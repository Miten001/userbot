# PlayHub — Free Online Games Portal

A CrazyGames-style HTML5 games portal built with **Next.js 14**, **TypeScript** and **Tailwind CSS**. Drop in your AdSense client ID and you have a full ad-monetized site ready to go.

> **Hindi/Hinglish me bola jaye to:** Yeh ek complete games portal hai jisme tum apne ads laga ke earn kar sakte ho. Bas AdSense ID daalo, games ke embed URLs paste karo, aur deploy kar do.

---

## ✨ Features

- **Auto-fetched 1000+ games** — pulls live from the public Gamemonetize JSON feed (no manual game adding)
- **24-hour auto-refresh** — catalog stays fresh without rebuilds (Next.js ISR)
- **Game player** with iframe embed, fullscreen + restart buttons, click-to-start
- **11 categories** with auto-mapping from Gamemonetize categories
- **Search, related games, popular & new** sections
- **Google AdSense** — 4 pre-wired ad slots (header, sidebar, in-content, footer)
- **SEO ready** — auto-generated `sitemap.xml` and `robots.txt`, OpenGraph + Twitter meta
- **Mobile-first**, dark themed, fully responsive
- **Static site generation** for top 200 games (build), on-demand for the rest
- **Optional Google Analytics 4** integration
- **Offline-safe** — falls back to a 35-game seed catalog if the feed is unreachable

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

### Step 1 — Register your site on Gamemonetize (5 minutes, no approval wait)

This is what unlocks the revenue. The games themselves auto-load — you only need to register your site so Gamemonetize attributes the ad impressions to you.

1. Sign up free at <https://gamemonetize.com>.
2. Go to **My Sites → Add Site** and submit your domain (e.g. `yourgamesite.com`).
3. Once approved (usually within 24h), grab your **Publisher ID** from your account page.
4. Paste it into `.env.local`:

   ```bash
   NEXT_PUBLIC_GAMEMONETIZE_PUBLISHER="your-publisher-id-here"
   ```

5. Redeploy. Every game iframe URL will now include your tracking ID. Earnings show up in your Gamemonetize dashboard.

> **Note:** Gamemonetize displays ads inside the games themselves (pre-roll, mid-roll). You don't need to do anything else to enable them — they're built into the game iframes.

### Step 2 — Add Google AdSense for site banner ads (extra revenue)

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

### Other ad networks (if AdSense rejects you)

- [Ezoic](https://www.ezoic.com) — beginner-friendly, lower traffic threshold than AdSense.
- [PropellerAds](https://propellerads.com) — instant approval, lower CPM but no minimum traffic.
- [AdMaven](https://ad-maven.com) — pop-unders, push notifications.

To swap networks, edit `components/AdSlot.tsx` to render their snippet instead of `adsbygoogle`.

---

## 🎮 Customizing the game catalog

By default the site auto-fetches **1000 games** from the public Gamemonetize JSON feed and refreshes the list every 24 hours. **You don't need to add games manually.**

### Want a different category mix or fewer games?

Generate a custom feed URL at <https://gamemonetize.com/rss-builder>, then set it in `.env.local`:

```bash
GAMEMONETIZE_FEED_URL="https://gamemonetize.com/rss-feed.php?format=0&amount=500&category=Action&type=html5"
```

### Want to add a hand-picked game on top of the auto-feed?

Edit `lib/seed-games.ts` and add an entry. Seed games are merged in if the feed is empty.

### Categories

Categories live in `lib/categories.ts`. The Gamemonetize → internal-slug mapping lives in `lib/feed.ts` (`mapCategory` function) — easy to tweak.

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
│  ├─ feed.ts              # Gamemonetize feed fetcher + helpers
│  ├─ games.ts             # Re-exports the helpers from feed.ts
│  └─ seed-games.ts        # Hand-coded fallback list (offline-safe)
├─ .env.example
├─ next.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

---

## 📜 License

MIT. Games are property of their respective publishers.
