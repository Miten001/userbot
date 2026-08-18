# Bugfix Requirements Document

## Introduction

The TeraBox automation GUI tools (`main.py` and `autoclose.py`) offer a "Use Proxy / IP Rotation" option and a text box where the user can paste their own proxies. When the user pastes **authenticated proxies** — in the format `IP:PORT:USER:PASS` or `USER:PASS@IP:PORT` — the tool selects and applies a proxy, but Chrome is never able to authenticate against it. As a result the target pages fail to load (connection errors such as `ERR_*`, "This site can't be reached", 407-style auth failures, or timeouts), and error-detection logic auto-closes the affected tabs. The automation therefore never reaches TeraBox through the user's proxy, even though the very same proxies work correctly in a normal browser or in `curl`.

This defect makes paid/authenticated proxies unusable in the GUI, which is the primary way users route traffic through trusted IPs. The fix must make authenticated custom proxies actually route Chrome traffic (with credentials applied) while leaving all other proxy behavior unchanged.

**Scope:** The failure has been observed with authenticated proxies supplied through the custom proxy box while the proxy option is enabled. Because the user is unsure which GUI they run and both tools share the same defect for authenticated proxies, the bug applies to both `main.py` and `autoclose.py`.

## Bug Analysis

### Current Behavior (Defect)

When the proxy option is enabled and one or more authenticated proxies are pasted into the custom proxy box, the tool applies the proxy to Chrome but authentication never succeeds, so browsing through the proxy fails.

1.1 WHEN the user enables the proxy option and supplies an authenticated proxy in `IP:PORT:USER:PASS` format THEN the system launches Chrome with the proxy but does not successfully supply the proxy credentials, so requests are rejected and the page fails to load (connection error / auth failure / timeout).

1.2 WHEN the user enables the proxy option and supplies an authenticated proxy in `USER:PASS@IP:PORT` format THEN the system launches Chrome with the proxy but does not successfully supply the proxy credentials, so requests are rejected and the page fails to load.

1.3 WHEN Chrome cannot authenticate to the supplied proxy THEN the system treats the resulting error page as a connection failure and auto-closes the tab, so the automation flow never runs through the intended proxy.

1.4 WHEN the user supplies an authenticated proxy that is known to work in a normal browser or `curl` THEN the system still fails to browse through it, indicating the failure is in how the proxy/credentials are handed to Chrome rather than in the proxy itself.

### Expected Behavior (Correct)

The tool should apply authenticated proxies to Chrome with credentials, so that traffic is routed through the proxy and pages load normally.

2.1 WHEN the user enables the proxy option and supplies an authenticated proxy in `IP:PORT:USER:PASS` format THEN the system SHALL launch Chrome so that requests are routed through that proxy with the username and password applied, and the target page SHALL load without an authentication or connection error.

2.2 WHEN the user enables the proxy option and supplies an authenticated proxy in `USER:PASS@IP:PORT` format THEN the system SHALL launch Chrome so that requests are routed through that proxy with the username and password applied, and the target page SHALL load without an authentication or connection error.

2.3 WHEN an authenticated proxy is applied and the credentials are valid THEN the system SHALL NOT treat the page as a connection failure or auto-close the tab, and SHALL proceed with the normal automation flow through the proxy.

2.4 WHEN an authenticated proxy that works in a normal browser or `curl` is supplied THEN the system SHALL be able to browse through it, producing the same reachability as the external tools.

### Unchanged Behavior (Regression Prevention)

The fix must not alter how non-authenticated proxies, direct connections, or proxy auto-fetching behave.

3.1 WHEN the user supplies a plain `IP:PORT` proxy (no credentials) THEN the system SHALL CONTINUE TO route Chrome traffic through that proxy as it does today.

3.2 WHEN the proxy option is disabled THEN the system SHALL CONTINUE TO use a direct connection with no proxy applied.

3.3 WHEN the proxy option is enabled and the custom proxy box is left empty THEN the system SHALL CONTINUE TO fall back to its existing auto-fetch behavior (fetching and, where applicable, verifying proxies) unchanged.

3.4 WHEN a supplied proxy is genuinely dead or unreachable THEN the system SHALL CONTINUE TO detect the connection error and handle it as it does today (e.g., auto-closing the failed tab).

3.5 WHEN valid proxies are applied THEN the system SHALL CONTINUE TO honor existing per-IP rotation and usage limits as it does today.
