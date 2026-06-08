"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, TrendingUp, Users } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type Trader = {
  rank: number;
  name: string;
  profitPct: number;
  winRate: number;
  totalProfit: number;
  accountSize: number;
  country: string;
};

const DEMO_TRADERS: Trader[] = [
  { rank: 1, name: "Marcus W.", profitPct: 34.2, winRate: 78, totalProfit: 17100, accountSize: 50000, country: "US" },
  { rank: 2, name: "Aisha K.", profitPct: 29.8, winRate: 72, totalProfit: 29800, accountSize: 100000, country: "UK" },
  { rank: 3, name: "Dmitri S.", profitPct: 27.5, winRate: 69, totalProfit: 13750, accountSize: 50000, country: "DE" },
  { rank: 4, name: "Sophia L.", profitPct: 24.1, winRate: 74, totalProfit: 24100, accountSize: 100000, country: "CA" },
  { rank: 5, name: "Raj P.", profitPct: 22.6, winRate: 66, totalProfit: 11300, accountSize: 50000, country: "IN" },
  { rank: 6, name: "Elena M.", profitPct: 21.3, winRate: 71, totalProfit: 21300, accountSize: 100000, country: "ES" },
  { rank: 7, name: "Tyler J.", profitPct: 19.8, winRate: 63, totalProfit: 4950, accountSize: 25000, country: "US" },
  { rank: 8, name: "Yuki T.", profitPct: 18.4, winRate: 68, totalProfit: 9200, accountSize: 50000, country: "JP" },
  { rank: 9, name: "Omar H.", profitPct: 17.9, winRate: 65, totalProfit: 17900, accountSize: 100000, country: "AE" },
  { rank: 10, name: "Liam O.", profitPct: 16.5, winRate: 62, totalProfit: 4125, accountSize: 25000, country: "IE" },
  { rank: 11, name: "Fatima A.", profitPct: 15.8, winRate: 67, totalProfit: 7900, accountSize: 50000, country: "SA" },
  { rank: 12, name: "Chen W.", profitPct: 14.2, winRate: 60, totalProfit: 14200, accountSize: 100000, country: "SG" },
  { rank: 13, name: "James B.", profitPct: 13.7, winRate: 64, totalProfit: 3425, accountSize: 25000, country: "AU" },
  { rank: 14, name: "Natalia V.", profitPct: 12.9, winRate: 61, totalProfit: 6450, accountSize: 50000, country: "BR" },
  { rank: 15, name: "Kevin N.", profitPct: 11.4, winRate: 58, totalProfit: 11400, accountSize: 100000, country: "FR" },
  { rank: 16, name: "Maria G.", profitPct: 10.8, winRate: 59, totalProfit: 2700, accountSize: 25000, country: "MX" },
  { rank: 17, name: "Ali R.", profitPct: 9.6, winRate: 57, totalProfit: 4800, accountSize: 50000, country: "PK" },
  { rank: 18, name: "Sarah C.", profitPct: 8.9, winRate: 56, totalProfit: 8900, accountSize: 100000, country: "US" },
];

const podiumColors = [
  "from-yellow-400 to-amber-600", // gold
  "from-slate-300 to-slate-500", // silver
  "from-amber-600 to-amber-800", // bronze
];

const podiumBorders = [
  "border-yellow-400/40",
  "border-slate-300/40",
  "border-amber-600/40",
];

export default function LeaderboardPage() {
  const top3 = DEMO_TRADERS.slice(0, 3);
  const rest = DEMO_TRADERS.slice(3);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Top <span className="gradient-text">Traders</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Monthly performance leaderboard ranking our best funded traders</p>
        </div>

        <PageTransition>
          {/* Stats row */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Users className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Active Traders</div>
              <div className="mt-1 font-display text-xl font-bold text-white">1,247</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <TrendingUp className="mx-auto h-5 w-5 text-emerald2-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Avg. Profit</div>
              <div className="mt-1 font-display text-xl font-bold text-emerald2-400">+14.6%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Trophy className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Total Payouts</div>
              <div className="mt-1 font-display text-xl font-bold text-white">$2.4M</div>
            </div>
          </div>

          {/* Podium - Top 3 */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((trader, i) => (
              <motion.div
                key={trader.rank}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className={`relative rounded-3xl border ${podiumBorders[i]} bg-bg-soft/50 p-6 text-center backdrop-blur-xl`}
              >
                <div className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${podiumColors[i]}`}>
                  <span className="font-display text-xl font-bold text-bg-deep">#{trader.rank}</span>
                </div>
                <h3 className="font-display text-lg font-bold text-white">{trader.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{trader.country}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Profit</div>
                    <div className="font-display text-sm font-bold text-emerald2-400">+{trader.profitPct}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Win Rate</div>
                    <div className="font-display text-sm font-bold text-white">{trader.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Total P/L</div>
                    <div className="font-display text-sm font-bold text-gold">+${trader.totalProfit.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Account</div>
                    <div className="font-display text-sm font-bold text-white">${(trader.accountSize / 1000)}K</div>
                  </div>
                </div>
                {i === 0 && (
                  <div className="absolute -top-2 right-4 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-bg-deep">
                    CHAMPION
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Rest of the leaderboard */}
          <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Medal className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-bold text-white">Rankings</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{DEMO_TRADERS.length} traders</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Trader</th>
                    <th className="px-3 py-2 font-semibold">Profit %</th>
                    <th className="px-3 py-2 font-semibold">Win Rate</th>
                    <th className="px-3 py-2 font-semibold">Total P/L</th>
                    <th className="px-3 py-2 font-semibold">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((trader) => (
                    <tr key={trader.rank} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-slate-400">#{trader.rank}</td>
                      <td className="px-3 py-3 font-display font-bold text-white">{trader.name}</td>
                      <td className="px-3 py-3 font-semibold text-emerald2-400">+{trader.profitPct}%</td>
                      <td className="px-3 py-3 text-slate-300">{trader.winRate}%</td>
                      <td className="px-3 py-3 font-semibold text-gold">+${trader.totalProfit.toLocaleString()}</td>
                      <td className="px-3 py-3 text-slate-300">${(trader.accountSize / 1000)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
