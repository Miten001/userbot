"""Preservation tests (Property 2) for behavior that must NOT change.

Focus is on the pure-Python accounting that can be exercised without a live
Chrome: ``main.py``'s per-IP usage limits (``IP_USAGE_COUNT`` / ``MAX_IP_USES``)
and the host-extraction they rely on. Flows that require Chrome (auto-fetch
verification, dead-proxy auto-close, autoclose's round-robin window opening)
are covered by the integration tests documented in tasks.md.

Validates: Requirement 3.5 (rotation / usage-limit accounting unchanged).
"""

import importlib

import pytest

import main


@pytest.fixture()
def fresh_usage(tmp_path, monkeypatch):
    """Isolate IP usage accounting to a temp file and empty counts."""
    usage_file = tmp_path / "ip_usage.json"
    monkeypatch.setattr(main, "IP_USAGE_FILE", str(usage_file))
    monkeypatch.setattr(main, "IP_USAGE_COUNT", {})
    return main.TeraBoxAutomation(status_callback=lambda *_: None)


def test_mark_ip_used_increments_per_host(fresh_usage):
    proxy = "203.0.113.10:8080:alice:s3cret"
    assert fresh_usage._get_ip_use_count(proxy) == 0
    fresh_usage._mark_ip_used(proxy)
    assert fresh_usage._get_ip_use_count(proxy) == 1
    fresh_usage._mark_ip_used(proxy)
    assert fresh_usage._get_ip_use_count(proxy) == 2


def test_usage_count_keyed_by_host_across_notations(fresh_usage):
    """Same host in either notation shares the same usage counter."""
    fresh_usage._mark_ip_used("203.0.113.10:8080:alice:s3cret")
    # @-notation for the SAME host/port must see the existing count.
    assert fresh_usage._get_ip_use_count("alice:s3cret@203.0.113.10:8080") == 1


def test_max_ip_uses_boundary_filters_available(fresh_usage):
    """Replicates run()'s available-proxy filter: count < MAX_IP_USES."""
    proxy = "203.0.113.10:8080"
    for _ in range(main.MAX_IP_USES):
        fresh_usage._mark_ip_used(proxy)
    assert fresh_usage._get_ip_use_count(proxy) >= main.MAX_IP_USES
    available = [p for p in [proxy] if fresh_usage._get_ip_use_count(p) < main.MAX_IP_USES]
    assert available == []


def test_usage_persisted_to_file(fresh_usage, tmp_path):
    fresh_usage._mark_ip_used("198.51.100.5:3128")
    assert main.os.path.exists(main.IP_USAGE_FILE)
    reloaded = main._load_ip_usage()
    assert reloaded.get("198.51.100.5") == 1


def test_round_robin_formula_is_cyclic():
    """autoclose selects proxy[(processed-1) % len]; confirm the formula cycles.

    The selection lives inline in ``run()`` (which opens Chrome windows), so we
    lock in the arithmetic it depends on rather than the window-opening flow.
    """
    proxies = ["p0", "p1", "p2"]
    selected = [proxies[(processed - 1) % len(proxies)] for processed in range(1, 7)]
    assert selected == ["p0", "p1", "p2", "p0", "p1", "p2"]
