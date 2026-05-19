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
| `app/api/checkout/route.ts` | POST — creates Stripe Checkout session + pending challenge row |
| `app/api/webhooks/stripe/route.ts` | Verifies signature → activates challenge → provisions MT5 account |
| `app/api/account/route.ts` | GET — returns user's accounts (RLS-protected) |
| `lib/stripe.ts` | Stripe client + plan catalog (single source of truth for prices) |
| `lib/db.ts` | Supabase clients (browser, server, admin) |
| `lib/mt5.ts` | MT5 provider abstraction — Mock + MetaApi |
| `supabase/schema.sql` | Full database schema with RLS policies |

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
