import { readState, updateReservationStatusInDb, type Env } from "../../../_shared/db";
import { handleApi, jsonResponse, readJson } from "../../../_shared/http";
import type { ReservationStatus } from "../../../../src/data/types";

type UpdateReservationStatusBody = {
  actorId: string;
  status: ReservationStatus;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) =>
  handleApi(async () => {
    const body = await readJson<UpdateReservationStatusBody>(request);
    await updateReservationStatusInDb(env.DB, String(params.id), body.actorId, body.status);
    return jsonResponse(await readState(env.DB, body.actorId));
  });

