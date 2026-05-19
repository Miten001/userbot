"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live market feed for the hero panel.
 *
 * Architecture:
 *   1. Mount → fetch /api/prices once for real opening data.
 *   2. Re-fetch every 30 s (matches the API's edge cache).
 *   3. Between fetches, apply tiny client-side micro-ticks every 1.5 s so the
 *      cards feel alive (purely cosmetic — sparkline only).
 *
 * Layout is a flat 2D grid (2 columns × 3 rows) — no 3D/floating effects.
 */

type Pair = {
  symbol: string;        // "BTC/USD"
  flagA: string;
  flagB: string;
  category: "crypto" | "metal" | "forex";
  decimals: number;
  price: number;
  change_pct: number;
};

const FALLBACK: Pair[] = [
  { symbol: "BTC/USD", flagA: "₿",  flagB: "🇺🇸", category: "crypto", decimals: 0, price: 67_420,    change_pct:  1.42 },
  { symbol: "ETH/USD", flagA: "Ξ",  flagB: "🇺🇸", category: "crypto", decimals: 2, price:  3_184.50, change_pct:  0.78 },
  { symbol: "XAU/USD", flagA: "🥇", flagB: "🇺🇸", category: "metal",  decimals: 2, price:  2_384.5,  change_pct:  0.31 },
  { symbol: "XAG/USD", flagA: "🥈", flagB: "🇺🇸", category: "metal",  decimals: 2, price:     27.84, change_pct: -0.52 },
  { symbol: "EUR/USD", flagA: "🇪🇺", flagB: "🇺🇸", category: "forex",  decimals: 4, price:      1.0842, change_pct:  0.18 },
  { symbol: "USD/JPY", flagA: "🇺🇸", flagB: "🇯🇵", category: "forex",  decimals: 2, price:    152.34, change_pct: -0.24 },
];

function formatPrice(p: number, decimals: number, isCrypto = false) {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };
  return (isCrypto && decimals === 0 ? "$" : "") + p.toLocaleString("en-US", opts);
}

function generateSpark(seed: number) {
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
  const [pairs, setPairs] = useState<Pair[]>(FALLBACK);
  const [source, setSource] = useState<"loading" | "yahoo" | "fallback">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const [sparks, setSparks] = useState<number[][]>(() =>
    FALLBACK.map((p) => generateSpark(p.price)),
  );

  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashes, setFlashes] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    let cancelled = false;
    let fetchTimer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const r = await fetch("/api/prices", { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as {
          source: "yahoo" | "fallback";
          at: string;
          quotes: Pair[];
        };
        if (cancelled || !data.quotes?.length) return;

        const newFlashes: Record<string, "up" | "down" | null> = {};
        for (const q of data.quotes) {
          const prev = prevPricesRef.current[q.symbol];
          if (prev != null && q.price !== prev) {
            newFlashes[q.symbol] = q.price > prev ? "up" : "down";
          }
          prevPricesRef.current[q.symbol] = q.price;
        }

        setPairs(data.quotes);
        setSource(data.source);
        setUpdatedAt(Date.parse(data.at));
        setFlashes(newFlashes);

        setTimeout(() => setFlashes({}), 800);
      } catch {
        // keep showing whatever we had
      }
    }

    load();
    fetchTimer = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      if (fetchTimer) clearInterval(fetchTimer);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSparks((prev) =>
        prev.map((arr) => {
          const last = arr[arr.length - 1];
          const next = Math.max(0.1, Math.min(0.9, last + (Math.random() - 0.5) * 0.18));
          return [...arr.slice(1), next];
        }),
      );
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const updatedAgo = updatedAt
    ? `${Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))}s ago`
    : "—";

  return (
    <div className="relative h-full w-full overflow-hidden p-3 sm:p-4">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,191,36,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 80%)",
        }}
      />

      <div className="relative z-10 mb-2.5 flex items-center justify-between rounded-xl border border-white/10 bg-bg-deep/70 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inset-0 rounded-full ${
                source === "yahoo"
                  ? "animate-ping bg-emerald2-400/70"
                  : source === "fallback"
                    ? "animate-ping bg-gold/70"
                    : "bg-slate-500"
              }`}
            />
            <span
              className={`relative h-2 w-2 rounded-full ${
                source === "yahoo"
                  ? "bg-emerald2-400"
                  : source === "fallback"
                    ? "bg-gold"
                    : "bg-slate-500"
              }`}
            />
          </span>
          <span className="font-bold tracking-wider text-emerald2-400">
            LIVE MARKET
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-widest text-slate-500">
          {source === "yahoo" ? "yahoo finance" : source === "fallback" ? "live api" : "loading…"}
          <span className="mx-1.5 text-slate-700">·</span>
          {updatedAgo}
        </div>
      </div>

      <div className="relative z-10 grid h-[calc(100%-2.75rem)] grid-cols-2 gap-2">
        {pairs.map((p, i) => (
          <PairCard
            key={p.symbol}
            pair={p}
            spark={sparks[i] ?? generateSpark(p.price)}
            flash={flashes[p.symbol] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function PairCard({
  pair,
  spark,
  flash,
}: {
  pair: Pair;
  spark: number[];
  flash: "up" | "down" | null;
}) {
  const up = pair.change_pct >= 0;
  const isCrypto = pair.category === "crypto";

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-bg-deep/40 p-3 transition-colors duration-300 ${
        flash === "up"
          ? "border-emerald2/60 bg-emerald2/[0.08]"
          : flash === "down"
            ? "border-rose2/60 bg-rose2/[0.08]"
            : up
              ? "border-emerald2/15 hover:border-emerald2/35"
              : "border-rose2/15 hover:border-rose2/35"
      }`}
    >
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{pair.flagA}</span>
          <span className="text-slate-600">/</span>
          <span className="text-base leading-none">{pair.flagB}</span>
          <span className="ml-1 font-display text-[11px] font-bold tracking-wider text-slate-200">
            {pair.symbol}
          </span>
        </div>

        <span
          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
            up ? "bg-emerald2/15 text-emerald2-400" : "bg-rose2/15 text-rose2-400"
          }`}
        >
          {up ? "▲" : "▼"} {Math.abs(pair.change_pct).toFixed(2)}%
        </span>
      </div>

      <div className="relative mt-1 flex items-end justify-between gap-2">
        <div
          className={`font-display text-base font-bold tabular-nums leading-none transition-colors sm:text-lg ${
            up ? "text-emerald2-400" : "text-rose2-400"
          }`}
        >
          {formatPrice(pair.price, pair.decimals, isCrypto)}
        </div>
        <Sparkline points={spark} up={up} />
      </div>
    </div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const w = 56;
  const h = 18;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - p * h}`)
    .join(" ");
  const stroke = up ? "#10b981" : "#f43f5e";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-4 w-14 flex-shrink-0 opacity-80"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        stroke={stroke}
        strokeWidth={1.4}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
