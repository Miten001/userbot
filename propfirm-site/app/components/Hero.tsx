"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ChevronRight, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-gradient-to-br from-accent/10 via-accent-violet/10 to-accent-green/10" />
  ),
});

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-32 sm:pt-36">
      {/* Background grid + blobs */}
      <div className="absolute inset-0 -z-10 grid-bg" />
      <div className="glow-blob left-[-10%] top-20 h-[420px] w-[420px] bg-accent/40" />
      <div className="glow-blob right-[-15%] top-40 h-[460px] w-[460px] bg-accent-violet/40" />
      <div className="glow-blob left-1/3 bottom-[-10%] h-[360px] w-[360px] bg-accent-green/30" />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-20 sm:px-10 lg:grid-cols-2 lg:gap-6">
        {/* Left: copy */}
        <div className="relative z-10">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="chip"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-green/70" />
              <span className="relative h-2 w-2 rounded-full bg-accent-green" />
            </span>
            New Season — 25% Off All Challenges
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="h-display mt-6 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl"
          >
            Trade Big.
            <br />
            <span className="gradient-text">Get Funded</span> Faster.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg text-slate-300"
          >
            Pass our one-step evaluation, get a funded account up to{" "}
            <span className="font-semibold text-white">$200,000</span>, and keep
            up to <span className="font-semibold text-white">90%</span> of the
            profits. Built for serious traders.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a href="#plans" className="btn-primary group">
              Start Challenge
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="#how" className="btn-secondary">
              <Sparkles className="h-4 w-4" />
              How it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-green" />
              Regulated liquidity
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Bi-weekly payouts
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-violet" />
              No time limit
            </div>
          </motion.div>
        </div>

        {/* Right: 3D Canvas + floating cards */}
        <div className="relative h-[440px] w-full sm:h-[520px] lg:h-[600px]">
          <div className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] shadow-[0_30px_80px_-20px_rgba(34,211,238,0.25)] backdrop-blur-md">
            <Hero3D />
            {/* Vignette overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(4,6,11,0.85)_100%)]" />
          </div>

          {/* Floating card — Live Account */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="absolute -left-2 top-10 hidden w-56 rounded-2xl border border-white/10 bg-bg-soft/80 p-4 backdrop-blur-2xl sm:block"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Live Account</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green" />
                Active
              </span>
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              $200,000
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-green"
                style={{ width: "78%" }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              78% to next payout
            </div>
          </motion.div>

          {/* Floating card — Profit */}
          <motion.div
            initial={{ opacity: 0, x: 20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="absolute bottom-12 right-2 hidden w-52 rounded-2xl border border-white/10 bg-bg-soft/80 p-4 backdrop-blur-2xl sm:block"
          >
            <div className="text-xs text-slate-400">Today P/L</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-accent-green">
                +$4,820
              </span>
              <span className="text-xs text-accent-green">+2.41%</span>
            </div>
            <Sparkline />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 120 36" className="mt-3 h-10 w-full">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 28 L15 22 L28 26 L42 14 L58 18 L72 10 L88 14 L102 6 L120 9 L120 36 L0 36 Z"
        fill="url(#spark)"
      />
      <path
        d="M0 28 L15 22 L28 26 L42 14 L58 18 L72 10 L88 14 L102 6 L120 9"
        stroke="#34d399"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
