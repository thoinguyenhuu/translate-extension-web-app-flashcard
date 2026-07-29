"use strict";

const runtimeConfig = window.APP_CONFIG || {};

const CONFIG = {
  supabaseUrl: runtimeConfig.supabaseUrl || "",
  supabaseAnonKey: runtimeConfig.supabaseAnonKey || "",
  supabaseTable: runtimeConfig.supabaseTable || "vocabulary",
  webAppUrl: runtimeConfig.webAppUrl || "https://flashcard.thoint.site",
  maxWordLength: 50,
  maxMeaningLength: 300
};

const SUPPORTED_PARTS_OF_SPEECH = new Set([
  "noun", "pronoun", "verb", "adjective", "adverb",
  "preposition", "conjunction", "interjection"
]);

const elements = {
  authGate: document.getElementById("authGate"),
  popupContent: document.getElementById("popupContent"),
  loginBtn: document.getElementById("loginBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  input: document.getElementById("wordInput"),
  translateButton: document.getElementById("translateButton"),
  translateResult: document.getElementById("translateResult"),
  translatedWord: document.getElementById("translatedWord"),
  translatedPos: document.getElementById("translatedPos"),
  translatedMeaning: document.getElementById("translatedMeaning"),
  translatedMeanings: document.getElementById("translatedMeanings"),
  meaningInput: document.getElementById("meaningInput"),
  posSelect: document.getElementById("posSelect"),
  saveButton: document.getElementById("saveButton"),
  resultWord: document.getElementById("resultWord"),
  resultMeaning: document.getElementById("resultMeaning"),
  resultMeaningList: document.getElementById("resultMeaningList"),
  resultMeta: document.getElementById("resultMeta"),
  statusMessage: document.getElementById("statusMessage")
};

let currentEntry = null;
let currentSession = null;
let currentTranslation = null; // last translate result
let sessionPollInterval = null;

// --- Session management ---

function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.session.get(["supabaseSession"], (result) => {
      resolve(result.supabaseSession || null);
    });
  });
}

async function checkAuth() {
  const session = await getStoredSession();

  if (!session || !session.accessToken) {
    showAuthGate();
    return false;
  }

  // Check if token is expired and try refresh
  if (session.expiresAt && Date.now() > session.expiresAt) {
    const refreshed = await refreshSession(session.refreshToken);
    if (!refreshed) {
      showAuthGate();
      return false;
    }
  }

  currentSession = session;
  hideAuthGate();
  return true;
}

async function refreshSession(refreshToken) {
  try {
    const response = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: CONFIG.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) return false;

    const data = await response.json();
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      user: data.user
    };

    currentSession = session;

    return new Promise((resolve) => {
      chrome.storage.session.set({ supabaseSession: session }, () => resolve(true));
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
  // Open web app for user to log in
  chrome.tabs.create({ url: CONFIG.webAppUrl });

  // Start polling for session detection
  startSessionPolling();
}

function startSessionPolling() {
  if (sessionPollInterval) return;

  sessionPollInterval = setInterval(async () => {
    const session = await getStoredSession();
    if (session?.accessToken) {
      clearInterval(sessionPollInterval);
      sessionPollInterval = null;
      // Session detected! Re-initialize the popup
      currentSession = session;
      hideAuthGate();
      resetResult();
      focusInput();
    }
  }, 1500);
}

function handleSettings() {
  chrome.runtime.openOptionsPage();
}

// --- Word validation and normalization ---

function normalizeWord(word) {
  return word.trim().toLowerCase();
}

function cleanWord(word) {
  return String(word || "").replace(/\s+/g, " ").trim();
}

function normalizePos(pos) {
  return cleanWord(pos).toLowerCase();
}

function validateSelectedPos(rawPos) {
  const pos = normalizePos(rawPos);
  if (!SUPPORTED_PARTS_OF_SPEECH.has(pos)) {
    throw new Error("Select a valid word type before saving.");
  }
  return pos;
}

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
  elements.posSelect.disabled = isLoading;
  elements.meaningInput.disabled = isLoading;
}

function setMeaningList(meanings) {
  const items = Array.isArray(meanings) ? meanings : [];
  elements.resultMeaningList.textContent = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No saved definition yet.";
    elements.resultMeaningList.appendChild(emptyItem);
    return;
  }

  for (const meaning of items) {
    const item = document.createElement("li");
    item.textContent = meaning;
    elements.resultMeaningList.appendChild(item);
  }
}

function normalizeEntry(entry, fallbackWord) {
  if (!entry || typeof entry !== "object") return null;

  const word = cleanWord(entry.word || fallbackWord || "");
  const pos = cleanWord(entry.pos || "unknown");
  const mainMeaning = cleanWord(entry.mainMeaning || entry.main_meaning || entry.meaning || "");
  const meanings = Array.isArray(entry.meanings)
    ? entry.meanings.map((item) => cleanWord(item)).filter(Boolean).slice(0, 3)
    : [];

  if (mainMeaning && !meanings.length) meanings.push(mainMeaning);
  if (!word || !mainMeaning) return null;

  return {
    word, pos, mainMeaning, meanings,
    createdAt: entry.createdAt || entry.created_at || new Date().toISOString()
  };
}

function renderEntry(entry, source) {
  const normalizedEntry = normalizeEntry(entry);
  if (!normalizedEntry) throw new Error("Word data is invalid.");

  currentEntry = normalizedEntry;
  elements.resultWord.textContent = `${normalizedEntry.word} (${normalizedEntry.pos})`;
  elements.resultMeaning.textContent = normalizedEntry.mainMeaning;
  elements.resultMeta.textContent = `Source: ${source}`;
  setMeaningList(normalizedEntry.meanings.slice(1));
}

function resetResult() {
  currentEntry = null;
  elements.resultWord.textContent = "No word saved yet";
  elements.resultMeaning.textContent = "Fill the form above and save it to Supabase.";
  elements.resultMeta.textContent = "";
  setMeaningList([]);
}

function validateWord(rawWord) {
  const word = cleanWord(rawWord);
  if (!word) throw new Error("Enter a word before saving.");
  if (word.length > CONFIG.maxWordLength) throw new Error(`Keep the word under ${CONFIG.maxWordLength} characters.`);
  return normalizeWord(word);
}

function validateMeaning(rawMeaning) {
  const meaning = cleanWord(rawMeaning);
  if (!meaning) throw new Error("Enter a definition before saving.");
  if (meaning.length > CONFIG.maxMeaningLength) throw new Error(`Keep the definition under ${CONFIG.maxMeaningLength} characters.`);
  return meaning;
}

// --- Translation API ---

function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["translationProvider", "translationApiKey"], (result) => {
      resolve({
        provider: result.translationProvider || "gemini",
        apiKey: result.translationApiKey || ""
      });
    });
  });
}

function buildTranslatePrompt(word) {
  return `You are a English-Vietnamese dictionary. For the English word "${word}", return ONLY valid JSON (no markdown, no explanation) with exactly these fields:
{
  "pos": "the part of speech (noun/verb/adjective/adverb/preposition/conjunction/interjection/pronoun)",
  "mainMeaning": "the primary Vietnamese translation",
  "meanings": ["2-3 additional Vietnamese meanings or usage examples"]
}`;
}

async function callGemini(word, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildTranslatePrompt(word) }] }]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function translateWord(word) {
  const { provider, apiKey } = await getApiSettings();
  if (!apiKey) throw new Error("No API key configured. Open Settings to add one.");

  const normalizedWord = normalizeWord(word);

  if (provider === "gemini") {
    return callGemini(normalizedWord, apiKey);
  }

  // For OpenAI-compatible providers (DeepSeek, OpenAI)
  const endpoints = {
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    openai: "https://api.openai.com/v1/chat/completions"
  };

  if (endpoints[provider]) {
    const response = await fetch(endpoints[provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
        messages: [{ role: "user", content: buildTranslatePrompt(normalizedWord) }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${provider} API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  }

  // Claude
  if (provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 300,
        messages: [{ role: "user", content: buildTranslatePrompt(normalizedWord) }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

function showTranslateResult(word, result) {
  elements.translatedWord.textContent = word;
  elements.translatedPos.textContent = result.pos;
  elements.translatedMeaning.textContent = result.mainMeaning;

  // Fill meanings list
  const meanings = Array.isArray(result.meanings) ? result.meanings : [];
  elements.translatedMeanings.textContent = "";
  for (const m of meanings) {
    const li = document.createElement("li");
    li.textContent = m;
    elements.translatedMeanings.appendChild(li);
  }

  elements.translateResult.style.display = "block";
}

function hideTranslateResult() {
  elements.translateResult.style.display = "none";
}

async function handleTranslate() {
  clearStatus();
  hideTranslateResult();

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
    currentTranslation = result;

    // Auto-fill the form
    showTranslateResult(word, result);

    // Set POS if recognized
    const normalizedPos = normalizePos(result.pos);
    if (SUPPORTED_PARTS_OF_SPEECH.has(normalizedPos)) {
      elements.posSelect.value = normalizedPos;
    }

    // Fill meaning
    elements.meaningInput.value = result.mainMeaning;

    showStatus("Translation ready. Edit if needed, then Save.", "success");
    elements.meaningInput.focus();
  } catch (error) {
    showStatus(error.message || "Translation failed.", "error");
    currentTranslation = null;
  } finally {
    elements.translateButton.disabled = false;
    elements.translateButton.textContent = "Translate";
  }
}

// --- Supabase operations ---

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
    throw new Error("Supabase config is missing. Generate extension/config.js from .env first.");
  }
  if (!currentSession?.accessToken) {
    throw new Error("Not authenticated. Please sign in first.");
  }

  const response = await fetch(buildSupabaseUrl(pathname, queryParams), {
    ...options,
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${currentSession.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError = null;
    try { parsedError = JSON.parse(errorText); } catch { parsedError = null; }

    if (parsedError?.code === "42703") {
      throw new Error("Supabase schema is outdated. Run supabase/schema.sql, then retry.");
    }

    throw new Error(`Supabase request failed: ${errorText || response.status}`);
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
    created_at: entry.createdAt
  };

  const rows = await supabaseFetch(
    `/rest/v1/${CONFIG.supabaseTable}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([payload])
    },
    { on_conflict: "word" }
  );

  return normalizeEntry(Array.isArray(rows) ? rows[0] : payload, entry.word);
}

function clearForm() {
  elements.input.value = "";
  elements.posSelect.value = "";
  elements.meaningInput.value = "";
  hideTranslateResult();
  currentTranslation = null;
}

async function handleSave() {
  clearStatus();

  try {
    setLoadingState(true);
    const word = validateWord(elements.input.value);
    const selectedPos = validateSelectedPos(elements.posSelect.value);
    const mainMeaning = validateMeaning(elements.meaningInput.value);

    // Use additional meanings from translation if available
    const additionalMeanings = currentTranslation?.meanings
      ? currentTranslation.meanings.filter((m) => m !== mainMeaning).slice(0, 2)
      : [];

    const allMeanings = [mainMeaning, ...additionalMeanings];

    const entry = await saveWordToSupabase({
      word, pos: selectedPos, mainMeaning,
      meanings: allMeanings,
      createdAt: new Date().toISOString()
    });

    renderEntry(entry, "Supabase");
    showStatus("Saved to Supabase.", "success");
    clearForm();
    hideTranslateResult();
    currentTranslation = null;
    focusInput();
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

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (elements.meaningInput.value) {
        handleSave();
      } else {
        handleTranslate();
      }
    }
  });

  elements.meaningInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleSave();
  });

  const clearFeedback = () => clearStatus();
  elements.input.addEventListener("input", () => {
    clearFeedback();
    hideTranslateResult();
  });
  elements.meaningInput.addEventListener("input", clearFeedback);

  elements.posSelect.addEventListener("change", () => {
    clearFeedback();
    focusInput();
  });
}

function focusInput() {
  window.requestAnimationFrame(() => {
    elements.input.focus({ preventScroll: true });
    const inputLength = elements.input.value.length;
    elements.input.setSelectionRange(inputLength, inputLength);
  });
}

async function initPopup() {
  bindEvents();
  const isAuthed = await checkAuth();
  if (isAuthed) {
    resetResult();
    focusInput();
  }
}

initPopup();
