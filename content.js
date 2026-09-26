// ============================================================================
// Shadow Persona - content.js (Full Engine)
// Modules:
// 1. Advanced Deceptive Honeypot & Bot-Trap Detection Engine
// 2. Persona Form Autofill with Field-Type Isolation
// 3. Dynamic DOM Mutation Observer
// 4. Automated Verification Code (OTP) Injector
// 5. Aggressive Paywall & Modal Overlay Neutralizer
// ============================================================================

// --- MODULE 1: COMPREHENSIVE HONEYPOT & TRAP DETECTION ENGINE ---

function isElementHiddenOrTrap(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  // 1. Explicit display/visibility hiding
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    parseFloat(style.opacity) === 0 ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return true;
  }

  // 2. Zero-dimension rendering
  if (
    rect.width === 0 ||
    rect.height === 0 ||
    parseFloat(style.width) === 0 ||
    parseFloat(style.height) === 0 ||
    parseFloat(style.maxHeight) === 0
  ) {
    return true;
  }

  // 3. Off-screen absolute or fixed positioning
  const left = rect.left;
  const top = rect.top;
  if (
    left < -999 ||
    top < -999 ||
    parseFloat(style.left) < -999 ||
    parseFloat(style.top) < -999
  ) {
    return true;
  }

  // 4. CSS Clipping / Collapsed bounds
  if (
    style.clipPath === "inset(50%)" ||
    style.clipPath === "polygon(0px 0px, 0px 0px, 0px 0px)" ||
    (style.clip && style.clip !== "auto" && style.clip.includes("rect(0"))
  ) {
    return true;
  }

  // 5. CSS Transformation scaling to zero
  if (
    style.transform.includes("matrix(0,") ||
    style.transform.includes("scale(0)")
  ) {
    return true;
  }

  // 6. Zero font size / zero line height hiding
  if (
    parseFloat(style.fontSize) === 0 ||
    parseFloat(style.lineHeight) === 0
  ) {
    return true;
  }

  // 7. Text color matches background color (camouflage)
  if (
    style.color === style.backgroundColor &&
    style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
    style.backgroundColor !== "transparent"
  ) {
    return true;
  }

  // 8. Trap naming conventions used by anti-bot frameworks
  const identifier = `${element.name || ""} ${element.id || ""} ${element.className || ""}`.toLowerCase();
  const trapKeywords = ["hidden", "decoy", "trap", "bot", "honeypot", "fake", "website_hp"];
  const matchesTrapName = trapKeywords.some((word) => identifier.includes(word));

  if (matchesTrapName) {
    return true;
  }

  // 9. Negative tabIndex combined with non-standard positioning
  if (element.tabIndex === -1 && (style.position === "absolute" || style.position === "fixed")) {
    return true;
  }

  return false;
}

function scanPageInputs() {
  const inputs = Array.from(
    document.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])")
  );

  let totalInputs = inputs.length;
  let invisibleBoxes = 0;
  let hiddenBoxes = 0;

  inputs.forEach((input) => {
    const isTrap = isElementHiddenOrTrap(input);

    if (isTrap) {
      invisibleBoxes++;
      input.classList.add("shadow-persona-trap");
      input.setAttribute("data-shadow-trap", "true");
      input.style.border = "2px dashed #ef4444";
      input.style.backgroundColor = "#fee2e2";
      input.setAttribute("title", "⚠️ Shadow Persona: Detected Deceptive Honeypot Trap");
    } else {
      input.removeAttribute("data-shadow-trap");
      input.classList.remove("shadow-persona-trap");
    }
  });

  const report = {
    totalInputs,
    hiddenBoxes,
    invisibleBoxes,
    isSuspicious: invisibleBoxes > 0
  };

  // Sync findings to storage for extension badge access
  chrome.storage.local.set({ scanReport: report });
  return report;
}

// --- MODULE 2: DYNAMIC DOM MUTATION OBSERVER ---

const domObserver = new MutationObserver(() => {
  scanPageInputs();
});

domObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class", "hidden"]
});

// --- MODULE 3: AUTOMATED FORM FILLER & OTP PROTECTION ---

function autofillPersonaForm(persona) {
  const inputs = document.querySelectorAll("input, select, textarea");

  inputs.forEach((field) => {
    // Never autofill marked honeypot traps
    if (field.getAttribute("data-shadow-trap") === "true") return;

    const name = (field.name || "").toLowerCase();
    const id = (field.id || "").toLowerCase();
    const type = (field.type || "text").toLowerCase();
    const autocomplete = (field.autocomplete || "").toLowerCase();
    const placeholder = (field.placeholder || "").toLowerCase();

    // STRICT CHECK: Disallow persona names from entering OTP / verification inputs
    const isOtpField =
      name.includes("otp") ||
      id.includes("otp") ||
      name.includes("code") ||
      id.includes("code") ||
      placeholder.includes("code") ||
      placeholder.includes("otp") ||
      autocomplete === "one-time-code" ||
      field.maxLength === 6 ||
      field.maxLength === 4;

    if (isOtpField) return;

    // Email fields
    if (type === "email" || name.includes("mail") || id.includes("mail") || autocomplete.includes("email")) {
      field.value = persona.email;
    }
    // Password fields
    else if (type === "password" || name.includes("pass") || id.includes("pass") || autocomplete.includes("password")) {
      field.value = persona.password;
    }
    // Username fields
    else if (name.includes("user") || id.includes("user") || autocomplete.includes("username")) {
      field.value = persona.username;
    }
    // Phone fields (skip or provide empty decoy if needed)
    else if (type === "tel" || name.includes("phone") || id.includes("phone")) {
      field.value = "";
    }
    // Checkboxes (Terms of service / Privacy policies)
    else if (type === "checkbox") {
      const parentText = (field.parentElement?.innerText || "").toLowerCase();
      if (parentText.includes("agree") || parentText.includes("terms") || parentText.includes("privacy")) {
        field.checked = true;
      }
    }
    // General Name inputs
    else if (
      name.includes("name") ||
      id.includes("name") ||
      placeholder.includes("name") ||
      type === "text"
    ) {
      field.value = persona.fullName;
    }

    // Dispatch input & change events for modern reactive web frameworks (React, Vue, Angular)
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// --- MODULE 4: AUTOMATED OTP INJECTION ---

function injectVerificationOtp(otpCode) {
  const otpInputs = document.querySelectorAll(
    'input[name*="otp" i], input[id*="otp" i], input[name*="code" i], input[id*="code" i], input[placeholder*="code" i], input[placeholder*="otp" i], input[autocomplete="one-time-code"], input[maxlength="6"], input[maxlength="4"]'
  );

  let injected = false;
  otpInputs.forEach((input) => {
    // Ensure it is not a trap
    if (input.getAttribute("data-shadow-trap") === "true") return;

    input.focus();
    input.value = otpCode;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    injected = true;
    console.log("🛡️ Shadow Persona: Injected OTP ->", otpCode);
  });

  return injected;
}

// --- MODULE 5: AGGRESSIVE PAYWALL & OVERLAY REMOVER ---

function bypassPaywallAndOverlays() {
  let removedCount = 0;

  // Target common backdrop, modal, paywall, and overlay identifiers
  const selectors = [
    "#signup-overlay",
    ".modal-backdrop",
    '[class*="overlay" i]',
    '[class*="modal" i]',
    '[class*="backdrop" i]',
    '[class*="paywall" i]',
    '[id*="overlay" i]',
    '[id*="modal" i]',
    '[id*="paywall" i]',
    '[role="dialog"]',
    '[aria-modal="true"]'
  ];

  const elements = document.querySelectorAll(selectors.join(", "));

  elements.forEach((el) => {
    // Safety check: do not delete the entire body, main container, or forms
    const tag = el.tagName.toLowerCase();
    if (tag === "body" || tag === "html" || tag === "main" || tag === "form") return;

    el.remove();
    removedCount++;
  });

  // Re-enable document scrolling locked by paywalls
  document.body.style.overflow = "auto";
  document.body.style.position = "static";
  document.documentElement.style.overflow = "auto";

  // Remove blur and grayscale filters applied to paywalled content
  const blurredElements = document.querySelectorAll("*");
  blurredElements.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.filter && style.filter.includes("blur")) {
      el.style.filter = "none";
    }
  });

  return removedCount;
}

// --- MESSAGE DISPATCHER (Popup <-> Content Script) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "REQUEST_SCAN") {
    const report = scanPageInputs();
    sendResponse(report);
    return true;
  }

  if (request.action === "AUTOFILL_PAGE" && request.persona) {
    autofillPersonaForm(request.persona);
    sendResponse({ status: "success" });
    return true;
  }

  if (request.action === "AUTOFILL_OTP" && request.otp) {
    const success = injectVerificationOtp(request.otp);
    sendResponse({ status: success ? "injected" : "not_found" });
    return true;
  }

  if (request.action === "BYPASS_OVERLAY") {
    const count = bypassPaywallAndOverlays();
    sendResponse({ removedCount: count });
    return true;
  }
});

// Run scan on initial page load
scanPageInputs();