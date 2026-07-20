import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { FoursquareLookupResponse } from "../types.js";

export function registerGetVenueFoursquareLookup(server: McpServer) {
  server.tool(
    "get_venue_foursquare_lookup",
    "Resolve a Foursquare venue ID to its Untappd venue (bridge between Foursquare data and Untappd venue tools)",
    {
      foursquare_id: z
        .string()
        .describe(
          "Foursquare venue ID in v2 MD5-hash format (v3 numeric IDs will not work)"
        ),
    },
    async ({ foursquare_id }) => {
      const { data, rateLimit } = await untappdFetch<FoursquareLookupResponse>(
        `/venue/foursquare_lookup/${encodeURIComponent(foursquare_id)}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                venues: data.venue?.items ?? [],
                count: data.venue?.count ?? 0,
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
