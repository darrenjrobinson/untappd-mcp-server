import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { UserFriendsResponse } from "../types.js";

export function registerGetUserFriends(server: McpServer) {
  server.tool(
    "get_user_friends",
    "Retrieve a user's friend list (public accounts only)",
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
    },
    async ({ username, offset, limit }) => {
      const { data, rateLimit } = await untappdFetch<UserFriendsResponse>(
        `/user/friends/${encodeURIComponent(username)}`,
        { offset, limit }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_count: data.found ?? 0,
                friends: (data.items ?? []).map((item) => ({
                  ...item.user,
                  friend_since: item.created_at,
                })),
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
