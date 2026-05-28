import { afterEach, describe, expect, it, vi } from "vitest";
import { requestRemoteEmailCode } from "./remoteApi";

describe("remote API errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves JSON API error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "Email delivery rejected this address." }), { status: 400 })
      )
    );

    await expect(requestRemoteEmailCode("buyer@foxmail.com")).rejects.toThrow(
      "Email delivery rejected this address."
    );
  });

  it("maps non-JSON gateway failures to an actionable message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));

    await expect(requestRemoteEmailCode("buyer@foxmail.com")).rejects.toThrow(
      "Service is temporarily unavailable. Try again in a few minutes."
    );
  });
});
