import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  getRateLimit,
  resolveUsername,
  untappdFetch,
} from "../client.js";
import {
  CheckinItem,
  RateLimitInfo,
  VenueCheckinsResponse,
} from "../types.js";

// The user checkins feed caps at 25 results per call.
const PAGE_SIZE = 25;

export interface UserVenueStatsResult {
  found: boolean;
  stats?: {
    venue_id: number;
    venue_name: string;
    checkins_at_venue: number;
    last_visit: string;
    earliest_scanned_visit: string;
    avg_rating: number | null;
    top_beers: Array<{ bid?: number; beer_name?: string; count: number }>;
  };
  note?: string;
  checkins_scanned: number;
  pages_fetched: number;
  truncated: boolean;
  rateLimit: RateLimitInfo;
}

/**
 * Scan a user's recent check-in feed (newest first, 25 per API call) for
 * check-ins at the given venue and aggregate stats over the scanned window.
 * The Untappd v4 API has no venue-history endpoint, so this is a windowed
 * scan — `truncated: true` means older check-ins were not examined.
 */
export async function computeUserStatsAtVenue(
  username: string,
  venueId: number,
  maxPages: number
): Promise<UserVenueStatsResult> {
  const matches: CheckinItem[] = [];
  let checkinsScanned = 0;
  let pagesFetched = 0;
  let truncated = false;
  let maxId: number | undefined;

  for (let page = 0; page < maxPages; page++) {
    const { data, rateLimit } = await untappdFetch<VenueCheckinsResponse>(
      `/user/checkins/${encodeURIComponent(username)}`,
      { limit: PAGE_SIZE, max_id: maxId }
    );
    pagesFetched++;

    const items = data.checkins?.items ?? [];
    checkinsScanned += items.length;
    matches.push(...items.filter((c) => c.venue?.venue_id === venueId));

    if (items.length < PAGE_SIZE) {
      break;
    }
    maxId =
      data.checkins?.pagination?.max_id ??
      items[items.length - 1]?.checkin_id;
    if (!maxId) {
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

  if (matches.length === 0) {
    return {
      found: false,
      note: `No check-ins at venue ${venueId} found in the user's ${checkinsScanned} most recent check-ins${truncated ? " (scan stopped early — raise max_pages to look further back)" : ""}`,
      checkins_scanned: checkinsScanned,
      pages_fetched: pagesFetched,
      truncated,
      rateLimit: getRateLimit(),
    };
  }

  const rated = matches.filter((c) => c.rating_score > 0);
  const beerCounts = new Map<
    string,
    { bid?: number; beer_name?: string; count: number }
  >();
  for (const c of matches) {
    const key = String(c.beer?.bid ?? c.beer?.beer_name ?? "unknown");
    const entry = beerCounts.get(key) ?? {
      bid: c.beer?.bid,
      beer_name: c.beer?.beer_name,
      count: 0,
    };
    entry.count++;
    beerCounts.set(key, entry);
  }
  const topBeers = [...beerCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    found: true,
    stats: {
      venue_id: venueId,
      venue_name: matches[0].venue?.venue_name ?? `venue ${venueId}`,
      checkins_at_venue: matches.length,
      last_visit: matches[0].created_at,
      earliest_scanned_visit: matches[matches.length - 1].created_at,
      avg_rating: rated.length
        ? Math.round(
            (rated.reduce((sum, c) => sum + c.rating_score, 0) / rated.length) *
              100
          ) / 100
        : null,
      top_beers: topBeers,
    },
    checkins_scanned: checkinsScanned,
    pages_fetched: pagesFetched,
    truncated,
    rateLimit: getRateLimit(),
  };
}

export function registerGetUserStatsAtVenue(server: McpServer) {
  server.tool(
    "get_user_stats_at_venue",
    "Get a user's check-in stats at a specific venue — visit count, last visit, average rating, top beers — by scanning their recent check-in feed (1 API call per 25 check-ins scanned; the stats cover the scanned window, not all time)",
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
        .max(20)
        .optional()
        .describe(
          "Max feed pages to scan at 25 check-ins/page (default 5 = 125 check-ins)"
        ),
    },
    async ({ venue_id, username, max_pages }) => {
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
