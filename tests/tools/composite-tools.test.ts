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

function makeVenueHistoryItem(venueId: number) {
  return {
    venue: { venue_id: venueId, venue_name: `Venue ${venueId}` },
    first_checkin_id: 10,
    last_checkin_id: 20,
    total_count: 7,
    first_created_at: "2025-01-01",
    last_created_at: "2026-07-01",
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
  it("throws without UNTAPPD_ACCESS_TOKEN", async () => {
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    mockUntappd([]);
    await expect(
      invokeTool(tool, { venue_id: 9, username: "tester" })
    ).rejects.toThrow("UNTAPPD_ACCESS_TOKEN is required for get_user_stats_at_venue");
  });

  it("finds the venue in history and returns stats", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    const { calls } = mockUntappd([
      {
        payload: {
          venues: {
            count: 2,
            items: [makeVenueHistoryItem(5), makeVenueHistoryItem(9)],
          },
        },
      },
    ]);

    const { payload } = await invokeTool(tool, { venue_id: 9, username: "tester" });

    expect(calls[0].pathname).toBe("/v4/user/venue_history/tester");
    expect(calls[0].searchParams.get("access_token")).toBe("test-token");
    expect(payload.found).toBe(true);
    expect(payload.stats).toEqual({
      venue_id: 9,
      venue_name: "Venue 9",
      total_checkins_at_venue: 7,
      first_visit: "2025-01-01",
      last_visit: "2026-07-01",
      first_checkin_id: 10,
      last_checkin_id: 20,
    });
    expect(payload.username).toBe("tester");
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 87 });
  });

  it("reports not found after scanning all history", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
    const tool = captureTools(registerGetUserStatsAtVenue)["get_user_stats_at_venue"];
    mockUntappd([
      { payload: { venues: { count: 1, items: [makeVenueHistoryItem(5)] } } },
    ]);

    const { payload } = await invokeTool(tool, { venue_id: 9, username: "tester" });

    expect(payload.found).toBe(false);
    expect(payload.venues_scanned).toBe(1);
    expect(payload.note).toContain("not found");
  });
});

describe("search_venue_then_get_user_stats", () => {
  it("throws without UNTAPPD_ACCESS_TOKEN", async () => {
    const tool = captureTools(registerSearchVenueThenGetUserStats)[
      "search_venue_then_get_user_stats"
    ];
    mockUntappd([]);
    await expect(
      invokeTool(tool, { q: "Test Venue", username: "tester" })
    ).rejects.toThrow(
      "UNTAPPD_ACCESS_TOKEN is required for search_venue_then_get_user_stats"
    );
  });

  it("searches, takes the top match, then computes stats", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
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
      { payload: { venues: { count: 1, items: [makeVenueHistoryItem(9)] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Venue 9", username: "tester" });

    expect(calls[0].pathname).toBe("/v4/search/venue");
    expect(calls[1].pathname).toBe("/v4/user/venue_history/tester");
    expect(payload.matched_venue).toEqual({
      venue_id: 9,
      venue_name: "Venue 9",
      location: { venue_city: "Sydney" },
    });
    expect(payload.found).toBe(true);
    expect(payload.stats.total_checkins_at_venue).toBe(7);
  });

  it("returns a clear note when no venue matches", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "test-token";
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
