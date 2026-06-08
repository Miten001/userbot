"use client";

import { motion } from "framer-motion";
import { BadgeCheck, DollarSign, Calendar, CreditCard } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type PayoutProof = {
  id: number;
  name: string;
  amount: number;
  date: string;
  method: string;
  accountSize: string;
};

const payoutProofs: PayoutProof[] = [
  { id: 1, name: "Marcus W.", amount: 8420, date: "2024-01-15", method: "Bank Transfer", accountSize: "$100K" },
  { id: 2, name: "Aisha K.", amount: 5280, date: "2024-01-12", method: "Crypto (USDT)", accountSize: "$50K" },
  { id: 3, name: "Dmitri S.", amount: 12650, date: "2024-01-10", method: "Bank Transfer", accountSize: "$200K" },
  { id: 4, name: "Sophia L.", amount: 3890, date: "2024-01-08", method: "PayPal", accountSize: "$50K" },
  { id: 5, name: "Raj P.", amount: 7210, date: "2024-01-05", method: "Crypto (BTC)", accountSize: "$100K" },
  { id: 6, name: "Elena M.", amount: 4560, date: "2024-01-03", method: "Bank Transfer", accountSize: "$50K" },
  { id: 7, name: "Tyler J.", amount: 15300, date: "2023-12-28", method: "Bank Transfer", accountSize: "$200K" },
  { id: 8, name: "Yuki T.", amount: 6780, date: "2023-12-25", method: "Crypto (USDT)", accountSize: "$100K" },
  { id: 9, name: "Omar H.", amount: 9140, date: "2023-12-22", method: "Bank Transfer", accountSize: "$100K" },
  { id: 10, name: "Liam O.", amount: 2950, date: "2023-12-20", method: "PayPal", accountSize: "$50K" },
];

const totalPaidOut = payoutProofs.reduce((sum, p) => sum + p.amount, 0);

export default function PayoutProofPage() {
  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Payout <span className="gradient-text">Proof</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Verified payouts to our funded traders
          </p>
        </div>

        <PageTransition>
          {/* Total paid out */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8 rounded-3xl border border-gold/20 bg-bg-soft/50 p-8 text-center backdrop-blur-xl"
          >
            <DollarSign className="mx-auto h-8 w-8 text-gold" />
            <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Total Paid Out</div>
            <div className="mt-2 font-display text-4xl font-bold text-white">
              ${totalPaidOut.toLocaleString()}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Across {payoutProofs.length} verified payouts to traders worldwide
            </p>
          </motion.div>

          {/* Payout proof grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {payoutProofs.map((proof, i) => (
              <motion.div
                key={proof.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gold/10">
                      <span className="font-display text-sm font-bold text-gold">
                        {proof.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-white">{proof.name}</div>
                      <div className="text-[11px] text-slate-500">{proof.accountSize} Account</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-emerald2-400/10 px-2 py-0.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald2-400" />
                    <span className="text-[10px] font-bold text-emerald2-400">VERIFIED</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </div>
                    <div className="mt-0.5 font-display text-lg font-bold text-emerald2-400">
                      +${proof.amount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <Calendar className="h-3 w-3" />
                      Date
                    </div>
                    <div className="mt-0.5 text-sm text-slate-300">
                      {new Date(proof.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs text-slate-400">{proof.method}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
