# ✅ START HERE — Sabse Simple Guide

Bas **3 accounts** chahiye (sab FREE), aur **6 keys** copy karni hain.
Total time: **~40 min**. Detailed steps: [`SETUP.md`](./SETUP.md).

---

## 🎯 Bilkul Short Mein — Kya Karna Hai

```
1. Vercel pe site deploy karo         → site live ho jayegi
2. Supabase project banao             → database + login
3. Stripe account banao (test mode)   → payment
4. 6 keys Vercel me daalo             → sab connect
5. Test payment karo                  → done! 🎉
```

---

## 🔑 6 Keys — Kahan Se Milegi (Cheat Sheet)

Yeh 6 cheezein chahiye. Niche **exactly kahan click karna hai** likha hai.

| # | Key (Vercel me yeh naam) | Kahan se milegi |
|---|---|---|
| 1 | `NEXT_PUBLIC_SITE_URL` | Vercel deploy ke baad jo URL milega (e.g. `https://userbot-xxx.vercel.app`) |
| 2 | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Settings → API** → "Project URL" |
| 3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Settings → API** → "anon public" key |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Settings → API** → "service_role" key (secret) |
| 5 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → **Developers → API keys** → "Publishable key" (`pk_test_...`) |
| 6 | `STRIPE_SECRET_KEY` | Stripe → **Developers → API keys** → "Secret key" (`sk_test_...`, "Reveal" dabao) |

➕ Ek aur baad mein (Step 5 ke baad):
| 7 | `STRIPE_WEBHOOK_SECRET` | Stripe → **Developers → Webhooks** → endpoint banane ke baad "Signing secret" (`whsec_...`) |

---

## 📍 Step-by-Step (kahan kya dabana hai)

### STEP 1 — Vercel (site live karo)
1. [vercel.com](https://vercel.com) → **"Continue with GitHub"**
2. **"Add New" → "Project"** → `Miten001/userbot` → **"Import"**
3. ⚠️ **Root Directory:** kuch mat badlo — **default hi rakho**
4. **"Deploy"** dabao → 90 sec wait → URL copy karo  ➡️ *yeh hai Key #1*

### STEP 2 — Supabase (database)
1. [supabase.com](https://supabase.com) → GitHub se login → **"New Project"**
   - Name: `apexfunded`, Password: strong (save karo), Region: Mumbai
2. **SQL Editor → New query** → repo ka [`supabase/schema.sql`](https://github.com/Miten001/userbot/blob/master/supabase/schema.sql) ka **pura content** paste → **Run**
3. **Settings → API** → Key #2, #3, #4 copy karo
4. **Authentication → URL Configuration:**
   - Site URL: tumhara Vercel URL
   - Redirect URLs: `https://tumhara-url.vercel.app/auth/callback`

### STEP 3 — Stripe (payment)
1. [stripe.com](https://stripe.com) → Sign up
2. ⚠️ Top-right **"Test mode" ON** (orange)
3. **Developers → API keys** → Key #5, #6 copy karo

### STEP 4 — Vercel me keys daalo
1. Vercel → project → **Settings → Environment Variables**
2. Upar wali table ki **6 keys** ek-ek karke add karo (Name + Value)
3. **Deployments → latest → "..." → Redeploy**

### STEP 5 — Stripe Webhook (auto account banane ke liye)
1. Stripe → **Developers → Webhooks → "Add endpoint"**
2. URL: `https://tumhara-url.vercel.app/api/webhooks/stripe`
3. Event select: `checkout.session.completed`
4. **"Add endpoint"** → "Signing secret" (`whsec_...`) copy ➡️ *Key #7*
5. Vercel me `STRIPE_WEBHOOK_SECRET` add karo → **Redeploy**

### STEP 6 — Test 🎉
- Site kholo → Plans → "Start Now" → test card:
  ```
  4242 4242 4242 4242   |   12/34   |   123
  ```
- Supabase → Table Editor → `accounts` me naya row aaya? = **DONE!**

### STEP 7 — Khud ko Admin banao
Supabase → SQL Editor me yeh chalao (apna email daalo):
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'tumhara@email.com');
```
Ab dashboard pe **"Admin"** button dikhega.

---

## 🟢 Optional (abhi zaroori NAHI)

| Feature | Key chahiye | Kahan se |
|---|---|---|
| Risk engine auto-run (har 15 min) | `CRON_SECRET` | khud generate: `openssl rand -hex 32` |
| Email notifications | `RESEND_API_KEY` + `EMAIL_FROM` | [resend.com](https://resend.com) |
| Google login button | `NEXT_PUBLIC_GOOGLE_AUTH=true` | + Supabase me Google provider ON |
| Real MT5 (mock ki jagah) | `METAAPI_TOKEN` | [metaapi.cloud](https://metaapi.cloud) ($39/mo) |

> In ke bina bhi sab kaam karega — emails skip ho jayenge, mock MT5 accounts banenge.

---

## ❓ Atak gaye?
Bas **step number** bata do (e.g. "Step 3 pe atka") — main detailed walkthrough doonga.
Ya error ka screenshot bhejo.
