"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ChevronRight, Crown, Loader2, Smartphone, Bitcoin, X } from "lucide-react";

type Step = "one" | "two" | "three";
type Method = "upi" | "crypto";

/** "$50,000" -> 50000 (for the API request) */
function parseSize(s: string) {
  return parseInt(s.replace(/[^0-9]/g, ""), 10);
}

async function startCheckout(step: Step, size: string, method: Method): Promise<void> {
  const account_size_usd = parseSize(size);
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, account_size_usd, method }),
    });

    if (res.status === 401) {
      // Not signed in — send to login, come back to plans after.
      window.location.href = "/login?next=/%23plans";
      return;
    }

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404 || txt.startsWith("<!DOCTYPE")) {
        alert(
          "Payments aren't enabled on this deployment yet.\n\n" +
            "Deploy to Vercel and add Razorpay / NOWPayments + Supabase env vars.\n" +
            "See SETUP.md.",
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
    else alert(data.error ?? "Gateway did not return a URL");
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
    { size: "$2,500", price: "$25", target: "10%", daily: "4%", overall: "6%", split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000", price: "$45", target: "10%", daily: "4%", overall: "6%", split: "80%", accent: "rose" },
    { size: "$10,000", price: "$69", target: "10%", daily: "4%", overall: "6%", split: "80%", accent: "royal" },
    { size: "$25,000", price: "$139", target: "10%", daily: "4%", overall: "6%", split: "80%", accent: "emerald" },
    { size: "$50,000", price: "$229", target: "10%", daily: "4%", overall: "6%", split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$489", target: "10%", daily: "4%", overall: "6%", split: "85%", accent: "rose" },
    { size: "$200,000", price: "$989", target: "10%", daily: "4%", overall: "6%", split: "90%", accent: "royal" },
  ],
  two: [
    { size: "$2,500", price: "$19", target: "8% / 5%", daily: "5%", overall: "10%", split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000", price: "$29", target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "rose" },
    { size: "$10,000", price: "$39", target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "royal" },
    { size: "$25,000", price: "$79", target: "8% / 5%", daily: "5%", overall: "10%", split: "80%", accent: "emerald" },
    { size: "$50,000", price: "$139", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$329", target: "8% / 5%", daily: "5%", overall: "10%", split: "85%", accent: "rose" },
    { size: "$200,000", price: "$649", target: "8% / 5%", daily: "5%", overall: "10%", split: "90%", accent: "royal" },
  ],
  three: [
    { size: "$2,500", price: "$15", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", starter: true, accent: "emerald" },
    { size: "$5,000", price: "$22", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", accent: "rose" },
    { size: "$10,000", price: "$29", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "75%", accent: "royal" },
    { size: "$25,000", price: "$59", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "80%", accent: "emerald" },
    { size: "$50,000", price: "$109", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "85%", popular: true, accent: "gold" },
    { size: "$100,000", price: "$259", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "85%", accent: "rose" },
    { size: "$200,000", price: "$499", target: "6% / 4% / 3%", daily: "5%", overall: "12%", split: "90%", accent: "royal" },
  ],
};

const accentMap = {
  gold: { glow: "from-gold/45 to-gold/0", text: "text-gold", border: "border-gold/40" },
  royal: { glow: "from-royal/40 to-royal/0", text: "text-royal-400", border: "border-royal/40" },
  emerald: { glow: "from-emerald2/40 to-emerald2/0", text: "text-emerald2-400", border: "border-emerald2/40" },
  rose: { glow: "from-rose2/40 to-rose2/0", text: "text-rose2-400", border: "border-rose2/40" },
};

const TABS: { key: Step; label: string; sub: string }[] = [
  { key: "one", label: "1-Step", sub: "Fastest" },
  { key: "two", label: "2-Step", sub: "Balanced" },
  { key: "three", label: "3-Step", sub: "Easiest" },
];

export default function Plans() {
  const [step, setStep] = useState<Step>("one");
  const [chosen, setChosen] = useState<{ step: Step; plan: Plan } | null>(null);
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
          Start with as little as <span className="font-semibold text-emerald2-400">$15</span>. Scale up to{" "}
          <span className="font-semibold text-gold">$200,000</span>. Pay via <span className="text-white">UPI</span> or{" "}
          <span className="text-white">crypto</span> — one-time fee, refunded with your first payout.
        </p>

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
                    step === t.key ? "bg-bg-deep/20 text-bg-deep" : "bg-white/5 text-slate-400"
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
            <PlanCard key={p.size} plan={p} onStart={() => setChosen({ step, plan: p })} />
          ))}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {chosen && <MethodModal data={chosen} onClose={() => setChosen(null)} />}
      </AnimatePresence>
    </section>
  );
}

function PlanCard({ plan, onStart }: { plan: Plan; onStart: () => void }) {
  const a = accentMap[plan.accent];

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex flex-col overflow-hidden rounded-3xl ${plan.popular ? "ring-conic" : ""}`}
    >
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b p-5 backdrop-blur-xl sm:p-6 ${
          plan.popular
            ? "border-gold/40 from-gold/[0.08] to-transparent bg-bg-soft/60"
            : "border-white/10 from-white/[0.04] to-transparent bg-white/[0.02]"
        }`}
      >
        <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} opacity-70 blur-3xl`} />

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
          <div className="text-xs uppercase tracking-wider text-slate-400">Account Size</div>
          <div className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{plan.size}</div>

          <div className="mt-4 flex items-baseline gap-1">
            <span className={`font-display text-3xl font-bold sm:text-4xl ${plan.popular ? "gradient-text" : a.text}`}>{plan.price}</span>
            <span className="text-[11px] text-slate-400">one-time</span>
          </div>

          <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
            <Row label="Profit Target" value={plan.target} />
            <Row label="Daily Loss" value={plan.daily} />
            <Row label="Overall Loss" value={plan.overall} />
            <Row label="Profit Split" value={plan.split} highlight />
            <Row label="Time Limit" value="Unlimited" />
          </ul>

          <button
            onClick={onStart}
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-all ${
              plan.popular ? "btn-primary" : "border border-white/15 bg-white/5 text-white hover:border-gold/40 hover:bg-white/10"
            }`}
          >
            {plan.popular && <Crown className="h-4 w-4" />}
            Start Now
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MethodModal({ data, onClose }: { data: { step: Step; plan: Plan }; onClose: () => void }) {
  const [loading, setLoading] = useState<Method | null>(null);

  async function pick(method: Method) {
    if (loading) return;
    setLoading(method);
    try {
      await startCheckout(data.step, data.plan.size, method);
    } finally {
      setLoading(null);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-bg-soft/90 p-6 backdrop-blur-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>

        <div className="text-xs uppercase tracking-wider text-slate-400">Checkout</div>
        <div className="mt-1 font-display text-2xl font-bold">
          {data.plan.size} <span className="text-slate-500">·</span> <span className="gradient-text">{data.plan.price}</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">Choose how you&apos;d like to pay:</p>

        <div className="mt-5 space-y-3">
          <button
            onClick={() => pick("upi")}
            disabled={loading !== null}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-gold/40 hover:bg-white/[0.06] disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald2/15 text-emerald2-400">
              {loading === "upi" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-semibold text-white">UPI / Cards</span>
              <span className="block text-xs text-slate-400">GPay, PhonePe, Paytm, cards, netbanking</span>
            </span>
          </button>

          <button
            onClick={() => pick("crypto")}
            disabled={loading !== null}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-gold/40 hover:bg-white/[0.06] disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
              {loading === "crypto" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bitcoin className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-semibold text-white">Crypto</span>
              <span className="block text-xs text-slate-400">USDT, BTC, ETH &amp; 100+ coins</span>
            </span>
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">Secure hosted checkout · one-time evaluation fee</p>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-none">
      <span className="flex items-center gap-1.5 text-xs text-slate-400 sm:text-sm">
        <Check className="h-3 w-3 text-emerald2-400 sm:h-3.5 sm:w-3.5" />
        {label}
      </span>
      <span className={highlight ? "text-xs font-bold text-gold sm:text-sm" : "text-xs font-medium text-white sm:text-sm"}>{value}</span>
    </li>
  );
}
