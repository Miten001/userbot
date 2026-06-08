import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyIpn, isPaidStatus } from "@/lib/crypto-pay";
import { fulfillChallenge } from "@/lib/fulfillment";

/**
 * POST /api/webhooks/nowpayments
 *
 * NOWPayments IPN callback. We verify the `x-nowpayments-sig` header (HMAC of
 * the alphabetically-sorted JSON body), then fulfill the matching challenge
 * once the payment reaches a paid status (`finished` / `confirmed`).
 *
 * `order_id` carries our challenge id (set when creating the invoice).
 * Configure NOWPAYMENTS_IPN_SECRET and point your IPN URL here.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = headers().get("x-nowpayments-sig");

  let payload: { order_id?: string; payment_status?: string; payment_id?: string | number };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!verifyIpn(payload, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Wait for a paid status; ack the rest so NOWPayments stops retrying.
  if (!isPaidStatus(payload.payment_status)) {
    return NextResponse.json({ received: true, status: payload.payment_status });
  }

  const challengeId = payload.order_id;
  if (!challengeId) {
    console.warn("NOWPayments webhook: missing order_id");
    return NextResponse.json({ received: true });
  }

  const result = await fulfillChallenge({
    challengeId,
    gateway: "nowpayments",
    gatewayPaymentId: payload.payment_id != null ? String(payload.payment_id) : undefined,
  });

  return NextResponse.json({ received: true, ...result });
}
