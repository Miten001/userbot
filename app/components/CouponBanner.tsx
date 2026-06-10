"use client";

const promos = [
  { text: "Use code APEX45 for 45% OFF all challenges!", highlight: "APEX45" },
  { text: "FIRST1000: 2-Phase $5,000 account for just $6 - first 1000 customers only!", highlight: "FIRST1000" },
  { text: "Massive 45% discount with code APEX45 - limited time!", highlight: "APEX45" },
  { text: "Grab a $5,000 funded account for only $6 - use code FIRST1000 at checkout!", highlight: "FIRST1000" },
];

export default function CouponBanner() {
  return (
    <div className="relative w-full h-9 overflow-hidden border-b border-gold/20 bg-bg-deep/95 backdrop-blur-sm z-[60]">
      {/* Subtle gold gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold/[0.03] via-transparent to-gold/[0.03] pointer-events-none" />

      <div className="flex animate-marquee whitespace-nowrap h-full items-center" style={{ willChange: 'transform' }}>
        {[...promos, ...promos].map((promo, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6 text-xs">
            <span className="text-gold-400">&#9733;</span>
            <span className="text-slate-300">
              {promo.text.split(promo.highlight).map((part, j, arr) => (
                <span key={j}>
                  {part}
                  {j < arr.length - 1 && (
                    <span className="font-bold text-gold-400 bg-gold/10 px-1.5 py-0.5 rounded">
                      {promo.highlight}
                    </span>
                  )}
                </span>
              ))}
            </span>
            <span className="text-gold-400">&#9733;</span>
          </span>
        ))}
      </div>
    </div>
  );
}
