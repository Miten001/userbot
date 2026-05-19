"use client";

import { motion } from "framer-motion";
import { Star, Quote, Crown } from "lucide-react";

const items = [
  {
    name: "Arjun M.",
    role: "Funded Trader · India",
    avatar: "AM",
    color: "from-gold to-rose2",
    rating: 5,
    payout: "$18,420",
    quote:
      "Passed the $100K challenge in 9 days. Got my first payout in 18 hours. The dashboard is the cleanest I've used.",
  },
  {
    name: "Sara K.",
    role: "Elite Trader · UAE",
    avatar: "SK",
    color: "from-gold-glow via-gold to-gold-500",
    rating: 5,
    payout: "$32,810",
    elite: true,
    quote:
      "The 90% split changed everything for me. Scaled from $50K to $400K in six months. Real liquidity, no slippage games.",
  },
  {
    name: "Marco R.",
    role: "Funded Trader · Brazil",
    avatar: "MR",
    color: "from-royal to-emerald2",
    rating: 5,
    payout: "$9,540",
    quote:
      "I run my EA 24/7 — zero issues, zero hidden rules. Their support team actually answers in minutes, not days.",
  },
  {
    name: "Liu W.",
    role: "Funded Trader · Singapore",
    avatar: "LW",
    color: "from-emerald2 to-gold",
    rating: 5,
    payout: "$24,000",
    quote:
      "Finally a prop firm that doesn't punish you for making money fast. No min days, no time pressure. Just trade.",
  },
  {
    name: "Emma D.",
    role: "Funded Trader · UK",
    avatar: "ED",
    color: "from-royal-400 to-rose2",
    rating: 5,
    payout: "$12,300",
    quote:
      "I've tried 5 prop firms. ApexFunded is the only one where the rules feel built for traders, not against them.",
  },
  {
    name: "Yusuf A.",
    role: "Elite Trader · Turkey",
    avatar: "YA",
    color: "from-gold via-rose2 to-royal",
    rating: 5,
    payout: "$41,200",
    elite: true,
    quote:
      "Withdrew via USDT in less than 2 hours. Already running on a $200K account after passing twice. Highly recommended.",
  },
];

export default function Testimonials() {
  return (
    <section className="section">
      <div className="mb-12 flex flex-col items-center text-center">
        <span className="chip-gold">
          <Crown className="h-3.5 w-3.5" />
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
            className={`group relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl transition-colors ${
              t.elite
                ? "border-gold/30 bg-gradient-to-br from-gold/[0.06] to-transparent hover:border-gold/50"
                : "border-white/10 bg-white/[0.025] hover:border-white/20"
            }`}
          >
            <Quote className="absolute right-5 top-5 h-7 w-7 text-white/[0.06]" />

            {t.elite && (
              <div className="absolute -right-8 top-6 rotate-45 bg-gold-gradient px-10 py-1 text-[10px] font-bold uppercase tracking-wider text-bg-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                Elite
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br ${t.color} font-display text-sm font-bold text-bg-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]`}
              >
                {t.avatar}
              </span>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  {t.name}
                  {t.elite && (
                    <Crown className="h-3.5 w-3.5 text-gold" />
                  )}
                </div>
                <div className="text-xs text-slate-400">{t.role}</div>
              </div>
            </div>

            {/* Stars */}
            <div className="mt-4 flex items-center gap-0.5">
              {Array.from({ length: t.rating }).map((_, k) => (
                <Star
                  key={k}
                  className="h-4 w-4 fill-gold text-gold"
                />
              ))}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {t.quote}
            </p>

            {/* Payout pill */}
            <div
              className={`mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
                t.elite
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-emerald2/30 bg-emerald2/10 text-emerald2-400"
              }`}
            >
              Last payout · {t.payout}
            </div>

            {/* Hover gradient line */}
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
