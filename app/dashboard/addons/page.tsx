"use client";

import { motion } from "framer-motion";
import { RotateCcw, Clock, Globe, CalendarCheck, Sparkles } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type AddOn = {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "gold" | "emerald" | "royal" | "rose";
};

const ADD_ONS: AddOn[] = [
  {
    id: "reset",
    title: "Reset Account",
    description: "Start fresh with a clean slate. Your balance and stats are reset to the initial state.",
    price: 15,
    icon: RotateCcw,
    accent: "rose",
  },
  {
    id: "extend-time",
    title: "Extend Time",
    description: "Add 14 extra days to your evaluation period. More time to hit your targets.",
    price: 10,
    icon: Clock,
    accent: "emerald",
  },
  {
    id: "swap-free",
    title: "Swap-Free Account",
    description: "No overnight swap fees on your positions. Ideal for swing traders.",
    price: 20,
    icon: Globe,
    accent: "royal",
  },
  {
    id: "biweekly-payouts",
    title: "Bi-Weekly Payouts",
    description: "Get paid every 2 weeks instead of monthly. Faster access to your profits.",
    price: 25,
    icon: CalendarCheck,
    accent: "gold",
  },
];

const accentStyles = {
  gold: { bg: "bg-gold/15", text: "text-gold", border: "border-gold/30" },
  emerald: { bg: "bg-emerald2/15", text: "text-emerald2-400", border: "border-emerald2/30" },
  royal: { bg: "bg-royal/15", text: "text-royal-400", border: "border-royal/30" },
  rose: { bg: "bg-rose2/15", text: "text-rose2-400", border: "border-rose2/30" },
};

export default function AddOnsPage() {
  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <span className="chip-gold">
              <Sparkles className="h-3.5 w-3.5" />
              Marketplace
            </span>
          </div>
          <h1 className="h-display mt-3 text-3xl sm:text-4xl">
            Add-<span className="gradient-text">ons</span>
          </h1>
          <p className="mt-2 max-w-xl text-slate-400">
            Enhance your trading experience with optional upgrades. Purchase add-ons for any active account.
          </p>
        </div>

        {/* Add-on cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADD_ONS.map((addon, i) => (
            <motion.div
              key={addon.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-colors hover:border-white/20"
            >
              {/* Glow */}
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${accentStyles[addon.accent].bg} opacity-60 blur-3xl`} />

              {/* Icon */}
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${accentStyles[addon.accent].bg} ${accentStyles[addon.accent].text}`}>
                <addon.icon className="h-6 w-6" />
              </div>

              {/* Content */}
              <h3 className="mt-4 text-lg font-semibold text-white">{addon.title}</h3>
              <p className="mt-2 flex-1 text-sm text-slate-400">{addon.description}</p>

              {/* Price + button */}
              <div className="mt-5 flex items-center justify-between">
                <span className={`text-xl font-bold ${accentStyles[addon.accent].text}`}>
                  ${addon.price}
                </span>
                <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all hover:border-gold/40 hover:bg-white/10">
                  Purchase
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info note */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <p className="text-sm text-slate-400">
            Add-ons are applied to your currently selected account. If you have multiple accounts, choose the correct one before purchasing.
            All add-on purchases are non-refundable.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
