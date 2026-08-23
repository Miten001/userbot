"""Pluggable proxy source adapters (HTML table, plaintext list, JSON API)."""

from proxy_scraper.infrastructure.sources.html_table_source import HtmlTableSource
from proxy_scraper.infrastructure.sources.json_api_source import JsonApiSource
from proxy_scraper.infrastructure.sources.plaintext_source import PlaintextListSource

__all__ = ["HtmlTableSource", "JsonApiSource", "PlaintextListSource"]
