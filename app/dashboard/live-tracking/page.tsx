"use client";

import { useState, useEffect, useId } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Zap } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type Position = {
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
};

const initialPositions: Position[] = [
  { symbol: "EUR/USD", side: "BUY", volume: 1.5, entryPrice: 1.0842, currentPrice: 1.0861, pnl: 285 },
  { symbol: "GBP/USD", side: "SELL", volume: 0.8, entryPrice: 1.2654, currentPrice: 1.2638, pnl: 128 },
  { symbol: "XAU/USD", side: "BUY", volume: 0.5, entryPrice: 2024.5, currentPrice: 2031.2, pnl: 335 },
  { symbol: "USD/JPY", side: "SELL", volume: 1.0, entryPrice: 148.52, currentPrice: 148.71, pnl: -128 },
];

const initialEquityHistory = [
  50000, 50120, 50280, 50190, 50420, 50380, 50540, 50620, 50580, 50710,
  50680, 50820, 50900, 50850, 50980, 51050, 51020, 51180, 51250, 51200,
];

function LiveEquityChart({ data }: { data: number[] }) {
  const id = useId();
  const width = 500;
  const height = 140;
  const padding = 8;
  const min = Math.min(...data) - 100;
  const max = Math.max(...data) + 100;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`live-eq-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill={`url(#live-eq-${id})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Live dot */}
      {data.length > 0 && (
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r="4"
          fill="#fbbf24"
          className="animate-pulse"
        />
      )}
    </svg>
  );
}

export default function LiveTrackingPage() {
  const [equity, setEquity] = useState(51200);
  const [equityHistory, setEquityHistory] = useState(initialEquityHistory);
  const [positions, setPositions] = useState(initialPositions);
  const [dailyPnL, setDailyPnL] = useState(620);

  useEffect(() => {
    const interval = setInterval(() => {
      setEquity((prev) => {
        const change = (Math.random() - 0.45) * 80;
        const newEquity = Math.round((prev + change) * 100) / 100;
        setEquityHistory((hist) => [...hist.slice(-29), newEquity]);
        return newEquity;
      });

      setPositions((prev) =>
        prev.map((pos) => {
          const change = (Math.random() - 0.48) * 50;
          const newPnl = Math.round((pos.pnl + change) * 100) / 100;
          const priceChange = pos.side === "BUY"
            ? (Math.random() - 0.48) * 0.001
            : -(Math.random() - 0.48) * 0.001;
          return {
            ...pos,
            currentPrice: Math.round((pos.currentPrice + priceChange * pos.currentPrice) * 100000) / 100000,
            pnl: newPnl,
          };
        })
      );

      setDailyPnL((prev) => {
        const change = (Math.random() - 0.45) * 20;
        return Math.round((prev + change) * 100) / 100;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Live <span className="gradient-text">Tracking</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time account monitoring and P&L tracking
          </p>
        </div>

        <PageTransition>
          {/* Top stats */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gold" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Account Equity</span>
                <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-emerald2-400" />
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-white">
                ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald2-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Unrealized P&L</span>
              </div>
              <div className={`mt-2 font-display text-2xl font-bold ${totalUnrealizedPnL >= 0 ? "text-emerald2-400" : "text-rose2-400"}`}>
                {totalUnrealizedPnL >= 0 ? "+" : ""}${totalUnrealizedPnL.toFixed(2)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                {dailyPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald2-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose2-400" />
                )}
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Daily P&L</span>
              </div>
              <div className={`mt-2 font-display text-2xl font-bold ${dailyPnL >= 0 ? "text-emerald2-400" : "text-rose2-400"}`}>
                {dailyPnL >= 0 ? "+" : ""}${dailyPnL.toFixed(2)}
              </div>
            </motion.div>
          </div>

          {/* Live equity chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Live Equity</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
                Updating live
              </div>
            </div>
            <div className="h-40">
              <LiveEquityChart data={equityHistory} />
            </div>
          </motion.div>

          {/* Open positions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-gold" />
              <h3 className="font-display text-lg font-bold text-white">Open Positions</h3>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                {positions.length} active
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Symbol</th>
                    <th className="px-3 py-2 font-semibold">Side</th>
                    <th className="px-3 py-2 font-semibold">Volume</th>
                    <th className="px-3 py-2 font-semibold">Entry</th>
                    <th className="px-3 py-2 font-semibold">Current</th>
                    <th className="px-3 py-2 font-semibold">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.symbol} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-white">{pos.symbol}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          pos.side === "BUY"
                            ? "bg-emerald2-400/10 text-emerald2-400"
                            : "bg-rose2-400/10 text-rose2-400"
                        }`}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{pos.volume}</td>
                      <td className="px-3 py-3 text-slate-300">{pos.entryPrice}</td>
                      <td className="px-3 py-3 text-slate-300">{pos.currentPrice.toFixed(5)}</td>
                      <td className={`px-3 py-3 font-semibold ${pos.pnl >= 0 ? "text-emerald2-400" : "text-rose2-400"}`}>
                        {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </PageTransition>
      </div>
    </div>
  );
}
