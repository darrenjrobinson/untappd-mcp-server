import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { BreweryInfoResponse } from "../types.js";

export function registerGetBreweryInfo(server: McpServer) {
  server.tool(
    "get_brewery_info",
    "Retrieve detailed information and recent check-ins for a specific brewery",
    {
      brewery_id: z.number().int().describe("Untappd brewery ID"),
      compact: z
        .boolean()
        .optional()
        .describe("If true, returns brewery info only. Default: false"),
    },
    async ({ brewery_id, compact }) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (compact) params.compact = "true";

      const { data, rateLimit } = await untappdFetch<BreweryInfoResponse>(
        `/brewery/info/${brewery_id}`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ brewery: data.brewery, rateLimit }, null, 2),
          },
        ],
      };
    }
  );
}
