import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * GET /api/profile
 * Returns the logged-in user's profile (RLS-protected). The row is created
 * automatically by the `handle_new_user` trigger on signup, but we upsert a
 * blank one here too in case an older account predates the trigger.
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
    .from("profiles")
    .select("id, full_name, country, phone, is_admin, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data ?? { id: user.id, full_name: null, country: null, phone: null, is_admin: false },
    email: user.email ?? null,
  });
}

/**
 * PATCH /api/profile
 * Body: { full_name?, country?, phone? }
 * Updates the editable profile fields. `is_admin` is intentionally NOT
 * accepted here — that can only be granted via the DB / service role.
 */
export async function PATCH(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 401 });
  }

  let body: { full_name?: unknown; country?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  for (const key of ["full_name", "country", "phone"] as const) {
    if (key in body) {
      const value = body[key];
      if (value !== null && typeof value !== "string") {
        return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 });
      }
      patch[key] = value === null ? null : (value as string).trim().slice(0, 120);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const supabase = dbServer(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Upsert so the call succeeds even if the profile row doesn't exist yet.
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...patch }, { onConflict: "id" })
    .select("id, full_name, country, phone, is_admin, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
