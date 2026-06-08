"use client";

import { motion } from "framer-motion";
import { Gift, CheckCircle, Clock, Target, AlertTriangle, Rocket } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

const trialRules = [
  { icon: Target, text: "10% profit target to pass" },
  { icon: AlertTriangle, text: "5% max daily drawdown" },
  { icon: Clock, text: "No time limit to complete" },
  { icon: CheckCircle, text: "Same rules as real challenge" },
];

export default function FreeTrialPage() {
  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Free <span className="gradient-text">Trial</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Try a challenge without any payment - prove your skills risk-free
          </p>
        </div>

        <PageTransition>
          {/* Hero CTA section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-8 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gold/10">
                <Gift className="h-8 w-8 text-gold" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">
                Start Your Free $10K Demo Challenge
              </h2>
              <p className="mt-2 max-w-lg text-sm text-slate-400">
                Experience the full challenge environment with no financial commitment.
                Trade with a $10,000 demo account under real challenge conditions.
                No payout on demo accounts, but pass and unlock a discount on your first real challenge.
              </p>
              <button className="btn-primary mt-6 flex items-center gap-2 px-8 py-3 text-base font-semibold">
                <Rocket className="h-5 w-5" />
                Start Free Trial
              </button>
            </div>
          </motion.div>

          {/* Trial Rules */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trialRules.map((rule, i) => (
              <motion.div
                key={rule.text}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
              >
                <rule.icon className="mb-3 h-5 w-5 text-gold" />
                <p className="text-sm font-medium text-slate-300">{rule.text}</p>
              </motion.div>
            ))}
          </div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <h3 className="mb-4 font-display text-lg font-bold text-white">How It Works</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold/10 font-display text-lg font-bold text-gold">
                  1
                </div>
                <p className="text-sm text-slate-300">Sign up and activate your free demo challenge</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold/10 font-display text-lg font-bold text-gold">
                  2
                </div>
                <p className="text-sm text-slate-300">Trade under real challenge rules with $10K virtual capital</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold/10 font-display text-lg font-bold text-gold">
                  3
                </div>
                <p className="text-sm text-slate-300">Pass and get a discount on your first funded challenge</p>
              </div>
            </div>
          </motion.div>

          {/* Demo Trial Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <h3 className="mb-4 font-display text-lg font-bold text-white">Your Trial Progress</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Status</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald2-400" />
                  <span className="font-display text-sm font-bold text-emerald2-400">Active</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Current Balance</div>
                <div className="mt-1 font-display text-sm font-bold text-white">$10,482.30</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Profit Target</div>
                <div className="mt-1 font-display text-sm font-bold text-gold">$11,000 (10%)</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Max Drawdown</div>
                <div className="mt-1 font-display text-sm font-bold text-white">$9,500 (5%)</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Progress to target</span>
                <span className="text-gold">48.2%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-amber-400"
                  style={{ width: "48.2%" }}
                />
              </div>
            </div>
          </motion.div>
        </PageTransition>
      </div>
    </div>
  );
}
