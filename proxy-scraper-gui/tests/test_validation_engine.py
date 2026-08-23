"""ValidationEngine tests (Tasks 9.3, 9.4, 9.5)."""

from __future__ import annotations

import asyncio
import json

from proxy_scraper.domain.interfaces import ValidationConfig
from proxy_scraper.domain.models import AnonymityLevel, GeoInfo, make_candidate
from proxy_scraper.domain.validation_engine import DefaultValidationEngine
from tests.fakes import FakeHttpClient


class FakeGeo:
    def __init__(self, info=None):
        self._info = info or GeoInfo("US", "United States")

    async def locate(self, ip):
        return self._info


def _run(coro):
    return asyncio.run(coro)


def _judge_body(origin, headers=None):
    return json.dumps({"origin": origin, "headers": headers or {}})


# --- Task 9.4: Property 6 - no crash on check failure ----------------------


def test_check_returns_dead_result_on_failure_never_raises():
    client = FakeHttpClient(raise_exc=OSError("connection refused"))
    engine = DefaultValidationEngine(client, FakeGeo())
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.alive is False
    assert result.latency_ms is None


# --- Task 9.3: Property 5 - latency consistency of output ------------------


def test_alive_result_has_nonnegative_latency():
    client = FakeHttpClient(body=_judge_body("9.9.9.9"))
    engine = DefaultValidationEngine(client, FakeGeo())
    engine._own_ip = "5.5.5.5"
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.alive is True
    assert isinstance(result.latency_ms, int) and result.latency_ms >= 0


def test_dead_result_has_none_latency_on_bad_status():
    client = FakeHttpClient(body="", status=500)
    engine = DefaultValidationEngine(client, FakeGeo())
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.alive is False
    assert result.latency_ms is None


# --- Task 9.5: anonymity classification ------------------------------------


def test_transparent_when_own_ip_leaks():
    client = FakeHttpClient(body=_judge_body("5.5.5.5"))
    engine = DefaultValidationEngine(client, FakeGeo())
    engine._own_ip = "5.5.5.5"
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.anonymity == AnonymityLevel.TRANSPARENT


def test_anonymous_when_proxy_headers_present_but_ip_hidden():
    body = _judge_body("1.2.3.4", {"Via": "1.1 proxy"})
    client = FakeHttpClient(body=body)
    engine = DefaultValidationEngine(client, FakeGeo())
    engine._own_ip = "5.5.5.5"
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.anonymity == AnonymityLevel.ANONYMOUS


def test_elite_when_no_leak_and_no_proxy_headers():
    body = _judge_body("1.2.3.4", {"Accept": "*/*"})
    client = FakeHttpClient(body=body)
    engine = DefaultValidationEngine(client, FakeGeo())
    engine._own_ip = "5.5.5.5"
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), ValidationConfig()))
    assert result.anonymity == AnonymityLevel.ELITE


def test_retries_then_gives_up():
    # retries=2 => 3 attempts; all fail.
    client = FakeHttpClient(raise_exc=TimeoutError("t"))
    engine = DefaultValidationEngine(client, FakeGeo())
    cfg = ValidationConfig(retries=2)
    result = _run(engine.check(make_candidate("1.2.3.4", 80, "http"), cfg))
    assert result.alive is False
    assert len(client.calls) == 3
