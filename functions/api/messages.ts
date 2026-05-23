import { readState, sendMessageInDb, type Env } from "../_shared/db";
import { handleApi, jsonResponse, readJson } from "../_shared/http";

type SendMessageBody = {
  reservationId: string;
  senderId: string;
  body: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) =>
  handleApi(async () => {
    const body = await readJson<SendMessageBody>(request);
    await sendMessageInDb(env.DB, body.reservationId, body.senderId, body.body);
    return jsonResponse(await readState(env.DB, body.senderId), { status: 201 });
  });

