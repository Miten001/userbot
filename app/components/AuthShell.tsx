"use client";

import Link from "next/link";
import { Info } from "lucide-react";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24">
      <div className="glow-blob -left-24 top-24 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 bottom-12 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
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
          <Link href="/" className="hover:text-gold">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
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
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="relative flex items-center">
        <Icon className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500" />
        <input
          type={type}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-gold/50 focus:bg-white/[0.05]"
        />
      </span>
    </label>
  );
}
