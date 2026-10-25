"""yt-dlp wrapper — YouTube / SoundCloud / direct link se audio stream nikalta hai."""
from __future__ import annotations
import asyncio
import functools
from typing import NamedTuple
import yt_dlp


class SongInfo(NamedTuple):
    title: str
    stream_url: str
    url: str           # original page url
    duration: str
    thumb: str | None


_YTDL_OPTS = {
    "format": "bestaudio/best",
    "noplaylist": True,
    "nocheckcertificate": True,
    "ignoreerrors": False,
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch1",   # agar direct link nahi to YouTube pe search
    "geo_bypass": True,
    "source_address": "0.0.0.0",
}


def _fmt_duration(seconds: int | None) -> str:
    if not seconds or seconds <= 0:
        return "?"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _extract_sync(query: str) -> SongInfo:
    with yt_dlp.YoutubeDL(_YTDL_OPTS) as ydl:
        data = ydl.extract_info(query, download=False)
    # agar search kiya to list aati hai
    if "entries" in data:
        data = data["entries"][0]
    return SongInfo(
        title=data.get("title", "Unknown"),
        stream_url=data["url"],
        url=data.get("webpage_url", query),
        duration=_fmt_duration(data.get("duration")),
        thumb=data.get("thumbnail"),
    )


async def extract(query: str) -> SongInfo:
    """Blocking extract call ko thread pool mein chalao taaki bot freeze na ho."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(_extract_sync, query))
