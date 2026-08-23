"""Test doubles: an in-memory HTTP client and fake proxy sources."""

from __future__ import annotations

from typing import Optional

from proxy_scraper.domain.interfaces import HttpResponse
from proxy_scraper.domain.models import ProxyCandidate


class FakeHttpClient:
    """Returns a canned response for any URL, or raises to simulate failure."""

    def __init__(
        self,
        *,
        body: str = "",
        status: int = 200,
        headers: Optional[dict] = None,
        latency_ms: int = 42,
        raise_exc: Optional[Exception] = None,
        body_by_url: Optional[dict] = None,
    ) -> None:
        self._body = body
        self._status = status
        self._headers = headers or {}
        self._latency = latency_ms
        self._raise = raise_exc
        self._body_by_url = body_by_url or {}
        self.calls: list[tuple] = []

    async def get(self, url, *, proxy=None, timeout=None) -> HttpResponse:
        self.calls.append((url, proxy, timeout))
        if self._raise is not None:
            raise self._raise
        body = self._body
        for key, value in self._body_by_url.items():
            if key in url:
                body = value
                break
        return HttpResponse(
            status=self._status,
            headers=dict(self._headers),
            body=body,
            latency_ms=self._latency,
        )


class FakeSource:
    """A fake ProxySource returning fixed candidates, or raising on demand."""

    def __init__(self, name: str, candidates=None, *, raise_exc=None):
        self.name = name
        self._candidates = candidates or []
        self._raise = raise_exc

    async def fetch(self, client) -> list[ProxyCandidate]:
        if self._raise is not None:
            # Well-behaved adapters swallow errors; a misbehaving one raises to
            # prove the ScraperManager isolates it.
            raise self._raise
        return list(self._candidates)
