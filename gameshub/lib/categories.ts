import { Category } from "./types";

export const categories: Category[] = [
  {
    slug: "action",
    name: "Action",
    emoji: "⚔️",
    blurb: "Fast-paced fights, ninjas, heroes and chaos.",
    color: "from-rose-500 to-orange-500"
  },
  {
    slug: "puzzle",
    name: "Puzzle",
    emoji: "🧩",
    blurb: "Brain-teasers, match-3, sudoku and more.",
    color: "from-cyan-400 to-sky-600"
  },
  {
    slug: "racing",
    name: "Racing",
    emoji: "🏎️",
    blurb: "Burn rubber on highways, dirt tracks and stunts.",
    color: "from-amber-400 to-rose-500"
  },
  {
    slug: "sports",
    name: "Sports",
    emoji: "⚽",
    blurb: "Football, basketball, pool and more.",
    color: "from-emerald-400 to-teal-600"
  },
  {
    slug: "shooting",
    name: "Shooting",
    emoji: "🎯",
    blurb: "Snipers, FPS arenas and zombie blasters.",
    color: "from-fuchsia-500 to-violet-600"
  },
  {
    slug: "adventure",
    name: "Adventure",
    emoji: "🗺️",
    blurb: "Quests, dungeons and treasure hunts.",
    color: "from-lime-400 to-emerald-600"
  },
  {
    slug: "arcade",
    name: "Arcade",
    emoji: "🕹️",
    blurb: "Classic retro fun: snake, pong, pinball.",
    color: "from-yellow-400 to-orange-500"
  },
  {
    slug: "io",
    name: ".io",
    emoji: "🌐",
    blurb: "Massive multiplayer browser arenas.",
    color: "from-indigo-400 to-purple-600"
  },
  {
    slug: "casual",
    name: "Casual",
    emoji: "🍩",
    blurb: "Easy pickup-and-play games for everyone.",
    color: "from-pink-400 to-rose-500"
  },
  {
    slug: "girls",
    name: "Girls",
    emoji: "💖",
    blurb: "Dress-up, makeover and cooking games.",
    color: "from-pink-300 to-fuchsia-500"
  },
  {
    slug: "2-player",
    name: "2 Player",
    emoji: "👥",
    blurb: "Couch co-op and head-to-head battles.",
    color: "from-sky-400 to-blue-600"
  }
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);
