# PlayHub — Free Online Games Portal

A CrazyGames-style HTML5 games portal built with **Next.js 14**, **TypeScript** and **Tailwind CSS**. Drop in your AdSense client ID and you have a full ad-monetized site ready to go.

> **Hindi/Hinglish me bola jaye to:** Yeh ek complete games portal hai jisme tum apne ads laga ke earn kar sakte ho. Bas AdSense ID daalo, games ke embed URLs paste karo, aur deploy kar do.

---

## ✨ Features

- **35+ sample games** across 11 categories (action, puzzle, racing, sports, shooting, .io, etc.)
- **Game player** with iframe embed, fullscreen + restart buttons, click-to-start
- **Categories, search, related games, popular & new sections**
- **Google AdSense** — 4 pre-wired ad slots (header, sidebar, in-content, footer)
- **SEO ready** — auto-generated `sitemap.xml` and `robots.txt`, OpenGraph + Twitter meta
- **Mobile-first**, dark themed, fully responsive
- **Static site generation** — every game page is pre-rendered for fast loads & SEO
- **Optional Google Analytics 4** integration

---

## 🚀 Quick start (local)

```bash
cd gameshub
cp .env.example .env.local   # fill in your IDs (optional during dev)
npm install
npm run dev
```

Open <http://localhost:3001>

---

## 💰 How to make money — monetization guide

### Option 1 — Google AdSense (recommended once you have traffic)

1. Apply at <https://www.google.com/adsense/start/>. Google needs your site to have real content + traffic before approving (usually a few weeks).
2. Once approved, copy your **publisher ID** — looks like `ca-pub-1234567890123456`.
3. Inside AdSense, go to **Ads → By ad unit → Create new** and create 4 display ad units:
   - `Header banner` (responsive, horizontal)
   - `Sidebar` (responsive, vertical)
   - `In-content` (responsive)
   - `Footer banner` (responsive, horizontal)
4. Each ad unit gives you a numeric **slot ID**. Paste them into `.env.local`:

```bash
NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-1234567890123456"
NEXT_PUBLIC_AD_SLOT_HEADER="1111111111"
NEXT_PUBLIC_AD_SLOT_SIDEBAR="2222222222"
NEXT_PUBLIC_AD_SLOT_INCONTENT="3333333333"
NEXT_PUBLIC_AD_SLOT_FOOTER="4444444444"
```

5. Redeploy. The `<Script>` tag in `app/layout.tsx` only loads when `NEXT_PUBLIC_ADSENSE_CLIENT` is set, and `components/AdSlot.tsx` renders real ads when both client + slot are configured.

### Option 2 — Gamemonetize.com (instant, no approval needed)

The fastest path to revenue. They show ads inside the games themselves and pay you per impression. No AdSense approval required.

1. Sign up free at <https://gamemonetize.com>.
2. Pick a game from their catalog → click **Embed** → copy the iframe URL (looks like `https://html5.gamemonetize.com/<game-id>/`).
3. In `lib/games.ts`, replace the placeholder `embedUrl` for any game with that real URL.
4. Add your `?publisher_id=<your-id>` query string per their docs to make sure revenue is attributed to you.

### Option 3 — GameDistribution.com

Same idea as gamemonetize, slightly different ecosystem. Sign up at <https://gamedistribution.com>, get a publisher ID, embed games via `https://html5.gamedistribution.com/<game-id>/`.

### Option 4 — Combine all three

Most established games sites use **gamemonetize/gamedistribution for in-game ads** + **AdSense for site banners**. That's what this template is built for.

### Other ad networks (if AdSense rejects you)

- [Ezoic](https://www.ezoic.com) — beginner-friendly, lower traffic threshold than AdSense.
- [PropellerAds](https://propellerads.com) — instant approval, lower CPM but no minimum traffic.
- [AdMaven](https://ad-maven.com) — pop-unders, push notifications.

To swap networks, edit `components/AdSlot.tsx` to render their snippet instead of `adsbygoogle`.

---

## 🎮 Adding/replacing games

Open `lib/games.ts`. Each game is a simple object:

```ts
{
  slug: "my-game",                            // URL: /game/my-game
  title: "My Game",
  description: "Short description shown on the game page.",
  category: "action",                         // must match a category slug
  tags: ["fun", "fast", "1-player"],
  thumbnail: "https://example.com/thumb.jpg", // 640x400 recommended
  embedUrl: "https://html5.gamemonetize.com/<game-id>/",
  aspect: "16/9",
  plays: 50000,
  rating: 4.5,
  controls: ["WASD to move", "Space to jump"],
  featured: true,
  new: true
}
```

Add as many as you want — they automatically appear on the homepage, in their category, in search, and in the sitemap.

To add a brand-new category, edit `lib/categories.ts` and add a new entry to the array. The `slug` you choose must be added to the `CategorySlug` union in `lib/types.ts`.

---

## 📦 Deployment

### Vercel (1-click, free hobby tier)

1. Push this repo to GitHub.
2. Go to <https://vercel.com/new> and import the repo.
3. **Important:** set the **Root Directory** to `gameshub` in Vercel's project settings.
4. Add the env variables from `.env.example` in **Settings → Environment Variables**.
5. Deploy. Done.

### Self-hosted (VPS, DigitalOcean droplet, Railway, etc.)

```bash
cd gameshub
npm install
npm run build
npm run start   # runs on port 3001
```

Put it behind nginx or Caddy for HTTPS + custom domain.

---

## 🧠 Tips to actually earn

1. **SEO is everything.** Pick low-competition long-tail keywords like "play tank trouble unblocked", "free 2048 game online no download". Write a unique 150-word description for each game.
2. **Speed wins.** This site is already SSG + image lazy-loaded. Don't bloat it.
3. **Aim for return visits.** Add favorites/recently-played (uses `localStorage`, easy upgrade).
4. **Promote.** Share on Reddit (`r/incremental_games`, `r/WebGames`), TikTok shorts of gameplay, Pinterest pins of game thumbnails.
5. **Patience.** AdSense usually takes 30-60 days from launch to first payout. Gamemonetize pays instantly.

---

## 📁 Project structure

```
gameshub/
├─ app/
│  ├─ layout.tsx           # global, loads AdSense + GA scripts
│  ├─ page.tsx             # homepage
│  ├─ globals.css
│  ├─ robots.ts            # /robots.txt
│  ├─ sitemap.ts           # /sitemap.xml (auto from games + categories)
│  ├─ not-found.tsx
│  ├─ game/[slug]/
│  │  ├─ page.tsx          # game player page (SSG)
│  │  └─ GamePlayer.tsx    # client iframe wrapper
│  ├─ category/[slug]/page.tsx
│  ├─ search/page.tsx
│  ├─ about/page.tsx
│  ├─ privacy/page.tsx
│  └─ terms/page.tsx
├─ components/
│  ├─ AdSlot.tsx           # AdSense slot or placeholder
│  ├─ Navbar.tsx
│  ├─ Footer.tsx
│  ├─ Hero.tsx
│  ├─ GameCard.tsx
│  ├─ GameGrid.tsx
│  ├─ CategoryStrip.tsx
│  ├─ SearchBar.tsx
│  └─ SectionHeader.tsx
├─ lib/
│  ├─ types.ts             # Game + Category types
│  ├─ categories.ts        # 11 categories
│  └─ games.ts             # 35+ games — EDIT THIS
├─ .env.example
├─ next.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 📜 License

MIT. Games are property of their respective publishers.
