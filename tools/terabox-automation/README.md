# TeraBox Automation Tool

## Description / Tafsilaat

Yeh ek Python GUI tool hai jo TeraBox website pe automated browser interaction karta hai.

This is a Python GUI tool that automates browser interaction with TeraBox website.

### Kya karta hai? / What does it do?

1. Chrome browser ko **incognito mode** mein open karta hai
2. TeraBox link pe jaata hai: `https://1024terabox.com/s/1axTeTaTPATdSOQizMrGeJQ`
3. **Sign In** button pe click karta hai
4. **Sign Up** button pe click karta hai
5. **Gmail** option select karta hai
6. Yeh sab aapke bataye hue pages ki tadaad ke hisaab se repeat hota hai

---

## Requirements / Zarooriyaat

- Python 3.7 ya zyada (Python 3.7 or higher)
- Google Chrome browser installed hona chahiye
- ChromeDriver (Chrome ke version ke mutabiq)
- Internet connection

### Python Packages

```
selenium>=4.0.0
```

---

## Installation / Setup

### Step 1: Python packages install karein

```bash
pip install -r requirements.txt
```

### Step 2: ChromeDriver

**Option A - Automatic (Recommended):**
Selenium 4.6+ automatically downloads the correct ChromeDriver. Bas Chrome browser install hona chahiye.

**Option B - Manual:**
1. Apna Chrome version check karein: Chrome > Settings > About Chrome
2. Matching ChromeDriver download karein: https://chromedriver.chromium.org/downloads
3. ChromeDriver ko PATH mein rakhein

---

## Usage / Istemal

### Run the tool:

```bash
python main.py
```

### Help dekhein:

```bash
python main.py --help
```

### GUI mein:

1. **Number of pages** - Kitne browser pages open karne hain woh number likhein
2. **Start Automation** - Button dabayein automation shuru karne ke liye
3. **Status** - Neeche progress dikhai dega
4. **Close All Browsers** - Sab browsers band karne ke liye

---

## Troubleshooting / Masail ka Hal

### "Chrome driver error"
- Chrome browser install hai? Install karein: https://www.google.com/chrome/
- ChromeDriver version Chrome ke version se match karta hai?

### "Sign In button not found"
- Website ka layout change ho sakta hai
- `main.py` mein selectors ko update karna pad sakta hai
- Page load hone ka wait karna pad sakta hai (internet slow ho to)

### "tkinter not installed"
- Linux: `sudo apt-get install python3-tk`
- Windows/Mac: Python ke saath aata hai by default

### Buttons nahi mil rahe?
- TeraBox website apna layout change kar sakti hai
- `main.py` mein `selectors_sign_in`, `selectors_sign_up`, `selectors_gmail` lists mein naye selectors add karein
- Browser mein manually check karein ke button ka text kya hai

---

## Notes / Baatein

- Tool browsers ko band nahi karta automatically - "Close All Browsers" button use karein
- Agar zyada pages open karein to system resources (RAM) zyada use hongi
- Incognito mode mein open hota hai taake cookies share na hon
- Har page ke beech thoda delay hota hai taake website block na kare

---

## File Structure

```
tools/terabox-automation/
  main.py            - Main script (GUI + automation)
  requirements.txt   - Python dependencies
  README.md          - This file (yeh file)
```
