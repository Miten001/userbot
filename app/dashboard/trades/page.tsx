"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, ArrowUpRight, ArrowDownRight, Info, TrendingUp,
} from "lucide-react";
import {
  Trade, DEMO_TRADES, fmtDate,
} from "@/app/dashboard/data";

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/trades", { cache: "no-store" });
        if (!r.ok) throw new Error("not configured");
        const data = await r.json();
        setTrades(data.trades ?? []);
        setDemo(false);
      } catch {
        setTrades(DEMO_TRADES);
        setDemo(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const closed = trades.filter((t) => t.profit_usd !== null);
  const totalPnl = closed.reduce((s, t) => s + (t.profit_usd ?? 0), 0);
  const wins = closed.filter((t) => (t.profit_usd ?? 0) > 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Trade <span className="gradient-text">History</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">View all your closed positions and performance metrics</p>
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode.</strong> Showing simulated trade data.
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
        ) : trades.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-12 text-center backdrop-blur-xl">
            <BarChart3 className="mx-auto h-10 w-10 text-gold" />
            <h3 className="font-display mt-4 text-2xl font-bold">No trades yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              They&apos;ll appear here automatically as your MT5 account syncs.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="mb-6 grid grid-cols-3 gap-4">
              <MiniStat label="Net P/L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={totalPnl >= 0 ? "good" : "bad"} />
              <MiniStat label="Win rate" value={`${winRate}%`} />
              <MiniStat label="Closed trades" value={closed.length} />
            </div>

            {/* Equity Curve */}
            <EquityCurve trades={closed} />

            {/* Trade table */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <h2 className="font-display text-xl font-bold text-white">All Trades</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{trades.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-semibold">Symbol</th>
                      <th className="px-3 py-2 font-semibold">Side</th>
                      <th className="px-3 py-2 font-semibold">Vol</th>
                      <th className="px-3 py-2 font-semibold">Open</th>
                      <th className="px-3 py-2 font-semibold">Close</th>
                      <th className="px-3 py-2 font-semibold">P/L</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => {
                      const pnl = t.profit_usd ?? 0;
                      const up = pnl >= 0;
                      const buy = t.side?.toLowerCase() === "buy";
                      return (
                        <tr key={t.id} className="border-t border-white/5">
                          <td className="px-3 py-3 font-display font-bold text-white">{t.symbol}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${buy ? "border-emerald2/30 bg-emerald2/10 text-emerald2-400" : "border-rose2/30 bg-rose2/10 text-rose2-400"}`}>
                              {buy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {t.side}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-300">{t.volume}</td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-400">{t.open_price ?? "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-400">{t.close_price ?? "-"}</td>
                          <td className={`px-3 py-3 font-semibold tabular-nums ${up ? "text-emerald2-400" : "text-rose2-400"}`}>
                            {t.profit_usd === null ? "-" : `${up ? "+" : ""}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-slate-500">{t.opened_at ? fmtDate(t.opened_at) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Equity Curve ---- */

function EquityCurve({ trades }: { trades: Trade[] }) {
  // Build cumulative equity points from trades sorted by close date
  const sorted = [...trades]
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  if (sorted.length < 2) return null;

  const startingEquity = 100_000;
  const points: number[] = [startingEquity];
  let equity = startingEquity;
  for (const t of sorted) {
    equity += t.profit_usd ?? 0;
    points.push(equity);
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 400;
  const height = 120;
  const padding = 8;

  const pathPoints = points.map((val, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePath = `M ${pathPoints.join(" L ")}`;
  const areaPath = `${linePath} L ${padding + (width - padding * 2)},${height - padding} L ${padding},${height - padding} Z`;

  const finalEquity = points[points.length - 1];
  const isUp = finalEquity >= startingEquity;

  return (
    <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gold" />
        <h2 className="font-display text-lg font-bold text-white">Equity Curve</h2>
        <span className={`ml-auto font-display text-lg font-bold tabular-nums ${isUp ? "text-emerald2-400" : "text-rose2-400"}`}>
          ${finalEquity.toLocaleString()}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isUp ? "#34d399" : "#fb7185"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? "#34d399" : "#fb7185"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#eq-grad)" />
        <path d={linePath} fill="none" stroke={isUp ? "#34d399" : "#fb7185"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ---- MiniStat ---- */

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
