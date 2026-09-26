from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import random
import requests
import string
import re

app = FastAPI(
    title="ShadowPersona Backend API",
    description="Microservice for persona generation, Mail.tm real disposable mailboxes, and automated OTP extraction",
    version="1.0"
)

# Enable CORS for browser extension and local test forms
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Pat", "Riley", "Cameron"]
LAST_NAMES = ["Vance", "Mercer", "Sterling", "Cross", "Hayden", "Rowan", "Ellis", "Quinn"]

# Caches for authentication and simulation
token_cache = {}        # email -> jwt_token
account_creds = {}      # email -> password
mock_inbox = {}         # email -> simulated OTP payload

MAILTM_BASE = "https://api.mail.tm"

def generate_strong_password(length: int = 12) -> str:
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(random.choice(characters) for _ in range(length))

def get_or_refresh_token(email_address: str) -> str:
    email_key = email_address.lower().strip()
    if email_key in token_cache:
        return token_cache[email_key]
    
    # If token expired or server restarted, re-authenticate using stored credentials
    if email_key in account_creds:
        login_payload = {
            "address": email_key,
            "password": account_creds[email_key]
        }
        res = requests.post(f"{MAILTM_BASE}/token", json=login_payload, timeout=8)
        if res.status_code == 200:
            token = res.json().get("token")
            token_cache[email_key] = token
            return token
            
    return None

# ============================================================================
# MODULE 2: Persona Generator with Real Mail.tm Account Creation
# ============================================================================
@app.get("/api/persona")
def get_synthetic_persona():
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    password = generate_strong_password()

    # 1. Query available active domains from Mail.tm
    try:
        domain_res = requests.get(f"{MAILTM_BASE}/domains", timeout=8)
        domain_res.raise_for_status()
        domains = domain_res.json().get("hydra:member", [])
        if not domains:
            raise Exception("No active domains returned by Mail.tm")
        chosen_domain = domains[0]["domain"]
    except Exception as exc:
        print(f"[-] Mail.tm domain lookup error: {exc}")
        raise HTTPException(status_code=503, detail="Mail.tm service unavailable")

    username = f"{first.lower()}_{last.lower()}{random.randint(100, 999)}"
    account_email = f"{username}@{chosen_domain}".lower()

    # 2. Register account on Mail.tm
    reg_payload = {"address": account_email, "password": password}
    reg_res = requests.post(f"{MAILTM_BASE}/accounts", json=reg_payload, timeout=8)
    if reg_res.status_code not in [200, 201]:
        print(f"[-] Registration failed: {reg_res.text}")
        raise HTTPException(status_code=500, detail="Failed to create burner mailbox")

    # 3. Retrieve JWT Bearer Token
    token_res = requests.post(f"{MAILTM_BASE}/token", json=reg_payload, timeout=8)
    if token_res.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to authenticate burner mailbox")

    jwt_token = token_res.json().get("token")

    # Save credentials for re-use
    token_cache[account_email] = jwt_token
    account_creds[account_email] = password

    print(f"[+] Successfully registered Mail.tm address: {account_email}")

    return {
        "fullName": f"{first} {last}",
        "username": username,
        "email": account_email,
        "login": username,
        "domain": chosen_domain,
        "password": password
    }

# ============================================================================
# MODULE 3: Automated OTP Interceptor & Inbox Poller
# ============================================================================
@app.get("/api/inbox/otp")
def fetch_inbox_otp(login: str, domain: str):
    email_key = f"{login}@{domain}".lower().strip()

    # Priority 1: Check simulated OTP cache (from extension 'Send Test OTP' button)
    if email_key in mock_inbox:
        simulated = mock_inbox[email_key]
        print(f"[+] Returning simulated OTP for {email_key}: {simulated['otp']}")
        return {
            "status": "success",
            "from": simulated.get("from", "verify@auth-service.com"),
            "subject": simulated.get("subject", "Verification Code"),
            "otp": simulated.get("otp"),
            "preview": simulated.get("preview")
        }

    # Priority 2: Check live Mail.tm inbox
    token = get_or_refresh_token(email_key)
    if not token:
        return {"status": "empty", "message": "No active session for this address", "otp": None}

    headers = {"Authorization": f"Bearer {token}"}

    try:
        messages_res = requests.get(f"{MAILTM_BASE}/messages", headers=headers, timeout=8)
        if messages_res.status_code == 401:
            # Token might have expired, clear and attempt refresh
            token_cache.pop(email_key, None)
            token = get_or_refresh_token(email_key)
            if not token:
                return {"status": "empty", "message": "Authentication expired", "otp": None}
            headers = {"Authorization": f"Bearer {token}"}
            messages_res = requests.get(f"{MAILTM_BASE}/messages", headers=headers, timeout=8)

        messages_data = messages_res.json()
        messages = messages_data.get("hydra:member", [])

        if not messages:
            return {"status": "empty", "message": "No emails received yet", "otp": None}

        # Inspect latest incoming email
        latest_id = messages[0]["id"]
        detail_res = requests.get(f"{MAILTM_BASE}/messages/{latest_id}", headers=headers, timeout=8)
        detail = detail_res.json()

        subject = detail.get("subject", "")
        text_body = detail.get("text", "") or detail.get("intro", "")
        html_body = " ".join(detail.get("html", [])) if isinstance(detail.get("html"), list) else str(detail.get("html", ""))
        full_content = f"{subject} {text_body} {html_body}"

        # Match 4-8 digit numeric verification code
        otp_match = re.search(r'\b\d{4,8}\b', full_content)
        detected_otp = otp_match.group(0) if otp_match else None

        sender = detail.get("from", {}).get("address", "Unknown Sender")
        print(f"[+] Mail received from {sender}! Extracted OTP: {detected_otp}")

        return {
            "status": "success",
            "from": sender,
            "subject": subject,
            "otp": detected_otp,
            "preview": text_body[:120]
        }
    except Exception as exc:
        print(f"[-] Mail.tm poll error: {exc}")
        return {"status": "empty", "message": str(exc), "otp": None}

# ============================================================================
# INSTANT SIMULATION: Trigger OTP without waiting for mail transit
# ============================================================================
@app.get("/api/inbox/simulate")
def simulate_otp(email: str, code: str = None):
    if not code:
        code = str(random.randint(100000, 999999))

    email_key = email.strip().lower()
    mock_inbox[email_key] = {
        "from": "security@shadowpersona-auth.org",
        "subject": "Your One-Time Passcode",
        "otp": code,
        "preview": f"Your verification code is {code}. This code expires in 10 minutes."
    }
    print(f"[+] Simulated OTP {code} registered for {email_key}")
    return {"status": "ok", "email": email_key, "otp": code}