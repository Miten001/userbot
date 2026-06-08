# ApexFunded — Forex Prop Firm Platform

A premium forex proprietary trading firm website + backend, built with Next.js 14, Supabase, Razorpay (UPI) and NOWPayments (crypto).

🌐 **Live site:** deploy to Vercel (see [`SETUP.md`](./SETUP.md))

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — glassmorphism + gradient utilities, gold/emerald/royal premium palette
- **Framer Motion** — scroll & hover animations
- **lucide-react** — icons
- **Supabase** — auth + Postgres database (RLS-protected)
- **Razorpay** — UPI / cards / netbanking checkout (India)
- **NOWPayments** — crypto checkout (USDT / BTC / ETH …)
- **MetaApi** (optional) — real MT5 account provisioning

---

## Frontend Sections

1. **Navbar** — sticky pill, scroll-aware glass blur
2. **Hero** — copy + animated live forex pairs grid
3. **Stats** + partners marquee
4. **Funding Plans** — 7 account sizes ($2.5K → $200K) × 3 challenge types (1/2/3-step)
5. **How It Works** — 3 steps with raised icon plates
6. **Features** — bento grid
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
| `app/api/checkout/route.ts` | POST `{ step, account_size_usd, method: "upi"\|"crypto" }` — creates a pending challenge + hosted payment page (Razorpay link / NOWPayments invoice). Demo fallback when unconfigured |
| `app/api/webhooks/razorpay/route.ts` | Verifies `x-razorpay-signature` → fulfills challenge (provisions MT5) on `payment_link.paid` |
| `app/api/webhooks/nowpayments/route.ts` | Verifies `x-nowpayments-sig` → fulfills challenge on `finished`/`confirmed` status |
| `app/api/account/route.ts` | GET — returns user's accounts (RLS-protected) |
| `app/api/payouts/route.ts` | GET list + POST request — withdrawal requests (RLS-protected) |
| `app/api/trades/route.ts` | GET — user's trades, optional `?account_id=` filter (RLS-protected) |
| `app/api/profile/route.ts` | GET + PATCH — read / update the signed-in user's profile (RLS-protected) |
| `app/api/sync/route.ts` | GET/POST — risk-engine heartbeat: equity refresh, drawdown enforcement, step progression, trade mirror. Auth via `CRON_SECRET` or admin session. Runs daily via Vercel Cron |
| `app/api/admin/route.ts` | GET — back-office overview (stats + recent challenges/accounts/payouts). Admin-only |
| `app/api/admin/payouts/route.ts` | POST — approve / reject / mark-paid a withdrawal. Admin-only |
| `app/api/admin/accounts/route.ts` | POST — manual account override (phase / equity / profit split). Admin-only |
| `lib/plans.ts` | Plan catalog + per-step risk rules + USD→INR rate (gateway-agnostic) |
| `lib/razorpay.ts` | Razorpay UPI Payment Links + webhook signature verify |
| `lib/crypto-pay.ts` | NOWPayments crypto invoices + IPN signature verify |
| `lib/fulfillment.ts` | Shared post-payment fulfillment (activate challenge + provision MT5 + email) |
| `lib/db.ts` | Supabase clients (browser, server, admin) |
| `lib/admin.ts` | `requireAdmin()` — gates admin routes via `ADMIN_USER_IDS` or `profiles.is_admin` |
| `lib/risk.ts` | Pure evaluation engine — drawdown breach, profit-target pass, step progression, daily reset |
| `lib/email.ts` | Resend transactional emails (account ready / funded / breached / payout) — no-op unless configured |
| `lib/mt5.ts` | MT5 provider abstraction — Mock + MetaApi (provision / equity / trades) |
| `supabase/schema.sql` | Full database schema with RLS policies (+ operational migration block) |

> **⏰ Cron frequency & Vercel plans.** The free **Hobby** plan only allows once-per-day cron jobs, so `vercel.json` uses `0 0 * * *` (daily). For more frequent runs: upgrade to Pro and set `*/15 * * * *`, or use an external scheduler (e.g. cron-job.org) hitting `/api/sync` with header `Authorization: Bearer <CRON_SECRET>`.

---

## Quick Start

```bash
git clone https://github.com/Miten001/userbot.git
cd userbot
cp .env.example .env.local
npm install
npm run dev
```

See [**`SETUP.md`**](./SETUP.md) for the full deploy guide.

---

## License

Proprietary — all rights reserved.
