"""
TRIANGLE BOT - LIVE GUI DASHBOARD (Tkinter)
Made by @codex_here

A separate dark-themed GUI window that the main bot updates in real time.
Layout matches the reference screenshot:
  +-------------------------------------------------------------------+
  |  Acc 12345 | Broker | Bal: ... | Eq: ...     WinRate ...  | UTC ..|
  |  NEXT SETUP:  EURUSD BUY  ->  approaching breakout                |
  +---------------------------------------------------------+---------+
  | [Active Trades] [Setup Scanner] [Closed Trades] [Chart View] [Console Log] |
  | (treeview tables update every ~1.5s)                                        |
  +-------------------------------------------------------------------+
"""

import os, csv, time, threading, queue, re
from datetime import datetime, timezone

import tkinter as tk
from tkinter import ttk

# ---- Dark theme palette ---------------------------------------------
BG_DARK   = "#0e1117"
BG_PANEL  = "#161b22"
BG_HEADER = "#1f2937"
FG_LIGHT  = "#e6edf3"
FG_DIM    = "#8b949e"
ACCENT    = "#3b82f6"   # blue
GREEN     = "#22c55e"
RED       = "#ef4444"
ORANGE    = "#f59e0b"
GOLD      = "#fbbf24"
MAGENTA   = "#c084fc"

# ANSI escape stripper for console-tab capture
_ANSI = re.compile(r"\x1b\[[0-9;]*m")


# ====================================================================
#  THREAD-SAFE SHARED STATE  (scan thread writes, GUI thread reads)
# ====================================================================
class BotState:
    def __init__(self):
        self.lock = threading.RLock()
        self.account       = None         # dict
        self.positions     = []           # list of dicts
        self.approaching   = []           # list of dicts
        self.recent_trades = []           # list of dicts
        self.next_setup    = ""           # short string
        self.scan_count    = 0
        self.last_scan_sec = 0.0
        self.start_time    = time.time()
        self.console_lines = []           # captured stdout lines
        self.max_console   = 2000
        self.connected     = False
        self.connect_msg   = "Connecting to MT5..."

    # ---- updates ----
    def update_account(self, acc):
        with self.lock:
            if acc is None:
                self.account = None
            else:
                self.account = {
                    "login":    getattr(acc, "login", "?"),
                    "server":   getattr(acc, "server", "?"),
                    "balance":  float(getattr(acc, "balance", 0)),
                    "equity":   float(getattr(acc, "equity", 0)),
                    "free":     float(getattr(acc, "margin_free", 0)),
                    "currency": getattr(acc, "currency", ""),
                }

    def update_positions(self, positions):
        with self.lock:
            new = []
            for p in (positions or []):
                new.append({
                    "ticket":  p.ticket,
                    "symbol":  p.symbol,
                    "type":    p.type,
                    "volume":  p.volume,
                    "entry":   p.price_open,
                    "current": p.price_current,
                    "sl":      p.sl,
                    "tp":      p.tp,
                    "profit":  p.profit,
                })
            self.positions = new

    def update_approaching(self, lst):
        with self.lock:
            self.approaching = list(lst)

    def add_recent_trade(self, t):
        with self.lock:
            self.recent_trades.append(t)
            if len(self.recent_trades) > 50:
                self.recent_trades = self.recent_trades[-50:]

    def add_console(self, line):
        line = _ANSI.sub("", str(line))
        with self.lock:
            self.console_lines.append(line)
            if len(self.console_lines) > self.max_console:
                self.console_lines = self.console_lines[-self.max_console:]

    def set_connected(self, ok, msg=""):
        with self.lock:
            self.connected = ok
            self.connect_msg = msg

    def snapshot(self):
        with self.lock:
            return {
                "account":       self.account,
                "positions":     list(self.positions),
                "approaching":   list(self.approaching),
                "recent_trades": list(self.recent_trades),
                "next_setup":    self.next_setup,
                "scan_count":    self.scan_count,
                "last_scan_sec": self.last_scan_sec,
                "uptime":        time.time() - self.start_time,
                "console_lines": list(self.console_lines),
                "connected":     self.connected,
                "connect_msg":   self.connect_msg,
            }


# Global state instance (imported by triangle_scanner.py)
STATE = BotState()


# ====================================================================
#  STDOUT TEE  (captures all print() into the GUI Console Log tab)
# ====================================================================
class StdoutTee:
    def __init__(self, original, state):
        self.original = original
        self.state    = state
        self._buf     = ""

    def write(self, s):
        try:
            self.original.write(s)
        except Exception:
            pass
        self._buf += s
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self.state.add_console(line)

    def flush(self):
        try:
            self.original.flush()
        except Exception:
            pass

    def __getattr__(self, name):
        return getattr(self.original, name)


# ====================================================================
#  HELPERS
# ====================================================================
def is_killzone():
    """True during London (07-10 UTC) or New York (12-15 UTC) sessions."""
    h = datetime.now(timezone.utc).hour
    return 7 <= h <= 10 or 12 <= h <= 15


def fmt_uptime(secs):
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    if h: return f"{h}h {m:02d}m"
    if m: return f"{m}m {s:02d}s"
    return f"{s}s"


def build_next_setup_text(approaching, positions):
    """Pick the most relevant 'next setup' line for the header."""
    if not approaching:
        if positions:
            return f"managing {len(positions)} open position(s)..."
        return "waiting for triangles to mature..."
    a = sorted(approaching, key=lambda x: x.get("distance_pct", 999))[0]
    return (f"{a['symbol']} {a['hint'].split()[0]}  ({a['tf']} {a['pattern']})  "
            f"-> {a['distance_pct']:.2f}% away from breakout")


# ====================================================================
#  DASHBOARD WINDOW
# ====================================================================
class Dashboard:
    def __init__(self, journal_file="trade_journal.csv", on_close=None):
        self.journal_file = journal_file
        self.on_close     = on_close
        self.root = tk.Tk()
        self.root.title("Triangle Bot - Live Dashboard  |  made by @codex_here")
        self.root.geometry("1280x720")
        self.root.minsize(1080, 600)
        self.root.configure(bg=BG_DARK)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._setup_styles()
        self._build_ui()

        self._last_console_count = 0
        self._last_closed_update = 0
        self._schedule_update()

    # ----------------------------------------------------------------
    def _setup_styles(self):
        st = ttk.Style()
        try:
            st.theme_use("clam")
        except Exception:
            pass
        st.configure(".", background=BG_DARK, foreground=FG_LIGHT,
                     fieldbackground=BG_PANEL, borderwidth=0)
        st.configure("TNotebook", background=BG_DARK, borderwidth=0)
        st.configure("TNotebook.Tab", background=BG_PANEL, foreground=FG_LIGHT,
                     padding=[16, 8], borderwidth=0, font=("Segoe UI", 10))
        st.map("TNotebook.Tab",
               background=[("selected", BG_HEADER)],
               foreground=[("selected", ACCENT)])
        st.configure("Treeview",
                     background=BG_PANEL, fieldbackground=BG_PANEL,
                     foreground=FG_LIGHT, rowheight=26, borderwidth=0,
                     font=("Consolas", 9))
        st.configure("Treeview.Heading",
                     background=BG_HEADER, foreground=ACCENT,
                     font=("Segoe UI", 9, "bold"), borderwidth=1, relief="flat")
        st.map("Treeview",
               background=[("selected", "#1e3a8a")],
               foreground=[("selected", FG_LIGHT)])

    # ----------------------------------------------------------------
    def _build_ui(self):
        # ---------- Top header bar ----------
        header = tk.Frame(self.root, bg=BG_DARK)
        header.pack(fill="x", padx=12, pady=(10, 2))

        self.lbl_account = tk.Label(
            header, text="Connecting to MT5...",
            bg=BG_DARK, fg=ACCENT, anchor="w",
            font=("Segoe UI", 11, "bold"))
        self.lbl_account.pack(side="left")

        self.lbl_pnl = tk.Label(
            header, text="WinRate 0.0%  (0W / 0L)  |  Total P&L: +0.00",
            bg=BG_DARK, fg=GREEN,
            font=("Segoe UI", 10, "bold"))
        self.lbl_pnl.pack(side="left", padx=20)

        self.lbl_time = tk.Label(
            header, text="UTC --:--    Killzone: no",
            bg=BG_DARK, fg=ORANGE, anchor="e",
            font=("Segoe UI", 10, "bold"))
        self.lbl_time.pack(side="right")

        # ---------- NEXT SETUP line ----------
        ns = tk.Frame(self.root, bg=BG_DARK)
        ns.pack(fill="x", padx=12, pady=(0, 6))
        tk.Label(ns, text="NEXT SETUP:", bg=BG_DARK, fg=ORANGE,
                 font=("Segoe UI", 10, "bold")).pack(side="left", padx=(0, 8))
        self.lbl_next_setup = tk.Label(
            ns, text="initializing...",
            bg=BG_DARK, fg=FG_LIGHT, anchor="w",
            font=("Segoe UI", 10))
        self.lbl_next_setup.pack(side="left", fill="x", expand=True)

        # ---------- Tabs ----------
        nb = ttk.Notebook(self.root)
        nb.pack(fill="both", expand=True, padx=10, pady=4)

        # Active Trades
        tab1 = tk.Frame(nb, bg=BG_DARK); nb.add(tab1, text="Active Trades")
        self._build_active_tab(tab1)
        # Setup Scanner
        tab2 = tk.Frame(nb, bg=BG_DARK); nb.add(tab2, text="Setup Scanner")
        self._build_scanner_tab(tab2)
        # Closed Trades
        tab3 = tk.Frame(nb, bg=BG_DARK); nb.add(tab3, text="Closed Trades")
        self._build_closed_tab(tab3)
        # Chart View
        tab4 = tk.Frame(nb, bg=BG_DARK); nb.add(tab4, text="Chart View")
        self._build_chart_tab(tab4)
        # Console Log
        tab5 = tk.Frame(nb, bg=BG_DARK); nb.add(tab5, text="Console Log")
        self._build_console_tab(tab5)

        # ---------- Status bar ----------
        sb = tk.Frame(self.root, bg=BG_DARK)
        sb.pack(fill="x", padx=12, pady=(2, 8))
        self.lbl_status = tk.Label(sb, text="status: starting...",
                                   bg=BG_DARK, fg=FG_DIM,
                                   font=("Segoe UI", 9), anchor="w")
        self.lbl_status.pack(side="left")
        self.lbl_session = tk.Label(sb, text="",
                                    bg=BG_DARK, fg=FG_DIM,
                                    font=("Segoe UI", 9), anchor="e")
        self.lbl_session.pack(side="right")

    # ----------------------------------------------------------------
    def _make_tree(self, parent, cols, widths, labels=None):
        labels = labels or [c.upper() for c in cols]
        frame = tk.Frame(parent, bg=BG_DARK)
        frame.pack(fill="both", expand=True, padx=4, pady=4)
        sb = ttk.Scrollbar(frame, orient="vertical")
        sb.pack(side="right", fill="y")
        tv = ttk.Treeview(frame, columns=cols, show="headings",
                          yscrollcommand=sb.set)
        for c, w, lbl in zip(cols, widths, labels):
            tv.heading(c, text=lbl)
            tv.column(c, width=w, anchor="center", stretch=False)
        tv.tag_configure("buy",     foreground=GREEN)
        tv.tag_configure("sell",    foreground=RED)
        tv.tag_configure("win",     foreground=GREEN)
        tv.tag_configure("loss",    foreground=RED)
        tv.tag_configure("neutral", foreground=FG_LIGHT)
        tv.pack(fill="both", expand=True)
        sb.config(command=tv.yview)
        return tv

    def _build_active_tab(self, parent):
        cols = ("ticket","symbol","side","lot","entry","sl","tp",
                "rr_init","current","r_now","pnl","stage")
        widths = [80, 90, 60, 60, 100, 100, 100, 80, 100, 80, 90, 100]
        self.tv_active = self._make_tree(parent, cols, widths)

    def _build_scanner_tab(self, parent):
        cols   = ("symbol","tf","pattern","R","S","distance","hint")
        widths = [100, 60, 130, 110, 110, 90, 130]
        labels = ["PAIR","TF","PATTERN","RESISTANCE","SUPPORT","DIST","HINT"]
        self.tv_scan = self._make_tree(parent, cols, widths, labels)

    def _build_closed_tab(self, parent):
        cols = ("date","time","symbol","tf","dir","entry","sl","tp",
                "rr","pattern","pnl","status")
        widths = [85, 70, 90, 50, 50, 90, 90, 90, 60, 110, 80, 80]
        self.tv_closed = self._make_tree(parent, cols, widths)

    def _build_chart_tab(self, parent):
        msg = ("CHART VIEW\n\n"
               "Live OHLC chart is not embedded yet.\n"
               "For full charting use the MT5 terminal next to this window.\n\n"
               "(Optional: install matplotlib for embedded charts)")
        tk.Label(parent, text=msg, bg=BG_DARK, fg=FG_DIM,
                 font=("Segoe UI", 12), justify="center"
                 ).pack(expand=True)

    def _build_console_tab(self, parent):
        sb = tk.Scrollbar(parent)
        sb.pack(side="right", fill="y")
        self.console_txt = tk.Text(
            parent, bg="#000000", fg="#cccccc",
            font=("Consolas", 9), relief="flat",
            yscrollcommand=sb.set, wrap="none", insertbackground=FG_LIGHT)
        self.console_txt.pack(fill="both", expand=True, padx=2, pady=2)
        sb.config(command=self.console_txt.yview)

    # ----------------------------------------------------------------
    def _schedule_update(self):
        try:
            self._update_ui()
        except Exception as e:
            # Don't let GUI update errors kill the loop
            try:
                self.lbl_status.config(text=f"GUI update error: {e}", fg=RED)
            except Exception:
                pass
        self.root.after(1500, self._schedule_update)

    def _update_ui(self):
        snap = STATE.snapshot()

        # ---- Header: account ----
        acc = snap["account"]
        if acc:
            self.lbl_account.config(
                text=f"Acc {acc['login']}  |  {acc['server']}  |  "
                     f"Bal: {acc['balance']:.2f}  |  Eq: {acc['equity']:.2f} {acc['currency']}",
                fg=ACCENT)
        else:
            self.lbl_account.config(text=snap["connect_msg"], fg=ORANGE)

        # ---- Header: P&L (today, from journal) ----
        wins, losses, realized = self._read_journal_today()
        unreal = sum(p["profit"] for p in snap["positions"])
        total = realized + unreal
        n = wins + losses
        wr = (wins / n * 100) if n else 0.0
        col = GREEN if total >= 0 else RED
        self.lbl_pnl.config(
            text=f"WinRate {wr:.1f}%  ({wins}W / {losses}L)  |  "
                 f"Total P&L: {total:+.2f}  (Open: {unreal:+.2f})",
            fg=col)

        # ---- Header: time / killzone ----
        utc_h = datetime.now(timezone.utc).strftime("%H:%M")
        kz = is_killzone()
        self.lbl_time.config(
            text=f"UTC {utc_h}    Killzone: {'YES' if kz else 'no'}",
            fg=GREEN if kz else ORANGE)

        # ---- NEXT SETUP ----
        ns_text = build_next_setup_text(snap["approaching"], snap["positions"])
        self.lbl_next_setup.config(text=ns_text)

        # ---- Active trades ----
        self._update_active(snap["positions"])
        # ---- Scanner ----
        self._update_scanner(snap["approaching"])
        # ---- Closed trades (every 5s) ----
        if time.time() - self._last_closed_update > 5:
            self._update_closed()
            self._last_closed_update = time.time()
        # ---- Console ----
        self._update_console(snap["console_lines"])

        # ---- Status bar ----
        self.lbl_status.config(
            text=f"status: scan #{snap['scan_count']}  -  "
                 f"last {snap['last_scan_sec']:.2f}s  -  "
                 f"connected={snap['connected']}",
            fg=GREEN if snap["connected"] else ORANGE)
        self.lbl_session.config(
            text=f"uptime: {fmt_uptime(snap['uptime'])}  |  "
                 f"open positions: {len(snap['positions'])}  |  "
                 f"approaching: {len(snap['approaching'])}")

    # ----------------------------------------------------------------
    def _update_active(self, positions):
        self.tv_active.delete(*self.tv_active.get_children())
        for p in positions:
            side = "BUY" if p["type"] == 0 else "SELL"
            risk = abs(p["entry"] - p["sl"]) if p["sl"] else 0
            move = (p["current"] - p["entry"]) if p["type"] == 0 else (p["entry"] - p["current"])
            r_now = (move / risk) if risk > 0 else 0
            rr_init = (abs(p["tp"] - p["entry"]) / risk) if (risk > 0 and p["tp"]) else 0
            stage = ("WIN-RUN" if r_now >= 1 else
                     "BREAK-EVEN" if 0 <= r_now < 1 else
                     "AT RISK")
            tag = "buy" if side == "BUY" else "sell"
            self.tv_active.insert("", "end", values=(
                p["ticket"], p["symbol"], side, f"{p['volume']:.2f}",
                f"{p['entry']:.5f}", f"{p['sl']:.5f}", f"{p['tp']:.5f}",
                f"1:{rr_init:.2f}", f"{p['current']:.5f}",
                f"{r_now:+.2f}R", f"{p['profit']:+.2f}", stage,
            ), tags=(tag,))

    def _update_scanner(self, approaching):
        self.tv_scan.delete(*self.tv_scan.get_children())
        for a in sorted(approaching, key=lambda x: x.get("distance_pct", 999)):
            tag = "buy" if a.get("hint") == "BUY breakout" else "sell"
            self.tv_scan.insert("", "end", values=(
                a["symbol"], a["tf"], a["pattern"],
                f"{a['R']:.5f}", f"{a['S']:.5f}",
                f"{a['distance_pct']:.2f}%", a.get("hint", ""),
            ), tags=(tag,))

    def _read_journal_today(self):
        if not os.path.exists(self.journal_file):
            return 0, 0, 0.0
        today = datetime.now().strftime("%Y-%m-%d")
        wins = losses = 0
        pnl = 0.0
        try:
            with open(self.journal_file, newline="") as f:
                for row in csv.DictReader(f):
                    if row.get("Date") != today:
                        continue
                    try:
                        p = float(row.get("Profit_Loss", 0) or 0)
                    except Exception:
                        p = 0
                    pnl += p
                    if p > 0:    wins += 1
                    elif p < 0:  losses += 1
        except Exception:
            pass
        return wins, losses, pnl

    def _update_closed(self):
        if not os.path.exists(self.journal_file):
            return
        self.tv_closed.delete(*self.tv_closed.get_children())
        try:
            with open(self.journal_file, newline="") as f:
                rows = list(csv.DictReader(f))
            for row in rows[-200:][::-1]:  # newest first, last 200
                try:
                    pnl = float(row.get("Profit_Loss", 0) or 0)
                except Exception:
                    pnl = 0
                tag = "win" if pnl > 0 else "loss" if pnl < 0 else "neutral"
                self.tv_closed.insert("", "end", values=(
                    row.get("Date", ""), row.get("Time", ""),
                    row.get("Symbol", ""), row.get("Timeframe", ""),
                    row.get("Direction", ""),
                    row.get("Entry", ""), row.get("SL", ""), row.get("TP", ""),
                    row.get("Est_RR", ""), row.get("Pattern_Type", ""),
                    row.get("Profit_Loss", ""), row.get("Status", ""),
                ), tags=(tag,))
        except Exception:
            pass

    def _update_console(self, lines):
        new_lines = lines[self._last_console_count:]
        if not new_lines:
            return
        try:
            self.console_txt.insert("end", "\n".join(new_lines) + "\n")
            self.console_txt.see("end")
        except Exception:
            pass
        self._last_console_count = len(lines)

    # ----------------------------------------------------------------
    def _on_close(self):
        try:
            if self.on_close:
                self.on_close()
        finally:
            try:
                self.root.destroy()
            except Exception:
                pass

    def run(self):
        self.root.mainloop()


# ====================================================================
#  Convenience launcher
# ====================================================================
def start_dashboard(journal_file="trade_journal.csv", on_close=None):
    """Create and return the Dashboard. Call .run() to enter the GUI loop."""
    return Dashboard(journal_file=journal_file, on_close=on_close)
