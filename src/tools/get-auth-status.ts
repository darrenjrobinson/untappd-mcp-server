import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTokenFilePath, maskToken, resolveAccessToken } from "../auth.js";
import { untappdFetch } from "../client.js";

const AUTHENTICATED_TOOLS = [
  "get_friend_feed",
  "get_user_venue_history",
  "get_user_stats_at_venue",
  "search_venue_then_get_user_stats",
];

export function registerGetAuthStatus(server: McpServer) {
  server.tool(
    "get_auth_status",
    "Report Untappd authentication status: whether an access token is configured, its source (UNTAPPD_ACCESS_TOKEN env var or the saved token file), the token file path, and whether the four authenticated tools are unlocked. Free (no API call) by default; set validate:true to verify the token with one authenticated API call (costs 1 rate-limit call).",
    {
      validate: z
        .boolean()
        .optional()
        .describe(
          "Verify the token against the Untappd API with one call (default false)"
        ),
    },
    async ({ validate }) => {
      const resolved = resolveAccessToken();

      const payload: Record<string, unknown> = {
        authenticated: !!resolved,
        source: resolved?.source ?? "none",
        tokenFilePath: getTokenFilePath(),
        maskedToken: resolved ? maskToken(resolved.token) : undefined,
        authenticatedToolsUnlocked: !!resolved,
        authenticatedTools: AUTHENTICATED_TOOLS,
        howToAuthenticate: resolved
          ? undefined
          : "Run the authenticate_untappd tool, or: npx untappd-mcp-server auth",
        howToClear: "npx untappd-mcp-server auth --clear",
      };

      if (validate && resolved) {
        const { data, rateLimit } = await untappdFetch<{
          user?: { user_name?: string };
        }>("/user/info", { compact: "true" }, { auth: "token" });
        payload.tokenValid = true;
        payload.validatedUser = data.user?.user_name;
        payload.rateLimit = rateLimit;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}
