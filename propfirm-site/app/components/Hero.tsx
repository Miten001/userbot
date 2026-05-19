"use client";

import { motion } from "framer-motion";
import {
  ChevronRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Crown,
} from "lucide-react";
import PairsShowcase from "./PairsShowcase";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-32 sm:pt-36">
      {/* Grid + glow blobs */}
      <div className="absolute inset-0 -z-10 grid-bg" />
      <div className="glow-blob left-[-10%] top-20 h-[460px] w-[460px] bg-gold-radial" />
      <div className="glow-blob right-[-15%] top-32 h-[480px] w-[480px] bg-royal-radial" />
      <div className="glow-blob left-1/3 bottom-[-15%] h-[380px] w-[380px] bg-emerald-radial" />
      <div className="glow-blob right-1/4 top-1/2 h-[260px] w-[260px] bg-rose-radial opacity-40" />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-20 sm:px-10 lg:grid-cols-2 lg:gap-6">
        {/* Left: copy */}
        <div className="relative z-10">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="chip-gold"
          >
            <Crown className="h-3.5 w-3.5" />
            New Season — 25% off all challenges
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="h-display mt-6 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl"
          >
            Trade Big.
            <br />
            <span className="gradient-text">Get Funded</span>
            <br className="sm:hidden" />
            <span className="lux-text"> Faster.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg text-slate-300"
          >
            Pass our one-step evaluation, get a funded account up to{" "}
            <span className="font-semibold text-gold">$200,000</span>, and keep
            up to <span className="font-semibold text-emerald2-400">90%</span>{" "}
            of the profits. Built for serious traders.
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
              <Sparkles className="h-4 w-4 text-gold" />
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
              <ShieldCheck className="h-4 w-4 text-emerald2-400" />
              Regulated liquidity
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" />
              Bi-weekly payouts
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-royal-400" />
              No time limit
            </div>
          </motion.div>
        </div>

        {/* Right: 3D Canvas + floating cards */}
        <div className="relative h-[440px] w-full sm:h-[520px] lg:h-[600px]">
          <div className="ring-conic absolute inset-0 overflow-hidden rounded-[36px] border border-white/10 bg-bg-deep/80 shadow-glass backdrop-blur-md">
            <PairsShowcase />
          </div>

          {/* Floating card — Live Account */}
          <motion.div
            initial={{ opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="absolute -left-2 top-10 hidden w-60 rounded-2xl border border-gold/30 bg-bg-soft/85 p-4 shadow-gold backdrop-blur-2xl sm:block"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-gold" />
                Funded Account
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald2-400" />
                <span className="text-emerald2-400">Active</span>
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold gradient-text">
              $200,000
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold via-rose2-400 to-emerald2-400"
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
            className="absolute bottom-12 right-2 hidden w-56 rounded-2xl border border-emerald2/30 bg-bg-soft/85 p-4 shadow-emerald backdrop-blur-2xl sm:block"
          >
            <div className="text-xs text-slate-400">Today P/L</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-emerald2-400">
                +$4,820
              </span>
              <span className="rounded-full bg-emerald2/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald2-400">
                +2.41%
              </span>
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
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sparkLine" x1="0" y1="0" x2="120" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path
        d="M0 28 L15 22 L28 26 L42 14 L58 18 L72 10 L88 14 L102 6 L120 9 L120 36 L0 36 Z"
        fill="url(#spark)"
      />
      <path
        d="M0 28 L15 22 L28 26 L42 14 L58 18 L72 10 L88 14 L102 6 L120 9"
        stroke="url(#sparkLine)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
