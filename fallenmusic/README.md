# 🎵 Fallen Music — Telegram Voice Chat Music Bot (Render-ready)

Vendored from [`AnonymousX1025/FallenMusic`](https://github.com/AnonymousX1025/FallenMusic)
at commit `b2d8297496b2ea800d564e561927ffe1a9c8a6f9` (2026-01-02, MIT licensed —
see [`LICENSE`](./LICENSE)). Plays YouTube audio into Telegram group voice chats
via Pyrogram + py-tgcalls.

**No MongoDB required.** Upstream keeps its queue in a plain in-memory dict
(`fallendb`), so there is no database to provision. The trade-off: the queue is
lost on every restart.

---

## What was changed from upstream

| Change | Why |
|---|---|
| `web.py` added — HTTP health endpoint + bot in one event loop | Render only offers free instances to **Web Services**, which must listen on `$PORT`. Background Workers have no free tier. |
| `FALLEN_DEFER_STARTUP` flag in `FallenMusic/__init__.py` | Upstream connects to Telegram at *import time*, so a transient network blip crashed the container before the health check ever came up. Now the HTTP server binds first and the bot connects with retries. |
| Safe module-level defaults for `BOT_ID` / `BOT_NAME` / `BOT_USERNAME` / `BOT_MENTION` / `fallendb` | Upstream creates them *inside* `fallen_startup()`. Modules bind them by value (`from FallenMusic import BOT_USERNAME`), so importing modules before startup raised `ImportError: cannot import name 'fallendb'`. Verified by `check_imports.py`. |
| `ADD_UPSTREAM_SUDO` defaults to **0** | Upstream defaulted `SUDO_USERS` to `1356469075` — the author's own ID — granting that account sudo on *your* bot, including `/eval`, which executes arbitrary Python on your server. |
| `JOIN_UPSTREAM_CHATS` defaults to **0** | Upstream made your assistant silently join the author's two chats on every boot. |
| `config.py` reports which variable is missing | Upstream did `int(getenv("API_ID"))` → bare `TypeError: int() argument must be...` with no clue what was unset. |
| `SUNAME` parsed defensively | Upstream's `SUPPORT_CHAT.split("me/")[1]` raised `IndexError` on any non-`t.me` value. |
| Dockerfile: `python:3.11-slim` + ffmpeg **+ nodejs** instead of `nikolaik/python-nodejs:python3.9-nodejs18` | Keeps the verified Python 3.11 pinning. Node is **required** — see the warning below. |

### ⚠️ Node.js is required, not optional

An earlier revision of the Dockerfile dropped Node, reasoning that py-tgcalls
only needed ffmpeg. That was **wrong** and it broke `/play` in production while
the image still built and the bot still connected.

py-tgcalls 0.9.7 runs its voice-chat core as a **Node subprocess**:

- `pytgcalls/binding.py` → `create_subprocess_exec('node', <pkg>/dist/index.js)`
- `pytgcalls/environment.py` → raises `NodeJSNotInstalled` when `node -v` is empty
- `pytgcalls/scaffold.py` → `_REQUIRED_NODEJS_VERSION = '15.0.0'`

Because `PyTgCalls.start()` sets `_is_running = True` *before* calling
`check_environment()`, the first attempt fails with `NodeJSNotInstalled` and
every retry after it reports the misleading `PyTgCallsAlreadyRunning`. `web.py`
now resets that flag between attempts so the real error stays visible.

Both binaries are asserted at **build time** (see the `RUN` near the end of the
Dockerfile) and again in CI, so a missing one fails the build rather than the
deploy.

The original worker entrypoint (`bash fallen` → `python3 -m FallenMusic`) is
untouched, so this still runs as a plain Background Worker or on a VPS.

---

## Deploy to Render

`render.yaml` at the repo root is a Blueprint. **Push this branch to GitHub
first**, then:

1. Go to <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
2. Connect the `Miten001/userbot` repo and select branch `main` (or this branch).
3. Render finds `render.yaml` and shows one service: `fallen-music`.
4. Fill in the five `sync: false` env vars (see below) and click **Apply**.

Manual alternative: **New → Web Service**, Root Directory `fallenmusic`,
Runtime **Docker**, Health Check Path `/health`, then add the env vars.

### Required environment variables

| Variable | Where to get it |
|---|---|
| `API_ID`, `API_HASH` | <https://my.telegram.org> → API development tools |
| `BOT_TOKEN` | `@BotFather` → `/newbot` |
| `SESSION` | Pyrogram **v2** string session for the *assistant* account — `@StringFatherBot` |
| `OWNER_ID` | Your numeric Telegram ID — `@userinfobot` |

### ⚠️ The free plan sleeps

Render's free Web Service spins down after **15 minutes without inbound HTTP
traffic** and takes about a minute to wake. A Telegram bot receives no HTTP
traffic, so it *will* sleep. Two options:

- **Free:** point an external uptime pinger (UptimeRobot, cron-job.org) at your
  `https://<service>.onrender.com/health` every 5–10 minutes. 24/7 uptime needs
  ~730 of Render's 750 free instance-hours per month — workable but tight.
- **Paid (recommended):** set `plan: 0.5c-512mb` in `render.yaml` ($7/month). No
  spin-down. Note the free instance is 0.1 CPU, which is thin for ffmpeg
  transcoding — expect occasional audio stutter on busy streams.

Render's own docs are explicit that free instances aren't for production:
<https://render.com/docs/free>

### After deploying

1. Add **both** accounts to your group: the bot, and the assistant account whose
   session you used.
2. Make the bot an admin with **Manage Video Chats**.
3. Start a voice chat in the group, then send `/play <song name>`.

---

## YouTube extraction on datacentre IPs

`/play` downloads through yt-dlp. On a datacentre IP (Render, Heroku, most VPS
hosts) YouTube frequently refuses the clients yt-dlp asks for by default and
raises:

```
Failed to extract any player response
```

`FallenMusic/Helpers/yt_fallback.py` walks an ordered list of player clients
until one answers, and logs which one worked. Configure it with
`YTDLP_CLIENTS`. The default order puts the clients that generally do **not**
need a GVS PO token first:

```
YTDLP_CLIENTS=web_embedded,tv_downgraded,tv_simply,mweb,android,tv
```

Valid names for yt-dlp 2026.10.21: `android, android_vr, ios, mweb, tv,
tv_downgraded, tv_samsung, tv_simply, visionos, web, web_creator, web_embedded,
web_music, web_safari`.

The yt-dlp build is logged at every boot **and** printed during the Docker
build, because a stale yt-dlp produces the same message as a blocked IP and the
error text does not tell them apart.

### Bumping yt-dlp

`yt-dlp` is **pinned** in `requirements.txt` (`yt-dlp==2026.10.21`). That is
deliberate: the Dockerfile's `pip install` layer is cached off
`requirements.txt`, so an unpinned dependency with an unchanged file reuses the
layer and silently keeps whatever version shipped in the *first* build.

When YouTube starts refusing requests:

1. Check the newest release: <https://pypi.org/pypi/yt-dlp/json>
2. Bump the pin in `requirements.txt`
3. Redeploy — the changed file invalidates the cached layer

CI asserts the pinned version equals the version actually installed in the
built image.

### ⚠️ This may not be enough

**If every client is refused, the host's egress IP is being walled by YouTube and
no flag in this repository can change that.** Real fixes, in order of
effectiveness:

1. **Cookies from a real YouTube account** — `cookiesfile` in the yt-dlp opts.
2. **Deploy somewhere with a different IP** — a VPS, or a fresh Render service
   (which gets a different egress address).
3. **A residential proxy** via yt-dlp's `proxy` option.

The bot logs an explicit message when all clients were refused, so this case is
distinguishable from a normal failure.

## Disk usage

Two things grow on disk over time, and both are capped because Render's
filesystem is small **and** ephemeral:

| What | Cap | Override |
|---|---|---|
| `fallenlogs.txt` | 5 MB × 3 rotated backups (~20 MB) | — |
| `downloads/` track cache | 200 MB, oldest files evicted first | `DOWNLOAD_CACHE_MB` |

Tracks are cached by video id so replaying a song doesn't re-download it. Once
`downloads/` passes the cap the oldest files are dropped; the file currently
being handed to the player is never evicted. The manual `/clean` command still
wipes the folder immediately.

## Environment variables

See [`.env.example`](./.env.example). Locally: `cp .env.example .env` and fill
it in. **Never commit `.env`** — it's gitignored.

Keep `ADD_UPSTREAM_SUDO=0` and `JOIN_UPSTREAM_CHATS=0`.

---

## Local development

```bash
cd fallenmusic
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# BOTH are required — without ffmpeg the bot joins the VC and plays silence,
# and without Node (>=15) pytgcalls.start() dies in check_environment().
ffmpeg -version
node -v

cp .env.example .env   # then fill it in
.venv/bin/python web.py
```

Health endpoint: <http://127.0.0.1:10000/health>

Verified on Python 3.11.2 with `py-tgcalls 0.9.7`, `Kurigram 2.2.1`,
`yt-dlp 2026.10.21`.

### Checks

```bash
# No network needed — proves every module imports with startup deferred
FALLEN_DEFER_STARTUP=1 python3 check_imports.py

# Config must reject missing credentials with a clear message
python3 -c "import config"
```

Both run in CI: [`.github/workflows/fallenmusic.yml`](../.github/workflows/fallenmusic.yml),
which also builds the Docker image and confirms `ffmpeg` is present.

---

## Commands

| Command | What it does |
|---|---|
| `/play <name or YouTube URL>` | Search & play, or queue if something is already playing |
| `/pause`, `/resume` | Pause / resume the current stream |
| `/skip` | Skip to the next track in the queue |
| `/stop` / `/end` | Stop and leave the voice chat |
| `/song <name>` | Download a track as an audio file |
| `/search <name>` | YouTube search with inline results |
| `/ping` | Latency + uptime |
| `/sysstats`, `/speedtest` | Host stats / bandwidth |
| `/activevc` | List voice chats the bot is in (sudo) |
| `/addsudo`, `/delsudo` | Manage sudo users (owner) |

Sudo commands include `/eval`, which runs arbitrary Python. Only add people you
trust completely.
