"use client";

import { motion } from "framer-motion";
import { Swords, Trophy, Clock, Users, DollarSign } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type Competition = {
  id: string;
  name: string;
  prizePool: number;
  participants: number;
  maxParticipants: number;
  entryFee: number;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "completed";
  winner?: string;
};

const DEMO_COMPETITIONS: Competition[] = [
  {
    id: "comp-001",
    name: "January Profit Sprint",
    prizePool: 10000,
    participants: 234,
    maxParticipants: 500,
    entryFee: 25,
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    status: "active",
  },
  {
    id: "comp-002",
    name: "February Scalping Challenge",
    prizePool: 5000,
    participants: 89,
    maxParticipants: 300,
    entryFee: 15,
    startDate: "2025-02-01",
    endDate: "2025-02-28",
    status: "upcoming",
  },
  {
    id: "comp-003",
    name: "December Grand Prix",
    prizePool: 15000,
    participants: 412,
    maxParticipants: 500,
    entryFee: 50,
    startDate: "2024-12-01",
    endDate: "2024-12-31",
    status: "completed",
    winner: "Marcus W.",
  },
];

type UserHistory = {
  competitionName: string;
  placement: number;
  profit: number;
  prize: number;
};

const DEMO_USER_HISTORY: UserHistory[] = [
  { competitionName: "December Grand Prix", placement: 12, profit: 8.4, prize: 0 },
  { competitionName: "November Challenge", placement: 5, profit: 14.2, prize: 250 },
  { competitionName: "October Showdown", placement: 3, profit: 18.9, prize: 1500 },
];

function getTimeRemaining(endDate: string) {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h remaining`;
}

export default function CompetitionsPage() {
  const active = DEMO_COMPETITIONS.filter((c) => c.status === "active" || c.status === "upcoming");
  const past = DEMO_COMPETITIONS.filter((c) => c.status === "completed");

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Trading <span className="gradient-text">Competitions</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Compete with other traders for cash prizes and bragging rights</p>
        </div>

        <PageTransition>
          {/* Stats row */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Swords className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Active Competitions</div>
              <div className="mt-1 font-display text-xl font-bold text-white">{active.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <DollarSign className="mx-auto h-5 w-5 text-emerald2-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Total Prize Pool</div>
              <div className="mt-1 font-display text-xl font-bold text-emerald2-400">$30,000</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Trophy className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Your Best Finish</div>
              <div className="mt-1 font-display text-xl font-bold text-gold">#3</div>
            </div>
          </div>

          {/* Active & Upcoming Competitions */}
          <div className="mb-8">
            <h2 className="mb-4 font-display text-xl font-bold text-white">Active & Upcoming</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {active.map((comp, i) => (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className="rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">{comp.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(comp.endDate)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      comp.status === "active"
                        ? "bg-emerald2/10 text-emerald2-400 border border-emerald2/30"
                        : "bg-royal/10 text-royal-400 border border-royal/30"
                    }`}>
                      {comp.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Prize Pool</div>
                      <div className="font-display text-sm font-bold text-gold">${comp.prizePool.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Participants</div>
                      <div className="font-display text-sm font-bold text-white">{comp.participants}/{comp.maxParticipants}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Entry Fee</div>
                      <div className="font-display text-sm font-bold text-white">${comp.entryFee}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Ends</div>
                      <div className="font-display text-sm font-bold text-slate-300">
                        {new Date(comp.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                      <span>Spots Filled</span>
                      <span>{Math.round((comp.participants / comp.maxParticipants) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-gold to-amber-500"
                        style={{ width: `${(comp.participants / comp.maxParticipants) * 100}%` }}
                      />
                    </div>
                  </div>

                  <button className="mt-4 w-full rounded-xl border border-gold/30 bg-gold/10 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/20">
                    {comp.status === "active" ? "Join Competition" : "Register"}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Past Competitions */}
          <div className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-bold text-white">Past Competitions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Competition</th>
                    <th className="px-3 py-2 font-semibold">Winner</th>
                    <th className="px-3 py-2 font-semibold">Prize Pool</th>
                    <th className="px-3 py-2 font-semibold">Participants</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((comp) => (
                    <tr key={comp.id} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-white">{comp.name}</td>
                      <td className="px-3 py-3 text-gold">{comp.winner}</td>
                      <td className="px-3 py-3 font-semibold text-emerald2-400">${comp.prizePool.toLocaleString()}</td>
                      <td className="px-3 py-3 text-slate-300">{comp.participants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User competition history */}
          <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-bold text-white">Your History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Competition</th>
                    <th className="px-3 py-2 font-semibold">Placement</th>
                    <th className="px-3 py-2 font-semibold">Profit %</th>
                    <th className="px-3 py-2 font-semibold">Prize Won</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_USER_HISTORY.map((entry, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-white">{entry.competitionName}</td>
                      <td className="px-3 py-3">
                        <span className={`font-display font-bold ${entry.placement <= 3 ? "text-gold" : "text-slate-300"}`}>
                          #{entry.placement}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald2-400">+{entry.profit}%</td>
                      <td className="px-3 py-3 font-semibold text-gold">
                        {entry.prize > 0 ? `$${entry.prize.toLocaleString()}` : "-"}
                      </td>
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
