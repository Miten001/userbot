"""
TeraBox Automation Tool
-----------------------
A GUI tool that automates browser interaction with TeraBox.
Opens Chrome with unique profiles via subprocess with remote debugging,
then connects Selenium for Log In -> Sign Up -> Email selection flow.

@codex_here
"""

import atexit
import base64
import os
import random
import shutil
import string
import subprocess
import threading
import time
import sys
import uuid


def _check_help():
    """Show help text and exit if --help or -h is passed."""
    if "--help" in sys.argv or "-h" in sys.argv:
        print("TeraBox Automation Tool")
        print("=" * 40)
        print()
        print("Usage: python main.py")
        print()
        print("This tool opens a GUI where you can:")
        print("  1. Enter the number of browser pages to open")
        print("  2. Click 'Start Automation' to begin")
        print()
        print("The automation will:")
        print("  - Open Chrome with unique profiles (via subprocess)")
        print("  - Navigate to TeraBox")
        print("  - Click Log In -> Sign Up -> Email")
        print("  - Repeat for each page")
        print()
        print("Requirements:")
        print("  - Python 3.7+")
        print("  - Google Chrome browser installed")
        print("  - selenium (pip install selenium)")
        print("  - pyautogui (pip install pyautogui)")
        print("  - tkinter (usually included with Python)")
        sys.exit(0)


# Handle --help before importing GUI/selenium dependencies
_check_help()

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    print("Error: tkinter is not installed.")
    print("Install it with: sudo apt-get install python3-tk (Linux)")
    print("On Windows/Mac, tkinter comes with Python by default.")
    sys.exit(1)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        TimeoutException,
        NoSuchElementException,
        WebDriverException,
    )
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

try:
    import pyautogui
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.1
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False


# Target URL
TERABOX_URL = "https://1024terabox.com/s/1axTeTaTPATdSOQizMrGeJQ"

# Supported countries for IP rotation:
# SA = Saudi Arabia, AE = UAE, US = United States
# KR = South Korea, JP = Japan, MX = Mexico, QA = Qatar
PROXY_COUNTRIES = "SA,AE,US,KR,JP,MX,QA"
ALLOWED_COUNTRIES = ["SA", "AE", "US", "KR", "JP", "MX", "QA"]

# Track used proxies across all sessions to prevent repeats
USED_PROXIES = set()

# Remote debugging port for Chrome
DEBUG_PORT = 9222

# Per-selector probe timeout in seconds (short to avoid cascade)
SELECTOR_TIMEOUT = 3
# Overall page load timeout in seconds
PAGE_LOAD_TIMEOUT = 30
# Delay between actions in seconds
ACTION_DELAY = 0.5
# Maximum number of concurrent browser pages allowed
MAX_PAGES = 1000


def find_chrome_path():
    """Find Chrome executable path on Windows."""
    possible_paths = [
        os.path.join(
            os.environ.get("PROGRAMFILES", r"C:\Program Files"),
            "Google", "Chrome", "Application", "chrome.exe"
        ),
        os.path.join(
            os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"),
            "Google", "Chrome", "Application", "chrome.exe"
        ),
        os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "Google", "Chrome", "Application", "chrome.exe"
        ),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for path in possible_paths:
        if path and os.path.isfile(path):
            return path
    # Try to find via where command on Windows
    try:
        result = subprocess.run(
            ["where", "chrome"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")[0].strip()
    except Exception:
        pass
    # Last resort: return chrome.exe and hope it is on PATH
    return "chrome.exe"


class TeraBoxAutomation:
    """Handles browser automation flow for TeraBox using subprocess + Selenium."""

    def __init__(self, status_callback=None, stop_event=None):
        self.status_callback = status_callback or print
        self.stop_event = stop_event or threading.Event()
        self.chrome_processes = []
        self.drivers = []
        self.proxies = []
        self.proxy_index = 0

    def _is_stopped(self):
        """Check if the stop event has been set."""
        return self.stop_event.is_set()

    def update_status(self, message):
        """Send status update to callback."""
        self.status_callback(message)

    def _get_proxy_country(self, proxy):
        """Get country of proxy IP using free API."""
        try:
            import urllib.request
            import json
            ip = proxy.split(":")[0]
            req = urllib.request.Request(
                f"http://ip-api.com/json/{ip}?fields=country,countryCode",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            response = urllib.request.urlopen(req, timeout=2)
            data = json.loads(response.read().decode('utf-8'))
            return data.get("countryCode", "??")
        except Exception:
            return "??"

    def _verify_proxy_country(self, proxy):
        """Check if proxy IP belongs to allowed country. Returns country code or None."""
        try:
            import urllib.request
            import json
            ip = proxy.split(":")[0]
            req = urllib.request.Request(
                f"http://ip-api.com/json/{ip}?fields=countryCode",
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            response = urllib.request.urlopen(req, timeout=2)
            data = json.loads(response.read().decode('utf-8'))
            country = data.get("countryCode", "")
            if country in ALLOWED_COUNTRIES:
                return country
            return None
        except Exception:
            return None

    def _fetch_proxies(self):
        """Fetch HTTP proxies ONLY from SA, AE, US, KR, JP, MX, QA."""
        self.update_status("Fetching proxies from: SA, AE, US, KR, JP, MX, QA only...")
        proxies = []
        try:
            import urllib.request
            apis = [
                f"https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country={PROXY_COUNTRIES}&ssl=all&anonymity=all",
                f"https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country={PROXY_COUNTRIES}&ssl=all&anonymity=anonymous",
                f"https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country={PROXY_COUNTRIES}&ssl=all&anonymity=elite",
            ]
            for api_url in apis:
                try:
                    req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
                    response = urllib.request.urlopen(req, timeout=10)
                    data = response.read().decode('utf-8')
                    for line in data.strip().split('\n'):
                        line = line.strip()
                        if ':' in line and line[0].isdigit() and len(line) < 25:
                            proxies.append(line)
                except Exception:
                    continue
        except Exception:
            pass
        proxies = list(set(proxies))
        random.shuffle(proxies)
        self.update_status(f"Found {len(proxies)} proxies from target countries")
        return proxies

    def _get_random_fingerprint(self):
        """Generate random browser fingerprint for each instance.
        
        Uses dynamic Chrome version/build numbers for THOUSANDS of unique
        user agents instead of a static list.
        """
        # Dynamic user agent generation with random build numbers
        chrome_version = random.randint(115, 125)
        build = random.randint(5000, 6999)
        patch = random.randint(0, 999)
        user_agent = f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_version}.0.{build}.{patch} Safari/537.36"

        # More random screen resolutions
        screen_width = random.choice([1920, 1366, 1536, 1440, 1280, 1600, 2560, 1680, 1360, 1024])
        screen_height = random.choice([1080, 768, 864, 900, 720, 1024, 1440, 1050, 800])

        webgl_vendors = [
            "Google Inc. (NVIDIA)",
            "Google Inc. (AMD)",
            "Google Inc. (Intel)",
            "Google Inc.",
        ]

        webgl_renderers = [
            "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)",
            "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)",
            "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
            "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
            "ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0)",
            "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)",
        ]

        languages = ["en-US", "en-GB", "en-IN", "en-AU", "en-CA"]
        platforms = ["Win32", "Win64", "MacIntel", "Linux x86_64"]
        timezones = ["Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Dubai", "America/Los_Angeles", "Europe/Berlin"]

        # Random screen color depth
        color_depth = random.choice([24, 30, 32])
        # Random timezone offset in minutes
        timezone_offset = random.choice([-480, -420, -360, -300, -240, 0, 60, 120, 180, 210, 270, 330, 345, 480, 540])

        return {
            "user_agent": user_agent,
            "chrome_version": chrome_version,
            "screen": (screen_width, screen_height),
            "color_depth": color_depth,
            "timezone_offset": timezone_offset,
            "webgl_vendor": random.choice(webgl_vendors),
            "webgl_renderer": random.choice(webgl_renderers),
            "language": random.choice(languages),
            "platform": random.choice(platforms),
            "timezone": random.choice(timezones),
            "hardware_concurrency": random.choice([2, 4, 6, 8, 12, 16]),
            "device_memory": random.choice([2, 4, 8, 16, 32]),
        }

    def _parse_proxy(self, proxy_string):
        """Parse proxy string. Supports IP:PORT and IP:PORT:USER:PASS formats."""
        parts = proxy_string.strip().split(":")
        if len(parts) == 4:
            return {
                "host": parts[0],
                "port": parts[1],
                "user": parts[2],
                "password": parts[3],
                "server": f"{parts[0]}:{parts[1]}",
                "has_auth": True,
            }
        elif len(parts) == 2:
            return {
                "host": parts[0],
                "port": parts[1],
                "user": None,
                "password": None,
                "server": f"{parts[0]}:{parts[1]}",
                "has_auth": False,
            }
        else:
            return {"server": proxy_string, "has_auth": False, "user": None, "password": None}

    def launch_chrome_subprocess(self, url, debug_port, user_agent=None, language=None, proxy=None):
        """
        Launch Chrome via subprocess with remote debugging enabled.
        This is the PRIMARY method - most reliable on Windows.
        Uses UUID-based user-data-dir so each Chrome is truly independent.
        Window positioning is handled externally via Win+Right hotkey.
        """
        chrome_path = find_chrome_path()
        self.update_status(f"Chrome path: {chrome_path}")

        # Create a truly unique user data dir with UUID to prevent singleton detection
        temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
        user_data_dir = os.path.join(temp_dir, f"chrome_{uuid.uuid4().hex[:8]}")

        # Delete folder if it exists to remove old lock files
        if os.path.exists(user_data_dir):
            try:
                shutil.rmtree(user_data_dir)
            except Exception:
                pass
        os.makedirs(user_data_dir, exist_ok=True)

        # Write First Run file to prevent singleton detection
        first_run_file = os.path.join(user_data_dir, "First Run")
        with open(first_run_file, 'w') as f:
            f.write('')

        # Remove any lock files that might exist
        for lock_name in ["SingletonLock", "SingletonSocket", "SingletonCookie"]:
            lock_file = os.path.join(user_data_dir, lock_name)
            if os.path.exists(lock_file):
                try:
                    os.remove(lock_file)
                except Exception:
                    pass

        args = [
            chrome_path,
            f"--user-data-dir={user_data_dir}",
            f"--remote-debugging-port={debug_port}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-popup-blocking",
            "--disable-notifications",
            "--disable-session-crashed-bubble",
            "--disable-infobars",
            "--disable-features=ChromeWhatsNewUI",
            "--no-service-autorun",
            "--password-store=basic",
            "--force-renderer-accessibility",
        ]

        if user_agent:
            args.append(f"--user-agent={user_agent}")
        if language:
            args.append(f"--lang={language}")
        if proxy:
            proxy_info = self._parse_proxy(proxy)
            args.append(f"--proxy-server=http://{proxy_info['server']}")

        args.append(url)

        try:
            process = subprocess.Popen(
                args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.chrome_processes.append(process)
            self.update_status(f"Chrome launched via subprocess (PID: {process.pid})")
            return process
        except FileNotFoundError:
            self.update_status(
                f"ERROR: Chrome not found at '{chrome_path}'.\n"
                "Please install Google Chrome or check the path."
            )
            return None
        except Exception as e:
            self.update_status(f"ERROR launching Chrome: {str(e)}")
            return None

    def connect_selenium_to_chrome(self, debug_port, max_retries=3):
        """
        Connect Selenium to an already-running Chrome via remote debugging.
        """
        if not HAS_SELENIUM:
            self.update_status(
                "Selenium not installed - cannot connect for automation."
            )
            return None

        for attempt in range(1, max_retries + 1):
            if self._is_stopped():
                return None
            try:
                self.update_status(
                    f"Connecting Selenium to Chrome "
                    f"(attempt {attempt}/{max_retries})..."
                )
                chrome_options = Options()
                chrome_options.add_experimental_option(
                    "debuggerAddress", f"127.0.0.1:{debug_port}"
                )
                driver = webdriver.Chrome(options=chrome_options)
                driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
                self.update_status("Selenium connected to Chrome successfully!")
                return driver
            except Exception as e:
                self.update_status(
                    f"Connection attempt {attempt} failed: {str(e)}"
                )
                if attempt < max_retries:
                    time.sleep(1)

        self.update_status("Could not connect Selenium to Chrome.")
        return None

    def _find_element(self, driver, selectors, step_name, page_number):
        """Try each selector with a short timeout to find a clickable element."""
        for by, selector in selectors:
            if self._is_stopped():
                self.update_status(
                    f"[Page {page_number}] Stopped during {step_name}."
                )
                return None
            try:
                element = WebDriverWait(driver, SELECTOR_TIMEOUT).until(
                    EC.element_to_be_clickable((by, selector))
                )
                if element:
                    return element
            except (TimeoutException, NoSuchElementException):
                continue
        return None

    def perform_automation(self, driver, page_number):
        """
        Perform the automation flow on a single page.
        Chrome is already open with the URL loaded via subprocess.
        Steps: Click Log In -> Click Sign Up -> Click Email option
        """
        try:
            if self._is_stopped():
                return False

            # Wait for page to fully load (TeraBox has heavy JS)
            time.sleep(2)

            # Verify page loaded
            try:
                current_url = driver.current_url
                self.update_status(
                    f"[Page {page_number}] Current URL: {current_url}"
                )
                if current_url in ("data:,", "about:blank"):
                    self.update_status(
                        f"[Page {page_number}] Page is blank, waiting more..."
                    )
                    time.sleep(2)
            except Exception:
                self.update_status(
                    f"[Page {page_number}] Could not get current URL"
                )

            if self._is_stopped():
                return False

            # Check for connection errors (proxy issues) - auto close tab
            try:
                page_source = driver.page_source
                if "ERR_" in page_source or "This site can" in page_source or "took too long" in page_source or "connection was reset" in page_source:
                    self.update_status(f"[Tab {page_number}] Connection error detected - auto closing tab...")
                    driver.close()
                    if driver.window_handles:
                        driver.switch_to.window(driver.window_handles[-1])
                    return False
            except Exception:
                pass

            # Step 1: Click "Log In" button
            self.update_status(
                f"[Page {page_number}] Looking for Log In button..."
            )
            time.sleep(ACTION_DELAY)

            selectors_sign_in = [
                (By.XPATH, "//button[contains(text(),'Login')]"),
                (By.XPATH, "//a[contains(text(),'Login')]"),
                (By.XPATH, "//*[contains(text(),'Login')]"),
                (By.XPATH, "//button[text()='Login']"),
                (By.XPATH, "//a[text()='Login']"),
                (By.CSS_SELECTOR, "button.login"),
                (By.CSS_SELECTOR, "a.login"),
                (By.CSS_SELECTOR, ".download-guide-login-btn"),
                (By.CSS_SELECTOR, "[class*='guide-login']"),
                (By.CSS_SELECTOR, "[class*='login-btn']"),
                (By.CSS_SELECTOR, "[class*='header-login']"),
                (By.CSS_SELECTOR, ".header-login-btn"),
                (By.XPATH, "//span[contains(text(),'Log In')]"),
                (By.XPATH, "//span[contains(text(),'Log in')]"),
                (By.XPATH, "//div[contains(@class,'login')]//span"),
                (By.XPATH, "//*[@id='login-btn']"),
                (By.CSS_SELECTOR, "[class*='download-guide-btn']"),
                (By.CSS_SELECTOR, ".btn-login"),
                (By.XPATH, "//div[contains(@class,'login')]"),
                (By.XPATH, "//span[contains(text(),'Sign in')]"),
                (By.XPATH, "//span[contains(text(),'Sign In')]"),
                (By.XPATH, "//button[contains(text(),'Sign in')]"),
                (By.XPATH, "//button[contains(text(),'Sign In')]"),
                (By.XPATH, "//a[contains(text(),'Sign in')]"),
                (By.XPATH, "//a[contains(text(),'Sign In')]"),
                (By.XPATH, "//*[contains(text(),'Log in')]"),
                (By.XPATH, "//*[contains(text(),'Log In')]"),
                (By.CSS_SELECTOR, "[class*='sign-in']"),
                (By.CSS_SELECTOR, "[class*='signin']"),
                (By.CSS_SELECTOR, "[class*='login']"),
                (By.CSS_SELECTOR, ".btn-sign-in"),
            ]

            sign_in_btn = self._find_element(
                driver, selectors_sign_in, "Log In", page_number
            )

            if self._is_stopped():
                return False

            if sign_in_btn:
                sign_in_btn.click()
                self.update_status(f"[Page {page_number}] Clicked Log In!")
                time.sleep(1)
            else:
                self.update_status(
                    f"[Page {page_number}] Log In button not found. "
                    "You may need to adjust the selectors."
                )
                return False

            if self._is_stopped():
                return False

            # Step 2: Click "Sign Up" button
            self.update_status(f"[Page {page_number}] Looking for Sign Up button...")
            time.sleep(ACTION_DELAY)

            selectors_sign_up = [
                (By.XPATH, "//*[text()='Sign up']"),
                (By.XPATH, "//div[text()='Sign up']"),
                (By.XPATH, "//span[text()='Sign up']"),
                (By.XPATH, "//p[text()='Sign up']"),
                (By.XPATH, "//a[text()='Sign up']"),
                (By.XPATH, "//li[text()='Sign up']"),
                (By.XPATH, "//*[contains(@class,'tab')]//*[text()='Sign up']"),
                (By.XPATH, "//*[contains(@class,'tab')]//*[contains(text(),'Sign up')]"),
                (By.XPATH, "//*[contains(@class,'switch')]//*[contains(text(),'Sign up')]"),
                (By.XPATH, "//*[contains(@class,'register-tab')]"),
                (By.CSS_SELECTOR, "[class*='signup']"),
                (By.CSS_SELECTOR, "[class*='sign-up']"),
                (By.CSS_SELECTOR, ".register-link"),
                (By.CSS_SELECTOR, "[class*='register']"),
                (By.XPATH, "//a[contains(text(),'Sign up')]"),
                (By.XPATH, "//a[contains(text(),'Sign Up')]"),
                (By.XPATH, "//span[contains(text(),'Sign up')]"),
                (By.XPATH, "//span[contains(text(),'Sign Up')]"),
                (By.XPATH, "//div[contains(@class,'tab')]//span[contains(text(),'Sign')]"),
                (By.XPATH, "//button[contains(text(),'Sign up')]"),
                (By.XPATH, "//button[contains(text(),'Sign Up')]"),
                (By.XPATH, "//*[contains(text(),'Create account')]"),
                (By.XPATH, "//*[contains(text(),'Register')]"),
            ]

            sign_up_btn = self._find_element(
                driver, selectors_sign_up, "Sign Up", page_number
            )

            if self._is_stopped():
                return False

            if sign_up_btn:
                sign_up_btn.click()
                self.update_status(f"[Page {page_number}] Clicked Sign Up!")
                time.sleep(1)
            else:
                self.update_status(
                    f"[Page {page_number}] Sign Up button not found. "
                    "You may need to adjust the selectors."
                )
                return False

            if self._is_stopped():
                return False

            # Step 3: Click Email icon option
            self.update_status(
                f"[Page {page_number}] Looking for Email icon option..."
            )
            time.sleep(ACTION_DELAY)

            selectors_email = [
                (By.XPATH, "//*[contains(@class,'other-login')]//*[contains(@class,'mail')]"),
                (By.XPATH, "//*[contains(@class,'other')]//*[contains(@class,'mail')]"),
                (By.XPATH, "//*[contains(@class,'third')]//*[contains(@class,'mail')]"),
                (By.XPATH, "//*[contains(@class,'social')]//*[contains(@class,'mail')]"),
                (By.XPATH, "//*[contains(@class,'login-type')]//*[contains(@class,'mail')]"),
                (By.CSS_SELECTOR, ".other-login-way [class*='mail']"),
                (By.CSS_SELECTOR, "[class*='other-login'] [class*='mail']"),
                (By.CSS_SELECTOR, "[class*='third-party'] [class*='mail']"),
                (By.CSS_SELECTOR, "[class*='email-btn']"),
                (By.CSS_SELECTOR, "[class*='email-login']"),
                (By.CSS_SELECTOR, "[class*='login-email']"),
                (By.CSS_SELECTOR, "[data-type='email']"),
                (By.CSS_SELECTOR, "[class*='mail']"),
                (By.XPATH, "//div[contains(@class,'email')]"),
                (By.XPATH, "//a[contains(@class,'email')]"),
                (By.XPATH, "//span[contains(text(),'Email')]"),
                (By.XPATH, "//span[contains(text(),'email')]"),
                (By.XPATH, "//*[contains(@class,'mail')]"),
                (By.XPATH, "//img[contains(@src,'mail')]/.."),
                (By.XPATH, "//img[contains(@alt,'mail')]/.."),
                (By.XPATH, "//img[contains(@alt,'Mail')]/.."),
                (By.XPATH, "//svg[contains(@class,'mail')]/.."),
                (By.CSS_SELECTOR, "[class*='icon-email']"),
                (By.CSS_SELECTOR, "[class*='icon-mail']"),
            ]

            email_btn = self._find_element(
                driver, selectors_email, "Email", page_number
            )

            if self._is_stopped():
                return False

            if email_btn:
                email_btn.click()
                self.update_status(
                    f"[Page {page_number}] Clicked Email option! Done."
                )
                time.sleep(ACTION_DELAY)
            else:
                self.update_status(
                    f"[Page {page_number}] Email option not found. "
                    "You may need to adjust the selectors."
                )
                return False

            return True

        except Exception as e:
            self.update_status(f"[Page {page_number}] Error: {str(e)}")
            return False

    def run(self, num_pages, custom_proxies=None, url=None):
        """Run the automation for the specified number of pages as separate Chrome windows.
        
        Two-phase approach for maximum speed:
        Phase 1: Open ALL Chrome windows fast (no selenium, no automation)
        Phase 2: Connect selenium to each and do automation
        """
        target_url = url or TERABOX_URL
        self.update_status(f"Starting automation for {num_pages} browser(s)...")

        # Handle proxies
        if custom_proxies == "auto":
            self.update_status("Fetching proxies...")
            raw_proxies = self._fetch_proxies()
            if raw_proxies:
                self.update_status(f"Got {len(raw_proxies)} raw proxies. Verifying countries...")
                self.proxies = []
                for idx, p in enumerate(raw_proxies[:100], 1):
                    if self._is_stopped():
                        break
                    country = self._verify_proxy_country(p)
                    if country:
                        if p not in USED_PROXIES:
                            self.proxies.append(p)
                            USED_PROXIES.add(p)
                            self.update_status(f"  [{idx}] {p} -> {country} OK (NEW)")
                        else:
                            self.update_status(f"  [{idx}] {p} -> {country} SKIP (already used)")
                    if len(self.proxies) >= 30:
                        break
                if self.proxies:
                    self.update_status(f"\n{len(self.proxies)} verified proxies (SA,AE,US,KR,JP,MX,QA only)!")
                else:
                    self.update_status("\nNo verified proxies found - direct connection")
            else:
                self.proxies = []
                self.update_status("No proxies found - direct connection")
        elif custom_proxies and isinstance(custom_proxies, list):
            self.proxies = custom_proxies
            self.update_status(f"Using {len(self.proxies)} custom proxies")
        else:
            self.proxies = []
            self.update_status("Proxy disabled - direct connection")

        # PHASE 1: Launch ALL Chrome windows fast
        launched_ports = []
        for page_number in range(1, num_pages + 1):
            if self._is_stopped():
                break

            fingerprint = self._get_random_fingerprint()
            proxy = None
            if self.proxies:
                proxy = self.proxies.pop(0)  # Take first and remove from list
                self.update_status(f"[{page_number}/{num_pages}] Using IP: {proxy}")
            else:
                self.update_status(f"[{page_number}/{num_pages}] No more proxies - direct connection")

            port = DEBUG_PORT + (page_number - 1)
            self.update_status(f"[{page_number}/{num_pages}] Opening browser... IP: {proxy if proxy else 'direct'}")

            process = self.launch_chrome_subprocess(
                target_url, port, fingerprint['user_agent'],
                fingerprint['language'], proxy
            )
            if process is None:
                continue

            # Show IP and country after successful launch
            country = self._get_proxy_country(proxy) if proxy else "LOCAL"
            self.update_status(f"[{page_number}/{num_pages}] IP: {proxy if proxy else 'direct'} | Country: {country}")

            # Verify Chrome actually started as new process
            time.sleep(0.5)
            if process.poll() is not None:
                self.update_status(f"[{page_number}] Chrome merged with existing - skipping")
                continue

            launched_ports.append((port, fingerprint, page_number, proxy))

            # Quick wait + snap to right half
            time.sleep(1)
            if HAS_PYAUTOGUI:
                pyautogui.hotkey('win', 'right')
                time.sleep(0.3)

        self.update_status(f"\n--- All {len(launched_ports)} browsers opened! ---")
        self.update_status("Now running automation on each...")

        # PHASE 2: Connect selenium and automate each window
        for port, fingerprint, page_number, proxy in launched_ports:
            if self._is_stopped():
                break

            driver = self.connect_selenium_to_chrome(port)
            if driver is None:
                self.update_status(f"[Window {page_number}] Selenium failed, skipping.")
                continue

            self.drivers.append(driver)

            # Authenticate proxy if it has username/password
            if proxy:
                proxy_info = self._parse_proxy(proxy)
                if proxy_info.get("has_auth"):
                    try:
                        credentials = base64.b64encode(
                            f"{proxy_info['user']}:{proxy_info['password']}".encode()
                        ).decode()
                        driver.execute_cdp_cmd('Network.enable', {})
                        driver.execute_cdp_cmd('Network.setExtraHTTPHeaders', {
                            'headers': {'Proxy-Authorization': f'Basic {credentials}'}
                        })
                        self.update_status(f"[Window {page_number}] Proxy authenticated!")
                    except Exception as e:
                        self.update_status(f"[Window {page_number}] Proxy auth failed: {e}")

            # Show fingerprint summary per window
            self.update_status(f"[Window {page_number}] Fingerprint: Chrome/{fingerprint['chrome_version']} | {fingerprint['platform']} | {fingerprint['screen'][0]}x{fingerprint['screen'][1]}")

            # Inject fingerprint with unique canvas noise per window
            canvas_noise = random.uniform(0.001, 0.01)
            spoof_script = f"""
Object.defineProperty(navigator, 'platform', {{get: () => '{fingerprint["platform"]}'}});
Object.defineProperty(navigator, 'hardwareConcurrency', {{get: () => {fingerprint["hardware_concurrency"]}}});
Object.defineProperty(navigator, 'deviceMemory', {{get: () => {fingerprint["device_memory"]}}});
Object.defineProperty(navigator, 'languages', {{get: () => ['{fingerprint["language"]}', 'en']}});
Object.defineProperty(screen, 'width', {{get: () => {fingerprint["screen"][0]}}});
Object.defineProperty(screen, 'height', {{get: () => {fingerprint["screen"][1]}}});
Object.defineProperty(screen, 'colorDepth', {{get: () => {fingerprint["color_depth"]}}});
const noise = {canvas_noise};
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type) {{
    const ctx = this.getContext('2d');
    if (ctx) {{
        const imageData = ctx.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {{
            imageData.data[i] = imageData.data[i] + (noise * (Math.random() - 0.5) * 2) | 0;
        }}
        ctx.putImageData(imageData, 0, 0);
    }}
    return originalToDataURL.apply(this, arguments);
}};
"""
            try:
                driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': spoof_script})
            except Exception:
                pass

            # Zoom out
            try:
                driver.execute_script("document.body.style.zoom='80%'")
            except Exception:
                pass

            # Check for error pages - auto close
            try:
                page_source = driver.page_source
                if "ERR_" in page_source or "This site can" in page_source or "took too long" in page_source or "DNS" in page_source:
                    self.update_status(f"[Window {page_number}] Proxy failed - window closed. Remaining windows will continue.")
                    driver.quit()
                    continue
            except Exception:
                pass

            # Run automation
            self.update_status(f"[Window {page_number}] Automating...")
            self.perform_automation(driver, page_number)

        if not self._is_stopped():
            self.update_status(f"\n--- Done! All browsers processed. ---")

    def close_all(self):
        """Close all open browser instances and Chrome processes."""
        for driver in self.drivers:
            try:
                driver.quit()
            except Exception:
                pass
        self.drivers = []
        for proc in self.chrome_processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        self.chrome_processes = []


class TeraBoxGUI:
    """Main GUI application for TeraBox automation with dark hacker theme."""

    def __init__(self):
        """Initialize the GUI."""
        self.root = tk.Tk()
        self.root.title("TeraBox Automation Tool")
        self.root.geometry("800x700")
        self.root.resizable(True, True)
        self.root.minsize(800, 600)
        self.root.configure(bg="#0a0a1a")

        # Automation instance
        self.automation = None
        self.is_running = False
        self._stop_event = threading.Event()

        self._setup_gui()

        # Handle window close to clean up Chrome processes
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close)

        # Also register atexit as a safety net
        atexit.register(self._cleanup_on_exit)

    def _on_window_close(self):
        """Handle window close event - stop automation and close browsers."""
        if self.is_running:
            self._stop_event.set()
        if self.automation:
            self.automation.close_all()
        self.root.destroy()

    def _cleanup_on_exit(self):
        """Safety net cleanup called at process exit."""
        if self.automation:
            self.automation.close_all()

    def _setup_gui(self):
        """Set up the GUI layout with rich colorful theme."""
        # Rich vibrant theme colors
        bg_dark = "#0a0a1a"
        bg_frame = "#1a0a2e"
        bg_entry = "#0d1b2a"
        fg_text = "#f0f0ff"
        fg_accent = "#00e5ff"
        fg_purple = "#e040fb"
        fg_green = "#76ff03"
        fg_gold = "#ffd600"
        fg_orange = "#ff6d00"
        fg_pink = "#ff4081"

        # Branding - @codex_here
        brand_label = tk.Label(
            self.root,
            text="@codex_here",
            font=("Consolas", 11, "bold"),
            fg=fg_gold,
            bg=bg_dark,
        )
        brand_label.pack(pady=(10, 0))

        # Title
        title_frame = tk.Frame(self.root, bg=bg_dark, pady=5)
        title_frame.pack(fill=tk.X)

        title_label = tk.Label(
            title_frame,
            text="TeraBox Automation Tool",
            font=("Consolas", 18, "bold"),
            fg=fg_pink,
            bg=bg_dark,
        )
        title_label.pack()

        subtitle_label = tk.Label(
            title_frame,
            text="Log In > Sign Up > Email Selection",
            font=("Consolas", 10),
            fg=fg_gold,
            bg=bg_dark,
        )
        subtitle_label.pack()

        # Input frame
        input_frame = tk.Frame(self.root, bg=bg_frame, pady=10, padx=20)
        input_frame.pack(fill=tk.X, padx=20, pady=5)

        # URL input
        url_label = tk.Label(
            input_frame,
            text="Link (URL):",
            font=("Consolas", 11, "bold"),
            fg=fg_accent,
            bg=bg_frame,
        )
        url_label.pack(anchor=tk.W)

        self.url_entry = tk.Entry(
            input_frame,
            font=("Consolas", 11),
            bg=bg_entry,
            fg=fg_accent,
            insertbackground=fg_accent,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=fg_accent,
        )
        self.url_entry.pack(anchor=tk.W, fill=tk.X, pady=5)
        self.url_entry.insert(0, "https://1024terabox.com/s/1axTeTaTPATdSOQizMrGeJQ")

        pages_label = tk.Label(
            input_frame,
            text=f"Kitne pages open karne hain? (1-{MAX_PAGES}):",
            font=("Consolas", 11, "bold"),
            fg=fg_accent,
            bg=bg_frame,
        )
        pages_label.pack(anchor=tk.W)

        self.pages_entry = tk.Entry(
            input_frame,
            font=("Consolas", 12),
            width=10,
            bg=bg_entry,
            fg=fg_accent,
            insertbackground=fg_accent,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=fg_accent,
        )
        self.pages_entry.pack(anchor=tk.W, pady=5)
        self.pages_entry.insert(0, "20")

        # Proxy checkbox
        self.use_proxy_var = tk.BooleanVar(value=True)
        self.proxy_checkbox = tk.Checkbutton(
            input_frame,
            text="Use Proxy / IP Rotation",
            variable=self.use_proxy_var,
            font=("Consolas", 10, "bold"),
            bg=bg_frame,
            fg=fg_orange,
            selectcolor="#000000",
            activebackground=bg_frame,
        )
        self.proxy_checkbox.pack(anchor=tk.W, pady=(10, 0))

        # Proxy input
        proxy_label = tk.Label(
            input_frame,
            text="Proxies (optional - one per line):",
            font=("Consolas", 11),
            fg=fg_purple,
            bg=bg_frame,
        )
        proxy_label.pack(anchor=tk.W, pady=(10, 0))

        self.proxy_text = tk.Text(
            input_frame,
            height=4,
            font=("Consolas", 9),
            bg="#000000",
            fg="#00ff41",
            insertbackground="#00ff41",
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=fg_accent,
        )
        self.proxy_text.pack(anchor=tk.W, fill=tk.X, pady=5)

        # Buttons frame
        btn_frame = tk.Frame(self.root, bg=bg_dark, pady=10, padx=20)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame,
            text="Start Automation",
            font=("Consolas", 11, "bold"),
            bg="#00e676",
            fg="#000000",
            activebackground="#69f0ae",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._start_automation,
        )
        self.start_btn.pack(side=tk.LEFT, padx=5)

        self.stop_btn = tk.Button(
            btn_frame,
            text="Stop",
            font=("Consolas", 11, "bold"),
            bg="#ff9100",
            fg="#000000",
            activebackground="#ffab40",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._stop_automation,
            state=tk.DISABLED,
        )
        self.stop_btn.pack(side=tk.LEFT, padx=5)

        self.close_btn = tk.Button(
            btn_frame,
            text="Close Browsers",
            font=("Consolas", 11, "bold"),
            bg="#d50000",
            fg="#ffffff",
            activebackground="#ff1744",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._close_browsers,
            state=tk.DISABLED,
        )
        self.close_btn.pack(side=tk.LEFT, padx=5)

        self.restart_btn = tk.Button(
            btn_frame,
            text="Restart (New IPs)",
            font=("Consolas", 11, "bold"),
            bg="#9c27b0",
            fg="#ffffff",
            activebackground="#ab47bc",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._restart_automation,
            state=tk.DISABLED,
        )
        self.restart_btn.pack(side=tk.LEFT, padx=5)

        # Close All Tabs button - always enabled
        self.close_all_btn = tk.Button(
            btn_frame,
            text="Close All Tabs",
            font=("Consolas", 11, "bold"),
            bg="#aa00ff",
            fg="#ffffff",
            activebackground="#d500f9",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._close_all_tabs,
        )
        self.close_all_btn.pack(side=tk.LEFT, padx=5)

        # Status frame
        status_frame = tk.Frame(self.root, bg=bg_dark, pady=5, padx=20)
        status_frame.pack(fill=tk.BOTH, expand=True)

        status_label = tk.Label(
            status_frame,
            text="[ Terminal Output ]",
            font=("Consolas", 10, "bold"),
            fg=fg_accent,
            bg=bg_dark,
        )
        status_label.pack(anchor=tk.W)

        # Text widget with scrollbar for status messages
        text_frame = tk.Frame(status_frame, bg=bg_dark)
        text_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        scrollbar = tk.Scrollbar(text_frame, bg=bg_dark, troughcolor=bg_dark)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        h_scrollbar = tk.Scrollbar(text_frame, orient=tk.HORIZONTAL, bg=bg_dark, troughcolor=bg_dark)
        h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)

        self.status_text = tk.Text(
            text_frame,
            height=18,
            font=("Consolas", 9),
            wrap=tk.NONE,
            state=tk.DISABLED,
            bg="#000000",
            fg=fg_green,
            insertbackground=fg_green,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=fg_accent,
            yscrollcommand=scrollbar.set,
            xscrollcommand=h_scrollbar.set,
        )
        self.status_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.status_text.yview)
        h_scrollbar.config(command=self.status_text.xview)

        # Progress bar with vibrant style
        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "dark.Horizontal.TProgressbar",
            troughcolor=bg_frame,
            background=fg_pink,
            darkcolor=fg_purple,
            lightcolor=fg_accent,
        )
        self.progress = ttk.Progressbar(
            self.root,
            mode="indeterminate",
            length=400,
            style="dark.Horizontal.TProgressbar",
        )
        self.progress.pack(pady=10)

    def _update_status(self, message):
        """
        Update the status text widget (thread-safe).

        Args:
            message: Status message to display
        """
        def _update():
            self.status_text.config(state=tk.NORMAL)
            self.status_text.insert(tk.END, message + "\n")
            self.status_text.see(tk.END)
            self.status_text.config(state=tk.DISABLED)

        self.root.after(0, _update)

    def _start_automation(self):
        """Start the automation in a separate thread."""
        # Validate URL input
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showerror("Error", "Please enter a URL / Link daalo")
            return

        # Validate input
        try:
            num_pages = int(self.pages_entry.get().strip())
            if num_pages < 1:
                raise ValueError("Must be at least 1")
            if num_pages > MAX_PAGES:
                messagebox.showerror(
                    "Error",
                    f"Maximum {MAX_PAGES} pages allowed.\n"
                    f"Zyada se zyada {MAX_PAGES} pages allowed hain.",
                )
                return
        except ValueError:
            messagebox.showerror(
                "Error",
                f"Please enter a valid number (1-{MAX_PAGES}).\n"
                f"Ek valid number daalein (1 se {MAX_PAGES} tak).",
            )
            return

        # Read user-provided proxies (only if checkbox is enabled)
        use_proxy = self.use_proxy_var.get()
        if use_proxy:
            user_proxies = self.proxy_text.get("1.0", tk.END).strip()
            if user_proxies:
                custom_proxies = [p.strip() for p in user_proxies.split('\n') if p.strip()]
            else:
                custom_proxies = "auto"  # signal to fetch from API
        else:
            custom_proxies = None  # no proxy at all

        # Disable start button, enable stop button
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.close_btn.config(state=tk.NORMAL)
        self.restart_btn.config(state=tk.NORMAL)
        self.is_running = True
        self._stop_event.clear()
        self.progress.start(10)

        # Clear previous status
        self.status_text.config(state=tk.NORMAL)
        self.status_text.delete(1.0, tk.END)
        self.status_text.config(state=tk.DISABLED)

        # Create automation instance with status callback and stop event
        self.automation = TeraBoxAutomation(
            status_callback=self._update_status,
            stop_event=self._stop_event,
        )

        # Run automation in a separate thread to keep GUI responsive
        thread = threading.Thread(
            target=self._run_automation_thread,
            args=(num_pages, custom_proxies, url),
            daemon=True,
        )
        thread.start()

    def _stop_automation(self):
        """Stop the running automation."""
        if self.is_running:
            self._stop_event.set()
            self._update_status("\nStopping automation... please wait.")
            self.stop_btn.config(state=tk.DISABLED)

    def _run_automation_thread(self, num_pages, custom_proxies=None, url=None):
        """
        Run the automation in a background thread.

        Args:
            num_pages: Number of browser windows to process
            custom_proxies: Optional list of user-provided proxies
            url: Optional URL to navigate to
        """
        try:
            self.automation.run(num_pages, custom_proxies, url)
        except Exception as e:
            self._update_status(f"Error: {str(e)}")
        finally:
            self.root.after(0, self._on_automation_complete)

    def _on_automation_complete(self):
        """Called when automation completes."""
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.restart_btn.config(state=tk.DISABLED)
        self.is_running = False
        self.progress.stop()
        if self._stop_event.is_set():
            self._update_status("\n--- Automation Stopped ---")
        else:
            self._update_status("\n--- Automation Complete ---")

    def _restart_automation(self):
        """Restart: close all browsers, fetch new proxies, start again."""
        self._update_status("\n--- RESTARTING ---")
        self._update_status("Closing all browsers...")

        # Stop current automation
        if self.is_running:
            self._stop_event.set()
            time.sleep(1)

        # Close all browsers
        if self.automation:
            self.automation.close_all()

        # Kill all Chrome processes
        try:
            import subprocess as sp
            if os.name == 'nt':
                sp.run(['taskkill', '/F', '/IM', 'chrome.exe'],
                             capture_output=True, timeout=5)
                sp.run(['taskkill', '/F', '/IM', 'chromedriver.exe'],
                             capture_output=True, timeout=5)
        except Exception:
            pass

        self._update_status("All browsers closed!")
        self._update_status("Waiting 2 seconds... then starting with NEW IPs")

        # Reset state
        self.is_running = False
        self._stop_event.clear()
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.progress.stop()

        # Wait then auto-start
        self.root.after(2000, self._start_automation)

    def _close_browsers(self):
        """Close all open browser instances."""
        if self.automation:
            self.automation.close_all()
            self._update_status("All browsers closed.")
        self.close_btn.config(state=tk.DISABLED)

    def _close_all_tabs(self):
        """Close all open browser tabs/instances and kill Chrome processes."""
        if self.automation:
            self.automation.close_all()
            self._update_status("All tabs/browsers closed.")
        # Also kill any remaining Chrome processes
        try:
            import subprocess
            if os.name == 'nt':
                subprocess.run(['taskkill', '/F', '/IM', 'chrome.exe'], 
                             capture_output=True, timeout=5)
                subprocess.run(['taskkill', '/F', '/IM', 'chromedriver.exe'], 
                             capture_output=True, timeout=5)
            else:
                subprocess.run(['pkill', '-f', 'chrome'], 
                             capture_output=True, timeout=5)
            self._update_status("All Chrome processes killed.")
        except Exception:
            pass
        self.close_btn.config(state=tk.DISABLED)
        if self.is_running:
            self._stop_event.set()
            self.is_running = False
            self.start_btn.config(state=tk.NORMAL)
            self.stop_btn.config(state=tk.DISABLED)
            self.progress.stop()

    def run(self):
        """Start the GUI main loop."""
        self._update_status("Ready! Enter the number of pages and click Start.")
        self._update_status(
            "Tayyar! Pages ki number daalein aur Start dabayein."
        )
        self._update_status(f"(Maximum {MAX_PAGES} pages allowed)")
        self._update_status("")
        self._update_status(
            "Method: Separate Chrome windows (right half, stacked)"
        )
        self.root.mainloop()


def main():
    """Main entry point."""
    app = TeraBoxGUI()
    app.run()


if __name__ == "__main__":
    main()
