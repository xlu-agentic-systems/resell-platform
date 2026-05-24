import type { User } from "../../src/data/types";
import { createId, type Env } from "./db";
import { ApiError, jsonResponse } from "./http";

const SESSION_COOKIE = "resell_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type CurrentUser = User & {
  email?: string;
  emailVerifiedAt?: string;
  phoneE164?: string;
  phoneVerifiedAt?: string;
  avatarUrl?: string;
  bio?: string;
  pickupArea?: string;
};

type CurrentUserRow = {
  id: string;
  name: string;
  role: User["role"];
  email?: string | null;
  email_verified_at?: string | null;
  phone_e164?: string | null;
  phone_verified_at?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  pickup_area?: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at?: string | null;
};

type ChallengeRow = {
  id: string;
  email_normalized: string;
  display_name?: string | null;
  code_hash: string;
  expires_at: string;
  consumed_at?: string | null;
  attempts: number;
};

export async function requestEmailCode(env: Env, email: string, displayName?: string, includeCode = false) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    throw new ApiError("Enter a valid email address.");
  }

  const code = createCode();
  const now = new Date();
  await env.DB.prepare(
    `INSERT INTO auth_challenges (
      id, email_normalized, display_name, code_hash, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      createId("challenge"),
      normalizedEmail,
      displayName?.trim() || null,
      await hashSecret(`${normalizedEmail}:${code}`),
      new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(),
      now.toISOString()
    )
    .run();

  // MVP delivery shim: replace this with a transactional email provider before public launch.
  console.log(`Verification code for ${normalizedEmail}: ${code}`);

  return {
    email: normalizedEmail,
    delivery: includeCode ? "development_response" : "email",
    verificationCode: includeCode ? code : undefined
  };
}

export async function verifyEmailCode(
  env: Env,
  email: string,
  code: string,
  displayName?: string,
  secureCookie = true
) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  const challenge = await env.DB.prepare(
    `SELECT * FROM auth_challenges
     WHERE email_normalized = ?
       AND consumed_at IS NULL
       AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(normalizedEmail, now)
    .first<ChallengeRow>();

  if (!challenge || challenge.attempts >= 5) {
    throw new ApiError("Verification code is invalid or expired.", 401);
  }

  const expectedHash = await hashSecret(`${normalizedEmail}:${code.trim()}`);
  if (expectedHash !== challenge.code_hash) {
    await env.DB.prepare("UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?")
      .bind(challenge.id)
      .run();
    throw new ApiError("Verification code is invalid or expired.", 401);
  }

  let user = await env.DB.prepare("SELECT * FROM users WHERE email_normalized = ?")
    .bind(normalizedEmail)
    .first<CurrentUserRow>();
  if (!user) {
    const userId = createId("user");
    const name = displayName?.trim() || challenge.display_name?.trim() || normalizedEmail.split("@")[0];
    await env.DB.prepare(
      `INSERT INTO users (
        id, name, role, email, email_normalized, email_verified_at, bio, pickup_area, created_at, updated_at
      ) VALUES (?, ?, 'buyer', ?, ?, ?, '', '', ?, ?)`
    )
      .bind(userId, name, normalizedEmail, normalizedEmail, now, now, now)
      .run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<CurrentUserRow>();
  } else {
    await env.DB.prepare(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ?
       WHERE id = ?`
    )
      .bind(now, now, user.id)
      .run();
  }

  if (!user) {
    throw new ApiError("Could not create account.", 500);
  }

  await env.DB.prepare("UPDATE auth_challenges SET consumed_at = ? WHERE id = ?").bind(now, challenge.id).run();

  const token = crypto.randomUUID();
  const sessionId = createId("session");
  await env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      sessionId,
      user.id,
      await hashSecret(token),
      new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
      now,
      now
    )
    .run();

  return {
    user: toCurrentUser({
      ...user,
      email: normalizedEmail,
      email_verified_at: user.email_verified_at ?? now
    }),
    cookie: createSessionCookie(token, SESSION_MAX_AGE_SECONDS, secureCookie)
  };
}

export async function getOptionalCurrentUser(request: Request, env: Env): Promise<CurrentUser | undefined> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return undefined;

  const tokenHash = await hashSecret(token);
  const session = await env.DB.prepare(
    `SELECT id, user_id, expires_at, revoked_at
     FROM auth_sessions
     WHERE token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > ?`
  )
    .bind(tokenHash, new Date().toISOString())
    .first<SessionRow>();
  if (!session) return undefined;

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(session.user_id).first<CurrentUserRow>();
  if (!user) return undefined;

  await env.DB.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), session.id)
    .run();

  return toCurrentUser(user);
}

export async function requireCurrentUser(request: Request, env: Env): Promise<CurrentUser> {
  const user = await getOptionalCurrentUser(request, env);
  if (!user) {
    throw new ApiError("Log in to continue.", 401);
  }
  return user;
}

export async function logout(request: Request, env: Env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?")
      .bind(new Date().toISOString(), await hashSecret(token))
      .run();
  }
  return jsonResponse({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}

export async function updateCurrentUserProfile(
  env: Env,
  userId: string,
  draft: { displayName: string; bio?: string; pickupArea?: string; phoneE164?: string }
) {
  const displayName = draft.displayName.trim();
  if (!displayName) throw new ApiError("Display name is required.");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE users
     SET name = ?, bio = ?, pickup_area = ?, phone_e164 = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      displayName,
      draft.bio?.trim() ?? "",
      draft.pickupArea?.trim() ?? "",
      draft.phoneE164?.trim() || null,
      now,
      userId
    )
    .run();
}

export function toPublicUser(user: CurrentUser | User) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    emailVerifiedAt: "emailVerifiedAt" in user ? user.emailVerifiedAt : undefined,
    phoneVerifiedAt: "phoneVerifiedAt" in user ? user.phoneVerifiedAt : undefined,
    pickupArea: "pickupArea" in user ? user.pickupArea : undefined,
    bio: "bio" in user ? user.bio : undefined,
    avatarUrl: "avatarUrl" in user ? user.avatarUrl : undefined
  };
}

function toCurrentUser(row: CurrentUserRow): CurrentUser {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email ?? undefined,
    emailVerifiedAt: row.email_verified_at ?? undefined,
    phoneE164: row.phone_e164 ?? undefined,
    phoneVerifiedAt: row.phone_verified_at ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    pickupArea: row.pickup_area ?? undefined
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

async function hashSecret(secret: string) {
  const input = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function createSessionCookie(token: string, maxAge: number, secure: boolean) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
