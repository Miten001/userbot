"use client";

import { motion } from "framer-motion";
import { Trophy, Rocket, BadgeDollarSign, Sparkles } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: Rocket,
    title: "Choose & Pass",
    desc: "Pick a funding size, take the evaluation and hit your profit target without breaking risk rules.",
    accent: "from-accent/40 to-accent/0",
    iconColor: "text-accent",
  },
  {
    n: "02",
    icon: Trophy,
    title: "Get Funded",
    desc: "Receive your live funded account within 24 hours. Trade your strategy with our capital.",
    accent: "from-accent-violet/40 to-accent-violet/0",
    iconColor: "text-accent-violet",
  },
  {
    n: "03",
    icon: BadgeDollarSign,
    title: "Get Paid",
    desc: "Withdraw up to 90% of profits — bi-weekly payouts via bank, crypto or Wise. Refund of fee on first payout.",
    accent: "from-accent-green/40 to-accent-green/0",
    iconColor: "text-accent-green",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className="mb-14 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent-violet" />
          How it works
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Three steps to <span className="gradient-text">funded</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          A simple, transparent path from challenge to payout. No hidden rules,
          no surprises.
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Connecting line */}
        <div className="pointer-events-none absolute left-0 right-0 top-[88px] hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />

        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-7 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div
              className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br ${s.accent} blur-3xl opacity-50 transition-opacity group-hover:opacity-90`}
            />

            {/* 3D-ish icon plate */}
            <div className="relative mb-5 inline-flex">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-white/0 blur-md" />
              <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_30px_-10px_rgba(0,0,0,0.6)]">
                <s.icon className={`h-7 w-7 ${s.iconColor}`} />
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-display text-xs font-semibold tracking-widest text-slate-500">
                STEP {s.n}
              </span>
            </div>
            <h3 className="font-display mt-1 text-2xl font-bold">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {s.desc}
            </p>

            {/* Bottom shine line on hover */}
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
