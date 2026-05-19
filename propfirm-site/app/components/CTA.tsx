"use client";

import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";

export default function CTA() {
  return (
    <section className="section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative isolate overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-bg-soft via-bg-soft to-black p-10 sm:p-16"
      >
        {/* Decorative grid */}
        <div className="absolute inset-0 -z-10 opacity-50 grid-bg" />

        {/* Glow blobs */}
        <div className="glow-blob -left-20 -top-20 h-80 w-80 bg-accent/40" />
        <div className="glow-blob -right-20 -bottom-20 h-80 w-80 bg-accent-violet/40" />
        <div className="glow-blob right-1/3 top-10 h-56 w-56 bg-accent-green/30" />

        {/* Animated border gradient */}
        <div className="pointer-events-none absolute inset-0 rounded-[36px] [mask:linear-gradient(white,white)_content-box,linear-gradient(white,white)] [mask-composite:exclude] p-[1px]">
          <div className="h-full w-full rounded-[36px] bg-[conic-gradient(from_0deg,rgba(34,211,238,0.4),rgba(167,139,250,0.4),rgba(52,211,153,0.4),rgba(34,211,238,0.4))] opacity-70" />
        </div>

        <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr,1fr]">
          <div>
            <span className="chip">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Limited time · 25% off
            </span>
            <h2 className="h-display mt-5 text-4xl leading-tight sm:text-5xl">
              Ready to trade with{" "}
              <span className="gradient-text">our capital?</span>
            </h2>
            <p className="mt-4 max-w-xl text-slate-300">
              Start your evaluation in minutes. Get instant access to up to
              $200,000 in trading capital and join 62,000+ funded traders
              worldwide.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#plans" className="btn-primary group">
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
                  "from-accent to-accent-violet",
                  "from-accent-green to-accent",
                  "from-accent-violet to-accent-green",
                  "from-accent to-accent-green",
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
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Funded since 2021</span>
              <span className="rounded-full border border-accent-green/30 bg-accent-green/10 px-2 py-0.5 text-accent-green">
                LIVE
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Stat label="Avg. Pass Rate" value="38%" sub="industry: 9%" />
              <Stat label="Avg. Payout" value="$4.2K" sub="per cycle" />
              <Stat label="Best Trader" value="$612K" sub="lifetime profit" />
              <Stat label="Trustpilot" value="4.8 / 5" sub="4,200+ reviews" />
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
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-display mt-1 text-2xl font-bold tracking-tight gradient-text">
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
