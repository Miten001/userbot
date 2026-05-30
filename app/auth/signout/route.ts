import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbServer } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * POST /auth/signout
 *
 * Clears the Supabase session cookies and sends the user back to the homepage.
 * Used by the "Log out" button in the navbar (a tiny <form> post).
 */
export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (isSupabaseConfigured()) {
    try {
      const supabase = dbServer(cookies());
      await supabase.auth.signOut();
    } catch {
      // ignore — we still redirect home
    }
  }

  // 303 forces the browser to follow the redirect with a GET.
  return NextResponse.redirect(`${siteUrl}/`, { status: 303 });
}
