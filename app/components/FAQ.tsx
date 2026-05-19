"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";

const faqs = [
  {
    q: "What is ApexFunded?",
    a: "ApexFunded is a proprietary trading firm that funds skilled traders with up to $200,000 in capital. Pass our evaluation, prove your edge, and we provide the capital — you keep up to 90% of the profits.",
  },
  {
    q: "How long does the evaluation take?",
    a: "There is no time limit. Most traders pass within 10–20 trading days, but you can take as long as you need. Once passed, your funded account is delivered within 24 hours.",
  },
  {
    q: "Are EAs and algorithmic strategies allowed?",
    a: "Yes. Expert Advisors, automated strategies and copy trading on your own accounts are fully permitted. We only restrict abusive practices like HFT latency arbitrage and tick scalping under 30 seconds.",
  },
  {
    q: "How fast are payouts?",
    a: "On average, payouts are processed within 24 hours. Crypto withdrawals (USDT TRC20) typically arrive in under 2 hours. Bi-weekly payout cycles are available on all funded accounts.",
  },
  {
    q: "Do I get my fee back?",
    a: "Yes. Your one-time challenge fee is fully refunded together with your first profit payout on a funded account.",
  },
  {
    q: "What if I break a rule?",
    a: "If a rule violation occurs (e.g. exceeding max daily or overall drawdown), the account is closed. You can purchase a new challenge at any time — there&apos;s no cooldown or penalty.",
  },
  {
    q: "Which platforms are supported?",
    a: "We currently support MetaTrader 5, cTrader, MatchTrader and TradeLocker. You can switch platforms once during your evaluation.",
  },
  {
    q: "Can I scale my account?",
    a: "Absolutely. Hit a 10% return over 4 months while staying within rules and your account is doubled — up to a maximum of $4M in allocated capital.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent-violet" />
          FAQ
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Got <span className="gradient-text">questions?</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Everything you need to know before starting your challenge.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={f.q}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-colors ${
                isOpen
                  ? "border-accent/40 bg-white/[0.04]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-medium text-white">{f.q}</span>
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border transition-all ${
                    isOpen
                      ? "rotate-45 border-accent/40 bg-accent/10 text-accent"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-5 pb-5 text-sm leading-relaxed text-slate-400">
                      {f.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
