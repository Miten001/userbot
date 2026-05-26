"""
   Forex · BTC · ETH · Gold · Silver
   Auto-Detect MT5  |  Auto Trade  |  Trail SL  |  Live GUI
"""

# ─────────────────────────────────────────────────────────
#  DEFENSIVE IMPORTS
# ─────────────────────────────────────────────────────────
import sys as _sys, os as _os, time as _time, traceback as _tb

def _critical(msg, hint=""):
    print("\n" + "="*64)
    print(" [CRITICAL ERROR] " + msg)
    print("="*64)
    if hint:
        for line in hint.splitlines():
            print("  " + line)
    print("\n  Window 180s ke liye open rahega...")
    try:    _time.sleep(180)
    except: pass
    _sys.exit(1)

try:
    import MetaTrader5 as mt5
except Exception as _e:
    _critical(
        f"MetaTrader5 load nahi hua: {_e}",
        "CMD mein chalao:\n"
        "    pip install MetaTrader5 pandas numpy colorama pywin32\n\n"
        "MT5 terminal install hona chahiye aur usi machine pe run ho raha hona chahiye."
    )

try:
    import pandas as pd
    import numpy as np
except Exception as _e:
    _critical(f"pandas/numpy missing: {_e}", "Run:  pip install pandas numpy")

try:
    import time, csv, os, sys, threading
    from datetime import datetime, timedelta
    from concurrent.futures import ThreadPoolExecutor, as_completed
except Exception as _e:
    _critical(f"Standard library error: {_e}")

# ─────────────────────────────────────────────────────────
#  THREADING & SHARED STATE
# ─────────────────────────────────────────────────────────
_STATE_LOCK = threading.Lock()
_STOP_EVENT = threading.Event()

SESSION = {
    "start_time"    : time.time(),
    "scans"         : 0,
    "last_scan_sec" : 0.0,
    "total_scan_sec": 0.0,
    "trades_placed" : 0,
    "connected"     : False,
    "account_info"  : None,
    "approaching"   : [],
    "open_positions": [],
    "log_lines"     : [],
    "scan_num"      : 0,
}

def _push_log(line):
    with _STATE_LOCK:
        SESSION["log_lines"].append(
            f"{datetime.now().strftime('%H:%M:%S')}  {line}")
        if len(SESSION["log_lines"]) > 300:
            SESSION["log_lines"] = SESSION["log_lines"][-300:]

# ─────────────────────────────────────────────────────────
#  COLORAMA (optional)
# ─────────────────────────────────────────────────────────
try:
    from colorama import init as _cinit, Fore, Style
    _cinit(autoreset=True)
except Exception:
    class _NC:
        def __getattr__(self, _): return ""
    Fore = Style = _NC()

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

try:
    import winreg
    WINDOWS = True
except ImportError:
    WINDOWS = False

# ─────────────────────────────────────────────────────────
#  SETTINGS
# ─────────────────────────────────────────────────────────
RISK_PERCENT      = 1.0
MIN_RR            = 2.0
TRAIL_AT_RR       = 1.1
SCAN_INTERVAL     = 5
DAILY_MAX_LOSS_PC = 5.0
MAX_OPEN_POSITIONS= 999

MAGIC          = 202530
JOURNAL_FILE   = "trade_journal.csv"
SCAN_WORKERS   = 12
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

_SESSION_START_BALANCE = None

# ─────────────────────────────────────────────────────────
#  MT5 CONNECTION
# ─────────────────────────────────────────────────────────
CREDS_DIR  = os.path.join(os.path.expanduser("~"), ".triangle_bot")
CREDS_FILE = os.path.join(CREDS_DIR, "creds.dat")

def cleanup_old_creds():
    try:
        if os.path.exists(CREDS_FILE):
            os.remove(CREDS_FILE)
    except Exception:
        pass

def load_settings():
    return (RISK_PERCENT, MIN_RR, TRAIL_AT_RR, SCAN_INTERVAL)

def wait_for_mt5_and_connect(max_retries=10, wait_sec=10):
    for attempt in range(1, max_retries + 1):
        print(clr(f"\r  MT5 detect kar raha hoon... #{attempt}/{max_retries}",
                  "cyan"), end="", flush=True)
        if mt5.initialize():
            acc = mt5.account_info()
            if acc is not None and acc.login:
                print()
                with _STATE_LOCK:
                    SESSION["connected"] = True
                _push_log(f"[CONNECT] MT5 mila - account={acc.login} server={acc.server}")
                return True
            try: mt5.shutdown()
            except: pass
            print()
            print(clr("  [WARN] MT5 open hai lekin login nahi - MT5 mein login karo...", "yellow"))
        else:
            _, err_msg = mt5.last_error()
            print(clr(f"\r  MT5 nahi mila ({err_msg}) - {wait_sec}s mein dobara try...",
                      "yellow"), end="", flush=True)
        time.sleep(wait_sec)
    print()
    print(clr(f"  [ERROR] {max_retries} tries ke baad bhi MT5 nahi mila.", "red"))
    return False

def _ensure_connected():
    try:
        if mt5.terminal_info() is None:
            _push_log("[RECONNECT] MT5 disconnect - reconnect try kar raha hoon...")
            mt5.shutdown()
            if mt5.initialize():
                acc = mt5.account_info()
                if acc:
                    with _STATE_LOCK:
                        SESSION["connected"] = True
                        SESSION["account_info"] = acc
                    _push_log(f"[RECONNECT] OK - {acc.login}")
                    return True
            with _STATE_LOCK:
                SESSION["connected"] = False
            _push_log("[RECONNECT] FAIL - agla scan try karega")
            return False
        return True
    except Exception as e:
        _push_log(f"[RECONNECT ERR] {e}")
        return False

def register_startup():
    if not WINDOWS:
        return
    try:
        script_path = os.path.abspath(sys.argv[0])
        cmd = f'"{sys.executable}" "{script_path}"'
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                             r"Software\Microsoft\Windows\CurrentVersion\Run",
                             0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, "TriangleBotV3", 0, winreg.REG_SZ, cmd)
        winreg.CloseKey(key)
        print(clr("  [OK] Windows Startup mein register kiya!", "green"))
    except Exception as e:
        print(clr(f"  [WARN] Startup register fail: {e}", "yellow"))

def print_banner():
    w = 62
    lines = [
        ("anony_v1 made by @codex_here", "gold"),
        ("Forex - Crypto - Gold - Silver", "cyan"),
        ("Auto-Detect MT5  |  Auto Trade  |  Trail SL  |  GUI", "gray"),
        ("", ""),
        ("Made by  @codex_here", "magenta"),
    ]
    print()
    print(clr("+" + "="*w + "+", "cyan"))
    for text, color in lines:
        if not text:
            print(clr("|" + " "*w + "|", "cyan"))
        else:
            pad = (w - len(text)) // 2
            print(clr("|", "cyan") + " "*pad + clr(text, color)
                  + " "*(w - pad - len(text)) + clr("|", "cyan"))
    print(clr("+" + "="*w + "+", "cyan"))

def _fmt_uptime(secs):
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    if h: return f"{h}h {m:02d}m {s:02d}s"
    if m: return f"{m}m {s:02d}s"
    return f"{s}s"

def _read_today_journal_stats():
    today = datetime.now().strftime("%Y-%m-%d")
    n = wins = losses = 0
    pnl_total = 0.0
    if not os.path.exists(JOURNAL_FILE): return n, wins, losses, pnl_total
    try:
        with open(JOURNAL_FILE, newline="") as f:
            for row in csv.DictReader(f):
                if row.get("Date") != today: continue
                n += 1
                try:    pnl = float(row.get("Profit_Loss", 0) or 0)
                except: pnl = 0.0
                pnl_total += pnl
                if pnl > 0:   wins += 1
                elif pnl < 0: losses += 1
    except Exception: pass
    return n, wins, losses, pnl_total

def _read_all_journal_stats():
    n = wins = losses = be = 0
    pnl_total = 0.0
    if not os.path.exists(JOURNAL_FILE): return n, wins, losses, be, pnl_total
    try:
        with open(JOURNAL_FILE, newline="") as f:
            for row in csv.DictReader(f):
                n += 1
                try:    pnl = float(row.get("Profit_Loss", 0) or 0)
                except: pnl = 0.0
                pnl_total += pnl
                if pnl > 0:   wins += 1
                elif pnl < 0: losses += 1
                else:         be += 1
    except Exception: pass
    return n, wins, losses, be, pnl_total

def _read_recent_journal_rows(limit=20):
    if not os.path.exists(JOURNAL_FILE): return []
    rows = []
    try:
        with open(JOURNAL_FILE, newline="") as f:
            rows = list(csv.DictReader(f))
    except Exception: pass
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

def log_trade(symbol, tf, direction, entry, sl, tp, lot, rr,
              height, pattern, status="OPEN", pnl=0, notes=""):
    now = datetime.now()
    with open(JOURNAL_FILE, "a", newline="") as f:
        csv.writer(f).writerow([
            now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"),
            symbol, tf, direction,
            round(entry, 5), round(sl, 5), round(tp, 5),
            lot, round(rr, 2), round(height, 1), pattern,
            status, round(pnl, 2), notes
        ])

def _daily_loss_hit():
    global _SESSION_START_BALANCE
    try:
        acc = mt5.account_info()
        if acc is None: return False
        if _SESSION_START_BALANCE is None:
            _SESSION_START_BALANCE = acc.balance
            return False
        loss_pc = (_SESSION_START_BALANCE - acc.balance) / _SESSION_START_BALANCE * 100
        if loss_pc >= DAILY_MAX_LOSS_PC:
            _push_log(f"[DAILY LIMIT] -{loss_pc:.1f}% - trading band! "
                      f"(limit={DAILY_MAX_LOSS_PC}%)")
            return True
    except Exception:
        pass
    return False

def get_candles(symbol, timeframe, count=150):
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
    if rates is None or len(rates) == 0:
        return None
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    return df

def find_swing_highs(df, window=5):
    highs = []
    for i in range(window, len(df) - window):
        seg_max = df["high"].iloc[i - window: i + window + 1].max()
        if df["high"].iloc[i] >= seg_max - 1e-10:
            highs.append((i, float(df["high"].iloc[i])))
    return highs

def find_swing_lows(df, window=5):
    lows = []
    for i in range(window, len(df) - window):
        seg_min = df["low"].iloc[i - window: i + window + 1].min()
        if df["low"].iloc[i] <= seg_min + 1e-10:
            lows.append((i, float(df["low"].iloc[i])))
    return lows

def _slope(values):
    n = len(values)
    if n < 2: return 0.0
    xm = (n - 1) / 2
    ym = sum(values) / n
    num = sum((i - xm) * (values[i] - ym) for i in range(n))
    den = sum((i - xm) ** 2 for i in range(n))
    return num / den if den else 0.0

def detect_triangle(df_closed):
    if df_closed is None or len(df_closed) < 30:
        return None
    sh   = find_swing_highs(df_closed)
    sl_p = find_swing_lows(df_closed)
    if len(sh) < 2 or len(sl_p) < 2:
        return None
    hv = [h[1] for h in sh[-3:]]
    lv = [l[1] for l in sl_p[-3:]]
    ht  = _slope(hv)
    lt  = _slope(lv)
    res = hv[-1]
    sup = lv[-1]
    H   = res - sup
    avg = float(df_closed["close"].iloc[-1])
    if H <= 0 or H < avg * 0.0010:
        return None
    flat = H * 0.30
    ht_flat = abs(ht) < flat
    lt_flat = abs(lt) < flat
    ht_down = ht < -(flat * 0.3)
    lt_up   = lt >  (flat * 0.3)
    if   ht_flat and lt_up:   pattern = "ASCENDING"
    elif ht_down and lt_flat: pattern = "DESCENDING"
    elif ht_down and lt_up:   pattern = "SYMMETRICAL"
    else:                     return None
    return {
        "pattern"   : pattern,
        "resistance": res,
        "support"   : sup,
        "height"    : H,
        "high_trend": ht,
        "low_trend" : lt,
    }

def check_breakout(df, triangle):
    if triangle is None or df is None or len(df) < 4:
        return None
    last  = df.iloc[-2]
    prev  = df.iloc[-3]
    close = float(last["close"])
    open_ = float(last["open"])
    body  = abs(close - open_)
    rng   = float(last["high"]) - float(last["low"])
    if rng <= 0 or (body / rng) < MIN_BODY_RATIO:
        return None
    R, S, H = triangle["resistance"], triangle["support"], triangle["height"]
    if close > R and float(prev["close"]) <= R:
        sl      = S
        sl_dist = abs(close - sl)
        tp      = close + max(H, MIN_RR * sl_dist)
        return {"direction": "BUY",  "entry": close,
                "sl": sl, "tp": tp, "height": H}
    if close < S and float(prev["close"]) >= S:
        sl      = R
        sl_dist = abs(sl - close)
        tp      = close - max(H, MIN_RR * sl_dist)
        return {"direction": "SELL", "entry": close,
                "sl": sl, "tp": tp, "height": H}
    return None

def _round_price(info, price):
    return round(float(price), int(info.digits))

def _enforce_stops(info, direction, price, sl, tp):
    stops_level = int(getattr(info, "trade_stops_level", 0) or 0)
    spread      = int(getattr(info, "spread", 0) or 0)
    min_pts     = max(stops_level, spread + 20, 20)
    min_dist    = min_pts * info.point
    if direction == "BUY":
        if (price - sl) < min_dist: sl = price - min_dist
        if (tp - price) < min_dist: tp = price + min_dist
    else:
        if (sl - price) < min_dist: sl = price + min_dist
        if (price - tp) < min_dist: tp = price - min_dist
    return sl, tp

def calculate_lot(symbol, entry, sl, risk_percent, already_risked_money=0.0):
    acc  = mt5.account_info()
    info = mt5.symbol_info(symbol)
    if acc is None or info is None:
        return 0.01
    available  = max(0.0, acc.equity - already_risked_money)
    risk_money = available * (risk_percent / 100)
    if risk_money <= 0:
        _push_log(f"[LOT WARN] {symbol} - available capital nahi, min lot")
        return info.volume_min
    tick_value   = info.trade_tick_value
    tick_size    = info.trade_tick_size or info.point
    if not tick_value or not tick_size:
        return info.volume_min
    sl_distance  = abs(entry - sl)
    if sl_distance <= 0:
        return info.volume_min
    loss_per_lot = (sl_distance / tick_size) * tick_value
    if loss_per_lot <= 0:
        return info.volume_min
    step = info.volume_step or 0.01
    lot  = round(round((risk_money / loss_per_lot) / step) * step, 2)
    return max(info.volume_min, min(lot, info.volume_max))

def place_order(symbol, direction, sl, tp, lot):
    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        _push_log(f"[ORDER ERR] {symbol} - info/tick None")
        return None, "no_info_or_tick"
    price = tick.ask if direction == "BUY" else tick.bid
    if price <= 0:
        _push_log(f"[ORDER ERR] {symbol} - invalid price {price}")
        return None, "invalid_price"
    sl, tp = _enforce_stops(info, direction, price, sl, tp)
    price  = _round_price(info, price)
    sl     = _round_price(info, sl)
    tp     = _round_price(info, tp)
    step = info.volume_step or 0.01
    lot  = round(round(max(info.volume_min,
                           min(float(lot), info.volume_max)) / step) * step, 2)
    otype = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL
    _push_log(f"[ORDER TRY] {symbol} {direction} price={price} "
              f"sl={sl} tp={tp} lot={lot}")
    last_result = None
    last_err    = "no attempt"
    for fmode in FILLING_MODES:
        req = {
            "action"      : mt5.TRADE_ACTION_DEAL,
            "symbol"      : symbol,
            "volume"      : float(lot),
            "type"        : otype,
            "price"       : price,
            "sl"          : sl,
            "tp"          : tp,
            "deviation"   : 30,
            "magic"       : MAGIC,
            "comment"     : "TriBot_v3.0",
            "type_time"   : mt5.ORDER_TIME_GTC,
            "type_filling": fmode,
        }
        result      = mt5.order_send(req)
        last_result = result
        if result is None:
            last_err = f"fmode={fmode} -> None err={mt5.last_error()}"
            _push_log(f"[ORDER WARN] {symbol} fmode={fmode} -> None, next try...")
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            return result, "ok"
        last_err = (f"fmode={fmode} rc={result.retcode} "
                    f"'{getattr(result,'comment','')}' err={mt5.last_error()}")
        _push_log(f"[ORDER WARN] {symbol} fmode={fmode} "
                  f"rc={result.retcode} -> next filling mode...")
    _push_log(f"[ORDER FAIL] {symbol} saare modes fail. Last: {last_err}")
    return last_result, last_err

def _our_positions():
    all_pos = mt5.positions_get()
    if not all_pos: return []
    return [p for p in all_pos if p.magic == MAGIC]

def is_already_open(symbol):
    pos = mt5.positions_get(symbol=symbol)
    if not pos: return False
    return any(p.magic == MAGIC for p in pos)

def manage_trailing_sl(trail_rr):
    for pos in _our_positions():
        sym  = pos.symbol
        info = mt5.symbol_info(sym)
        if info is None: continue
        direc  = "BUY" if pos.type == 0 else "SELL"
        entry  = pos.price_open
        c_sl   = pos.sl
        c_tp   = pos.tp
        tick   = mt5.symbol_info_tick(sym)
        if tick is None: continue
        price  = tick.bid if direc == "BUY" else tick.ask
        risk   = abs(entry - c_sl)
        if risk <= 0: continue
        pir = ((price - entry) / risk if direc == "BUY"
               else (entry - price) / risk)
        if pir < trail_rr:
            continue
        if pir >= 2.0:
            trail_dist = risk * 0.3
        elif pir >= 1.5:
            trail_dist = risk * 0.4
        else:
            trail_dist = risk * 0.5
        if direc == "BUY":
            new_sl = price - trail_dist
            if new_sl <= c_sl:
                continue
        else:
            new_sl = price + trail_dist
            if new_sl >= c_sl:
                continue
        new_sl, _ = _enforce_stops(info, direc, price,
                                   _round_price(info, new_sl),
                                   _round_price(info, c_tp))
        new_sl = _round_price(info, new_sl)
        if new_sl == c_sl:
            continue
        res = mt5.order_send({
            "action"  : mt5.TRADE_ACTION_SLTP,
            "position": pos.ticket,
            "symbol"  : sym,
            "sl"      : new_sl,
            "tp"      : _round_price(info, c_tp),
        })
        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
            _push_log(f"[TRAIL] {sym} {direc} SL={new_sl} "
                      f"RR=1:{round(pir,2)} dist={round(trail_dist/info.point)}pts")

def _scan_one_pair(symbol, tf_name, tf_code, min_rr):
    try:
        if not mt5.symbol_select(symbol, True):
            return None
        df = get_candles(symbol, tf_code)
        if df is None or len(df) < 35:
            return None
        df_closed = df.iloc[:-1].reset_index(drop=True)
        triangle  = detect_triangle(df_closed)
        if triangle is None:
            return None
        breakout = check_breakout(df, triangle)
        if breakout is None:
            R, S, H = (triangle["resistance"],
                       triangle["support"],
                       triangle["height"])
            tick = mt5.symbol_info_tick(symbol)
            live = tick.bid if tick else float(df["close"].iloc[-1])
            prox = H * 0.12
            dist_R, dist_S = abs(live - R), abs(live - S)
            if dist_R < prox or dist_S < prox:
                closest      = min(dist_R, dist_S)
                distance_pct = (closest / live * 100) if live else 0
                hint         = "BUY breakout" if dist_R <= dist_S else "SELL breakout"
                return {
                    "type": "approaching", "symbol": symbol, "tf": tf_name,
                    "pattern": triangle["pattern"], "R": R, "S": S,
                    "close": live, "distance_pct": distance_pct, "hint": hint,
                }
            return None
        b_entry = breakout["entry"]
        b_sl    = breakout["sl"]
        b_tp    = breakout["tp"]
        if abs(b_entry - b_sl) < 1e-10:
            return None
        rr = abs(b_tp - b_entry) / abs(b_entry - b_sl)
        if rr < min_rr:
            return {"type": "skip_rr", "symbol": symbol, "tf": tf_name, "rr": rr}
        return {
            "type"    : "signal",
            "symbol"  : symbol,
            "tf"      : tf_name,
            "triangle": triangle,
            "breakout": breakout,
            "rr"      : rr,
        }
    except Exception as e:
        return {"type": "error", "symbol": symbol, "tf": tf_name, "error": str(e)}

def scan_all_symbols(scan_num, min_rr, risk_percent, trail_rr):
    if not _ensure_connected():
        _push_log(f"[SCAN #{scan_num}] Skipped - MT5 connected nahi")
        return
    if _daily_loss_hit():
        _push_log(f"[SCAN #{scan_num}] Skipped - daily loss limit hit")
        return
    t0 = time.time()
    signals = approaching = skipped = 0
    approaching_list = []
    signal_results   = []
    tasks = [(sym, tfn, tfc)
             for sym in SYMBOLS
             for tfn, tfc in TIMEFRAMES.items()]
    with ThreadPoolExecutor(max_workers=SCAN_WORKERS) as ex:
        futures = {ex.submit(_scan_one_pair, s, tn, tc, min_rr): None
                   for s, tn, tc in tasks}
        for fut in as_completed(futures):
            r = fut.result()
            if r is None: continue
            t = r["type"]
            if   t == "approaching": approaching += 1; approaching_list.append(r)
            elif t == "skip_rr":     skipped += 1
            elif t == "signal":      signal_results.append(r)
            elif t == "error":
                _push_log(f"[WARN] {r['symbol']} [{r['tf']}] {r['error']}")
    open_count = len(_our_positions())
    committed_risk = 0.0
    for r in signal_results:
        symbol   = r["symbol"]
        tf_name  = r["tf"]
        triangle = r["triangle"]
        breakout = r["breakout"]
        rr       = r["rr"]
        signals += 1
        _push_log(f"[SIGNAL] {symbol} {tf_name} {breakout['direction']} "
                  f"{triangle['pattern']} RR=1:{round(rr,2)}")
        if is_already_open(symbol):
            _push_log(f"[SKIP] {symbol} - position already open")
            continue
        entry = breakout["entry"]
        sl    = breakout["sl"]
        tp    = breakout["tp"]
        lot   = calculate_lot(symbol, entry, sl, risk_percent, committed_risk)
        result, status = place_order(symbol, breakout["direction"], sl, tp, lot)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            _push_log(f"[ORDER OK] {symbol} ticket=#{result.order} lot={lot} "
                      f"RR=1:{round(rr,2)}")
            log_trade(symbol, tf_name, breakout["direction"],
                      entry, sl, tp, lot, rr,
                      breakout["height"] * 10000,
                      triangle["pattern"],
                      notes=f"Auto|{tf_name}|Scan#{scan_num}")
            with _STATE_LOCK:
                SESSION["trades_placed"] += 1
            open_count += 1
            info_tmp = mt5.symbol_info(symbol)
            tick_tmp = mt5.symbol_info_tick(symbol)
            if info_tmp and tick_tmp:
                ts = info_tmp.trade_tick_size or info_tmp.point
                tv = info_tmp.trade_tick_value
                if ts and tv:
                    committed_risk += lot * (abs(entry - sl) / ts) * tv
        else:
            rc      = result.retcode if result else "None"
            comment = getattr(result, "comment", "") if result else ""
            _push_log(f"[ORDER FAIL] {symbol} rc={rc} '{comment}' "
                      f"status='{status}' err={mt5.last_error()}")
    elapsed = time.time() - t0
    with _STATE_LOCK:
        SESSION["scans"]          += 1
        SESSION["last_scan_sec"]   = elapsed
        SESSION["total_scan_sec"] += elapsed
        SESSION["scan_num"]        = scan_num
        SESSION["approaching"]     = approaching_list
        pos_snap = []
        for p in _our_positions():
            ep   = p.price_open
            sl_p = p.sl
            tp_p = p.tp
            risk = abs(ep - sl_p) if sl_p else 0
            move = ((p.price_current - ep) if p.type == 0
                    else (ep - p.price_current))
            rr_now = (move / risk) if risk > 0 else 0
            pos_snap.append({
                "symbol": p.symbol,
                "side"  : "BUY" if p.type == 0 else "SELL",
                "entry" : ep, "now": p.price_current,
                "sl": sl_p, "tp": tp_p,
                "profit": p.profit, "rr": rr_now, "lot": p.volume,
            })
        SESSION["open_positions"] = pos_snap
        SESSION["account_info"]   = mt5.account_info()
    _push_log(f"[SCAN #{scan_num}] signals={signals} "
              f"approaching={approaching} skipped={skipped} ({elapsed:.2f}s)")
    manage_trailing_sl(trail_rr)

def run_startup_test_trade():
    TEST_MAGIC  = MAGIC + 1
    TEST_SYM    = "EURUSD"
    WAIT_SEC    = 10
    _push_log("[TEST] Startup test trade shuru...")
    if not mt5.symbol_select(TEST_SYM, True):
        _push_log(f"[TEST] {TEST_SYM} select nahi hua - skip")
        return
    info = mt5.symbol_info(TEST_SYM)
    tick = mt5.symbol_info_tick(TEST_SYM)
    if info is None or tick is None:
        _push_log("[TEST] info/tick nahi mila - skip")
        return
    lot      = info.volume_min
    price    = tick.ask
    stops_lv = int(getattr(info, "trade_stops_level", 5) or 5)
    spread   = int(getattr(info, "spread", 10) or 10)
    min_dist = max(stops_lv, spread + 20, 20) * info.point
    sl       = _round_price(info, price - min_dist * 3)
    tp       = _round_price(info, price + min_dist * 3)
    last_result = None
    for fmode in FILLING_MODES:
        req = {
            "action"      : mt5.TRADE_ACTION_DEAL,
            "symbol"      : TEST_SYM,
            "volume"      : float(lot),
            "type"        : mt5.ORDER_TYPE_BUY,
            "price"       : _round_price(info, price),
            "sl"          : sl, "tp": tp,
            "deviation"   : 30,
            "magic"       : TEST_MAGIC,
            "comment"     : "TEST_v3",
            "type_time"   : mt5.ORDER_TIME_GTC,
            "type_filling": fmode,
        }
        r = mt5.order_send(req)
        last_result = r
        if r and r.retcode == mt5.TRADE_RETCODE_DONE:
            break
    if not last_result or last_result.retcode != mt5.TRADE_RETCODE_DONE:
        _push_log(f"[TEST] FAIL rc={getattr(last_result,'retcode','None')} "
                  f"- AlgoTrading enabled hai? Err={mt5.last_error()}")
        return
    ticket = last_result.order
    _push_log(f"[TEST] BUY #{ticket} lot={lot} - {WAIT_SEC}s mein close hoga...")
    for _ in range(WAIT_SEC):
        if _STOP_EVENT.is_set(): break
        time.sleep(1)
    positions = mt5.positions_get(ticket=ticket) or []
    if not positions:
        all_pos = mt5.positions_get(symbol=TEST_SYM) or []
        positions = [p for p in all_pos if p.magic == TEST_MAGIC]
    if not positions:
        _push_log(f"[TEST] #{ticket} close karne gaya, mila nahi (TP/SL hit?) - OK")
        return
    for pos in positions:
        ctick = mt5.symbol_info_tick(pos.symbol)
        if ctick is None: continue
        cinf  = mt5.symbol_info(pos.symbol)
        cr = None
        for fmode in FILLING_MODES:
            cr = mt5.order_send({
                "action"      : mt5.TRADE_ACTION_DEAL,
                "symbol"      : pos.symbol,
                "volume"      : pos.volume,
                "type"        : mt5.ORDER_TYPE_SELL,
                "position"    : pos.ticket,
                "price"       : _round_price(cinf, ctick.bid) if cinf else ctick.bid,
                "deviation"   : 30,
                "magic"       : TEST_MAGIC,
                "comment"     : "TEST_close_v3",
                "type_time"   : mt5.ORDER_TIME_GTC,
                "type_filling": fmode,
            })
            if cr and cr.retcode == mt5.TRADE_RETCODE_DONE:
                break
        if cr and cr.retcode == mt5.TRADE_RETCODE_DONE:
            _push_log(f"[TEST] #{pos.ticket} close hua - Script sahi kaam kar rahi hai!")
        else:
            rc = cr.retcode if cr else "None"
            _push_log(f"[TEST] Close FAIL #{pos.ticket} rc={rc} "
                      f"- MT5 mein manually close karo {TEST_SYM} TEST position")

def scanner_worker(risk, min_rr, trail, interval):
    global _SESSION_START_BALANCE
    print(clr("\n  Scanner thread start - MT5 detect kar raha hoon...", "cyan"))
    _push_log("[STARTUP] MT5 dhundh raha hoon...")
    if not wait_for_mt5_and_connect():
        _push_log("[FATAL] MT5 nahi mila - MT5 open karo, login karo, restart karo")
        with _STATE_LOCK:
            SESSION["connected"] = False
        return
    acc = mt5.account_info()
    _SESSION_START_BALANCE = acc.balance
    with _STATE_LOCK:
        SESSION["account_info"] = acc
        SESSION["connected"]    = True
    setup_journal()
    _push_log(f"[OK] Connected: account={acc.login} "
              f"balance=${acc.balance:.2f} server={acc.server}")
    term = mt5.terminal_info()
    if term and not term.trade_allowed:
        _push_log("[WARN] AlgoTrading DISABLED hai MT5 mein! "
                  "MT5 toolbar mein 'Algo Trading' button click karo.")
    try:
        run_startup_test_trade()
    except Exception as e:
        _push_log(f"[TEST] Exception: {e}")
    scan_num = 0
    try:
        while not _STOP_EVENT.is_set():
            scan_num += 1
            try:
                scan_all_symbols(scan_num, min_rr, risk, trail)
            except Exception as e:
                _push_log(f"[ERROR] Scan crash: {e}")
            for _ in range(interval):
                if _STOP_EVENT.is_set(): break
                time.sleep(1)
    finally:
        try: mt5.shutdown()
        except: pass
        _push_log("[SHUTDOWN] Scanner band hua")

class DashboardGUI:
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
        self.tk  = tk
        self.ttk = ttk
        self.ST  = scrolledtext.ScrolledText
        self.root = tk.Tk()
        self.root.title("Triangle Bot v3.0  -  Final Stable")
        self.root.geometry("1300x800")
        self.root.minsize(1100, 700)
        self.root.configure(bg=self.BG)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self._build_ui()
        self.worker = threading.Thread(
            target=scanner_worker,
            args=(risk, min_rr, trail, interval),
            daemon=True,
        )
        self.worker.start()
        self.root.after(500, self._refresh)

    def _lbl(self, parent, text, fg=None, font=("Segoe UI", 10), bg=None, **kw):
        return self.tk.Label(parent, text=text, fg=fg or self.FG,
                             bg=bg or self.PANEL, font=font, **kw)

    def _section(self, parent, title, color=None):
        wrap  = self.tk.Frame(parent, bg=self.BORDER)
        inner = self.tk.Frame(wrap,  bg=self.PANEL)
        inner.pack(fill="both", expand=True, padx=1, pady=1)
        hdr   = self.tk.Frame(inner, bg=self.PANEL_HI)
        hdr.pack(fill="x")
        self._lbl(hdr, "  " + title, fg=color or self.GOLD,
                  font=("Segoe UI", 10, "bold"),
                  bg=self.PANEL_HI, anchor="w").pack(side="left", pady=4)
        body = self.tk.Frame(inner, bg=self.PANEL)
        body.pack(fill="both", expand=True, padx=10, pady=8)
        return wrap, body

    def _make_tree(self, parent, columns, headings, widths):
        ttk   = self.ttk
        style = ttk.Style()
        try: style.theme_use("clam")
        except: pass
        style.configure("Tri.Treeview",
            background=self.PANEL, foreground=self.FG,
            fieldbackground=self.PANEL, borderwidth=0,
            rowheight=22, font=("Consolas", 9))
        style.configure("Tri.Treeview.Heading",
            background=self.PANEL_HI, foreground=self.GOLD,
            font=("Segoe UI", 9, "bold"), borderwidth=0)
        style.map("Tri.Treeview",
            background=[("selected", self.PANEL_HI)],
            foreground=[("selected", self.GOLD)])
        tree = ttk.Treeview(parent, columns=columns, show="headings",
                            style="Tri.Treeview", height=8)
        for c in columns:
            tree.heading(c, text=headings.get(c, c))
            tree.column(c, width=widths.get(c, 80), anchor="center", stretch=True)
        tree.pack(fill="both", expand=True, side="left")
        vs = ttk.Scrollbar(parent, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vs.set)
        vs.pack(side="right", fill="y")
        tree.tag_configure("buy",     foreground=self.GREEN)
        tree.tag_configure("sell",    foreground=self.RED)
        tree.tag_configure("win",     foreground=self.GREEN)
        tree.tag_configure("loss",    foreground=self.RED)
        tree.tag_configure("neutral", foreground=self.FG)
        return tree

    def _build_ui(self):
        tk = self.tk
        topbar = tk.Frame(self.root, bg=self.PANEL_HI, height=58)
        topbar.pack(fill="x")
        tk.Label(topbar, text="  anony_v1 MADE BY @codex_here ",
                 bg=self.PANEL_HI, fg=self.GOLD,
                 font=("Consolas", 14, "bold")).pack(side="left", padx=14)
        self.lbl_conn  = tk.Label(topbar, text=" connecting... ",
                                  bg=self.PANEL_HI, fg=self.YELLOW,
                                  font=("Segoe UI", 10, "bold"))
        self.lbl_conn.pack(side="left", padx=10)
        self.lbl_acc   = tk.Label(topbar, text="", bg=self.PANEL_HI,
                                  fg=self.FG, font=("Consolas", 10))
        self.lbl_acc.pack(side="left", padx=10)
        self.lbl_clock = tk.Label(topbar, text="", bg=self.PANEL_HI,
                                  fg=self.DIM, font=("Consolas", 10))
        self.lbl_clock.pack(side="right", padx=14)
        main = tk.Frame(self.root, bg=self.BG)
        main.pack(fill="both", expand=True, padx=10, pady=8)
        for col in range(3):
            main.columnconfigure(col, weight=1, uniform="col")
        for row in range(3):
            main.rowconfigure(row, weight=1)
        sw, sb = self._section(main, "STRATEGY LOGIC", color=self.BLUE)
        sw.grid(row=0, column=0, sticky="nsew", padx=4, pady=4)
        rows = [
            ("Pattern", "Triangle breakout (ASC / DESC / SYM)"),
            ("Entry",   f"Closed candle outside R/S, body>={int(MIN_BODY_RATIO*100)}% range"),
            ("SL",      "Opposite triangle line"),
            ("TP",      f"Entry +/- max(H, {MIN_RR}xSL_dist)"),
            ("Min RR",  f"1:{MIN_RR}"),
            ("Risk",    f"{RISK_PERCENT}% balance / trade"),
            ("Trail",   f"BE at RR {TRAIL_AT_RR}, then 50% trail"),
            ("Max pos", f"{MAX_OPEN_POSITIONS} positions at a time"),
            ("DailyLim",f"-{DAILY_MAX_LOSS_PC}% balance -> trading stop"),
            ("Symbols", f"{len(SYMBOLS)} pairs x {', '.join(TIMEFRAMES.keys())}"),
            ("Scan",    f"every {SCAN_INTERVAL}s, {SCAN_WORKERS} workers"),
        ]
        for i, (k, v) in enumerate(rows):
            tk.Label(sb, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=9
                     ).grid(row=i, column=0, sticky="w")
            tk.Label(sb, text=v, fg=self.FG, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w",
                     justify="left", wraplength=310
                     ).grid(row=i, column=1, sticky="w", padx=4)
        stw, stb = self._section(main, "WIN RATE & P&L", color=self.GREEN)
        stw.grid(row=0, column=1, sticky="nsew", padx=4, pady=4)
        self.stats_labels = {}
        stat_rows = [
            ("All-time trades",    "all_n",    self.FG),
            ("Win rate",           "all_wr",   self.GREEN),
            ("Wins / Losses",      "all_wl",   self.FG),
            ("All-time P&L",       "all_pnl",  self.GREEN),
            ("",                   "",         self.FG),
            ("Today trades",       "today_n",  self.FG),
            ("Today win rate",     "today_wr", self.GREEN),
            ("Today P&L",          "today_pnl",self.GREEN),
            ("Unrealized P&L",     "unreal",   self.GREEN),
        ]
        for i, (k, key, color) in enumerate(stat_rows):
            if not k:
                tk.Frame(stb, bg=self.PANEL, height=8).grid(row=i, column=0, columnspan=2)
                continue
            tk.Label(stb, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=18
                     ).grid(row=i, column=0, sticky="w", pady=1)
            lbl = tk.Label(stb, text="-", fg=color, bg=self.PANEL,
                           font=("Consolas", 11, "bold"), anchor="w")
            lbl.grid(row=i, column=1, sticky="w", padx=4)
            self.stats_labels[key] = lbl
        aw, ab = self._section(main, "ACCOUNT / SESSION", color=self.GOLD)
        aw.grid(row=0, column=2, sticky="nsew", padx=4, pady=4)
        self.acc_labels = {}
        acc_rows = [
            ("Login",      "login",    self.FG),
            ("Server",     "server",   self.FG),
            ("Balance",    "balance",  self.FG),
            ("Equity",     "equity",   self.FG),
            ("Free margin","free",     self.FG),
            ("Currency",   "currency", self.DIM),
            ("",           "",         self.FG),
            ("Uptime",     "uptime",   self.DIM),
            ("Scans",      "scans",    self.DIM),
            ("Last scan",  "last_scan",self.DIM),
            ("Avg scan",   "avg_scan", self.DIM),
        ]
        for i, (k, key, color) in enumerate(acc_rows):
            if not k:
                tk.Frame(ab, bg=self.PANEL, height=8).grid(row=i, column=0, columnspan=2)
                continue
            tk.Label(ab, text=k+":", fg=self.DIM, bg=self.PANEL,
                     font=("Segoe UI", 9), anchor="w", width=12
                     ).grid(row=i, column=0, sticky="w", pady=1)
            lbl = tk.Label(ab, text="-", fg=color, bg=self.PANEL,
                           font=("Consolas", 10), anchor="w")
            lbl.grid(row=i, column=1, sticky="w", padx=4)
            self.acc_labels[key] = lbl
        nw, nb = self._section(main, "NEXT TRADE ALERTS - approaching breakouts",
                               color=self.YELLOW)
        nw.grid(row=1, column=0, sticky="nsew", padx=4, pady=4)
        self.alerts_tree = self._make_tree(nb,
            columns=("pair","tf","pattern","R","S","dist","hint"),
            headings={"pair":"Pair","tf":"TF","pattern":"Pattern",
                      "R":"R","S":"S","dist":"Dist%","hint":"Hint"},
            widths={"pair":75,"tf":40,"pattern":92,"R":78,"S":78,"dist":58,"hint":92},
        )
        pw, pb = self._section(main, "OPEN POSITIONS - live RR / SL / TP / P&L",
                               color=self.GREEN)
        pw.grid(row=1, column=1, columnspan=2, sticky="nsew", padx=4, pady=4)
        self.pos_tree = self._make_tree(pb,
            columns=("pair","side","lot","entry","now","sl","tp","rr","pnl"),
            headings={"pair":"Pair","side":"Side","lot":"Lot","entry":"Entry",
                      "now":"Price","sl":"SL","tp":"TP","rr":"RR","pnl":"P&L"},
            widths={"pair":80,"side":50,"lot":50,"entry":85,"now":85,
                    "sl":85,"tp":85,"rr":60,"pnl":80},
        )
        jw, jb = self._section(main, "TRADE JOURNAL - last 20",
                               color=self.MAGENTA)
        jw.grid(row=2, column=0, columnspan=2, sticky="nsew", padx=4, pady=4)
        self.journal_tree = self._make_tree(jb,
            columns=("date","time","pair","tf","dir","pattern",
                     "entry","sl","tp","lot","rr","pnl","status"),
            headings={"date":"Date","time":"Time","pair":"Pair","tf":"TF",
                      "dir":"Dir","pattern":"Pattern","entry":"Entry","sl":"SL",
                      "tp":"TP","lot":"Lot","rr":"RR","pnl":"P&L","status":"Status"},
            widths={"date":80,"time":60,"pair":70,"tf":35,"dir":40,"pattern":85,
                    "entry":75,"sl":75,"tp":75,"lot":45,"rr":45,"pnl":60,"status":60},
        )
        lw, lb = self._section(main, "ACTIVITY LOG", color=self.DIM)
        lw.grid(row=2, column=2, sticky="nsew", padx=4, pady=4)
        self.log_text = self.ST(
            lb, bg="#0a0d14", fg=self.DIM, font=("Consolas", 9),
            wrap="word", insertbackground=self.FG,
            relief="flat", borderwidth=0, highlightthickness=0,
        )
        self.log_text.pack(fill="both", expand=True)
        self.log_text.configure(state="disabled")
        foot = tk.Frame(self.root, bg=self.BG)
        foot.pack(fill="x", padx=10, pady=(0, 6))
        tk.Label(foot,
                 text="Made by @codex_here  -  v3.0 Final  -  auto-detects MT5  "
                      "-  no credentials stored",
                 bg=self.BG, fg=self.DIM, font=("Segoe UI", 8)
                 ).pack(side="left")

    def _refresh(self):
        try:    self._refresh_once()
        except Exception as e: _push_log(f"[GUI] refresh err: {e}")
        if not _STOP_EVENT.is_set():
            self.root.after(1000, self._refresh)

    def _refresh_once(self):
        self.lbl_clock.config(text=datetime.now().strftime("%Y-%m-%d  %H:%M:%S"))
        with _STATE_LOCK:
            connected  = SESSION["connected"]
            acc        = SESSION["account_info"]
            approach   = list(SESSION["approaching"])
            positions  = list(SESSION["open_positions"])
            scans      = SESSION["scans"]
            last_scan  = SESSION["last_scan_sec"]
            total_scan = SESSION["total_scan_sec"]
            log_lines  = list(SESSION["log_lines"])
        self.lbl_conn.config(
            text="  CONNECTED   " if connected else "  CONNECTING...",
            fg=self.GREEN if connected else self.YELLOW)
        if acc:
            self.lbl_acc.config(
                text=f"  Acct {acc.login}  |  Bal ${acc.balance:,.2f}  "
                     f"|  Equity ${acc.equity:,.2f}  |  {acc.server}")
            self.acc_labels["login"].config(text=str(acc.login))
            self.acc_labels["server"].config(text=acc.server)
            self.acc_labels["balance"].config(text=f"${acc.balance:,.2f}")
            self.acc_labels["equity"].config(text=f"${acc.equity:,.2f}")
            self.acc_labels["free"].config(text=f"${acc.margin_free:,.2f}")
            self.acc_labels["currency"].config(text=acc.currency)
        avg = (total_scan / scans) if scans else 0.0
        self.acc_labels["uptime"].config(
            text=_fmt_uptime(time.time() - SESSION["start_time"]))
        self.acc_labels["scans"].config(text=str(scans))
        self.acc_labels["last_scan"].config(text=f"{last_scan:.2f}s")
        self.acc_labels["avg_scan"].config(text=f"{avg:.2f}s")
        n_t, w_t, l_t, pnl_t = _read_today_journal_stats()
        n_a, w_a, l_a, _, pnl_a = _read_all_journal_stats()
        wr_a = (w_a / max(1, w_a + l_a)) * 100 if (w_a + l_a) else 0
        wr_t = (w_t / max(1, w_t + l_t)) * 100 if (w_t + l_t) else 0
        unreal = sum(p["profit"] for p in positions)
        self.stats_labels["all_n"].config(text=str(n_a))
        self.stats_labels["all_wr"].config(
            text=f"{wr_a:.1f}%",
            fg=self.GREEN if wr_a >= 50 else (self.YELLOW if wr_a >= 35 else self.RED))
        self.stats_labels["all_wl"].config(text=f"{w_a} W  /  {l_a} L")
        self.stats_labels["all_pnl"].config(
            text=self._money(pnl_a),
            fg=self.GREEN if pnl_a >= 0 else self.RED)
        self.stats_labels["today_n"].config(text=str(n_t))
        self.stats_labels["today_wr"].config(
            text=f"{wr_t:.1f}%",
            fg=self.GREEN if wr_t >= 50 else (self.YELLOW if wr_t >= 35 else self.RED))
        self.stats_labels["today_pnl"].config(
            text=self._money(pnl_t),
            fg=self.GREEN if pnl_t >= 0 else self.RED)
        self.stats_labels["unreal"].config(
            text=self._money(unreal),
            fg=self.GREEN if unreal >= 0 else self.RED)
        self.alerts_tree.delete(*self.alerts_tree.get_children())
        for a in sorted(approach, key=lambda x: x["distance_pct"])[:30]:
            tag = "buy" if "BUY" in a["hint"] else "sell"
            self.alerts_tree.insert("", "end", tags=(tag,), values=(
                a["symbol"], a["tf"], a["pattern"],
                f"{a['R']:.5f}", f"{a['S']:.5f}",
                f"{a['distance_pct']:.2f}%", a["hint"],
            ))
        self.pos_tree.delete(*self.pos_tree.get_children())
        for p in positions:
            tag = "win" if p["profit"] >= 0 else "loss"
            self.pos_tree.insert("", "end", tags=(tag,), values=(
                p["symbol"], p["side"], f"{p['lot']:.2f}",
                f"{p['entry']:.5f}", f"{p['now']:.5f}",
                f"{p['sl']:.5f}", f"{p['tp']:.5f}",
                f"{p['rr']:+.2f}", self._money(p["profit"]),
            ))
        rows = _read_recent_journal_rows(20)
        self.journal_tree.delete(*self.journal_tree.get_children())
        for row in rows[::-1]:
            try:    pnl_v = float(row.get("Profit_Loss", 0) or 0)
            except: pnl_v = 0
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
        try:    x = float(x)
        except: return str(x)
        sign = "+" if x >= 0 else "-"
        return f"{sign}${abs(x):,.2f}"

    def _on_close(self):
        from tkinter import messagebox
        if messagebox.askyesno(
                "Bot Band Karo?",
                "Bot band karne pe MT5 disconnect ho jayega.\n\n"
                "Open positions broker pe rahenge (automatically close nahi honge).\n\n"
                "Band karna hai?"):
            _STOP_EVENT.set()
            self.root.after(500, self.root.destroy)

    def run(self):
        self.root.mainloop()

def run_console_mode(risk, min_rr, trail, interval):
    global _SESSION_START_BALANCE
    print(clr("\n  MT5 detect kar raha hoon...", "cyan"))
    if not wait_for_mt5_and_connect():
        print(clr("\n  [ERROR] MT5 nahi mila!", "red"))
        time.sleep(15); return
    acc = mt5.account_info()
    _SESSION_START_BALANCE = acc.balance
    print(clr(f"\n  Account: {acc.login}  Bal: ${acc.balance:,.2f}  Server: {acc.server}",
              "green"))
    term = mt5.terminal_info()
    if term and not term.trade_allowed:
        print(clr("  [WARN] AlgoTrading DISABLED hai MT5 mein!", "red"))
    setup_journal()
    try:
        run_startup_test_trade()
    except Exception as e:
        _push_log(f"[TEST] Exception: {e}")
    print(clr("\n  Bot chal raha hai (console mode). Ctrl+C se band karo.\n", "green"))
    scan_num = 0
    try:
        while True:
            scan_num += 1
            scan_all_symbols(scan_num, min_rr, risk, trail)
            with _STATE_LOCK:
                lines = list(SESSION["log_lines"])
            for line in lines[-10:]:
                print(clr("  " + line, "gray"))
            time.sleep(interval)
    except KeyboardInterrupt:
        print(clr("\n  Band ho raha hoon...", "yellow"))
        try: mt5.shutdown()
        except: pass

def main():
    print_banner()
    cleanup_old_creds()
    use_console = "--console" in sys.argv
    risk, min_rr, trail, interval = load_settings()
    if WINDOWS:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                 r"Software\Microsoft\Windows\CurrentVersion\Run",
                                 0, winreg.KEY_READ)
            winreg.QueryValueEx(key, "TriangleBotV3")
            winreg.CloseKey(key)
        except FileNotFoundError:
            print(clr("\n  First run - Windows Startup mein register kar raha hoon...",
                      "yellow"))
            register_startup()
        except Exception:
            pass
    if use_console:
        run_console_mode(risk, min_rr, trail, interval)
        return
    try:
        import tkinter
        p = tkinter.Tk(); p.withdraw(); p.destroy()
    except Exception as e:
        print(clr(f"\n  [WARN] tkinter nahi mila ({e}) - console mode mein ja raha hoon.",
                  "yellow"))
        run_console_mode(risk, min_rr, trail, interval)
        return
    print(clr("\n  GUI window launch ho rahi hai...", "cyan"))
    print(clr("  (MT5 open aur logged in hona chahiye. Console: --console)\n", "dim"))
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
        print()
        print(clr("="*60, "red"))
        print(clr(" [CRASH] Script crash ho gaya", "red"))
        print(clr("="*60, "red"))
        print(clr(f"\n  {type(e).__name__}: {e}\n", "yellow"))
        _tb.print_exc()
        print(clr("\n  60 second mein band ho jayega...", "dim"))
        try: time.sleep(60)
        except: pass
        sys.exit(1)
