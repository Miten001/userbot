"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ChevronRight } from "lucide-react";

type Step = "one" | "two";

const PLANS: Record<
  Step,
  {
    size: string;
    price: string;
    target: string;
    daily: string;
    overall: string;
    split: string;
    popular?: boolean;
    accent: "cyan" | "violet" | "green";
  }[]
> = {
  one: [
    { size: "$10,000", price: "$89", target: "10%", daily: "4%", overall: "6%", split: "80%", accent: "cyan" },
    { size: "$25,000", price: "$179", target: "10%", daily: "4%", overall: "6%", split: "80%", accent: "violet" },
    { size: "$50,000", price: "$289", target: "10%", daily: "4%", overall: "6%", split: "85%", popular: true, accent: "green" },
    { size: "$100,000", price: "$489", target: "10%", daily: "4%", overall: "6%", split: "85%", accent: "cyan" },
    { size: "$200,000", price: "$989", target: "10%", daily: "4%", overall: "6%", split: "90%", accent: "violet" },
  ],
  two: [
    { size: "$10,000", price: "$59", target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "cyan" },
    { size: "$25,000", price: "$129", target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "violet" },
    { size: "$50,000", price: "$229", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", popular: true, accent: "green" },
    { size: "$100,000", price: "$429", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", accent: "cyan" },
    { size: "$200,000", price: "$849", target: "8% / 5%", daily: "5%", overall: "10%", split: "90%", accent: "violet" },
  ],
};

const accentMap = {
  cyan: "from-accent/30 to-accent/0 text-accent border-accent/40",
  violet: "from-accent-violet/30 to-accent-violet/0 text-accent-violet border-accent-violet/40",
  green: "from-accent-green/30 to-accent-green/0 text-accent-green border-accent-green/40",
};

export default function Plans() {
  const [step, setStep] = useState<Step>("one");
  const plans = PLANS[step];

  return (
    <section id="plans" className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Funding Programs
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Pick your <span className="gradient-text">capital</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Choose a challenge that matches your trading style. One-time fee. No
          monthly subscriptions. Refunded with your first payout.
        </p>

        {/* Toggle */}
        <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur">
          {(
            [
              { key: "one", label: "1-Step Challenge" },
              { key: "two", label: "2-Step Challenge" },
            ] as { key: Step; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setStep(t.key)}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                step === t.key ? "text-bg" : "text-slate-300 hover:text-white"
              }`}
            >
              {step === t.key && (
                <motion.span
                  layoutId="planToggle"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-accent-green"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          {plans.map((p) => (
            <PlanCard key={p.size} plan={p} />
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)["one"][number] }) {
  const accent = accentMap[plan.accent];
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex flex-col overflow-hidden rounded-3xl border bg-gradient-to-b ${
        plan.popular
          ? "border-accent-green/40 bg-bg-soft"
          : "border-white/10 bg-white/[0.025]"
      } p-6 backdrop-blur-xl`}
    >
      {/* Glow accent */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-60 blur-3xl`}
      />

      {plan.popular && (
        <div className="absolute right-4 top-4 rounded-full border border-accent-green/40 bg-accent-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-green">
          Popular
        </div>
      )}

      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-slate-400">
          Account Size
        </div>
        <div className="mt-1 font-display text-3xl font-bold tracking-tight">
          {plan.size}
        </div>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold gradient-text">
            {plan.price}
          </span>
          <span className="text-xs text-slate-400">one-time</span>
        </div>

        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          <Row label="Profit Target" value={plan.target} />
          <Row label="Max Daily Loss" value={plan.daily} />
          <Row label="Max Overall Loss" value={plan.overall} />
          <Row label="Profit Split" value={plan.split} highlight />
          <Row label="Time Limit" value="Unlimited" />
          <Row label="EAs / News" value="Allowed" />
        </ul>

        <a
          href="#"
          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all ${
            plan.popular
              ? "bg-gradient-to-r from-accent to-accent-green text-bg shadow-[0_8px_24px_-8px_rgba(52,211,153,0.6)] hover:-translate-y-0.5"
              : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          Start Now
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </motion.div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-none">
      <span className="flex items-center gap-2 text-slate-400">
        <Check className="h-3.5 w-3.5 text-accent-green" />
        {label}
      </span>
      <span
        className={
          highlight
            ? "font-semibold text-accent-green"
            : "font-medium text-white"
        }
      >
        {value}
      </span>
    </li>
  );
}
