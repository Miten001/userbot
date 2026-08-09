"""
TeraBox Automation Tool - Simple Copy-Paste PDF Guide
Landscape orientation, short commands, designed for easy copy-paste.
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos


class CopyPasteGuide(FPDF):
    def __init__(self):
        super().__init__(orientation="L", format="A4")
        self.set_auto_page_break(auto=True, margin=10)
        self.set_margins(10, 10, 10)

    def title_block(self):
        """Dark header with green title."""
        self.set_fill_color(30, 30, 30)
        self.rect(0, 0, 297, 40, "F")
        # Title in green
        self.set_font("Helvetica", "B", 24)
        self.set_text_color(80, 200, 80)
        self.set_y(8)
        self.cell(
            0, 12, "TeraBox Automation Tool",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C"
        )
        # Subtitle
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(180, 180, 180)
        self.cell(
            0, 10, "@codex_here",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C"
        )
        self.set_text_color(0, 0, 0)
        self.ln(12)

    def step_title(self, text):
        """Render a step heading."""
        self.ln(4)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(40, 40, 40)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def body(self, text):
        """Normal body text."""
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def cmd_box(self, text):
        """Command in gray box, Courier font, easy to copy."""
        self.ln(1)
        self.set_fill_color(235, 235, 235)
        self.set_font("Courier", "", 9)
        lines = text.split("\n")
        for line in lines:
            self.set_x(12)
            self.cell(
                270, 6, line,
                new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True
            )
        self.set_font("Helvetica", "", 10)
        self.ln(2)

    def label(self, text):
        """Small label above command."""
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.set_x(12)
        self.cell(0, 5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)

    def bullet(self, text):
        """Bullet point."""
        self.set_font("Helvetica", "", 10)
        self.set_x(14)
        self.cell(4, 5, "-")
        self.multi_cell(0, 5, text)


def generate_guide():
    pdf = CopyPasteGuide()

    # --- PAGE 1 ---
    pdf.add_page()
    pdf.title_block()

    # STEP 1
    pdf.step_title("STEP 1 - INSTALL PYTHON")
    pdf.body("Download and install from:")
    pdf.cmd_box("https://python.org/downloads")
    pdf.body('(Tick "Add Python to PATH" during install)')

    # STEP 2
    pdf.step_title("STEP 2 - OPEN CMD")
    pdf.body("Press Windows+R, type cmd, press Enter")

    # STEP 3
    pdf.step_title("STEP 3 - COPY PASTE THESE COMMANDS ONE BY ONE:")

    pdf.label("Command 1 - Create folder:")
    pdf.cmd_box("mkdir C:\\terabox")

    pdf.label("Command 2 - Go to folder:")
    pdf.cmd_box("cd C:\\terabox")

    pdf.label("Command 3 - Download tool (FOR CMD):")
    cmd_url = (
        "https://raw.githubusercontent.com/"
        "Miten001/userbot/uncheck/"
        "tools/terabox-automation/main.py"
    )
    pdf.cmd_box(f"curl -L -o main.py {cmd_url}")

    pdf.label("Command 3 - Download tool (FOR POWERSHELL):")
    ps_url = (
        "https://raw.githubusercontent.com/"
        "Miten001/userbot/uncheck/"
        "tools/terabox-automation/main.py"
    )
    pdf.cmd_box(
        'Invoke-WebRequest -Uri "'
        + ps_url
        + '" -OutFile "main.py"'
    )

    pdf.label("Command 4 - Install dependencies:")
    pdf.cmd_box("pip install selenium pyautogui")

    pdf.label("Command 5 - Run tool:")
    pdf.cmd_box("python main.py")

    # --- PAGE 2 ---
    pdf.add_page()

    # HOW TO USE GUI
    pdf.step_title("HOW TO USE GUI:")
    pdf.bullet("Link box: Paste URL you want to open")
    pdf.bullet("Pages: How many browsers to open (1-1000)")
    pdf.bullet("Proxy checkbox: Tick for IP rotation (optional)")
    pdf.bullet("Start: Click to begin")
    pdf.bullet("Stop: Cancel anytime")
    pdf.bullet("Close All: Kill all browsers")

    # NEXT TIME
    pdf.ln(4)
    pdf.step_title("NEXT TIME (already installed):")
    pdf.cmd_box("cd C:\\terabox\npython main.py")

    # CONTACT
    pdf.ln(4)
    pdf.step_title("CONTACT:")
    pdf.body("@codex_here")

    # Output
    output_path = "TeraBox_Installation_Guide.pdf"
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    generate_guide()
