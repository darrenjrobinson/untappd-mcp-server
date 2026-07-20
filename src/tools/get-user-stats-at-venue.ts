import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  checkAuthRequired,
  getRateLimit,
  resolveUsername,
  untappdFetch,
} from "../client.js";
import { RateLimitInfo, UserVenueHistoryResponse } from "../types.js";

const PAGE_SIZE = 50;

export interface UserVenueStatsResult {
  found: boolean;
  stats?: {
    venue_id: number;
    venue_name: string;
    total_checkins_at_venue: number;
    first_visit: string;
    last_visit: string;
    first_checkin_id: number;
    last_checkin_id: number;
  };
  note?: string;
  venues_scanned: number;
  pages_fetched: number;
  truncated: boolean;
  rateLimit: RateLimitInfo;
}

export async function computeUserStatsAtVenue(
  username: string,
  venueId: number,
  maxPages: number
): Promise<UserVenueStatsResult> {
  let venuesScanned = 0;
  let pagesFetched = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const { data, rateLimit } = await untappdFetch<UserVenueHistoryResponse>(
      `/user/venue_history/${encodeURIComponent(username)}`,
      { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
      { auth: "token" }
    );
    pagesFetched++;

    const pageItems = data.venues?.items ?? [];
    venuesScanned += pageItems.length;

    const match = pageItems.find((v) => v.venue?.venue_id === venueId);
    if (match) {
      return {
        found: true,
        stats: {
          venue_id: match.venue.venue_id,
          venue_name: match.venue.venue_name,
          total_checkins_at_venue: match.total_count,
          first_visit: match.first_created_at,
          last_visit: match.last_created_at,
          first_checkin_id: match.first_checkin_id,
          last_checkin_id: match.last_checkin_id,
        },
        venues_scanned: venuesScanned,
        pages_fetched: pagesFetched,
        truncated,
        rateLimit,
      };
    }

    if (pageItems.length < PAGE_SIZE) {
      break;
    }
    if (rateLimit.remaining <= 1) {
      truncated = true;
      break;
    }
    if (page === maxPages - 1) {
      truncated = true;
    }
  }

  return {
    found: false,
    note: truncated
      ? `Venue ${venueId} not found in the first ${venuesScanned} venues scanned (stopped early — raise max_pages or check rate limit)`
      : `Venue ${venueId} not found in the user's venue history (${venuesScanned} venues scanned)`,
    venues_scanned: venuesScanned,
    pages_fetched: pagesFetched,
    truncated,
    rateLimit: getRateLimit(),
  };
}

export function registerGetUserStatsAtVenue(server: McpServer) {
  server.tool(
    "get_user_stats_at_venue",
    "Get a user's check-in stats at a specific venue — total check-ins, first/last visit (requires UNTAPPD_ACCESS_TOKEN; scans venue history at 1 API call per 50 venues)",
    {
      venue_id: z.number().int().describe("Untappd venue ID"),
      username: z
        .string()
        .optional()
        .describe("Untappd username (defaults to UNTAPPD_USERNAME env var)"),
      max_pages: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Max venue-history pages to scan at 50/page (default 5)"),
    },
    async ({ venue_id, username, max_pages }) => {
      checkAuthRequired("get_user_stats_at_venue");
      const resolved = resolveUsername(username, "get_user_stats_at_venue");
      assertRateLimitSufficient(2);

      const result = await computeUserStatsAtVenue(
        resolved,
        venue_id,
        max_pages ?? 5
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ username: resolved, ...result }, null, 2),
          },
        ],
      };
    }
  );
}
