import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { UserWishlistResponse } from "../types.js";

export function registerGetUserWishlist(server: McpServer) {
  server.tool(
    "get_user_wishlist",
    "Retrieve beers on a user's wish list",
    {
      username: z.string().describe("Untappd username"),
      offset: z.number().int().min(0).optional().describe("Pagination offset"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Results per page (max 50, default 25)"),
      sort: z
        .enum(["date", "checkin", "highest_rated", "lowest_rated"])
        .optional()
        .describe("Sort order (default: date)"),
    },
    async ({ username, offset, limit, sort }) => {
      const { data, rateLimit } = await untappdFetch<UserWishlistResponse>(
        `/user/wishlist/${encodeURIComponent(username)}`,
        { offset, limit, sort }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: data.beers?.count ?? 0,
                items: data.beers?.items ?? [],
                rateLimit,
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
