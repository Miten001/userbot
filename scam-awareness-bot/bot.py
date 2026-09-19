"""
Scam Awareness Demo Bot (Telegram)
==================================
MAQSAD: Logo ko dikhana ki "number se pura data nikal dunga" wale
Telegram bots kaise dikhte hain aur unke andar kya hota hai.

YE BOT KYA KARTA HAI:
  * User koi phone number / @username / TG ID bhejta hai
  * Bot ek FAKE "database scan" animation dikhata hai (bilkul waise
    jaise real scam bots dikhte hain)
  * Phir ek FAKE masked report deta hai (random + masked values)
  * Phir REVEAL karta hai: "ye sab fake tha — aise hi scam hota hai"

YE BOT KYA *NAHI* KARTA (by design, safety):
  * Koi real lookup nahi (koi API, koi database, koi contact-import nahi)
  * Koi real Aadhaar/PAN/address data generate ya store nahi karta
  * Koi payment link real nahi hota

Setup: README.md dekho. Run: BOT_TOKEN=xxx python bot.py
"""

import asyncio
import logging
import os
import re
from html import escape

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

import fake_report

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO
)
log = logging.getLogger("scam-awareness")

# ------------------------------------------------------------- tiny .env loader

def load_dotenv(path: str = ".env") -> None:
    """python-dotenv dependency se bachne ke liye simple .env loader."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


# ------------------------------------------------------------- keyboards

def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🎭 Demo dekho — fake scan", callback_data="demo_intro")],
            [InlineKeyboardButton("🧠 Ye scam kaise kaam karta hai", callback_data="how")],
            [InlineKeyboardButton("🚩 Red flags checklist", callback_data="redflags")],
            [InlineKeyboardButton("🛡️ Apne aap ko kaise bachao", callback_data="protect")],
            [InlineKeyboardButton("🚨 Scam report kaise karo", callback_data="report")],
            [InlineKeyboardButton("ℹ️ Is bot ke baare mein", callback_data="about")],
        ]
    )


def back_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("⬅️ Menu", callback_data="menu")]]
    )


# ------------------------------------------------------------- content

WELCOME = (
    "👋 <b>Scam Awareness Demo Bot</b>\n\n"
    "Market mein bahut se fraud bots ghoomte hain jo bolte hain:\n"
    "“<i>number ya Telegram ID do — puri info nikal dunga, Aadhaar, PAN, "
    "sab kuch!</i>”\n\n"
    "🚨 <b>Sach:</b> Koi bhi legal bot ye nahi kar sakta. Jo bot aisa claim "
    "kare, wo ya to <b>scam</b> hai (paisa lootne ka) ya <b>khud illegal</b> "
    "(hacked data bechne wala — jisme use karne wale par bhi criminal case "
    "banta hai).\n\n"
    "Is bot se <b>demo</b> dekho — main wahi fake “scanning wala show” "
    "karke dikhaunga jo real scam bots karte hain, aur phir <b>reveal</b> "
    "karunga ki trick kahan thi. 👇"
)

DEMO_INTRO = (
    "🎭 <b>Demo mode</b>\n\n"
    "Koi bhi <b>phone number</b>, <b>@username</b> ya <b>Telegram ID</b> "
    "bhejo — main wahi “database scan + report” dikhata hoon jo scam bots "
    "dikhaate hain.\n\n"
    "⚠️ Spoiler: report 100% <b>FAKE</b> hoga — mere paas koi real data hai "
    "hi nahi. Bas pattern dikhana hai."
)

HOW_IT_WORKS = (
    "🧠 <b>Ye scam kaise chalta hai — step by step</b>\n\n"
    "<b>1. Bada claim</b> — “Number se pura data: Aadhaar, PAN, address, "
    "family…” Ye legally <i>impossible</i> hai, isliye hi claim itna bada "
    "hota hai — attention ke liye.\n\n"
    "<b>2. Fake scanning</b> — bot “214 databases scan ho rahi hain…” "
    "jaisi animation dikhata hai. Ye sirf drama hai; aapka number kahin "
    "search nahi ho raha. (Is bot ke demo mein aapne khud dekha.)\n\n"
    "<b>3. Masked “proof”</b> — thoda sa data dikhate hain ( naam, XXXX "
    "wala Aadhaar) taaki believable lage. Kabhi-kabhi ye data purane "
    "<b>data breaches</b> se hota hai — tab aur real lagta hai.\n\n"
    "<b>4. Payment</b> — “Full report ₹499 mein unlock karo.” Yahi asli "
    "maqsad hai: UPI payment.\n\n"
    "<b>5. End game</b> — ya to report kabhi milta nahi, ya bakwaas milta "
    "hai. Kabhi-kabhi aapka number/ID bhi unke paas chala jaata hai aur "
    "aapko hi target banaya jaata hai.\n\n"
    "💡 Ek line mein: <b>jo bhi bot “number se puri khabar” de, wo fraud "
    "hai — 100%.</b>"
)

REDFLAGS = (
    "🚩 <b>Red flags — turant bhaago agar…</b>\n\n"
    "1️⃣ Bot/company bole “number se pura data nikal dunga”\n"
    "2️⃣ Aadhaar/PAN/bank details ka claim ho\n"
    "3️⃣ Report dekhne se pehle <b>payment</b> maango (₹99–₹999)\n"
    "4️⃣ Data <b>masked</b> dikhe (“XXXX-1234”) aur “unlock” ke liye paise maange\n"
    "5️⃣ Telegram se bahar kisi “admin” ke personal WhatsApp/Instagram par bheje\n"
    "6️⃣ “Premium channel join karo” wala pressure ho\n"
    "7️⃣ Bot ka naam/DP mein “OSINT”, “DATABASE”, “INFO” jaise words + 🔓💰 emojis\n\n"
    "📌 Yaad rakho: in “databases” ka data hacked/stolen hota hai. Aisa bot "
    "<b>use</b> karna bhi India mein criminal offence hai (IT Act 66C/66D, "
    "Aadhaar Act, DPDP Act)."
)

PROTECT = (
    "🛡️ <b>Apne aap ko kaise bachao</b>\n\n"
    "<b>Telegram privacy (2 minute ka kaam):</b>\n"
    "⚙️ Settings → Privacy and Security → Phone Number → <b>Nobody</b>\n"
    "⚙️ Usi menu mein “Who can find me by my number” → <b>My Contacts</b>\n\n"
    "<b>Documents:</b>\n"
    "🪪 Aadhaar lock kar do — UIDAI mAadhaar app ya resident.uidai.gov.in se\n"
    "🪪 PAN/Aadhaar ki photo, screenshot kisi ko na bhejo — na “KYC” ke naam par\n\n"
    "<b>Golden rules:</b>\n"
    "❌ OTP kisi ke saath share mat karo (na bank, na “Telegram verify”)\n"
    "❌ Unknown links/apps install mat karo (spyware bhi data churata hai)\n"
    "❌ Public groups/comments mein apna number mat chhodo\n"
    "✅ 2FA (cloud password) Telegram par on rakho"
)

REPORT_INFO = (
    "🚨 <b>Scam dikhe toh report karo</b>\n\n"
    "<b>India (official):</b>\n"
    "🌐 <b>cybercrime.gov.in</b> — National Cyber Crime Reporting Portal\n"
    "📞 <b>1930</b> — Cyber Fraud Helpline (paisa gira toh turant, golden hour!)\n"
    "📞 1930 par bank ko freeze karwa sakte hain agar jaldi action lo\n\n"
    "<b>Telegram ke andar:</b>\n"
    "👉 Scam bot/chat kholo → ⋮ / report → <b>Scam or Fraud</b> (multiple "
    "reports se bot band hota hai)\n"
    "👉 @notoscam — Telegram ki official anti-scam team ko forward karo\n\n"
    "<b>Payment scam hua?</b>\n"
    "1. Bank ko turant call karo\n"
    "2. 1930 par complaint\n"
    "3. cybercrime.gov.in par FIR report\n"
    "4. Screenshots, UPI ref no., scam bot ka @username — sab save rakho"
)

ABOUT = (
    "ℹ️ <b>Is bot ke baare mein</b>\n\n"
    "Ye ek <b>open-source awareness project</b> hai — sirf education ke liye.\n\n"
    "✅ Kya karta hai: scam bots ka “fake show” karke logo ko unka pattern "
    "sikhaata hai\n"
    "❌ Kya nahi karta: koi real lookup, koi real database, koi payment — "
    "kuch bhi nahi. Bot ka poora code public hai: har “report” random "
    "letters/XXXX se banta hai (<code>fake_report.py</code> dekh lo).\n\n"
    "🧑‍🏫 Ise use karo: doston ko demo do, school/college mein dikhao, "
    "scam victim hone se pehle pattern pehchano.\n\n"
    "⚖️ Disclaimer: Ye bot kisi ko spy karne, harass karne ya kisi ka data "
    "dhundhne ke liye <b>nahi</b> hai — isliye aisa feature banaya hi nahi "
    "gaya hai."
)

# ------------------------------------------------------------------ demo flow

# "query" detection: phone (+91..., 10+ digits), @username, t.me link, ya numeric TG ID
# (kind sirf label hai — dono ka ilaaj same hai: FAKE demo)
RE_PHONE = re.compile(r"^\+?\d[\d\s\-]{9,14}$")
RE_USERNAME = re.compile(r"^@(?:[A-Za-z0-9_]{4,32})$")
RE_TMLINK = re.compile(r"^(?:https?://)?t\.me/([A-Za-z0-9_]{4,32})/?$", re.I)
RE_TGID = re.compile(r"^\d{5,12}$")


def classify_query(text: str):
    """Return (kind, normalized_query) ya (None, None)."""
    t = text.strip()
    if not t:
        return None, None
    if RE_PHONE.match(t):
        return "phone", re.sub(r"[\s\-]", "", t)
    if RE_USERNAME.match(t):
        return "username", t
    m = RE_TMLINK.match(t)
    if m:
        return "username", "@" + m.group(1)
    if RE_TGID.match(t):
        return "id", t
    return None, None


REVEAL_TEXT = (
    "🚨 <b>REVEAL — ab sach batata hoon</b> 🚨\n\n"
    "Jo report aapne abhi dekha, wo <b>100% FAKE</b> tha. Usme naam se leke "
    "“records found” tak — <i>sab kuch random generate</i> hua. Aapka bheja "
    "hua number/username kahin search hi nahi hua. 🎭\n\n"
    "<b>Aur yahi asli scam bots ka formula hai:</b>\n"
    "1️⃣ Dikhawa — “214 databases scan ho rahi hain” (drama 🎬)\n"
    "2️⃣ Chhota “proof” — masked data se bharosa jitwana\n"
    "3️⃣ Paisa — “Full report ₹499” (asli maqsad 💸)\n"
    "4️⃣ Result — ya kuch nahi milta, ya aapka data bhi unke paas\n\n"
    "💡 <b>Yaad rakhna:</b> koi bhi bot/website jo bole “number ya ID se "
    "Aadhaar-PAN-address nikal dunga” — wo <b>fraud</b> hai. Ye data legally "
    "kisi bot ke paas hota hi nahi.\n\n"
    "Ab jaan lo 🛡️ apne aap ko kaise bachana hai 👇"
)


async def run_fake_scan(update: Update, query: str, kind: str) -> None:
    """Fake scanning animation + fake report + reveal (sab demo)."""
    chat = update.effective_chat

    # Step 1 — scanning drama
    scan = await chat.send_message("🔍 Scanning 2,14,73,091 records…")
    await asyncio.sleep(1.0)
    await scan.edit_text("🔎 [██████░░░░░░░░░░] 38% — databases check ho rahi hain…")
    await asyncio.sleep(1.0)
    await scan.edit_text("🔎 [████████████░░░░] 76% — cross-matching…")
    await asyncio.sleep(1.0)
    await scan.edit_text("✅ <b>3 records found</b> — report generate ho raha hai…",
                         parse_mode=ParseMode.HTML)
    await asyncio.sleep(0.8)

    # Step 2 — fake report
    report = fake_report.generate_fake_report(query)
    await chat.send_message(f"<pre>{escape(report)}</pre>", parse_mode=ParseMode.HTML)
    await asyncio.sleep(1.2)

    # Step 3 — reveal (asli education)
    await chat.send_message(
        REVEAL_TEXT,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("🛡️ Kaise bacho", callback_data="protect")],
             [InlineKeyboardButton("🚩 Red flags", callback_data="redflags")],
             [InlineKeyboardButton("⬅️ Menu", callback_data="menu")]]
        ),
    )


# ------------------------------------------------------------------ handlers

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        WELCOME, parse_mode=ParseMode.HTML, reply_markup=main_menu()
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "📖 <b>Commands</b>\n"
        "/start — intro + menu\n"
        "/demo — fake scan demo shuru karo\n"
        "/redflags — red flags checklist\n"
        "/protect — apne aap ko bachao\n"
        "/report — scam report kaise karo\n\n"
        "Ya seedha koi number/@username bhej do — demo chal jaayega.",
        parse_mode=ParseMode.HTML,
        reply_markup=main_menu(),
    )


async def cmd_demo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args
    if args:
        kind, q = classify_query(" ".join(args))
        if kind:
            await run_fake_scan(update, q, kind)
            return
    await update.message.reply_text(DEMO_INTRO, parse_mode=ParseMode.HTML)


async def cmd_redflags(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        REDFLAGS, parse_mode=ParseMode.HTML, reply_markup=back_menu()
    )


async def cmd_protect(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        PROTECT, parse_mode=ParseMode.HTML, reply_markup=back_menu()
    )


async def cmd_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        REPORT_INFO, parse_mode=ParseMode.HTML, reply_markup=back_menu()
    )


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Koi bhi text aaye — agar number/@username/ID jaisa lage toh demo."""
    kind, q = classify_query(update.message.text or "")
    if kind is None:
        await update.message.reply_text(
            "🤔 Ye number/@username/ID jaisa nahi lag raha.\n\n"
            "Demo ke liye koi bhi phone number, <code>@username</code> ya "
            "Telegram ID bhejo — ya /start se menu kholo.",
            parse_mode=ParseMode.HTML,
            reply_markup=main_menu(),
        )
        return
    await update.message.chat.send_action(ChatAction.TYPING)
    await run_fake_scan(update, q, kind)


async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    await q.answer()
    data = q.data

    table = {
        "menu": (WELCOME, main_menu()),
        "demo_intro": (DEMO_INTRO, back_menu()),
        "how": (HOW_IT_WORKS, back_menu()),
        "redflags": (REDFLAGS, back_menu()),
        "protect": (PROTECT, back_menu()),
        "report": (REPORT_INFO, back_menu()),
        "about": (ABOUT, back_menu()),
    }
    if data in table:
        text, kb = table[data]
        await q.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=kb)
        try:
            await q.message.delete()  # purana message hatao, spam na ho
        except Exception:
            pass


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.error("Exception: %s", context.error)


# ------------------------------------------------------------------ main

def main() -> None:
    load_dotenv()
    token = os.environ.get("BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "BOT_TOKEN missing!\n"
            "1. Telegram par @BotFather kholo → /newbot → token copy karo\n"
            "2. `export BOT_TOKEN=123456:ABC...` ya .env file banao\n"
            "3. Phir `python bot.py` chalao"
        )

    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler(["start", "menu"], cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("demo", cmd_demo))
    app.add_handler(CommandHandler("redflags", cmd_redflags))
    app.add_handler(CommandHandler("protect", cmd_protect))
    app.add_handler(CommandHandler("report", cmd_report))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    app.add_error_handler(error_handler)

    log.info("Scam Awareness Demo Bot chal raha hai (polling)…")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
