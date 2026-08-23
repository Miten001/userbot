"""Source adapter tests with recorded fixtures (Task 5.2)."""

from __future__ import annotations

import asyncio
import os

from proxy_scraper.domain.models import ProxyProtocol
from proxy_scraper.infrastructure.sources import (
    HtmlTableSource,
    JsonApiSource,
    PlaintextListSource,
)
from tests.fakes import FakeHttpClient

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _read(name: str) -> str:
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as fh:
        return fh.read()


def test_html_table_source_parses_and_discards_malformed():
    client = FakeHttpClient(body=_read("free_proxy_list.html"))
    source = HtmlTableSource()
    candidates = asyncio.run(source.fetch(client))
    # Two valid rows; the malformed row is discarded.
    assert len(candidates) == 2
    hosts = {c.host for c in candidates}
    assert hosts == {"203.0.113.5", "198.51.100.9"}
    # "Https: yes" row => HTTPS, "no" row => HTTP.
    by_host = {c.host: c.protocol for c in candidates}
    assert by_host["203.0.113.5"] == ProxyProtocol.HTTPS
    assert by_host["198.51.100.9"] == ProxyProtocol.HTTP


def test_plaintext_source_parses_and_discards_malformed():
    client = FakeHttpClient(body=_read("plaintext_list.txt"))
    source = PlaintextListSource("http://x", "plain", ProxyProtocol.HTTP)
    candidates = asyncio.run(source.fetch(client))
    # 3 valid entries (last has out-of-range port -> discarded).
    hosts = {c.host for c in candidates}
    assert hosts == {"203.0.113.10", "198.51.100.20", "192.0.2.30"}
    by_host = {c.host: c.protocol for c in candidates}
    assert by_host["192.0.2.30"] == ProxyProtocol.SOCKS5  # scheme prefix honored


def test_json_api_source_parses_and_discards_malformed():
    client = FakeHttpClient(body=_read("json_api.json"))
    source = JsonApiSource(url="http://x", name="json")
    candidates = asyncio.run(source.fetch(client))
    hosts = {c.host for c in candidates}
    assert hosts == {"203.0.113.40", "198.51.100.50"}


def test_source_returns_empty_on_http_error_never_raises():
    client = FakeHttpClient(raise_exc=RuntimeError("boom"))
    for source in (
        HtmlTableSource(),
        PlaintextListSource("http://x", "p"),
        JsonApiSource(url="http://x", name="j"),
    ):
        assert asyncio.run(source.fetch(client)) == []


def test_source_returns_empty_on_bad_status():
    client = FakeHttpClient(body="whatever", status=500)
    assert asyncio.run(HtmlTableSource().fetch(client)) == []


def test_json_source_returns_empty_on_unparseable_body():
    client = FakeHttpClient(body="<<<not json>>>")
    assert asyncio.run(JsonApiSource(url="http://x", name="j").fetch(client)) == []
