"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown, ChevronRight, ShieldCheck, TrendingUp, Wallet,
  Banknote, Info, BarChart3, ArrowUpRight, ArrowDownRight,
  Send, Eye,
} from "lucide-react";
import {
  Account, Profile, Payout, Trade,
  DEMO_ACCOUNTS, DEMO_PROFILE, DEMO_PAYOUTS, DEMO_TRADES, fmtDate,
} from "./data";

export default function DashboardOverview() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account", { cache: "no-store" });
        if (!r.ok) throw new Error("not configured");
        const data = await r.json();
        setAccounts(data.accounts ?? []);
        setDemo(false);

        const [pr, po, tr] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/payouts", { cache: "no-store" }),
          fetch("/api/trades", { cache: "no-store" }),
        ]);
        if (pr.ok) { const pd = await pr.json(); setProfile(pd.profile); }
        if (po.ok) setPayouts((await po.json()).payouts ?? []);
        if (tr.ok) setTrades((await tr.json()).trades ?? []);
      } catch {
        setAccounts(DEMO_ACCOUNTS);
        setProfile(DEMO_PROFILE);
        setPayouts(DEMO_PAYOUTS);
        setTrades(DEMO_TRADES);
        setDemo(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalBalance = accounts?.reduce((s, a) => s + a.balance_usd, 0) ?? 0;
  const totalPnl = accounts?.reduce((s, a) => s + (a.equity_usd - a.balance_usd), 0) ?? 0;
  const activeAccounts = accounts?.filter((a) => a.phase !== "breached" && a.phase !== "closed").length ?? 0;
  const recentTrades = trades.slice(0, 4);
  const recentPayouts = payouts.slice(0, 3);
  const fundedAccounts = accounts?.filter((a) => a.phase === "funded") ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="h-display text-4xl sm:text-5xl">
              Trader <span className="gradient-text">Dashboard</span>
            </h1>
            {profile?.full_name && (
              <p className="mt-1 text-sm text-slate-400">Welcome back, <span className="text-slate-200">{profile.full_name}</span></p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile?.is_admin && (
              <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-gold/40 hover:text-white">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Admin
              </Link>
            )}
            <Link href="/#plans" className="btn-primary">
              <Crown className="h-4 w-4" /> Buy Challenge <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode active.</strong>{" "}
              You&apos;re seeing simulated data. Add Razorpay/NOWPayments + Supabase env vars in Vercel to switch to live mode.{" "}
              <Link href="/admin/setup" className="font-semibold text-gold underline">Setup status</Link>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : (
          <>
            {/* Summary Stats */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={Wallet} label="Total Balance" value={`$${totalBalance.toLocaleString()}`} />
              <StatCard icon={TrendingUp} label="Total P/L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString()}`} tone={totalPnl >= 0 ? "good" : "bad"} />
              <StatCard icon={BarChart3} label="Active Accounts" value={activeAccounts} />
              <StatCard icon={ArrowUpRight} label="Recent Trades" value={trades.length} />
            </div>

            {/* Quick Actions */}
            <div className="mb-8 flex flex-wrap gap-3">
              <Link href="/#plans" className="btn-primary">
                <Crown className="h-4 w-4" /> Buy Challenge
              </Link>
              {fundedAccounts.length > 0 && (
                <Link href="/dashboard/payouts" className="btn-secondary">
                  <Send className="h-4 w-4" /> Withdraw
                </Link>
              )}
              <Link href="/dashboard/trades" className="btn-secondary">
                <Eye className="h-4 w-4" /> View Trades
              </Link>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Recent Trades */}
              <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-gold" />
                    <h2 className="font-display text-lg font-bold text-white">Recent Trades</h2>
                  </div>
                  <Link href="/dashboard/trades" className="text-xs text-gold hover:underline">View all</Link>
                </div>
                {recentTrades.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">No trades yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentTrades.map((t) => {
                      const pnl = t.profit_usd ?? 0;
                      const up = pnl >= 0;
                      const buy = t.side?.toLowerCase() === "buy";
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase ${buy ? "border-emerald2/30 bg-emerald2/10 text-emerald2-400" : "border-rose2/30 bg-rose2/10 text-rose2-400"}`}>
                              {buy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                              {t.side}
                            </span>
                            <div>
                              <span className="font-display text-sm font-bold text-white">{t.symbol}</span>
                              <span className="ml-2 text-[11px] text-slate-500">{t.opened_at ? fmtDate(t.opened_at) : ""}</span>
                            </div>
                          </div>
                          <span className={`font-display text-sm font-bold tabular-nums ${up ? "text-emerald2-400" : "text-rose2-400"}`}>
                            {t.profit_usd === null ? "-" : `${up ? "+" : ""}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Payouts */}
              <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-gold" />
                    <h2 className="font-display text-lg font-bold text-white">Recent Payouts</h2>
                  </div>
                  <Link href="/dashboard/payouts" className="text-xs text-gold hover:underline">View all</Link>
                </div>
                {recentPayouts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">No payouts yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentPayouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${p.status === "paid" ? "bg-emerald2/15 text-emerald2-400" : "bg-gold/15 text-gold"}`}>
                            {p.status === "paid" ? <ArrowUpRight className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                          </div>
                          <div>
                            <span className="font-display text-sm font-bold text-white">${p.amount_usd.toLocaleString()}</span>
                            <span className="ml-2 text-[11px] text-slate-500">{fmtDate(p.requested_at)}</span>
                          </div>
                        </div>
                        <PayoutBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Small components ---- */

function StatCard({ icon: Icon, label, value, tone = "neutral" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone?: "good" | "bad" | "neutral";
}) {
  const color = tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="ring-conic relative overflow-hidden rounded-2xl">
      <div className="relative rounded-2xl border border-white/10 bg-bg-soft/70 p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon className="h-3.5 w-3.5 text-gold" />
          {label}
        </div>
        <div className={`mt-2 font-display text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function PayoutBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "border-emerald2/30 bg-emerald2/10 text-emerald2-400",
    approved: "border-gold/30 bg-gold/10 text-gold",
    requested: "border-gold/30 bg-gold/10 text-gold",
    rejected: "border-rose2/30 bg-rose2/10 text-rose2-400",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? "border-white/10 bg-white/5 text-slate-400"}`}>{status}</span>;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />)}
    </div>
  );
}
