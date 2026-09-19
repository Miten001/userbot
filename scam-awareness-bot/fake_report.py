"""
fake_report.py — Scam-bot style FAKE report generator (DEMO ONLY)
=================================================================
Ye module SIRF awareness demo ke liye hai. Ye:

  * Koi bhi REAL lookup nahi karta — zero network calls, zero database.
  * Har value ya to random fake hai ya masked (XXXX) hai — jaise real
    scam bots dikhate hain (unki tarah, lekin honestly).
  * Har report par "FAKE / DEMO" watermark hota hai.

Kyun masked values? Kyunki real scam bots bhi poora data pehle nahi
dikhte — pehle masked "proof" dikhate hain, phir payment maangte hain
"full report" ke liye. Wahi pattern yahan demo hota hai.
"""

import random

# ---------------------------------------------------------------- fake pools

FIRST_NAMES = [
    "Rahul", "Priya", "Amit", "Sneha", "Vikram", "Pooja", "Rohit",
    "Anjali", "Karan", "Neha", "Suresh", "Divya", "Manish", "Kavita",
]

LAST_NAMES = [
    "Sharma", "Patel", "Verma", "Singh", "Gupta", "Mehta", "Joshi",
    "Shah", "Iyer", "Reddy", "Nair", "Chauhan", "Desai", "Rathod",
]

CITIES = [
    ("Ahmedabad", "Gujarat"), ("Surat", "Gujarat"), ("Mumbai", "Maharashtra"),
    ("Delhi", "Delhi"), ("Jaipur", "Rajasthan"), ("Indore", "Madhya Pradesh"),
    ("Pune", "Maharashtra"), ("Lucknow", "Uttar Pradesh"),
]

STREETS = [
    "MG Road", "Station Road", "Civil Lines", "Ring Road",
    "Sardar Patel Nagar", "Gandhi Chowk", "Model Town", "Krishna Society",
]

OPERATORS = ["Jio", "Airtel", "Vi", "BSNL"]

CARRIERS_DOC = ["Driving Licence", "Voter ID", "Ration Card", "Bank Passbook"]


# ---------------------------------------------------------------- helpers

def _masked_digits(count: int, show_last: int = 4) -> str:
    """XXXX-XXXX-1234 style masked string. Koi real number generate nahi hota."""
    hidden = "X" * (count - show_last)
    shown = "".join(random.choice("0123456789") for _ in range(show_last))
    return f"{hidden}{shown}"


def _fake_name() -> str:
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def _fake_address() -> str:
    city, state = random.choice(CITIES)
    house = random.randint(1, 999)
    street = random.choice(STREETS)
    pin = "XXXXXX"  # masked — real PIN kabhi generate nahi karte
    return f"{house}, {street}, {city}, {state} — {pin}"


# ---------------------------------------------------------------- main

def generate_fake_report(query: str) -> str:
    """
    Ek scam-bot jaisa FAKE report banata hai `query` (number/username/ID)
    ke liye. Sab kuch random + masked hai. 100% demo.
    """
    name = _fake_name()
    father = _fake_name()
    city, state = random.choice(CITIES)
    operator = random.choice(OPERATORS)
    circle = random.choice(["Gujarat", "Maharashtra", "Delhi NCR", "West"])
    alt_doc = random.choice(CARRIERS_DOC)
    email_user = _fake_name().split()[0].lower() + "****"
    relatives = ", ".join(_fake_name() for _ in range(3))

    query_repr = query if len(query) <= 24 else query[:24] + "…"

    lines = [
        "┌─────────────────────────────────────┐",
        "   ⚠️  DEMO REPORT — 100% FAKE  ⚠️",
        "│   (awareness demo — koi real data    │",
        "│    isi bot mein exist hi nahi karta)  │",
        "└─────────────────────────────────────┘",
        f"  QUERY   : {query_repr}",
        "  STATUS  : 3 records found ✅",
        "├─────────────────────────────────────┤",
        f"  NAME        : {name}",
        f"  FATHER      : {father}",
        f"  DOB         : XX-XX-19{random.randint(60, 99)}",
        f"  GENDER      : {random.choice(['M', 'F'])}",
        f"  ADDRESS     : {_fake_address()}",
        "├─────────────────────────────────────┤",
        f"  SIM         : {operator} ({circle})",
        f"  ALT NUMBER  : {_masked_digits(10)}",
        f"  EMAIL       : {email_user}@gmail.com",
        "├─────────────────────────────────────┤",
        f"  AADHAAR     : {_masked_digits(12)}",
        f"  PAN         : XXXXX-XXXX-{random.choice('XQZ')} (masked)",
        f"  {alt_doc.upper():<12}: XXXXXXXXXX",
        "├─────────────────────────────────────┤",
        f"  RELATIVES   : {relatives}",
        "  ─────────────────────────────────",
        "  🔓 FULL REPORT UNLOCK ₹499/-",
        "  PAY NOW → @fake_admin (DEMO LINK — mat dabao!)",
        "└─────────────────────────────────────┘",
    ]
    return "\n".join(lines)
