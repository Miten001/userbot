"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ChevronRight, Crown, Loader2 } from "lucide-react";

type Step = "one" | "two" | "three";

/** Convert "$50,000" -> 50000 for the API */
function parseSize(s: string) {
  return parseInt(s.replace(/[^0-9]/g, ""), 10);
}

async function startCheckout(step: Step, size: string) {
  const account_size_usd = parseSize(size);
  const guest_email = window.prompt("Enter your email to start the challenge:");
  if (!guest_email) return;

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, account_size_usd, guest_email }),
    });

    if (!res.ok) {
      const txt = await res.text();
      // Static GH Pages will return the index.html for /api/* — show a friendly hint.
      if (res.status === 404 || txt.startsWith("<!DOCTYPE")) {
        alert(
          "Payments aren't enabled on this deployment yet.\n\n" +
            "Deploy to Vercel and add Stripe + Supabase env vars to enable checkout.\n" +
            "See propfirm-site/BACKEND.md.",
        );
        return;
      }
      try {
        const j = JSON.parse(txt);
        alert(`Checkout failed: ${j.error ?? res.statusText}`);
      } catch {
        alert(`Checkout failed: ${res.statusText}`);
      }
      return;
    }

    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Stripe did not return a URL");
  } catch (e) {
    alert(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

type Plan = {
  size: string;
  price: string;
  target: string;
  daily: string;
  overall: string;
  split: string;
  popular?: boolean;
  starter?: boolean;
  accent: "gold" | "royal" | "emerald" | "rose";
};

const PLANS: Record<Step, Plan[]> = {
  one: [
    { size: "$2,500",   price: "$25",  target: "10%", daily: "4%", overall: "6%",  split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000",   price: "$45",  target: "10%", daily: "4%", overall: "6%",  split: "80%", accent: "rose" },
    { size: "$10,000",  price: "$69",  target: "10%", daily: "4%", overall: "6%",  split: "80%", accent: "royal" },
    { size: "$25,000",  price: "$139", target: "10%", daily: "4%", overall: "6%",  split: "80%", accent: "emerald" },
    { size: "$50,000",  price: "$229", target: "10%", daily: "4%", overall: "6%",  split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$489", target: "10%", daily: "4%", overall: "6%",  split: "85%", accent: "rose" },
    { size: "$200,000", price: "$989", target: "10%", daily: "4%", overall: "6%",  split: "90%", accent: "royal" },
  ],
  two: [
    { size: "$2,500",   price: "$19",  target: "8% / 5%", daily: "5%", overall: "10%", split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000",   price: "$29",  target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "rose" },
    { size: "$10,000",  price: "$39",  target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "royal" },
    { size: "$25,000",  price: "$79",  target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "emerald" },
    { size: "$50,000",  price: "$139", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$329", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", accent: "rose" },
    { size: "$200,000", price: "$649", target: "8% / 5%", daily: "5%", overall: "10%", split: "90%", accent: "royal" },
  ],
  three: [
    { size: "$2,500",   price: "$15",  target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000",   price: "$22",  target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", accent: "rose" },
    { size: "$10,000",  price: "$29",  target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", accent: "royal" },
    { size: "$25,000",  price: "$59",  target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "80%", accent: "emerald" },
    { size: "$50,000",  price: "$109", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$259", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "85%", accent: "rose" },
    { size: "$200,000", price: "$499", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "90%", accent: "royal" },
  ],
};

const accentMap = {
  gold:    { glow: "from-gold/45 to-gold/0",         text: "text-gold",          border: "border-gold/40" },
  royal:   { glow: "from-royal/40 to-royal/0",       text: "text-royal-400",     border: "border-royal/40" },
  emerald: { glow: "from-emerald2/40 to-emerald2/0", text: "text-emerald2-400",  border: "border-emerald2/40" },
  rose:    { glow: "from-rose2/40 to-rose2/0",       text: "text-rose2-400",     border: "border-rose2/40" },
};

const TABS: { key: Step; label: string; sub: string }[] = [
  { key: "one",   label: "1-Step",  sub: "Fastest" },
  { key: "two",   label: "2-Step",  sub: "Balanced" },
  { key: "three", label: "3-Step",  sub: "Easiest" },
];

export default function Plans() {
  const [step, setStep] = useState<Step>("one");
  const plans = PLANS[step];

  return (
    <section id="plans" className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip-gold">
          <Sparkles className="h-3.5 w-3.5" />
          Funding Programs
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Pick your <span className="gradient-text">capital</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Start with as little as <span className="font-semibold text-emerald2-400">$15</span>.
          Scale up to <span className="font-semibold text-gold">$200,000</span>.
          One-time fee, refunded with your first payout.
        </p>

        {/* Toggle (3 options) */}
        <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStep(t.key)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5 ${
                step === t.key ? "text-bg-deep" : "text-slate-300 hover:text-white"
              }`}
            >
              {step === t.key && (
                <motion.span
                  layoutId="planToggle"
                  className="absolute inset-0 rounded-full bg-gold-gradient"
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {t.label}
                <span
                  className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:inline-block ${
                    step === t.key
                      ? "bg-bg-deep/20 text-bg-deep"
                      : "bg-white/5 text-slate-400"
                  }`}
                >
                  {t.sub}
                </span>
              </span>
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
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {plans.map((p) => (
            <PlanCard key={p.size} plan={p} />
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const a = accentMap[plan.accent];
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("one");
  // Read the active step from the parent via the closest data attribute on the card.
  // (We pass it down via a hidden span below so PlanCard doesn't need props plumbing.)
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex flex-col overflow-hidden rounded-3xl ${
        plan.popular ? "ring-conic" : ""
      }`}
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b p-5 backdrop-blur-xl sm:p-6 ${
          plan.popular
            ? "border-gold/40 from-gold/[0.08] to-transparent bg-bg-soft/60"
            : "border-white/10 from-white/[0.04] to-transparent bg-white/[0.02]"
        }`}
      >
        {/* Glow accent */}
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} opacity-70 blur-3xl`}
        />

        {plan.popular && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:right-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[10px]">
            <Crown className="h-3 w-3" />
            Popular
          </div>
        )}

        {plan.starter && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald2/40 bg-emerald2/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald2-400 sm:right-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[10px]">
            <Sparkles className="h-3 w-3" />
            Starter
          </div>
        )}

        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            Account Size
          </div>
          <div className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {plan.size}
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <span
              className={`font-display text-3xl font-bold sm:text-4xl ${
                plan.popular ? "gradient-text" : a.text
              }`}
            >
              {plan.price}
            </span>
            <span className="text-[11px] text-slate-400">one-time</span>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
            <Row label="Profit Target" value={plan.target} />
            <Row label="Daily Loss" value={plan.daily} />
            <Row label="Overall Loss" value={plan.overall} />
            <Row label="Profit Split" value={plan.split} highlight />
            <Row label="Time Limit" value="Unlimited" />
          </ul>

          <a
            href="#"
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-all ${
              plan.popular
                ? "btn-primary"
                : "border border-white/15 bg-white/5 text-white hover:border-gold/40 hover:bg-white/10"
            }`}
          >
            {plan.popular && <Crown className="h-4 w-4" />}
            Start Now
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
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
      <span className="flex items-center gap-1.5 text-xs text-slate-400 sm:text-sm">
        <Check className="h-3 w-3 text-emerald2-400 sm:h-3.5 sm:w-3.5" />
        {label}
      </span>
      <span
        className={
          highlight
            ? "text-xs font-bold text-gold sm:text-sm"
            : "text-xs font-medium text-white sm:text-sm"
        }
      >
        {value}
      </span>
    </li>
  );
}
