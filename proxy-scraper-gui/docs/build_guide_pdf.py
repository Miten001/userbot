#!/usr/bin/env python3
"""
Build a nicely formatted PDF setup & usage guide for the Proxy Scraper GUI app.

Usage:
    pip install fpdf2
    python build_guide_pdf.py

Output:
    Proxy-Scraper-Setup-Guide.pdf  (written next to this script)

Notes:
    - Uses only the built-in core fonts (Helvetica / Courier) so no font files
      are required.
    - All text is kept ASCII / latin-1 safe (e.g. "->" instead of arrow glyphs)
      so the core fonts never raise an encoding error.
"""

import os
from fpdf import FPDF

# ---------------------------------------------------------------------------
# Palette / layout constants
# ---------------------------------------------------------------------------
COLOR_PRIMARY = (30, 64, 122)      # deep blue for headings
COLOR_ACCENT = (0, 120, 90)        # teal accent
COLOR_TEXT = (33, 37, 41)          # near-black body text
COLOR_MUTED = (108, 117, 125)      # grey for subtitles / notes
COLOR_CODE_BG = (244, 246, 248)    # light grey code background
COLOR_CODE_TEXT = (20, 20, 20)
COLOR_TABLE_HEADER_BG = (30, 64, 122)
COLOR_TABLE_ROW_ALT = (240, 243, 247)
COLOR_LINE = (210, 214, 220)

FOOTER_TEXT = "Proxy Scraper GUI - by @codex_here"

OUTPUT_NAME = "Proxy-Scraper-Setup-Guide.pdf"


class GuidePDF(FPDF):
    def header(self):
        # No repeating header content beyond a thin top rule (keeps title page clean).
        pass

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(*COLOR_LINE)
        self.set_line_width(0.2)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*COLOR_MUTED)
        self.cell(0, 8, FOOTER_TEXT, align="L")
        self.cell(0, 8, f"Page {self.page_no()}", align="R")


def ascii_safe(text: str) -> str:
    """Replace common non-latin-1 characters with ASCII equivalents."""
    replacements = {
        "\u2192": "->",   # right arrow
        "\u2190": "<-",   # left arrow
        "\u2013": "-",    # en dash
        "\u2014": "--",   # em dash
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",    # bullet
        "\u00a0": " ",    # non-breaking space
        "\u2026": "...",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    # Final safety net: drop anything not encodable in latin-1.
    return text.encode("latin-1", "replace").decode("latin-1")


class GuideBuilder:
    def __init__(self):
        self.pdf = GuidePDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=20)
        self.pdf.set_margins(18, 18, 18)
        self.pdf.add_page()

    # ---- primitives ------------------------------------------------------
    def content_width(self):
        return self.pdf.w - self.pdf.l_margin - self.pdf.r_margin

    def title_block(self, title, subtitle):
        self.pdf.set_fill_color(*COLOR_PRIMARY)
        self.pdf.rect(0, 0, self.pdf.w, 42, style="F")
        self.pdf.set_y(12)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font("Helvetica", "B", 22)
        self.pdf.cell(0, 12, ascii_safe(title), align="C")
        self.pdf.ln(12)
        self.pdf.set_font("Helvetica", "I", 12)
        self.pdf.set_text_color(210, 220, 235)
        self.pdf.cell(0, 8, ascii_safe(subtitle), align="C")
        self.pdf.ln(20)
        self.pdf.set_text_color(*COLOR_TEXT)

    def section_heading(self, text):
        if self.pdf.get_y() > self.pdf.h - 50:
            self.pdf.add_page()
        self.pdf.ln(3)
        self.pdf.set_font("Helvetica", "B", 14)
        self.pdf.set_text_color(*COLOR_PRIMARY)
        self.pdf.multi_cell(0, 8, ascii_safe(text))
        # underline rule
        y = self.pdf.get_y() + 1
        self.pdf.set_draw_color(*COLOR_ACCENT)
        self.pdf.set_line_width(0.5)
        self.pdf.line(self.pdf.l_margin, y, self.pdf.w - self.pdf.r_margin, y)
        self.pdf.ln(4)
        self.pdf.set_text_color(*COLOR_TEXT)

    def sub_heading(self, text):
        self.pdf.ln(1)
        self.pdf.set_font("Helvetica", "B", 11)
        self.pdf.set_text_color(*COLOR_ACCENT)
        self.pdf.multi_cell(0, 6, ascii_safe(text))
        self.pdf.set_text_color(*COLOR_TEXT)
        self.pdf.ln(1)

    def paragraph(self, text, size=10.5):
        self.pdf.set_font("Helvetica", "", size)
        self.pdf.set_text_color(*COLOR_TEXT)
        self.pdf.multi_cell(0, 5.5, ascii_safe(text))
        self.pdf.ln(1.5)

    def bullet(self, text, size=10.5):
        self.pdf.set_font("Helvetica", "", size)
        self.pdf.set_text_color(*COLOR_TEXT)
        x = self.pdf.get_x()
        self.pdf.cell(5, 5.5, "-")
        self.pdf.set_x(x + 5)
        self.pdf.multi_cell(self.content_width() - 5, 5.5, ascii_safe(text))
        self.pdf.ln(0.5)

    def numbered(self, n, text, size=10.5):
        self.pdf.set_font("Helvetica", "", size)
        self.pdf.set_text_color(*COLOR_TEXT)
        x = self.pdf.get_x()
        label = f"{n}."
        self.pdf.cell(7, 5.5, label)
        self.pdf.set_x(x + 7)
        self.pdf.multi_cell(self.content_width() - 7, 5.5, ascii_safe(text))
        self.pdf.ln(0.5)

    def note(self, text):
        self.pdf.ln(1)
        self.pdf.set_font("Helvetica", "I", 9.5)
        self.pdf.set_text_color(*COLOR_MUTED)
        self.pdf.multi_cell(0, 5, ascii_safe(text))
        self.pdf.set_text_color(*COLOR_TEXT)
        self.pdf.ln(1.5)

    def _wrap_code_line(self, text, inner_width, cont_indent="  "):
        """Wrap a single command line to fit inner_width using the current font.

        Breaks at spaces when possible, otherwise breaks mid-token (hard
        character wrap) so that space-less URLs never overflow. Continuation
        lines are visually indented with ``cont_indent`` (display-only).
        Returns a list of physical line strings.
        """
        text = ascii_safe(text)
        # Fast path: already fits on a single physical line.
        if self.pdf.get_string_width(text) <= inner_width:
            return [text]

        physical = []
        first = True
        remaining = text
        while remaining:
            prefix = "" if first else cont_indent
            avail = inner_width - self.pdf.get_string_width(prefix)
            # Guard against a pathological case where even the indent is too wide.
            if avail <= 0:
                avail = inner_width
                prefix = ""
            # Greedily pack as many characters as fit.
            take = 0
            for i in range(1, len(remaining) + 1):
                if self.pdf.get_string_width(remaining[:i]) <= avail:
                    take = i
                else:
                    break
            if take <= 0:
                take = 1  # always make progress
            chunk = remaining[:take]
            rest = remaining[take:]
            # Prefer breaking at a space if there is one and there is more to come.
            if rest and " " in chunk.rstrip():
                # Do not break on a leading space; find last space within chunk.
                break_at = chunk.rstrip().rfind(" ")
                if break_at > 0:
                    # Only use the space break if it keeps reasonable line usage.
                    chunk = remaining[:break_at]
                    rest = remaining[break_at:].lstrip(" ")
            physical.append(prefix + chunk)
            remaining = rest
            first = False
        return physical

    def code_block(self, lines):
        """Render a monospace command block in a shaded box.

        Long command lines are wrapped so nothing is ever clipped at the right
        margin. Wrapping prefers spaces but falls back to hard character breaks
        for space-less tokens (e.g. long URLs).
        """
        self.pdf.ln(1)
        line_h = 5.2
        pad = 3
        font_size = 8.5
        self.pdf.set_font("Courier", "", font_size)

        # Usable inner text width = box width - left inset (pad + accent bar
        # allowance of 1.5) - right pad.
        left_inset = pad + 1.5
        inner_width = self.content_width() - left_inset - pad

        # Pre-compute the wrapped physical lines for the whole block.
        physical_lines = []
        for ln_text in lines:
            physical_lines.extend(self._wrap_code_line(ln_text, inner_width))

        # Recompute box height from the TOTAL number of physical lines.
        block_h = line_h * len(physical_lines) + pad * 2
        if self.pdf.get_y() + block_h > self.pdf.h - 22:
            self.pdf.add_page()
        top = self.pdf.get_y()
        self.pdf.set_fill_color(*COLOR_CODE_BG)
        self.pdf.set_draw_color(*COLOR_LINE)
        self.pdf.set_line_width(0.2)
        self.pdf.rect(self.pdf.l_margin, top, self.content_width(), block_h, style="DF")
        # accent bar on the left
        self.pdf.set_fill_color(*COLOR_ACCENT)
        self.pdf.rect(self.pdf.l_margin, top, 1.2, block_h, style="F")
        self.pdf.set_text_color(*COLOR_CODE_TEXT)
        self.pdf.set_xy(self.pdf.l_margin + left_inset, top + pad)
        for ln_text in physical_lines:
            self.pdf.set_x(self.pdf.l_margin + left_inset)
            self.pdf.cell(0, line_h, ln_text)
            self.pdf.ln(line_h)
        self.pdf.set_y(top + block_h)
        self.pdf.ln(3)
        self.pdf.set_text_color(*COLOR_TEXT)

    # ---- comparison table -----------------------------------------------
    def comparison_table(self, headers, rows):
        self.pdf.ln(2)
        # Column widths: first (Feature) wider, then 4 equal-ish columns.
        total = self.content_width()
        first_w = total * 0.24
        other_w = (total - first_w) / (len(headers) - 1)
        widths = [first_w] + [other_w] * (len(headers) - 1)
        line_h = 5.0

        def row_height(cells, font_style, size):
            self.pdf.set_font("Helvetica", font_style, size)
            max_lines = 1
            for i, c in enumerate(cells):
                txt = ascii_safe(str(c))
                # estimate wrapped lines
                lines = self._count_lines(txt, widths[i] - 2, size, font_style)
                max_lines = max(max_lines, lines)
            return max_lines * line_h + 2

        # Header
        header_h = row_height(headers, "B", 9)
        if self.pdf.get_y() + header_h > self.pdf.h - 22:
            self.pdf.add_page()
        self.pdf.set_fill_color(*COLOR_TABLE_HEADER_BG)
        self.pdf.set_text_color(255, 255, 255)
        self.pdf.set_font("Helvetica", "B", 9)
        self.pdf.set_draw_color(*COLOR_LINE)
        self._draw_row(headers, widths, header_h, line_h, fill=True)

        # Body
        self.pdf.set_text_color(*COLOR_TEXT)
        for idx, row in enumerate(rows):
            rh = row_height(row, "", 8.5)
            if self.pdf.get_y() + rh > self.pdf.h - 22:
                self.pdf.add_page()
                # re-draw header on new page
                self.pdf.set_fill_color(*COLOR_TABLE_HEADER_BG)
                self.pdf.set_text_color(255, 255, 255)
                self.pdf.set_font("Helvetica", "B", 9)
                self._draw_row(headers, widths, header_h, line_h, fill=True)
                self.pdf.set_text_color(*COLOR_TEXT)
            alt = idx % 2 == 1
            self.pdf.set_font("Helvetica", "", 8.5)
            if alt:
                self.pdf.set_fill_color(*COLOR_TABLE_ROW_ALT)
            else:
                self.pdf.set_fill_color(255, 255, 255)
            self._draw_row(row, widths, rh, line_h, fill=True, bold_first=True)
        self.pdf.ln(3)

    def _count_lines(self, text, width, size, style):
        self.pdf.set_font("Helvetica", style, size)
        words = text.split(" ")
        lines = 1
        current = ""
        for w in words:
            trial = (current + " " + w).strip()
            if self.pdf.get_string_width(trial) <= width:
                current = trial
            else:
                lines += 1
                current = w
        return lines

    def _draw_row(self, cells, widths, height, line_h, fill=False, bold_first=False):
        x0 = self.pdf.l_margin
        y0 = self.pdf.get_y()
        # backgrounds + borders
        for i, w in enumerate(widths):
            self.pdf.set_xy(x0, y0)
            self.pdf.cell(w, height, "", border=1, fill=fill)
            x0 += w
        # text
        x0 = self.pdf.l_margin
        for i, c in enumerate(cells):
            txt = ascii_safe(str(c))
            if bold_first and i == 0:
                cur_style = self.pdf.font_style
                self.pdf.set_font(self.pdf.font_family, "B", self.pdf.font_size_pt)
            self.pdf.set_xy(x0 + 1, y0 + 1)
            self.pdf.multi_cell(widths[i] - 2, line_h, txt, align="L")
            if bold_first and i == 0:
                self.pdf.set_font(self.pdf.font_family, "", self.pdf.font_size_pt)
            x0 += widths[i]
        self.pdf.set_xy(self.pdf.l_margin, y0 + height)

    def save(self, path):
        self.pdf.output(path)


def build():
    g = GuideBuilder()

    g.title_block(
        "Proxy Scraper GUI - Setup & Usage Guide",
        "Created by @codex_here",
    )

    # ---------------- Section 1 ----------------
    g.section_heading("1. Before You Start (Requirements)")
    g.bullet("Windows 10 or 11 (curl and tar are built in).")
    g.bullet('Python 3.11 or newer. During install, TICK the box "Add Python to PATH".')
    g.bullet("Check Python is installed - in Command Prompt run:")
    g.code_block(["python --version"])
    g.bullet("Git is OPTIONAL (only needed for Method B). Method A uses only built-in Windows tools.")

    # ---------------- Section 2 ----------------
    g.section_heading("2. Method A: Download + Run entirely from CMD (recommended, no Git needed)")
    g.paragraph(
        "Copy-paste this whole block into Command Prompt (cmd.exe). It downloads the "
        "code as a ZIP using curl, extracts it with tar, installs dependencies, and "
        "launches the app."
    )
    g.code_block([
        "cd %USERPROFILE%",
        "curl -L -o proxy-app.zip https://github.com/Miten001/userbot/archive/refs/heads/feat/proxy-scraper-gui.zip",
        "tar -xf proxy-app.zip",
        "cd userbot-feat-proxy-scraper-gui\\proxy-scraper-gui",
        "pip install -r requirements.txt",
        "python main.py",
    ])
    g.note(
        'Note: The extracted folder is named "userbot-feat-proxy-scraper-gui". '
        "If Windows names it differently, run `dir` to see the folder name and `cd` into it."
    )
    g.sub_heading("One-line all-in-one version (uses & to chain commands in cmd):")
    g.code_block([
        "cd %USERPROFILE% & curl -L -o proxy-app.zip https://github.com/Miten001/userbot/archive/refs/heads/feat/proxy-scraper-gui.zip & tar -xf proxy-app.zip & cd userbot-feat-proxy-scraper-gui\\proxy-scraper-gui & pip install -r requirements.txt & python main.py",
    ])

    # ---------------- Section 3 ----------------
    g.section_heading("3. Method B: Using Git")
    g.code_block([
        "cd %USERPROFILE%",
        "git clone -b feat/proxy-scraper-gui https://github.com/Miten001/userbot.git proxy-app",
        "cd proxy-app\\proxy-scraper-gui",
        "pip install -r requirements.txt",
        "python main.py",
    ])

    # ---------------- Section 4 ----------------
    g.section_heading("4. Recommended: Use a Virtual Environment (optional)")
    g.code_block([
        "python -m venv .venv",
        ".venv\\Scripts\\activate",
        "pip install -r requirements.txt",
        "python main.py",
    ])

    # ---------------- Section 5 ----------------
    g.section_heading("5. How to Use the App")
    g.numbered(1, 'Pick a country or leave it on "Random / Any".')
    g.numbered(2, "Choose protocols (HTTP/HTTPS/SOCKS4/SOCKS5) and a max latency.")
    g.numbered(3, 'Choose an Anonymity level from the dropdown. "Elite only" is the '
                  'default - pick it if you want the website to NOT be able to tell you '
                  'are using a proxy. "Anonymous or better" hides your real IP but the '
                  'site may still detect that a proxy is being used. "Any" applies no '
                  'anonymity restriction.')
    g.numbered(4, "Click Start - working proxies stream into the table.")
    g.numbered(5, "Click Cancel anytime (keeps results found so far).")
    g.numbered(6, "Click Export to save as CSV / TXT / JSON.")

    g.sub_heading("Anonymity Levels (which proxy hides best?)")
    g.bullet("Transparent: leaks your real IP - avoid.")
    g.bullet("Anonymous: hides your IP, but the site can tell a proxy is being used.")
    g.bullet("Elite (High Anonymous): hides your IP AND that a proxy is used - the site "
             "cannot detect the proxy. Best for browsing. This is the app's default.")
    g.note(
        "Note: free \"Elite\" proxies still may be blocked by advanced sites "
        "(Cloudflare/Google) via IP reputation; for undetectable use, residential/paid "
        "proxies are more reliable."
    )

    # ---------------- Section 6 ----------------
    g.section_heading("6. Troubleshooting")
    g.bullet('"python is not recognized" -> Python not on PATH; reinstall Python and '
             'tick "Add Python to PATH", then reopen Command Prompt.')
    g.bullet('"pip is not recognized" -> use  python -m pip install -r requirements.txt')
    g.bullet("The system cannot find the path specified -> you are in the wrong folder; "
             "run `dir` and `cd` into the correct extracted folder.")
    g.bullet("Do NOT run these commands inside C:\\Windows\\System32 - use your user "
             "folder (%USERPROFILE%).")

    # ---------------- Section 7 ----------------
    g.section_heading("7. Proxy Types Explained: HTTP vs HTTPS vs SOCKS4 vs SOCKS5")

    g.sub_heading("HTTP proxy")
    g.paragraph(
        "Works only for web (HTTP) traffic. It understands HTTP requests and can cache "
        "or modify them. Best for simple web browsing/scraping. On its own it does not "
        "encrypt traffic."
    )
    g.sub_heading("HTTPS proxy")
    g.paragraph(
        "An HTTP proxy that supports the CONNECT method, so it can tunnel encrypted "
        "HTTPS (TLS) traffic to secure websites (port 443). The end-to-end TLS stays "
        "encrypted - the proxy only relays the tunnel and cannot read the page content. "
        "Best for accessing secure (https://) websites."
    )
    g.sub_heading("SOCKS4")
    g.paragraph(
        "A lower-level, general-purpose proxy that forwards any TCP connection (not just "
        "web) - e.g. email, FTP, games. It does not interpret the traffic. Limitations: "
        "no authentication support to speak of, no UDP, IPv4 only, and DNS is resolved on "
        "the client side (can leak DNS)."
    )
    g.sub_heading("SOCKS5")
    g.paragraph(
        "The upgraded version of SOCKS4. Supports both TCP and UDP, username/password "
        "authentication, remote DNS resolution (better privacy, avoids DNS leaks), and "
        "IPv6. The most flexible and is great for apps, games, streaming, and torrents. "
        "Note: SOCKS itself does not add encryption - it just forwards traffic."
    )

    headers = ["Feature", "HTTP", "HTTPS", "SOCKS4", "SOCKS5"]
    rows = [
        ["Traffic type", "Web (HTTP)", "Web incl. HTTPS tunnel", "Any TCP", "Any TCP + UDP"],
        ["Handles HTTPS sites", "Limited", "Yes", "Yes (as raw TCP)", "Yes (as raw TCP)"],
        ["Authentication", "Basic", "Basic", "No", "Yes (user/pass)"],
        ["Remote DNS", "N/A", "N/A", "No", "Yes"],
        ["UDP support", "No", "No", "No", "Yes"],
        ["IPv6 support", "No", "No", "No", "Yes"],
        ["Best for", "Simple web scraping", "Secure websites", "General TCP apps",
         "Everything (apps, games, torrents)"],
    ]
    g.comparison_table(headers, rows)

    g.note(
        "Tip: If you are unsure, SOCKS5 is the most versatile; HTTPS is best for secure "
        "websites; HTTP is fine for basic web scraping."
    )

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), OUTPUT_NAME)
    g.save(out_path)
    return out_path


if __name__ == "__main__":
    path = build()
    size = os.path.getsize(path)
    print(f"PDF written to: {path}")
    print(f"File size: {size} bytes")
