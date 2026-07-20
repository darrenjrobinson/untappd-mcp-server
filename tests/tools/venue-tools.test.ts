import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGetVenueInfo } from "../../src/tools/get-venue-info.js";
import { registerGetVenueCheckins } from "../../src/tools/get-venue-checkins.js";
import { registerGetVenueFoursquareLookup } from "../../src/tools/get-venue-foursquare-lookup.js";
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

describe("get_venue_info", () => {
  it("calls /venue/info/:id and passes compact as a string flag", async () => {
    const tool = captureTools(registerGetVenueInfo)["get_venue_info"];
    const venue = { venue_id: 99, venue_name: "Test Venue" };
    const { calls } = mockUntappd([{ payload: { venue } }]);

    const { payload } = await invokeTool(tool, { venue_id: 99, compact: true });

    expect(calls[0].pathname).toBe("/v4/venue/info/99");
    expect(calls[0].searchParams.get("compact")).toBe("true");
    expect(payload.venue).toEqual(venue);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});

describe("get_venue_checkins", () => {
  it("calls /venue/checkins/:id and returns the feed shape", async () => {
    const tool = captureTools(registerGetVenueCheckins)["get_venue_checkins"];
    const { calls } = mockUntappd([{ payload: FEED_RESPONSE }]);

    const { payload } = await invokeTool(tool, { venue_id: 99, limit: 10, max_id: 500 });

    expect(calls[0].pathname).toBe("/v4/venue/checkins/99");
    expect(calls[0].searchParams.get("limit")).toBe("10");
    expect(calls[0].searchParams.get("max_id")).toBe("500");
    expectFeedPayload(payload);
  });
});

describe("get_venue_foursquare_lookup", () => {
  it("calls /venue/foursquare_lookup/:id and returns matched venues", async () => {
    const tool = captureTools(registerGetVenueFoursquareLookup)[
      "get_venue_foursquare_lookup"
    ];
    const venue = { venue_id: 12, venue_name: "Linked Venue" };
    const { calls } = mockUntappd([
      { payload: { venue: { count: 1, items: [venue] } } },
    ]);

    const { payload } = await invokeTool(tool, {
      foursquare_id: "4b5b9f2af964a520fa0129e3",
    });

    expect(calls[0].pathname).toBe(
      "/v4/venue/foursquare_lookup/4b5b9f2af964a520fa0129e3"
    );
    expect(payload.venues).toEqual([venue]);
    expect(payload.count).toBe(1);
    expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
  });
});
