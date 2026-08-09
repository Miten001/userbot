"""
TeraBox Automation Tool - Complete Installation & Usage Guide PDF Generator
Generates a professional PDF installation guide using fpdf2.
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos


class InstallGuide(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=15)

    def header_block(self):
        """Draw the dark header/title area."""
        # Dark background header
        self.set_fill_color(30, 30, 30)
        self.rect(0, 0, 210, 55, "F")

        # Title
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(255, 255, 255)
        self.set_y(10)
        self.cell(
            0, 12, "TeraBox Automation Tool",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C"
        )

        # Subtitle
        self.set_font("Helvetica", "I", 14)
        self.set_text_color(180, 180, 180)
        self.cell(
            0, 10, "Complete Installation & Usage Guide",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C"
        )

        # Author
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(100, 200, 100)
        self.cell(0, 10, "@codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

        # Reset text color
        self.set_text_color(0, 0, 0)
        self.ln(15)

    def section_title(self, title):
        """Render a section title with accent bar."""
        self.ln(6)
        # Accent bar
        self.set_fill_color(50, 50, 50)
        self.rect(10, self.get_y(), 190, 9, "F")
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(255, 255, 255)
        self.set_x(14)
        self.cell(0, 9, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(4)

    def body_text(self, text):
        """Render normal body text."""
        self.set_font("Helvetica", "", 11)
        self.set_x(14)
        self.multi_cell(180, 6, text)
        self.ln(1)

    def bullet(self, text):
        """Render a bullet point."""
        self.set_font("Helvetica", "", 11)
        self.set_x(18)
        self.cell(4, 6, "-")
        self.multi_cell(172, 6, text)

    def code_block(self, text):
        """Render a code block with highlighted background."""
        self.ln(2)
        self.set_fill_color(240, 240, 240)
        self.set_font("Courier", "", 10)
        self.set_x(18)
        lines = text.split("\n")
        for line in lines:
            self.set_x(18)
            self.cell(170, 6, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        self.set_font("Helvetica", "", 11)
        self.ln(2)

    def important_note(self, text):
        """Render an important note with emphasis."""
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(200, 50, 50)
        self.set_x(18)
        self.multi_cell(172, 6, "IMPORTANT: " + text)
        self.set_text_color(0, 0, 0)
        self.set_font("Helvetica", "", 11)
        self.ln(1)


def generate_guide():
    pdf = InstallGuide()
    pdf.add_page()
    pdf.header_block()

    # REQUIREMENTS
    pdf.section_title("REQUIREMENTS")
    pdf.bullet("Windows 10/11")
    pdf.bullet("Python 3.7+")
    pdf.bullet("Google Chrome browser (latest)")
    pdf.bullet("Internet connection")

    # STEP 1 - INSTALL PYTHON
    pdf.section_title("STEP 1 - INSTALL PYTHON")
    pdf.body_text("Download Python from the official website:")
    pdf.code_block("https://python.org/downloads")
    pdf.important_note('Tick "Add Python to PATH" during installation')
    pdf.body_text("Verify installation by opening CMD and typing:")
    pdf.code_block("python --version")

    # STEP 2 - DOWNLOAD TOOL
    pdf.section_title("STEP 2 - DOWNLOAD TOOL")
    pdf.body_text("Method 1 (with Git):")
    pdf.code_block("git clone https://github.com/Miten001/userbot.git")
    pdf.ln(2)
    pdf.body_text("Method 2 (without Git):")
    pdf.body_text("Open CMD and run:")
    pdf.code_block(
        "curl -L -o userbot.zip "
        "https://github.com/Miten001/userbot/archive/refs/heads/uncheck.zip"
    )
    pdf.body_text("Extract:")
    pdf.code_block("tar -xf userbot.zip")
    pdf.body_text("Go to folder:")
    pdf.code_block("cd userbot-uncheck\\tools\\terabox-automation")
    pdf.ln(2)
    pdf.body_text("Method 3 (Manual):")
    pdf.body_text(
        "Download ZIP from https://github.com/Miten001/userbot "
        "browser me open karke"
    )

    # STEP 3 - INSTALL DEPENDENCIES
    pdf.section_title("STEP 3 - INSTALL DEPENDENCIES")
    pdf.body_text("Open CMD in the terabox-automation folder and run:")
    pdf.code_block("pip install selenium pyautogui")
    pdf.body_text("If pip not found:")
    pdf.code_block("python -m pip install selenium pyautogui")

    # STEP 4 - RUN
    pdf.section_title("STEP 4 - RUN")
    pdf.body_text("Open CMD in the terabox-automation folder and run:")
    pdf.code_block("python main.py")
    pdf.body_text("GUI will open with dark theme.")

    # HOW TO USE - GUI OPTIONS
    pdf.section_title("HOW TO USE - GUI OPTIONS")
    pdf.bullet(
        "Link (URL): Paste any URL you want to open (default: TeraBox link)"
    )
    pdf.bullet(
        "Pages (1-1000): How many browser windows to open simultaneously"
    )
    pdf.bullet(
        "Use Proxy / IP Rotation: Check to enable proxy (OFF by default)"
    )
    pdf.bullet(
        "Proxies box: Paste custom proxies (IP:PORT format, one per line)"
    )
    pdf.bullet(
        "Start Automation: Opens all browsers and does "
        "Login > Sign up > Email click"
    )
    pdf.bullet("Stop: Cancel anytime")
    pdf.bullet("Close Browsers: Close all Chrome windows")
    pdf.bullet("Close All Tabs: Kill all Chrome processes")

    # FEATURES
    pdf.section_title("FEATURES")
    pdf.bullet("Dark hacker theme GUI with @codex_here branding")
    pdf.bullet("Up to 1000 pages simultaneously")
    pdf.bullet(
        "Each browser has unique fingerprint "
        "(User-Agent, GPU, Screen, Canvas, etc.)"
    )
    pdf.bullet(
        "IP rotation support "
        "(Saudi Arabia, UAE, US, South Korea, Japan, Mexico, Qatar)"
    )
    pdf.bullet("Grid layout - all browsers arranged neatly on screen")
    pdf.bullet("Zoom out 80% for better visibility")
    pdf.bullet("Real-time status/terminal output")

    # TROUBLESHOOTING
    pdf.section_title("TROUBLESHOOTING")
    pdf.bullet('"Chrome not found" -> Install Google Chrome')
    pdf.bullet('"pip not found" -> python -m pip install selenium pyautogui')
    pdf.bullet(
        '"tkinter not found" -> Reinstall Python with tkinter checked'
    )
    pdf.bullet(
        '"This page isn\'t working" -> '
        "Uncheck proxy checkbox, use direct connection"
    )
    pdf.bullet('"Browser not opening" -> Make sure Chrome is updated')
    pdf.bullet(
        '"Selenium connection failed" -> '
        "Close all Chrome windows and try again"
    )
    pdf.bullet(
        "Pages overlapping -> Tool auto-arranges in grid, close extra windows"
    )

    # ONE-LINER INSTALL
    pdf.section_title("ONE-LINER INSTALL (copy paste in CMD)")
    pdf.body_text("With Git:")
    pdf.code_block(
        "git clone https://github.com/Miten001/userbot.git && "
        "cd userbot\\tools\\terabox-automation && "
        "pip install selenium pyautogui && python main.py"
    )
    pdf.body_text("Without Git:")
    pdf.code_block(
        "curl -L -o userbot.zip "
        "https://github.com/Miten001/userbot/archive/refs/heads/uncheck.zip "
        "&& tar -xf userbot.zip && "
        "cd userbot-uncheck\\tools\\terabox-automation && "
        "pip install selenium pyautogui && python main.py"
    )

    # CONTACT
    pdf.section_title("CONTACT")
    pdf.body_text("For help and updates:")
    pdf.body_text("@codex_here")

    # Output
    output_path = "TeraBox_Installation_Guide.pdf"
    pdf.output(output_path)
    print(f"PDF generated successfully: {output_path}")


if __name__ == "__main__":
    generate_guide()
