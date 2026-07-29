"use strict";

// Service worker for Vocabulary Learning extension
// Handles auth callback from Supabase OAuth redirect

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    // Open options page on first install for API key setup
    chrome.runtime.openOptionsPage();
  }
});

// Listen for auth callback messages from auth.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_SUCCESS") {
    // Save session to storage (persists across popup opens)
    chrome.storage.session.set({ supabaseSession: message.session }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep channel open for async response
  }

  if (message.type === "AUTH_LOGOUT") {
    chrome.storage.session.remove("supabaseSession", () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
