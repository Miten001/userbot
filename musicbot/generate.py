"""Non-interactive session string generator (reliable two-step).

Usage:
  # Pehla run — OTP bhejega
  API_ID=.. API_HASH=.. PHONE=+9198.. python3 generate.py

  # Dusra run — CODE=12345 daal ke
  API_ID=.. API_HASH=.. PHONE=+9198.. CODE=12345 python3 generate.py

  # Agar 2FA password hai (NEED_PASSWORD aaye to)
  API_ID=.. API_HASH=.. PHONE=+9198.. CODE=12345 PASSWORD=your2fa python3 generate.py
"""
import asyncio, os, sys, json
from pyrogram import Client
from pyrogram.errors import (
    SessionPasswordNeeded, PhoneCodeInvalid, PhoneCodeExpired,
    PhoneNumberInvalid, ApiIdInvalid, ApiIdPublishedFlood,
)

STATE_FILE = "_gsession_state.json"

API_ID = int(os.environ["API_ID"])
API_HASH = os.environ["API_HASH"]
PHONE = os.environ["PHONE"]
CODE = os.environ.get("CODE", "").strip()
PASSWORD = os.environ.get("PASSWORD", "").strip()


def save_state(d: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(d, f)


def load_state() -> dict:
    if not os.path.exists(STATE_FILE):
        return {}
    with open(STATE_FILE) as f:
        return json.load(f)


async def main():
    # Always start fresh with a file-backed session named _gsession_tmp
    for ext in (".session",):
        if os.path.exists("_gsession_tmp" + ext):
            os.remove("_gsession_tmp" + ext)
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)

    app = Client("_gsession_tmp", api_id=API_ID, api_hash=API_HASH, in_memory=False)
    await app.connect()

    try:
        print(f"📱 Sending login code to {PHONE} ...")
        sent = await app.send_code(PHONE)
        save_state({"phone_code_hash": sent.phone_code_hash})
    except ApiIdInvalid:
        print("❌ API_ID / API_HASH galat hai. Phir se check kar.")
        await app.disconnect()
        sys.exit(1)
    except ApiIdPublishedFlood:
        print("❌ Flood wait. Thodi der baad try kar.")
        await app.disconnect()
        sys.exit(1)
    except PhoneNumberInvalid:
        print("❌ Phone number galat hai. +91 ke saath sahi format me daal.")
        await app.disconnect()
        sys.exit(1)

    if not CODE:
        print("\n📲 Assistant ke Telegram app pe ek 5-digit login code aayega.")
        print("   Mujhe woh code bhej de — main next step me session nikal dunga.\n")
        await app.disconnect()
        sys.exit(2)

    state = load_state()
    phone_code_hash = state.get("phone_code_hash")
    if not phone_code_hash:
        print("❌ State file nahi mila, pehla step dubara chalao (CODE ke bina).")
        await app.disconnect()
        sys.exit(2)

    try:
        signed = await app.sign_in(PHONE, phone_code_hash, CODE)
    except PhoneCodeInvalid:
        print("❌ Code galat hai. Sahi 5-digit code bhej.")
        await app.disconnect()
        sys.exit(4)
    except PhoneCodeExpired:
        print("❌ Code expire ho gaya. Naya code bhejunga — CODE env empty karke fir chalao.")
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        await app.disconnect()
        sys.exit(5)
    except SessionPasswordNeeded:
        if not PASSWORD:
            print("\n🔐 Assistant account pe 2FA (two-step password) lagaa hua hai.")
            print("   Mujhe woh password bhej do.\n")
            await app.disconnect()
            sys.exit(3)
        try:
            signed = await app.check_password(PASSWORD)
        except Exception as e:
            print(f"❌ 2FA password galat: {e}")
            await app.disconnect()
            sys.exit(3)

    me = signed
    s = await app.export_session_string()
    print(f"\n✅ Logged in as: {me.first_name} (id={me.id})")
    print("\n========== SESSION STRING (POORA COPY KAR) ==========\n")
    print(s)
    print("\n====================================================\n")

    # cleanup temp
    await app.disconnect()
    for ext in (".session",):
        if os.path.exists("_gsession_tmp" + ext):
            os.remove("_gsession_tmp" + ext)
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)


if __name__ == "__main__":
    asyncio.run(main())
