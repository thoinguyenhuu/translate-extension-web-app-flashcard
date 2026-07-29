"use strict";

// ============================================================
// content.js — Highlight-to-Translate
// Runs on all pages. Shows floating tooltip for text selection.
// ============================================================

const SUPABASE_URL = "https://asuxigdpuracsosyuxiy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdXhpZ2RwdXJhY3Nvc3l1eGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjgwODksImV4cCI6MjA5MDM0NDA4OX0.XiBjubFxUkZ2TVvNcT9wKIsBJKAzlp30QkEWKdc0djM";

let floatingIcon = null;
let tooltipCard = null;
let selectedText = "";
let currentTranslation = null;
let tooltipVisible = false;

// --- Init ---

function init() {
  injectStyles();
  createFloatingIcon();
  createTooltipCard();
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mousedown", handleMouseDown);
}

// --- Styles ---

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .vl-icon {
      position: fixed; z-index: 2147483647; cursor: pointer;
      width: 36px; height: 36px; border-radius: 50%;
      background: #2563eb; color: #fff; font-size: 18px;
      display: none; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(37,99,235,0.3);
      transition: transform 0.15s ease, opacity 0.15s ease;
      font-family: system-ui, sans-serif; user-select: none;
    }
    .vl-icon:hover { transform: scale(1.12); }
    .vl-icon.is-hidden { opacity: 0; pointer-events: none; }

    .vl-card {
      position: fixed; z-index: 2147483647; display: none;
      width: 320px; max-height: 360px; overflow-y: auto;
      border-radius: 14px; background: #ffffff;
      box-shadow: 0 12px 48px rgba(0,0,0,0.18);
      font-family: system-ui, sans-serif; font-size: 14px;
      color: #1f2937; padding: 0;
      animation: vl-fadein 0.18s ease;
    }
    @keyframes vl-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .vl-card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px 0; gap: 8px;
    }
    .vl-card-word { font-size: 20px; font-weight: 800; }
    .vl-card-pos {
      display: inline-flex; margin-left: 8px; padding: 2px 8px;
      border-radius: 999px; background: #eff6ff; color: #2563eb;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
    }
    .vl-card-close {
      background: none; border: none; cursor: pointer; font-size: 18px;
      color: #94a3b8; line-height: 1; padding: 2px;
    }
    .vl-card-close:hover { color: #475569; }

    .vl-card-main {
      padding: 10px 16px 0; font-size: 18px; font-weight: 700; color: #166534;
    }
    .vl-card-list { margin: 8px 16px 0; padding-left: 18px; color: #475569; font-size: 13px; line-height: 1.6; }
    .vl-card-list li + li { margin-top: 4px; }

    .vl-card-actions {
      display: flex; gap: 8px; padding: 12px 16px;
    }
    .vl-card-save {
      flex: 1; padding: 9px 0; border: none; border-radius: 10px;
      background: #0f62fe; color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: opacity 0.15s;
    }
    .vl-card-save:hover { opacity: 0.9; }
    .vl-card-save:disabled { opacity: 0.5; cursor: wait; }
    .vl-card-save.is-saved { background: #16a34a; cursor: default; }

    .vl-card-error {
      padding: 14px 16px; color: #b91c1c; font-size: 13px;
    }
    .vl-card-loading {
      padding: 20px 16px; text-align: center; color: #64748b; font-size: 13px;
    }
    .vl-card-nokey {
      padding: 14px 16px; color: #64748b; font-size: 13px;
    }
    .vl-card-nokey a { color: #2563eb; cursor: pointer; text-decoration: underline; }
  `;
  document.head.appendChild(style);
}

// --- Floating Icon ---

function createFloatingIcon() {
  floatingIcon = document.createElement("div");
  floatingIcon.className = "vl-icon";
  floatingIcon.textContent = "📖";
  floatingIcon.title = "Translate word";
  floatingIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    openTooltip();
  });
  document.body.appendChild(floatingIcon);
}

function showFloatingIcon(x, y) {
  floatingIcon.style.left = `${Math.min(x, window.innerWidth - 44)}px`;
  floatingIcon.style.top = `${y}px`;
  floatingIcon.style.display = "flex";
  floatingIcon.classList.remove("is-hidden");
}

function hideFloatingIcon() {
  floatingIcon.style.display = "none";
}

// --- Tooltip Card ---

function createTooltipCard() {
  tooltipCard = document.createElement("div");
  tooltipCard.className = "vl-card";
  document.body.appendChild(tooltipCard);
}

function setTooltipContent(html) {
  tooltipCard.innerHTML = html;
}

function showTooltip(x, y) {
  tooltipCard.style.left = `${Math.min(x, window.innerWidth - 340)}px`;
  tooltipCard.style.top = `${y + 12}px`;
  tooltipCard.style.display = "block";
  tooltipVisible = true;
  floatingIcon.classList.add("is-hidden");
}

function hideTooltip() {
  tooltipCard.style.display = "none";
  tooltipVisible = false;
}

// --- Selection detection ---

function handleMouseUp(e) {
  // Ignore clicks inside our own tooltip
  if (e.target.closest(".vl-card") || e.target.closest(".vl-icon")) return;

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text.length >= 1 && /^[a-zA-Z\s.,'?!-]+$/.test(text)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      selectedText = text;
      showFloatingIcon(rect.right + 6, rect.top - 18);
    } else {
      if (!tooltipVisible) {
        selectedText = "";
        hideFloatingIcon();
      }
    }
  }, 10);
}

function handleMouseDown(e) {
  if (e.target.closest(".vl-card") || e.target.closest(".vl-icon")) return;
  hideTooltip();
  hideFloatingIcon();
  selectedText = "";
  tooltipVisible = false;
}

// --- Translation ---

async function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["translationProvider", "translationApiKey"], (result) => {
      resolve({
        provider: result.translationProvider || "gemini",
        apiKey: result.translationApiKey || ""
      });
    });
  });
}

function getSession() {
  return new Promise((resolve) => {
    // Try session storage first (faster), fallback to local storage
    try {
      chrome.storage.session.get(["supabaseSession"], (result) => {
        if (result?.supabaseSession) {
          resolve(result.supabaseSession);
        } else {
          // Fallback to local storage (more reliable for content scripts)
          chrome.storage.local.get(["supabaseSession"], (localResult) => {
            resolve(localResult?.supabaseSession || null);
          });
        }
      });
    } catch {
      // Final fallback
      chrome.storage.local.get(["supabaseSession"], (localResult) => {
        resolve(localResult?.supabaseSession || null);
      });
    }
  });
}

function buildPrompt(text) {
  const isSingleWord = /^[a-zA-Z]+(?:-[a-zA-Z]+)?$/.test(text.trim());

  if (isSingleWord) {
    return `You are a English-Vietnamese dictionary. For the English word "${text}", return ONLY valid JSON (no markdown, no explanation) with exactly these fields:
{
  "pos": "the part of speech (noun/verb/adjective/adverb/preposition/conjunction/interjection/pronoun)",
  "mainMeaning": "the primary Vietnamese translation",
  "meanings": ["2-3 additional Vietnamese meanings or usage examples"]
}`;
  }

  return `You are a English-Vietnamese translator. Translate this English text to Vietnamese: "${text}". Return ONLY valid JSON (no markdown, no explanation) with exactly these fields:
{
  "pos": "phrase",
  "mainMeaning": "the complete Vietnamese translation of the text",
  "meanings": []
}`;
}

async function callTranslateApi(word, provider, apiKey) {
  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(word) }] }] })
      }
    );
    if (!res.ok) throw new Error(`API error (${res.status})`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  }

  const endpoints = {
    deepseek: { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" },
    openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }
  };

  if (endpoints[provider]) {
    const { url, model } = endpoints[provider];
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: buildPrompt(word) }], temperature: 0.1 })
    });
    if (!res.ok) throw new Error(`API error (${res.status})`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 300, messages: [{ role: "user", content: buildPrompt(word) }] })
    });
    if (!res.ok) throw new Error(`API error (${res.status})`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
  }

  throw new Error("Unknown provider");
}

function showTranslationResult(word, result) {
  const main = escapeHtml(result.mainMeaning || "");
  const pos = escapeHtml(result.pos || "");
  const meanings = Array.isArray(result.meanings) ? result.meanings.filter(m => m !== result.mainMeaning) : [];
  const listHtml = meanings.map(m => `<li>${escapeHtml(m)}</li>`).join("");

  setTooltipContent(`
    <div class="vl-card-header">
      <span>
        <span class="vl-card-word">${escapeHtml(word)}</span>
        <span class="vl-card-pos">${pos}</span>
      </span>
      <button class="vl-card-close" id="vlClose">×</button>
    </div>
    <div class="vl-card-main">${main}</div>
    ${listHtml ? `<ul class="vl-card-list">${listHtml}</ul>` : ""}
    <div class="vl-card-actions">
      <button class="vl-card-save" id="vlSave">Save to vocabulary</button>
    </div>
  `);
  showTooltip(floatingIcon.offsetLeft, floatingIcon.offsetTop + 44);
  document.getElementById("vlClose")?.addEventListener("click", hideTooltip);
  document.getElementById("vlSave")?.addEventListener("click", handleSave);
}

async function openTooltip() {
  const word = selectedText.trim().toLowerCase();
  if (!word) return;

  const { provider, apiKey } = await getApiSettings();

  if (!apiKey) {
    setTooltipContent(`
      <div class="vl-card-nokey">
        No API key configured.
        <a id="vlOpenOptions">Open extension settings</a> to add one.
      </div>
    `);
    showTooltip(floatingIcon.offsetLeft, floatingIcon.offsetTop + 44);
    document.getElementById("vlOpenOptions")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" }).catch(() => {});
    });
    return;
  }

  // Show loading with the word
  setTooltipContent(`
    <div class="vl-card-header">
      <span><span class="vl-card-word">${escapeHtml(word)}</span></span>
      <button class="vl-card-close" id="vlClose">×</button>
    </div>
    <div class="vl-card-loading">Translating...</div>
  `);
  showTooltip(floatingIcon.offsetLeft, floatingIcon.offsetTop + 44);
  document.getElementById("vlClose")?.addEventListener("click", hideTooltip);

  try {
    const result = await callTranslateApi(word, provider, apiKey);
    currentTranslation = result;

    showTranslationResult(word, result);
  } catch (error) {
    setTooltipContent(`
      <div class="vl-card-header">
        <span><span class="vl-card-word">${escapeHtml(word)}</span></span>
        <button class="vl-card-close" id="vlClose">×</button>
      </div>
      <div class="vl-card-error">Translation failed: ${escapeHtml(error.message)}</div>
    `);
    showTooltip(floatingIcon.offsetLeft, floatingIcon.offsetTop + 44);
    document.getElementById("vlClose")?.addEventListener("click", hideTooltip);
  }
}

// --- Save ---

async function handleSave() {
  const session = await getSession();
  if (!session?.accessToken) {
    const word = selectedText.trim().toLowerCase();
    setTooltipContent(`
      <div class="vl-card-header">
        <span><span class="vl-card-word">${escapeHtml(word)}</span></span>
        <button class="vl-card-close" id="vlClose">×</button>
      </div>
      <div class="vl-card-error">Not logged in. Open the extension popup to sign in.</div>
    `);
    showTooltip(floatingIcon.offsetLeft, floatingIcon.offsetTop + 44);
    document.getElementById("vlClose")?.addEventListener("click", hideTooltip);
    return;
  }

  const saveBtn = document.getElementById("vlSave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  const word = selectedText.trim().toLowerCase();
  const mainMeaning = currentTranslation?.mainMeaning || "";
  const pos = currentTranslation?.pos || "unknown";
  const meanings = currentTranslation?.meanings
    ? [mainMeaning, ...currentTranslation.meanings.filter(m => m !== mainMeaning)]
    : [mainMeaning];

  try {
    const payload = {
      word,
      pos,
      meaning: mainMeaning,
      main_meaning: mainMeaning,
      meanings,
      created_at: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/vocabulary?on_conflict=user_id,word`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify([payload])
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    if (saveBtn) {
      saveBtn.textContent = "✓ Saved";
      saveBtn.classList.add("is-saved");
      saveBtn.disabled = false;
    }

    setTimeout(hideTooltip, 1200);
  } catch (error) {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save failed — try again";
    }
  }
}

// --- Helpers ---

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Listen for session updates from content-auth.js ---
// (Session is already shared via chrome.storage.session,
//  so no additional handling needed)

init();
