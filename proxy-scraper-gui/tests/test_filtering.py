"""Filter/premium/country predicate tests (Tasks 11.2, 11.3)."""

from __future__ import annotations

import time

import pytest
from hypothesis import given
from hypothesis import strategies as st

from proxy_scraper.application.filtering import (
    FilterValidationError,
    anonymity_ok,
    is_premium,
    normalize_filter,
    passes_country,
    validate_filter,
)
from proxy_scraper.domain.models import (
    DEFAULT_MAX_LATENCY_MS,
    AnonymityFilter,
    AnonymityLevel,
    ProxyCandidate,
    ProxyFilter,
    ProxyProtocol,
    ProxyResult,
)


def _anonymity_ok_expected(anon: AnonymityLevel, min_anon: AnonymityFilter) -> bool:
    """Reference implementation of the anonymity semantics (Requirement 7.3-7.5)."""
    if min_anon == AnonymityFilter.ANY:
        return True
    if min_anon == AnonymityFilter.ANONYMOUS_OR_BETTER:
        return anon != AnonymityLevel.TRANSPARENT
    # ELITE_ONLY
    return anon == AnonymityLevel.ELITE


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
    min_anon=st.sampled_from(list(AnonymityFilter)),
    threshold=st.integers(min_value=1, max_value=30000),
)
def test_premium_matches_definition(alive, latency, anon, min_anon, threshold):
    result = _result(alive, latency if alive else None, anon)
    flt = ProxyFilter(
        country_code=None,
        protocols=frozenset({ProxyProtocol.HTTP}),
        max_latency_ms=threshold,
        min_anonymity=min_anon,
    )
    expected = (
        alive
        and (latency is not None and latency <= threshold)
        and _anonymity_ok_expected(anon, min_anon)
    )
    assert is_premium(result, flt) == expected


@given(
    anon=st.sampled_from(list(AnonymityLevel)),
    min_anon=st.sampled_from(list(AnonymityFilter)),
)
def test_anonymity_ok_matches_definition(anon, min_anon):
    """anonymity_ok honors each of the three anonymity levels (Req 7.3-7.5)."""
    assert anonymity_ok(anon, min_anon) == _anonymity_ok_expected(anon, min_anon)


def test_elite_only_admits_only_elite():
    """ELITE_ONLY (the default): only ELITE qualifies as premium."""
    flt = ProxyFilter(
        protocols=frozenset({ProxyProtocol.HTTP}),
        min_anonymity=AnonymityFilter.ELITE_ONLY,
    )
    for anon in AnonymityLevel:
        result = _result(True, 100, anon)
        assert is_premium(result, flt) is (anon == AnonymityLevel.ELITE)


def test_anonymous_or_better_excludes_transparent():
    """ANONYMOUS_OR_BETTER admits everything except TRANSPARENT."""
    flt = ProxyFilter(
        protocols=frozenset({ProxyProtocol.HTTP}),
        min_anonymity=AnonymityFilter.ANONYMOUS_OR_BETTER,
    )
    for anon in AnonymityLevel:
        result = _result(True, 100, anon)
        assert is_premium(result, flt) is (anon != AnonymityLevel.TRANSPARENT)


def test_any_admits_all_anonymity_levels():
    """ANY imposes no anonymity restriction; every level qualifies."""
    flt = ProxyFilter(
        protocols=frozenset({ProxyProtocol.HTTP}),
        min_anonymity=AnonymityFilter.ANY,
    )
    for anon in AnonymityLevel:
        result = _result(True, 100, anon)
        assert is_premium(result, flt) is True


def test_default_min_anonymity_is_elite_only():
    """When omitted, min_anonymity defaults to ELITE_ONLY (Req 7.6, 8.6)."""
    flt = ProxyFilter(protocols=frozenset({ProxyProtocol.HTTP}))
    assert flt.min_anonymity == AnonymityFilter.ELITE_ONLY
    assert is_premium(_result(True, 100, AnonymityLevel.ANONYMOUS), flt) is False
    assert is_premium(_result(True, 100, AnonymityLevel.ELITE), flt) is True


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
    flt = normalize_filter(None, frozenset({ProxyProtocol.HTTP}), None)
    assert flt.max_latency_ms == DEFAULT_MAX_LATENCY_MS


def test_normalize_filter_defaults_to_elite_only():
    flt = normalize_filter(None, frozenset({ProxyProtocol.HTTP}), 1000)
    assert flt.min_anonymity == AnonymityFilter.ELITE_ONLY


def test_normalize_filter_accepts_min_anonymity():
    flt = normalize_filter(
        None,
        frozenset({ProxyProtocol.HTTP}),
        1000,
        AnonymityFilter.ANONYMOUS_OR_BETTER,
    )
    assert flt.min_anonymity == AnonymityFilter.ANONYMOUS_OR_BETTER


def test_invalid_country_code_rejected():
    with pytest.raises(FilterValidationError):
        normalize_filter("ZZZ", frozenset({ProxyProtocol.HTTP}), 1000)
