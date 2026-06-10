import { cookies } from "next/headers";
import { dbServer, dbAdmin } from "@/lib/db";
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
  const cookieStore = cookies();
  try {
    const supabase = dbServer(cookieStore);
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch (err) {
    console.warn("[admin] Failed to get user from session:", err);
    return null;
  }

  if (!user) {
    console.warn("[admin] No user from SSR client, trying cookie fallback...");
    user = await fallbackGetUser(cookieStore);
    if (!user) {
      console.warn("[admin] Fallback also failed - user not authenticated");
      return null;
    }
    console.log("[admin] Fallback succeeded, got user:", user.id);
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

/**
 * Fallback: read the raw Supabase auth cookie and verify the access token
 * using the service role client. This handles cases where the SSR client
 * fails to parse or refresh the session cookie.
 */
async function fallbackGetUser(cookieStore: ReturnType<typeof cookies>) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;

    // Extract project ref from URL (e.g. "abc123" from "https://abc123.supabase.co")
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;

    const rawCookie = cookieStore.get(cookieName)?.value;
    if (!rawCookie) {
      console.warn("[admin][fallback] No auth cookie found with name:", cookieName);
      return null;
    }

    // Parse the cookie value - it may be JSON or base64-encoded JSON
    let parsed: any;
    try {
      parsed = JSON.parse(decodeURIComponent(rawCookie));
    } catch {
      try {
        parsed = JSON.parse(rawCookie);
      } catch {
        console.warn("[admin][fallback] Could not parse cookie value");
        return null;
      }
    }

    // Extract access_token - could be at root level or inside first array element
    let accessToken: string | undefined;
    if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed) && parsed.length > 0) {
        accessToken = parsed[0]?.access_token;
      } else {
        accessToken = parsed.access_token;
      }
    }

    if (!accessToken) {
      console.warn("[admin][fallback] No access_token found in parsed cookie");
      return null;
    }

    // Verify the token using the service role client
    const adminClient = dbAdmin();
    const { data, error } = await adminClient.auth.getUser(accessToken);

    if (error || !data.user) {
      console.warn("[admin][fallback] Token verification failed:", error?.message);
      return null;
    }

    return data.user;
  } catch (err) {
    console.warn("[admin][fallback] Unexpected error:", err);
    return null;
  }
}

function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim().replace(/[\r\n\t]/g, ""))
    .filter(Boolean);
}
