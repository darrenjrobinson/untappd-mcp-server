import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { VenueCheckinsResponse } from "../types.js";

export function registerGetUserActivity(server: McpServer) {
  server.tool(
    "get_user_activity",
    "Retrieve the recent check-in activity feed for a specific Untappd user",
    {
      username: z.string().describe("Untappd username"),
      limit: z
        .number()
        .int()
        .max(25)
        .optional()
        .describe("Number of results (max 25, default 25)"),
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
    async ({ username, limit, max_id, min_id }) => {
      const { data, rateLimit } = await untappdFetch<VenueCheckinsResponse>(
        `/user/checkins/${encodeURIComponent(username)}`,
        { limit, max_id, min_id }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                checkins: data.checkins?.items ?? [],
                count: data.checkins?.count ?? 0,
                pagination: data.checkins?.pagination,
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
