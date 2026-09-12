# Copyright (c) 2025
# Part of Spydii Music
#
# Small helper to generate a Pyrogram v2 (Kurigram) string session for an
# ASSISTANT account. Run this on your own machine/VPS (NOT inside this
# sandbox) and log in with the phone number of the account you want to use
# to join voice chats.
#
# Usage:
#   uv run python3 generate_session.py
#   (or: python3 generate_session.py, if you installed deps with pip)

import asyncio
from pyrogram import Client


async def main():
    print("=" * 50)
    print(" Spydii Music - Assistant Session Generator")
    print("=" * 50)
    print(
        "\nUse a NORMAL Telegram account here (not a bot).\n"
        "This account will join voice chats and stream audio.\n"
    )

    api_id = int(input("Enter your API_ID: ").strip())
    api_hash = input("Enter your API_HASH: ").strip()

    async with Client("session_gen", api_id=api_id, api_hash=api_hash, in_memory=True) as app:
        session_string = await app.export_session_string()

    print("\n✅ Your session string (keep this SECRET, treat it like a password):\n")
    print(session_string)
    print("\nAdd it to your .env file as SESSION=<the string above>\n")


if __name__ == "__main__":
    asyncio.run(main())
