"use client";

import { motion } from "framer-motion";
import {
  Zap,
  ShieldCheck,
  Wallet,
  LineChart,
  Globe,
  Bot,
  Sparkles,
} from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="section">
      <div className="mb-14 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent-green" />
          Why ApexFunded
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Built for <span className="gradient-text">serious traders</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Real liquidity, transparent rules, and the fastest payouts in the
          industry.
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
        {/* Big feature: Profit Split */}
        <BentoCard className="md:col-span-3 md:row-span-1">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <IconBadge color="green">
                <Wallet className="h-5 w-5 text-accent-green" />
              </IconBadge>
              <h3 className="font-display mt-4 text-2xl font-bold">
                Up to <span className="gradient-text">90% profit split</span>
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Industry-best splits. Scale your account up to $4M with our
                progressive scaling plan.
              </p>
            </div>
            <SplitMeter />
          </div>
        </BentoCard>

        {/* Fast Payouts */}
        <BentoCard className="md:col-span-3">
          <IconBadge color="cyan">
            <Zap className="h-5 w-5 text-accent" />
          </IconBadge>
          <h3 className="font-display mt-4 text-2xl font-bold">
            Lightning-fast payouts
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            On-demand withdrawals processed in under 24 hours via bank, USDT, or
            Wise.
          </p>
          <PayoutRow />
        </BentoCard>

        {/* Risk Engine */}
        <BentoCard className="md:col-span-2">
          <IconBadge color="violet">
            <ShieldCheck className="h-5 w-5 text-accent-violet" />
          </IconBadge>
          <h3 className="font-display mt-4 text-xl font-bold">
            Transparent risk engine
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            See your drawdown, equity, and rule status in real-time on your
            dashboard.
          </p>
        </BentoCard>

        {/* Global */}
        <BentoCard className="md:col-span-2">
          <IconBadge color="cyan">
            <Globe className="h-5 w-5 text-accent" />
          </IconBadge>
          <h3 className="font-display mt-4 text-xl font-bold">
            150+ countries
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Trusted by traders across 6 continents. Support in 12 languages.
          </p>
          <Globule />
        </BentoCard>

        {/* EAs / Bots */}
        <BentoCard className="md:col-span-2">
          <IconBadge color="green">
            <Bot className="h-5 w-5 text-accent-green" />
          </IconBadge>
          <h3 className="font-display mt-4 text-xl font-bold">
            EAs & algorithms welcome
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Run your strategies automatically — copy trading, news trading and
            EAs are all allowed.
          </p>
        </BentoCard>
      </div>
    </section>
  );
}

function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-xl transition-colors hover:border-white/20 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-10 -top-20 h-40 rounded-full bg-gradient-to-b from-white/10 to-transparent blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

function IconBadge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "cyan" | "violet" | "green";
}) {
  const map = {
    cyan: "from-accent/30 to-accent/0 border-accent/30",
    violet: "from-accent-violet/30 to-accent-violet/0 border-accent-violet/30",
    green: "from-accent-green/30 to-accent-green/0 border-accent-green/30",
  };
  return (
    <span
      className={`inline-grid h-11 w-11 place-items-center rounded-xl border bg-gradient-to-br ${map[color]} backdrop-blur`}
    >
      {children}
    </span>
  );
}

function SplitMeter() {
  const splits = [
    { l: "Standard", v: "80%", w: "80%" },
    { l: "Pro", v: "85%", w: "85%" },
    { l: "Elite", v: "90%", w: "90%" },
  ];
  return (
    <div className="space-y-2.5">
      {splits.map((s) => (
        <div key={s.l}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>{s.l}</span>
            <span className="text-white">{s.v}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: s.w }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-green"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PayoutRow() {
  const items = [
    { label: "Bank Wire", time: "24h" },
    { label: "USDT (TRC20)", time: "<2h" },
    { label: "Wise", time: "12h" },
  ];
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs"
        >
          <LineChart className="h-3.5 w-3.5 text-accent" />
          <span className="text-slate-300">{i.label}</span>
          <span className="text-slate-500">·</span>
          <span className="font-semibold text-accent-green">{i.time}</span>
        </div>
      ))}
    </div>
  );
}

function Globule() {
  return (
    <div className="mt-4 flex items-center gap-2">
      {["🇺🇸", "🇮🇳", "🇬🇧", "🇦🇪", "🇩🇪", "🇸🇬", "🇧🇷"].map((f, i) => (
        <span
          key={i}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-sm"
        >
          {f}
        </span>
      ))}
      <span className="ml-1 text-xs text-slate-400">+143 more</span>
    </div>
  );
}
