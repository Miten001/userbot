"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Pair = {
  symbol: string;
  flagA: string;
  flagB: string;
  base: number;
  spread: number;
  decimals: number;
  isCrypto?: boolean;
  isMetal?: boolean;
};

const PAIRS: Pair[] = [
  { symbol: "EUR/USD", flagA: "🇪🇺", flagB: "🇺🇸", base: 1.0842, spread: 0.0009, decimals: 4 },
  { symbol: "GBP/USD", flagA: "🇬🇧", flagB: "🇺🇸", base: 1.2718, spread: 0.0011, decimals: 4 },
  { symbol: "USD/JPY", flagA: "🇺🇸", flagB: "🇯🇵", base: 152.34, spread: 0.12, decimals: 2 },
  { symbol: "XAU/USD", flagA: "🥇", flagB: "🇺🇸", base: 2384.5, spread: 1.8, decimals: 2, isMetal: true },
  { symbol: "BTC/USD", flagA: "₿", flagB: "🇺🇸", base: 67_420, spread: 35, decimals: 0, isCrypto: true },
  { symbol: "AUD/USD", flagA: "🇦🇺", flagB: "🇺🇸", base: 0.6612, spread: 0.0008, decimals: 4 },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function formatPrice(p: number, decimals: number) {
  return p.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function generateSpark(seed: number) {
  // 14 points, oscillating
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < 14; i++) {
    v += (Math.sin(seed + i * 0.6) + Math.cos(seed * 1.3 + i * 0.4)) * 0.06;
    v = Math.max(0.1, Math.min(0.9, v));
    out.push(v);
  }
  return out;
}

export default function PairsShowcase() {
  const [ticks, setTicks] = useState(() =>
    PAIRS.map((p) => ({
      price: p.base,
      change: rand(-0.8, 0.8),
      spark: generateSpark(p.base),
    })),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) =>
        prev.map((t, i) => {
          const p = PAIRS[i];
          const drift = rand(-p.spread, p.spread);
          const newPrice = +(t.price + drift).toFixed(p.decimals);
          const change = +(t.change + rand(-0.06, 0.06)).toFixed(2);
          const next = [...t.spark.slice(1), Math.max(0.1, Math.min(0.9, t.spark[t.spark.length - 1] + rand(-0.12, 0.12)))];
          return { price: newPrice, change, spark: next };
        }),
      );
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden p-4 sm:p-5">
      {/* subtle grid backdrop */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 80%)",
        }}
      />

      {/* Header bar */}
      <div className="relative z-10 mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-bg-deep/60 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald2-400/70" />
            <span className="relative h-2 w-2 rounded-full bg-emerald2-400" />
          </span>
          <span className="font-semibold text-emerald2-400">LIVE MARKET</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">
          Real-time feed
        </div>
      </div>

      {/* Pairs grid */}
      <div className="relative z-10 grid h-[calc(100%-3rem)] grid-cols-2 gap-2.5 sm:gap-3">
        {PAIRS.map((p, i) => (
          <PairCard key={p.symbol} pair={p} tick={ticks[i]} index={i} />
        ))}
      </div>
    </div>
  );
}

function PairCard({
  pair,
  tick,
  index,
}: {
  pair: Pair;
  tick: { price: number; change: number; spark: number[] };
  index: number;
}) {
  const up = tick.change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -3, scale: 1.02 }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-3 backdrop-blur-xl transition-colors ${
        up
          ? "border-emerald2/25 from-emerald2/[0.08] to-transparent hover:border-emerald2/50"
          : "border-rose2/25 from-rose2/[0.08] to-transparent hover:border-rose2/50"
      }`}
    >
      {/* glow accent */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl transition-opacity ${
          up ? "bg-emerald2/40" : "bg-rose2/40"
        } opacity-40 group-hover:opacity-80`}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 text-base sm:text-lg">
            <span>{pair.flagA}</span>
            <span className="text-slate-500">/</span>
            <span>{pair.flagB}</span>
          </div>
          <div className="mt-0.5 font-display text-[11px] font-bold tracking-wider text-slate-300 sm:text-xs">
            {pair.symbol}
          </div>
        </div>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
            up
              ? "border-emerald2/30 bg-emerald2/10 text-emerald2-400"
              : "border-rose2/30 bg-rose2/10 text-rose2-400"
          }`}
        >
          {up ? "▲" : "▼"} {Math.abs(tick.change).toFixed(2)}%
        </span>
      </div>

      <div className="relative mt-2">
        <div
          className={`font-display text-base font-bold tabular-nums sm:text-lg ${
            up ? "text-emerald2-400" : "text-rose2-400"
          }`}
        >
          {pair.isCrypto ? "$" : ""}
          {formatPrice(tick.price, pair.decimals)}
        </div>
        <Sparkline points={tick.spark} up={up} />
      </div>
    </motion.div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const w = 100;
  const h = 22;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - p * h}`)
    .join(" ");
  const areaPath = `${path} L ${w} ${h} L 0 ${h} Z`;
  const stroke = up ? "#10b981" : "#f43f5e";
  const fill = up
    ? "url(#sparkUp)"
    : "url(#sparkDown)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1.5 h-5 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkUp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sparkDown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={fill} />
      <path d={path} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
