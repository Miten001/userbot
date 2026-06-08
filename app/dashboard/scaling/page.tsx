"use client";

import { motion } from "framer-motion";
import { Layers, TrendingUp, CheckCircle, Star, ArrowRight } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type ScalingTier = {
  size: string;
  sizeNum: number;
  requirement: string;
  profitReq: string;
  months: number;
  benefits: string[];
  active: boolean;
  completed: boolean;
};

const scalingTiers: ScalingTier[] = [
  {
    size: "$50K",
    sizeNum: 50000,
    requirement: "Pass initial challenge",
    profitReq: "8% profit",
    months: 0,
    benefits: ["80% profit split", "Bi-weekly payouts"],
    active: false,
    completed: true,
  },
  {
    size: "$100K",
    sizeNum: 100000,
    requirement: "2 consecutive profitable months",
    profitReq: "10%+ total profit",
    months: 2,
    benefits: ["85% profit split", "Weekly payouts"],
    active: true,
    completed: false,
  },
  {
    size: "$200K",
    sizeNum: 200000,
    requirement: "3 consecutive profitable months",
    profitReq: "12%+ total profit",
    months: 3,
    benefits: ["85% profit split", "Weekly payouts", "Dedicated manager"],
    active: false,
    completed: false,
  },
  {
    size: "$400K",
    sizeNum: 400000,
    requirement: "4 consecutive profitable months",
    profitReq: "15%+ total profit",
    months: 4,
    benefits: ["90% profit split", "On-demand payouts", "VIP support"],
    active: false,
    completed: false,
  },
];

export default function ScalingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Scaling <span className="gradient-text">Plan</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Grow your funded account with consistent performance
          </p>
        </div>

        <PageTransition>
          {/* Current progress card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8 rounded-3xl border border-gold/20 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-gold" />
                  <h2 className="font-display text-lg font-bold text-white">Your Progress</h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Currently at $50K - working toward $100K tier
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Profitable Months</div>
                  <div className="font-display text-xl font-bold text-gold">1 / 2</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Current Profit</div>
                  <div className="font-display text-xl font-bold text-emerald2-400">+6.8%</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Scaling progress</span>
                <span className="text-gold">50%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-amber-400"
                  style={{ width: "50%" }}
                />
              </div>
            </div>
          </motion.div>

          {/* Scaling timeline */}
          <div className="mb-8">
            <h3 className="mb-6 font-display text-xl font-bold text-white">Scaling Tiers</h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 h-full w-px bg-white/10 sm:left-1/2" />

              <div className="space-y-6">
                {scalingTiers.map((tier, i) => (
                  <motion.div
                    key={tier.size}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
                    className="relative flex items-start gap-4 sm:gap-0"
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-full border-2 ${
                          tier.completed
                            ? "border-emerald2-400 bg-emerald2-400/10"
                            : tier.active
                            ? "border-gold bg-gold/10"
                            : "border-white/20 bg-bg-deep"
                        }`}
                      >
                        {tier.completed ? (
                          <CheckCircle className="h-5 w-5 text-emerald2-400" />
                        ) : (
                          <span className="font-display text-sm font-bold text-gold">
                            {tier.size}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content card */}
                    <div
                      className={`flex-1 rounded-3xl border p-5 backdrop-blur-xl sm:w-[calc(50%-3rem)] ${
                        tier.active
                          ? "border-gold/30 bg-gold/5"
                          : "border-white/10 bg-bg-soft/50"
                      } ${i % 2 === 0 ? "sm:mr-auto sm:pr-8" : "sm:ml-auto sm:pl-8"}`}
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-lg font-bold text-white">{tier.size} Account</h4>
                        {tier.active && (
                          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">
                            CURRENT TARGET
                          </span>
                        )}
                        {tier.completed && (
                          <span className="rounded-full bg-emerald2-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald2-400">
                            COMPLETED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{tier.requirement}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Min: {tier.profitReq}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tier.benefits.map((benefit) => (
                          <span
                            key={benefit}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                          >
                            {benefit}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Benefits of scaling */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-gold" />
              <h3 className="font-display text-lg font-bold text-white">Benefits of Scaling</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Higher Profit Split", desc: "Up to 90% of your profits as you scale" },
                { title: "Larger Capital", desc: "Trade with up to $400K in funded capital" },
                { title: "Faster Payouts", desc: "From bi-weekly to on-demand withdrawals" },
                { title: "VIP Support", desc: "Dedicated account manager at higher tiers" },
                { title: "No Extra Cost", desc: "Scale for free based on performance alone" },
                { title: "Compounding Growth", desc: "Your skills grow alongside your account" },
              ].map((item, i) => (
                <div key={item.title} className="flex items-start gap-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </PageTransition>
      </div>
    </div>
  );
}
