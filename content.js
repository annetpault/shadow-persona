// content.js - Scanner, Cyber-Dark HUD Dashboard, Vault Viewer, Typing Jitter, & Wall Bypass

// ==========================================
// 1. Human-Speed Typing Jitter Engine
// ==========================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeWithJitter(element, text) {
  if (!element || !text) return;

  element.focus();
  element.value = "";

  for (let i = 0; i < text.length; i++) {
    element.value += text[i];
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));

    const jitterDelay = Math.floor(Math.random() * (95 - 40 + 1)) + 40;
    await sleep(jitterDelay);
  }

  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

// ==========================================
// 2. Honeypot & Trap Scanner
// ==========================================
function runShadowScan() {
  let hiddenCount = 0;
  let invisibleCount = 0;

  const allInputs = document.querySelectorAll("input");

  allInputs.forEach((box) => {
    if (box.type === "hidden") {
      hiddenCount++;
    } else {
      const style = window.getComputedStyle(box);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        box.offsetWidth === 0 ||
        box.offsetHeight === 0
      ) {
        invisibleCount++;
      }
    }
  });

  const report = {
    totalInputs: allInputs.length,
    hiddenBoxes: hiddenCount,
    invisibleBoxes: invisibleCount,
    isSuspicious: invisibleCount > 0
  };

  chrome.storage.local.set({ scanReport: report });

  if (report.isSuspicious && !document.getElementById("shadow-persona-hud-host")) {
    injectInPageWarning(report);
  }

  return report;
}

// ==========================================
// 3. AES-256-GCM Helpers
// ==========================================
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

// ==========================================
// 4. Redesigned HUD Dashboard
// ==========================================
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

function createLocalPersona() {
  const first = getRandomItem(firstNames);
  const last = getRandomItem(lastNames);
  const num = Math.floor(100 + Math.random() * 900);
  const username = `${first.toLowerCase()}_${last.toLowerCase()}${num}`;
  const domain = "1secmail.com";

  return {
    fullName: `${first} ${last}`,
    username: username,
    email: `${username}@${domain}`,
    login: username,
    domain: domain,
    password: generatePassword()
  };
}

function injectInPageWarning(report) {
  const host = document.createElement("div");
  host.id = "shadow-persona-hud-host";
  host.style.position = "fixed";
  host.style.top = "24px";
  host.style.right = "24px";
  host.style.zIndex = "2147483647";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  let hudPersona = createLocalPersona();

  shadow.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }

      .hud-wrap {
        perspective: 1000px;
      }

      /* Compact Banner Card */
      .hud-banner {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.92));
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(239, 68, 68, 0.35);
        box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        padding: 14px 16px;
        width: 290px;
        animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes slideIn {
        from { transform: translateX(110%) scale(0.95); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }

      .banner-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .banner-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #f87171;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .pulse-dot {
        width: 7px;
        height: 7px;
        background: #ef4444;
        border-radius: 50%;
        box-shadow: 0 0 8px #ef4444;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #64748b;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
      }

      .banner-msg {
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.5;
        margin-bottom: 12px;
      }

      .banner-msg b {
        color: #fca5a5;
        font-weight: 600;
      }

      .btn-mask {
        width: 100%;
        background: linear-gradient(135deg, #2563eb, #3b82f6);
        color: #ffffff;
        border: none;
        border-radius: 9px;
        padding: 9px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-mask:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(37, 99, 235, 0.5);
        background: linear-gradient(135deg, #1d4ed8, #2563eb);
      }

      /* Expanded Control Dashboard */
      .hud-panel {
        display: none;
        background: linear-gradient(180deg, #0d121f 0%, #090d16 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 16px;
        width: 328px;
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
        animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes scaleUp {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: scale(1); }
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        margin-bottom: 12px;
      }

      .panel-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: -0.2px;
      }

      .status-pill {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #f87171;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 9px;
        border-radius: 7px;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 12px;
      }

      .persona-preview {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 12px;
      }

      .preview-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        font-size: 11px;
      }

      .preview-row:not(:last-child) {
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      .row-label {
        color: #64748b;
        font-weight: 500;
      }

      .row-val {
        color: #e2e8f0;
        font-weight: 600;
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .val-mono {
        font-family: 'JetBrains Mono', monospace;
        color: #38bdf8;
      }

      .btn-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }

      .action-btn {
        width: 100%;
        padding: 9px 10px;
        border-radius: 9px;
        border: 1px solid transparent;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }

      .btn-primary {
        background: #2563eb;
        color: #fff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
      }
      .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }

      .btn-subtle {
        background: rgba(255, 255, 255, 0.05);
        color: #cbd5e1;
        border-color: rgba(255, 255, 255, 0.06);
      }
      .btn-subtle:hover { background: rgba(255, 255, 255, 0.09); color: #fff; }

      .btn-emerald {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
        border-color: rgba(16, 185, 129, 0.25);
      }
      .btn-emerald:hover { background: rgba(16, 185, 129, 0.2); }

      .btn-violet {
        background: rgba(139, 92, 246, 0.12);
        color: #a78bfa;
        border-color: rgba(139, 92, 246, 0.25);
      }
      .btn-violet:hover { background: rgba(139, 92, 246, 0.2); }

      /* In-Page Vault Viewer */
      .vault-view {
        display: none;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        max-height: 150px;
        overflow-y: auto;
      }

      .vault-view::-webkit-scrollbar { width: 4px; }
      .vault-view::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }

      .vault-item {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 6px;
        font-size: 10.5px;
      }

      .vault-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        color: #f1f5f9;
        font-weight: 600;
      }

      .vault-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .vault-fill-btn {
        background: #2563eb;
        border: none;
        color: #fff;
        font-size: 9.5px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .vault-fill-btn:hover { background: #1d4ed8; }

      .vault-del-btn {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        font-size: 10px;
        font-weight: bold;
        padding: 1px 5px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .vault-del-btn:hover {
        background: rgba(239, 68, 68, 0.35);
        color: #fff;
      }

      .inbox-section {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .inbox-title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }
    </style>

    <div class="hud-wrap">
      <!-- 1. Compact Banner -->
      <div class="hud-banner" id="hud-banner">
        <div class="banner-head">
          <div class="banner-tag">
            <span class="pulse-dot"></span>
            Trap Detected
          </div>
          <button class="close-btn" id="banner-close">&times;</button>
        </div>
        <div class="banner-msg">
          <b>${report.invisibleBoxes} hidden trap(s) detected.</b>
        </div>
        <button class="btn-mask" id="banner-open-btn">
          ⚡ Mask My Identity
        </button>
      </div>

      <!-- 2. Full In-Page Control Dashboard -->
      <div class="hud-panel" id="hud-panel">
        <div class="panel-header">
          <div class="panel-brand">
            <span>🛡️</span> Shadow Persona
          </div>
          <button class="close-btn" id="panel-close">&times;</button>
        </div>

        <div class="status-pill">
          <span>⚠️</span> ${report.invisibleBoxes} Trap(s) Intercepted & Isolated
        </div>

        <div class="persona-preview">
          <div class="preview-row">
            <span class="row-label">Name</span>
            <span class="row-val" id="hud-name">${hudPersona.fullName}</span>
          </div>
          <div class="preview-row">
            <span class="row-label">Email</span>
            <span class="row-val" id="hud-email" style="color: #60a5fa;">${hudPersona.email}</span>
          </div>
          <div class="preview-row">
            <span class="row-label">Password</span>
            <span class="row-val val-mono" id="hud-pass">${hudPersona.password}</span>
          </div>
        </div>

        <button class="action-btn btn-primary" id="hud-autofill-btn" style="margin-bottom: 8px;">
          ⚡ Autofill With Jitter
        </button>

        <div class="btn-grid">
          <button class="action-btn btn-subtle" id="hud-reroll-btn">
            🔄 Reroll Identity
          </button>
          <button class="action-btn btn-subtle" id="hud-bypass-btn">
            🔓 Bypass Wall
          </button>
          <button class="action-btn btn-emerald" id="hud-vault-btn">
            🔒 Save to Vault
          </button>
          <button class="action-btn btn-violet" id="hud-view-vault-btn">
            📂 View Vault
          </button>
        </div>

        <div class="vault-view" id="hud-vault-view">
          <div id="hud-vault-list"></div>
        </div>

        <div class="inbox-section">
          <div class="inbox-title">Temporary Mailbox Polling</div>
          <button class="action-btn btn-subtle" id="hud-check-inbox">
            📬 Poll OTP / Inbox
          </button>
          <div id="hud-inbox-output" style="margin-top: 6px; font-size: 11px; color: #94a3b8;"></div>
        </div>
      </div>
    </div>
  `;

  const banner = shadow.getElementById("hud-banner");
  const panel = shadow.getElementById("hud-panel");
  const vaultView = shadow.getElementById("hud-vault-view");
  const vaultList = shadow.getElementById("hud-vault-list");

  shadow.getElementById("banner-close").addEventListener("click", () => host.remove());
  shadow.getElementById("panel-close").addEventListener("click", () => host.remove());

  shadow.getElementById("banner-open-btn").addEventListener("click", () => {
    banner.style.display = "none";
    panel.style.display = "block";
  });

  // Action: Autofill Current HUD Persona
  shadow.getElementById("hud-autofill-btn").addEventListener("click", async () => {
    const btn = shadow.getElementById("hud-autofill-btn");
    btn.textContent = "⚡ Emulating Human Keystrokes...";
    btn.disabled = true;
    await fillFormInputs(hudPersona);
    btn.textContent = "✅ Autofill Complete";
    setTimeout(() => {
      btn.textContent = "⚡ Autofill With Jitter";
      btn.disabled = false;
    }, 1500);
  });

  // Action: Reroll Identity
  shadow.getElementById("hud-reroll-btn").addEventListener("click", () => {
    hudPersona = createLocalPersona();
    shadow.getElementById("hud-name").textContent = hudPersona.fullName;
    shadow.getElementById("hud-email").textContent = hudPersona.email;
    shadow.getElementById("hud-pass").textContent = hudPersona.password;
  });

  // Action: Bypass
  shadow.getElementById("hud-bypass-btn").addEventListener("click", () => {
    const btn = shadow.getElementById("hud-bypass-btn");
    const count = removeWall();
    btn.textContent = count > 0 ? `✅ Cleaned ${count} Wall(s)` : "No Walls Found";
    setTimeout(() => {
      btn.textContent = "🔓 Bypass Wall";
    }, 1800);
  });

  // Action: Save to Vault
  shadow.getElementById("hud-vault-btn").addEventListener("click", async () => {
    const btn = shadow.getElementById("hud-vault-btn");
    btn.textContent = "Encrypting...";

    try {
      const key = await getOrCreateVaultKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(hudPersona));
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);

      const record = {
        iv: Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join(""),
        ciphertext: Array.from(new Uint8Array(cipher)).map((b) => b.toString(16).padStart(2, "0")).join(""),
        date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      const data = await chrome.storage.local.get(["encryptedVault"]);
      const vault = data.encryptedVault || [];
      vault.unshift(record);
      await chrome.storage.local.set({ encryptedVault: vault });

      btn.textContent = "✅ Saved (AES)";
      if (vaultView.style.display === "block") {
        renderVaultRecords();
      }
    } catch (e) {
      btn.textContent = "❌ Error";
    }

    setTimeout(() => {
      btn.textContent = "🔒 Save to Vault";
    }, 1500);
  });

  // Helper: Delete single item from vault in content HUD
  async function deleteVaultRecord(indexToRemove) {
    const data = await chrome.storage.local.get(["encryptedVault"]);
    let records = data.encryptedVault || [];
    records.splice(indexToRemove, 1);
    await chrome.storage.local.set({ encryptedVault: records });
    await renderVaultRecords();
  }

  // Action: View Vault (with Fill & Delete per item)
  async function renderVaultRecords() {
    const data = await chrome.storage.local.get(["encryptedVault"]);
    const records = data.encryptedVault || [];

    if (records.length === 0) {
      vaultList.innerHTML = `<span style="color:#64748b;font-size:10px;">Vault is empty.</span>`;
      return;
    }

    vaultList.innerHTML = "";
    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      try {
        const decrypted = await decryptPersona(item);
        const entry = document.createElement("div");
        entry.className = "vault-item";
        entry.innerHTML = `
          <div class="vault-item-header">
            <span>${decrypted.fullName} <span style="color:#64748b;font-weight:400;">(${item.date})</span></span>
            <div class="vault-actions">
              <button class="vault-fill-btn" data-index="${i}">⚡ Fill</button>
              <button class="vault-del-btn" data-index="${i}">✕</button>
            </div>
          </div>
          <div style="color:#60a5fa;margin-bottom:2px;">${decrypted.email}</div>
          <div style="font-family:'JetBrains Mono',monospace;color:#94a3b8;">${decrypted.password}</div>
        `;

        // Wire up per-item Fill
        entry.querySelector(".vault-fill-btn").addEventListener("click", async (e) => {
          const btn = e.target;
          btn.textContent = "Filling...";
          await fillFormInputs(decrypted);
          btn.textContent = "Filled!";
          setTimeout(() => (btn.textContent = "⚡ Fill"), 1200);
        });

        // Wire up per-item Delete
        entry.querySelector(".vault-del-btn").addEventListener("click", async () => {
          await deleteVaultRecord(i);
        });

        vaultList.appendChild(entry);
      } catch (err) {
        console.error("Decryption error", err);
      }
    }
  }

  shadow.getElementById("hud-view-vault-btn").addEventListener("click", async () => {
    const btn = shadow.getElementById("hud-view-vault-btn");
    const isShowing = vaultView.style.display === "block";

    if (isShowing) {
      vaultView.style.display = "none";
      btn.textContent = "📂 View Vault";
    } else {
      vaultView.style.display = "block";
      btn.textContent = "🔼 Hide Vault";
      await renderVaultRecords();
    }
  });

  // Action: Check Inbox / OTP
  shadow.getElementById("hud-check-inbox").addEventListener("click", async () => {
    const out = shadow.getElementById("hud-inbox-output");
    out.innerHTML = "<span style='color:#60a5fa;'>Polling 1secmail...</span>";

    try {
      const res = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${hudPersona.login}&domain=${hudPersona.domain}`);
      const messages = await res.json();

      if (!messages || messages.length === 0) {
        const mockCode = String(Math.floor(100000 + Math.random() * 900000));
        out.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);padding:6px 8px;border-radius:6px;margin-top:4px;">
            <span>No incoming mail</span>
            <button id="in-page-mock-otp" style="background:#2563eb;color:#fff;border:none;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:600;cursor:pointer;">
              Inject OTP: ${mockCode}
            </button>
          </div>
        `;
        shadow.getElementById("in-page-mock-otp")?.addEventListener("click", () => {
          fillOtpInput(mockCode);
          out.innerHTML = `<span style="color:#34d399;">Injected OTP <b>${mockCode}</b></span>`;
        });
      } else {
        const mail = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${hudPersona.login}&domain=${hudPersona.domain}&id=${messages[0].id}`).then((r) => r.json());
        const otpMatch = (mail.textBody || mail.body || "").match(/\b\d{4,6}\b/);
        if (otpMatch) {
          fillOtpInput(otpMatch[0]);
          out.innerHTML = `<span style="color:#34d399;">Detected & Injected OTP: <b>${otpMatch[0]}</b></span>`;
        } else {
          out.innerHTML = `<span style="color:#cbd5e1;">Subject: ${mail.subject}</span>`;
        }
      }
    } catch (e) {
      const demoOtp = String(Math.floor(100000 + Math.random() * 900000));
      out.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);padding:6px 8px;border-radius:6px;margin-top:4px;">
          <span style="color:#f59e0b;">Offline Fallback</span>
          <button id="in-page-demo-btn" style="background:#2563eb;color:#fff;border:none;border-radius:5px;padding:3px 7px;font-size:10px;font-weight:600;cursor:pointer;">
            Inject OTP: ${demoOtp}
          </button>
        </div>
      `;
      shadow.getElementById("in-page-demo-btn")?.addEventListener("click", () => {
        fillOtpInput(demoOtp);
        out.innerHTML = `<span style="color:#34d399;">Applied OTP <b>${demoOtp}</b></span>`;
      });
    }
  });
}

function fillOtpInput(code) {
  const otpInput = document.querySelector(
    "input[name*='otp' i], input[id*='otp' i], input[placeholder*='otp' i], input[placeholder*='code' i], input[name*='code' i]"
  );
  if (otpInput) {
    typeWithJitter(otpInput, code);
  }
}

// ==========================================
// 5. Core Autofill Mechanism (Sequential Jitter)
// ==========================================
async function fillFormInputs(persona) {
  if (!persona) return;
  const inputs = document.querySelectorAll("input");
  let filledCount = 0;

  for (const input of inputs) {
    const style = window.getComputedStyle(input);

    if (
      input.type === "hidden" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      input.offsetWidth === 0 ||
      input.offsetHeight === 0
    ) {
      continue;
    }

    const inputName = (input.name || "").toLowerCase();
    const inputId = (input.id || "").toLowerCase();
    const inputType = (input.type || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();

    if (inputType === "password" || inputName.includes("pass") || inputId.includes("pass")) {
      await typeWithJitter(input, persona.password);
      filledCount++;
    } else if (
      inputType === "email" ||
      inputName.includes("mail") ||
      inputId.includes("mail") ||
      placeholder.includes("mail")
    ) {
      await typeWithJitter(input, persona.email);
      filledCount++;
    } else if (
      (inputType === "text" || inputType === "") &&
      !inputName.includes("otp") &&
      !inputId.includes("otp") &&
      !placeholder.includes("otp") &&
      !placeholder.includes("code") &&
      !inputName.includes("code") &&
      (
        inputName.includes("user") ||
        inputId.includes("user") ||
        placeholder.includes("user") ||
        inputName.includes("name") ||
        inputId.includes("name") ||
        placeholder.includes("name") ||
        inputName.includes("full")
      )
    ) {
      await typeWithJitter(input, persona.fullName);
      filledCount++;
    }
  }

  console.log(`🛡️ Shadow Persona auto-filled ${filledCount} field(s) with typing jitter.`);
}

// ==========================================
// 6. Anti-Paywall / Sign-up Wall Bypass Engine
// ==========================================
const WALL_SELECTORS = [
  "#overlay",
  "#signup-wall",
  "#reg-overlay",
  ".modal-backdrop",
  ".overlay",
  ".registration-wall",
  "[id*='wall' i]",
  "[class*='wall' i]",
  "[id*='overlay' i]",
  "[class*='overlay' i]",
  "[id*='modal' i]"
];

function detectWall() {
  for (const selector of WALL_SELECTORS) {
    const el = document.querySelector(selector);
    if (el && el.id !== "shadow-persona-hud-host") {
      return true;
    }
  }

  const fixedElements = Array.from(document.querySelectorAll("div")).filter((el) => {
    if (el.id === "shadow-persona-hud-host" || el.closest("#shadow-persona-hud-host")) return false;
    const style = window.getComputedStyle(el);
    return (
      (style.position === "fixed" || style.position === "absolute") &&
      parseInt(style.zIndex, 10) > 10 &&
      el.offsetWidth >= window.innerWidth * 0.8 &&
      el.offsetHeight >= window.innerHeight * 0.8
    );
  });

  return fixedElements.length > 0;
}

function removeWall() {
  let removedCount = 0;

  WALL_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.id !== "shadow-persona-hud-host" && !el.closest("#shadow-persona-hud-host")) {
        el.remove();
        removedCount++;
      }
    });
  });

  document.querySelectorAll("div").forEach((el) => {
    if (el.id === "shadow-persona-hud-host" || el.closest("#shadow-persona-hud-host")) return;
    const style = window.getComputedStyle(el);
    if (
      (style.position === "fixed" || style.position === "absolute") &&
      parseInt(style.zIndex, 10) > 10 &&
      el.offsetWidth >= window.innerWidth * 0.8 &&
      el.offsetHeight >= window.innerHeight * 0.8
    ) {
      el.remove();
      removedCount++;
    }
  });

  document.body.style.overflow = "auto";
  document.documentElement.style.overflow = "auto";
  document.body.style.filter = "none";

  document.querySelectorAll("*").forEach((el) => {
    if (window.getComputedStyle(el).filter !== "none") {
      el.style.filter = "none";
    }
  });

  console.log(`🔓 ShadowPersona removed ${removedCount} paywall/overlay element(s).`);
  return removedCount;
}

// ==========================================
// 7. Message Listener for Extension Popup
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "REQUEST_SCAN") {
    const report = runShadowScan();
    sendResponse(report);
    return false;
  }

  if (request.action === "CHECK_WALL") {
    sendResponse({ wallDetected: detectWall() });
    return false;
  }

  if (request.action === "BYPASS_OVERLAY" || request.action === "BYPASS_WALL") {
    const count = removeWall();
    sendResponse({ success: true, removedCount: count });
    return false;
  }

  if (request.action === "AUTOFILL_PAGE") {
    sendResponse({ status: "started" });
    fillFormInputs(request.persona).catch(console.error);
    return false;
  }

  if (request.action === "FILL_OTP") {
    fillOtpInput(request.otp);
    sendResponse({ success: true });
    return false;
  }
});

// Run scan on page load
runShadowScan();