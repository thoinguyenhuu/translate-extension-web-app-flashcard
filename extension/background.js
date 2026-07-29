"use strict";

// Service worker for Vocabulary Learning extension

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// Handle auth session from content-auth.js (runs on web app domain)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_SUCCESS") {
    chrome.storage.session.set({ supabaseSession: message.session }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "AUTH_LOGOUT") {
    chrome.storage.session.remove("supabaseSession", () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
