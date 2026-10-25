# MIT License
#
# Copyright (c) 2023 AnonymousX1025
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import os

from yt_dlp.utils import DownloadError

from FallenMusic.Helpers.yt_fallback import (
    client_strategies,
    is_retryable,
    make_ydl,
    strip_playlist,
)
from FallenMusic import LOGGER

DOWNLOADS_DIR = "downloads"
_DEFAULT_CACHE_MB = 200
# A zero or negative cap would make prune_downloads() delete every cached track
# immediately, so treat anything below this as the default.
_MIN_CACHE_MB = 10


def _cache_limit_bytes() -> int:
    """Read DOWNLOAD_CACHE_MB, tolerating empty/invalid/silly values.

    This runs at import time, so a bare ``int(os.getenv(...))`` would turn a
    typo in one optional env var into a hard crash that stops the bot from
    starting at all — and the traceback would point at import machinery, not at
    the variable that is actually wrong.  Fall back to the default and log why.
    """
    raw = os.getenv("DOWNLOAD_CACHE_MB")
    if raw is None or not raw.strip():
        return _DEFAULT_CACHE_MB * 1024 * 1024
    try:
        mb = int(raw.strip())
    except ValueError:
        LOGGER.warning(
            f"[•] DOWNLOAD_CACHE_MB={raw!r} is not a number; using "
            f"{_DEFAULT_CACHE_MB} MB."
        )
        return _DEFAULT_CACHE_MB * 1024 * 1024
    if mb < _MIN_CACHE_MB:
        LOGGER.warning(
            f"[•] DOWNLOAD_CACHE_MB={mb} is below {_MIN_CACHE_MB}; using "
            f"{_DEFAULT_CACHE_MB} MB instead so the cache is not emptied "
            "immediately after every download."
        )
        return _DEFAULT_CACHE_MB * 1024 * 1024
    return mb * 1024 * 1024


# audio_dl caches every track it fetches so replays are instant, but the cache
# was never trimmed.  Cap it so a 24/7 bot cannot fill Render's small ephemeral
# disk.  Override with DOWNLOAD_CACHE_MB.
DOWNLOAD_CACHE_BYTES = _cache_limit_bytes()

ydl_opts = {
    "format": "bestaudio/best",
    "outtmpl": "downloads/%(id)s.%(ext)s",
    "geo_bypass": True,
    "nocheckcertificate": True,
    "quiet": True,
    "no_warnings": True,
    "prefer_ffmpeg": True,
    # /play always wants exactly one track.  Without this, a search result that
    # is a YouTube Mix sends yt-dlp down the youtube:tab playlist extractor and
    # the request fails on the playlist API page.
    "noplaylist": True,
    "postprocessors": [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "320",
        }
    ],
}


def prune_downloads(limit: int = DOWNLOAD_CACHE_BYTES, keep: str | None = None) -> int:
    """Trim the downloads/ cache down to `limit` bytes, oldest files first.

    ``audio_dl`` caches by video id so replays don't re-download, but nothing
    ever removed those files — only the manual ``/clean`` command did.  Render
    gives the container a small ephemeral disk and this bot runs 24/7, so a busy
    deployment would slowly fill it and then start failing on unrelated
    operations.

    Returns how many files were removed.  `keep` (a path we just handed back to
    the player) is never deleted, even if it alone exceeds the limit.
    """
    entries: list[tuple[float, int, str]] = []
    total = 0
    try:
        names = os.listdir(DOWNLOADS_DIR)
    except FileNotFoundError:
        return 0

    for name in names:
        path = os.path.join(DOWNLOADS_DIR, name)
        if not os.path.isfile(path):
            continue
        try:
            stat = os.stat(path)
        except OSError:
            continue
        entries.append((stat.st_mtime, stat.st_size, path))
        total += stat.st_size

    if total <= limit:
        return 0

    removed = 0
    for _mtime, size, path in sorted(entries):  # oldest first
        if total <= limit:
            break
        if keep and os.path.abspath(path) == os.path.abspath(keep):
            continue
        try:
            os.remove(path)
        except OSError:
            continue
        total -= size
        removed += 1

    if removed:
        LOGGER.info(f"[•] downloads cache trimmed: removed {removed} old file(s).")
    return removed


def audio_dl(url: str) -> str:
    """Download a track as MP3, trying alternate player clients on refusal.

    Upstream used one module-level ``YoutubeDL`` with yt-dlp's default clients.
    On a datacentre IP those defaults are frequently refused, so every single
    ``/play`` failed with "Failed to extract any player response".  This walks
    the client list until one answers.

    Non-retryable errors (private video, deleted video, bad URL) are raised
    immediately instead of being retried under five more clients.
    """
    last_error: DownloadError | None = None
    url = strip_playlist(url)

    for client in client_strategies():
        label = client or "yt-dlp default"
        try:
            ydl = make_ydl(ydl_opts, client)
            sin = ydl.extract_info(url, False)
            x_file = os.path.join(DOWNLOADS_DIR, f"{sin['id']}.mp3")
            if os.path.exists(x_file):
                return x_file
            ydl.download([url])
            if client:
                LOGGER.info(f"[•] YouTube extracted via player client '{client}'.")
            # Only after a real download: a cache hit added nothing to the disk.
            # `keep` protects the file we are about to hand to the player.
            prune_downloads(keep=x_file)
            return x_file
        except DownloadError as exc:
            if not is_retryable(exc):
                raise
            last_error = exc
            LOGGER.warning(
                f"[•] player client '{label}' refused ({exc}); trying next."
            )

    # Every client was refused — almost always means the host's egress IP is
    # blocked by YouTube.  Say so, because no client flag can fix that.
    LOGGER.error(
        "[•] All player clients were refused. The host's egress IP is very "
        "likely blocked by YouTube. Real fixes: supply cookies from a real "
        "account (YTDLP_COOKIES), deploy somewhere with a different IP, or "
        "route through a proxy."
    )
    if last_error is not None:
        raise last_error
    raise DownloadError("No YouTube player client succeeded")
