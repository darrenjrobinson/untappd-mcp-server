#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runAuthCli } from "./auth-cli.js";
import { resolveAccessToken } from "./auth.js";
import { registerAllTools } from "./register-tools.js";

if (process.argv[2] === "auth") {
  runAuthCli(process.argv.slice(3)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  );
} else {
  const hasClientCreds = !!(
    process.env.UNTAPPD_CLIENT_ID && process.env.UNTAPPD_CLIENT_SECRET
  );
  const hasToken = !!resolveAccessToken();

  if (!hasClientCreds && !hasToken) {
    console.error(
      "Missing Untappd credentials: set UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, or UNTAPPD_ACCESS_TOKEN. To authenticate interactively: npx untappd-mcp-server auth"
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "untappd-mcp-server",
    version: "2.0.0",
  });

  registerAllTools(server);

  const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Untappd MCP Server running on stdio");
  };

  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
