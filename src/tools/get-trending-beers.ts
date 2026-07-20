import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { untappdFetch } from "../client.js";
import { TrendingResponse } from "../types.js";

export function registerGetTrendingBeers(server: McpServer) {
  server.tool(
    "get_trending_beers",
    "Retrieve globally trending beers on Untappd (macro and micro brew lists, by recent check-in velocity)",
    {},
    async () => {
      const { data, rateLimit } = await untappdFetch<TrendingResponse>(
        "/beer/trending"
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                macro: data.macro?.items ?? [],
                micro: data.micro?.items ?? [],
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
