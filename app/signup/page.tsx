"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown, Loader2, Mail, Lock, User, ArrowRight, MailCheck,
} from "lucide-react";
import { dbBrowser } from "@/lib/db";
import { AuthShell, DemoNotice, Field, SUPABASE_READY } from "@/app/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!SUPABASE_READY) {
      setError("Sign-up isn't configured on this deployment yet (demo mode).");
      return;
    }

    setLoading(true);
    try {
      const supabase = dbBrowser();
      const emailRedirectTo =
        (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) + "/auth/callback";

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo },
      });

      if (error) {
        setError(error.message);
        return;
      }

      // If email confirmation is OFF, Supabase returns a session immediately.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Otherwise the user must confirm via the email link.
      setConfirmSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <AuthShell title="Check your inbox" subtitle="One quick step to finish.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-emerald2/30 bg-emerald2/10">
            <MailCheck className="h-8 w-8 text-emerald2-400" />
          </span>
          <p className="text-sm text-slate-300">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-gold">{email}</span>. Click it to
            activate your account, then log in.
          </p>
          <Link href="/login" className="btn-secondary mt-2">
            Go to login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up to buy a challenge and track your funded accounts."
    >
      {!SUPABASE_READY && <DemoNotice />}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          icon={User}
          type="text"
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Trader"
          autoComplete="name"
        />
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
          placeholder="At least 6 characters"
          autoComplete="new-password"
          minLength={6}
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
              <Loader2 className="h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" /> Create account <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
