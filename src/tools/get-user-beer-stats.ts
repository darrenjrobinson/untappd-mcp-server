import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  getRateLimit,
  untappdFetch,
} from "../client.js";
import { DistinctBeerItem, UserBeersResponse } from "../types.js";

const PAGE_SIZE = 50;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function topCounts(counts: Map<string, number>, top: number) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, count]) => ({ name, count }));
}

export function registerGetUserBeerStats(server: McpServer) {
  server.tool(
    "get_user_beer_stats",
    "Aggregate a user's distinct beer history into style, brewery, and rating breakdowns (paginates the API — costs 1 call per 50 beers scanned)",
    {
      username: z.string().describe("Untappd username"),
      max_pages: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max pages to scan at 50 beers/page (default 10 = 500 beers)"),
    },
    async ({ username, max_pages }) => {
      const maxPages = max_pages ?? 10;
      assertRateLimitSufficient(2);

      const items: DistinctBeerItem[] = [];
      let totalCount = 0;
      let pagesFetched = 0;
      let truncated = false;

      for (let page = 0; page < maxPages; page++) {
        const { data, rateLimit } = await untappdFetch<UserBeersResponse>(
          `/user/beers/${encodeURIComponent(username)}`,
          { offset: page * PAGE_SIZE, limit: PAGE_SIZE }
        );
        pagesFetched++;

        const pageItems = data.beers?.items ?? [];
        items.push(...pageItems);
        totalCount = data.total_count ?? data.beers?.count ?? items.length;

        if (pageItems.length < PAGE_SIZE || items.length >= totalCount) {
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

      const styleCounts = new Map<string, number>();
      const breweryCounts = new Map<string, number>();
      let yourRatingSum = 0;
      let yourRatingCount = 0;
      let globalRatingSum = 0;
      let globalRatingCount = 0;

      for (const item of items) {
        const style = item.beer?.beer_style;
        if (style) styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
        const brewery = item.brewery?.brewery_name;
        if (brewery)
          breweryCounts.set(brewery, (breweryCounts.get(brewery) ?? 0) + 1);
        if (item.rating_score > 0) {
          yourRatingSum += item.rating_score;
          yourRatingCount++;
        }
        const globalRating = item.beer?.rating_score ?? 0;
        if (globalRating > 0) {
          globalRatingSum += globalRating;
          globalRatingCount++;
        }
      }

      const highestRatedYours = [...items]
        .filter((i) => i.rating_score > 0)
        .sort((a, b) => b.rating_score - a.rating_score)
        .slice(0, 5)
        .map((i) => ({
          bid: i.beer?.bid,
          beer_name: i.beer?.beer_name,
          brewery_name: i.brewery?.brewery_name,
          your_rating: i.rating_score,
        }));

      const mostCheckedIn = [...items]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((i) => ({
          bid: i.beer?.bid,
          beer_name: i.beer?.beer_name,
          brewery_name: i.brewery?.brewery_name,
          times_checked_in: i.count,
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_distinct_beers: totalCount,
                scanned_count: items.length,
                pages_fetched: pagesFetched,
                truncated,
                top_styles: topCounts(styleCounts, 10),
                top_breweries: topCounts(breweryCounts, 10),
                avg_your_rating: yourRatingCount
                  ? round2(yourRatingSum / yourRatingCount)
                  : null,
                avg_global_rating: globalRatingCount
                  ? round2(globalRatingSum / globalRatingCount)
                  : null,
                highest_rated_yours: highestRatedYours,
                most_checked_in: mostCheckedIn,
                rateLimit: getRateLimit(),
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
