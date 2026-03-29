# 📘 Vocabulary Learning Extension

## 🚀 Overview
This project is a browser extension that helps users learn English vocabulary efficiently during daily usage.

Users can translate English words into Vietnamese using the DeepL API, store them intelligently, and review them later through a flashcard system accessible on both desktop and mobile devices.

The system follows a **local-first + cloud sync architecture**, using Supabase for optional synchronization across devices.

---

## 🎯 Objectives
- Provide fast and seamless word translation
- Minimize API usage through caching
- Build a personal vocabulary database
- Enable cross-device learning (PC + mobile)

---

## ⚙️ Core Features

### 1. 🔍 Word Translation
- Users can:
  - Manually input a word into the extension popup
  - (Optional) Highlight a word directly on any website
- The system translates English → Vietnamese using DeepL API

---

### 2. 💾 Smart Caching (Key Feature)
- Before calling the API:
  - Check if the word already exists in local storage
- If the word exists:
  - Return stored result immediately (no API call)
- If not:
  - Call DeepL API
  - Store the result locally
  - Sync to Supabase (optional)

👉 Benefits:
- Reduce API usage (DeepL quota optimization)
- Improve performance (instant response)

---

### 3. 🧠 Vocabulary Storage
Each word is stored with:

- Word
- Meaning (Vietnamese)
- Context sentence (optional)
- Created timestamp
- Review metadata (for flashcards)

---

### 4. 📦 Storage Architecture

#### Local (Primary)
- chrome.storage.local
- Ensures fast and offline-first experience

#### Cloud Sync (Optional)
- Supabase (PostgreSQL)
- Used for:
  - Sync across devices
  - Backup
  - Flashcard access on mobile

---

### 5. 🧾 History Management
- Prevent duplicate entries
- Retrieve cached results instantly
- Persist vocabulary across sessions

---

### 6. 🃏 Flashcard System (Mobile + Web)
- A responsive web app for reviewing saved vocabulary
- Features:
  - Flashcard UI (word → reveal meaning)
  - Review tracking
  - (Optional) spaced repetition system

---

## 🧱 System Architecture
[User Action]
↓
[Browser Extension]
↓
Check Local Storage
↓
IF exists → return result
ELSE → call DeepL API
↓
Save locally
↓
(Optional) Sync to Supabase
↓
[Flashcard Web App]
↓
Fetch data from Supabase

---

## 🛠️ Tech Stack

### Extension
- JavaScript (Content Script)
- HTML/CSS (Popup UI)

### Translation API
- DeepL API

### Storage
- chrome.storage.local (primary)
- Supabase (PostgreSQL, optional sync)

### Flashcard Web
- React / simple web app (responsive)
- Deploy via Vercel

---

## 🔥 Future Improvements
- Context-aware translation
- AI-generated examples
- Spaced repetition algorithm (Anki-style)
- User authentication (optional)
- Multi-language support

---

## 🧠 Key Insight
This project is not just a translation tool, but a **personal vocabulary learning system integrated into daily browsing**, with offline-first performance and optional cloud sync.

---

## 📌 Summary
- Translate words using DeepL
- Cache results locally to reduce API calls
- Sync data across devices using Supabase
- Review vocabulary via flashcards on mobile

---

## 🧨 Development Strategy

1. Build MVP:
   - Manual input → translate → save locally
2. Add highlight-to-translate
3. Integrate Supabase sync
4. Build flashcard web app
5. Add spaced repetition

---

## 📎 Notes
- DeepL free tier: 500,000 characters/month (input only)
- Limit translation length (<50 characters) for optimization
- Use caching aggressively to minimize API usage
4. 📦 Storage Architecture
Local (Primary)
chrome.storage.local
Fast, offline-first
Cloud Sync (Optional)
Supabase (PostgreSQL)
Used for:
Sync across devices
Backup
Flashcard access on mobile
5. 🧾 History Management
Prevent duplicate entries
Normalize words (lowercase)
Instant lookup (O(1) access pattern)
6. 🃏 Flashcard System (Mobile + Web)
Responsive web app
Features:
Flashcard UI
Show main meaning first
Reveal other meanings
Review tracking
🧱 System Architecture

User → Extension → Check Cache
→ If exists → return
→ If not → Dictionary API → DeepL
→ Save local → (optional) Supabase
→ Flashcard Web App

🛠️ Tech Stack
Extension
JavaScript (Content Script)
HTML/CSS
APIs
DeepL API (translation)
Free Dictionary API (meanings + POS)
Storage
chrome.storage.local
Supabase (optional sync)
Flashcard Web
React / simple web app
Deploy via Vercel
🔥 Future Improvements
Smart meaning ranking (TOEIC-focused)
Lazy loading additional meanings
Spaced repetition (Anki-style)
Highlight-to-translate UX
AI-generated examples
🧠 Key Insight

This project is not just a translation tool, but a personal vocabulary learning system, combining translation, dictionary, caching, and spaced learning.

📌 Summary
Use Dictionary API for meanings + POS
Use DeepL only for main meaning
Cache everything locally
Sync optionally via Supabase
Learn via flashcards
🧨 Development Strategy
MVP:
Input → Dictionary → DeepL → Save
Add caching
Add UI for multiple meanings
Add Supabase sync
Build flashcard web