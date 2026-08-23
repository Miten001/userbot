"""ScraperManager tests (Tasks 7.2, 7.3 - Property 6, scraping side)."""

from __future__ import annotations

import asyncio

from proxy_scraper.domain.models import make_candidate
from proxy_scraper.domain.scraper_manager import DefaultScraperManager
from tests.fakes import FakeHttpClient, FakeSource


def _cands(*specs):
    return [make_candidate(h, p, proto) for h, p, proto in specs]


def test_scrape_all_aggregates_and_dedupes():
    mgr = DefaultScraperManager(max_concurrency=4)
    mgr.register(FakeSource("a", _cands(("1.1.1.1", 80, "http"), ("2.2.2.2", 80, "http"))))
    mgr.register(FakeSource("b", _cands(("2.2.2.2", 80, "http"), ("3.3.3.3", 80, "http"))))

    outcome = asyncio.run(mgr.scrape_all(FakeHttpClient()))

    keys = {c.key for c in outcome.candidates}
    assert len(outcome.candidates) == len(keys) == 3
    assert {r.source for r in outcome.reports} == {"a", "b"}
    assert all(r.error is None for r in outcome.reports)


def test_scrape_all_reports_per_source_counts():
    mgr = DefaultScraperManager()
    mgr.register(FakeSource("a", _cands(("1.1.1.1", 80, "http"))))
    mgr.register(FakeSource("b", _cands(("2.2.2.2", 80, "http"), ("3.3.3.3", 80, "http"))))
    outcome = asyncio.run(mgr.scrape_all(FakeHttpClient()))
    found = {r.source: r.found for r in outcome.reports}
    assert found == {"a": 1, "b": 2}


def test_scrape_all_isolates_a_failing_source():
    """Property 6: a misbehaving source never aborts the run or raises."""
    mgr = DefaultScraperManager()
    mgr.register(FakeSource("ok", _cands(("1.1.1.1", 80, "http"))))
    mgr.register(FakeSource("bad", raise_exc=RuntimeError("kaboom")))

    outcome = asyncio.run(mgr.scrape_all(FakeHttpClient()))

    assert len(outcome.candidates) == 1
    reports = {r.source: r for r in outcome.reports}
    assert reports["ok"].error is None
    assert reports["bad"].error is not None
    assert outcome.succeeded_count == 1
    assert outcome.failed_count == 1


def test_scrape_all_empty_registry():
    mgr = DefaultScraperManager()
    outcome = asyncio.run(mgr.scrape_all(FakeHttpClient()))
    assert outcome.candidates == []
    assert outcome.reports == []
