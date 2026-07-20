import { expect, vi } from "vitest";
import { z } from "zod";
import type { ZodRawShape } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { _setRateLimitForTests } from "../src/client.js";

export interface CapturedTool {
  description: string;
  schema: ZodRawShape;
  handler: (
    args: Record<string, unknown>
  ) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

/** Register tools against a fake server that just captures name/schema/handler. */
export function captureTools(
  register: (s: McpServer) => void
): Record<string, CapturedTool> {
  const tools: Record<string, CapturedTool> = {};
  const fake = {
    tool: (
      name: string,
      description: string,
      schema: ZodRawShape,
      handler: CapturedTool["handler"]
    ) => {
      tools[name] = { description, schema, handler };
    },
  };
  register(fake as unknown as McpServer);
  return tools;
}

/** Parse args through the tool's zod schema (exercising it), then invoke the handler. */
export async function invokeTool(
  tool: CapturedTool,
  args: Record<string, unknown> = {}
) {
  const parsed = z.object(tool.schema).parse(args);
  const result = await tool.handler(parsed);
  const payload = JSON.parse(result.content[0].text);
  return { result, payload };
}

export interface MockResponse {
  payload?: unknown;
  status?: number;
  limit?: number;
  remaining?: number;
}

/** Stub global fetch to return queued Untappd API envelopes with rate-limit headers. */
export function mockUntappd(responses: MockResponse[]) {
  const calls: URL[] = [];
  const fn = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const r = responses.shift() ?? {};
    const status = r.status ?? 200;
    return new Response(
      JSON.stringify({ meta: { code: status }, response: r.payload ?? {} }),
      {
        status,
        headers: {
          "x-ratelimit-limit": String(r.limit ?? 100),
          "x-ratelimit-remaining": String(r.remaining ?? 87),
        },
      }
    );
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

/** Reset env and rate-limit state to a clean public-auth baseline. */
export function setupEnv() {
  process.env.UNTAPPD_CLIENT_ID = "test-client-id";
  process.env.UNTAPPD_CLIENT_SECRET = "test-client-secret";
  delete process.env.UNTAPPD_ACCESS_TOKEN;
  delete process.env.UNTAPPD_USERNAME;
  _setRateLimitForTests({ limit: 100, remaining: 100 });
}

export const DEFAULT_RATE_LIMIT = { limit: 100, remaining: 87 };

export const FEED_RESPONSE = {
  checkins: {
    count: 1,
    items: [
      {
        checkin_id: 42,
        created_at: "Sat, 18 Jul 2026 10:00:00 +0000",
        rating_score: 4.25,
        checkin_comment: "Great drop",
        beer: { bid: 5, beer_name: "Test IPA", beer_style: "IPA - American" },
        brewery: { brewery_id: 7, brewery_name: "Test Brewing" },
        user: { uid: 1, user_name: "tester" },
      },
    ],
    pagination: { since_url: "s", next_url: "n", max_id: 42 },
  },
};

/** Shared assertions for tools that return the standard check-in feed shape. */
export function expectFeedPayload(payload: Record<string, unknown>) {
  expect(payload.checkins).toEqual(FEED_RESPONSE.checkins.items);
  expect(payload.count).toBe(1);
  expect(payload.pagination).toEqual(FEED_RESPONSE.checkins.pagination);
  expect(payload.rateLimit).toEqual(DEFAULT_RATE_LIMIT);
}
