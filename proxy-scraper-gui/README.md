# Proxy Scraper GUI

A standalone, cross-platform **Python 3.11 + PyQt6** desktop application that
harvests free proxy servers from multiple public internet sources, validates
each proxy for reachability, latency and anonymity, resolves each proxy's
country via geolocation, and presents only the working, high-quality
("premium") results. You can filter by a specific country or request results
from any/random country, and export the validated list as **CSV, TXT or JSON**.

> **"Premium" is a quality guarantee, not a paid tier.** A proxy is only shown
> if it is reachable, responds within your latency threshold, and its anonymity
> level has been classified.

---

## Features

- **Multi-source scraping** — pluggable adapters for HTML tables, plaintext
  lists, and JSON APIs, fetched concurrently with bounded parallelism.
- **Deduplication** by `(host, port, protocol)` before any connection attempt.
- **Validation** of HTTP / HTTPS / SOCKS4 / SOCKS5 proxies with latency
  measurement, retries, and **anonymity classification**
  (transparent / anonymous / elite).
- **Accurate geolocation** — offline GeoIP database first, with a free public
  API fallback and per-session caching.
- **Searchable country selector** with a **"Random / Any"** option.
- **Live, incremental results table** (sortable by country, latency, anonymity,
  protocol) that updates in batches to stay responsive.
- **Responsive UI** — all network/CPU work runs on background workers; the Qt
  main thread never touches the network.
- **Cancel** an in-progress run and keep the results gathered so far.
- **Export** to CSV / TXT / JSON, with clear success/failure feedback.
- **Safety first** — scraped proxies are treated as untrusted: only neutral
  "judge" requests (carrying no cookies/tokens/personal data) are routed through
  them.

---

## Architecture

The code follows a four-layer architecture:

```
proxy_scraper/
├── presentation/     # PyQt6 UI (MainWindow, widgets)
├── application/      # AppController + background QThread workers + filtering
├── domain/           # models, interfaces, ScraperManager, ValidationEngine,
│                     #   GeoLocationService, ExportService, Deduplicator
└── infrastructure/   # AsyncHttpClient + pluggable source adapters
main.py               # composition root — wires everything and launches Qt
```

- **Presentation** talks only to the `AppController` via Qt signals/slots.
- **Application** owns worker lifecycle and enforces the active filter.
- **Domain** holds pure business logic and service contracts (`typing.Protocol`).
- **Infrastructure** implements the HTTP client and source adapters.

---

## Requirements

- **Python 3.11+**
- The Python packages listed in [`requirements.txt`](requirements.txt):
  PyQt6, aiohttp, aiohttp-socks, beautifulsoup4, lxml, geoip2.

On headless Linux you may also need the Qt system libraries
(`libGL`, `libEGL`, `libxkbcommon`, `xcb-util-cursor`); on a normal desktop
these are already present.

---

## Installation

```bash
cd proxy-scraper-gui

# (recommended) create a virtual environment
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# install runtime dependencies
pip install -r requirements.txt

# …or install as an editable package (uses pyproject.toml)
pip install -e .
```

To also install the test tooling (pytest, pytest-qt, Hypothesis):

```bash
pip install -r requirements-dev.txt
```

---

## Running

```bash
python main.py
```

This launches the desktop window. Typical flow:

1. Pick a **country** (or leave it on *Random / Any*).
2. Choose one or more **protocols** and a **max latency** threshold.
3. Optionally tick **Require anonymous** to exclude transparent proxies.
4. Click **Start**. Results stream into the table as they are validated.
5. Click **Cancel** at any time — results found so far are kept.
6. Click **Export…** to save the list as CSV, TXT, or JSON.

---

## Offline GeoIP database (optional but recommended)

By default the app resolves countries using a **free public API fallback**
(`ip-api.com`). For faster, rate-limit-free resolution, drop a MaxMind
**GeoLite2-Country** database on disk and point the app at it:

- Place `GeoLite2-Country.mmdb` in the project root, **or**
- set the environment variable `GEOIP_DB_PATH=/path/to/GeoLite2-Country.mmdb`.

The service always tries the offline database first and only falls back to the
public API when no database entry is found. If neither can resolve an IP, the
country is reported as `??` (Unknown).

---

## Testing

```bash
pip install -r requirements-dev.txt

# run everything (unit + property-based tests)
pytest

# headless environments: use the offscreen Qt platform for UI tests
QT_QPA_PLATFORM=offscreen pytest
```

Tests include Hypothesis property tests validating the design's correctness
properties (deduplication, premium predicate, country-filter soundness,
latency consistency, export fidelity) plus unit tests for the source adapters,
export formats, and filter logic.

---

## Security & responsible use

- Scraped proxies are **untrusted third parties**. This tool never routes your
  sensitive traffic through them — it only issues neutral judge requests that
  carry no cookies, tokens, or personal data.
- Adapters use a descriptive User-Agent and reasonable request rates. Please
  respect each source's terms of service and rate limits.
- This is a defensive tool for validating proxies for your own use — not a
  scraping-abuse tool.

---

## License

MIT.
