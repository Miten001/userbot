import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

/**
 * Runs on every matched request to keep the Supabase session cookie fresh.
 * We deliberately skip the Stripe webhook route — it needs the raw, untouched
 * request body to verify the signature.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static, _next/image (build assets)
     *  - favicon and common image files
     *  - /api/webhooks/* (Stripe needs the raw body)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
