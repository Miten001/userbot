"""
TRIANGLE BREAKOUT AUTO TRADER  v2.0
   Forex - BTC - ETH - Gold - Silver
   Auto Login | Auto Trade | Trail SL | Color Console

   Made by @codex_here

SETUP:
  1. pip install MetaTrader5 pandas numpy colorama pywin32
  2. python triangle_scanner.py   ->  first run will save your config
  3. Run again  ->  auto login + background mode starts

BACKGROUND AUTO-START (Windows Startup):
  - Script automatically registers itself in Windows Startup
  - If MT5 is already running  ->  immediate login + scan
  - If MT5 is not found        ->  wait 30s and retry (up to 10 times)

LOGIN INFO: stored in config.ini (same folder as the script)
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import time, csv, os, sys, configparser
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
#  DEFAULT SETTINGS
# ======================================================
RISK_PERCENT  = 1.0
MIN_RR        = 2.0
TRAIL_AT_RR   = 1.1
SCAN_INTERVAL = 30
JOURNAL_FILE  = "trade_journal.csv"
CONFIG_FILE   = "config.ini"

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
#  AUTO LOGIN - CONFIG FILE
# ======================================================

def load_or_create_config():
    """
    First run: ask for credentials and save them.
    Subsequent runs: read silently from config.ini.
    NOTE: Banner is NOT printed here - main() already prints it once.
    """
    config = configparser.ConfigParser()

    if os.path.exists(CONFIG_FILE):
        config.read(CONFIG_FILE)
        try:
            login    = int(config["MT5"]["login"])
            password = config["MT5"]["password"]
            server   = config["MT5"]["server"]
            risk     = float(config["Settings"].get("risk_percent",  RISK_PERCENT))
            min_rr   = float(config["Settings"].get("min_rr",        MIN_RR))
            trail    = float(config["Settings"].get("trail_at_rr",   TRAIL_AT_RR))
            interval = int(  config["Settings"].get("scan_interval", SCAN_INTERVAL))

            print(clr("[OK] Config found! Auto-logging in...", "green"))
            print(clr(f"   Account : {login}", "cyan"))
            print(clr(f"   Server  : {server}", "cyan"))
            return login, password, server, risk, min_rr, trail, interval
        except Exception as e:
            print(clr(f"[WARN]  Config read error: {e} - recreating config", "yellow"))

    # First-time setup - ask user for credentials
    print(clr("\n  FIRST-TIME SETUP - Enter credentials (only once):", "yellow"))
    print(clr("   (These will be saved to config.ini)\n", "gray"))

    login    = int(input(clr("   MT5 Account Number : ", "cyan")))
    password = input(    clr("   MT5 Password       : ", "cyan"))
    server   = input(    clr("   Broker Server      : ", "cyan"))

    print(clr("\n  Trading Settings (press Enter to accept default):", "yellow"))
    risk_in  = input(clr(f"   Risk % per trade   [{RISK_PERCENT}] : ", "cyan")).strip()
    rr_in    = input(clr(f"   Min RR             [{MIN_RR}] : ",       "cyan")).strip()
    trail_in = input(clr(f"   Trail at RR        [{TRAIL_AT_RR}] : ",  "cyan")).strip()
    scan_in  = input(clr(f"   Scan interval (sec)[{SCAN_INTERVAL}] : ","cyan")).strip()

    risk     = float(risk_in)  if risk_in  else RISK_PERCENT
    min_rr   = float(rr_in)    if rr_in    else MIN_RR
    trail    = float(trail_in) if trail_in else TRAIL_AT_RR
    interval = int(scan_in)    if scan_in  else SCAN_INTERVAL

    config["MT5"] = {
        "login"   : str(login),
        "password": password,
        "server"  : server,
    }
    config["Settings"] = {
        "risk_percent" : str(risk),
        "min_rr"       : str(min_rr),
        "trail_at_rr"  : str(trail),
        "scan_interval": str(interval),
    }

    with open(CONFIG_FILE, "w") as f:
        config.write(f)

    print(clr(f"\n[OK] Config saved to: {CONFIG_FILE}", "green"))
    return login, password, server, risk, min_rr, trail, interval

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
            print(clr( "     Please verify your credentials in config.ini", "yellow"))
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

    if signals == 0 and approaching == 0:
        print(clr(f"\n  No setups right now - next scan in {SCAN_INTERVAL}s...", "dim"))

# ======================================================
#  MAIN
# ======================================================

def main():
    # Print the banner ONCE here.
    print_banner()

    # Load credentials (or ask on first run). load_or_create_config no longer
    # prints the banner, so it cannot show up twice anymore.
    login, password, server, risk, min_rr, trail, interval = load_or_create_config()

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

    # Wait for MT5 terminal to be open and log in automatically
    connected = wait_for_mt5_and_connect(login, password, server,
                                         max_retries=10, wait_sec=30)

    if not connected:
        print(clr("\n  [ERROR] Could not connect to MT5!", "red"))
        print(clr( "     -> Open the MT5 terminal and run again", "yellow"))
        if WINDOWS:
            input("\n  Press Enter to exit...")
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
    main()
