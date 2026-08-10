"""
TeraBox Auto Close Tool
-----------------------
A GUI tool that opens multiple browsers simultaneously,
keeps them open for a random duration, then auto-closes them.
New browsers open to maintain the configured concurrent count.

@codex_here
"""

import atexit
import os
import random
import shutil
import subprocess
import threading
import time
import sys
import uuid


def _check_help():
    """Show help text and exit if --help or -h is passed."""
    if "--help" in sys.argv or "-h" in sys.argv:
        print("TeraBox Auto Close Tool")
        print("=" * 40)
        print()
        print("Usage: python autoclose.py")
        print()
        print("Opens browsers with random auto-close timers.")
        print("Random close times: 10s, 15s, 25s, 30s, or 60s")
        print()
        print("Requirements:")
        print("  - Python 3.7+")
        print("  - Google Chrome browser installed")
        print("  - selenium (pip install selenium)")
        print("  - pyautogui (pip install pyautogui)")
        print("  - tkinter (usually included with Python)")
        sys.exit(0)


_check_help()

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    print("Error: tkinter is not installed.")
    sys.exit(1)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
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
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False


# Target URL
TERABOX_URL = "https://1024terabox.com/s/1axTeTaTPATdSOQizMrGeJQ"

# Tier 1 countries for high quality proxy IPs (80% premium traffic)
PROXY_COUNTRIES = "US,GB,CA,AU,DE,FR,NL,JP,KR,SE,NO,DK,CH,NZ,AT,BE,FI,IE,SG"

# Remote debugging base port
DEBUG_PORT_BASE = 9222

# Timeouts
SELECTOR_TIMEOUT = 3
PAGE_LOAD_TIMEOUT = 30
ACTION_DELAY = 0.5

# Random close times in seconds
RANDOM_CLOSE_TIMES = [10, 15, 25, 30, 60]


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
    try:
        result = subprocess.run(
            ["where", "chrome"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")[0].strip()
    except Exception:
        pass
    return "chrome.exe"


class TeraBoxAutoClose:
    """Handles browser auto-close automation for TeraBox."""

    def __init__(self, status_callback=None, stop_event=None):
        self.status_callback = status_callback or print
        self.stop_event = stop_event or threading.Event()
        self.chrome_processes = []
        self.drivers = []
        self.active_windows = []
        self.proxies = []
        self.proxy_index = 0
        self.port_counter = 0

    def _is_stopped(self):
        """Check if the stop event has been set."""
        return self.stop_event.is_set()

    def update_status(self, message):
        """Send status update to callback."""
        self.status_callback(message)

    def _fetch_proxies(self):
        """Fetch free HTTP proxy list."""
        self.update_status("Fetching Tier 1 country proxies (US,GB,CA,AU,DE,FR,NL,JP,KR...)...")
        proxies = []
        try:
            import urllib.request
            apis = [
                f"https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country={PROXY_COUNTRIES}&ssl=all&anonymity=all",
            ]
            for api_url in apis:
                try:
                    req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
                    response = urllib.request.urlopen(req, timeout=10)
                    data = response.read().decode('utf-8')
                    for line in data.strip().split('\n'):
                        line = line.strip()
                        if ':' in line and line[0].isdigit():
                            proxies.append(line)
                except Exception:
                    continue
        except Exception:
            pass
        random.shuffle(proxies)
        return proxies

    def _test_proxy(self, proxy):
        """Test if proxy can reach TeraBox (2 second timeout)."""
        try:
            import urllib.request
            proxy_handler = urllib.request.ProxyHandler({
                'http': f'http://{proxy}',
                'https': f'http://{proxy}'
            })
            opener = urllib.request.build_opener(proxy_handler)
            req = urllib.request.Request(
                'https://www.terabox.app',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            response = opener.open(req, timeout=2)
            return response.status == 200
        except Exception:
            return False

    def _parse_proxy_string(self, proxy_str):
        """Parse proxy string in format ip:port:user:pass or ip:port."""
        parts = proxy_str.strip().split(":")
        if len(parts) == 4:
            # Format: ip:port:user:pass
            ip, port, user, password = parts
            return f"{user}:{password}@{ip}:{port}"
        elif len(parts) == 2:
            # Format: ip:port
            return proxy_str.strip()
        else:
            return proxy_str.strip()

    def _get_random_fingerprint(self):
        """Generate random browser fingerprint for each instance."""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        ]
        screen_resolutions = [
            (1920, 1080), (1366, 768), (1536, 864), (1440, 900),
            (1280, 720), (1600, 900), (2560, 1440), (1280, 1024),
        ]
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
        return {
            "user_agent": random.choice(user_agents),
            "screen": random.choice(screen_resolutions),
            "webgl_vendor": random.choice(webgl_vendors),
            "webgl_renderer": random.choice(webgl_renderers),
            "language": random.choice(languages),
            "platform": random.choice(platforms),
            "timezone": random.choice(timezones),
            "hardware_concurrency": random.choice([2, 4, 6, 8, 12, 16]),
            "device_memory": random.choice([2, 4, 8, 16, 32]),
        }

    def _get_next_port(self):
        """Get next available debugging port."""
        port = DEBUG_PORT_BASE + self.port_counter
        self.port_counter += 1
        return port

    def launch_chrome_subprocess(self, url, debug_port, user_agent=None, language=None, proxy=None):
        """
        Launch Chrome via subprocess with remote debugging enabled.
        Uses UUID-based user-data-dir so each Chrome is truly independent.
        """
        chrome_path = find_chrome_path()

        # Create unique user data dir with UUID
        temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
        user_data_dir = os.path.join(temp_dir, f"chrome_{uuid.uuid4().hex[:8]}")

        if os.path.exists(user_data_dir):
            try:
                shutil.rmtree(user_data_dir)
            except Exception:
                pass
        os.makedirs(user_data_dir, exist_ok=True)

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
        ]

        if user_agent:
            args.append(f"--user-agent={user_agent}")
        if language:
            args.append(f"--lang={language}")
        if proxy:
            args.append(f"--proxy-server={proxy}")

        args.append(url)

        try:
            process = subprocess.Popen(
                args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.chrome_processes.append(process)
            return process, user_data_dir
        except FileNotFoundError:
            self.update_status(
                f"ERROR: Chrome not found at '{chrome_path}'."
            )
            return None, user_data_dir
        except Exception as e:
            self.update_status(f"ERROR launching Chrome: {str(e)}")
            return None, user_data_dir

    def connect_selenium_to_chrome(self, debug_port, max_retries=3):
        """Connect Selenium to running Chrome via remote debugging."""
        if not HAS_SELENIUM:
            self.update_status("Selenium not installed.")
            return None

        for attempt in range(1, max_retries + 1):
            if self._is_stopped():
                return None
            try:
                chrome_options = Options()
                chrome_options.add_experimental_option(
                    "debuggerAddress", f"127.0.0.1:{debug_port}"
                )
                driver = webdriver.Chrome(options=chrome_options)
                driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
                return driver
            except Exception as e:
                if attempt < max_retries:
                    time.sleep(1)
        return None

    def _check_error_page(self, driver):
        """Check if page has connection error."""
        try:
            page_source = driver.page_source
            if "ERR_" in page_source or "This site can" in page_source or "DNS" in page_source or "took too long" in page_source:
                return True
        except Exception:
            return True
        return False

    def _find_element(self, driver, selectors, step_name, page_number):
        """Try each selector with a short timeout to find a clickable element."""
        for by, selector in selectors:
            if self._is_stopped():
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
        Perform the automation flow: Click Log In -> Sign Up -> Email
        """
        try:
            if self._is_stopped():
                return False

            time.sleep(2)

            # Check for error page
            if self._check_error_page(driver):
                self.update_status(f"[Window {page_number}] Error page detected - closing immediately")
                return False

            if self._is_stopped():
                return False

            # Step 1: Click "Login" button
            self.update_status(f"[Window {page_number}] Looking for Login button...")
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

            sign_in_btn = self._find_element(driver, selectors_sign_in, "Login", page_number)
            if self._is_stopped():
                return False

            if sign_in_btn:
                sign_in_btn.click()
                self.update_status(f"[Window {page_number}] Clicked Login!")
                time.sleep(1)
            else:
                self.update_status(f"[Window {page_number}] Login button not found.")
                return False

            if self._is_stopped():
                return False

            # Step 2: Click "Sign up" tab
            self.update_status(f"[Window {page_number}] Looking for Sign up tab...")
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

            sign_up_btn = self._find_element(driver, selectors_sign_up, "Sign Up", page_number)
            if self._is_stopped():
                return False

            if sign_up_btn:
                sign_up_btn.click()
                self.update_status(f"[Window {page_number}] Clicked Sign Up!")
                time.sleep(1)
            else:
                self.update_status(f"[Window {page_number}] Sign Up button not found.")
                return False

            if self._is_stopped():
                return False

            # Step 3: Click Email icon
            self.update_status(f"[Window {page_number}] Looking for Email icon...")
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

            email_btn = self._find_element(driver, selectors_email, "Email", page_number)
            if self._is_stopped():
                return False

            if email_btn:
                email_btn.click()
                self.update_status(f"[Window {page_number}] Clicked Email option! Done.")
                time.sleep(ACTION_DELAY)
            else:
                self.update_status(f"[Window {page_number}] Email option not found.")
                return False

            return True

        except Exception as e:
            self.update_status(f"[Window {page_number}] Error: {str(e)}")
            return False

    def _open_single_window(self, url, page_number, proxy=None):
        """Open a single browser window and return window info."""
        fingerprint = self._get_random_fingerprint()
        port = self._get_next_port()

        process, user_data_dir = self.launch_chrome_subprocess(
            url, port, fingerprint["user_agent"],
            fingerprint["language"], proxy
        )
        if process is None:
            return None

        # Snap to right half
        time.sleep(1)
        if HAS_PYAUTOGUI:
            pyautogui.hotkey("win", "right")
            time.sleep(0.3)

        # Connect selenium
        driver = self.connect_selenium_to_chrome(port)
        if driver is None:
            self.update_status(f"[Window {page_number}] Selenium connection failed, skipping.")
            try:
                process.terminate()
            except Exception:
                pass
            return None

        self.drivers.append(driver)

        # Inject fingerprint spoof
        spoof_script = f"""
Object.defineProperty(navigator, 'platform', {{get: () => '{fingerprint['platform']}'}});
Object.defineProperty(navigator, 'hardwareConcurrency', {{get: () => {fingerprint['hardware_concurrency']}}});
Object.defineProperty(navigator, 'deviceMemory', {{get: () => {fingerprint['device_memory']}}});
Object.defineProperty(navigator, 'languages', {{get: () => ['{fingerprint['language']}', 'en']}});
"""
        try:
            driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': spoof_script})
        except Exception:
            pass

        # Zoom out 80%
        try:
            driver.execute_script("document.body.style.zoom='80%'")
        except Exception:
            pass

        # Check for error page immediately
        if self._check_error_page(driver):
            self.update_status(f"[Window {page_number}] Error page detected - closing immediately")
            try:
                driver.quit()
            except Exception:
                pass
            try:
                process.terminate()
            except Exception:
                pass
            return None

        # Run automation (Login > Sign Up > Email)
        self.perform_automation(driver, page_number)

        # Assign random close time
        close_seconds = random.choice(RANDOM_CLOSE_TIMES)
        close_time = time.time() + close_seconds
        self.update_status(f"[Window {page_number}] Opened - will close in {close_seconds} seconds")

        return {
            "driver": driver,
            "process": process,
            "close_time": close_time,
            "close_seconds": close_seconds,
            "page_number": page_number,
            "user_data_dir": user_data_dir,
            "port": port,
        }

    def _close_window(self, window_info):
        """Close a single browser window and clean up."""
        try:
            window_info["driver"].quit()
        except Exception:
            pass
        try:
            window_info["process"].terminate()
            window_info["process"].wait(timeout=5)
        except Exception:
            try:
                window_info["process"].kill()
            except Exception:
                pass
        # Clean up user data dir
        try:
            if os.path.exists(window_info["user_data_dir"]):
                shutil.rmtree(window_info["user_data_dir"], ignore_errors=True)
        except Exception:
            pass

    def run(self, total_pages, open_at_once, custom_proxies=None, url=None):
        """
        Run the auto-close automation.
        Opens browsers, keeps them for random time, closes, opens new ones.
        """
        target_url = url or TERABOX_URL
        self.update_status(f"Starting Auto Close automation...")
        self.update_status(f"Total pages: {total_pages} | Open at once: {open_at_once}")
        self.update_status(f"Random close times: {RANDOM_CLOSE_TIMES} seconds")
        self.update_status("")

        # Handle proxies
        if custom_proxies == "auto":
            self.update_status("Fetching HTTP proxies...")
            self.proxies = self._fetch_proxies()
            if self.proxies:
                total_to_test = min(30, len(self.proxies))
                self.update_status(f"Testing {total_to_test} proxies against TeraBox...")
                working = []
                for idx, p in enumerate(self.proxies[:30], 1):
                    if self._is_stopped():
                        break
                    self.update_status(f"  Testing [{idx}/{total_to_test}]: {p}...")
                    if self._test_proxy(p):
                        working.append(p)
                        self.update_status(f"  WORKING: {p}")
                        if len(working) >= 10:
                            break
                    else:
                        self.update_status(f"  DEAD: {p}")
                self.proxies = working if working else []
                if self.proxies:
                    self.update_status(f"\n{len(self.proxies)} working proxies found!")
                else:
                    self.update_status("\nNo working proxies found! Using direct connection.")
            else:
                self.update_status("No proxies found - direct connection")
        elif custom_proxies and isinstance(custom_proxies, list):
            self.proxies = custom_proxies
            self.update_status(f"Using {len(self.proxies)} custom proxies (each browser gets different IP)")
        else:
            self.proxies = []
            self.update_status("Proxy disabled - direct connection")

        self.update_status("")

        processed = 0
        self.active_windows = []

        # Phase 1: Open first batch
        self.update_status(f"--- Phase 1: Opening first {open_at_once} windows ---")
        for i in range(min(open_at_once, total_pages)):
            if self._is_stopped():
                break
            processed += 1
            proxy = None
            if self.proxies:
                proxy = self.proxies[(processed - 1) % len(self.proxies)]
            window_info = self._open_single_window(target_url, processed, proxy)
            if window_info:
                self.active_windows.append(window_info)

        self.update_status(f"\n--- Phase 2: Monitor loop (closing and replacing) ---")
        self.update_status(f"Active: {len(self.active_windows)} | Processed: {processed}/{total_pages} | Remaining: {total_pages - processed}")
        self.update_status("")

        # Phase 2: Monitor loop
        while self.active_windows and not self._is_stopped():
            windows_to_close = []

            # Check timers
            current_time = time.time()
            for window_info in self.active_windows:
                if current_time >= window_info["close_time"]:
                    windows_to_close.append(window_info)

            # Also check for error pages
            for window_info in self.active_windows:
                if window_info not in windows_to_close:
                    try:
                        if self._check_error_page(window_info["driver"]):
                            self.update_status(f"[Window {window_info['page_number']}] Error page detected - closing immediately")
                            windows_to_close.append(window_info)
                    except Exception:
                        windows_to_close.append(window_info)

            # Close expired/error windows and open replacements
            for window_info in windows_to_close:
                if self._is_stopped():
                    break
                self.update_status(f"[Window {window_info['page_number']}] Timer expired ({window_info['close_seconds']}s) - closing...")
                self._close_window(window_info)
                self.active_windows.remove(window_info)

                # Open replacement if we still have pages to process
                if processed < total_pages and not self._is_stopped():
                    processed += 1
                    proxy = None
                    if self.proxies:
                        proxy = self.proxies[(processed - 1) % len(self.proxies)]
                    self.update_status(f"[Window {processed}] Opening replacement...")
                    new_window = self._open_single_window(target_url, processed, proxy)
                    if new_window:
                        self.active_windows.append(new_window)

                self.update_status(f"Active: {len(self.active_windows)} | Processed: {processed}/{total_pages} | Remaining: {total_pages - processed}")

            time.sleep(1)

        if not self._is_stopped():
            self.update_status(f"\n--- Done! All {total_pages} pages processed. ---")

    def close_all(self):
        """Close all open browser instances."""
        for window_info in self.active_windows:
            self._close_window(window_info)
        self.active_windows = []
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


class AutoCloseGUI:
    """Main GUI application for TeraBox Auto Close with dark hacker theme."""

    def __init__(self):
        """Initialize the GUI."""
        self.root = tk.Tk()
        self.root.title("TeraBox Auto Close Tool")
        self.root.geometry("750x750")
        self.root.resizable(True, True)
        self.root.configure(bg="#0f0f0f")

        self.automation = None
        self.is_running = False
        self._stop_event = threading.Event()

        self._setup_gui()

        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close)
        atexit.register(self._cleanup_on_exit)

    def _on_window_close(self):
        """Handle window close event."""
        if self.is_running:
            self._stop_event.set()
        if self.automation:
            self.automation.close_all()
        self.root.destroy()

    def _cleanup_on_exit(self):
        """Safety net cleanup at process exit."""
        if self.automation:
            self.automation.close_all()

    def _setup_gui(self):
        """Set up the GUI layout with dark hacker theme."""
        bg_dark = "#0f0f0f"
        bg_frame = "#1a1a2e"
        bg_entry = "#16213e"
        fg_text = "#f0f0ff"
        fg_accent = "#00fff5"
        fg_purple = "#bf00ff"
        fg_green = "#00ff41"
        fg_gold = "#ffd600"

        # Branding - @codex_here
        brand_label = tk.Label(
            self.root,
            text="@codex_here",
            font=("Consolas", 11, "bold"),
            fg=fg_accent,
            bg=bg_dark,
        )
        brand_label.pack(pady=(10, 0))

        # Title
        title_frame = tk.Frame(self.root, bg=bg_dark, pady=5)
        title_frame.pack(fill=tk.X)

        title_label = tk.Label(
            title_frame,
            text="TeraBox Auto Close Tool",
            font=("Consolas", 18, "bold"),
            fg=fg_accent,
            bg=bg_dark,
        )
        title_label.pack()

        subtitle_label = tk.Label(
            title_frame,
            text="Random Timer Auto Close",
            font=("Consolas", 10),
            fg=fg_purple,
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

        # Total Pages
        pages_label = tk.Label(
            input_frame,
            text="Total Pages:",
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
        self.pages_entry.insert(0, "100")

        # Open At Once
        once_label = tk.Label(
            input_frame,
            text="Open At Once:",
            font=("Consolas", 11, "bold"),
            fg=fg_accent,
            bg=bg_frame,
        )
        once_label.pack(anchor=tk.W)

        self.once_entry = tk.Entry(
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
        self.once_entry.pack(anchor=tk.W, pady=5)
        self.once_entry.insert(0, "10")

        # Proxy checkbox
        self.use_proxy_var = tk.BooleanVar(value=False)
        self.proxy_checkbox = tk.Checkbutton(
            input_frame,
            text="Use Proxy / IP Rotation",
            variable=self.use_proxy_var,
            font=("Consolas", 10, "bold"),
            bg=bg_frame,
            fg="#ff6d00",
            selectcolor="#000000",
            activebackground=bg_frame,
        )
        self.proxy_checkbox.pack(anchor=tk.W, pady=(10, 0))

        # Proxy input
        proxy_label = tk.Label(
            input_frame,
            text="Proxies (optional - one per line, format: ip:port:user:pass):",
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
        btn_frame = tk.Frame(self.root, bg="#0f0f0f", pady=10, padx=20)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame,
            text="Start",
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
            text="Close All",
            font=("Consolas", 11, "bold"),
            bg="#d50000",
            fg="#ffffff",
            activebackground="#ff1744",
            padx=15,
            pady=5,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._close_all,
        )
        self.close_btn.pack(side=tk.LEFT, padx=5)

        # Status frame
        status_frame = tk.Frame(self.root, bg="#0f0f0f", pady=5, padx=20)
        status_frame.pack(fill=tk.BOTH, expand=True)

        status_label = tk.Label(
            status_frame,
            text="[ Terminal Output ]",
            font=("Consolas", 10, "bold"),
            fg="#00fff5",
            bg="#0f0f0f",
        )
        status_label.pack(anchor=tk.W)

        text_frame = tk.Frame(status_frame, bg="#0f0f0f")
        text_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        scrollbar = tk.Scrollbar(text_frame, bg="#0f0f0f", troughcolor="#0f0f0f")
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.status_text = tk.Text(
            text_frame,
            height=12,
            font=("Consolas", 9),
            wrap=tk.WORD,
            state=tk.DISABLED,
            bg="#000000",
            fg="#00ff41",
            insertbackground="#00ff41",
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor="#00fff5",
            yscrollcommand=scrollbar.set,
        )
        self.status_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.status_text.yview)

    def _update_status(self, message):
        """Update the status text widget (thread-safe)."""
        def _update():
            self.status_text.config(state=tk.NORMAL)
            self.status_text.insert(tk.END, message + "\n")
            self.status_text.see(tk.END)
            self.status_text.config(state=tk.DISABLED)
        self.root.after(0, _update)

    def _start_automation(self):
        """Start the automation in a separate thread."""
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showerror("Error", "Please enter a URL")
            return

        try:
            total_pages = int(self.pages_entry.get().strip())
            if total_pages < 1:
                raise ValueError("Must be at least 1")
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid number for Total Pages.")
            return

        try:
            open_at_once = int(self.once_entry.get().strip())
            if open_at_once < 1:
                raise ValueError("Must be at least 1")
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid number for Open At Once.")
            return

        # Read proxies
        use_proxy = self.use_proxy_var.get()
        if use_proxy:
            user_proxies = self.proxy_text.get("1.0", tk.END).strip()
            if user_proxies:
                custom_proxies = [p.strip() for p in user_proxies.split("\n") if p.strip()]
            else:
                custom_proxies = "auto"
        else:
            custom_proxies = None

        # Update UI state
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.is_running = True
        self._stop_event.clear()

        # Clear status
        self.status_text.config(state=tk.NORMAL)
        self.status_text.delete(1.0, tk.END)
        self.status_text.config(state=tk.DISABLED)

        # Create automation instance
        self.automation = TeraBoxAutoClose(
            status_callback=self._update_status,
            stop_event=self._stop_event,
        )

        # Parse proxy format if custom proxies provided
        if isinstance(custom_proxies, list):
            custom_proxies = [self.automation._parse_proxy_string(p) for p in custom_proxies]

        thread = threading.Thread(
            target=self._run_automation_thread,
            args=(total_pages, open_at_once, custom_proxies, url),
            daemon=True,
        )
        thread.start()

    def _stop_automation(self):
        """Stop the running automation."""
        if self.is_running:
            self._stop_event.set()
            self._update_status("\nStopping automation... please wait.")
            self.stop_btn.config(state=tk.DISABLED)

    def _run_automation_thread(self, total_pages, open_at_once, custom_proxies=None, url=None):
        """Run automation in background thread."""
        try:
            self.automation.run(total_pages, open_at_once, custom_proxies, url)
        except Exception as e:
            self._update_status(f"Error: {str(e)}")
        finally:
            self.root.after(0, self._on_automation_complete)

    def _on_automation_complete(self):
        """Called when automation completes."""
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.is_running = False
        if self._stop_event.is_set():
            self._update_status("\n--- Automation Stopped ---")
        else:
            self._update_status("\n--- Automation Complete ---")

    def _close_all(self):
        """Close all open browsers and kill Chrome."""
        if self.automation:
            self.automation.close_all()
            self._update_status("All browsers closed.")
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"],
                             capture_output=True, timeout=5)
                subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe"],
                             capture_output=True, timeout=5)
            else:
                subprocess.run(["pkill", "-f", "chrome"],
                             capture_output=True, timeout=5)
            self._update_status("All Chrome processes killed.")
        except Exception:
            pass
        if self.is_running:
            self._stop_event.set()
            self.is_running = False
            self.start_btn.config(state=tk.NORMAL)
            self.stop_btn.config(state=tk.DISABLED)

    def run(self):
        """Start the GUI main loop."""
        self._update_status("Ready! Configure settings and click Start.")
        self._update_status("Random close times: 10s, 15s, 25s, 30s, or 60s")
        self._update_status("Each browser gets a different IP (if proxy enabled)")
        self._update_status("Proxy format: ip:port:user:pass (one per line)")
        self._update_status("")
        self.root.mainloop()


def main():
    """Main entry point."""
    app = AutoCloseGUI()
    app.run()


if __name__ == "__main__":
    main()
