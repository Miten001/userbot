"""Composition root and entry point for Proxy Scraper GUI.

Wires together the infrastructure, domain and application layers, constructs the
PyQt6 MainWindow, and launches the Qt event loop.

Run with::

    python main.py
"""

from __future__ import annotations

import logging
import sys

logger = logging.getLogger(__name__)


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )


def build_controller():
    """Assemble the domain/application services and return an AppController.

    Importing PyQt6-dependent modules lazily here keeps the pure domain layer
    importable without a Qt installation.
    """
    from proxy_scraper.application.app_controller import AppController
    from proxy_scraper.domain.export_service import DefaultExportService
    from proxy_scraper.domain.geolocation import GeoLocationService
    from proxy_scraper.domain.scraper_manager import DefaultScraperManager
    from proxy_scraper.domain.validation_engine import DefaultValidationEngine
    from proxy_scraper.infrastructure.http_client import AsyncHttpClient
    from proxy_scraper.infrastructure.seen_proxy_store import JsonSeenProxyStore
    from proxy_scraper.infrastructure.source_registry import default_sources

    # Infrastructure: a factory so each background run gets a fresh client
    # bound to that worker's event loop.
    def http_client_factory() -> AsyncHttpClient:
        return AsyncHttpClient(default_timeout=8.0)

    # A dedicated client for geolocation API fallback (used on the worker loop).
    geo_client = AsyncHttpClient(default_timeout=6.0)
    geo_service = GeoLocationService(client=geo_client)

    # Domain services.
    scraper_manager = DefaultScraperManager(max_concurrency=8)
    for source in default_sources():
        scraper_manager.register(source)

    validation_engine = DefaultValidationEngine(
        client=http_client_factory(), geo=geo_service
    )
    export_service = DefaultExportService()

    # Persistent cross-session seen-proxy history (Requirement 19). Load the
    # previously-saved history from disk on startup so IPs surfaced on prior
    # runs (including on earlier days) are never surfaced again.
    seen_store = JsonSeenProxyStore()
    seen_store.load()
    logger.info("Seen-proxy history holds %d host(s) at %s", len(seen_store), seen_store.path)

    controller = AppController(
        http_client_factory=http_client_factory,
        scraper_manager=scraper_manager,
        validation_engine=validation_engine,
        export_service=export_service,
        seen_store=seen_store,
        concurrency=100,
    )
    return controller, geo_service


def main() -> int:
    _configure_logging()

    from PyQt6.QtWidgets import QApplication

    from proxy_scraper.presentation.main_window import MainWindow

    app = QApplication(sys.argv)
    app.setApplicationName("Proxy Scraper GUI")

    controller, geo_service = build_controller()
    window = MainWindow(controller)

    # Clean up the offline GeoIP reader on shutdown.
    app.aboutToQuit.connect(geo_service.close)

    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
