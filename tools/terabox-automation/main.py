"""
TeraBox Automation Tool
-----------------------
A GUI tool that automates browser interaction with TeraBox.
Opens Chrome in incognito mode, navigates to TeraBox, and performs
Sign In -> Sign Up -> Gmail selection flow for multiple pages.
"""

import atexit
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
        print("  - Open Chrome in incognito mode")
        print("  - Navigate to TeraBox")
        print("  - Click Sign In -> Sign Up -> Gmail")
        print("  - Repeat for each page")
        print()
        print("Requirements:")
        print("  - Python 3.7+")
        print("  - Google Chrome browser installed")
        print("  - ChromeDriver (matching your Chrome version)")
        print("  - selenium (pip install selenium)")
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
except ImportError:
    print("Error: selenium is not installed.")
    print("Install it with: pip install selenium")
    sys.exit(1)


# Target URL
TERABOX_URL = "https://1024terabox.com/s/1axTeTaTPATdSOQizMrGeJQ"

# Per-selector probe timeout in seconds (short to avoid cascade)
SELECTOR_TIMEOUT = 2
# Overall page load timeout in seconds
PAGE_LOAD_TIMEOUT = 20
# Delay between actions in seconds
ACTION_DELAY = 2
# Maximum number of concurrent browser pages allowed
MAX_PAGES = 20


class TeraBoxAutomation:
    """Handles the Selenium automation flow for TeraBox."""

    def __init__(self, status_callback=None, stop_event=None):
        """
        Initialize the automation handler.

        Args:
            status_callback: Function to call with status updates (str)
            stop_event: threading.Event that signals cancellation
        """
        self.status_callback = status_callback or print
        self.stop_event = stop_event or threading.Event()
        self.drivers = []

    def _is_stopped(self):
        """Check if the stop event has been set."""
        return self.stop_event.is_set()

    def update_status(self, message):
        """Send status update to callback."""
        self.status_callback(message)

    def create_driver(self):
        """Create a Chrome WebDriver instance in incognito mode."""
        chrome_options = Options()
        chrome_options.add_argument("--incognito")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option("useAutomationExtension", False)

        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.maximize_window()
            return driver
        except WebDriverException as e:
            self.update_status(f"Chrome driver error: {str(e)}")
            self.update_status(
                "Make sure Chrome and ChromeDriver are installed and in PATH."
            )
            return None

    def _find_element(self, driver, selectors, step_name, page_number):
        """
        Try each selector with a short timeout to find a clickable element.

        Uses a short per-selector timeout (SELECTOR_TIMEOUT) to avoid the
        cascade problem where many failing selectors each burn a long wait.

        Args:
            driver: Selenium WebDriver instance
            selectors: List of (By, selector_string) tuples
            step_name: Name of the step for logging
            page_number: Page number for status updates

        Returns:
            The found WebElement, or None if not found or stopped.
        """
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
        Perform the automation flow on a single page:
        1. Navigate to TeraBox URL
        2. Click Sign In
        3. Click Sign Up
        4. Click Gmail option

        Args:
            driver: Selenium WebDriver instance
            page_number: Page number for status updates
        """
        try:
            if self._is_stopped():
                return False

            # Step 1: Navigate to TeraBox
            self.update_status(f"[Page {page_number}] Opening TeraBox...")
            driver.get(TERABOX_URL)
            time.sleep(ACTION_DELAY)

            if self._is_stopped():
                return False

            # Step 2: Click "Sign In" button
            self.update_status(f"[Page {page_number}] Looking for Sign In button...")
            time.sleep(ACTION_DELAY)

            selectors_sign_in = [
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
                driver, selectors_sign_in, "Sign In", page_number
            )

            if self._is_stopped():
                return False

            if sign_in_btn:
                sign_in_btn.click()
                self.update_status(f"[Page {page_number}] Clicked Sign In!")
                time.sleep(ACTION_DELAY)
            else:
                self.update_status(
                    f"[Page {page_number}] Sign In button not found. "
                    "You may need to adjust the selectors."
                )
                return False

            if self._is_stopped():
                return False

            # Step 3: Click "Sign Up" button
            self.update_status(f"[Page {page_number}] Looking for Sign Up button...")
            time.sleep(ACTION_DELAY)

            selectors_sign_up = [
                (By.XPATH, "//span[contains(text(),'Sign up')]"),
                (By.XPATH, "//span[contains(text(),'Sign Up')]"),
                (By.XPATH, "//a[contains(text(),'Sign up')]"),
                (By.XPATH, "//a[contains(text(),'Sign Up')]"),
                (By.XPATH, "//button[contains(text(),'Sign up')]"),
                (By.XPATH, "//button[contains(text(),'Sign Up')]"),
                (By.XPATH, "//*[contains(text(),'Create account')]"),
                (By.XPATH, "//*[contains(text(),'Register')]"),
                (By.CSS_SELECTOR, "[class*='sign-up']"),
                (By.CSS_SELECTOR, "[class*='signup']"),
                (By.CSS_SELECTOR, "[class*='register']"),
            ]

            sign_up_btn = self._find_element(
                driver, selectors_sign_up, "Sign Up", page_number
            )

            if self._is_stopped():
                return False

            if sign_up_btn:
                sign_up_btn.click()
                self.update_status(f"[Page {page_number}] Clicked Sign Up!")
                time.sleep(ACTION_DELAY)
            else:
                self.update_status(
                    f"[Page {page_number}] Sign Up button not found. "
                    "You may need to adjust the selectors."
                )
                return False

            if self._is_stopped():
                return False

            # Step 4: Click Gmail option
            self.update_status(
                f"[Page {page_number}] Looking for Gmail option..."
            )
            time.sleep(ACTION_DELAY)

            selectors_gmail = [
                (By.XPATH, "//*[contains(text(),'Google')]"),
                (By.XPATH, "//*[contains(text(),'Gmail')]"),
                (By.XPATH, "//*[contains(text(),'google')]"),
                (By.XPATH, "//*[contains(text(),'gmail')]"),
                (By.XPATH, "//img[contains(@src,'google')]"),
                (By.XPATH, "//img[contains(@alt,'Google')]"),
                (By.CSS_SELECTOR, "[class*='google']"),
                (By.CSS_SELECTOR, "[class*='Gmail']"),
                (By.CSS_SELECTOR, "[data-type='google']"),
                (By.CSS_SELECTOR, ".google-login"),
                (By.CSS_SELECTOR, ".btn-google"),
            ]

            gmail_btn = self._find_element(
                driver, selectors_gmail, "Gmail", page_number
            )

            if self._is_stopped():
                return False

            if gmail_btn:
                gmail_btn.click()
                self.update_status(
                    f"[Page {page_number}] Clicked Gmail option! Done."
                )
                time.sleep(ACTION_DELAY)
            else:
                self.update_status(
                    f"[Page {page_number}] Gmail option not found. "
                    "You may need to adjust the selectors."
                )
                return False

            return True

        except Exception as e:
            self.update_status(f"[Page {page_number}] Error: {str(e)}")
            return False

    def run(self, num_pages):
        """
        Run the automation for the specified number of pages.

        Args:
            num_pages: Number of browser pages to open
        """
        self.update_status(f"Starting automation for {num_pages} page(s)...")

        for i in range(1, num_pages + 1):
            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            self.update_status(f"\n--- Opening Page {i} of {num_pages} ---")
            driver = self.create_driver()

            if driver is None:
                self.update_status(f"[Page {i}] Failed to create browser. Stopping.")
                break

            self.drivers.append(driver)

            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            success = self.perform_automation(driver, i)

            if self._is_stopped():
                self.update_status("\nAutomation stopped by user.")
                break

            if success:
                self.update_status(f"[Page {i}] Automation completed successfully!")
            else:
                self.update_status(f"[Page {i}] Automation completed with issues.")

            time.sleep(1)

        if not self._is_stopped():
            self.update_status(
                f"\nAll {num_pages} page(s) processed. Browsers will remain open."
            )

    def close_all(self):
        """Close all open browser instances."""
        for driver in self.drivers:
            try:
                driver.quit()
            except Exception:
                pass
        self.drivers = []


class TeraBoxGUI:
    """Main GUI application for TeraBox automation."""

    def __init__(self):
        """Initialize the GUI."""
        self.root = tk.Tk()
        self.root.title("TeraBox Automation Tool")
        self.root.geometry("600x500")
        self.root.resizable(True, True)

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
        """Set up the GUI layout."""
        # Title
        title_frame = tk.Frame(self.root, pady=10)
        title_frame.pack(fill=tk.X)

        title_label = tk.Label(
            title_frame,
            text="TeraBox Automation Tool",
            font=("Arial", 16, "bold"),
        )
        title_label.pack()

        subtitle_label = tk.Label(
            title_frame,
            text="Automated Sign In -> Sign Up -> Gmail Selection",
            font=("Arial", 10),
            fg="gray",
        )
        subtitle_label.pack()

        # Input frame
        input_frame = tk.Frame(self.root, pady=10, padx=20)
        input_frame.pack(fill=tk.X)

        # Number of pages input
        pages_label = tk.Label(
            input_frame,
            text=f"Kitne pages open karne hain? (1-{MAX_PAGES}):",
            font=("Arial", 11),
        )
        pages_label.pack(anchor=tk.W)

        self.pages_entry = tk.Entry(
            input_frame,
            font=("Arial", 12),
            width=10,
        )
        self.pages_entry.pack(anchor=tk.W, pady=5)
        self.pages_entry.insert(0, "1")

        # Buttons frame
        btn_frame = tk.Frame(self.root, pady=10, padx=20)
        btn_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            btn_frame,
            text="Start Automation",
            font=("Arial", 12, "bold"),
            bg="#4CAF50",
            fg="white",
            padx=20,
            pady=5,
            command=self._start_automation,
        )
        self.start_btn.pack(side=tk.LEFT, padx=5)

        self.stop_btn = tk.Button(
            btn_frame,
            text="Stop Automation",
            font=("Arial", 12, "bold"),
            bg="#FF9800",
            fg="white",
            padx=20,
            pady=5,
            command=self._stop_automation,
            state=tk.DISABLED,
        )
        self.stop_btn.pack(side=tk.LEFT, padx=5)

        self.close_btn = tk.Button(
            btn_frame,
            text="Close All Browsers",
            font=("Arial", 12),
            bg="#f44336",
            fg="white",
            padx=20,
            pady=5,
            command=self._close_browsers,
            state=tk.DISABLED,
        )
        self.close_btn.pack(side=tk.LEFT, padx=5)

        # Status/Progress frame
        status_frame = tk.Frame(self.root, pady=10, padx=20)
        status_frame.pack(fill=tk.BOTH, expand=True)

        status_label = tk.Label(
            status_frame,
            text="Status / Progress:",
            font=("Arial", 11, "bold"),
        )
        status_label.pack(anchor=tk.W)

        # Text widget with scrollbar for status messages
        text_frame = tk.Frame(status_frame)
        text_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        scrollbar = tk.Scrollbar(text_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.status_text = tk.Text(
            text_frame,
            height=12,
            font=("Courier", 10),
            wrap=tk.WORD,
            state=tk.DISABLED,
            yscrollcommand=scrollbar.set,
        )
        self.status_text.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.status_text.yview)

        # Progress bar
        self.progress = ttk.Progressbar(
            self.root, mode="indeterminate", length=400
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
        self.root.mainloop()


def main():
    """Main entry point."""
    app = TeraBoxGUI()
    app.run()


if __name__ == "__main__":
    main()
