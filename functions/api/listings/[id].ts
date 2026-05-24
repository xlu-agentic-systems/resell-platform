import { requireCurrentUser } from "../../_shared/auth";
import { readState, updateListingInDb, type Env } from "../../_shared/db";
import { handleApi, jsonResponse, readJson } from "../../_shared/http";
import type { ListingDraft } from "../../../src/data/types";

type UpdateListingBody = {
  draft: ListingDraft;
};

export const onRequestPatch: PagesFunction<Env> = async ({ env, params, request }) =>
  handleApi(async () => {
    const user = await requireCurrentUser(request, env);
    const body = await readJson<UpdateListingBody>(request);
    await updateListingInDb(env, String(params.id), user.id, body.draft);
    return jsonResponse(await readState(env.DB, user));
  });
