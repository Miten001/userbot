"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Eye, EyeOff, ShieldCheck, Zap, Banknote, TrendingUp } from "lucide-react";

/** Whether the Supabase public keys are present in this build (client-safe). */
export const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Showcase panel (desktop only) ── */}
      <aside className="relative hidden overflow-hidden border-r border-white/10 bg-bg-deep/60 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="glow-blob -left-20 top-10 h-[460px] w-[460px] bg-gold-radial" />
        <div className="glow-blob -right-10 bottom-0 h-[420px] w-[420px] bg-royal-radial" />

        <Link href="/" className="relative inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-gradient text-bg-deep">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Apex<span className="gradient-text">Funded</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="h-display text-4xl leading-tight">
            Trade our capital. <br />
            <span className="gradient-text">Keep up to 90%</span> of the profit.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Pass the evaluation, get funded up to $200,000, and withdraw your
            share on demand. No time limits, real MT5 accounts.
          </p>

          <ul className="mt-8 space-y-4">
            <Highlight icon={Zap} title="Instant account provisioning" desc="Your MT5 login lands seconds after checkout." />
            <Highlight icon={Banknote} title="Fast, flexible payouts" desc="Bank, Wise, or USDT — request anytime when funded." />
            <Highlight icon={TrendingUp} title="Automated risk engine" desc="Transparent drawdown tracking, synced every 15 minutes." />
          </ul>
        </div>

        <div className="relative flex items-center gap-8">
          <Stat value="$4.2M+" label="Paid to traders" />
          <Stat value="12,000+" label="Funded accounts" />
          <Stat value="90%" label="Max profit split" />
        </div>
      </aside>

      {/* ── Form panel ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
        <div className="glow-blob -right-24 top-24 h-[360px] w-[360px] bg-royal-radial lg:hidden" />

        <div className="relative w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-6 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-tight">
                Apex<span className="gradient-text">Funded</span>
              </span>
            </Link>
          </div>

          <div className="ring-conic rounded-3xl">
            <div className="rounded-3xl border border-white/10 bg-bg-soft/80 p-7 backdrop-blur-2xl sm:p-8">
              <h1 className="h-display text-2xl sm:text-3xl">{title}</h1>
              <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
              <div className="mt-6">{children}</div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/" className="hover:text-gold">← Back to home</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Highlight({ icon: Icon, title, desc }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-sm text-slate-400">{desc}</div>
      </div>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold gradient-text">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

export function DemoNotice() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3.5 text-sm text-slate-300">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
      <div>
        <strong className="text-gold">Demo mode.</strong> Add Supabase env vars to
        enable real sign-up &amp; accounts.{" "}
        <Link href="/admin/setup" className="font-semibold text-gold underline">
          Setup status →
        </Link>
      </div>
    </div>
  );
}

export function Field({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const isPassword = type === "password";
  const [reveal, setReveal] = useState(false);
  const inputType = isPassword ? (reveal ? "text" : "password") : type;

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="relative flex items-center">
        <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500" />
        <input
          type={inputType}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-gold/50 focus:bg-white/[0.05] ${isPassword ? "pr-11" : "pr-3"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-3 text-slate-500 transition-colors hover:text-slate-300"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </span>
    </label>
  );
}
