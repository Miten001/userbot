# Implementation Plan: Proxy Scraper GUI

## Overview

This plan converts the Proxy Scraper GUI design into a series of incremental, testable coding steps in **Python 3.11** using **PyQt6**. It follows the layered architecture from the design (Presentation / Application / Domain / Infrastructure) and builds bottom-up: shared data models and validation first, then infrastructure (HTTP client, source adapters, GeoIP), then domain services (ScraperManager, ValidationEngine, GeoLocationService, ExportService), then the AppController orchestration layer, and finally the PyQt6 MainWindow — wiring everything together at the end so no code is orphaned.

Testing uses **pytest**, **pytest-qt**, and **Hypothesis**. Property-based tests validate the correctness properties from the design; unit and integration tests cover examples and edge cases. Test sub-tasks are marked optional with `*`.

## Tasks

- [ ] 1. Set up project structure, tooling, and core enums
  - Create the package layout: `proxy_scraper/{presentation,application,domain,infrastructure}/` with `__init__.py` files, plus a top-level `main.py` entry point stub.
  - Add `pyproject.toml` / `requirements.txt` declaring Python 3.11 and dependencies: PyQt6, aiohttp (or httpx), aiohttp-socks/PySocks, beautifulsoup4, lxml, geoip2, pytest, pytest-qt, hypothesis.
  - Configure pytest (`pytest.ini`/`pyproject` `[tool.pytest.ini_options]`) and a `tests/` directory with fixtures folder.
  - Define the `Protocol` and `AnonymityLevel` enums in `domain/models.py`.
  - _Requirements: 3.4_

- [ ] 2. Implement core data models and their validation rules
  - [ ] 2.1 Implement `ProxyCandidate`, `ProxyResult`, `ProxyFilter`, and outcome dataclasses
    - Add frozen dataclasses `ProxyCandidate`, `ProxyResult`, `ProxyFilter`, `ScrapeProgress`, `SourceReport`, `ScrapeOutcome`, `ExportOutcome`, and `GeoInfo` in `domain/models.py`.
    - Implement candidate validation helpers: non-empty valid IP/hostname host, port in 1–65535, protocol is a supported enum value; expose a `validate_candidate()` / factory that returns `None` on invalid input.
    - Enforce model invariants: `alive == False ⟹ latency_ms is None`; `alive == True ⟹ latency_ms >= 0`; `country_code` is a 2-letter code or `"??"`.
    - _Requirements: 3.5, 3.6, 17.1, 17.2, 17.3, 17.4_

  - [ ]* 2.2 Write property test for latency consistency
    - **Property 5: Latency consistency**
    - **Validates: Requirements 3.5, 3.6**
    - Use Hypothesis to generate `ProxyResult` values and assert `alive == False ⟺ latency_ms is None` and `alive == True ⟹ latency_ms >= 0`.

  - [ ]* 2.3 Write unit tests for candidate input validation
    - Test that invalid hosts, out-of-range ports, and unsupported protocols are rejected/discarded, and valid candidates are accepted.
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 3. Define domain service interfaces (Protocols)
  - Declare `ProxySource`, `ScraperManager`, `ValidationEngine`, `GeoLocationService`, and `ExportService` Protocol/ABC interfaces plus the `ValidationConfig`, `ExportFormat` types in `domain/interfaces.py`, matching the design signatures.
  - This establishes the contracts all later components implement against; no behavior yet.
  - _Requirements: 1.1, 3.1, 5.1, 13.1_

- [ ] 4. Implement infrastructure HTTP client
  - [ ] 4.1 Implement `AsyncHttpClient` in `infrastructure/http_client.py`
    - Wrap the async HTTP library with configurable per-request connect/read timeouts and a descriptive User-Agent.
    - Support issuing a request *through* a given proxy for HTTP/HTTPS/SOCKS4/SOCKS5 (via aiohttp-socks/PySocks), returning status, headers, body, and measured round-trip latency.
    - Ensure requests carry no cookies/tokens/personal data by default (clean session per judge request).
    - _Requirements: 3.1, 3.4, 18.2_

  - [ ]* 4.2 Write unit tests for the HTTP client
    - Use a local mock server to assert timeout behavior, latency measurement, and that no sensitive headers are attached.
    - _Requirements: 3.1, 18.2_

- [ ] 5. Implement proxy source adapters
  - [ ] 5.1 Implement the three source adapters behind `ProxySource`
    - Create `infrastructure/sources/html_table_source.py` (BeautifulSoup+lxml), `plaintext_source.py`, and `json_api_source.py`, each with a `name` and a `fetch(client)` returning `list[ProxyCandidate]`.
    - Route all parsed rows through the candidate validation helper from task 2.1 so malformed entries are discarded before any connection attempt.
    - Each adapter MUST NOT raise: on HTTP error/timeout/unparseable response, return `[]` and surface the error to the caller for its `SourceReport`.
    - _Requirements: 1.3, 1.5, 14.3, 17.1, 17.2, 17.3, 17.4_

  - [ ]* 5.2 Write unit tests for source adapters with recorded fixtures
    - Feed each adapter fixture HTML/plaintext/JSON payloads; assert correct `ProxyCandidate` parsing and that malformed input yields `[]` (never raises).
    - _Requirements: 1.3, 1.5, 14.3_

- [ ] 6. Implement the deduplicator
  - [ ] 6.1 Implement `Deduplicator` in `domain/dedup.py`
    - Remove duplicate candidates using the identity key `(host, port, protocol)`, preserving one entry per key.
    - _Requirements: 2.1, 2.2_

  - [ ]* 6.2 Write property test for deduplication
    - **Property 4: Deduplication**
    - **Validates: Requirements 2.1, 2.2**
    - Use Hypothesis to generate arbitrary candidate lists and assert the output contains no two entries sharing `(host, port, protocol)`.

- [ ] 7. Implement the ScraperManager
  - [ ] 7.1 Implement `ScraperManager` in `domain/scraper_manager.py`
    - Hold a registry via `register(source)`; implement `scrape_all()` to fetch from all sources concurrently with bounded parallelism.
    - Aggregate candidates, apply the deduplicator, and build a `ScrapeOutcome` with per-source `SourceReport`s (name, found count, error).
    - Continue processing remaining sources when one fails; never propagate a source exception.
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 14.1_

  - [ ]* 7.2 Write property test for no-crash-on-source-failure (scraping side)
    - **Property 6: No crash on source failure**
    - **Validates: Requirements 1.5, 14.1, 14.3**
    - Generate a mix of failing and succeeding fake sources; assert `scrape_all()` completes, reports failures, and never raises.

  - [ ]* 7.3 Write unit tests for concurrent aggregation and reporting
    - Assert concurrency is bounded, per-source counts are correct, and dedup is applied to the aggregated set.
    - _Requirements: 1.2, 1.4, 2.2_

- [ ] 8. Implement the GeoLocationService
  - [ ] 8.1 Implement `GeoLocationService` in `domain/geolocation.py`
    - Resolve ISO 3166-1 alpha-2 country code and name using an offline GeoIP (geoip2/GeoLite2) database first, with a rate-limited public API fallback.
    - Add an in-memory per-session cache so a repeated IP returns the cached result without re-resolving.
    - Return `GeoInfo(country_code="??", ...)` when resolution is impossible; never raise.
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.2 Write unit tests for geolocation resolution, caching, and fallback
    - Assert offline-first ordering, cache hit on repeated IP, and `"??"` sentinel on unresolved IP.
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 9. Implement the ValidationEngine
  - [ ] 9.1 Implement own-public-IP acquisition and anonymity classification
    - Obtain the user's own public IP from a trusted service for anonymity comparison.
    - Implement classification into transparent / anonymous / elite by inspecting whether the origin IP or proxy-related headers leak through the judge response; return `UNKNOWN` when it cannot be determined.
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 9.2 Implement `ValidationEngine.check()` in `domain/validation_engine.py`
    - Issue a timed judge-endpoint request through the candidate for HTTP/HTTPS/SOCKS4/SOCKS5, applying the configured retry policy.
    - On success: mark `alive=True`, set integer `latency_ms >= 0`, invoke GeoLocationService for country, and set anonymity via task 9.1.
    - On timeout/connection failure after retries: mark `alive=False`, set `latency_ms=None`; never raise (return a not-alive `ProxyResult`).
    - Route ONLY judge-endpoint requests through the proxy; never route user traffic; exclude cookies/tokens/personal data.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 14.2, 14.4, 18.1, 18.2_

  - [ ]* 9.3 Write property test for latency consistency of validation output
    - **Property 5: Latency consistency**
    - **Validates: Requirements 3.5, 3.6**
    - Mock the HTTP client to produce alive/dead/slow outcomes; assert every returned `ProxyResult` satisfies the latency invariant.

  - [ ]* 9.4 Write property test for no-crash-on-check-failure (validation side)
    - **Property 6: No crash on source failure**
    - **Validates: Requirements 14.2, 14.4**
    - Generate failing check scenarios; assert `check()` returns a not-alive result and never raises.

  - [ ]* 9.5 Write unit tests for anonymity classification and retries
    - Mock judge responses for each anonymity level and retry-then-fail cases.
    - _Requirements: 3.3, 4.1, 4.2, 4.3_

- [ ] 10. Checkpoint - domain and infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement filter and premium-classification logic
  - [ ] 11.1 Implement filter validation and the premium predicate in `application/filtering.py`
    - Reject a `ProxyFilter` with an empty protocol set or a non-positive `max_latency_ms`; apply a default `max_latency_ms` of 5000 when unspecified.
    - Define/consume the `AnonymityFilter` enum (`ANY`, `ANONYMOUS_OR_BETTER`, `ELITE_ONLY`) and default `filter.min_anonymity` to `ELITE_ONLY` when unspecified.
    - Implement `anonymity_ok(anonymity, min_anonymity)` with three-level semantics: `ANY` ⟹ always satisfied; `ANONYMOUS_OR_BETTER` ⟹ `anonymity != TRANSPARENT`; `ELITE_ONLY` ⟹ `anonymity == ELITE`.
    - Implement `is_premium(result, filter)` = `alive AND latency_ms <= filter.max_latency_ms AND anonymity_ok(result.anonymity, filter.min_anonymity)`; under the default `ELITE_ONLY`, only `ELITE` results qualify.
    - Implement `passes_country(result, filter)`: specific code ⟹ `country_code == code` and exclude `"??"`; None/"ANY" ⟹ any country.
    - _Requirements: 6.2, 6.3, 6.4, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 8.3, 8.4_

  - [ ]* 11.2 Write property test for the premium predicate
    - **Property 3: Premium definition**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**
    - Use Hypothesis over random `(alive, latency, anonymity, min_anonymity, threshold)` tuples to assert `is_premium` matches its definition across all three `AnonymityFilter` levels: `ANY` (any anonymity qualifies), `ANONYMOUS_OR_BETTER` (excludes `TRANSPARENT`), and `ELITE_ONLY` (only `ELITE` qualifies).

  - [ ]* 11.3 Write property test for country-filter soundness
    - **Property 2: Country filter soundness**
    - **Validates: Requirements 6.2, 6.3, 6.4, 5.4**
    - Assert a specific country code never emits a differing-country result and never emits `"??"`; None/"ANY" admits any country.

- [ ] 12. Implement the ExportService
  - [ ] 12.1 Implement `ExportService.export()` in `domain/export_service.py`
    - Support CSV, TXT, and JSON; TXT writes `host:port` lines; CSV/JSON include country, latency, anonymity, and protocol metadata.
    - Return `ExportOutcome` with `records_written` equal to the number of results passed, writing exactly those records.
    - On unwritable destination, return `ExportOutcome(success=False, error=...)`; write only to the user-chosen path.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 18.3_

  - [ ]* 12.2 Write property test for export fidelity
    - **Property 8: Export fidelity**
    - **Validates: Requirements 13.3, 13.4, 13.5**
    - Round-trip generated result lists to CSV/TXT/JSON and assert `records_written` and on-disk record count/content match the input exactly.

  - [ ]* 12.3 Write unit tests for export formats and write-failure
    - Assert format-specific content and that an unwritable path yields a failure outcome.
    - _Requirements: 13.2, 13.6_

- [ ] 13. Implement the AppController orchestration layer
  - [ ] 13.1 Implement background workers (`ScrapeWorker`, validation worker pool)
    - Implement `application/workers.py` with a `QThread`-based scrape worker and a bounded `QThreadPool` validation pool driving `ScraperManager` and `ValidationEngine`.
    - Emit progress (phase, completed, total) and per-result Qt signals; run all network/CPU work off the main thread.
    - Honor a shared cancellation flag: stop scheduling new work and drain gracefully.
    - _Requirements: 10.1, 10.2, 11.1, 12.1_

  - [ ] 13.2 Implement `AppController` in `application/app_controller.py`
    - Implement `start_scrape`, `cancel`, `export`, `on_progress`, `on_result`; own worker lifecycle and marshal results to the UI via signals.
    - Apply the active `ProxyFilter`: append only alive results that pass the country filter; classify premium via task 11.1.
    - On cancel, retain already-validated results as visible/exportable and return to idle.
    - _Requirements: 6.2, 6.3, 6.4, 7.1, 9.1, 10.1, 10.2, 12.1, 12.2_

  - [ ]* 13.3 Write property test for "only validated proxies surfaced"
    - **Property 1: Only validated proxies are surfaced**
    - **Validates: Requirements 7.1, 3.2, 3.3**
    - Assert every result the controller forwards to the UI has `alive == True`.

  - [ ]* 13.4 Write unit tests for controller filtering and cancellation
    - Assert country/premium filtering on the display path and that cancellation retains prior results and returns to idle.
    - _Requirements: 6.2, 6.4, 12.2, 12.3_

- [ ] 14. Checkpoint - application layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement the PyQt6 MainWindow (Presentation)
  - [ ] 15.1 Build MainWindow widgets and filter controls
    - Implement `presentation/main_window.py`: searchable country selector with a "Random / Any" option, protocol multi-select, latency-threshold input, Start/Cancel buttons, progress bar, and status bar.
    - Add an anonymity-level dropdown offering exactly "Any", "Anonymous or better", and "Elite only" (mapping to `AnonymityFilter.ANY`, `ANONYMOUS_OR_BETTER`, `ELITE_ONLY`), defaulting to "Elite only" on first presentation; this replaces the old "Require anonymous" checkbox.
    - Wire the selected anonymity level into the constructed `ProxyFilter.min_anonymity`.
    - Perform no direct network I/O in the window.
    - _Requirements: 6.1, 8.1, 8.5, 8.6, 8.7, 10.3_

  - [ ] 15.2 Build the incremental, sortable results table and export dialog
    - Implement a results table that appends rows in batches (not per-result) and supports sorting by country, latency, anonymity, and protocol.
    - Implement the export dialog (format + destination); on export failure, show the error and re-open the dialog.
    - Implement the empty-state message (suggest loosening latency, choosing "Any" country, or retry) and the per-source success/failure summary on completion.
    - _Requirements: 9.2, 9.3, 11.2, 11.3, 15.1, 16.1_

  - [ ]* 15.3 Write pytest-qt UI smoke tests
    - Assert progress/result signals update the progress bar and table without blocking the main thread, and that the empty-state renders.
    - **Property 7: UI responsiveness**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 16. Wire the application together end-to-end
  - [ ] 16.1 Assemble the composition root in `main.py`
    - Instantiate the `AsyncHttpClient`, register the source adapters on `ScraperManager`, construct `ValidationEngine`, `GeoLocationService`, `ExportService`, the `AppController`, and `MainWindow`.
    - Connect controller callbacks to Qt signals/slots (progress → progress bar/status, result → table append, source report → summary) and launch the Qt event loop.
    - _Requirements: 9.1, 10.2, 11.2, 11.3_

  - [ ]* 16.2 Write an offline integration test for the full pipeline
    - Run scrape → dedupe → validate → geolocate → filter → display against a local mock source server and mock proxy/judge; assert deterministic, offline end-to-end behavior.
    - _Requirements: 1.1, 2.2, 3.2, 5.1, 7.1, 9.1_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP, though they validate the design's correctness properties and are strongly recommended.
- Each task references specific requirement sub-clauses for traceability.
- Property-based tests (Hypothesis) validate universal correctness properties; unit tests cover examples/edge cases; pytest-qt covers UI responsiveness; the integration test runs fully offline for determinism.
- Checkpoints ensure incremental validation at layer boundaries.
- Scraped proxies are untrusted: only neutral judge-endpoint requests are routed through them, and no cookies/tokens/personal data are attached.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "4.1", "6.1"] },
    { "id": 2, "tasks": ["4.2", "5.1", "6.2", "8.1", "11.1", "12.1"] },
    { "id": 3, "tasks": ["5.2", "7.1", "8.2", "9.1", "11.2", "11.3", "12.2", "12.3"] },
    { "id": 4, "tasks": ["7.2", "7.3", "9.2"] },
    { "id": 5, "tasks": ["9.3", "9.4", "9.5", "13.1"] },
    { "id": 6, "tasks": ["13.2", "15.1"] },
    { "id": 7, "tasks": ["13.3", "13.4", "15.2"] },
    { "id": 8, "tasks": ["15.3", "16.1"] },
    { "id": 9, "tasks": ["16.2"] }
  ]
}
```
