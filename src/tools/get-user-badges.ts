import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { UserBadgesResponse } from "../types.js";

export function registerGetUserBadges(server: McpServer) {
  server.tool(
    "get_user_badges",
    "Retrieve a user's earned badges (returned in pages of 50, most recent first)",
    {
      username: z.string().describe("Untappd username"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Pagination offset (badges are returned in pages of 50)"),
    },
    async ({ username, offset }) => {
      const { data, rateLimit } = await untappdFetch<UserBadgesResponse>(
        `/user/badges/${encodeURIComponent(username)}`,
        { offset }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: data.badges?.count ?? 0,
                badges: data.badges?.items ?? [],
                offset: offset ?? 0,
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
