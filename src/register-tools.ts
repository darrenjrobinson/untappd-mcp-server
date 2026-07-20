import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Search & lookup
import { registerVenueSearch } from "./tools/venue-search.js";
import { registerSearchBrewery } from "./tools/search-brewery.js";
import { registerSearchBeer } from "./tools/search-beer.js";

// Venue
import { registerGetVenueInfo } from "./tools/get-venue-info.js";
import { registerGetVenueCheckins } from "./tools/get-venue-checkins.js";
import { registerGetVenueFoursquareLookup } from "./tools/get-venue-foursquare-lookup.js";

// Beer
import { registerGetBeerInfo } from "./tools/get-beer-info.js";
import { registerGetBeerCheckins } from "./tools/get-beer-checkins.js";
import { registerGetTrendingBeers } from "./tools/get-trending-beers.js";

// Brewery
import { registerGetBreweryInfo } from "./tools/get-brewery-info.js";
import { registerGetBreweryCheckins } from "./tools/get-brewery-checkins.js";

// User
import { registerGetUserInfo } from "./tools/get-user-info.js";
import { registerGetUserActivity } from "./tools/get-user-activity.js";
import { registerGetUserVenueHistory } from "./tools/get-user-venue-history.js";
import { registerGetUserDistinctBeers } from "./tools/get-user-distinct-beers.js";
import { registerGetUserWishlist } from "./tools/get-user-wishlist.js";
import { registerGetUserBadges } from "./tools/get-user-badges.js";
import { registerGetUserFriends } from "./tools/get-user-friends.js";

// Activity feeds
import { registerGetGlobalFeed } from "./tools/get-global-feed.js";
import { registerGetLocalFeed } from "./tools/get-local-feed.js";
import { registerGetFriendFeed } from "./tools/get-friend-feed.js";

// Checkin
import { registerGetCheckinInfo } from "./tools/get-checkin-info.js";

// Composite / aggregation
import { registerGetUserStatsAtVenue } from "./tools/get-user-stats-at-venue.js";
import { registerSearchVenueThenGetUserStats } from "./tools/search-venue-then-get-user-stats.js";
import { registerGetUserBeerStats } from "./tools/get-user-beer-stats.js";
import { registerGetUserBadgeSummary } from "./tools/get-user-badge-summary.js";

export function registerAllTools(server: McpServer): void {
  registerVenueSearch(server);
  registerSearchBrewery(server);
  registerSearchBeer(server);

  registerGetVenueInfo(server);
  registerGetVenueCheckins(server);
  registerGetVenueFoursquareLookup(server);

  registerGetBeerInfo(server);
  registerGetBeerCheckins(server);
  registerGetTrendingBeers(server);

  registerGetBreweryInfo(server);
  registerGetBreweryCheckins(server);

  registerGetUserInfo(server);
  registerGetUserActivity(server);
  registerGetUserVenueHistory(server);
  registerGetUserDistinctBeers(server);
  registerGetUserWishlist(server);
  registerGetUserBadges(server);
  registerGetUserFriends(server);

  registerGetGlobalFeed(server);
  registerGetLocalFeed(server);
  registerGetFriendFeed(server);

  registerGetCheckinInfo(server);

  registerGetUserStatsAtVenue(server);
  registerSearchVenueThenGetUserStats(server);
  registerGetUserBeerStats(server);
  registerGetUserBadgeSummary(server);
}
