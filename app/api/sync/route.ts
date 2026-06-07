import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { dbAdmin } from "@/lib/db";
import { getMT5Provider } from "@/lib/mt5";
import { evaluateAccount, type EvalAccount } from "@/lib/risk";
import { requireAdmin } from "@/lib/admin";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { notifyFunded, notifyBreached } from "@/lib/email";

/**
 * /api/sync  (GET for Vercel Cron, POST for manual/admin runs)
 *
 * The heartbeat of the prop firm. For every live account it:
 *   1. Pulls fresh balance/equity from the MT5 provider.
 *   2. Runs the pure risk engine (drawdown breach / profit-target / step pass).
 *   3. Persists the resulting patch + any challenge state change.
 *   4. Mirrors recent trades into the `trades` table (upsert by ticket).
 *
 * Auth: when CRON_SECRET is set, the caller must present it (Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`). Otherwise an admin session is
 * required. This keeps the endpoint from being publicly triggerable.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}

async function runSync() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 503 });
  }

  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = dbAdmin();
  const mt5 = getMT5Provider();

  // Only sync accounts that are still "live".
  const { data: accounts, error } = await db
    .from("accounts")
    .select(
      "id, user_id, challenge_id, provider_id, initial_balance_usd, balance_usd, equity_usd, high_water_usd, day_start_equity_usd, day_anchor, daily_loss_pct, overall_loss_pct, profit_target_pct, phase, step_index, total_steps",
    )
    .in("phase", ["evaluation", "funded"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const results: Array<Record<string, unknown>> = [];
  let breached = 0;
  let funded = 0;
  let stepPassed = 0;
  let tradesSynced = 0;

  for (const a of accounts ?? []) {
    if (!a.provider_id) continue;

    try {
      const { equity_usd } = await mt5.fetchEquity(a.provider_id);

      const evalAccount: EvalAccount = {
        initial_balance_usd: Number(a.initial_balance_usd ?? a.balance_usd),
        balance_usd: Number(a.balance_usd),
        equity_usd: Number(a.equity_usd),
        high_water_usd: Number(a.high_water_usd ?? a.balance_usd),
        day_start_equity_usd: a.day_start_equity_usd == null ? null : Number(a.day_start_equity_usd),
        day_anchor: a.day_anchor ?? null,
        daily_loss_pct: Number(a.daily_loss_pct),
        overall_loss_pct: Number(a.overall_loss_pct),
        profit_target_pct: Number(a.profit_target_pct),
        phase: a.phase as EvalAccount["phase"],
        step_index: Number(a.step_index ?? 1),
        total_steps: Number(a.total_steps ?? 1),
      };

      const { patch, events, challengeState } = evaluateAccount(evalAccount, equity_usd, now);

      await db.from("accounts").update(patch).eq("id", a.id);

      if (challengeState && a.challenge_id) {
        await db.from("challenges").update({ state: challengeState }).eq("id", a.challenge_id);
      }

      // Mirror recent trades (best-effort — never fail the whole run on this).
      try {
        const deals = await mt5.fetchTrades(a.provider_id);
        if (deals.length) {
          const rows = deals.map((d) => ({ account_id: a.id, ...d }));
          const { error: tErr } = await db
            .from("trades")
            .upsert(rows, { onConflict: "account_id,ticket", ignoreDuplicates: true });
          if (!tErr) tradesSynced += rows.length;
        }
      } catch {
        // ignore trade-sync hiccups
      }

      for (const e of events) {
        if (e.type === "breached") breached++;
        if (e.type === "funded") funded++;
        if (e.type === "step_passed") stepPassed++;
      }

      // Best-effort lifecycle emails (no-op unless RESEND_API_KEY is set).
      const hitFunded = events.some((e) => e.type === "funded");
      const hitBreach = events.some((e) => e.type === "breached");
      if ((hitFunded || hitBreach) && a.user_id) {
        const email = await userEmail(db, a.user_id);
        if (email) {
          if (hitFunded) await notifyFunded(email, { size: Number(a.initial_balance_usd ?? a.balance_usd) });
          else await notifyBreached(email, { reason: patch.breach_reason ?? "Risk limit reached." });
        }
      }

      results.push({ account_id: a.id, equity_usd, events: events.map((e) => e.type), phase: patch.phase ?? a.phase });
    } catch (err) {
      results.push({ account_id: a.id, error: err instanceof Error ? err.message : "sync failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    synced_at: now.toISOString(),
    accounts_processed: results.length,
    breached,
    funded,
    steps_passed: stepPassed,
    trades_synced: tradesSynced,
    results,
  });
}

/** Look up a user's email via the service-role admin API (best-effort). */
async function userEmail(db: ReturnType<typeof dbAdmin>, userId: string): Promise<string | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** CRON_SECRET (Vercel Cron / external scheduler) OR an admin session. */
async function authorize(): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = headers().get("authorization") || "";
    if (auth === `Bearer ${secret}`) return true;
  }
  const admin = await requireAdmin();
  return Boolean(admin);
}
