"""
TRIANGLE BOT  -  DIAGNOSTIC SCRIPT
   Made by @codex_here

Checks everything required to run the bot. Run this FIRST on a new
machine (or RDP / VPS) to find out exactly what is missing or broken.

How to run:   python diagnose.py
"""

import sys, os, platform, time, traceback


def head(msg):
    bar = "=" * 60
    print()
    print(bar)
    print(" " + msg)
    print(bar)


def ok(msg):     print("  [OK]    " + msg)
def fail(msg):   print("  [FAIL]  " + msg)
def warn(msg):   print("  [WARN]  " + msg)
def info(msg):   print("          " + msg)


def section_python():
    head("1. Python environment")
    ok(f"Python: {sys.version.split()[0]}")
    ok(f"Executable: {sys.executable}")
    ok(f"Platform: {platform.system()}  {platform.release()}")
    ok(f"Arch: {platform.machine()}")
    if sys.maxsize <= 2**32:
        warn("32-bit Python detected. MetaTrader5 module needs to match MT5 terminal bitness.")
        warn("Most modern MT5 terminals are 64-bit. Install 64-bit Python.")
    else:
        ok("64-bit Python (good)")


def check_module(name, install_hint, optional=False):
    try:
        __import__(name)
        ok(f"Module '{name}' imported OK")
        return True
    except Exception as e:
        if optional:
            warn(f"Optional module '{name}' missing: {e}")
        else:
            fail(f"Module '{name}' missing or broken: {e}")
        info(f"Fix:  pip install {install_hint}")
        return False


def section_modules():
    head("2. Required Python packages")
    all_ok = True
    all_ok &= check_module("MetaTrader5", "MetaTrader5")
    all_ok &= check_module("pandas",      "pandas")
    all_ok &= check_module("numpy",       "numpy")
    all_ok &= check_module("colorama",    "colorama")
    # tkinter is part of standard library but sometimes missing on stripped Windows Server installs
    try:
        import tkinter as tk
        ok("Module 'tkinter' imported OK")
        try:
            r = tk.Tk()
            r.withdraw()
            r.destroy()
            ok("Tkinter Tk() creation works (GUI popup will work)")
        except Exception as e:
            warn(f"Tkinter import OK but Tk() failed: {e}")
            warn("On RDP/VPS without display, GUI may not work.")
            info("Script will fall back to terminal input for credentials.")
    except Exception as e:
        warn(f"tkinter missing: {e}")
        warn("Script will fall back to terminal input (still works).")
    if platform.system() == "Windows":
        check_module("winreg", "(part of Python stdlib on Windows)", optional=True)
    return all_ok


def section_mt5_init():
    head("3. MetaTrader5 connection (without login)")
    try:
        import MetaTrader5 as mt5
    except Exception as e:
        fail(f"Cannot import MetaTrader5: {e}")
        return False
    try:
        if not mt5.initialize():
            err = mt5.last_error()
            fail(f"mt5.initialize() failed: {err}")
            info("Common causes:")
            info("  - MT5 terminal is not running on THIS machine.")
            info("  - On RDP / VPS: install + run MT5 terminal on the RDP itself,")
            info("    not your local PC. The Python module talks to LOCAL MT5 only.")
            info("  - 32/64 bit mismatch between Python and MT5 terminal.")
            return False
        v = mt5.version()
        ti = mt5.terminal_info()
        ok(f"MT5 initialized.  Version: {v}")
        if ti:
            ok(f"Terminal path: {getattr(ti, 'path', '?')}")
            ok(f"Terminal connected to broker: {getattr(ti, 'connected', '?')}")
        mt5.shutdown()
        return True
    except Exception as e:
        fail(f"Exception during MT5 init: {e}")
        traceback.print_exc()
        return False


def section_creds():
    head("4. Saved credentials")
    home = os.path.expanduser("~")
    creds_dir  = os.path.join(home, ".triangle_bot")
    creds_file = os.path.join(creds_dir, "creds.dat")
    if not os.path.exists(creds_file):
        warn(f"No saved credentials at: {creds_file}")
        warn("This is fine on first run - the GUI will ask for them.")
        return False
    ok(f"Credentials file found: {creds_file}")
    try:
        size = os.path.getsize(creds_file)
        ok(f"Size: {size} bytes")
    except Exception as e:
        warn(f"Cannot read file size: {e}")
    return True


def section_creds_login():
    head("5. MT5 login with saved credentials")
    home = os.path.expanduser("~")
    creds_file = os.path.join(home, ".triangle_bot", "creds.dat")
    if not os.path.exists(creds_file):
        warn("No saved creds. Skipping login test.")
        return None
    try:
        import base64
        with open(creds_file, "rb") as f:
            data = f.read()
        XOR_KEY = b"TriangleBotV2_codex_here_secret_key_2026"
        decrypted = bytes(b ^ XOR_KEY[i % len(XOR_KEY)]
                          for i, b in enumerate(base64.b64decode(data))).decode("utf-8")
        login_str, password, server = decrypted.split("\n", 2)
        login = int(login_str)
        ok(f"Decoded creds.   Account: {login}   Server: {server}")
    except Exception as e:
        fail(f"Could not decode creds.dat: {e}")
        return False
    try:
        import MetaTrader5 as mt5
        if not mt5.initialize(login=login, password=password, server=server):
            err = mt5.last_error()
            fail(f"Login failed: {err}")
            info("Either MT5 terminal isn't running, or saved password / server is wrong.")
            info(f"To redo setup, delete: {creds_file}")
            return False
        acc = mt5.account_info()
        if acc:
            ok(f"Logged in.  Balance: ${acc.balance:,.2f}   Equity: ${acc.equity:,.2f}")
        mt5.shutdown()
        return True
    except Exception as e:
        fail(f"Exception during login: {e}")
        traceback.print_exc()
        return False


def main():
    print("\n  TRIANGLE BOT - DIAGNOSTIC TOOL  (Made by @codex_here)")

    section_python()
    mods_ok = section_modules()

    if mods_ok:
        section_mt5_init()
        section_creds()
        section_creds_login()

    head("Done")
    print("\n  Send a screenshot of this whole window so the issue can be diagnosed.")
    print("  Window stays open for 120 seconds...")
    try:
        time.sleep(120)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("\n  [DIAGNOSTIC CRASH]")
        traceback.print_exc()
        time.sleep(120)
