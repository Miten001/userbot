/**
 * Public game data API.
 *
 * All helpers are async and fetch from the Gamemonetize JSON feed
 * (cached for 24h via Next.js fetch revalidation), with a graceful
 * fallback to `seedGames` if the network is unavailable.
 *
 * To switch to a different feed, set GAMEMONETIZE_FEED_URL in your env.
 */
export {
  getAllGames,
  getGame,
  getGamesByCategory,
  getFeatured,
  getNew,
  getPopular,
  searchGames
} from "./feed";
