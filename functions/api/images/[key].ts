import type { Env } from "../../_shared/db";
import { errorResponse, handleApi } from "../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) =>
  handleApi(async () => {
    if (!env.LISTING_IMAGES) {
      return errorResponse("Image storage is not configured.", 500);
    }

    const object = await env.LISTING_IMAGES.get(String(params.key));
    if (!object) {
      return errorResponse("Image not found.", 404);
    }

    return new Response(object.body, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": object.httpMetadata?.contentType ?? "application/octet-stream"
      }
    });
  });

