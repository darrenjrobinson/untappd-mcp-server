import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  checkAuthRequired,
  resolveUsername,
  untappdFetch,
} from "../client.js";
import { VenueSearchResponse } from "../types.js";
import { computeUserStatsAtVenue } from "./get-user-stats-at-venue.js";

export function registerSearchVenueThenGetUserStats(server: McpServer) {
  server.tool(
    "search_venue_then_get_user_stats",
    "Search for a venue by name, then get the user's check-in stats at the top match (requires UNTAPPD_ACCESS_TOKEN; costs 1 search call + venue-history scan)",
    {
      q: z.string().describe("Venue search query (venue name)"),
      username: z
        .string()
        .optional()
        .describe("Untappd username (defaults to UNTAPPD_USERNAME env var)"),
      lat: z.number().optional().describe("Latitude for location-aware search"),
      lng: z.number().optional().describe("Longitude for location-aware search"),
      max_pages: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Max venue-history pages to scan at 50/page (default 5)"),
    },
    async ({ q, username, lat, lng, max_pages }) => {
      checkAuthRequired("search_venue_then_get_user_stats");
      const resolved = resolveUsername(
        username,
        "search_venue_then_get_user_stats"
      );
      assertRateLimitSufficient(3);

      const { data, rateLimit } = await untappdFetch<VenueSearchResponse>(
        "/search/venue",
        { q, lat, lng }
      );

      const topMatch = (data.venues?.items ?? [])[0]?.venue;
      if (!topMatch) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  matched_venue: null,
                  note: `No venue matched "${q}"`,
                  rateLimit,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await computeUserStatsAtVenue(
        resolved,
        topMatch.venue_id,
        max_pages ?? 5
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                matched_venue: {
                  venue_id: topMatch.venue_id,
                  venue_name: topMatch.venue_name,
                  location: topMatch.location,
                },
                username: resolved,
                ...result,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
