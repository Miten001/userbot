# GUI Proxy Fix Bugfix Design

## Overview

The TeraBox automation GUIs (`tools/terabox-automation/main.py` and `tools/terabox-automation/autoclose.py`) let the user enable a proxy and paste custom proxies. When the user supplies an **authenticated proxy** (`IP:PORT:USER:PASS` or `USER:PASS@IP:PORT`), Chrome is launched pointing at the proxy but the credentials are never successfully delivered to the proxy's authentication challenge. The proxy answers with an HTTP 407 (or the connection stalls), Chrome renders an error page, the existing error-detection logic classifies it as a dead-connection page, and the tab is auto-closed. The user's automation therefore never reaches TeraBox through their paid/authenticated proxy, even though the identical proxy works in a normal browser or `curl`.

Two distinct, code-confirmed defects produce this single symptom:

- **`main.py` (`launch_chrome_subprocess`, ~line 528; `_create_proxy_auth_extension`, ~line 408):** authenticated proxies are handled by generating an on-disk Chrome extension whose `manifest.json` declares `"manifest_version": 2` and relies on a persistent background page plus blocking `chrome.webRequest.onAuthRequired` and `chrome.proxy.settings`. Modern Chrome has deprecated/disabled Manifest V2 unpacked extensions and blocking `webRequestBlocking` for normally-loaded extensions, so the credential callback never fires reliably.
- **`autoclose.py` (`launch_chrome_subprocess`, ~line 324; `_open_single_window`, ~line 538):** the proxy `host:port` is passed to `--proxy-server` with no scheme, and authentication is attempted by injecting a `Proxy-Authorization: Basic ...` header via CDP `Network.setExtraHTTPHeaders`. That header is attached to requests destined for the origin server, **not** to the proxy `CONNECT` handshake used for HTTPS, so the proxy's auth challenge is never satisfied. Additionally, `_parse_proxy_string` (~line 211) does not recognize the `USER:PASS@IP:PORT` format at all.

The fix replaces both fragile mechanisms with a single reliable, modern approach: authenticate the proxy through the Chrome DevTools Protocol (CDP) `Fetch` domain (`Fetch.enable` with `handleAuthRequests: true`, answering `Fetch.authRequired` with `Fetch.continueWithAuth`). Because both tools already drive Chrome over remote-debugging Selenium, CDP is available without new dependencies, and it authenticates both HTTP requests and HTTPS `CONNECT` tunnels. Robust parsing is unified so both credential formats normalize to the same proxy configuration, and all non-authenticated behavior (plain proxies, direct connection, auto-fetch fallback, rotation and usage limits, dead-proxy auto-close) is preserved unchanged.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the proxy option is enabled and an authenticated proxy (`IP:PORT:USER:PASS` or `USER:PASS@IP:PORT`) is applied to Chrome, but the credentials are never delivered to the proxy's auth challenge, so requests are rejected.
- **Property (P)**: The desired behavior — when an authenticated proxy is applied, Chrome routes traffic through it **with credentials supplied**, the target page loads without a 407/connection error, and the tab is not auto-closed.
- **Preservation**: Existing behavior that must remain unchanged — plain `IP:PORT` proxies, direct connection when the option is off, auto-fetch fallback when the box is empty, dead-proxy detection/auto-close, and per-IP rotation/usage limits.
- **Authenticated proxy**: A proxy requiring a username and password, supplied as `IP:PORT:USER:PASS` or `USER:PASS@IP:PORT`.
- **`_parse_proxy` / `_parse_proxy_string`**: The functions in `main.py` (~line 360) and `autoclose.py` (~line 211) that turn a user-supplied proxy string into a structured record (`host`, `port`, `user`, `password`, `has_auth`).
- **`launch_chrome_subprocess`**: The function in each tool that builds Chrome's command line (including the `--proxy-server` / extension flags) and starts Chrome with remote debugging.
- **`_create_proxy_auth_extension`**: The `main.py` helper (~line 408) that writes the Manifest V2 proxy-auth extension — the primary defect in `main.py`.
- **CDP `Fetch` auth**: The Chrome DevTools Protocol interception (`Fetch.enable` + `Fetch.authRequired` → `Fetch.continueWithAuth`) used to answer proxy authentication challenges reliably in modern Chrome.
- **`has_auth`**: The parsed flag that is `true` only when both a username and password were supplied — this flag selects the credentialed launch path.

## Bug Details

### Bug Condition

The bug manifests when the proxy option is enabled and the applied proxy carries credentials. In `main.py` the credentialed path builds a Manifest V2 `--load-extension` that modern Chrome will not honor; in `autoclose.py` the credentialed path passes a bare `host:port` to `--proxy-server` and tries to authenticate with a destination-only HTTP header that never covers the proxy `CONNECT` tunnel. In both cases the proxy's authentication challenge is left unanswered.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ProxyLaunchRequest
         { proxyEnabled: boolean,
           proxyString: string,       // as typed by the user
           chromeVersion: modern }    // current Chrome, MV2 disabled
  OUTPUT: boolean

  parsed := parseProxy(input.proxyString)

  RETURN input.proxyEnabled = TRUE
         AND parsed.has_auth = TRUE                 // username AND password present
         AND parsed.host is reachable and proxy is live
         AND NOT proxyCredentialsDeliveredToProxy(parsed)  // 407/handshake never satisfied
END FUNCTION
```

Where `proxyCredentialsDeliveredToProxy` is false today because:
- `main.py`: the MV2 background extension carrying `onAuthRequired`/`chrome.proxy.settings` is not loaded/honored by modern Chrome.
- `autoclose.py`: the `Proxy-Authorization` header set via `Network.setExtraHTTPHeaders` is applied to origin requests, not to the proxy `CONNECT`, so the proxy never sees valid credentials.

### Examples

- **`IP:PORT:USER:PASS` (main.py):** user pastes `203.0.113.10:8080:alice:s3cret`. `_parse_proxy` correctly returns `has_auth=True`, an MV2 extension is written and passed via `--load-extension`, but modern Chrome ignores it. Expected: page loads through the proxy authenticated as `alice`. Actual: 407 / `ERR_*` error page → tab auto-closed.
- **`USER:PASS@IP:PORT` (main.py):** user pastes `alice:s3cret@203.0.113.10:8080`. Same MV2 failure. Expected: authenticated page load. Actual: error page → auto-closed.
- **`IP:PORT:USER:PASS` (autoclose.py):** user pastes `203.0.113.10:8080:alice:s3cret`. Chrome gets `--proxy-server=203.0.113.10:8080`; the CDP `Proxy-Authorization` header does not authenticate the HTTPS `CONNECT`. Expected: authenticated page load. Actual: 407 / error page → window closed.
- **`USER:PASS@IP:PORT` (autoclose.py):** user pastes `alice:s3cret@203.0.113.10:8080`. `_parse_proxy_string` does not recognize the `@` format, so credentials are dropped entirely (parsed as a single host with empty port). Expected: authenticated page load. Actual: proxy misconfigured → error page → window closed.
- **Edge case — plain proxy `IP:PORT` (both tools):** user pastes `203.0.113.10:8080` (no credentials). `has_auth=False`; this is **not** the bug condition and must keep working exactly as today.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Plain `IP:PORT` proxies (no credentials) SHALL continue to route Chrome traffic exactly as they do today via `--proxy-server` (Requirement 3.1).
- With the proxy option disabled, Chrome SHALL continue to launch with no proxy — a direct connection (Requirement 3.2).
- With the proxy option enabled and the custom-proxy box empty, the tool SHALL continue its existing auto-fetch fallback — fetching (and, in `autoclose.py`, `_test_proxy`-verifying; in `main.py`, `_verify_proxy_country`-verifying) proxies unchanged (Requirement 3.3).
- A genuinely dead/unreachable proxy SHALL continue to be detected by the existing error-page logic (`_check_error_page` / the `ERR_`/`This site can`/timeout checks) and handled as today, including auto-closing the failed tab/window (Requirement 3.4).
- Per-IP rotation and usage limits SHALL be honored exactly as today — `main.py`'s `IP_USAGE_COUNT` / `MAX_IP_USES` accounting and the shuffled unique-host assignment, and `autoclose.py`'s round-robin `self.proxies[(processed-1) % len(self.proxies)]` (Requirement 3.5).

**Scope:**
All inputs that are NOT an enabled authenticated proxy should be completely unaffected by this fix. This includes:
- Plain `IP:PORT` proxies (`has_auth = False`).
- The proxy-disabled / direct-connection path.
- The empty-box auto-fetch fallback path (fetched proxies are plain `IP:PORT`).
- Dead-proxy error detection and auto-close.
- Rotation and usage-limit accounting.

**Note:** The correct positive behavior for authenticated proxies is defined in the Correctness Properties section (Property 1). This section fixes what must NOT change.

## Hypothesized Root Cause

Based on the bug description and confirmed by reading the code, the causes are:

1. **`main.py` — obsolete Manifest V2 proxy-auth extension**: `_create_proxy_auth_extension` writes an extension declaring `"manifest_version": 2` with a persistent background page, blocking `chrome.webRequest.onAuthRequired`, and `chrome.proxy.settings`. Modern Chrome disables MV2 unpacked extensions and restricts blocking `webRequest`, so the `authCredentials` callback never runs and the proxy 407 is never answered.
   - The launch path at ~line 528 selects this extension only when `has_auth` is true, so exactly the authenticated case is broken.

2. **`autoclose.py` — wrong authentication channel**: `_open_single_window` (~line 573) authenticates by setting `Proxy-Authorization: Basic ...` through CDP `Network.setExtraHTTPHeaders`. That header rides on requests to the destination origin, not on the proxy `CONNECT` used for HTTPS, so the proxy's auth challenge is never satisfied. `--proxy-server` is also passed without an `http://` scheme.

3. **`autoclose.py` — incomplete parsing**: `_parse_proxy_string` (~line 211) handles only `IP:PORT` and `IP:PORT:USER:PASS`; the `USER:PASS@IP:PORT` format falls into the `else` branch and silently loses the credentials and port.

4. **Launch/navigation ordering**: both tools pass the target URL directly on Chrome's command line, so navigation begins before Selenium/CDP is attached. Any auth interception that is armed after connect can miss the first challenge. The fix must arm proxy auth before the credentialed navigation occurs (e.g., launch to a neutral start page, enable CDP `Fetch` auth, then navigate).

## Correctness Properties

Property 1: Bug Condition - Authenticated Proxy Routes With Credentials

_For any_ launch request where the bug condition holds (`isBugCondition` returns true — the proxy option is enabled and an applied proxy parses with `has_auth = true` for either `IP:PORT:USER:PASS` or `USER:PASS@IP:PORT`), the fixed tool SHALL launch Chrome so that requests are routed through that proxy with the parsed username and password delivered to the proxy's authentication challenge, the target page SHALL load without a 407/authentication or connection error, and the tool SHALL NOT auto-close the tab as a connection failure — proceeding with the normal automation flow through the proxy, matching the reachability of the same proxy in a normal browser or `curl`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Authenticated Proxy Behavior Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition` returns false — a plain `IP:PORT` proxy, the proxy option disabled, an empty custom box triggering auto-fetch, a genuinely dead proxy, or rotation/usage-limit accounting), the fixed tool SHALL produce the same observable result as the original tool, preserving direct-connection behavior, plain-proxy routing, auto-fetch fallback, dead-proxy error detection and auto-close, and per-IP rotation and usage limits.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

Property 3: Parsing - Both Authenticated Formats Normalize Identically

_For any_ authenticated proxy expressing the same host, port, username, and password, whether written as `IP:PORT:USER:PASS` or as `USER:PASS@IP:PORT`, the fixed parser in both tools SHALL produce the same normalized proxy configuration (`host`, `port`, `user`, `password`, `has_auth = true`), so downstream launch and authentication behave identically regardless of the input notation.

**Validates: Requirements 2.1, 2.2**

## Fix Implementation

### Changes Required

Assuming the root-cause analysis is correct, the fix standardizes credentialed proxy authentication on CDP `Fetch` interception in both tools and unifies parsing.

**File**: `tools/terabox-automation/main.py`

**Functions**: `_parse_proxy` (~line 360), `_create_proxy_auth_extension` (~line 408), `launch_chrome_subprocess` (~line 472/528), and the connect/navigate flow in `run` (~line 827) / replacement-window flow (~line 1037).

**Specific Changes**:
1. **Remove reliance on the MV2 extension**: stop selecting `_create_proxy_auth_extension` / `--load-extension` for authenticated proxies. Always pass the proxy endpoint to Chrome via `--proxy-server=http://{host}:{port}` (scheme included), for both authenticated and plain proxies.
2. **Add CDP-based proxy authentication**: after Selenium connects to Chrome, enable `Fetch` interception with auth handling and register a handler that answers the proxy challenge with the parsed credentials, then continues normal requests:
   - `Fetch.enable` with `handleAuthRequests = true`
   - on `Fetch.authRequired` → `Fetch.continueWithAuth` with `authChallengeResponse = { response: "ProvideCredentials", username, password }`
   - on `Fetch.requestPaused` → `Fetch.continueRequest`
3. **Arm auth before the credentialed navigation**: when `has_auth` is true, launch Chrome to a neutral start page (e.g. `about:blank`) instead of the target URL, connect Selenium, enable the `Fetch` auth handler, then navigate to the target URL. Plain-proxy / no-proxy launches keep launching directly to the URL (no behavior change).
4. **Harden `_parse_proxy`**: keep support for `IP:PORT`, `IP:PORT:USER:PASS`, and `USER:PASS@IP:PORT`; split `host:port` from the right so credentials containing separators are tolerated; ensure both authenticated formats yield the same normalized record with `has_auth = true` (Property 3).
5. **Keep everything else intact**: preserve `--proxy-server` for plain proxies, the direct-connection path, auto-fetch fallback, dead-proxy error detection/auto-close, and `IP_USAGE_COUNT`/`MAX_IP_USES` rotation accounting.

**File**: `tools/terabox-automation/autoclose.py`

**Functions**: `_parse_proxy_string` (~line 211), `launch_chrome_subprocess` (~line 324), `_open_single_window` (~line 538), and the connect/navigate flow in `run` (~line 807).

**Specific Changes**:
1. **Replace the header-based auth**: remove the `Network.setExtraHTTPHeaders` `Proxy-Authorization` approach and instead authenticate via the same CDP `Fetch` mechanism described above (`Fetch.enable` + `Fetch.authRequired` → `Fetch.continueWithAuth`, `Fetch.requestPaused` → `Fetch.continueRequest`).
2. **Add scheme to `--proxy-server`**: pass `--proxy-server=http://{host}:{port}` (using the parsed `host:port`, not the credential-bearing raw string).
3. **Extend `_parse_proxy_string`**: recognize the `USER:PASS@IP:PORT` format in addition to `IP:PORT:USER:PASS` and `IP:PORT`, normalizing to the same record shape (`host`, `port`, `user`, `password`, `raw = host:port`), so both authenticated notations behave identically (Property 3).
4. **Arm auth before the credentialed navigation**: launch to a neutral start page for authenticated proxies, connect Selenium, enable the `Fetch` auth handler, then navigate to the target URL. Non-authenticated launches are unchanged.
5. **Keep everything else intact**: preserve plain-proxy `--proxy-server`, the direct-connection path, the `_fetch_proxies` + `_test_proxy` auto-fetch fallback, dead-proxy error detection/auto-close, and the round-robin rotation.

> Optional shared helper: the CDP auth-arming logic and the normalized parser are identical across both tools and MAY be factored into a small shared helper to avoid divergence, but this is not required for correctness.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on the unfixed code, then verify the fix authenticates proxies correctly while preserving all existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix, and confirm or refute the root-cause analysis (MV2 extension in `main.py`; wrong auth channel + missing `@` parsing in `autoclose.py`). If refuted, re-hypothesize.

**Test Plan**: Point each tool at a controlled authenticating proxy (a local proxy that requires Basic auth, e.g. a small `mitmproxy`/`tinyproxy`/squid instance with a known user/pass) and a benign target URL. Run on the UNFIXED code and observe the auth challenge being unanswered (407 / `ERR_*` error page / auto-close). Capture the proxy-side access log to confirm whether valid credentials ever reached the proxy.

**Test Cases**:
1. **main.py — `IP:PORT:USER:PASS`**: enable proxy, paste a valid authenticated proxy; expect the page to fail and the MV2 extension to not authenticate (will fail on unfixed code).
2. **main.py — `USER:PASS@IP:PORT`**: same as above with the `@` notation (will fail on unfixed code).
3. **autoclose.py — `IP:PORT:USER:PASS`**: enable proxy, paste a valid authenticated proxy; expect the CONNECT tunnel to go unauthenticated and the window to close (will fail on unfixed code).
4. **autoclose.py — `USER:PASS@IP:PORT`**: confirm `_parse_proxy_string` drops the credentials/port for the `@` format (will fail on unfixed code).
5. **Edge case — plain `IP:PORT`**: confirm this already works on unfixed code (baseline; should NOT fail), establishing the preservation boundary.

**Expected Counterexamples**:
- The proxy access log shows no successful authentication for the authenticated cases; Chrome shows a 407/`ERR_*` page and the tab/window is auto-closed.
- Possible causes confirmed: MV2 extension not honored (`main.py`), `Proxy-Authorization` header not applied to CONNECT (`autoclose.py`), `@`-format credentials dropped (`autoclose.py`).

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function delivers credentials and the page loads.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := launchWithProxy_fixed(input)
  ASSERT result.credentialsDeliveredToProxy = TRUE
  ASSERT result.pageLoaded = TRUE
  ASSERT result.tabAutoClosed = FALSE
  ASSERT result.reachability = reachability(curlThroughSameProxy(input))
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT launchWithProxy_original(input) = launchWithProxy_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many proxy strings and launch configurations automatically across the input domain.
- It catches edge cases (odd ports, empty box, disabled option, dead hosts) that manual tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-authenticated inputs.

**Test Plan**: Observe behavior on the UNFIXED code first for plain proxies, direct connection, auto-fetch, dead proxies, and rotation; then write property-based tests capturing that behavior and re-run against the fixed code.

**Test Cases**:
1. **Plain proxy preservation**: observe `IP:PORT` routing on unfixed code, assert identical routing (`--proxy-server`) after the fix (Req 3.1).
2. **Direct-connection preservation**: proxy disabled → no `--proxy-server`, direct connection unchanged (Req 3.2).
3. **Auto-fetch fallback preservation**: enabled + empty box → fetch/verify path unchanged (Req 3.3).
4. **Dead-proxy preservation**: unreachable proxy still yields an error page and auto-close (Req 3.4).
5. **Rotation/usage-limit preservation**: `main.py` `MAX_IP_USES`/`IP_USAGE_COUNT` accounting and `autoclose.py` round-robin selection unchanged (Req 3.5).

### Unit Tests

- Parser: `_parse_proxy` / `_parse_proxy_string` produce identical normalized records for `IP:PORT:USER:PASS` and `USER:PASS@IP:PORT`; `has_auth` is true only when both user and password are present; plain `IP:PORT` yields `has_auth = false` (Property 3).
- Command-line builder: authenticated and plain proxies both emit `--proxy-server=http://host:port`; no `--load-extension` MV2 path is used.
- CDP auth handler: given an `authRequired` event, the handler responds with `ProvideCredentials` and the parsed username/password.

### Property-Based Tests

- Generate random valid `host`/`port`/`user`/`pass` and both notations; assert the two notations normalize to the same config (Property 3).
- Generate random non-authenticated inputs (plain proxies, disabled option, empty box) and assert the fixed launch configuration equals the original (Property 2 / preservation).
- Generate random rotation sequences and assert usage-limit/round-robin selection is unchanged.

### Integration Tests

- End-to-end against a local authenticating proxy: authenticated proxy in both notations loads the target page through the proxy without auth error, in both `main.py` and `autoclose.py` (Property 1).
- End-to-end with a plain proxy and with the proxy disabled: confirms preservation of routing and direct-connection flows.
- Dead-proxy end-to-end: confirms the error page is still detected and the tab/window is still auto-closed (Req 3.4), and that navigation ordering (neutral start page → arm auth → navigate) does not regress non-authenticated flows.
