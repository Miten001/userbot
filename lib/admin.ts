import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseAdminConfigured } from "@/lib/config";

/**
 * Admin authorization.
 *
 * A request counts as an admin when EITHER:
 *   1. The logged-in user's `profiles.is_admin` flag is true, OR
 *   2. Their Supabase user id is listed in the ADMIN_USER_IDS env var
 *      (comma-separated) -- handy for bootstrapping the first admin before
 *      you've flipped the DB flag.
 *
 * Returns the admin user's id on success, or null when the caller is not an
 * admin (or Supabase isn't configured).
 */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  if (!isSupabaseAdminConfigured()) {
    console.warn("[admin] Supabase admin not configured, denying access");
    return null;
  }

  let user;
  try {
    const supabase = dbServer(cookies());
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch (err) {
    console.warn("[admin] Failed to get user from session:", err);
    return null;
  }

  if (!user) {
    console.warn("[admin] No user in session - user may not be logged in");
    return null;
  }

  // 1. Env allow-list (bootstrap path).
  const adminIds = envAdminIds();
  if (adminIds.includes(user.id)) {
    return { userId: user.id };
  }

  // 2. profiles.is_admin flag.
  try {
    const supabase = dbServer(cookies());
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (error) {
      // If is_admin column doesn't exist or profiles table missing, log and skip
      console.warn("[admin] profiles query failed:", error.message);
    } else if (data?.is_admin === true) {
      return { userId: user.id };
    }
  } catch (err) {
    console.warn("[admin] profiles check threw:", err);
  }

  console.warn("[admin] User", user.id, "is not an admin. ADMIN_USER_IDS contains:", adminIds);
  return null;
}

function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim().replace(/[\r\n\t]/g, ""))
    .filter(Boolean);
}
