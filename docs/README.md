# PlayHub — Static games portal

A single-page CrazyGames-style HTML5 games portal, **fully static** — no Next.js, no build step, no Vercel headaches. Just one HTML file you can deploy on **GitHub Pages, Netlify, or any static host** in 60 seconds.

## ⚡ Deploy on GitHub Pages (1-click)

1. Repo me jao → **Settings** → **Pages** (left sidebar)
2. Source: **Deploy from branch**
3. Branch: **`master`** | Folder: **`/docs`**
4. **Save** dabao
5. 1-2 min ruko → site live ho jayegi at:
   `https://miten001.github.io/userbot/`

Bas. Itna hi.

## 📁 Files

```
docs/
├── index.html   # full portal (sidebar + game grid + player)
├── 404.html     # SPA fallback for hash-based routes
├── .nojekyll    # tells GitHub Pages "don't process with Jekyll"
└── README.md    # this file
```

## 🎮 Games

25+ classic Internet Archive games hardcoded in `index.html`. Real, working iframe URLs:
Pac-Man, Tetris, DOOM, Wolfenstein 3D, Prince of Persia, Lemmings, Oregon Trail, SimCity, Bubble Bobble, and more.

## 💰 Adding ads

Open `index.html`, find these comments and uncomment / fill in:

```html
<!-- AdSense placeholder -->
<script async src=".../adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"></script>
```

Plus 4 ad slot `<div>` blocks already laid out in the page (look for `text-white/30 ad slot` in the markup) — replace each with:

```html
<ins class="adsbygoogle" style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

## ➕ Adding more games

Edit `index.html`, find the `GAMES` array near the bottom, copy any entry:

```js
{ slug:'my-game', title:'My Game', desc:'...', cat:'puzzle',
  tags:['fun'], thumb:thumb('my-game'),
  embed:'https://archive.org/embed/SOME_ID', plays:50000, rating:4.5 }
```

Game pe automatically homepage me, sidebar category me, search me sab jagah dikhne lagega.
