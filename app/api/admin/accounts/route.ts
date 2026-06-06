import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { dbAdmin } from "@/lib/db";

/**
 * POST /api/admin/accounts
 * Body: {
 *   account_id: string,
 *   phase?: "evaluation" | "funded" | "breached" | "closed",
 *   equity_usd?: number,
 *   balance_usd?: number,
 *   profit_split_pct?: number,
 *   breach_reason?: string
 * }
 *
 * Manual back-office override for an account. Admin-only. Useful for resolving
 * disputes, manually funding/closing, or correcting balances. Phase changes
 * automatically stamp/clear `funded_at` / `breached_at`.
 */
const PHASES = ["evaluation", "funded", "breached", "closed"] as const;
type Phase = (typeof PHASES)[number];

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    account_id?: string;
    phase?: string;
    equity_usd?: number;
    balance_usd?: number;
    profit_split_pct?: number;
    breach_reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { account_id } = body;
  if (!account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (body.phase !== undefined) {
    if (!PHASES.includes(body.phase as Phase)) {
      return NextResponse.json({ error: `phase must be one of: ${PHASES.join(", ")}` }, { status: 400 });
    }
    patch.phase = body.phase;
    if (body.phase === "funded") {
      patch.funded_at = now;
      patch.breached_at = null;
      patch.breach_reason = null;
    } else if (body.phase === "breached") {
      patch.breached_at = now;
      patch.breach_reason = body.breach_reason ?? "Manually breached by admin";
    } else if (body.phase === "evaluation") {
      // Re-activating — clear breach markers.
      patch.breached_at = null;
      patch.breach_reason = null;
    }
  }

  for (const key of ["equity_usd", "balance_usd", "profit_split_pct"] as const) {
    if (body[key] !== undefined) {
      const value = body[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return NextResponse.json({ error: `${key} must be a non-negative number` }, { status: 400 });
      }
      patch[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = dbAdmin();
  const { data, error } = await db
    .from("accounts")
    .update(patch)
    .eq("id", account_id)
    .select(
      "id, user_id, mt5_login, initial_balance_usd, balance_usd, equity_usd, phase, step_index, total_steps, profit_split_pct, funded_at, breached_at, breach_reason",
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Account not found" }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ account: data });
}
