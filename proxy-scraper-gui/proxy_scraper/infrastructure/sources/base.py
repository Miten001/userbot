"""Shared helpers for proxy source adapters."""

from __future__ import annotations

import logging
import re
from typing import Iterable, Optional

from proxy_scraper.domain.models import ProxyCandidate, ProxyProtocol, make_candidate

logger = logging.getLogger(__name__)

# Matches ``host:port`` optionally prefixed with a scheme, e.g.
# ``socks5://1.2.3.4:1080`` or ``1.2.3.4:8080``.
_HOSTPORT_RE = re.compile(
    r"(?:(?P<scheme>https?|socks4|socks5)://)?"
    r"(?P<host>[A-Za-z0-9.\-:]+?):(?P<port>\d{1,5})"
)


def parse_host_port_line(
    line: str,
    default_protocol: ProxyProtocol,
    source_name: str,
) -> Optional[ProxyCandidate]:
    """Parse a single ``host:port`` (optionally scheme-prefixed) line into a
    validated :class:`ProxyCandidate`, or ``None`` when it is malformed."""
    if not line:
        return None
    match = _HOSTPORT_RE.search(line.strip())
    if not match:
        return None
    scheme = match.group("scheme")
    protocol = ProxyProtocol.from_str(scheme) if scheme else default_protocol
    if protocol is None:
        protocol = default_protocol
    # ``make_candidate`` performs full host/port/protocol validation and
    # returns None on any failure (Requirement 17).
    return make_candidate(
        host=match.group("host"),
        port=match.group("port"),
        protocol=protocol,
        source=source_name,
    )


def parse_host_port_lines(
    text: str,
    default_protocol: ProxyProtocol,
    source_name: str,
) -> list[ProxyCandidate]:
    """Parse a plaintext blob of ``host:port`` lines into candidates."""
    out: list[ProxyCandidate] = []
    for raw in text.splitlines():
        candidate = parse_host_port_line(raw, default_protocol, source_name)
        if candidate is not None:
            out.append(candidate)
    return out


def dedupe_in_order(candidates: Iterable[ProxyCandidate]) -> list[ProxyCandidate]:
    """Remove duplicate keys while preserving order (local convenience)."""
    seen: set = set()
    result: list[ProxyCandidate] = []
    for c in candidates:
        if c.key not in seen:
            seen.add(c.key)
            result.append(c)
    return result
