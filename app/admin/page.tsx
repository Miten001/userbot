"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, RefreshCw, Crown, DollarSign, Users, Trophy,
  AlertTriangle, Banknote, Check, X, Zap, Lock, ChevronRight,
} from "lucide-react";
import DashboardLayout from "@/app/components/DashboardLayout";

/* ───────────────────────── types ───────────────────────── */

type Stats = {
  challenges_total: number;
  challenges_active: number;
  challenges_pending: number;
  accounts_total: number;
  accounts_funded: number;
  accounts_breached: number;
  payouts_requested: number;
  payouts_paid_usd: number;
  evaluation_revenue_usd: number;
};

type ChallengeRow = {
  id: string;
  user_id: string;
  step: string;
  account_size_usd: number;
  price_usd: number | null;
  state: string;
  paid_at: string | null;
  created_at: string;
};

type AccountRow = {
  id: string;
  user_id: string;
  challenge_id?: string;
  mt5_login: string | null;
  initial_balance_usd: number | null;
  balance_usd: number;
  equity_usd: number;
  phase: string;
  step_index: number;
  total_steps: number;
  profit_split_pct: number;
  breach_reason: string | null;
  last_synced_at: string | null;
};

type PayoutRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount_usd: number;
  method: string | null;
  destination: string | null;
  status: string;
  requested_at: string;
  paid_at: string | null;
};

type Overview = { stats: Stats; challenges: ChallengeRow[]; accounts: AccountRow[]; payouts: PayoutRow[] };

/* ───────────────────────── demo data ───────────────────────── */

const DEMO: Overview = {
  stats: {
    challenges_total: 42, challenges_active: 28, challenges_pending: 3,
    accounts_total: 39, accounts_funded: 11, accounts_breached: 6,
    payouts_requested: 4, payouts_paid_usd: 18_420, evaluation_revenue_usd: 9_870,
  },
  challenges: [
    { id: "demo-ch1", user_id: "u_8821", step: "two", account_size_usd: 50_000, price_usd: 139, state: "active", paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: "demo-ch2", user_id: "u_4410", step: "one", account_size_usd: 100_000, price_usd: 489, state: "active", paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: "demo-ch3", user_id: "u_2093", step: "three", account_size_usd: 25_000, price_usd: 59, state: "active", paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: "demo-ch4", user_id: "u_7781", step: "two", account_size_usd: 10_000, price_usd: 39, state: "passed", paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
  ],
  accounts: [
    { id: "demo-a1", user_id: "u_7781", challenge_id: "demo-ch4", mt5_login: "10458321", initial_balance_usd: 50_000, balance_usd: 50_000, equity_usd: 53_120, phase: "evaluation", step_index: 1, total_steps: 2, profit_split_pct: 80, breach_reason: null, last_synced_at: new Date().toISOString() },
    { id: "demo-a2", user_id: "u_4410", challenge_id: "demo-ch2", mt5_login: "10458109", initial_balance_usd: 100_000, balance_usd: 100_000, equity_usd: 104_900, phase: "funded", step_index: 2, total_steps: 2, profit_split_pct: 85, breach_reason: null, last_synced_at: new Date().toISOString() },
    { id: "demo-a3", user_id: "u_2093", challenge_id: "demo-ch3", mt5_login: "10457744", initial_balance_usd: 25_000, balance_usd: 25_000, equity_usd: 22_380, phase: "breached", step_index: 1, total_steps: 1, profit_split_pct: 80, breach_reason: "Daily drawdown breached", last_synced_at: new Date().toISOString() },
  ],
  payouts: [
    { id: "demo-p1", user_id: "u_4410", account_id: "demo-a2", amount_usd: 1_240, method: "crypto", destination: "0x91a…f3", status: "requested", requested_at: new Date().toISOString(), paid_at: null },
    { id: "demo-p2", user_id: "u_7781", account_id: "demo-a9", amount_usd: 860, method: "bank", destination: "IBAN ****", status: "approved", requested_at: new Date().toISOString(), paid_at: null },
  ],
};

/* ───────────────────────── page ───────────────────────── */

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "demo">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [activateForm, setActivateForm] = useState<Record<string, { mt5_login: string; mt5_password: string; mt5_server: string }>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin", { cache: "no-store" });
      if (r.status === 403) { setState("forbidden"); return; }
      if (!r.ok) { setData(DEMO); setState("demo"); return; }
      setData(await r.json());
      setState("ok");
    } catch {
      setData(DEMO);
      setState("demo");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function act(key: string, fn: () => Promise<Response>, okMsg: string) {
    if (state === "demo") { flash("ok", "Demo mode — action simulated."); return; }
    setBusy(key);
    try {
      const r = await fn();
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Request failed");
      flash("ok", okMsg);
      await load();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const updatePayout = (id: string, status: string) =>
    act(`payout-${id}-${status}`,
      () => fetch("/api/admin/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payout_id: id, status }) }),
      `Payout ${status}.`);

  const setPhase = (id: string, phase: string) =>
    act(`acct-${id}-${phase}`,
      () => fetch("/api/admin/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account_id: id, phase }) }),
      `Account set to ${phase}.`);

  const runSync = () =>
    act("sync",
      () => fetch("/api/sync", { method: "POST" }),
      "Sync run complete.");

  const activateChallenge = (challengeId: string) => {
    const form = activateForm[challengeId];
    if (!form?.mt5_login || !form?.mt5_password || !form?.mt5_server) {
      flash("err", "Fill all MT5 fields before activating.");
      return;
    }
    act(`activate-${challengeId}`,
      () => fetch("/api/admin/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challenge_id: challengeId,
          mt5_login: form.mt5_login,
          mt5_password: form.mt5_password,
          mt5_server: form.mt5_server,
        }),
      }),
      "Account activated and email sent!");
  };

  const updateFormField = (challengeId: string, field: string, value: string) => {
    setActivateForm((prev) => ({
      ...prev,
      [challengeId]: { ...prev[challengeId], [field]: value } as { mt5_login: string; mt5_password: string; mt5_server: string },
    }));
  };

  if (state === "forbidden") return <Forbidden />;

  return (
    <DashboardLayout isAdmin={true}>
      <div className="relative min-h-screen overflow-hidden pb-24">
        <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
        <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

        <div className="relative mx-auto w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="h-display mt-2 flex items-center gap-3 text-4xl sm:text-5xl">
                <ShieldCheck className="h-9 w-9 text-gold" />
                Admin <span className="gradient-text">Console</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/setup" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-gold/40 hover:text-white">
                Setup status
              </Link>
              <button onClick={runSync} disabled={busy === "sync"} className="btn-primary disabled:opacity-60">
                <Zap className={`h-4 w-4 ${busy === "sync" ? "animate-pulse" : ""}`} />
                Run Sync
              </button>
              <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-gold/40 hover:text-white">
                <RefreshCw className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

        {state === "demo" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Crown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode.</strong> Showing sample data — configure Supabase admin keys and sign in as an admin to manage live accounts.
            </div>
          </div>
        )}

        {state === "loading" || !data ? (
          <div className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={DollarSign} label="Eval Revenue" value={`$${data.stats.evaluation_revenue_usd.toLocaleString()}`} tone="gold" />
              <StatCard icon={Banknote} label="Paid Out" value={`$${data.stats.payouts_paid_usd.toLocaleString()}`} tone="emerald" />
              <StatCard icon={Users} label="Accounts" value={data.stats.accounts_total} />
              <StatCard icon={Trophy} label="Funded" value={data.stats.accounts_funded} tone="emerald" />
              <StatCard icon={AlertTriangle} label="Breached" value={data.stats.accounts_breached} tone="rose" />
              <StatCard icon={Crown} label="Pending Payouts" value={data.stats.payouts_requested} tone="gold" />
            </div>

            {/* Pending Setup */}
            {(() => {
              const provisionedChallengeIds = new Set(data.accounts.map((a) => a.challenge_id));
              const pending = (data.challenges ?? []).filter(
                (c) => c.state === "active" && !provisionedChallengeIds.has(c.id),
              );
              return (
                <Section title="Pending Setup" count={pending.length}>
                  {pending.length === 0 ? (
                    <Empty label="No challenges awaiting MT5 setup." />
                  ) : (
                    <div className="space-y-4">
                      {pending.map((c) => {
                        const form = activateForm[c.id] || { mt5_login: "", mt5_password: "", mt5_server: "" };
                        return (
                          <div key={c.id} className="rounded-2xl border border-gold/20 bg-gold/[0.03] p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                              <span className="font-mono text-xs text-slate-400">{c.user_id.slice(0, 8)}...</span>
                              <span className="font-semibold text-white">${c.account_size_usd.toLocaleString()}</span>
                              <Badge status={c.step + "-step"} />
                              {c.paid_at && <span className="text-xs text-slate-500">Paid {fmtDate(c.paid_at)}</span>}
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <input
                                type="text"
                                placeholder="MT5 Login"
                                value={form.mt5_login}
                                onChange={(e) => updateFormField(c.id, "mt5_login", e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="MT5 Password"
                                value={form.mt5_password}
                                onChange={(e) => updateFormField(c.id, "mt5_password", e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="MT5 Server"
                                value={form.mt5_server}
                                onChange={(e) => updateFormField(c.id, "mt5_server", e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
                              />
                              <ActionBtn
                                tone="emerald"
                                loading={busy === `activate-${c.id}`}
                                onClick={() => activateChallenge(c.id)}
                              >
                                <Check className="h-3.5 w-3.5" />Activate
                              </ActionBtn>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              );
            })()}

            {/* Payouts */}
            <Section title="Withdrawal Requests" count={data.payouts.length}>
              {data.payouts.length === 0 ? (
                <Empty label="No payout requests." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <Th>Amount</Th><Th>Method</Th><Th>Destination</Th><Th>Status</Th><Th>Requested</Th><Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((p) => (
                        <tr key={p.id} className="border-t border-white/5">
                          <Td className="font-display font-bold text-white">${p.amount_usd.toLocaleString()}</Td>
                          <Td className="capitalize text-slate-300">{p.method ?? "—"}</Td>
                          <Td className="font-mono text-xs text-slate-400">{p.destination ?? "—"}</Td>
                          <Td><Badge status={p.status} /></Td>
                          <Td className="text-xs text-slate-500">{fmtDate(p.requested_at)}</Td>
                          <Td>
                            <div className="flex gap-1.5">
                              {p.status === "requested" && (
                                <>
                                  <ActionBtn tone="emerald" loading={busy === `payout-${p.id}-approved`} onClick={() => updatePayout(p.id, "approved")}><Check className="h-3.5 w-3.5" />Approve</ActionBtn>
                                  <ActionBtn tone="rose" loading={busy === `payout-${p.id}-rejected`} onClick={() => updatePayout(p.id, "rejected")}><X className="h-3.5 w-3.5" />Reject</ActionBtn>
                                </>
                              )}
                              {p.status === "approved" && (
                                <ActionBtn tone="gold" loading={busy === `payout-${p.id}-paid`} onClick={() => updatePayout(p.id, "paid")}><Banknote className="h-3.5 w-3.5" />Mark Paid</ActionBtn>
                              )}
                              {(p.status === "paid" || p.status === "rejected") && (
                                <span className="text-xs text-slate-600">—</span>
                              )}
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Accounts */}
            <Section title="Accounts" count={data.accounts.length}>
              {data.accounts.length === 0 ? (
                <Empty label="No accounts yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <Th>MT5 Login</Th><Th>Size</Th><Th>Equity</Th><Th>Phase</Th><Th>Step</Th><Th>Split</Th><Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.accounts.map((a) => {
                        const size = a.initial_balance_usd ?? a.balance_usd;
                        const up = a.equity_usd >= size;
                        return (
                          <tr key={a.id} className="border-t border-white/5">
                            <Td className="font-mono text-slate-300">{a.mt5_login ?? "—"}</Td>
                            <Td className="text-slate-300">${size.toLocaleString()}</Td>
                            <Td className={`font-semibold tabular-nums ${up ? "text-emerald2-400" : "text-rose2-400"}`}>${a.equity_usd.toLocaleString()}</Td>
                            <Td><Badge status={a.phase} /></Td>
                            <Td className="text-slate-400">{a.step_index}/{a.total_steps}</Td>
                            <Td className="text-slate-400">{a.profit_split_pct}%</Td>
                            <Td>
                              <div className="flex gap-1.5">
                                {a.phase !== "funded" && (
                                  <ActionBtn tone="emerald" loading={busy === `acct-${a.id}-funded`} onClick={() => setPhase(a.id, "funded")}><Trophy className="h-3.5 w-3.5" />Fund</ActionBtn>
                                )}
                                {a.phase !== "breached" && (
                                  <ActionBtn tone="rose" loading={busy === `acct-${a.id}-breached`} onClick={() => setPhase(a.id, "breached")}><AlertTriangle className="h-3.5 w-3.5" />Breach</ActionBtn>
                                )}
                                {a.phase === "breached" && (
                                  <ActionBtn tone="gold" loading={busy === `acct-${a.id}-evaluation`} onClick={() => setPhase(a.id, "evaluation")}><RefreshCw className="h-3.5 w-3.5" />Reset</ActionBtn>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-xl ${toast.kind === "ok" ? "border-emerald2/40 bg-emerald2/15 text-emerald2-400" : "border-rose2/40 bg-rose2/15 text-rose2-400"}`}>
          {toast.msg}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function StatCard({ icon: Icon, label, value, tone = "neutral" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number;
  tone?: "gold" | "emerald" | "rose" | "neutral";
}) {
  const color = tone === "gold" ? "text-gold" : tone === "emerald" ? "text-emerald2-400" : tone === "rose" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-bg-soft/60 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
        <Icon className={`h-3.5 w-3.5 ${color}`} />{label}
      </div>
      <div className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{count}</span>
      </div>
      <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">{children}</div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    funded: "border-emerald2/30 bg-emerald2/10 text-emerald2-400",
    paid: "border-emerald2/30 bg-emerald2/10 text-emerald2-400",
    approved: "border-gold/30 bg-gold/10 text-gold",
    evaluation: "border-royal/40 bg-royal/10 text-slate-200",
    active: "border-royal/40 bg-royal/10 text-slate-200",
    requested: "border-gold/30 bg-gold/10 text-gold",
    breached: "border-rose2/30 bg-rose2/10 text-rose2-400",
    failed: "border-rose2/30 bg-rose2/10 text-rose2-400",
    rejected: "border-rose2/30 bg-rose2/10 text-rose2-400",
    closed: "border-white/10 bg-white/5 text-slate-400",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? "border-white/10 bg-white/5 text-slate-400"}`}>
      {status}
    </span>
  );
}

function ActionBtn({ children, onClick, tone, loading }: {
  children: React.ReactNode; onClick: () => void; tone: "emerald" | "rose" | "gold"; loading?: boolean;
}) {
  const cls = tone === "emerald"
    ? "border-emerald2/40 bg-emerald2/10 text-emerald2-400 hover:bg-emerald2/20"
    : tone === "rose"
      ? "border-rose2/40 bg-rose2/10 text-rose2-400 hover:bg-rose2/20"
      : "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20";
  return (
    <button onClick={onClick} disabled={loading}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-8 text-center text-sm text-slate-500">{label}</div>;
}

function Forbidden() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="glow-blob -left-24 top-24 h-[400px] w-[400px] bg-rose2/20" />
      <div className="relative max-w-md rounded-3xl border border-white/10 bg-bg-soft/70 p-10 text-center backdrop-blur-2xl">
        <Lock className="mx-auto h-10 w-10 text-rose2-400" />
        <h1 className="font-display mt-4 text-3xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-400">
          This area is for administrators only. If you should have access, ask an owner to set
          <span className="font-mono text-slate-300"> profiles.is_admin = true</span> for your account,
          or add your user ID to <span className="font-mono text-slate-300">ADMIN_USER_IDS</span>.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Go to Dashboard <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}

/* ───────────────────────── utils ───────────────────────── */

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
