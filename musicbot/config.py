"""Central config loader."""
import os
from dotenv import load_dotenv

load_dotenv()


def _int_env(name: str, default: int = 0) -> int:
    val = os.getenv(name, "").strip()
    try:
        return int(val)
    except ValueError:
        return default


def _list_env(name: str) -> list[int]:
    raw = os.getenv(name, "")
    if not raw:
        return []
    out = []
    for x in raw.split(","):
        x = x.strip()
        if x.isdigit():
            out.append(int(x))
    return out


API_ID        = _int_env("API_ID")
API_HASH      = os.getenv("API_HASH", "").strip()
BOT_TOKEN     = os.getenv("BOT_TOKEN", "").strip()
SESSION_STRING = os.getenv("SESSION_STRING", "").strip()
OWNER_ID      = _int_env("OWNER_ID")
SUDO_USERS    = set(_list_env("SUDO_USERS")) | ({OWNER_ID} if OWNER_ID else set())
BOT_USERNAME  = os.getenv("BOT_USERNAME", "").strip()
SUPPORT_CHAT  = os.getenv("SUPPORT_CHAT", "").strip()

PREFIXES = ["!", "/", "."]
