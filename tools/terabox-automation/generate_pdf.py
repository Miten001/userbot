"""
TeraBox Automation Tool - Installation Guide PDF Generator
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
        self.rect(0, 0, 210, 50, "F")

        # Title
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(255, 255, 255)
        self.set_y(12)
        self.cell(
            0, 12, "TeraBox Automation Tool - Installation Guide",
            new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C"
        )

        # Subtitle
        self.set_font("Helvetica", "I", 14)
        self.set_text_color(180, 180, 180)
        self.cell(0, 10, "@codex_here", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

        # Reset text color
        self.set_text_color(0, 0, 0)
        self.ln(20)

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
    pdf.bullet("Python 3.7 or higher")
    pdf.bullet("Google Chrome browser (latest version)")
    pdf.bullet("Internet connection")

    # STEP 1 - PYTHON INSTALL
    pdf.section_title("STEP 1 - PYTHON INSTALL")
    pdf.body_text("Download Python from the official website:")
    pdf.code_block("https://python.org/downloads")
    pdf.important_note('Check "Add Python to PATH" during installation')
    pdf.body_text("Verify installation by opening CMD and typing:")
    pdf.code_block("python --version")

    # STEP 2 - DOWNLOAD TOOL
    pdf.section_title("STEP 2 - DOWNLOAD TOOL")
    pdf.body_text("Clone the repository using git:")
    pdf.code_block("git clone https://github.com/Miten001/userbot.git")
    pdf.body_text("OR download ZIP from GitHub.")
    pdf.body_text("Navigate to the tool folder:")
    pdf.code_block("userbot/tools/terabox-automation/")

    # STEP 3 - INSTALL DEPENDENCIES
    pdf.section_title("STEP 3 - INSTALL DEPENDENCIES")
    pdf.body_text("Open CMD in the terabox-automation folder and run:")
    pdf.code_block("pip install selenium pyautogui")
    pdf.body_text("If pip is not found, use:")
    pdf.code_block("python -m pip install selenium pyautogui")

    # STEP 4 - RUN THE TOOL
    pdf.section_title("STEP 4 - RUN THE TOOL")
    pdf.body_text("Open CMD in the terabox-automation folder and run:")
    pdf.code_block("python main.py")
    pdf.body_text("The GUI will open with a dark theme.")

    # HOW TO USE
    pdf.section_title("HOW TO USE")
    pdf.bullet("Enter number of pages (1-50)")
    pdf.bullet('Click "Start Automation"')
    pdf.bullet("All pages will open simultaneously in Chrome incognito")
    pdf.bullet(
        "Tool will automatically: Login -> Sign up -> Click Email icon"
    )
    pdf.bullet('Use "Stop" to cancel anytime')
    pdf.bullet('Use "Close Browsers" to close all Chrome windows')

    # TROUBLESHOOTING
    pdf.section_title("TROUBLESHOOTING")
    pdf.bullet(
        '"Chrome not found" -> Install Google Chrome or check installation path'
    )
    pdf.bullet('"pip not found" -> Use "python -m pip install ..."')
    pdf.bullet(
        '"tkinter not found" -> Reinstall Python with tkinter option checked'
    )
    pdf.bullet(
        '"Browser opens but nothing happens" -> Make sure Chrome is updated to latest version'
    )
    pdf.bullet("Pages not opening -> Check internet connection")

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
