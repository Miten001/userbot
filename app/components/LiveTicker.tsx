"use client";

const pairs = [
  { symbol: "XAUUSD", price: "2,341.50", change: "+1.24%" },
  { symbol: "EURUSD", price: "1.0847", change: "+0.18%" },
  { symbol: "GBPUSD", price: "1.2715", change: "-0.32%" },
  { symbol: "USDJPY", price: "154.82", change: "+0.45%" },
  { symbol: "BTCUSD", price: "67,842", change: "+2.61%" },
  { symbol: "ETHUSD", price: "3,521", change: "+1.87%" },
  { symbol: "AUDUSD", price: "0.6612", change: "-0.14%" },
  { symbol: "USDCAD", price: "1.3645", change: "-0.22%" },
  { symbol: "GBPJPY", price: "196.84", change: "+0.53%" },
  { symbol: "XAGUSD", price: "29.42", change: "+0.91%" },
];

export default function LiveTicker() {
  return (
    <div className="relative w-full h-8 overflow-hidden border-b border-white/[0.06] bg-bg-deep/95 backdrop-blur-md z-[60]">
      <div className="flex animate-marquee whitespace-nowrap h-full items-center">
        {[...pairs, ...pairs].map((pair, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-4 text-xs">
            <span className="font-medium text-slate-400">{pair.symbol}</span>
            <span className="text-slate-300">{pair.price}</span>
            <span
              className={
                pair.change.startsWith("+")
                  ? "text-emerald2 font-medium"
                  : "text-rose2 font-medium"
              }
            >
              {pair.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
