"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown, ChevronRight, ShieldCheck, TrendingUp, Wallet,
  Banknote, Info, Settings, X, Send, Clock, Check,
  ArrowUpRight, ArrowDownRight, BarChart3,
} from "lucide-react";

/* ───────────────────────── types ───────────────────────── */

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
  profit_split_pct?: number;
  challenge?: { step: string; account_size_usd: number; state: string };
};

type Profile = {
  id: string;
  full_name: string | null;
  country: string | null;
  phone: string | null;
  is_admin?: boolean;
};

type Payout = {
  id: string;
  account_id: string;
  amount_usd: number;
  method: string | null;
  destination: string | null;
  status: string;
  requested_at: string;
  paid_at: string | null;
};

type Trade = {
  id: string;
  account_id: string;
  symbol: string;
  side: string;
  volume: number;
  open_price: number | null;
  close_price: number | null;
  profit_usd: number | null;
  opened_at: string | null;
  closed_at: string | null;
};

const WITHDRAW_METHODS = [
  { value: "bank", label: "Bank transfer" },
  { value: "usdt-trc20", label: "USDT (TRC-20)" },
  { value: "wise", label: "Wise" },
];

/* ───────────────────────── demo data ───────────────────────── */

const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo-1", mt5_login: "10458321", mt5_server: "ApexFunded-Demo",
    balance_usd: 50_000, equity_usd: 52_412, phase: "evaluation", step_index: 1,
    profit_target_pct: 8, daily_loss_pct: 5, overall_loss_pct: 10, profit_split_pct: 80,
    challenge: { step: "two", account_size_usd: 50_000, state: "active" },
  },
  {
    id: "demo-2", mt5_login: "10458977", mt5_server: "ApexFunded-Live",
    balance_usd: 100_000, equity_usd: 106_300, phase: "funded", step_index: 2,
    profit_target_pct: 0, daily_loss_pct: 5, overall_loss_pct: 10, profit_split_pct: 85,
    challenge: { step: "two", account_size_usd: 100_000, state: "funded" },
  },
];

const DEMO_PROFILE: Profile = { id: "demo", full_name: "Alex Trader", country: "AE", phone: "+971 50 000 0000" };

const DEMO_PAYOUTS: Payout[] = [
  { id: "demo-po1", account_id: "demo-2", amount_usd: 1_240, method: "usdt-trc20", destination: "TXk…9f3", status: "paid", requested_at: new Date(Date.now() - 6e8).toISOString(), paid_at: new Date(Date.now() - 5e8).toISOString() },
];

const DEMO_TRADES: Trade[] = [
  { id: "t1", account_id: "demo-2", symbol: "XAUUSD", side: "buy", volume: 1.2, open_price: 2318.4, close_price: 2331.7, profit_usd: 1_596, opened_at: new Date(Date.now() - 2e8).toISOString(), closed_at: new Date(Date.now() - 1.9e8).toISOString() },
  { id: "t2", account_id: "demo-1", symbol: "EURUSD", side: "sell", volume: 0.8, open_price: 1.0921, close_price: 1.0894, profit_usd: 216, opened_at: new Date(Date.now() - 3e8).toISOString(), closed_at: new Date(Date.now() - 2.8e8).toISOString() },
  { id: "t3", account_id: "demo-1", symbol: "GBPUSD", side: "buy", volume: 0.5, open_price: 1.2710, close_price: 1.2688, profit_usd: -110, opened_at: new Date(Date.now() - 4e8).toISOString(), closed_at: new Date(Date.now() - 3.9e8).toISOString() },
  { id: "t4", account_id: "demo-2", symbol: "BTCUSD", side: "buy", volume: 0.3, open_price: 61_200, close_price: 62_540, profit_usd: 402, opened_at: new Date(Date.now() - 5e8).toISOString(), closed_at: new Date(Date.now() - 4.8e8).toISOString() },
];

/* ───────────────────────── page ───────────────────────── */

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [withdrawFor, setWithdrawFor] = useState<Account | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const flash = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadPayouts = useCallback(async () => {
    try {
      const r = await fetch("/api/payouts", { cache: "no-store" });
      if (r.ok) setPayouts((await r.json()).payouts ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account", { cache: "no-store" });
        if (!r.ok) throw new Error("not configured");
        const data = await r.json();
        setAccounts(data.accounts ?? []);
        setDemo(false);

        const [pr, po] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/payouts", { cache: "no-store" }),
        ]);
        if (pr.ok) { const pd = await pr.json(); setProfile(pd.profile); setEmail(pd.email); }
        if (po.ok) setPayouts((await po.json()).payouts ?? []);

        const tr = await fetch("/api/trades", { cache: "no-store" });
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

  return (
    <main className="relative min-h-screen overflow-hidden pt-12 pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl px-6 sm:px-10">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-gold">← Back to site</Link>
            <h1 className="h-display mt-2 text-4xl sm:text-5xl">
              Trader <span className="gradient-text">Dashboard</span>
            </h1>
            {profile?.full_name && (
              <p className="mt-1 text-sm text-slate-400">Welcome back, <span className="text-slate-200">{profile.full_name}</span></p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-gold/40 hover:text-white">
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>
            {profile?.is_admin && (
              <Link href="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:border-gold/40 hover:text-white">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Admin
              </Link>
            )}
            <Link href="/#plans" className="btn-primary">
              <Crown className="h-4 w-4" /> Buy Another Challenge <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {demo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4 text-sm text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <div>
              <strong className="text-gold">Demo Mode active.</strong>{" "}
              You&apos;re seeing simulated data. Add Razorpay/NOWPayments + Supabase env vars in Vercel to switch to live mode.{" "}
              <Link href="/admin/setup" className="font-semibold text-gold underline">Setup status →</Link>
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

        {/* Payout history */}
        {!loading && (accounts?.length ?? 0) > 0 && (
          <PayoutHistory payouts={payouts} />
        )}

        {/* Trades */}
        {!loading && (accounts?.length ?? 0) > 0 && (
          <TradesSection trades={trades} />
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          profile={profile}
          email={email}
          demo={demo}
          onClose={() => setSettingsOpen(false)}
          onSaved={(p) => { setProfile(p); flash("ok", "Profile updated."); }}
          onError={(m) => flash("err", m)}
        />
      )}

      {withdrawFor && (
        <WithdrawModal
          account={withdrawFor}
          demo={demo}
          onClose={() => setWithdrawFor(null)}
          onDone={(po) => {
            if (po) setPayouts((prev) => [po, ...prev]);
            else loadPayouts();
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
    </main>
  );
}

/* ───────────────────────── account card ───────────────────────── */

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

/* ───────────────────────── payout history ───────────────────────── */

function PayoutHistory({ payouts }: { payouts: Payout[] }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Banknote className="h-4 w-4 text-gold" />
        <h2 className="font-display text-xl font-bold text-white">Withdrawals</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{payouts.length}</span>
      </div>
      <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
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
                    <div className="text-[11px] text-slate-500">{p.method ?? "—"} · {fmtDate(p.requested_at)}</div>
                  </div>
                </div>
                <PayoutBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── trades ───────────────────────── */

function TradesSection({ trades }: { trades: Trade[] }) {
  const closed = trades.filter((t) => t.profit_usd !== null);
  const totalPnl = closed.reduce((s, t) => s + (t.profit_usd ?? 0), 0);
  const wins = closed.filter((t) => (t.profit_usd ?? 0) > 0).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-gold" />
        <h2 className="font-display text-xl font-bold text-white">Trade History</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{trades.length}</span>
      </div>

      <div className="rounded-3xl border border-white/10 bg-bg-soft/50 p-4 backdrop-blur-xl sm:p-5">
        {trades.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No trades yet. They&apos;ll appear here automatically as your MT5 account syncs.
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <MiniStat label="Net P/L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={totalPnl >= 0 ? "good" : "bad"} />
              <MiniStat label="Win rate" value={`${winRate}%`} />
              <MiniStat label="Closed" value={closed.length} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Symbol</th>
                    <th className="px-3 py-2 font-semibold">Side</th>
                    <th className="px-3 py-2 font-semibold">Vol</th>
                    <th className="px-3 py-2 font-semibold">Open</th>
                    <th className="px-3 py-2 font-semibold">Close</th>
                    <th className="px-3 py-2 font-semibold">P/L</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => {
                    const pnl = t.profit_usd ?? 0;
                    const up = pnl >= 0;
                    const buy = t.side?.toLowerCase() === "buy";
                    return (
                      <tr key={t.id} className="border-t border-white/5">
                        <td className="px-3 py-3 font-display font-bold text-white">{t.symbol}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${buy ? "border-emerald2/30 bg-emerald2/10 text-emerald2-400" : "border-rose2/30 bg-rose2/10 text-rose2-400"}`}>
                            {buy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {t.side}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{t.volume}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-400">{t.open_price ?? "—"}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-400">{t.close_price ?? "—"}</td>
                        <td className={`px-3 py-3 font-semibold tabular-nums ${up ? "text-emerald2-400" : "text-rose2-400"}`}>
                          {t.profit_usd === null ? "—" : `${up ? "+" : ""}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-slate-500">{t.opened_at ? fmtDate(t.opened_at) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald2-400" : tone === "bad" ? "text-rose2-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

/* ───────────────────────── modals ───────────────────────── */
function SettingsModal({ profile, email, demo, onClose, onSaved, onError }: {
  profile: Profile | null; email: string | null; demo: boolean;
  onClose: () => void; onSaved: (p: Profile) => void; onError: (m: string) => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (demo) {
        onSaved({ id: "demo", full_name: fullName, country, phone, is_admin: profile?.is_admin });
        onClose();
        return;
      }
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName, country, phone }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to save");
      onSaved(body.profile);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Account Settings" onClose={onClose}>
      {email && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <span className="text-slate-400">Email: </span><span className="text-slate-200">{email}</span>
        </div>
      )}
      <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Your name" /></Field>
      <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="e.g. United Arab Emirates" /></Field>
      <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+1 555 000 0000" /></Field>
      <button onClick={save} disabled={saving} className="btn-primary mt-2 w-full justify-center disabled:opacity-60">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </Modal>
  );
}

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
    <Modal title="Withdraw Profit" onClose={onClose}>
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
        {submitting ? "Submitting…" : "Request withdrawal"}
      </button>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-bg-soft/90 p-6 backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── small bits ───────────────────────── */

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

function PayoutBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "border-emerald2/30 bg-emerald2/10 text-emerald2-400",
    approved: "border-gold/30 bg-gold/10 text-gold",
    requested: "border-gold/30 bg-gold/10 text-gold",
    rejected: "border-rose2/30 bg-rose2/10 text-rose2-400",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? "border-white/10 bg-white/5 text-slate-400"}`}>{status}</span>;
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

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}
