import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  _setRateLimitForTests,
  assertRateLimitSufficient,
  checkAuthRequired,
  getRateLimit,
  resolveUsername,
  untappdFetch,
} from "../src/client.js";
import { mockUntappd, setupEnv } from "./helpers.js";

beforeEach(setupEnv);
afterEach(() => vi.unstubAllGlobals());

describe("untappdFetch auth modes", () => {
  it("uses client_id/client_secret in auto mode without a token", async () => {
    const { calls } = mockUntappd([{ payload: {} }]);
    await untappdFetch("/beer/info/1");
    expect(calls[0].searchParams.get("client_id")).toBe("test-client-id");
    expect(calls[0].searchParams.get("client_secret")).toBe("test-client-secret");
    expect(calls[0].searchParams.get("access_token")).toBeNull();
  });

  it("prefers access_token in auto mode when configured", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const { calls } = mockUntappd([{ payload: {} }]);
    await untappdFetch("/beer/info/1");
    expect(calls[0].searchParams.get("access_token")).toBe("test-token");
    expect(calls[0].searchParams.get("client_id")).toBeNull();
    expect(calls[0].searchParams.get("client_secret")).toBeNull();
  });

  it("token mode sends access_token", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const { calls } = mockUntappd([{ payload: {} }]);
    await untappdFetch("/checkin/recent", {}, { auth: "token" });
    expect(calls[0].searchParams.get("access_token")).toBe("test-token");
  });

  it("token mode throws without UNTAPPD_ACCESS_TOKEN", async () => {
    mockUntappd([{ payload: {} }]);
    await expect(
      untappdFetch("/checkin/recent", {}, { auth: "token" })
    ).rejects.toThrow("UNTAPPD_ACCESS_TOKEN is required");
  });

  it("throws a clear error when no credentials are configured", async () => {
    delete process.env.UNTAPPD_CLIENT_ID;
    delete process.env.UNTAPPD_CLIENT_SECRET;
    mockUntappd([{ payload: {} }]);
    await expect(untappdFetch("/beer/info/1")).rejects.toThrow(
      "Untappd credentials required: set UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, or UNTAPPD_ACCESS_TOKEN"
    );
  });

  it("omits undefined params and stringifies the rest", async () => {
    const { calls } = mockUntappd([{ payload: {} }]);
    await untappdFetch("/thepub", { limit: 5, max_id: undefined });
    expect(calls[0].searchParams.get("limit")).toBe("5");
    expect(calls[0].searchParams.has("max_id")).toBe(false);
  });
});

describe("untappdFetch errors and rate limit capture", () => {
  it("captures rate limit headers and returns them", async () => {
    mockUntappd([{ payload: {}, remaining: 42 }]);
    const { rateLimit } = await untappdFetch("/beer/info/1");
    expect(rateLimit).toEqual({ limit: 100, remaining: 42 });
    expect(getRateLimit()).toEqual({ limit: 100, remaining: 42 });
  });

  it("maps 401 to a credentials error", async () => {
    mockUntappd([{ status: 401 }]);
    await expect(untappdFetch("/beer/info/1")).rejects.toThrow(
      "Invalid API credentials"
    );
  });

  it("maps 404 to resource not found", async () => {
    mockUntappd([{ status: 404 }]);
    await expect(untappdFetch("/beer/info/1")).rejects.toThrow(
      "Resource not found"
    );
  });

  it("maps 429 to a rate limit error", async () => {
    mockUntappd([{ status: 429, remaining: 0 }]);
    await expect(untappdFetch("/beer/info/1")).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});

describe("helpers", () => {
  it("checkAuthRequired throws without a token and passes with one", () => {
    expect(() => checkAuthRequired("get_friend_feed")).toThrow(
      "UNTAPPD_ACCESS_TOKEN is required for get_friend_feed"
    );
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    expect(() => checkAuthRequired("get_friend_feed")).not.toThrow();
  });

  it("assertRateLimitSufficient throws below the threshold", () => {
    _setRateLimitForTests({ limit: 100, remaining: 3 });
    expect(() => assertRateLimitSufficient(5)).toThrow(
      "Insufficient rate limit: 3 calls remaining, at least 5 needed"
    );
    expect(() => assertRateLimitSufficient(2)).not.toThrow();
  });

  it("resolveUsername falls back to UNTAPPD_USERNAME and throws when neither is set", () => {
    expect(() => resolveUsername(undefined, "tool_x")).toThrow(
      "tool_x requires a username parameter or the UNTAPPD_USERNAME env var"
    );
    process.env.UNTAPPD_USERNAME = "envuser";
    expect(resolveUsername(undefined, "tool_x")).toBe("envuser");
    expect(resolveUsername("explicit", "tool_x")).toBe("explicit");
  });
});
