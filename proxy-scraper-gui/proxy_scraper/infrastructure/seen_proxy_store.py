"""Disk-backed JSON implementation of the persistent ``SeenProxyStore``.

This is the concrete, infrastructure-layer implementation of the Domain-layer
``SeenProxyStore`` contract (Component 7). It records the host (IP) of every
proxy actually surfaced to the user so the same IP is never surfaced again on
any future run -- including after the app is closed and reopened on a later
day (Requirement 19).

Design references:
* Component 7: SeenProxyStore
* Model 5: SeenProxy
* Error Scenario 7: seen-proxy store file missing or corrupt
* Properties 9, 10, 11

Key behaviours:
* Membership (``contains``) is O(1) via an in-memory ``dict[str, float]``
  mapping each host to its ``first_seen`` epoch timestamp.
* The default on-disk path is resolved with
  ``platformdirs.user_data_dir("proxy-scraper-gui")``; a configurable path may
  be supplied (tests point it at a temp directory).
* JSON format: ``{"version": 1, "hosts": {host: first_seen}}``.
* ``save()`` writes to a temp file then atomically ``os.replace``-s it into
  place so an interrupted write cannot corrupt the store.
* ``load()`` treats a missing OR corrupt/malformed file as an empty history
  and never raises; a corrupt file is logged and backed up as
  ``<name>.bak`` before re-initializing.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Iterable, Optional, Union

from proxy_scraper.domain.models import is_valid_host

logger = logging.getLogger(__name__)

APP_NAME = "proxy-scraper-gui"
DEFAULT_FILENAME = "seen_proxies.json"
SCHEMA_VERSION = 1


def default_store_path() -> Path:
    """Resolve the default per-user on-disk path for the seen-proxy history.

    Uses ``platformdirs.user_data_dir`` so the location is platform-appropriate
    (e.g. ``~/.local/share/proxy-scraper-gui/seen_proxies.json`` on Linux,
    ``%LOCALAPPDATA%\\proxy-scraper-gui\\seen_proxies.json`` on Windows).
    """
    import platformdirs

    data_dir = platformdirs.user_data_dir(APP_NAME)
    return Path(data_dir) / DEFAULT_FILENAME


class JsonSeenProxyStore:
    """A JSON-file-backed, in-memory-indexed :class:`SeenProxyStore`.

    Parameters
    ----------
    path:
        The on-disk location for the JSON history. Defaults to the
        platform-appropriate per-user data directory. Tests may pass a temp
        path. ``str`` and :class:`pathlib.Path` are both accepted.
    """

    def __init__(self, path: Optional[Union[str, os.PathLike]] = None) -> None:
        self._path: Path = Path(path) if path is not None else default_store_path()
        # Host -> first_seen epoch timestamp. O(1) membership via dict keys.
        self._hosts: dict[str, float] = {}

    # -- properties ----------------------------------------------------------

    @property
    def path(self) -> Path:
        """The on-disk path this store reads from / writes to."""
        return self._path

    # -- load ----------------------------------------------------------------

    def load(self) -> None:
        """Read the persisted history from disk into memory.

        A missing file is normal on first run. A corrupt/malformed file is
        logged, backed up as ``<name>.bak`` and treated as an empty history.
        This method never raises (Error Scenario 7, Requirement 19.5).
        """
        self._hosts = {}
        if not self._path.exists():
            logger.debug("Seen-proxy store %s does not exist yet (first run).", self._path)
            return

        try:
            raw = self._path.read_text(encoding="utf-8")
            data = json.loads(raw)
            hosts = self._parse_hosts(data)
        except Exception as exc:  # noqa: BLE001 - never propagate (Error Scenario 7)
            logger.warning(
                "Seen-proxy store %s is unreadable/corrupt (%s); "
                "initializing an empty history.",
                self._path,
                exc,
            )
            self._backup_corrupt_file()
            self._hosts = {}
            return

        self._hosts = hosts
        logger.info("Loaded %d seen proxy host(s) from %s", len(self._hosts), self._path)

    @staticmethod
    def _parse_hosts(data: object) -> dict[str, float]:
        """Extract a ``{host: first_seen}`` mapping from parsed JSON, ignoring
        malformed entries. Raises ``ValueError`` if the top-level structure is
        not a valid store document."""
        if not isinstance(data, dict):
            raise ValueError("seen-proxy store root must be a JSON object")
        hosts_obj = data.get("hosts", {})
        if not isinstance(hosts_obj, dict):
            raise ValueError("'hosts' must be a JSON object")

        parsed: dict[str, float] = {}
        for host, first_seen in hosts_obj.items():
            if not isinstance(host, str) or not is_valid_host(host):
                # Skip malformed individual entries rather than failing the
                # whole load; the store self-heals from that point forward.
                continue
            try:
                ts = float(first_seen)
            except (TypeError, ValueError):
                ts = 0.0
            if ts < 0:
                ts = 0.0
            parsed[host] = ts
        return parsed

    def _backup_corrupt_file(self) -> None:
        """Best-effort backup of a corrupt store file to ``<name>.bak``."""
        try:
            backup = self._path.with_name(self._path.name + ".bak")
            os.replace(self._path, backup)
            logger.info("Backed up corrupt seen-proxy store to %s", backup)
        except OSError as exc:  # pragma: no cover - defensive
            logger.warning("Could not back up corrupt seen-proxy store: %s", exc)

    # -- membership / mutation ----------------------------------------------

    def contains(self, host: str) -> bool:
        """True if *host* (IP) has been surfaced on this or a previous run."""
        return host in self._hosts

    def add(self, host: str) -> bool:
        """Record *host* as surfaced.

        Returns ``True`` if it was newly added, ``False`` if it was already
        present. Idempotent per host (Requirement 19.1).
        """
        if host in self._hosts:
            return False
        self._hosts[host] = time.time()
        return True

    def add_many(self, hosts: Iterable[str]) -> int:
        """Record several hosts at once; returns the count newly added."""
        added = 0
        for host in hosts:
            if self.add(host):
                added += 1
        return added

    # -- persistence ---------------------------------------------------------

    def save(self) -> None:
        """Persist the current history to disk atomically.

        Writes to a temp file in the same directory and then ``os.replace``-s
        it into place so an interrupted write cannot corrupt the existing
        store (write safety of Error Scenario 7).
        """
        self._path.parent.mkdir(parents=True, exist_ok=True)
        document = {"version": SCHEMA_VERSION, "hosts": self._hosts}
        payload = json.dumps(document, indent=2, sort_keys=True)

        fd, tmp_name = tempfile.mkstemp(
            dir=str(self._path.parent), prefix=self._path.name + ".", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(payload)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp_name, self._path)
        except Exception:
            # Clean up the temp file on failure; do not leave debris.
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise

    # -- reset ---------------------------------------------------------------

    def clear(self) -> None:
        """Empty the history in memory and on disk (Requirement 19.4)."""
        self._hosts = {}
        self.save()

    # -- introspection -------------------------------------------------------

    def __len__(self) -> int:
        return len(self._hosts)

    def __contains__(self, host: object) -> bool:  # convenience
        return isinstance(host, str) and host in self._hosts
