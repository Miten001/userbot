/**
 * Backend configuration helpers.
 *
 * The site is designed to run in two modes:
 *   • DEMO mode  — no payment / Supabase keys set. Checkout simulates a
 *                  successful purchase and the dashboard shows a fake account.
 *                  Perfect for showing the site to clients before going live.
 *   • LIVE mode  — keys set. Real UPI/crypto checkout, real DB, real MT5.
 *
 * Payments use Razorpay (UPI/cards, India) and NOWPayments (crypto).
 *
 * We never throw at module-load time — env vars are read lazily so the build
 * doesn't fail when keys aren't configured yet.
 */

import { isRazorpayConfigured } from "@/lib/razorpay";
import { isCryptoConfigured } from "@/lib/crypto-pay";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isMetaApiConfigured(): boolean {
  return Boolean(process.env.METAAPI_TOKEN);
}

export function isCronConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Any payment gateway available? */
export function isPaymentConfigured(): boolean {
  return isRazorpayConfigured() || isCryptoConfigured();
}

export function isLiveMode(): boolean {
  return isSupabaseAdminConfigured() && isPaymentConfigured();
}

/** Returns a per-feature status object — used by the /api/health route. */
export function configStatus() {
  return {
    mode: isLiveMode() ? "live" : "demo",
    supabase_anon: isSupabaseConfigured(),
    supabase_admin: isSupabaseAdminConfigured(),
    razorpay: isRazorpayConfigured(),
    crypto: isCryptoConfigured(),
    metaapi: isMetaApiConfigured(),
    cron: isCronConfigured(),
    email: isEmailConfigured(),
    site_url: process.env.NEXT_PUBLIC_SITE_URL || null,
  };
}
