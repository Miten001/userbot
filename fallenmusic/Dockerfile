# Fallen Music — Render-ready image
#
# BOTH ffmpeg AND Node.js are required:
#   - ffmpeg      : py-tgcalls transcodes audio through the ffmpeg binary.
#   - Node.js     : py-tgcalls 0.9.7 runs its voice-chat core as a Node
#                   subprocess.  pytgcalls/binding.py literally does
#                   create_subprocess_exec('node', <pkg>/dist/index.js), and
#                   pytgcalls/environment.py raises NodeJSNotInstalled when
#                   `node -v` returns nothing.  Minimum version is 15.0.0
#                   (pytgcalls/scaffold.py: _REQUIRED_NODEJS_VERSION).
#
# An earlier revision of this file dropped Node on the reasoning that
# py-tgcalls only needed ffmpeg.  That was wrong: the image built fine and the
# bot + assistant connected, but pytgcalls.start() died in check_environment(),
# so /play never worked.
#
# Debian bookworm (what python:3.11-slim is based on) ships Node 18.x, which
# satisfies the >=15 requirement.

FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        nodejs \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so code-only changes reuse this layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p downloads cache

# Fail the build instead of the deploy if either binary is missing.  Without
# this the image builds cleanly and only breaks at runtime, deep inside
# pytgcalls.start().
#
# The yt-dlp version is printed so the build log states exactly which release
# shipped — an unpinned dependency plus a cached `pip install` layer is how a
# stale yt-dlp ends up in production while looking current.
RUN ffmpeg -version > /dev/null \
    && node -v \
    && python -c "import pytgcalls, pyrogram; print('imports ok')" \
    && python -c "import yt_dlp; print('yt-dlp', yt_dlp.version.__version__)"

# Render injects PORT; config.py falls back to 10000 for local runs.
EXPOSE 10000

CMD ["python3", "web.py"]
