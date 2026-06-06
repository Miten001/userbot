import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseAdminConfigured } from "@/lib/config";

/**
 * Admin authorization.
 *
 * A request counts as an admin when EITHER:
 *   1. The logged-in user's `profiles.is_admin` flag is true, OR
 *   2. Their Supabase user id is listed in the ADMIN_USER_IDS env var
 *      (comma-separated) — handy for bootstrapping the first admin before
 *      you've flipped the DB flag.
 *
 * Returns the admin user's id on success, or null when the caller is not an
 * admin (or Supabase isn't configured).
 */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  if (!isSupabaseAdminConfigured()) return null;

  let user;
  try {
    const supabase = dbServer(cookies());
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch {
    return null;
  }
  if (!user) return null;

  // 1. Env allow-list (bootstrap path).
  if (envAdminIds().includes(user.id)) return { userId: user.id };

  // 2. profiles.is_admin flag.
  try {
    const supabase = dbServer(cookies());
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (data?.is_admin === true) return { userId: user.id };
  } catch {
    // ignore — fall through to "not admin"
  }

  return null;
}

function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
