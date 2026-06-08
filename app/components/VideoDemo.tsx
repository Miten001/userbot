"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";

export default function VideoDemo() {
  return (
    <section className="section">
      <div className="text-center mb-12">
        <h2 className="h-display text-3xl sm:text-4xl gradient-text">
          See the Platform in Action
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-slate-400 text-sm leading-relaxed">
          Watch how traders use ApexFunded to scale their trading careers with funded accounts up to $200K.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-4xl"
      >
        <div className="lux-card overflow-hidden rounded-3xl aspect-video relative group cursor-pointer">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-royal/20 via-transparent to-gold/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/80 via-transparent to-transparent" />

          {/* Grid pattern */}
          <div className="absolute inset-0 grid-bg opacity-40" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-gold/20 blur-xl animate-glow-pulse" />
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-gold/40 bg-bg-deep/80 backdrop-blur-xl shadow-gold transition-transform group-hover:scale-110">
                <Play className="h-8 w-8 text-gold ml-1" fill="currentColor" />
              </div>
            </div>
          </div>

          {/* Corner accents */}
          <div className="absolute top-4 left-4 h-8 w-8 border-t-2 border-l-2 border-gold/30 rounded-tl-lg" />
          <div className="absolute top-4 right-4 h-8 w-8 border-t-2 border-r-2 border-gold/30 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-gold/30 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-gold/30 rounded-br-lg" />
        </div>
      </motion.div>
    </section>
  );
}
