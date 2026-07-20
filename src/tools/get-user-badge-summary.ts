import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  assertRateLimitSufficient,
  getRateLimit,
  untappdFetch,
} from "../client.js";
import { BadgeItem, UserBadgesResponse } from "../types.js";

const PAGE_SIZE = 50;

export function registerGetUserBadgeSummary(server: McpServer) {
  server.tool(
    "get_user_badge_summary",
    "Retrieve all badges for a user (paginating to completion) with a structured summary (costs 1 API call per 50 badges)",
    {
      username: z.string().describe("Untappd username"),
      max_pages: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max pages to scan at 50 badges/page (default 10 = 500 badges)"),
    },
    async ({ username, max_pages }) => {
      const maxPages = max_pages ?? 10;
      assertRateLimitSufficient(2);

      const badges: BadgeItem[] = [];
      let pagesFetched = 0;
      let truncated = false;

      for (let page = 0; page < maxPages; page++) {
        const { data, rateLimit } = await untappdFetch<UserBadgesResponse>(
          `/user/badges/${encodeURIComponent(username)}`,
          { offset: page * PAGE_SIZE }
        );
        pagesFetched++;

        const pageItems = data.badges?.items ?? [];
        badges.push(...pageItems);

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

      const slim = badges.map((b) => ({
        badge_id: b.badge_id,
        badge_name: b.badge_name,
        badge_description: b.badge_description,
        created_at: b.created_at,
        checkin_id: b.checkin_id,
        badge_image_md: b.badge_image?.md,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_badges: badges.length,
                recent_badges: slim.slice(0, 5),
                badges: slim,
                pages_fetched: pagesFetched,
                truncated,
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
