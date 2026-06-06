"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Eye, EyeOff, ShieldCheck, Zap, Banknote, TrendingUp } from "lucide-react";
import { dbBrowser } from "@/lib/db";

/** Whether the Supabase public keys are present in this build (client-safe). */
export const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Show the Google sign-in button only when explicitly enabled. */
export const GOOGLE_READY = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true";

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

export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  if (!GOOGLE_READY) return null;

  async function signIn() {
    setLoading(true);
    try {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const redirectTo =
        `${base}/auth/callback` + (next ? `?next=${encodeURIComponent(next)}` : "");
      const supabase = dbBrowser();
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-60"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.2c-2 1.5-4.6 2.5-7.4 2.5-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2c-.4.4 6.8-5 6.8-15.2 0-1.3-.1-2.3-.4-3.5z" />
        </svg>
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-600">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
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
