import { createListingInDb, readState, type Env } from "../_shared/db";
import { handleApi, jsonResponse, readJson } from "../_shared/http";
import type { ListingDraft } from "../../src/data/types";

type CreateListingBody = {
  sellerId: string;
  draft: ListingDraft;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) =>
  handleApi(async () => {
    const body = await readJson<CreateListingBody>(request);
    await createListingInDb(env.DB, body.sellerId, body.draft);
    return jsonResponse(await readState(env.DB, body.sellerId), { status: 201 });
  });

