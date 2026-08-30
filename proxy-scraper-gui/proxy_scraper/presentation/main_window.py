"""PyQt6 MainWindow - the presentation layer.

Hosts the searchable country selector (with a "Random / Any" option), protocol
and latency filter controls, Start/Cancel buttons, a live progress bar, a
sortable results table that updates incrementally in batches, an export dialog,
an empty-state message, and a per-source completion summary.

The window performs **no** network I/O (Requirement 10.3); it only talks to the
:class:`AppController` and reacts to its Qt signals.
"""

from __future__ import annotations

import logging
from typing import Optional

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QCompleter,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QSpinBox,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from proxy_scraper.application.app_controller import AppController
from proxy_scraper.application.filtering import FilterValidationError, normalize_filter
from proxy_scraper.domain.countries import sorted_countries
from proxy_scraper.domain.models import (
    ANY_COUNTRY,
    DEFAULT_MAX_LATENCY_MS,
    AnonymityFilter,
    ExportFormat,
    ProxyProtocol,
    ProxyResult,
    ScrapeProgress,
    SourceReport,
)

logger = logging.getLogger(__name__)

_COLUMNS = ["Country", "Host", "Port", "Protocol", "Latency (ms)", "Anonymity"]
_BATCH_INTERVAL_MS = 250


class MainWindow(QMainWindow):
    def __init__(self, controller: AppController, parent=None) -> None:
        super().__init__(parent)
        self._controller = controller
        self._result_buffer: list[ProxyResult] = []

        self.setWindowTitle("Proxy Scraper GUI — by @codex_here")
        self.resize(1000, 680)

        self._build_ui()
        self._build_menu()
        self._connect_controller()

        # Batch table updates so we do not repaint per individual result
        # (Requirement 9.2).
        self._flush_timer = QTimer(self)
        self._flush_timer.setInterval(_BATCH_INTERVAL_MS)
        self._flush_timer.timeout.connect(self._flush_results)

    # -- UI construction -----------------------------------------------------

    def _build_ui(self) -> None:
        central = QWidget()
        root = QVBoxLayout(central)

        root.addWidget(self._build_filter_panel())
        root.addWidget(self._build_action_bar())
        root.addWidget(self._build_progress_bar())
        root.addWidget(self._build_results_area(), stretch=1)
        root.addWidget(self._build_status_bar())

        self.setCentralWidget(central)

    def _build_menu(self) -> None:
        """Build the menu bar with a Tools menu hosting the 'Clear seen
        history' action (Requirement 19.4, 19.6)."""
        tools_menu = self.menuBar().addMenu("&Tools")
        self.clear_seen_action = QAction("Clear seen history…", self)
        self.clear_seen_action.setToolTip(
            "Forget every proxy IP surfaced so far so they may appear again."
        )
        self.clear_seen_action.triggered.connect(self._on_clear_seen_history)
        tools_menu.addAction(self.clear_seen_action)

    def _build_filter_panel(self) -> QWidget:
        box = QGroupBox("Filters")
        layout = QHBoxLayout(box)

        # Searchable country selector with a "Random / Any" option (Req 6.1).
        country_col = QVBoxLayout()
        country_col.addWidget(QLabel("Country"))
        self.country_combo = QComboBox()
        self.country_combo.setEditable(True)
        self.country_combo.addItem("Random / Any", userData=ANY_COUNTRY)
        for code, name in sorted_countries():
            self.country_combo.addItem(f"{name} ({code})", userData=code)
        self.country_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        completer = QCompleter(
            [self.country_combo.itemText(i) for i in range(self.country_combo.count())]
        )
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        completer.setFilterMode(Qt.MatchFlag.MatchContains)
        self.country_combo.setCompleter(completer)
        country_col.addWidget(self.country_combo)
        layout.addLayout(country_col)

        # Protocol multi-select (Requirement 8.1).
        proto_col = QVBoxLayout()
        proto_col.addWidget(QLabel("Protocols"))
        self.protocol_checks: dict[ProxyProtocol, QCheckBox] = {}
        proto_row = QHBoxLayout()
        for proto in ProxyProtocol:
            cb = QCheckBox(proto.value.upper())
            cb.setChecked(proto in (ProxyProtocol.HTTP, ProxyProtocol.HTTPS))
            self.protocol_checks[proto] = cb
            proto_row.addWidget(cb)
        proto_col.addLayout(proto_row)
        layout.addLayout(proto_col)

        # Max latency threshold (Requirement 8.1, 8.4).
        latency_col = QVBoxLayout()
        latency_col.addWidget(QLabel("Max latency (ms)"))
        self.latency_spin = QSpinBox()
        self.latency_spin.setRange(1, 60000)
        self.latency_spin.setSingleStep(250)
        self.latency_spin.setValue(DEFAULT_MAX_LATENCY_MS)
        latency_col.addWidget(self.latency_spin)
        layout.addLayout(latency_col)

        # Anonymity-level selector (Requirement 8.5-8.7). Exactly three
        # options mapping to the AnonymityFilter values; defaults to
        # "Elite only" so only proxies the destination site cannot detect
        # are shown (Requirement 7.6, 8.6).
        anon_col = QVBoxLayout()
        anon_col.addWidget(QLabel("Anonymity"))
        self.anon_combo = QComboBox()
        self.anon_combo.addItem("Any", userData=AnonymityFilter.ANY)
        self.anon_combo.addItem(
            "Anonymous or better", userData=AnonymityFilter.ANONYMOUS_OR_BETTER
        )
        self.anon_combo.addItem("Elite only", userData=AnonymityFilter.ELITE_ONLY)
        # Default selection: "Elite only".
        self.anon_combo.setCurrentIndex(
            self.anon_combo.findData(AnonymityFilter.ELITE_ONLY)
        )
        anon_col.addWidget(self.anon_combo)
        anon_col.addStretch()
        layout.addLayout(anon_col)

        return box

    def _build_action_bar(self) -> QWidget:
        bar = QWidget()
        layout = QHBoxLayout(bar)
        self.start_btn = QPushButton("Start")
        self.cancel_btn = QPushButton("Cancel")
        self.export_btn = QPushButton("Export…")
        self.cancel_btn.setEnabled(False)
        self.export_btn.setEnabled(False)
        self.start_btn.clicked.connect(self._on_start_clicked)
        self.cancel_btn.clicked.connect(self._on_cancel_clicked)
        self.export_btn.clicked.connect(self._on_export_clicked)
        layout.addWidget(self.start_btn)
        layout.addWidget(self.cancel_btn)
        layout.addStretch()
        layout.addWidget(self.export_btn)
        return bar

    def _build_progress_bar(self) -> QWidget:
        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.setFormat("Idle")
        return self.progress

    def _build_results_area(self) -> QWidget:
        # A stack: index 0 = results table, index 1 = empty-state message.
        self.results_stack = QStackedWidget()

        self.table = QTableWidget(0, len(_COLUMNS))
        self.table.setHorizontalHeaderLabels(_COLUMNS)
        self.table.setSortingEnabled(True)  # sortable columns (Req 9.3)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.results_stack.addWidget(self.table)

        self.empty_label = QLabel(
            "No proxies to show yet.\n\n"
            "Tips: loosen the latency threshold, choose the \"Random / Any\" "
            "country, select more protocols, or click Start to try again."
        )
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setWordWrap(True)
        self.results_stack.addWidget(self.empty_label)

        self.results_stack.setCurrentWidget(self.empty_label)
        return self.results_stack

    def _build_status_bar(self) -> QWidget:
        bar = QWidget()
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(0, 0, 0, 0)

        self.status_label = QLabel("Ready.")
        self.status_label.setTextInteractionFlags(
            Qt.TextInteractionFlag.TextSelectableByMouse
        )
        layout.addWidget(self.status_label)
        layout.addStretch()

        # Permanent, unobtrusive attribution on the right of the status bar.
        self.credit_label = QLabel("Created by @codex_here")
        self.credit_label.setStyleSheet("color: gray; font-size: 11px;")
        self.credit_label.setAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        self.credit_label.setTextInteractionFlags(
            Qt.TextInteractionFlag.TextSelectableByMouse
        )
        layout.addWidget(self.credit_label)

        return bar

    # -- controller wiring ---------------------------------------------------

    def _connect_controller(self) -> None:
        self._controller.progressChanged.connect(self._on_progress)
        self._controller.resultReady.connect(self._on_result)
        self._controller.reportsReady.connect(self._on_reports)
        self._controller.runFinished.connect(self._on_finished)
        self._controller.runFailed.connect(self._on_failed)

    # -- filter assembly -----------------------------------------------------

    def _selected_country(self) -> Optional[str]:
        data = self.country_combo.currentData()
        if data is None or data == ANY_COUNTRY:
            return None
        return str(data)

    def _selected_protocols(self) -> frozenset[ProxyProtocol]:
        return frozenset(
            proto for proto, cb in self.protocol_checks.items() if cb.isChecked()
        )

    def _selected_anonymity(self) -> AnonymityFilter:
        data = self.anon_combo.currentData()
        if isinstance(data, AnonymityFilter):
            return data
        return AnonymityFilter.ELITE_ONLY

    def _build_filter(self):
        return normalize_filter(
            country_code=self._selected_country(),
            protocols=self._selected_protocols(),
            max_latency_ms=self.latency_spin.value(),
            min_anonymity=self._selected_anonymity(),
        )

    # -- actions -------------------------------------------------------------

    def _on_start_clicked(self) -> None:
        try:
            proxy_filter = self._build_filter()
        except FilterValidationError as exc:
            QMessageBox.warning(self, "Invalid filter", str(exc))
            return

        # Reset the view for a fresh run.
        self.table.setSortingEnabled(False)
        self.table.setRowCount(0)
        self.table.setSortingEnabled(True)
        self._result_buffer.clear()
        self.results_stack.setCurrentWidget(self.table)

        self._set_running(True)
        self.progress.setValue(0)
        self.progress.setFormat("Starting…")
        self.status_label.setText("Scraping sources…")

        try:
            self._controller.start_scrape(proxy_filter)
        except FilterValidationError as exc:
            QMessageBox.warning(self, "Invalid filter", str(exc))
            self._set_running(False)
            return
        self._flush_timer.start()

    def _on_cancel_clicked(self) -> None:
        self.status_label.setText("Cancelling… draining in-flight checks.")
        self._controller.cancel()

    def _on_clear_seen_history(self) -> None:
        """Confirm and clear the persistent seen-proxy history so previously
        surfaced IPs may appear again (Requirement 19.4, 19.6)."""
        reply = QMessageBox.question(
            self,
            "Clear seen history",
            "Forget every proxy IP that has been surfaced so far?\n\n"
            "Previously-shown proxies will then be eligible to appear again "
            "on future runs. This cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        self._controller.clear_seen_history()
        self.status_label.setText("Seen-proxy history cleared.")

    def _on_export_clicked(self) -> None:
        results = self._controller.displayed_results
        if not results:
            QMessageBox.information(self, "Nothing to export", "There are no results to export.")
            return
        self._open_export_dialog(results)

    def _open_export_dialog(self, results: list[ProxyResult]) -> None:
        path, selected_filter = QFileDialog.getSaveFileName(
            self,
            "Export proxies",
            "proxies.csv",
            "CSV (*.csv);;Plain text (*.txt);;JSON (*.json)",
        )
        if not path:
            return
        fmt = self._format_from_selection(path, selected_filter)
        outcome = self._controller.export(results, fmt, path)
        if outcome.success:
            QMessageBox.information(
                self,
                "Export complete",
                f"Wrote {outcome.records_written} proxies to:\n{outcome.path}",
            )
        else:
            # On failure, show the error and re-open the dialog (Req 16.1).
            QMessageBox.critical(
                self, "Export failed", f"Could not export:\n{outcome.error}"
            )
            self._open_export_dialog(results)

    @staticmethod
    def _format_from_selection(path: str, selected_filter: str) -> ExportFormat:
        lower = path.lower()
        if lower.endswith(".txt"):
            return ExportFormat.TXT
        if lower.endswith(".json"):
            return ExportFormat.JSON
        if lower.endswith(".csv"):
            return ExportFormat.CSV
        if "txt" in selected_filter.lower():
            return ExportFormat.TXT
        if "json" in selected_filter.lower():
            return ExportFormat.JSON
        return ExportFormat.CSV

    # -- controller signal slots ---------------------------------------------

    def _on_progress(self, progress: ScrapeProgress) -> None:
        self.progress.setValue(int(progress.fraction * 100))
        phase = progress.phase.capitalize()
        self.progress.setFormat(
            f"{phase}: {progress.completed}/{progress.total}"
        )
        if progress.message:
            self.status_label.setText(progress.message)

    def _on_result(self, result: ProxyResult) -> None:
        # Buffer; the batch timer flushes into the table (Requirement 9.2).
        self._result_buffer.append(result)

    def _flush_results(self) -> None:
        if not self._result_buffer:
            return
        batch = self._result_buffer
        self._result_buffer = []

        self.table.setSortingEnabled(False)
        for result in batch:
            self._append_row(result)
        self.table.setSortingEnabled(True)

        if self.table.rowCount() > 0:
            self.results_stack.setCurrentWidget(self.table)

    def _append_row(self, result: ProxyResult) -> None:
        row = self.table.rowCount()
        self.table.insertRow(row)

        latency_item = QTableWidgetItem()
        latency_item.setData(
            Qt.ItemDataRole.DisplayRole,
            int(result.latency_ms) if result.latency_ms is not None else 0,
        )
        port_item = QTableWidgetItem()
        port_item.setData(Qt.ItemDataRole.DisplayRole, int(result.port))

        cells = [
            QTableWidgetItem(f"{result.country_name} ({result.country_code})"),
            QTableWidgetItem(result.host),
            port_item,
            QTableWidgetItem(result.protocol.value.upper()),
            latency_item,
            QTableWidgetItem(result.anonymity.value),
        ]
        for col, item in enumerate(cells):
            self.table.setItem(row, col, item)

    def _on_reports(self, reports: list[SourceReport]) -> None:
        succeeded = sum(1 for r in reports if r.succeeded)
        failed = len(reports) - succeeded
        total_found = sum(r.found for r in reports)
        self.status_label.setText(
            f"Sources: {succeeded} succeeded, {failed} failed — "
            f"{total_found} candidates found. Validating…"
        )

    def _on_finished(self, cancelled: bool) -> None:
        self._flush_timer.stop()
        self._flush_results()  # flush any remaining buffered results
        self._set_running(False)

        has_results = self.table.rowCount() > 0
        self.export_btn.setEnabled(has_results)
        if not has_results:
            self.results_stack.setCurrentWidget(self.empty_label)

        if cancelled:
            self.progress.setFormat("Cancelled")
            self.status_label.setText(
                f"Cancelled. {self.table.rowCount()} proxies retained."
            )
        else:
            self.progress.setValue(100)
            self.progress.setFormat("Done")
            self.status_label.setText(
                f"Finished. {self.table.rowCount()} premium proxies found."
            )

    def _on_failed(self, error: str) -> None:
        self._flush_timer.stop()
        self._set_running(False)
        QMessageBox.critical(self, "Run failed", f"The run failed:\n{error}")
        self.status_label.setText(f"Failed: {error}")

    # -- helpers -------------------------------------------------------------

    def _set_running(self, running: bool) -> None:
        self.start_btn.setEnabled(not running)
        self.cancel_btn.setEnabled(running)
        # Filter controls are locked during a run.
        self.country_combo.setEnabled(not running)
        self.latency_spin.setEnabled(not running)
        self.anon_combo.setEnabled(not running)
        for cb in self.protocol_checks.values():
            cb.setEnabled(not running)
        if not running:
            self.export_btn.setEnabled(self.table.rowCount() > 0)
