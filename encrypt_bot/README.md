# anony_v1 - Encrypted Build

Multi-layer Python source code obfuscation/encryption ke liye toolkit.

## Files

| File | Purpose |
|---|---|
| `triangle_bot_v3.0.py` | Original cleartext source |
| `triangle_bot_v3.0_ENCRYPTED.py` | Basic encrypted build (4 layers) |
| `triangle_bot_v3.0_PROTECTED.py` | Pro encrypted build (4 layers + SHA256 + name mangling + decoys) |
| `encrypt_tool.py` | Basic encryptor |
| `encrypt_tool_pro.py` | Pro encryptor with anti-tamper |

## How it works

```
Source (.py)
   |
   v
[1] UTF-8 bytes
   |
   v
[2] zlib compress (level 9)
   |
   v
[3] zlib compress AGAIN (level 9)
   |
   v
[4] base64 encode
   |
   v
[5] XOR scramble with random 32-byte rotating key
        + position-dependent salt: (i*7 + 13) & 0xFF
   |
   v
[6] base85 final encoding
   |
   v
PRO version adds:
[7] SHA256 integrity check (rejects tampered payloads)
[8] Random variable name mangling
[9] Decoy strings to confuse pattern matchers
```

## Usage

### Apni script encrypt karo:

```bash
# Basic version
python encrypt_tool.py triangle_bot_v3.0.py output_encrypted.py

# Pro version (recommended)
python encrypt_tool_pro.py triangle_bot_v3.0.py output_protected.py
```

### Encrypted version run karo:

```bash
python triangle_bot_v3.0_PROTECTED.py
```

Behavior original script jaise hi rahega - GUI bhi same, trades bhi same, sab kuch.

## Compatibility

- Python 3.7+
- Source code Python version-independent (marshal use nahi karte)
- Windows / Linux / Mac sab pe chalega
- Target machine pe `MetaTrader5`, `pandas`, `numpy`, `colorama`, `pywin32` install hone chahiye

## Important Notes

1. **100% encryption possible nahi hai** - Python interpreter ko code run karne ke liye decode karna hi padta hai. Ye obfuscation hai jo casual reverse engineering bahut mushkil bana deta hai.

2. **Strong protection chahiye to**:
   - **PyArmor** use karo (commercial - real bytecode encryption)
   - **Cython** use karke `.pyd`/`.so` compiled binary banao
   - **Nuitka** use karke standalone `.exe` banao

3. **Tampering**: PROTECTED version mein agar koi loader edit kare ya payload modify kare to SHA256 check fail ho jayega aur script abort ho jayegi.

4. **Each build unique**: Pro version har baar different random keys + variable names use karta hai. Same source ko 2 baar encrypt karoge to different output milega.

## Anti-Reverse Engineering Tips

Agar serious protection chahiye:

```bash
# Option 1: PyArmor (paid, very strong)
pip install pyarmor
pyarmor gen --output dist triangle_bot_v3.0.py

# Option 2: Compile to native binary (free, strong)
pip install nuitka
python -m nuitka --standalone --onefile triangle_bot_v3.0.py

# Option 3: Cython compilation
pip install cython
cythonize -i triangle_bot_v3.0.py
```
