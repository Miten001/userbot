"""Controller-level seen-proxy property/integration tests.

Covers:
* Task 18.7 - Property 9:  No IP is surfaced twice across runs.
* Task 18.8 - Property 10: Only surfaced hosts are recorded.
* Task 18.12 - cross-session no-repeat integration test.

These drive the real :class:`AppController` display path (``_on_worker_result``)
synchronously (no worker threads) against a real, disk-backed
:class:`JsonSeenProxyStore`, constructing a fresh store/controller from the
same path between runs to simulate closing and reopening the app on another
day.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from PyQt6.QtWidgets import QApplication

from proxy_scraper.application.app_controller import AppController
from proxy_scraper.application.filtering import should_display
from proxy_scraper.domain.models import (
    AnonymityFilter,
    AnonymityLevel,
    ExportOutcome,
    ProxyCandidate,
    ProxyFilter,
    ProxyProtocol,
    ProxyResult,
)
from proxy_scraper.infrastructure.seen_proxy_store import JsonSeenProxyStore

from tests.fakes import InMemorySeenProxyStore

# A single QApplication for the whole module (offscreen platform in CI).
_APP = QApplication.instance() or QApplication([])

# Small host pool so collisions occur within and across runs, genuinely
# exercising the per-run and cross-run de-duplication.
_HOST_POOL = [
    "203.0.113.1",
    "203.0.113.2",
    "203.0.113.3",
    "198.51.100.7",
    "198.51.100.8",
    "192.0.2.10",
    "192.0.2.11",
    "192.0.2.12",
]


class _NullExport:
    def export(self, results, fmt, path):  # pragma: no cover - unused
        return ExportOutcome(True, len(results), path, None)


@st.composite
def _result_strategy(draw):
    host = draw(st.sampled_from(_HOST_POOL))
    port = draw(st.integers(min_value=1, max_value=65535))
    proto = draw(st.sampled_from(list(ProxyProtocol)))
    alive = draw(st.booleans())
    anon = draw(st.sampled_from(list(AnonymityLevel)))
    if alive:
        latency = draw(st.integers(min_value=0, max_value=10000))
        code = draw(st.sampled_from(["US", "DE", "??"]))
    else:
        latency = None
        code = "??"
    candidate = ProxyCandidate(host, port, proto, "s")
    return ProxyResult(
        candidate=candidate,
        alive=alive,
        latency_ms=latency,
        country_code=code,
        country_name="X",
        anonymity=anon,
        checked_at=0.0,
    )


def _make_controller(store):
    return AppController(
        http_client_factory=lambda: None,
        scraper_manager=None,
        validation_engine=None,
        export_service=_NullExport(),
        seen_store=store,
    )


def _run(results, flt, store):
    """Feed *results* through a fresh controller bound to *store* and return
    the list of hosts actually surfaced (in order)."""
    ctrl = _make_controller(store)
    ctrl._filter = flt
    ctrl._surfaced_this_run = set()
    for r in results:
        ctrl._on_worker_result(r)
    surfaced = [res.host for res in ctrl.displayed_results]
    ctrl.deleteLater()
    return surfaced


# --- Task 18.7: Property 9 - no IP surfaced twice across runs --------------


@settings(max_examples=60)
@given(results=st.lists(_result_strategy(), max_size=40))
def test_property_9_no_ip_surfaced_twice_across_runs(results):
    """Two runs sharing one on-disk store (with save + reload of a fresh
    store between them, simulating an app restart) surface any host at most
    once in total (Property 9)."""
    flt = ProxyFilter(
        country_code=None,  # any country
        protocols=frozenset(ProxyProtocol),
        max_latency_ms=10000,
        min_anonymity=AnonymityFilter.ANY,
    )
    mid = len(results) // 2
    run1_results, run2_results = results[:mid], results[mid:]

    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "seen_proxies.json"

        # Run 1 with its own store instance (persists to disk via save()).
        store1 = JsonSeenProxyStore(path)
        store1.load()
        surfaced1 = _run(run1_results, flt, store1)

        # Run 2: a brand-new store instance re-loading the same path, as if
        # the app were closed and reopened on another day.
        store2 = JsonSeenProxyStore(path)
        store2.load()
        surfaced2 = _run(run2_results, flt, store2)

        all_surfaced = surfaced1 + surfaced2
        # Every host displayed at most once total (no dupes within or across).
        assert len(all_surfaced) == len(set(all_surfaced))
        # And no host from run 1 reappears in run 2.
        assert set(surfaced1).isdisjoint(set(surfaced2))


# --- Task 18.8: Property 10 - only surfaced hosts are recorded -------------


@settings(max_examples=60)
@given(results=st.lists(_result_strategy(), max_size=40))
def test_property_10_only_surfaced_hosts_recorded(results):
    """After a run, the store contains exactly the hosts that passed the full
    display predicate -- never dead/filtered candidates (Property 10)."""
    flt = ProxyFilter(
        country_code="US",
        protocols=frozenset(ProxyProtocol),
        max_latency_ms=5000,
        min_anonymity=AnonymityFilter.ELITE_ONLY,
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "seen_proxies.json"
        store = JsonSeenProxyStore(path)
        store.load()

        _run(results, flt, store)

        expected_hosts = {r.host for r in results if should_display(r, flt)}
        assert len(store) == len(expected_hosts)
        for host in _HOST_POOL:
            assert store.contains(host) == (host in expected_hosts)


# --- Task 18.12: cross-session no-repeat integration test ------------------


def _elite_us(host, latency=100, port=8080, proto=ProxyProtocol.HTTP):
    return ProxyResult(
        candidate=ProxyCandidate(host, port, proto, "mock"),
        alive=True,
        latency_ms=latency,
        country_code="US",
        country_name="United States",
        anonymity=AnonymityLevel.ELITE,
        checked_at=0.0,
    )


def test_cross_session_no_repeat_integration(tmp_path):
    """Run the display pipeline twice against the same set of validated
    results with a shared on-disk store, building a fresh controller + store
    from the same path for run 2 (simulating a restart on another day).
    Assert no host surfaced in run 1 is surfaced again in run 2 (18.12)."""
    path = tmp_path / "seen_proxies.json"
    flt = ProxyFilter(
        country_code="US",
        protocols=frozenset(ProxyProtocol),
        max_latency_ms=5000,
        min_anonymity=AnonymityFilter.ELITE_ONLY,
    )

    # The same pool of validated, surfaceable results is produced each run
    # (as if the same live proxies were scraped again).
    def make_results():
        return [
            _elite_us("203.0.113.10"),
            _elite_us("203.0.113.11", latency=200),
            _elite_us("203.0.113.12", latency=300),
        ]

    # Run 1: fresh store, everything is new -> all three surface.
    store1 = JsonSeenProxyStore(path)
    store1.load()
    surfaced1 = _run(make_results(), flt, store1)
    assert sorted(surfaced1) == ["203.0.113.10", "203.0.113.11", "203.0.113.12"]

    # Run 2: brand-new controller + store re-loaded from the same path.
    store2 = JsonSeenProxyStore(path)
    store2.load()
    assert len(store2) == 3  # history persisted across the "restart"
    surfaced2 = _run(make_results(), flt, store2)

    # Nothing repeats: every host from run 1 is excluded in run 2.
    assert surfaced2 == []
    assert set(surfaced1).isdisjoint(set(surfaced2))

    # A genuinely new host in run 2 would still surface.
    store3 = JsonSeenProxyStore(path)
    store3.load()
    surfaced3 = _run(make_results() + [_elite_us("203.0.113.99")], flt, store3)
    assert surfaced3 == ["203.0.113.99"]




# --- Task 18.5/18.6: controller unit tests ---------------------------------


def _permissive_filter():
    return ProxyFilter(
        country_code="US",
        protocols=frozenset(ProxyProtocol),
        max_latency_ms=5000,
        min_anonymity=AnonymityFilter.ELITE_ONLY,
    )


def test_already_seen_host_is_not_surfaced():
    """A host pre-recorded in the store is excluded from the display path."""
    store = InMemorySeenProxyStore()
    store.add("203.0.113.10")  # seen on a prior run
    flt = _permissive_filter()

    surfaced = _run([_elite_us("203.0.113.10"), _elite_us("203.0.113.11")], flt, store)
    assert surfaced == ["203.0.113.11"]


def test_surfacing_records_and_saves_promptly():
    """Surfacing a result records its host and persists promptly."""
    store = InMemorySeenProxyStore()
    flt = _permissive_filter()

    _run([_elite_us("203.0.113.10")], flt, store)
    assert store.contains("203.0.113.10") is True
    assert store.save_calls >= 1


def test_non_surfaced_candidates_are_not_recorded():
    """Dead / filtered-out results are never recorded (Property 10)."""
    store = InMemorySeenProxyStore()
    flt = _permissive_filter()

    dead = ProxyResult(
        candidate=ProxyCandidate("203.0.113.20", 80, ProxyProtocol.HTTP, "s"),
        alive=False,
        latency_ms=None,
        country_code="??",
        country_name="Unknown",
        anonymity=AnonymityLevel.UNKNOWN,
        checked_at=0.0,
    )
    wrong_country = _elite_us("203.0.113.21")
    wrong_country = ProxyResult(
        candidate=wrong_country.candidate,
        alive=True,
        latency_ms=100,
        country_code="DE",  # filter wants US
        country_name="Germany",
        anonymity=AnonymityLevel.ELITE,
        checked_at=0.0,
    )
    surfaced = _run([dead, wrong_country], flt, store)
    assert surfaced == []
    assert len(store) == 0


def test_at_most_one_result_per_host_within_a_run():
    """Two passing results for the same host surface only once in a run."""
    store = InMemorySeenProxyStore()
    flt = _permissive_filter()
    surfaced = _run(
        [_elite_us("203.0.113.10", latency=100), _elite_us("203.0.113.10", latency=200)],
        flt,
        store,
    )
    assert surfaced == ["203.0.113.10"]
    assert len(store) == 1


def test_clear_seen_history_empties_store():
    """clear_seen_history() empties the store so hosts may surface again."""
    store = InMemorySeenProxyStore()
    store.add("203.0.113.10")
    ctrl = _make_controller(store)

    ctrl.clear_seen_history()
    assert len(store) == 0
    assert store.contains("203.0.113.10") is False

    # After clearing, the previously-seen host surfaces again.
    ctrl._filter = _permissive_filter()
    ctrl._surfaced_this_run = set()
    ctrl._on_worker_result(_elite_us("203.0.113.10"))
    assert [r.host for r in ctrl.displayed_results] == ["203.0.113.10"]
    ctrl.deleteLater()
