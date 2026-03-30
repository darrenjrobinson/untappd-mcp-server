#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVenueSearch } from "./tools/venue-search.js";
import { registerGetVenueInfo } from "./tools/get-venue-info.js";
import { registerGetVenueCheckins } from "./tools/get-venue-checkins.js";
import { registerSearchBrewery } from "./tools/search-brewery.js";
import { registerGetBreweryInfo } from "./tools/get-brewery-info.js";
import { registerSearchBeer } from "./tools/search-beer.js";
import { registerGetBeerInfo } from "./tools/get-beer-info.js";
import { registerGetUserInfo } from "./tools/get-user-info.js";
import { registerGetUserActivity } from "./tools/get-user-activity.js";

const server = new McpServer({
  name: "untappd-mcp-server",
  version: "1.0.0",
});

registerVenueSearch(server);
registerGetVenueInfo(server);
registerGetVenueCheckins(server);
registerSearchBrewery(server);
registerGetBreweryInfo(server);
registerSearchBeer(server);
registerGetBeerInfo(server);
registerGetUserInfo(server);
registerGetUserActivity(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Untappd MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
