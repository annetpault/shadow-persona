// ============================================================================
// Shadow Persona - content.js (High-Performance Engine)
// Modules:
// 1. Deceptive Honeypot & Bot-Trap Detection Engine
// 2. Persona Form Autofill with Field-Type Isolation
// 3. Debounced Non-Looping DOM Mutation Observer (Freeze Fix)
// 4. Automated Verification Code (OTP) Injector
// 5. Paywall & Modal Overlay Neutralizer
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
    (rect.width === 0 && rect.height === 0) ||
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

  // 7. Camouflage (text color matches background color)
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

let isScanning = false;

function scanPageInputs() {
  if (isScanning) return;
  isScanning = true;

  try {
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
        if (!input.classList.contains("shadow-persona-trap")) {
          input.classList.add("shadow-persona-trap");
          input.setAttribute("data-shadow-trap", "true");
          input.style.border = "2px dashed #ef4444";
          input.style.backgroundColor = "#fee2e2";
          input.setAttribute("title", "⚠️ Shadow Persona: Detected Deceptive Honeypot Trap");
        }
      } else {
        if (input.classList.contains("shadow-persona-trap")) {
          input.removeAttribute("data-shadow-trap");
          input.classList.remove("shadow-persona-trap");
          input.style.border = "";
          input.style.backgroundColor = "";
          input.removeAttribute("title");
        }
      }
    });

    const report = {
      totalInputs,
      hiddenBoxes,
      invisibleBoxes,
      isSuspicious: invisibleBoxes > 0
    };

    chrome.storage.local.set({ scanReport: report });
    return report;
  } finally {
    isScanning = false;
  }
}

// --- MODULE 2: DEBOUNCED DOM MUTATION OBSERVER (PREVENTS FREEZING) ---

let debounceTimeout = null;

const domObserver = new MutationObserver((mutations) => {
  // Only trigger when input elements are actually added to the DOM
  const hasRelevantMutations = mutations.some((m) => {
    return Array.from(m.addedNodes).some(
      (node) => node.nodeType === 1 && (node.tagName === "INPUT" || node.querySelector?.("input"))
    );
  });

  if (!hasRelevantMutations) return;

  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    scanPageInputs();
  }, 500);
});

// Observe node additions only; strictly avoid style/attribute listeners to prevent infinite loops
domObserver.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

// --- MODULE 3: AUTOMATED FORM FILLER & OTP PROTECTION ---

function autofillPersonaForm(persona) {
  const inputs = document.querySelectorAll("input, select, textarea");

  inputs.forEach((field) => {
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

    // Fill Email
    if (type === "email" || name.includes("mail") || id.includes("mail") || autocomplete.includes("email")) {
      field.value = persona.email;
    }
    // Fill Password
    else if (type === "password" || name.includes("pass") || id.includes("pass") || autocomplete.includes("password")) {
      field.value = persona.password;
    }
    // Fill Username
    else if (name.includes("user") || id.includes("user") || autocomplete.includes("username")) {
      field.value = persona.username;
    }
    // Fill Terms / Checkbox
    else if (type === "checkbox") {
      const parentText = (field.parentElement?.innerText || "").toLowerCase();
      if (parentText.includes("agree") || parentText.includes("terms") || parentText.includes("privacy")) {
        field.checked = true;
      }
    }
    // Fill Full Name
    else if (
      name.includes("name") ||
      id.includes("name") ||
      placeholder.includes("name") ||
      type === "text"
    ) {
      field.value = persona.fullName;
    }

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
    if (input.getAttribute("data-shadow-trap") === "true") return;

    input.focus();
    input.value = otpCode;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    injected = true;
  });

  return injected;
}

// --- MODULE 5: PAYWALL & OVERLAY REMOVER ---

function bypassPaywallAndOverlays() {
  let removedCount = 0;

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
    const tag = el.tagName.toLowerCase();
    if (tag === "body" || tag === "html" || tag === "main" || tag === "form") return;
    el.remove();
    removedCount++;
  });

  document.body.style.overflow = "auto";
  document.body.style.position = "static";
  document.documentElement.style.overflow = "auto";

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

// Run a single initial scan after the DOM has parsed
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanPageInputs);
} else {
  scanPageInputs();
}