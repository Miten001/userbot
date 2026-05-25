import { Game, CategorySlug } from "./types";
import { seedGames } from "./seed-games";

/**
 * Pulls games from the public Gamemonetize JSON feed, normalizes them
 * to our internal Game type, and caches the result.
 *
 * The feed is the same one their RSS Builder generates:
 *   https://gamemonetize.com/rss-feed.php?format=0&amount=1000&category=All&type=html5&company=All&gateway=All
 *
 * - `format=0` returns JSON
 * - `amount` caps at 1000 per request
 * - we revalidate once per day so the catalog stays fresh without rebuilds
 *
 * If the feed fails (network down, dev offline, schema change), we fall back
 * to the local seedGames list so the site never breaks.
 */

const DEFAULT_FEED_URL =
  "https://gamemonetize.com/rss-feed.php?format=0&amount=1000&category=All&type=html5&company=All&gateway=All";

const REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day

// ---- Raw feed item shape (only fields we actually use) ----
type FeedItem = {
  id?: string;
  title?: string;
  description?: string;
  instructions?: string;
  category?: string;
  tags?: string;
  url?: string; // embed URL
  width?: string | number;
  height?: string | number;
  // GameMonetize uses several thumbnail keys depending on feed version
  thumb?: string;
  image?: string;
  asset?: string;
  thumb_1?: string;
  thumb_2?: string;
  image_180x180?: string;
  image_512x384?: string;
  image_512x512?: string;
};

// ---- Public helpers ----------------------------------------------------------

let cache: { games: Game[]; expiresAt: number } | null = null;

export async function getAllGames(): Promise<Game[]> {
  // Per-process cache (Next.js will also fetch-cache thanks to revalidate)
  if (cache && cache.expiresAt > Date.now()) return cache.games;

  const feedUrl = process.env.GAMEMONETIZE_FEED_URL || DEFAULT_FEED_URL;
  let games: Game[] = [];

  try {
    // 8 second timeout — keeps the Vercel build from hanging forever
    // if Gamemonetize is slow or unreachable. We fall back to seedGames.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(feedUrl, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "user-agent": "PlayHubBot/1.0 (+https://nextjs.org)" },
      signal: ac.signal
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);

    const data = await res.json();
    const raw: FeedItem[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: FeedItem[] })?.items)
        ? (data as { items: FeedItem[] }).items
        : Array.isArray((data as { games?: FeedItem[] })?.games)
          ? (data as { games: FeedItem[] }).games
          : [];

    games = raw
      .map(mapFeedItem)
      .filter((g): g is Game => Boolean(g));

    // De-duplicate by slug
    const seen = new Set<string>();
    games = games.filter((g) => {
      if (seen.has(g.slug)) return false;
      seen.add(g.slug);
      return true;
    });
  } catch (err) {
    console.warn(
      "[feed] Failed to load Gamemonetize feed, falling back to seed games:",
      err instanceof Error ? err.message : err
    );
  }

  // Fallback / merge: if feed gave us nothing, use seeds.
  // If somehow seeds are also empty, return a single placeholder so the
  // build never crashes on an empty array (e.g. generateStaticParams).
  if (games.length === 0) games = seedGames;
  if (games.length === 0) {
    games = [
      {
        slug: "coming-soon",
        title: "Coming soon",
        description: "Games are loading. Check back in a few minutes.",
        category: "casual",
        tags: [],
        thumbnail: "https://picsum.photos/seed/coming-soon/640/400",
        embedUrl: "about:blank"
      }
    ];
  }

  // Sprinkle some featured/new flags on top games so the homepage never looks bare
  games = decorateRanking(games);

  cache = {
    games,
    expiresAt: Date.now() + REVALIDATE_SECONDS * 1000
  };
  return games;
}

export async function getGame(slug: string): Promise<Game | undefined> {
  const all = await getAllGames();
  return all.find((g) => g.slug === slug);
}

export async function getGamesByCategory(
  category: string
): Promise<Game[]> {
  const all = await getAllGames();
  return all.filter((g) => g.category === category);
}

export async function getFeatured(n = 6): Promise<Game[]> {
  const all = await getAllGames();
  return all.filter((g) => g.featured).slice(0, n);
}

export async function getNew(n = 8): Promise<Game[]> {
  const all = await getAllGames();
  return all.filter((g) => g.new).slice(0, n);
}

export async function getPopular(n = 12): Promise<Game[]> {
  const all = await getAllGames();
  return [...all]
    .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
    .slice(0, n);
}

export async function searchGames(q: string): Promise<Game[]> {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const all = await getAllGames();
  return all.filter(
    (g) =>
      g.title.toLowerCase().includes(term) ||
      g.description.toLowerCase().includes(term) ||
      g.tags.some((t) => t.toLowerCase().includes(term)) ||
      g.category.includes(term)
  );
}

// ---- Internals ---------------------------------------------------------------

function mapFeedItem(item: FeedItem): Game | null {
  const title = (item.title || "").trim();
  if (!title) return null;

  const id = (item.id || "").trim();
  const slug = slugify(title) || slugify(id);
  if (!slug) return null;

  let embedUrl = (item.url || "").trim();
  // Force HTTPS
  if (embedUrl.startsWith("http://")) embedUrl = "https://" + embedUrl.slice(7);
  if (!embedUrl) return null;

  // Append publisher tracking ID if configured
  embedUrl = withPublisher(embedUrl);

  const thumbnail =
    item.image_512x384 ||
    item.image_512x512 ||
    item.thumb ||
    item.image ||
    item.asset ||
    item.thumb_1 ||
    item.thumb_2 ||
    item.image_180x180 ||
    `https://picsum.photos/seed/${slug}/640/400`;

  const tagList = (item.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const category = mapCategory(item.category);

  // Synthesize popularity from id hash so ordering is stable across builds
  const plays = 25_000 + (hashString(slug) % 1_500_000);
  const rating = 4 + ((hashString(title) % 90) / 100); // 4.00 - 4.89

  return {
    slug,
    title,
    description:
      (item.description || item.instructions || `Play ${title} online for free.`).slice(
        0,
        320
      ),
    category,
    tags: tagList.slice(0, 6),
    thumbnail,
    embedUrl,
    aspect: aspectFromDims(item.width, item.height),
    plays,
    rating: Math.round(rating * 10) / 10,
    controls: item.instructions
      ? splitInstructions(item.instructions)
      : undefined
  };
}

function decorateRanking(games: Game[]): Game[] {
  // Top-10 by plays = featured. Top-20..40 = new. Cheap and stable.
  const sorted = [...games].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0));
  const featuredSet = new Set(sorted.slice(0, 10).map((g) => g.slug));
  const newSet = new Set(sorted.slice(20, 40).map((g) => g.slug));
  return games.map((g) => ({
    ...g,
    featured: g.featured ?? featuredSet.has(g.slug),
    new: g.new ?? newSet.has(g.slug)
  }));
}

function withPublisher(url: string): string {
  const pub = process.env.NEXT_PUBLIC_GAMEMONETIZE_PUBLISHER?.trim();
  if (!pub) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("gd_sdk_referrer_url")) {
      u.searchParams.set("gd_sdk_referrer_url", pub);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function aspectFromDims(
  w?: string | number,
  h?: string | number
): Game["aspect"] {
  const W = Number(w) || 0;
  const H = Number(h) || 0;
  if (!W || !H) return "16/9";
  const ratio = W / H;
  if (ratio > 1.6) return "16/9";
  if (ratio > 1.2) return "4/3";
  if (ratio > 0.95) return "1/1";
  return "9/16";
}

function splitInstructions(s: string): string[] {
  // Split by common separators; keep up to 4 short hints
  return s
    .replace(/<[^>]+>/g, "")
    .split(/[.;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && p.length < 80)
    .slice(0, 4);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Maps Gamemonetize categories -> our 11 internal slugs
function mapCategory(raw?: string): CategorySlug {
  const c = (raw || "").toLowerCase().trim();

  if (c.includes("2 player") || c.includes("two player")) return "2-player";
  if (c.includes("girl") || c.includes("cooking") || c.includes("dress"))
    return "girls";
  if (c === "io" || c.includes(".io") || c.includes("multiplayer")) return "io";
  if (c.includes("racing") || c.includes("car") || c.includes("driving"))
    return "racing";
  if (
    c.includes("shoot") ||
    c.includes("fps") ||
    c.includes("sniper") ||
    c.includes("gun")
  )
    return "shooting";
  if (
    c.includes("sport") ||
    c.includes("soccer") ||
    c.includes("football") ||
    c.includes("basketball") ||
    c.includes("pool")
  )
    return "sports";
  if (c.includes("puzzle") || c.includes("bejeweled") || c.includes("match"))
    return "puzzle";
  if (c.includes("adventure") || c.includes("rpg")) return "adventure";
  if (c.includes("arcade") || c.includes("clicker")) return "arcade";
  if (c.includes("action") || c.includes("stickman") || c.includes("fight"))
    return "action";
  if (c.includes("hyper") || c.includes("casual") || c.includes("kid"))
    return "casual";

  return "casual";
}
