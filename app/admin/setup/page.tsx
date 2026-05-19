"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Crown, ExternalLink, RefreshCw } from "lucide-react";

type Status = {
  mode: "live" | "demo";
  stripe: boolean;
  supabase_anon: boolean;
  supabase_admin: boolean;
  stripe_webhook: boolean;
  metaapi: boolean;
  site_url: string | null;
};

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setStatus(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="relative min-h-screen pb-24 pt-12">
      <div className="glow-blob -left-24 top-24 h-[400px] w-[400px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/2 h-[400px] w-[400px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-3xl px-6 sm:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-gold">
              ← Back to site
            </Link>
            <h1 className="h-display mt-2 text-3xl sm:text-4xl">
              Setup <span className="gradient-text">Status</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Configure Stripe + Supabase to switch from demo to live mode.
            </p>
          </div>

          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:border-gold/40 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {status && (
          <>
            {/* Mode banner */}
            <div
              className={`mb-6 flex items-center gap-3 rounded-3xl border p-5 ${
                status.mode === "live"
                  ? "border-emerald2/30 bg-emerald2/[0.06]"
                  : "border-gold/30 bg-gold/[0.06]"
              }`}
            >
              {status.mode === "live" ? (
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald2-400" />
              ) : (
                <Crown className="h-6 w-6 flex-shrink-0 text-gold" />
              )}
              <div>
                <div className="font-display text-xl font-bold">
                  {status.mode === "live" ? (
                    <>
                      <span className="text-emerald2-400">LIVE</span> mode
                    </>
                  ) : (
                    <>
                      <span className="text-gold">DEMO</span> mode
                    </>
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  {status.mode === "live"
                    ? "All systems configured. Real payments + database active."
                    : "Site is fully usable, but payments are simulated. Add the env vars below to go live."}
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <Item
                ok={status.stripe}
                title="Stripe configured"
                desc="STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set"
                ctaLabel="Get Stripe keys"
                ctaHref="https://dashboard.stripe.com/test/apikeys"
              />
              <Item
                ok={status.supabase_anon}
                title="Supabase (public) configured"
                desc="NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY set"
                ctaLabel="Create Supabase project"
                ctaHref="https://supabase.com/dashboard/projects"
              />
              <Item
                ok={status.supabase_admin}
                title="Supabase (admin) configured"
                desc="SUPABASE_SERVICE_ROLE_KEY set (needed for webhook to write rows)"
              />
              <Item
                ok={status.stripe_webhook}
                title="Stripe webhook secret set"
                desc="STRIPE_WEBHOOK_SECRET — required for the checkout webhook"
                ctaLabel="Add webhook"
                ctaHref="https://dashboard.stripe.com/test/webhooks"
              />
              <Item
                ok={status.metaapi}
                title="MetaApi (real MT5) configured"
                desc="Optional — without this, mock MT5 accounts are provisioned"
                ctaLabel="MetaApi pricing"
                ctaHref="https://metaapi.cloud/docs/client/getting-started/getting-token"
                optional
              />
            </div>

            {/* Site URL */}
            {status.site_url && (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400">
                <strong className="text-slate-300">Site URL:</strong>{" "}
                <span className="font-mono">{status.site_url}</span>
              </div>
            )}

            {/* Help link */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
              Full step-by-step guide:{" "}
              <a
                href="https://github.com/Miten001/userbot/blob/master/SETUP.md"
                className="font-semibold text-gold hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                SETUP.md →
              </a>
              <p className="mt-2">
                After adding env vars in Vercel, click{" "}
                <strong className="text-slate-300">Deployments → Redeploy</strong>,
                then refresh this page.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Item({
  ok, title, desc, ctaLabel, ctaHref, optional,
}: {
  ok: boolean;
  title: string;
  desc: string;
  ctaLabel?: string;
  ctaHref?: string;
  optional?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 backdrop-blur-xl ${
        ok
          ? "border-emerald2/25 bg-emerald2/[0.04]"
          : optional
            ? "border-white/10 bg-white/[0.02]"
            : "border-rose2/25 bg-rose2/[0.04]"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald2-400" />
      ) : (
        <XCircle
          className={`h-5 w-5 flex-shrink-0 ${optional ? "text-slate-400" : "text-rose2-400"}`}
        />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 font-semibold text-white">
          {title}
          {optional && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
              optional
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      {!ok && ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"
        >
          {ctaLabel}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
