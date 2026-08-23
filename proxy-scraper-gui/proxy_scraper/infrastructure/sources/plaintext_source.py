"""Plaintext-list proxy source adapter.

Parses sources that return a newline-delimited list of ``host:port`` (optionally
scheme-prefixed) entries. Works with popular public raw lists and the
ProxyScrape plaintext API.

The adapter never raises: any HTTP or parse error results in an empty list
(Requirement 1.5, 14.3).
"""

from __future__ import annotations

import logging

from proxy_scraper.domain.interfaces import HttpClient
from proxy_scraper.domain.models import ProxyCandidate, ProxyProtocol
from proxy_scraper.infrastructure.sources.base import parse_host_port_lines

logger = logging.getLogger(__name__)


class PlaintextListSource:
    """Fetches proxies from a plaintext ``host:port`` list."""

    def __init__(
        self,
        url: str,
        name: str,
        default_protocol: ProxyProtocol = ProxyProtocol.HTTP,
    ) -> None:
        self.url = url
        self.name = name
        self._default_protocol = default_protocol

    async def fetch(self, client: HttpClient) -> list[ProxyCandidate]:
        try:
            response = await client.get(self.url)
        except Exception as exc:  # noqa: BLE001 - adapters must not raise
            logger.warning("PlaintextListSource %s fetch failed: %s", self.name, exc)
            return []

        if not response.ok or not response.body:
            logger.warning(
                "PlaintextListSource %s returned status %s", self.name, response.status
            )
            return []

        try:
            return parse_host_port_lines(
                response.body, self._default_protocol, self.name
            )
        except Exception as exc:  # noqa: BLE001 - parsing must not raise
            logger.warning("PlaintextListSource %s parse failed: %s", self.name, exc)
            return []
