"""Test configuration for the TeraBox automation proxy-fix suite.

Adds the tool directory (the parent of ``tests/``) to ``sys.path`` so the
tests can import ``main``, ``autoclose`` and ``proxy_auth`` directly, mirroring
how the GUIs are launched (``python main.py`` from the tool directory).
"""

import os
import sys

TOOL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if TOOL_DIR not in sys.path:
    sys.path.insert(0, TOOL_DIR)
