"""
TRIANGLE BREAKOUT AUTO TRADER  v2.1  -  AUTO-TRADE BUGFIX EDITION
   Forex - BTC - ETH - Gold - Silver
   Auto Login | Auto Trade | Trail SL | Color Console

   Made by @codex_here

==================== HOW TO USE ====================
  1. pip install MetaTrader5 pandas numpy colorama pywin32
  2. Double-click run.bat  (or:  python triangle_scanner.py)
  3. First time only:  a small popup window asks for your MT5
     account / password / broker server. Click "Save & Start".
  4. Every run after that:  silent auto-login. NO window popup,
     NO prompts, NO file editing.

  Credentials are stored encrypted in:
     %USERPROFILE%\\.triangle_bot\\creds.dat   (Windows)
     ~/.triangle_bot/creds.dat                  (Linux/Mac)

==================== v2.1 BUGFIXES =================
  [FIX] Breakout was being checked on the CURRENT (still forming)
        candle - now uses the LAST CLOSED candle. This was the main
        reason no trades were being placed.
  [FIX] SL / TP / price now rounded to symbol.digits before sending
        (was causing "Invalid stops" silent rejects on many brokers).
  [FIX] Respect broker SYMBOL_TRADE_STOPS_LEVEL - SL/TP auto-pushed
        to the broker minimum distance if they were too tight.
  [FIX] order_send() now retries with FOK / RETURN if the broker does
        not support IOC filling mode.
  [FIX] is_already_open() now filters magic number manually
        (mt5.positions_get(magic=...) does NOT actually filter).
  [FIX] Triangle detector tolerance was using wrong units, causing it
        to almost never trigger - rebalanced relative to triangle height.
  [FIX] Body/range filter relaxed 50% -> 35% (real breakout candles
        often leave a wick - we were rejecting valid breakouts).
  [FIX] Failed orders now print the broker comment so you can see
        WHY the broker rejected (no more silent failures).
====================================================
"""

# ====================================================================
#  DEFENSIVE IMPORTS  (so cmd window stays open with a useful message
#  even when something is missing - especially important on RDP / VPS)
# ====================================================================
import sys as _sys, os as _os, time as _time, traceback as _tb

def _critical(msg, hint=""):
    print()
    print("=" * 64)
    print(" [CRITICAL ERROR] " + msg)
    print("=" * 64)
    if hint:
        print()
        for line in hint.splitlines():
            print("  " + line)
    print()
    print("  This window stays open for 180 seconds so you can read it...")
    try:
        _time.sleep(180)
    except KeyboardInterrupt:
        pass
    _sys.exit(1)

try:
    import MetaTrader5 as mt5
except Exception as _e:
    _critical(
        f"MetaTrader5 module not loadable: {_e}",
        "Open cmd and run:\n"
        "    pip install MetaTrader5 pandas numpy colorama pywin32\n"
        "\n"
        "If you are on a Windows RDP / VPS:\n"
        "  - You must run pip on the SAME machine where you'll run the bot.\n"
        "  - MetaTrader5 also requires the MT5 TERMINAL APP to be installed\n"
        "    and RUNNING on this same Windows machine - it cannot connect to\n"
        "    a remote MT5. Download MT5 from your broker, install it on the\n"
        "    RDP, log in once manually, then run the bot."
    )

try:
    import pandas as pd
    import numpy as np
except Exception as _e:
    _critical(
        f"pandas / numpy missing or broken: {_e}",
        "Run:  pip install pandas numpy"
    )

try:
    import time, csv, os, sys, base64
    from datetime import datetime, timedelta
    from concurrent.futures import ThreadPoolExecutor, as_completed
except Exception as _e:
    _critical(f"Standard library import error: {_e}")

# Session-wide tracking for the GPU-style dashboard
SESSION = {
    "start_time"       : time.time(),
    "scans"            : 0,
    "last_scan_sec"    : 0.0,
    "total_scan_sec"   : 0.0,
    "trades_placed"    : 0,
    "last_trade_time"  : None,
    "last_trade_pair"  : None,
    "recent_trades"    : [],   # list of dicts (last 5)
}

# How many parallel workers for candle fetching. MT5 read calls are thread-safe.
SCAN_WORKERS = 12

# colorama is OPTIONAL - if missing, run with no colors (still works on RDP)
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except Exception:
    class _NoColor:
        def __getattr__(self, _n): return ""
    Fore = _NoColor()
    Style = _NoColor()
    def init(*a, **k): pass

# Windows-only imports (graceful fallback on other OS)
try:
    import winreg
    WINDOWS = True
except ImportError:
    WINDOWS = False

# ======================================================
#  COLOR SHORTCUTS
# ======================================================
C = {
    "reset"  : Style.RESET_ALL,
    "bold"   : Style.BRIGHT,
    "green"  : Fore.GREEN   + Style.BRIGHT,
    "red"    : Fore.RED     + Style.BRIGHT,
    "yellow" : Fore.YELLOW  + Style.BRIGHT,
    "cyan"   : Fore.CYAN    + Style.BRIGHT,
    "blue"   : Fore.BLUE    + Style.BRIGHT,
    "magenta": Fore.MAGENTA + Style.BRIGHT,
    "white"  : Fore.WHITE   + Style.BRIGHT,
    "gray"   : Fore.WHITE,
    "gold"   : Fore.YELLOW,
    "dim"    : Style.DIM,
}

def clr(text, color): return C.get(color, "") + str(text) + Style.RESET_ALL

# ======================================================
#  TRADING SETTINGS
# ======================================================
RISK_PERCENT  = 1.0     # % of balance risked per trade
MIN_RR        = 2.0     # minimum reward-to-risk to take a trade
TRAIL_AT_RR   = 1.1     # move SL to break-even at this RR
SCAN_INTERVAL = 5       # seconds between scans
JOURNAL_FILE  = "trade_journal.csv"
MAGIC         = 202526  # magic number identifying our trades

# Body / range filter for the breakout candle.  v2.0 used 0.5 which was
# too strict - many real breakouts leave a wick.  Lowered to 0.35.
MIN_BODY_RATIO = 0.35

TIMEFRAMES = {
    "M15": mt5.TIMEFRAME_M15,
    "H1" : mt5.TIMEFRAME_H1,
    "H4" : mt5.TIMEFRAME_H4,
}

SYMBOLS = [
    "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD",
    "EURGBP","EURJPY","GBPJPY","AUDJPY","CADJPY","CHFJPY","EURAUD","EURCHF",
    "BTCUSD","ETHUSD",
    "XAUUSD","XAGUSD",
]

# Broker filling-mode fallback chain. Different brokers support different
# combinations - we try them in order until one is accepted.
FILLING_MODES = [
    mt5.ORDER_FILLING_IOC,
    mt5.ORDER_FILLING_FOK,
    mt5.ORDER_FILLING_RETURN,
]

# ======================================================
#  ENCRYPTED CREDENTIAL STORAGE
#  - First run:   GUI popup -> save encrypted file
#  - Future runs: read silently, auto-login
# ======================================================
CREDS_DIR  = os.path.join(os.path.expanduser("~"), ".triangle_bot")
CREDS_FILE = os.path.join(CREDS_DIR, "creds.dat")
_XOR_KEY   = b"TriangleBotV2_codex_here_secret_key_2026"

def _xor_bytes(data, key):
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

def _save_creds(login, password, server):
    """Encrypt + save creds to user's home directory."""
    os.makedirs(CREDS_DIR, exist_ok=True)
    payload   = f"{login}\n{password}\n{server}".encode("utf-8")
    encrypted = base64.b64encode(_xor_bytes(payload, _XOR_KEY))
    with open(CREDS_FILE, "wb") as f:
        f.write(encrypted)

def _load_creds():
    """Return (login, password, server) or None if not saved yet / corrupt."""
    if not os.path.exists(CREDS_FILE):
        return None
    try:
        with open(CREDS_FILE, "rb") as f:
            encrypted = f.read()
        decrypted = _xor_bytes(base64.b64decode(encrypted), _XOR_KEY).decode("utf-8")
        login_str, password, server = decrypted.split("\n", 2)
        return int(login_str), password, server
    except Exception:
        return None

def _show_setup_gui():
    """
    First-time setup: small tkinter popup window asking for credentials.
    Returns (login, password, server) on Save, or None if user closed window.
    Falls back to terminal input if tkinter / display is not available
    (common on stripped Windows Server RDPs or headless VPS).
    """
    tk = None
    messagebox = None
    try:
        import tkinter as _tk_mod
        from tkinter import messagebox as _mb_mod
        _probe = _tk_mod.Tk()
        _probe.withdraw()
        _probe.destroy()
        tk = _tk_mod
        messagebox = _mb_mod
    except Exception as e:
        print()
        print("  (GUI popup not available on this machine -> using terminal input)")
        print(f"  reason: {e}")
        print()
        print("  ---------- FIRST-TIME SETUP ----------")
        print("  Enter your MT5 credentials (saved encrypted, one time only):")
        print()
        try:
            login_str = input("    MT5 Account Number : ").strip()
            if not login_str:
                return None
            login = int(login_str)
            password = input("    MT5 Password       : ")
            server   = input("    Broker Server      : ").strip()
            if not password or not server:
                print("  [ERROR] All three fields are required.")
                return None
            return login, password, server
        except (KeyboardInterrupt, EOFError):
            return None
        except Exception as e2:
            print(f"  [ERROR] Could not read input: {e2}")
            return None

    result = {"creds": None}
    root = tk.Tk()
    root.title("Triangle Breakout Auto Trader - First-Time Setup")
    root.geometry("480x340")
    root.resizable(False, False)
    root.configure(bg="#1e1e2e")

    try:
        root.attributes("-topmost", True)
        root.after(100, lambda: root.attributes("-topmost", False))
    except Exception:
        pass

    tk.Label(root, text="TRIANGLE BREAKOUT AUTO TRADER  v2.1",
             bg="#1e1e2e", fg="#ffd700",
             font=("Consolas", 13, "bold")).pack(pady=(18, 4))
    tk.Label(root, text="First-time MT5 login setup  (only once)",
             bg="#1e1e2e", fg="#a0a0c0",
             font=("Segoe UI", 9)).pack(pady=(0, 18))

    frm = tk.Frame(root, bg="#1e1e2e")
    frm.pack(padx=40, fill="x")

    def add_row(row, label, show=None):
        tk.Label(frm, text=label, bg="#1e1e2e", fg="#e0e0ff",
                 font=("Segoe UI", 10), anchor="w", width=15
                 ).grid(row=row, column=0, sticky="w", pady=5)
        e = tk.Entry(frm, font=("Consolas", 10), width=28,
                     bg="#2a2a3e", fg="white", insertbackground="white",
                     relief="flat", show=show)
        e.grid(row=row, column=1, padx=8, pady=5, ipady=4)
        return e

    e_login  = add_row(0, "Account Number:")
    e_pw     = add_row(1, "Password:", show="*")
    e_server = add_row(2, "Broker Server:")

    tk.Label(root, text='(Server example:  "Exness-MT5Trial7"  -  copy from MT5 login screen)',
             bg="#1e1e2e", fg="#666688",
             font=("Segoe UI", 8)).pack(pady=(8, 0))

    def on_save(*_):
        try:
            login = int(e_login.get().strip())
        except ValueError:
            messagebox.showerror("Invalid", "Account number must be a number.")
            return
        pw     = e_pw.get()
        server = e_server.get().strip()
        if not pw or not server:
            messagebox.showerror("Missing", "All three fields are required.")
            return
        result["creds"] = (login, pw, server)
        root.destroy()

    btn = tk.Button(root, text="  Save & Start  ",
                    bg="#28a745", fg="white",
                    activebackground="#1e7e34", activeforeground="white",
                    font=("Segoe UI", 11, "bold"),
                    relief="flat", cursor="hand2",
                    command=on_save)
    btn.pack(pady=18, ipady=4)

    tk.Label(root, text="Made by @codex_here",
             bg="#1e1e2e", fg="#666688",
             font=("Segoe UI", 8)).pack(side="bottom", pady=8)

    root.bind("<Return>", on_save)
    e_login.focus()
    root.mainloop()
    return result["creds"]


def load_credentials():
    """
    Return (login, password, server, risk, min_rr, trail, interval).
    """
    saved = _load_creds()
    if saved is not None:
        login, password, server = saved
        print(clr("[OK] Auto-login from saved credentials...", "green"))
        print(clr(f"   Account : {login}", "cyan"))
        print(clr(f"   Server  : {server}", "cyan"))
        return (login, password, server,
                RISK_PERCENT, MIN_RR, TRAIL_AT_RR, SCAN_INTERVAL)

    print(clr("\n  First-time setup - opening configuration window...", "yellow"))
    print(clr("  (After this, every run will auto-login silently.)\n", "dim"))

    creds = _show_setup_gui()
    if creds is None:
        print(clr("\n  [ERROR] Setup cancelled. Run again to retry.", "red"))
        time.sleep(8)
        sys.exit(0)

    login, password, server = creds
    _save_creds(login, password, server)

    print(clr(f"[OK] Credentials saved (encrypted): {CREDS_FILE}", "green"))
    print(clr("     Future runs will auto-login silently.\n", "cyan"))
    print(clr(f"   Account : {login}", "cyan"))
    print(clr(f"   Server  : {server}", "cyan"))

    return (login, password, server,
            RISK_PERCENT, MIN_RR, TRAIL_AT_RR, SCAN_INTERVAL)

# ======================================================
#  BACKGROUND AUTO-START (Windows Startup)
# ======================================================

def register_startup():
    if not WINDOWS:
        return
    try:
        script_path = os.path.abspath(sys.argv[0])
        python_exe  = sys.executable
        cmd         = f'"{python_exe}" "{script_path}"'
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE
        )
        winreg.SetValueEx(key, "TriangleBotV2", 0, winreg.REG_SZ, cmd)
        winreg.CloseKey(key)
        print(clr("  [OK] Registered in Windows Startup!", "green"))
        print(clr( "     -> Will auto-start on every PC reboot", "gray"))
    except Exception as e:
        print(clr(f"  [WARN]  Startup registration failed: {e}", "yellow"))


def remove_startup():
    if not WINDOWS:
        return
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_SET_VALUE
        )
        winreg.DeleteValue(key, "TriangleBotV2")
        winreg.CloseKey(key)
        print(clr("  Removed from Startup.", "yellow"))
    except FileNotFoundError:
        pass
    except Exception as e:
        print(clr(f"  [WARN]  Remove error: {e}", "yellow"))


def wait_for_mt5_and_connect(login, password, server, max_retries=10, wait_sec=30):
    for attempt in range(1, max_retries + 1):
        print(clr(f"\r  MT5 connect attempt #{attempt}/{max_retries}...", "cyan"),
              end="", flush=True)

        success = mt5.initialize(login=login, password=password, server=server)
        if success:
            print()
            return True

        err_code, err_msg = mt5.last_error()

        if err_code in (-10006, -10005, 1):
            print(clr(f"\r  MT5 not found (err:{err_code}) - retrying in {wait_sec}s...",
                      "yellow"), end="", flush=True)
        else:
            print()
            print(clr(f"  [ERROR] Login error: {err_msg} (code:{err_code})", "red"))
            print(clr( "     Saved credentials may be wrong.", "yellow"))
            print(clr(f"     Delete this file to redo setup:  {CREDS_FILE}", "yellow"))
            return False

        time.sleep(wait_sec)

    print()
    print(clr(f"  [ERROR] Tried {max_retries} times - MT5 terminal not detected.", "red"))
    print(clr( "     Please open MT5 manually and rerun the script.", "yellow"))
    return False


# ======================================================
#  BANNER & UI
# ======================================================

def print_banner():
    w = 62
    lines = [
        ("TRIANGLE BREAKOUT AUTO TRADER  v2.1", "gold"),
        ("Forex - Crypto - Gold - Silver", "cyan"),
        ("Auto Login | Auto Trade | Trail SL | Live Console", "gray"),
        ("", ""),
        ("Made by  @codex_here", "magenta"),
    ]
    print()
    print(clr("+" + "="*w + "+", "cyan"))
    for text, color in lines:
        if text == "":
            print(clr("|" + " "*w + "|", "cyan"))
        else:
            pad = (w - len(text)) // 2
            print(clr("|", "cyan") + " "*pad + clr(text, color) +
                  " "*(w - pad - len(text)) + clr("|", "cyan"))
    print(clr("+" + "="*w + "+", "cyan"))


def print_account_info(info, risk, min_rr, trail, interval):
    w = 62
    print(clr("+" + "="*w + "+", "green"))
    rows = [
        ("[OK] MT5 Connected!", "green"),
        ("", ""),
        (f"Account  : {info.login}", "white"),
        (f"Balance  : ${info.balance:,.2f}  |  Equity: ${info.equity:,.2f}", "white"),
        (f"Broker   : {info.server}", "white"),
        (f"Currency : {info.currency}", "white"),
        ("", ""),
        (f"Risk/Trade: {risk}%   Min RR: 1:{min_rr}   Trail@: 1:{trail}", "yellow"),
        (f"Symbols  : {len(SYMBOLS)}   Timeframes: {', '.join(TIMEFRAMES.keys())}", "cyan"),
        (f"Scan     : every {interval}s   Journal: {JOURNAL_FILE}", "cyan"),
    ]
    for text, color in rows:
        content = clr(text, color) if color else ""
        spaces  = w - len(text) - 2
        print(clr("|", "green") + " " + content + " "*max(0, spaces) + clr(" |", "green"))
    print(clr("+" + "="*w + "+", "green"))
    print()


def print_separator(char="-", color="dim"):
    print(clr(char * 64, color))


def _fmt_uptime(secs):
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    if h:
        return f"{h}h {m:02d}m {s:02d}s"
    if m:
        return f"{m}m {s:02d}s"
    return f"{s}s"


# ======================================================
#  GPU-STYLE LIVE DASHBOARD
# ======================================================

def _read_today_journal_stats():
    today = datetime.now().strftime("%Y-%m-%d")
    n = wins = losses = 0
    pnl_total = 0.0
    if not os.path.exists(JOURNAL_FILE):
        return n, wins, losses, pnl_total
    try:
        with open(JOURNAL_FILE, newline="") as f:
            for row in csv.DictReader(f):
                if row.get("Date") != today:
                    continue
                n += 1
                try:
                    pnl = float(row.get("Profit_Loss", 0) or 0)
                except Exception:
                    pnl = 0.0
                pnl_total += pnl
                if pnl > 0:    wins += 1
                elif pnl < 0:  losses += 1
    except Exception:
        pass
    return n, wins, losses, pnl_total


def _format_money(x):
    sign = "+" if x >= 0 else "-"
    return f"{sign}${abs(x):,.2f}"


def print_live_dashboard(approaching_list, scan_num, scan_seconds=None):
    acc = mt5.account_info()
    if acc is None:
        return

    positions       = _our_positions()
    n_today, wins, losses, realized = _read_today_journal_stats()
    unrealized      = sum(p.profit for p in positions)
    uptime          = _fmt_uptime(time.time() - SESSION["start_time"])
    avg_scan        = (SESSION["total_scan_sec"] / SESSION["scans"]) if SESSION["scans"] else 0.0
    last_scan       = SESSION.get("last_scan_sec", 0.0)
    win_pct         = (wins / n_today * 100) if n_today else 0.0

    W = 78
    H = "+" + "=" * W + "+"
    h = "+" + "-" * W + "+"

    def title(text):
        pad = (W - len(text)) // 2
        line = " " * pad + text + " " * (W - pad - len(text))
        print(clr("|", "cyan") + clr(line, "white") + clr("|", "cyan"))

    def section(text, color="yellow"):
        line = "  " + text
        print(clr("|", "cyan") + clr(line, color) +
              " " * (W - len(line)) + clr("|", "cyan"))

    def one_line(content):
        for esc in (Fore.GREEN, Fore.RED, Fore.YELLOW, Fore.CYAN, Fore.MAGENTA,
                    Fore.WHITE, Fore.BLUE, Style.BRIGHT, Style.DIM, Style.RESET_ALL):
            if isinstance(content, str):
                content_plain = content
                for e2 in (Fore.GREEN, Fore.RED, Fore.YELLOW, Fore.CYAN, Fore.MAGENTA,
                           Fore.WHITE, Fore.BLUE, Style.BRIGHT, Style.DIM, Style.RESET_ALL):
                    content_plain = content_plain.replace(e2, "")
                break
        plain_len = len(content_plain) if isinstance(content_plain, str) else 0
        pad = max(0, W - plain_len)
        print(clr("|", "cyan") + content + " " * pad + clr("|", "cyan"))

    print()
    print(clr(H, "cyan"))
    title(f"  BOT STATUS DASHBOARD     -     Scan #{scan_num}     -     "
          f"{datetime.now().strftime('%H:%M:%S')}")
    print(clr(H, "cyan"))

    section("ACCOUNT  /  SESSION", "yellow")
    one_line(
        clr("  Login   :", "gray") + clr(f" {acc.login:<14}", "white") +
        clr("  Uptime    :", "gray") + clr(f" {uptime}", "white")
    )
    one_line(
        clr("  Balance :", "gray") + clr(f" ${acc.balance:>10,.2f}   ", "white") +
        clr("  Scans done:", "gray") + clr(f" {SESSION['scans']}", "white")
    )
    one_line(
        clr("  Equity  :", "gray") + clr(f" ${acc.equity:>10,.2f}   ", "white") +
        clr("  Last scan :", "gray") + clr(f" {last_scan:.2f}s", "white")
    )
    one_line(
        clr("  Free    :", "gray") + clr(f" ${acc.margin_free:>10,.2f}   ", "white") +
        clr("  Avg scan  :", "gray") + clr(f" {avg_scan:.2f}s", "white")
    )

    print(clr(h, "cyan"))
    section("TODAY P&L  /  UNREALIZED P&L", "yellow")
    rcol = "green" if realized >= 0 else "red"
    ucol = "green" if unrealized >= 0 else "red"
    one_line(
        clr("  Trades  :", "gray") + clr(f" {n_today:<14}", "white") +
        clr("  Open pos. :", "gray") + clr(f" {len(positions)}", "white")
    )
    one_line(
        clr("  Wins    :", "gray") + clr(f" {wins} ({win_pct:.1f}%)", "green") +
        " " * max(0, 8 - len(f"{wins} ({win_pct:.1f}%)")) +
        clr("    Unrealized:", "gray") + clr(f" {_format_money(unrealized)}", ucol)
    )
    one_line(
        clr("  Losses  :", "gray") + clr(f" {losses:<14}", "red") +
        clr("  Realized  :", "gray") + clr(f" {_format_money(realized)}", rcol)
    )

    if SESSION.get("last_trade_time"):
        ago_s = int(time.time() - SESSION["last_trade_time"])
        ago_str = _fmt_uptime(ago_s) + " ago"
        one_line(
            clr("  Last trade:", "gray") + clr(f" {SESSION['last_trade_pair']} - {ago_str}",
                                              "magenta")
        )

    print(clr(h, "cyan"))
    if positions:
        section(f"OPEN POSITIONS  [{len(positions)}]   -  live P&L + RR achieved", "yellow")
        hdr = (f"   {'Pair':<10} {'Side':<5} {'Entry':>10} {'Now':>10} "
               f"{'SL':>10} {'TP':>10} {'P&L':>9} {'RR':>7}")
        one_line(clr(hdr, "dim"))
        for pos in positions:
            sym       = pos.symbol
            side      = "BUY " if pos.type == 0 else "SELL"
            entry     = pos.price_open
            now       = pos.price_current
            sl, tp    = pos.sl, pos.tp
            profit    = pos.profit
            risk_dist = abs(entry - sl) if sl else 0
            move      = (now - entry) if pos.type == 0 else (entry - now)
            rr_now    = (move / risk_dist) if risk_dist > 0 else 0
            row_color = "green" if profit >= 0 else "red"
            row = (f"   {sym:<10} {side:<5} {entry:>10.5f} {now:>10.5f} "
                   f"{sl:>10.5f} {tp:>10.5f} "
                   f"{_format_money(profit):>9} {rr_now:>+6.2f}")
            one_line(clr(row, row_color))
    else:
        section("OPEN POSITIONS  [0]   -  no live trades", "dim")

    print(clr(h, "cyan"))
    recent = SESSION.get("recent_trades", [])
    if recent:
        section(f"LAST {len(recent)} TRADES (this session)", "yellow")
        hdr = (f"   {'Time':<10} {'Pair':<10} {'TF':<4} {'Dir':<5} "
               f"{'Pattern':<12} {'RR':>6} {'Lot':>6}")
        one_line(clr(hdr, "dim"))
        for t in recent[-5:]:
            row = (f"   {t['time']:<10} {t['symbol']:<10} {t['tf']:<4} {t['dir']:<5} "
                   f"{t['pattern']:<12} {t['rr']:>+5.2f}  {t['lot']:>6.2f}")
            color = "green" if t["dir"] == "BUY" else "red"
            one_line(clr(row, color))
    else:
        section("LAST TRADES (this session)  -  none yet", "dim")

    print(clr(h, "cyan"))
    if approaching_list:
        section(f"NEXT SETUPS FORMING  [{len(approaching_list)}]   -  approaching breakout",
                "yellow")
        hdr = (f"   {'Pair':<10} {'TF':<4} {'Pattern':<12} {'Resistance':>11} "
               f"{'Support':>11} {'~Dist':>8}  Hint")
        one_line(clr(hdr, "dim"))
        approaching_list.sort(key=lambda a: a["distance_pct"])
        for a in approaching_list[:6]:
            hint_color = "green" if a["hint"] == "BUY breakout" else "red"
            row_left  = (f"   {a['symbol']:<10} {a['tf']:<4} {a['pattern']:<12} "
                         f"{a['R']:>11.5f} {a['S']:>11.5f} {a['distance_pct']:>7.2f}%  ")
            one_line(clr(row_left, "white") + clr(a["hint"], hint_color))
        if len(approaching_list) > 6:
            one_line(clr(f"   ... and {len(approaching_list)-6} more", "dim"))
    else:
        section("NEXT SETUPS FORMING  -  no triangles approaching breakout", "dim")

    print(clr(h, "cyan"))
    section("STRATEGY LOGIC", "yellow")
    one_line(clr("  Pattern :", "gray") +
             clr(" Triangle breakout (ASCENDING /\\, DESCENDING \\/, SYMMETRICAL <>)", "white"))
    one_line(clr("  Entry   :", "gray") +
             clr(f" CLOSED candle outside R/S, body >= {int(MIN_BODY_RATIO*100)}% of range", "white"))
    one_line(clr("  SL / TP :", "gray") +
             clr(" SL at opposite triangle line   |   TP at entry +/- triangle height", "white"))
    one_line(clr("  Filters :", "gray") +
             clr(f" Min RR >= 1:{MIN_RR}    Risk = {RISK_PERCENT}% balance", "white"))
    one_line(clr("  Trail   :", "gray") +
             clr(f" Move SL to break-even at 1:{TRAIL_AT_RR}   then trail at 50% of risk", "white"))
    print(clr(H, "cyan"))


def print_scan_header(scan_num):
    now  = datetime.now().strftime("%H:%M:%S")
    date = datetime.now().strftime("%Y-%m-%d")
    print()
    print_separator("=", "cyan")
    print(clr(f"  SCAN #{scan_num}  -  {date}  {now}  -  {len(SYMBOLS)} symbols", "cyan"))
    print_separator("=", "cyan")


def print_signal_box(symbol, tf_name, triangle, breakout, rr, lot):
    direction = breakout["direction"]
    entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
    height        = breakout["height"]
    pattern       = triangle["pattern"]

    is_buy    = direction == "BUY"
    box_color = "green" if is_buy else "red"
    dir_icon  = "BUY " if is_buy else "SELL"
    pat_icon  = {"ASCENDING": "/\\", "DESCENDING": "\\/", "SYMMETRICAL": "<>"}.get(pattern, "*")

    w = 52
    print()
    print(clr("  +" + "="*w + "+", box_color))
    print(clr("  |", box_color) +
          clr(f"  {dir_icon} SIGNAL  -  {symbol}  [{tf_name}]".center(w), box_color) +
          clr("|", box_color))
    print(clr("  +" + "="*w + "+", box_color))

    rows = [
        ("Pattern  ", f"{pat_icon} {pattern} Triangle Breakout"),
        ("Entry    ", f"{round(entry, 5)}"),
        ("Stop Loss", f"{round(sl, 5)}"),
        ("Take Prof", f"{round(tp, 5)}"),
        ("Est. RR  ", f"1:{round(rr, 2)}  ({'Excellent' if rr>=3 else 'Good' if rr>=2 else 'Low'})"),
        ("Height   ", f"~{round(height*10000, 1)} pips"),
        ("Lot Size ", f"{lot}"),
    ]

    for label, val in rows:
        line   = f"  {label}: {val}"
        spaces = w - len(line) - 1
        print(clr("  |", box_color) + clr(line, "white") +
              " "*max(0, spaces) + clr(" |", box_color))

    print(clr("  +" + "="*w + "+", box_color))

# ======================================================
#  JOURNAL
# ======================================================

def setup_journal():
    if not os.path.exists(JOURNAL_FILE):
        with open(JOURNAL_FILE, "w", newline="") as f:
            csv.writer(f).writerow([
                "Date","Time","Symbol","Timeframe","Direction",
                "Entry","SL","TP","Lot","Est_RR",
                "Triangle_Height_Pips","Pattern_Type",
                "Status","Profit_Loss","Notes"
            ])
        print(clr(f"  Journal created: {JOURNAL_FILE}", "cyan"))


def log_trade(symbol, tf, direction, entry, sl, tp, lot, rr, height,
              pattern, status="OPEN", pnl=0, notes=""):
    now = datetime.now()
    with open(JOURNAL_FILE, "a", newline="") as f:
        csv.writer(f).writerow([
            now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"),
            symbol, tf, direction,
            round(entry, 5), round(sl, 5), round(tp, 5),
            lot, round(rr, 2), round(height, 1), pattern,
            status, round(pnl, 2), notes
        ])

# ======================================================
#  CANDLE DATA
# ======================================================

def get_candles(symbol, timeframe, count=120):
    """Fetch candles. Note: index 0 is OLDEST, index -1 is NEWEST (still forming)."""
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
    if rates is None or len(rates) == 0:
        return None
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    return df

# ======================================================
#  TRIANGLE DETECTION
# ======================================================

def find_swing_highs(df, window=5):
    highs = []
    for i in range(window, len(df) - window):
        if df["high"].iloc[i] == df["high"].iloc[i - window:i + window + 1].max():
            highs.append((i, df["high"].iloc[i]))
    return highs


def find_swing_lows(df, window=5):
    lows = []
    for i in range(window, len(df) - window):
        if df["low"].iloc[i] == df["low"].iloc[i - window:i + window + 1].min():
            lows.append((i, df["low"].iloc[i]))
    return lows


def detect_triangle(df_closed):
    """
    Detect a triangle pattern on CLOSED candles only.
    df_closed should already exclude the current forming candle.

    [v2.1 FIX] Tolerance is now relative to triangle HEIGHT (the proper
    unit for slope-per-candle), not absolute price. The old version used
    `tol = price * 0.0005` which made the comparisons numerically wrong
    and almost never matched a pattern.
    """
    if df_closed is None or len(df_closed) < 30:
        return None
    sh = find_swing_highs(df_closed)
    sl = find_swing_lows(df_closed)
    if len(sh) < 2 or len(sl) < 2:
        return None

    rh = sh[-3:]; rl = sl[-3:]
    hv = [h[1] for h in rh]; lv = [l[1] for l in rl]

    # Slope per index across the swing points
    ht = float(np.polyfit(range(len(hv)), hv, 1)[0])
    lt = float(np.polyfit(range(len(lv)), lv, 1)[0])

    resistance = float(hv[-1])
    support    = float(lv[-1])
    height     = resistance - support
    avg        = float(df_closed["close"].iloc[-1])

    if height <= 0 or height < avg * 0.0015:
        return None

    # Tolerance: a slope is "flat" if its move-per-index is small relative
    # to the triangle's total height. 15% of height per index = effectively flat.
    tol = height * 0.15

    pattern = None
    if   abs(ht) < tol and lt > tol:                pattern = "ASCENDING"
    elif ht < -tol and abs(lt) < tol:               pattern = "DESCENDING"
    elif ht < -tol and lt > tol:                    pattern = "SYMMETRICAL"

    if pattern is None:
        return None

    return {"pattern": pattern, "resistance": resistance, "support": support,
            "height": height, "high_trend": ht, "low_trend": lt}

# ======================================================
#  BREAKOUT CHECK
# ======================================================

def check_breakout(df, triangle):
    """
    [v2.1 CRITICAL FIX]
    Originally df.iloc[-1] (the CURRENT FORMING candle) was used for the
    breakout check. That candle has not closed yet so its body, range and
    close are all incomplete - this was the #1 reason the bot 'never
    placed a trade'. We now use df.iloc[-2] (the last CLOSED candle) and
    df.iloc[-3] (the one before it) for the cross-confirmation.
    """
    if triangle is None or df is None or len(df) < 3:
        return None

    last = df.iloc[-2]   # last CLOSED candle  (was -1 in v2.0)
    prev = df.iloc[-3]   # candle before the last closed one (was -2 in v2.0)

    close = float(last["close"])
    open_ = float(last["open"])
    body  = abs(close - open_)
    rng   = float(last["high"]) - float(last["low"])

    if rng <= 0 or (body / rng) < MIN_BODY_RATIO:
        return None

    R, S, H = triangle["resistance"], triangle["support"], triangle["height"]

    if close > R and float(prev["close"]) <= R:
        return {"direction": "BUY",  "entry": close, "sl": S, "tp": close + H, "height": H}
    if close < S and float(prev["close"]) >= S:
        return {"direction": "SELL", "entry": close, "sl": R, "tp": close - H, "height": H}
    return None

# ======================================================
#  LOT SIZE
# ======================================================

def calculate_lot(symbol, entry, sl, risk_percent):
    acc  = mt5.account_info()
    if acc is None: return 0.01
    info = mt5.symbol_info(symbol)
    if info is None: return 0.01

    risk_money = acc.balance * (risk_percent / 100)
    tick_value = info.trade_tick_value
    tick_size  = info.trade_tick_size or info.point
    point      = info.point

    if not tick_value or not tick_size or not point:
        return info.volume_min

    sl_distance = abs(entry - sl)
    if sl_distance <= 0:
        return info.volume_min

    # Loss for 1.0 lot if SL hits = (sl_distance / tick_size) * tick_value
    loss_per_lot = (sl_distance / tick_size) * tick_value
    if loss_per_lot <= 0:
        return info.volume_min

    lot = risk_money / loss_per_lot

    # Round to volume_step
    step = info.volume_step or 0.01
    lot = round(lot / step) * step
    lot = max(info.volume_min, min(lot, info.volume_max))
    # Always round to 2 decimal places for clean display
    return round(lot, 2)

# ======================================================
#  PRICE ROUNDING + STOPS LEVEL HELPERS  (v2.1 NEW)
# ======================================================

def _round_price(symbol_info, price):
    """Round price to broker's allowed digits."""
    return round(float(price), int(symbol_info.digits))

def _enforce_stops_level(symbol_info, direction, current_price, sl, tp):
    """
    Brokers reject orders whose SL/TP are closer than SYMBOL_TRADE_STOPS_LEVEL
    points to the current market price. Push them out to the broker minimum
    if they are too tight.
    """
    stops_level = int(getattr(symbol_info, "trade_stops_level", 0) or 0)
    if stops_level <= 0:
        return sl, tp
    point = symbol_info.point
    min_dist = stops_level * point

    if direction == "BUY":
        if (current_price - sl) < min_dist:
            sl = current_price - min_dist
        if (tp - current_price) < min_dist:
            tp = current_price + min_dist
    else:  # SELL
        if (sl - current_price) < min_dist:
            sl = current_price + min_dist
        if (current_price - tp) < min_dist:
            tp = current_price - min_dist
    return sl, tp

# ======================================================
#  PLACE ORDER  (v2.1 - rounding + stops_level + filling fallback)
# ======================================================

def place_order(symbol, direction, entry, sl, tp, lot):
    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        return None, "no_info_or_tick"

    # Use live ask/bid as the actual entry, not the candle close
    price = tick.ask if direction == "BUY" else tick.bid

    # Enforce broker stops_level + round to digits
    sl, tp = _enforce_stops_level(info, direction, price, sl, tp)
    price  = _round_price(info, price)
    sl     = _round_price(info, sl)
    tp     = _round_price(info, tp)

    otype = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL

    last_result = None
    last_err = ""
    for fmode in FILLING_MODES:
        req = {
            "action"      : mt5.TRADE_ACTION_DEAL,
            "symbol"      : symbol,
            "volume"      : float(lot),
            "type"        : otype,
            "price"       : price,
            "sl"          : sl,
            "tp"          : tp,
            "deviation"   : 20,
            "magic"       : MAGIC,
            "comment"     : "TriangleBot_v2.1",
            "type_time"   : mt5.ORDER_TIME_GTC,
            "type_filling": fmode,
        }
        result = mt5.order_send(req)
        last_result = result

        if result is None:
            last_err = f"order_send returned None (last_error={mt5.last_error()})"
            continue

        if result.retcode == mt5.TRADE_RETCODE_DONE:
            return result, "ok"

        # If filling mode is unsupported, try the next one
        if result.retcode in (
            mt5.TRADE_RETCODE_INVALID_FILL,
            mt5.TRADE_RETCODE_UNSUPPORTED_FILL_POLICY
            if hasattr(mt5, "TRADE_RETCODE_UNSUPPORTED_FILL_POLICY") else -1,
        ):
            last_err = f"filling mode {fmode} unsupported, trying next..."
            continue

        # Any other retcode -> stop and report
        last_err = f"retcode={result.retcode} ({getattr(result, 'comment', '')})"
        break

    return last_result, last_err

# ======================================================
#  TRAILING SL  (v2.1 - magic filtered manually)
# ======================================================

def _our_positions():
    """Return list of positions opened by THIS bot (filtered by magic)."""
    all_pos = mt5.positions_get()
    if not all_pos:
        return []
    return [p for p in all_pos if p.magic == MAGIC]

def manage_trailing_sl(trail_rr):
    positions = _our_positions()
    if not positions:
        return

    for pos in positions:
        sym   = pos.symbol
        info  = mt5.symbol_info(sym)
        if info is None:
            continue
        direc = "BUY" if pos.type == 0 else "SELL"
        entry = pos.price_open
        c_sl, c_tp = pos.sl, pos.tp
        tick  = mt5.symbol_info_tick(sym)
        if tick is None: continue

        price = tick.bid if direc == "BUY" else tick.ask
        risk  = abs(entry - c_sl)
        if risk <= 0: continue

        pir = (price - entry) / risk if direc == "BUY" else (entry - price) / risk
        new_sl = c_sl

        # Move to break-even (slightly in profit) once RR >= trail_rr
        if pir >= trail_rr:
            if direc == "BUY"  and c_sl < entry: new_sl = entry + risk * 0.1
            if direc == "SELL" and c_sl > entry: new_sl = entry - risk * 0.1

        # Trail at 50% of original risk distance behind price
        if pir >= 1.5:
            td = risk * 0.5
            if direc == "BUY":  new_sl = max(new_sl, price - td)
            else:               new_sl = min(new_sl, price + td)

        if new_sl != c_sl:
            new_sl_r = _round_price(info, new_sl)
            # Make sure new SL still respects stops_level
            new_sl_r, _ = _enforce_stops_level(info, direc, price, new_sl_r, c_tp)
            new_sl_r = _round_price(info, new_sl_r)
            req = {
                "action"  : mt5.TRADE_ACTION_SLTP,
                "position": pos.ticket,
                "symbol"  : sym,
                "sl"      : new_sl_r,
                "tp"      : _round_price(info, c_tp),
            }
            res = mt5.order_send(req)
            if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                phase = "BREAKEVEN" if pir < 1.5 else "TRAILING"
                print(clr(f"  {phase} SL -> {sym} | New SL: {new_sl_r} | RR: 1:{round(pir, 2)}",
                          "yellow"))

# ======================================================
#  DUPLICATE CHECK  (v2.1 fix)
# ======================================================

def is_already_open(symbol):
    """[v2.1 FIX] mt5.positions_get(symbol=X, magic=Y) does NOT actually
    filter by magic - we now filter manually."""
    pos = mt5.positions_get(symbol=symbol)
    if not pos:
        return False
    return any(p.magic == MAGIC for p in pos)

# ======================================================
#  MAIN SCAN
# ======================================================

def _scan_one_pair(symbol, tf_name, tf_code, min_rr):
    """
    Worker: fetch + analyze ONE (symbol, timeframe) pair.
    No order placement here.
    """
    try:
        if not mt5.symbol_select(symbol, True):
            return None
        df = get_candles(symbol, tf_code)
        if df is None or len(df) < 30:
            return None

        # [v2.1 FIX] Detect pattern on CLOSED candles only
        # (drop the still-forming last bar so the swing detector and
        # trendline don't include a half-finished candle).
        df_closed = df.iloc[:-1].reset_index(drop=True)
        triangle = detect_triangle(df_closed)
        if triangle is None:
            return None

        breakout = check_breakout(df, triangle)
        if breakout is None:
            # Approaching-breakout hint: how close is the LIVE price?
            R, S, H = triangle["resistance"], triangle["support"], triangle["height"]
            tick = mt5.symbol_info_tick(symbol)
            live = tick.last if (tick and tick.last) else float(df["close"].iloc[-1])
            prox = H * 0.10
            if abs(live - R) < prox or abs(live - S) < prox:
                dist_R = abs(live - R)
                dist_S = abs(live - S)
                closest = min(dist_R, dist_S)
                distance_pct = (closest / live * 100) if live else 0
                hint = "BUY breakout" if dist_R <= dist_S else "SELL breakout"
                return {
                    "type": "approaching",
                    "symbol": symbol, "tf": tf_name,
                    "pattern": triangle["pattern"],
                    "R": R, "S": S, "close": live,
                    "distance_pct": distance_pct, "hint": hint,
                }
            return None

        # Breakout detected -> evaluate RR
        entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
        if abs(entry - sl) == 0:
            return None
        rr = abs(tp - entry) / abs(entry - sl)
        if rr < min_rr:
            return {
                "type": "skip_rr", "symbol": symbol, "tf": tf_name, "rr": rr,
            }
        return {
            "type": "signal",
            "symbol": symbol, "tf": tf_name,
            "triangle": triangle, "breakout": breakout, "rr": rr,
        }
    except Exception as e:
        return {"type": "error", "symbol": symbol, "tf": tf_name, "error": str(e)}


def scan_all_symbols(scan_num, min_rr, risk_percent, trail_rr):
    print_scan_header(scan_num)
    t0 = time.time()

    signals = approaching = skipped = 0
    approaching_list = []
    signal_results = []

    tasks = []
    for symbol in SYMBOLS:
        for tf_name, tf_code in TIMEFRAMES.items():
            tasks.append((symbol, tf_name, tf_code))

    with ThreadPoolExecutor(max_workers=SCAN_WORKERS) as ex:
        futures = [ex.submit(_scan_one_pair, s, tn, tc, min_rr) for s, tn, tc in tasks]
        for fut in as_completed(futures):
            r = fut.result()
            if r is None:
                continue
            if r["type"] == "approaching":
                approaching += 1
                approaching_list.append(r)
                pat_icon = {"ASCENDING":"/\\","DESCENDING":"\\/","SYMMETRICAL":"<>"}.get(
                    r["pattern"], "*")
                print(clr("  APPROACHING  ", "yellow") +
                      clr(f"{r['symbol']:<10}", "white") +
                      clr(f"[{r['tf']}] ", "gray") +
                      clr(f"{pat_icon} {r['pattern']}", "magenta") +
                      clr(f"  R:{round(r['R'], 5)}  S:{round(r['S'], 5)}", "gray"))
            elif r["type"] == "skip_rr":
                skipped += 1
                print(clr("  LOW RR       ", "red") +
                      clr(f"{r['symbol']:<10}", "white") +
                      clr(f"[{r['tf']}]", "gray") +
                      clr(f"  RR={round(r['rr'], 2)} (need {min_rr})", "red"))
            elif r["type"] == "signal":
                signal_results.append(r)
            elif r["type"] == "error":
                print(clr(f"  [WARN] {r['symbol']} [{r['tf']}] error: {r['error']}",
                          "yellow"))

    # Place orders SEQUENTIALLY
    for r in signal_results:
        symbol = r["symbol"]; tf_name = r["tf"]
        triangle = r["triangle"]; breakout = r["breakout"]; rr = r["rr"]
        entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
        signals += 1

        lot = calculate_lot(symbol, entry, sl, risk_percent)
        print_signal_box(symbol, tf_name, triangle, breakout, rr, lot)

        if is_already_open(symbol):
            print(clr(f"  Position already open on {symbol} - skipping", "cyan"))
            continue

        result, status = place_order(symbol, breakout["direction"], entry, sl, tp, lot)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            print(clr(f"  [OK] ORDER PLACED  Ticket#{result.order}  Lot:{lot}", "green"))
            log_trade(symbol, tf_name, breakout["direction"],
                      entry, sl, tp, lot, rr,
                      breakout["height"] * 10000, triangle["pattern"],
                      notes=f"Auto|{tf_name}|Scan#{scan_num}")
            SESSION["trades_placed"] += 1
            SESSION["last_trade_time"] = time.time()
            SESSION["last_trade_pair"] = f"{symbol} ({tf_name})"
            SESSION["recent_trades"].append({
                "time"   : datetime.now().strftime("%H:%M:%S"),
                "symbol" : symbol, "tf": tf_name,
                "dir"    : breakout["direction"],
                "pattern": triangle["pattern"],
                "rr"     : rr, "lot": lot,
            })
            if len(SESSION["recent_trades"]) > 20:
                SESSION["recent_trades"] = SESSION["recent_trades"][-20:]
        else:
            rc      = result.retcode if result is not None else "None"
            comment = getattr(result, "comment", "") if result is not None else ""
            print(clr(f"  [ERROR] ORDER FAILED  {symbol}  retcode={rc}  "
                      f"comment='{comment}'  status='{status}'", "red"))
            print(clr(f"          MT5 last_error: {mt5.last_error()}", "red"))

    elapsed = time.time() - t0
    SESSION["scans"] += 1
    SESSION["last_scan_sec"] = elapsed
    SESSION["total_scan_sec"] += elapsed

    print()
    print(clr("  SCAN SUMMARY  ", "bold") +
          clr(f"Signals:{signals}  ", "green") +
          clr(f"Approaching:{approaching}  ", "yellow") +
          clr(f"Skipped:{skipped}  ", "red") +
          clr(f"({elapsed:.2f}s, {SCAN_WORKERS} parallel workers)", "cyan"))

    manage_trailing_sl(trail_rr)

    print_live_dashboard(approaching_list, scan_num, scan_seconds=elapsed)

# ======================================================
#  MAIN
# ======================================================

def main():
    print_banner()

    login, password, server, risk, min_rr, trail, interval = load_credentials()

    if WINDOWS:
        try:
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Run",
                0, winreg.KEY_READ
            )
            winreg.QueryValueEx(key, "TriangleBotV2")
            winreg.CloseKey(key)
        except FileNotFoundError:
            print(clr("\n  First run - registering in Windows Startup...", "yellow"))
            register_startup()
        except Exception:
            pass

    print(clr("\n  Waiting for MT5 (background auto-login)...", "cyan"))
    print(clr(f"     Account : {login}  |  Server : {server}", "gray"))

    connected = wait_for_mt5_and_connect(login, password, server,
                                         max_retries=10, wait_sec=30)

    if not connected:
        print(clr("\n  [ERROR] Could not connect to MT5!", "red"))
        print(clr( "     -> Open the MT5 terminal and run again", "yellow"))
        time.sleep(15)
        return

    info = mt5.account_info()
    print_account_info(info, risk, min_rr, trail, interval)

    # Confirm AlgoTrading is enabled (one of the silent reasons orders fail)
    term = mt5.terminal_info()
    if term is not None and not term.trade_allowed:
        print(clr("  [WARN] 'AlgoTrading' is DISABLED in your MT5 terminal!", "red"))
        print(clr("         Click the 'Algo Trading' button in MT5 toolbar to enable.", "yellow"))
        print(clr("         Bot will keep scanning, but trades will be REJECTED until you enable it.\n",
                  "yellow"))

    setup_journal()

    print(clr("  Bot is running! Press Ctrl+C to stop\n", "green"))

    scan_num = 0
    try:
        while True:
            scan_num += 1
            scan_all_symbols(scan_num, min_rr, risk, trail)
            tick = 1 if interval <= 10 else 5
            for remaining in range(interval, 0, -tick):
                print(clr(f"\r  Next scan in: {remaining}s ...    ", "dim"),
                      end="", flush=True)
                time.sleep(min(tick, remaining))
            print()

    except KeyboardInterrupt:
        print()
        print_separator("=", "cyan")
        print(clr("  Shutting down... disconnecting MT5", "yellow"))
        mt5.shutdown()
        print(clr("  [OK] Closed cleanly. Goodbye!", "green"))
        print(clr("  Made by @codex_here", "magenta"))
        print_separator("=", "cyan")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        pass
    except Exception as e:
        import traceback
        print()
        print(clr("="*60, "red"))
        print(clr(" [CRASH] Uncaught error - script stopped", "red"))
        print(clr("="*60, "red"))
        print(clr(f"\n  {type(e).__name__}: {e}\n", "yellow"))
        print(clr("Full traceback:", "dim"))
        traceback.print_exc()
        print(clr("\n  This window will close in 60 seconds...", "dim"))
        try:
            time.sleep(60)
        except Exception:
            pass
        sys.exit(1)
