/* ───────────────────────────────────────────────────────────────────────────
 * Coupon / discount code utility
 *
 * Demo catalog of coupon codes with validation logic.
 * Used by:
 *   - /api/coupon/validate (client-side preview)
 *   - /api/checkout (server-side enforcement)
 * ─────────────────────────────────────────────────────────────────────── */

export type CouponType = "percent" | "fixed";

export type Coupon = {
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  description?: string;
};

export const COUPON_CATALOG: Coupon[] = [
  { code: "APEX10", type: "percent", value: 10, active: true, description: "10% off" },
  { code: "FIRST20", type: "percent", value: 20, active: true, description: "20% off first purchase" },
  { code: "SAVE5", type: "fixed", value: 5, active: true, description: "$5 off" },
  { code: "WELCOME15", type: "percent", value: 15, active: true, description: "15% off" },
  { code: "EXPIRED50", type: "percent", value: 50, active: false, description: "Expired coupon" },
];

export function validateCoupon(
  code: string,
  priceUsd: number,
): { valid: boolean; discount: number; finalPrice: number; message: string } {
  const coupon = COUPON_CATALOG.find(
    (c) => c.code.toLowerCase() === code.trim().toLowerCase(),
  );

  if (!coupon || !coupon.active) {
    return {
      valid: false,
      discount: 0,
      finalPrice: priceUsd,
      message: "Invalid or expired coupon code",
    };
  }

  let discount: number;
  if (coupon.type === "percent") {
    discount = Math.round((priceUsd * coupon.value) / 100);
  } else {
    discount = coupon.value;
  }

  const finalPrice = Math.max(priceUsd - discount, 0);

  return {
    valid: true,
    discount,
    finalPrice,
    message: `Coupon applied! You save $${discount}`,
  };
}
