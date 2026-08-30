"""
TRIANGLE BREAKOUT AUTO TRADER  v2.3  -  AUTO-DETECT MT5 EDITION
   Forex - BTC - ETH - Gold - Silver
   Auto Detect MT5 | Auto Trade | Trail SL | Live GUI Window

   Made by @codex_here

==================== v2.3 CHANGES ==================
  [CHANGED]  No more saved credentials. The bot now auto-detects
             whatever MT5 terminal is already running and logged-in
             on this machine and attaches to it.

             Workflow now is simply:
                1. Open MT5 terminal and log in (your normal way).
                2. Run this script.
                3. Done. Script attaches to that session.

             - No popup window asking for account / password.
             - No file written to disk with credentials.
             - If you change brokers or accounts, just log into the
               new one in MT5 - the bot will pick it up next run.

  [CLEANUP]  Old encrypted creds file (if any) is auto-deleted from
                ~/.triangle_bot/creds.dat
             so nothing sensitive is left behind.

==================== v2.2 FEATURES (still in) ======
  [GUI]  Separate live GUI dashboard window with:
            * Account info + connection status
            * Strategy logic panel
            * Next trade alerts (approaching breakouts)
            * Win-rate, trades-today, P&L stats
            * Open positions (live RR / SL / TP / P&L)
            * Trade journal (last 20 trades)
         Run with default settings to get the GUI; pass --console
         to run in old text-only mode.

==================== HOW TO USE ====================
  1. pip install MetaTrader5 pandas numpy colorama pywin32
  2. Open MT5 terminal -> log in to your broker account.
  3. Double-click run.bat  (or:  python triangle_scanner.py)
       -> Auto-detects MT5 + opens the live dashboard window.
       -> Console-only mode:  python triangle_scanner.py --console

==================== v2.1 BUGFIXES (still in) ======
  [FIX] Breakout now checks the LAST CLOSED candle (was using the
        still-forming candle - main reason no trades were placed).
  [FIX] SL/TP/price rounded to symbol.digits.
  [FIX] Respect broker SYMBOL_TRADE_STOPS_LEVEL.
  [FIX] order_send() retries with FOK / RETURN if IOC unsupported.
  [FIX] is_already_open() filters magic manually.
  [FIX] Triangle slope tolerance now relative to triangle height.
  [FIX] Body/range filter relaxed 50% -> 35%.
  [FIX] Failed orders print broker comment + last_error.
====================================================
"""

# ====================================================================
#  DEFENSIVE IMPORTS
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
    import time, csv, os, sys, base64, threading
    from datetime import datetime, timedelta
    from concurrent.futures import ThreadPoolExecutor, as_completed
except Exception as _e:
    _critical(f"Standard library import error: {_e}")

# ----- Threading & shared state (GUI + scanner) ---------------------
_STATE_LOCK = threading.Lock()
_STOP_EVENT = threading.Event()

# Session-wide tracking
SESSION = {
    "start_time"       : time.time(),
    "scans"            : 0,
    "last_scan_sec"    : 0.0,
    "total_scan_sec"   : 0.0,
    "trades_placed"    : 0,
    "last_trade_time"  : None,
    "last_trade_pair"  : None,
    "recent_trades"    : [],
    # GUI live state
    "connected"        : False,
    "account_info"     : None,
    "approaching"      : [],      # latest approaching list
    "open_positions"   : [],      # snapshot list of position dicts
    "log_lines"        : [],      # rolling log for the GUI activity panel
    "last_signals"     : [],      # last detected signals (for "next trade alert")
    "scan_num"         : 0,
}

def _push_log(line):
    with _STATE_LOCK:
        SESSION["log_lines"].append(f"{datetime.now().strftime('%H:%M:%S')}  {line}")
        if len(SESSION["log_lines"]) > 200:
            SESSION["log_lines"] = SESSION["log_lines"][-200:]

# How many parallel workers for candle fetching.
SCAN_WORKERS = 12

# colorama is OPTIONAL
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except Exception:
    class _NoColor:
        def __getattr__(self, _n): return ""
    Fore = _NoColor()
    Style = _NoColor()
    def init(*a, **k): pass

# Windows-only imports
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
RISK_PERCENT  = 1.0
MIN_RR        = 2.0
TRAIL_AT_RR   = 1.1
SCAN_INTERVAL = 5
JOURNAL_FILE  = "trade_journal.csv"
MAGIC         = 202526

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

FILLING_MODES = [
    mt5.ORDER_FILLING_IOC,
    mt5.ORDER_FILLING_FOK,
    mt5.ORDER_FILLING_RETURN,
]

# ======================================================
#  AUTO-DETECT MT5  (no saved credentials, no popup)
#
#  v2.3 change: we no longer ask for or store login/password/server.
#  Calling mt5.initialize() with NO arguments attaches to whatever
#  MT5 terminal is already running and logged in on this machine.
# ======================================================
CREDS_DIR  = os.path.join(os.path.expanduser("~"), ".triangle_bot")
CREDS_FILE = os.path.join(CREDS_DIR, "creds.dat")  # legacy file - cleaned up

def cleanup_old_creds():
    """Delete any leftover encrypted creds file from previous versions."""
    try:
        if os.path.exists(CREDS_FILE):
            os.remove(CREDS_FILE)
            print(clr(f"  [CLEANUP] Removed old saved credentials: {CREDS_FILE}", "yellow"))
    except Exception:
        pass


def load_settings():
    """v2.3: no credentials needed. Just returns trading settings."""
    return (RISK_PERCENT, MIN_RR, TRAIL_AT_RR, SCAN_INTERVAL)


# ======================================================
#  WINDOWS STARTUP
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
    except Exception as e:
        print(clr(f"  [WARN]  Startup registration failed: {e}", "yellow"))


def wait_for_mt5_and_connect(max_retries=10, wait_sec=10):
    """
    v2.3: Attach to whatever MT5 terminal is currently running and
    logged in on this machine. We do NOT supply login/password/server -
    that means MT5 uses the live terminal session.

    Retry loop in case the user opens MT5 a few seconds after the bot.
    """
    for attempt in range(1, max_retries + 1):
        print(clr(f"\r  Detecting MT5 terminal... attempt #{attempt}/{max_retries}",
                  "cyan"), end="", flush=True)

        # NO login/password/server - attach to running terminal
        success = mt5.initialize()
        if success:
            # Verify a real account is logged in
            acc = mt5.account_info()
            if acc is not None and acc.login:
                print()
                with _STATE_LOCK:
                    SESSION["connected"] = True
                _push_log(f"[AUTO-DETECT] Attached to MT5 - account={acc.login} "
                          f"server={acc.server}")
                return True
            else:
                # Terminal open but not logged in
                try: mt5.shutdown()
                except Exception: pass
                print()
                print(clr("  [WARN] MT5 terminal is open but no account is logged in.",
                          "yellow"))
                print(clr("         Log in inside MT5 and the bot will retry...", "yellow"))

        err_code, err_msg = mt5.last_error()
        print(clr(f"\r  MT5 not detected ({err_msg}) - retrying in {wait_sec}s... ",
                  "yellow"), end="", flush=True)
        time.sleep(wait_sec)

    print()
    print(clr(f"  [ERROR] Could not detect MT5 after {max_retries} attempts.", "red"))
    print(clr( "     -> Open the MT5 terminal, log in to your account, then re-run.",
              "yellow"))
    return False


# ======================================================
#  CONSOLE BANNERS (kept for --console mode and log file)
# ======================================================
def print_banner():
    w = 62
    lines = [
        ("TRIANGLE BREAKOUT AUTO TRADER  v2.3", "gold"),
        ("Forex - Crypto - Gold - Silver", "cyan"),
        ("Auto-Detect MT5 | Auto Trade | Trail SL | Live GUI", "gray"),
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


def _fmt_uptime(secs):
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    if h: return f"{h}h {m:02d}m {s:02d}s"
    if m: return f"{m}m {s:02d}s"
    return f"{s}s"


# ======================================================
#  JOURNAL
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
                if row.get("Date") != today: continue
                n += 1
                try: pnl = float(row.get("Profit_Loss", 0) or 0)
                except Exception: pnl = 0.0
                pnl_total += pnl
                if pnl > 0:    wins += 1
                elif pnl < 0:  losses += 1
    except Exception:
        pass
    return n, wins, losses, pnl_total


def _read_all_journal_stats():
    """Total win-rate from the entire journal (for the GUI stats panel)."""
    n = wins = losses = breakeven = 0
    pnl_total = 0.0
    if not os.path.exists(JOURNAL_FILE):
        return n, wins, losses, breakeven, pnl_total
    try:
        with open(JOURNAL_FILE, newline="") as f:
            for row in csv.DictReader(f):
                n += 1
                try: pnl = float(row.get("Profit_Loss", 0) or 0)
                except Exception: pnl = 0.0
                pnl_total += pnl
                if pnl > 0:    wins += 1
                elif pnl < 0:  losses += 1
                else:          breakeven += 1
    except Exception:
        pass
    return n, wins, losses, breakeven, pnl_total


def _read_recent_journal_rows(limit=20):
    if not os.path.exists(JOURNAL_FILE):
        return []
    rows = []
    try:
        with open(JOURNAL_FILE, newline="") as f:
            for row in csv.DictReader(f):
                rows.append(row)
    except Exception:
        return []
    return rows[-limit:]


def setup_journal():
    if not os.path.exists(JOURNAL_FILE):
        with open(JOURNAL_FILE, "w", newline="") as f:
            csv.writer(f).writerow([
                "Date","Time","Symbol","Timeframe","Direction",
                "Entry","SL","TP","Lot","Est_RR",
                "Triangle_Height_Pips","Pattern_Type",
                "Status","Profit_Loss","Notes"
            ])

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
#  CANDLES + TRIANGLE LOGIC (v2.1 fixes preserved)
# ======================================================
def get_candles(symbol, timeframe, count=120):
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
    if rates is None or len(rates) == 0:
        return None
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    return df

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
    if df_closed is None or len(df_closed) < 30:
        return None
    sh = find_swing_highs(df_closed)
    sl = find_swing_lows(df_closed)
    if len(sh) < 2 or len(sl) < 2:
        return None

    rh = sh[-3:]; rl = sl[-3:]
    hv = [h[1] for h in rh]; lv = [l[1] for l in rl]

    ht = float(np.polyfit(range(len(hv)), hv, 1)[0])
    lt = float(np.polyfit(range(len(lv)), lv, 1)[0])

    resistance = float(hv[-1]); support = float(lv[-1])
    height = resistance - support
    avg    = float(df_closed["close"].iloc[-1])

    if height <= 0 or height < avg * 0.0015:
        return None

    tol = height * 0.15
    pattern = None
    if   abs(ht) < tol and lt > tol:                pattern = "ASCENDING"
    elif ht < -tol and abs(lt) < tol:               pattern = "DESCENDING"
    elif ht < -tol and lt > tol:                    pattern = "SYMMETRICAL"
    if pattern is None: return None

    return {"pattern": pattern, "resistance": resistance, "support": support,
            "height": height, "high_trend": ht, "low_trend": lt}

def check_breakout(df, triangle):
    if triangle is None or df is None or len(df) < 3:
        return None
    last = df.iloc[-2]   # last CLOSED candle
    prev = df.iloc[-3]
    close = float(last["close"]); open_ = float(last["open"])
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
#  ORDER PLACEMENT (with rounding + stops_level + filling fallback)
# ======================================================
def calculate_lot(symbol, entry, sl, risk_percent):
    acc  = mt5.account_info()
    if acc is None: return 0.01
    info = mt5.symbol_info(symbol)
    if info is None: return 0.01
    risk_money = acc.balance * (risk_percent / 100)
    tick_value = info.trade_tick_value
    tick_size  = info.trade_tick_size or info.point
    if not tick_value or not tick_size:
        return info.volume_min
    sl_distance = abs(entry - sl)
    if sl_distance <= 0: return info.volume_min
    loss_per_lot = (sl_distance / tick_size) * tick_value
    if loss_per_lot <= 0: return info.volume_min
    lot = risk_money / loss_per_lot
    step = info.volume_step or 0.01
    lot = round(lot / step) * step
    lot = max(info.volume_min, min(lot, info.volume_max))
    return round(lot, 2)

def _round_price(symbol_info, price):
    return round(float(price), int(symbol_info.digits))

def _enforce_stops_level(symbol_info, direction, current_price, sl, tp):
    stops_level = int(getattr(symbol_info, "trade_stops_level", 0) or 0)
    if stops_level <= 0: return sl, tp
    point = symbol_info.point
    min_dist = stops_level * point
    if direction == "BUY":
        if (current_price - sl) < min_dist: sl = current_price - min_dist
        if (tp - current_price) < min_dist: tp = current_price + min_dist
    else:
        if (sl - current_price) < min_dist: sl = current_price + min_dist
        if (current_price - tp) < min_dist: tp = current_price - min_dist
    return sl, tp

def place_order(symbol, direction, entry, sl, tp, lot):
    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        return None, "no_info_or_tick"
    price = tick.ask if direction == "BUY" else tick.bid
    sl, tp = _enforce_stops_level(info, direction, price, sl, tp)
    price  = _round_price(info, price)
    sl     = _round_price(info, sl)
    tp     = _round_price(info, tp)
    otype = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL

    last_result = None; last_err = ""
    for fmode in FILLING_MODES:
        req = {
            "action": mt5.TRADE_ACTION_DEAL, "symbol": symbol,
            "volume": float(lot), "type": otype, "price": price,
            "sl": sl, "tp": tp, "deviation": 20, "magic": MAGIC,
            "comment": "TriangleBot_v2.3",
            "type_time": mt5.ORDER_TIME_GTC, "type_filling": fmode,
        }
        result = mt5.order_send(req)
        last_result = result
        if result is None:
            last_err = f"order_send returned None ({mt5.last_error()})"
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            return result, "ok"
        if result.retcode in (
            mt5.TRADE_RETCODE_INVALID_FILL,
            mt5.TRADE_RETCODE_UNSUPPORTED_FILL_POLICY
            if hasattr(mt5, "TRADE_RETCODE_UNSUPPORTED_FILL_POLICY") else -1,
        ):
            last_err = f"filling mode {fmode} unsupported"
            continue
        last_err = f"retcode={result.retcode} ({getattr(result, 'comment', '')})"
        break
    return last_result, last_err

def _our_positions():
    all_pos = mt5.positions_get()
    if not all_pos: return []
    return [p for p in all_pos if p.magic == MAGIC]

def manage_trailing_sl(trail_rr):
    positions = _our_positions()
    if not positions: return
    for pos in positions:
        sym = pos.symbol
        info = mt5.symbol_info(sym)
        if info is None: continue
        direc = "BUY" if pos.type == 0 else "SELL"
        entry = pos.price_open
        c_sl, c_tp = pos.sl, pos.tp
        tick = mt5.symbol_info_tick(sym)
        if tick is None: continue
        price = tick.bid if direc == "BUY" else tick.ask
        risk = abs(entry - c_sl)
        if risk <= 0: continue
        pir = (price - entry) / risk if direc == "BUY" else (entry - price) / risk
        new_sl = c_sl
        if pir >= trail_rr:
            if direc == "BUY"  and c_sl < entry: new_sl = entry + risk * 0.1
            if direc == "SELL" and c_sl > entry: new_sl = entry - risk * 0.1
        if pir >= 1.5:
            td = risk * 0.5
            if direc == "BUY":  new_sl = max(new_sl, price - td)
            else:               new_sl = min(new_sl, price + td)
        if new_sl != c_sl:
            new_sl_r = _round_price(info, new_sl)
            new_sl_r, _ = _enforce_stops_level(info, direc, price, new_sl_r, c_tp)
            new_sl_r = _round_price(info, new_sl_r)
            req = {"action": mt5.TRADE_ACTION_SLTP, "position": pos.ticket,
                   "symbol": sym, "sl": new_sl_r, "tp": _round_price(info, c_tp)}
            res = mt5.order_send(req)
            if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                phase = "BREAKEVEN" if pir < 1.5 else "TRAILING"
                _push_log(f"[{phase}] {sym} new SL={new_sl_r} RR=1:{round(pir,2)}")

def is_already_open(symbol):
    pos = mt5.positions_get(symbol=symbol)
    if not pos: return False
    return any(p.magic == MAGIC for p in pos)

# ======================================================
#  SCAN
# ======================================================
def _scan_one_pair(symbol, tf_name, tf_code, min_rr):
    try:
        if not mt5.symbol_select(symbol, True): return None
        df = get_candles(symbol, tf_code)
        if df is None or len(df) < 30: return None
        df_closed = df.iloc[:-1].reset_index(drop=True)
        triangle = detect_triangle(df_closed)
        if triangle is None: return None
        breakout = check_breakout(df, triangle)
        if breakout is None:
            R, S, H = triangle["resistance"], triangle["support"], triangle["height"]
            tick = mt5.symbol_info_tick(symbol)
            live = tick.last if (tick and tick.last) else float(df["close"].iloc[-1])
            prox = H * 0.10
            if abs(live - R) < prox or abs(live - S) < prox:
                dist_R = abs(live - R); dist_S = abs(live - S)
                closest = min(dist_R, dist_S)
                distance_pct = (closest / live * 100) if live else 0
                hint = "BUY breakout" if dist_R <= dist_S else "SELL breakout"
                return {"type": "approaching", "symbol": symbol, "tf": tf_name,
                        "pattern": triangle["pattern"], "R": R, "S": S, "close": live,
                        "distance_pct": distance_pct, "hint": hint}
            return None
        entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
        if abs(entry - sl) == 0: return None
        rr = abs(tp - entry) / abs(entry - sl)
        if rr < min_rr:
            return {"type": "skip_rr", "symbol": symbol, "tf": tf_name, "rr": rr}
        return {"type": "signal", "symbol": symbol, "tf": tf_name,
                "triangle": triangle, "breakout": breakout, "rr": rr}
    except Exception as e:
        return {"type": "error", "symbol": symbol, "tf": tf_name, "error": str(e)}


def scan_all_symbols(scan_num, min_rr, risk_percent, trail_rr):
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
            if r is None: continue
            if r["type"] == "approaching":
                approaching += 1
                approaching_list.append(r)
            elif r["type"] == "skip_rr":
                skipped += 1
            elif r["type"] == "signal":
                signal_results.append(r)
            elif r["type"] == "error":
                _push_log(f"[WARN] {r['symbol']} [{r['tf']}] error: {r['error']}")

    # Place orders sequentially
    for r in signal_results:
        symbol = r["symbol"]; tf_name = r["tf"]
        triangle = r["triangle"]; breakout = r["breakout"]; rr = r["rr"]
        entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
        signals += 1
        lot = calculate_lot(symbol, entry, sl, risk_percent)

        _push_log(f"[SIGNAL] {symbol} {tf_name} {breakout['direction']} "
                  f"{triangle['pattern']} RR=1:{round(rr,2)} lot={lot}")

        if is_already_open(symbol):
            _push_log(f"[SKIP] {symbol} - position already open")
            continue

        result, status = place_order(symbol, breakout["direction"], entry, sl, tp, lot)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            _push_log(f"[ORDER OK] {symbol} ticket#{result.order} lot={lot}")
            log_trade(symbol, tf_name, breakout["direction"], entry, sl, tp, lot, rr,
                      breakout["height"] * 10000, triangle["pattern"],
                      notes=f"Auto|{tf_name}|Scan#{scan_num}")
            with _STATE_LOCK:
                SESSION["trades_placed"] += 1
                SESSION["last_trade_time"] = time.time()
                SESSION["last_trade_pair"] = f"{symbol} ({tf_name})"
                SESSION["recent_trades"].append({
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "symbol": symbol, "tf": tf_name,
                    "dir": breakout["direction"], "pattern": triangle["pattern"],
                    "rr": rr, "lot": lot,
                })
                if len(SESSION["recent_trades"]) > 20:
                    SESSION["recent_trades"] = SESSION["recent_trades"][-20:]
        else:
            rc = result.retcode if result is not None else "None"
            comment = getattr(result, "comment", "") if result is not None else ""
            _push_log(f"[ORDER FAIL] {symbol} retcode={rc} comment='{comment}' "
                      f"status='{status}' last_err={mt5.last_error()}")

    elapsed = time.time() - t0
    with _STATE_LOCK:
        SESSION["scans"] += 1
        SESSION["last_scan_sec"] = elapsed
        SESSION["total_scan_sec"] += elapsed
        SESSION["scan_num"] = scan_num
        SESSION["approaching"] = approaching_list
        # Build positions snapshot
        pos_snap = []
        for p in _our_positions():
            entry_p = p.price_open; sl_p = p.sl; tp_p = p.tp
            risk = abs(entry_p - sl_p) if sl_p else 0
            move = (p.price_current - entry_p) if p.type == 0 else (entry_p - p.price_current)
            rr_now = (move / risk) if risk > 0 else 0
            pos_snap.append({
                "symbol": p.symbol, "side": "BUY" if p.type == 0 else "SELL",
                "entry": entry_p, "now": p.price_current, "sl": sl_p, "tp": tp_p,
                "profit": p.profit, "rr": rr_now, "lot": p.volume,
            })
        SESSION["open_positions"] = pos_snap
        # Refresh account info snapshot
        SESSION["account_info"] = mt5.account_info()

    _push_log(f"[SCAN #{scan_num}] signals={signals} approaching={approaching} "
              f"skipped={skipped} ({elapsed:.2f}s)")

    manage_trailing_sl(trail_rr)


# ======================================================
#  SCANNER WORKER (background thread)
# ======================================================
def scanner_worker(risk, min_rr, trail, interval):
    print(clr("\n  Scanner thread starting - detecting MT5 terminal...", "cyan"))
    _push_log("[STARTUP] Looking for running MT5 terminal...")
    connected = wait_for_mt5_and_connect()
    if not connected:
        _push_log("[FATAL] Could not detect MT5 - open MT5 terminal & log in, then restart")
        with _STATE_LOCK:
            SESSION["connected"] = False
        return

    info = mt5.account_info()
    with _STATE_LOCK:
        SESSION["account_info"] = info
        SESSION["connected"] = True

    setup_journal()
    _push_log(f"[OK] Auto-attached: account={info.login} balance=${info.balance:.2f} "
              f"server={info.server}")

    # Algo trading check
    term = mt5.terminal_info()
    if term is not None and not term.trade_allowed:
        _push_log("[WARN] AlgoTrading is DISABLED in MT5! Trades will be REJECTED. "
                  "Click 'Algo Trading' button in MT5 toolbar.")

    scan_num = 0
    try:
        while not _STOP_EVENT.is_set():
            scan_num += 1
            try:
                scan_all_symbols(scan_num, min_rr, risk, trail)
            except Exception as e:
                _push_log(f"[ERROR] scan crashed: {e}")
            # Sleep with stop-event awareness
            for _ in range(interval):
                if _STOP_EVENT.is_set(): break
                time.sleep(1)
    finally:
        try: mt5.shutdown()
        except Exception: pass
        _push_log("[SHUTDOWN] Scanner stopped")


# ======================================================
#  GUI DASHBOARD WINDOW (Tk - main thread)
# ======================================================
class DashboardGUI:
    """
    Live dashboard window with panels:
      [Status bar]   account, balance, equity, free, connected status
      [Strategy]     trading rules / filters
      [Next Trade]   approaching breakouts (alerts)
      [Stats]        win rate, trades today, P&L
      [Positions]    live RR / SL / TP / P&L
      [Journal]      last trades from CSV
      [Activity]     rolling log
    """

    BG       = "#0f1117"
    PANEL    = "#161a23"
    PANEL_HI = "#1d2230"
    BORDER   = "#2a2f3e"
    FG       = "#e6e8ef"
    DIM      = "#8b91a3"
    GREEN    = "#22c55e"
    RED      = "#ef4444"
    YELLOW   = "#facc15"
    BLUE     = "#3b82f6"
    MAGENTA  = "#a855f7"
    GOLD     = "#fbbf24"

    def __init__(self, risk, min_rr, trail, interval):
        self.cfg = dict(risk=risk, min_rr=min_rr, trail=trail, interval=interval)

        import tkinter as tk
        from tkinter import ttk, scrolledtext
        self.tk = tk; self.ttk = ttk; self.ScrolledText = scrolledtext.ScrolledText

        self.root = tk.Tk()
        self.root.title("Triangle Bot v2.3  -  AUTO-DETECT FROM RUNNING MT5")
        self.root.geometry("1280x780")
        self.root.minsize(1100, 700)
        self.root.configure(bg=self.BG)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._build_ui()

        # Start the scanner in a background thread
        self.worker = threading.Thread(
            target=scanner_worker,
            args=(risk, min_rr, trail, interval),
            daemon=True,
        )
        self.worker.start()

        # Begin periodic refresh
        self.root.after(500, self._refresh)

    # ---------- UI construction ----------
    def _label(self, parent, text, fg=None, font=("Segoe UI", 10), bg=None, **kw):
        return self.tk.Label(parent, text=text, fg=fg or self.FG,
                             bg=bg or self.PANEL, font=font, **kw)

    def _section(self, parent, title, color=None):
        wrap = self.tk.Frame(parent, bg=self.BORDER, bd=0, highlightthickness=0)
        inner = self.tk.Frame(wrap, bg=self.PANEL)
        inner.pack(fill="both", expand=True, padx=1, pady=1)
        header = self.tk.Frame(inner, bg=self.PANEL_HI)
        header.pack(fill="x")
        self._label(header, "  " + title, fg=color or self.GOLD,
                    font=("Segoe UI", 10, "bold"),
                    bg=self.PANEL_HI, anchor="w").pack(side="left", pady=4)
        body = self.tk.Frame(inner, bg=self.PANEL)
        body.pack(fill="both", expand=True, padx=10, pady=8)
        return wrap, body

    def _build_ui(self):
        tk = self.tk

        # ===== Top status bar =====
        topbar = tk.Frame(self.root, bg=self.PANEL_HI, height=58)
        topbar.pack(fill="x")
        tk.Label(topbar, text=" TRIANGLE BREAKOUT AUTO TRADER  v2.3 ",
                 bg=self.PANEL_HI, fg=self.GOLD,
                 font=("Consolas", 14, "bold")).pack(side="left", padx=14)
        self.lbl_conn = tk.Label(topbar, text=" connecting... ",
                                 bg=self.PANEL_HI, fg=self.YELLOW,
                                 font=("Segoe UI", 10, "bold"))
        self.lbl_conn.pack(side="left", padx=10)
        self.lbl_acc = tk.Label(topbar, text="", bg=self.PANEL_HI,
                                fg=self.FG, font=("Consolas", 10))
        self.lbl_acc.pack(side="left", padx=10)
        self.lbl_clock = tk.Label(topbar, text="", bg=self.PANEL_HI,
                                  fg=self.DIM, font=("Consolas", 10))
        self.lbl_clock.pack(side="right", padx=14)

        # ===== Main 3-column grid =====
        main = tk.Frame(self.root, bg=self.BG)
        main.pack(fill="both", expand=True, padx=10, pady=8)
        main.columnconfigure(0, weight=1, uniform="col")
        main.columnconfigure(1, weight=1, uniform="col")
        main.columnconfigure(2, weight=1, uniform="col")
        main.rowconfigure(0, weight=0)
        main.rowconfigure(1, weight=1)
        main.rowconfigure(2, weight=1)

        # --- Row 0:  STRATEGY (col 0)  -  STATS (col 1)  -  ACCOUNT (col 2) ---
        # Strategy
        s_wrap, s_body = self._section(main, "STRATEGY LOGIC", color=self.BLUE)
        s_wrap.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)
        rows = [
            ("Pattern", "Triangle breakout (ASC /\\, DESC \\/, SYM <>)"),
            ("Entry",   f"Closed candle outside R/S, body >= {int(MIN_BODY_RATIO*100)}% of range"),
            ("SL",      "At opposite triangle line"),
            ("TP",      "Entry +/- triangle height"),
            ("Min RR",  f"1:{MIN_RR}"),
            ("Risk",    f"{RISK_PERCENT}% of balance per trade"),
            ("Trail",   f"BE at 1:{TRAIL_AT_RR}, then 50% trailing"),
            ("Symbols", f"{len(SYMBOLS)} pairs across {', '.join(TIMEFRAMES.keys())}"),
            ("Scan",    f"every {SCAN_INTERVAL}s, {SCAN_WORKERS} parallel workers"),
        ]
        for i, (k, v) in enumerate(rows):
            tk.Label(s_body, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=8
                     ).grid(row=i, column=0, sticky="w")
            tk.Label(s_body, text=v, fg=self.FG, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", justify="left",
                     wraplength=320
                     ).grid(row=i, column=1, sticky="w", padx=4)

        # Stats
        st_wrap, st_body = self._section(main, "WIN RATE & P&L", color=self.GREEN)
        st_wrap.grid(row=0, column=1, sticky="nsew", padx=4, pady=4)
        self.stats_labels = {}
        rows = [
            ("All-time trades",    "all_n",    self.FG),
            ("Win rate",           "all_wr",   self.GREEN),
            ("Wins / Losses",      "all_wl",   self.FG),
            ("All-time P&L",       "all_pnl",  self.GREEN),
            ("",                   "",         self.FG),
            ("Today's trades",     "today_n",  self.FG),
            ("Today's win rate",   "today_wr", self.GREEN),
            ("Today's P&L",        "today_pnl",self.GREEN),
            ("Unrealized P&L",     "unreal",   self.GREEN),
        ]
        for i, (k, key, color) in enumerate(rows):
            if k == "":
                tk.Frame(st_body, bg=self.PANEL, height=8).grid(row=i, column=0, columnspan=2)
                continue
            tk.Label(st_body, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=18
                     ).grid(row=i, column=0, sticky="w", pady=1)
            lbl = tk.Label(st_body, text="-", fg=color, bg=self.PANEL,
                           font=("Consolas", 11, "bold"), anchor="w")
            lbl.grid(row=i, column=1, sticky="w", padx=4)
            self.stats_labels[key] = lbl

        # Account
        a_wrap, a_body = self._section(main, "ACCOUNT  /  SESSION", color=self.GOLD)
        a_wrap.grid(row=0, column=2, sticky="nsew", padx=4, pady=4)
        self.acc_labels = {}
        rows = [
            ("Login",     "login",   self.FG),
            ("Server",    "server",  self.FG),
            ("Balance",   "balance", self.FG),
            ("Equity",    "equity",  self.FG),
            ("Free margin","free",   self.FG),
            ("Currency",  "currency",self.DIM),
            ("",          "",        self.FG),
            ("Uptime",    "uptime",  self.DIM),
            ("Scans done","scans",   self.DIM),
            ("Last scan", "last_scan",self.DIM),
            ("Avg scan",  "avg_scan",self.DIM),
        ]
        for i, (k, key, color) in enumerate(rows):
            if k == "":
                tk.Frame(a_body, bg=self.PANEL, height=8).grid(row=i, column=0, columnspan=2)
                continue
            tk.Label(a_body, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=12
                     ).grid(row=i, column=0, sticky="w", pady=1)
            lbl = tk.Label(a_body, text="-", fg=color, bg=self.PANEL,
                           font=("Consolas", 10), anchor="w")
            lbl.grid(row=i, column=1, sticky="w", padx=4)
            self.acc_labels[key] = lbl

        # --- Row 1:  NEXT TRADE ALERTS (col 0)  -  OPEN POSITIONS (col 1-2) ---
        n_wrap, n_body = self._section(main, "NEXT TRADE ALERTS  -  approaching breakouts",
                                       color=self.YELLOW)
        n_wrap.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)
        self.alerts_tree = self._make_tree(
            n_body,
            columns=("pair", "tf", "pattern", "R", "S", "dist", "hint"),
            headings={"pair":"Pair", "tf":"TF", "pattern":"Pattern",
                      "R":"R", "S":"S", "dist":"Dist%", "hint":"Hint"},
            widths={"pair":75, "tf":40, "pattern":92, "R":78, "S":78, "dist":58, "hint":92},
        )

        p_wrap, p_body = self._section(main, "OPEN POSITIONS  -  live RR / SL / TP / P&L",
                                       color=self.GREEN)
        p_wrap.grid(row=1, column=1, columnspan=2, sticky="nsew", padx=4, pady=4)
        self.pos_tree = self._make_tree(
            p_body,
            columns=("pair", "side", "lot", "entry", "now", "sl", "tp", "rr", "pnl"),
            headings={"pair":"Pair","side":"Side","lot":"Lot","entry":"Entry",
                      "now":"Price","sl":"SL","tp":"TP","rr":"RR","pnl":"P&L"},
            widths={"pair":80,"side":50,"lot":50,"entry":85,"now":85,
                    "sl":85,"tp":85,"rr":60,"pnl":80},
        )

        # --- Row 2:  TRADE JOURNAL (col 0-1)  -  ACTIVITY LOG (col 2) ---
        j_wrap, j_body = self._section(main, "TRADE JOURNAL  -  last 20 entries",
                                       color=self.MAGENTA)
        j_wrap.grid(row=2, column=0, columnspan=2, sticky="nsew", padx=4, pady=4)
        self.journal_tree = self._make_tree(
            j_body,
            columns=("date","time","pair","tf","dir","pattern","entry","sl","tp",
                     "lot","rr","pnl","status"),
            headings={"date":"Date","time":"Time","pair":"Pair","tf":"TF",
                      "dir":"Dir","pattern":"Pattern","entry":"Entry","sl":"SL",
                      "tp":"TP","lot":"Lot","rr":"RR","pnl":"P&L","status":"Status"},
            widths={"date":80,"time":60,"pair":70,"tf":35,"dir":40,"pattern":85,
                    "entry":75,"sl":75,"tp":75,"lot":45,"rr":45,"pnl":60,"status":60},
        )

        l_wrap, l_body = self._section(main, "ACTIVITY LOG", color=self.DIM)
        l_wrap.grid(row=2, column=2, sticky="nsew", padx=4, pady=4)
        self.log_text = self.ScrolledText(
            l_body, bg="#0a0d14", fg=self.DIM, font=("Consolas", 9),
            wrap="word", insertbackground=self.FG,
            relief="flat", borderwidth=0, highlightthickness=0,
        )
        self.log_text.pack(fill="both", expand=True)
        self.log_text.configure(state="disabled")

        # Footer
        footer = tk.Frame(self.root, bg=self.BG)
        footer.pack(fill="x", padx=10, pady=(0, 6))
        tk.Label(footer, text="Made by @codex_here  -  auto-detects running MT5 terminal  "
                              "-  no credentials stored on disk",
                 bg=self.BG, fg=self.DIM, font=("Segoe UI", 8)
                 ).pack(side="left")

    def _make_tree(self, parent, columns, headings, widths):
        """Create a styled ttk.Treeview inside parent and return it."""
        ttk = self.ttk
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure("Triangle.Treeview",
                        background=self.PANEL, foreground=self.FG,
                        fieldbackground=self.PANEL, borderwidth=0,
                        rowheight=22, font=("Consolas", 9))
        style.configure("Triangle.Treeview.Heading",
                        background=self.PANEL_HI, foreground=self.GOLD,
                        font=("Segoe UI", 9, "bold"), borderwidth=0)
        style.map("Triangle.Treeview",
                  background=[("selected", self.PANEL_HI)],
                  foreground=[("selected", self.GOLD)])

        tree = ttk.Treeview(parent, columns=columns, show="headings",
                            style="Triangle.Treeview", height=8)
        for c in columns:
            tree.heading(c, text=headings.get(c, c))
            tree.column(c, width=widths.get(c, 80), anchor="center", stretch=True)
        tree.pack(fill="both", expand=True, side="left")
        # Scrollbar
        vs = ttk.Scrollbar(parent, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vs.set)
        vs.pack(side="right", fill="y")

        # Color tags
        tree.tag_configure("buy",  foreground=self.GREEN)
        tree.tag_configure("sell", foreground=self.RED)
        tree.tag_configure("win",  foreground=self.GREEN)
        tree.tag_configure("loss", foreground=self.RED)
        tree.tag_configure("neutral", foreground=self.FG)
        return tree

    # ---------- Refresh ----------
    def _refresh(self):
        try:
            self._refresh_once()
        except Exception as e:
            _push_log(f"[GUI] refresh error: {e}")
        # Refresh again in 1s
        if not _STOP_EVENT.is_set():
            self.root.after(1000, self._refresh)

    def _refresh_once(self):
        # Clock
        self.lbl_clock.config(text=datetime.now().strftime("%Y-%m-%d  %H:%M:%S"))

        with _STATE_LOCK:
            connected = SESSION["connected"]
            acc       = SESSION["account_info"]
            approach  = list(SESSION["approaching"])
            positions = list(SESSION["open_positions"])
            scans     = SESSION["scans"]
            last_scan = SESSION["last_scan_sec"]
            total_scan= SESSION["total_scan_sec"]
            log_lines = list(SESSION["log_lines"])

        # ===== Status bar =====
        if connected:
            self.lbl_conn.config(text="  CONNECTED   ", fg=self.GREEN)
        else:
            self.lbl_conn.config(text="  CONNECTING...", fg=self.YELLOW)

        if acc is not None:
            self.lbl_acc.config(
                text=f"  Acct {acc.login}   |   Bal ${acc.balance:,.2f}   "
                     f"|   Equity ${acc.equity:,.2f}   |   {acc.server}"
            )
            self.acc_labels["login"].config(text=str(acc.login))
            self.acc_labels["server"].config(text=acc.server)
            self.acc_labels["balance"].config(text=f"${acc.balance:,.2f}")
            self.acc_labels["equity"].config(text=f"${acc.equity:,.2f}")
            self.acc_labels["free"].config(text=f"${acc.margin_free:,.2f}")
            self.acc_labels["currency"].config(text=acc.currency)

        uptime = _fmt_uptime(time.time() - SESSION["start_time"])
        avg = (total_scan / scans) if scans else 0.0
        self.acc_labels["uptime"].config(text=uptime)
        self.acc_labels["scans"].config(text=str(scans))
        self.acc_labels["last_scan"].config(text=f"{last_scan:.2f}s")
        self.acc_labels["avg_scan"].config(text=f"{avg:.2f}s")

        # ===== Stats =====
        n_today, w_today, l_today, pnl_today = _read_today_journal_stats()
        n_all, w_all, l_all, _, pnl_all      = _read_all_journal_stats()
        wr_all   = (w_all   / max(1, w_all + l_all))   * 100 if (w_all + l_all)   else 0
        wr_today = (w_today / max(1, w_today + l_today))*100 if (w_today + l_today) else 0
        unrealized = sum(p["profit"] for p in positions)

        self.stats_labels["all_n"].config(text=str(n_all))
        self.stats_labels["all_wr"].config(
            text=f"{wr_all:.1f}%",
            fg=self.GREEN if wr_all >= 50 else (self.YELLOW if wr_all >= 35 else self.RED))
        self.stats_labels["all_wl"].config(text=f"{w_all} W  /  {l_all} L")
        self.stats_labels["all_pnl"].config(
            text=self._money(pnl_all),
            fg=self.GREEN if pnl_all >= 0 else self.RED)

        self.stats_labels["today_n"].config(text=str(n_today))
        self.stats_labels["today_wr"].config(
            text=f"{wr_today:.1f}%",
            fg=self.GREEN if wr_today >= 50 else (self.YELLOW if wr_today >= 35 else self.RED))
        self.stats_labels["today_pnl"].config(
            text=self._money(pnl_today),
            fg=self.GREEN if pnl_today >= 0 else self.RED)
        self.stats_labels["unreal"].config(
            text=self._money(unrealized),
            fg=self.GREEN if unrealized >= 0 else self.RED)

        # ===== Next trade alerts =====
        self.alerts_tree.delete(*self.alerts_tree.get_children())
        approach.sort(key=lambda a: a["distance_pct"])
        for a in approach[:30]:
            tag = "buy" if "BUY" in a["hint"] else "sell"
            self.alerts_tree.insert("", "end", tags=(tag,), values=(
                a["symbol"], a["tf"], a["pattern"],
                f"{a['R']:.5f}", f"{a['S']:.5f}",
                f"{a['distance_pct']:.2f}%", a["hint"],
            ))

        # ===== Open positions =====
        self.pos_tree.delete(*self.pos_tree.get_children())
        for p in positions:
            tag = "win" if p["profit"] >= 0 else "loss"
            self.pos_tree.insert("", "end", tags=(tag,), values=(
                p["symbol"], p["side"], f"{p['lot']:.2f}",
                f"{p['entry']:.5f}", f"{p['now']:.5f}",
                f"{p['sl']:.5f}", f"{p['tp']:.5f}",
                f"{p['rr']:+.2f}", self._money(p["profit"]),
            ))

        # ===== Journal =====
        rows = _read_recent_journal_rows(20)
        self.journal_tree.delete(*self.journal_tree.get_children())
        for row in rows[::-1]:
            try: pnl_v = float(row.get("Profit_Loss", 0) or 0)
            except Exception: pnl_v = 0
            tag = "win" if pnl_v > 0 else ("loss" if pnl_v < 0 else "neutral")
            self.journal_tree.insert("", "end", tags=(tag,), values=(
                row.get("Date",""), row.get("Time",""),
                row.get("Symbol",""), row.get("Timeframe",""),
                row.get("Direction",""), row.get("Pattern_Type",""),
                row.get("Entry",""), row.get("SL",""), row.get("TP",""),
                row.get("Lot",""), row.get("Est_RR",""),
                self._money(pnl_v) if pnl_v else "-",
                row.get("Status",""),
            ))

        # ===== Activity log =====
        # Only repaint if changed (cheap diff)
        new_text = "\n".join(log_lines[-200:])
        cur_text = self.log_text.get("1.0", "end-1c")
        if new_text != cur_text:
            self.log_text.configure(state="normal")
            self.log_text.delete("1.0", "end")
            self.log_text.insert("1.0", new_text)
            self.log_text.see("end")
            self.log_text.configure(state="disabled")

    @staticmethod
    def _money(x):
        try: x = float(x)
        except Exception: return str(x)
        sign = "+" if x >= 0 else "-"
        return f"{sign}${abs(x):,.2f}"

    def _on_close(self):
        if not self._confirm_close():
            return
        _STOP_EVENT.set()
        self.root.after(500, self.root.destroy)

    def _confirm_close(self):
        from tkinter import messagebox
        return messagebox.askyesno(
            "Stop Triangle Bot?",
            "Stopping will disconnect MT5 and the bot will no longer manage your trades.\n\n"
            "Open positions stay on your broker (they are NOT closed).\n\n"
            "Are you sure you want to stop?")

    def run(self):
        self.root.mainloop()


# ======================================================
#  CONSOLE-ONLY MODE (legacy)
# ======================================================
def run_console_mode(risk, min_rr, trail, interval):
    print(clr("\n  Detecting running MT5 terminal...", "cyan"))
    connected = wait_for_mt5_and_connect()
    if not connected:
        print(clr("\n  [ERROR] Could not detect MT5!", "red"))
        print(clr( "     Open MT5, log in, then re-run this script.", "yellow"))
        time.sleep(15); return

    info = mt5.account_info()
    print(clr(f"\n  Account: {info.login}  Bal: ${info.balance:,.2f}  Server: {info.server}",
              "green"))

    term = mt5.terminal_info()
    if term is not None and not term.trade_allowed:
        print(clr("  [WARN] AlgoTrading is DISABLED in MT5 - enable it!", "red"))

    setup_journal()
    print(clr("\n  Bot running (console mode). Press Ctrl+C to stop.\n", "green"))

    scan_num = 0
    try:
        while True:
            scan_num += 1
            scan_all_symbols(scan_num, min_rr, risk, trail)
            for line in SESSION["log_lines"][-10:]:
                print(clr("  " + line, "gray"))
            time.sleep(interval)
    except KeyboardInterrupt:
        print(clr("\n  Stopping...", "yellow"))
        try: mt5.shutdown()
        except Exception: pass


# ======================================================
#  MAIN
# ======================================================
def main():
    print_banner()
    cleanup_old_creds()

    use_console = "--console" in sys.argv

    risk, min_rr, trail, interval = load_settings()

    # Register Windows Startup once
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

    if use_console:
        run_console_mode(risk, min_rr, trail, interval)
        return

    # Try GUI mode
    try:
        import tkinter
        _probe = tkinter.Tk(); _probe.withdraw(); _probe.destroy()
    except Exception as e:
        print(clr(f"\n  [WARN] tkinter unavailable ({e}) - falling back to console mode.", "yellow"))
        run_console_mode(risk, min_rr, trail, interval)
        return

    print(clr("\n  Launching live dashboard window...", "cyan"))
    print(clr("  (Make sure MT5 is open & logged in. Console mode: --console)\n", "dim"))
    gui = DashboardGUI(risk, min_rr, trail, interval)
    gui.run()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        _STOP_EVENT.set()
    except Exception as e:
        import traceback
        print()
        print(clr("="*60, "red"))
        print(clr(" [CRASH] Uncaught error - script stopped", "red"))
        print(clr("="*60, "red"))
        print(clr(f"\n  {type(e).__name__}: {e}\n", "yellow"))
        traceback.print_exc()
        print(clr("\n  This window will close in 60 seconds...", "dim"))
        try: time.sleep(60)
        except Exception: pass
        sys.exit(1)
