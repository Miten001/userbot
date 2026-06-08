import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyWebhook } from "@/lib/razorpay";
import { fulfillChallenge } from "@/lib/fulfillment";

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay calls this when a Payment Link is paid. We verify the
 * `x-razorpay-signature` header against the raw body, then fulfill the
 * matching challenge (found via the `challenge_id` we stored in `notes`).
 *
 * Configure the webhook in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://your-site.vercel.app/api/webhooks/razorpay
 *   Events: payment_link.paid
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = headers().get("x-razorpay-signature");

  if (!verifyWebhook(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment_link?: { entity?: { id?: string; notes?: Record<string, string> } };
      payment?: { entity?: { id?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Only act on a successful payment link.
  if (event.event !== "payment_link.paid") {
    return NextResponse.json({ received: true, ignored: event.event });
  }

  const notes = event.payload?.payment_link?.entity?.notes ?? {};
  const challengeId = notes.challenge_id;
  const paymentId = event.payload?.payment?.entity?.id;

  if (!challengeId) {
    console.warn("Razorpay webhook: missing challenge_id in notes");
    return NextResponse.json({ received: true });
  }

  const result = await fulfillChallenge({
    challengeId,
    gateway: "razorpay",
    gatewayPaymentId: paymentId,
  });

  return NextResponse.json({ received: true, ...result });
}
