"""ExportService: serialize validated results to CSV, TXT or JSON.

Guarantees (Requirement 13, Property 8):
* TXT writes one ``host:port`` line per result (Requirement 13.2).
* CSV / JSON include country, latency, anonymity and protocol metadata
  (Requirement 13.3).
* ``records_written`` equals the number of results passed, and the file on
  disk contains exactly those records (Requirement 13.4, 13.5).
* On an unwritable destination, returns ``ExportOutcome(success=False, ...)``
  rather than raising (Requirement 13.6). Writes only to the user-chosen path
  (Requirement 18.3).
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
from typing import Iterable

from proxy_scraper.domain.models import (
    ExportFormat,
    ExportOutcome,
    ProxyResult,
)

logger = logging.getLogger(__name__)

_CSV_FIELDS = [
    "host",
    "port",
    "protocol",
    "country_code",
    "country_name",
    "latency_ms",
    "anonymity",
    "alive",
    "checked_at",
]


class DefaultExportService:
    """Concrete ExportService."""

    def export(
        self,
        results: list[ProxyResult],
        fmt: ExportFormat,
        path: str,
    ) -> ExportOutcome:
        results = list(results)
        try:
            content = self._serialize(results, fmt)
        except Exception as exc:  # noqa: BLE001 - serialization must not raise
            logger.warning("Export serialization failed: %s", exc)
            return ExportOutcome(
                success=False, records_written=0, path=path, error=str(exc)
            )

        try:
            # Ensure parent directory exists only if it was specified.
            parent = os.path.dirname(os.path.abspath(path))
            if parent and not os.path.isdir(parent):
                os.makedirs(parent, exist_ok=True)
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.write(content)
        except (OSError, IOError, ValueError) as exc:
            logger.warning("Export write failed for %s: %s", path, exc)
            return ExportOutcome(
                success=False, records_written=0, path=path, error=str(exc)
            )

        return ExportOutcome(
            success=True,
            records_written=len(results),
            path=path,
            error=None,
        )

    # -- serialization -------------------------------------------------------

    def _serialize(self, results: list[ProxyResult], fmt: ExportFormat) -> str:
        if fmt == ExportFormat.TXT:
            return self._to_txt(results)
        if fmt == ExportFormat.CSV:
            return self._to_csv(results)
        if fmt == ExportFormat.JSON:
            return self._to_json(results)
        raise ValueError(f"Unsupported export format: {fmt!r}")

    @staticmethod
    def _to_txt(results: Iterable[ProxyResult]) -> str:
        return "".join(f"{r.host}:{r.port}\n" for r in results)

    @staticmethod
    def _row(result: ProxyResult) -> dict:
        return {
            "host": result.host,
            "port": result.port,
            "protocol": result.protocol.value,
            "country_code": result.country_code,
            "country_name": result.country_name,
            "latency_ms": result.latency_ms if result.latency_ms is not None else "",
            "anonymity": result.anonymity.value,
            "alive": result.alive,
            "checked_at": result.checked_at,
        }

    def _to_csv(self, results: list[ProxyResult]) -> str:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for result in results:
            writer.writerow(self._row(result))
        return buffer.getvalue()

    def _to_json(self, results: list[ProxyResult]) -> str:
        rows = []
        for result in results:
            row = self._row(result)
            # JSON uses null (not "") for a missing latency.
            row["latency_ms"] = result.latency_ms
            rows.append(row)
        return json.dumps(rows, indent=2)
