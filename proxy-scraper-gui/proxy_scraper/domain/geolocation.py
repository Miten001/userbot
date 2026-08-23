"""GeoLocationService: resolve a proxy IP's country.

Resolution order (Requirement 5.2):
1. Offline GeoIP database (geoip2 / MaxMind GeoLite2) when available - fast,
   no rate limits.
2. A rate-limited public HTTP API fallback (ip-api.com) when no offline DB is
   present or the DB has no entry.

An in-memory per-session cache avoids repeated lookups for the same IP
(Requirement 5.3). Resolution never raises: on failure the sentinel
``GeoInfo("??", "Unknown")`` is returned (Requirement 5.4).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from proxy_scraper.domain.countries import country_name_for_code
from proxy_scraper.domain.interfaces import HttpClient
from proxy_scraper.domain.models import GeoInfo, UNKNOWN_COUNTRY_CODE

logger = logging.getLogger(__name__)

# Public fallback API. Returns JSON like
# {"status":"success","countryCode":"US","country":"United States", ...}
_FALLBACK_API = "http://ip-api.com/json/{ip}?fields=status,country,countryCode"


class GeoLocationService:
    """Offline-first geolocation with public API fallback and caching."""

    def __init__(
        self,
        client: Optional[HttpClient] = None,
        *,
        geoip_db_path: Optional[str] = None,
        enable_api_fallback: bool = True,
    ) -> None:
        self._client = client
        self._enable_api_fallback = enable_api_fallback
        self._cache: dict[str, GeoInfo] = {}
        self._lock = asyncio.Lock()
        self._reader = None
        self._db_path = geoip_db_path or self._discover_db_path()
        self._init_reader()

    # -- setup ---------------------------------------------------------------

    @staticmethod
    def _discover_db_path() -> Optional[str]:
        """Look for a GeoLite2 database in common locations / env var."""
        env = os.environ.get("GEOIP_DB_PATH")
        candidates = [
            env,
            os.path.join(os.getcwd(), "GeoLite2-Country.mmdb"),
            os.path.join(os.path.dirname(__file__), "..", "..", "GeoLite2-Country.mmdb"),
            "/usr/share/GeoIP/GeoLite2-Country.mmdb",
        ]
        for path in candidates:
            if path and os.path.isfile(path):
                return os.path.abspath(path)
        return None

    def _init_reader(self) -> None:
        if not self._db_path:
            logger.info("No offline GeoIP database found; will use API fallback.")
            return
        try:
            import geoip2.database  # lazy import

            self._reader = geoip2.database.Reader(self._db_path)
            logger.info("Loaded offline GeoIP database: %s", self._db_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to open GeoIP DB %s: %s", self._db_path, exc)
            self._reader = None

    @property
    def has_offline_db(self) -> bool:
        return self._reader is not None

    # -- resolution ----------------------------------------------------------

    async def locate(self, ip: str) -> GeoInfo:
        if not ip:
            return GeoInfo.unknown()

        # Cache hit (Requirement 5.3).
        cached = self._cache.get(ip)
        if cached is not None:
            return cached

        async with self._lock:
            # Re-check after acquiring the lock (another coroutine may have
            # resolved the same IP concurrently).
            cached = self._cache.get(ip)
            if cached is not None:
                return cached

            info = self._locate_offline(ip)
            if info is None and self._enable_api_fallback:
                info = await self._locate_api(ip)
            if info is None:
                info = GeoInfo.unknown()

            self._cache[ip] = info
            return info

    def _locate_offline(self, ip: str) -> Optional[GeoInfo]:
        if self._reader is None:
            return None
        try:
            response = self._reader.country(ip)
            code = (response.country.iso_code or "").upper()
            if not code:
                return None
            name = response.country.name or country_name_for_code(code)
            return GeoInfo(country_code=code, country_name=name)
        except Exception:  # noqa: BLE001 - address not found / bad input
            return None

    async def _locate_api(self, ip: str) -> Optional[GeoInfo]:
        if self._client is None:
            return None
        try:
            import json

            response = await self._client.get(_FALLBACK_API.format(ip=ip), timeout=6.0)
            if not response.ok:
                return None
            payload = json.loads(response.body)
            if payload.get("status") != "success":
                return None
            code = (payload.get("countryCode") or "").upper()
            if not code or code == UNKNOWN_COUNTRY_CODE:
                return None
            name = payload.get("country") or country_name_for_code(code)
            return GeoInfo(country_code=code, country_name=name)
        except Exception as exc:  # noqa: BLE001 - never raise
            logger.debug("GeoIP API fallback failed for %s: %s", ip, exc)
            return None

    def close(self) -> None:
        if self._reader is not None:
            try:
                self._reader.close()
            except Exception:  # noqa: BLE001
                pass
            self._reader = None
