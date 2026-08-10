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
        print("Random close times: 30-120 seconds")
        print()
        print("Requirements:")
        print("  - Python 3.7+")
        print("  - Google Chrome browser installed")
        print("  - selenium (pip install selenium)")
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
    from selenium.common.exceptions import WebDriverException
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

try:
    import pyautogui
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False

# Target URL
TERABOX_URL = "https://viiukuhe.com/dc/?blockID=402321"

# Tier 1 countries for high quality proxy IPs (80% premium traffic)
PROXY_COUNTRIES = "US,GB,CA,AU,DE,FR,NL,JP,KR,SE,NO,DK,CH,NZ,AT,BE,FI,IE,SG"

# Remote debugging base port
DEBUG_PORT_BASE = 9222

# Timeouts
PAGE_LOAD_TIMEOUT = 30

# Referrer URLs for spoofing (makes traffic look like it comes from real sources)
REFERRER_URLS = [
    # Google search queries (organic)
    "https://www.google.com/search?q=terabox+download",
    "https://www.google.com/search?q=free+cloud+storage",
    "https://www.google.com/search?q=file+sharing+online",
    "https://www.google.com/search?q=terabox+free+1tb",
    "https://www.google.com/search?q=download+large+files+free",
    "https://www.google.com/",
    # Bing search
    "https://www.bing.com/search?q=terabox+download",
    "https://www.bing.com/search?q=free+cloud+storage+1tb",
    # Yahoo search
    "https://search.yahoo.com/search?p=terabox+file+sharing",
    "https://search.yahoo.com/search?p=free+cloud+storage",
    # Social media
    "https://www.facebook.com/",
    "https://www.youtube.com/redirect?q=terabox",
    "https://www.reddit.com/r/DataHoarder/",
    "https://www.reddit.com/r/CloudStorage/",
    "https://www.tiktok.com/",
    "https://www.instagram.com/",
    "https://t.me/",
    "https://www.pinterest.com/",
    # Direct traffic (empty referrers)
    "",
    "",
    "",
]


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
            "--no-service-autorun",
            "--password-store=basic",
            "--disable-blink-features=AutomationControlled",
            "--disable-ipc-flooding-protection",
            "--disable-background-networking",
            "--disable-client-side-phishing-detection",
            "--disable-default-apps",
            "--disable-hang-monitor",
            "--disable-prompt-on-repost",
            "--metrics-recording-only",
            "--safebrowsing-disable-auto-update",
            "--disable-features=SafeBrowsing",
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

    def _handle_captcha(self, driver, page_number):
        """Check for CAPTCHA/Cloudflare challenge and wait for auto-resolve."""
        try:
            page_source = driver.page_source.lower()
            captcha_keywords = ["captcha", "cloudflare", "turnstile", "hcaptcha", "challenge-platform", "cf-browser-verification", "ray id"]
            detected = any(keyword in page_source for keyword in captcha_keywords)
            if detected:
                self.update_status(f"[Window {page_number}] CAPTCHA/Cloudflare challenge detected - waiting up to 30s for auto-resolve...")
                # Wait up to 30 seconds for CAPTCHA to auto-resolve
                for _ in range(30):
                    time.sleep(1)
                    if self._is_stopped():
                        return False
                    try:
                        page_source = driver.page_source.lower()
                        if not any(keyword in page_source for keyword in captcha_keywords):
                            self.update_status(f"[Window {page_number}] CAPTCHA resolved successfully!")
                            return True
                    except Exception:
                        return False
                # CAPTCHA not resolved after 30 seconds
                self.update_status(f"[Window {page_number}] CAPTCHA not resolved after 30s - closing window")
                return False
        except Exception:
            return True
        return True

    def _accept_cookies(self, driver, page_number):
        """Click cookie accept buttons to dismiss cookie banners."""
        try:
            cookie_selectors = [
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]",
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'i agree')]",
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'got it')]",
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'ok')]",
                "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]",
                "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'i agree')]",
                "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'got it')]",
            ]
            for xpath in cookie_selectors:
                try:
                    elements = driver.find_elements(By.XPATH, xpath)
                    for el in elements:
                        if el.is_displayed():
                            el.click()
                            self.update_status(f"[Window {page_number}] Cookie banner accepted")
                            time.sleep(random.uniform(0.5, 1.5))
                            return
                except Exception:
                    continue
        except Exception:
            pass

    def _simulate_ad_engagement(self, driver, page_number):
        """Simulate real ad interaction to make traffic look genuine to Adsterra."""
        try:
            # Wait 3-6 seconds for ads to load
            time.sleep(random.uniform(3, 6))

            # Smooth scroll 3-7 times with random amounts (150-350px)
            scroll_times = random.randint(3, 7)
            for _ in range(scroll_times):
                scroll_amount = random.randint(150, 350)
                driver.execute_script(
                    f"window.scrollBy({{top: {scroll_amount}, behavior: 'smooth'}})"
                )
                time.sleep(random.uniform(0.8, 1.5))

            # Pause 2-5 seconds to "read"
            time.sleep(random.uniform(2, 5))

            # Scroll back up sometimes (40% chance)
            if random.random() < 0.4:
                scroll_back = random.randint(150, 350)
                driver.execute_script(
                    f"window.scrollBy({{top: -{scroll_back}, behavior: 'smooth'}})"
                )
                time.sleep(random.uniform(1, 2))

            # Dispatch mousemove events on the page
            for _ in range(random.randint(3, 6)):
                x = random.randint(100, 1200)
                y = random.randint(100, 700)
                driver.execute_script(f"""
                    var evt = new MouseEvent('mousemove', {{
                        clientX: {x},
                        clientY: {y},
                        bubbles: true
                    }});
                    document.dispatchEvent(evt);
                """)
                time.sleep(random.uniform(0.3, 0.8))

            # Trigger visibilitychange, mousemove, touchstart events
            driver.execute_script("""
                document.dispatchEvent(new Event('visibilitychange'));
                document.dispatchEvent(new MouseEvent('mousemove', {
                    clientX: Math.random() * window.innerWidth,
                    clientY: Math.random() * window.innerHeight,
                    bubbles: true
                }));
                document.dispatchEvent(new TouchEvent('touchstart', {
                    bubbles: true,
                    cancelable: true
                }));
            """)
            time.sleep(random.uniform(0.5, 1.0))

            # Final scroll to 80% of page
            driver.execute_script(
                "window.scrollTo({top: document.body.scrollHeight * 0.8, behavior: 'smooth'})"
            )
            time.sleep(random.uniform(1, 2))

            self.update_status(f"[Window {page_number}] Ad engagement simulation complete")
        except Exception:
            pass

    def _simulate_human_behavior(self, driver, page_number):
        """Simulate real human behavior on the page."""
        try:
            # Random initial wait (humans don't interact instantly)
            time.sleep(random.uniform(1, 3))

            # Random scroll down slowly (like reading)
            scroll_times = random.randint(2, 5)
            for _ in range(scroll_times):
                scroll_amount = random.randint(100, 400)
                driver.execute_script(f"window.scrollBy(0, {scroll_amount})")
                time.sleep(random.uniform(0.5, 2))

            # Sometimes scroll back up
            if random.random() > 0.5:
                driver.execute_script(f"window.scrollBy(0, -{random.randint(100, 300)})")
                time.sleep(random.uniform(0.5, 1.5))

            # Random mouse movements (if pyautogui available)
            if HAS_PYAUTOGUI:
                try:
                    for _ in range(random.randint(1, 3)):
                        x = random.randint(400, 1200)
                        y = random.randint(200, 700)
                        pyautogui.moveTo(x, y, duration=random.uniform(0.3, 1.0))
                        time.sleep(random.uniform(0.3, 1.0))
                except Exception:
                    pass

            # Sometimes hover over random elements
            try:
                elements = driver.find_elements(By.TAG_NAME, "a")
                if elements:
                    random_element = random.choice(elements[:10])
                    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", random_element)
                    time.sleep(random.uniform(0.5, 1.5))
            except Exception:
                pass

        except Exception:
            pass

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

        # Check if page loaded properly (wait max 10 seconds)
        try:
            time.sleep(5)  # wait for page to load
            current_url = driver.current_url
            page_source = driver.page_source

            # If page is blank or has error
            if current_url in ("data:,", "about:blank", "chrome-error://"):
                self.update_status(f"[Window {page_number}] Page not loaded - closing...")
                self.fail_count += 1
                driver.quit()
                process.terminate()
                return None

            if "ERR_" in page_source or "This site can" in page_source or "took too long" in page_source or "DNS" in page_source or "refused" in page_source:
                self.update_status(f"[Window {page_number}] Load error - closing...")
                self.fail_count += 1
                driver.quit()
                process.terminate()
                return None

            if len(page_source) < 100:
                self.update_status(f"[Window {page_number}] Empty page - closing...")
                self.fail_count += 1
                driver.quit()
                process.terminate()
                return None

        except Exception as e:
            self.update_status(f"[Window {page_number}] Error checking page - closing...")
            self.fail_count += 1
            try:
                driver.quit()
                process.terminate()
            except Exception:
                pass
            return None

        # Inject fingerprint spoof
        spoof_script = f"""
Object.defineProperty(navigator, 'webdriver', {{get: () => false}});
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
window.chrome = {{
    runtime: {{}},
    loadTimes: function() {{
        return {{
            commitLoadTime: Date.now() / 1000 - Math.random() * 2,
            connectionInfo: "h2",
            finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
            finishLoadTime: Date.now() / 1000 - Math.random() * 0.5,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: Date.now() / 1000 - Math.random() * 1.5,
            navigationType: "Other",
            npnNegotiatedProtocol: "h2",
            requestTime: Date.now() / 1000 - Math.random() * 3,
            startLoadTime: Date.now() / 1000 - Math.random() * 2.5,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true
        }};
    }},
    csi: function() {{
        return {{
            onloadT: Date.now(),
            startE: Date.now() - Math.floor(Math.random() * 1000),
            pageT: Math.floor(Math.random() * 5000) + 1000,
            tran: 15
        }};
    }}
}};
Object.defineProperty(navigator, 'platform', {{get: () => '{fingerprint['platform']}'}});
Object.defineProperty(navigator, 'hardwareConcurrency', {{get: () => {fingerprint['hardware_concurrency']}}});
Object.defineProperty(navigator, 'deviceMemory', {{get: () => {fingerprint['device_memory']}}});
Object.defineProperty(navigator, 'languages', {{get: () => ['{fingerprint['language']}', 'en']}});

// Spoof navigator.plugins
Object.defineProperty(navigator, 'plugins', {{
    get: () => {{
        const pluginData = [
            {{name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format'}},
            {{name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: ''}},
            {{name: 'Native Client', filename: 'internal-nacl-plugin', description: ''}}
        ];
        const plugins = pluginData.map(p => {{
            const plugin = Object.create(Plugin.prototype);
            Object.defineProperties(plugin, {{
                name: {{value: p.name, enumerable: true}},
                filename: {{value: p.filename, enumerable: true}},
                description: {{value: p.description, enumerable: true}},
                length: {{value: 1, enumerable: true}}
            }});
            return plugin;
        }});
        Object.setPrototypeOf(plugins, PluginArray.prototype);
        Object.defineProperty(plugins, 'length', {{value: pluginData.length}});
        return plugins;
    }}
}});

// Override Permissions API
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications' ?
        Promise.resolve({{state: Notification.permission}}) :
        originalQuery(parameters)
);

// Spoof Notification.requestPermission
Notification.requestPermission = function() {{
    return Promise.resolve('default');
}};

// Spoof navigator.getBattery
navigator.getBattery = function() {{
    return Promise.resolve({{
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 0.85 + Math.random() * 0.15,
        addEventListener: function() {{}},
        removeEventListener: function() {{}}
    }});
}};

// Spoof navigator.connection (4g with random downlink/rtt)
Object.defineProperty(navigator, 'connection', {{
    get: () => ({{
        effectiveType: '4g',
        downlink: {round(random.uniform(5.0, 30.0), 1)},
        rtt: {random.randint(20, 100)},
        saveData: false,
        addEventListener: function() {{}},
        removeEventListener: function() {{}}
    }})
}});
"""
        try:
            driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': spoof_script})
        except Exception:
            pass

        # Referrer spoofing and Accept-Language headers
        referrer = random.choice(REFERRER_URLS)
        try:
            driver.execute_cdp_cmd('Network.enable', {})
            headers = {
                'Accept-Language': f'{fingerprint["language"]},en;q=0.9',
            }
            if referrer:
                headers['Referer'] = referrer
            driver.execute_cdp_cmd('Network.setExtraHTTPHeaders', {
                'headers': headers
            })
        except Exception:
            pass

        # Zoom out 80%
        try:
            driver.execute_script("document.body.style.zoom='80%'")
        except Exception:
            pass

        # Handle CAPTCHA/Cloudflare challenge before continuing
        if not self._handle_captcha(driver, page_number):
            self.fail_count += 1
            try:
                driver.quit()
            except Exception:
                pass
            try:
                process.terminate()
            except Exception:
                pass
            return None

        # Accept cookie banners
        self._accept_cookies(driver, page_number)

        # Simulate ad engagement (scroll, mouse events, visibility triggers)
        self._simulate_ad_engagement(driver, page_number)

        # Simulate human behavior before timer starts
        self._simulate_human_behavior(driver, page_number)

        # Check for error page immediately
        if self._check_error_page(driver):
            self.update_status(f"[Window {page_number}] Error page detected - closing immediately")
            self.fail_count += 1
            try:
                driver.quit()
            except Exception:
                pass
            try:
                process.terminate()
            except Exception:
                pass
            return None

        # Assign random close time (any time between 30-120 seconds)
        close_seconds = random.randint(30, 120)
        close_time = time.time() + close_seconds
        self.success_count += 1
        self.update_status(f"[Window {page_number}] Loaded! (Success: {self.success_count} | Failed: {self.fail_count})")
        self.update_status(f"[Window {page_number}] Will close in {close_seconds} seconds")

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
        self.success_count = 0
        self.fail_count = 0
        self.update_status(f"Starting Auto Close automation...")
        self.update_status(f"Total pages: {total_pages} | Open at once: {open_at_once}")
        self.update_status(f"Random close times: 30-120 seconds")
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
            # Stagger between opening windows to avoid triggering anti-bot
            if i < min(open_at_once, total_pages) - 1 and not self._is_stopped():
                stagger_time = random.uniform(1, 2)
                self.update_status(f"  Waiting {stagger_time:.1f}s before next window...")
                time.sleep(stagger_time)

        self.update_status(f"\n--- Phase 2: Monitor loop (closing and replacing) ---")
        self.update_status(f"Active: {len(self.active_windows)} | Success: {self.success_count} | Failed: {self.fail_count} | Total: {processed}/{total_pages}")
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
                    stagger_time = random.uniform(1, 2)
                    time.sleep(stagger_time)
                    processed += 1
                    proxy = None
                    if self.proxies:
                        proxy = self.proxies[(processed - 1) % len(self.proxies)]
                    window_info = self._open_single_window(target_url, processed, proxy)
                    if window_info:
                        self.active_windows.append(window_info)
                        self.update_status(f"Active: {len(self.active_windows)} | Success: {self.success_count} | Failed: {self.fail_count} | Total: {processed}/{total_pages}")
                    else:
                        self.update_status(f"[Window {processed}] Failed to open, skipping...")
                        self.update_status(f"Active: {len(self.active_windows)} | Success: {self.success_count} | Failed: {self.fail_count} | Total: {processed}/{total_pages}")
                else:
                    self.update_status(f"Active: {len(self.active_windows)} | Success: {self.success_count} | Failed: {self.fail_count} | Total: {processed}/{total_pages}")

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
        self.url_entry.insert(0, "https://viiukuhe.com/dc/?blockID=402321")

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
        self._update_status("Random close times: 30-120 seconds")
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
