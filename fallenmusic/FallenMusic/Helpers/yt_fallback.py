"""YouTube extraction with player-client fallbacks.

On datacentre IPs (Render, Heroku, most VPS hosts) YouTube routinely refuses the
clients yt-dlp requests by default, and extraction dies with::

    Failed to extract any player response

or::

    All player responses are invalid. Your IP is likely being blocked by Youtube

This module walks an ordered list of player clients until one answers.  The
clients listed first are the ones that historically work without a GVS PO token.
Override the order with the ``YTDLP_CLIENTS`` env var (comma separated).

.. warning::

    This does **not** make a blocked IP work.  If every client is refused, the
    host's egress address is being walled by YouTube and the only real fixes are
    cookies from a real account, a different/residential IP, or a proxy.  What
    this does is stop one bad default client from killing every single request.

Valid client names come from ``yt_dlp.extractor.youtube._base.INNERTUBE_CLIENTS``.
For yt-dlp 2026.10.21 they are: android, android_vr, ios, mweb, tv,
tv_downgraded, tv_samsung, tv_simply, visionos, web, web_creator, web_embedded,
web_music, web_safari.
"""

from __future__ import annotations

import logging
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

LOGGER = logging.getLogger("FallenMusic.yt")

#: Query params that make yt-dlp switch from the video extractor to the
#: playlist/tab extractor.  ``youtube_search`` builds its links straight from
#: YouTube's own ``webCommandMetadata.url``, which frequently includes a Mix:
#: ``/watch?v=<id>&list=RD<id>&start_radio=1``.  Left alone, yt-dlp then tries to
#: walk the whole Mix through the ``youtube:tab`` extractor, which player_client
#: fallbacks cannot rescue at all.
_PLAYLIST_PARAMS = ("list", "start_radio", "index")

#: Clients tried in order.  These are the ones that generally do not require a
#: GVS PO token, which is what a headless datacentre request cannot supply.
DEFAULT_CLIENTS = "web_embedded,tv_downgraded,tv_simply,mweb,android,tv"

#: Substrings that mean "YouTube refused this request" rather than "this video
#: genuinely cannot be downloaded".  Only these trigger another client.
_RETRYABLE = (
    "player response",
    "sign in to confirm",
    "ip is likely being blocked",
    "po token",
    "not a bot",
    "429",
    "403",
)


def client_strategies() -> list[str | None]:
    """Ordered list of player clients to try.

    The first entry is ``None``, meaning "let yt-dlp use its own defaults" —
    that keeps normal (non-blocked) hosts on the well-tested path.
    """
    raw = os.getenv("YTDLP_CLIENTS", DEFAULT_CLIENTS)
    clients = [c.strip() for c in raw.split(",") if c.strip()]
    return [None, *clients]


def strip_playlist(url: str) -> str:
    """Drop playlist params so yt-dlp fetches a single video, not a Mix.

    ``/play`` only ever wants one track.  Without this, a search result that
    happens to be a Mix sends yt-dlp down the ``youtube:tab`` extractor and the
    request fails on the playlist API page instead of the video.
    """
    parts = urlsplit(url)
    if not parts.query:
        return url
    kept = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k not in _PLAYLIST_PARAMS
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))


def is_retryable(exc: BaseException) -> bool:
    """True when trying a different player client could plausibly help.

    A ``[youtube:tab]`` failure is the *playlist* extractor, which player_client
    does not affect — retrying it under six more clients just burns time and
    produces misleading logs, so it is excluded explicitly.
    """
    if not isinstance(exc, DownloadError):
        return False
    text = str(exc).lower()
    if "[youtube:tab]" in text:
        return False
    return any(marker in text for marker in _RETRYABLE)


def make_ydl(base_opts: dict, client: str | None = None) -> YoutubeDL:
    """Build a YoutubeDL, optionally pinned to one player client."""
    opts = dict(base_opts)
    if client:
        extractor_args = dict(opts.get("extractor_args") or {})
        youtube_args = dict(extractor_args.get("youtube") or {})
        youtube_args["player_client"] = [client]
        extractor_args["youtube"] = youtube_args
        opts["extractor_args"] = extractor_args
    return YoutubeDL(opts)


def log_version() -> None:
    """Log the yt-dlp build once at startup.

    A stale yt-dlp produces exactly the same symptom as a blocked IP, and the
    error text does not distinguish them.  Logging the version removes the
    guesswork.
    """
    try:
        import yt_dlp

        LOGGER.info(f"[•] yt-dlp version: {yt_dlp.version.__version__}")
    except Exception as exc:  # noqa: BLE001 — logging must never break startup
        LOGGER.warning(f"[•] could not read yt-dlp version: {exc}")
    LOGGER.info(
        "[•] YouTube client order: "
        + ", ".join(str(c or "<yt-dlp default>") for c in client_strategies())
    )
