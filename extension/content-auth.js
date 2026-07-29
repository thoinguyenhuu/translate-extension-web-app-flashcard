"use strict";

// content-auth.js
// Runs on the web app domain. Detects Supabase Auth session
// in localStorage and shares it with the extension background script.

function detectSession() {
  // Supabase stores auth token in localStorage as sb-<ref>-auth-token
  const authKey = Object.keys(localStorage).find(
    (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
  );

  if (!authKey) return;

  try {
    const raw = JSON.parse(localStorage.getItem(authKey));
    if (!raw || !raw.access_token) return;

    chrome.runtime.sendMessage({
      type: "AUTH_SUCCESS",
      session: {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        expiresAt: Date.now() + (raw.expires_in || 3600) * 1000,
        user: raw.user
      }
    });
  } catch {
    // ignore parse errors — session may not be ready yet
  }
}

// Run on page load
detectSession();

// Also detect when storage changes (e.g., after OAuth redirect)
window.addEventListener("storage", (event) => {
  if (event.key && event.key.startsWith("sb-") && event.key.endsWith("-auth-token")) {
    detectSession();
  }
});
