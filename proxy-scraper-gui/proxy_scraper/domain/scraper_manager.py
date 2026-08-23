"""ScraperManager: aggregates candidates from all registered sources.

Runs source fetches concurrently with a bounded parallelism limit, deduplicates
the aggregate set, and builds a per-source report. A single failing source
never aborts the run and never propagates an exception (Requirement 1, 14.1).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, Optional

from proxy_scraper.domain.dedup import Deduplicator
from proxy_scraper.domain.interfaces import HttpClient, ProxySource
from proxy_scraper.domain.models import (
    ProxyCandidate,
    ScrapeOutcome,
    ScrapeProgress,
    SourceReport,
)

logger = logging.getLogger(__name__)


class DefaultScraperManager:
    """Concrete ScraperManager."""

    def __init__(self, *, max_concurrency: int = 8) -> None:
        self._sources: list[ProxySource] = []
        self._max_concurrency = max(1, max_concurrency)
        self._dedup = Deduplicator()

    def register(self, source: ProxySource) -> None:
        self._sources.append(source)

    @property
    def sources(self) -> list[ProxySource]:
        return list(self._sources)

    async def scrape_all(
        self,
        client: HttpClient,
        *,
        progress: Optional[Callable[[ScrapeProgress], None]] = None,
        is_cancelled: Optional[Callable[[], bool]] = None,
    ) -> ScrapeOutcome:
        total = len(self._sources)
        if total == 0:
            return ScrapeOutcome(candidates=[], reports=[])

        semaphore = asyncio.Semaphore(self._max_concurrency)
        completed = 0
        lock = asyncio.Lock()

        async def run_one(source: ProxySource) -> tuple[SourceReport, list[ProxyCandidate]]:
            nonlocal completed
            if is_cancelled is not None and is_cancelled():
                report = SourceReport(source=source.name, found=0, error="cancelled")
                return report, []
            async with semaphore:
                try:
                    candidates = await source.fetch(client)
                    report = SourceReport(source=source.name, found=len(candidates))
                except Exception as exc:  # noqa: BLE001 - defensive: never propagate
                    logger.warning("source %s raised: %s", source.name, exc)
                    candidates = []
                    report = SourceReport(source=source.name, found=0, error=str(exc))
            async with lock:
                completed += 1
                if progress is not None:
                    progress(
                        ScrapeProgress(
                            phase="scraping",
                            completed=completed,
                            total=total,
                            message=f"Fetched {source.name} ({report.found} found)",
                        )
                    )
            return report, candidates

        results = await asyncio.gather(
            *(run_one(source) for source in self._sources),
            return_exceptions=False,
        )

        reports: list[SourceReport] = []
        aggregated: list[ProxyCandidate] = []
        for report, candidates in results:
            reports.append(report)
            aggregated.extend(candidates)

        deduped = self._dedup.dedupe(aggregated)
        return ScrapeOutcome(candidates=deduped, reports=reports)
