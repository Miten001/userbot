import Link from "next/link";
import { Crown, ChevronRight, ShieldCheck, Info } from "lucide-react";

type Search = { step?: string; size?: string; price?: string };

const STEP_LABEL: Record<string, string> = {
  one: "1-Step",
  two: "2-Step",
  three: "3-Step",
};

function fakeMt5Login() {
  // Deterministic-looking demo number based on the current minute so reloads
  // give a different one (small delight).
  const base = 10_000_000 + Math.floor(Math.random() * 89_999_999);
  return String(base);
}

function fakePassword() {
  return Math.random().toString(36).slice(2, 12).toUpperCase();
}

export default function DemoSuccessPage({ searchParams }: { searchParams: Search }) {
  const step = searchParams.step ?? "one";
  const sizeStr = searchParams.size ?? "0";
  const priceStr = searchParams.price ?? "0";
  const size = Number(sizeStr).toLocaleString();
  const login = fakeMt5Login();
  const password = fakePassword();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Glow accents */}
      <div className="glow-blob -left-24 top-24 h-[400px] w-[400px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[400px] w-[400px] bg-emerald-radial" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        {/* Demo banner */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gold">
          <Info className="h-3.5 w-3.5" />
          Demo Mode — No Real Payment Was Charged
        </div>

        <div className="mb-6 grid h-20 w-20 place-items-center rounded-full border border-emerald2/30 bg-emerald2/10 shadow-emerald">
          <ShieldCheck className="h-10 w-10 text-emerald2-400" />
        </div>

        <h1 className="h-display text-4xl sm:text-5xl">
          Challenge <span className="gradient-text">Activated!</span>
        </h1>

        <p className="mt-4 max-w-xl text-slate-300">
          Welcome to ApexFunded. Your{" "}
          <span className="font-semibold text-gold">${size}</span>{" "}
          {STEP_LABEL[step]} evaluation account has been provisioned. Use the
          credentials below to log into MT5.
        </p>

        {/* Credentials card */}
        <div className="ring-conic mt-10 w-full max-w-md rounded-3xl">
          <div className="rounded-3xl border border-white/10 bg-bg-soft/80 p-6 text-left backdrop-blur-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-gold" />
                Funded Account
              </span>
              <span className="rounded-full border border-emerald2/30 bg-emerald2/10 px-2 py-0.5 text-emerald2-400">
                EVALUATION
              </span>
            </div>

            <div className="mt-3 font-display text-3xl font-bold gradient-text">
              ${size}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <Field label="MT5 Login"   value={login} />
              <Field label="Password"    value={password} mono />
              <Field label="Server"      value="ApexFunded-Demo" />
              <Field label="Plan"        value={`${STEP_LABEL[step]} Evaluation`} />
              <Field label="Fee Paid"    value={`$${priceStr} (refundable)`} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
              <strong className="block text-slate-300">⚠ Demo data</strong>
              These credentials are simulated. To provision real MT5 accounts,
              add a MetaApi token in your Vercel env vars (see SETUP.md).
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            <Crown className="h-4 w-4" />
            Go to Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-none">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-semibold text-white ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
