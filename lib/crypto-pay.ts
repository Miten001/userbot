import crypto from "crypto";

/**
 * NOWPayments — crypto checkout (USDT / BTC / ETH / 100+ coins).
 *
 * We use the **Invoice** API: the server creates a hosted invoice, we redirect
 * the user to `invoice_url`, they pick a coin and pay, and NOWPayments calls
 * our IPN webhook when the payment is confirmed/finished.
 *
 * No SDK — plain REST with `x-api-key`. Configure with:
 *   NOWPAYMENTS_API_KEY     — create invoices
 *   NOWPAYMENTS_IPN_SECRET  — verify IPN callbacks
 */

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

export type CreateInvoiceInput = {
  amountUsd: number;
  orderId: string; // our challenge id
  description: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateInvoiceResult = { id: string; url: string };

/** Creates a NOWPayments invoice and returns its id + hosted invoice_url. */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY || "", "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: input.amountUsd,
      price_currency: "usd",
      order_id: input.orderId,
      order_description: input.description.slice(0, 500),
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`NOWPayments invoice failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as { id: string; invoice_url: string };
  return { id: data.id, url: data.invoice_url };
}

/**
 * Verifies a NOWPayments IPN signature.
 * Header `x-nowpayments-sig` = HMAC-SHA512 of the JSON body with keys sorted
 * alphabetically, using NOWPAYMENTS_IPN_SECRET.
 */
export function verifyIpn(parsedBody: unknown, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  try {
    const sorted = JSON.stringify(sortObject(parsedBody));
    const expected = crypto.createHmac("sha512", secret).update(sorted).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Recursively sort object keys (NOWPayments signs the alphabetically-sorted JSON). */
function sortObject(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObject((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

/** NOWPayments statuses that mean "money received, fulfill now". */
export function isPaidStatus(status: string | undefined): boolean {
  return status === "finished" || status === "confirmed";
}
