"use strict";

const PROVIDER_LINKS = {
  gemini: { label: "aistudio.google.com/apikey", url: "https://aistudio.google.com/apikey" },
  deepseek: { label: "platform.deepseek.com/api_keys", url: "https://platform.deepseek.com/api_keys" },
  openai: { label: "platform.openai.com/api-keys", url: "https://platform.openai.com/api-keys" },
  claude: { label: "console.anthropic.com/settings/keys", url: "https://console.anthropic.com/settings/keys" }
};

const elements = {
  providerSelect: document.getElementById("providerSelect"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  providerLink: document.getElementById("providerLink"),
  saveBtn: document.getElementById("saveBtn"),
  statusMsg: document.getElementById("statusMsg")
};

function showStatus(message, type) {
  elements.statusMsg.textContent = message;
  elements.statusMsg.className = `opt-status opt-status-${type}`;
}

function clearStatus() {
  elements.statusMsg.textContent = "";
  elements.statusMsg.className = "opt-status";
}

function updateProviderLink(provider) {
  const info = PROVIDER_LINKS[provider] || PROVIDER_LINKS.gemini;
  elements.providerLink.textContent = info.label;
  elements.providerLink.href = info.url;
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["translationProvider", "translationApiKey"], (result) => {
      resolve(result);
    });
  });
}

async function saveSettings(provider, apiKey) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { translationProvider: provider, translationApiKey: apiKey },
      resolve
    );
  });
}

async function handleSave() {
  clearStatus();

  const provider = elements.providerSelect.value;
  const apiKey = elements.apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus("Please enter an API key.", "error");
    return;
  }

  elements.saveBtn.disabled = true;

  try {
    await saveSettings(provider, apiKey);
    showStatus("Settings saved. Your API key is stored locally.", "success");
  } catch (error) {
    showStatus(error.message || "Failed to save settings.", "error");
  } finally {
    elements.saveBtn.disabled = false;
  }
}

async function initOptions() {
  const settings = await loadSettings();

  if (settings.translationProvider) {
    elements.providerSelect.value = settings.translationProvider;
    updateProviderLink(settings.translationProvider);
  }

  if (settings.translationApiKey) {
    elements.apiKeyInput.value = settings.translationApiKey;
  }

  elements.providerSelect.addEventListener("change", () => {
    updateProviderLink(elements.providerSelect.value);
    clearStatus();
  });

  elements.saveBtn.addEventListener("click", handleSave);

  // Allow Enter to save
  elements.apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleSave();
  });
}

initOptions();
