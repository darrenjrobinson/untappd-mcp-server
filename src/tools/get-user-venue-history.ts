import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  checkAuthRequired,
  resolveUsername,
  untappdFetch,
} from "../client.js";
import { UserVenueHistoryResponse } from "../types.js";

export function registerGetUserVenueHistory(server: McpServer) {
  server.tool(
    "get_user_venue_history",
    "Retrieve the venues a user has checked in at, with first/last visit details (requires UNTAPPD_ACCESS_TOKEN)",
    {
      username: z
        .string()
        .optional()
        .describe("Untappd username (defaults to UNTAPPD_USERNAME env var)"),
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
      checkAuthRequired("get_user_venue_history");
      const resolved = resolveUsername(username, "get_user_venue_history");

      const { data, rateLimit } = await untappdFetch<UserVenueHistoryResponse>(
        `/user/venue_history/${encodeURIComponent(resolved)}`,
        { offset, limit },
        { auth: "token" }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: data.venues?.count ?? 0,
                venues: data.venues?.items ?? [],
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
