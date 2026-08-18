"""
TeraBox Automation Tool - Features & Fixes Report (PDF)
Documents all current features of both GUI tools plus the authenticated-proxy fix.
@codex_here
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos


ACCENT = (46, 134, 222)      # blue
GREEN = (39, 174, 96)        # fixed / success
ORANGE = (230, 126, 34)      # bug / before
DARK = (30, 30, 40)
GREY = (110, 110, 110)


class Report(FPDF):
    def __init__(self):
        super().__init__(orientation="P", format="A4")
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(15, 15, 15)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 8, "TeraBox Automation Tool - Features & Fixes", align="L")
        self.cell(0, 8, "@codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="R")
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)

    def cover(self):
        self.add_page()
        self.set_fill_color(*DARK)
        self.rect(0, 0, 210, 90, "F")
        self.set_y(28)
        self.set_font("Helvetica", "B", 26)
        self.set_text_color(255, 255, 255)
        self.cell(0, 14, "TeraBox Automation Tool", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(120, 200, 255)
        self.cell(0, 10, "Features & Fixes Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_font("Helvetica", "", 11)
        self.set_text_color(200, 200, 200)
        self.cell(0, 8, "@codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_text_color(0, 0, 0)
        self.set_y(105)
        self.body(
            "This report summarizes what the two TeraBox automation GUI tools "
            "(main.py and autoclose.py) do, and documents the recent fix that "
            "makes authenticated (username/password) proxies work correctly."
        )

    def h1(self, text):
        self.ln(3)
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(*ACCENT)
        self.cell(0, 9, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.5)
        y = self.get_y()
        self.line(15, y, 195, y)
        self.set_text_color(0, 0, 0)
        self.ln(3)

    def h2(self, text, color=DARK):
        self.ln(2)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*color)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(1)

    def body(self, text):
        self.set_font("Helvetica", "", 10.5)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text, color=None):
        self.set_font("Helvetica", "", 10.5)
        if color:
            self.set_text_color(*color)
        self.set_x(18)
        self.cell(5, 5.5, chr(149))
        self.multi_cell(0, 5.5, text)
        self.set_text_color(0, 0, 0)

    def tag(self, label, color):
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(*color)
        self.set_text_color(255, 255, 255)
        self.cell(self.get_string_width(label) + 6, 6, label, fill=True, align="C")
        self.set_text_color(0, 0, 0)
        self.ln(8)


def build():
    pdf = Report()
    pdf.cover()

    # ---- Overview ----
    pdf.add_page()
    pdf.h1("1. Overview")
    pdf.body(
        "The project ships two Python GUI tools (Tkinter) that automate Chrome "
        "against a TeraBox / ad link. Both open real Chrome windows via remote "
        "debugging and drive them with Selenium, apply anti-detection "
        "fingerprints, and can route traffic through proxies with IP rotation."
    )
    pdf.h2("main.py - Automation Tool")
    pdf.body(
        "Opens many Chrome windows and runs the Log In > Sign Up > Email "
        "selection flow on each, with country-filtered proxy rotation and "
        "per-IP usage limits."
    )
    pdf.h2("autoclose.py - Auto Close Tool")
    pdf.body(
        "Opens a set number of concurrent windows, keeps each open for a random "
        "60-180 seconds while simulating engagement, then closes and replaces it "
        "to keep the configured count running."
    )

    # ---- Features ----
    pdf.h1("2. Features")

    pdf.h2("Common to both tools")
    for t in [
        "Dark-themed Tkinter GUI with live status/terminal output and counters.",
        "Launches Chrome via subprocess with a unique user-data-dir per window (true isolation).",
        "Connects Selenium over the remote-debugging port for automation.",
        "Configurable target URL, number of pages/windows, and Start/Stop controls.",
        "Proxy / IP rotation toggle with a custom proxy box (one per line).",
        "Auto-fetch of free proxies from ProxyScrape when the box is left empty.",
        "Randomized browser fingerprints: user-agent, screen size, WebGL vendor/renderer, language, platform, timezone, hardware concurrency, device memory.",
        "Error-page detection (ERR_, 'This site can't be reached', timeouts) with auto-close.",
        "Aggressive cleanup of Chrome processes and temp profiles on stop/exit.",
    ]:
        pdf.bullet(t)

    pdf.h2("main.py specific")
    for t in [
        "Automated flow: clicks Log In, then Sign Up, then the Email option using a large set of resilient selectors.",
        "Country-filtered proxies (SA, AE, US, KR, JP, MX, QA) with IP-country verification.",
        "Per-IP usage limit (max 2 uses) persisted across restarts; 'Reset IP History' button.",
        "Unique-IP assignment per run and automatic replacement window on failure.",
        "Canvas-noise + navigator spoofing to reduce automation detection.",
        "Supports up to 1000 pages.",
    ]:
        pdf.bullet(t)

    pdf.h2("autoclose.py specific")
    for t in [
        "Random auto-close timer (60-180s) per window with force-kill safety net.",
        "Maintains a concurrent window count, opening replacements as others close.",
        "Ad-engagement and human-behavior simulation (scrolling, mouse moves, dwell).",
        "CAPTCHA / Cloudflare challenge detection with wait-for-resolve.",
        "Cookie-banner auto-accept and referrer spoofing for organic-looking traffic.",
        "Safety limits: max 5 concurrent, max 500 daily views.",
    ]:
        pdf.bullet(t)

    # ---- Fixes ----
    pdf.add_page()
    pdf.h1("3. What Was Fixed - Authenticated Proxy Support")

    pdf.body(
        "Reported issue: proxies were not working in the GUI. Investigation "
        "showed that plain IP:PORT proxies worked, but authenticated proxies "
        "(with a username and password) failed - pages errored out and tabs "
        "auto-closed, even with known-good paid proxies."
    )

    pdf.tag("BEFORE  (BUG)", ORANGE)
    for t in [
        "main.py delivered proxy credentials through a Manifest V2 Chrome extension, which modern Chrome no longer honors - so the proxy's login was never answered.",
        "autoclose.py sent a Proxy-Authorization header via CDP Network.setExtraHTTPHeaders; that header does not authenticate the HTTPS CONNECT tunnel, so auth failed.",
        "autoclose.py could not even parse the USER:PASS@IP:PORT format - the credentials and port were silently dropped.",
        "Result: HTTP 407 / connection errors, and the tool auto-closed the window treating it as a dead connection.",
    ]:
        pdf.bullet(t, color=DARK)

    pdf.tag("AFTER  (FIXED)", GREEN)
    for t in [
        "Both tools now authenticate proxies through the Chrome DevTools Protocol Fetch domain (handles both plain HTTP 407 and the HTTPS CONNECT tunnel).",
        "On an auth challenge, Chrome is answered with ProvideCredentials carrying the parsed username and password.",
        "Proxy parsing is unified: IP:PORT:USER:PASS and USER:PASS@IP:PORT now normalize identically in both tools.",
        "Chrome receives --proxy-server=http://host:port (explicit scheme); no fragile extension and no destination-only header.",
        "For authenticated proxies the browser launches to about:blank, auth is armed, then it navigates - so the very first request is authenticated.",
        "The obsolete Manifest V2 extension path and the header-based auth were removed.",
    ]:
        pdf.bullet(t, color=DARK)

    pdf.h2("Preserved (unchanged) behavior")
    for t in [
        "Plain IP:PORT proxies still route exactly as before.",
        "Direct connection (proxy off) is unchanged.",
        "Empty-box auto-fetch fallback is unchanged.",
        "Dead-proxy detection and auto-close still work.",
        "IP rotation and per-IP usage limits are untouched.",
    ]:
        pdf.bullet(t, color=GREEN)

    pdf.h2("Verification")
    pdf.body(
        "A stdlib-only helper (proxy_auth.py) implements the CDP Fetch auth with "
        "no new dependencies. A pure-Python test suite covers proxy parsing, the "
        "Chrome command-line builder, and the CDP auth messages: 45 tests pass. "
        "Full end-to-end checks against a live authenticating proxy require a "
        "Chrome + proxy environment and are provided as ready-to-run test "
        "placeholders."
    )
    pdf.h2("How to use an authenticated proxy")
    pdf.body(
        "Enable 'Use Proxy / IP Rotation', then paste your proxy in either "
        "format below (one per line):"
    )
    pdf.set_font("Courier", "", 10)
    pdf.set_fill_color(235, 235, 235)
    pdf.set_x(18)
    pdf.cell(0, 6, "  203.0.113.10:8080:username:password", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
    pdf.set_x(18)
    pdf.cell(0, 6, "  username:password@203.0.113.10:8080", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
    pdf.set_font("Helvetica", "", 10.5)

    out = "/projects/sandbox/userbot/tools/terabox-automation/TeraBox_Features_and_Fixes.pdf"
    pdf.output(out)
    print("PDF written:", out)


if __name__ == "__main__":
    build()
