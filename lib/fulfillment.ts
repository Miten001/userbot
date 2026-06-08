import { dbAdmin } from "@/lib/db";
import { getMT5Provider } from "@/lib/mt5";
import { stepRules, type Step } from "@/lib/plans";
import { notifyAccountReady } from "@/lib/email";

/**
 * Shared post-payment fulfillment — called by BOTH payment webhooks
 * (Razorpay + NOWPayments) once a challenge is paid.
 *
 * Steps:
 *   1. Load the pending challenge (idempotent — skips if already active).
 *   2. Mark it active + record the gateway payment reference.
 *   3. Provision an MT5 (or mock) account.
 *   4. Insert the `accounts` row.
 *   5. Send a best-effort "account ready" email.
 *
 * Returns a small result object; never throws into the webhook handler.
 */
export async function fulfillChallenge(opts: {
  challengeId: string;
  gateway: "razorpay" | "nowpayments";
  gatewayPaymentId?: string;
}): Promise<{ ok: boolean; reason?: string; accountId?: string }> {
  const { challengeId, gateway, gatewayPaymentId } = opts;
  const admin = dbAdmin();

  // 1. Load challenge.
  const { data: challenge, error: loadErr } = await admin
    .from("challenges")
    .select("id, user_id, step, account_size_usd, state")
    .eq("id", challengeId)
    .single();

  if (loadErr || !challenge) {
    console.warn("fulfillChallenge: challenge not found", challengeId, loadErr?.message);
    return { ok: false, reason: "challenge_not_found" };
  }

  // Idempotency: if it's already been fulfilled, do nothing.
  if (challenge.state !== "pending") {
    return { ok: true, reason: "already_fulfilled" };
  }

  // 2. Mark active.
  const { error: updErr } = await admin
    .from("challenges")
    .update({
      state: "active",
      gateway,
      gateway_payment_id: gatewayPaymentId ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", challengeId)
    .eq("state", "pending"); // guard against double-fulfill races

  if (updErr) {
    console.error("fulfillChallenge: failed to activate", updErr.message);
    return { ok: false, reason: "activate_failed" };
  }

  const step = challenge.step as Step;
  const accountSize = Number(challenge.account_size_usd);
  const email = await userEmail(admin, challenge.user_id);

  // 3. Provision MT5 (or mock).
  const mt5 = getMT5Provider();
  const provisioned = await mt5.provision({
    account_size_usd: accountSize,
    user_email: email ?? "",
    group: `evaluation-${step}-${accountSize}`,
  });

  // 4. Save the account row.
  const rules = stepRules(step);
  const today = new Date().toISOString().slice(0, 10);
  const { data: account, error: acctErr } = await admin
    .from("accounts")
    .insert({
      user_id: challenge.user_id,
      challenge_id: challenge.id,
      provider: provisioned.provider,
      provider_id: provisioned.provider_id,
      mt5_login: provisioned.login,
      mt5_password: provisioned.password,
      mt5_server: provisioned.server,
      initial_balance_usd: provisioned.balance_usd,
      balance_usd: provisioned.balance_usd,
      equity_usd: provisioned.balance_usd,
      high_water_usd: provisioned.balance_usd,
      day_start_equity_usd: provisioned.balance_usd,
      day_anchor: today,
      daily_loss_pct: rules.daily_loss_pct,
      overall_loss_pct: rules.overall_loss_pct,
      profit_target_pct: rules.profit_target_pct,
      phase: "evaluation",
      step_index: 1,
      total_steps: rules.steps,
    })
    .select("id")
    .single();

  if (acctErr) {
    console.error("fulfillChallenge: account insert failed", acctErr.message);
    return { ok: false, reason: "account_insert_failed" };
  }

  // 5. Best-effort email (no-op unless RESEND_API_KEY set).
  if (email) {
    await notifyAccountReady(email, {
      login: provisioned.login,
      server: provisioned.server,
      size: accountSize,
      step,
    });
  }

  return { ok: true, accountId: account?.id };
}

/** Look up a user's email via the service-role admin API (best-effort). */
async function userEmail(admin: ReturnType<typeof dbAdmin>, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
