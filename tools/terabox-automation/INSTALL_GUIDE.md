# TeraBox Automation Tool - Installation Guide

**@codex_here**

---

## REQUIREMENTS

- Windows 10/11
- Python 3.7 or higher
- Google Chrome browser (latest version)
- Internet connection

---

## STEP 1 - PYTHON INSTALL

1. Download Python from [python.org/downloads](https://python.org/downloads)

2. **IMPORTANT:** Check "Add Python to PATH" during installation

3. Verify installation - Open CMD and type:
   ```
   python --version
   ```

---

## STEP 2 - DOWNLOAD TOOL

Clone the repository using git:
```
git clone https://github.com/Miten001/userbot.git
```

OR download ZIP from GitHub.

Navigate to the tool folder:
```
userbot/tools/terabox-automation/
```

---

## STEP 3 - INSTALL DEPENDENCIES

Open CMD in the terabox-automation folder and run:
```
pip install selenium pyautogui
```

If pip is not found, use:
```
python -m pip install selenium pyautogui
```

---

## STEP 4 - RUN THE TOOL

Open CMD in the terabox-automation folder and run:
```
python main.py
```

The GUI will open with a dark theme.

---

## HOW TO USE

1. Enter number of pages (1-50)
2. Click "Start Automation"
3. All pages will open simultaneously in Chrome incognito
4. Tool will automatically: Login -> Sign up -> Click Email icon
5. Use "Stop" to cancel anytime
6. Use "Close Browsers" to close all Chrome windows

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Chrome not found" | Install Google Chrome or check installation path |
| "pip not found" | Use `python -m pip install ...` |
| "tkinter not found" | Reinstall Python with tkinter option checked |
| "Browser opens but nothing happens" | Make sure Chrome is updated to latest version |
| Pages not opening | Check internet connection |

---

## CONTACT

For help and updates: **@codex_here**
