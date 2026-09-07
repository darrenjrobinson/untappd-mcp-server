# untappd-mcp-server

[![npm version](https://img.shields.io/npm/v/untappd-mcp-server)](https://www.npmjs.com/package/untappd-mcp-server)
[![npm downloads](https://img.shields.io/npm/dt/untappd-mcp-server)](https://www.npmjs.com/package/untappd-mcp-server)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Model Context Protocol (MCP) server that exposes the Untappd API as tools for AI agents — **27 tools** covering the full Untappd v4 read API, plus built-in interactive OAuth authentication. Search venues, breweries, and beers; check what's on tap via check-in feeds; explore user badges, friends, wish lists, and drinking history; and aggregate stats — all from any MCP-compatible client.

## Prerequisites

- Node.js 20+
- Untappd API credentials (`client_id` and `client_secret`) from [untappd.com/api](https://untappd.com/api)
- Optional: an Untappd OAuth access token to unlock authenticated tools — obtainable in-chat via the `authenticate_untappd` tool or `npx untappd-mcp-server auth` (see [Interactive Authentication](#interactive-authentication))

## Quick Start

### Via npx (zero install)

```bash
UNTAPPD_CLIENT_ID=xxx UNTAPPD_CLIENT_SECRET=yyy npx untappd-mcp-server
```

### PowerShell

```powershell
$env:UNTAPPD_CLIENT_ID = "your_client_id"
$env:UNTAPPD_CLIENT_SECRET = "your_client_secret"
npx untappd-mcp-server
```

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "untappd": {
      "command": "npx",
      "args": ["untappd-mcp-server"],
      "env": {
        "UNTAPPD_CLIENT_ID": "your_client_id",
        "UNTAPPD_CLIENT_SECRET": "your_client_secret",
        "UNTAPPD_ACCESS_TOKEN": "optional_oauth_token",
        "UNTAPPD_USERNAME": "optional_default_username"
      }
    }
  }
}
```

## Tools

Tools marked **🔑 token** require an access token (`UNTAPPD_ACCESS_TOKEN` env var or interactive authentication).

### Authentication Tools

#### authenticate_untappd

Interactively authenticate with Untappd via OAuth: opens your browser to Untappd's approve page, captures the redirect on a temporary localhost listener, and saves the access token — the 🔑 tools work immediately, no restart. **Prerequisite:** your Untappd app's Callback URL must be set to exactly `http://localhost:8737/callback` (or your `UNTAPPD_REDIRECT_URL`).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeout_seconds` | integer | No | How long to wait for browser approval (default 180, max 600) |

#### get_auth_status

Report authentication status: token presence, source (env var or token file), file path, and whether the 🔑 tools are unlocked. Free by default; `validate: true` verifies the token with one API call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `validate` | boolean | No | Verify the token against the API with one call (default false) |

### Search & Lookup

#### venue_search

Search for venues (breweries, bars, restaurants) by name with optional location awareness.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (venue name) |
| `lat` | number | No | Latitude for location-aware results |
| `lng` | number | No | Longitude for location-aware results |

#### search_brewery

Search for breweries by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Brewery name search query |
| `offset` | integer | No | Offset for pagination |

#### search_beer

Search for beers by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Beer name search query |
| `offset` | integer | No | Pagination offset |
| `sort` | string | No | Sort order: `checkin` (default), `name`, `count` |

### Venue

#### get_venue_info

Retrieve detailed information and recent check-ins for a venue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | Yes | Untappd venue ID |
| `compact` | boolean | No | If true, returns venue info only (no checkins, media, top beers) |

#### get_venue_checkins

Retrieve the recent check-in feed for a venue. This is the primary tool for determining what's currently on tap — recent check-ins act as a live signal for available beers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | Yes | Untappd venue ID |
| `limit` | integer | No | Number of results (max 25, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

#### get_venue_foursquare_lookup

Resolve a Foursquare venue ID to its Untappd venue — the bridge between Foursquare/location data and Untappd venue tools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `foursquare_id` | string | Yes | Foursquare venue ID in v2 MD5-hash format (v3 numeric IDs will not work) |

### Beer

#### get_beer_info

Retrieve detailed information for a specific beer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bid` | integer | Yes | Untappd beer ID |
| `compact` | boolean | No | If true, returns beer info only |

#### get_beer_checkins

Retrieve the recent public check-in feed for a specific beer — what people are saying about it right now, and where they're drinking it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bid` | integer | Yes | Untappd beer ID |
| `limit` | integer | No | Results per page (max 50, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

#### get_trending_beers

Retrieve globally trending beers (macro and micro brew lists, by recent check-in velocity). No parameters.

### Brewery

#### get_brewery_info

Retrieve detailed information, beer list, and recent check-ins for a brewery.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `brewery_id` | integer | Yes | Untappd brewery ID |
| `compact` | boolean | No | If true, returns brewery info only |

#### get_brewery_checkins

Retrieve the recent public check-in feed for a brewery — all its beers being checked in globally.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `brewery_id` | integer | Yes | Untappd brewery ID |
| `limit` | integer | No | Results per page (max 50, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

### User

#### get_user_info

Retrieve profile and stats for an Untappd user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `compact` | boolean | No | If true, returns user info only (no checkins, media, recent brews) |

#### get_user_activity

Retrieve the recent check-in activity feed for a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `limit` | integer | No | Number of results (max 25, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

#### get_user_distinct_beers

Retrieve the unique beers a user has checked in, with flexible sort ordering. `sort=checkin` with `limit=1` is the single-call pattern for "most-checked-in beer".

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `offset` | integer | No | Pagination offset |
| `limit` | integer | No | Results per page (max 50, default 25) |
| `sort` | string | No | `date` (default), `checkin`, `highest_rated`, `lowest_rated`, `highest_rated_you`, `lowest_rated_you` |

#### get_user_wishlist

Retrieve beers on a user's wish list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `offset` | integer | No | Pagination offset |
| `limit` | integer | No | Results per page (max 50, default 25) |
| `sort` | string | No | `date` (default), `checkin`, `highest_rated`, `lowest_rated` |

#### get_user_badges

Retrieve a user's earned badges (pages of 50, most recent first).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `offset` | integer | No | Pagination offset (pages of 50) |

#### get_user_friends

Retrieve a user's friend list (public accounts only).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `offset` | integer | No | Pagination offset |
| `limit` | integer | No | Results per page (max 50, default 25) |

### Activity Feeds

#### get_global_feed

Retrieve the global public check-in feed (The Pub). High rate-limit cost for the data returned — prefer `min_id` polling to fetch only new check-ins. **Note:** standard API keys are typically not authorized for `/thepub` — Untappd returns *"You are not authorized to call this method from this key"* unless your key has elevated access (`get_local_feed` is not restricted).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (max 50, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

#### get_local_feed

Retrieve the public check-in feed near a geographic point.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | number | Yes | Latitude |
| `lng` | number | Yes | Longitude |
| `radius` | integer | No | Radius in **miles** (default 25, max 50) |
| `limit` | integer | No | Results per page (max 50, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

#### get_friend_feed 🔑 token

Retrieve the friend check-in feed for the authenticated user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (max 50, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

### Checkin

#### get_checkin_info

Retrieve extended details for a specific check-in, including badges earned, toasts, and comments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `checkin_id` | integer | Yes | Untappd check-in ID |

### Composite / Aggregation

These tools make multiple API calls (1 per page scanned — 50 beers/badges, 25 check-ins). They pre-check the remaining rate limit before starting and stop early — setting `truncated: true` in the response — if the budget runs low.

#### get_user_stats_at_venue

Get a user's check-in stats at a specific venue — visit count, last visit, average rating, top beers — by scanning their recent check-in feed. Untappd's API has no venue-history endpoint, so the stats cover the scanned window (`max_pages` × 25 check-ins), not all time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | Yes | Untappd venue ID |
| `username` | string | No | Untappd username (defaults to `UNTAPPD_USERNAME`) |
| `max_pages` | integer | No | Max feed pages to scan at 25 check-ins/page (default 5 = 125 check-ins) |

#### search_venue_then_get_user_stats

Search for a venue by name, then get the user's check-in stats at the top match.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Venue search query |
| `username` | string | No | Untappd username (defaults to `UNTAPPD_USERNAME`) |
| `lat` | number | No | Latitude for location-aware search |
| `lng` | number | No | Longitude for location-aware search |
| `max_pages` | integer | No | Max feed pages to scan at 25 check-ins/page (default 5 = 125 check-ins) |

#### get_user_beer_stats

Aggregate a user's distinct beer history into style, brewery, and rating breakdowns — top styles, top breweries, average personal vs global ratings, highest-rated, and most-checked-in.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `max_pages` | integer | No | Max pages to scan at 50 beers/page (default 10 = 500 beers) |

#### get_user_badge_summary

Retrieve all badges for a user (paginating to completion) with a structured summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `max_pages` | integer | No | Max pages to scan at 50 badges/page (default 10 = 500 badges) |

## Rate Limiting

The Untappd API allows **100 calls per hour** per API key (per access token when authenticated). Every tool response includes the current rate limit status:

```json
{
  "rateLimit": {
    "limit": 100,
    "remaining": 97
  }
}
```

Composite tools call `assertRateLimitSufficient` before starting pagination and stop early with `truncated: true` rather than exhausting the budget. If the limit is exceeded, the Untappd API returns a 429 error which is surfaced as: `Rate limit exceeded. Limit: 100, Remaining: 0. Resets hourly.`

## Authentication

| Mode | Env Vars | Unlocks |
|------|----------|---------|
| Public | `UNTAPPD_CLIENT_ID` + `UNTAPPD_CLIENT_SECRET` | All public tools |
| Authenticated | + `UNTAPPD_ACCESS_TOKEN` (+ optional `UNTAPPD_USERNAME`) | `get_friend_feed`, user-scoped rate limits, richer `/user` data |

When an access token is configured (env var or saved token file), the server prefers it for **all** calls — rate limits become user-scoped and `/user` endpoints return richer data. `UNTAPPD_USERNAME` provides a default username for authenticated user tools.

The server exits on startup if neither a client id/secret pair nor an access token is configured.

## Interactive Authentication

You don't need to obtain an access token manually — the server can run Untappd's OAuth flow for you.

**One-time prerequisite:** in your Untappd app settings at [untappd.com/api](https://untappd.com/api), set the **Callback URL** to exactly:

```
http://localhost:8737/callback
```

(or the value of `UNTAPPD_REDIRECT_URL` if you override it — it must be a localhost http URL, and the two must match exactly or Untappd rejects the flow).

**In chat:** ask your agent to run the `authenticate_untappd` tool. Your browser opens to Untappd's approve page; once you approve, the token is saved and the 🔑 tools work immediately — no restart needed.

**In a terminal:**

```bash
npx untappd-mcp-server auth            # run the interactive flow
npx untappd-mcp-server auth --status   # show current auth status
npx untappd-mcp-server auth --clear    # delete the saved token
```

(In the repo: `npm run auth`.)

**Storage & precedence:** the token is saved to `~/.untappd-mcp-server/token.json` (override with `UNTAPPD_TOKEN_PATH`). If `UNTAPPD_ACCESS_TOKEN` is set it always wins over the file. Untappd tokens do not expire.

**Security note:** the token is stored in plaintext with `0600` permissions on macOS/Linux; on Windows protection relies on your user-profile ACLs. Delete it any time with `auth --clear`. Tool outputs only ever include a masked form of the token.

## Development

```bash
npm install
npm run build
npm test          # unit tests (mocked API — no rate limit cost)
npm run smoke     # live smoke test against the real API (~25 calls, ~26 with a token)
```

The smoke test uses your `UNTAPPD_*` env vars, skips authenticated tools when no access token is set, and aborts if the remaining rate limit drops below 5. Filter to a single tool with `npm run smoke -- --only=tool_name`.

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Known Limitations

- **No tap list data** — actual tap lists require an Untappd for Business subscription. Venue check-in feeds serve as a real-time proxy.
- **No venue events** — Untappd's public API has no events endpoint, and the Eventbrite search API that could have bridged the gap was discontinued; deferred to v3.
- **No venue-history endpoint** — the v4 API has no per-user venue history; `get_user_stats_at_venue` scans the recent check-in feed instead, so its stats cover a window (`max_pages` × 25 check-ins), not all time.
- **Rate limit: 100/hour** — minimise redundant calls; every response surfaces `rateLimit.remaining`.
- **Feed limit caps** — tools accept `limit` up to 50, but the API caps some feeds at 25 server-side.
- **Global feed requires an elevated key** — `/thepub` (`get_global_feed`) is not authorized for standard API keys; the local feed works with any key.
- **Foursquare lookup requires v2 IDs** — the MD5-hash format; Foursquare v3 numeric IDs will not work.
- **Venue IDs required** — use `venue_search` first to resolve a venue name to an ID.
- **Public check-ins only** — private user accounts are not visible.
- **Read-only** — write operations (check-in, toast, comment, wish-list management) are deferred to v3.
- **MCP client timeouts** — some MCP clients cap tool-call duration below the `authenticate_untappd` default of 180s; pass a smaller `timeout_seconds` if your client times out first, or use `npx untappd-mcp-server auth` in a terminal instead.

## License

MIT
