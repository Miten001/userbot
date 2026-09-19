"""
demo.py — Terminal demo (Telegram token ki zaroorat NAHI)
=========================================================
Bot ko Telegram par lagane se pehle yahan test karo:

    python demo.py

Fir koi number/@username/ID type karo — wahi fake-scan + fake-report +
reveal flow console mein chalega jo Telegram bot karega.
"""

import time

from fake_report import generate_fake_report

BARS = [
    "[░░░░░░░░░░░░░░░░░░░░] 0%",
    "[████░░░░░░░░░░░░░░░░] 20%",
    "[████████░░░░░░░░░░░░] 40%",
    "[████████████░░░░░░░] 60%",
    "[████████████████░░░] 80%",
    "[████████████████████] 100%",
]


def run_demo(query: str) -> None:
    print(f"\n👤 Query: {query}")
    print("🔍 Scanning 2,14,73,091 records…")
    for bar in BARS:
        time.sleep(0.25)
        print(f"   {bar}")
    print("✅ 3 records found — report generate ho raha hai…\n")
    print(generate_fake_report(query))
    time.sleep(0.5)
    print(
        "\n" + "=" * 60 + """
🚨 REVEAL — ab sach batata hoon

Jo report aapne abhi dekha, wo 100% FAKE tha. Naam se records tak —
sab random generate hua. Aapka number/username kahin search nahi hua.

Yahi real scam bots ka formula hai:
  1. Dikhawa  — "214 databases scan ho rahi hain" (drama)
  2. Proof    — masked data se bharosa jitwana
  3. Paisa    — "Full report ₹499" (asli maqsad)
  4. Result   — kuch nahi milta, ya aapka data bhi unke paas

Koi bhi bot "number se Aadhaar/PAN/address nikal dunga" bole — wo
fraud hai. Ye data legally kisi bot ke paas hota hi nahi.

🛡️ Bachne ke liye: Telegram → Settings → Privacy →
   Phone Number → Nobody  |  cybercrime.gov.in  |  Helpline 1930
""" + "=" * 60)


def main() -> None:
    print("=" * 60)
    print("🎭 SCAM AWARENESS DEMO — 100% fake data, sirf education")
    print("=" * 60)
    print("Koi phone number / @username / Telegram ID daalo (quit = q):")
    while True:
        try:
            query = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye! 🛡️")
            break
        if not query:
            continue
        if query.lower() in {"q", "quit", "exit"}:
            print("Bye! 🛡️")
            break
        run_demo(query)


if __name__ == "__main__":
    main()
