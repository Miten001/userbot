"""Filter validation and the premium / country predicates.

Pure functions - no I/O, no framework - so they are trivially unit- and
property-testable. They encode the correctness properties from the design:

* Property 2: Country filter soundness (Requirement 6.2, 6.3, 6.4, 5.4)
* Property 3: Premium definition       (Requirement 7.2, 7.3)
"""

from __future__ import annotations

from typing import Optional

from proxy_scraper.domain.models import (
    ANY_COUNTRY,
    DEFAULT_MAX_LATENCY_MS,
    AnonymityFilter,
    AnonymityLevel,
    ProxyFilter,
    ProxyProtocol,
    ProxyResult,
    UNKNOWN_COUNTRY_CODE,
    is_valid_country_code,
)


class FilterValidationError(ValueError):
    """Raised when a :class:`ProxyFilter` violates its validation rules."""


def validate_filter(filter: ProxyFilter) -> None:
    """Validate a filter, raising :class:`FilterValidationError` on violation.

    Rules (Requirement 8.2, 8.3):
    * ``protocols`` must be non-empty.
    * ``max_latency_ms`` must be a positive integer.
    * ``country_code`` must be None, "ANY", or a valid ISO alpha-2 code.
    """
    if not filter.protocols:
        raise FilterValidationError("At least one protocol must be selected.")
    if not all(isinstance(p, ProxyProtocol) for p in filter.protocols):
        raise FilterValidationError("protocols must contain ProxyProtocol values.")
    if isinstance(filter.max_latency_ms, bool) or not isinstance(
        filter.max_latency_ms, int
    ):
        raise FilterValidationError("max_latency_ms must be an integer.")
    if filter.max_latency_ms <= 0:
        raise FilterValidationError("max_latency_ms must be a positive integer.")
    if filter.country_code is not None:
        code = filter.country_code.upper()
        if code != ANY_COUNTRY and (
            code == UNKNOWN_COUNTRY_CODE or not is_valid_country_code(code)
        ):
            raise FilterValidationError(f"Invalid country code: {filter.country_code!r}")


def normalize_filter(
    country_code: Optional[str],
    protocols: frozenset[ProxyProtocol],
    max_latency_ms: Optional[int],
    min_anonymity: AnonymityFilter = AnonymityFilter.ELITE_ONLY,
) -> ProxyFilter:
    """Build a validated :class:`ProxyFilter`, applying the default latency
    threshold when none is supplied (Requirement 8.4) and defaulting the
    anonymity selector to ``ELITE_ONLY`` (Requirement 7.6, 8.6)."""
    latency = max_latency_ms if max_latency_ms else DEFAULT_MAX_LATENCY_MS
    filter = ProxyFilter(
        country_code=country_code,
        protocols=frozenset(protocols),
        max_latency_ms=latency,
        min_anonymity=min_anonymity,
    )
    validate_filter(filter)
    return filter


def passes_country(result: ProxyResult, filter: ProxyFilter) -> bool:
    """Country-filter predicate (Property 2, Requirement 6.2-6.4, 5.4).

    * Specific code C  => ``result.country_code == C`` and never ``"??"``.
    * None / "ANY"     => any country is admitted.
    """
    target = filter.normalized_country
    if target is None:
        return True  # any / random country
    if result.country_code == UNKNOWN_COUNTRY_CODE:
        return False  # exclude unknown-country results from a specific filter
    return result.country_code.upper() == target


def anonymity_ok(
    anonymity: AnonymityLevel, min_anonymity: AnonymityFilter
) -> bool:
    """Whether *anonymity* satisfies the *min_anonymity* selector
    (Property 3, Requirement 7.3-7.5).

    * ``ANY``                 => always ``True`` (no anonymity restriction).
    * ``ANONYMOUS_OR_BETTER`` => ``anonymity != AnonymityLevel.TRANSPARENT``.
    * ``ELITE_ONLY``          => ``anonymity == AnonymityLevel.ELITE``.
    """
    if min_anonymity == AnonymityFilter.ANY:
        return True
    if min_anonymity == AnonymityFilter.ANONYMOUS_OR_BETTER:
        return anonymity != AnonymityLevel.TRANSPARENT
    if min_anonymity == AnonymityFilter.ELITE_ONLY:
        return anonymity == AnonymityLevel.ELITE
    # Defensive default: unknown selector imposes no restriction.
    return True


def is_premium(result: ProxyResult, filter: ProxyFilter) -> bool:
    """Premium predicate (Property 3, Requirement 7.2-7.5).

    ``premium`` iff::

        alive
        AND latency_ms <= filter.max_latency_ms
        AND anonymity_ok(anonymity, filter.min_anonymity)
    """
    if not result.alive:
        return False
    if result.latency_ms is None:
        return False
    if result.latency_ms > filter.max_latency_ms:
        return False
    if not anonymity_ok(result.anonymity, filter.min_anonymity):
        return False
    return True


def passes_protocol(result: ProxyResult, filter: ProxyFilter) -> bool:
    """True when the result's protocol is one of the selected protocols."""
    return result.protocol in filter.protocols


def should_display(result: ProxyResult, filter: ProxyFilter) -> bool:
    """Combined display predicate used by the controller.

    A result is displayed iff it is alive (Requirement 7.1), passes the country
    filter, passes the protocol filter, and is premium for the active filter.
    """
    return (
        result.alive
        and passes_protocol(result, filter)
        and passes_country(result, filter)
        and is_premium(result, filter)
    )
