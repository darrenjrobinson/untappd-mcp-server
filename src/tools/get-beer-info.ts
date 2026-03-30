import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { BeerInfoResponse } from "../types.js";

export function registerGetBeerInfo(server: McpServer) {
  server.tool(
    "get_beer_info",
    "Retrieve detailed information for a specific beer",
    {
      bid: z.number().int().describe("Untappd beer ID"),
      compact: z
        .boolean()
        .optional()
        .describe("If true, returns beer info only. Default: false"),
    },
    async ({ bid, compact }) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (compact) params.compact = "true";

      const { data, rateLimit } = await untappdFetch<BeerInfoResponse>(
        `/beer/info/${bid}`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ beer: data.beer, rateLimit }, null, 2),
          },
        ],
      };
    }
  );
}
