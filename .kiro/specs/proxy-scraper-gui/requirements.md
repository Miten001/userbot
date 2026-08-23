# Requirements Document

## Introduction

Proxy Scraper GUI is a standalone, cross-platform Python desktop application (PyQt6) that harvests free proxy servers from multiple public internet sources, validates each proxy for reachability, latency, and anonymity, resolves each proxy's country via geolocation, and presents only working, high-quality ("premium") results to the user. The user can filter results by a specific country or request results from any/random country, and export the validated list to disk as CSV, TXT, or JSON.

These requirements are derived from the approved design document and trace directly to its components (AppController, ScraperManager, ValidationEngine, GeoLocationService, ExportService, MainWindow), its data models, and its stated correctness properties.

## Glossary

- **Proxy_Scraper**: The overall desktop application, including UI and background workers.
- **Scraper_Manager**: The component that aggregates proxy candidates from all registered source adapters and deduplicates them.
- **Proxy_Source**: A pluggable adapter that fetches and parses raw proxy candidates from one public source.
- **Validation_Engine**: The component that determines whether a candidate is a live, usable proxy and measures its quality attributes.
- **GeoLocation_Service**: The component that resolves the country for a proxy's IP address.
- **Export_Service**: The component that serializes validated results to CSV, TXT, or JSON.
- **App_Controller**: The orchestration component that mediates between the UI and domain services and owns background workers.
- **Main_Window**: The PyQt6 top-level window hosting all UI widgets, including the results table, filter controls, progress bar, and export dialog.
- **Results_Table**: The UI widget that displays validated proxy results incrementally.
- **Proxy_Candidate**: A raw, unvalidated proxy identified by `(host, port, protocol)`.
- **Proxy_Result**: A candidate after validation, including `alive`, `latency_ms`, `country_code`, `country_name`, and `anonymity`.
- **Proxy_Filter**: The user's active selection: country (specific, or None/"ANY" for random/any), protocols, maximum latency, and anonymity requirement.
- **Premium**: A quality classification, not a paid tier. A result is premium iff it is alive, its latency is within the configured threshold, and (when anonymity is required) its anonymity level is not transparent.
- **Anonymity_Level**: One of transparent, anonymous, elite, or unknown.
- **Judge_Endpoint**: A neutral, trusted endpoint used to test a proxy without routing the user's sensitive traffic.
- **Supported_Protocol**: One of HTTP, HTTPS, SOCKS4, SOCKS5.

## Requirements

### Requirement 1: Scrape proxy candidates from multiple sources

**User Story:** As a user, I want the application to gather proxy candidates from many public sources, so that I have a large pool of proxies to validate.

#### Acceptance Criteria

1. WHEN the user starts a scrape, THE Scraper_Manager SHALL fetch proxy candidates from all registered Proxy_Source adapters.
2. THE Scraper_Manager SHALL run source fetches concurrently with a bounded parallelism limit.
3. WHERE a Proxy_Source parses an HTML table, plaintext list, or JSON API, THE Proxy_Source SHALL return the parsed proxy candidates.
4. WHEN scraping completes, THE Scraper_Manager SHALL return a per-source report containing the source name and the count of candidates found.
5. IF a Proxy_Source encounters an HTTP error, timeout, or unparseable response, THEN THE Proxy_Source SHALL return an empty candidate list and record the error in its source report.

### Requirement 2: Deduplicate proxy candidates

**User Story:** As a user, I want duplicate proxies removed before validation, so that the application does not waste time checking the same proxy multiple times.

#### Acceptance Criteria

1. WHEN candidates are aggregated from all sources, THE Scraper_Manager SHALL remove duplicates using the identity key `(host, port, protocol)`.
2. THE Scraper_Manager SHALL pass to validation a candidate set in which no two candidates share the same `(host, port, protocol)` key.

### Requirement 3: Validate proxy reachability and latency

**User Story:** As a user, I want only reachable proxies with acceptable speed, so that the results I receive are usable.

#### Acceptance Criteria

1. WHEN a Proxy_Candidate is validated, THE Validation_Engine SHALL attempt a timed request to the Judge_Endpoint through the candidate.
2. WHEN a validation request succeeds, THE Validation_Engine SHALL record the proxy as alive and set `latency_ms` to the measured round-trip time as a non-negative integer.
3. IF a validation request times out or fails to connect after the configured number of retries, THEN THE Validation_Engine SHALL mark the proxy as not alive and set `latency_ms` to none.
4. THE Validation_Engine SHALL support validation of HTTP, HTTPS, SOCKS4, and SOCKS5 proxies.
5. WHEN validation produces a Proxy_Result that is not alive, THE Validation_Engine SHALL set `latency_ms` to none.
6. WHEN validation produces a Proxy_Result that is alive, THE Validation_Engine SHALL set `latency_ms` to a value greater than or equal to zero.

### Requirement 4: Classify proxy anonymity

**User Story:** As a user, I want to know each proxy's anonymity level, so that I can avoid proxies that leak my real IP address.

#### Acceptance Criteria

1. WHEN a proxy is confirmed alive, THE Validation_Engine SHALL classify its anonymity level as transparent, anonymous, or elite by inspecting whether the origin IP or proxy-related headers are exposed through the Judge_Endpoint.
2. IF the anonymity level cannot be determined, THEN THE Validation_Engine SHALL classify the anonymity level as unknown.
3. THE Validation_Engine SHALL obtain the user's own public IP from a trusted service for use in anonymity comparison.

### Requirement 5: Resolve proxy country via geolocation

**User Story:** As a user, I want each proxy's country resolved accurately, so that country filtering does not rely on a source's self-reported labels.

#### Acceptance Criteria

1. WHEN a proxy IP requires geolocation, THE GeoLocation_Service SHALL resolve the ISO 3166-1 alpha-2 country code and country name.
2. THE GeoLocation_Service SHALL resolve country using an offline GeoIP database before using any public API fallback.
3. WHEN the same IP is resolved more than once during a session, THE GeoLocation_Service SHALL return the cached result rather than resolving again.
4. IF geolocation cannot resolve an IP, THEN THE GeoLocation_Service SHALL return the sentinel country code `"??"`.

### Requirement 6: Filter results by country

**User Story:** As a user, I want to filter proxies by a specific country or request any/random country, so that I can obtain proxies from the location I need.

#### Acceptance Criteria

1. THE Main_Window SHALL provide a searchable country selector that includes a "Random / Any" option.
2. WHILE the Proxy_Filter specifies a specific country code, THE App_Controller SHALL display only Proxy_Results whose `country_code` equals that specified code.
3. WHILE the Proxy_Filter country is none or "ANY", THE App_Controller SHALL display Proxy_Results from any country.
4. WHILE the Proxy_Filter specifies a specific country code, THE App_Controller SHALL exclude Proxy_Results whose country code is the sentinel `"??"` from the displayed results.

### Requirement 7: Classify and surface premium results only

**User Story:** As a user, I want only working, high-quality proxies shown, so that I do not have to manually sift through dead or low-quality entries.

#### Acceptance Criteria

1. THE Results_Table SHALL display only Proxy_Results whose `alive` value is true.
2. THE App_Controller SHALL classify a Proxy_Result as premium if and only if the result is alive AND its `latency_ms` is less than or equal to the Proxy_Filter's `max_latency_ms` AND (the Proxy_Filter does not require anonymity OR the result's anonymity level is not transparent).
3. WHERE the Proxy_Filter requires anonymity, THE App_Controller SHALL exclude Proxy_Results whose anonymity level is transparent from the premium classification.

### Requirement 8: Configure filter controls

**User Story:** As a user, I want to configure protocol and latency filters, so that results match my quality needs.

#### Acceptance Criteria

1. THE Main_Window SHALL provide controls for selecting one or more Supported_Protocols and a maximum latency threshold.
2. THE App_Controller SHALL reject a Proxy_Filter whose protocol set is empty.
3. THE App_Controller SHALL reject a Proxy_Filter whose `max_latency_ms` is not a positive integer.
4. WHERE no maximum latency is specified by the user, THE App_Controller SHALL apply a default latency threshold of 5000 milliseconds.

### Requirement 9: Display live, incremental results

**User Story:** As a user, I want results to appear as they are validated, so that I get feedback without waiting for the entire run to finish.

#### Acceptance Criteria

1. WHEN a Proxy_Result is validated and matches the active Proxy_Filter, THE App_Controller SHALL append a corresponding row to the Results_Table.
2. THE App_Controller SHALL stream results to the Results_Table in batches rather than repainting per individual result.
3. THE Results_Table SHALL support sorting by country, latency, anonymity, and protocol.

### Requirement 10: Keep the user interface responsive

**User Story:** As a user, I want the interface to remain responsive during scraping and validation, so that the application does not freeze while hundreds of proxies are checked.

#### Acceptance Criteria

1. THE App_Controller SHALL execute all network and CPU-bound scraping and validation work on background workers rather than on the Qt main thread.
2. WHEN a background worker produces progress or results, THE App_Controller SHALL deliver them to the Main_Window using Qt signals.
3. THE Main_Window SHALL perform no direct network input or output.

### Requirement 11: Report progress during a run

**User Story:** As a user, I want to see progress while proxies are scraped and validated, so that I know the application is working and how far along it is.

#### Acceptance Criteria

1. WHILE a run is in progress, THE App_Controller SHALL emit progress updates that include the current phase, the completed count, and the total count.
2. WHEN progress updates are emitted, THE Main_Window SHALL update the progress bar and status message to reflect the current phase and counts.
3. WHEN a run completes, THE Main_Window SHALL display a per-source summary that reports how many sources succeeded and how many failed.

### Requirement 12: Cancel an in-progress run

**User Story:** As a user, I want to cancel a scrape or validation run in progress, so that I can stop long-running work and keep the results gathered so far.

#### Acceptance Criteria

1. WHEN the user requests cancellation, THE App_Controller SHALL signal background workers to stop scheduling new work and drain gracefully.
2. WHEN cancellation completes, THE App_Controller SHALL retain the Proxy_Results validated before cancellation as visible and exportable.
3. WHEN cancellation completes, THE Main_Window SHALL return to an idle state.

### Requirement 13: Export validated results

**User Story:** As a user, I want to export the validated proxy list to disk, so that I can use the results in other tools.

#### Acceptance Criteria

1. THE Export_Service SHALL support exporting results in CSV, TXT, and JSON formats.
2. WHERE the export format is TXT, THE Export_Service SHALL write each result as a `host:port` line.
3. WHERE the export format is CSV or JSON, THE Export_Service SHALL include country, latency, anonymity, and protocol metadata for each result.
4. WHEN an export succeeds, THE Export_Service SHALL return an outcome whose `records_written` equals the number of Proxy_Results passed to the exporter.
5. WHEN an export succeeds, THE Export_Service SHALL write a file whose contents contain exactly the Proxy_Results passed to the exporter.
6. IF the destination path is not writable, THEN THE Export_Service SHALL return an outcome indicating failure with an error description.

### Requirement 14: Continue running when individual failures occur

**User Story:** As a user, I want the application to keep working when a single source or proxy check fails, so that one failure does not abort the whole run.

#### Acceptance Criteria

1. IF a single Proxy_Source fails, THEN THE Scraper_Manager SHALL continue processing the remaining sources and complete the run.
2. IF a single proxy validation fails, THEN THE Validation_Engine SHALL continue validating the remaining candidates and complete the run.
3. THE Proxy_Source SHALL return an empty list on failure rather than raising an unhandled exception.
4. THE Validation_Engine SHALL return a not-alive Proxy_Result on failure rather than raising an unhandled exception.

### Requirement 15: Communicate an empty-result state

**User Story:** As a user, I want a clear message when no proxies are found, so that I understand the outcome and know how to adjust.

#### Acceptance Criteria

1. IF all sources return no candidates or no proxy passes validation for the chosen Proxy_Filter, THEN THE Main_Window SHALL display an empty-state message with suggestions to loosen the latency threshold, choose "Any" country, or retry.

### Requirement 16: Handle export write failures

**User Story:** As a user, I want to be informed and able to retry when an export fails, so that I can save my results to a valid location.

#### Acceptance Criteria

1. IF an export returns a failure outcome, THEN THE Main_Window SHALL display the error and re-open the export dialog so the user can select another destination.

### Requirement 17: Validate parsed proxy input

**User Story:** As a user, I want malformed proxy data rejected before any connection attempt, so that the application stays safe and stable.

#### Acceptance Criteria

1. WHEN a Proxy_Candidate is parsed from a source, THE Scraper_Manager SHALL accept it only if its host is non-empty and syntactically a valid IP address or hostname.
2. WHEN a Proxy_Candidate is parsed from a source, THE Scraper_Manager SHALL accept it only if its port is an integer in the range 1 to 65535 inclusive.
3. WHEN a Proxy_Candidate is parsed from a source, THE Scraper_Manager SHALL accept it only if its protocol is one of the Supported_Protocols.
4. IF a parsed Proxy_Candidate fails any validation rule, THEN THE Scraper_Manager SHALL discard the candidate before any connection attempt.

### Requirement 18: Protect the user from untrusted proxies

**User Story:** As a user, I want assurance that scraped proxies are treated as untrusted, so that my sensitive traffic and credentials are never exposed.

#### Acceptance Criteria

1. THE Validation_Engine SHALL route only Judge_Endpoint requests through scraped proxies and SHALL NOT route the user's sensitive traffic through them.
2. WHEN a Judge_Endpoint request is issued through a proxy, THE Validation_Engine SHALL exclude cookies, tokens, and personal data from that request.
3. THE Export_Service SHALL write only to user-chosen destination locations.
