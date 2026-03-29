"use strict";

const runtimeConfig = window.APP_CONFIG || {};

const CONFIG = {
  deeplApiKey: runtimeConfig.deeplApiKey || "",
  deeplEndpoint: runtimeConfig.deeplEndpoint || "https://api-free.deepl.com/v2/translate",
  supabaseUrl: runtimeConfig.supabaseUrl || "",
  supabaseAnonKey: runtimeConfig.supabaseAnonKey || "",
  supabaseTable: runtimeConfig.supabaseTable || "vocabulary",
  dictionaryEndpoint: "https://api.dictionaryapi.dev/api/v2/entries/en",
  maxInputLength: 50
};

const elements = {
  input: document.getElementById("wordInput"),
  translateButton: document.getElementById("translateButton"),
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

function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status status-${type}`;
}

function clearStatus() {
  elements.statusMessage.textContent = "";
  elements.statusMessage.className = "status";
}

function setLoadingState(isLoading) {
  elements.translateButton.disabled = isLoading;
}

function setMeaningList(meanings) {
  const items = Array.isArray(meanings) ? meanings : [];
  elements.resultMeaningList.textContent = "";

  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No additional meanings.";
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
  elements.resultWord.textContent = "No word selected";
  elements.resultMeaning.textContent = "Look up a word to see the translated main meaning.";
  elements.resultMeta.textContent = "";
  setMeaningList([]);
}

function validateWord(rawWord) {
  const word = cleanWord(rawWord);

  if (!word) {
    throw new Error("Enter an English word before looking it up.");
  }

  if (word.length > CONFIG.maxInputLength) {
    throw new Error(`Keep the input under ${CONFIG.maxInputLength} characters.`);
  }

  return normalizeWord(word);
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

async function fetchWordFromSupabase(word) {
  const rows = await supabaseFetch(
    `/rest/v1/${CONFIG.supabaseTable}`,
    {
      method: "GET",
      headers: {
        Prefer: "return=representation"
      }
    },
    {
      select: "*",
      word: `eq.${word}`,
      limit: "1"
    }
  );

  return normalizeEntry(Array.isArray(rows) ? rows[0] : null, word);
}

async function insertWordToSupabase(entry) {
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

async function fetchDictionary(word) {
  const response = await fetch(`${CONFIG.dictionaryEndpoint}/${encodeURIComponent(word)}`);

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.title || `Dictionary request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const entries = Array.isArray(payload) ? payload : [];
  const definitions = [];
  const seenDefinitions = new Set();
  const dictionaryWord = cleanWord(entries[0]?.word || word);

  for (const entry of entries) {
    for (const meaning of entry.meanings || []) {
      const pos = cleanWord(meaning.partOfSpeech || "unknown").toLowerCase();

      for (const definitionItem of meaning.definitions || []) {
        const definition = cleanWord(definitionItem.definition || "");
        const definitionKey = normalizeWord(definition);

        if (!definition || seenDefinitions.has(definitionKey)) {
          continue;
        }

        seenDefinitions.add(definitionKey);
        definitions.push({
          partOfSpeech: pos || "unknown",
          definition
        });
      }
    }
  }

  if (!definitions.length) {
    throw new Error("Dictionary API returned no usable meanings.");
  }

  return {
    word: dictionaryWord,
    definitions
  };
}

function selectMainMeaning(data) {
  const verbDefinitions = data.definitions.filter((item) => item.partOfSpeech === "verb");
  const preferredDefinitions = verbDefinitions.length ? verbDefinitions : data.definitions;
  const primary = preferredDefinitions[0];
  const meanings = [];
  const seenDefinitions = new Set();

  const addMeaning = (definition) => {
    const key = normalizeWord(definition);

    if (!definition || seenDefinitions.has(key) || meanings.length >= 3) {
      return;
    }

    seenDefinitions.add(key);
    meanings.push(definition);
  };

  addMeaning(primary.definition);

  for (const item of preferredDefinitions) {
    addMeaning(item.definition);
  }

  for (const item of data.definitions) {
    addMeaning(item.definition);
  }

  return {
    word: data.word,
    pos: primary.partOfSpeech,
    primaryDefinition: primary.definition,
    meanings
  };
}

async function translateMainMeaning(text) {
  if (!CONFIG.deeplApiKey) {
    throw new Error("DeepL API key is missing. Generate extension/config.js from .env first.");
  }

  const body = new URLSearchParams({
    text,
    source_lang: "EN",
    target_lang: "VI"
  });

  const response = await fetch(CONFIG.deeplEndpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${CONFIG.deeplApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `DeepL request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const translatedText = payload?.translations?.[0]?.text;

  if (!translatedText) {
    throw new Error("DeepL returned an empty translation.");
  }

  return translatedText;
}

async function lookupWord(word) {
  const existingEntry = await fetchWordFromSupabase(word);

  if (existingEntry) {
    return {
      entry: existingEntry,
      source: "Supabase"
    };
  }

  const dictionaryData = await fetchDictionary(word);
  const selectedMeaning = selectMainMeaning(dictionaryData);
  const mainMeaning = await translateMainMeaning(selectedMeaning.primaryDefinition);
  const insertedEntry = await insertWordToSupabase({
    word: selectedMeaning.word,
    pos: selectedMeaning.pos,
    mainMeaning,
    meanings: selectedMeaning.meanings,
    createdAt: new Date().toISOString()
  });

  return {
    entry: insertedEntry,
    source: "Dictionary API + DeepL + Supabase"
  };
}

async function handleTranslate() {
  clearStatus();
  resetResult();

  try {
    setLoadingState(true);
    const word = validateWord(elements.input.value);
    const { entry, source } = await lookupWord(word);
    renderEntry(entry, source);
    showStatus(source === "Supabase" ? "Loaded existing word from Supabase." : "Word created in Supabase.", "success");
  } catch (error) {
    resetResult();
    showStatus(error.message || "Lookup failed.", "error");
  } finally {
    setLoadingState(false);
  }
}

function bindEvents() {
  elements.translateButton.addEventListener("click", handleTranslate);

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleTranslate();
    }
  });

  elements.input.addEventListener("input", () => {
    clearStatus();
    resetResult();
  });
}

function initPopup() {
  bindEvents();
  resetResult();
}

initPopup();
