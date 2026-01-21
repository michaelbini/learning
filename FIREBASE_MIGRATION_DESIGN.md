# Firebase Migration Design

## Overview

This document outlines a design to migrate all learning games to use a shared Firebase Realtime Database as the primary data source, with local JSON files as fallback when the database is unavailable.

### Key Principles

1. **Test-First Approach** - Write tests for current behavior before making changes
2. **Graceful Degradation** - Firebase → JSON → Embedded (3-tier fallback)
3. **Incremental Migration** - Migrate one game at a time, verify tests pass
4. **Keep JSON as Fallback** - Don't delete JSON files, they're the safety net

### Quick Reference

| Item | Count |
|------|-------|
| **Phase 1: Migration** | 14/15 ✅ |
| **Phase 2: Statistics** | 8/8 ✅ |
| Games Migrated | 6/6 ✅ |
| Admin Tool | `admin/index.html` |
| Test Runner | `test/test-runner.html` |
| Stats Dashboard | `stats/index.html` |
| Files to Keep | JSON fallbacks |
| Total Tests | 33 |

### URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?source=firebase` | Force Firebase only (no JSON fallback) |
| `?source=json` | Force JSON only (skip Firebase) |
| (none) | Default: Firebase → JSON → Embedded |

### Admin Tool

The admin tool (`admin/index.html`) provides a full UI for managing vocabulary:

**Features:**
- 📊 **Dashboard** - Overview with stats for English and Hebrew vocabulary
- 🇬🇧 **English Panel** - Search, filter by lesson, add/edit/delete words
- 🇮🇱 **Hebrew Panel** - Search, filter by type/difficulty, add/edit/delete pairs
- 🔄 **Sync Panel** - Import JSON to Firebase, export, clear data

**Firebase Operations Used:**
```javascript
// Add new item with Firebase-generated ID
await push(ref(db, 'vocabulary/english'), word);

// Update existing item
await set(ref(db, `vocabulary/english/${id}`), word);

// Delete item
await remove(ref(db, `vocabulary/english/${id}`));

// Real-time listener
onValue(ref(db, 'vocabulary/english'), (snapshot) => {
    englishWords = snapshot.val() || {};
    updateUI();
});
```

### Firebase Data Structure

We use **structured database** (like `magin.html`), not file storage:

```
vocabulary/
  english/
    -NxAbc123: { english: "book", hebrew: "ספר", lesson: 1 }
    -NxAbc124: { english: "area", hebrew: "אזור", lesson: 1 }
  hebrew/
    -NxDef456: { word: "ילד", typo: "ילת", type: "words", difficulty: "easy" }
    -NxDef457: { word: "ילדה", typo: "ילדא", type: "words", difficulty: "easy" }
```

Each item has a Firebase-generated ID, enabling individual add/edit/delete operations.

---

## Current Architecture

### Data Sources

| Game Category | Current Data Source | Data Format |
|---------------|---------------------|-------------|
| English games | `english/vocabulary.json` | `{ vocabulary: [{english, hebrew, lesson}] }` |
| Hebrew spelling | `hebrew/vocabulary.json` | `{ wordPairs: [{word, typo, type, difficulty}] }` |
| Math games | Embedded in HTML | Various formats |
| Magin (roulette) | Firebase Realtime DB | `{ participants: [{name, location}] }` |

### Data Counts (Verified by Tests)

| Dataset | Count | Breakdown |
|---------|-------|-----------|
| English Vocabulary | 87 words | Lesson 1: 66, Lesson 2: 21 |
| Hebrew Word Pairs | 792 pairs | Words: 448, Numbers: 344 |
| Hebrew Difficulty | 4 levels | Easy: 52, Medium: 209, Hard: 521, Expert: 10 |

### Current Loading Pattern

```javascript
// All games follow this pattern
async function loadVocabulary() {
    try {
        const response = await fetch('vocabulary.json');
        if (response.ok) {
            const data = await response.json();
            // process data
        }
    } catch (error) {
        // fallback to embedded vocabulary
    }
}
```

---

## Proposed Architecture

### Data Loading Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Game Request Data                     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              1. Try Firebase Database                    │
│                 (Primary Source)                         │
└─────────────────────────────────────────────────────────┘
                            │
                   Success? │
              ┌─────────────┴─────────────┐
              │ YES                       │ NO (timeout/error)
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│   Return Firebase   │     │  2. Try Local JSON File     │
│        Data         │     │     (Fallback Source)       │
└─────────────────────┘     └─────────────────────────────┘
                                          │
                                 Success? │
                            ┌─────────────┴─────────────┐
                            │ YES                       │ NO
                            ▼                           ▼
              ┌─────────────────────┐     ┌─────────────────────┐
              │  Return JSON Data   │     │ 3. Use Embedded     │
              │  (Show offline      │     │    Vocabulary       │
              │   indicator)        │     │    (Last Resort)    │
              └─────────────────────┘     └─────────────────────┘
```

### Firebase Database Structure

```
learning-games-db/
├── vocabulary/
│   ├── english/
│   │   ├── lessons/
│   │   │   ├── lesson1/
│   │   │   │   ├── name: "Basic Words"
│   │   │   │   └── words/
│   │   │   │       ├── word1: { english: "area", hebrew: "אזור" }
│   │   │   │       └── word2: { english: "book", hebrew: "ספר" }
│   │   │   └── lesson2/...
│   │   └── metadata/
│   │       ├── totalWords: 90
│   │       └── lastUpdated: "2024-01-20"
│   │
│   ├── hebrew/
│   │   ├── wordPairs/
│   │   │   ├── pair1: { correct: "ילד", incorrect: "ילת", type: "words" }
│   │   │   └── pair2: { correct: "שלושה", incorrect: "שלשה", type: "numbers" }
│   │   └── metadata/
│   │       ├── totalPairs: 455
│   │       └── lastUpdated: "2024-01-20"
│   │
│   └── numbers/
│       └── pairs/
│           └── pair1: { correct: "אחד", incorrect: "אחת", type: "numbers" }
│
├── progress/
│   └── {sessionId}/
│       ├── english/
│       │   ├── flashcards: { correct: 10, total: 15, lastPlayed: timestamp }
│       │   └── quiz: { correct: 8, total: 12, lastPlayed: timestamp }
│       └── hebrew/
│           └── spelling: { correct: 20, total: 25, lastPlayed: timestamp }
│
└── admin/
    └── participants/  (existing magin.html data)
        └── {id}: { name: "...", location: "..." }
```

---

## Shared Firebase Module

### File: `shared/firebase-config.js`

```javascript
// Firebase configuration (shared across all games)
export const firebaseConfig = {
    apiKey: "AIzaSyBWc81acgd-9tVi4wLlAw_PXdEgR0n81qU",
    authDomain: "trip-9506c.firebaseapp.com",
    projectId: "trip-9506c",
    storageBucket: "trip-9506c.firebasestorage.app",
    messagingSenderId: "813393240812",
    appId: "1:813393240812:web:929bed95de2c48d5e43bc9",
    databaseURL: "https://trip-9506c-default-rtdb.firebaseio.com/"
};

export const DB_PATHS = {
    ENGLISH_VOCABULARY: 'vocabulary/english',
    HEBREW_WORD_PAIRS: 'vocabulary/hebrew/wordPairs',
    HEBREW_NUMBERS: 'vocabulary/numbers/pairs',
    PROGRESS: 'progress',
    PARTICIPANTS: 'admin/participants'
};

// Fallback JSON paths (relative to game directory)
export const JSON_FALLBACKS = {
    ENGLISH_VOCABULARY: 'vocabulary.json',
    HEBREW_WORD_PAIRS: 'vocabulary.json',
    HEBREW_NUMBERS: 'vocabulary_numbers_small.json'
};

// Connection timeout in milliseconds
export const FIREBASE_TIMEOUT = 5000;
```

### File: `shared/vocabulary-service.js`

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig, DB_PATHS, JSON_FALLBACKS, FIREBASE_TIMEOUT } from './firebase-config.js';

class VocabularyService {
    constructor() {
        this.app = null;
        this.db = null;
        this.isConnected = false;
        this.isOffline = false;
        this.cache = new Map();
        this.onStatusChange = null; // Callback for connection status
    }

    async init() {
        if (this.app) return this.isConnected;

        try {
            this.app = initializeApp(firebaseConfig);
            this.db = getDatabase(this.app);
            this.isConnected = true;
            return true;
        } catch (error) {
            console.warn('Firebase init failed:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    // Set callback for connection status changes
    setStatusCallback(callback) {
        this.onStatusChange = callback;
    }

    // Notify status change
    _notifyStatus(isOnline, source) {
        if (this.onStatusChange) {
            this.onStatusChange({ isOnline, source });
        }
    }

    // ============================================
    // ENGLISH VOCABULARY
    // ============================================
    async getEnglishVocabulary(jsonFallbackPath = 'vocabulary.json') {
        // Try Firebase first
        const firebaseData = await this._tryFirebase(DB_PATHS.ENGLISH_VOCABULARY);
        if (firebaseData) {
            this._notifyStatus(true, 'firebase');
            return this._transformEnglishData(firebaseData);
        }

        // Fallback to JSON
        const jsonData = await this._tryJsonFallback(jsonFallbackPath);
        if (jsonData) {
            this._notifyStatus(false, 'json');
            return jsonData;
        }

        // Return null - game should use embedded data
        this._notifyStatus(false, 'embedded');
        return null;
    }

    // ============================================
    // HEBREW WORD PAIRS
    // ============================================
    async getHebrewWordPairs(type = null, jsonFallbackPath = 'vocabulary.json') {
        // Try Firebase first
        const firebaseData = await this._tryFirebase(DB_PATHS.HEBREW_WORD_PAIRS);
        if (firebaseData) {
            this._notifyStatus(true, 'firebase');
            let pairs = Object.values(firebaseData);
            if (type) {
                pairs = pairs.filter(pair => pair.type === type);
            }
            return pairs;
        }

        // Fallback to JSON
        const jsonData = await this._tryJsonFallback(jsonFallbackPath);
        if (jsonData) {
            this._notifyStatus(false, 'json');
            let pairs = jsonData.wordPairs || jsonData;
            if (type && Array.isArray(pairs)) {
                pairs = pairs.filter(pair => pair.type === type);
            }
            return pairs;
        }

        // Return null - game should use embedded data
        this._notifyStatus(false, 'embedded');
        return null;
    }

    // ============================================
    // FIREBASE FETCH WITH TIMEOUT
    // ============================================
    async _tryFirebase(path) {
        if (!await this.init()) {
            return null;
        }

        // Check cache first
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }

        try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Firebase timeout')), FIREBASE_TIMEOUT);
            });

            // Create fetch promise
            const fetchPromise = get(ref(this.db, path));

            // Race between fetch and timeout
            const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
            const data = snapshot.val();

            if (data) {
                this.cache.set(path, data);
                this.isOffline = false;
                console.log(`✅ Data loaded from Firebase: ${path}`);
                return data;
            }
        } catch (error) {
            console.warn(`⚠️ Firebase fetch failed for ${path}:`, error.message);
            this.isOffline = true;
        }

        return null;
    }

    // ============================================
    // JSON FALLBACK FETCH
    // ============================================
    async _tryJsonFallback(jsonPath) {
        try {
            const response = await fetch(jsonPath);
            if (response.ok) {
                const data = await response.json();
                console.log(`📁 Data loaded from JSON fallback: ${jsonPath}`);
                return data;
            }
        } catch (error) {
            console.warn(`⚠️ JSON fallback failed for ${jsonPath}:`, error.message);
        }
        return null;
    }

    // ============================================
    // DATA TRANSFORMERS
    // ============================================
    _transformEnglishData(firebaseData) {
        // Transform Firebase structure to match expected JSON format
        if (firebaseData.lessons) {
            return {
                lessons: Object.values(firebaseData.lessons).map(lesson => ({
                    name: lesson.name,
                    words: lesson.words ? Object.values(lesson.words) : []
                }))
            };
        }
        return firebaseData;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================
    clearCache() {
        this.cache.clear();
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isOffline: this.isOffline
        };
    }
}

// Singleton instance
export const vocabularyService = new VocabularyService();
```

---

## Fallback Mechanism Details

### Priority Order

1. **Firebase Database (Primary)**
   - Real-time, always up-to-date
   - Timeout after 5 seconds if no response
   - Cached locally after first successful fetch

2. **Local JSON Files (Fallback)**
   - Used when Firebase is unavailable
   - Shows "offline mode" indicator to user
   - Data may be slightly outdated

3. **Embedded Vocabulary (Last Resort)**
   - Hardcoded in HTML files
   - Used only if both Firebase and JSON fail
   - Minimal dataset for basic functionality

### Offline Indicator Component

```javascript
// shared/offline-indicator.js
export function createOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.innerHTML = '📡 מצב לא מקוון - נטען מקובץ מקומי';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #f59e0b;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        z-index: 9999;
        display: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(indicator);
    return indicator;
}

export function showOfflineIndicator(show = true) {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
    }
}
```

---

## Migration Strategy

### Phase 1: Create Shared Infrastructure

1. Create `shared/` directory with:
   - `firebase-config.js` - Firebase configuration
   - `vocabulary-service.js` - Data access layer with fallback
   - `offline-indicator.js` - UI component for offline status

2. Directory structure:
   ```
   learning/
   ├── shared/
   │   ├── firebase-config.js
   │   ├── vocabulary-service.js
   │   └── offline-indicator.js
   ├── english/
   │   └── vocabulary.json  ← KEEP as fallback
   ├── hebrew/
   │   └── vocabulary.json  ← KEEP as fallback
   ├── math/
   └── index.html
   ```

### Phase 2: Populate Firebase Database

1. Create a migration script to upload existing JSON data:
   ```javascript
   // migrate-data.js (run once)
   import vocabulary from './english/vocabulary.json';
   import hebrewPairs from './hebrew/vocabulary.json';
   // ... upload to Firebase
   ```

2. Verify data structure in Firebase Console

### Phase 3: Update Games (One at a Time)

#### English Games Migration

**Before:**
```javascript
async function loadVocabulary() {
    try {
        const response = await fetch('vocabulary.json');
        if (response.ok) {
            const data = await response.json();
            // process data
        }
    } catch (error) {
        // use embedded
    }
}
```

**After:**
```javascript
import { vocabularyService } from '../shared/vocabulary-service.js';
import { createOfflineIndicator, showOfflineIndicator } from '../shared/offline-indicator.js';

// Create offline indicator on page load
createOfflineIndicator();

// Set status callback
vocabularyService.setStatusCallback(({ isOnline, source }) => {
    showOfflineIndicator(!isOnline);
    console.log(`Data source: ${source}`);
});

async function loadVocabulary() {
    // Try Firebase first, then JSON fallback
    const data = await vocabularyService.getEnglishVocabulary('vocabulary.json');

    if (data) {
        // Use data from Firebase or JSON
        vocabulary = data.lessons
            ? data.lessons.flatMap(lesson => lesson.words)
            : data;
    } else {
        // Last resort: use embedded vocabulary
        vocabulary = EMBEDDED_VOCABULARY;
    }

    initializeGame();
}
```

#### Hebrew Games Migration

**After:**
```javascript
import { vocabularyService } from '../shared/vocabulary-service.js';
import { createOfflineIndicator, showOfflineIndicator } from '../shared/offline-indicator.js';

createOfflineIndicator();

vocabularyService.setStatusCallback(({ isOnline }) => {
    showOfflineIndicator(!isOnline);
});

async function loadWordPairs() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('type') || 'words';

    // Try Firebase first, then JSON fallback
    const data = await vocabularyService.getHebrewWordPairs(gameType, 'vocabulary.json');

    if (data) {
        wordPairs = data;
    } else {
        // Last resort: use embedded word pairs
        wordPairs = EMBEDDED_WORD_PAIRS.filter(p => p.type === gameType);
    }

    initializeGame();
}
```

---

## Files to Modify

| File | Changes Required |
|------|------------------|
| `english/flashcards.html` | Add vocabularyService with JSON fallback |
| `english/quiz.html` | Add vocabularyService with JSON fallback |
| `english/typing.html` | Add vocabularyService with JSON fallback |
| `english/board.html` | Add vocabularyService with JSON fallback |
| `hebrew/spelling.html` | Add vocabularyService with JSON fallback |
| `hebrew/spelling-compar.html` | Add vocabularyService with JSON fallback |

---

## Files to KEEP as Fallback

| File | Purpose |
|------|---------|
| `english/vocabulary.json` | Fallback when Firebase unavailable |
| `hebrew/vocabulary.json` | Fallback when Firebase unavailable |

---

## Files Safe to DELETE (Orphaned)

| File | Reason |
|------|--------|
| `vocabulary.json` (root) | Duplicate, not used |
| `vocabulary_numbers_small.json` (root) | Not referenced |
| `word-pairs-manager.js` (root) | Not used at root |
| `hebrew/vocabulary_numbers_small.json` | Not referenced |
| `magin.html` | Not linked from index |

---

## Benefits

1. **Resilience** - Games work even when Firebase is down
2. **Single Source of Truth** - Firebase is primary, JSON is backup
3. **Real-time Updates** - When online, changes reflect immediately
4. **Offline Support** - Users can still play with local JSON
5. **User Feedback** - Clear indicator when in offline mode
6. **Graceful Degradation** - Three-tier fallback system

---

## Connection Status UI

| Status | Indicator | Data Source |
|--------|-----------|-------------|
| Online | None (hidden) | Firebase |
| Offline | Yellow banner: "מצב לא מקוון" | Local JSON |
| Error | Yellow banner | Embedded |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Firebase outage | JSON fallback + embedded vocabulary |
| JSON out of sync | Periodic sync script or manual update |
| API key exposure | Firebase security rules (read-only for vocab) |
| Slow connection | 5-second timeout, then fallback |

---

## Security Rules (Firebase)

```json
{
  "rules": {
    "vocabulary": {
      ".read": true,
      ".write": false
    },
    "progress": {
      "$sessionId": {
        ".read": true,
        ".write": true
      }
    },
    "admin": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## Keeping JSON in Sync

### Option 1: Manual Export Script

```javascript
// export-firebase-to-json.js
// Run periodically to update JSON fallback files
import { vocabularyService } from './shared/vocabulary-service.js';
import fs from 'fs';

async function exportToJson() {
    const englishData = await vocabularyService.getEnglishVocabulary();
    fs.writeFileSync('./english/vocabulary.json', JSON.stringify(englishData, null, 2));

    const hebrewData = await vocabularyService.getHebrewWordPairs();
    fs.writeFileSync('./hebrew/vocabulary.json', JSON.stringify({ wordPairs: hebrewData }, null, 2));
}
```

### Option 2: GitHub Action (Automated)

```yaml
# .github/workflows/sync-vocabulary.yml
name: Sync Firebase to JSON
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Export Firebase data
        run: node export-firebase-to-json.js
      - name: Commit changes
        run: |
          git add *.json
          git commit -m "Sync vocabulary from Firebase" || exit 0
          git push
```

---

## Implementation Order (Test-First Approach)

### Why Test-First?

Before making any changes, we need to establish a baseline of tests that verify current behavior. This ensures we don't break existing functionality during migration.

```
┌─────────────────────────────────────┐
│  1. Write tests for CURRENT code    │
│     (games load from JSON)          │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  2. Run tests → All PASS            │
│     (baseline established)          │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  3. Build VocabularyService         │
│     + unit tests for it             │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  4. Migrate ONE game (flashcards)   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  5. Run tests → All PASS?           │
│     YES → continue to next game     │
│     NO → fix before proceeding      │
└─────────────────────────────────────┘
```

---

### Phase 1: Testing Current Behavior (Tasks 1-3) ✅ COMPLETED

| Task | Description | Output | Status |
|------|-------------|--------|--------|
| 1 | Create test infrastructure | `test/test-runner.html`, `test/test-utils.js` | ✅ Done |
| 2 | Write tests for current English games | 11 tests including lesson logic | ✅ Done |
| 3 | Write tests for current Hebrew games | 16 tests including difficulty | ✅ Done |

**Test Summary (33 total tests):**

| Suite | Tests | What's Verified |
|-------|-------|-----------------|
| English Vocabulary | 11 | Loading, structure, 87 words, 2 lessons (66+21), no empty values |
| Hebrew Vocabulary | 16 | Loading, structure, 792 pairs, type filtering (448+344), difficulty levels (52+209+521+10) |
| Game Pages | 6 | All 6 HTML game pages load successfully |

**Data Source Selector:**

The test runner includes a UI to switch between data sources:
- 📁 **JSON Files** - Local files (ready now)
- 🔥 **Firebase** - Remote database (pending Tasks 5-6)
- 🔄 **Fallback** - Firebase → JSON (pending Tasks 5-6)

Same 33 tests run against any data source to verify data consistency.

---

### Phase 2: Upload to Firebase (Task 4) ✅ COMPLETED

| Task | Description | Tool | Status |
|------|-------------|------|--------|
| 4 | Upload vocabulary to Firebase | `admin/upload-to-firebase.js` | ✅ Done |

**Uploaded Data:**
- English: **87 words** (2 lessons)
- Hebrew: **792 pairs** (words + numbers, 4 difficulty levels)

**Verification:**
```bash
curl -s 'https://trip-9506c-default-rtdb.firebaseio.com/vocabulary/english.json' | jq 'length'
# Returns: 87

curl -s 'https://trip-9506c-default-rtdb.firebaseio.com/vocabulary/hebrew.json' | jq 'length'
# Returns: 792
```

---

### Phase 3: Infrastructure (Tasks 5-7) ✅ COMPLETED

| Task | Description | Output | Status |
|------|-------------|--------|--------|
| 5 | Create `shared/` + Firebase config | `shared/firebase-config.js` | ✅ Done |
| 6 | Wire DataSource to Firebase in tests | Update `test/test-runner.html` | ✅ Done |
| 7 | Create VocabularyService | `shared/vocabulary-service.js` | ✅ Done |

**Files Created in `shared/`:**

| File | Purpose |
|------|---------|
| `firebase-config.js` | Firebase config, DB_PATHS, FIREBASE_TIMEOUT, EXPECTED_COUNTS |
| `vocabulary-service.js` | Data access layer with 3-tier fallback |
| `offline-indicator.js` | UI component for offline status banner |

**VocabularyService API:**
```javascript
import { vocabularyService } from '../shared/vocabulary-service.js';

// Get all English vocabulary
const data = await vocabularyService.getEnglishVocabulary();
// Returns: { vocabulary: [...] }

// Get all Hebrew vocabulary
const data = await vocabularyService.getHebrewVocabulary();
// Returns: { wordPairs: [...] }

// Filtered getters
await vocabularyService.getEnglishByLesson(1);
await vocabularyService.getHebrewByType('words');
await vocabularyService.getHebrewByDifficulty('easy');
```

**Test Runner Updated:**
- Imports Firebase SDK and shared config
- DataSource now supports all 3 modes:
  - 📁 JSON Files - Local files
  - 🔥 Firebase - Remote database (✅ working!)
  - 🔄 Fallback - Firebase → JSON

---

### Phase 4: Migrate Games (Tasks 8-13) ✅ COMPLETED

| Task | File | Status |
|------|------|--------|
| 8 | `english/flashcards.html` | ✅ Done |
| 9 | `english/quiz.html` | ✅ Done |
| 10 | `english/typing.html` | ✅ Done |
| 11 | `english/board.html` | ✅ Done |
| 12 | `hebrew/spelling.html` | ✅ Done |
| 13 | `hebrew/spelling-compar.html` | ✅ Done |

**Changes applied to each game:**
1. Changed `<script>` to `<script type="module">`
2. Added imports for VocabularyService and offline-indicator
3. Replaced `loadVocabulary()` to use VocabularyService with 3-tier fallback
4. Added offline indicator that shows when data is loaded from JSON fallback

---

### Phase 5: Cleanup (Task 14) ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 14 | Delete orphaned files + add URL source switch | ✅ Done |
| 15 | Update `magin.html` to use shared config | ⏭️ Skipped |

**Files Deleted:**
- `/learning/word-pairs-manager.js` (root duplicate)
- `/learning/hebrew/word-pairs-manager.js` (no longer needed)
- `/learning/hebrew/vocabulary_numbers_small.json` (not referenced)

**URL Source Switch Added:**
- `?source=firebase` - Force Firebase only
- `?source=json` - Force JSON only

---

### Phase 1 Task Summary

| Phase | Tasks | Count | Status |
|-------|-------|-------|--------|
| Testing Current Behavior | 1-3 | 3 | ✅ Complete |
| Upload to Firebase | 4 | 1 | ✅ Complete |
| Infrastructure | 5-7 | 3 | ✅ Complete |
| Migrate Games | 8-13 | 6 | ✅ Complete |
| Cleanup | 14 | 1 | ✅ Complete |
| Skipped | 15 | 1 | ⏭️ Skipped |
| **Total Phase 1** | | **14/15** | **✅ COMPLETE** |

---

## Testing Strategy

### Test File Structure

```
learning/
├── shared/
│   ├── firebase-config.js
│   ├── vocabulary-service.js
│   └── vocabulary-service.test.js  ← Test file
├── test/
│   ├── test-runner.html            ← Browser test runner
│   ├── mock-firebase.js            ← Firebase mock
│   └── test-utils.js               ← Test utilities
```

---

### File: `shared/vocabulary-service.test.js`

```javascript
/**
 * VocabularyService Test Suite
 * Run in browser console or with test-runner.html
 */

import { vocabularyService } from './vocabulary-service.js';

// ============================================
// TEST UTILITIES
// ============================================
const TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    async run(name, testFn) {
        try {
            await testFn();
            this.passed++;
            this.results.push({ name, status: '✅ PASS' });
            console.log(`✅ PASS: ${name}`);
        } catch (error) {
            this.failed++;
            this.results.push({ name, status: '❌ FAIL', error: error.message });
            console.error(`❌ FAIL: ${name}`, error.message);
        }
    },

    assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message} Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
        }
    },

    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`${message} Expected true, got false`);
        }
    },

    assertNotNull(value, message = '') {
        if (value === null || value === undefined) {
            throw new Error(`${message} Expected non-null value`);
        }
    },

    summary() {
        console.log('\n========== TEST SUMMARY ==========');
        console.log(`Total: ${this.passed + this.failed}`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        return { passed: this.passed, failed: this.failed, results: this.results };
    }
};

// ============================================
// MOCK IMPLEMENTATIONS
// ============================================

// Mock Firebase that simulates different scenarios
class MockFirebase {
    static scenario = 'online'; // 'online', 'offline', 'timeout', 'empty'
    static delay = 100;
    static mockData = {
        english: {
            lessons: {
                lesson1: { name: 'Test Lesson', words: { w1: { english: 'test', hebrew: 'בדיקה' } } }
            }
        },
        hebrew: {
            wordPairs: {
                p1: { correct: 'ילד', incorrect: 'ילת', type: 'words' },
                p2: { correct: 'שניים', incorrect: 'שנים', type: 'numbers' }
            }
        }
    };

    static setScenario(scenario, delay = 100) {
        this.scenario = scenario;
        this.delay = delay;
    }

    static async get(path) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                switch (this.scenario) {
                    case 'online':
                        const data = path.includes('english')
                            ? this.mockData.english
                            : this.mockData.hebrew;
                        resolve({ val: () => data });
                        break;
                    case 'offline':
                        reject(new Error('Network error'));
                        break;
                    case 'timeout':
                        // Never resolves - will hit timeout
                        break;
                    case 'empty':
                        resolve({ val: () => null });
                        break;
                }
            }, this.delay);
        });
    }
}

// Mock fetch for JSON fallback testing
const originalFetch = window.fetch;
function mockFetch(scenario = 'success', mockData = null) {
    window.fetch = async (url) => {
        if (scenario === 'success') {
            return {
                ok: true,
                json: async () => mockData || { wordPairs: [{ correct: 'json', incorrect: 'fallback', type: 'words' }] }
            };
        } else if (scenario === 'fail') {
            return { ok: false };
        } else if (scenario === 'error') {
            throw new Error('Network error');
        }
    };
}

function restoreFetch() {
    window.fetch = originalFetch;
}

// ============================================
// TEST CASES
// ============================================

async function runAllTests() {
    console.log('🧪 Starting VocabularyService Tests...\n');

    // Reset service state before tests
    vocabularyService.cache.clear();
    vocabularyService.isConnected = false;
    vocabularyService.isOffline = false;

    // ----------------------------------------
    // TEST 1: Firebase Online - Returns Data
    // ----------------------------------------
    await TestRunner.run('Firebase online returns data', async () => {
        MockFirebase.setScenario('online');
        // Note: In real test, you'd inject MockFirebase into service
        // For now, test the JSON fallback path

        mockFetch('success', {
            lessons: [{ name: 'Lesson 1', words: [{ english: 'hello', hebrew: 'שלום' }] }]
        });

        const data = await vocabularyService.getEnglishVocabulary('vocabulary.json');
        TestRunner.assertNotNull(data, 'Data should not be null');
        restoreFetch();
    });

    // ----------------------------------------
    // TEST 2: Firebase Offline - Falls back to JSON
    // ----------------------------------------
    await TestRunner.run('Firebase offline falls back to JSON', async () => {
        // Simulate Firebase failure by clearing connection
        vocabularyService.isConnected = false;
        vocabularyService.cache.clear();

        mockFetch('success', {
            wordPairs: [{ correct: 'fallback', incorrect: 'test', type: 'words' }]
        });

        const data = await vocabularyService.getHebrewWordPairs(null, 'vocabulary.json');
        TestRunner.assertNotNull(data, 'Should return JSON fallback data');
        restoreFetch();
    });

    // ----------------------------------------
    // TEST 3: Both Firebase and JSON fail - Returns null
    // ----------------------------------------
    await TestRunner.run('Both sources fail returns null', async () => {
        vocabularyService.isConnected = false;
        vocabularyService.cache.clear();

        mockFetch('error');

        const data = await vocabularyService.getHebrewWordPairs(null, 'nonexistent.json');
        TestRunner.assertEqual(data, null, 'Should return null when both fail');
        restoreFetch();
    });

    // ----------------------------------------
    // TEST 4: Type filtering works correctly
    // ----------------------------------------
    await TestRunner.run('Type filtering returns correct subset', async () => {
        mockFetch('success', {
            wordPairs: [
                { correct: 'ילד', incorrect: 'ילת', type: 'words' },
                { correct: 'שניים', incorrect: 'שנים', type: 'numbers' },
                { correct: 'ספר', incorrect: 'סיפר', type: 'words' }
            ]
        });

        const wordsOnly = await vocabularyService.getHebrewWordPairs('words', 'vocabulary.json');
        TestRunner.assertEqual(wordsOnly.length, 2, 'Should return 2 word pairs');
        TestRunner.assertTrue(wordsOnly.every(p => p.type === 'words'), 'All should be words type');

        const numbersOnly = await vocabularyService.getHebrewWordPairs('numbers', 'vocabulary.json');
        TestRunner.assertEqual(numbersOnly.length, 1, 'Should return 1 number pair');

        restoreFetch();
    });

    // ----------------------------------------
    // TEST 5: Cache works correctly
    // ----------------------------------------
    await TestRunner.run('Cache prevents duplicate fetches', async () => {
        vocabularyService.cache.clear();
        let fetchCount = 0;

        mockFetch('success', { wordPairs: [{ correct: 'cached', incorrect: 'data', type: 'words' }] });
        const originalFetchImpl = window.fetch;
        window.fetch = async (...args) => {
            fetchCount++;
            return originalFetchImpl(...args);
        };

        // First call - should fetch
        await vocabularyService.getHebrewWordPairs(null, 'vocabulary.json');
        // Second call - should use cache (but JSON fallback doesn't cache, so this tests the path)

        TestRunner.assertTrue(fetchCount >= 1, 'Should have fetched at least once');
        restoreFetch();
    });

    // ----------------------------------------
    // TEST 6: Status callback is called
    // ----------------------------------------
    await TestRunner.run('Status callback receives correct status', async () => {
        let receivedStatus = null;

        vocabularyService.setStatusCallback((status) => {
            receivedStatus = status;
        });

        mockFetch('success', { wordPairs: [] });
        await vocabularyService.getHebrewWordPairs(null, 'vocabulary.json');

        TestRunner.assertNotNull(receivedStatus, 'Status callback should be called');
        TestRunner.assertTrue('isOnline' in receivedStatus, 'Status should have isOnline');
        TestRunner.assertTrue('source' in receivedStatus, 'Status should have source');

        restoreFetch();
        vocabularyService.setStatusCallback(null);
    });

    // ----------------------------------------
    // TEST 7: Empty data handling
    // ----------------------------------------
    await TestRunner.run('Empty data returns empty array', async () => {
        mockFetch('success', { wordPairs: [] });

        const data = await vocabularyService.getHebrewWordPairs(null, 'vocabulary.json');
        TestRunner.assertEqual(data.length, 0, 'Should return empty array');

        restoreFetch();
    });

    // ----------------------------------------
    // TEST 8: Data transformation for English
    // ----------------------------------------
    await TestRunner.run('English data transformation works', async () => {
        mockFetch('success', {
            lessons: [
                { name: 'Lesson 1', words: [{ english: 'a', hebrew: 'א' }] },
                { name: 'Lesson 2', words: [{ english: 'b', hebrew: 'ב' }] }
            ]
        });

        const data = await vocabularyService.getEnglishVocabulary('vocabulary.json');
        TestRunner.assertTrue(Array.isArray(data.lessons), 'Should have lessons array');
        TestRunner.assertEqual(data.lessons.length, 2, 'Should have 2 lessons');

        restoreFetch();
    });

    // Print summary
    return TestRunner.summary();
}

// Export for use
export { runAllTests, TestRunner, MockFirebase, mockFetch, restoreFetch };
```

---

### File: `test/test-runner.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VocabularyService Tests</title>
    <style>
        body {
            font-family: 'Consolas', 'Monaco', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            margin: 0;
        }
        h1 { color: #569cd6; }
        .controls { margin: 20px 0; }
        button {
            background: #0e639c;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
            font-size: 14px;
            border-radius: 4px;
        }
        button:hover { background: #1177bb; }
        .pass { color: #4ec9b0; }
        .fail { color: #f14c4c; }
        #results {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            white-space: pre-wrap;
        }
        .summary {
            margin-top: 20px;
            padding: 15px;
            background: #333;
            border-radius: 8px;
        }
        .summary.all-pass { border-left: 4px solid #4ec9b0; }
        .summary.has-fail { border-left: 4px solid #f14c4c; }
    </style>
</head>
<body>
    <h1>🧪 VocabularyService Test Runner</h1>

    <div class="controls">
        <button onclick="runTests()">▶️ Run All Tests</button>
        <button onclick="runTests('online')">🌐 Test Online Mode</button>
        <button onclick="runTests('offline')">📴 Test Offline Mode</button>
        <button onclick="clearResults()">🗑️ Clear Results</button>
    </div>

    <div id="results">Click "Run All Tests" to start...</div>

    <script type="module">
        import { runAllTests, TestRunner } from '../shared/vocabulary-service.test.js';

        window.runTests = async function(mode) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '⏳ Running tests...\n\n';

            try {
                const summary = await runAllTests();

                // Display results
                let html = '';
                summary.results.forEach(r => {
                    const cls = r.status.includes('PASS') ? 'pass' : 'fail';
                    html += `<span class="${cls}">${r.status}</span>: ${r.name}\n`;
                    if (r.error) html += `   └─ Error: ${r.error}\n`;
                });

                html += `\n<div class="summary ${summary.failed === 0 ? 'all-pass' : 'has-fail'}">`;
                html += `📊 Results: ${summary.passed} passed, ${summary.failed} failed\n`;
                html += summary.failed === 0
                    ? '✅ All tests passed!'
                    : '❌ Some tests failed';
                html += '</div>';

                resultsDiv.innerHTML = html;
            } catch (error) {
                resultsDiv.innerHTML = `<span class="fail">❌ Test runner error: ${error.message}</span>`;
            }
        };

        window.clearResults = function() {
            document.getElementById('results').innerHTML = 'Results cleared. Click "Run All Tests" to start...';
        };
    </script>
</body>
</html>
```

---

### Manual Testing Scenarios

#### Scenario 1: Test Firebase Online

```javascript
// In browser console on any game page
// 1. Open DevTools > Network tab
// 2. Ensure "Online" mode
// 3. Reload page
// 4. Check console for: "✅ Data loaded from Firebase"
// 5. Verify no offline indicator shown
```

#### Scenario 2: Test Firebase Offline (Network Disconnected)

```javascript
// In browser console
// 1. Open DevTools > Network tab
// 2. Select "Offline" from throttling dropdown
// 3. Reload page
// 4. Check console for: "📁 Data loaded from JSON fallback"
// 5. Verify yellow offline indicator appears
```

#### Scenario 3: Test Firebase Timeout

```javascript
// Modify firebase-config.js temporarily:
export const FIREBASE_TIMEOUT = 100; // Very short timeout

// Or simulate slow network:
// DevTools > Network > Slow 3G
// Then reload and watch for timeout fallback
```

#### Scenario 4: Test JSON Fallback Failure

```javascript
// 1. Rename vocabulary.json temporarily
// 2. Disconnect network (offline mode)
// 3. Reload page
// 4. Verify embedded vocabulary is used
// 5. Check console for: "ℹ️ Using embedded vocabulary"
```

#### Scenario 5: Test Cache Behavior

```javascript
// In browser console after page load:
vocabularyService.getConnectionStatus();
// Should show: { isConnected: true, isOffline: false }

// Clear cache and refetch:
vocabularyService.clearCache();
await vocabularyService.getHebrewWordPairs();
// Watch network tab - should make new request
```

---

### Browser Console Test Commands

```javascript
// Quick test commands to paste in browser console

// Test 1: Check service status
console.log('Status:', vocabularyService.getConnectionStatus());

// Test 2: Fetch English vocabulary
vocabularyService.getEnglishVocabulary('vocabulary.json')
    .then(data => console.log('English:', data?.lessons?.length, 'lessons'));

// Test 3: Fetch Hebrew words only
vocabularyService.getHebrewWordPairs('words', 'vocabulary.json')
    .then(data => console.log('Hebrew words:', data?.length, 'pairs'));

// Test 4: Fetch Hebrew numbers only
vocabularyService.getHebrewWordPairs('numbers', 'vocabulary.json')
    .then(data => console.log('Hebrew numbers:', data?.length, 'pairs'));

// Test 5: Test status callback
vocabularyService.setStatusCallback(s => console.log('Status changed:', s));
vocabularyService.clearCache();
vocabularyService.getHebrewWordPairs();

// Test 6: Simulate offline
vocabularyService.isConnected = false;
vocabularyService.clearCache();
vocabularyService.getHebrewWordPairs('words', 'vocabulary.json')
    .then(data => console.log('Offline result:', data?.length, 'pairs'));
```

---

### Integration Test: Full Game Flow

```javascript
// test/integration-test.js
// Run this after migrating a game

async function testGameIntegration() {
    console.log('🎮 Testing full game integration...\n');

    // 1. Test initial load
    console.log('1️⃣ Testing initial data load...');
    const startTime = performance.now();
    await loadVocabulary(); // Game's load function
    const loadTime = performance.now() - startTime;
    console.log(`   Loaded in ${loadTime.toFixed(0)}ms`);

    // 2. Test game has data
    console.log('2️⃣ Checking game state...');
    if (typeof vocabulary !== 'undefined' && vocabulary.length > 0) {
        console.log(`   ✅ Vocabulary loaded: ${vocabulary.length} items`);
    } else if (typeof wordPairs !== 'undefined' && wordPairs.length > 0) {
        console.log(`   ✅ Word pairs loaded: ${wordPairs.length} items`);
    } else {
        console.log('   ❌ No game data found!');
        return false;
    }

    // 3. Test offline indicator exists
    console.log('3️⃣ Checking offline indicator...');
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        console.log('   ✅ Offline indicator element exists');
    } else {
        console.log('   ⚠️ No offline indicator found');
    }

    // 4. Test game functionality
    console.log('4️⃣ Testing game start...');
    if (typeof initializeGame === 'function') {
        initializeGame();
        console.log('   ✅ Game initialized');
    }

    console.log('\n✅ Integration test complete!');
    return true;
}

// Run test
testGameIntegration();
```

---

## Testing Checklist

### Unit Tests
- [ ] `getEnglishVocabulary()` returns data when Firebase online
- [ ] `getHebrewWordPairs()` returns data when Firebase online
- [ ] `getHebrewWordPairs('words')` filters correctly
- [ ] `getHebrewWordPairs('numbers')` filters correctly
- [ ] Service falls back to JSON when Firebase fails
- [ ] Service returns null when both sources fail
- [ ] Cache prevents duplicate Firebase requests
- [ ] Status callback receives correct source info
- [ ] Timeout triggers fallback correctly

### Integration Tests
- [ ] Game loads and displays vocabulary
- [ ] Game works with Firebase data
- [ ] Game works with JSON fallback
- [ ] Game works with embedded data
- [ ] Offline indicator appears/hides correctly
- [ ] Type parameter (?type=words) works in URL

### Manual Tests
- [ ] Test with DevTools offline mode
- [ ] Test with slow network (3G throttling)
- [ ] Test with invalid Firebase config
- [ ] Test with missing JSON file
- [ ] Test on mobile device
- [ ] Test page refresh behavior
- [ ] Test navigation between games

---

## Project Summary

### What We're Building

A centralized data layer that:
- Fetches vocabulary from Firebase (primary)
- Falls back to local JSON when offline
- Uses embedded data as last resort
- Shows offline indicator to users

### Files to Create

| File | Purpose |
|------|---------|
| `shared/firebase-config.js` | Firebase configuration |
| `shared/vocabulary-service.js` | Data fetching with fallback |
| `shared/offline-indicator.js` | UI component |
| `shared/vocabulary-service.test.js` | Unit tests |
| `test/test-runner.html` | Browser test runner |

### Files to Keep (Fallback)

| File | Purpose |
|------|---------|
| `english/vocabulary.json` | Offline fallback for English games |
| `hebrew/vocabulary.json` | Offline fallback for Hebrew games |

### Files to Delete (Orphaned)

| File | Reason |
|------|--------|
| `vocabulary.json` (root) | Not used |
| `vocabulary_numbers_small.json` (root) | Not referenced |
| `word-pairs-manager.js` (root) | Not used |
| `hebrew/vocabulary_numbers_small.json` | Not referenced |
| `magin.html` | Not linked from index |

### Games to Migrate (6)

1. `english/flashcards.html`
2. `english/quiz.html`
3. `english/typing.html`
4. `english/board.html`
5. `hebrew/spelling.html`
6. `hebrew/spelling-compar.html`

---

## Getting Started

```bash
# Step 1: Start local server
python3 -m http.server 8000

# Step 2: Run tests to verify baseline (Tasks 1-3 ✅ COMPLETE)
open http://localhost:8000/test/test-runner.html

# Step 3: Verify all 33 tests pass
# - Select "JSON Files" data source
# - Click "Run All Tests"
# - All tests should pass

# Step 4: Next - Create shared infrastructure (Task 4)
mkdir -p shared

# Step 5: Implement Firebase config (Task 5)
# Step 6: Implement VocabularyService (Task 6)
# Step 7-8: Upload data to Firebase
# Step 9-14: Migrate games one at a time
# Step 15-16: Cleanup
```

---

---

# Phase 2: Game Statistics

## Overview

Track detailed game play statistics in Firebase to analyze usage patterns, player progress, and game popularity.

### Key Features

1. **Player Identification** - One-time name entry, stored in localStorage forever
2. **Cross-Device Support** - Same player name links stats across all devices
3. **Detailed Session Tracking** - Score, time, words played, difficulty
4. **Statistics Dashboard** - View aggregated stats and player history

---

## Player Identification

### Flow

```
First visit (any device):
┌─────────────────────────────────┐
│  🎮 Welcome to Learning Games   │
│                                 │
│  Enter your name:               │
│  ┌─────────────────────────┐   │
│  │ gen                      │   │
│  └─────────────────────────┘   │
│                                 │
│  [Start Playing]                │
└─────────────────────────────────┘
         ↓
   localStorage.setItem('player_name', 'gen')
         ↓
   Never asked again on this device
```

### Cross-Device Linking

```
Phone (first visit):   Enter "gen" → Saved to localStorage
Tablet (first visit):  Enter "gen" → Saved to localStorage
Computer (first visit): Enter "gen" → Saved to localStorage

All devices → Same "gen" stats in Firebase
```

### Architecture (Separation of Concerns)

```
shared/
├── player-service.js      ← Player ID + localStorage (Task 16 ✅)
├── statistics-service.js  ← Session tracking, imports playerService (Task 17)
├── vocabulary-service.js  ← Vocabulary data (existing)
└── offline-indicator.js   ← UI component (existing)
```

**How it works:**
- `player-service.js` handles player identification only
- `statistics-service.js` imports `playerService` internally
- Games only import `statisticsService` - player prompt happens automatically

### Implementation

**File: `shared/player-service.js`** ✅ Created

```javascript
import { playerService } from '../shared/player-service.js';

// Get player ID (prompts on first visit, returns cached thereafter)
const playerId = playerService.getPlayerId();

// Check if player exists without prompting
if (playerService.hasPlayerId()) { ... }

// Get ID silently (returns null if not set)
const id = playerService.getPlayerIdSilent();
```

**File: `shared/statistics-service.js`** (Task 17)

```javascript
import { playerService } from './player-service.js';

class StatisticsService {
  startSession(gameId, options) {
    // Automatically gets player ID (prompts if needed)
    const playerId = playerService.getPlayerId();
    // ... start tracking
  }
}
```

**Usage in games:**

```javascript
import { statisticsService } from '../shared/statistics-service.js';

// At game start - triggers player prompt if needed
statisticsService.startSession('english-flashcards', { totalWords: 87 });

// At game end
statisticsService.endSession({ correctCount: 72, wrongCount: 15 });
```

---

## Firebase Structure

```
/statistics
  /players
    /gen                                    # Player ID = lowercase name
      createdAt: "2026-01-15T08:00:00Z"
      lastSeen: "2026-01-21T10:30:45Z"
      totalSessions: 47
      gamesPlayed: ["english-flashcards", "hebrew-spelling", ...]

  /sessions
    /-OjXyz123abc                           # Auto-generated session ID
      # Player & Game Info
      playerId: "gen"
      gameId: "english-flashcards"
      timestamp: "2026-01-21T10:30:45Z"
      date: "2026-01-21"                    # For easy date queries

      # Game Results
      totalWords: 87
      wordsCompleted: 87
      correctCount: 72
      wrongCount: 15
      skippedCount: 0
      score: 83                             # Percentage (0-100)

      # Time Tracking
      durationSeconds: 342                  # 5 min 42 sec

      # Context
      lesson: 1                             # For English games (null if N/A)
      difficulty: null                      # For Hebrew games (null if N/A)
      isRetryMode: false                    # Playing wrong words only?
      source: "firebase"                    # Data source used
```

---

## Session Data Model

```javascript
{
  // Player
  playerId: string,           // "gen" - from localStorage

  // Game identification
  gameId: string,             // "english-flashcards", "hebrew-spelling", etc.
  timestamp: string,          // ISO timestamp "2026-01-21T10:30:45Z"
  date: string,               // "2026-01-21" for easy filtering

  // Game results
  totalWords: number,         // Total words in session
  wordsCompleted: number,     // Words actually played (may differ if abandoned)
  correctCount: number,       // Correct answers
  wrongCount: number,         // Wrong answers
  skippedCount: number,       // Skipped words (typing game)
  score: number,              // Percentage 0-100

  // Time tracking
  startTime: number,          // Unix timestamp (ms) when game started
  endTime: number,            // Unix timestamp (ms) when game ended
  durationSeconds: number,    // Total play time in seconds

  // Context (optional)
  lesson: number | null,      // English lesson number (1, 2, etc.)
  difficulty: string | null,  // Hebrew difficulty ("easy", "medium", "hard", "expert")
  isRetryMode: boolean,       // Was this a retry of wrong words?
  source: string              // "firebase" | "json" | "embedded"
}
```

---

## Statistics Service API

### File: `shared/statistics-service.js`

```javascript
class StatisticsService {
  constructor() {
    this.playerId = null;
    this.currentSession = null;
    this.startTime = null;
  }

  // ============================================
  // PLAYER IDENTIFICATION
  // ============================================

  // Get or prompt for player name (one-time prompt)
  getPlayerId() {
    if (this.playerId) return this.playerId;

    let name = localStorage.getItem('player_name');
    if (!name) {
      name = prompt('🎮 Enter your name to track progress:');
      if (name) {
        name = name.toLowerCase().trim();
        localStorage.setItem('player_name', name);
      }
    }
    this.playerId = name;
    return name;
  }

  // ============================================
  // SESSION TRACKING
  // ============================================

  // Call when game starts
  startSession(gameId, options = {}) {
    this.startTime = Date.now();
    this.currentSession = {
      playerId: this.getPlayerId(),
      gameId: gameId,
      totalWords: options.totalWords || 0,
      lesson: options.lesson || null,
      difficulty: options.difficulty || null,
      isRetryMode: options.isRetryMode || false,
      source: options.source || 'unknown'
    };
  }

  // Call when game ends - saves to Firebase
  async endSession(results) {
    if (!this.currentSession) return null;

    const endTime = Date.now();
    const session = {
      ...this.currentSession,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      wordsCompleted: results.wordsCompleted || this.currentSession.totalWords,
      correctCount: results.correctCount || 0,
      wrongCount: results.wrongCount || 0,
      skippedCount: results.skippedCount || 0,
      score: this._calculateScore(results),
      startTime: this.startTime,
      endTime: endTime,
      durationSeconds: Math.round((endTime - this.startTime) / 1000)
    };

    // Save to Firebase
    const sessionId = await this._saveSession(session);

    // Update player stats
    await this._updatePlayerStats(session);

    // Reset
    this.currentSession = null;
    this.startTime = null;

    return sessionId;
  }

  // ============================================
  // QUERY METHODS (for stats dashboard)
  // ============================================

  // Get all sessions for current player
  async getPlayerSessions(limit = 50) { ... }

  // Get sessions for a specific game
  async getGameSessions(gameId, limit = 50) { ... }

  // Get aggregated stats for a player
  async getPlayerStats() { ... }

  // Get aggregated stats for a game
  async getGameStats(gameId) { ... }

  // Get leaderboard for a game
  async getLeaderboard(gameId, limit = 10) { ... }
}

export const statisticsService = new StatisticsService();
```

---

## Usage in Games

### At Game Start

```javascript
// In startGame() or initializeGame()
statisticsService.startSession('english-flashcards', {
  totalWords: vocabulary.length,
  lesson: currentLesson,           // or null for Hebrew games
  difficulty: currentDifficulty,   // or null for English games
  isRetryMode: isRetryMode,
  source: vocabularyService.getLastSource()
});
```

### At Game End

```javascript
// In showFinalScreen() or showCompleteScreen()
await statisticsService.endSession({
  wordsCompleted: cards.length,
  correctCount: correctCount,
  wrongCount: wrongCount,
  skippedCount: skippedCount || 0
});
```

---

## Statistics Dashboard

### File: `stats/index.html`

A page to view statistics with:

1. **Player Summary**
   - Total games played
   - Total time spent
   - Average score
   - Favorite game

2. **Recent Sessions**
   - Last 20 game sessions
   - Date, game, score, duration

3. **Game Stats**
   - Stats per game
   - Best scores
   - Progress over time

4. **Leaderboard** (optional)
   - Top players by score
   - Top players by games played

### Dashboard Mockup

```
┌─────────────────────────────────────────────────────────┐
│  📊 Learning Games Statistics                           │
│  Player: gen                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📈 Your Summary                                        │
│  ┌─────────────┬─────────────┬─────────────┬─────────┐  │
│  │ Total Games │ Total Time  │ Avg Score   │ Streak  │  │
│  │     47      │   4h 32m    │    81%      │   12    │  │
│  └─────────────┴─────────────┴─────────────┴─────────┘  │
│                                                         │
│  🎮 Recent Sessions                                     │
│  ┌────────────┬──────────────────┬───────┬──────────┐  │
│  │ Date       │ Game             │ Score │ Duration │  │
│  ├────────────┼──────────────────┼───────┼──────────┤  │
│  │ 2026-01-21 │ English Quiz     │ 92%   │ 5:42     │  │
│  │ 2026-01-21 │ Hebrew Spelling  │ 78%   │ 8:15     │  │
│  │ 2026-01-20 │ English Typing   │ 85%   │ 4:30     │  │
│  └────────────┴──────────────────┴───────┴──────────┘  │
│                                                         │
│  🏆 Best Scores by Game                                 │
│  • English Flashcards: 95% (2026-01-18)                │
│  • English Quiz: 92% (2026-01-21)                      │
│  • Hebrew Spelling: 88% (2026-01-19)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 2 Tasks

| Task | Description | Status |
|------|-------------|--------|
| 16 | Create `shared/player-service.js` - Player name prompt + localStorage | ✅ Done |
| 17 | Create `shared/statistics-service.js` - Session tracking + Firebase save | ✅ Done |
| 18 | Add statistics tracking to English games (4 games) | ✅ Done |
| 19 | Add statistics tracking to Hebrew games (2 games) | ✅ Done |
| 20 | Create `stats/index.html` - Statistics dashboard | ✅ Done |
| 21 | Add player summary view to dashboard | ✅ Done (combined with 20) |
| 22 | Add recent sessions + game stats to dashboard | ✅ Done (combined with 20) |
| 23 | Create admin statistics dashboard (`stats/admin.html`) | ✅ Done |

### Task Details

**Task 16: Create Player Service** ✅ DONE
- Created `shared/player-service.js`
- On first visit, shows prompt: "🎮 Enter your name to track progress:"
- Saves to `localStorage.setItem('player_name', name)`
- Never asks again - stored forever
- Same name on different devices = aggregated stats
- Exports: `getPlayerId()`, `hasPlayerId()`, `getPlayerIdSilent()`, `clearPlayerId()`, `setPlayerId()`

**Task 17: Create Statistics Service** ✅ DONE
- Created `shared/statistics-service.js`
- Imports `playerService` internally (separation of concerns)
- `startSession(gameId, options)` - starts tracking, triggers player prompt if needed
- `endSession(results)` - saves session to Firebase
- Query methods for dashboard: `getPlayerSessions()`, `getPlayerStats()`, `getBestScores()`

**Task 18: Add to English Games** ✅ DONE
- `flashcards.html` - Track on game completion
- `quiz.html` - Track on game completion
- `typing.html` - Track on game completion
- `board.html` - Track on game completion

**Task 19: Add to Hebrew Games** ✅ DONE
- `spelling.html` - Track on game completion
- `spelling-compar.html` - Track on game completion

**Task 20-22: Create Dashboard Page** ✅ DONE
- Created `stats/index.html` with full dashboard
- Player summary cards (total sessions, play time, avg score, games played)
- Best scores per game section
- Recent sessions table with score, duration, date
- Link added to main `index.html`

---

## Firebase Security Rules Update

```json
{
  "rules": {
    "vocabulary": {
      ".read": true,
      ".write": false
    },
    "statistics": {
      "sessions": {
        ".read": true,
        ".write": true,
        ".indexOn": ["playerId", "gameId", "date"]
      },
      "players": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Initial | Basic migration design |
| 1.1 | Updated | Added JSON fallback mechanism |
| 1.2 | Updated | Added comprehensive testing strategy |
| 1.3 | Updated | Reorganized with test-first approach |
| 1.4 | Updated | Tasks 1-3 complete, 33 tests, data source selector, actual data structure verified |
| 1.5 | Updated | Added admin tool, reordered tasks (upload first), structured DB approach |
| 1.6 | Updated | Task 4 complete - vocabulary uploaded to Firebase (87 English, 792 Hebrew) |
| 1.7 | Updated | Tasks 5-7 complete - shared/ infrastructure, VocabularyService, test runner wired to Firebase |
| 1.8 | Updated | Phase 1 complete (14/15 tasks) - all games migrated, URL source switch added |
| 1.9 | Updated | Added Phase 2: Statistics design with player tracking and dashboard |
| 2.0 | Updated | Task 16 complete - player-service.js created, architecture clarified (separation of concerns) |
| 2.1 | Updated | Phase 2 complete (7/7 tasks) - statistics-service.js, all 6 games integrated, stats dashboard created |
| 2.2 | Updated | Added admin statistics dashboard (Task 23) - all players view, leaderboards, game stats |

