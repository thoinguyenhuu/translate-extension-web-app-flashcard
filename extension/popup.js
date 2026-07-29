"use strict";

const runtimeConfig = window.APP_CONFIG || {};

const CONFIG = {
  supabaseUrl: runtimeConfig.supabaseUrl || "",
  supabaseAnonKey: runtimeConfig.supabaseAnonKey || "",
  supabaseTable: runtimeConfig.supabaseTable || "vocabulary",
  maxWordLength: 50,
  maxMeaningLength: 300
};

const SUPPORTED_PARTS_OF_SPEECH = new Set([
  "noun",
  "pronoun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection"
]);

const elements = {
  input: document.getElementById("wordInput"),
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
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const word = cleanWord(entry.word || fallbackWord || "");
  const pos = cleanWord(entry.pos || "unknown");
  const mainMeaning = cleanWord(entry.mainMeaning || entry.main_meaning || entry.meaning || "");
  const meanings = Array.isArray(entry.meanings)
    ? entry.meanings.map((item) => cleanWord(item)).filter(Boolean).slice(0, 3)
    : [];

  if (mainMeaning && !meanings.length) {
    meanings.push(mainMeaning);
  }

  if (!word || !mainMeaning) {
    return null;
  }

  return {
    word,
    pos,
    mainMeaning,
    meanings,
    createdAt: entry.createdAt || entry.created_at || new Date().toISOString()
  };
}

function renderEntry(entry, source) {
  const normalizedEntry = normalizeEntry(entry);

  if (!normalizedEntry) {
    throw new Error("Word data is invalid.");
  }

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

  if (!word) {
    throw new Error("Enter a word before saving.");
  }

  if (word.length > CONFIG.maxWordLength) {
    throw new Error(`Keep the word under ${CONFIG.maxWordLength} characters.`);
  }

  return normalizeWord(word);
}

function validateMeaning(rawMeaning) {
  const meaning = cleanWord(rawMeaning);

  if (!meaning) {
    throw new Error("Enter a definition before saving.");
  }

  if (meaning.length > CONFIG.maxMeaningLength) {
    throw new Error(`Keep the definition under ${CONFIG.maxMeaningLength} characters.`);
  }

  return meaning;
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
    throw new Error("Supabase config is missing. Generate extension/config.js from .env first.");
  }

  const response = await fetch(buildSupabaseUrl(pathname, queryParams), {
    ...options,
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError = null;

    try {
      parsedError = JSON.parse(errorText);
    } catch (error) {
      parsedError = null;
    }

    if (parsedError?.code === "42703") {
      throw new Error("Supabase schema is outdated. Run supabase/schema.sql, then retry.");
    }

    throw new Error(`Supabase request failed: ${errorText || response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

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
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify([payload])
    },
    {
      on_conflict: "word"
    }
  );

  return normalizeEntry(Array.isArray(rows) ? rows[0] : payload, entry.word);
}

function clearForm() {
  elements.input.value = "";
  elements.posSelect.value = "";
  elements.meaningInput.value = "";
}

async function handleSave() {
  clearStatus();

  try {
    setLoadingState(true);
    const word = validateWord(elements.input.value);
    const selectedPos = validateSelectedPos(elements.posSelect.value);
    const mainMeaning = validateMeaning(elements.meaningInput.value);
    const entry = await saveWordToSupabase({
      word,
      pos: selectedPos,
      mainMeaning,
      meanings: [mainMeaning],
      createdAt: new Date().toISOString()
    });

    renderEntry(entry, "Supabase");
    showStatus("Saved to Supabase.", "success");
    clearForm();
    focusInput();
  } catch (error) {
    showStatus(error.message || "Save failed.", "error");
  } finally {
    setLoadingState(false);
  }
}

function bindEvents() {
  elements.saveButton.addEventListener("click", handleSave);

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSave();
    }
  });

  elements.meaningInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleSave();
    }
  });

  const clearFeedback = () => {
    clearStatus();
  };

  elements.input.addEventListener("input", clearFeedback);
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

function initPopup() {
  bindEvents();
  resetResult();
  focusInput();
}

initPopup();
