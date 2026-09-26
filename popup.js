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
  } catch (err) {
    activePersona = {
      fullName: `${first} ${last}`,
      username: username,
      email: `${username}@shadowmail.local`,
      login: username,
      domain: "shadowmail.local",
      password: password
    };
  }

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

function startAutoInboxListener() {
  if (autoPollTimer) clearInterval(autoPollTimer);
  if (!activePersona.login || !activePersona.domain) return;

  const inboxStatus = document.getElementById("inbox-status");
  if (inboxStatus) {
    inboxStatus.innerHTML = `Inbox: ⏳ Listening on <code>${activePersona.login}@${activePersona.domain}</code>...`;
  }

  checkInbox(true);
  autoPollTimer = setInterval(async () => {
    await checkInbox(true);
  }, 2500);
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
      } else if (!isAuto) {
        listEl.innerHTML = "<span style='font-size:11px;color:#94a3b8'>No emails received yet.</span>";
      }
    }
  } catch (err) {
    if (!isAuto) {
      listEl.innerHTML = "<span style='font-size:11px;color:#ef4444'>Backend connection offline.</span>";
    }
  }
}

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

// AES-256 Vault Helpers
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

// Button Listeners
document.getElementById("btn-regen").addEventListener("click", () => {
  createPersona();
});

const checkMailBtn = document.getElementById("btn-check-mail");
if (checkMailBtn) {
  checkMailBtn.addEventListener("click", () => checkInbox(false));
}

// Send Test OTP Button
const simulateOtpBtn = document.getElementById("btn-simulate-otp");
if (simulateOtpBtn) {
  simulateOtpBtn.addEventListener("click", async () => {
    if (!activePersona.email) return;
    simulateOtpBtn.textContent = "Sending...";
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/inbox/simulate?email=${encodeURIComponent(activePersona.email)}`);
      const data = await res.json();
      simulateOtpBtn.textContent = "Sent!";
      setTimeout(() => (simulateOtpBtn.textContent = "⚡ Send Test OTP"), 1500);
      await checkInbox(false);
    } catch (e) {
      simulateOtpBtn.textContent = "Error";
      setTimeout(() => (simulateOtpBtn.textContent = "⚡ Send Test OTP"), 1500);
    }
  });
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

initPersona();
triggerActiveScan();
loadVaultUI();