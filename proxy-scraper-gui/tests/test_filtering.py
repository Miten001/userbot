"""Filter/premium/country predicate tests (Tasks 11.2, 11.3)."""

from __future__ import annotations

import time

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proxy_scraper.application.filtering import (
    FilterValidationError,
    is_premium,
    normalize_filter,
    passes_country,
    validate_filter,
)
from proxy_scraper.domain.models import (
    DEFAULT_MAX_LATENCY_MS,
    AnonymityLevel,
    ProxyCandidate,
    ProxyFilter,
    ProxyProtocol,
    ProxyResult,
)


def _result(alive, latency, anon, code="US"):
    cand = ProxyCandidate("1.2.3.4", 80, ProxyProtocol.HTTP, "t")
    return ProxyResult(
        candidate=cand,
        alive=alive,
        latency_ms=latency,
        country_code=code if alive else "??",
        country_name="X",
        anonymity=anon,
        checked_at=time.time(),
    )


# --- Task 11.2: Property 3 - premium predicate -----------------------------


@given(
    alive=st.booleans(),
    latency=st.integers(min_value=0, max_value=30000),
    anon=st.sampled_from(list(AnonymityLevel)),
    require_anon=st.booleans(),
    threshold=st.integers(min_value=1, max_value=30000),
)
def test_premium_matches_definition(alive, latency, anon, require_anon, threshold):
    result = _result(alive, latency if alive else None, anon)
    flt = ProxyFilter(
        country_code=None,
        protocols=frozenset({ProxyProtocol.HTTP}),
        max_latency_ms=threshold,
        require_anonymous=require_anon,
    )
    expected = (
        alive
        and (latency is not None and latency <= threshold)
        and (not require_anon or anon != AnonymityLevel.TRANSPARENT)
    )
    assert is_premium(result, flt) == expected


def test_transparent_excluded_when_anonymity_required():
    result = _result(True, 100, AnonymityLevel.TRANSPARENT)
    flt = ProxyFilter(protocols=frozenset({ProxyProtocol.HTTP}), require_anonymous=True)
    assert is_premium(result, flt) is False


# --- Task 11.3: Property 2 - country filter soundness ----------------------


@given(
    code=st.sampled_from(["US", "DE", "IN", "??"]),
    target=st.sampled_from(["US", "DE", None, "ANY"]),
)
def test_country_filter_soundness(code, target):
    result = _result(True, 100, AnonymityLevel.ELITE, code=code)
    flt = ProxyFilter(country_code=target, protocols=frozenset({ProxyProtocol.HTTP}))
    passed = passes_country(result, flt)
    if target in (None, "ANY"):
        assert passed is True
    else:
        assert passed == (code == target)
        if passed:
            assert result.country_code != "??"


# --- filter validation (Requirement 8.2-8.4) ------------------------------


def test_empty_protocol_set_rejected():
    with pytest.raises(FilterValidationError):
        validate_filter(ProxyFilter(protocols=frozenset()))


def test_nonpositive_latency_rejected():
    with pytest.raises(FilterValidationError):
        validate_filter(
            ProxyFilter(protocols=frozenset({ProxyProtocol.HTTP}), max_latency_ms=0)
        )


def test_default_latency_applied_when_unspecified():
    flt = normalize_filter(None, frozenset({ProxyProtocol.HTTP}), None, False)
    assert flt.max_latency_ms == DEFAULT_MAX_LATENCY_MS


def test_invalid_country_code_rejected():
    with pytest.raises(FilterValidationError):
        normalize_filter("ZZZ", frozenset({ProxyProtocol.HTTP}), 1000, False)
