import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe, stepRules, type Step } from "@/lib/stripe";
import { dbAdmin } from "@/lib/db";
import { getMT5Provider } from "@/lib/mt5";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends a signed event whenever a checkout completes. We verify the
 * signature with STRIPE_WEBHOOK_SECRET, then:
 *   1. Update the matching `challenges` row to `active`.
 *   2. Ask the MT5 provider to provision an account.
 *   3. Insert an `accounts` row tied to the user + challenge.
 *
 * NOTE: Stripe needs the *raw* request body to verify the signature, so we
 * read it as text and pass it to `constructEvent`.
 */
export async function POST(req: Request) {
  const sig = headers().get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Bad signature: ${message}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Ignore other events for now.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const email = meta.email ?? session.customer_email ?? "";
  const step = meta.step as Step | undefined;
  const accountSize = Number(meta.account_size_usd);

  if (!userId || !step || !accountSize) {
    // Guest checkout or malformed — ack so Stripe doesn't retry forever.
    console.warn("Stripe webhook: missing metadata", meta);
    return NextResponse.json({ received: true });
  }

  const admin = dbAdmin();

  // 1. Mark the challenge active.
  const { data: challenge, error: chErr } = await admin
    .from("challenges")
    .update({
      state: "active",
      stripe_payment_intent: session.payment_intent as string | null,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .select()
    .single();

  if (chErr || !challenge) {
    console.error("Failed to update challenge", chErr);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  // 2. Provision MT5 (or mock).
  const mt5 = getMT5Provider();
  const provisioned = await mt5.provision({
    account_size_usd: accountSize,
    user_email: email,
    group: `evaluation-${step}-${accountSize}`,
  });

  // 3. Save the funded account row.
  const rules = stepRules(step);
  await admin.from("accounts").insert({
    user_id: userId,
    challenge_id: challenge.id,
    provider: provisioned.provider,
    provider_id: provisioned.provider_id,
    mt5_login: provisioned.login,
    mt5_password: provisioned.password,
    mt5_server: provisioned.server,
    balance_usd: provisioned.balance_usd,
    equity_usd: provisioned.balance_usd,
    high_water_usd: provisioned.balance_usd,
    daily_loss_pct: rules.daily_loss_pct,
    overall_loss_pct: rules.overall_loss_pct,
    profit_target_pct: rules.profit_target_pct,
    phase: "evaluation",
    step_index: 1,
  });

  return NextResponse.json({ received: true, accountSize, step });
}
