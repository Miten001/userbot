"""Inline keyboard helpers."""
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def now_playing_kbd(track_url: str):
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("▶️", callback_data="cb_resume"),
            InlineKeyboardButton("⏸", callback_data="cb_pause"),
            InlineKeyboardButton("⏭", callback_data="cb_skip"),
            InlineKeyboardButton("⏹", callback_data="cb_stop"),
        ],
        [InlineKeyboardButton("🔗 Song Link", url=track_url)],
    ])
