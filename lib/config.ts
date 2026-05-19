/**
 * Backend configuration helpers.
 *
 * The site is designed to run in two modes:
 *   • DEMO mode  — no Stripe / Supabase keys set. Checkout simulates a
 *                  successful purchase and the dashboard shows a fake account.
 *                  Perfect for showing the site to clients before going live.
 *   • LIVE mode  — all keys set. Real Stripe checkout, real DB, real MT5.
 *
 * We never throw at module-load time — env vars are read lazily so the build
 * doesn't fail when keys aren't configured yet.
 */

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_SECRET_KEY.startsWith("sk_") &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function isMetaApiConfigured(): boolean {
  return Boolean(process.env.METAAPI_TOKEN);
}

export function isLiveMode(): boolean {
  return (
    isStripeConfigured() &&
    isSupabaseConfigured() &&
    isSupabaseAdminConfigured() &&
    isWebhookConfigured()
  );
}

/** Returns a per-feature status object — used by the /api/health route. */
export function configStatus() {
  return {
    mode: isLiveMode() ? "live" : "demo",
    stripe: isStripeConfigured(),
    supabase_anon: isSupabaseConfigured(),
    supabase_admin: isSupabaseAdminConfigured(),
    stripe_webhook: isWebhookConfigured(),
    metaapi: isMetaApiConfigured(),
    site_url: process.env.NEXT_PUBLIC_SITE_URL || null,
  };
}
