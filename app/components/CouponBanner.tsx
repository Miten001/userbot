"use client";

const promos = [
  { text: "Use code APEX10 for 10% off all challenges!", highlight: "APEX10" },
  { text: "Limited time: 15% off with code FUNDED15", highlight: "FUNDED15" },
  { text: "New traders get 20% off - code WELCOME20", highlight: "WELCOME20" },
  { text: "Flash Sale: Use APEX10 at checkout for instant savings", highlight: "APEX10" },
  { text: "Join 5,000+ funded traders - code FUNDED15 for 15% off", highlight: "FUNDED15" },
];

export default function CouponBanner() {
  return (
    <div className="relative w-full h-9 overflow-hidden border-b border-gold/20 bg-bg-deep/95 backdrop-blur-md z-[60]">
      {/* Subtle gold gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold/[0.03] via-transparent to-gold/[0.03] pointer-events-none" />

      <div className="flex animate-marquee whitespace-nowrap h-full items-center">
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
