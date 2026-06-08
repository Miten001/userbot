"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote, Check, Clock, Info, X, Send,
} from "lucide-react";
import {
  Account, Payout, DEMO_ACCOUNTS, DEMO_PAYOUTS, WITHDRAW_METHODS, fmtDate,
} from "@/app/dashboard/data";

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
        const [ar, pr] = await Promise.all([
          fetch("/api/account", { cache: "no-store" }),
          fetch("/api/payouts", { cache: "no-store" }),
        ]);
        if (!ar.ok || !pr.ok) throw new Error("not configured");
        const ad = await ar.json();
        const pd = await pr.json();
        setAccounts(ad.accounts ?? []);
        setPayouts(pd.payouts ?? []);
        setDemo(false);
      } catch {
        setAccounts(DEMO_ACCOUNTS);
        setPayouts(DEMO_PAYOUTS);
        setDemo(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fundedAccounts = accounts.filter((a) => a.phase === "funded");
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_usd, 0);
  const totalPending = payouts.filter((p) => p.status === "requested" || p.status === "approved").reduce((s, p) => s + p.amount_usd, 0);

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="h-display text-4xl sm:text-5xl">
              <span className="gradient-text">Payouts</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">Track your withdrawals and request new payouts</p>
          </div>
          {fundedAccounts.length > 0 && (
            <button
              onClick={() => setWithdrawFor(fundedAccounts[0])}
              className="btn-primary"
            >
              <Send className="h-4 w-4" /> Request Withdrawal
            </button>
          )}
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode.</strong> Showing simulated payout data.
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
        ) : (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard label="Total Paid" value={`$${totalPaid.toLocaleString()}`} tone="good" />
              <SummaryCard label="Pending" value={`$${totalPending.toLocaleString()}`} tone="neutral" />
              <SummaryCard label="Total Requests" value={payouts.length} tone="neutral" />
            </div>

            {/* Payout list */}
            <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-gold" />
                <h2 className="font-display text-xl font-bold text-white">Withdrawal History</h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{payouts.length}</span>
              </div>
              {payouts.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">No withdrawals yet. Funded accounts can request payouts anytime.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${p.status === "paid" ? "bg-emerald2/15 text-emerald2-400" : p.status === "rejected" ? "bg-rose2/15 text-rose2-400" : "bg-gold/15 text-gold"}`}>
                          {p.status === "paid" ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-display font-bold text-white">${p.amount_usd.toLocaleString()}</div>
                          <div className="text-[11px] text-slate-500">{p.method ?? "-"} · {fmtDate(p.requested_at)}</div>
                        </div>
                      </div>
                      <PayoutBadge status={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {withdrawFor && (
        <WithdrawModal
          account={withdrawFor}
          accounts={fundedAccounts}
          demo={demo}
          onClose={() => setWithdrawFor(null)}
          onDone={(po) => {
            if (po) setPayouts((prev) => [po, ...prev]);
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

/* ---- WithdrawModal ---- */

function WithdrawModal({ account, accounts, demo, onClose, onDone, onError }: {
  account: Account; accounts: Account[]; demo: boolean;
  onClose: () => void; onDone: (po?: Payout) => void; onError: (m: string) => void;
}) {
  const [selectedAccount, setSelectedAccount] = useState(account);
  const profit = selectedAccount.equity_usd - selectedAccount.balance_usd;
  const split = selectedAccount.profit_split_pct ?? 80;
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
          id: `demo-${Date.now()}`, account_id: selectedAccount.id, amount_usd: amt,
          method, destination, status: "requested",
          requested_at: new Date().toISOString(), paid_at: null,
        });
        return;
      }
      const r = await fetch("/api/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account_id: selectedAccount.id, amount_usd: amt, method, destination }),
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
        {accounts.length > 1 && (
          <Field label="Account">
            <select
              value={selectedAccount.id}
              onChange={(e) => {
                const found = accounts.find((a) => a.id === e.target.value);
                if (found) setSelectedAccount(found);
              }}
              className={inputCls}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-bg-card">${a.balance_usd.toLocaleString()} - {a.mt5_login}</option>
              ))}
            </select>
          </Field>
        )}
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

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${color}`}>{value}</div>
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
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? "border-white/10 bg-white/5 text-slate-400"}`}>{status}</span>;
}
