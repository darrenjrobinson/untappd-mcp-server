#!/usr/bin/env node
// Live smoke test: exercises every tool once against the real Untappd API.
// Requires UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET (or UNTAPPD_ACCESS_TOKEN).
// Authenticated-only tools are skipped when UNTAPPD_ACCESS_TOKEN is absent.
// Costs ~22 API calls of the 100/hour budget (~28 with a token).
//
// Usage: npm run smoke [-- --only=tool_name]

import { registerAllTools } from "../dist/register-tools.js";
import { getRateLimit } from "../dist/client.js";

const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length);

const hasToken = !!process.env.UNTAPPD_ACCESS_TOKEN;
const hasClientCreds = !!(
  process.env.UNTAPPD_CLIENT_ID && process.env.UNTAPPD_CLIENT_SECRET
);
if (!hasClientCreds && !hasToken) {
  console.error(
    "Missing credentials: set UNTAPPD_CLIENT_ID + UNTAPPD_CLIENT_SECRET, or UNTAPPD_ACCESS_TOKEN"
  );
  process.exit(1);
}

// Fallback is a known-valid public Untappd account (co-founder). Set
// UNTAPPD_USERNAME to smoke-test against your own profile.
const username = process.env.UNTAPPD_USERNAME ?? "gregavola";

// Capture tool handlers the same way the unit tests do.
const tools = {};
registerAllTools({
  tool: (name, _description, _schema, handler) => {
    tools[name] = handler;
  },
});

const results = [];
let aborted = false;

async function run(name, args, { skip, reason } = {}) {
  if (only && name !== only) return null;
  if (skip) {
    console.log(`- SKIP ${name} — ${reason}`);
    results.push({ name, status: "skip", reason });
    return null;
  }
  if (aborted) {
    results.push({ name, status: "skip", reason: "aborted (rate limit low)" });
    return null;
  }
  try {
    const result = await tools[name](args);
    const payload = JSON.parse(result.content[0].text);
    const remaining = payload.rateLimit?.remaining ?? getRateLimit().remaining;
    console.log(`✔ ${name} — remaining: ${remaining}`);
    results.push({ name, status: "pass", remaining });
    if (remaining < 5) {
      console.error(`Aborting: only ${remaining} API calls remaining this hour`);
      aborted = true;
    }
    return payload;
  } catch (err) {
    // Some endpoints (e.g. /thepub) require elevated API key permissions —
    // report as restricted rather than failing the run.
    if (/not authorized to call this method from this key/i.test(err.message)) {
      console.log(`- RESTRICTED ${name} — API key lacks access to this endpoint`);
      results.push({ name, status: "restricted" });
      return null;
    }
    console.error(`✖ ${name} — ${err.message}`);
    results.push({ name, status: "fail", error: err.message });
    return null;
  }
}

// --- Beer chain ---
const beerSearch = await run("search_beer", { q: "Pliny the Elder", sort: "checkin" });
const bid = beerSearch?.beers?.[0]?.beer?.bid ?? 4499; // fallback: Pliny the Elder
await run("get_beer_info", { bid, compact: true });
await run("get_beer_checkins", { bid, limit: 5 });

// --- Brewery chain ---
const brewerySearch = await run("search_brewery", { q: "Russian River" });
const breweryId = brewerySearch?.breweries?.[0]?.brewery_id ?? 259; // fallback: Russian River
await run("get_brewery_info", { brewery_id: breweryId, compact: true });
const breweryCheckins = await run("get_brewery_checkins", { brewery_id: breweryId, limit: 5 });
const checkinId = breweryCheckins?.checkins?.[0]?.checkin_id;
await run(
  "get_checkin_info",
  { checkin_id: checkinId },
  checkinId ? {} : { skip: true, reason: "no checkin_id from brewery feed" }
);

// --- Venue chain ---
const venueSearch = await run("venue_search", { q: "Bracket Brewing" });
const venue = venueSearch?.venues?.[0];
const venueId = venue?.venue_id;
const venueInfo = await run(
  "get_venue_info",
  { venue_id: venueId },
  venueId ? {} : { skip: true, reason: "no venue from search" }
);
await run(
  "get_venue_checkins",
  { venue_id: venueId, limit: 5 },
  venueId ? {} : { skip: true, reason: "no venue from search" }
);
const foursquareId =
  venue?.foursquare?.foursquare_id ??
  venueInfo?.venue?.foursquare?.foursquare_id;
await run(
  "get_venue_foursquare_lookup",
  { foursquare_id: foursquareId },
  foursquareId ? {} : { skip: true, reason: "no foursquare_id on venue" }
);

// --- Trending & feeds ---
await run("get_trending_beers", {});
await run("get_global_feed", { limit: 5 });
await run("get_local_feed", { lat: -33.8688, lng: 151.2093, radius: 25, limit: 5 });

// --- User chain ---
const userInfo = await run("get_user_info", { username, compact: true });
// If the username doesn't resolve, skip the rest of the user chain — some
// user endpoints return empty lists instead of 404 for unknown users, which
// would produce vacuous passes.
const userSkip = userInfo
  ? {}
  : { skip: true, reason: `username "${username}" did not resolve` };
await run("get_user_activity", { username, limit: 5 }, userSkip);
await run("get_user_badges", { username }, userSkip);
await run("get_user_friends", { username, limit: 5 }, userSkip);
await run("get_user_wishlist", { username, limit: 5 }, userSkip);
await run("get_user_distinct_beers", { username, limit: 5, sort: "checkin" }, userSkip);

// --- Composites (public) ---
await run("get_user_beer_stats", { username, max_pages: 1 }, userSkip);
await run("get_user_badge_summary", { username, max_pages: 1 }, userSkip);

// --- Authenticated-only tools ---
const authSkip = hasToken
  ? {}
  : { skip: true, reason: "no UNTAPPD_ACCESS_TOKEN" };
await run("get_friend_feed", { limit: 5 }, authSkip);
const history = await run(
  "get_user_venue_history",
  { username, limit: 5 },
  authSkip
);
const historyVenue = history?.venues?.[0]?.venue;
await run(
  "get_user_stats_at_venue",
  { venue_id: historyVenue?.venue_id, username, max_pages: 1 },
  hasToken && historyVenue
    ? {}
    : { skip: true, reason: hasToken ? "no venue in history" : "no UNTAPPD_ACCESS_TOKEN" }
);
await run(
  "search_venue_then_get_user_stats",
  { q: historyVenue?.venue_name, username, max_pages: 1 },
  hasToken && historyVenue
    ? {}
    : { skip: true, reason: hasToken ? "no venue in history" : "no UNTAPPD_ACCESS_TOKEN" }
);

// --- Summary ---
const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail");
const skipped = results.filter((r) => r.status === "skip").length;
const restricted = results.filter((r) => r.status === "restricted").length;

console.log("\n--- Smoke summary ---");
console.log(
  `passed: ${passed}, failed: ${failed.length}, skipped: ${skipped}, restricted: ${restricted}`
);
console.log(`rate limit remaining: ${getRateLimit().remaining}`);
for (const f of failed) {
  console.log(`  FAIL ${f.name}: ${f.error}`);
}

process.exit(failed.length > 0 ? 1 : 0);
