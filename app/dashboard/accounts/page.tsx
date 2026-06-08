"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown, ChevronRight, Wallet, TrendingUp, Banknote,
  Send, X, Info,
} from "lucide-react";
import {
  Account, Payout, DEMO_ACCOUNTS, DEMO_PAYOUTS, WITHDRAW_METHODS,
} from "@/app/dashboard/data";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [withdrawFor, setWithdrawFor] = useState<Account | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const flash = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account", { cache: "no-store" });
        if (!r.ok) throw new Error("not configured");
        const data = await r.json();
        setAccounts(data.accounts ?? []);
        setDemo(false);
      } catch {
        setAccounts(DEMO_ACCOUNTS);
        setDemo(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="h-display text-4xl sm:text-5xl">
              My <span className="gradient-text">Accounts</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">Manage your trading accounts and challenges</p>
          </div>
          <Link href="/#plans" className="btn-primary">
            <Crown className="h-4 w-4" /> Buy Challenge <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode active.</strong>{" "}
              You&apos;re seeing simulated data.{" "}
              <Link href="/admin/setup" className="font-semibold text-gold underline">Setup status</Link>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : accounts && accounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onWithdraw={() => setWithdrawFor(a)} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {withdrawFor && (
        <WithdrawModal
          account={withdrawFor}
          demo={demo}
          onClose={() => setWithdrawFor(null)}
          onDone={() => {
            flash("ok", "Withdrawal request submitted.");
            setWithdrawFor(null);
          }}
          onError={(m) => flash("err", m)}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-xl ${toast.kind === "ok" ? "border-emerald2/40 bg-emerald2/15 text-emerald2-400" : "border-rose2/40 bg-rose2/15 text-rose2-400"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---- AccountCard ---- */

function AccountCard({ account: a, onWithdraw }: { account: Account; onWithdraw: () => void }) {
  const profitPct = a.balance_usd ? ((a.equity_usd - a.balance_usd) / a.balance_usd) * 100 : 0;
  const profitUsd = a.equity_usd - a.balance_usd;
  const up = profitPct >= 0;
  const targetUsd = a.balance_usd * (a.profit_target_pct / 100);
  const targetProgress = targetUsd > 0 ? Math.min(100, Math.max(0, (profitUsd / targetUsd) * 100)) : 100;
  const funded = a.phase === "funded";
  const breached = a.phase === "breached";

  return (
    <div className="ring-conic relative overflow-hidden rounded-3xl">
      <div className="relative h-full rounded-3xl border border-white/10 bg-bg-soft/70 p-6 backdrop-blur-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Crown className="h-3 w-3 text-gold" />
              {a.challenge?.step?.toUpperCase()}-STEP · {a.phase.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-3xl font-bold gradient-text">${a.balance_usd.toLocaleString()}</div>
          </div>
          <PhaseTag phase={a.phase} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat icon={Wallet} label="Equity" value={`$${a.equity_usd.toLocaleString()}`} />
          <Stat icon={TrendingUp} label="P/L" value={`${up ? "+" : ""}$${profitUsd.toLocaleString()}`} tone={up ? "good" : "bad"} sub={`${up ? "+" : ""}${profitPct.toFixed(2)}%`} />
        </div>

        {funded ? (
          <div className="mt-5 rounded-2xl border border-emerald2/20 bg-emerald2/[0.06] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-emerald2-400">Withdrawable profit · {a.profit_split_pct ?? 80}% split</div>
                <div className="mt-0.5 font-display text-xl font-bold text-emerald2-400">
                  ${Math.max(0, profitUsd * ((a.profit_split_pct ?? 80) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <button onClick={onWithdraw} className="inline-flex items-center gap-1.5 rounded-full border border-emerald2/40 bg-emerald2/15 px-4 py-2 text-xs font-semibold text-emerald2-400 hover:bg-emerald2/25">
                <Send className="h-3.5 w-3.5" /> Withdraw
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Profit target progress</span>
              <span className="font-semibold text-gold">{targetProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-gold via-rose2-400 to-emerald2-400" style={{ width: `${targetProgress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
              <span>{breached ? "Account breached" : `Need $${targetUsd.toLocaleString()} profit`}</span>
              <span>{a.profit_target_pct}% target</span>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <Pill label="Max Daily" value={`${a.daily_loss_pct}%`} />
          <Pill label="Max Overall" value={`${a.overall_loss_pct}%`} />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">MT5 Credentials</div>
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

/* ---- WithdrawModal ---- */

function WithdrawModal({ account, demo, onClose, onDone, onError }: {
  account: Account; demo: boolean;
  onClose: () => void; onDone: (po?: Payout) => void; onError: (m: string) => void;
}) {
  const profit = account.equity_usd - account.balance_usd;
  const split = account.profit_split_pct ?? 80;
  const available = Math.max(0, profit * (split / 100));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(WITHDRAW_METHODS[0].value);
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { onError("Enter a valid amount."); return; }
    if (!destination.trim()) { onError("Enter a payout destination."); return; }

    setSubmitting(true);
    try {
      if (demo) {
        onDone({
          id: `demo-${Date.now()}`, account_id: account.id, amount_usd: amt,
          method, destination, status: "requested",
          requested_at: new Date().toISOString(), paid_at: null,
        });
        return;
      }
      const r = await fetch("/api/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account_id: account.id, amount_usd: amt, method, destination }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Request failed");
      onDone(body.payout);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-bg-soft/90 p-6 backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-white">Withdraw Profit</h3>
          <button onClick={onClose} className="rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 rounded-xl border border-emerald2/20 bg-emerald2/[0.06] px-3 py-2 text-sm">
          <span className="text-slate-400">Available ({split}% split): </span>
          <span className="font-display font-bold text-emerald2-400">${available.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
        <Field label="Amount (USD)">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.00" />
        </Field>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {WITHDRAW_METHODS.map((m) => <option key={m.value} value={m.value} className="bg-bg-card">{m.label}</option>)}
          </select>
        </Field>
        <Field label="Destination (wallet / IBAN / email)">
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className={inputCls} placeholder="Where should we send it?" />
        </Field>
        <button onClick={submit} disabled={submitting} className="btn-primary mt-2 w-full justify-center disabled:opacity-60">
          {submitting ? "Submitting..." : "Request withdrawal"}
        </button>
      </div>
    </div>
  );
}

/* ---- Small components ---- */

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-gold/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = "neutral" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral";
}) {
  const color = tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 font-display text-xl font-bold tabular-nums ${color}`}>{value}</div>
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

function PhaseTag({ phase }: { phase: string }) {
  const map: Record<string, string> = {
    funded: "border-emerald2/30 bg-emerald2/10 text-emerald2-400",
    evaluation: "border-gold/30 bg-gold/10 text-gold",
    breached: "border-rose2/30 bg-rose2/10 text-rose2-400",
    closed: "border-white/10 bg-white/5 text-slate-400",
  };
  return (
    <div className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[phase] ?? map.closed}`}>
      {phase === "funded" ? "Funded" : phase === "breached" ? "Breached" : "Active"}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-12 text-center backdrop-blur-xl">
      <Banknote className="mx-auto h-10 w-10 text-gold" />
      <h3 className="font-display mt-4 text-2xl font-bold">No active challenges</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">You don&apos;t have any funded accounts yet. Pick a plan to get started.</p>
      <Link href="/#plans" className="btn-primary mt-6 inline-flex"><Crown className="h-4 w-4" /> Browse Plans</Link>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />)}
    </div>
  );
}
