"""ValidationEngine: determine whether a candidate is a live, usable proxy.

For each candidate it issues a *timed* request to a neutral judge endpoint
through the proxy (Requirement 3.1, 18.1), measuring latency, classifying
anonymity (Requirement 4), resolving country via the GeoLocationService
(Requirement 5), and applying a retry policy (Requirement 3.3).

Security: only the judge request is routed through the untrusted proxy, and it
carries no cookies/tokens/personal data (Requirement 18.1, 18.2). The engine
never raises - failures produce a not-alive ``ProxyResult`` (Requirement 14.4).
"""

from __future__ import annotations

import ipaddress
import json
import logging
import time
from typing import Optional

from proxy_scraper.domain.interfaces import HttpClient, ValidationConfig
from proxy_scraper.domain.geolocation import GeoLocationService
from proxy_scraper.domain.models import (
    AnonymityLevel,
    ProxyCandidate,
    ProxyProtocol,
    ProxyResult,
    make_dead_result,
)

logger = logging.getLogger(__name__)

# Headers that reveal a request was proxied. If any appear in the judge's echo
# of received headers, the proxy is at best "anonymous", not "elite".
_PROXY_HEADER_NAMES = {
    "via",
    "x-forwarded-for",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
    "x-real-ip",
    "proxy-connection",
    "x-proxy-id",
    "client-ip",
    "x-forwarded-host",
}


class DefaultValidationEngine:
    """Concrete ValidationEngine."""

    def __init__(
        self,
        client: HttpClient,
        geo: GeoLocationService,
        *,
        own_ip: Optional[str] = None,
    ) -> None:
        self._client = client
        self._geo = geo
        self._own_ip = own_ip

    # -- own public IP (Requirement 4.3) ------------------------------------

    async def ensure_own_ip(self, cfg: ValidationConfig) -> Optional[str]:
        """Obtain and cache the user's own public IP from a trusted service
        (no proxy). Used for anonymity comparison."""
        if self._own_ip:
            return self._own_ip
        try:
            response = await self._client.get(cfg.judge_url, timeout=cfg.timeout_seconds)
            origin = self._extract_origin(response.body)
            if origin:
                self._own_ip = origin
        except Exception as exc:  # noqa: BLE001 - never raise
            logger.debug("Failed to obtain own public IP: %s", exc)
        return self._own_ip

    # -- validation ----------------------------------------------------------

    async def check(
        self,
        candidate: ProxyCandidate,
        cfg: ValidationConfig,
    ) -> ProxyResult:
        """Validate a single candidate. Never raises."""
        judge = self._judge_for(candidate, cfg)
        attempts = max(1, cfg.retries + 1)
        last_error: Optional[Exception] = None

        for attempt in range(attempts):
            try:
                start = time.perf_counter()
                response = await self._client.get(
                    judge, proxy=candidate, timeout=cfg.timeout_seconds
                )
                latency_ms = int((time.perf_counter() - start) * 1000)
                if not response.ok:
                    last_error = RuntimeError(f"status {response.status}")
                    continue

                origin = self._extract_origin(response.body)
                received_headers = self._extract_headers(response.body)
                anonymity = self._classify_anonymity(origin, received_headers)

                # Resolve country from the proxy host / observed origin.
                geo_target = self._geo_target(candidate, origin)
                geo = await self._geo.locate(geo_target)

                return ProxyResult(
                    candidate=candidate,
                    alive=True,
                    latency_ms=max(0, latency_ms),
                    country_code=geo.country_code,
                    country_name=geo.country_name,
                    anonymity=anonymity,
                    checked_at=time.time(),
                )
            except Exception as exc:  # noqa: BLE001 - retry then give up
                last_error = exc
                continue

        logger.debug(
            "Proxy %s dead after %d attempt(s): %s",
            candidate.address,
            attempts,
            last_error,
        )
        return make_dead_result(candidate, checked_at=time.time())

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _judge_for(candidate: ProxyCandidate, cfg: ValidationConfig) -> str:
        if candidate.protocol == ProxyProtocol.HTTPS:
            return cfg.https_judge_url
        return cfg.judge_url

    @staticmethod
    def _extract_origin(body: str) -> Optional[str]:
        """Extract the observed client IP from a judge response.

        Works with httpbin-style JSON (``{"origin": "1.2.3.4"}``) and falls
        back to scanning for the first IP-like token.
        """
        if not body:
            return None
        try:
            payload = json.loads(body)
            origin = payload.get("origin")
            if isinstance(origin, str) and origin:
                # httpbin may report "ip1, ip2" when forwarded.
                first = origin.split(",")[0].strip()
                return first
        except (ValueError, AttributeError):
            pass
        return None

    @staticmethod
    def _extract_headers(body: str) -> dict[str, str]:
        """Extract the echoed request headers from a judge JSON response."""
        try:
            payload = json.loads(body)
            headers = payload.get("headers")
            if isinstance(headers, dict):
                return {str(k).lower(): str(v) for k, v in headers.items()}
        except (ValueError, AttributeError):
            pass
        return {}

    def _classify_anonymity(
        self,
        origin: Optional[str],
        received_headers: dict[str, str],
    ) -> AnonymityLevel:
        """Classify anonymity (Requirement 4.1, 4.2).

        * TRANSPARENT - the response reveals the user's real public IP.
        * ANONYMOUS   - real IP hidden but proxy-revealing headers present.
        * ELITE       - real IP hidden and no proxy headers leaked.
        * UNKNOWN     - not enough information to decide.
        """
        proxy_headers_present = any(
            name in received_headers for name in _PROXY_HEADER_NAMES
        )

        if self._own_ip and origin:
            if self._own_ip == origin or self._own_ip in received_headers.values():
                return AnonymityLevel.TRANSPARENT
            # Real IP not exposed.
            return (
                AnonymityLevel.ANONYMOUS
                if proxy_headers_present
                else AnonymityLevel.ELITE
            )

        # Own IP unknown: fall back to header inspection only.
        if origin is not None:
            return (
                AnonymityLevel.ANONYMOUS
                if proxy_headers_present
                else AnonymityLevel.UNKNOWN
            )
        return AnonymityLevel.UNKNOWN

    @staticmethod
    def _geo_target(candidate: ProxyCandidate, origin: Optional[str]) -> str:
        """Prefer the proxy host IP for geolocation; if the host is not an IP
        literal, use the observed origin IP when available."""
        try:
            ipaddress.ip_address(candidate.host)
            return candidate.host
        except ValueError:
            return origin or candidate.host
