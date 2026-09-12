<div align="center">

<h1>🎧 Spydii Music</h1>

<b>Modern Telegram Group-Call Music Bot</b><br>
Rich, colorful "Now Playing" thumbnails • YouTube, Spotify, Apple Music, SoundCloud & M3U8 support

<a href="https://github.com/Miten001/userbot/blob/main/musicbot">
    <img src="https://img.shields.io/badge/Version-1.0.0-blueviolet?style=for-the-badge" alt="Version"/>
</a>
<a href="https://github.com/Miten001/userbot/blob/main/musicbot/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
</a>
<a href="https://www.python.org/">
    <img src="https://img.shields.io/badge/Written%20in-Python-blue?style=for-the-badge&logo=python" alt="Python"/>
</a>
<br><br>

Spydii Music streams high-quality, low-latency audio and video into Telegram group video chats.<br>
Built with Python, Pyrogram (Kurigram) and Py-TgCalls — with a completely redesigned,
gradient-glass "Now Playing" thumbnail so every song looks like a premium release.
</div>

<hr>

<h2>🔥 Features</h2>

- 🎧 Real-time, low-latency audio/video streaming into Telegram group video chats
- 🌈 **Unique, hand-designed "Now Playing" thumbnails** — glass card, neon gradient ring, live-style progress bar, play badge
- 🌐 Supports YouTube, Spotify, Apple Music, SoundCloud, Resso & direct M3U8 links
- 📃 Advanced queue management with auto-play, loop, seek and force-play
- 👥 Multi-assistant support (up to 3 assistant accounts) for scaling across many chats
- 🌍 13 built-in languages
- ⚙️ Simple deployment — Local, VPS, Docker or Heroku
- ❤️ 100% Python, fully open for customization

<hr>

<h2>☁️ Deployment</h2>

<h3>✔️ Prerequisites</h3>

- <a href="https://www.python.org">Python 3.10+</a>
- <a href="https://deno.com/">deno</a> & <a href="https://ffmpeg.org/">ffmpeg</a> installed and on `PATH`
- A **Bot Token** from [@BotFather](https://t.me/BotFather)
- **API_ID / API_HASH** from [my.telegram.org](https://my.telegram.org)
- A **MongoDB** connection string from [cloud.mongodb.com](https://cloud.mongodb.com) (free tier works)
- At least **one Pyrogram string session** for an assistant account (a normal Telegram account, NOT the bot) —
  generate it with [@StringFatherBot](https://t.me/StringFatherBot) or the `generate_session.py` helper below.
  This assistant is what actually joins the voice chat; Telegram bots cannot join calls themselves.

<h3>🐧 Linux / macOS (VPS)</h3>

```bash
git clone https://github.com/Miten001/userbot && cd userbot/musicbot

# Install uv (fast Python package manager)
curl -Ls https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Install ffmpeg + deno if missing
sudo apt-get update && sudo apt-get install -y ffmpeg
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"

# Install dependencies
uv sync --frozen

# Configure environment variables
cp sample.env .env
nano .env   # fill in API_ID, API_HASH, BOT_TOKEN, MONGO_URL, LOGGER_ID, OWNER_ID, SESSION

# Start the bot
bash start
```

Or use the guided installer, which asks for every value interactively:

```bash
bash setup
```

<h3>🪟 Windows (PowerShell)</h3>

```powershell
git clone https://github.com/Miten001/userbot; cd userbot/musicbot

irm https://astral.sh/uv/install.ps1 | iex
uv sync --frozen

Copy-Item sample.env .env
notepad .env

uv run python3 -m anony
```

<h3>🐳 Docker</h3>

```bash
cd userbot/musicbot
docker build -t spydii-music .
docker run -d --name spydii-music --env-file .env spydii-music
```

<h3>🟪 Heroku</h3>

Push the `musicbot/` folder as its own repo (Heroku needs the Dockerfile at the repo root),
then deploy with the container stack:

```bash
heroku create your-app-name
heroku stack:set container -a your-app-name
git push heroku HEAD:main
```

Fill in all variables from `app.json` in the Heroku dashboard's Config Vars.

<hr>

<h2>⚙️ Configuration (`.env`)</h2>

```env
API_ID=123456
API_HASH=abcdef1234567890
BOT_TOKEN=123456:ABC-DEF
OWNER_ID=123456789
LOGGER_ID=-1001234567890
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net
SESSION=BQgfh...AA        # assistant #1 (required)
SESSION2=                 # assistant #2 (optional, for scale)
SESSION3=                 # assistant #3 (optional, for scale)
```

> 📝 See [`config.py`](../config.py) for every available option (duration limits, queue size, auto-leave, etc).

**How to get a SESSION string:** message [@StringFatherBot](https://t.me/StringFatherBot) on Telegram
with your API_ID/API_HASH, or run the `generate_session.py` script included in this folder and log in
with the phone number of the account you want to use as the music assistant.

<hr>

<h2>🧐 Usage</h2>

1. Add the bot to your Telegram **supergroup**.
2. Promote it to **admin** with "Invite Users via Link" permission.
3. Make sure a voice chat is started in the group.
4. Control playback with these commands:

```
/play    [name or link]  -> Play audio in the voice chat
/vplay   [name or link]  -> Play video in the voice chat
/playforce / /vplayforce -> Skip the queue and play immediately
/pause                   -> Pause playback
/resume                  -> Resume playback
/skip                    -> Skip to the next track
/stop                    -> Stop playback and leave the call
/seek <seconds>          -> Seek within the current track
/queue                   -> Show the current queue
/loop <count>            -> Loop the current track
/playmode | /settings    -> Configure chat playback settings
/lang                    -> Change bot language
/ping                    -> Bot + PyTgCalls latency and stats
```

<hr>

<h2>🎨 The Redesigned "Now Playing" Card</h2>

Every track streamed by Spydii Music renders a unique thumbnail on the fly:

- Blurred + tinted backdrop generated from the track's own cover art
- A frosted-glass info panel with a subtle gradient border
- A neon pink → violet → blue → teal gradient ring around the album art
- A live-style gradient progress bar with a glowing scrubber knob
- A gradient play badge and a small brand watermark

No third-party thumbnail APIs are used — everything is rendered locally with Pillow, so it keeps
working even if external image services go down.

<hr>

<h2>❤️ Contributing</h2>

1. Fork the repository.
2. Create your branch: `git checkout -b feature/new`.
3. Commit changes: `git commit -m 'New feature'`.
4. Push: `git push origin feature/new`.
5. Open a Pull Request.

<hr>

<h2>🗒️ License</h2>

Licensed under the **MIT License** — see [`LICENSE`](../LICENSE).
Originally based on the open-source AnonXMusic project, heavily restyled and rebranded as Spydii Music.

<hr>

<div align="center">

⭐ Enjoying the tunes? Give this repo a star!

</div>
