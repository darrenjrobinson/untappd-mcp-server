import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { BeerSearchResponse } from "../types.js";

export function registerSearchBeer(server: McpServer) {
  server.tool(
    "search_beer",
    "Search for beers by name",
    {
      q: z.string().describe("Beer name search query"),
      offset: z.number().int().optional().describe("Pagination offset"),
      sort: z
        .enum(["checkin", "name", "count"])
        .optional()
        .describe("Sort order: checkin (default), name, count"),
    },
    async ({ q, offset, sort }) => {
      const { data, rateLimit } = await untappdFetch<BeerSearchResponse>(
        "/search/beer",
        { q, offset, sort }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                beers: data.beers?.items ?? [],
                count: data.beers?.count ?? 0,
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
