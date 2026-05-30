import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * GET /api/trades?account_id=<uuid>
 *
 * Returns the logged-in user's trades. RLS limits rows to accounts owned by the
 * caller; the optional `account_id` query param narrows it to one account.
 */
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 401 });
  }

  const supabase = dbServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = new URL(req.url).searchParams.get("account_id");

  // Apply filters (.eq) BEFORE transforms (.order/.limit) so the query stays
  // type-correct in postgrest-js.
  let filter = supabase
    .from("trades")
    .select(
      "id, account_id, ticket, symbol, side, volume, open_price, close_price, profit_usd, opened_at, closed_at",
    );

  if (accountId) {
    filter = filter.eq("account_id", accountId);
  }

  const { data, error } = await filter
    .order("opened_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trades: data ?? [] });
}
