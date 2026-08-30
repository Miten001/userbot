"""Domain service interfaces (contracts).

These ``typing.Protocol`` definitions establish the contracts that the
concrete infrastructure and domain components implement against. Declaring
them separately keeps the layers decoupled and makes the components easy to
substitute (real vs. mock) in tests.

Design references: Components 1-6.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Awaitable, Callable, Iterable, Optional, Protocol, runtime_checkable

from proxy_scraper.domain.models import (
    ExportFormat,
    ExportOutcome,
    GeoInfo,
    ProxyCandidate,
    ProxyFilter,
    ProxyResult,
    ScrapeOutcome,
    ScrapeProgress,
)


# ---------------------------------------------------------------------------
# Configuration value objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ValidationConfig:
    """Tunable parameters for the ValidationEngine."""

    judge_url: str = "http://httpbin.org/get"
    https_judge_url: str = "https://httpbin.org/get"
    timeout_seconds: float = 8.0
    retries: int = 1
    max_latency_ms: int = 5000


@dataclass(frozen=True)
class HttpResponse:
    """A minimal, framework-agnostic HTTP response returned by the client."""

    status: int
    headers: dict[str, str]
    body: str
    latency_ms: int

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 400


# ---------------------------------------------------------------------------
# Infrastructure contract: HTTP client
# ---------------------------------------------------------------------------


@runtime_checkable
class HttpClient(Protocol):
    """Async HTTP client abstraction used by sources and the validator."""

    async def get(
        self,
        url: str,
        *,
        proxy: Optional[ProxyCandidate] = None,
        timeout: Optional[float] = None,
    ) -> HttpResponse:
        """Issue a GET request, optionally routed *through* a proxy.

        Must attach no cookies/tokens/personal data (Requirement 18.2).
        Raises on network failure so callers can time / classify it.
        """
        ...


# ---------------------------------------------------------------------------
# Domain contract: proxy sources
# ---------------------------------------------------------------------------


@runtime_checkable
class ProxySource(Protocol):
    """A pluggable adapter that fetches proxy candidates from one source."""

    name: str

    async def fetch(self, client: HttpClient) -> list[ProxyCandidate]:
        """Return raw candidates parsed from this source.

        MUST NOT raise: return ``[]`` on any failure (Requirement 14.3). The
        ScraperManager records the error in the SourceReport separately.
        """
        ...


# ---------------------------------------------------------------------------
# Domain contract: scraper manager
# ---------------------------------------------------------------------------


@runtime_checkable
class ScraperManager(Protocol):
    def register(self, source: ProxySource) -> None:
        ...

    async def scrape_all(
        self,
        client: HttpClient,
        *,
        progress: Optional[Callable[[ScrapeProgress], None]] = None,
        is_cancelled: Optional[Callable[[], bool]] = None,
    ) -> ScrapeOutcome:
        """Fetch from all sources concurrently, dedupe, and return candidates
        plus a per-source report (Requirement 1)."""
        ...


# ---------------------------------------------------------------------------
# Domain contract: validation engine
# ---------------------------------------------------------------------------


@runtime_checkable
class ValidationEngine(Protocol):
    async def check(
        self,
        candidate: ProxyCandidate,
        cfg: ValidationConfig,
    ) -> ProxyResult:
        """Attempt a timed judge request through the proxy, classify anonymity,
        measure latency, and mark alive/dead. Never raises (Requirement 14.4)."""
        ...


# ---------------------------------------------------------------------------
# Domain contract: geolocation service
# ---------------------------------------------------------------------------


@runtime_checkable
class GeoLocationService(Protocol):
    async def locate(self, ip: str) -> GeoInfo:
        """Resolve country code/name for an IP (Requirement 5). Never raises."""
        ...


# ---------------------------------------------------------------------------
# Domain contract: export service
# ---------------------------------------------------------------------------


@runtime_checkable
class ExportService(Protocol):
    def export(
        self,
        results: list[ProxyResult],
        fmt: ExportFormat,
        path: str,
    ) -> ExportOutcome:
        """Write results to disk (Requirement 13). Never raises; failures are
        reported via ``ExportOutcome.success == False``."""
        ...


# ---------------------------------------------------------------------------
# Domain contract: persistent seen-proxy store (Component 7)
# ---------------------------------------------------------------------------


@runtime_checkable
class SeenProxyStore(Protocol):
    """A persistent, cross-session record of the host (IP) of every proxy that
    has actually been surfaced to the user, so those IPs are never surfaced
    again on any future run (Component 7, Requirement 19).

    Contract:
    * Identity is keyed by **host (IP) only** -- not ``(host, port, protocol)``.
    * :meth:`load` MUST never raise on a missing/corrupt file; it initializes
      to an empty history instead (Error Scenario 7, Requirement 19.5).
    * :meth:`save` MUST persist atomically (write-temp + rename) so a
      crash/close cannot corrupt or lose the file.
    * :meth:`contains` is O(1) (backed by an in-memory set/dict).
    """

    def load(self) -> None:
        """Read the persisted history from disk into memory. On a missing or
        corrupt file, initialize to an empty history and never raise
        (Error Scenario 7, Requirement 19.5)."""
        ...

    def contains(self, host: str) -> bool:
        """True if *host* (IP) has been surfaced on this or any previous run
        (Requirement 19.2)."""
        ...

    def add(self, host: str) -> bool:
        """Record *host* as surfaced. Returns ``True`` if it was newly added,
        ``False`` if it was already present. Idempotent per host
        (Requirement 19.1)."""
        ...

    def add_many(self, hosts: Iterable[str]) -> int:
        """Record several hosts at once; returns the count newly added."""
        ...

    def save(self) -> None:
        """Persist the current history to disk atomically (write-temp +
        rename) so a crash/close cannot corrupt or lose the file
        (Requirement 19.1, write safety of Error Scenario 7)."""
        ...

    def clear(self) -> None:
        """Empty the history in memory and on disk (used by the UI
        'Clear seen history' action, Requirement 19.4)."""
        ...

    def __len__(self) -> int:
        """Number of distinct hosts remembered (for status/UI display)."""
        ...


# ---------------------------------------------------------------------------
# Callback type aliases used by the application layer
# ---------------------------------------------------------------------------

ProgressCallback = Callable[[ScrapeProgress], None]
ResultCallback = Callable[[ProxyResult], None]
