"""CDP Fetch auth-handler tests for the gui-proxy-fix bugfix.

These exercise the pure message-construction logic of the shared
``proxy_auth`` helper without a live Chrome:

* ``Fetch.enable`` is armed with ``handleAuthRequests = true``.
* A ``Fetch.authRequired`` event is answered with ``Fetch.continueWithAuth``
  using ``ProvideCredentials`` and the parsed username/password.
* A ``Fetch.requestPaused`` event is answered with ``Fetch.continueRequest``.
* Unrelated events are ignored.

Validates: Requirement 2.3 (credentials delivered to the proxy auth challenge).
"""

import string

from hypothesis import given, strategies as st

import proxy_auth


def test_fetch_enable_handles_auth_requests():
    cmd = proxy_auth.build_fetch_enable_command(1)
    assert cmd["method"] == "Fetch.enable"
    assert cmd["params"]["handleAuthRequests"] is True


def test_auth_required_answered_with_provide_credentials():
    event = {
        "method": "Fetch.authRequired",
        "params": {"requestId": "req-1", "authChallenge": {"source": "Proxy"}},
    }
    cmd = proxy_auth.build_auth_response(event, "alice", "s3cret", 7)
    assert cmd["method"] == "Fetch.continueWithAuth"
    assert cmd["params"]["requestId"] == "req-1"
    resp = cmd["params"]["authChallengeResponse"]
    assert resp == {
        "response": "ProvideCredentials",
        "username": "alice",
        "password": "s3cret",
    }


def test_request_paused_continued_unmodified():
    event = {"method": "Fetch.requestPaused", "params": {"requestId": "req-2"}}
    cmd = proxy_auth.build_continue_request(event, 9)
    assert cmd["method"] == "Fetch.continueRequest"
    assert cmd["params"]["requestId"] == "req-2"


def test_dispatch_routes_auth_required():
    event = {"method": "Fetch.authRequired", "params": {"requestId": "r"}}
    cmd = proxy_auth.dispatch_event(event, "u", "p", 1)
    assert cmd["method"] == "Fetch.continueWithAuth"
    assert cmd["params"]["authChallengeResponse"]["response"] == "ProvideCredentials"


def test_dispatch_routes_request_paused():
    event = {"method": "Fetch.requestPaused", "params": {"requestId": "r"}}
    cmd = proxy_auth.dispatch_event(event, "u", "p", 1)
    assert cmd["method"] == "Fetch.continueRequest"


def test_dispatch_ignores_unrelated_events():
    for method in ("Network.responseReceived", "Page.loadEventFired", "Target.attached"):
        assert proxy_auth.dispatch_event({"method": method, "params": {}}, "u", "p", 1) is None


def test_start_cdp_proxy_auth_requires_credentials():
    # No username/password => nothing to arm.
    assert proxy_auth.start_cdp_proxy_auth(9222, None, None) is None
    assert proxy_auth.start_cdp_proxy_auth(9222, "user", "") is None


@given(
    user=st.text(alphabet=string.printable, min_size=1, max_size=32),
    password=st.text(alphabet=string.printable, min_size=1, max_size=32),
    request_id=st.text(alphabet=string.ascii_letters + string.digits + "-", min_size=1, max_size=12),
)
def test_property_auth_response_carries_exact_credentials(user, password, request_id):
    event = {"method": "Fetch.authRequired", "params": {"requestId": request_id}}
    cmd = proxy_auth.dispatch_event(event, user, password, 3)
    resp = cmd["params"]["authChallengeResponse"]
    assert resp["response"] == "ProvideCredentials"
    assert resp["username"] == user
    assert resp["password"] == password
    assert cmd["params"]["requestId"] == request_id
