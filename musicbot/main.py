"""
🎵 VVIP MUSIC BOT — Telegram Voice Chat Music Player
====================================================
Pyrofork (bot + assistant) + pytgcalls + yt-dlp
"""
from __future__ import annotations
import asyncio
import os
import signal
import sys
from typing import Optional

from pyrogram import Client, filters
from pyrogram.errors import ChatAdminRequired, UserAlreadyParticipant
from pyrogram.types import Message, CallbackQuery, Chat
from pytgcalls import PyTgCalls, idle
from pytgcalls.types import AudioPiped, MediaStream
from pytgcalls.types.stream import StreamAudioEnded
from pytgcalls.exceptions import (
    NoActiveGroupCall, AlreadyJoinedError, GroupCallNotFound
)

import config
from player import extract
from song_queue import Track, get as get_state, reset as reset_queue
from helpers import now_playing_kbd


# -------- clients --------

app_bot = Client(
    "vvip_bot",
    api_id=config.API_ID,
    api_hash=config.API_HASH,
    bot_token=config.BOT_TOKEN,
)

app_assistant = Client(
    "vvip_assistant",
    api_id=config.API_ID,
    api_hash=config.API_HASH,
    session_string=config.SESSION_STRING,
)

pytgcalls = PyTgCalls(app_assistant)


# -------- auth helpers --------

def _is_owner(user_id: int | None) -> bool:
    return bool(user_id and user_id in config.SUDO_USERS)


async def _join_assistant_to_chat(chat: Chat) -> None:
    """Assistant user ko group me add karo agar nahi hai."""
    me = await app_assistant.get_me()
    try:
        await chat.add_members(me.id)
    except (ChatAdminRequired, UserAlreadyParticipant):
        pass
    except Exception:
        try:
            link = await chat.export_invite_link()
            await app_assistant.join_chat(link)
        except Exception:
            pass


# -------- playback logic --------

async def _play_next(chat_id: int):
    state = get_state(chat_id)
    if not state.queue and not state.loop:
        state.current = None
        state.playing = False
        try:
            await pytgcalls.leave_group_call(chat_id)
        except Exception:
            pass
        return

    if state.loop and state.current:
        track = state.current
    else:
        track = state.queue.pop(0)
        state.current = track

    stream = AudioPiped(track.stream_url)
    try:
        await pytgcalls.join_group_call(chat_id, stream)
    except AlreadyJoinedError:
        await pytgcalls.change_stream(chat_id, stream)
    except NoActiveGroupCall:
        state.queue.insert(0, track)
        state.current = None
        raise
    state.playing = True


# -------- command helpers --------

def owner_cmd(cmd: str):
    return filters.command(cmd, prefixes=config.PREFIXES) & filters.user(list(config.SUDO_USERS))

def any_cmd(cmd: str):
    return filters.command(cmd, prefixes=config.PREFIXES)


# -------- commands --------

@app_bot.on_message(any_cmd(["start", "help"]))
async def cmd_start(_: Client, msg: Message):
    await msg.reply(
        f"🎵 **VVIP MUSIC BOT**\n\n"
        "Commands:\n"
        "• `/play <song/yt link>` — voice chat me gaana chalao\n"
        "• `/skip` — agla song\n"
        "• `/pause` / `/resume`\n"
        "• `/stop` — roko, queue saaf\n"
        "• `/queue` — queue dikhao\n"
        "• `/loop` — current song loop (owner)\n"
        "• `/leave` — voice chat se nikal jao (owner)\n"
        "• `/restart` — bot restart (owner)"
    )


@app_bot.on_message(any_cmd("play"))
async def cmd_play(_: Client, msg: Message):
    if not msg.from_user:
        return
    if msg.chat.type not in ("group", "supergroup"):
        return await msg.reply("❌ Yeh command sirf group me chalta hai.")
    if len(msg.command) < 2:
        return await msg.reply("ℹ️ Usage: `/play <song name ya YouTube link>`")

    await _join_assistant_to_chat(msg.chat)
    query = " ".join(msg.command[1:])
    status = await msg.reply("🔍 Dhoondh raha hoon...")

    try:
        song = await extract(query)
    except Exception as e:
        return await status.edit(f"❌ Fetch nahi ho paaya: `{e}`")

    track = Track(
        title=song.title,
        url=song.url,
        stream_url=song.stream_url,
        duration=song.duration,
        requester=msg.from_user.id,
        requester_name=msg.from_user.first_name,
        thumb=song.thumb,
    )
    state = get_state(msg.chat.id)
    was_playing = state.playing and state.current is not None
    state.queue.append(track)

    if not was_playing:
        await status.edit("▶️ Chala raha hoon...")
        try:
            await _play_next(msg.chat.id)
        except NoActiveGroupCall:
            return await status.edit(
                "❌ Is group me **voice chat start nahi hai**.\n"
                "Pehle group me voice chat shuru karo, phir `/play` use karo."
            )
        except Exception as e:
            return await status.edit(f"❌ Play nahi ho paaya: `{e}`")
        text = (
            f"🎶 **Ab chala raha hoon:**\n"
            f"[{track.title}]({track.url})\n"
            f"⏱ `{track.duration}` • 👤 {track.requester_name}"
        )
        await status.edit(text, reply_markup=now_playing_kbd(track.url))
    else:
        pos = len(state.queue)
        await status.edit(
            f"✅ Queue me add #{pos}:\n[{track.title}]({track.url})\n"
            f"⏱ `{track.duration}` • 👤 {track.requester_name}"
        )


@app_bot.on_message(any_cmd("skip"))
async def cmd_skip(_: Client, msg: Message):
    state = get_state(msg.chat.id)
    if not state.current:
        return await msg.reply("❌ Kuch chal nahi raha.")
    state.loop = False
    try:
        await _play_next(msg.chat.id)
        await msg.reply("⏭ Skip kar diya.")
    except Exception as e:
        await msg.reply(f"❌ Skip nahi ho paaya: `{e}`")


@app_bot.on_message(any_cmd("pause"))
async def cmd_pause(_: Client, msg: Message):
    state = get_state(msg.chat.id)
    if not state.playing:
        return await msg.reply("❌ Pehle se paused hai ya chalu nahi.")
    try:
        await pytgcalls.pause_stream(msg.chat.id)
        state.playing = False
        await msg.reply("⏸ Pause kar diya.")
    except Exception as e:
        await msg.reply(f"❌: `{e}`")


@app_bot.on_message(any_cmd("resume"))
async def cmd_resume(_: Client, msg: Message):
    state = get_state(msg.chat.id)
    if state.playing:
        return await msg.reply("❌ Pehle se chalu hai.")
    try:
        await pytgcalls.resume_stream(msg.chat.id)
        state.playing = True
        await msg.reply("▶️ Resume kar diya.")
    except Exception as e:
        await msg.reply(f"❌: `{e}`")


@app_bot.on_message(any_cmd("stop"))
async def cmd_stop(_: Client, msg: Message):
    reset_queue(msg.chat.id)
    try:
        await pytgcalls.leave_group_call(msg.chat.id)
    except Exception:
        pass
    await msg.reply("⏹ Stop kar diya, queue saaf.")


@app_bot.on_message(any_cmd("queue"))
async def cmd_queue(_: Client, msg: Message):
    state = get_state(msg.chat.id)
    lines = []
    if state.current:
        lines.append(f"▶️ **Chal raha:** {state.current.title} ({state.current.duration})")
    if state.queue:
        for i, t in enumerate(state.queue, 1):
            lines.append(f"{i}. {t.title} ({t.duration}) — {t.requester_name}")
    if not lines:
        return await msg.reply("📭 Queue khali hai.")
    await msg.reply("\n".join(lines), disable_web_page_preview=True)


@app_bot.on_message(owner_cmd("loop"))
async def cmd_loop(_: Client, msg: Message):
    state = get_state(msg.chat.id)
    if not state.current:
        return await msg.reply("❌ Kuch chal nahi raha.")
    state.loop = not state.loop
    await msg.reply(f"🔁 Loop {'ON ✅' if state.loop else 'OFF ❌'}")


@app_bot.on_message(owner_cmd("leave"))
async def cmd_leave(_: Client, msg: Message):
    reset_queue(msg.chat.id)
    try:
        await pytgcalls.leave_group_call(msg.chat.id)
        await msg.reply("👋 Voice chat se nikal gaya.")
    except Exception as e:
        await msg.reply(f"❌: `{e}`")


@app_bot.on_message(owner_cmd("restart"))
async def cmd_restart(_: Client, msg: Message):
    await msg.reply("🔄 Restart ho raha hoon...")
    os.execv(sys.executable, [sys.executable, "main.py"] + sys.argv)


# -------- callback buttons --------

@app_bot.on_callback_query()
async def on_cb(_: Client, cb: CallbackQuery):
    if not cb.message or not cb.from_user:
        return
    chat_id = cb.message.chat.id
    state = get_state(chat_id)
    data = cb.data

    if data == "cb_pause":
        if state.playing:
            try:
                await pytgcalls.pause_stream(chat_id)
                state.playing = False
                await cb.answer("⏸ Paused")
            except Exception as e:
                await cb.answer(f"Error: {e}", show_alert=True)
        else:
            await cb.answer("Already paused")
    elif data == "cb_resume":
        if not state.playing and state.current:
            try:
                await pytgcalls.resume_stream(chat_id)
                state.playing = True
                await cb.answer("▶️ Resumed")
            except Exception as e:
                await cb.answer(f"Error: {e}", show_alert=True)
        else:
            await cb.answer("Already playing")
    elif data == "cb_skip":
        state.loop = False
        try:
            await _play_next(chat_id)
            await cb.answer("⏭ Skipped")
        except Exception as e:
            await cb.answer(f"Error: {e}", show_alert=True)
    elif data == "cb_stop":
        reset_queue(chat_id)
        try:
            await pytgcalls.leave_group_call(chat_id)
            await cb.answer("⏹ Stopped")
        except Exception as e:
            await cb.answer(f"Error: {e}", show_alert=True)


# -------- pytgcalls event: stream ended --------

@pytgcalls.on_stream_end()
async def on_stream_end(_, update):
    chat_id = update.chat_id
    try:
        await _play_next(chat_id)
    except Exception:
        pass


# -------- main --------

async def main():
    missing = []
    if not config.API_ID: missing.append("API_ID")
    if not config.API_HASH: missing.append("API_HASH")
    if not config.BOT_TOKEN: missing.append("BOT_TOKEN")
    if not config.SESSION_STRING: missing.append("SESSION_STRING")
    if missing:
        print(f"❌ .env me missing: {', '.join(missing)}")
        sys.exit(1)

    print("🔑 Starting bot...")
    await app_bot.start()
    print("👤 Starting assistant...")
    await pytgcalls.start()
    me = await app_bot.get_me()
    print(f"✅ VVIP MUSIC BOT live: @{me.username} (id={me.id})")

    def _stop(*_):
        print("\n🛑 Stopping...")
        asyncio.create_task(app_bot.stop())
        asyncio.create_task(app_assistant.stop())
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, _stop)
        except (ValueError, OSError):
            pass

    await idle()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
