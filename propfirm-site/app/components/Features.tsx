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
  Crown,
} from "lucide-react";

export default function Features() {
  return (
    <section id="features" className="section">
      <div className="mb-14 flex flex-col items-center text-center">
        <span className="chip-gold">
          <Crown className="h-3.5 w-3.5" />
          Why ApexFunded
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Built for <span className="lux-text">serious traders</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Real liquidity, transparent rules, and the fastest payouts in the
          industry.
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
        {/* Big feature: Profit Split — premium gold card */}
        <BentoCard
          className="md:col-span-3 md:row-span-1"
          glow="from-gold/40"
          isPremium
        >
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <IconBadge color="gold">
                <Wallet className="h-5 w-5 text-gold" />
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
        <BentoCard className="md:col-span-3" glow="from-rose2/30">
          <IconBadge color="rose">
            <Zap className="h-5 w-5 text-rose2-400" />
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
        <BentoCard className="md:col-span-2" glow="from-royal/40">
          <IconBadge color="royal">
            <ShieldCheck className="h-5 w-5 text-royal-400" />
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
        <BentoCard className="md:col-span-2" glow="from-emerald2/35">
          <IconBadge color="emerald">
            <Globe className="h-5 w-5 text-emerald2-400" />
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
        <BentoCard className="md:col-span-2" glow="from-gold/30">
          <IconBadge color="gold">
            <Bot className="h-5 w-5 text-gold" />
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
  glow = "from-white/10",
  isPremium = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
  isPremium?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
      className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl transition-colors ${
        isPremium
          ? "border-gold/30 bg-gradient-to-br from-gold/[0.06] to-transparent hover:border-gold/50"
          : "border-white/10 bg-white/[0.025] hover:border-white/20"
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br ${glow} to-transparent blur-3xl opacity-60 transition-opacity duration-500 group-hover:opacity-100`}
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

function IconBadge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "gold" | "royal" | "emerald" | "rose";
}) {
  const map = {
    gold: "from-gold/30 to-gold/0 border-gold/40",
    royal: "from-royal/30 to-royal/0 border-royal/40",
    emerald: "from-emerald2/30 to-emerald2/0 border-emerald2/40",
    rose: "from-rose2/30 to-rose2/0 border-rose2/40",
  };
  return (
    <span
      className={`inline-grid h-11 w-11 place-items-center rounded-xl border bg-gradient-to-br ${map[color]} backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`}
    >
      {children}
    </span>
  );
}

function SplitMeter() {
  const splits = [
    { l: "Standard", v: "80%", w: "80%", c: "from-royal-400 to-royal" },
    { l: "Pro", v: "85%", w: "85%", c: "from-emerald2-400 to-emerald2" },
    { l: "Elite", v: "90%", w: "90%", c: "from-gold-glow via-gold to-gold-500" },
  ];
  return (
    <div className="space-y-2.5">
      {splits.map((s) => (
        <div key={s.l}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>{s.l}</span>
            <span
              className={
                s.l === "Elite"
                  ? "font-bold text-gold"
                  : "font-medium text-white"
              }
            >
              {s.v}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: s.w }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${s.c}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PayoutRow() {
  const items = [
    { label: "Bank Wire", time: "24h", color: "text-royal-400" },
    { label: "USDT (TRC20)", time: "<2h", color: "text-emerald2-400" },
    { label: "Wise", time: "12h", color: "text-gold" },
  ];
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((i) => (
        <div
          key={i.label}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs"
        >
          <LineChart className={`h-3.5 w-3.5 ${i.color}`} />
          <span className="text-slate-300">{i.label}</span>
          <span className="text-slate-500">·</span>
          <span className={`font-bold ${i.color}`}>{i.time}</span>
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
