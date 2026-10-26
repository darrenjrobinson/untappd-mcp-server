import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { untappdFetch } from "../client.js";

export function registerGetUserInfo(server: McpServer) {
  server.registerTool(
    "get_user_info",
    {
      description:
        "Retrieve profile and stats for a specific Untappd user by username",
      inputSchema: z.object({
        username: z.string().describe("Untappd username to look up"),
        compact: z
          .boolean()
          .optional()
          .describe(
            "If true, returns user info only (no checkins, media, recent brews). Default: false"
          ),
      }),
    },
    async ({ username, compact }) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (compact) params.compact = "true";

      const { data, rateLimit } = await untappdFetch<{ user: unknown }>(
        `/user/info/${encodeURIComponent(username)}`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ user: data.user, rateLimit }, null, 2),
          },
        ],
      };
    }
  );
}
