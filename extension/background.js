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
    // Store in session (popup) AND local (content scripts)
    chrome.storage.session.set({ supabaseSession: message.session }, () => {
      chrome.storage.local.set({ supabaseSession: message.session }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message.type === "AUTH_LOGOUT") {
    chrome.storage.session.remove("supabaseSession", () => {
      chrome.storage.local.remove("supabaseSession", () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
