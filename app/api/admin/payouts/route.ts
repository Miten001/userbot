import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { dbAdmin } from "@/lib/db";
import { notifyPayout } from "@/lib/email";

/**
 * POST /api/admin/payouts
 * Body: { payout_id: string, status: "approved" | "rejected" | "paid" }
 *
 * Moves a withdrawal request through its lifecycle. Admin-only.
 * Allowed transitions:
 *   requested → approved | rejected
 *   approved  → paid | rejected
 * Marking a payout `paid` stamps `paid_at`.
 */
const NEXT_STATES: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { payout_id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { payout_id, status } = body;
  if (!payout_id || !status) {
    return NextResponse.json({ error: "Missing payout_id or status" }, { status: 400 });
  }
  if (!["approved", "rejected", "paid"].includes(status)) {
    return NextResponse.json({ error: "status must be approved, rejected or paid" }, { status: 400 });
  }

  const db = dbAdmin();

  const { data: current, error: findErr } = await db
    .from("payouts")
    .select("id, status")
    .eq("id", payout_id)
    .single();

  if (findErr || !current) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const allowed = NEXT_STATES[current.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot move payout from '${current.status}' to '${status}'` },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();

  const { data, error } = await db
    .from("payouts")
    .update(patch)
    .eq("id", payout_id)
    .select("id, user_id, account_id, amount_usd, method, destination, status, requested_at, paid_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort status email to the trader (no-op unless RESEND_API_KEY is set).
  if (data?.user_id) {
    try {
      const { data: u } = await db.auth.admin.getUserById(data.user_id);
      if (u.user?.email) {
        await notifyPayout(u.user.email, { amount: Number(data.amount_usd), status });
      }
    } catch {
      // ignore email failures
    }
  }

  return NextResponse.json({ payout: data });
}
