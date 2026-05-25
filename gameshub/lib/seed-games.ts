import { Game } from "./types";

/**
 * GAME CATALOG (offline-safe seed)
 * --------------------------------
 * These are real, publicly playable HTML5 / DOS games that work
 * cleanly inside an iframe. The Internet Archive entries use their
 * official `/embed/<identifier>/` URLs — they are designed for
 * iframe embedding, no API key required, no CORS hassle.
 *
 * The Gamemonetize JSON feed (lib/feed.ts) is still the primary
 * source. This list is the fallback when the feed is unreachable
 * or returns too few English-language games.
 *
 * To add your own games:
 *   - Internet Archive: https://archive.org/details/softwarelibrary_msdos_games
 *     (find a game, replace `details` with `embed` in the URL)
 *   - Gamemonetize: https://gamemonetize.com (sign up, copy embed URL)
 *   - GameDistribution: https://gamedistribution.com
 */

const ia = (id: string) => `https://archive.org/embed/${id}`;

// Internet Archive serves a generic emulator screenshot for games;
// we use picsum.photos for thumbnails (deterministic per slug).
const thumb = (seed: string) =>
  `https://picsum.photos/seed/${seed}/640/640`;

export const seedGames: Game[] = [
  // ---------- CLASSIC PUZZLE ----------
  {
    slug: "tetris",
    title: "Tetris",
    description:
      "The legendary Russian falling-block puzzle game. Stack the tetrominoes, clear the lines, beat your highscore.",
    category: "puzzle",
    tags: ["classic", "blocks", "highscore"],
    thumbnail: thumb("tetris-classic"),
    embedUrl: ia("msdos_Tetris_1986"),
    aspect: "4/3",
    plays: 1240500,
    rating: 4.9,
    controls: ["Arrow keys to move", "Up to rotate", "Space to drop"],
    featured: true
  },
  {
    slug: "lemmings",
    title: "Lemmings",
    description:
      "Guide the army of suicidal green-haired creatures safely to the exit.",
    category: "puzzle",
    tags: ["classic", "strategy", "puzzle"],
    thumbnail: thumb("lemmings"),
    embedUrl: ia("msdos_Lemmings_1991"),
    aspect: "4/3",
    plays: 612400,
    rating: 4.7,
    new: true
  },
  {
    slug: "number-munchers",
    title: "Number Munchers",
    description:
      "Eat the right numbers, dodge the troggles. Educational arcade classic.",
    category: "puzzle",
    tags: ["classic", "math", "kids"],
    thumbnail: thumb("number-munchers"),
    embedUrl: ia("msdos_Number_Munchers_1990"),
    aspect: "4/3",
    plays: 312220,
    rating: 4.5
  },
  {
    slug: "sokoban",
    title: "Sokoban",
    description:
      "Push crates onto target squares — the original sliding puzzle.",
    category: "puzzle",
    tags: ["classic", "puzzle", "logic"],
    thumbnail: thumb("sokoban"),
    embedUrl: ia("msdos_Sokoban_1984"),
    aspect: "4/3",
    plays: 184320,
    rating: 4.4
  },

  // ---------- ACTION / ARCADE ----------
  {
    slug: "pac-man",
    title: "Pac-Man",
    description:
      "Eat all the dots, dodge the ghosts. The 1982 arcade icon, fully playable.",
    category: "arcade",
    tags: ["classic", "arcade", "highscore"],
    thumbnail: thumb("pacman"),
    embedUrl: ia("msdos_Pac-Man_1983"),
    aspect: "4/3",
    plays: 2400500,
    rating: 4.9,
    featured: true,
    controls: ["Arrow keys to move"]
  },
  {
    slug: "prince-of-persia",
    title: "Prince of Persia",
    description:
      "Acrobatic platformer through deadly dungeons. Save the princess in 60 minutes.",
    category: "action",
    tags: ["classic", "platformer", "adventure"],
    thumbnail: thumb("prince-of-persia"),
    embedUrl: ia("msdos_Prince_of_Persia_1990"),
    aspect: "4/3",
    plays: 884320,
    rating: 4.8,
    featured: true
  },
  {
    slug: "duke-nukem",
    title: "Duke Nukem",
    description:
      "Side-scrolling shoot-em-up — Duke vs Dr. Proton. Pure 90s action.",
    category: "shooting",
    tags: ["classic", "action", "platformer"],
    thumbnail: thumb("duke-nukem"),
    embedUrl: ia("msdos_Duke_Nukem_1991"),
    aspect: "4/3",
    plays: 720100,
    rating: 4.6
  },
  {
    slug: "commander-keen",
    title: "Commander Keen",
    description:
      "Billy Blaze, boy genius, defends Earth from Vorticons. Classic 90s platformer.",
    category: "action",
    tags: ["classic", "platformer", "adventure"],
    thumbnail: thumb("commander-keen"),
    embedUrl: ia("msdos_Commander_Keen_in_Invasion_of_the_Vorticons_1990"),
    aspect: "4/3",
    plays: 421300,
    rating: 4.7
  },
  {
    slug: "wolfenstein-3d",
    title: "Wolfenstein 3D",
    description:
      "The grandfather of FPS games. Escape the Nazi castle in glorious 1992 3D.",
    category: "shooting",
    tags: ["classic", "fps", "3d"],
    thumbnail: thumb("wolfenstein"),
    embedUrl: ia("msdos_Wolfenstein_3D_1992"),
    aspect: "4/3",
    plays: 980220,
    rating: 4.8,
    featured: true
  },
  {
    slug: "doom",
    title: "DOOM",
    description:
      "1993's most influential shooter — fight demons through the bowels of hell.",
    category: "shooting",
    tags: ["classic", "fps", "horror"],
    thumbnail: thumb("doom"),
    embedUrl: ia("msdos_Doom_1993"),
    aspect: "4/3",
    plays: 1850000,
    rating: 4.9,
    featured: true
  },
  {
    slug: "jazz-jackrabbit",
    title: "Jazz Jackrabbit",
    description:
      "Speed-running rabbit hero, side-scrolling action across 9 worlds.",
    category: "action",
    tags: ["classic", "platformer", "speed"],
    thumbnail: thumb("jazz"),
    embedUrl: ia("msdos_Jazz_Jackrabbit_1994"),
    aspect: "4/3",
    plays: 305210,
    rating: 4.5,
    new: true
  },

  // ---------- ADVENTURE ----------
  {
    slug: "the-oregon-trail",
    title: "The Oregon Trail",
    description:
      "1848: caravan from Missouri to Oregon. Hunt buffalo, ford rivers, dodge dysentery.",
    category: "adventure",
    tags: ["classic", "strategy", "educational"],
    thumbnail: thumb("oregon-trail"),
    embedUrl: ia("msdos_Oregon_Trail_The_1990"),
    aspect: "4/3",
    plays: 612200,
    rating: 4.7,
    featured: true
  },
  {
    slug: "carmen-sandiego",
    title: "Where in the World is Carmen Sandiego?",
    description:
      "Globe-trotting detective adventure. Track down the V.I.L.E. henchmen.",
    category: "adventure",
    tags: ["classic", "detective", "educational"],
    thumbnail: thumb("carmen-sandiego"),
    embedUrl: ia("msdos_Where_in_the_World_is_Carmen_Sandiego_1989"),
    aspect: "4/3",
    plays: 162400,
    rating: 4.5
  },

  // ---------- STRATEGY / TYCOON ----------
  {
    slug: "sim-city",
    title: "SimCity",
    description:
      "Build, zone, and tax your way to a thriving metropolis. The original god-game.",
    category: "casual",
    tags: ["classic", "tycoon", "strategy"],
    thumbnail: thumb("simcity"),
    embedUrl: ia("msdos_SimCity_1989"),
    aspect: "4/3",
    plays: 502100,
    rating: 4.7
  },

  // ---------- RACING ----------
  {
    slug: "stunts",
    title: "Stunts",
    description:
      "Top-down 3D racing with custom track editor. Backflip a Lamborghini at 200mph.",
    category: "racing",
    tags: ["classic", "racing", "3d"],
    thumbnail: thumb("stunts"),
    embedUrl: ia("msdos_Stunts_1990"),
    aspect: "4/3",
    plays: 312220,
    rating: 4.4
  },
  {
    slug: "skyroads",
    title: "SkyRoads",
    description:
      "Float-track 3D racer through space. One wrong move — instant explosion.",
    category: "racing",
    tags: ["classic", "racing", "space"],
    thumbnail: thumb("skyroads"),
    embedUrl: ia("msdos_SkyRoads_1993"),
    aspect: "4/3",
    plays: 211110,
    rating: 4.4,
    new: true
  },

  // ---------- SPORTS ----------
  {
    slug: "pinball-fantasies",
    title: "Pinball Fantasies",
    description:
      "Four full pinball tables with multiball, tilt, and 90s soundtracks.",
    category: "sports",
    tags: ["classic", "pinball", "highscore"],
    thumbnail: thumb("pinball-fantasies"),
    embedUrl: ia("msdos_Pinball_Fantasies_1992"),
    aspect: "4/3",
    plays: 84320,
    rating: 4.5
  },
  {
    slug: "california-games",
    title: "California Games",
    description:
      "Surfing, BMX, hacky sack, footbag, half-pipe and roller skating.",
    category: "sports",
    tags: ["classic", "sports", "multi-event"],
    thumbnail: thumb("california-games"),
    embedUrl: ia("msdos_California_Games_1988"),
    aspect: "4/3",
    plays: 89430,
    rating: 4.3
  },

  // ---------- KIDS / CASUAL ----------
  {
    slug: "bubble-bobble",
    title: "Bubble Bobble",
    description:
      "Two dragons trap enemies in bubbles. Perfect for couch co-op.",
    category: "2-player",
    tags: ["classic", "co-op", "arcade"],
    thumbnail: thumb("bubble-bobble"),
    embedUrl: ia("msdos_Bubble_Bobble_1989"),
    aspect: "4/3",
    plays: 612200,
    rating: 4.7,
    featured: true
  },

  // ---------- 2 PLAYER ----------
  {
    slug: "scorched-earth",
    title: "Scorched Earth",
    description:
      "Tank-vs-tank artillery duel. Pick angle, pick power, fire — repeat for hours.",
    category: "2-player",
    tags: ["classic", "tanks", "couch"],
    thumbnail: thumb("scorched-earth"),
    embedUrl: ia("msdos_Scorched_Earth_1991"),
    aspect: "4/3",
    plays: 84210,
    rating: 4.6,
    new: true
  },

  // ---------- SHOOTING ----------
  {
    slug: "raptor",
    title: "Raptor: Call of the Shadows",
    description:
      "Top-down vertical shooter — pilot a Saturn fighter through enemy waves.",
    category: "shooting",
    tags: ["classic", "shmup", "arcade"],
    thumbnail: thumb("raptor"),
    embedUrl: ia("msdos_Raptor_Call_of_the_Shadows_1994"),
    aspect: "4/3",
    plays: 211110,
    rating: 4.5
  },

  // ---------- IO / MULTIPLAYER FEEL ----------
  {
    slug: "rampage",
    title: "Rampage",
    description:
      "Three giant monsters demolish American cities. Punch helicopters out of the sky.",
    category: "action",
    tags: ["classic", "destruction", "co-op"],
    thumbnail: thumb("rampage"),
    embedUrl: ia("msdos_Rampage_1988"),
    aspect: "4/3",
    plays: 211400,
    rating: 4.5
  },

  // ---------- GIRLS / DRESS-UP era classics ----------
  {
    slug: "hugo",
    title: "Hugo's House of Horrors",
    description:
      "Classic point-and-click adventure. Save Penelope from the haunted mansion.",
    category: "adventure",
    tags: ["classic", "adventure", "story"],
    thumbnail: thumb("hugo"),
    embedUrl: ia("msdos_Hugos_House_of_Horrors_1990"),
    aspect: "4/3",
    plays: 122100,
    rating: 4.4
  },

  // ---------- MORE PUZZLE ----------
  {
    slug: "chip-challenge",
    title: "Chip's Challenge",
    description:
      "149 levels of grid-based logic puzzles. Push blocks, dodge bugs, find chips.",
    category: "puzzle",
    tags: ["classic", "puzzle", "logic"],
    thumbnail: thumb("chip-challenge"),
    embedUrl: ia("msdos_Chips_Challenge_1990"),
    aspect: "4/3",
    plays: 84210,
    rating: 4.5
  }
];
