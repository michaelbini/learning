/**
 * Firebase Configuration for Learning Games
 * Shared across all games for consistent database access
 */

// Firebase project configuration
export const firebaseConfig = {
    apiKey: "AIzaSyBWc81acgd-9tVi4wLlAw_PXdEgR0n81qU",
    authDomain: "trip-9506c.firebaseapp.com",
    projectId: "trip-9506c",
    storageBucket: "trip-9506c.firebasestorage.app",
    messagingSenderId: "813393240812",
    appId: "1:813393240812:web:929bed95de2c48d5e43bc9",
    databaseURL: "https://trip-9506c-default-rtdb.firebaseio.com/"
};

// Database paths
export const DB_PATHS = {
    VOCABULARY_ENGLISH: 'vocabulary/english',
    VOCABULARY_HEBREW: 'vocabulary/hebrew',
    PARTICIPANTS: 'participants'
};

// Fallback JSON paths (relative to game directory)
export const JSON_FALLBACKS = {
    ENGLISH: '../english/vocabulary.json',
    HEBREW: '../hebrew/vocabulary.json'
};

// Connection timeout in milliseconds
export const FIREBASE_TIMEOUT = 5000;

// Expected data counts (for validation)
export const EXPECTED_COUNTS = {
    ENGLISH_WORDS: 87,
    ENGLISH_LESSONS: 2,
    HEBREW_PAIRS: 792,
    HEBREW_WORDS: 448,
    HEBREW_NUMBERS: 344
};
