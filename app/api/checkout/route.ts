import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe, lookupPrice, stepLabel, type Step } from "@/lib/stripe";
import { dbServer, dbAdmin } from "@/lib/db";

/**
 * POST /api/checkout
 * Body: { step: "one"|"two"|"three", account_size_usd: number }
 *
 * Creates a Stripe Checkout session for the given plan and inserts a pending
 * `challenges` row keyed to the Stripe session id. The webhook flips the row
 * to `active` and provisions the MT5 account once payment succeeds.
 */
export async function POST(req: Request) {
  let body: { step?: Step; account_size_usd?: number; guest_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { step, account_size_usd, guest_email } = body;
  if (!step || !account_size_usd) {
    return NextResponse.json({ error: "Missing step or account_size_usd" }, { status: 400 });
  }

  const price = lookupPrice(account_size_usd, step);
  if (price == null) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  // Resolve user (logged-in or guest checkout).
  const supabase = dbServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  const customerEmail = user?.email ?? guest_email;
  if (!customerEmail) {
    return NextResponse.json(
      { error: "Not authenticated. Pass guest_email or sign in first." },
      { status: 401 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // Create the Stripe session.
  let session;
  try {
    session = await stripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: price * 100,
            product_data: {
              name: `ApexFunded ${stepLabel(step)} — $${account_size_usd.toLocaleString()} Challenge`,
              description:
                "One-time evaluation fee. Refunded with your first payout on a funded account.",
            },
          },
        },
      ],
      success_url: `${siteUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#plans`,
      metadata: {
        step,
        account_size_usd: String(account_size_usd),
        user_id: user?.id ?? "",
        email: customerEmail,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Record a pending challenge so the webhook has something to update.
  if (user?.id) {
    const admin = dbAdmin();
    await admin.from("challenges").insert({
      user_id: user.id,
      step,
      account_size_usd,
      price_usd: price,
      stripe_session_id: session.id,
      state: "pending",
    });
  }

  return NextResponse.json({ url: session.url, id: session.id });
}
