import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerVenueSearch } from "../../src/tools/venue-search.js";
import { registerSearchBrewery } from "../../src/tools/search-brewery.js";
import { registerSearchBeer } from "../../src/tools/search-beer.js";
import {
  DEFAULT_RATE_LIMIT,
  captureTools,
  invokeTool,
  mockUntappd,
  setupEnv,
} from "../helpers.js";

beforeEach(setupEnv);
afterEach(() => vi.unstubAllGlobals());

describe("venue_search", () => {
  it("calls /search/venue and unwraps venue items", async () => {
    const tool = captureTools(registerVenueSearch)["venue_search"];
    const venue = { venue_id: 1, venue_name: "Test Bar" };
    const { calls } = mockUntappd([
      { payload: { venues: { count: 1, items: [{ venue }] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Test Bar", lat: -33.87, lng: 151.21 });

    expect(calls[0].pathname).toBe("/v4/search/venue");
    expect(calls[0].searchParams.get("q")).toBe("Test Bar");
    expect(calls[0].searchParams.get("lat")).toBe("-33.87");
    expect(payload.venues).toEqual([venue]);
    expect(payload.count).toBe(1);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("search_brewery", () => {
  it("calls /search/brewery and unwraps brewery items", async () => {
    const tool = captureTools(registerSearchBrewery)["search_brewery"];
    const brewery = { brewery_id: 2, brewery_name: "Test Brewing" };
    const { calls } = mockUntappd([
      { payload: { brewery: { count: 1, items: [{ brewery }] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "Test Brewing", offset: 10 });

    expect(calls[0].pathname).toBe("/v4/search/brewery");
    expect(calls[0].searchParams.get("offset")).toBe("10");
    expect(payload.breweries).toEqual([brewery]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("search_beer", () => {
  it("calls /search/beer with sort and returns items", async () => {
    const tool = captureTools(registerSearchBeer)["search_beer"];
    const item = { checkin_count: 5, beer: { bid: 3 }, brewery: { brewery_id: 2 } };
    const { calls } = mockUntappd([
      { payload: { beers: { count: 1, items: [item] } } },
    ]);

    const { payload } = await invokeTool(tool, { q: "IPA", sort: "count" });

    expect(calls[0].pathname).toBe("/v4/search/beer");
    expect(calls[0].searchParams.get("sort")).toBe("count");
    expect(payload.beers).toEqual([item]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });

  it("rejects an invalid sort value via the zod schema", async () => {
    const tool = captureTools(registerSearchBeer)["search_beer"];
    mockUntappd([]);
    await expect(invokeTool(tool, { q: "IPA", sort: "bogus" })).rejects.toThrow();
  });
});
