#!/usr/bin/env python3
"""Generate GhostShell extension icons (PNG) with zero third-party deps."""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "extension", "icons")
OUT = os.path.normpath(OUT)


def png(path, size, pixels):
    """pixels: list of rows, each row a list of (r,g,b,a)."""
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    blob = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(blob)


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def inside_shield(nx, ny):
    """nx, ny in [0,1]. Shield silhouette: broad top, tapers to a point at bottom."""
    cx, cy = 0.5, 0.5
    # top edge and bottom tip
    top, tip = 0.06, 0.97
    if ny < top or ny > tip:
        return False
    if ny < 0.40:
        half = 0.40
        # round the top corners
        r = 0.13
        if ny < top + r:
            dx = abs(nx - cx)
            dy = top + r - ny
            if dx > half - r:
                if math.hypot(dx - (half - r), dy) > r:
                    return False
        return abs(nx - cx) <= half
    t = (ny - 0.40) / (tip - 0.40)
    half = 0.40 * (1.0 - t ** 1.55)
    return abs(nx - cx) <= half


def render(size):
    # vertical gradient: deep indigo -> cyan (privacy/shield feel)
    top_c = (34, 38, 74)
    mid_c = (23, 92, 122)
    bot_c = (12, 168, 168)
    rows = []
    for y in range(size):
        row = []
        fy = (y + 0.5) / size
        for x in range(size):
            fx = (x + 0.5) / size
            if not inside_shield(fx, fy):
                row.append((0, 0, 0, 0))
                continue
            if fy < 0.5:
                base = mix(top_c, mid_c, fy / 0.5)
            else:
                base = mix(mid_c, bot_c, (fy - 0.5) / 0.5)
            # soft light sheen from upper-left
            sheen = max(0.0, 1.0 - math.hypot(fx - 0.32, fy - 0.26) / 0.85)
            col = mix(base, (255, 255, 255), 0.16 * sheen)
            # antialias edges by supersampling coverage
            cover = 0.0
            for sy in (-0.3, 0.3):
                for sx in (-0.3, 0.3):
                    if inside_shield(fx + sx / size, fy + sy / size):
                        cover += 0.25
            row.append((col[0], col[1], col[2], int(round(255 * cover))))
        rows.append(row)
    # keyhole / mask slit: a darker vertical slot in the middle
    slot_w = max(1, int(size * 0.075))
    slot_top = int(size * 0.42)
    slot_bot = int(size * 0.80)
    cx = size // 2
    for y in range(slot_top, slot_bot):
        t = (y - slot_top) / max(1, (slot_bot - slot_top))
        w = int(slot_w * (1.0 - 0.55 * t))
        for x in range(cx - w, cx + w + 1):
            if 0 <= x < size:
                r, g, b, a = rows[y][x]
                if a:
                    rows[y][x] = (mix((r, g, b), (226, 240, 255), 0.88)[0],
                                  mix((r, g, b), (226, 240, 255), 0.88)[1],
                                  mix((r, g, b), (226, 240, 255), 0.88)[2], a)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 48, 128):
        png(os.path.join(OUT, f"icon{size}.png"), size, render(size))
        print("wrote", size)


if __name__ == "__main__":
    main()
