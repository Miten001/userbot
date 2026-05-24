"""
TRIANGLE BREAKOUT AUTO TRADER  v2.0  -  ZERO-EDIT AUTO LOGIN EDITION
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
====================================================
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import time, csv, os, sys, base64
from datetime import datetime
from colorama import init, Fore, Style

# Windows-only imports (graceful fallback on other OS)
try:
    import winreg
    WINDOWS = True
except ImportError:
    WINDOWS = False

init(autoreset=True)  # Windows color support

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
SCAN_INTERVAL = 30      # seconds between scans
JOURNAL_FILE  = "trade_journal.csv"

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
    """
    try:
        import tkinter as tk
        from tkinter import messagebox
    except ImportError:
        # Fallback: no GUI available -> use plain stdin (rare)
        print(clr("\n  GUI not available. Using terminal input as fallback.", "yellow"))
        try:
            login    = int(input("  MT5 Account Number : "))
            password = input("  MT5 Password       : ")
            server   = input("  Broker Server      : ")
            return login, password, server
        except Exception:
            return None

    result = {"creds": None}
    root = tk.Tk()
    root.title("Triangle Breakout Auto Trader - First-Time Setup")
    root.geometry("480x340")
    root.resizable(False, False)
    root.configure(bg="#1e1e2e")

    # Try to bring to front
    try:
        root.attributes("-topmost", True)
        root.after(100, lambda: root.attributes("-topmost", False))
    except Exception:
        pass

    # Title bar
    tk.Label(root, text="TRIANGLE BREAKOUT AUTO TRADER  v2.0",
             bg="#1e1e2e", fg="#ffd700",
             font=("Consolas", 13, "bold")).pack(pady=(18, 4))
    tk.Label(root, text="First-time MT5 login setup  (only once)",
             bg="#1e1e2e", fg="#a0a0c0",
             font=("Segoe UI", 9)).pack(pady=(0, 18))

    # Inputs frame
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

    # Helper text
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

    # Enter key submits
    root.bind("<Return>", on_save)
    e_login.focus()
    root.mainloop()
    return result["creds"]


def load_credentials():
    """
    Return (login, password, server, risk, min_rr, trail, interval).

    Flow:
      1. If encrypted creds file exists -> silent auto-login.
      2. Otherwise -> show GUI popup, save encrypted, then continue.
      3. NEVER requires editing the .py file. NEVER prompts in cmd
         once credentials have been saved once.
    """
    saved = _load_creds()
    if saved is not None:
        login, password, server = saved
        print(clr("[OK] Auto-login from saved credentials...", "green"))
        print(clr(f"   Account : {login}", "cyan"))
        print(clr(f"   Server  : {server}", "cyan"))
        return (login, password, server,
                RISK_PERCENT, MIN_RR, TRAIL_AT_RR, SCAN_INTERVAL)

    # First run -> open GUI for one-time setup
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
    """Add the script to HKCU\\...\\Run so it launches with Windows."""
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
    """Remove the script from Windows Startup."""
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
    """
    Wait for MT5 terminal to be available and log in automatically.
    Retries every `wait_sec` seconds, up to `max_retries` times.
    Returns True if connected, False otherwise.
    """
    for attempt in range(1, max_retries + 1):
        print(clr(f"\r  MT5 connect attempt #{attempt}/{max_retries}...", "cyan"),
              end="", flush=True)

        success = mt5.initialize(login=login, password=password, server=server)
        if success:
            print()  # newline after \r
            return True

        err_code, err_msg = mt5.last_error()

        # MT5 terminal not running -> wait and retry
        if err_code in (-10006, -10005, 1):  # IPC errors / terminal not found
            print(clr(f"\r  MT5 not found (err:{err_code}) - retrying in {wait_sec}s...",
                      "yellow"), end="", flush=True)
        else:
            # Hard failure - wrong credentials / server
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
        ("TRIANGLE BREAKOUT AUTO TRADER  v2.0", "gold"),
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


# ======================================================
#  LIVE DASHBOARD  (P&L, open trades, next setups)
# ======================================================

def _read_today_journal_stats():
    """Return (trade_count, wins, losses, total_realized_pnl) for today."""
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


def _box_line(content, color="blue"):
    """Print a content line inside the dashboard box."""
    # Strip ANSI codes for length calc (rough - good enough)
    plain = content
    for esc in (Fore.GREEN, Fore.RED, Fore.YELLOW, Fore.CYAN, Fore.MAGENTA,
                Fore.WHITE, Fore.BLUE, Style.BRIGHT, Style.DIM, Style.RESET_ALL):
        plain = plain.replace(esc, "")
    pad = max(0, 78 - len(plain))
    print(clr("|", color) + " " + content + " " * pad + clr("|", color))


def print_live_dashboard(approaching_list, scan_num):
    """
    Show:
      - Account balance / equity
      - Today's realized stats (trades, wins, losses, P&L)
      - Open positions with live P&L and current RR
      - Next setups forming (approaching breakout) with logic + direction hint
    Logic itself is NOT changed - this is a read-only summary panel.
    """
    acc = mt5.account_info()
    if acc is None:
        return

    positions = mt5.positions_get(magic=202526) or []
    n, wins, losses, realized = _read_today_journal_stats()
    unrealized = sum(p.profit for p in positions)

    print()
    print(clr("+" + "=" * 78 + "+", "blue"))
    title = clr(f"  LIVE DASHBOARD   (after Scan #{scan_num})", "white")
    _box_line(title, "blue")
    print(clr("+" + "=" * 78 + "+", "blue"))

    # ---- Account ----
    acc_line = (clr(f"  Account:", "gray") + clr(f" {acc.login}", "white") +
                clr("    Balance:", "gray") + clr(f" ${acc.balance:,.2f}", "white") +
                clr("    Equity:", "gray") + clr(f" ${acc.equity:,.2f}", "white") +
                clr("    Free:", "gray") + clr(f" ${acc.margin_free:,.2f}", "white"))
    _box_line(acc_line, "blue")

    # ---- Today's stats ----
    realized_color = "green" if realized >= 0 else "red"
    today_line = (clr(f"  Today:", "gray") +
                  clr(f"  Trades={n}", "white") +
                  clr(f"   Wins={wins}", "green") +
                  clr(f"   Losses={losses}", "red") +
                  clr("   Realized P&L:", "gray") +
                  clr(f" {_format_money(realized)}", realized_color))
    _box_line(today_line, "blue")

    # ---- Unrealized ----
    unr_color = "green" if unrealized >= 0 else "red"
    unr_line = (clr(f"  Open:", "gray") +
                clr(f"  {len(positions)} position(s)", "white") +
                clr("       Unrealized P&L:", "gray") +
                clr(f" {_format_money(unrealized)}", unr_color))
    _box_line(unr_line, "blue")

    print(clr("+" + "-" * 78 + "+", "blue"))

    # ---- Open positions detail ----
    if positions:
        _box_line(clr("  OPEN POSITIONS  (live P&L + RR achieved)", "yellow"), "blue")
        # Header
        hdr = clr(
            f"   {'Pair':<10} {'Side':<5} {'Entry':>10} {'Now':>10} {'SL':>10} {'TP':>10} {'P&L':>9} {'RR':>7}",
            "dim"
        )
        _box_line(hdr, "blue")
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
            _box_line(clr(row, row_color), "blue")
        print(clr("+" + "-" * 78 + "+", "blue"))

    # ---- Approaching (next setups) ----
    if approaching_list:
        _box_line(clr("  NEXT SETUPS FORMING  (approaching triangle breakout)", "yellow"), "blue")
        hdr = clr(
            f"   {'Pair':<10} {'TF':<4} {'Pattern':<12} {'Resistance':>11} {'Support':>11} {'~Dist':>8}  Hint",
            "dim"
        )
        _box_line(hdr, "blue")
        # Sort by closest to breakout
        approaching_list.sort(key=lambda a: a["distance_pct"])
        for a in approaching_list[:8]:  # cap to top 8 nearest
            hint_color = "green" if a["hint"] == "BUY breakout" else "red"
            row_left  = (f"   {a['symbol']:<10} {a['tf']:<4} {a['pattern']:<12} "
                         f"{a['R']:>11.5f} {a['S']:>11.5f} {a['distance_pct']:>7.2f}%  ")
            row = clr(row_left, "white") + clr(a["hint"], hint_color)
            _box_line(row, "blue")
        if len(approaching_list) > 8:
            _box_line(clr(f"   ... and {len(approaching_list)-8} more", "dim"), "blue")
        print(clr("+" + "-" * 78 + "+", "blue"))
    else:
        _box_line(clr("  No setups forming right now - waiting for triangles to mature...", "dim"), "blue")
        print(clr("+" + "-" * 78 + "+", "blue"))

    # ---- Logic legend (so user understands what triggers a trade) ----
    _box_line(clr("  LOGIC: Triangle breakout + body>=50% of range + RR >= " +
                  f"{MIN_RR}  -> trade taken", "dim"), "blue")
    _box_line(clr("         ASCENDING /\\ = flat top + rising bottom    " +
                  "DESCENDING \\/ = falling top + flat bottom", "dim"), "blue")
    _box_line(clr("         SYMMETRICAL <> = falling top + rising bottom" +
                  "    Trail SL @ 1:" + f"{TRAIL_AT_RR}", "dim"), "blue")
    print(clr("+" + "=" * 78 + "+", "blue"))


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

def get_candles(symbol, timeframe, count=100):
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


def detect_triangle(df):
    if df is None or len(df) < 30:
        return None
    sh = find_swing_highs(df)
    sl = find_swing_lows(df)
    if len(sh) < 2 or len(sl) < 2:
        return None

    rh = sh[-3:]; rl = sl[-3:]
    hv = [h[1] for h in rh]; lv = [l[1] for l in rl]

    ht = np.polyfit(range(len(hv)), hv, 1)[0]
    lt = np.polyfit(range(len(lv)), lv, 1)[0]

    resistance = hv[-1]; support = lv[-1]
    height = resistance - support
    avg    = df["close"].iloc[-1]
    tol    = avg * 0.0005

    if height < avg * 0.002:
        return None

    if   abs(ht) < tol and lt > tol:   pattern = "ASCENDING"
    elif ht < -tol and abs(lt) < tol:  pattern = "DESCENDING"
    elif ht < -tol and lt > tol:       pattern = "SYMMETRICAL"
    else: return None

    return {"pattern": pattern, "resistance": resistance, "support": support,
            "height": height, "high_trend": ht, "low_trend": lt}

# ======================================================
#  BREAKOUT CHECK
# ======================================================

def check_breakout(df, triangle):
    if triangle is None or df is None:
        return None
    last  = df.iloc[-1]; prev = df.iloc[-2]
    close = last["close"]; open_ = last["open"]
    body  = abs(close - open_)
    rng   = last["high"] - last["low"]

    if rng == 0 or body / rng < 0.5:
        return None

    R, S, H = triangle["resistance"], triangle["support"], triangle["height"]

    if close > R and prev["close"] <= R:
        return {"direction": "BUY",  "entry": close, "sl": S, "tp": close + H, "height": H}
    if close < S and prev["close"] >= S:
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
    pip_val    = info.trade_tick_value
    pip_size   = info.point
    sl_pips    = abs(entry - sl) / pip_size

    if sl_pips == 0 or pip_val == 0: return 0.01
    lot = risk_money / (sl_pips * pip_val)
    return max(info.volume_min, min(round(lot, 2), info.volume_max))

# ======================================================
#  PLACE ORDER
# ======================================================

def place_order(symbol, direction, entry, sl, tp, lot):
    tick = mt5.symbol_info_tick(symbol)
    if tick is None: return None
    price = tick.ask if direction == "BUY" else tick.bid
    otype = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL

    req = {
        "action"      : mt5.TRADE_ACTION_DEAL,
        "symbol"      : symbol,
        "volume"      : lot,
        "type"        : otype,
        "price"       : price,
        "sl"          : sl,
        "tp"          : tp,
        "deviation"   : 20,
        "magic"       : 202526,
        "comment"     : "TriangleBot_v2",
        "type_time"   : mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    return mt5.order_send(req)

# ======================================================
#  TRAILING SL
# ======================================================

def manage_trailing_sl(trail_rr):
    positions = mt5.positions_get(magic=202526)
    if not positions: return

    for pos in positions:
        sym   = pos.symbol
        direc = "BUY" if pos.type == 0 else "SELL"
        entry = pos.price_open
        c_sl, c_tp = pos.sl, pos.tp
        tick  = mt5.symbol_info_tick(sym)
        if tick is None: continue

        price = tick.bid if direc == "BUY" else tick.ask
        risk  = abs(entry - c_sl)
        if risk == 0: continue

        pir = (price - entry) / risk if direc == "BUY" else (entry - price) / risk
        new_sl = c_sl

        if pir >= trail_rr:
            if direc == "BUY"  and c_sl < entry: new_sl = entry + risk * 0.1
            if direc == "SELL" and c_sl > entry: new_sl = entry - risk * 0.1

        if pir >= 1.5:
            td = risk * 0.5
            if direc == "BUY":  new_sl = max(c_sl, price - td)
            else:               new_sl = min(c_sl, price + td)

        if new_sl != c_sl:
            digits = mt5.symbol_info(sym).digits
            req = {"action": mt5.TRADE_ACTION_SLTP, "position": pos.ticket,
                   "symbol": sym, "sl": round(new_sl, digits), "tp": c_tp}
            res = mt5.order_send(req)
            if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                phase = "BREAKEVEN" if pir < 1.5 else "TRAILING"
                print(clr(f"  {phase} SL -> {sym} | New SL: {round(new_sl, digits)} | RR: 1:{round(pir, 2)}",
                          "yellow"))

# ======================================================
#  DUPLICATE CHECK
# ======================================================

def is_already_open(symbol):
    pos = mt5.positions_get(symbol=symbol, magic=202526)
    return pos is not None and len(pos) > 0

# ======================================================
#  MAIN SCAN
# ======================================================

def scan_all_symbols(scan_num, min_rr, risk_percent, trail_rr):
    print_scan_header(scan_num)
    signals = approaching = skipped = 0
    approaching_list = []  # collected for live dashboard at end

    for symbol in SYMBOLS:
        if not mt5.symbol_select(symbol, True):
            continue

        sym_label = clr(f"{symbol:<10}", "white")

        for tf_name, tf_code in TIMEFRAMES.items():
            df = get_candles(symbol, tf_code)
            if df is None: continue

            triangle = detect_triangle(df)
            if triangle is None: continue

            breakout = check_breakout(df, triangle)

            if breakout is None:
                last_c = df["close"].iloc[-1]
                R, S, H = triangle["resistance"], triangle["support"], triangle["height"]
                prox = H * 0.05

                if abs(last_c - R) < prox or abs(last_c - S) < prox:
                    approaching += 1
                    pat = triangle["pattern"]
                    pat_icon = {"ASCENDING":"/\\","DESCENDING":"\\/","SYMMETRICAL":"<>"}.get(pat, "*")
                    print(clr("  APPROACHING  ", "yellow") +
                          sym_label + clr(f"[{tf_name}] ", "gray") +
                          clr(f"{pat_icon} {pat}", "magenta") +
                          clr(f"  R:{round(R, 5)}  S:{round(S, 5)}", "gray"))
                    # Collect for dashboard
                    dist_to_R = abs(last_c - R)
                    dist_to_S = abs(last_c - S)
                    closest   = min(dist_to_R, dist_to_S)
                    distance_pct = (closest / last_c * 100) if last_c else 0
                    hint = "BUY breakout" if dist_to_R <= dist_to_S else "SELL breakout"
                    approaching_list.append({
                        "symbol": symbol, "tf": tf_name, "pattern": pat,
                        "R": R, "S": S, "close": last_c,
                        "distance_pct": distance_pct, "hint": hint,
                    })
                continue

            entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
            rr = abs(tp - entry) / abs(entry - sl) if abs(entry - sl) > 0 else 0

            if rr < min_rr:
                skipped += 1
                print(clr("  LOW RR       ", "red") +
                      sym_label + clr(f"[{tf_name}]", "gray") +
                      clr(f"  RR={round(rr, 2)} (need {min_rr})", "red"))
                continue

            signals += 1
            lot = calculate_lot(symbol, entry, sl, risk_percent)
            print_signal_box(symbol, tf_name, triangle, breakout, rr, lot)

            if is_already_open(symbol):
                print(clr(f"  Position already open on {symbol} - skipping", "cyan"))
                continue

            result = place_order(symbol, breakout["direction"], entry, sl, tp, lot)

            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                print(clr(f"  [OK] ORDER PLACED  Ticket#{result.order}  Lot:{lot}", "green"))
                log_trade(symbol, tf_name, breakout["direction"],
                          entry, sl, tp, lot, rr,
                          breakout["height"] * 10000, triangle["pattern"],
                          notes=f"Auto|{tf_name}|Scan#{scan_num}")
            else:
                err = result.retcode if result else "No response"
                print(clr(f"  [ERROR] ORDER FAILED  {symbol}  Error:{err}", "red"))

    print()
    print(clr("  SCAN SUMMARY  ", "bold") +
          clr(f"Signals:{signals}  ", "green") +
          clr(f"Approaching:{approaching}  ", "yellow") +
          clr(f"Skipped:{skipped}", "red"))

    manage_trailing_sl(trail_rr)

    # ---- LIVE DASHBOARD (P&L, open trades, next setups, logic) ----
    print_live_dashboard(approaching_list, scan_num)

# ======================================================
#  MAIN
# ======================================================

def main():
    print_banner()

    # Zero-edit auto-login: read encrypted creds, or popup GUI on first run.
    login, password, server, risk, min_rr, trail, interval = load_credentials()

    # Register in Windows Startup the first time we see we're not registered yet
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
    setup_journal()

    print(clr("  Bot is running! Press Ctrl+C to stop\n", "green"))

    scan_num = 0
    try:
        while True:
            scan_num += 1
            scan_all_symbols(scan_num, min_rr, risk, trail)
            for remaining in range(interval, 0, -5):
                print(clr(f"\r  Next scan in: {remaining}s ...    ", "dim"),
                      end="", flush=True)
                time.sleep(min(5, remaining))
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
        # ANY uncaught error -> show full traceback and pause so the
        # cmd window doesn't close before the user can read what went wrong.
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
