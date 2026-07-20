import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  resolveUsername,
  untappdFetch,
} from "../client.js";
import { VenueSearchResponse } from "../types.js";
import { computeUserStatsAtVenue } from "./get-user-stats-at-venue.js";

export function registerSearchVenueThenGetUserStats(server: McpServer) {
  server.tool(
    "search_venue_then_get_user_stats",
    "Search for a venue by name, then get the user's check-in stats at the top match (1 search call + a scan of the user's recent check-in feed at 25/page)",
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
        .max(20)
        .optional()
        .describe(
          "Max feed pages to scan at 25 check-ins/page (default 5 = 125 check-ins)"
        ),
    },
    async ({ q, username, lat, lng, max_pages }) => {
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
