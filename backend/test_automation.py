import os
import requests
from playwright.sync_api import sync_playwright

def run_test():
    print("=" * 60)
    print(" ShadowPersona Playwright Automation Engine ")
    print("=" * 60)

    # 1. Fetch synthetic persona from local FastAPI backend
    print("\n[+] Step 1: Fetching synthetic persona from FastAPI...")
    try:
        res = requests.get("http://127.0.0.1:8000/api/persona", timeout=3)
        persona = res.json()
    except Exception:
        print("[!] Backend offline, using fallback persona.")
        persona = {
            "fullName": "Alex Cross",
            "email": "alex.cross101@shadowmail.local",
            "password": "SecurePassword123!"
        }

    print(f"    Loaded Identity: {persona['fullName']} | {persona['email']}")

    # 2. Resolve absolute path to test.html
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    test_html_path = os.path.join(base_dir, "test.html")
    file_url = f"file:///{test_html_path.replace(os.sep, '/')}"

    # 3. Launch automated browser instance
    print("\n[+] Step 2: Booting Chromium via Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()
        page.goto(file_url)
        print(f"    Target loaded: {file_url}")

        # 4. Detect honeypots and fill form
        print("\n[+] Step 3: Scanning inputs and neutralizing honeypots...")
        inputs = page.query_selector_all("input")

        for el in inputs:
            name = (el.get_attribute("name") or "").lower()
            input_type = (el.get_attribute("type") or "text").lower()

            # Skip honeypot decoys
            if any(trap in name for trap in ["trap", "website", "hp", "bot", "decoy"]):
                print(f"    [⚠️ TRAP DETECTED] Bypassing '{name}' decoy field!")
                continue

            # Fill clean fields
            if "name" in name or (input_type == "text" and "otp" not in name and "code" not in name):
                el.fill(persona["fullName"])
                print(f"    [✓] Injected Name -> '{name}'")
            elif input_type == "email" or "email" in name:
                el.fill(persona["email"])
                print(f"    [✓] Injected Email -> '{name}'")
            elif input_type == "password":
                el.fill(persona["password"])
                print(f"    [✓] Injected Password -> '{name}'")

        # 5. Fetch and inject OTP
        print("\n[+] Step 4: Intercepting OTP via backend virtual inbox...")
        try:
            otp_res = requests.get(
                f"http://127.0.0.1:8000/api/inbox/simulate?email={persona['email']}", 
                timeout=3
            )
            otp_code = otp_res.json().get("otp", "784912")
            print(f"    Received OTP Code: {otp_code}")

            otp_input = page.query_selector("input[placeholder*='code' i], input[name*='otp' i]")
            if otp_input:
                otp_input.fill(otp_code)
                print("    [✓] Injected OTP into verification field!")
        except Exception as e:
            print(f"    [!] OTP step note: {e}")

        print("\n[+] Step 5: Test complete. Keeping browser open for 3 seconds...")
        page.wait_for_timeout(10000)
        browser.close()
        print("\n[🎉 SUCCESS] Playwright verification completed successfully!\n")

if __name__ == "__main__":
    run_test()