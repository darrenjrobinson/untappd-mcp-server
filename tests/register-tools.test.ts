import { describe, expect, it } from "vitest";
import { registerAllTools } from "../src/register-tools.js";
import { captureTools } from "./helpers.js";

const EXPECTED_TOOLS = [
  // Auth
  "authenticate_untappd",
  "get_auth_status",
  // Search & lookup
  "venue_search",
  "search_brewery",
  "search_beer",
  // Venue
  "get_venue_info",
  "get_venue_checkins",
  "get_venue_foursquare_lookup",
  // Beer
  "get_beer_info",
  "get_beer_checkins",
  "get_trending_beers",
  // Brewery
  "get_brewery_info",
  "get_brewery_checkins",
  // User
  "get_user_info",
  "get_user_activity",
  "get_user_distinct_beers",
  "get_user_wishlist",
  "get_user_badges",
  "get_user_friends",
  // Activity feeds
  "get_global_feed",
  "get_local_feed",
  "get_friend_feed",
  // Checkin
  "get_checkin_info",
  // Composite / aggregation
  "get_user_stats_at_venue",
  "search_venue_then_get_user_stats",
  "get_user_beer_stats",
  "get_user_badge_summary",
];

describe("registerAllTools", () => {
  it("registers exactly the expected 27 tools", () => {
    const tools = captureTools(registerAllTools);
    const names = Object.keys(tools);
    expect(names).toHaveLength(27);
    expect(names.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("every tool has a description and a handler", () => {
    const tools = captureTools(registerAllTools);
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.description, name).toBeTruthy();
      expect(typeof tool.handler, name).toBe("function");
    }
  });
});
