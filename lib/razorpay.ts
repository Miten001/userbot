import crypto from "crypto";
import { usdToInr } from "@/lib/plans";

/**
 * Razorpay — UPI / cards / netbanking / wallets (India).
 *
 * We use the **Payment Links** API: the server creates a hosted payment link,
 * we redirect the user to `short_url`, they pay via UPI (GPay/PhonePe/Paytm) or
 * any other method, and Razorpay calls our webhook (`payment_link.paid`).
 *
 * No SDK needed — plain REST with Basic auth (key_id:key_secret).
 * Configure with RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
 */

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID || "";
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export type CreateLinkInput = {
  amountUsd: number;
  email: string;
  description: string;
  notes: Record<string, string>;
  callbackUrl: string;
};

export type CreateLinkResult = { id: string; url: string };

/** Creates a Razorpay Payment Link and returns its id + short_url. */
export async function createPaymentLink(input: CreateLinkInput): Promise<CreateLinkResult> {
  const amountPaise = Math.round(input.amountUsd * usdToInr() * 100);

  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      description: input.description.slice(0, 2048),
      customer: { email: input.email },
      notify: { email: false, sms: false },
      reminder_enable: false,
      notes: input.notes,
      callback_url: input.callbackUrl,
      callback_method: "get",
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Razorpay payment link failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as { id: string; short_url: string };
  return { id: data.id, url: data.short_url };
}

/**
 * Verifies a Razorpay webhook signature.
 * Razorpay sends header `x-razorpay-signature` = HMAC-SHA256(rawBody, webhookSecret).
 */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
