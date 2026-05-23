import { readState, reserveListingInDb, type Env } from "../_shared/db";
import { handleApi, jsonResponse, readJson } from "../_shared/http";

type CreateReservationBody = {
  listingId: string;
  buyerId: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) =>
  handleApi(async () => {
    const body = await readJson<CreateReservationBody>(request);
    await reserveListingInDb(env.DB, body.listingId, body.buyerId);
    return jsonResponse(await readState(env.DB, body.buyerId), { status: 201 });
  });

