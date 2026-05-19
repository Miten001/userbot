# 🚀 ApexFunded — Deploy Guide

There are two ways to view the live site. The **first option needs only one
click from you** — everything else is fully automated.

---

## ⭐ Option 1 · GitHub Pages (auto-deploy, zero config)

A GitHub Actions workflow has been set up at
`.github/workflows/deploy-pages.yml` that automatically builds the site as a
static export and publishes it to GitHub Pages every time you push to
`master` / `main`.

### One-time setup (1 click)

1. Open the repo on GitHub: **<https://github.com/Miten001/userbot>**
2. Click **Settings** (top right of the repo).
3. In the left sidebar, click **Pages**.
4. Under **"Build and deployment"** → **Source**, select
   **"GitHub Actions"**.
5. Save.

That's it. The next push (or the workflow that already ran) will publish the
site at:

> **<https://miten001.github.io/userbot/>**

You can also trigger the workflow manually anytime from the **Actions** tab →
**Deploy ApexFunded to GitHub Pages** → **Run workflow**.

### What the workflow does

1. Checks out the repo.
2. Installs Node 20 + dependencies in `propfirm-site/`.
3. Runs `next build` with `GITHUB_PAGES=true` so Next produces a static
   export under `propfirm-site/out/`.
4. Uploads the artifact and deploys to Pages.

The site already knows it's hosted at `/userbot/` thanks to the conditional
`basePath` in `next.config.mjs`.

---

## Option 2 · Vercel (faster CDN + custom domains)

If you want a top-tier CDN, push-to-deploy previews, and easy custom domains,
deploy to Vercel.

1. Go to **<https://vercel.com/new>**.
2. Sign in with GitHub and import `Miten001/userbot`.
3. In the import dialog:
   - **Root Directory** → click "Edit" → select `propfirm-site`.
   - Framework auto-detects as **Next.js**.
4. Click **Deploy**. ~90 seconds later you get
   `https://userbot-xxx.vercel.app`.

You don't need any environment variables — Vercel runs the regular Next build
(no static export), which is the highest-fidelity mode.

### Custom domain

After deploy: **Settings → Domains → Add `your-domain.com`** and follow the
DNS instructions Vercel provides.

---

## Option 3 · Run locally

```bash
git clone https://github.com/Miten001/userbot.git
cd userbot/propfirm-site
npm install
npm run dev
```

Open <http://localhost:3000>. Requires Node.js 18+ → <https://nodejs.org>

---

## Troubleshooting

| Symptom                          | Fix                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Pages shows 404                  | Did you select **"GitHub Actions"** as the Pages source? Re-run the workflow.      |
| Assets 404 on Pages              | Make sure `next.config.mjs` still has the `isPages` block (uses `basePath`).       |
| 3D scene blank for 2-3s          | Normal — it's a dynamic import that loads after first paint.                       |
| Vercel build fails               | Set **Root Directory** to `propfirm-site` in the project settings.                 |
| Want a different repo path       | Change `repoBasePath` in `next.config.mjs` to `/your-repo-name`.                   |

---

## Updating the live site

```bash
git add -A
git commit -m "tweak: copy update"
git push origin master
```

The Pages workflow auto-runs and re-deploys in ~2 minutes.
