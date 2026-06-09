import { NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";

/**
 * POST /api/coupon/validate
 * Body: { code: string, price_usd: number, step?: string, account_size_usd?: number }
 * Returns: { valid, discount, finalPrice, message }
 */
export async function POST(req: Request) {
  let body: { code?: string; price_usd?: number; step?: string; account_size_usd?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code, price_usd, step, account_size_usd } = body;

  if (!code || price_usd == null) {
    return NextResponse.json(
      { error: "Missing required fields: code, price_usd" },
      { status: 400 },
    );
  }

  const result = validateCoupon(code, price_usd, { step, account_size_usd });
  return NextResponse.json(result);
}
