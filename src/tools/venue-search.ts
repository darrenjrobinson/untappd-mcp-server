import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { VenueSearchResponse } from "../types.js";

export function registerVenueSearch(server: McpServer) {
  server.tool(
    "venue_search",
    "Search for venues (breweries, bars, restaurants) by name, with optional location awareness",
    {
      q: z.string().describe("Search query (venue name)"),
      lat: z.number().optional().describe("Latitude for location-aware results"),
      lng: z.number().optional().describe("Longitude for location-aware results"),
    },
    async ({ q, lat, lng }) => {
      const { data, rateLimit } = await untappdFetch<VenueSearchResponse>(
        "/search/venue",
        { q, lat, lng }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                venues: data.venues?.items ?? [],
                count: data.venues?.count ?? 0,
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
