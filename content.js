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
  console.log("🛡️ Shadow Persona Scan Completed:", report);
}

runShadowScan();

// Listen for Autofill commands from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTOFILL_PAGE") {
    const persona = request.persona;
    const inputs = document.querySelectorAll("input");

    inputs.forEach((input) => {
      // Do not touch hidden or invisible inputs
      if (input.type === "hidden" || input.offsetWidth === 0 || input.offsetHeight === 0) {
        return;
      }

      const inputName = (input.name || "").toLowerCase();
      const inputId = (input.id || "").toLowerCase();
      const inputType = (input.type || "").toLowerCase();
      const placeholder = (input.placeholder || "").toLowerCase();

      // Password fields
      if (inputType === "password" || inputName.includes("pass") || inputId.includes("pass")) {
        input.value = persona.password;
      }
      // Username or Name fields
      else if (
        inputType === "text" &&
        (inputName.includes("user") || inputId.includes("user") || placeholder.includes("user"))
      ) {
        input.value = persona.username;
      }
      // General name field
      else if (inputType === "text" && (inputName.includes("name") || inputId.includes("name"))) {
        input.value = persona.fullName;
      }
      
      // Dispatch input event so forms recognize the typing
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    console.log("⚡ Shadow Persona Auto-filled form with mock data!");
  }
});