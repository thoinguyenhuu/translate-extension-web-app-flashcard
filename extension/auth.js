"use strict";

// Auth flow for Vocabulary Learning extension
// Uses chrome.identity.launchWebAuthFlow for Google OAuth via Supabase

const CONFIG = window.APP_CONFIG || {};

const elements = {
  googleLoginBtn: document.getElementById("googleLoginBtn"),
  authError: document.getElementById("authError")
};

function showError(message) {
  elements.authError.textContent = message;
}

function clearError() {
  elements.authError.textContent = "";
}

/**
 * Open a popup window for Google OAuth via Supabase.
 * chrome.identity.launchWebAuthFlow handles the OAuth popup
 * and captures the redirect URL with tokens.
 */
async function signInWithGoogle() {
  clearError();
  elements.googleLoginBtn.disabled = true;

  try {
    // Build Supabase OAuth authorize URL
    const redirectUrl = chrome.identity.getRedirectURL("auth");
    const params = new URLSearchParams({
      provider: "google",
      redirect_to: redirectUrl
    });

    const authUrl = `${CONFIG.supabaseUrl}/auth/v1/authorize?${params}`;

    // Launch OAuth flow — Chrome handles the popup window
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError) {
          showError(chrome.runtime.lastError.message || "Login cancelled.");
          elements.googleLoginBtn.disabled = false;
          return;
        }

        if (!responseUrl) {
          showError("Login failed — no response received.");
          elements.googleLoginBtn.disabled = false;
          return;
        }

        // Parse tokens from the redirect URL fragment
        const fragment = new URLSearchParams(
          responseUrl.includes("#") ? responseUrl.split("#")[1] : ""
        );

        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        const expiresIn = parseInt(fragment.get("expires_in") || "3600", 10);

        if (!accessToken) {
          showError("Login failed — no access token received.");
          elements.googleLoginBtn.disabled = false;
          return;
        }

        // Verify session by fetching user info
        const userResponse = await fetch(`${CONFIG.supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: CONFIG.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`
          }
        });

        if (!userResponse.ok) {
          showError("Login failed — unable to verify identity.");
          elements.googleLoginBtn.disabled = false;
          return;
        }

        const userData = await userResponse.json();

        const session = {
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn * 1000,
          user: userData
        };

        // Send session to background script for persistent storage
        chrome.runtime.sendMessage(
          { type: "AUTH_SUCCESS", session },
          (response) => {
            if (response?.ok) {
              // Close auth popup — main popup will detect the session
              window.close();
            } else {
              showError("Failed to save session.");
              elements.googleLoginBtn.disabled = false;
            }
          }
        );
      }
    );
  } catch (error) {
    showError(error.message || "Login failed.");
    elements.googleLoginBtn.disabled = false;
  }
}

function initAuth() {
  elements.googleLoginBtn.addEventListener("click", signInWithGoogle);
}

initAuth();
