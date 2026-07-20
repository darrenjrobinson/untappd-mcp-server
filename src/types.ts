export interface UntappdApiResponse<T> {
  meta: {
    code: number;
    response_time: {
      time: number;
      measure: string;
    };
    init_time: {
      time: number;
      measure: string;
    };
  };
  notifications?: unknown;
  response: T;
}

export interface VenueSearchResponse {
  venues: {
    count: number;
    items: Array<{ venue: VenueSearchItem }>;
  };
}

export interface VenueSearchItem {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  primary_category_key: string;
  primary_category: string;
  parent_category_id: string;
  categories: {
    count: number;
    items: Array<{
      category_key: string;
      category_name: string;
      category_id: string;
      is_primary: boolean;
    }>;
  };
  location: VenueLocation;
  contact: VenueContact;
  foursquare: {
    foursquare_id: string;
    foursquare_url: string;
  };
  venue_icon: {
    sm: string;
    md: string;
    lg: string;
  };
  is_verified: boolean;
}

export interface VenueLocation {
  venue_address: string;
  venue_city: string;
  venue_state: string;
  venue_country: string;
  lat: number;
  lng: number;
}

export interface VenueContact {
  twitter: string;
  venue_url: string;
  facebook: string;
}

export interface VenueInfoResponse {
  venue: VenueDetail;
}

export interface VenueDetail {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  primary_category_key: string;
  primary_category: string;
  location: VenueLocation;
  contact: VenueContact;
  stats: {
    total_count: number;
    user_count: number;
    total_user_count: number;
    monthly_count: number;
    weekly_count: number;
  };
  top_beers?: {
    count: number;
    items: Array<{
      created_at: string;
      total_count: number;
      beer: BeerSimple;
      brewery: BrewerySimple;
    }>;
  };
  checkins?: CheckinList;
}

export interface CheckinList {
  count: number;
  items: CheckinItem[];
  pagination?: {
    since_url: string;
    next_url: string;
    max_id: number;
  };
}

export interface CheckinItem {
  checkin_id: number;
  created_at: string;
  rating_score: number;
  checkin_comment: string;
  beer: BeerSimple;
  brewery: BrewerySimple;
  user: {
    uid: number;
    user_name: string;
    first_name: string;
    last_name: string;
    user_avatar: string;
  };
  venue?: VenueSearchItem;
}

export interface VenueCheckinsResponse {
  checkins: CheckinList;
}

export interface BrewerySearchResponse {
  brewery: {
    count: number;
    items: Array<{
      brewery: BrewerySearchItem;
    }>;
  };
}

export interface BrewerySearchItem {
  brewery_id: number;
  brewery_name: string;
  brewery_slug: string;
  brewery_type: string;
  brewery_label: string;
  country_name: string;
  contact: {
    twitter: string;
    facebook: string;
    url: string;
  };
  location: {
    brewery_city: string;
    brewery_state: string;
    lat: number;
    lng: number;
  };
  brewery_active: number;
}

export interface BreweryInfoResponse {
  brewery: BreweryDetail;
}

export interface BreweryDetail {
  brewery_id: number;
  brewery_name: string;
  brewery_slug: string;
  brewery_type: string;
  brewery_label: string;
  brewery_description: string;
  country_name: string;
  contact: {
    twitter: string;
    facebook: string;
    url: string;
  };
  location: {
    brewery_city: string;
    brewery_state: string;
    lat: number;
    lng: number;
  };
  stats: {
    total_count: number;
    unique_count: number;
    monthly_count: number;
    weekly_count: number;
    user_count: number;
    age_on_service: number;
  };
  beer_list?: {
    count: number;
    items: Array<{
      total_count: number;
      beer: BeerSimple;
    }>;
  };
  checkins?: CheckinList;
}

export interface BeerSearchResponse {
  beers: {
    count: number;
    items: Array<{
      checkin_count: number;
      beer: BeerSimple;
      brewery: BrewerySimple;
    }>;
  };
}

export interface BeerInfoResponse {
  beer: BeerDetail;
}

export interface BeerSimple {
  bid: number;
  beer_name: string;
  beer_label: string;
  beer_style: string;
  beer_abv: number;
  beer_ibu: number;
  beer_slug: string;
  beer_description?: string;
  rating_score?: number;
  rating_count?: number;
  auth_rating?: number;
  wish_list?: boolean;
}

export interface BrewerySimple {
  brewery_id: number;
  brewery_name: string;
  brewery_slug: string;
  brewery_type: string;
  brewery_label: string;
  country_name: string;
  contact: {
    twitter: string;
    facebook: string;
    url: string;
  };
  location: {
    brewery_city: string;
    brewery_state: string;
    lat: number;
    lng: number;
  };
}

export interface BeerDetail extends BeerSimple {
  beer_description: string;
  is_in_production: number;
  created_at: string;
  rating_score: number;
  rating_count: number;
  stats: {
    total_count: number;
    monthly_count: number;
    total_user_count: number;
    user_count: number;
  };
  brewery: BrewerySimple;
  similar?: {
    count: number;
    items: Array<{
      beer: BeerSimple;
      brewery: BrewerySimple;
    }>;
  };
  checkins?: CheckinList;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
}

export interface BadgeImage {
  sm: string;
  md: string;
  lg: string;
}

export interface BadgeItem {
  badge_id: number;
  user_badge_id?: number;
  badge_name: string;
  badge_description: string;
  badge_image: BadgeImage;
  created_at: string;
  checkin_id?: number;
}

export interface UserBadgesResponse {
  badges: {
    count: number;
    items: BadgeItem[];
  };
}

export interface FriendUser {
  uid: number;
  user_name: string;
  first_name: string;
  last_name: string;
  user_avatar: string;
  location?: string;
  relationship?: string;
  stats?: {
    total_badges: number;
    total_friends: number;
    total_checkins: number;
    total_beers: number;
    total_created_beers?: number;
  };
}

export interface UserFriendsResponse {
  found: number;
  items: Array<{
    friendship_hash: string;
    created_at: string;
    user: FriendUser;
  }>;
}

export interface WishlistItem {
  created_at: string;
  beer: BeerSimple;
  brewery: BrewerySimple;
}

export interface UserWishlistResponse {
  beers: {
    count: number;
    items: WishlistItem[];
  };
}

export interface DistinctBeerItem {
  first_checkin_id: number;
  recent_checkin_id: number;
  first_created_at: string;
  recent_created_at: string;
  rating_score: number;
  count: number;
  beer: BeerSimple;
  brewery: BrewerySimple;
}

export interface UserBeersResponse {
  total_count?: number;
  beers: {
    count: number;
    items: DistinctBeerItem[];
  };
}

export interface FoursquareLookupResponse {
  venue: {
    count: number;
    items: VenueSearchItem[];
  };
}

export interface ToastItem {
  uid: number;
  user: FriendUser;
  like_owner?: boolean;
  created_at: string;
}

export interface CommentItem {
  user: FriendUser;
  checkin_comment_id: number;
  comment: string;
  created_at: string;
}

export interface CheckinDetail extends CheckinItem {
  badges?: {
    count: number;
    items: BadgeItem[];
  };
  toasts?: {
    total_count?: number;
    count: number;
    items: ToastItem[];
  };
  comments?: {
    total_count?: number;
    count: number;
    items: CommentItem[];
  };
}

export interface CheckinViewResponse {
  checkin: CheckinDetail;
}

export interface TrendingItem {
  checkin_count?: number;
  beer: BeerSimple;
  brewery: BrewerySimple;
}

export interface TrendingResponse {
  macro: {
    count: number;
    items: TrendingItem[];
  };
  micro: {
    count: number;
    items: TrendingItem[];
  };
}

export interface VenueHistoryItem {
  venue: VenueSearchItem;
  first_checkin_id: number;
  last_checkin_id: number;
  total_count: number;
  first_created_at: string;
  last_created_at: string;
}

export interface UserVenueHistoryResponse {
  venues: {
    count: number;
    items: VenueHistoryItem[];
  };
}
