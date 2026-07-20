import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { untappdFetch } from "../client.js";
import { CheckinViewResponse } from "../types.js";

export function registerGetCheckinInfo(server: McpServer) {
  server.tool(
    "get_checkin_info",
    "Retrieve extended details for a specific check-in, including badges earned, toasts, and comments",
    {
      checkin_id: z.number().int().describe("Untappd check-in ID"),
    },
    async ({ checkin_id }) => {
      const { data, rateLimit } = await untappdFetch<CheckinViewResponse>(
        `/checkin/view/${checkin_id}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                checkin: data.checkin,
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
