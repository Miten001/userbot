"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Loader2, Mail, Lock, ArrowRight, Sparkles, KeyRound, MailCheck } from "lucide-react";
import { dbBrowser } from "@/lib/db";
import { AuthShell, DemoNotice, Field, SUPABASE_READY } from "@/app/components/AuthShell";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

type Mode = "password" | "magic";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    search.get("error") ? "Sign-in link expired or invalid. Please try again." : null,
  );

  const redirectBase = () =>
    (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : ""));

  function guardConfigured(): boolean {
    if (!SUPABASE_READY) {
      setError("Authentication isn't configured on this deployment yet (demo mode).");
      return false;
    }
    return true;
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    if (!guardConfigured()) return;

    setLoading(true);
    try {
      const supabase = dbBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setError(error.message);
      const next = search.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onMagicSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    if (!guardConfigured()) return;
    if (!email) return setError("Enter your email first.");

    setLoading(true);
    try {
      const supabase = dbBrowser();
      const next = search.get("next");
      const emailRedirectTo =
        `${redirectBase()}/auth/callback` + (next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "");
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
      if (error) return setError(error.message);
      setNotice(`Magic link sent to ${email}. Check your inbox to sign in.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    if (!guardConfigured()) return;
    if (!email) return setError("Enter your email above, then tap “Forgot password”.");

    setLoading(true);
    try {
      const supabase = dbBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectBase()}/auth/callback?next=/dashboard`,
      });
      if (error) return setError(error.message);
      setNotice(`Password reset link sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to view your funded accounts and request payouts."
    >
      {!SUPABASE_READY && <DemoNotice />}

      {/* Mode switch */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
        <ModeTab active={mode === "password"} onClick={() => { setMode("password"); setNotice(null); setError(null); }} icon={KeyRound}>
          Password
        </ModeTab>
        <ModeTab active={mode === "magic"} onClick={() => { setMode("magic"); setNotice(null); setError(null); }} icon={Sparkles}>
          Magic link
        </ModeTab>
      </div>

      {notice ? (
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-emerald2/30 bg-emerald2/10">
            <MailCheck className="h-7 w-7 text-emerald2-400" />
          </span>
          <p className="text-sm text-slate-300">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-sm font-semibold text-gold hover:underline">
            Back to login
          </button>
        </div>
      ) : (
        <form onSubmit={mode === "password" ? onPasswordSubmit : onMagicSubmit} className="space-y-4">
          <Field
            icon={Mail}
            type="email"
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />

          {mode === "password" && (
            <>
              <Field
                icon={Lock}
                type="password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={onForgotPassword} className="text-xs text-slate-400 hover:text-gold">
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-xl border border-rose2/30 bg-rose2/[0.06] px-3 py-2 text-sm text-rose2-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-70"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {mode === "magic" ? "Sending…" : "Logging in…"}</>
            ) : mode === "magic" ? (
              <><Sparkles className="h-4 w-4" /> Email me a magic link</>
            ) : (
              <><Crown className="h-4 w-4" /> Log in <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        New to ApexFunded?{" "}
        <Link href="/signup" className="font-semibold text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

function ModeTab({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition ${
        active ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
