"""
Build script: takes triangle_scanner.py and produces triangle_scanner_encrypted.py
using multi-layer (zlib + base85 + zlib + base64) wrapping of the SOURCE.

Cross-version safe: works on any Python 3.x because we keep source (not bytecode).
The output file is a single self-contained Python file that runs identically
to the original, but the source code is no longer human-readable.
"""

import base64, zlib, sys

SRC = "triangle_scanner.py"
DST = "triangle_scanner_encrypted.py"

# 1. Read original source
with open(SRC, "rb") as f:
    source_bytes = f.read()

# 2. Multi-layer obfuscation: zlib -> base85 -> zlib -> base64
payload = zlib.compress(source_bytes, level=9)
payload = base64.b85encode(payload)
payload = zlib.compress(payload, level=9)
payload = base64.b64encode(payload)

# 3. Pretty-format the payload as 80-char lines so the file isn't one giant line
chunks = [payload[i:i+76].decode("ascii") for i in range(0, len(payload), 76)]
formatted = "\n".join(chunks)

LOADER = '''# -*- coding: utf-8 -*-
# TRIANGLE BREAKOUT AUTO TRADER v2.0  -  Made by @codex_here
# Encrypted build. Do not modify or redistribute the source.
# Run with:   python triangle_scanner_encrypted.py
import base64 as _b, zlib as _z
_p = b"""\\
{payload}"""
exec(compile(_z.decompress(_b.b85decode(_z.decompress(_b.b64decode(_p)))).decode("utf-8"), "<triangle_scanner>", "exec"))
'''

with open(DST, "w", encoding="utf-8") as f:
    f.write(LOADER.format(payload=formatted))

import os
orig = os.path.getsize(SRC)
enc  = os.path.getsize(DST)
print(f"OK  {SRC} ({orig:,} bytes)  ->  {DST} ({enc:,} bytes)")
print(f"Built with Python {sys.version.split()[0]}  (cross-version safe)")
