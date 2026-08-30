"""AppController: orchestrates the end-to-end workflow.

Mediates all communication between the UI and the domain services, owns the
background worker lifecycle, and enforces the active :class:`ProxyFilter` on
the display path (Requirement 6, 7, 9, 10, 12). It contains no widget code and
performs no low-level networking - it coordinates.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

from PyQt6.QtCore import QObject, pyqtSignal

from proxy_scraper.application.filtering import should_display, validate_filter
from proxy_scraper.application.workers import PipelineWorker
from proxy_scraper.domain.interfaces import SeenProxyStore, ValidationConfig
from proxy_scraper.domain.models import (
    ExportFormat,
    ExportOutcome,
    ProxyFilter,
    ProxyResult,
    ScrapeProgress,
    SourceReport,
)

logger = logging.getLogger(__name__)


class AppController(QObject):
    """Coordinates scraping/validation workers and the UI."""

    # Signals the UI connects to. Emitting from here (main thread) keeps the
    # UI decoupled from the worker threads.
    progressChanged = pyqtSignal(object)   # ScrapeProgress
    resultReady = pyqtSignal(object)       # ProxyResult (passed the filter)
    reportsReady = pyqtSignal(object)      # list[SourceReport]
    runFinished = pyqtSignal(bool)         # cancelled?
    runFailed = pyqtSignal(str)

    def __init__(
        self,
        *,
        http_client_factory,
        scraper_manager,
        validation_engine,
        export_service,
        seen_store: Optional[SeenProxyStore] = None,
        concurrency: int = 100,
        parent: Optional[QObject] = None,
    ) -> None:
        super().__init__(parent)
        self._http_client_factory = http_client_factory
        self._manager = scraper_manager
        self._engine = validation_engine
        self._export = export_service
        self._concurrency = concurrency

        # Persistent cross-session seen-proxy history (Component 7,
        # Requirement 19). Injected for tests; defaults to the disk-backed
        # JSON store at the platform data directory. The default instance is
        # loaded eagerly so its history is consulted from the first run.
        if seen_store is None:
            from proxy_scraper.infrastructure.seen_proxy_store import (
                JsonSeenProxyStore,
            )

            seen_store = JsonSeenProxyStore()
            seen_store.load()
        self._seen_store: SeenProxyStore = seen_store

        self._worker: Optional[PipelineWorker] = None
        self._filter: Optional[ProxyFilter] = None
        # All alive results retained for export, even those filtered from view
        # is NOT desired: we retain only what the user sees. We keep displayed
        # (premium, filtered) results here (Requirement 12.2).
        self._displayed: list[ProxyResult] = []
        # Hosts surfaced during the *current* run, so at most one result per
        # host is surfaced within a single run (Requirement 19.3).
        self._surfaced_this_run: set[str] = set()

    # -- lifecycle -----------------------------------------------------------

    @property
    def is_running(self) -> bool:
        return self._worker is not None and self._worker.isRunning()

    @property
    def displayed_results(self) -> list[ProxyResult]:
        """The results currently shown (and therefore exportable)."""
        return list(self._displayed)

    @property
    def seen_store(self) -> SeenProxyStore:
        """The persistent seen-proxy history backing the display path."""
        return self._seen_store

    def start_scrape(self, filter: ProxyFilter) -> None:
        """Kick off scraping + validation on a background worker. Non-blocking.

        Raises :class:`FilterValidationError` if the filter is invalid
        (Requirement 8.2, 8.3) - the UI should surface this before starting.
        """
        if self.is_running:
            logger.info("start_scrape ignored: a run is already in progress")
            return

        validate_filter(filter)
        self._filter = filter
        self._displayed = []
        self._surfaced_this_run = set()

        config = ValidationConfig(max_latency_ms=filter.max_latency_ms)
        worker = PipelineWorker(
            http_client_factory=self._http_client_factory,
            scraper_manager=self._manager,
            validation_engine=self._engine,
            filter=filter,
            config=config,
            concurrency=self._concurrency,
        )
        worker.progress.connect(self._on_worker_progress)
        worker.result.connect(self._on_worker_result)
        worker.reports.connect(self._on_worker_reports)
        worker.finished_run.connect(self._on_worker_finished)
        worker.failed.connect(self._on_worker_failed)
        self._worker = worker
        worker.start()

    def cancel(self) -> None:
        """Request cancellation of any in-flight run (Requirement 12.1)."""
        if self._worker is not None and self._worker.isRunning():
            self._worker.request_cancel()

    def clear_seen_history(self) -> None:
        """Wipe the persistent seen-proxy history so previously-surfaced IPs
        may appear again on future runs (Requirement 19.4). Empties the store
        both in memory and on disk, and forgets hosts surfaced in the current
        run so they too become eligible again. Wired to a UI action."""
        self._seen_store.clear()
        self._surfaced_this_run = set()

    # -- export --------------------------------------------------------------

    def export(
        self,
        results: list[ProxyResult],
        fmt: ExportFormat,
        path: str,
    ) -> ExportOutcome:
        """Persist validated results to disk (Requirement 13)."""
        return self._export.export(results, fmt, path)

    # -- optional callback registration (design Component 1) -----------------

    def on_progress(self, callback: Callable[[ScrapeProgress], None]) -> None:
        self.progressChanged.connect(callback)

    def on_result(self, callback: Callable[[ProxyResult], None]) -> None:
        self.resultReady.connect(callback)

    # -- worker signal handlers (run on the main thread) ---------------------

    def _on_worker_progress(self, progress: ScrapeProgress) -> None:
        self.progressChanged.emit(progress)

    def _on_worker_result(self, result: ProxyResult) -> None:
        # Enforce the active filter on the display path: only alive results
        # that pass country/protocol/premium are surfaced (Requirement 7.1,
        # 6.2-6.4, 7.2, 7.3 / Property 1).
        if self._filter is None:
            return
        if not should_display(result, self._filter):
            return

        host = result.host
        # Never surface a host already recorded on this or any prior run
        # (Requirement 19.2 / Property 9), and surface at most one result per
        # host within a single run (Requirement 19.3).
        if host in self._surfaced_this_run or self._seen_store.contains(host):
            return

        # Record the host ONLY because it is actually being surfaced, and
        # persist promptly so a crash/close still remembers it (Requirement
        # 19.1, 19.3 / Property 10).
        self._surfaced_this_run.add(host)
        self._seen_store.add(host)
        self._seen_store.save()

        self._displayed.append(result)
        self.resultReady.emit(result)

    def _on_worker_reports(self, reports: list[SourceReport]) -> None:
        self.reportsReady.emit(reports)

    def _on_worker_finished(self, cancelled: bool) -> None:
        # Results validated before cancellation remain visible/exportable
        # (Requirement 12.2). We simply clean up the worker and go idle.
        self.runFinished.emit(cancelled)
        if self._worker is not None:
            self._worker.deleteLater()
            self._worker = None

    def _on_worker_failed(self, error: str) -> None:
        self.runFailed.emit(error)
