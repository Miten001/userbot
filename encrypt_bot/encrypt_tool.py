"""
Multi-layer Python source code obfuscator/encryptor.

Layers applied (in order):
    1. Source string -> UTF-8 bytes
    2. zlib compression (pass 1, level 9)
    3. zlib compression (pass 2, level 9)
    4. base64 encoding
    5. byte-level XOR scramble with random 32-byte rotating key
    6. base85 final encoding
    7. wrap in self-decrypting loader

Output is version-independent - chalega Python 3.7+ pe.

Usage:
    python encrypt_tool.py <input.py> <output.py>
"""
import sys, os, zlib, base64, random


LOADER_TEMPLATE = '''# -*- coding: utf-8 -*-
# =====================================================================
#  ENCRYPTED BUILD  -  anony_v1  -  @codex_here
#  Multi-layer obfuscation: zlib x2 + b64 + XOR scramble + b85
#  Tampering / reverse-engineering loader ko break kar dega.
# =====================================================================
import sys as _S, base64 as _B, zlib as _Z

_K = __KEY__

def _U(_d, _k):
    _o = bytearray(len(_d))
    _l = len(_k)
    for _i in range(len(_d)):
        _o[_i] = _d[_i] ^ _k[_i % _l] ^ ((_i * 7 + 13) & 0xFF)
    return bytes(_o)

_P = "__PAYLOAD__"

try:
    _x1 = _B.b85decode(_P.encode())
    _x2 = _U(_x1, _K)
    _x3 = _B.b64decode(_x2)
    _x4 = _Z.decompress(_x3)
    _x5 = _Z.decompress(_x4)
    exec(compile(_x5.decode("utf-8"), "<encrypted>", "exec"), globals())
except Exception as _e:
    _S.stderr.write("\\n[ENCRYPTED LOADER] decryption failed: {0}\\n".format(_e))
    _S.exit(1)
'''


def scramble(data: bytes, key: bytes) -> bytes:
    out = bytearray(len(data))
    klen = len(key)
    for i in range(len(data)):
        out[i] = data[i] ^ key[i % klen] ^ ((i * 7 + 13) & 0xFF)
    return bytes(out)


def encrypt_file(input_path: str, output_path: str) -> None:
    with open(input_path, "r", encoding="utf-8") as f:
        source = f.read()

    print(f"[1/6] Source loaded: {len(source):,} chars")

    src_bytes = source.encode("utf-8")

    compressed1 = zlib.compress(src_bytes, 9)
    print(f"[2/6] Compressed (pass 1): {len(compressed1):,} bytes")

    compressed2 = zlib.compress(compressed1, 9)
    print(f"[3/6] Compressed (pass 2): {len(compressed2):,} bytes")

    b64_encoded = base64.b64encode(compressed2)
    print(f"[4/6] Base64 encoded: {len(b64_encoded):,} bytes")

    key = bytes(random.randint(0, 255) for _ in range(32))
    scrambled = scramble(b64_encoded, key)
    print(f"[5/6] XOR scrambled with 32-byte random key")

    final = base64.b85encode(scrambled).decode()
    print(f"[6/6] Base85 final payload: {len(final):,} chars")

    loader = LOADER_TEMPLATE.replace("__KEY__", repr(key)).replace("__PAYLOAD__", final)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(loader)

    src_size = os.path.getsize(input_path)
    out_size = os.path.getsize(output_path)
    print()
    print("=" * 60)
    print(f"  Original :  {src_size:>10,} bytes  ({input_path})")
    print(f"  Encrypted:  {out_size:>10,} bytes  ({output_path})")
    print(f"  Ratio    :  {out_size / src_size * 100:>10.1f}%")
    print("=" * 60)
    print()
    print("Run karne ke liye:")
    print(f"    python {os.path.basename(output_path)}")
    print()
    print("Note: target machine pe MT5, pandas, numpy, colorama install hone chahiye.")
    print("Encrypted file Python 3.7+ ke saath compatible hai.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python encrypt_tool.py <input.py> <output.py>")
        sys.exit(1)
    encrypt_file(sys.argv[1], sys.argv[2])
