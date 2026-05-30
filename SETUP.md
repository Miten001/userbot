# 🚀 ApexFunded — Easy Setup Guide (Hinglish)

End-to-end backend chalu karne ke liye. Total time: **~40 minutes**.
Cost: **$0** (test mode). Production ke liye baad me upgrade.

---

## 📋 Kya-Kya Chahiye (Overview)

| # | Service | Free? | Kyu chahiye |
|---|---|---|---|
| 1 | **GitHub** | ✅ Already hai | Code repo |
| 2 | **Vercel** | ✅ Free | Site hosting + backend |
| 3 | **Supabase** | ✅ Free | Database (users, payments) |
| 4 | **Stripe** | ✅ Free (test mode) | Payment gateway |
| 5 | **MetaApi** (optional) | 💸 $39/mo | Real MT5 accounts |

---

## ⏱ Step-by-Step (40 min)

### Step 1️⃣ — Vercel pe Deploy (10 min)

**Kya hoga:** Aapka Next.js site Vercel pe live hoga with backend support.

1. **Sign up:** Jao [vercel.com](https://vercel.com) → "Continue with GitHub"
2. Dashboard me **"Add New..."** → **"Project"**
3. `Miten001/userbot` repo dhundo aur **"Import"** click karo
4. **Configure** dialog me yeh karo:
   - **Root Directory:** click "Edit" → select `propfirm-site` ⚠️ *important*
   - **Framework:** auto-detect ho jayega — Next.js
   - **Environment Variables:** abhi skip karo, baad me add karenge
5. **Deploy** button click karo
6. ~90 second wait karo. Aapko URL milega jaise:
   ```
   https://userbot-xxxx.vercel.app
   ```
7. Copy karo yeh URL — agle steps me chahiye hoga

**Tip:** Vercel auto-deploy karta hai jab bhi `master` branch pe push karoge. Magic ✨

---

### Step 2️⃣ — Supabase Setup (10 min)

**Kya hoga:** Database create hoga jo users, payments aur accounts store karega.

#### 2a. Project banao

1. Jao [supabase.com](https://supabase.com) → "Start your project"
2. GitHub se sign in karo
3. **"New Project"** click karo
4. Form fill karo:
   - **Name:** `apexfunded`
   - **Database Password:** strong password rakho aur **save karo somewhere safe**
   - **Region:** Mumbai (ya nearest)
   - **Plan:** Free
5. **"Create new project"** — 2 min wait karo

#### 2b. Schema run karo

1. Project ready hone par left sidebar me **"SQL Editor"** click karo
2. **"New query"** button
3. GitHub se [`supabase/schema.sql`](https://github.com/Miten001/userbot/blob/master/propfirm-site/supabase/schema.sql) ka **complete content copy** karo
4. SQL editor me **paste** karo
5. **"Run"** button (ya `Ctrl+Enter`)
6. Aap dekhoge "Success. No rows returned" — sab tables ban gaye ✅

#### 2c. API keys nikalo

1. Left sidebar → **Settings** ⚙️ → **API**
2. Yeh 3 cheezein copy karo (notepad me save karo):
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key (lambi key, `eyJ...` se shuru hoti hai)
   - **service_role** key (alag wali, **secret** rakho — kabhi share mat karo)

#### 2d. Auth URLs set karo (login/signup ke liye)

1. Left sidebar → **Authentication** → **URL Configuration**
2. **Site URL** me apni site daalo: `https://your-site.vercel.app`
3. **Redirect URLs** me add karo: `https://your-site.vercel.app/auth/callback`
   (local dev ke liye `http://localhost:3000/auth/callback` bhi add kar sakte ho)
4. **Save**

> Note: By default Supabase email confirmation ON hota hai — signup ke baad user
> ko email me link aata hai. Testing fast karni ho to **Authentication →
> Providers → Email** me "Confirm email" temporarily OFF kar sakte ho.

---

### Step 3️⃣ — Stripe Setup (10 min)

**Kya hoga:** Payment gateway ready hoga. Test mode me **fake card numbers** se test kar sakte ho.

1. [stripe.com](https://stripe.com) jao → "Start now" / Sign up
2. Email + password se account banao
3. Country/business info skip kar sakte ho — direct dashboard pe jao
4. ⚠️ **Top-right toggle "Test mode" ON rakhna** (orange dikhega)
5. Left sidebar → **Developers** → **API keys**
6. Yeh 2 keys copy karo:
   - **Publishable key** (`pk_test_...`)
   - **Secret key** (`sk_test_...` — "Reveal" click karo)

---

### Step 4️⃣ — Vercel me Env Vars Add Karo (5 min)

**Kya hoga:** Sab keys connect honge taaki backend kaam kare.

1. Vercel dashboard → aapka project → **Settings** → **Environment Variables**
2. Ek-ek karke add karo (Name + Value, "Production, Preview, Development" sab tick rakho):

```
NEXT_PUBLIC_SITE_URL = https://your-site.vercel.app
NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...(anon public key)
SUPABASE_SERVICE_ROLE_KEY = eyJ...(service_role key)
STRIPE_SECRET_KEY = sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...
```

(`STRIPE_WEBHOOK_SECRET` aur `METAAPI_TOKEN` baad me add karenge)

3. **Save** karo har ek ke baad
4. Top right **Deployments** tab → latest deployment ke 3 dots → **"Redeploy"** click karo
5. ~1 min wait — site ab env vars ke saath chal rahi hai

---

### Step 5️⃣ — Stripe Webhook Setup (5 min)

**Kya hoga:** Payment ke baad Stripe automatically aapke backend ko inform karega taaki MT5 account ban jaye.

1. Stripe dashboard → **Developers** → **Webhooks**
2. **"Add endpoint"** click karo
3. Form fill karo:
   - **Endpoint URL:** `https://your-site.vercel.app/api/webhooks/stripe`
   - **Description:** `ApexFunded checkout completed`
   - **Events to send:** **"+ Select events"** click karo → `checkout.session.completed` dhundke select karo
4. **"Add endpoint"** click karo
5. Endpoint create hone ke baad **"Signing secret"** dikhega (`whsec_...`) — copy karo
6. Vercel pe wapas jao → Settings → Environment Variables → add karo:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_...
   ```
7. Phir **Redeploy** karo (Step 4 ka step 4 dohrao)

---

### Step 6️⃣ — Test Karo! 🎉 (5 min)

1. Vercel URL kholo: `https://your-site.vercel.app`
2. **Plans** section pe scroll karo
3. Koi bhi **"Start Now"** click karo (e.g. $2,500 Starter)
4. Email maangega — koi bhi test email daalo (`test@example.com`)
5. Stripe Checkout page khulegi — yeh **fake card** use karo:
   ```
   Card number:  4242 4242 4242 4242
   Expiry:       12/34 (koi bhi future date)
   CVC:          123
   ZIP:          12345
   Name:         Test User
   ```
6. **"Pay"** click karo
7. Payment success → redirect ho jayega
8. **Verify:**
   - Stripe dashboard → **Payments** → aapka test payment dikhega ✅
   - Supabase → **Table Editor** → `challenges` table → naya row dikhega ✅
   - `accounts` table me MT5 account number dikhega (mock) ✅

**Sab kaam kar raha hai? 🎉 Backend live hai!**

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| Vercel build fail | Root Directory `propfirm-site` set kiya hai? |
| "Stripe error" alert | Env vars correct hain? Redeploy kiya? |
| Webhook 400 error | `STRIPE_WEBHOOK_SECRET` dobara check karo |
| Supabase RLS error | `service_role` key sahi se copy hua? |
| Page errors | Browser console (F12) me error check karo |

---

## 🚀 Production Pe Le Jaane Ke Liye (Optional, Later)

Jab tested ho jaye aur real customers chahiye:

### a) Stripe Live Mode
1. Stripe dashboard → top-right **Test mode toggle OFF**
2. **Activate account** karo (KYC: PAN, business proof, bank account)
3. Live keys copy karo (`sk_live_...` aur `pk_live_...`)
4. Vercel env vars me replace karo
5. Live webhook bhi alag se banao

### b) MetaApi (Real MT5)
1. [metaapi.cloud](https://metaapi.cloud) signup
2. Plan: **Standard $39/month** (1 account allowed)
3. API token copy karo
4. Vercel env: `METAAPI_TOKEN=...`
5. Broker se actual MT5 accounts provision karwane padenge — alag setup hai
6. **Reality check:** real prop firm chalane ke liye broker partnership zaruri hai (Eightcap, Purple Trading, etc.)

### c) Custom Domain
1. Domain kharido (Namecheap, GoDaddy ~₹500-1500/year)
2. Vercel → Settings → Domains → add karo
3. DNS records Vercel batayega — domain provider me copy paste

### d) Sales karne se pehle
- ⚠️ Legal: Trading services ke liye **disclaimer + ToS + privacy policy** zaroori
- ⚠️ Compliance: India me prop trading rules check karo (SEBI guidelines)
- ⚠️ Tax: GST + income tax ka setup
- ⚠️ Bank: Business account chahiye payouts ke liye

---

## 💡 Easy Hai Lekin Time Lagega

Pehli baar setup karne me **40 min** lagenge — kuch confusion ho to bilkul normal hai. Har step me agar koi error ya doubt ho:

1. Screenshot bhejo
2. Mai exact line fix bata dunga

Agar Stripe ya Supabase ka koi specific step pe atak gaye — **bata do step number**, mai detailed walkthrough deta hu.
