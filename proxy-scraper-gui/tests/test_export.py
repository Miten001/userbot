"""Export service tests (Tasks 12.2, 12.3 - Property 8)."""

from __future__ import annotations

import csv
import json
import os

from hypothesis import given
from hypothesis import strategies as st

from proxy_scraper.domain.export_service import DefaultExportService
from proxy_scraper.domain.models import ExportFormat
from tests.conftest import result_strategy


def _alive_results():
    # Only alive results are ever exported by the UI, but the exporter must be
    # faithful for any list; use alive results for stable content assertions.
    return st.lists(result_strategy(), max_size=30)


# --- Task 12.2: Property 8 - export fidelity -------------------------------


@given(results=_alive_results(), fmt=st.sampled_from(list(ExportFormat)))
def test_export_records_written_matches_input(tmp_path_factory, results, fmt):
    path = str(tmp_path_factory.mktemp("exp") / f"out.{fmt.value}")
    outcome = DefaultExportService().export(results, fmt, path)
    assert outcome.success is True
    assert outcome.records_written == len(results)

    with open(path, encoding="utf-8") as fh:
        content = fh.read()

    if fmt == ExportFormat.TXT:
        lines = [ln for ln in content.splitlines() if ln.strip()]
        assert len(lines) == len(results)
    elif fmt == ExportFormat.JSON:
        assert len(json.loads(content)) == len(results)
    else:  # CSV
        rows = list(csv.DictReader(content.splitlines()))
        assert len(rows) == len(results)


# --- Task 12.3: format specifics + write failure ---------------------------


def test_txt_uses_host_port_lines(tmp_path):
    from proxy_scraper.domain.models import (
        AnonymityLevel,
        ProxyCandidate,
        ProxyProtocol,
        ProxyResult,
    )

    r = ProxyResult(
        ProxyCandidate("1.2.3.4", 8080, ProxyProtocol.HTTP, "t"),
        alive=True,
        latency_ms=120,
        country_code="US",
        country_name="United States",
        anonymity=AnonymityLevel.ELITE,
    )
    path = str(tmp_path / "out.txt")
    DefaultExportService().export([r], ExportFormat.TXT, path)
    assert open(path).read().strip() == "1.2.3.4:8080"


def test_csv_includes_metadata_columns(tmp_path):
    from proxy_scraper.domain.models import (
        AnonymityLevel,
        ProxyCandidate,
        ProxyProtocol,
        ProxyResult,
    )

    r = ProxyResult(
        ProxyCandidate("1.2.3.4", 8080, ProxyProtocol.HTTP, "t"),
        alive=True,
        latency_ms=120,
        country_code="US",
        country_name="United States",
        anonymity=AnonymityLevel.ANONYMOUS,
    )
    path = str(tmp_path / "out.csv")
    DefaultExportService().export([r], ExportFormat.CSV, path)
    rows = list(csv.DictReader(open(path).read().splitlines()))
    assert rows[0]["country_code"] == "US"
    assert rows[0]["latency_ms"] == "120"
    assert rows[0]["anonymity"] == "anonymous"
    assert rows[0]["protocol"] == "http"


def test_unwritable_path_returns_failure_outcome():
    outcome = DefaultExportService().export(
        [], ExportFormat.CSV, "/this/does/not/exist/\x00bad/out.csv"
    )
    assert outcome.success is False
    assert outcome.error
    assert outcome.records_written == 0
