#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./register-tools.js";

const hasClientCreds = !!(
  process.env.UNTAPPD_CLIENT_ID && process.env.UNTAPPD_CLIENT_SECRET
);
const hasToken = !!process.env.UNTAPPD_ACCESS_TOKEN;

if (!hasClientCreds && !hasToken) {
  console.error(
    "Missing Untappd credentials: set UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, or UNTAPPD_ACCESS_TOKEN"
  );
  process.exit(1);
}

const server = new McpServer({
  name: "untappd-mcp-server",
  version: "2.0.0",
});

registerAllTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Untappd MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
