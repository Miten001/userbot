"use client";

import { motion } from "framer-motion";

const partners = [
  "MetaTrader 5",
  "cTrader",
  "TradingView",
  "MatchTrader",
  "DXtrade",
  "TradeLocker",
  "Eightcap",
  "IC Markets",
];

export default function Partners() {
  return (
    <section className="section">
      <div className="text-center mb-14">
        <p className="chip-gold mb-4 mx-auto w-fit">Integrations</p>
        <h2 className="h-display text-3xl sm:text-4xl gradient-text">
          Trusted by Top Platforms
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-slate-400 text-sm leading-relaxed">
          We integrate with the industry&apos;s most respected trading platforms and brokers.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {partners.map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-gold/30 transition-colors group"
          >
            <span className="h-3 w-3 rounded-full bg-gold/60 mb-3 group-hover:bg-gold transition-colors" />
            <span className="font-display text-base font-semibold text-slate-200 group-hover:text-gold transition-colors">
              {name}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
