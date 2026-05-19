"use client";

import { motion } from "framer-motion";
import { Star, Sparkles, Quote } from "lucide-react";

const items = [
  {
    name: "Arjun M.",
    role: "Funded Trader · India",
    avatar: "AM",
    color: "from-accent to-accent-violet",
    rating: 5,
    payout: "$18,420",
    quote:
      "Passed the $100K challenge in 9 days. Got my first payout in 18 hours. The dashboard is the cleanest I've used.",
  },
  {
    name: "Sara K.",
    role: "Funded Trader · UAE",
    avatar: "SK",
    color: "from-accent-green to-accent",
    rating: 5,
    payout: "$32,810",
    quote:
      "The 90% split changed everything for me. Scaled from $50K to $400K in six months. Real liquidity, no slippage games.",
  },
  {
    name: "Marco R.",
    role: "Funded Trader · Brazil",
    avatar: "MR",
    color: "from-accent-violet to-accent-green",
    rating: 5,
    payout: "$9,540",
    quote:
      "I run my EA 24/7 — zero issues, zero hidden rules. Their support team actually answers in minutes, not days.",
  },
  {
    name: "Liu W.",
    role: "Funded Trader · Singapore",
    avatar: "LW",
    color: "from-accent to-accent-green",
    rating: 5,
    payout: "$24,000",
    quote:
      "Finally a prop firm that doesn't punish you for making money fast. No min days, no time pressure. Just trade.",
  },
  {
    name: "Emma D.",
    role: "Funded Trader · UK",
    avatar: "ED",
    color: "from-accent-violet to-accent",
    rating: 5,
    payout: "$12,300",
    quote:
      "I've tried 5 prop firms. ApexFunded is the only one where the rules feel built for traders, not against them.",
  },
  {
    name: "Yusuf A.",
    role: "Funded Trader · Turkey",
    avatar: "YA",
    color: "from-accent-green to-accent-violet",
    rating: 5,
    payout: "$41,200",
    quote:
      "Withdrew via USDT in less than 2 hours. Already running on a $200K account after passing twice. Highly recommended.",
  },
];

export default function Testimonials() {
  return (
    <section className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip">
          <Sparkles className="h-3.5 w-3.5 text-accent-green" />
          Trader Stories
        </span>
        <h2 className="h-display mt-4 text-4xl sm:text-5xl">
          Real traders. <span className="gradient-text">Real payouts.</span>
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Join thousands of traders who turned their edge into a career.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <motion.article
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-xl transition-colors hover:border-white/20"
          >
            <Quote className="absolute right-5 top-5 h-7 w-7 text-white/[0.06]" />

            {/* Header */}
            <div className="flex items-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${t.color} font-display text-sm font-bold text-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]`}
              >
                {t.avatar}
              </span>
              <div>
                <div className="font-semibold text-white">{t.name}</div>
                <div className="text-xs text-slate-400">{t.role}</div>
              </div>
            </div>

            {/* Stars */}
            <div className="mt-4 flex items-center gap-0.5">
              {Array.from({ length: t.rating }).map((_, k) => (
                <Star
                  key={k}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
              ))}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {t.quote}
            </p>

            {/* Payout pill */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-xs font-semibold text-accent-green">
              Last payout · {t.payout}
            </div>

            {/* Hover gradient line */}
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
