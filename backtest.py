"""
TRIANGLE BREAKOUT  -  HISTORICAL BACKTESTER
   Made by @codex_here

Runs the EXACT SAME logic as triangle_scanner.py against historical
MT5 candle data to estimate per-pair / per-timeframe performance.

How to run:
   1. Make sure triangle_scanner.py has been run at least once
      (so credentials are saved in ~/.triangle_bot/creds.dat)
   2. Open MT5 terminal so it can serve historical data
   3. Double-click run_backtest.bat   (or:  python backtest.py)

Output:
   - Per-pair x per-timeframe table:
        Trades  Win%  Avg RR  Total R  Best  Worst  Trades/day
   - Overall summary
   - CSV file:  backtest_results.csv
"""

import os, sys, csv, base64, time
from datetime import datetime, timedelta
from collections import defaultdict

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from colorama import init, Fore, Style

init(autoreset=True)

# ====================================================================
#  SETTINGS - tune the backtest window here
# ====================================================================

# How many days of history to backtest, per timeframe
HISTORY_DAYS = {
    "M15": 30,    # last 30 days  (M15 has ~3000 candles in 30 days)
    "H1" : 180,   # last 180 days
    "H4" : 730,   # last 2 years
}

# Same trade rules as live bot
MIN_RR    = 2.0
SWING_WIN = 5    # swing-high/low lookback window
HEIGHT_MIN_PCT = 0.002  # min triangle height as % of price

# Use the same symbol list as the live bot
SYMBOLS = [
    "EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD",
    "EURGBP","EURJPY","GBPJPY","AUDJPY","CADJPY","CHFJPY","EURAUD","EURCHF",
    "BTCUSD","ETHUSD",
    "XAUUSD","XAGUSD",
]

TIMEFRAMES = {
    "M15": mt5.TIMEFRAME_M15,
    "H1" : mt5.TIMEFRAME_H1,
    "H4" : mt5.TIMEFRAME_H4,
}

# ====================================================================
#  COLOR HELPERS
# ====================================================================
C = {
    "green":   Fore.GREEN   + Style.BRIGHT,
    "red":     Fore.RED     + Style.BRIGHT,
    "yellow":  Fore.YELLOW  + Style.BRIGHT,
    "cyan":    Fore.CYAN    + Style.BRIGHT,
    "magenta": Fore.MAGENTA + Style.BRIGHT,
    "white":   Fore.WHITE   + Style.BRIGHT,
    "gray":    Fore.WHITE,
    "dim":     Style.DIM,
}
def clr(t, c): return C.get(c, "") + str(t) + Style.RESET_ALL

# ====================================================================
#  LOAD SAVED CREDENTIALS  (same scheme as triangle_scanner.py)
# ====================================================================
CREDS_DIR  = os.path.join(os.path.expanduser("~"), ".triangle_bot")
CREDS_FILE = os.path.join(CREDS_DIR, "creds.dat")
_XOR_KEY   = b"TriangleBotV2_codex_here_secret_key_2026"

def _xor_bytes(d, k): return bytes(b ^ k[i % len(k)] for i, b in enumerate(d))

def load_saved_creds():
    if not os.path.exists(CREDS_FILE):
        print(clr("[ERROR] No saved credentials found.", "red"))
        print(clr("        Run triangle_scanner.py once first to save them.", "yellow"))
        sys.exit(1)
    try:
        with open(CREDS_FILE, "rb") as f:
            data = f.read()
        decrypted = _xor_bytes(base64.b64decode(data), _XOR_KEY).decode("utf-8")
        login_str, password, server = decrypted.split("\n", 2)
        return int(login_str), password, server
    except Exception as e:
        print(clr(f"[ERROR] Could not read creds: {e}", "red"))
        sys.exit(1)

# ====================================================================
#  EXACT SAME DETECTION + BREAKOUT LOGIC AS LIVE BOT
# ====================================================================

def find_swing_highs(df, window=SWING_WIN):
    highs = []
    for i in range(window, len(df) - window):
        if df["high"].iloc[i] == df["high"].iloc[i - window:i + window + 1].max():
            highs.append((i, df["high"].iloc[i]))
    return highs

def find_swing_lows(df, window=SWING_WIN):
    lows = []
    for i in range(window, len(df) - window):
        if df["low"].iloc[i] == df["low"].iloc[i - window:i + window + 1].min():
            lows.append((i, df["low"].iloc[i]))
    return lows

def detect_triangle(df):
    if df is None or len(df) < 30:
        return None
    sh = find_swing_highs(df); sl = find_swing_lows(df)
    if len(sh) < 2 or len(sl) < 2: return None
    rh = sh[-3:]; rl = sl[-3:]
    hv = [h[1] for h in rh]; lv = [l[1] for l in rl]
    ht = np.polyfit(range(len(hv)), hv, 1)[0]
    lt = np.polyfit(range(len(lv)), lv, 1)[0]
    resistance = hv[-1]; support = lv[-1]
    height = resistance - support
    avg = df["close"].iloc[-1]
    tol = avg * 0.0005
    if height < avg * HEIGHT_MIN_PCT:
        return None
    if   abs(ht) < tol and lt > tol:   pattern = "ASCENDING"
    elif ht < -tol and abs(lt) < tol:  pattern = "DESCENDING"
    elif ht < -tol and lt > tol:       pattern = "SYMMETRICAL"
    else: return None
    return {"pattern": pattern, "resistance": resistance, "support": support,
            "height": height}

def check_breakout(df, triangle):
    if triangle is None or df is None: return None
    last = df.iloc[-1]; prev = df.iloc[-2]
    close = last["close"]; open_ = last["open"]
    body = abs(close - open_); rng = last["high"] - last["low"]
    if rng == 0 or body / rng < 0.5:
        return None
    R, S, H = triangle["resistance"], triangle["support"], triangle["height"]
    if close > R and prev["close"] <= R:
        return {"direction": "BUY",  "entry": close, "sl": S, "tp": close + H, "height": H}
    if close < S and prev["close"] >= S:
        return {"direction": "SELL", "entry": close, "sl": R, "tp": close - H, "height": H}
    return None

# ====================================================================
#  CANDLE FETCHING
# ====================================================================
def fetch_candles(symbol, tf_code, days):
    if not mt5.symbol_select(symbol, True):
        return None
    end = datetime.now()
    start = end - timedelta(days=days)
    rates = mt5.copy_rates_range(symbol, tf_code, start, end)
    if rates is None or len(rates) == 0:
        return None
    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    df.set_index("time", inplace=True)
    return df

# ====================================================================
#  WALK-FORWARD SIMULATOR
# ====================================================================
def simulate(df, symbol, tf_name):
    """
    Walk forward through candles. At each candle:
      - If a trade is open, check if SL or TP hit
      - If no open trade, run detect_triangle + check_breakout on last 100 candles
      - If valid signal AND RR >= MIN_RR, open the trade
    Returns list of trade dicts.
    """
    trades = []
    open_trade = None

    if len(df) < 110:
        return trades

    for i in range(100, len(df)):
        candle_high = df["high"].iloc[i]
        candle_low  = df["low"].iloc[i]

        # ------ Manage any open trade ------
        if open_trade is not None:
            t = open_trade
            if t["direction"] == "BUY":
                # Conservative: if both SL and TP are inside this candle, assume SL hit (worst case)
                hit_sl = candle_low  <= t["sl"]
                hit_tp = candle_high >= t["tp"]
                if hit_sl and hit_tp:
                    t["result"] = "LOSS"; t["pnl_R"] = -1.0
                elif hit_sl:
                    t["result"] = "LOSS"; t["pnl_R"] = -1.0
                elif hit_tp:
                    t["result"] = "WIN";  t["pnl_R"] = t["rr"]
                else:
                    continue  # still open
            else:  # SELL
                hit_sl = candle_high >= t["sl"]
                hit_tp = candle_low  <= t["tp"]
                if hit_sl and hit_tp:
                    t["result"] = "LOSS"; t["pnl_R"] = -1.0
                elif hit_sl:
                    t["result"] = "LOSS"; t["pnl_R"] = -1.0
                elif hit_tp:
                    t["result"] = "WIN";  t["pnl_R"] = t["rr"]
                else:
                    continue
            t["exit_time"] = df.index[i]
            t["bars_held"] = i - t["entry_idx"]
            trades.append(t)
            open_trade = None
            # don't take a new trade on the same bar that closed one
            continue

        # ------ Look for new signal on completed candle ------
        window = df.iloc[i - 100:i + 1]
        triangle = detect_triangle(window)
        if triangle is None:
            continue
        breakout = check_breakout(window, triangle)
        if breakout is None:
            continue
        entry, sl, tp = breakout["entry"], breakout["sl"], breakout["tp"]
        if abs(entry - sl) == 0:
            continue
        rr = abs(tp - entry) / abs(entry - sl)
        if rr < MIN_RR:
            continue

        open_trade = {
            "symbol": symbol, "tf": tf_name,
            "entry_time": df.index[i], "entry_idx": i,
            "direction": breakout["direction"],
            "entry": entry, "sl": sl, "tp": tp,
            "rr": rr, "pattern": triangle["pattern"],
        }

    return trades

# ====================================================================
#  REPORT FORMATTING
# ====================================================================
def fmt_pct(x): return f"{x*100:5.1f}%"
def fmt_R(x):   return f"{x:+6.2f}R"

def print_per_pair_table(all_trades, history_days):
    """Print a per-pair × per-timeframe summary."""
    print()
    print(clr("=" * 110, "cyan"))
    print(clr("  BACKTEST RESULTS  -  per Pair × Timeframe", "cyan"))
    print(clr("=" * 110, "cyan"))

    hdr = (f"  {'Pair':<10} {'TF':<5} {'Trades':>7} {'Wins':>6} {'Losses':>7} "
           f"{'Win%':>7} {'AvgRR':>7} {'TotalR':>9} {'Best':>7} {'Worst':>7} {'Trd/day':>9}")
    print(clr(hdr, "yellow"))
    print(clr("-" * 110, "dim"))

    # Group trades by (symbol, tf)
    grouped = defaultdict(list)
    for t in all_trades:
        grouped[(t["symbol"], t["tf"])].append(t)

    rows_data = []
    for (sym, tf), trs in sorted(grouped.items()):
        n = len(trs)
        wins = sum(1 for t in trs if t["result"] == "WIN")
        losses = sum(1 for t in trs if t["result"] == "LOSS")
        winrate = wins / n if n else 0
        avg_rr = np.mean([t["rr"] for t in trs]) if n else 0
        total_R = sum(t["pnl_R"] for t in trs)
        best  = max([t["pnl_R"] for t in trs], default=0)
        worst = min([t["pnl_R"] for t in trs], default=0)
        days = max(history_days.get(tf, 30), 1)
        per_day = n / days

        wr_color = "green" if winrate >= 0.5 else ("yellow" if winrate >= 0.35 else "red")
        tot_color = "green" if total_R > 0 else "red"

        line = (f"  {sym:<10} {tf:<5} "
                f"{n:>7} {wins:>6} {losses:>7} "
                f"{clr(fmt_pct(winrate), wr_color)} "
                f"{avg_rr:>6.2f}  "
                f"{clr(fmt_R(total_R), tot_color):>9} "
                f"{best:>+6.2f}R {worst:>+6.2f}R {per_day:>8.2f}")
        print(line)
        rows_data.append({
            "symbol": sym, "tf": tf, "trades": n, "wins": wins, "losses": losses,
            "winrate": winrate, "avg_rr": avg_rr, "total_R": total_R,
            "best_R": best, "worst_R": worst, "trades_per_day": per_day,
        })
    print(clr("-" * 110, "dim"))
    return rows_data

def print_per_tf_summary(all_trades, history_days):
    print()
    print(clr("=" * 70, "cyan"))
    print(clr("  PER-TIMEFRAME SUMMARY (across all pairs)", "cyan"))
    print(clr("=" * 70, "cyan"))
    print(clr(f"  {'TF':<5} {'Trades':>7} {'Win%':>8} {'AvgRR':>8} {'TotalR':>10} {'Trd/day':>10}", "yellow"))
    print(clr("-" * 70, "dim"))
    grouped = defaultdict(list)
    for t in all_trades:
        grouped[t["tf"]].append(t)
    for tf in TIMEFRAMES.keys():
        trs = grouped.get(tf, [])
        n = len(trs)
        if n == 0:
            print(f"  {tf:<5} {0:>7} {'-':>8} {'-':>8} {'-':>10} {'-':>10}")
            continue
        wins = sum(1 for t in trs if t["result"] == "WIN")
        winrate = wins / n
        avg_rr = np.mean([t["rr"] for t in trs])
        total_R = sum(t["pnl_R"] for t in trs)
        days = max(history_days.get(tf, 30), 1)
        per_day = n / days / max(1, len(set(t["symbol"] for t in trs)))
        # per_day above is per-symbol per-day; we want overall trades/day
        overall_per_day = n / days
        wr_color = "green" if winrate >= 0.5 else ("yellow" if winrate >= 0.35 else "red")
        tot_color = "green" if total_R > 0 else "red"
        print(f"  {tf:<5} {n:>7} {clr(fmt_pct(winrate), wr_color)} "
              f"{avg_rr:>7.2f} {clr(fmt_R(total_R), tot_color):>10} {overall_per_day:>9.2f}")
    print(clr("-" * 70, "dim"))

def print_per_pattern_summary(all_trades):
    print()
    print(clr("=" * 60, "cyan"))
    print(clr("  PER-PATTERN SUMMARY", "cyan"))
    print(clr("=" * 60, "cyan"))
    print(clr(f"  {'Pattern':<14} {'Trades':>7} {'Win%':>8} {'AvgRR':>8} {'TotalR':>10}", "yellow"))
    print(clr("-" * 60, "dim"))
    grouped = defaultdict(list)
    for t in all_trades:
        grouped[t["pattern"]].append(t)
    for pat, trs in grouped.items():
        n = len(trs)
        wins = sum(1 for t in trs if t["result"] == "WIN")
        winrate = wins / n if n else 0
        avg_rr = np.mean([t["rr"] for t in trs]) if n else 0
        total_R = sum(t["pnl_R"] for t in trs)
        wr_color = "green" if winrate >= 0.5 else ("yellow" if winrate >= 0.35 else "red")
        tot_color = "green" if total_R > 0 else "red"
        print(f"  {pat:<14} {n:>7} {clr(fmt_pct(winrate), wr_color)} "
              f"{avg_rr:>7.2f} {clr(fmt_R(total_R), tot_color):>10}")
    print(clr("-" * 60, "dim"))

def print_overall(all_trades, history_days):
    print()
    print(clr("+" + "=" * 60 + "+", "magenta"))
    print(clr("|  OVERALL BACKTEST SUMMARY".ljust(61) + "|", "magenta"))
    print(clr("+" + "=" * 60 + "+", "magenta"))
    n = len(all_trades)
    if n == 0:
        print("  No trades found in backtest period.")
        return
    wins = sum(1 for t in all_trades if t["result"] == "WIN")
    losses = sum(1 for t in all_trades if t["result"] == "LOSS")
    winrate = wins / n
    avg_rr = np.mean([t["rr"] for t in all_trades])
    total_R = sum(t["pnl_R"] for t in all_trades)
    avg_R   = total_R / n
    print(f"  Total trades simulated:    {n}")
    print(f"  Wins / Losses:             {clr(wins, 'green')} / {clr(losses, 'red')}")
    wr_c = "green" if winrate >= 0.5 else ("yellow" if winrate >= 0.35 else "red")
    print(f"  Win rate:                  {clr(fmt_pct(winrate), wr_c)}")
    print(f"  Average RR (planned):      1:{avg_rr:.2f}")
    print(f"  Average return per trade:  {avg_R:+.2f}R")
    tot_c = "green" if total_R > 0 else "red"
    print(f"  Total return (R-multiple): {clr(fmt_R(total_R), tot_c)}")
    if winrate > 0:
        # Expectancy per trade in R
        # win contributes +avg_rr (with planned RR), loss contributes -1
        expectancy = winrate * avg_rr - (1 - winrate) * 1.0
        exp_c = "green" if expectancy > 0 else "red"
        print(f"  Expectancy per trade:      {clr(f'{expectancy:+.2f}R', exp_c)}  (theoretical)")
    print(clr("+" + "=" * 60 + "+", "magenta"))

def save_csv(all_trades, path="backtest_trades.csv"):
    if not all_trades: return
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["symbol","tf","entry_time","exit_time","direction","pattern",
                    "entry","sl","tp","rr","result","pnl_R","bars_held"])
        for t in all_trades:
            w.writerow([t["symbol"], t["tf"], t["entry_time"], t.get("exit_time",""),
                        t["direction"], t["pattern"], t["entry"], t["sl"], t["tp"],
                        round(t["rr"],2), t["result"], round(t["pnl_R"],2),
                        t.get("bars_held", "")])
    print(clr(f"\n  Detailed trade log saved: {path}", "cyan"))

# ====================================================================
#  MAIN
# ====================================================================
def main():
    print(clr("\n" + "=" * 70, "cyan"))
    print(clr("  TRIANGLE BREAKOUT  -  HISTORICAL BACKTESTER", "gold" if "gold" in C else "yellow"))
    print(clr("  Made by @codex_here", "magenta"))
    print(clr("=" * 70, "cyan"))

    login, password, server = load_saved_creds()
    print(clr(f"  Account: {login}    Server: {server}", "gray"))
    print(clr("  Connecting to MT5...", "cyan"))

    if not mt5.initialize(login=login, password=password, server=server):
        err = mt5.last_error()
        print(clr(f"  [ERROR] MT5 initialize failed: {err}", "red"))
        print(clr("  Make sure MT5 terminal is running.", "yellow"))
        time.sleep(15)
        sys.exit(1)
    print(clr("  Connected.\n", "green"))

    all_trades = []
    total_combos = len(SYMBOLS) * len(TIMEFRAMES)
    done = 0

    for symbol in SYMBOLS:
        for tf_name, tf_code in TIMEFRAMES.items():
            done += 1
            days = HISTORY_DAYS.get(tf_name, 60)
            print(clr(f"  [{done}/{total_combos}] Fetching  {symbol:<10} {tf_name}  "
                      f"(last {days} days)...", "dim"), end=" ", flush=True)
            df = fetch_candles(symbol, tf_code, days)
            if df is None or len(df) < 110:
                print(clr("skipped (no data)", "yellow"))
                continue
            trades = simulate(df, symbol, tf_name)
            n = len(trades)
            if n == 0:
                print(clr(f"0 trades  ({len(df)} candles)", "dim"))
            else:
                wins = sum(1 for t in trades if t["result"] == "WIN")
                wr = wins / n
                col = "green" if wr >= 0.5 else "yellow" if wr >= 0.35 else "red"
                print(clr(f"{n} trades  WR={fmt_pct(wr)}", col))
            all_trades.extend(trades)

    mt5.shutdown()

    # ----- Reports -----
    print_per_pair_table(all_trades, HISTORY_DAYS)
    print_per_tf_summary(all_trades, HISTORY_DAYS)
    print_per_pattern_summary(all_trades)
    print_overall(all_trades, HISTORY_DAYS)
    save_csv(all_trades)

    print(clr("\n  Backtest done. Press any key to exit (window stays for 60s)...", "dim"))
    time.sleep(60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        import traceback
        print()
        print(clr("=" * 60, "red"))
        print(clr(f"  [CRASH] {type(e).__name__}: {e}", "red"))
        print(clr("=" * 60, "red"))
        traceback.print_exc()
        time.sleep(60)
