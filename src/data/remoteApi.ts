import type { AppState, ListingDraft, ReservationStatus } from "./types";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchRemoteState(activeUserId: string): Promise<AppState> {
  return apiRequest<AppState>(`/api/state?activeUserId=${encodeURIComponent(activeUserId)}`);
}

export async function createRemoteListing(sellerId: string, draft: ListingDraft): Promise<AppState> {
  return apiRequest<AppState>("/api/listings", {
    method: "POST",
    body: JSON.stringify({ sellerId, draft })
  });
}

export async function reserveRemoteListing(listingId: string, buyerId: string): Promise<AppState> {
  return apiRequest<AppState>("/api/reservations", {
    method: "POST",
    body: JSON.stringify({ listingId, buyerId })
  });
}

export async function sendRemoteMessage(
  reservationId: string,
  senderId: string,
  body: string
): Promise<AppState> {
  return apiRequest<AppState>("/api/messages", {
    method: "POST",
    body: JSON.stringify({ reservationId, senderId, body })
  });
}

export async function updateRemoteReservationStatus(
  reservationId: string,
  actorId: string,
  status: ReservationStatus
): Promise<AppState> {
  return apiRequest<AppState>(`/api/reservations/${encodeURIComponent(reservationId)}/status`, {
    method: "POST",
    body: JSON.stringify({ actorId, status })
  });
}

export async function markRemoteNotificationsRead(userId: string): Promise<AppState> {
  return apiRequest<AppState>("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify({ userId })
  });
}

