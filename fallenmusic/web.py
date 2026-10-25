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


async def start_health_server() -> web.AppRunner:
    app = web.Application()
    app.router.add_get("/", handle_root)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/health/strict", handle_health_strict)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", config.PORT)
    await site.start()
    LOGGER.info(f"[•] Health endpoint listening on 0.0.0.0:{config.PORT}")
    return runner


# --- Bot bootstrap -----------------------------------------------------------

async def boot_bot() -> None:
    """Connect bot + assistant + pytgcalls, retrying forever on failure."""
    import FallenMusic as fm
    from FallenMusic.Modules import ALL_MODULES

    for folder in ("downloads", "cache"):
        os.makedirs(folder, exist_ok=True)

    while True:
        STATE["attempts"] += 1
        try:
            # Order matters: fallen_startup() connects both clients and fills in
            # BOT_ID / BOT_NAME / BOT_USERNAME / BOT_MENTION / fallendb.  Several
            # modules bind those by value at import time, so they can only be
            # imported *after* startup has succeeded.
            await fm.fallen_startup()
            STATE["bot_online"] = True
            STATE["assistant_online"] = True

            LOGGER.info("[•] Loading Modules...")
            for module in ALL_MODULES:
                importlib.import_module("FallenMusic.Modules." + module)
            STATE["modules_loaded"] = len(ALL_MODULES)
            LOGGER.info(f"[•] Loaded {len(ALL_MODULES)} Modules.")

            # Must happen after the modules are imported: watcher.py registers
            # its @pytgcalls.on_stream_end() handler at import time.
            await fm.pytgcalls.start()
            STATE["pytgcalls_online"] = True
            STATE["last_error"] = None

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
            LOGGER.error(
                f"[•] Startup attempt {STATE['attempts']} failed -> {detail}. "
                f"Retrying in {config.RETRY_SECONDS}s."
            )
            # Full traceback: the one-line summary above is often useless on its
            # own.  e.g. a blocked network shows up as an opaque
            # "KeyError: 0" from pyrogram's TLObject.read(), which only makes
            # sense once you can see it came from the DC handshake.
            LOGGER.error("Traceback follows:\n%s", traceback.format_exc())
            LOGGER.error(
                "[•] Usual causes: wrong API_ID/API_HASH, expired SESSION string, "
                "BOT_TOKEN revoked by BotFather, or outbound traffic to "
                "Telegram's data centres blocked by the network/firewall."
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
