import { dbAdmin } from "@/lib/db";

/**
 * Shared post-payment fulfillment — called by BOTH payment webhooks
 * (Razorpay + NOWPayments) once a challenge is paid.
 *
 * Steps:
 *   1. Load the pending challenge (idempotent — skips if already active).
 *   2. Mark it active + record the gateway payment reference.
 *
 * Admin manually provisions MT5 credentials via /api/admin/activate.
 * Returns a small result object; never throws into the webhook handler.
 */
export async function fulfillChallenge(opts: {
  challengeId: string;
  gateway: "razorpay" | "nowpayments";
  gatewayPaymentId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
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

  return { ok: true };
}
