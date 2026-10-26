import { McpServer } from "@modelcontextprotocol/server";
import { untappdFetch } from "../client.js";
import { TrendingResponse } from "../types.js";
import { z } from "zod";

export function registerGetTrendingBeers(server: McpServer) {
  server.registerTool(
    "get_trending_beers",
    {
      description:
        "Retrieve globally trending beers on Untappd (macro and micro brew lists, by recent check-in velocity)",
      inputSchema: z.object({}),
    },
    async () => {
      const { data, rateLimit } =
        await untappdFetch<TrendingResponse>("/beer/trending");

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
