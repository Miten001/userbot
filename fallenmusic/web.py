"""Render entrypoint: Fallen Music + an HTTP health endpoint in one process.

Why this exists
---------------
Render gives free instances only to *Web Services* — Background Workers start at
the paid Starter plan.  A Web Service must listen on ``$PORT``, so this module
serves a tiny aiohttp health API and runs the bot in the same event loop.

It also fixes a boot-order problem: upstream runs
``run_until_complete(fallen_startup())`` at *import time* of the package, so any
transient Telegram failure crashed the container before the web server (and
therefore Render's health check) ever came up.  Here the HTTP server binds
first, then the bot connects with retries — a restart loop becomes a logged
retry instead.

Run it:      python3 web.py
Health:      GET /health        -> 200 always, JSON status
             GET /health/strict -> 503 until the bot is actually connected
Diagnosis:   GET /diag/yt       -> can YouTube be reached from this host?
             GET /diag/yt?url=<youtube url>
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import os
import time
import traceback

from aiohttp import web

# Must be set before FallenMusic is imported: it defers the import-time connect.
os.environ.setdefault("FALLEN_DEFER_STARTUP", "1")

import config  # noqa: E402  (imported after the env flag above)

LOGGER = logging.getLogger("FallenMusic.web")

STARTED_AT = time.time()

STATE = {
    "modules_loaded": 0,
    "bot_online": False,
    "assistant_online": False,
    "pytgcalls_online": False,
    "attempts": 0,
    "stage": None,
    "last_error": None,
}


def _bot_identity() -> dict:
    """Read bot/assistant identity, which only exists after a successful boot."""
    import FallenMusic as fm

    return {
        "bot_name": getattr(fm, "BOT_NAME", None),
        "bot_username": getattr(fm, "BOT_USERNAME", None),
        "assistant_name": getattr(fm, "ASS_NAME", None),
        "assistant_username": getattr(fm, "ASS_USERNAME", None),
    }


def _status_payload() -> dict:
    return {
        "service": "fallen-music",
        "status": "online" if STATE["pytgcalls_online"] else "degraded",
        "uptime_seconds": round(time.time() - STARTED_AT, 1),
        **{k: v for k, v in STATE.items() if k != "last_error"},
        "last_error": STATE["last_error"],
        **_bot_identity(),
    }


# --- HTTP handlers -----------------------------------------------------------

async def handle_health(request: web.Request) -> web.Response:
    return web.json_response(_status_payload())


async def handle_health_strict(request: web.Request) -> web.Response:
    """For a real liveness probe: 503 until the bot is connected to Telegram."""
    payload = _status_payload()
    code = 200 if STATE["pytgcalls_online"] else 503
    return web.json_response(payload, status=code)


async def handle_root(request: web.Request) -> web.Response:
    return web.Response(
        text="Fallen Music bot is running. See /health for status.\n",
        content_type="text/plain",
    )


DEFAULT_DIAG_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Message fragments that mean "we never got a usable reply from YouTube" rather
# than "YouTube answered and said no".  Only used as a fallback when the
# exception chain does not tell us.
_NETWORK_MARKERS = (
    "unable to download",
    "tls/ssl",
    "certificate",
    "name or service not known",
    "temporary failure in name resolution",
    "network is unreachable",
    "connection refused",
    "connection reset",
    "connection aborted",
    "eof occurred",
    "timed out",
    "failed to resolve",
    "no route to host",
    "getaddrinfo",
)


def _classify_failure(exc: BaseException) -> str:
    """Return "refused" (YouTube answered and said no) or "network" (never got there).

    These look similar in the log and mean opposite things, so the distinction
    is worth getting right:

      * "refused" — an HTTP response arrived (403/429/"sign in to confirm
        you're not a bot").  YouTube is reachable and actively blocking this
        host.  Cookies, a different egress IP, or a proxy can help.
      * "network" — no usable reply at all (TLS/DNS/connection failure).  Nothing
        about YouTube's opinion of us is known yet; fix connectivity first.

    Walks the real exception chain (``__cause__``/``__context__``/``exc_info``)
    and only falls back to message matching if that is inconclusive.
    """
    from yt_dlp.networking.exceptions import HTTPError, TransportError

    seen: set[int] = set()
    stack = [exc]
    # DownloadError stashes the original exception as a sys.exc_info() tuple.
    stack.extend(x for x in (getattr(exc, "exc_info", None) or ()) if isinstance(x, BaseException))

    while stack:
        current = stack.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))
        if isinstance(current, HTTPError):
            return "refused"  # got a status line back -> we reached YouTube
        if isinstance(current, TransportError):
            return "network"
        stack.append(getattr(current, "__cause__", None))
        stack.append(getattr(current, "__context__", None))

    msg = str(exc).lower()
    if any(marker in msg for marker in _NETWORK_MARKERS):
        return "network"
    return "refused"


def _run_yt_diagnosis(url: str) -> dict:
    """Try every shipped player client against `url` and report what happened.

    Deliberately calls the *same* helpers /play uses (``client_strategies`` and
    ``make_ydl`` from ``FallenMusic.Helpers.yt_fallback``) so this reports the
    real code path instead of a re-implementation that could drift from it.

    ``download=False`` — we only need to know whether extraction succeeds, so no
    audio is fetched and nothing touches the disk.
    """
    from yt_dlp import version as ydl_version
    from yt_dlp.utils import DownloadError

    from FallenMusic.Helpers.yt_fallback import (
        client_strategies,
        is_retryable,
        make_ydl,
        strip_playlist,
    )
    from FallenMusic.Helpers.downloaders import ydl_opts

    clean_url = strip_playlist(url)
    attempts = []
    first_error = None

    for client in client_strategies():
        label = client or "yt-dlp default"
        entry = {"client": label}
        try:
            ydl = make_ydl(ydl_opts, client)
            info = ydl.extract_info(clean_url, download=False)
            entry["ok"] = True
            entry["id"] = info.get("id")
            entry["title"] = (info.get("title") or "")[:80]
            entry["formats"] = len(info.get("formats") or [])
            attempts.append(entry)
            return {
                "url": clean_url,
                "works": True,
                "yt_dlp_version": ydl_version.__version__,
                "winning_client": label,
                "attempts": attempts,
                "verdict": (
                    f"YouTube extraction works from this host via '{label}'. "
                    "If /play still fails the problem is elsewhere."
                ),
            }
        except DownloadError as exc:
            msg = str(exc)
            entry["ok"] = False
            entry["retryable"] = is_retryable(exc)
            entry["kind"] = _classify_failure(exc)
            entry["error"] = msg[:400]
            first_error = first_error or msg
            attempts.append(entry)
        except Exception as exc:  # noqa: BLE001 — diagnostics must not raise
            entry["ok"] = False
            entry["retryable"] = False
            entry["kind"] = _classify_failure(exc)
            entry["error"] = f"{type(exc).__name__}: {exc}"[:400]
            first_error = first_error or entry["error"]
            attempts.append(entry)

    kinds = {a.get("kind") for a in attempts if not a["ok"]}
    return {
        "url": clean_url,
        "works": False,
        "yt_dlp_version": ydl_version.__version__,
        "winning_client": None,
        "attempts": attempts,
        "last_error": first_error,
        "failure_kind": "network" if kinds == {"network"} else (
            "refused" if kinds == {"refused"} else "mixed"
        ),
        "verdict": _verdict(kinds),
    }


def _verdict(kinds: set) -> str:
    if kinds == {"network"}:
        return (
            "Could not reach YouTube at all — every attempt failed at the "
            "network layer (TLS/DNS/connection), before YouTube could accept or "
            "refuse anything. This says nothing about whether your IP is "
            "blocked. Fix outbound connectivity first: check DNS, any proxy "
            "settings, and that the container can reach the internet. Note that "
            "yt-dlp is up to date here, so a version bump is not the answer."
        )
    if kinds == {"refused"}:
        return (
            "Every player client was refused *after* YouTube answered. That is "
            "the signature of this host's egress IP being walled by YouTube, "
            "not a config bug — no yt-dlp flag or version bump will fix it. "
            "Real fixes: cookies from a real YouTube account, a different "
            "egress IP (VPS / fresh Render service), or a residential proxy."
        )
    return (
        "Mixed failures across clients — some looked like network trouble and "
        "some like YouTube refusals. See 'attempts' for the per-client detail."
    )


async def handle_diag_yt(request: web.Request) -> web.Response:
    """GET /diag/yt[?url=...] — can YouTube be reached from this host?

    Answers the one question the logs make hard to answer at a glance, and it is
    the question that decides whether /play can ever work here.  yt-dlp is
    blocking, so it runs in a worker thread and the event loop stays free.
    """
    url = request.query.get("url") or DEFAULT_DIAG_URL
    if not url.lower().startswith(("http://", "https://")):
        return web.json_response(
            {"error": "url must start with http:// or https://"}, status=400
        )
    try:
        payload = await asyncio.to_thread(_run_yt_diagnosis, url)
    except Exception as exc:  # noqa: BLE001
        return web.json_response(
            {"url": url, "works": False, "error": f"{type(exc).__name__}: {exc}"},
            status=500,
        )
    return web.json_response(payload, status=200 if payload["works"] else 502)


async def start_health_server() -> web.AppRunner:
    app = web.Application()
    app.router.add_get("/", handle_root)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/health/strict", handle_health_strict)
    app.router.add_get("/diag/yt", handle_diag_yt)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", config.PORT)
    await site.start()
    LOGGER.info(f"[•] Health endpoint listening on 0.0.0.0:{config.PORT}")
    return runner


# --- Bot bootstrap -----------------------------------------------------------

async def _stop_clients(fm) -> None:
    """Tear down partially-started clients so the next attempt can reconnect.

    pyrogram sets ``is_connected = True`` at the end of a successful
    ``connect()``, so a failure *after* ``app.start()`` leaves that client
    connected.  ``connect()`` then raises ``ConnectionError("Client is already
    connected")`` on every subsequent attempt, which makes the retry loop
    unable to ever recover — and hides the real error behind it.

    ``Client.stop()`` is ``terminate()`` + ``disconnect()``; both raise when the
    client is already down, so each call is guarded.

    py-tgcalls 0.9.7 has no ``stop()``, and it has the same trap one level down:
    ``start()`` sets ``self._is_running = True`` *before* doing any work, then
    runs ``check_environment()`` / ``_init_mtproto()`` / ``_start_binding()``.
    If any of those raise, the flag stays set and every later attempt dies with
    ``PyTgCallsAlreadyRunning`` — hiding the real cause (in this deployment it
    was Node.js missing from the image).  So reset the flag by hand.
    """
    for name in ("app2", "app"):
        client = getattr(fm, name, None)
        if client is None:
            continue
        try:
            await client.stop()
            LOGGER.info(f"[•] cleanup: {name} stopped.")
        except Exception as exc:  # noqa: BLE001 — cleanup must never raise
            LOGGER.debug(
                f"[•] cleanup: {name}.stop() -> {type(exc).__name__}: {exc}"
            )

    calls = getattr(fm, "pytgcalls", None)
    if calls is not None and getattr(calls, "_is_running", False):
        calls._is_running = False
        LOGGER.info("[•] cleanup: pytgcalls._is_running reset.")


async def boot_bot() -> None:
    """Connect bot + assistant + pytgcalls, retrying forever on failure."""
    import FallenMusic as fm
    from FallenMusic.Modules import ALL_MODULES

    for folder in ("downloads", "cache"):
        os.makedirs(folder, exist_ok=True)

    while True:
        STATE["attempts"] += 1
        # Names the failing step in the log, so "attempt N failed" says *what*
        # failed instead of leaving the reader to reconstruct it from a
        # traceback.
        stage = "connect clients"
        try:
            # Order matters: fallen_startup() connects both clients and fills in
            # BOT_ID / BOT_NAME / BOT_USERNAME / BOT_MENTION / fallendb.  Several
            # modules bind those by value at import time, so they can only be
            # imported *after* startup has succeeded.
            await fm.fallen_startup()
            STATE["bot_online"] = True
            STATE["assistant_online"] = True

            stage = "load modules"
            LOGGER.info("[•] Loading Modules...")
            for module in ALL_MODULES:
                importlib.import_module("FallenMusic.Modules." + module)
            STATE["modules_loaded"] = len(ALL_MODULES)
            LOGGER.info(f"[•] Loaded {len(ALL_MODULES)} Modules.")

            # A stale yt-dlp looks exactly like a blocked IP in the error text,
            # so log the build once per boot to remove the guesswork.
            from FallenMusic.Helpers.yt_fallback import log_version

            log_version()

            # Must happen after the modules are imported: watcher.py registers
            # its @pytgcalls.on_stream_end() handler at import time.
            stage = "start pytgcalls"
            await fm.pytgcalls.start()
            STATE["pytgcalls_online"] = True
            STATE["last_error"] = None
            STATE["stage"] = "ready"

            LOGGER.info(
                "[•] Bot Started As "
                f"{getattr(fm, 'BOT_NAME', '?')} (@{getattr(fm, 'BOT_USERNAME', '?')})."
            )
            LOGGER.info(
                "[•] Assistant Started As "
                f"{getattr(fm, 'ASS_NAME', '?')} (@{getattr(fm, 'ASS_USERNAME', '?')})."
            )
            LOGGER.info("[•] PyTgCalls client running. Ready for /play.")
            return
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — keep the process alive on purpose
            detail = f"{type(exc).__name__}: {exc}"
            STATE["last_error"] = detail
            STATE["stage"] = f"failed during: {stage}"
            LOGGER.error(
                f"[•] Startup attempt {STATE['attempts']} failed during "
                f"'{stage}' -> {detail}. Retrying in {config.RETRY_SECONDS}s."
            )
            # Full traceback: the one-line summary above is often useless on its
            # own.  e.g. a blocked network shows up as an opaque
            # "KeyError: 0" from pyrogram's TLObject.read(), which only makes
            # sense once you can see it came from the DC handshake.
            LOGGER.error("Traceback follows:\n%s", traceback.format_exc())

            # Without this the next attempt dies instantly with
            # "Client is already connected" and the loop can never recover.
            await _stop_clients(fm)
            STATE["bot_online"] = False
            STATE["assistant_online"] = False
            STATE["pytgcalls_online"] = False

            LOGGER.error(
                "[•] Usual causes by stage: "
                "'connect clients' -> wrong API_ID/API_HASH, expired SESSION "
                "string, or BOT_TOKEN revoked; "
                "'load modules' -> a code/import error; "
                "'start pytgcalls' -> NodeJSNotInstalled (py-tgcalls 0.9.7 runs "
                "its voice-chat core as a `node` subprocess and needs Node >=15 "
                "in the image), a missing ffmpeg binary, or a voice-chat "
                "backend problem."
            )
            await asyncio.sleep(config.RETRY_SECONDS)


# --- Entrypoint --------------------------------------------------------------

async def main() -> None:
    runner = await start_health_server()
    try:
        await boot_bot()
        while True:  # keep the loop (and the container) alive
            await asyncio.sleep(3600)
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    logging.basicConfig(
        format="[%(asctime)s - %(levelname)s] - %(name)s - %(message)s",
        datefmt="%d-%b-%y %H:%M:%S",
        level=logging.INFO,
    )

    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        LOGGER.info("Fallen Music stopped.")
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        LOGGER.critical(f"Fatal: {exc}")
        raise
