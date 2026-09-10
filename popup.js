// Arrays to randomly generate mock personas
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

function createPersona() {
  const first = getRandomItem(firstNames);
  const last = getRandomItem(lastNames);
  const num = Math.floor(100 + Math.random() * 900);
  
  return {
    fullName: `${first} ${last}`,
    username: `${first.toLowerCase()}_${last.toLowerCase()}${num}`,
    password: generatePassword()
  };
}

let activePersona = createPersona();

function updateUI() {
  document.getElementById("mock-name").textContent = activePersona.fullName;
  document.getElementById("mock-user").textContent = activePersona.username;
  document.getElementById("mock-pass").textContent = activePersona.password;
}

// 1. Load scan reports
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

// 2. Initialize Identity View
updateUI();

// 3. Reroll Button
document.getElementById("btn-regen").addEventListener("click", () => {
  activePersona = createPersona();
  updateUI();
});

// 4. Autofill Button - sends message to content.js
document.getElementById("btn-fill").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "AUTOFILL_PAGE",
      persona: activePersona
    });
  }
});