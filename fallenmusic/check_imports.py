"""Import every FallenMusic module without touching the network.

This is the regression test for a real ordering bug: upstream creates
``BOT_ID`` / ``BOT_NAME`` / ``BOT_USERNAME`` / ``BOT_MENTION`` / ``fallendb``
*inside* ``fallen_startup()``, which only works because upstream runs that
function at package import time.  Modules such as ``Modules/skip.py``,
``Modules/watcher.py`` and ``Helpers/dossier.py`` bind those names by value:

    from FallenMusic import BOT_USERNAME, fallendb

So if the package is imported with startup deferred (as web.py does) and the
names don't exist yet, importing the modules raises::

    ImportError: cannot import name 'fallendb' from 'FallenMusic'

``FallenMusic/__init__.py`` now defines safe module-level defaults so the
package is importable in any order.  This script proves that holds.

Usage:
    FALLEN_DEFER_STARTUP=1 python3 check_imports.py
Requires dummy values for API_ID / API_HASH / BOT_TOKEN / SESSION / OWNER_ID —
no connection is ever attempted.
"""

import importlib
import os
import sys

# Never connect to Telegram.
os.environ.setdefault("FALLEN_DEFER_STARTUP", "1")


def main() -> int:
    import FallenMusic as fm
    from FallenMusic.Modules import ALL_MODULES

    print(f"package imported from {fm.__file__}")
    print(f"deferred startup active: {fm.DEFER_STARTUP}")
    if not fm.DEFER_STARTUP:
        print("FAIL: FALLEN_DEFER_STARTUP was not honoured")
        return 1

    failed = []
    for name in ALL_MODULES:
        module = f"FallenMusic.Modules.{name}"
        try:
            importlib.import_module(module)
            print(f"  ok   {module}")
        except Exception as exc:  # noqa: BLE001 — report every failure, not just the first
            failed.append((module, exc))
            print(f"  FAIL {module} -> {type(exc).__name__}: {exc}")

    print(f"\n{len(ALL_MODULES) - len(failed)}/{len(ALL_MODULES)} modules imported")
    if failed:
        print("IMPORT CHECK FAILED")
        return 1

    # The identity globals must exist before startup for the imports above to
    # have worked; confirm they are the safe defaults, not real Telegram data.
    print(f"BOT_ID default={fm.BOT_ID!r} BOT_NAME default={fm.BOT_NAME!r}")
    print(f"fallendb default={fm.fallendb!r}")
    print("IMPORT CHECK PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
