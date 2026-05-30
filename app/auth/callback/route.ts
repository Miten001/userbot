import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * GET /auth/callback?code=...&next=/dashboard
 *
 * Supabase redirects here after a user confirms their email (or completes an
 * OAuth flow). We exchange the one-time `code` for a session, which sets the
 * auth cookies, then bounce the user to `next` (default: the dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${siteUrl}/login?error=not_configured`);
  }

  if (code) {
    const supabase = dbServer(cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback`);
}

/** Only allow same-site relative paths to avoid open-redirects. */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
