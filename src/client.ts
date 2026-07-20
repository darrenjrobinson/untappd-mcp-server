import { RateLimitInfo, UntappdApiResponse } from "./types.js";

const BASE_URL = "https://api.untappd.com/v4";

let lastRateLimit: RateLimitInfo = { limit: 100, remaining: 100 };

export function getRateLimit(): RateLimitInfo {
  return { ...lastRateLimit };
}

export function _setRateLimitForTests(info: RateLimitInfo): void {
  lastRateLimit = { ...info };
}

export type AuthMode = "auto" | "token";

/**
 * Throws if UNTAPPD_ACCESS_TOKEN is not configured. Call at the top of
 * authenticated-only tool handlers for a clear error instead of an API 401.
 */
export function checkAuthRequired(toolName: string): void {
  if (!process.env.UNTAPPD_ACCESS_TOKEN) {
    throw new Error(`UNTAPPD_ACCESS_TOKEN is required for ${toolName}`);
  }
}

/**
 * Throws if the last-observed rate limit is below `needed`. Starts optimistic
 * (100/100) before the first API call of the session.
 */
export function assertRateLimitSufficient(needed: number): void {
  if (lastRateLimit.remaining < needed) {
    throw new Error(
      `Insufficient rate limit: ${lastRateLimit.remaining} calls remaining, at least ${needed} needed. Untappd limit resets hourly.`
    );
  }
}

export function resolveUsername(
  username: string | undefined,
  toolName: string
): string {
  const resolved = username ?? process.env.UNTAPPD_USERNAME;
  if (!resolved) {
    throw new Error(
      `${toolName} requires a username parameter or the UNTAPPD_USERNAME env var`
    );
  }
  return resolved;
}

export async function untappdFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  opts: { auth?: AuthMode } = {}
): Promise<{ data: T; rateLimit: RateLimitInfo }> {
  const accessToken = process.env.UNTAPPD_ACCESS_TOKEN;
  const clientId = process.env.UNTAPPD_CLIENT_ID;
  const clientSecret = process.env.UNTAPPD_CLIENT_SECRET;

  const url = new URL(`${BASE_URL}${path}`);

  if (opts.auth === "token") {
    if (!accessToken) {
      throw new Error("UNTAPPD_ACCESS_TOKEN is required for this endpoint");
    }
    url.searchParams.set("access_token", accessToken);
  } else if (accessToken) {
    // Prefer the access token when configured: user-scoped rate limits and
    // richer /user payloads.
    url.searchParams.set("access_token", accessToken);
  } else if (clientId && clientSecret) {
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
  } else {
    throw new Error(
      "Untappd credentials required: set UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, or UNTAPPD_ACCESS_TOKEN"
    );
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request to Untappd API timed out");
    }
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  const rateLimitHeader = response.headers.get("x-ratelimit-limit");
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

  if (rateLimitHeader) lastRateLimit.limit = parseInt(rateLimitHeader, 10);
  if (rateLimitRemaining) lastRateLimit.remaining = parseInt(rateLimitRemaining, 10);

  const rateLimit = getRateLimit();

  if (response.status === 401) {
    throw new Error(
      "Invalid API credentials (check client_id/client_secret or access_token)"
    );
  }
  if (response.status === 404) {
    throw new Error("Resource not found");
  }
  if (response.status === 429) {
    throw new Error(
      `Rate limit exceeded. Limit: ${rateLimit.limit}, Remaining: 0. Resets hourly.`
    );
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Untappd API error: ${response.status} ${body}`);
  }

  const json = (await response.json()) as UntappdApiResponse<T>;
  return { data: json.response, rateLimit };
}
