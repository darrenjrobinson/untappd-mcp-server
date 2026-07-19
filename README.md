# untappd-mcp-server

[![npm version](https://img.shields.io/npm/v/untappd-mcp-server)](https://www.npmjs.com/package/untappd-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/untappd-mcp-server)](https://www.npmjs.com/package/untappd-mcp-server)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Model Context Protocol (MCP) server that exposes the Untappd API as tools for AI agents. Search for venues, breweries, and beers, check what's on tap via recent check-in feeds, and look up user activity — all from any MCP-compatible client.

## Prerequisites

- Node.js 18+
- Untappd API credentials (`client_id` and `client_secret`) from [untappd.com/api](https://untappd.com/api)

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
        "UNTAPPD_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## Tools

### venue_search

Search for venues (breweries, bars, restaurants) by name with optional location awareness.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (venue name) |
| `lat` | number | No | Latitude for location-aware results |
| `lng` | number | No | Longitude for location-aware results |

### get_venue_info

Retrieve detailed information and recent check-ins for a venue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | Yes | Untappd venue ID |
| `compact` | boolean | No | If true, returns venue info only (no checkins, media, top beers) |

### get_venue_checkins

Retrieve the recent check-in feed for a venue. This is the primary tool for determining what's currently on tap — recent check-ins act as a live signal for available beers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | Yes | Untappd venue ID |
| `limit` | integer | No | Number of results (max 25, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

### search_brewery

Search for breweries by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Brewery name search query |
| `offset` | integer | No | Offset for pagination |

### get_brewery_info

Retrieve detailed information, beer list, and recent check-ins for a brewery.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `brewery_id` | integer | Yes | Untappd brewery ID |
| `compact` | boolean | No | If true, returns brewery info only |

### search_beer

Search for beers by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Beer name search query |
| `offset` | integer | No | Pagination offset |
| `sort` | string | No | Sort order: `checkin` (default), `name`, `count` |

### get_beer_info

Retrieve detailed information for a specific beer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bid` | integer | Yes | Untappd beer ID |
| `compact` | boolean | No | If true, returns beer info only |

### get_user_info

Retrieve profile and stats for an Untappd user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `compact` | boolean | No | If true, returns user info only (no checkins, media, recent brews) |

### get_user_activity

Retrieve the recent check-in activity feed for a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Untappd username |
| `limit` | integer | No | Number of results (max 25, default 25) |
| `max_id` | integer | No | Return results older than this checkin ID |
| `min_id` | integer | No | Return only checkins newer than this ID |

## Rate Limiting

The Untappd API allows **100 calls per hour** per API key. Every tool response includes the current rate limit status:

```json
{
  "rateLimit": {
    "limit": 100,
    "remaining": 97
  }
}
```

The server does not block requests at the rate limit — if the limit is exceeded, the Untappd API returns a 429 error which is surfaced as: `Rate limit exceeded. Limit: 100, Remaining: 0. Resets hourly.`

## Authentication

This server uses `client_id` + `client_secret` authentication for public API endpoints. OAuth user authentication (access tokens) is not currently supported.

Set credentials via environment variables:

```
UNTAPPD_CLIENT_ID=your_client_id
UNTAPPD_CLIENT_SECRET=your_client_secret
```

The server will throw on startup if these are not set.

## Development

```bash
npm install
npm run build
npm start
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Known Limitations

- **No tap list data** — actual tap lists require an Untappd for Business subscription. Venue check-in feeds serve as a real-time proxy.
- **Rate limit: 100/hour** — minimise redundant calls; check-in feeds are the recommended approach for live data.
- **Venue IDs required** — use `venue_search` first to resolve a venue name to an ID.
- **Public check-ins only** — private user accounts are not visible.

## License

MIT
