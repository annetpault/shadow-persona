chrome.storage.local.get(["scanReport"], (data) => {
  const report = data.scanReport;
  if (!report) return;

  document.getElementById("total").textContent = report.totalInputs;
  document.getElementById("hidden").textContent = report.hiddenBoxes;
  document.getElementById("traps").textContent = report.invisibleBoxes;

  const statusBox = document.getElementById("status");
  if (report.isSuspicious) {
    statusBox.textContent = "⚠️ Suspicious Traps Found";
    statusBox.className = "badge warning";
  } else {
    statusBox.textContent = "✅ Page Appears Safe";
    statusBox.className = "badge safe";
  }
});