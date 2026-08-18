"""Parser tests for the gui-proxy-fix bugfix.

Covers:
* Property 3 (Parsing) - ``IP:PORT:USER:PASS`` and ``USER:PASS@IP:PORT`` normalize
  identically in each tool AND across both tools.
* Unit examples - ``has_auth`` is true only when both user and password are
  present; plain ``IP:PORT`` yields ``has_auth = false``.
* Preservation - plain ``IP:PORT`` parsing is unchanged.

Validates: Requirements 2.1, 2.2 (and preservation of 3.1).
"""

import string

import pytest
from hypothesis import given, strategies as st

import main
import autoclose


@pytest.fixture()
def parse_main():
    return main.TeraBoxAutomation(status_callback=lambda *_: None)._parse_proxy


@pytest.fixture()
def parse_ac():
    return autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)._parse_proxy_string


def _core(record):
    """Extract the normalized fields that must match across notations/tools."""
    return (
        record.get("host"),
        record.get("port"),
        record.get("user"),
        record.get("password"),
        bool(record.get("has_auth")),
    )


# --- Unit examples ---------------------------------------------------------

def test_plain_proxy_has_no_auth_main(parse_main):
    rec = parse_main("203.0.113.10:8080")
    assert _core(rec) == ("203.0.113.10", "8080", None, None, False)


def test_plain_proxy_has_no_auth_autoclose(parse_ac):
    rec = parse_ac("203.0.113.10:8080")
    assert _core(rec) == ("203.0.113.10", "8080", None, None, False)
    # Preservation: raw remains the bare host:port with no scheme.
    assert rec["raw"] == "203.0.113.10:8080"


def test_colon_auth_format_main(parse_main):
    rec = parse_main("203.0.113.10:8080:alice:s3cret")
    assert _core(rec) == ("203.0.113.10", "8080", "alice", "s3cret", True)


def test_at_auth_format_main(parse_main):
    rec = parse_main("alice:s3cret@203.0.113.10:8080")
    assert _core(rec) == ("203.0.113.10", "8080", "alice", "s3cret", True)


def test_colon_auth_format_autoclose(parse_ac):
    rec = parse_ac("203.0.113.10:8080:alice:s3cret")
    assert _core(rec) == ("203.0.113.10", "8080", "alice", "s3cret", True)


def test_at_auth_format_autoclose_now_parsed(parse_ac):
    # Regression guard for the original bug: the @ notation used to drop the
    # port and credentials (host=whole string, port='', user=None).
    rec = parse_ac("alice:s3cret@203.0.113.10:8080")
    assert _core(rec) == ("203.0.113.10", "8080", "alice", "s3cret", True)


def test_both_authenticated_records_expose_scheme_free_server(parse_main, parse_ac):
    assert parse_main("alice:s3cret@203.0.113.10:8080")["server"] == "203.0.113.10:8080"
    assert parse_ac("alice:s3cret@203.0.113.10:8080")["raw"] == "203.0.113.10:8080"


# --- Property 3: both notations normalize identically ----------------------

# Field alphabets deliberately exclude ':' and '@' so the two notations are
# unambiguous (the separators that distinguish the formats).
_host = st.text(alphabet=string.ascii_lowercase + string.digits + ".-", min_size=1, max_size=20)
_port = st.integers(min_value=1, max_value=65535).map(str)
_cred = st.text(alphabet=string.ascii_letters + string.digits + "-_.", min_size=1, max_size=16)


@given(host=_host, port=_port, user=_cred, password=_cred)
def test_property3_main_notations_match(host, port, user, password):
    p = main.TeraBoxAutomation(status_callback=lambda *_: None)
    colon = p._parse_proxy(f"{host}:{port}:{user}:{password}")
    at = p._parse_proxy(f"{user}:{password}@{host}:{port}")
    assert _core(colon) == _core(at) == (host, port, user, password, True)


@given(host=_host, port=_port, user=_cred, password=_cred)
def test_property3_autoclose_notations_match(host, port, user, password):
    p = autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)
    colon = p._parse_proxy_string(f"{host}:{port}:{user}:{password}")
    at = p._parse_proxy_string(f"{user}:{password}@{host}:{port}")
    assert _core(colon) == _core(at) == (host, port, user, password, True)


@given(host=_host, port=_port, user=_cred, password=_cred)
def test_property3_cross_tool_normalization_matches(host, port, user, password):
    """The two tools produce the same normalized core for the same proxy."""
    m = main.TeraBoxAutomation(status_callback=lambda *_: None)
    a = autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)
    for raw in (f"{host}:{port}:{user}:{password}", f"{user}:{password}@{host}:{port}"):
        assert _core(m._parse_proxy(raw)) == _core(a._parse_proxy_string(raw))


@given(host=_host, port=_port)
def test_property_plain_proxy_never_has_auth(host, port):
    m = main.TeraBoxAutomation(status_callback=lambda *_: None)
    a = autoclose.TeraBoxAutoClose(status_callback=lambda *_: None)
    raw = f"{host}:{port}"
    assert _core(m._parse_proxy(raw)) == (host, port, None, None, False)
    assert _core(a._parse_proxy_string(raw)) == (host, port, None, None, False)
