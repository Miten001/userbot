"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { dbBrowser } from "@/lib/db";
import { AuthShell, DemoNotice, Field, SUPABASE_READY } from "@/app/components/AuthShell";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    search.get("error") ? "Sign-in link expired or invalid. Please try again." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!SUPABASE_READY) {
      setError("Authentication isn't configured on this deployment yet (demo mode).");
      return;
    }

    setLoading(true);
    try {
      const supabase = dbBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      const next = search.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
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

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          icon={Mail}
          type="email"
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <Field
          icon={Lock}
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />

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
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Logging in…
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" /> Log in <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        New to ApexFunded?{" "}
        <Link href="/signup" className="font-semibold text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
