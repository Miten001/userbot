"""HTML-table proxy source adapter (BeautifulSoup + lxml).

Parses free-proxy-list style pages that render proxies as an HTML ``<table>``
with columns for IP, port, country code, anonymity and an HTTPS flag.

Default target: https://free-proxy-list.net/ (public, free).

The adapter never raises: any HTTP or parse error results in an empty list
(Requirement 1.5, 14.3). Every parsed row is routed through ``make_candidate``
so malformed entries are discarded before any connection attempt.
"""

from __future__ import annotations

import logging
from typing import Optional

from proxy_scraper.domain.interfaces import HttpClient
from proxy_scraper.domain.models import ProxyCandidate, ProxyProtocol, make_candidate

logger = logging.getLogger(__name__)


class HtmlTableSource:
    """Fetches proxies from an HTML table page."""

    def __init__(
        self,
        url: str = "https://free-proxy-list.net/",
        name: str = "free-proxy-list.net",
        default_protocol: ProxyProtocol = ProxyProtocol.HTTP,
    ) -> None:
        self.url = url
        self.name = name
        self._default_protocol = default_protocol

    async def fetch(self, client: HttpClient) -> list[ProxyCandidate]:
        try:
            response = await client.get(self.url)
        except Exception as exc:  # noqa: BLE001 - adapters must not raise
            logger.warning("HtmlTableSource %s fetch failed: %s", self.name, exc)
            return []

        if not response.ok or not response.body:
            logger.warning(
                "HtmlTableSource %s returned status %s", self.name, response.status
            )
            return []

        try:
            return self._parse(response.body)
        except Exception as exc:  # noqa: BLE001 - parsing must not raise
            logger.warning("HtmlTableSource %s parse failed: %s", self.name, exc)
            return []

    def _parse(self, html: str) -> list[ProxyCandidate]:
        from bs4 import BeautifulSoup  # lazy import

        # ``lxml`` is preferred; fall back to the stdlib parser if unavailable.
        try:
            soup = BeautifulSoup(html, "lxml")
        except Exception:  # noqa: BLE001
            soup = BeautifulSoup(html, "html.parser")

        candidates: list[ProxyCandidate] = []
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = [c.get_text(strip=True) for c in row.find_all("td")]
                candidate = self._parse_row(cells)
                if candidate is not None:
                    candidates.append(candidate)
        return candidates

    def _parse_row(self, cells: list[str]) -> Optional[ProxyCandidate]:
        # Expected free-proxy-list layout:
        # [IP, Port, Code, Country, Anonymity, Google, Https, LastChecked]
        if len(cells) < 2:
            return None
        host = cells[0]
        port = cells[1]

        protocol = self._default_protocol
        # Column 6 ("Https") is "yes"/"no" on free-proxy-list.
        if len(cells) >= 7:
            https_flag = cells[6].strip().lower()
            if https_flag == "yes":
                protocol = ProxyProtocol.HTTPS
            else:
                protocol = ProxyProtocol.HTTP

        return make_candidate(host=host, port=port, protocol=protocol, source=self.name)
