"""Proxy Scraper GUI.

A standalone, cross-platform PyQt6 desktop application that harvests free
proxy servers from multiple public sources, validates each proxy for
reachability / latency / anonymity, resolves each proxy's country via
geolocation, and presents only the working, high-quality ("premium") results.

The package is organized into four layers following the design document:

* ``proxy_scraper.domain``          - data models, interfaces and pure services
* ``proxy_scraper.infrastructure``  - HTTP client and pluggable source adapters
* ``proxy_scraper.application``     - orchestration (controller + workers)
* ``proxy_scraper.presentation``    - PyQt6 UI (MainWindow, widgets)
"""

__version__ = "1.0.0"
