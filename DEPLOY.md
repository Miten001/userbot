# Deploy

The full deployment walkthrough is in [`SETUP.md`](./SETUP.md).

## TL;DR

1. Push to GitHub (already done).
2. Import the repo at <https://vercel.com/new>.
3. **No Root Directory change needed** — repo root IS the Next.js app.
4. Add environment variables (see [`.env.example`](./.env.example)).
5. Click **Deploy**.

That's it — your site is live in ~90 seconds.

---

## Telegram music bot (separate service)

The repo also ships a Telegram voice-chat music bot in [`fallenmusic/`](./fallenmusic),
deployed to **Render** rather than Vercel (it's a long-running process, not a web app).

It is driven by the Blueprint at [`render.yaml`](./render.yaml):

1. Push this branch to GitHub.
2. <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
3. Connect `Miten001/userbot`, pick the branch.
4. Fill in `API_ID`, `API_HASH`, `BOT_TOKEN`, `SESSION`, `OWNER_ID`.
5. **Apply**.

Full instructions, the required variables, and the free-plan sleep caveat:
[`fallenmusic/README.md`](./fallenmusic/README.md).
