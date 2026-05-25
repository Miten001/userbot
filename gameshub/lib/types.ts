export type CategorySlug =
  | "action"
  | "puzzle"
  | "racing"
  | "sports"
  | "shooting"
  | "adventure"
  | "arcade"
  | "io"
  | "casual"
  | "girls"
  | "2-player";

export type Category = {
  slug: CategorySlug;
  name: string;
  emoji: string;
  blurb: string;
  color: string; // tailwind gradient classes
};

export type Game = {
  slug: string;
  title: string;
  description: string;
  category: CategorySlug;
  tags: string[];
  thumbnail: string;
  /**
   * Iframe embed URL for the playable game.
   * Replace with your gamemonetize.com / gamedistribution.com / itch.io embed URL.
   */
  embedUrl: string;
  /** Aspect ratio of the iframe e.g. "16/9" or "4/3". Defaults to "16/9". */
  aspect?: "16/9" | "4/3" | "9/16" | "1/1";
  plays?: number; // synthetic popularity number
  rating?: number; // 1..5
  controls?: string[]; // human-readable control hints
  featured?: boolean;
  new?: boolean;
};
