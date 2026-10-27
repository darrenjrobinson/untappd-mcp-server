import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { VenueInfoResponse } from "../types.js";

export function registerGetVenueInfo(server: McpServer) {
  server.registerTool(
    "get_venue_info",
    {
      description:
        "Retrieve detailed information and recent check-ins for a known venue",
      inputSchema: z.object({
        venue_id: z.number().int().describe("Untappd venue ID"),
        compact: z
          .boolean()
          .optional()
          .describe(
            "If true, returns venue info only (no checkins, media, top_beers). Default: false"
          ),
      }),
    },
    async ({ venue_id, compact }) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (compact) params.compact = "true";

      const { data, rateLimit } = await untappdFetch<VenueInfoResponse>(
        `/venue/info/${venue_id}`,
        params
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ venue: data.venue, rateLimit }, null, 2),
          },
        ],
      };
    }
  );
}
