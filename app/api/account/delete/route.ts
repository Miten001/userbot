import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer, dbAdmin } from "@/lib/db";

/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user's account from auth.users.
 * Foreign-key ON DELETE CASCADE removes profiles, challenges, accounts, etc.
 */
export async function POST() {
  const supabase = dbServer(cookies());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = dbAdmin();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
