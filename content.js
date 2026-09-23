// --- MODULE 1: Trap Scanner & Honeypot Neutralizer ---
function scanPageInputs() {
  const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button'])"));
  let totalInputs = inputs.length;
  let invisibleBoxes = 0;
  let hiddenBoxes = 0;

  inputs.forEach((input) => {
    const style = window.getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    const isHidden = 
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) === 0 ||
      rect.width === 0 ||
      rect.height === 0 ||
      input.getAttribute("aria-hidden") === "true";

    const isTrapName = /hidden|decoy|trap|bot|honeypot/i.test(input.name || "") || 
                       /hidden|decoy|trap|bot|honeypot/i.test(input.id || "");

    if (isHidden || isTrapName) {
      invisibleBoxes++;
      input.classList.add("shadow-persona-trap");
      input.setAttribute("data-shadow-trap", "true");
      input.style.border = "2px dashed #ef4444";
    }
  });

  return {
    totalInputs,
    hiddenBoxes,
    invisibleBoxes,
    isSuspicious: invisibleBoxes > 0
  };
}

// --- MODULES 2, 3, & 4: Cross-Script Communication ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Live DOM Trap Scan Request
  if (request.action === "REQUEST_SCAN") {
    const report = scanPageInputs();
    sendResponse(report);
    return true;
  }

  // 2. Identity Autofill (Excludes hidden traps and OTP fields)
  if (request.action === "AUTOFILL_PAGE" && request.persona) {
    const p = request.persona;
    const inputs = document.querySelectorAll("input");

    inputs.forEach((input) => {
      // Do not touch honeypot traps
      if (input.getAttribute("data-shadow-trap") === "true") return;

      const name = (input.name || "").toLowerCase();
      const id = (input.id || "").toLowerCase();
      const type = (input.type || "text").toLowerCase();

      // STRICT PROTECTION: Do not place persona names into OTP boxes
      const isOtpField = name.includes("otp") || id.includes("otp") || 
                         name.includes("code") || id.includes("code") || 
                         input.maxLength === 6 || input.maxLength === 4;
      if (isOtpField) return;

      // Fill Email
      if (type === "email" || name.includes("mail") || id.includes("mail")) {
        input.value = p.email;
      }
      // Fill Password
      else if (type === "password" || name.includes("pass") || id.includes("pass")) {
        input.value = p.password;
      }
      // Fill Username
      else if (name.includes("user") || id.includes("user")) {
        input.value = p.username;
      } 
      // Fill Full Name
      else if (name.includes("name") || id.includes("name") || type === "text") {
        input.value = p.fullName;
      }

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    sendResponse({ status: "autofilled" });
    return true;
  }

  // 3. Automated OTP Injector
  if (request.action === "AUTOFILL_OTP" && request.otp) {
    const otpInput = document.querySelector(
      'input[name*="otp" i], input[id*="otp" i], input[name*="code" i], input[id*="code" i], input[autocomplete="one-time-code"], input[maxlength="6"], input[maxlength="4"]'
    );

    if (otpInput) {
      otpInput.focus();
      otpInput.value = request.otp;
      otpInput.dispatchEvent(new Event("input", { bubbles: true }));
      otpInput.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("🛡️ Shadow Persona: OTP auto-injected successfully ->", request.otp);
    }
    return true;
  }

  // 4. Sign-up Wall / Backdrop Remover
  if (request.action === "BYPASS_OVERLAY") {
    let removed = 0;
    const candidates = document.querySelectorAll(
      '[class*="overlay" i], [class*="modal" i], [class*="backdrop" i], [id*="overlay" i], [id*="modal" i], [id*="paywall" i]'
    );

    candidates.forEach((el) => {
      el.remove();
      removed++;
    });

    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    sendResponse({ removedCount: removed });
    return true;
  }
});

// Run initial scan
scanPageInputs();