"use client";

import { motion } from "framer-motion";
import { Banknote, Users, Globe2, Clock4 } from "lucide-react";

const stats = [
  {
    icon: Banknote,
    label: "Total Payouts",
    value: "$946K+",
    accent: "gold",
  },
  {
    icon: Users,
    label: "Funded Traders",
    value: "1,247+",
    accent: "royal",
  },
  {
    icon: Globe2,
    label: "Countries",
    value: "62+",
    accent: "emerald",
  },
  {
    icon: Clock4,
    label: "Avg. Payout Time",
    value: "< 24h",
    accent: "rose",
  },
] as const;

const accentMap = {
  gold: {
    text: "text-gold",
    bg: "from-gold/35 to-gold/0",
    border: "group-hover:border-gold/30",
  },
  royal: {
    text: "text-royal-400",
    bg: "from-royal/30 to-royal/0",
    border: "group-hover:border-royal/30",
  },
  emerald: {
    text: "text-emerald2-400",
    bg: "from-emerald2/30 to-emerald2/0",
    border: "group-hover:border-emerald2/30",
  },
  rose: {
    text: "text-rose2-400",
    bg: "from-rose2/30 to-rose2/0",
    border: "group-hover:border-rose2/30",
  },
};

const partners = [
  "MetaTrader 5",
  "cTrader",
  "TradingView",
  "MatchTrader",
  "DXtrade",
  "TradeLocker",
  "Plus500",
  "Eightcap",
];

export default function Stats() {
  return (
    <section className="relative">
      {/* Stats grid */}
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((s, i) => {
            const a = accentMap[s.accent];
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-colors ${a.border}`}
              >
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${a.bg} blur-2xl transition-opacity duration-500 group-hover:scale-125`}
                />
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                    <s.icon className={`h-5 w-5 ${a.text}`} />
                  </span>
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    {s.label}
                  </span>
                </div>
                <div
                  className={`mt-4 font-display text-3xl font-bold tracking-tight ${
                    s.accent === "gold" ? "gradient-text" : a.text
                  }`}
                >
                  {s.value}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Partners marquee */}
      <div className="relative border-y border-white/5 bg-white/[0.015] py-8">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg-deep to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg-deep to-transparent" />

        <div className="mb-4 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          Powered by industry-leading platforms
        </div>

        <div className="flex w-full overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-12 pr-12">
            {[...partners, ...partners].map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 whitespace-nowrap text-lg font-semibold text-slate-400/70 transition-colors hover:text-gold"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gold/60" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
