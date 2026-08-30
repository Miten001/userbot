"""Core domain models, enums and their validation rules.

This module is the foundation of the whole application. It contains no I/O and
no framework dependencies so it can be imported and unit-tested in isolation.

Design references:
* Model 1: ProxyCandidate
* Model 2: ProxyResult
* Model 3: ProxyFilter
* Model 4: ScrapeProgress / SourceReport / ScrapeOutcome / ExportOutcome / GeoInfo
"""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ProxyProtocol(Enum):
    """Supported proxy protocols (Requirement 3.4, 17.3)."""

    HTTP = "http"
    HTTPS = "https"
    SOCKS4 = "socks4"
    SOCKS5 = "socks5"

    @classmethod
    def from_str(cls, value: str) -> Optional["ProxyProtocol"]:
        """Parse a protocol from a free-form string, returning ``None`` if
        the value is not one of the supported protocols."""
        if not value:
            return None
        normalized = value.strip().lower()
        # Common aliases seen in the wild.
        aliases = {
            "http": cls.HTTP,
            "https": cls.HTTPS,
            "ssl": cls.HTTPS,
            "tls": cls.HTTPS,
            "socks": cls.SOCKS5,
            "socks4": cls.SOCKS4,
            "socks4a": cls.SOCKS4,
            "socks5": cls.SOCKS5,
            "socks5h": cls.SOCKS5,
        }
        return aliases.get(normalized)


# Backwards/design-compatible alias. The design document names this enum
# ``Protocol``; we expose it under that name too while keeping the more
# descriptive ``ProxyProtocol`` as the canonical name (avoids clashing with
# ``typing.Protocol`` used in the interfaces module).
Protocol = ProxyProtocol


class AnonymityLevel(Enum):
    """How much a proxy reveals about the client (Requirement 4)."""

    TRANSPARENT = "transparent"  # reveals your real IP
    ANONYMOUS = "anonymous"      # hides IP but reveals it is a proxy
    ELITE = "elite"              # hides IP and that it is a proxy
    UNKNOWN = "unknown"          # could not be determined


class AnonymityFilter(Enum):
    """Minimum anonymity level a proxy must reach to qualify as premium.

    Ordered from least to most restrictive. The default is ``ELITE_ONLY``
    because the primary use case is proxies where the destination site cannot
    detect that a proxy is being used at all (Requirement 7.3-7.6, 8.5-8.7).

    Semantics (evaluated against :class:`AnonymityLevel`):
    * ``ANY``                 -- no anonymity restriction; every level qualifies.
    * ``ANONYMOUS_OR_BETTER`` -- exclude ``TRANSPARENT`` only (the prior
      ``require_anonymous == True`` behaviour); ``ANONYMOUS`` and ``ELITE`` pass.
    * ``ELITE_ONLY``          -- require ``ELITE`` (the site cannot tell a proxy
      is in use at all).
    """

    ANY = "any"                                   # no anonymity restriction
    ANONYMOUS_OR_BETTER = "anonymous_or_better"   # exclude TRANSPARENT only
    ELITE_ONLY = "elite_only"                     # require ELITE


class ExportFormat(Enum):
    """Supported export formats (Requirement 13.1)."""

    CSV = "csv"
    TXT = "txt"
    JSON = "json"

    @classmethod
    def from_str(cls, value: str) -> Optional["ExportFormat"]:
        if not value:
            return None
        try:
            return cls(value.strip().lower())
        except ValueError:
            return None


# Sentinel used when a country cannot be resolved (Requirement 5.4).
UNKNOWN_COUNTRY_CODE = "??"
UNKNOWN_COUNTRY_NAME = "Unknown"

# Filter value meaning "any / random country" (Requirement 6.3).
ANY_COUNTRY = "ANY"

# Default latency threshold in milliseconds (Requirement 8.4).
DEFAULT_MAX_LATENCY_MS = 5000


# ---------------------------------------------------------------------------
# Host / port / country validation helpers (Requirement 17)
# ---------------------------------------------------------------------------

# RFC 1123 hostname label validation (each label 1-63 chars, letters/digits/-).
_HOSTNAME_LABEL_RE = re.compile(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$")
_ISO_ALPHA2_RE = re.compile(r"^[A-Za-z]{2}$")


def is_valid_host(host: str) -> bool:
    """Return ``True`` if *host* is a syntactically valid IP address or
    hostname (Requirement 17.1)."""
    if not host or not isinstance(host, str):
        return False
    host = host.strip()
    if not host:
        return False

    # Try IP address first (covers IPv4 and IPv6).
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass

    # Otherwise validate as a hostname.
    if len(host) > 253:
        return False
    # A trailing dot is allowed in FQDNs.
    if host.endswith("."):
        host = host[:-1]
    labels = host.split(".")
    if not labels:
        return False
    return all(_HOSTNAME_LABEL_RE.match(label) for label in labels)


def is_valid_port(port: object) -> bool:
    """Return ``True`` if *port* is an integer in the range 1..65535
    (Requirement 17.2)."""
    # Bool is a subclass of int - reject it explicitly.
    if isinstance(port, bool):
        return False
    if isinstance(port, int):
        return 1 <= port <= 65535
    if isinstance(port, str) and port.strip().isdigit():
        return 1 <= int(port.strip()) <= 65535
    return False


def is_valid_country_code(code: str) -> bool:
    """A 2-letter ISO 3166-1 alpha-2 code, or the ``"??"`` sentinel."""
    if code == UNKNOWN_COUNTRY_CODE:
        return True
    return bool(code) and bool(_ISO_ALPHA2_RE.match(code))


# ---------------------------------------------------------------------------
# Model 1: ProxyCandidate
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProxyCandidate:
    """A raw, unvalidated proxy parsed from a source.

    Identity for deduplication is ``(host, port, protocol)``.
    """

    host: str
    port: int
    protocol: ProxyProtocol
    source: str = ""

    @property
    def key(self) -> tuple[str, int, ProxyProtocol]:
        """The identity key used for deduplication (Requirement 2.1)."""
        return (self.host, self.port, self.protocol)

    @property
    def address(self) -> str:
        """Convenience ``host:port`` representation."""
        return f"{self.host}:{self.port}"


def make_candidate(
    host: object,
    port: object,
    protocol: object,
    source: str = "",
) -> Optional[ProxyCandidate]:
    """Factory that validates raw input and returns a :class:`ProxyCandidate`,
    or ``None`` when any validation rule fails (Requirement 17.1-17.4).

    Accepts loose input (strings, aliases) from source adapters and normalizes
    it. This is the single choke point that guarantees no malformed candidate
    ever reaches a connection attempt (Requirement 17.4).
    """
    # --- host ---
    if not isinstance(host, str):
        return None
    host = host.strip()
    if not is_valid_host(host):
        return None

    # --- port ---
    if isinstance(port, bool):
        return None
    if isinstance(port, str):
        port_str = port.strip()
        if not port_str.isdigit():
            return None
        port = int(port_str)
    if not isinstance(port, int) or not is_valid_port(port):
        return None

    # --- protocol ---
    if isinstance(protocol, ProxyProtocol):
        proto = protocol
    elif isinstance(protocol, str):
        proto = ProxyProtocol.from_str(protocol)
    else:
        proto = None
    if proto is None:
        return None

    return ProxyCandidate(host=host, port=int(port), protocol=proto, source=source)


# ---------------------------------------------------------------------------
# Model: GeoInfo
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class GeoInfo:
    """Result of geolocating an IP address (Requirement 5)."""

    country_code: str = UNKNOWN_COUNTRY_CODE
    country_name: str = UNKNOWN_COUNTRY_NAME

    @classmethod
    def unknown(cls) -> "GeoInfo":
        return cls(UNKNOWN_COUNTRY_CODE, UNKNOWN_COUNTRY_NAME)

    @property
    def is_unknown(self) -> bool:
        return self.country_code == UNKNOWN_COUNTRY_CODE


# ---------------------------------------------------------------------------
# Model 2: ProxyResult
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProxyResult:
    """A candidate after validation, including quality metadata.

    Invariants (enforced in ``__post_init__``):
    * ``alive is False``  => ``latency_ms is None``
    * ``alive is True``   => ``latency_ms`` is an ``int`` >= 0
    * ``country_code`` is a 2-letter code or the ``"??"`` sentinel.
    """

    candidate: ProxyCandidate
    alive: bool
    latency_ms: Optional[int]
    country_code: str = UNKNOWN_COUNTRY_CODE
    country_name: str = UNKNOWN_COUNTRY_NAME
    anonymity: AnonymityLevel = AnonymityLevel.UNKNOWN
    checked_at: float = 0.0

    def __post_init__(self) -> None:
        # Latency consistency invariant (Requirement 3.5, 3.6 / Property 5).
        if self.alive:
            if not isinstance(self.latency_ms, int) or isinstance(self.latency_ms, bool):
                raise ValueError("alive result must have an integer latency_ms")
            if self.latency_ms < 0:
                raise ValueError("alive result must have latency_ms >= 0")
        else:
            if self.latency_ms is not None:
                raise ValueError("dead result must have latency_ms == None")

        # Country code invariant (Requirement 5.1, 5.4).
        if not is_valid_country_code(self.country_code):
            raise ValueError(f"invalid country_code: {self.country_code!r}")

    # Convenience accessors used by the UI / export layers -------------------

    @property
    def host(self) -> str:
        return self.candidate.host

    @property
    def port(self) -> int:
        return self.candidate.port

    @property
    def protocol(self) -> ProxyProtocol:
        return self.candidate.protocol

    @property
    def address(self) -> str:
        return self.candidate.address


def make_dead_result(
    candidate: ProxyCandidate,
    *,
    checked_at: float = 0.0,
    anonymity: AnonymityLevel = AnonymityLevel.UNKNOWN,
) -> ProxyResult:
    """Helper to build a not-alive result with correct invariants."""
    return ProxyResult(
        candidate=candidate,
        alive=False,
        latency_ms=None,
        country_code=UNKNOWN_COUNTRY_CODE,
        country_name=UNKNOWN_COUNTRY_NAME,
        anonymity=anonymity,
        checked_at=checked_at,
    )


# ---------------------------------------------------------------------------
# Model 3: ProxyFilter
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProxyFilter:
    """The user's active selection driving scraping / validation display.

    Validation rules (Requirement 8):
    * ``country_code`` is ``None``, ``"ANY"`` or a valid ISO alpha-2 code.
    * ``protocols`` is non-empty.
    * ``max_latency_ms`` is a positive integer.
    """

    country_code: Optional[str] = None
    protocols: frozenset[ProxyProtocol] = field(
        default_factory=lambda: frozenset(ProxyProtocol)
    )
    max_latency_ms: int = DEFAULT_MAX_LATENCY_MS
    # Default to ELITE_ONLY: by default only proxies the destination site
    # cannot detect are considered premium (Requirement 7.6, 8.6).
    min_anonymity: AnonymityFilter = AnonymityFilter.ELITE_ONLY

    @property
    def wants_specific_country(self) -> bool:
        """True when a concrete country code is selected (not any/random)."""
        return (
            self.country_code is not None
            and self.country_code.upper() != ANY_COUNTRY
        )

    @property
    def normalized_country(self) -> Optional[str]:
        """Uppercased country code, or ``None`` for any/random."""
        if not self.wants_specific_country:
            return None
        assert self.country_code is not None
        return self.country_code.upper()


# ---------------------------------------------------------------------------
# Model 4: progress / reporting / outcome value objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ScrapeProgress:
    """Progress update emitted during a run (Requirement 11.1)."""

    phase: str  # "scraping" | "validating"
    completed: int
    total: int
    message: str = ""

    @property
    def fraction(self) -> float:
        if self.total <= 0:
            return 0.0
        return max(0.0, min(1.0, self.completed / self.total))


@dataclass(frozen=True)
class SourceReport:
    """Per-source outcome of a scrape (Requirement 1.4, 1.5)."""

    source: str
    found: int
    error: Optional[str] = None

    @property
    def succeeded(self) -> bool:
        return self.error is None


@dataclass(frozen=True)
class ScrapeOutcome:
    """Aggregate result of scraping all sources (Requirement 1.4)."""

    candidates: list[ProxyCandidate]
    reports: list[SourceReport]

    @property
    def succeeded_count(self) -> int:
        return sum(1 for r in self.reports if r.succeeded)

    @property
    def failed_count(self) -> int:
        return sum(1 for r in self.reports if not r.succeeded)


@dataclass(frozen=True)
class ExportOutcome:
    """Result of an export operation (Requirement 13.4, 13.6)."""

    success: bool
    records_written: int
    path: str
    error: Optional[str] = None



# ---------------------------------------------------------------------------
# Model 5: SeenProxy
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeenProxy:
    """A single entry in the persistent cross-session seen-proxy history.

    Identity is the **host (IP)** alone -- NOT ``(host, port, protocol)`` --
    because the requirement is that a given IP is never surfaced twice
    regardless of the port or protocol it appears on (Model 5, Requirement
    19.1).

    Invariants (enforced in ``__post_init__``):
    * ``host`` is a non-empty, syntactically valid IP/host (same rule as
      :class:`ProxyCandidate.host`).
    * ``first_seen`` is a non-negative epoch timestamp.
    """

    host: str
    first_seen: float

    def __post_init__(self) -> None:
        if not isinstance(self.host, str) or not is_valid_host(self.host):
            raise ValueError(f"invalid seen-proxy host: {self.host!r}")
        if isinstance(self.first_seen, bool) or not isinstance(
            self.first_seen, (int, float)
        ):
            raise ValueError("first_seen must be a numeric epoch timestamp")
        if self.first_seen < 0:
            raise ValueError("first_seen must be a non-negative epoch timestamp")
