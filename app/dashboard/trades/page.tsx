"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, ArrowUpRight, ArrowDownRight, Info,
} from "lucide-react";
import {
  Trade, DEMO_TRADES, fmtDate,
} from "@/app/dashboard/data";
import PageTransition from "@/app/components/PageTransition";
import { SkeletonStats, SkeletonTable } from "@/app/components/SkeletonCard";
import EquityCurve from "@/app/components/EquityCurve";
import PnLChart from "@/app/components/PnLChart";

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
  const equityData = useMemo(() => buildEquityData(closed), [closed]);
  const pnlData = useMemo(() => buildPnLData(closed), [closed]);

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
          <div className="space-y-6">
            <SkeletonStats />
            <SkeletonTable />
          </div>
        ) : trades.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-12 text-center backdrop-blur-xl">
            <BarChart3 className="mx-auto h-10 w-10 text-gold" />
            <h3 className="font-display mt-4 text-2xl font-bold">No trades yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              They&apos;ll appear here automatically as your MT5 account syncs.
            </p>
          </div>
        ) : (
          <PageTransition>
            {/* Stats row */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MiniStat label="Net P/L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={totalPnl >= 0 ? "good" : "bad"} />
              <MiniStat label="Win rate" value={`${winRate}%`} />
              <MiniStat label="Closed trades" value={closed.length} />
            </div>

            {/* Equity Curve */}
            <EquityCurve data={equityData} height={200} title="Equity Curve" />

            {/* P/L Chart */}
            <div className="mt-6">
              <PnLChart data={pnlData} height={180} />
            </div>

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
          </PageTransition>
        )}
      </div>
    </div>
  );
}

/* ---- Data helpers for charts ---- */

function buildEquityData(trades: Trade[]) {
  const sorted = [...trades]
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  if (sorted.length < 2) {
    // Generate demo data if not enough trades
    return generateDemoEquityData();
  }

  const startingEquity = 100_000;
  let equity = startingEquity;
  const data: { date: string; value: number }[] = [
    { date: sorted[0].closed_at!.split("T")[0], value: startingEquity },
  ];
  for (const t of sorted) {
    equity += t.profit_usd ?? 0;
    data.push({
      date: t.closed_at!.split("T")[0],
      value: Math.round(equity),
    });
  }
  return data;
}

function buildPnLData(trades: Trade[]) {
  const sorted = [...trades]
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  if (sorted.length < 2) {
    return generateDemoPnLData();
  }

  // Group by day
  const byDay: Record<string, number> = {};
  for (const t of sorted) {
    const day = t.closed_at!.split("T")[0];
    byDay[day] = (byDay[day] ?? 0) + (t.profit_usd ?? 0);
  }

  return Object.entries(byDay).map(([date, value]) => ({
    date,
    value: Math.round(value),
  }));
}

function generateDemoEquityData() {
  const data: { date: string; value: number }[] = [];
  let equity = 50000;
  let seed = 42;
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    seed = (seed * 16807 + 0) % 2147483647;
    const random = (seed & 0x7fffffff) / 0x7fffffff;
    const change = (random - 0.4) * 1000;
    equity += change;
    data.push({
      date: d.toISOString().split("T")[0],
      value: Math.round(equity),
    });
  }
  return data;
}

function generateDemoPnLData() {
  const data: { date: string; value: number }[] = [];
  let seed = 123;
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    seed = (seed * 16807 + 0) % 2147483647;
    const random = (seed & 0x7fffffff) / 0x7fffffff;
    const value = Math.round((random - 0.45) * 1200);
    data.push({
      date: d.toISOString().split("T")[0],
      value,
    });
  }
  return data;
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
