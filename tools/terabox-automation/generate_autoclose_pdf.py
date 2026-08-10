"""
Generate AutoClose_Guide.pdf - A simple copy-paste PDF guide for autoclose.py
Landscape orientation, Courier font for commands, gray boxes, green title.
"""

from fpdf import FPDF


class AutoClosePDF(FPDF):
    def __init__(self):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.set_margins(10, 10, 10)
        self.set_auto_page_break(auto=True, margin=10)

    def command_box(self, text):
        """Draw a gray background box with Courier text for commands."""
        self.set_fill_color(230, 230, 230)
        self.set_font("Courier", "", 9)
        # Calculate height needed
        lines = text.split("\n")
        line_h = 4.5
        box_h = len(lines) * line_h + 4
        # Draw box
        self.rect(self.get_x(), self.get_y(), self.epw, box_h, style="F")
        self.ln(2)
        for line in lines:
            self.cell(0, line_h, line, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def section_title(self, text):
        """Section heading in bold."""
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(0, 0, 0)
        self.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        """Normal body text."""
        self.set_font("Helvetica", "", 9)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5, text)
        self.ln(1)


def generate_pdf():
    pdf = AutoClosePDF()

    # ---- PAGE 1 ----
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(0, 128, 0)
    pdf.cell(0, 12, "TeraBox Auto Close Tool", align="C", new_x="LMARGIN", new_y="NEXT")

    # Subtitle
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 7, "@codex_here", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # STEP 1
    pdf.section_title("STEP 1 - INSTALL PYTHON")
    pdf.body_text("Download: https://python.org/downloads\n(Tick \"Add Python to PATH\")")

    # STEP 2
    pdf.section_title("STEP 2 - OPEN CMD")
    pdf.body_text("Press Windows+R, type cmd, Enter")

    # STEP 3
    pdf.section_title("STEP 3 - RUN THESE COMMANDS:")
    pdf.ln(1)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 5, "Command 1:", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box("mkdir C:\\terabox")

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "Command 2:", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box("cd C:\\terabox")

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "Command 3 (Download):", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box("curl -L -o autoclose.py https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/autoclose.py")

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "Command 4 (Install):", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box("pip install selenium pyautogui")

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, "Command 5 (Run):", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box("python autoclose.py")

    # POWERSHELL section
    pdf.ln(3)
    pdf.section_title("FOR POWERSHELL:")

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 5, "Command 3 (Download):", new_x="LMARGIN", new_y="NEXT")
    pdf.command_box('Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Miten001/userbot/uncheck/tools/terabox-automation/autoclose.py" -OutFile "autoclose.py"')

    # ---- PAGE 2 ----
    pdf.add_page()

    # HOW TO USE
    pdf.section_title("HOW TO USE:")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(50, 50, 50)
    usage_lines = [
        "- Link: Paste website URL",
        "- Total Pages: How many total visits (e.g. 100)",
        "- Open At Once: How many browsers same time (e.g. 10)",
        "- Proxy: Tick checkbox for IP rotation",
        "- Start: Click to begin",
        "- Each browser stays 30-120 seconds (random)",
        "- Auto closes and new opens",
        "- Continues until all pages done",
    ]
    for line in usage_lines:
        pdf.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # NEXT TIME
    pdf.section_title("NEXT TIME (already installed):")
    pdf.command_box("cd C:\\terabox\npython autoclose.py")

    pdf.ln(5)

    # CONTACT
    pdf.section_title("CONTACT:")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 6, "@codex_here", new_x="LMARGIN", new_y="NEXT")

    # Save
    import os
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AutoClose_Guide.pdf")
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    generate_pdf()
