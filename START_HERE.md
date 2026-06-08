# ✅ START HERE — Sabse Simple Guide

Site **UPI** (Razorpay) aur **Crypto** (NOWPayments) dono se payment leti hai.
Total time: **~40 min**. Detailed steps: [`SETUP.md`](./SETUP.md).

---

## 🎯 Bilkul Short Mein — Kya Karna Hai

```
1. Vercel pe site deploy karo            → site live ho jayegi
2. Supabase project banao                → database + login
3. Razorpay (UPI) + NOWPayments (crypto) → payment keys
4. Keys Vercel me daalo                   → sab connect
5. Test payment karo                      → done! 🎉
```

> Kam se kam **ek** payment gateway daalo (sirf UPI, ya sirf crypto, ya dono). Jo na ho wo button apne aap hide ho jayega.

---

## 🔑 Keys — Kahan Se Milegi (Cheat Sheet)

| # | Key (Vercel me yeh naam) | Kahan se milegi |
|---|---|---|
| 1 | `NEXT_PUBLIC_SITE_URL` | Vercel deploy ke baad jo URL milega |
| 2 | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Settings → API** → "Project URL" |
| 3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Settings → API** → "anon public" |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Settings → API** → "service_role" (secret) |
| **UPI** | | |
| 5 | `RAZORPAY_KEY_ID` | Razorpay → **Settings → API Keys** → "Key Id" (`rzp_test_...`) |
| 6 | `RAZORPAY_KEY_SECRET` | Razorpay → **Settings → API Keys** → "Key Secret" |
| 7 | `RAZORPAY_WEBHOOK_SECRET` | Razorpay → **Settings → Webhooks** → webhook banane ke baad apna chosen secret |
| **Crypto** | | |
| 8 | `NOWPAYMENTS_API_KEY` | NOWPayments → **Store Settings → API Keys** |
| 9 | `NOWPAYMENTS_IPN_SECRET` | NOWPayments → **Store Settings → IPN** → IPN secret key |

> Sirf UPI chahiye? → bas #5,#6,#7 daalo. Sirf crypto? → bas #8,#9.

---

## 📍 Step-by-Step

### STEP 1 — Vercel (site live karo)
1. [vercel.com](https://vercel.com) → **"Continue with GitHub"**
2. **"Add New" → "Project"** → `Miten001/userbot` → **"Import"**
3. ⚠️ **Root Directory:** kuch mat badlo — **default hi rakho**
4. **"Deploy"** → 90 sec → URL copy karo ➡️ *Key #1*

### STEP 2 — Supabase (database)
1. [supabase.com](https://supabase.com) → GitHub login → **"New Project"** (Name `apexfunded`, Region Mumbai)
2. **SQL Editor → New query** → repo ka [`supabase/schema.sql`](https://github.com/Miten001/userbot/blob/master/supabase/schema.sql) ka **pura content** paste → **Run**
3. **Settings → API** → Key #2, #3, #4 copy karo
4. **Authentication → URL Configuration:**
   - Site URL: tumhara Vercel URL
   - Redirect URLs: `https://tumhara-url.vercel.app/auth/callback`

### STEP 3 — Payment gateway(s)

**UPI → Razorpay**
1. [razorpay.com](https://razorpay.com) → Sign up → ⚠️ **Test Mode** ON
2. **Settings → API Keys → Generate Test Key** → Key #5 (`rzp_test_...`) + Key #6 (secret)

**Crypto → NOWPayments**
1. [nowpayments.io](https://nowpayments.io) → Sign up → apna **USDT/crypto wallet address** add karo (payout ke liye)
2. **Store Settings → API Keys** → Key #8
3. **Store Settings → IPN** → IPN secret generate → Key #9

### STEP 4 — Vercel me keys daalo
1. Vercel → project → **Settings → Environment Variables**
2. Upar wali keys ek-ek karke add karo (Key + Value)
3. **Deployments → latest → "⋯" → Redeploy**

### STEP 5 — Webhooks (auto account banane ke liye)

**Razorpay webhook**
1. Razorpay → **Settings → Webhooks → Add New Webhook**
2. URL: `https://tumhara-url.vercel.app/api/webhooks/razorpay`
3. Secret: koi bhi strong text daalo → **same text** Vercel me `RAZORPAY_WEBHOOK_SECRET` me daalo (Key #7)
4. Active event: **`payment_link.paid`** select → Save

**NOWPayments IPN**
1. NOWPayments → **Store Settings → IPN** → callback URL: `https://tumhara-url.vercel.app/api/webhooks/nowpayments`
2. IPN secret (Key #9) Vercel me daalo

Phir **Redeploy** karo.

### STEP 6 — Test 🎉
- Site kholo → Plans → **"Start Now"** → **UPI** ya **Crypto** choose karo
- UPI test: Razorpay test mode me test UPI `success@razorpay` use kar sakte ho
- Supabase → Table Editor → `accounts` me naya row aaya? = **DONE!**

### STEP 7 — Khud ko Admin banao
Supabase → SQL Editor:
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'tumhara@email.com');
```
Ab dashboard pe **"Admin"** button dikhega.

---

## 🟢 Optional (abhi zaroori NAHI)

| Feature | Key | Kahan se |
|---|---|---|
| Risk engine auto-run | `CRON_SECRET` | khud generate: `openssl rand -hex 32` |
| Email notifications | `RESEND_API_KEY` + `EMAIL_FROM` | [resend.com](https://resend.com) |
| Google login | `NEXT_PUBLIC_GOOGLE_AUTH=true` | + Supabase me Google provider ON |
| Real MT5 | `METAAPI_TOKEN` | [metaapi.cloud](https://metaapi.cloud) |
| USD→INR rate (UPI) | `USD_TO_INR` | default 84 |

> In ke bina bhi sab kaam karega — emails skip, mock MT5 accounts banenge.

---

## ❓ Atak gaye?
Bas **step number** bata do (e.g. "Step 3 pe atka") — main detailed walkthrough doonga.
