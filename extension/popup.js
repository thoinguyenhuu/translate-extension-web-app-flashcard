"use strict";

const runtimeConfig = window.APP_CONFIG || {};

const CONFIG = {
  supabaseUrl: runtimeConfig.supabaseUrl || "",
  supabaseAnonKey: runtimeConfig.supabaseAnonKey || "",
  supabaseTable: runtimeConfig.supabaseTable || "vocabulary",
  webAppUrl: runtimeConfig.webAppUrl || "https://flashcard.thoint.site",
  maxWordLength: 50,
  maxMeaningLength: 300,
};

const elements = {
  authGate: document.getElementById("authGate"),
  popupContent: document.getElementById("popupContent"),
  loginBtn: document.getElementById("loginBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  input: document.getElementById("wordInput"),
  translateButton: document.getElementById("translateButton"),
  resultCard: document.getElementById("resultCard"),
  cardWord: document.getElementById("cardWord"),
  cardPos: document.getElementById("cardPos"),
  mainMeaningInput: document.getElementById("mainMeaningInput"),
  meaningsList: document.getElementById("meaningsList"),
  addMeaningBtn: document.getElementById("addMeaningBtn"),
  saveButton: document.getElementById("saveButton"),
  statusMessage: document.getElementById("statusMessage"),
};

let currentEntry = null;
let currentSession = null;
let sessionPollInterval = null;

// --- Session management ---

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.session.get(["supabaseSession"], (result) => {
      if (result?.supabaseSession) {
        resolve(result.supabaseSession);
      } else {
        chrome.storage.local.get(["supabaseSession"], (localResult) => {
          resolve(localResult?.supabaseSession || null);
        });
      }
    });
  });
}

async function checkAuth() {
  const session = await getStoredSession();

  if (!session || !session.accessToken) {
    showAuthGate();
    return false;
  }

  const expired = session.expiresAt
    ? Date.now() > session.expiresAt
    : isTokenExpired(session.accessToken);

  if (expired) {
    const refreshed = await refreshSession(session.refreshToken);
    if (!refreshed) {
      showAuthGate();
      return false;
    }
    // refreshSession() already set currentSession to the new session
    hideAuthGate();
    return true;
  }

  currentSession = session;
  hideAuthGate();
  return true;
}

async function refreshSession(refreshToken) {
  try {
    const response = await fetch(
      `${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: CONFIG.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) return false;

    const data = await response.json();
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user,
    };

    currentSession = session;

    return new Promise((resolve) => {
      chrome.storage.session.set({ supabaseSession: session }, () => {
        chrome.storage.local.set({ supabaseSession: session }, () => resolve(true));
      });
    });
  } catch {
    return false;
  }
}

function showAuthGate() {
  elements.authGate.style.display = "flex";
  elements.popupContent.classList.remove("is-authenticated");
}

function hideAuthGate() {
  elements.authGate.style.display = "none";
  elements.popupContent.classList.add("is-authenticated");
}

// --- Auth actions ---

function handleLogin() {
  chrome.tabs.create({ url: CONFIG.webAppUrl });
  startSessionPolling();
}

function startSessionPolling() {
  if (sessionPollInterval) return;

  sessionPollInterval = setInterval(async () => {
    const session = await getStoredSession();
    if (session?.accessToken) {
      clearInterval(sessionPollInterval);
      sessionPollInterval = null;
      currentSession = session;
      hideAuthGate();
      elements.input.focus();
    }
  }, 1500);
}

function handleSettings() {
  chrome.runtime.openOptionsPage();
}

// --- UI helpers ---

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status status-${type}`;
}

function clearStatus() {
  elements.statusMessage.textContent = "";
  elements.statusMessage.className = "status";
}

function setLoadingState(isLoading) {
  elements.input.disabled = isLoading;
  elements.translateButton.disabled = isLoading;
  elements.saveButton.disabled = isLoading;
  elements.mainMeaningInput.disabled = isLoading;
}

function showResultCard() {
  elements.resultCard.style.display = "block";
}

function hideResultCard() {
  elements.resultCard.style.display = "none";
}

// --- Meanings list management ---

function addMeaningRow(value) {
  const li = document.createElement("li");
  li.className = "meaning-row";

  const input = document.createElement("input");
  input.className = "text-input";
  input.type = "text";
  input.value = value || "";
  input.placeholder = "Additional meaning";
  li.appendChild(input);

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-meaning-btn";
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => li.remove());
  li.appendChild(removeBtn);

  elements.meaningsList.appendChild(li);
  return li;
}

function clearMeaningsList() {
  elements.meaningsList.textContent = "";
}

function collectMeanings() {
  const items = elements.meaningsList.querySelectorAll("input");
  const meanings = [];

  for (const input of items) {
    const val = input.value.trim();
    if (val) meanings.push(val);
  }

  return meanings;
}

// --- Translate ---

function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["translationProvider", "translationApiKey"],
      (result) => {
        resolve({
          provider: result.translationProvider || "gemini",
          apiKey: result.translationApiKey || "",
        });
      },
    );
  });
}

function buildTranslatePrompt(text) {
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

async function callGemini(word, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildTranslatePrompt(word) }] }],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("Gemini API error:", err);
    throw new Error(`Gemini error (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned);
}

async function translateWord(word) {
  const { provider, apiKey } = await getApiSettings();
  if (!apiKey)
    throw new Error("No API key configured. Open Settings to add one.");

  const normalizedWord = normalizeWord(word);

  if (provider === "gemini") {
    return callGemini(normalizedWord, apiKey);
  }

  const endpoints = {
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    openai: "https://api.openai.com/v1/chat/completions",
  };

  if (endpoints[provider]) {
    const response = await fetch(endpoints[provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
        messages: [
          { role: "user", content: buildTranslatePrompt(normalizedWord) },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) throw new Error(`${provider} error (${response.status})`);

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  }

  if (provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 300,
        messages: [
          { role: "user", content: buildTranslatePrompt(normalizedWord) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Claude error (${response.status})`);

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function handleTranslate() {
  clearStatus();

  const rawWord = elements.input.value.trim();
  if (!rawWord) {
    showStatus("Enter a word first.", "error");
    return;
  }

  const word = normalizeWord(rawWord);
  elements.translateButton.disabled = true;
  elements.translateButton.textContent = "Translating...";

  try {
    const result = await translateWord(word);

    // Fill the result card
    elements.cardWord.textContent = word;
    elements.cardPos.textContent = result.pos || "unknown";

    // Main meaning
    elements.mainMeaningInput.value = result.mainMeaning || "";

    // Additional meanings
    clearMeaningsList();
    const additionalMeanings = Array.isArray(result.meanings)
      ? result.meanings.filter((m) => m !== result.mainMeaning)
      : [];
    for (const m of additionalMeanings) {
      addMeaningRow(m);
    }

    showResultCard();
    showStatus("Edit meanings if needed, then Save.", "success");
    elements.mainMeaningInput.focus();
  } catch (error) {
    showStatus(error.message || "Translation failed.", "error");
    hideResultCard();
  } finally {
    elements.translateButton.disabled = false;
    elements.translateButton.textContent = "Translate";
  }
}

// --- Save ---

function normalizeWord(word) {
  return word.trim().toLowerCase();
}

function cleanWord(word) {
  return String(word || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSupabaseUrl(pathname, queryParams) {
  const baseUrl = CONFIG.supabaseUrl.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}${pathname}`);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function supabaseFetch(pathname, options = {}, queryParams) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    throw new Error("Supabase config is missing.");
  }
  if (!currentSession?.accessToken) {
    throw new Error("Not authenticated. Sign in first.");
  }

  let response = await fetch(buildSupabaseUrl(pathname, queryParams), {
    ...options,
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${currentSession.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // Auto-refresh on 401 and retry once
  if (response.status === 401 && currentSession.refreshToken) {
    const refreshed = await refreshSession(currentSession.refreshToken);
    if (refreshed) {
      response = await fetch(buildSupabaseUrl(pathname, queryParams), {
        ...options,
        headers: {
          apikey: CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${currentSession.accessToken}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Supabase request failed:", errorText);
    throw new Error("Save failed. Please try again.");
  }

  if (response.status === 204) return null;
  return response.json();
}

async function saveWordToSupabase(entry) {
  const payload = {
    word: entry.word,
    pos: entry.pos,
    meaning: entry.mainMeaning,
    main_meaning: entry.mainMeaning,
    meanings: entry.meanings,
    created_at: entry.createdAt,
  };

  const rows = await supabaseFetch(
    `/rest/v1/${CONFIG.supabaseTable}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([payload]),
    },
    { on_conflict: "user_id,word" },
  );

  return Array.isArray(rows) ? rows[0] : payload;
}

async function handleSave() {
  clearStatus();

  const word = normalizeWord(elements.input.value);
  if (!word) {
    showStatus("Enter a word first.", "error");
    return;
  }

  const mainMeaning = cleanWord(elements.mainMeaningInput.value);
  if (!mainMeaning) {
    showStatus("Main meaning is required.", "error");
    return;
  }

  const pos = cleanWord(elements.cardPos.textContent) || "unknown";
  const allMeanings = [mainMeaning, ...collectMeanings()];

  setLoadingState(true);

  try {
    const entry = {
      word,
      pos,
      mainMeaning,
      meanings: allMeanings,
      createdAt: new Date().toISOString(),
    };

    await saveWordToSupabase(entry);

    showStatus("Saved!", "success");
    elements.input.value = "";
    hideResultCard();
    elements.input.focus();
  } catch (error) {
    showStatus(error.message || "Save failed.", "error");
  } finally {
    setLoadingState(false);
  }
}

function bindEvents() {
  elements.loginBtn.addEventListener("click", handleLogin);
  elements.settingsBtn.addEventListener("click", handleSettings);
  elements.translateButton.addEventListener("click", handleTranslate);
  elements.saveButton.addEventListener("click", handleSave);
  elements.addMeaningBtn.addEventListener("click", () => addMeaningRow(""));

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (elements.resultCard.style.display === "block") {
        handleSave();
      } else {
        handleTranslate();
      }
    }
  });

  elements.mainMeaningInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleSave();
  });
}

async function initPopup() {
  bindEvents();
  const isAuthed = await checkAuth();
  if (isAuthed) {
    elements.input.focus();
  }
}

initPopup();
