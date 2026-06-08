"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { PieChart, TrendingDown, TrendingUp, Clock, Target, BarChart3 } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

const stats = {
  winRate: 68.4,
  avgProfit: 142.5,
  bestPair: "EUR/USD",
  worstPair: "GBP/JPY",
  avgHoldingTime: "4h 23m",
  maxDrawdown: 4.8,
  profitFactor: 2.14,
  sharpeRatio: 1.87,
  totalTrades: 234,
  winningTrades: 160,
  losingTrades: 74,
};

const drawdownData = [
  0, -0.5, -1.2, -0.8, -2.1, -3.4, -4.8, -3.2, -2.5, -1.8,
  -0.9, -1.5, -2.8, -2.2, -1.1, -0.4, -1.7, -3.1, -2.4, -1.6,
  -0.7, -1.3, -2.6, -1.9, -0.8, -0.3, -1.1, -2.0, -1.4, -0.5,
];

const equityData = [
  10000, 10142, 10285, 10190, 10420, 10580, 10350, 10490, 10680, 10820,
  10750, 10930, 11050, 10980, 11200, 11350, 11280, 11450, 11600, 11520,
  11700, 11850, 11780, 11950, 12100, 12050, 12230, 12380, 12500, 12650,
];

const pairPerformance = [
  { pair: "EUR/USD", profit: 3240, trades: 58, winRate: 74 },
  { pair: "GBP/USD", profit: 1850, trades: 42, winRate: 69 },
  { pair: "USD/JPY", profit: 1420, trades: 38, winRate: 65 },
  { pair: "XAU/USD", profit: 980, trades: 31, winRate: 61 },
  { pair: "GBP/JPY", profit: -420, trades: 28, winRate: 46 },
  { pair: "AUD/USD", profit: 560, trades: 22, winRate: 63 },
];

function DrawdownChart() {
  const id = useId();
  const width = 400;
  const height = 120;
  const padding = 4;
  const maxDD = 5;
  const points = drawdownData.map((d, i) => {
    const x = padding + (i / (drawdownData.length - 1)) * (width - padding * 2);
    const y = padding + ((Math.abs(d) / maxDD) * (height - padding * 2));
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`dd-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding},${padding} ${points} ${width - padding},${padding}`}
        fill={`url(#dd-grad-${id})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke="#f43f5e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EquityMiniChart() {
  const id = useId();
  const width = 400;
  const height = 120;
  const padding = 4;
  const min = Math.min(...equityData);
  const max = Math.max(...equityData);
  const range = max - min || 1;
  const points = equityData.map((d, i) => {
    const x = padding + (i / (equityData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`eq-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill={`url(#eq-grad-${id})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WinRateDonut({ rate }: { rate: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#donut-grad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="donut-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <div className="font-display text-2xl font-bold text-white">{rate}%</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Win Rate</div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Trading <span className="gradient-text">Stats</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Advanced analytics and performance metrics
          </p>
        </div>

        <PageTransition>
          {/* Top stats grid */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Trades", value: stats.totalTrades.toString(), icon: BarChart3, color: "text-gold" },
              { label: "Profit Factor", value: stats.profitFactor.toFixed(2), icon: TrendingUp, color: "text-emerald2-400" },
              { label: "Sharpe Ratio", value: stats.sharpeRatio.toFixed(2), icon: Target, color: "text-royal-400" },
              { label: "Max Drawdown", value: `${stats.maxDrawdown}%`, icon: TrendingDown, color: "text-rose2-400" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
              >
                <item.icon className={`mb-2 h-5 w-5 ${item.color}`} />
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{item.label}</div>
                <div className={`mt-1 font-display text-xl font-bold ${item.color}`}>{item.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Win rate and key metrics */}
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Win rate donut */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col items-center rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
            >
              <WinRateDonut rate={stats.winRate} />
              <div className="mt-4 grid w-full grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Winning</div>
                  <div className="font-display text-sm font-bold text-emerald2-400">{stats.winningTrades}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Losing</div>
                  <div className="font-display text-sm font-bold text-rose2-400">{stats.losingTrades}</div>
                </div>
              </div>
            </motion.div>

            {/* Key performance metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl lg:col-span-2"
            >
              <h3 className="mb-4 font-display text-lg font-bold text-white">Key Metrics</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Avg Profit/Trade</div>
                  <div className="mt-1 font-display text-lg font-bold text-emerald2-400">+${stats.avgProfit}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Best Pair</div>
                  <div className="mt-1 font-display text-lg font-bold text-gold">{stats.bestPair}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Worst Pair</div>
                  <div className="mt-1 font-display text-lg font-bold text-rose2-400">{stats.worstPair}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Avg Holding Time</div>
                  <div className="mt-1 flex items-center gap-1 font-display text-lg font-bold text-white">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {stats.avgHoldingTime}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Profit Factor</div>
                  <div className="mt-1 font-display text-lg font-bold text-gold">{stats.profitFactor}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Sharpe Ratio</div>
                  <div className="mt-1 font-display text-lg font-bold text-royal-400">{stats.sharpeRatio}</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Equity Curve */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
            >
              <h3 className="mb-4 font-display text-lg font-bold text-white">Equity Curve</h3>
              <div className="h-32">
                <EquityMiniChart />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>30 days ago</span>
                <span className="text-emerald2-400">+$2,650</span>
                <span>Today</span>
              </div>
            </motion.div>

            {/* Drawdown Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
            >
              <h3 className="mb-4 font-display text-lg font-bold text-white">Drawdown</h3>
              <div className="h-32">
                <DrawdownChart />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>30 days ago</span>
                <span className="text-rose2-400">Max: -{stats.maxDrawdown}%</span>
                <span>Today</span>
              </div>
            </motion.div>
          </div>

          {/* Pair performance table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-gold" />
              <h3 className="font-display text-lg font-bold text-white">Pair Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Pair</th>
                    <th className="px-3 py-2 font-semibold">Trades</th>
                    <th className="px-3 py-2 font-semibold">Win Rate</th>
                    <th className="px-3 py-2 font-semibold">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {pairPerformance.map((pair) => (
                    <tr key={pair.pair} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-white">{pair.pair}</td>
                      <td className="px-3 py-3 text-slate-300">{pair.trades}</td>
                      <td className="px-3 py-3 text-slate-300">{pair.winRate}%</td>
                      <td className={`px-3 py-3 font-semibold ${pair.profit >= 0 ? "text-emerald2-400" : "text-rose2-400"}`}>
                        {pair.profit >= 0 ? "+" : ""}${pair.profit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </PageTransition>
      </div>
    </div>
  );
}
