import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveAccessToken, runInteractiveAuth } from "../auth.js";

const UNLOCKED_TOOLS = [
  "get_friend_feed",
  "get_user_venue_history",
  "get_user_stats_at_venue",
  "search_venue_then_get_user_stats",
];

export function registerAuthenticateUntappd(server: McpServer) {
  server.tool(
    "authenticate_untappd",
    "Interactively authenticate the user with Untappd via OAuth to unlock the authenticated tools (get_friend_feed, get_user_venue_history, get_user_stats_at_venue, search_venue_then_get_user_stats). Opens the user's browser to Untappd's login/approve page and blocks until they approve (up to timeout_seconds). PREREQUISITE: the user's Untappd API app (untappd.com/api) must have its Callback URL set to exactly http://localhost:8737/callback (or the UNTAPPD_REDIRECT_URL value). Requires UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET. The token is saved to disk and used immediately — no server restart needed.",
    {
      timeout_seconds: z
        .number()
        .int()
        .min(30)
        .max(600)
        .optional()
        .describe(
          "How long to wait for the user to approve in the browser (default 180)"
        ),
    },
    async ({ timeout_seconds }) => {
      if (resolveAccessToken()?.source === "env") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "already_authenticated",
                  source: "env",
                  note: "UNTAPPD_ACCESS_TOKEN env var is set and takes precedence over any file token — unset it before re-authenticating interactively",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const result = await runInteractiveAuth({
        timeoutMs: (timeout_seconds ?? 180) * 1000,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "authenticated",
                source: "file",
                tokenPath: result.tokenPath,
                maskedToken: result.maskedToken,
                redirectUrl: result.redirectUrl,
                unlockedTools: UNLOCKED_TOOLS,
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
