"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown, ChevronRight, ShieldCheck, TrendingUp, Wallet,
  Banknote, Activity, Info,
} from "lucide-react";

type Account = {
  id: string;
  mt5_login: string;
  mt5_server: string;
  balance_usd: number;
  equity_usd: number;
  phase: string;
  step_index: number;
  profit_target_pct: number;
  daily_loss_pct: number;
  overall_loss_pct: number;
  challenge?: {
    step: string;
    account_size_usd: number;
    state: string;
  };
};

const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo-1",
    mt5_login: "10458321",
    mt5_server: "ApexFunded-Demo",
    balance_usd: 50_000,
    equity_usd: 52_412,
    phase: "evaluation",
    step_index: 1,
    profit_target_pct: 8,
    daily_loss_pct: 5,
    overall_loss_pct: 10,
    challenge: { step: "two", account_size_usd: 50_000, state: "active" },
  },
];

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account")
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setAccounts(data.accounts ?? []);
          setDemo(false);
        } else {
          // 401 / 500 / API not configured — fall back to demo data.
          setAccounts(DEMO_ACCOUNTS);
          setDemo(true);
        }
      })
      .catch(() => {
        setAccounts(DEMO_ACCOUNTS);
        setDemo(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden pt-12 pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl px-6 sm:px-10">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-gold">
              ← Back to site
            </Link>
            <h1 className="h-display mt-2 text-4xl sm:text-5xl">
              Trader <span className="gradient-text">Dashboard</span>
            </h1>
          </div>
          <Link href="/#plans" className="btn-primary">
            <Crown className="h-4 w-4" />
            Buy Another Challenge
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode active.</strong>
              {" "}
              You&apos;re seeing simulated data. Add Stripe + Supabase env vars
              in Vercel to switch to live mode and see real accounts.{" "}
              <Link href="/admin/setup" className="font-semibold text-gold underline">
                Setup status →
              </Link>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : accounts && accounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

function AccountCard({ account: a }: { account: Account }) {
  const profitPct = a.balance_usd
    ? ((a.equity_usd - a.balance_usd) / a.balance_usd) * 100
    : 0;
  const profitUsd = a.equity_usd - a.balance_usd;
  const up = profitPct >= 0;
  const targetUsd = a.balance_usd * (a.profit_target_pct / 100);
  const targetProgress = Math.min(100, Math.max(0, (profitUsd / targetUsd) * 100));

  return (
    <div className="ring-conic relative overflow-hidden rounded-3xl">
      <div className="relative h-full rounded-3xl border border-white/10 bg-bg-soft/70 p-6 backdrop-blur-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Crown className="h-3 w-3 text-gold" />
              {a.challenge?.step?.toUpperCase()}-STEP · {a.phase.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-3xl font-bold gradient-text">
              ${a.balance_usd.toLocaleString()}
            </div>
          </div>
          <div className="rounded-full border border-emerald2/30 bg-emerald2/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald2-400">
            Active
          </div>
        </div>

        {/* Equity + P/L */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat icon={Wallet} label="Equity" value={`$${a.equity_usd.toLocaleString()}`} />
          <Stat
            icon={TrendingUp}
            label="P/L"
            value={`${up ? "+" : ""}$${profitUsd.toLocaleString()}`}
            tone={up ? "good" : "bad"}
            sub={`${up ? "+" : ""}${profitPct.toFixed(2)}%`}
          />
        </div>

        {/* Progress to target */}
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>Profit target progress</span>
            <span className="font-semibold text-gold">{targetProgress.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold via-rose2-400 to-emerald2-400"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>Need ${targetUsd.toLocaleString()} profit</span>
            <span>{a.profit_target_pct}% target</span>
          </div>
        </div>

        {/* Risk rules */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <Pill label="Max Daily" value={`${a.daily_loss_pct}%`} />
          <Pill label="Max Overall" value={`${a.overall_loss_pct}%`} />
        </div>

        {/* MT5 creds */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            MT5 Credentials
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400">Login:</span>
            <span className="font-mono font-semibold">{a.mt5_login}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-slate-400">Server:</span>
            <span className="font-mono">{a.mt5_server}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub, tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
      {sub && <div className={`text-[11px] font-semibold ${color}`}>{sub}</div>}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-12 text-center backdrop-blur-xl">
      <Banknote className="mx-auto h-10 w-10 text-gold" />
      <h3 className="font-display mt-4 text-2xl font-bold">No active challenges</h3>
      <p className="mt-2 max-w-md mx-auto text-sm text-slate-400">
        You don&apos;t have any funded accounts yet. Pick a plan to get started.
      </p>
      <Link href="/#plans" className="btn-primary mt-6 inline-flex">
        <Crown className="h-4 w-4" />
        Browse Plans
      </Link>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]"
        />
      ))}
    </div>
  );
}
