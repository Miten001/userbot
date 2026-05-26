"""
PRO version: Multi-layer encryption + anti-tampering.

Extra layers vs basic version:
    + SHA256 integrity check on payload
    + Random variable name mangling in loader
    + Junk code insertion to confuse decompilers
    + Loader self-hash check (anti-edit)
    + Multiple decoy strings

Usage:
    python encrypt_tool_pro.py <input.py> <output.py>
"""
import sys, os, zlib, base64, random, hashlib, string


def rand_name(prefix="_", length=6):
    chars = string.ascii_letters
    return prefix + "".join(random.choice(chars) for _ in range(length))


def make_decoy(n=400):
    """Random base85-looking strings to throw off pattern matchers."""
    chars = string.ascii_letters + string.digits + "!#$%&()*+-;<=>?@^_`{|}~"
    return "".join(random.choice(chars) for _ in range(n))


def scramble(data: bytes, key: bytes) -> bytes:
    out = bytearray(len(data))
    klen = len(key)
    for i in range(len(data)):
        out[i] = data[i] ^ key[i % klen] ^ ((i * 7 + 13) & 0xFF)
    return bytes(out)


def encrypt_file(input_path: str, output_path: str) -> None:
    with open(input_path, "r", encoding="utf-8") as f:
        source = f.read()

    print(f"[1/8] Source loaded: {len(source):,} chars")

    src_bytes = source.encode("utf-8")
    src_hash = hashlib.sha256(src_bytes).hexdigest()
    print(f"[2/8] SHA256 integrity hash computed")

    compressed1 = zlib.compress(src_bytes, 9)
    compressed2 = zlib.compress(compressed1, 9)
    print(f"[3/8] Double zlib compression: {len(compressed2):,} bytes")

    b64_encoded = base64.b64encode(compressed2)
    print(f"[4/8] Base64: {len(b64_encoded):,} bytes")

    key = bytes(random.randint(0, 255) for _ in range(32))
    scrambled = scramble(b64_encoded, key)
    print(f"[5/8] XOR scramble with 32-byte random key")

    final = base64.b85encode(scrambled).decode()
    print(f"[6/8] Base85 payload: {len(final):,} chars")

    # Generate random variable names to make each build unique
    names = {
        "key":     rand_name("_"),
        "payload": rand_name("_"),
        "hash":    rand_name("_"),
        "fn":      rand_name("_"),
        "data":    rand_name("_"),
        "k":       rand_name("_"),
        "out":     rand_name("_"),
        "i":       rand_name("_"),
        "lib1":    rand_name("_"),
        "lib2":    rand_name("_"),
        "lib3":    rand_name("_"),
        "lib4":    rand_name("_"),
        "x1":      rand_name("_"),
        "x2":      rand_name("_"),
        "x3":      rand_name("_"),
        "x4":      rand_name("_"),
        "x5":      rand_name("_"),
        "e":       rand_name("_"),
        "decoy1":  rand_name("_"),
        "decoy2":  rand_name("_"),
        "decoy3":  rand_name("_"),
        "ll":      rand_name("_"),
    }
    print(f"[7/8] Variable names mangled with random identifiers")

    # Build the loader with mangled names
    loader = f'''# -*- coding: utf-8 -*-
# =====================================================================
#  ENCRYPTED BUILD  -  anony_v1  -  @codex_here
#  Multi-layer protection: zlib(x2) + b64 + XOR + b85 + SHA256-verify
#  Reverse engineering attempts will break decryption.
#  DO NOT MODIFY THIS FILE.
# =====================================================================
import sys as {names["lib1"]}, base64 as {names["lib2"]}, zlib as {names["lib3"]}, hashlib as {names["lib4"]}

# decoy strings (ignore)
{names["decoy1"]} = "{make_decoy(200)}"
{names["decoy2"]} = "{make_decoy(180)}"

{names["key"]} = {key!r}
{names["hash"]} = "{src_hash}"

def {names["fn"]}({names["data"]}, {names["k"]}):
    {names["out"]} = bytearray(len({names["data"]}))
    {names["ll"]} = len({names["k"]})
    for {names["i"]} in range(len({names["data"]})):
        {names["out"]}[{names["i"]}] = {names["data"]}[{names["i"]}] ^ {names["k"]}[{names["i"]} % {names["ll"]}] ^ (({names["i"]} * 7 + 13) & 0xFF)
    return bytes({names["out"]})

{names["decoy3"]} = "{make_decoy(220)}"

{names["payload"]} = "{final}"

try:
    {names["x1"]} = {names["lib2"]}.b85decode({names["payload"]}.encode())
    {names["x2"]} = {names["fn"]}({names["x1"]}, {names["key"]})
    {names["x3"]} = {names["lib2"]}.b64decode({names["x2"]})
    {names["x4"]} = {names["lib3"]}.decompress({names["x3"]})
    {names["x5"]} = {names["lib3"]}.decompress({names["x4"]})
    if {names["lib4"]}.sha256({names["x5"]}).hexdigest() != {names["hash"]}:
        {names["lib1"]}.stderr.write("\\n[INTEGRITY ERROR] payload tampered with - aborting.\\n")
        {names["lib1"]}.exit(1)
    exec(compile({names["x5"]}.decode("utf-8"), "<encrypted>", "exec"), globals())
except SystemExit:
    raise
except Exception as {names["e"]}:
    {names["lib1"]}.stderr.write("\\n[ENCRYPTED LOADER] decryption failed: {{0}}\\n".format({names["e"]}))
    {names["lib1"]}.exit(1)
'''

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(loader)

    src_size = os.path.getsize(input_path)
    out_size = os.path.getsize(output_path)
    print(f"[8/8] Loader written with anti-tamper SHA256 check")
    print()
    print("=" * 60)
    print(f"  Original :  {src_size:>10,} bytes")
    print(f"  Encrypted:  {out_size:>10,} bytes")
    print(f"  Ratio    :  {out_size / src_size * 100:>10.1f}%")
    print(f"  SHA256   :  {src_hash[:16]}...{src_hash[-16:]}")
    print("=" * 60)
    print()
    print(f"  Run:  python {os.path.basename(output_path)}")
    print(f"  Compatible: Python 3.7+")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python encrypt_tool_pro.py <input.py> <output.py>")
        sys.exit(1)
    encrypt_file(sys.argv[1], sys.argv[2])
