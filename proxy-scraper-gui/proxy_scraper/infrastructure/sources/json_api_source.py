"""JSON-API proxy source adapter.

Parses sources that expose proxies as JSON. The default configuration targets
the Geonode free proxy list API, whose payload looks like::

    {"data": [{"ip": "1.2.3.4", "port": "8080", "protocols": ["http"], ...}]}

The adapter is configurable via a small extraction spec so it can adapt to
other JSON shapes without code changes. It never raises: any HTTP or parse
error yields an empty list (Requirement 1.5, 14.3).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from proxy_scraper.domain.interfaces import HttpClient
from proxy_scraper.domain.models import ProxyCandidate, ProxyProtocol, make_candidate

logger = logging.getLogger(__name__)


class JsonApiSource:
    """Fetches proxies from a JSON API endpoint."""

    def __init__(
        self,
        url: str = (
            "https://proxylist.geonode.com/api/proxy-list"
            "?limit=500&page=1&sort_by=lastChecked&sort_type=desc"
        ),
        name: str = "geonode.com",
        *,
        records_key: Optional[str] = "data",
        host_key: str = "ip",
        port_key: str = "port",
        protocols_key: str = "protocols",
        default_protocol: ProxyProtocol = ProxyProtocol.HTTP,
    ) -> None:
        self.url = url
        self.name = name
        self._records_key = records_key
        self._host_key = host_key
        self._port_key = port_key
        self._protocols_key = protocols_key
        self._default_protocol = default_protocol

    async def fetch(self, client: HttpClient) -> list[ProxyCandidate]:
        try:
            response = await client.get(self.url)
        except Exception as exc:  # noqa: BLE001 - adapters must not raise
            logger.warning("JsonApiSource %s fetch failed: %s", self.name, exc)
            return []

        if not response.ok or not response.body:
            logger.warning(
                "JsonApiSource %s returned status %s", self.name, response.status
            )
            return []

        try:
            payload = json.loads(response.body)
            return self._parse(payload)
        except Exception as exc:  # noqa: BLE001 - parsing must not raise
            logger.warning("JsonApiSource %s parse failed: %s", self.name, exc)
            return []

    def _parse(self, payload: Any) -> list[ProxyCandidate]:
        records = self._extract_records(payload)
        candidates: list[ProxyCandidate] = []
        for record in records:
            candidate = self._parse_record(record)
            if candidate is not None:
                candidates.append(candidate)
        return candidates

    def _extract_records(self, payload: Any) -> list[dict]:
        if self._records_key and isinstance(payload, dict):
            records = payload.get(self._records_key, [])
        else:
            records = payload
        if not isinstance(records, list):
            return []
        return [r for r in records if isinstance(r, dict)]

    def _parse_record(self, record: dict) -> Optional[ProxyCandidate]:
        host = record.get(self._host_key)
        port = record.get(self._port_key)

        protocol = self._default_protocol
        raw_protocols = record.get(self._protocols_key)
        if isinstance(raw_protocols, list) and raw_protocols:
            parsed = ProxyProtocol.from_str(str(raw_protocols[0]))
            if parsed is not None:
                protocol = parsed
        elif isinstance(raw_protocols, str):
            parsed = ProxyProtocol.from_str(raw_protocols)
            if parsed is not None:
                protocol = parsed

        return make_candidate(host=host, port=port, protocol=protocol, source=self.name)
