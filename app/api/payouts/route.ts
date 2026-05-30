import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/config";

const ALLOWED_METHODS = ["bank", "usdt-trc20", "wise"] as const;
type Method = (typeof ALLOWED_METHODS)[number];

/**
 * GET /api/payouts
 * Returns the logged-in user's payout requests (RLS-protected).
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 401 });
  }

  const supabase = dbServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("payouts")
    .select("id, account_id, amount_usd, method, destination, status, requested_at, paid_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payouts: data ?? [] });
}

/**
 * POST /api/payouts
 * Body: { account_id, amount_usd, method, destination }
 *
 * Creates a withdrawal request against a funded account. We verify the account
 * belongs to the user and that the requested amount doesn't exceed the
 * available profit (equity − starting balance).
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 401 });
  }

  let body: {
    account_id?: string;
    amount_usd?: number;
    method?: string;
    destination?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { account_id, amount_usd, method, destination } = body;

  if (!account_id || !destination || typeof amount_usd !== "number") {
    return NextResponse.json(
      { error: "Missing account_id, amount_usd or destination" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount_usd) || amount_usd <= 0) {
    return NextResponse.json({ error: "amount_usd must be a positive number" }, { status: 400 });
  }
  if (!method || !ALLOWED_METHODS.includes(method as Method)) {
    return NextResponse.json(
      { error: `method must be one of: ${ALLOWED_METHODS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = dbServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the account belongs to the user (RLS already scopes this, but we
  // also need the balances to validate the amount).
  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, user_id, balance_usd, equity_usd, phase")
    .eq("id", account_id)
    .single();

  if (accErr || !account || account.user_id !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (account.phase !== "funded") {
    return NextResponse.json(
      { error: "Payouts are only available on funded accounts" },
      { status: 400 },
    );
  }

  const available = Number(account.equity_usd) - Number(account.balance_usd);
  if (amount_usd > available) {
    return NextResponse.json(
      { error: `Requested amount exceeds available profit ($${available.toFixed(2)})` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("payouts")
    .insert({
      user_id: user.id,
      account_id,
      amount_usd,
      method,
      destination,
      status: "requested",
    })
    .select("id, account_id, amount_usd, method, destination, status, requested_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payout: data }, { status: 201 });
}
