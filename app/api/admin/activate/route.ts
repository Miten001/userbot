import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { dbAdmin } from "@/lib/db";
import { stepRules, type Step } from "@/lib/plans";
import { notifyAccountReady } from "@/lib/email";

/**
 * POST /api/admin/activate
 *
 * Manually provisions an MT5 account for a paid challenge.
 * Admin enters the credentials obtained from the broker, and the system
 * creates the account row + sends the customer notification email.
 *
 * Body: { challenge_id, mt5_login, mt5_password, mt5_server }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    challenge_id?: string;
    mt5_login?: string;
    mt5_password?: string;
    mt5_server?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { challenge_id, mt5_login, mt5_password, mt5_server } = body;

  if (!challenge_id || !mt5_login || !mt5_password || !mt5_server) {
    return NextResponse.json(
      { error: "Missing required fields: challenge_id, mt5_login, mt5_password, mt5_server" },
      { status: 400 },
    );
  }

  const db = dbAdmin();

  // Load the challenge - must be in 'active' state (paid but not yet provisioned).
  const { data: challenge, error: chErr } = await db
    .from("challenges")
    .select("id, user_id, step, account_size_usd, state")
    .eq("id", challenge_id)
    .single();

  if (chErr || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  if (challenge.state !== "active") {
    return NextResponse.json(
      { error: `Challenge must be in 'active' state (current: ${challenge.state})` },
      { status: 400 },
    );
  }

  // Check no account already exists for this challenge.
  const { data: existing } = await db
    .from("accounts")
    .select("id")
    .eq("challenge_id", challenge_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Account already exists for this challenge" }, { status: 409 });
  }

  // Get risk parameters.
  const step = challenge.step as Step;
  const accountSize = Number(challenge.account_size_usd);
  const rules = stepRules(step);
  const today = new Date().toISOString().slice(0, 10);

  // Insert the account row.
  const { data: account, error: acctErr } = await db
    .from("accounts")
    .insert({
      user_id: challenge.user_id,
      challenge_id: challenge.id,
      provider: "manual",
      provider_id: null,
      mt5_login,
      mt5_password,
      mt5_server,
      initial_balance_usd: accountSize,
      balance_usd: accountSize,
      equity_usd: accountSize,
      high_water_usd: accountSize,
      day_start_equity_usd: accountSize,
      day_anchor: today,
      daily_loss_pct: rules.daily_loss_pct,
      overall_loss_pct: rules.overall_loss_pct,
      profit_target_pct: rules.profit_target_pct,
      profit_split_pct: 80,
      phase: "evaluation",
      step_index: 1,
      total_steps: rules.steps,
    })
    .select("id, mt5_login, mt5_server")
    .single();

  if (acctErr || !account) {
    return NextResponse.json(
      { error: acctErr?.message ?? "Failed to create account" },
      { status: 500 },
    );
  }

  // Look up user email and send notification.
  let email: string | null = null;
  let emailSent = false;
  try {
    const { data } = await db.auth.admin.getUserById(challenge.user_id);
    email = data.user?.email ?? null;
  } catch {
    // best-effort
  }

  if (email) {
    emailSent = await notifyAccountReady(email, {
      login: mt5_login,
      server: mt5_server,
      size: accountSize,
      step,
    });
  }

  return NextResponse.json({ account, emailSent });
}
