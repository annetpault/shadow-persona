// popup.js - Persona Generator, Autofill, DOM Scanner, Encrypted Vault, and Smart OTP Autofill

const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Pat", "Riley", "Cameron"];
const lastNames = ["Vance", "Mercer", "Sterling", "Cross", "Hayden", "Rowan", "Ellis", "Quinn"];

// Use 1secmail.com exclusively as other domains often fail DNS/CORS in browser fetch
const MAIL_DOMAINS = ["1secmail.com"];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

let activePersona = {
  fullName: "",
  username: "",
  email: "",
  login: "",
  domain: "",
  password: ""
};

function isValidTab(tab) {
  if (!tab || !tab.id || !tab.url) return false;
  return (
    tab.url.startsWith("http://") ||
    tab.url.startsWith("https://") ||
    tab.url.startsWith("file://")
  );
}

// 1. Instant Persona Generation
function createPersona() {
  const first = getRandomItem(firstNames);
  const last = getRandomItem(lastNames);
  const num = Math.floor(100 + Math.random() * 900);
  const username = `${first.toLowerCase()}_${last.toLowerCase()}${num}`;
  const domain = getRandomItem(MAIL_DOMAINS);
  const password = generatePassword();

  activePersona = {
    fullName: `${first} ${last}`,
    username: username,
    email: `${username}@${domain}`,
    login: username,
    domain: domain,
    password: password
  };

  updateUI();
}

function updateUI() {
  const nameEl = document.getElementById("mock-name");
  const userEl = document.getElementById("mock-user");
  const emailEl = document.getElementById("mock-email");
  const passEl = document.getElementById("mock-pass");

  if (nameEl) nameEl.textContent = activePersona.fullName;
  if (userEl) userEl.textContent = activePersona.username;
  if (emailEl) emailEl.textContent = activePersona.email;
  if (passEl) passEl.textContent = activePersona.password;
}

// Helper: Extract 4-to-6 digit OTP from message body
function extractOTP(text) {
  if (!text) return null;
  const match = text.match(/\b\d{4,6}\b/);
  return match ? match[0] : null;
}

// 2. Smart OTP Inbox Polling & Auto-Injection
async function checkInbox() {
  if (!activePersona.login || !activePersona.domain) return;
  const listEl = document.getElementById("mail-list");
  if (!listEl) return;

  listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>Checking inbox...</span>";

  try {
    const res = await fetch(
      `https://www.1secmail.com/api/v1/?action=getMessages&login=${activePersona.login}&domain=${activePersona.domain}`
    );

    if (!res.ok) throw new Error("API Offline");

    const messages = await res.json();

    if (!messages || messages.length === 0) {
      // Provide a 1-click test simulation button if testing locally
      listEl.innerHTML = `
        <span style='font-size:11px;color:#94a3b8'>No emails received yet.</span>
        <button id="btn-simulate-otp" style="display:block;margin-top:6px;width:100%;font-size:10px;background:#334155;color:#f8fafc;border:none;border-radius:4px;padding:4px;cursor:pointer;">
          ⚡ Simulate Mock Test OTP (Demo)
        </button>
      `;

      document.getElementById("btn-simulate-otp")?.addEventListener("click", () => {
        const mockCode = String(Math.floor(100000 + Math.random() * 900000));
        injectOtpToPage(mockCode);
        listEl.innerHTML = `<span style='font-size:11px;color:#10b981;'>Simulated OTP <b>${mockCode}</b> injected!</span>`;
      });
      return;
    }

    listEl.innerHTML = "";
    for (const msg of messages.slice(0, 2)) {
      const mailDetail = await fetch(
        `https://www.1secmail.com/api/v1/?action=readMessage&login=${activePersona.login}&domain=${activePersona.domain}&id=${msg.id}`
      ).then((r) => r.json());

      const detectedOtp = extractOTP(mailDetail.textBody || mailDetail.body || msg.subject);

      const item = document.createElement("div");
      item.className = "mail-item";
      item.innerHTML = `
        <b>From:</b> ${msg.from}<br>
        <b>Subject:</b> ${msg.subject}<br>
        ${detectedOtp ? `<b style="color:#10b981;">Detected OTP: ${detectedOtp}</b>` : ""}
      `;
      listEl.appendChild(item);

      // Auto-fill OTP field if detected
      if (detectedOtp) {
        injectOtpToPage(detectedOtp);
      }
    }
  } catch (e) {
    // Graceful offline fallback with local OTP injection for demo/testing
    const fallbackOtp = String(Math.floor(100000 + Math.random() * 900000));
    listEl.innerHTML = `
      <span style='font-size:11px;color:#f59e0b'>1secmail API unreachable.</span>
      <button id="btn-use-mock-otp" style="display:block;margin-top:4px;width:100%;font-size:11px;background:#2563eb;color:#fff;border:none;border-radius:4px;padding:5px;cursor:pointer;">
        Fill Demo OTP: ${fallbackOtp}
      </button>
    `;

    document.getElementById("btn-use-mock-otp")?.addEventListener("click", () => {
      injectOtpToPage(fallbackOtp);
      listEl.innerHTML = `<span style='font-size:11px;color:#10b981;'>Applied OTP <b>${fallbackOtp}</b>!</span>`;
    });
  }
}

// Send OTP fill message to content.js
async function injectOtpToPage(code) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isValidTab(tab)) {
    chrome.tabs.sendMessage(tab.id, { action: "FILL_OTP", otp: code }, () => {
      if (chrome.runtime.lastError) return;
    });
  }
}

// 3. Render scan findings
function renderScanReport(report) {
  if (!report) return;
  const totalEl = document.getElementById("total");
  const hiddenEl = document.getElementById("hidden");
  const trapsEl = document.getElementById("traps");

  if (totalEl) totalEl.textContent = report.totalInputs || 0;
  if (hiddenEl) hiddenEl.textContent = report.hiddenBoxes || 0;
  if (trapsEl) trapsEl.textContent = report.invisibleBoxes || 0;

  const statusBox = document.getElementById("status");
  if (statusBox) {
    if (report.isSuspicious) {
      statusBox.textContent = `⚠️ Warning: ${report.invisibleBoxes} Trap(s) Detected`;
      statusBox.className = "badge warning";
    } else {
      statusBox.textContent = "✅ Page Appears Safe";
      statusBox.className = "badge safe";
    }
  }
}

// 4. Request live DOM scan from content.js
async function triggerActiveScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!isValidTab(tab)) {
    chrome.storage.local.get(["scanReport"], (data) => {
      renderScanReport(data.scanReport);
    });
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "REQUEST_SCAN" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      chrome.storage.local.get(["scanReport"], (data) => {
        renderScanReport(data.scanReport);
      });
    } else {
      renderScanReport(response);
    }
  });
}

// --- MODULE 4: AES-256-GCM LOCAL ENCRYPTED VAULT ---

async function getOrCreateVaultKey() {
  const stored = await chrome.storage.local.get(["vaultMasterKey"]);
  if (stored.vaultMasterKey) {
    return await crypto.subtle.importKey(
      "jwk",
      stored.vaultMasterKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  const newKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedJwk = await crypto.subtle.exportKey("jwk", newKey);
  await chrome.storage.local.set({ vaultMasterKey: exportedJwk });
  return newKey;
}

async function encryptPersona(personaObj) {
  const key = await getOrCreateVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(personaObj));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );

  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join("");
  const dataHex = Array.from(new Uint8Array(cipherBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return { iv: ivHex, ciphertext: dataHex, date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
}

async function decryptPersona(encryptedRecord) {
  const key = await getOrCreateVaultKey();
  const iv = new Uint8Array(encryptedRecord.iv.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(encryptedRecord.ciphertext.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

async function loadVaultUI() {
  const vaultList = document.getElementById("vault-list");
  if (!vaultList) return;

  const data = await chrome.storage.local.get(["encryptedVault"]);
  const records = data.encryptedVault || [];

  if (records.length === 0) {
    vaultList.innerHTML = `<span style="color:#94a3b8; font-size:11px;">No credentials saved yet.</span>`;
    return;
  }

  vaultList.innerHTML = "";
  for (const item of records) {
    try {
      const persona = await decryptPersona(item);
      const div = document.createElement("div");
      div.className = "vault-item";
      div.innerHTML = `
        <b>${persona.fullName}</b> <span style="color:#94a3b8; font-size:10px;">(${item.date})</span><br>
        <span style="color:#2563eb;">${persona.email}</span><br>
        Pass: <span style="font-family:monospace; font-weight:bold;">${persona.password}</span>
      `;
      vaultList.appendChild(div);
    } catch (e) {
      console.error("Vault decryption error", e);
    }
  }
}

// 5. Button Bindings
const regenBtn = document.getElementById("btn-regen");
if (regenBtn) {
  regenBtn.addEventListener("click", () => createPersona());
}

const checkMailBtn = document.getElementById("btn-check-mail");
if (checkMailBtn) {
  checkMailBtn.addEventListener("click", checkInbox);
}

const fillBtn = document.getElementById("btn-fill");
if (fillBtn) {
  fillBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isValidTab(tab)) return;

    chrome.tabs.sendMessage(
      tab.id,
      { action: "AUTOFILL_PAGE", persona: activePersona },
      () => {
        if (chrome.runtime.lastError) return;
      }
    );
  });
}

const bypassBtn = document.getElementById("btn-bypass");
if (bypassBtn) {
  bypassBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isValidTab(tab)) return;

    chrome.tabs.sendMessage(tab.id, { action: "BYPASS_OVERLAY" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.removedCount > 0) {
        bypassBtn.textContent = `✅ Removed ${response.removedCount} Overlay(s)`;
      } else {
        bypassBtn.textContent = "No Sign-up Wall Found";
      }
      setTimeout(() => {
        bypassBtn.textContent = "🔓 Bypass Sign-up Wall";
      }, 2000);
    });
  });
}

const saveVaultBtn = document.getElementById("btn-save-vault");
if (saveVaultBtn) {
  saveVaultBtn.addEventListener("click", async () => {
    if (!activePersona.email) return;
    saveVaultBtn.textContent = "Encrypting...";

    const encryptedData = await encryptPersona(activePersona);
    const data = await chrome.storage.local.get(["encryptedVault"]);
    const vault = data.encryptedVault || [];

    vault.unshift(encryptedData);
    await chrome.storage.local.set({ encryptedVault: vault });

    saveVaultBtn.textContent = "✅ Saved (AES-256)!";
    loadVaultUI();
    setTimeout(() => {
      saveVaultBtn.textContent = "🔒 Save to Encrypted Vault";
    }, 1500);
  });
}

const clearVaultBtn = document.getElementById("btn-clear-vault");
if (clearVaultBtn) {
  clearVaultBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ encryptedVault: [] });
    loadVaultUI();
  });
}

createPersona();
triggerActiveScan();
loadVaultUI();