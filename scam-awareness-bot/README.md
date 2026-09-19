# 🛡️ Scam Awareness Demo Bot (Telegram)

Market mein bahut se **fraud Telegram bots** ghoomte hain jo bolte hain:

> "Number ya Telegram ID do — puri info nikal dunga: Aadhaar, PAN, address, family sab kuch 😈"

Ye bot logo ko **dikhaata hai ki ye scam kaise kaam karta hai** — wahi fake
"database scanning" show karke jo real scam bots karte hain, fake report
dikhake, aur phir **REVEAL** karke samjhata hai ki trick kahan thi.

## ⚠️ Zaroori baat (pehle padho)

- Is bot mein **koi real lookup nahi hai** — na API, na database, na
  contact-import. Har "report" random letters aur `XXXX` se banta hai
  (`fake_report.py` dekh lo, poora code public hai).
- Real mein aisa koi bhi **legal** bot exist nahi karta. Jo bole "number se
  pura data", wo fraud hai — aur agar koi hacked data se dikha bhi de, to
  use karna India mein **criminal offence** hai (IT Act 66C/66D,
  Aadhaar Act 2016, DPDP Act 2023).
- Ye project **education/awareness** ke liye hai — doston, school/college,
  community groups mein scam pattern samjhaane ke liye.

## ✨ Features

| Feature | Kya hai |
|---|---|
| 🎭 Fake scan demo | Number/@username/TG ID bhejo → fake "214 databases scanning" animation |
| 📄 Fake report | Scam-bot jaisa masked report (100% random, watermark ke saath) |
| 🚨 Reveal | Turant baad mein sach: "ye sab fake tha — aise hi scam hota hai" |
| 🚩 Red flags checklist | Scam bot pehchanne ke 7 signs |
| 🛡️ Protection tips | Telegram privacy settings, Aadhaar lock, OTP rules |
| 🚨 Report guide | cybercrime.gov.in, helpline 1930, Telegram reporting |
| 📋 Report kit | Kisi asli scam/doxxing bot ko ban karwane ka step-by-step kit — [`report-kit.md`](./report-kit.md) |

## 🚀 Setup (5 minute)

### 1. Bot banao (free)

1. Telegram mein **@BotFather** kholo
2. `/newbot` bhejo → naam do (e.g. `Scam Awareness Demo`)
3. Username do (e.g. `scam_awareness_demo_bot`)
4. BotFather jo **token** de (format: `123456789:AA...`) — copy karo

### 2. Chalao

```bash
cd scam-awareness-bot

# (recommended) virtual environment
python3 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt

# token do — dono me se ek tarika:
export BOT_TOKEN="123456789:AA..."   # ya:
cp .env.example .env                 # aur .env mein token paste karo

python bot.py
```

Terminal mein `Scam Awareness Demo Bot chal raha hai` dikhe toh bot ready hai.
Ab apne naye bot par `/start` bhejo. 🎉

### 3. Bina Telegram ke test (optional)

Telegram se pehle hi flow dekhna hai? Terminal demo chalao — token ki
zaroorat nahi:

```bash
python demo.py
```

## 🤖 Bot commands

| Command | Kaam |
|---|---|
| `/start` | Intro + main menu |
| `/demo +919876543210` | Fake scan demo (ya seedha number bhej do) |
| `/redflags` | Red flags checklist |
| `/protect` | Kaise bacho |
| `/report` | Scam report kaise karo |
| `/help` | Sab commands |

Koi bhi text message jo number / `@username` / Telegram ID jaisa lage, wo
automatically demo trigger karta hai.

## 📁 Files

```
scam-awareness-bot/
├── bot.py            # Main Telegram bot (python-telegram-bot v21)
├── fake_report.py    # FAKE report generator (random + masked, zero lookups)
├── demo.py           # Terminal demo — bina token ke test
├── requirements.txt
└── .env.example      # BOT_TOKEN=yahan paste karo
```

## 🧠 Demo flow (jo user experience karta hai)

```
User: 9876543210
Bot:  🔍 Scanning 2,14,73,091 records…
Bot:  🔎 [████████████░░░░] 76% — cross-matching…
Bot:  ✅ 3 records found — report generate ho raha hai…
Bot:  (fake masked report — "DEMO 100% FAKE" watermark)
Bot:  🚨 REVEAL — ye sab FAKE tha! Aise hi real scam chalta hai…
      1. Dikhawa  2. Chhota "proof"  3. Paisa  4. Kuch nahi milta
Bot:  🛡️ + 🚩 buttons — kaise bacho, kaise pehchano, kaise report karo
```

## 📜 License & intent

Sirf awareness ke liye. Kisi ko harass karne, doxx karne ya darane ke liye
use na karo — wahi cheez is bot ke khud ke message mein mana ki gayi hai. 😄
