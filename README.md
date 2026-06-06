# ApexFunded — Forex Prop Firm Platform

A premium forex proprietary trading firm website + backend, built with Next.js 14, Supabase, and Stripe.

🌐 **Live site:** deploy to Vercel (see [`SETUP.md`](./SETUP.md))

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — glassmorphism + gradient utilities, gold/emerald/royal premium palette
- **Framer Motion** — scroll & hover animations
- **lucide-react** — icons
- **Supabase** — auth + Postgres database (RLS-protected)
- **Stripe** — checkout + webhooks
- **MetaApi** (optional) — real MT5 account provisioning

---

## Frontend Sections

1. **Navbar** — sticky pill, scroll-aware glass blur
2. **Hero** — copy + animated live forex pairs grid (EUR/USD, GBP/USD, USD/JPY, XAU/USD, BTC/USD, AUD/USD)
3. **Stats** + partners marquee
4. **Funding Plans** — 7 account sizes ($2.5K → $200K) × 3 challenge types (1/2/3-step)
5. **How It Works** — 3 steps with raised icon plates
6. **Features** — bento grid (split meter, payout chips, country flags)
7. **Trading Rules** — Allowed vs Not Allowed
8. **Testimonials** — 6 trader stories with payout pills
9. **FAQ** — animated accordion
10. **CTA** — conic-gradient border card
11. **Footer** — newsletter + socials + risk disclaimer

---

## Backend

| Path | Purpose |
|---|---|
| `app/login` + `app/signup` | Email/password auth UI (Supabase) — graceful demo-mode fallback |
| `app/auth/callback/route.ts` | GET — exchanges the email-confirmation code for a session |
| `app/auth/signout/route.ts` | POST — clears the session and redirects home |
| `middleware.ts` | Refreshes the Supabase session cookie on every request |
| `app/api/checkout/route.ts` | POST — creates Stripe Checkout session + pending challenge row |
| `app/api/webhooks/stripe/route.ts` | Verifies signature → activates challenge → provisions MT5 account |
| `app/api/account/route.ts` | GET — returns user's accounts (RLS-protected) |
| `app/api/payouts/route.ts` | GET list + POST request — withdrawal requests (RLS-protected) |
| `app/api/trades/route.ts` | GET — user's trades, optional `?account_id=` filter (RLS-protected) |
| `app/api/profile/route.ts` | GET + PATCH — read / update the signed-in user's profile (RLS-protected) |
| `app/api/sync/route.ts` | GET/POST — risk-engine heartbeat: refreshes equity, enforces drawdown, advances steps, funds accounts, mirrors trades. Auth via `CRON_SECRET` or admin session. Runs every 15 min via Vercel Cron |
| `app/api/admin/route.ts` | GET — back-office overview (stats + recent challenges/accounts/payouts). Admin-only |
| `app/api/admin/payouts/route.ts` | POST — approve / reject / mark-paid a withdrawal. Admin-only |
| `app/api/admin/accounts/route.ts` | POST — manual account override (phase / equity / profit split). Admin-only |
| `lib/stripe.ts` | Stripe client + plan catalog (single source of truth for prices) + per-step risk rules |
| `lib/db.ts` | Supabase clients (browser, server, admin) |
| `lib/admin.ts` | `requireAdmin()` — gates admin routes via `ADMIN_USER_IDS` or `profiles.is_admin` |
| `lib/risk.ts` | Pure evaluation engine — drawdown breach, profit-target pass, step progression, daily reset |
| `lib/email.ts` | Resend transactional emails (account ready / funded / breached / payout) — no-op unless configured |
| `lib/mt5.ts` | MT5 provider abstraction — Mock + MetaApi (provision / equity / trades) |
| `supabase/schema.sql` | Full database schema with RLS policies (+ operational migration block) |

---

## Quick Start

### Local development

```bash
git clone https://github.com/Miten001/userbot.git
cd userbot
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
```

Open <http://localhost:3000>.

### Deploy

See [**`SETUP.md`**](./SETUP.md) for the full step-by-step guide
(Vercel + Supabase + Stripe + MetaApi).

---

## Customization

| Cheez | File |
|---|---|
| Brand colors | `tailwind.config.ts` |
| Plans pricing | `app/components/Plans.tsx` + `lib/stripe.ts` (keep them in sync) |
| Testimonials | `app/components/Testimonials.tsx` |
| FAQ | `app/components/FAQ.tsx` |
| Forex pairs | `app/components/PairsShowcase.tsx` |

---

## License

Proprietary — all rights reserved.
