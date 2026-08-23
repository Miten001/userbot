"""Tests for core data models (Tasks 2.2, 2.3)."""

from __future__ import annotations

import pytest
from hypothesis import given

from proxy_scraper.domain.models import (
    ProxyProtocol,
    ProxyResult,
    make_candidate,
)
from tests.conftest import result_strategy


# --- Task 2.2: Property 5 - latency consistency ----------------------------


@given(result_strategy())
def test_latency_consistency_invariant(result: ProxyResult):
    """alive == False  <=> latency_ms is None; alive == True => latency >= 0."""
    if result.alive:
        assert result.latency_ms is not None
        assert result.latency_ms >= 0
    else:
        assert result.latency_ms is None


def test_alive_result_requires_integer_latency():
    cand = make_candidate("1.2.3.4", 80, "http")
    with pytest.raises(ValueError):
        ProxyResult(cand, alive=True, latency_ms=None)


def test_dead_result_rejects_latency():
    cand = make_candidate("1.2.3.4", 80, "http")
    with pytest.raises(ValueError):
        ProxyResult(cand, alive=False, latency_ms=10)


# --- Task 2.3: candidate input validation (Requirement 17) -----------------


@pytest.mark.parametrize(
    "host,port,proto",
    [
        ("1.2.3.4", 8080, "http"),
        ("example.com", 3128, "https"),
        ("10.0.0.1", 1080, "socks5"),
        ("proxy.host.io", 443, "socks4"),
        ("::1", 8080, "http"),
    ],
)
def test_valid_candidates_accepted(host, port, proto):
    assert make_candidate(host, port, proto) is not None


@pytest.mark.parametrize(
    "host,port,proto",
    [
        ("", 8080, "http"),            # empty host
        ("not a host!", 8080, "http"),  # invalid host chars
        ("1.2.3.4", 0, "http"),        # port too low
        ("1.2.3.4", 70000, "http"),    # port too high
        ("1.2.3.4", -1, "http"),       # negative port
        ("1.2.3.4", "abc", "http"),    # non-numeric port
        ("1.2.3.4", 8080, "gopher"),   # unsupported protocol
        ("1.2.3.4", 8080, ""),         # empty protocol
    ],
)
def test_invalid_candidates_rejected(host, port, proto):
    assert make_candidate(host, port, proto) is None


def test_string_port_is_parsed():
    cand = make_candidate("1.2.3.4", "8080", "http")
    assert cand is not None
    assert cand.port == 8080


def test_protocol_aliases():
    assert ProxyProtocol.from_str("SOCKS5H") is ProxyProtocol.SOCKS5
    assert ProxyProtocol.from_str("ssl") is ProxyProtocol.HTTPS
    assert ProxyProtocol.from_str("bogus") is None


def test_candidate_key_identity():
    a = make_candidate("1.2.3.4", 80, "http")
    b = make_candidate("1.2.3.4", 80, "http")
    assert a.key == b.key
