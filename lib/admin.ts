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
 *
 * Supabase SSR v0.5.x uses CHUNKED cookies:
 *   sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, ...
 * We also check for the non-chunked name as a fallback.
 */
async function fallbackGetUser(cookieStore: ReturnType<typeof cookies>) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;

    // Extract project ref from URL (e.g. "abc123" from "https://abc123.supabase.co")
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    const cookieBaseName = `sb-${projectRef}-auth-token`;

    // Attempt 1: Read chunked cookies (sb-<ref>-auth-token.0, .1, .2, ...)
    let rawCookie = readChunkedCookie(cookieStore, cookieBaseName);

    // Attempt 2: Try the non-chunked cookie name
    if (!rawCookie) {
      rawCookie = cookieStore.get(cookieBaseName)?.value || null;
    }

    if (!rawCookie) {
      // Attempt 3: List all cookies and look for any that start with sb- and contain auth-token
      const allCookies = cookieStore.getAll();
      const authCookies = allCookies.filter(
        (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
      );
      console.warn(
        "[admin][fallback] No auth cookie found. Base name:", cookieBaseName,
        "| Available sb-*auth* cookies:", authCookies.map((c) => c.name),
      );

      // If we found chunked cookies with a slightly different pattern, try them
      if (authCookies.length > 0) {
        // Sort by name to get correct chunk order
        const sorted = authCookies.sort((a, b) => a.name.localeCompare(b.name));
        rawCookie = sorted.map((c) => c.value).join("");
        console.log("[admin][fallback] Assembled from found cookies:", authCookies.map((c) => c.name));
      }

      if (!rawCookie) return null;
    }

    // Parse the cookie value
    const accessToken = extractAccessToken(rawCookie);

    if (!accessToken) {
      console.warn("[admin][fallback] No access_token found in cookie payload (length:", rawCookie.length, ")");
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

/**
 * Read chunked Supabase cookies. The SSR library splits large cookies into
 * chunks named: <baseName>.0, <baseName>.1, <baseName>.2, ...
 * Returns the concatenated value or null if no chunks found.
 */
function readChunkedCookie(
  cookieStore: ReturnType<typeof cookies>,
  baseName: string,
): string | null {
  const chunks: string[] = [];
  for (let i = 0; i < 10; i++) {
    const chunk = cookieStore.get(`${baseName}.${i}`);
    if (!chunk) break;
    chunks.push(chunk.value);
  }
  if (chunks.length === 0) return null;
  console.log(`[admin][fallback] Found ${chunks.length} chunked cookie(s) for ${baseName}`);
  return chunks.join("");
}

/**
 * Extract access_token from a raw cookie string.
 * Handles: JSON, URL-encoded JSON, base64-encoded JSON, and arrays.
 */
function extractAccessToken(raw: string): string | null {
  // Try direct JSON parse
  let parsed = tryParseJson(raw);

  // Try URL-decoded
  if (!parsed) {
    try {
      parsed = tryParseJson(decodeURIComponent(raw));
    } catch {
      // decodeURIComponent can throw on malformed sequences
    }
  }

  // Try base64 decode
  if (!parsed) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      parsed = tryParseJson(decoded);
    } catch {
      // not valid base64
    }
  }

  if (!parsed) return null;

  // Extract access_token from various shapes
  if (typeof parsed === "object" && parsed !== null) {
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Supabase stores [access_token, refresh_token, ...] or [{access_token, ...}]
      if (typeof parsed[0] === "string") {
        // First element is the access_token itself
        return parsed[0];
      }
      return parsed[0]?.access_token || null;
    }
    return parsed.access_token || null;
  }

  return null;
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim().replace(/[\r\n\t]/g, ""))
    .filter(Boolean);
}
