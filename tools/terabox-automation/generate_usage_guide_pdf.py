"""
TeraBox Automation Tool - Usage & Setup Guide (copy-paste friendly PDF)
@codex_here
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos

GREEN = (39, 174, 96)
BLUE = (46, 134, 222)
DARK = (25, 25, 30)
GREY = (110, 110, 110)


class Guide(FPDF):
    def __init__(self):
        super().__init__(orientation="P", format="A4")
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(15, 14, 15)

    def banner(self):
        self.set_fill_color(*DARK)
        self.rect(0, 0, 210, 34, "F")
        self.set_y(8)
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(90, 210, 120)
        self.cell(0, 9, "TeraBox Automation Tool", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(180, 180, 180)
        self.cell(0, 7, "Setup & Usage Guide  -  @codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_text_color(0, 0, 0)
        self.set_y(40)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 8, f"Page {self.page_no()}  -  @codex_here", align="C")
        self.set_text_color(0, 0, 0)

    def step(self, text):
        self.ln(3)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*BLUE)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(1)

    def body(self, text):
        self.set_font("Helvetica", "", 10.5)
        self.multi_cell(0, 5.4, text)
        self.ln(0.5)

    def label(self, text):
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(*GREY)
        self.cell(0, 5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)

    def cmd(self, text):
        self.ln(0.5)
        self.set_fill_color(238, 238, 238)
        self.set_font("Courier", "", 8.5)
        for line in text.split("\n"):
            self.set_x(15)
            self.multi_cell(180, 5.5, line, fill=True)
        self.set_font("Helvetica", "", 10.5)
        self.ln(1.5)

    def bullet(self, text):
        self.set_font("Helvetica", "", 10.5)
        self.set_x(17)
        self.cell(5, 5.4, chr(149))
        self.multi_cell(0, 5.4, text)


def build():
    p = Guide()
    p.add_page()
    p.banner()

    p.step("STEP 1 - Install Python")
    p.body("Download and install Python from the link below. During install, TICK the box \"Add Python to PATH\".")
    p.cmd("https://python.org/downloads")

    p.step("STEP 2 - Open a Terminal")
    p.body("Press Windows+R, type  cmd  and press Enter. (PowerShell also works - commands for both are given below.)")

    p.step("STEP 3 - Create and enter a folder")
    p.cmd("mkdir C:\\terabox\ncd C:\\terabox")

    p.step("STEP 4 - Download the tool (2 files needed)")
    p.body("IMPORTANT: Download BOTH main.py AND proxy_auth.py into the same folder. The proxy login feature will not work without proxy_auth.py.")
    p.label("For CMD:")
    p.cmd(
        "curl -L -o main.py https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/main.py\n"
        "curl -L -o proxy_auth.py https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/proxy_auth.py"
    )
    p.label("For PowerShell:")
    p.cmd(
        "Invoke-WebRequest -Uri \"https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/main.py\" -OutFile \"main.py\"\n"
        "Invoke-WebRequest -Uri \"https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/proxy_auth.py\" -OutFile \"proxy_auth.py\""
    )

    p.step("STEP 5 - Install dependencies")
    p.cmd("pip install selenium pyautogui")

    p.step("STEP 6 - Run the tool")
    p.cmd("python main.py")
    p.body("A dark-themed window will open. (Google Chrome must be installed on the PC.)")

    # Page 2
    p.add_page()
    p.step("HOW TO USE THE GUI")
    for t in [
        "Link (URL): paste the URL you want to open.",
        "Pages: how many browser windows to open (1-1000).",
        "Use Proxy / IP Rotation: tick this to route traffic through proxies.",
        "Proxies box: paste your own proxies (one per line). Leave EMPTY to auto-fetch free proxies.",
        "Start Automation: begins opening windows and running the flow.",
        "Reset IP History: clears the used-IP history (including the day-wise history) so all IPs can be used again.",
    ]:
        p.bullet(t)

    p.step("PROXY FORMATS (authenticated proxies now supported)")
    p.body("Paste in EITHER of these formats, one per line:")
    p.cmd("203.0.113.10:8080:username:password\nusername:password@203.0.113.10:8080")
    p.body("Plain proxies without a login also work:")
    p.cmd("203.0.113.10:8080")

    p.step("WHAT'S NEW / KEY FEATURES")
    for t in [
        "Authenticated proxies (user:pass) now work correctly (CDP-based proxy login).",
        "Fresh, unique fingerprint per window - user-agent, screen, WebGL, timezone, canvas noise.",
        "No IP reuse across different days: an IP used on a previous day is skipped automatically.",
        "This applies to BOTH your custom proxies and auto-fetched proxies.",
        "Country-filtered proxies, per-IP usage limit, and auto replacement on failure.",
    ]:
        p.bullet(t)

    p.step("NEXT TIME (already installed)")
    p.cmd("cd C:\\terabox\npython main.py")

    p.step("TROUBLESHOOTING")
    for t in [
        "\"python is not recognized\": reinstall Python and TICK 'Add Python to PATH'.",
        "\"tkinter not found\": reinstall Python (default installer includes tkinter).",
        "Pages fail to load with a proxy: your proxy may be dead/blocked - try a paid residential proxy.",
        "Proxy login not working: make sure proxy_auth.py is in the SAME folder as main.py.",
    ]:
        p.bullet(t)

    p.ln(3)
    p.set_font("Helvetica", "B", 10)
    p.set_text_color(*GREEN)
    p.cell(0, 6, "CONTACT: @codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    p.set_text_color(0, 0, 0)

    out = "/projects/sandbox/userbot/tools/terabox-automation/TeraBox_Usage_Guide.pdf"
    p.output(out)
    print("PDF written:", out)


if __name__ == "__main__":
    build()
