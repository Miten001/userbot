import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { dbAdmin } from "@/lib/db";

/**
 * GET /api/admin
 *
 * Back-office overview for admins. Uses the service-role client (bypasses RLS)
 * after verifying the caller is an admin. Returns aggregate stats plus the most
 * recent challenges, accounts and payout requests.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = dbAdmin();

  const [challenges, accounts, payouts] = await Promise.all([
    db
      .from("challenges")
      .select("id, user_id, step, account_size_usd, price_usd, state, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("accounts")
      .select(
        "id, user_id, challenge_id, mt5_login, mt5_server, initial_balance_usd, balance_usd, equity_usd, high_water_usd, phase, step_index, total_steps, profit_split_pct, funded_at, breached_at, breach_reason, last_synced_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("payouts")
      .select("id, user_id, account_id, amount_usd, method, destination, status, requested_at, paid_at")
      .order("requested_at", { ascending: false })
      .limit(100),
  ]);

  const err = challenges.error || accounts.error || payouts.error;
  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const ch = challenges.data ?? [];
  const ac = accounts.data ?? [];
  const po = payouts.data ?? [];

  const revenue = ch
    .filter((c) => c.state !== "pending" && c.state !== "refunded")
    .reduce((sum, c) => sum + Number(c.price_usd || 0), 0);

  const stats = {
    challenges_total: ch.length,
    challenges_active: ch.filter((c) => c.state === "active").length,
    challenges_pending: ch.filter((c) => c.state === "pending").length,
    accounts_total: ac.length,
    accounts_funded: ac.filter((a) => a.phase === "funded").length,
    accounts_breached: ac.filter((a) => a.phase === "breached").length,
    payouts_requested: po.filter((p) => p.status === "requested").length,
    payouts_paid_usd: po
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount_usd || 0), 0),
    evaluation_revenue_usd: revenue,
  };

  return NextResponse.json({
    stats,
    challenges: ch,
    accounts: ac,
    payouts: po,
  });
}
