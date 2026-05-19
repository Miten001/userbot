import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazy Stripe client — won't crash builds when STRIPE_SECRET_KEY isn't set. */
export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

/* ───────────────────────────────────────────────────────────────────────────
 * Plan catalog — kept in code (single source of truth) so the frontend
 * Plans.tsx and the backend checkout route always agree on prices.
 *
 * Prices are in USD WHOLE DOLLARS. Stripe wants cents (multiply by 100).
 * ─────────────────────────────────────────────────────────────────────── */

export type Step = "one" | "two" | "three";

export type PlanRow = {
  size: number;        // 2500, 5000, 10000, ...
  prices: Record<Step, number>;   // 1-step / 2-step / 3-step in USD
};

export const PLAN_CATALOG: PlanRow[] = [
  { size:  2500,  prices: { one:  25, two:  19, three:  15 } },
  { size:  5000,  prices: { one:  45, two:  29, three:  22 } },
  { size: 10000,  prices: { one:  69, two:  39, three:  29 } },
  { size: 25000,  prices: { one: 139, two:  79, three:  59 } },
  { size: 50000,  prices: { one: 229, two: 139, three: 109 } },
  { size:100000,  prices: { one: 489, two: 329, three: 259 } },
  { size:200000,  prices: { one: 989, two: 649, three: 499 } },
];

export function lookupPrice(size: number, step: Step): number | null {
  const row = PLAN_CATALOG.find((p) => p.size === size);
  return row ? row.prices[step] : null;
}

export function stepLabel(step: Step) {
  return ({ one: "1-Step", two: "2-Step", three: "3-Step" } as const)[step];
}

/** Default risk parameters per step — used when provisioning an account. */
export function stepRules(step: Step) {
  switch (step) {
    case "one":   return { profit_target_pct:  10, daily_loss_pct: 4, overall_loss_pct:  6, steps: 1 };
    case "two":   return { profit_target_pct:   8, daily_loss_pct: 5, overall_loss_pct: 10, steps: 2 };
    case "three": return { profit_target_pct:   6, daily_loss_pct: 5, overall_loss_pct: 12, steps: 3 };
  }
}
