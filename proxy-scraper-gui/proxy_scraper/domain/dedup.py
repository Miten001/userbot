"""Candidate deduplication (Requirement 2, Property 4)."""

from __future__ import annotations

from typing import Iterable

from proxy_scraper.domain.models import ProxyCandidate


class Deduplicator:
    """Removes duplicate candidates using the identity key
    ``(host, port, protocol)``, preserving the first occurrence of each key."""

    @staticmethod
    def dedupe(candidates: Iterable[ProxyCandidate]) -> list[ProxyCandidate]:
        seen: set[tuple] = set()
        result: list[ProxyCandidate] = []
        for candidate in candidates:
            key = candidate.key
            if key not in seen:
                seen.add(key)
                result.append(candidate)
        return result
