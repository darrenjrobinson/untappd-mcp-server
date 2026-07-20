import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkAuthRequired, untappdFetch } from "../client.js";
import { VenueCheckinsResponse } from "../types.js";

export function registerGetFriendFeed(server: McpServer) {
  server.tool(
    "get_friend_feed",
    "Retrieve the friend check-in feed for the authenticated user (requires UNTAPPD_ACCESS_TOKEN)",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Results per page (max 50, default 25 — the API may cap some feeds at 25)"),
      max_id: z
        .number()
        .int()
        .optional()
        .describe("Return results older than this checkin ID"),
      min_id: z
        .number()
        .int()
        .optional()
        .describe("Return only checkins newer than this ID"),
    },
    async ({ limit, max_id, min_id }) => {
      checkAuthRequired("get_friend_feed");

      const { data, rateLimit } = await untappdFetch<VenueCheckinsResponse>(
        "/checkin/recent",
        { limit, max_id, min_id },
        { auth: "token" }
      );

      const warning =
        rateLimit.remaining < 5
          ? `Only ${rateLimit.remaining} API calls remaining this hour`
          : undefined;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                checkins: data.checkins?.items ?? [],
                count: data.checkins?.count ?? 0,
                pagination: data.checkins?.pagination,
                warning,
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
