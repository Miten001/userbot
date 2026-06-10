import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer, dbAdmin } from "@/lib/db";

/**
 * GET /api/admin/debug
 *
 * Diagnostic endpoint to debug admin authentication issues.
 * Returns cookie names, env var status, and auth results.
 * Does NOT expose sensitive values (only names and booleans).
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Environment checks
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const adminUserIds = process.env.ADMIN_USER_IDS || "(not set)";

  diagnostics.env = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, "").slice(0, 30) + "..." : "(not set)",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hasAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: hasServiceRole,
    ADMIN_USER_IDS: adminUserIds,
  };

  // 2. Extract project ref
  let projectRef = "(unknown)";
  try {
    if (supabaseUrl) {
      const hostname = new URL(supabaseUrl).hostname;
      projectRef = hostname.split(".")[0];
    }
  } catch {
    projectRef = "(parse error)";
  }
  diagnostics.projectRef = projectRef;

  // 3. Cookie analysis
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map((c) => c.name);

  const cookieBaseName = `sb-${projectRef}-auth-token`;
  const relevantCookies = cookieNames.filter(
    (name) => name.startsWith("sb-") || name.includes("auth"),
  );

  // Check chunked cookies
  const chunkedCookies: string[] = [];
  for (let i = 0; i < 10; i++) {
    const name = `${cookieBaseName}.${i}`;
    if (cookieStore.get(name)) {
      chunkedCookies.push(name);
    }
  }

  // Check non-chunked cookie
  const hasNonChunked = Boolean(cookieStore.get(cookieBaseName));

  diagnostics.cookies = {
    total_count: allCookies.length,
    all_names: cookieNames,
    relevant_auth_cookies: relevantCookies,
    expected_base_name: cookieBaseName,
    has_non_chunked: hasNonChunked,
    chunked_found: chunkedCookies,
    chunked_count: chunkedCookies.length,
  };

  // 4. SSR client getUser result
  let ssrUserId: string | null = null;
  let ssrError: string | null = null;
  try {
    const supabase = dbServer(cookieStore);
    const res = await supabase.auth.getUser();
    ssrUserId = res.data.user?.id || null;
    ssrError = res.error?.message || null;
  } catch (err: any) {
    ssrError = err?.message || String(err);
  }

  diagnostics.ssr_client = {
    user_id: ssrUserId,
    error: ssrError,
  };

  // 5. Manual token extraction attempt (for debugging)
  let manualTokenResult: Record<string, unknown> = {};
  try {
    // Try chunked
    let rawValue: string | null = null;
    if (chunkedCookies.length > 0) {
      rawValue = chunkedCookies.map((name) => cookieStore.get(name)?.value || "").join("");
      manualTokenResult.source = "chunked";
    } else if (hasNonChunked) {
      rawValue = cookieStore.get(cookieBaseName)?.value || null;
      manualTokenResult.source = "non-chunked";
    } else {
      // Try any sb-*auth* cookie
      const sbAuthCookies = allCookies.filter(
        (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
      );
      if (sbAuthCookies.length > 0) {
        const sorted = sbAuthCookies.sort((a, b) => a.name.localeCompare(b.name));
        rawValue = sorted.map((c) => c.value).join("");
        manualTokenResult.source = "wildcard-match";
        manualTokenResult.matched_cookies = sorted.map((c) => c.name);
      }
    }

    if (rawValue) {
      manualTokenResult.raw_length = rawValue.length;
      manualTokenResult.raw_preview = rawValue.slice(0, 50) + "...";

      // Try parsing
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawValue);
        manualTokenResult.parse_method = "direct JSON";
      } catch {
        try {
          parsed = JSON.parse(decodeURIComponent(rawValue));
          manualTokenResult.parse_method = "URL-decoded JSON";
        } catch {
          try {
            const decoded = Buffer.from(rawValue, "base64").toString("utf-8");
            parsed = JSON.parse(decoded);
            manualTokenResult.parse_method = "base64 JSON";
          } catch {
            manualTokenResult.parse_method = "FAILED all methods";
          }
        }
      }

      if (parsed) {
        manualTokenResult.parsed_type = Array.isArray(parsed) ? "array" : typeof parsed;
        if (Array.isArray(parsed)) {
          manualTokenResult.array_length = parsed.length;
          manualTokenResult.first_element_type = typeof parsed[0];
          if (typeof parsed[0] === "object" && parsed[0]) {
            manualTokenResult.first_element_keys = Object.keys(parsed[0]);
          }
        } else if (typeof parsed === "object" && parsed !== null) {
          manualTokenResult.keys = Object.keys(parsed);
        }

        // Try to get access_token and verify
        let accessToken: string | null = null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === "string") {
            accessToken = parsed[0];
          } else {
            accessToken = parsed[0]?.access_token || null;
          }
        } else if (parsed?.access_token) {
          accessToken = parsed.access_token;
        }

        manualTokenResult.has_access_token = Boolean(accessToken);
        if (accessToken) {
          manualTokenResult.token_preview = accessToken.slice(0, 20) + "...";

          // Verify with service role
          if (hasServiceRole) {
            try {
              const adminClient = dbAdmin();
              const { data, error } = await adminClient.auth.getUser(accessToken);
              manualTokenResult.verification = {
                user_id: data?.user?.id || null,
                error: error?.message || null,
              };
            } catch (err: any) {
              manualTokenResult.verification = { error: err?.message || String(err) };
            }
          }
        }
      }
    } else {
      manualTokenResult.source = "none found";
    }
  } catch (err: any) {
    manualTokenResult.error = err?.message || String(err);
  }

  diagnostics.manual_token_extraction = manualTokenResult;

  // 6. Admin check result
  let isAdmin = false;
  if (ssrUserId) {
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    isAdmin = adminIds.includes(ssrUserId);
  } else if (manualTokenResult.verification && typeof manualTokenResult.verification === "object") {
    const v = manualTokenResult.verification as Record<string, unknown>;
    if (v.user_id) {
      const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
      isAdmin = adminIds.includes(v.user_id as string);
    }
  }

  diagnostics.admin_check = {
    would_be_admin: isAdmin,
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
