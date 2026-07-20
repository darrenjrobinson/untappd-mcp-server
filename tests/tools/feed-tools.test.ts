import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGetGlobalFeed } from "../../src/tools/get-global-feed.js";
import { registerGetLocalFeed } from "../../src/tools/get-local-feed.js";
import { registerGetFriendFeed } from "../../src/tools/get-friend-feed.js";
import { registerGetCheckinInfo } from "../../src/tools/get-checkin-info.js";
import {
  DEFAULT_RATE_LIMIT,
  FEED_RESPONSE,
  captureTools,
  expectFeedPayload,
  invokeTool,
  mockUntappd,
  setupEnv,
} from "../helpers.js";

beforeEach(setupEnv);
afterEach(() => vi.unstubAllGlobals());

describe("get_global_feed", () => {
  it("calls /thepub and returns the feed shape", async () => {
    const tool = captureTools(registerGetGlobalFeed)["get_global_feed"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { limit: 10, min_id: 100 });

    expect(calls[0].pathname).toBe("/v4/thepub");
    expect(calls[0].searchParams.get("min_id")).toBe("100");
    expectFeedPayload(payload);
  });
});

describe("get_local_feed", () => {
  it("calls /thepub/local with lat/lng/radius", async () => {
    const tool = captureTools(registerGetLocalFeed)["get_local_feed"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, {
      lat: -33.87,
      lng: 151.21,
      radius: 10,
      limit: 5,
    });

    expect(calls[0].pathname).toBe("/v4/thepub/local");
    expect(calls[0].searchParams.get("lat")).toBe("-33.87");
    expect(calls[0].searchParams.get("lng")).toBe("151.21");
    expect(calls[0].searchParams.get("radius")).toBe("10");
    expectFeedPayload(payload);
  });

  it("requires lat and lng", async () => {
    const tool = captureTools(registerGetLocalFeed)["get_local_feed"];
    mockUntappd([]);
    await expect(invokeTool(tool, { lat: -33.87 })).rejects.toThrow();
  });
});

describe("get_friend_feed", () => {
  it("throws without UNTAPPD_ACCESS_TOKEN", async () => {
    const tool = captureTools(registerGetFriendFeed)["get_friend_feed"];
    mockUntappd([]);
    await expect(invokeTool(tool, {})).rejects.toThrow(
      "UNTAPPD_ACCESS_TOKEN is required for get_friend_feed"
    );
  });

  it("calls /checkin/recent with token auth", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const tool = captureTools(registerGetFriendFeed)["get_friend_feed"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { limit: 5 });

    expect(calls[0].pathname).toBe("/v4/checkin/recent");
    expect(calls[0].searchParams.get("access_token")).toBe("test-token");
    expectFeedPayload(payload);
    expect(payload.warning).toBeUndefined();
  });

  it("includes a warning when remaining rate limit is low", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const tool = captureTools(registerGetFriendFeed)["get_friend_feed"];
    mockUntappd([{ payload: FEED_RESPONSE, remaining: 3 }]);

    const { payload } = await invokeTool(tool, {});

    expect(payload.warning).toBe("Only 3 API calls remaining this hour");
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 3 });
  });
});

describe("get_checkin_info", () => {
  it("calls /checkin/view/:id and returns the extended checkin", async () => {
    const tool = captureTools(registerGetCheckinInfo)["get_checkin_info"];
    const checkin = {
      checkin_id: 42,
      badges: { count: 1, items: [{ badge_id: 1 }] },
      toasts: { count: 2, items: [] },
      comments: { count: 0, items: [] },
    };
    const { calls } = mockUntappd([{ payload: { checkin } }]);

    const { payload } = await invokeTool(tool, { checkin_id: 42 });

    expect(calls[0].pathname).toBe("/v4/checkin/view/42");
    expect(payload.checkin).toEqual(checkin);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});
