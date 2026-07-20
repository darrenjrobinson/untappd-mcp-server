import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { UserBeersResponse } from "../types.js";

export function registerGetUserDistinctBeers(server: McpServer) {
  server.tool(
    "get_user_distinct_beers",
    "Retrieve the unique beers a user has checked in, with flexible sort ordering",
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
        .enum([
          "date",
          "checkin",
          "highest_rated",
          "lowest_rated",
          "highest_rated_you",
          "lowest_rated_you",
        ])
        .optional()
        .describe(
          "Sort order (default: date). 'checkin' = most checked-in first; '_you' variants use the user's personal rating"
        ),
    },
    async ({ username, offset, limit, sort }) => {
      const { data, rateLimit } = await untappdFetch<UserBeersResponse>(
        `/user/beers/${encodeURIComponent(username)}`,
        { offset, limit, sort }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_count: data.total_count ?? data.beers?.count ?? 0,
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
