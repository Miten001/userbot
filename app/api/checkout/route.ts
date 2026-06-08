import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lookupPrice, stepLabel, type Step } from "@/lib/plans";
import { dbServer, dbAdmin } from "@/lib/db";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { isRazorpayConfigured, createPaymentLink } from "@/lib/razorpay";
import { isCryptoConfigured, createInvoice } from "@/lib/crypto-pay";

/**
 * POST /api/checkout
 * Body: {
 *   step: "one"|"two"|"three",
 *   account_size_usd: number,
 *   method: "upi" | "crypto"
 * }
 *
 * Live mode: creates a pending `challenges` row, then a hosted payment page:
 *   • method "upi"    → Razorpay Payment Link (UPI/cards/netbanking)
 *   • method "crypto" → NOWPayments invoice (USDT/BTC/ETH/…)
 * Returns { url } to redirect the user to. A webhook fulfills the order.
 *
 * Demo mode: if the chosen gateway (or Supabase admin) isn't configured,
 * returns a /demo-success URL so the full flow can be previewed without paying.
 */
export type CheckoutMethod = "upi" | "crypto";

export async function POST(req: Request) {
  let body: { step?: Step; account_size_usd?: number; method?: CheckoutMethod };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { step, account_size_usd } = body;
  const method: CheckoutMethod = body.method === "crypto" ? "crypto" : "upi";

  if (!step || !account_size_usd) {
    return NextResponse.json({ error: "Missing step or account_size_usd" }, { status: 400 });
  }

  const price = lookupPrice(account_size_usd, step);
  if (price == null) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const gatewayReady = method === "crypto" ? isCryptoConfigured() : isRazorpayConfigured();

  // ──────────────────────────────────────────────────────────────────────
  // DEMO MODE — gateway or DB not configured. Preview the flow, no real pay.
  // ──────────────────────────────────────────────────────────────────────
  if (!gatewayReady || !isSupabaseAdminConfigured()) {
    const url = new URL("/demo-success", siteUrl);
    url.searchParams.set("step", step);
    url.searchParams.set("size", String(account_size_usd));
    url.searchParams.set("price", String(price));
    url.searchParams.set("method", method);
    return NextResponse.json({
      url: url.toString(),
      mode: "demo",
      hint: `${method === "crypto" ? "NOWPayments" : "Razorpay"} not configured — showing demo checkout. See SETUP.md.`,
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIVE MODE — must be signed in (challenge rows require a user id).
  // ──────────────────────────────────────────────────────────────────────
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to start a challenge.", needsAuth: true },
      { status: 401 },
    );
  }

  // 1. Create the pending challenge row.
  const { data: challenge, error: chErr } = await dbAdmin()
    .from("challenges")
    .insert({
      user_id: user.id,
      step,
      account_size_usd,
      price_usd: price,
      gateway: method === "crypto" ? "nowpayments" : "razorpay",
      state: "pending",
    })
    .select("id")
    .single();

  if (chErr || !challenge) {
    return NextResponse.json({ error: `Could not create order: ${chErr?.message}` }, { status: 500 });
  }

  const label = `ApexFunded ${stepLabel(step)} — $${account_size_usd.toLocaleString()} Challenge`;

  // 2. Create the hosted payment page on the chosen gateway.
  try {
    if (method === "crypto") {
      const inv = await createInvoice({
        amountUsd: price,
        orderId: challenge.id,
        description: label,
        ipnCallbackUrl: `${siteUrl}/api/webhooks/nowpayments`,
        successUrl: `${siteUrl}/dashboard?checkout=success`,
        cancelUrl: `${siteUrl}/#plans`,
      });
      await dbAdmin().from("challenges").update({ gateway_ref: inv.id }).eq("id", challenge.id);
      return NextResponse.json({ url: inv.url, mode: "live", method });
    }

    const link = await createPaymentLink({
      amountUsd: price,
      email: user.email,
      description: label,
      notes: {
        challenge_id: challenge.id,
        user_id: user.id,
        step,
        account_size_usd: String(account_size_usd),
      },
      callbackUrl: `${siteUrl}/dashboard?checkout=success`,
    });
    await dbAdmin().from("challenges").update({ gateway_ref: link.id }).eq("id", challenge.id);
    return NextResponse.json({ url: link.url, mode: "live", method });
  } catch (err) {
    // Roll the challenge back so a failed gateway call doesn't leave orphans.
    await dbAdmin().from("challenges").delete().eq("id", challenge.id);
    const message = err instanceof Error ? err.message : "Payment gateway error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Resolve the logged-in Supabase user (email required). */
async function resolveUser(): Promise<{ id: string; email: string } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = dbServer(cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) return { id: user.id, email: user.email };
  } catch {
    // ignore
  }
  return null;
}
