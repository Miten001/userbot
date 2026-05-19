"use client";

import { motion } from "framer-motion";
import {
  Check,
  X,
  ScrollText,
  Sparkles,
  Clock,
  AlertTriangle,
} from "lucide-react";

const allowed = [
  "Expert Advisors (EAs)",
  "News trading",
  "Hedging across pairs",
  "Holding overnight",
  "Holding over weekends",
  "Copy trading (own accounts)",
  "All major & minor FX pairs",
  "Indices, metals, crypto",
];

const notAllowed = [
  "HFT / Latency arbitrage",
  "Tick scalping (< 30s)",
  "Account martingale abuse",
  "Group hedging across users",
  "Reverse trading scams",
  "Off-market price exploits",
];

const rules = [
  { icon: Clock, label: "Time Limit", value: "Unlimited" },
  { icon: AlertTriangle, label: "Min Trading Days", value: "0 days" },
  { icon: ScrollText, label: "Leverage", value: "Up to 1:100" },
];

export default function Rules() {
  return (
    <section id="rules" className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Trading Rules
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Simple, <span className="gradient-text">trader-first</span> rules
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          We don&apos;t hide the rulebook in fine print. Here&apos;s exactly
          what you can and can&apos;t do.
        </p>
      </div>

      {/* Top key facts */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rules.map((r, i) => (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                <r.icon className="h-4 w-4 text-accent" />
              </span>
              <span className="text-sm text-slate-300">{r.label}</span>
            </div>
            <span className="font-display text-lg font-bold text-white">
              {r.value}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Allowed / Not Allowed */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-accent-green/30 bg-gradient-to-br from-accent-green/10 to-transparent p-7 backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-green/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent-green/40 bg-accent-green/10">
                <Check className="h-5 w-5 text-accent-green" />
              </span>
              <h3 className="font-display text-2xl font-bold">Allowed</h3>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allowed.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-slate-200"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-green" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-transparent p-7 backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-500/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/40 bg-rose-500/10">
                <X className="h-5 w-5 text-rose-400" />
              </span>
              <h3 className="font-display text-2xl font-bold">Not Allowed</h3>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {notAllowed.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-slate-200"
                >
                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
