import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { VenueCheckinsResponse } from "../types.js";

export function registerGetLocalFeed(server: McpServer) {
  server.tool(
    "get_local_feed",
    "Retrieve the public check-in feed near a geographic point (The Pub — Local)",
    {
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      radius: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Radius in miles (default 25)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Results per page (max 50, default 25 — the API may cap some feeds at 25)"),
      max_id: z
        .number()
        .int()
        .optional()
        .describe("Return results older than this checkin ID"),
      min_id: z
        .number()
        .int()
        .optional()
        .describe("Return only checkins newer than this ID"),
    },
    async ({ lat, lng, radius, limit, max_id, min_id }) => {
      const { data, rateLimit } = await untappdFetch<VenueCheckinsResponse>(
        "/thepub/local",
        { lat, lng, radius, limit, max_id, min_id }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                checkins: data.checkins?.items ?? [],
                count: data.checkins?.count ?? 0,
                pagination: data.checkins?.pagination,
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
