"use client";

import { motion } from "framer-motion";
import { ChevronRight, Crown } from "lucide-react";

export default function CTA() {
  return (
    <section className="section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="ring-conic relative isolate overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-bg-soft via-bg-soft to-bg-deep p-10 sm:p-16"
      >
        {/* Decorative grid */}
        <div className="absolute inset-0 -z-10 opacity-50 grid-bg" />

        {/* Glow blobs */}
        <div className="glow-blob -left-20 -top-20 h-80 w-80 bg-gold-radial" />
        <div className="glow-blob -right-20 -bottom-20 h-80 w-80 bg-royal-radial" />
        <div className="glow-blob right-1/3 top-10 h-56 w-56 bg-emerald-radial" />
        <div className="glow-blob left-1/2 bottom-1/3 h-44 w-44 bg-rose-radial opacity-60" />

        <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr,1fr]">
          <div>
            <span className="chip-gold">
              <Crown className="h-3.5 w-3.5" />
              Limited time · 25% off
            </span>
            <h2 className="h-display mt-5 text-4xl leading-tight sm:text-5xl">
              Ready to trade with{" "}
              <span className="gradient-text">our capital?</span>
            </h2>
            <p className="mt-4 max-w-xl text-slate-300">
              Start your evaluation in minutes. Get instant access to up to{" "}
              <span className="font-semibold text-gold">$200,000</span> in
              trading capital and join 1,200+ funded traders worldwide.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#plans" className="btn-primary group">
                <Crown className="h-4 w-4" />
                Start Challenge
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="#faq" className="btn-secondary">
                Read the FAQ
              </a>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
              <div className="flex -space-x-2">
                {[
                  "from-gold to-rose2",
                  "from-emerald2 to-gold",
                  "from-royal to-emerald2",
                  "from-rose2 to-royal",
                ].map((c, i) => (
                  <span
                    key={i}
                    className={`h-7 w-7 rounded-full border-2 border-bg-soft bg-gradient-to-br ${c}`}
                  />
                ))}
              </div>
              Joined by 240+ traders this week
            </div>
          </div>

          {/* Right: stat panel */}
          <div className="relative rounded-3xl border border-gold/20 bg-white/[0.04] p-6 shadow-gold backdrop-blur-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Funded since 2021</span>
              <span className="rounded-full border border-emerald2/30 bg-emerald2/10 px-2 py-0.5 text-emerald2-400">
                LIVE
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Stat label="Avg. Pass Rate" value="38%" sub="industry: 9%" tone="gold" />
              <Stat label="Avg. Payout" value="$1.8K" sub="per cycle" tone="emerald" />
              <Stat label="Best Trader" value="$42K" sub="lifetime profit" tone="rose" />
              <Stat label="Trustpilot" value="4.7 / 5" sub="180+ reviews" tone="royal" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "gold" | "royal" | "emerald" | "rose";
}) {
  const toneClass = {
    gold: "gradient-text",
    royal: "text-royal-400",
    emerald: "text-emerald2-400",
    rose: "text-rose2-400",
  }[tone];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/15">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-display mt-1 text-2xl font-bold tracking-tight ${toneClass}`}>
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
