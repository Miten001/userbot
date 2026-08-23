"""Deduplication tests (Task 6.2, Property 4)."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from proxy_scraper.domain.dedup import Deduplicator
from proxy_scraper.domain.models import ProxyProtocol, make_candidate
from tests.conftest import candidate_strategy


@given(st.lists(candidate_strategy(), max_size=200))
def test_dedup_has_no_duplicate_keys(candidates):
    result = Deduplicator.dedupe(candidates)
    keys = [c.key for c in result]
    assert len(keys) == len(set(keys))


@given(st.lists(candidate_strategy(), max_size=200))
def test_dedup_preserves_membership(candidates):
    """Every input key survives exactly once in the output."""
    result = Deduplicator.dedupe(candidates)
    assert {c.key for c in result} == {c.key for c in candidates}


def test_dedup_preserves_first_occurrence_order():
    c1 = make_candidate("1.1.1.1", 80, "http")
    c2 = make_candidate("2.2.2.2", 80, "http")
    dup = make_candidate("1.1.1.1", 80, "http")
    result = Deduplicator.dedupe([c1, c2, dup])
    assert result == [c1, c2]


def test_same_host_port_different_protocol_not_duplicate():
    a = make_candidate("1.1.1.1", 80, "http")
    b = make_candidate("1.1.1.1", 80, "socks5")
    result = Deduplicator.dedupe([a, b])
    assert len(result) == 2
