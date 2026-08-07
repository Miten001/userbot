"""
TeraBox Automation Tool
-----------------------
A GUI tool that automates browser interaction with TeraBox.
Opens Chrome in incognito mode via subprocess with remote debugging,
then connects Selenium for Log In -> Sign Up -> Email selection flow.

@codex_here
"""

import atexit
import os
import subprocess
import threading
import time
import sys


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
        print("  - Open Chrome in incognito mode (via subprocess)")
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

# Remote debugging port for Chrome
DEBUG_PORT = 9222

# Per-selector probe timeout in seconds (short to avoid cascade)
SELECTOR_TIMEOUT = 5
# Overall page load timeout in seconds
PAGE_LOAD_TIMEOUT = 30
# Delay between actions in seconds
ACTION_DELAY = 2
# Maximum number of concurrent browser pages allowed
MAX_PAGES = 20


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

    def _is_stopped(self):
        """Check if the stop event has been set."""
        return self.stop_event.is_set()

    def update_status(self, message):
        """Send status update to callback."""
        self.status_callback(message)

    def launch_chrome_subprocess(self, url, debug_port):
        """
        Launch Chrome via subprocess with remote debugging enabled.
        This is the PRIMARY method - most reliable on Windows.
        """
        chrome_path = find_chrome_path()
        self.update_status(f"Chrome path: {chrome_path}")

        # Create a unique user data dir to allow multiple instances
        temp_dir = os.environ.get("TEMP", os.path.expanduser("~"))
        user_data_dir = os.path.join(temp_dir, f"chrome_terabox_{debug_port}")

        args = [
            chrome_path,
            "--incognito",
            f"--remote-debugging-port={debug_port}",
            f"--user-data-dir={user_data_dir}",
            "--disable-dev-shm-usage",
            "--start-maximized",
            "--no-first-run",
            "--no-default-browser-check",
            url,
        ]

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

    def connect_selenium_to_chrome(self, debug_port, max_retries=5):
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
                    time.sleep(3)

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
            time.sleep(5)

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
                    time.sleep(5)
            except Exception:
                self.update_status(
                    f"[Page {page_number}] Could not get current URL"
                )

            if self._is_stopped():
                return False

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
                time.sleep(3)
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
                time.sleep(3)
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

    def run(self, num_pages):
        """Run the automation for the specified number of pages."""
        self.update_status(f"Starting automation for {num_pages} page(s)...")

        for i in range(1, num_pages + 1):
            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            self.update_status(f"\n--- Opening Page {i} of {num_pages} ---")

            # Use a unique debug port per page
            port = DEBUG_PORT + (i - 1)

            # PRIMARY METHOD: Launch Chrome via subprocess
            process = self.launch_chrome_subprocess(TERABOX_URL, port)

            if process is None:
                self.update_status(
                    f"[Page {i}] Failed to launch Chrome. Stopping."
                )
                break

            # Wait for Chrome to start up
            time.sleep(4)

            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            # Connect Selenium to the running Chrome for element interaction
            driver = self.connect_selenium_to_chrome(port)

            if driver is None:
                self.update_status(
                    f"[Page {i}] Chrome is open but Selenium could not "
                    "connect.\nThe page is loaded - you can interact manually."
                )
                continue

            self.drivers.append(driver)

            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            success = self.perform_automation(driver, i)

            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            if success:
                self.update_status(
                    f"[Page {i}] Automation completed successfully!"
                )
            else:
                self.update_status(
                    f"[Page {i}] Automation completed with issues."
                )

            time.sleep(1)

        if not self._is_stopped():
            self.update_status(
                f"\nAll {num_pages} page(s) processed. "
                "Browsers will remain open."
            )

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
            except Exception:
                pass
        self.chrome_processes = []


class TeraBoxGUI:
    """Main GUI application for TeraBox automation with dark hacker theme."""

    def __init__(self):
        """Initialize the GUI."""
        self.root = tk.Tk()
        self.root.title("TeraBox Automation Tool")
        self.root.geometry("650x550")
        self.root.resizable(True, True)
        self.root.configure(bg="#0f0f0f")

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
        """Set up the GUI layout with dark hacker theme."""
        # Dark theme colors
        bg_dark = "#0f0f0f"
        bg_frame = "#1a1a2e"
        bg_entry = "#16213e"
        fg_text = "#ffffff"
        fg_accent = "#00fff5"
        fg_purple = "#bf00ff"
        fg_green = "#00ff41"

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
            text="TeraBox Automation Tool",
            font=("Consolas", 18, "bold"),
            fg=fg_accent,
            bg=bg_dark,
        )
        title_label.pack()

        subtitle_label = tk.Label(
            title_frame,
            text="Log In > Sign Up > Email Selection",
            font=("Consolas", 10),
            fg=fg_purple,
            bg=bg_dark,
        )
        subtitle_label.pack()

        # Input frame
        input_frame = tk.Frame(self.root, bg=bg_frame, pady=10, padx=20)
        input_frame.pack(fill=tk.X, padx=20, pady=5)

        pages_label = tk.Label(
            input_frame,
            text=f"Kitne pages open karne hain? (1-{MAX_PAGES}):",
            font=("Consolas", 11),
            fg=fg_text,
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
        self.pages_entry.insert(0, "1")

        # Buttons frame
        btn_frame = tk.Frame(self.root, bg=bg_dark, pady=10, padx=20)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame,
            text="Start Automation",
            font=("Consolas", 11, "bold"),
            bg="#00c853",
            fg="#000000",
            activebackground="#00e676",
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
            bg="#ff6d00",
            fg="#000000",
            activebackground="#ff9100",
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

        # Status frame
        status_frame = tk.Frame(self.root, bg=bg_dark, pady=5, padx=20)
        status_frame.pack(fill=tk.BOTH, expand=True)

        status_label = tk.Label(
            status_frame,
            text="[ Terminal Output ]",
            font=("Consolas", 10, "bold"),
            fg=fg_green,
            bg=bg_dark,
        )
        status_label.pack(anchor=tk.W)

        # Text widget with scrollbar for status messages
        text_frame = tk.Frame(status_frame, bg=bg_dark)
        text_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        scrollbar = tk.Scrollbar(text_frame, bg=bg_dark, troughcolor=bg_dark)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.status_text = tk.Text(
            text_frame,
            height=12,
            font=("Consolas", 9),
            wrap=tk.WORD,
            state=tk.DISABLED,
            bg="#000000",
            fg=fg_green,
            insertbackground=fg_green,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=fg_accent,
            yscrollcommand=scrollbar.set,
        )
        self.status_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.status_text.yview)

        # Progress bar with dark style
        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "dark.Horizontal.TProgressbar",
            troughcolor=bg_frame,
            background=fg_accent,
            darkcolor=fg_accent,
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

        # Disable start button, enable stop button
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.close_btn.config(state=tk.NORMAL)
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
            args=(num_pages,),
            daemon=True,
        )
        thread.start()

    def _stop_automation(self):
        """Stop the running automation."""
        if self.is_running:
            self._stop_event.set()
            self._update_status("\nStopping automation... please wait.")
            self.stop_btn.config(state=tk.DISABLED)

    def _run_automation_thread(self, num_pages):
        """
        Run the automation in a background thread.

        Args:
            num_pages: Number of pages to process
        """
        try:
            self.automation.run(num_pages)
        except Exception as e:
            self._update_status(f"Error: {str(e)}")
        finally:
            # Re-enable start button on completion
            self.root.after(0, self._on_automation_complete)

    def _on_automation_complete(self):
        """Called when automation completes."""
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.is_running = False
        self.progress.stop()
        if self._stop_event.is_set():
            self._update_status("\n--- Automation Stopped ---")
        else:
            self._update_status("\n--- Automation Complete ---")

    def _close_browsers(self):
        """Close all open browser instances."""
        if self.automation:
            self.automation.close_all()
            self._update_status("All browsers closed.")
        self.close_btn.config(state=tk.DISABLED)

    def run(self):
        """Start the GUI main loop."""
        self._update_status("Ready! Enter the number of pages and click Start.")
        self._update_status(
            "Tayyar! Pages ki number daalein aur Start dabayein."
        )
        self._update_status(f"(Maximum {MAX_PAGES} pages allowed)")
        self._update_status("")
        self._update_status(
            "Method: subprocess Chrome launch + Selenium connect"
        )
        self.root.mainloop()


def main():
    """Main entry point."""
    app = TeraBoxGUI()
    app.run()


if __name__ == "__main__":
    main()
