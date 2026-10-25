"""Per-chat queue + current-track state (named song_queue to avoid stdlib clash)."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Track:
    title: str
    url: str
    stream_url: str
    duration: str
    requester: int
    requester_name: str
    thumb: Optional[str] = None


@dataclass
class ChatState:
    queue: list[Track] = field(default_factory=list)
    current: Optional[Track] = None
    playing: bool = False
    loop: bool = False


_states: dict[int, ChatState] = {}


def get(chat_id: int) -> ChatState:
    if chat_id not in _states:
        _states[chat_id] = ChatState()
    return _states[chat_id]


def reset(chat_id: int) -> None:
    _states[chat_id] = ChatState()
