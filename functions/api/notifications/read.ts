import { markNotificationsReadInDb, readState, type Env } from "../../_shared/db";
import { handleApi, jsonResponse, readJson } from "../../_shared/http";

type MarkNotificationsReadBody = {
  userId: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) =>
  handleApi(async () => {
    const body = await readJson<MarkNotificationsReadBody>(request);
    await markNotificationsReadInDb(env.DB, body.userId);
    return jsonResponse(await readState(env.DB, body.userId));
  });

