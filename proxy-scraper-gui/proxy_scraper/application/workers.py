"""Background workers (Requirement 10, 11, 12).

All network / CPU-bound work runs here, off the Qt main thread. A single
:class:`PipelineWorker` (a ``QThread``) drives the whole scrape -> dedupe ->
validate pipeline on its own asyncio event loop and communicates exclusively
through Qt signals, so the UI never blocks and never touches the network.

Cancellation is cooperative: a flag is polled between units of work; workers
stop scheduling new checks and drain gracefully (Requirement 12.1).
"""

from __future__ import annotations

import asyncio
import logging
import threading

from PyQt6.QtCore import QThread, pyqtSignal

from proxy_scraper.domain.interfaces import ValidationConfig
from proxy_scraper.domain.models import (
    ProxyFilter,
    ProxyResult,
    ScrapeOutcome,
    ScrapeProgress,
)

logger = logging.getLogger(__name__)


class PipelineWorker(QThread):
    """Runs scraping + validation on a background thread.

    Signals (all delivered to the main thread via Qt's queued connections):
    * ``progress``  - a :class:`ScrapeProgress` update.
    * ``result``    - a validated :class:`ProxyResult` (alive or dead).
    * ``reports``   - the list of per-source :class:`SourceReport`.
    * ``finished_run`` - emitted once at the end; payload is ``cancelled``.
    * ``failed``    - emitted with an error string on catastrophic failure.
    """

    progress = pyqtSignal(object)
    result = pyqtSignal(object)
    reports = pyqtSignal(object)
    finished_run = pyqtSignal(bool)
    failed = pyqtSignal(str)

    def __init__(
        self,
        *,
        http_client_factory,
        scraper_manager,
        validation_engine,
        filter: ProxyFilter,
        config: ValidationConfig,
        concurrency: int = 100,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._http_client_factory = http_client_factory
        self._manager = scraper_manager
        self._engine = validation_engine
        self._filter = filter
        self._config = config
        self._concurrency = max(1, concurrency)
        self._cancel_event = threading.Event()

    # -- public API ----------------------------------------------------------

    def request_cancel(self) -> None:
        """Signal the worker to stop scheduling new work (Requirement 12.1)."""
        self._cancel_event.set()

    @property
    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    # -- QThread entry point -------------------------------------------------

    def run(self) -> None:  # noqa: D401 - QThread override
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._run_async())
        except Exception as exc:  # noqa: BLE001 - never crash the thread
            logger.exception("Pipeline worker crashed")
            self.failed.emit(str(exc))
        finally:
            try:
                loop.run_until_complete(loop.shutdown_asyncgens())
            except Exception:  # noqa: BLE001
                pass
            loop.close()
            self.finished_run.emit(self.is_cancelled)

    # -- pipeline ------------------------------------------------------------

    async def _run_async(self) -> None:
        client = self._http_client_factory()

        # Best-effort acquisition of the user's own public IP for anonymity
        # comparison (Requirement 4.3). Never fatal.
        ensure = getattr(self._engine, "ensure_own_ip", None)
        if callable(ensure):
            try:
                await ensure(self._config)
            except Exception:  # noqa: BLE001
                pass

        outcome: ScrapeOutcome = await self._manager.scrape_all(
            client,
            progress=self._emit_progress,
            is_cancelled=lambda: self.is_cancelled,
        )
        self.reports.emit(list(outcome.reports))

        if self.is_cancelled:
            return

        # Only validate candidates whose protocol is selected in the filter.
        candidates = [
            c for c in outcome.candidates if c.protocol in self._filter.protocols
        ]
        total = len(candidates)
        if total == 0:
            self._emit_progress(
                ScrapeProgress("validating", 0, 0, "No candidates to validate")
            )
            return

        semaphore = asyncio.Semaphore(self._concurrency)
        completed = 0
        lock = asyncio.Lock()

        async def check_one(candidate) -> None:
            nonlocal completed
            if self.is_cancelled:
                return
            async with semaphore:
                if self.is_cancelled:
                    return
                result: ProxyResult = await self._engine.check(candidate, self._config)
            async with lock:
                completed += 1
                self._emit_progress(
                    ScrapeProgress(
                        phase="validating",
                        completed=completed,
                        total=total,
                        message=f"Validated {completed}/{total}",
                    )
                )
            self.result.emit(result)

        await asyncio.gather(*(check_one(c) for c in candidates))

    # -- helpers -------------------------------------------------------------

    def _emit_progress(self, progress: ScrapeProgress) -> None:
        self.progress.emit(progress)
