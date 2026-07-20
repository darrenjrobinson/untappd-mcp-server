import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGetUserInfo } from "../../src/tools/get-user-info.js";
import { registerGetUserActivity } from "../../src/tools/get-user-activity.js";
import { registerGetUserVenueHistory } from "../../src/tools/get-user-venue-history.js";
import { registerGetUserDistinctBeers } from "../../src/tools/get-user-distinct-beers.js";
import { registerGetUserWishlist } from "../../src/tools/get-user-wishlist.js";
import { registerGetUserBadges } from "../../src/tools/get-user-badges.js";
import { registerGetUserFriends } from "../../src/tools/get-user-friends.js";
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

describe("get_user_info", () => {
  it("calls /user/info/:username with URL encoding", async () => {
    const tool = captureTools(registerGetUserInfo)["get_user_info"];
    const user = { user_name: "test user" };
    const { calls } = mockUntappd([{ payload: { user } }]);

    const { payload } = await invokeTool(tool, { username: "test user" });

    expect(calls[0].pathname).toBe("/v4/user/info/test%20user");
    expect(payload.user).toEqual(user);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_user_activity", () => {
  it("calls /user/checkins/:username and returns the feed shape", async () => {
    const tool = captureTools(registerGetUserActivity)["get_user_activity"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { username: "tester", limit: 5 });

    expect(calls[0].pathname).toBe("/v4/user/checkins/tester");
    expect(calls[0].searchParams.get("limit")).toBe("5");
    expectFeedPayload(payload);
  });
});

describe("get_user_venue_history", () => {
  it("throws without UNTAPPD_ACCESS_TOKEN", async () => {
    const tool = captureTools(registerGetUserVenueHistory)["get_user_venue_history"];
    mockUntappd([]);
    await expect(invokeTool(tool, { username: "tester" })).rejects.toThrow(
      "access token is required for get_user_venue_history"
    );
  });

  it("uses token auth and falls back to UNTAPPD_USERNAME", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    process.env.UNTAPPD_USERNAME = "envuser";
    const tool = captureTools(registerGetUserVenueHistory)["get_user_venue_history"];
    const venueItem = {
      venue: { venue_id: 9, venue_name: "Local" },
      first_checkin_id: 1,
      last_checkin_id: 2,
      total_count: 3,
      first_created_at: "a",
      last_created_at: "b",
    };
    const { calls } = mockUntappd([
      { payload: { venues: { count: 1, items: [venueItem] } } },
    ]);

    const { payload } = await invokeTool(tool, { limit: 25 });

    expect(calls[0].pathname).toBe("/v4/user/venue_history/envuser");
    expect(calls[0].searchParams.get("access_token")).toBe("test-token");
    expect(payload.count).toBe(1);
    expect(payload.venues).toEqual([venueItem]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_user_distinct_beers", () => {
  it("calls /user/beers/:username with sort and surfaces total_count", async () => {
    const tool = captureTools(registerGetUserDistinctBeers)["get_user_distinct_beers"];
    const item = { count: 4, rating_score: 4.5, beer: { bid: 1 }, brewery: {} };
    const { calls } = mockUntappd([
      { payload: { total_count: 321, beers: { count: 1, items: [item] } } },
    ]);

    const { payload } = await invokeTool(tool, {
      username: "tester",
      sort: "highest_rated_you",
      limit: 1,
    });

    expect(calls[0].pathname).toBe("/v4/user/beers/tester");
    expect(calls[0].searchParams.get("sort")).toBe("highest_rated_you");
    expect(payload.total_count).toBe(321);
    expect(payload.items).toEqual([item]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_user_wishlist", () => {
  it("calls /user/wishlist/:username with sort", async () => {
    const tool = captureTools(registerGetUserWishlist)["get_user_wishlist"];
    const item = { created_at: "x", beer: { bid: 1 }, brewery: {} };
    const { calls } = mockUntappd([
      { payload: { beers: { count: 1, items: [item] } } },
    ]);

    const { payload } = await invokeTool(tool, {
      username: "tester",
      sort: "highest_rated",
    });

    expect(calls[0].pathname).toBe("/v4/user/wishlist/tester");
    expect(calls[0].searchParams.get("sort")).toBe("highest_rated");
    expect(payload.count).toBe(1);
    expect(payload.items).toEqual([item]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_user_badges", () => {
  it("calls /user/badges/:username with offset", async () => {
    const tool = captureTools(registerGetUserBadges)["get_user_badges"];
    const badge = { badge_id: 1, badge_name: "IPA Day", badge_image: { sm: "", md: "", lg: "" } };
    const { calls } = mockUntappd([
      { payload: { badges: { count: 1, items: [badge] } } },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester", offset: 50 });

    expect(calls[0].pathname).toBe("/v4/user/badges/tester");
    expect(calls[0].searchParams.get("offset")).toBe("50");
    expect(payload.badges).toEqual([badge]);
    expect(payload.offset).toBe(50);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_user_friends", () => {
  it("calls /user/friends/:username and flattens friend items", async () => {
    const tool = captureTools(registerGetUserFriends)["get_user_friends"];
    const user = { uid: 1, user_name: "friend1", first_name: "F", last_name: "One" };
    const { calls } = mockUntappd([
      {
        payload: {
          found: 42,
          items: [{ friendship_hash: "h", created_at: "2020-01-01", user }],
        },
      },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester", limit: 25 });

    expect(calls[0].pathname).toBe("/v4/user/friends/tester");
    expect(payload.total_count).toBe(42);
    expect(payload.friends).toEqual([{ ...user, friend_since: "2020-01-01" }]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});
