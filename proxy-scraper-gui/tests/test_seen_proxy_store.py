"""Tests for the persistent JsonSeenProxyStore (Tasks 18.4, 18.9).

Covers Component 7 / Model 5 / Error Scenario 7 / Property 11:
* load / add / contains / save / clear behaviour and idempotent add,
* missing file loads as empty,
* corrupt/truncated file loads as empty without raising (and is backed up),
* a fresh instance re-loading the same path sees hosts persisted by a prior
  instance (simulating an app restart on another day),
* Property 11: after clear() (and reload) contains(h) is false and len == 0.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from proxy_scraper.infrastructure.seen_proxy_store import (
    JsonSeenProxyStore,
    default_store_path,
)


# --- host strategy (valid IPv4) --------------------------------------------

_host_strategy = st.builds(
    lambda a, b, c, d: f"{a}.{b}.{c}.{d}",
    st.integers(0, 255),
    st.integers(0, 255),
    st.integers(0, 255),
    st.integers(0, 255),
)


# --- Task 18.4: unit tests -------------------------------------------------


def test_missing_file_loads_as_empty(tmp_path):
    store = JsonSeenProxyStore(tmp_path / "seen_proxies.json")
    store.load()  # file does not exist yet
    assert len(store) == 0
    assert store.contains("1.2.3.4") is False


def test_add_contains_and_idempotency(tmp_path):
    store = JsonSeenProxyStore(tmp_path / "seen_proxies.json")
    store.load()

    assert store.add("203.0.113.7") is True
    assert store.contains("203.0.113.7") is True
    assert len(store) == 1

    # Adding an already-present host is idempotent and returns False.
    assert store.add("203.0.113.7") is False
    assert len(store) == 1


def test_add_many_counts_only_new(tmp_path):
    store = JsonSeenProxyStore(tmp_path / "seen_proxies.json")
    store.load()
    store.add("203.0.113.7")
    added = store.add_many(["203.0.113.7", "198.51.100.42", "198.51.100.43"])
    assert added == 2
    assert len(store) == 3


def test_save_writes_expected_json_schema(tmp_path):
    path = tmp_path / "seen_proxies.json"
    store = JsonSeenProxyStore(path)
    store.load()
    store.add("203.0.113.7")
    store.save()

    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert "203.0.113.7" in data["hosts"]
    assert isinstance(data["hosts"]["203.0.113.7"], (int, float))


def test_persistence_across_fresh_instances(tmp_path):
    """A fresh instance re-loading the same path sees hosts persisted by a
    prior instance -- simulating closing and reopening the app another day."""
    path = tmp_path / "seen_proxies.json"

    first = JsonSeenProxyStore(path)
    first.load()
    first.add("203.0.113.7")
    first.add("198.51.100.42")
    first.save()

    # Brand-new instance, same path (as if the app were restarted).
    second = JsonSeenProxyStore(path)
    second.load()
    assert second.contains("203.0.113.7") is True
    assert second.contains("198.51.100.42") is True
    assert len(second) == 2


def test_corrupt_file_loads_as_empty_without_raising(tmp_path):
    path = tmp_path / "seen_proxies.json"
    path.write_text("{ this is not valid json ", encoding="utf-8")  # truncated/garbage

    store = JsonSeenProxyStore(path)
    store.load()  # must not raise (Error Scenario 7)

    assert len(store) == 0
    # The corrupt file is backed up rather than left in place.
    assert path.with_name(path.name + ".bak").exists()


def test_malformed_schema_loads_as_empty_without_raising(tmp_path):
    path = tmp_path / "seen_proxies.json"
    # Valid JSON but wrong shape (a list, not the store object).
    path.write_text(json.dumps([1, 2, 3]), encoding="utf-8")

    store = JsonSeenProxyStore(path)
    store.load()
    assert len(store) == 0


def test_malformed_individual_entries_are_skipped(tmp_path):
    path = tmp_path / "seen_proxies.json"
    document = {
        "version": 1,
        "hosts": {
            "203.0.113.7": 1731000000.0,
            "": 1.0,                    # invalid host -> skipped
            "not a host!!": 2.0,        # invalid host -> skipped
            "198.51.100.42": "oops",    # bad timestamp -> coerced to 0.0
        },
    }
    path.write_text(json.dumps(document), encoding="utf-8")

    store = JsonSeenProxyStore(path)
    store.load()
    assert store.contains("203.0.113.7") is True
    assert store.contains("198.51.100.42") is True
    assert store.contains("") is False
    assert len(store) == 2


def test_clear_empties_memory_and_disk(tmp_path):
    path = tmp_path / "seen_proxies.json"
    store = JsonSeenProxyStore(path)
    store.load()
    store.add("203.0.113.7")
    store.save()

    store.clear()
    assert len(store) == 0
    assert store.contains("203.0.113.7") is False

    # A fresh instance re-loading the same path also sees an empty history.
    reloaded = JsonSeenProxyStore(path)
    reloaded.load()
    assert len(reloaded) == 0


def test_save_is_atomic_no_temp_files_left(tmp_path):
    path = tmp_path / "seen_proxies.json"
    store = JsonSeenProxyStore(path)
    store.load()
    store.add("203.0.113.7")
    store.save()
    # Only the final file should remain -- no leftover .tmp debris.
    leftovers = [p.name for p in tmp_path.iterdir() if p.name.endswith(".tmp")]
    assert leftovers == []


def test_default_store_path_uses_app_name():
    path = default_store_path()
    assert path.name == "seen_proxies.json"
    assert "proxy-scraper-gui" in str(path)


# --- Task 18.9: Property 11 - clearing the seen history is a reset ---------


@settings(max_examples=50)
@given(hosts=st.lists(_host_strategy, max_size=30))
def test_property_11_clear_resets_history(hosts):
    """After clear() (and a reload from disk) contains(h) is false for every
    host and len == 0 -- both in memory and after reload (Property 11)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "seen_proxies.json"
        store = JsonSeenProxyStore(path)
        store.load()
        store.add_many(hosts)
        store.save()

        store.clear()

        # In memory.
        assert len(store) == 0
        for h in hosts:
            assert store.contains(h) is False

        # After reload from disk.
        reloaded = JsonSeenProxyStore(path)
        reloaded.load()
        assert len(reloaded) == 0
        for h in hosts:
            assert reloaded.contains(h) is False
