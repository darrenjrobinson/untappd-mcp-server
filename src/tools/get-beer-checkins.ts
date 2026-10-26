import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { VenueCheckinsResponse } from "../types.js";

export function registerGetBeerCheckins(server: McpServer) {
  server.registerTool(
    "get_beer_checkins",
    {
      description:
        "Retrieve the recent public check-in feed for a specific beer",
      inputSchema: z.object({
        bid: z.number().int().describe("Untappd beer ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            "Results per page (max 50, default 25 — the API may cap some feeds at 25)"
          ),
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
      }),
    },
    async ({ bid, limit, max_id, min_id }) => {
      const { data, rateLimit } = await untappdFetch<VenueCheckinsResponse>(
        `/beer/checkins/${bid}`,
        { limit, max_id, min_id }
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
