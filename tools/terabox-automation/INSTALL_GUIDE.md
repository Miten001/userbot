# TeraBox Automation Tool

## Complete Installation & Usage Guide

**Author: @codex_here**

---

## REQUIREMENTS

- Windows 10/11
- Python 3.7+
- Google Chrome browser (latest)
- Internet connection

---

## STEP 1 - INSTALL PYTHON

1. Download from: https://python.org/downloads

2. **IMPORTANT:** Tick "Add Python to PATH" during installation

3. Verify - Open CMD and type:
   ```
   python --version
   ```

---

## STEP 2 - DOWNLOAD TOOL

### Method 1 (with Git):
```
git clone https://github.com/Miten001/userbot.git
```

### Method 2 (without Git):
Open CMD and run:
```
curl -L -o userbot.zip https://github.com/Miten001/userbot/archive/refs/heads/uncheck.zip
```

Extract:
```
tar -xf userbot.zip
```

Go to folder:
```
cd userbot-uncheck\tools\terabox-automation
```

### Method 3 (Manual):
Download ZIP from https://github.com/Miten001/userbot browser me open karke

---

## STEP 3 - INSTALL DEPENDENCIES

Open CMD in the terabox-automation folder and run:
```
pip install selenium pyautogui
```

If pip not found:
```
python -m pip install selenium pyautogui
```

---

## STEP 4 - RUN

Open CMD in the terabox-automation folder and run:
```
python main.py
```

GUI will open with dark theme.

---

## HOW TO USE - GUI OPTIONS

| Option | Description |
|--------|-------------|
| Link (URL) | Paste any URL you want to open (default: TeraBox link) |
| Pages (1-1000) | How many browser windows to open simultaneously |
| Use Proxy / IP Rotation | Check to enable proxy (OFF by default) |
| Proxies box | Paste custom proxies (IP:PORT format, one per line) |
| Start Automation | Opens all browsers and does Login > Sign up > Email click |
| Stop | Cancel anytime |
| Close Browsers | Close all Chrome windows |
| Close All Tabs | Kill all Chrome processes |

---

## FEATURES

- Dark hacker theme GUI with @codex_here branding
- Up to 1000 pages simultaneously
- Each browser has unique fingerprint (User-Agent, GPU, Screen, Canvas, etc.)
- IP rotation support (Saudi Arabia, UAE, US, South Korea, Japan, Mexico, Qatar)
- Grid layout - all browsers arranged neatly on screen
- Zoom out 80% for better visibility
- Real-time status/terminal output

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Chrome not found" | Install Google Chrome |
| "pip not found" | python -m pip install selenium pyautogui |
| "tkinter not found" | Reinstall Python with tkinter checked |
| "This page isn't working" | Uncheck proxy checkbox, use direct connection |
| "Browser not opening" | Make sure Chrome is updated |
| "Selenium connection failed" | Close all Chrome windows and try again |
| Pages overlapping | Tool auto-arranges in grid, close extra windows |

---

## ONE-LINER INSTALL (copy paste in CMD)

**With Git:**
```
git clone https://github.com/Miten001/userbot.git && cd userbot\tools\terabox-automation && pip install selenium pyautogui && python main.py
```

**Without Git:**
```
curl -L -o userbot.zip https://github.com/Miten001/userbot/archive/refs/heads/uncheck.zip && tar -xf userbot.zip && cd userbot-uncheck\tools\terabox-automation && pip install selenium pyautogui && python main.py
```

---

## CONTACT

For help and updates: **@codex_here**
