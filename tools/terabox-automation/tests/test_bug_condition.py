"""Bug-condition exploration tests (Property 1) for the gui-proxy-fix bugfix.

Methodology: task 1 asks for tests that FAIL on the unfixed code (proving the
bug) and then PASS after the fix (confirming Property 1). The full
demonstration requires a live authenticating proxy + Chrome, which is not
available in this environment (see the CHROME-DEPENDENT section below).

What CAN be proven without Chrome is the ``autoclose.py`` parsing half of the
bug: on the unfixed code ``_parse_proxy_string`` silently dropped the port and
credentials for the ``USER:PASS@IP:PORT`` notation, so the proxy was
misconfigured and the window auto-closed. The documented unfixed counterexample
was::

    _parse_proxy_string("alice:s3cret@203.0.113.10:8080")
      -> {"host": "alice:s3cret@203.0.113.10:8080", "port": "",
          "user": None, "password": None, "raw": "alice:s3cret@203.0.113.10:8080"}

After the fix the same input parses correctly and both tools normalize both
notations identically. These assertions FAILED on the unfixed code and PASS on
the fixed code, encoding Property 1's parsing precondition.

Validates: Requirements 1.1, 1.2, 1.3, 1.4 (now expressed as 2.1, 2.2 behavior).
"""

import pytest

import main
import autoclose
import proxy_auth


AUTH_CASES = [
    ("203.0.113.10:8080:alice:s3cret", "203.0.113.10", "8080", "alice", "s3cret"),
    ("alice:s3cret@203.0.113.10:8080", "203.0.113.10", "8080", "alice", "s3cret"),
]


@pytest.mark.parametrize("raw,host,port,user,password", AUTH_CASES)
def test_autoclose_parses_both_auth_notations(raw, host, port, user, password):
    """Was the core autoclose defect: @-notation dropped port+credentials."""
    rec = autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)._parse_proxy_string(raw)
    assert (rec["host"], rec["port"], rec["user"], rec["password"]) == (host, port, user, password)
    assert rec["has_auth"] is True


@pytest.mark.parametrize("raw,host,port,user,password", AUTH_CASES)
def test_main_no_longer_uses_mv2_extension(raw, host, port, user, password):
    """main's defect was the MV2 --load-extension path for authenticated proxies.

    The fixed builder routes via --proxy-server (scheme included) and arms auth
    through CDP instead, so no --load-extension flag is produced.
    """
    m = main.TeraBoxAutomation(status_callback=lambda *_: None)
    args = m._proxy_launch_args(raw)
    assert args == [f"--proxy-server=http://{host}:{port}"]
    assert all("--load-extension" not in a for a in args)


@pytest.mark.parametrize("raw,host,port,user,password", AUTH_CASES)
def test_credentials_are_delivered_via_cdp_provide_credentials(raw, host, port, user, password):
    """The parsed credentials reach the proxy auth challenge as ProvideCredentials.

    This is the credential-delivery half of Property 1, expressed at the CDP
    message level (the transport itself needs a live Chrome).
    """
    for parsed in (
        main.TeraBoxAutomation(status_callback=lambda *_: None)._parse_proxy(raw),
        autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)._parse_proxy_string(raw),
    ):
        event = {"method": "Fetch.authRequired", "params": {"requestId": "r1"}}
        cmd = proxy_auth.dispatch_event(event, parsed["user"], parsed["password"], 1)
        resp = cmd["params"]["authChallengeResponse"]
        assert resp == {
            "response": "ProvideCredentials",
            "username": user,
            "password": password,
        }


# --- CHROME-DEPENDENT (documented, cannot run in this sandbox) --------------
# The following end-to-end assertions require a live Chrome plus a controlled
# authenticating proxy (e.g. mitmproxy/tinyproxy/squid with Basic auth) and are
# skipped here. They constitute task 3.5's full verification:
#   1. main.py  + IP:PORT:USER:PASS  -> page loads, no 407/ERR_, tab NOT closed
#   2. main.py  + USER:PASS@IP:PORT  -> same
#   3. autoclose.py + IP:PORT:USER:PASS -> CONNECT tunnel authenticates, window stays
#   4. autoclose.py + USER:PASS@IP:PORT -> same
# with the proxy access log confirming the credentials actually reached the
# proxy, matching `curl` reachability through the same proxy.

_CHROME_REASON = "requires live Chrome + a controlled authenticating proxy (not available in sandbox)"


@pytest.mark.skip(reason=_CHROME_REASON)
def test_e2e_authenticated_proxy_loads_page_main():
    ...


@pytest.mark.skip(reason=_CHROME_REASON)
def test_e2e_authenticated_proxy_loads_page_autoclose():
    ...


@pytest.mark.skip(reason=_CHROME_REASON)
def test_e2e_dead_proxy_still_auto_closed():
    ...
