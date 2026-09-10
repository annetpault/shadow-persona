function runShadowScan() {
  let hiddenCount = 0;
  let invisibleCount = 0;

  // Grab every input typing box on the page
  const allInputs = document.querySelectorAll("input");

  allInputs.forEach((box) => {
    // Check if the HTML explicitly marks it as hidden
    if (box.type === "hidden") {
      hiddenCount++;
    } else {
      // Check if CSS rules make it invisible to human eyes
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

  // Save the report into browser memory
  chrome.storage.local.set({ scanReport: report });
  console.log("🛡️ Shadow Persona Scan Completed:", report);
}

// Run the scan when the page finishes loading
runShadowScan();