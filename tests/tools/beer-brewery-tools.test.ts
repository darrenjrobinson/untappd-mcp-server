import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGetBeerInfo } from "../../src/tools/get-beer-info.js";
import { registerGetBeerCheckins } from "../../src/tools/get-beer-checkins.js";
import { registerGetTrendingBeers } from "../../src/tools/get-trending-beers.js";
import { registerGetBreweryInfo } from "../../src/tools/get-brewery-info.js";
import { registerGetBreweryCheckins } from "../../src/tools/get-brewery-checkins.js";
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

describe("get_beer_info", () => {
  it("calls /beer/info/:bid", async () => {
    const tool = captureTools(registerGetBeerInfo)["get_beer_info"];
    const beer = { bid: 5, beer_name: "Test IPA" };
    const { calls } = mockUntappd([{ payload: { beer } }]);

    const { payload } = await invokeTool(tool, { bid: 5 });

    expect(calls[0].pathname).toBe("/v4/beer/info/5");
    expect(payload.beer).toEqual(beer);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_beer_checkins", () => {
  it("calls /beer/checkins/:bid and returns the feed shape", async () => {
    const tool = captureTools(registerGetBeerCheckins)["get_beer_checkins"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { bid: 5, limit: 25, min_id: 10 });

    expect(calls[0].pathname).toBe("/v4/beer/checkins/5");
    expect(calls[0].searchParams.get("limit")).toBe("25");
    expect(calls[0].searchParams.get("min_id")).toBe("10");
    expectFeedPayload(payload);
  });

  it("rejects a limit above 50", async () => {
    const tool = captureTools(registerGetBeerCheckins)["get_beer_checkins"];
    mockUntappd([]);
    await expect(invokeTool(tool, { bid: 5, limit: 51 })).rejects.toThrow();
  });
});

describe("get_trending_beers", () => {
  it("calls /beer/trending with no params and returns macro/micro lists", async () => {
    const tool = captureTools(registerGetTrendingBeers)["get_trending_beers"];
    const item = { checkin_count: 100, beer: { bid: 1 }, brewery: { brewery_id: 2 } };
    const { calls } = mockUntappd([
      {
        payload: {
          macro: { count: 1, items: [item] },
          micro: { count: 1, items: [item] },
        },
      },
    ]);

    const { payload } = await invokeTool(tool, {});

    expect(calls[0].pathname).toBe("/v4/beer/trending");
    expect(payload.macro).toEqual([item]);
    expect(payload.micro).toEqual([item]);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_brewery_info", () => {
  it("calls /brewery/info/:id", async () => {
    const tool = captureTools(registerGetBreweryInfo)["get_brewery_info"];
    const brewery = { brewery_id: 7, brewery_name: "Test Brewing" };
    const { calls } = mockUntappd([{ payload: { brewery } }]);

    const { payload } = await invokeTool(tool, { brewery_id: 7, compact: true });

    expect(calls[0].pathname).toBe("/v4/brewery/info/7");
    expect(calls[0].searchParams.get("compact")).toBe("true");
    expect(payload.brewery).toEqual(brewery);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_brewery_checkins", () => {
  it("calls /brewery/checkins/:id and returns the feed shape", async () => {
    const tool = captureTools(registerGetBreweryCheckins)["get_brewery_checkins"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { brewery_id: 7 });

    expect(calls[0].pathname).toBe("/v4/brewery/checkins/7");
    expectFeedPayload(payload);
  });
});
