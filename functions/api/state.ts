import { readState, type Env } from "../_shared/db";
import { handleApi, jsonResponse } from "../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) =>
  handleApi(async () => {
    const activeUserId = new URL(request.url).searchParams.get("activeUserId") ?? undefined;
    return jsonResponse(await readState(env.DB, activeUserId));
  });

