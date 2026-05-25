import { Game } from "./types";

/**
 * GAME CATALOG
 * ------------
 * The `embedUrl` field is what gets loaded inside the iframe on the play page.
 *
 * Where to get free embeddable HTML5 games:
 *   1. https://gamemonetize.com   — sign up free, copy any game's iframe URL.
 *      Format:  https://html5.gamemonetize.com/<game-id>/
 *   2. https://gamedistribution.com — sign up, get a publisher ID, embed games.
 *      Format:  https://html5.gamedistribution.com/<game-id>/
 *   3. https://itch.io  — many games allow iframe embedding (check each).
 *
 * The thumbnails below use picsum.photos as deterministic placeholders.
 * Replace with the real game's thumbnail URL for production.
 *
 * Add as many games as you want — every entry automatically appears in the UI.
 */

const thumb = (seed: string) =>
  `https://picsum.photos/seed/${seed}/640/400`;

export const games: Game[] = [
  // ---------- ACTION ----------
  {
    slug: "ninja-clash",
    title: "Ninja Clash",
    description:
      "Slice your way through hordes of shadow ninjas in this fast-paced sword-fighting arena.",
    category: "action",
    tags: ["ninja", "sword", "fighting", "1-player"],
    thumbnail: thumb("ninja-clash"),
    embedUrl: "https://html5.gamemonetize.com/ninja-clash-demo/",
    aspect: "16/9",
    plays: 184320,
    rating: 4.6,
    controls: ["WASD to move", "Mouse to attack", "Space to dash"],
    featured: true
  },
  {
    slug: "stickman-warriors",
    title: "Stickman Warriors",
    description:
      "Pick your stickman champion and brawl through 40+ levels of pure chaos.",
    category: "action",
    tags: ["stickman", "fighting", "combo"],
    thumbnail: thumb("stickman-warriors"),
    embedUrl: "https://html5.gamemonetize.com/stickman-warriors-demo/",
    plays: 92110,
    rating: 4.4,
    controls: ["Arrow keys", "J = punch", "K = kick"],
    new: true
  },
  {
    slug: "zombie-survival-3d",
    title: "Zombie Survival 3D",
    description:
      "Survive endless waves of the undead with upgradable weapons and explosive gear.",
    category: "action",
    tags: ["zombie", "survival", "3d"],
    thumbnail: thumb("zombie-survival-3d"),
    embedUrl: "https://html5.gamemonetize.com/zombie-survival-demo/",
    plays: 230440,
    rating: 4.7,
    featured: true
  },
  {
    slug: "samurai-blade",
    title: "Samurai Blade",
    description:
      "Master the way of the katana across feudal Japan in this stylish action adventure.",
    category: "action",
    tags: ["samurai", "katana", "anime"],
    thumbnail: thumb("samurai-blade"),
    embedUrl: "https://html5.gamemonetize.com/samurai-blade-demo/",
    plays: 51230,
    rating: 4.3
  },

  // ---------- PUZZLE ----------
  {
    slug: "2048",
    title: "2048",
    description:
      "Combine matching tiles to reach the legendary 2048 tile. Easy to learn, hard to master.",
    category: "puzzle",
    tags: ["numbers", "logic", "merge"],
    thumbnail: thumb("2048"),
    embedUrl: "https://play2048.co/",
    plays: 1240500,
    rating: 4.8,
    controls: ["Arrow keys to move tiles"],
    featured: true
  },
  {
    slug: "block-puzzle-classic",
    title: "Block Puzzle Classic",
    description:
      "Drag colored blocks onto a 10x10 grid and clear lines to score big.",
    category: "puzzle",
    tags: ["blocks", "tetris-like", "classic"],
    thumbnail: thumb("block-puzzle-classic"),
    embedUrl: "https://html5.gamemonetize.com/block-puzzle-demo/",
    plays: 421100,
    rating: 4.6
  },
  {
    slug: "bubble-shooter",
    title: "Bubble Shooter",
    description:
      "Pop colorful bubbles in this timeless match-3 arcade puzzle.",
    category: "puzzle",
    tags: ["match-3", "bubble", "casual"],
    thumbnail: thumb("bubble-shooter"),
    embedUrl: "https://html5.gamemonetize.com/bubble-shooter-demo/",
    plays: 884320,
    rating: 4.7,
    featured: true
  },
  {
    slug: "sudoku-master",
    title: "Sudoku Master",
    description:
      "Train your brain with daily Sudoku puzzles across four difficulty levels.",
    category: "puzzle",
    tags: ["numbers", "logic", "brain"],
    thumbnail: thumb("sudoku-master"),
    embedUrl: "https://html5.gamemonetize.com/sudoku-master-demo/",
    plays: 162400,
    rating: 4.5
  },
  {
    slug: "match-3-mania",
    title: "Match 3 Mania",
    description:
      "Swap candies and trigger powerful combos in this colorful match-3 adventure.",
    category: "puzzle",
    tags: ["match-3", "candy", "casual"],
    thumbnail: thumb("match-3-mania"),
    embedUrl: "https://html5.gamemonetize.com/match-3-mania-demo/",
    plays: 305210,
    rating: 4.4,
    new: true
  },

  // ---------- RACING ----------
  {
    slug: "highway-racer",
    title: "Highway Racer",
    description:
      "Dodge traffic at 200 km/h. Customize your ride and chase the leaderboard.",
    category: "racing",
    tags: ["racing", "traffic", "endless"],
    thumbnail: thumb("highway-racer"),
    embedUrl: "https://html5.gamemonetize.com/highway-racer-demo/",
    plays: 502100,
    rating: 4.6,
    featured: true
  },
  {
    slug: "drift-hunters",
    title: "Drift Hunters",
    description:
      "Tune cars and slide around tracks in the cult-classic drifting simulator.",
    category: "racing",
    tags: ["drift", "cars", "tuning"],
    thumbnail: thumb("drift-hunters"),
    embedUrl: "https://html5.gamemonetize.com/drift-hunters-demo/",
    plays: 1210400,
    rating: 4.8,
    featured: true
  },
  {
    slug: "moto-stunt-x",
    title: "Moto Stunt X",
    description:
      "Backflip, frontflip and crash through 50 brutal motorbike trial levels.",
    category: "racing",
    tags: ["bike", "stunt", "physics"],
    thumbnail: thumb("moto-stunt-x"),
    embedUrl: "https://html5.gamemonetize.com/moto-stunt-x-demo/",
    plays: 312220,
    rating: 4.5
  },
  {
    slug: "traffic-rush",
    title: "Traffic Rush",
    description:
      "Direct intersections without crashes. Simple to play, hard to put down.",
    category: "racing",
    tags: ["traffic", "casual", "timing"],
    thumbnail: thumb("traffic-rush"),
    embedUrl: "https://html5.gamemonetize.com/traffic-rush-demo/",
    plays: 89430,
    rating: 4.3
  },

  // ---------- SPORTS ----------
  {
    slug: "8-ball-pool-pro",
    title: "8 Ball Pool Pro",
    description:
      "Sink the 8-ball in classic pool with online-style multiplayer feel.",
    category: "sports",
    tags: ["pool", "billiards", "1v1"],
    thumbnail: thumb("8-ball-pool-pro"),
    embedUrl: "https://html5.gamemonetize.com/8-ball-pool-pro-demo/",
    plays: 720100,
    rating: 4.7,
    featured: true
  },
  {
    slug: "basketball-stars",
    title: "Basketball Stars",
    description:
      "Showtime hoops! 1v1 tournaments, dunk contests and trick shots.",
    category: "sports",
    tags: ["basketball", "1v1", "arcade"],
    thumbnail: thumb("basketball-stars"),
    embedUrl: "https://html5.gamemonetize.com/basketball-stars-demo/",
    plays: 415100,
    rating: 4.6
  },
  {
    slug: "soccer-skills-cup",
    title: "Soccer Skills Cup",
    description:
      "Pick a country and lift the cup in this fast 5v5 arcade football game.",
    category: "sports",
    tags: ["football", "soccer", "tournament"],
    thumbnail: thumb("soccer-skills-cup"),
    embedUrl: "https://html5.gamemonetize.com/soccer-skills-cup-demo/",
    plays: 533200,
    rating: 4.5
  },

  // ---------- SHOOTING ----------
  {
    slug: "sniper-strike",
    title: "Sniper Strike",
    description:
      "Steady your breath and take the shot — 60 sniping missions across the world.",
    category: "shooting",
    tags: ["sniper", "fps", "missions"],
    thumbnail: thumb("sniper-strike"),
    embedUrl: "https://html5.gamemonetize.com/sniper-strike-demo/",
    plays: 421300,
    rating: 4.6,
    featured: true
  },
  {
    slug: "bullet-force-arena",
    title: "Bullet Force Arena",
    description:
      "A modern multiplayer FPS arena right in your browser.",
    category: "shooting",
    tags: ["fps", "multiplayer", "guns"],
    thumbnail: thumb("bullet-force-arena"),
    embedUrl: "https://html5.gamemonetize.com/bullet-force-arena-demo/",
    plays: 980220,
    rating: 4.7,
    featured: true
  },
  {
    slug: "zombie-hunter-3d",
    title: "Zombie Hunter 3D",
    description:
      "Quarantine, undead, shotguns. You know the drill — survive til dawn.",
    category: "shooting",
    tags: ["zombie", "fps", "horror"],
    thumbnail: thumb("zombie-hunter-3d"),
    embedUrl: "https://html5.gamemonetize.com/zombie-hunter-3d-demo/",
    plays: 211110,
    rating: 4.4,
    new: true
  },

  // ---------- ADVENTURE ----------
  {
    slug: "temple-runner",
    title: "Temple Runner",
    description:
      "Steal the idol, run forever. Slide, jump and tilt across the temple.",
    category: "adventure",
    tags: ["runner", "endless", "3d"],
    thumbnail: thumb("temple-runner"),
    embedUrl: "https://html5.gamemonetize.com/temple-runner-demo/",
    plays: 612100,
    rating: 4.5
  },
  {
    slug: "treasure-island",
    title: "Treasure Island",
    description:
      "Explore a pirate island, solve clues and dig up legendary loot.",
    category: "adventure",
    tags: ["pirate", "exploration", "puzzle"],
    thumbnail: thumb("treasure-island"),
    embedUrl: "https://html5.gamemonetize.com/treasure-island-demo/",
    plays: 84320,
    rating: 4.3
  },
  {
    slug: "dragon-quest-mini",
    title: "Dragon Quest Mini",
    description:
      "A bite-sized RPG with sprite art, side-scrolling combat and bosses.",
    category: "adventure",
    tags: ["rpg", "fantasy", "story"],
    thumbnail: thumb("dragon-quest-mini"),
    embedUrl: "https://html5.gamemonetize.com/dragon-quest-mini-demo/",
    plays: 121430,
    rating: 4.4
  },

  // ---------- ARCADE ----------
  {
    slug: "snake-classic",
    title: "Snake Classic",
    description:
      "The original snake. Eat. Grow. Don't bite yourself.",
    category: "arcade",
    tags: ["retro", "classic", "skill"],
    thumbnail: thumb("snake-classic"),
    embedUrl: "https://html5.gamemonetize.com/snake-classic-demo/",
    plays: 312220,
    rating: 4.5
  },
  {
    slug: "pong-revival",
    title: "Pong Revival",
    description:
      "The 1972 arcade icon, modernized with neon visuals and chip-tune sound.",
    category: "arcade",
    tags: ["retro", "neon", "1v1"],
    thumbnail: thumb("pong-revival"),
    embedUrl: "https://html5.gamemonetize.com/pong-revival-demo/",
    plays: 64210,
    rating: 4.2
  },
  {
    slug: "neon-pinball",
    title: "Neon Pinball",
    description:
      "A flashing, bouncing, multiball pinball table that never quits.",
    category: "arcade",
    tags: ["pinball", "neon", "highscore"],
    thumbnail: thumb("neon-pinball"),
    embedUrl: "https://html5.gamemonetize.com/neon-pinball-demo/",
    plays: 78210,
    rating: 4.3,
    new: true
  },
  {
    slug: "flappy-bird-x",
    title: "Flappy Bird X",
    description:
      "Tap. Flap. Don't die. The remix of the world-famous one-tap nightmare.",
    category: "arcade",
    tags: ["one-tap", "frustrating", "casual"],
    thumbnail: thumb("flappy-bird-x"),
    embedUrl: "https://html5.gamemonetize.com/flappy-bird-x-demo/",
    plays: 922100,
    rating: 4.4,
    featured: true
  },

  // ---------- IO ----------
  {
    slug: "slither-arena",
    title: "Slither Arena",
    description:
      "Eat glowing orbs, grow huge, and trap rivals in this multiplayer snake arena.",
    category: "io",
    tags: ["multiplayer", "snake", "arena"],
    thumbnail: thumb("slither-arena"),
    embedUrl: "https://html5.gamemonetize.com/slither-arena-demo/",
    plays: 1031000,
    rating: 4.7,
    featured: true
  },
  {
    slug: "agar-cells",
    title: "Agar Cells",
    description:
      "Absorb smaller cells, dodge giants, and become the king of the petri dish.",
    category: "io",
    tags: ["multiplayer", "blob", "arena"],
    thumbnail: thumb("agar-cells"),
    embedUrl: "https://html5.gamemonetize.com/agar-cells-demo/",
    plays: 612400,
    rating: 4.5
  },
  {
    slug: "krunker-arena",
    title: "Krunker Arena",
    description:
      "A blocky FPS shooter with quick rounds and serious recoil control.",
    category: "io",
    tags: ["fps", "voxel", "multiplayer"],
    thumbnail: thumb("krunker-arena"),
    embedUrl: "https://html5.gamemonetize.com/krunker-arena-demo/",
    plays: 845210,
    rating: 4.6
  },

  // ---------- CASUAL ----------
  {
    slug: "crossy-roads",
    title: "Crossy Roads",
    description:
      "Hop across rivers, roads and rails as a chicken (or a hundred other characters).",
    category: "casual",
    tags: ["arcade", "endless", "voxel"],
    thumbnail: thumb("crossy-roads"),
    embedUrl: "https://html5.gamemonetize.com/crossy-roads-demo/",
    plays: 412210,
    rating: 4.5
  },
  {
    slug: "cookie-tycoon",
    title: "Cookie Tycoon",
    description:
      "Click cookies. Hire grandmas. Conquer the universe. The OG idle game returns.",
    category: "casual",
    tags: ["idle", "clicker", "tycoon"],
    thumbnail: thumb("cookie-tycoon"),
    embedUrl: "https://html5.gamemonetize.com/cookie-tycoon-demo/",
    plays: 281100,
    rating: 4.6
  },

  // ---------- GIRLS ----------
  {
    slug: "fashion-stylist",
    title: "Fashion Stylist",
    description:
      "Mix runway looks, makeup and accessories in this dress-up extravaganza.",
    category: "girls",
    tags: ["dress-up", "fashion", "makeover"],
    thumbnail: thumb("fashion-stylist"),
    embedUrl: "https://html5.gamemonetize.com/fashion-stylist-demo/",
    plays: 122100,
    rating: 4.4
  },
  {
    slug: "bakery-tycoon",
    title: "Bakery Tycoon",
    description:
      "Run your own bakery — bake, decorate and serve eager customers.",
    category: "girls",
    tags: ["cooking", "tycoon", "casual"],
    thumbnail: thumb("bakery-tycoon"),
    embedUrl: "https://html5.gamemonetize.com/bakery-tycoon-demo/",
    plays: 71200,
    rating: 4.3
  },

  // ---------- 2 PLAYER ----------
  {
    slug: "fireboy-watergirl",
    title: "Fireboy & Watergirl",
    description:
      "Co-op puzzle adventure for two players — solve elemental temples together.",
    category: "2-player",
    tags: ["co-op", "puzzle", "couch"],
    thumbnail: thumb("fireboy-watergirl"),
    embedUrl: "https://html5.gamemonetize.com/fireboy-watergirl-demo/",
    plays: 612200,
    rating: 4.7,
    featured: true
  },
  {
    slug: "tank-trouble-2p",
    title: "Tank Trouble 2P",
    description:
      "Bounce shells around tight maze battlefields. Last tank standing wins.",
    category: "2-player",
    tags: ["tanks", "1v1", "couch"],
    thumbnail: thumb("tank-trouble-2p"),
    embedUrl: "https://html5.gamemonetize.com/tank-trouble-2p-demo/",
    plays: 84210,
    rating: 4.4,
    new: true
  }
];

// ---- Helpers ----
export const getGame = (slug: string) =>
  games.find((g) => g.slug === slug);

export const getGamesByCategory = (slug: string) =>
  games.filter((g) => g.category === slug);

export const getFeatured = (n = 6) =>
  games.filter((g) => g.featured).slice(0, n);

export const getNew = (n = 8) => games.filter((g) => g.new).slice(0, n);

export const getPopular = (n = 12) =>
  [...games].sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0)).slice(0, n);

export const searchGames = (q: string) => {
  const term = q.trim().toLowerCase();
  if (!term) return [] as Game[];
  return games.filter(
    (g) =>
      g.title.toLowerCase().includes(term) ||
      g.description.toLowerCase().includes(term) ||
      g.tags.some((t) => t.toLowerCase().includes(term)) ||
      g.category.includes(term)
  );
};
