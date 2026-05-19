import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";

/**
 * GET /api/account
 *
 * Returns the logged-in user's accounts (and the challenge that produced each).
 * Relies on Supabase RLS — the supabase client uses the user's session cookie,
 * so they only see their own rows.
 */
export async function GET() {
  const supabase = dbServer(cookies());

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      id, mt5_login, mt5_server, balance_usd, equity_usd,
      phase, step_index, profit_target_pct, daily_loss_pct, overall_loss_pct,
      created_at,
      challenge:challenges (
        id, step, account_size_usd, price_usd, state, paid_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}
