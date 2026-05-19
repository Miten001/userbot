import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe, lookupPrice, stepLabel, type Step } from "@/lib/stripe";
import { dbServer, dbAdmin } from "@/lib/db";
import { isStripeConfigured, isSupabaseAdminConfigured } from "@/lib/config";

/**
 * POST /api/checkout
 * Body: { step: "one"|"two"|"three", account_size_usd: number, guest_email?: string }
 *
 * Live mode:  creates a Stripe Checkout session + pending DB row.
 * Demo mode:  if Stripe / Supabase aren't configured, returns a URL to a
 *             local /demo-success page that simulates a paid challenge.
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // ──────────────────────────────────────────────────────────────────────
  // DEMO MODE — keys missing. Send the user to a fake "checkout success"
  // page so they can preview the full flow without paying anything real.
  // ──────────────────────────────────────────────────────────────────────
  if (!isStripeConfigured()) {
    const url = new URL("/demo-success", siteUrl);
    url.searchParams.set("step", step);
    url.searchParams.set("size", String(account_size_usd));
    url.searchParams.set("price", String(price));
    return NextResponse.json({
      url: url.toString(),
      mode: "demo",
      hint: "Stripe keys not configured — showing demo checkout. See SETUP.md to enable real payments.",
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIVE MODE
  // ──────────────────────────────────────────────────────────────────────
  const customerEmail = await resolveEmail(guest_email);
  if (!customerEmail) {
    return NextResponse.json(
      { error: "No email provided. Sign in or pass guest_email." },
      { status: 401 },
    );
  }

  let session;
  try {
    session = await stripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: price * 100,
            product_data: {
              name: `ApexFunded ${stepLabel(step)} — $${account_size_usd.toLocaleString()} Challenge`,
              description: "One-time evaluation fee. Refunded with your first payout on a funded account.",
            },
          },
        },
      ],
      success_url: `${siteUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#plans`,
      metadata: {
        step,
        account_size_usd: String(account_size_usd),
        user_id: customerEmail.userId ?? "",
        email: customerEmail.email,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Best-effort: record a pending challenge if Supabase is configured.
  if (customerEmail.userId && isSupabaseAdminConfigured()) {
    try {
      await dbAdmin().from("challenges").insert({
        user_id: customerEmail.userId,
        step,
        account_size_usd,
        price_usd: price,
        stripe_session_id: session.id,
        state: "pending",
      });
    } catch (e) {
      console.warn("Could not insert pending challenge:", e);
    }
  }

  return NextResponse.json({ url: session.url, id: session.id, mode: "live" });
}

/** Try the logged-in user first, then fall back to guest email. */
async function resolveEmail(guestEmail?: string) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = dbServer(cookies());
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) return { email: user.email, userId: user.id };
    } catch {
      // ignore — fall through to guest
    }
  }
  if (guestEmail) return { email: guestEmail, userId: null };
  return null;
}
