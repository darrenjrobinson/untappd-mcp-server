import { RateLimitInfo, UntappdApiResponse } from "./types.js";

const BASE_URL = "https://api.untappd.com/v4";

let lastRateLimit: RateLimitInfo = { limit: 100, remaining: 100 };

export function getRateLimit(): RateLimitInfo {
  return { ...lastRateLimit };
}

export async function untappdFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<{ data: T; rateLimit: RateLimitInfo }> {
  const clientId = process.env.UNTAPPD_CLIENT_ID;
  const clientSecret = process.env.UNTAPPD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "UNTAPPD_CLIENT_ID and UNTAPPD_CLIENT_SECRET are required"
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);

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
    throw new Error("Invalid API credentials");
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
