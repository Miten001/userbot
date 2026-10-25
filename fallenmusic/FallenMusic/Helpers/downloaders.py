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
            x_file = os.path.join("downloads", f"{sin['id']}.mp3")
            if os.path.exists(x_file):
                return x_file
            ydl.download([url])
            if client:
                LOGGER.info(f"[•] YouTube extracted via player client '{client}'.")
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
