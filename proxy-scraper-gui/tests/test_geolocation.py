"""GeoLocationService tests (Task 8.2): caching, API fallback, sentinel."""

from __future__ import annotations

import asyncio
import json

from proxy_scraper.domain.geolocation import GeoLocationService
from proxy_scraper.domain.models import UNKNOWN_COUNTRY_CODE
from tests.fakes import FakeHttpClient


def test_api_fallback_resolves_country():
    body = json.dumps({"status": "success", "countryCode": "US", "country": "United States"})
    client = FakeHttpClient(body=body)
    svc = GeoLocationService(client=client, geoip_db_path=None)
    info = asyncio.run(svc.locate("8.8.8.8"))
    assert info.country_code == "US"
    assert info.country_name == "United States"


def test_cache_returns_without_reresolving():
    body = json.dumps({"status": "success", "countryCode": "DE", "country": "Germany"})
    client = FakeHttpClient(body=body)
    svc = GeoLocationService(client=client, geoip_db_path=None)

    async def scenario():
        first = await svc.locate("1.1.1.1")
        second = await svc.locate("1.1.1.1")
        return first, second

    first, second = asyncio.run(scenario())
    assert first.country_code == second.country_code == "DE"
    # Second lookup must be served from cache -> exactly one HTTP call.
    assert len(client.calls) == 1


def test_unknown_sentinel_on_failed_resolution():
    body = json.dumps({"status": "fail"})
    client = FakeHttpClient(body=body)
    svc = GeoLocationService(client=client, geoip_db_path=None)
    info = asyncio.run(svc.locate("10.0.0.1"))
    assert info.country_code == UNKNOWN_COUNTRY_CODE


def test_never_raises_on_client_error():
    client = FakeHttpClient(raise_exc=RuntimeError("network down"))
    svc = GeoLocationService(client=client, geoip_db_path=None)
    info = asyncio.run(svc.locate("10.0.0.2"))
    assert info.country_code == UNKNOWN_COUNTRY_CODE
