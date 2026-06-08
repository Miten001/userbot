"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Copy, CheckCircle2, DollarSign, Clock, Gift } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type Referral = {
  id: string;
  name: string;
  date: string;
  status: "active" | "pending" | "completed";
  commission: number;
};

const DEMO_REFERRALS: Referral[] = [
  { id: "ref-001", name: "John D.", date: "2025-01-05", status: "completed", commission: 45 },
  { id: "ref-002", name: "Emily R.", date: "2025-01-12", status: "active", commission: 60 },
  { id: "ref-003", name: "Mike T.", date: "2025-01-18", status: "pending", commission: 0 },
  { id: "ref-004", name: "Anna S.", date: "2024-12-28", status: "completed", commission: 35 },
  { id: "ref-005", name: "David L.", date: "2024-12-15", status: "completed", commission: 50 },
];

const REFERRAL_LINK = "https://apexfunded.com/ref/USER123";

const steps = [
  { icon: Copy, title: "Share Your Link", description: "Copy your unique referral link and share it with friends or on social media." },
  { icon: Users, title: "Friend Signs Up", description: "When someone uses your link to purchase a challenge, they get 10% off." },
  { icon: DollarSign, title: "Earn Commission", description: "You receive 15% commission on every successful referral purchase." },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);

  const totalReferrals = DEMO_REFERRALS.length;
  const earnedCommission = DEMO_REFERRALS.filter((r) => r.status === "completed").reduce((s, r) => s + r.commission, 0);
  const pendingCommission = DEMO_REFERRALS.filter((r) => r.status === "active").reduce((s, r) => s + r.commission, 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(REFERRAL_LINK).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Referral <span className="gradient-text">Program</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Earn commission by inviting traders to ApexFunded</p>
        </div>

        <PageTransition>
          {/* Referral Link */}
          <div className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-bold text-white">Your Referral Link</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-xl border border-white/10 bg-bg-deep/50 px-4 py-3 font-mono text-sm text-slate-300">
                {REFERRAL_LINK}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold/20"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Users className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Total Referrals</div>
              <div className="mt-1 font-display text-xl font-bold text-white">{totalReferrals}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <DollarSign className="mx-auto h-5 w-5 text-emerald2-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Earned Commission</div>
              <div className="mt-1 font-display text-xl font-bold text-emerald2-400">${earnedCommission}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Clock className="mx-auto h-5 w-5 text-royal-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Pending Commission</div>
              <div className="mt-1 font-display text-xl font-bold text-royal-400">${pendingCommission}</div>
            </div>
          </div>

          {/* How it works */}
          <div className="mb-8 rounded-3xl border border-white/10 bg-bg-soft/50 p-6 backdrop-blur-xl">
            <h2 className="mb-5 font-display text-xl font-bold text-white">How It Works</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  className="text-center"
                >
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gold/10 border border-gold/20">
                    <step.icon className="h-5 w-5 text-gold" />
                  </div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Step {i + 1}</div>
                  <h3 className="font-display text-sm font-bold text-white">{step.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Referral History */}
          <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              <h2 className="font-display text-xl font-bold text-white">Referral History</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{DEMO_REFERRALS.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">User</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_REFERRALS.map((ref) => (
                    <tr key={ref.id} className="border-t border-white/5">
                      <td className="px-3 py-3 font-display font-bold text-white">{ref.name}</td>
                      <td className="px-3 py-3 text-slate-400">
                        {new Date(ref.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ref.status === "completed"
                            ? "border-emerald2/30 bg-emerald2/10 text-emerald2-400"
                            : ref.status === "active"
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-slate-400/30 bg-slate-400/10 text-slate-400"
                        }`}>
                          {ref.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-emerald2-400">
                        {ref.commission > 0 ? `+$${ref.commission}` : "-"}
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
