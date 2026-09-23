// Arrays to randomly generate mock personas
const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Pat", "Riley", "Cameron"];
const lastNames = ["Vance", "Mercer", "Sterling", "Cross", "Hayden", "Rowan", "Ellis", "Quinn"];

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

// 1. Generate identity & fetch real temporary inbox from 1secmail
async function createPersona() {
  const first = getRandomItem(firstNames);
  const last = getRandomItem(lastNames);
  const num = Math.floor(100 + Math.random() * 900);
  const username = `${first.toLowerCase()}_${last.toLowerCase()}${num}`;
  const password = generatePassword();

  try {
    const res = await fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
    const [genEmail] = await res.json();
    const [login, domain] = genEmail.split("@");

    activePersona = {
      fullName: `${first} ${last}`,
      username: username,
      email: genEmail,
      login: login,
      domain: domain,
      password: password
    };
  } catch (err) {
    // Fallback if offline or API is unreachable
    activePersona = {
      fullName: `${first} ${last}`,
      username: username,
      email: `${username}@1secmail.com`,
      login: username,
      domain: "1secmail.com",
      password: password
    };
  }

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

// 2. Poll for incoming OTPs / emails
async function checkInbox() {
  if (!activePersona.login || !activePersona.domain) return;
  const listEl = document.getElementById("mail-list");
  if (!listEl) return;

  listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>Checking...</span>";

  try {
    const res = await fetch(
      `https://www.1secmail.com/api/v1/?action=getMessages&login=${activePersona.login}&domain=${activePersona.domain}`
    );
    const messages = await res.json();

    if (messages.length === 0) {
      listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>No emails received yet.</span>";
    } else {
      listEl.innerHTML = "";
      for (const msg of messages.slice(0, 2)) {
        const mailDetail = await fetch(
          `https://www.1secmail.com/api/v1/?action=readMessage&login=${activePersona.login}&domain=${activePersona.domain}&id=${msg.id}`
        ).then((r) => r.json());

        const item = document.createElement("div");
        item.className = "mail-item";
        item.innerHTML = `<b>From:</b> ${msg.from}<br><b>Subject:</b> ${msg.subject}<br><b>Preview:</b> ${mailDetail.textBody.substring(0, 80)}...`;
        listEl.appendChild(item);
      }
    }
  } catch (e) {
    listEl.innerHTML = "<span style='font-size:11px;color:#ef4444'>Failed to fetch messages.</span>";
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

// 4. Request live DOM scan from content.js on popup open
async function triggerActiveScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
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
}

// --- MODULE 4: AES-256-GCM LOCAL ENCRYPTED VAULT ---

// Derive or load persistent 256-bit AES key
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

// Encrypt persona data to AES-256-GCM ciphertext
async function encryptPersona(personaObj) {
  const key = await getOrCreateVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
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

// Decrypt ciphertext back to persona object
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

// Render decrypted items in vault UI
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

// 5. Wire up button actions
document.getElementById("btn-regen").addEventListener("click", () => {
  createPersona();
});

const checkMailBtn = document.getElementById("btn-check-mail");
if (checkMailBtn) {
  checkMailBtn.addEventListener("click", checkInbox);
}

// Autofill action
document.getElementById("btn-fill").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "AUTOFILL_PAGE",
      persona: activePersona
    });
  }
});

// Paywall / Backdrop bypass action
const bypassBtn = document.getElementById("btn-bypass");
if (bypassBtn) {
  bypassBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "BYPASS_OVERLAY" }, (response) => {
        if (response?.removedCount > 0) {
          bypassBtn.textContent = `✅ Removed ${response.removedCount} Overlay(s)`;
        } else {
          bypassBtn.textContent = "No Sign-up Wall Found";
        }
        setTimeout(() => {
          bypassBtn.textContent = "🔓 Bypass Sign-up Wall";
        }, 2000);
      });
    }
  });
}

// Save to Encrypted Vault action
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

// Clear Vault action
const clearVaultBtn = document.getElementById("btn-clear-vault");
if (clearVaultBtn) {
  clearVaultBtn.addEventListener("click", async () => {
    await chrome.storage.local.set({ encryptedVault: [] });
    loadVaultUI();
  });
}

// Initialize on popup open
createPersona();
triggerActiveScan();
loadVaultUI();