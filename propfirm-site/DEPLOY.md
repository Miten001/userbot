# 🚀 Deploy ApexFunded — Step by Step

The fastest way to get your site live (90 seconds). The site lives in the
`propfirm-site/` subfolder of this repo, so make sure the **Root Directory**
is configured correctly in Vercel.

---

## Option A · Vercel (recommended, free)

### 1. One-click import

1. Go to **<https://vercel.com/new>**
2. Click **"Continue with GitHub"** and authorize.
3. Find **`Miten001/userbot`** in the list and click **Import**.

### 2. Configure the project

In the import dialog:

| Setting              | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| **Root Directory**   | `propfirm-site` ← click "Edit" and pick this folder    |
| **Framework Preset** | `Next.js` (auto-detected once root dir is correct)     |
| **Node Version**     | `20.x` (default)                                       |
| **Build Command**    | leave default (`next build`)                           |
| **Install Command**  | leave default (`npm install`)                          |

### 3. Choose branch

- For PR preview: deploy from `feat/apexfunded-propfirm-site`
- For production: merge the PR first, then deploy from `main`

### 4. Click **Deploy**

After ~90 seconds you'll get a live URL like:

> `https://userbot-xxxx.vercel.app`

That's your live site. Share it anywhere.

### 5. Add a custom domain (optional)

In the Vercel dashboard → **Settings → Domains** → add your domain
(e.g. `apexfunded.com`). Vercel will give you DNS records to point at it.

---

## Option B · Run locally

```bash
git clone https://github.com/Miten001/userbot.git
cd userbot/propfirm-site
git checkout feat/apexfunded-propfirm-site
npm install
npm run dev
```

Open <http://localhost:3000>. Requires Node.js 18+ → <https://nodejs.org>

---

## Option C · StackBlitz (in-browser, no install)

Open this URL in your browser:

```
https://stackblitz.com/github/Miten001/userbot/tree/feat/apexfunded-propfirm-site/propfirm-site
```

Note: Three.js is heavy in StackBlitz. For best experience use Vercel.

---

## Troubleshooting

- **Build fails with "module not found"** → make sure Root Directory is set to
  `propfirm-site`, not the repo root.
- **Blank page after deploy** → check the build logs in Vercel; typically a
  TypeScript error. Run `npm run build` locally to reproduce.
- **3D scene not loading** → it's dynamically imported. Wait a moment after
  the page paints; on slow networks the chunk takes 2-3 seconds.

---

## Update the site after first deploy

Every push to a branch triggers a preview deploy.
Every push/merge to `main` triggers a production deploy automatically.

```bash
git add -A
git commit -m "tweak: copy update"
git push origin main
```

Done — Vercel rebuilds and ships in ~60 seconds.
