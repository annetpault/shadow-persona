// content.js - Scanner, In-Page HUD Injection, and Form Filler

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

  // If suspicious traps or high input volume are found, inject the floating HUD
  if (report.isSuspicious && !document.getElementById("shadow-persona-hud-host")) {
    injectInPageWarning(report);
  }
}

// Inject an isolated floating widget via Shadow DOM
function injectInPageWarning(report) {
  const host = document.createElement("div");
  host.id = "shadow-persona-hud-host";
  host.style.position = "fixed";
  host.style.top = "20px";
  host.style.right = "20px";
  host.style.zIndex = "2147483647"; // Ensure it stays on top of page elements
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      .hud-card {
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #ef4444;
        border-radius: 10px;
        padding: 14px 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 270px;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .hud-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .hud-title {
        font-size: 13px;
        font-weight: 700;
        color: #fca5a5;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .hud-close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .hud-close:hover { color: #ffffff; }
      .hud-desc {
        font-size: 11px;
        color: #cbd5e1;
        line-height: 1.4;
        margin-bottom: 12px;
      }
      .hud-btn {
        width: 100%;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .hud-btn:hover { background: #1d4ed8; }
    </style>

    <div class="hud-card">
      <div class="hud-header">
        <span class="hud-title">🛡️ Trap Detected</span>
        <button class="hud-close" id="hud-dismiss">&times;</button>
      </div>
      <div class="hud-desc">
        Shadow Persona found <b>${report.invisibleBoxes}</b> deceptive hidden input(s) on this form.
      </div>
      <button class="hud-btn" id="hud-mask-btn">⚡ Mask My Identity</button>
    </div>
  `;

  // Dismiss button handler
  shadow.getElementById("hud-dismiss").addEventListener("click", () => {
    host.remove();
  });

  // Direct In-Page Autofill handler
  shadow.getElementById("hud-mask-btn").addEventListener("click", async () => {
    const btn = shadow.getElementById("hud-mask-btn");
    btn.textContent = "Generating...";
    btn.disabled = true;

    // Fetch burner email
    let mockEmail = `shadow_${Math.floor(1000 + Math.random() * 9000)}@1secmail.com`;
    try {
      const res = await fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
      const [apiEmail] = await res.json();
      if (apiEmail) mockEmail = apiEmail;
    } catch (e) {
      console.warn("Using offline burner email fallback");
    }

    const mockPersona = {
      fullName: "Alex Vance",
      email: mockEmail,
      password: "P@" + Math.random().toString(36).slice(-8) + "9!"
    };

    fillFormInputs(mockPersona);
    btn.textContent = "✅ Identity Applied!";
    setTimeout(() => host.remove(), 2000);
  });
}

// Core autofill mechanism
function fillFormInputs(persona) {
  const inputs = document.querySelectorAll("input");
  let filledCount = 0;

  inputs.forEach((input) => {
    const style = window.getComputedStyle(input);
    if (
      input.type === "hidden" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      input.offsetWidth === 0 ||
      input.offsetHeight === 0
    ) {
      return;
    }

    const inputName = (input.name || "").toLowerCase();
    const inputId = (input.id || "").toLowerCase();
    const inputType = (input.type || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();

    if (inputType === "password" || inputName.includes("pass") || inputId.includes("pass")) {
      input.value = persona.password;
      filledCount++;
    } else if (inputType === "email" || inputName.includes("mail") || inputId.includes("mail") || placeholder.includes("mail")) {
      input.value = persona.email;
      filledCount++;
    } else if (
      inputType === "text" ||
      inputName.includes("user") ||
      inputId.includes("user") ||
      placeholder.includes("user") ||
      inputName.includes("name") ||
      inputId.includes("name")
    ) {
      input.value = persona.fullName;
      filledCount++;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  console.log(`🛡️ Shadow Persona auto-filled ${filledCount} field(s).`);
}

// External message listener (from popup.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTOFILL_PAGE") {
    fillFormInputs(request.persona);
    sendResponse({ status: "success" });
  }
  return true;
});

// Run scan on load
runShadowScan();