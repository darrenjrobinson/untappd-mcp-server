import {
  clearToken,
  getTokenFilePath,
  maskToken,
  resolveAccessToken,
  runInteractiveAuth,
} from "./auth.js";

const USAGE = `Usage: untappd-mcp-server auth [--status | --clear]

  (no flags)  Run the interactive OAuth flow: opens your browser to Untappd,
              captures the redirect, and saves the access token to
              ${getTokenFilePath()}
              Requires UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, and your
              Untappd app's Callback URL registered as the redirect URL
              (default: http://localhost:8737/callback).
  --status    Show current authentication status.
  --clear     Delete the saved token file.`;

export async function runAuthCli(args: string[]): Promise<number> {
  const flag = args[0];

  if (flag === "--status") {
    const resolved = resolveAccessToken();
    if (resolved) {
      console.log(
        `Authenticated via ${resolved.source === "env" ? "UNTAPPD_ACCESS_TOKEN env var" : `token file (${getTokenFilePath()})`}`
      );
      console.log(`Token: ${maskToken(resolved.token)}`);
    } else {
      console.log(
        `Not authenticated — no UNTAPPD_ACCESS_TOKEN env var and no token file at ${getTokenFilePath()}`
      );
      console.log("Run: npx untappd-mcp-server auth");
    }
    return 0;
  }

  if (flag === "--clear") {
    const removed = clearToken();
    console.log(
      removed
        ? `Deleted token file ${getTokenFilePath()}`
        : `No token file to delete at ${getTokenFilePath()}`
    );
    if (process.env.UNTAPPD_ACCESS_TOKEN) {
      console.log(
        "Note: UNTAPPD_ACCESS_TOKEN env var is still set — you remain authenticated via the environment"
      );
    }
    return 0;
  }

  if (flag !== undefined) {
    console.log(USAGE);
    return 1;
  }

  try {
    const result = await runInteractiveAuth({ log: console.log });
    console.log(
      `Authenticated with Untappd — token ${result.maskedToken} saved to ${result.tokenPath}`
    );
    console.log(
      "The authenticated tools (get_friend_feed, get_user_venue_history, get_user_stats_at_venue, search_venue_then_get_user_stats) are now unlocked."
    );
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
