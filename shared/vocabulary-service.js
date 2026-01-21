/**
 * VocabularyService - Data access layer for Learning Games
 * Provides vocabulary data with 3-tier fallback: Firebase -> JSON -> Embedded
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig, DB_PATHS, FIREBASE_TIMEOUT } from './firebase-config.js';

class VocabularyService {
    constructor() {
        this.app = null;
        this.db = null;
        this.isConnected = false;
        this.isOffline = false;
        this.cache = new Map();
        this.onStatusChange = null;
        this.lastSource = null;
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

    setStatusCallback(callback) {
        this.onStatusChange = callback;
    }

    _notifyStatus(isOnline, source) {
        this.lastSource = source;
        if (this.onStatusChange) {
            this.onStatusChange({ isOnline, source });
        }
    }

    // ============================================
    // ENGLISH VOCABULARY
    // ============================================
    async getEnglishVocabulary(jsonFallbackPath = '../english/vocabulary.json') {
        // Try Firebase first
        const firebaseData = await this._tryFirebase(DB_PATHS.VOCABULARY_ENGLISH);
        if (firebaseData) {
            this._notifyStatus(true, 'firebase');
            // Transform Firebase object to array
            const words = Object.values(firebaseData);
            return { vocabulary: words };
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
    // HEBREW VOCABULARY
    // ============================================
    async getHebrewVocabulary(jsonFallbackPath = '../hebrew/vocabulary.json') {
        // Try Firebase first
        const firebaseData = await this._tryFirebase(DB_PATHS.VOCABULARY_HEBREW);
        if (firebaseData) {
            this._notifyStatus(true, 'firebase');
            // Transform Firebase object to array
            const pairs = Object.values(firebaseData);
            return { wordPairs: pairs };
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
    // FILTERED GETTERS
    // ============================================
    async getEnglishByLesson(lesson, jsonFallbackPath) {
        const data = await this.getEnglishVocabulary(jsonFallbackPath);
        if (!data || !data.vocabulary) return null;
        return {
            vocabulary: data.vocabulary.filter(w => w.lesson === lesson)
        };
    }

    async getHebrewByType(type, jsonFallbackPath) {
        const data = await this.getHebrewVocabulary(jsonFallbackPath);
        if (!data || !data.wordPairs) return null;
        return {
            wordPairs: data.wordPairs.filter(p => p.type === type)
        };
    }

    async getHebrewByDifficulty(difficulty, jsonFallbackPath) {
        const data = await this.getHebrewVocabulary(jsonFallbackPath);
        if (!data || !data.wordPairs) return null;
        return {
            wordPairs: data.wordPairs.filter(p => p.difficulty === difficulty)
        };
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
    // UTILITY METHODS
    // ============================================
    clearCache() {
        this.cache.clear();
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isOffline: this.isOffline,
            lastSource: this.lastSource
        };
    }

    getLastSource() {
        return this.lastSource;
    }
}

// Singleton instance
export const vocabularyService = new VocabularyService();

// Also export the class for testing
export { VocabularyService };
