"""Shared pytest fixtures and Hypothesis strategies."""

from __future__ import annotations

import time

import pytest
from hypothesis import strategies as st

from proxy_scraper.domain.models import (
    AnonymityLevel,
    ProxyCandidate,
    ProxyProtocol,
    ProxyResult,
)

# --- host / candidate strategies -------------------------------------------

octet = st.integers(min_value=0, max_value=255)


@st.composite
def ipv4_strategy(draw):
    return ".".join(str(draw(octet)) for _ in range(4))


@st.composite
def candidate_strategy(draw):
    host = draw(ipv4_strategy())
    port = draw(st.integers(min_value=1, max_value=65535))
    protocol = draw(st.sampled_from(list(ProxyProtocol)))
    source = draw(st.sampled_from(["s1", "s2", "s3"]))
    return ProxyCandidate(host=host, port=port, protocol=protocol, source=source)


@st.composite
def result_strategy(draw):
    """Generate a valid ProxyResult honoring the latency invariant."""
    candidate = draw(candidate_strategy())
    alive = draw(st.booleans())
    anonymity = draw(st.sampled_from(list(AnonymityLevel)))
    if alive:
        latency = draw(st.integers(min_value=0, max_value=30000))
        code = draw(st.sampled_from(["US", "DE", "IN", "??"]))
    else:
        latency = None
        code = "??"
    return ProxyResult(
        candidate=candidate,
        alive=alive,
        latency_ms=latency,
        country_code=code,
        country_name="X",
        anonymity=anonymity,
        checked_at=time.time(),
    )


@pytest.fixture
def sample_candidate() -> ProxyCandidate:
    return ProxyCandidate("1.2.3.4", 8080, ProxyProtocol.HTTP, "test")
