"""Central configuration for Fallen Music (Render-ready fork).

Reads everything from the environment (.env locally, service env vars on Render).
Upstream version did ``int(getenv("API_ID"))``, which dies with a bare
``TypeError: int() argument must be ...`` when a variable is missing.  This
version reports *which* variable is missing and exits with a clear message.
"""

import sys
from os import getenv

from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    """Return a required env var, or exit with an actionable message."""
    value = (getenv(name) or "").strip()
    if not value:
        sys.stderr.write(
            f"\n[config] ERROR: required environment variable {name} is not set.\n"
            f"[config] On Render: Dashboard -> your service -> Environment.\n"
            f"[config] Locally: copy sample.env to .env and fill it in.\n\n"
        )
        raise SystemExit(2)
    return value


def _required_int(name: str) -> int:
    raw = _required(name)
    try:
        return int(raw)
    except ValueError:
        sys.stderr.write(
            f"\n[config] ERROR: {name} must be an integer, got {raw!r}.\n\n"
        )
        raise SystemExit(2)


# --- Telegram credentials (all required) -------------------------------------
API_ID = _required_int("API_ID")
API_HASH = _required("API_HASH")
BOT_TOKEN = _required("BOT_TOKEN")

# Assistant (userbot) string session — required for voice-chat streaming.
SESSION = _required("SESSION")

# Bot owner. Defaults to the value upstream shipped, but you should override it.
OWNER_ID = _required_int("OWNER_ID")

# --- Behaviour ---------------------------------------------------------------
# Max track length in MINUTES that /play will accept.
DURATION_LIMIT = int(getenv("DURATION_LIMIT", "90"))

# Images used by /start and /ping.
START_IMG = getenv("START_IMG", "https://te.legra.ph/file/f8ba75bdbb9931cbc8229.jpg")
PING_IMG = getenv("PING_IMG", "https://te.legra.ph/file/6f99c49bdb4679acad717.jpg")
FAILED = "https://te.legra.ph/file/4c896584b592593c00aa8.jpg"

# --- Sudo / ownership --------------------------------------------------------
# Upstream defaulted SUDO_USERS to "1356469075" (the upstream author's ID),
# which silently gave that account sudo on *your* bot — including /eval, which
# executes arbitrary Python.  Default is now empty: only OWNER_ID gets sudo.
SUDO_USERS = [int(x) for x in (getenv("SUDO_USERS") or "").split()]

# Set to "1" to also grant sudo to the upstream author. Off by default.
ADD_UPSTREAM_SUDO = getenv("ADD_UPSTREAM_SUDO", "0") == "1"

# --- Support chat ------------------------------------------------------------
# Must be a public t.me link.  Upstream did ``SUPPORT_CHAT.split("me/")[1]``
# which raises IndexError on anything that isn't a t.me URL.
SUPPORT_CHAT = getenv("SUPPORT_CHAT", "https://t.me/DevilsHeavenMF")
SUPPORT_CHANNEL = getenv("SUPPORT_CHANNEL", "https://t.me/FallenAssociation")

_parts = SUPPORT_CHAT.split("me/")
SUNAME = _parts[1].strip("/") if len(_parts) > 1 else "DevilsHeavenMF"

# Upstream made the assistant silently join the author's two chats on every
# boot.  Off by default; set JOIN_UPSTREAM_CHATS=1 to restore that behaviour.
JOIN_UPSTREAM_CHATS = getenv("JOIN_UPSTREAM_CHATS", "0") == "1"
UPSTREAM_CHATS = ("DevilsHeavenMF", "FallenAssociation")

# --- Health endpoint ---------------------------------------------------------
# web.py binds to $PORT (Render injects it). Fallback keeps local runs simple.
PORT = int(getenv("PORT", "10000"))
# Seconds to wait between reconnect attempts when Telegram is unreachable.
RETRY_SECONDS = int(getenv("RETRY_SECONDS", "30"))
