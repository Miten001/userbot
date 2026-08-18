"""Command-line builder tests for the gui-proxy-fix bugfix.

Covers:
* Fix - authenticated AND plain proxies both emit
  ``--proxy-server=http://host:port`` (scheme included); no MV2
  ``--load-extension`` path is ever produced.
* Fix - authenticated proxies launch to ``about:blank`` (auth armed before the
  first credentialed navigation); plain / no proxy launch straight to the URL.
* Preservation (Property 2) - proxy disabled => no proxy args, direct URL.

Validates: Requirements 2.1, 2.2, 2.3 (and preservation 3.1, 3.2).
"""

import string

import pytest
from hypothesis import given, strategies as st

import main
import autoclose


@pytest.fixture()
def m():
    return main.TeraBoxAutomation(status_callback=lambda *_: None)


@pytest.fixture()
def a():
    return autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)


TARGET = "https://example.com/target"


# --- Fix: uniform --proxy-server with scheme -------------------------------

@pytest.mark.parametrize("raw", [
    "203.0.113.10:8080:alice:s3cret",
    "alice:s3cret@203.0.113.10:8080",
    "203.0.113.10:8080",
])
def test_main_emits_proxy_server_with_scheme(m, raw):
    args = m._proxy_launch_args(raw)
    assert args == ["--proxy-server=http://203.0.113.10:8080"]


@pytest.mark.parametrize("raw", [
    "203.0.113.10:8080:alice:s3cret",
    "alice:s3cret@203.0.113.10:8080",
    "203.0.113.10:8080",
])
def test_autoclose_emits_proxy_server_with_scheme(a, raw):
    args = a._proxy_launch_args(raw)
    assert args == ["--proxy-server=http://203.0.113.10:8080"]


def test_autoclose_accepts_dict_proxy(a):
    info = a._parse_proxy_string("alice:s3cret@203.0.113.10:8080")
    assert a._proxy_launch_args(info) == ["--proxy-server=http://203.0.113.10:8080"]


@pytest.mark.parametrize("raw", [
    "203.0.113.10:8080:alice:s3cret",
    "alice:s3cret@203.0.113.10:8080",
    "203.0.113.10:8080",
])
def test_no_mv2_load_extension_path(m, a, raw):
    """The obsolete Manifest V2 --load-extension mechanism must be gone."""
    assert all("--load-extension" not in x for x in m._proxy_launch_args(raw))
    assert all("--load-extension" not in x for x in a._proxy_launch_args(raw))


# --- Fix: start-url arming for authenticated proxies -----------------------

@pytest.mark.parametrize("raw", [
    "203.0.113.10:8080:alice:s3cret",
    "alice:s3cret@203.0.113.10:8080",
])
def test_authenticated_proxy_starts_at_about_blank(m, a, raw):
    assert m._proxy_start_url(TARGET, raw) == "about:blank"
    assert a._proxy_start_url(TARGET, raw) == "about:blank"


def test_plain_proxy_starts_at_target(m, a):
    assert m._proxy_start_url(TARGET, "203.0.113.10:8080") == TARGET
    assert a._proxy_start_url(TARGET, "203.0.113.10:8080") == TARGET


# --- Preservation (Property 2): proxy disabled -----------------------------

def test_no_proxy_produces_no_args_and_direct_url(m, a):
    assert m._proxy_launch_args(None) == []
    assert a._proxy_launch_args(None) == []
    assert m._proxy_start_url(TARGET, None) == TARGET
    assert a._proxy_start_url(TARGET, None) == TARGET


# --- Property: plain proxies always route with scheme, never about:blank ---

_host = st.text(alphabet=string.ascii_lowercase + string.digits + ".-", min_size=1, max_size=20)
_port = st.integers(min_value=1, max_value=65535).map(str)


@given(host=_host, port=_port)
def test_property_plain_proxy_routing_preserved(host, port):
    m = main.TeraBoxAutomation(status_callback=lambda *_: None)
    a = autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)
    raw = f"{host}:{port}"
    expected = [f"--proxy-server=http://{host}:{port}"]
    assert m._proxy_launch_args(raw) == expected
    assert a._proxy_launch_args(raw) == expected
    # Plain proxies keep navigating directly to the target (no about:blank arming).
    assert m._proxy_start_url(TARGET, raw) == TARGET
    assert a._proxy_start_url(TARGET, raw) == TARGET
