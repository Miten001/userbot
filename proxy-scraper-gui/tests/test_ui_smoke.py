"""UI smoke tests (Task 15.3, Property 7).

These verify that controller signals update the progress bar and results table
without blocking the main thread, and that the empty-state renders. They use
pytest-qt; if it is not installed the module is skipped.
"""

from __future__ import annotations

import time

import pytest

pytest.importorskip("pytestqt")

from proxy_scraper.application.app_controller import AppController  # noqa: E402
from proxy_scraper.domain.models import (  # noqa: E402
    AnonymityLevel,
    ProxyCandidate,
    ProxyFilter,
    ProxyProtocol,
    ProxyResult,
    ScrapeProgress,
    SourceReport,
)
from proxy_scraper.presentation.main_window import MainWindow  # noqa: E402


class _NullExport:
    def export(self, results, fmt, path):  # pragma: no cover - unused here
        from proxy_scraper.domain.models import ExportOutcome

        return ExportOutcome(True, len(results), path, None)


def _make_controller():
    return AppController(
        http_client_factory=lambda: None,
        scraper_manager=None,
        validation_engine=None,
        export_service=_NullExport(),
    )


def _alive_result(code="US", latency=100):
    return ProxyResult(
        ProxyCandidate("1.2.3.4", 8080, ProxyProtocol.HTTP, "t"),
        alive=True,
        latency_ms=latency,
        country_code=code,
        country_name="United States",
        anonymity=AnonymityLevel.ELITE,
    )


def test_progress_updates_bar(qtbot):
    controller = _make_controller()
    window = MainWindow(controller)
    qtbot.addWidget(window)

    controller.progressChanged.emit(ScrapeProgress("validating", 5, 10, "half"))
    assert window.progress.value() == 50


def test_results_flush_into_table(qtbot):
    controller = _make_controller()
    window = MainWindow(controller)
    qtbot.addWidget(window)

    # Simulate a run having started so the filter is active.
    controller._filter = ProxyFilter(protocols=frozenset({ProxyProtocol.HTTP}))
    window._flush_timer.start()

    controller._on_worker_result(_alive_result())
    controller._on_worker_result(_alive_result(latency=250))

    # Wait for the batch timer to flush.
    qtbot.waitUntil(lambda: window.table.rowCount() == 2, timeout=2000)
    assert window.table.rowCount() == 2


def test_empty_state_shown_when_no_results(qtbot):
    controller = _make_controller()
    window = MainWindow(controller)
    qtbot.addWidget(window)

    controller.runFinished.emit(False)
    assert window.results_stack.currentWidget() is window.empty_label


def test_source_summary_reported(qtbot):
    controller = _make_controller()
    window = MainWindow(controller)
    qtbot.addWidget(window)

    reports = [SourceReport("a", 10), SourceReport("b", 0, error="boom")]
    controller.reportsReady.emit(reports)
    text = window.status_label.text()
    assert "1 succeeded" in text and "1 failed" in text
