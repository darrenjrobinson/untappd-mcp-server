import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _setRateLimitForTests } from "../../src/client.js";
import { registerGetUserBeerStats } from "../../src/tools/get-user-beer-stats.js";
import { registerGetUserBadgeSummary } from "../../src/tools/get-user-badge-summary.js";
import { registerGetUserStatsAtVenue } from "../../src/tools/get-user-stats-at-venue.js";
import { registerSearchVenueThenGetUserStats } from "../../src/tools/search-venue-then-get-user-stats.js";
import {
  captureTools,
  invokeTool,
  mockUntappd,
  setupEnv,
} from "../helpers.js";

beforeEach(setupEnv);
afterEach(() => vi.unstubAllGlobals());

function makeDistinctBeer(i: number, overrides: Record<string, unknown> = {}) {
  return {
    first_checkin_id: i,
    recent_checkin_id: i + 1000,
    first_created_at: "a",
    recent_created_at: "b",
    rating_score: 4,
    count: 1,
    beer: {
      bid: i,
      beer_name: `Beer ${i}`,
      beer_style: "IPA - American",
      rating_score: 3.5,
    },
    brewery: { brewery_id: 1, brewery_name: "Test Brewing" },
    ...overrides,
  };
}

function makeBadge(i: number) {
  return {
    badge_id: i,
    badge_name: `Badge ${i}`,
    badge_description: "desc",
    badge_image: { sm: "s", md: "m", lg: "l" },
    created_at: "2026-01-01",
    checkin_id: i,
  };
}

function makeCheckin(
  id: number,
  venueId: number | undefined,
  overrides: Record<string, unknown> = {}
) {
  return {
    checkin_id: id,
    created_at: `checkin-${id}`,
    rating_score: 4,
    checkin_comment: "",
    beer: { bid: 100, beer_name: "House IPA" },
    brewery: { brewery_id: 1, brewery_name: "Test Brewing" },
    user: { uid: 1, user_name: "tester" },
    venue: venueId
      ? { venue_id: venueId, venue_name: `Venue ${venueId}` }
      : undefined,
    ...overrides,
  };
}

describe("get_user_beer_stats", () => {
  it("aggregates styles, breweries, and ratings from a single page", async () => {
    const tool = captureTools(registerGetUserBeerStats)["get_user_beer_stats"];
    const items = [
      makeDistinctBeer(1, { rating_score: 5, count: 10 }),
      makeDistinctBeer(2, { rating_score: 3, count: 2 }),
      makeDistinctBeer(3, {
        rating_score: 0,
        beer: { bid: 3, beer_name: "Stout One", beer_style: "Stout - Imperial", rating_score: 4.5 },
        brewery: { brewery_id: 2, brewery_name: "Other Brewing" },
      }),
    ];
    const { calls } = mockUntappd([
      { payload: { total_count: 3, beers: { count: 3, items } } },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester" });

    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe("/v4/user/beers/tester");
    expect(calls[0].searchParams.get("limit")).toBe("50");
    expect(payload.total_distinct_beers).toBe(3);
    expect(payload.scanned_count).toBe(3);
    expect(payload.pages_fetched).toBe(1);
    expect(payload.truncated).toBe(false);
    expect(payload.top_styles[0]).toEqual({ name: "IPA - American", count: 2 });
    expect(payload.top_breweries[0]).toEqual({ name: "Test Brewing", count: 2 });
    expect(payload.avg_your_rating).toBe(4); // (5 + 3) / 2, zero ratings excluded
    expect(payload.avg_global_rating).toBe(3.83); // (3.5 + 3.5 + 4.5) / 3 rounded
    expect(payload.highest_rated_yours[0].your_rating).toBe(5);
    expect(payload.most_checked_in[0].times_checked_in).toBe(10);
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 87 });
  });

  it("paginates with offset until total_count is reached", async () => {
    const tool = captureTools(registerGetUserBeerStats)["get_user_beer_stats"];
    const page1 = Array.from({ length: 50 }, (_, i) => makeDistinctBeer(i));
    const page2 = Array.from({ length: 10 }, (_, i) => makeDistinctBeer(50 + i));
    const { calls } = mockUntappd([
      { payload: { total_count: 60, beers: { count: 50, items: page1 } } },
      { payload: { total_count: 60, beers: { count: 10, items: page2 } } },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester" });

    expect(calls).toHaveLength(2);
    expect(calls[0].searchParams.get("offset")).toBe("0");
    expect(calls[1].searchParams.get("offset")).toBe("50");
    expect(payload.scanned_count).toBe(60);
    expect(payload.truncated).toBe(false);
  });

  it("stops and marks truncated when the rate limit runs low", async () => {
    const tool = captureTools(registerGetUserBeerStats)["get_user_beer_stats"];
    const page1 = Array.from({ length: 50 }, (_, i) => makeDistinctBeer(i));
    const { calls } = mockUntappd([
      {
        payload: { total_count: 500, beers: { count: 50, items: page1 } },
        remaining: 1,
      },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester" });

    expect(calls).toHaveLength(1);
    expect(payload.truncated).toBe(true);
    expect(payload.scanned_count).toBe(50);
  });

  it("marks truncated when max_pages is hit with more data remaining", async () => {
    const tool = captureTools(registerGetUserBeerStats)["get_user_beer_stats"];
    const page = Array.from({ length: 50 }, (_, i) => makeDistinctBeer(i));
    mockUntappd([
      { payload: { total_count: 500, beers: { count: 50, items: page } } },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester", max_pages: 1 });

    expect(payload.truncated).toBe(true);
    expect(payload.pages_fetched).toBe(1);
  });

  it("throws before calling the API when the rate limit is exhausted", async () => {
    const tool = captureTools(registerGetUserBeerStats)["get_user_beer_stats"];
    _setRateLimitForTests({ limit: 100, remaining: 0 });
    const { calls } = mockUntappd([]);

    await expect(invokeTool(tool, { username: "tester" })).rejects.toThrow(
      "Insufficient rate limit"
    );
    expect(calls).toHaveLength(0);
  });
});

describe("get_user_badge_summary", () => {
  it("pages badges to completion and returns a slim summary", async () => {
    const tool = captureTools(registerGetUserBadgeSummary)["get_user_badge_summary"];
    const page1 = Array.from({ length: 50 }, (_, i) => makeBadge(i));
    const page2 = Array.from({ length: 7 }, (_, i) => makeBadge(50 + i));
    const { calls } = mockUntappd([
      { payload: { badges: { count: 50, items: page1 } } },
      { payload: { badges: { count: 7, items: page2 } } },
    ]);

    const { payload } = await invokeTool(tool, { username: "tester" });

    expect(calls).toHaveLength(2);
    expect(calls[0].pathname).toBe("/v4/user/badges/tester");
    expect(calls[1].searchParams.get("offset")).toBe("50");
    expect(payload.total_badges).toBe(57);
    expect(payload.recent_badges).toHaveLength(5);
    expect(payload.badges).toHaveLength(57);
    expect(payload.badges[0]).toEqual({
      badge_id: 0,
      badge_name: "Badge 0",
      badge_description: "desc",
      created_at: "2026-01-01",
      checkin_id: 0,
      badge_image_md: "m",
    });
    expect(payload.truncated).toBe(false);
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 87 });
  });

  it("throws before calling the API when the rate limit is exhausted", async () => {
    const tool = captureTools(registerGetUserBadgeSummary)["get_user_badge_summary"];
    _setRateLimitForTests({ limit: 100, remaining: 1 });
    const { calls } = mockUntappd([]);

    await expect(invokeTool(tool, { username: "tester" })).rejects.toThrow(
      "Insufficient rate limit"
    );
    expect(calls).toHaveLength(0);
  });
});

describe("get_user_stats_at_venue", () => {
  it("works without an access token (public checkin feed)", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    const { calls } = mockUntappd([
      { payload: { checkins: { count: 1, items: [makeCheckin(1, 9)] } } },
    ]);

    const { payload } = await invokeTool(tool, { venue_id: 9, username: "tester" });

    expect(calls[0].pathname).toBe("/v4/user/checkins/tester");
    expect(calls[0].searchParams.get("client_id")).toBe("test-client-id");
    expect(payload.found).toBe(true);
  });

  it("aggregates stats from matching check-ins in the scanned window", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    const items = [
      makeCheckin(30, 9, { rating_score: 5 }),
      makeCheckin(29, 5),
      makeCheckin(28, 9, {
        rating_score: 3,
        beer: { bid: 200, beer_name: "Stout One" },
      }),
      makeCheckin(27, 9, { rating_score: 0 }),
      makeCheckin(26, undefined),
    ];
    const { calls } = mockUntappd([
      { payload: { checkins: { count: 5, items } } },
    ]);

    const { payload } = await invokeTool(tool, { venue_id: 9, username: "tester" });

    expect(calls[0].searchParams.get("limit")).toBe("25");
    expect(payload.found).toBe(true);
    expect(payload.stats.venue_name).toBe("Venue 9");
    expect(payload.stats.checkins_at_venue).toBe(3);
    expect(payload.stats.last_visit).toBe("checkin-30");
    expect(payload.stats.earliest_scanned_visit).toBe("checkin-27");
    expect(payload.stats.avg_rating).toBe(4); // (5 + 3) / 2, zero rating excluded
    expect(payload.stats.top_beers[0]).toEqual({
      bid: 100,
      beer_name: "House IPA",
      count: 2,
    });
    expect(payload.checkins_scanned).toBe(5);
    expect(payload.truncated).toBe(false);
    expect(payload.username).toBe("tester");
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 87 });
  });

  it("paginates with max_id until the feed ends", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    const page1 = Array.from({ length: 25 }, (_, i) => makeCheckin(100 - i, 5));
    const page2 = [makeCheckin(50, 9)];
    const { calls } = mockUntappd([
      {
        payload: {
          checkins: {
            count: 25,
            items: page1,
            pagination: { since_url: "s", next_url: "n", max_id: 76 },
          },
        },
      },
      { payload: { checkins: { count: 1, items: page2 } } },
    ]);

    const { payload } = await invokeTool(tool, { venue_id: 9, username: "tester" });

    expect(calls).toHaveLength(2);
    expect(calls[0].searchParams.has("max_id")).toBe(false);
    expect(calls[1].searchParams.get("max_id")).toBe("76");
    expect(payload.found).toBe(true);
    expect(payload.checkins_scanned).toBe(26);
  });

  it("reports not found with a windowed note when max_pages is hit", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    const page = Array.from({ length: 25 }, (_, i) => makeCheckin(100 - i, 5));
    mockUntappd([
      {
        payload: {
          checkins: {
            count: 25,
            items: page,
            pagination: { since_url: "s", next_url: "n", max_id: 76 },
          },
        },
      },
    ]);

    const { payload } = await invokeTool(tool, {
      venue_id: 9,
      username: "tester",
      max_pages: 1,
    });

    expect(payload.found).toBe(false);
    expect(payload.truncated).toBe(true);
    expect(payload.note).toContain("25 most recent check-ins");
    expect(payload.note).toContain("raise max_pages");
  });

  it("throws before calling the API when the rate limit is exhausted", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    _setRateLimitForTests({ limit: 100, remaining: 1 });
    const { calls } = mockUntappd([]);

    await expect(
      invokeTool(tool, { venue_id: 9, username: "tester" })
    ).rejects.toThrow("Insufficient rate limit");
    expect(calls).toHaveLength(0);
  });
});

describe("search_venue_then_get_user_stats", () => {
  it("searches, takes the top match, then computes stats (no token needed)", async () => {
    const tool = captureTools(registerSearchVenueThenGetUserStats)[
      "search_venue_then_get_user_stats"
    ];
    const matched = {
      venue_id: 9,
      venue_name: "Venue 9",
      location: { venue_city: "Sydney" },
    };
    const { calls } = mockUntappd([
      { payload: { venues: { count: 1, items: [{ venue: matched }] } } },
      { payload: { checkins: { count: 1, items: [makeCheckin(1, 9)] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Venue 9", username: "tester" });

    expect(calls[0].pathname).toBe("/v4/search/venue");
    expect(calls[1].pathname).toBe("/v4/user/checkins/tester");
    expect(payload.matched_venue).toEqual({
      venue_id: 9,
      venue_name: "Venue 9",
      location: { venue_city: "Sydney" },
    });
    expect(payload.found).toBe(true);
    expect(payload.stats.checkins_at_venue).toBe(1);
  });

  it("falls back to UNTAPPD_USERNAME when username is omitted", async () => {
    process.env.UNTAPPD_USERNAME = "envuser";
    const tool = captureTools(registerSearchVenueThenGetUserStats)[
      "search_venue_then_get_user_stats"
    ];
    const matched = { venue_id: 9, venue_name: "Venue 9", location: {} };
    const { calls } = mockUntappd([
      { payload: { venues: { count: 1, items: [{ venue: matched }] } } },
      { payload: { checkins: { count: 0, items: [] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Venue 9" });

    expect(calls[1].pathname).toBe("/v4/user/checkins/envuser");
    expect(payload.username).toBe("envuser");
  });

  it("returns a clear note when no venue matches", async () => {
    const tool = captureTools(registerSearchVenueThenGetUserStats)[
      "search_venue_then_get_user_stats"
    ];
    const { calls } = mockUntappd([
      { payload: { venues: { count: 0, items: [] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Nowhere", username: "tester" });

    expect(calls).toHaveLength(1);
    expect(payload.matched_venue).toBeNull();
    expect(payload.note).toBe('No venue matched "Nowhere"');
  });
});
