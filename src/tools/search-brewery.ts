import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { BrewerySearchResponse } from "../types.js";

export function registerSearchBrewery(server: McpServer) {
  server.tool(
    "search_brewery",
    "Search for breweries by name",
    {
      q: z.string().describe("Brewery name search query"),
      offset: z.number().int().optional().describe("Offset for pagination"),
    },
    async ({ q, offset }) => {
      const { data, rateLimit } = await untappdFetch<BrewerySearchResponse>(
        "/search/brewery",
        { q, offset }
      );

      const breweries = (data.brewery?.items ?? []).map((item) => item.brewery);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                breweries,
                count: data.brewery?.count ?? 0,
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
