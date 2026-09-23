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

let autoPollTimer = null;

// 1. Load existing persona from storage or generate a new one
async function initPersona() {
  const stored = await chrome.storage.local.get("activePersona");
  if (stored.activePersona && stored.activePersona.email) {
    activePersona = stored.activePersona;
    updateUI();
    startAutoInboxListener();
  } else {
    await createPersona();
  }
}

// Generate new persona and save to storage (only on fresh boot or reroll)
async function createPersona() {
  const first = getRandomItem(firstNames);
  const last = getRandomItem(lastNames);
  const num = Math.floor(100 + Math.random() * 900);
  const username = `${first.toLowerCase()}_${last.toLowerCase()}${num}`;
  const password = generatePassword();

  const emailEl = document.getElementById("mock-email");
  if (emailEl) emailEl.textContent = "Generating...";

  try {
    const backendRes = await fetch("http://127.0.0.1:8000/api/persona");
    if (backendRes.ok) {
      activePersona = await backendRes.json();
    } else {
      throw new Error("FastAPI offline");
    }
  } catch (backendErr) {
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
      activePersona = {
        fullName: `${first} ${last}`,
        username: username,
        email: `${username}@1secmail.com`,
        login: username,
        domain: "1secmail.com",
        password: password
      };
    }
  }

  // Save to Chrome Storage so closing the popup doesn't lose the address
  await chrome.storage.local.set({ activePersona });

  updateUI();
  startAutoInboxListener();
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

// 2. Automated Polling Engine & OTP Interceptor
function startAutoInboxListener() {
  if (autoPollTimer) clearInterval(autoPollTimer);
  if (!activePersona.login || !activePersona.domain) return;

  const inboxStatus = document.getElementById("inbox-status");
  if (inboxStatus) {
    inboxStatus.innerHTML = `Inbox: ⏳ Listening for OTP on <code>${activePersona.login}@${activePersona.domain}</code>...`;
  }

  // Poll immediately, then every 4 seconds
  checkInbox(true);
  autoPollTimer = setInterval(async () => {
    await checkInbox(true);
  }, 4000);
}

async function checkInbox(isAuto = false) {
  if (!activePersona.login || !activePersona.domain) return;
  const listEl = document.getElementById("mail-list");
  const inboxStatus = document.getElementById("inbox-status");
  if (!listEl) return;

  if (!isAuto) {
    listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>Checking...</span>";
  }

  try {
    // 1. Try FastAPI backend first
    try {
      const apiRes = await fetch(
        `http://127.0.0.1:8000/api/inbox/otp?login=${encodeURIComponent(activePersona.login)}&domain=${encodeURIComponent(activePersona.domain)}`
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.status === "success" && data.otp) {
          clearInterval(autoPollTimer);

          if (inboxStatus) {
            inboxStatus.innerHTML = `<span style="color:#16a34a; font-weight:bold;">🎉 OTP Received & Verified!</span>`;
          }

          listEl.innerHTML = `
            <div class="mail-item" style="border-left-color: #16a34a; background: #dcfce7; color: #166534; padding: 6px;">
              <b>From:</b> ${data.from || "Verification"}<br>
              <b>Subject:</b> ${data.subject || "OTP Code"}<br>
              <div style="font-size: 15px; font-weight: bold; letter-spacing: 2px; margin-top: 4px;">
                Code: ${data.otp}
              </div>
            </div>
          `;

          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL_OTP", otp: data.otp });
          }
          return;
        }
      }
    } catch (_) {}

    // 2. Direct 1secmail fallback
    const res = await fetch(
      `https://www.1secmail.com/api/v1/?action=getMessages&login=${activePersona.login}&domain=${activePersona.domain}`
    );
    const messages = await res.json();

    if (messages.length === 0) {
      if (!isAuto) {
        listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>No emails received yet.</span>";
      }
    } else {
      listEl.innerHTML = "";
      for (const msg of messages.slice(0, 2)) {
        const mailDetail = await fetch(
          `https://www.1secmail.com/api/v1/?action=readMessage&login=${activePersona.login}&domain=${activePersona.domain}&id=${msg.id}`
        ).then((r) => r.json());

        const otpMatch = mailDetail.textBody ? mailDetail.textBody.match(/\b\d{4,8}\b/) : null;
        const detectedOtp = otpMatch ? otpMatch[0] : null;

        if (detectedOtp) {
          clearInterval(autoPollTimer);
          if (inboxStatus) {
            inboxStatus.innerHTML = `<span style="color:#16a34a; font-weight:bold;">🎉 OTP Intercepted!</span>`;
          }

          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL_OTP", otp: detectedOtp });
          }
        }

        const item = document.createElement("div");
        item.className = "mail-item";
        item.innerHTML = `
          <b>From:</b> ${msg.from}<br>
          <b>Subject:</b> ${msg.subject}<br>
          ${detectedOtp ? `<b style="color:#16a34a; font-size:13px;">OTP: ${detectedOtp}</b><br>` : ""}
          <b>Preview:</b> ${mailDetail.textBody.substring(0, 80)}...
        `;
        listEl.appendChild(item);
      }
    }
  } catch (e) {
    if (!isAuto) {
      listEl.innerHTML = "<span style='font-size:11px;color:#ef4444'>Failed to fetch messages.</span>";
    }
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
      statusBox.textContent = "🛡️ Protected: No Traps";
      statusBox.className = "badge safe";
    }
  }
}

// 4. Request live DOM scan from content.js
async function triggerActiveScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "REQUEST_SCAN" }, (response) => {
      if (!chrome.runtime.lastError && response) {
        renderScanReport(response);
      }
    });
  }
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

// 5. Button Actions
document.getElementById("btn-regen").addEventListener("click", () => {
  createPersona(); // Generates and saves a brand new persona
});

const checkMailBtn = document.getElementById("btn-check-mail");
if (checkMailBtn) {
  checkMailBtn.addEventListener("click", () => checkInbox(false));
}

document.getElementById("btn-fill").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "AUTOFILL_PAGE",
      persona: activePersona
    });
  }
});

const bypassBtn = document.getElementById("btn-bypass");
if (bypassBtn) {
  bypassBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "BYPASS_OVERLAY" }, (response) => {
        if (response?.removedCount > 0) {
          bypassBtn.textContent = `✅ Removed Wall`;
        } else {
          bypassBtn.textContent = "No Sign-up Wall Found";
        }
        setTimeout(() => {
          bypassBtn.textContent = "🔓 Bypass Sign-up Wall";
        }, 1800);
      });
    }
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

// Initial Boot: restore saved persona or create one
initPersona();
triggerActiveScan();
loadVaultUI();