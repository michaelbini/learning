/**
 * StatisticsService - Game session tracking for Learning Games
 *
 * Tracks game sessions and saves to Firebase.
 * Uses PlayerService for player identification.
 *
 * Usage:
 *   import { statisticsService } from '../shared/statistics-service.js';
 *
 *   // At game start
 *   statisticsService.startSession('english-flashcards', { totalWords: 87, lesson: 1 });
 *
 *   // At game end
 *   await statisticsService.endSession({ correctCount: 72, wrongCount: 15 });
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, get, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';
import { playerService } from './player-service.js';

const DB_PATHS = {
    SESSIONS: 'statistics/sessions',
    PLAYERS: 'statistics/players'
};

class StatisticsService {
    constructor() {
        this.app = null;
        this.db = null;
        this.currentSession = null;
        this.startTime = null;
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async _init() {
        if (this.app) return true;

        try {
            this.app = initializeApp(firebaseConfig, 'statistics');
            this.db = getDatabase(this.app);
            return true;
        } catch (error) {
            // App might already be initialized
            if (error.code === 'app/duplicate-app') {
                const { getApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
                try {
                    this.app = getApp('statistics');
                    this.db = getDatabase(this.app);
                    return true;
                } catch {
                    this.app = getApp();
                    this.db = getDatabase(this.app);
                    return true;
                }
            }
            console.warn('Statistics: Firebase init failed:', error.message);
            return false;
        }
    }

    // ============================================
    // SESSION TRACKING
    // ============================================

    /**
     * Start a new game session.
     * Triggers player name prompt if not already set.
     *
     * @param {string} gameId - Game identifier (e.g., 'english-flashcards')
     * @param {object} options - Session options
     * @param {number} options.totalWords - Total words in this session
     * @param {number} [options.lesson] - Lesson number (English games)
     * @param {string} [options.difficulty] - Difficulty level (Hebrew games)
     * @param {boolean} [options.isRetryMode] - Is this a retry of wrong words?
     * @param {string} [options.source] - Data source ('firebase', 'json', 'embedded')
     */
    startSession(gameId, options = {}) {
        // Get player ID (prompts if needed)
        const playerId = playerService.getPlayerId();

        if (!playerId) {
            console.warn('Statistics: No player ID, session not tracked');
            return;
        }

        this.startTime = Date.now();
        this.currentSession = {
            playerId: playerId,
            gameId: gameId,
            totalWords: options.totalWords || 0,
            lesson: options.lesson || null,
            difficulty: options.difficulty || null,
            isRetryMode: options.isRetryMode || false,
            source: options.source || 'unknown'
        };

        console.log(`📊 Session started: ${gameId} (${options.totalWords} words)`);
    }

    /**
     * End the current session and save to Firebase.
     *
     * @param {object} results - Game results
     * @param {number} results.correctCount - Number of correct answers
     * @param {number} results.wrongCount - Number of wrong answers
     * @param {number} [results.skippedCount] - Number of skipped words
     * @param {number} [results.wordsCompleted] - Words actually completed
     * @returns {Promise<string|null>} Session ID or null if failed
     */
    async endSession(results) {
        if (!this.currentSession) {
            console.warn('Statistics: No active session to end');
            return null;
        }

        const endTime = Date.now();
        const wordsCompleted = results.wordsCompleted ||
            (results.correctCount + results.wrongCount + (results.skippedCount || 0));

        const session = {
            // Player & Game Info
            playerId: this.currentSession.playerId,
            gameId: this.currentSession.gameId,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],

            // Game Results
            totalWords: this.currentSession.totalWords,
            wordsCompleted: wordsCompleted,
            correctCount: results.correctCount || 0,
            wrongCount: results.wrongCount || 0,
            skippedCount: results.skippedCount || 0,
            score: this._calculateScore(results.correctCount, wordsCompleted),

            // Time Tracking
            startTime: this.startTime,
            endTime: endTime,
            durationSeconds: Math.round((endTime - this.startTime) / 1000),

            // Context
            lesson: this.currentSession.lesson,
            difficulty: this.currentSession.difficulty,
            isRetryMode: this.currentSession.isRetryMode,
            source: this.currentSession.source
        };

        // Save to Firebase
        const sessionId = await this._saveSession(session);

        // Update player stats
        if (sessionId) {
            await this._updatePlayerStats(session);
        }

        // Log result
        console.log(`📊 Session ended: ${session.score}% (${session.correctCount}/${wordsCompleted}) in ${session.durationSeconds}s`);

        // Reset
        this.currentSession = null;
        this.startTime = null;

        return sessionId;
    }

    /**
     * Calculate score as percentage.
     */
    _calculateScore(correct, total) {
        if (!total || total === 0) return 0;
        return Math.round((correct / total) * 100);
    }

    /**
     * Save session to Firebase.
     */
    async _saveSession(session) {
        if (!await this._init()) {
            console.warn('Statistics: Cannot save - Firebase not initialized');
            return null;
        }

        try {
            const sessionsRef = ref(this.db, DB_PATHS.SESSIONS);
            const newSessionRef = push(sessionsRef);
            await set(newSessionRef, session);
            console.log('📊 Session saved:', newSessionRef.key);
            return newSessionRef.key;
        } catch (error) {
            console.warn('Statistics: Failed to save session:', error.message);
            return null;
        }
    }

    /**
     * Update player aggregate stats.
     */
    async _updatePlayerStats(session) {
        if (!await this._init()) return;

        try {
            const playerRef = ref(this.db, `${DB_PATHS.PLAYERS}/${session.playerId}`);
            const snapshot = await get(playerRef);
            const existing = snapshot.val() || {};

            const gamesPlayed = existing.gamesPlayed || [];
            if (!gamesPlayed.includes(session.gameId)) {
                gamesPlayed.push(session.gameId);
            }

            const updated = {
                createdAt: existing.createdAt || session.timestamp,
                lastSeen: session.timestamp,
                totalSessions: (existing.totalSessions || 0) + 1,
                totalPlayTime: (existing.totalPlayTime || 0) + session.durationSeconds,
                gamesPlayed: gamesPlayed
            };

            await set(playerRef, updated);
        } catch (error) {
            console.warn('Statistics: Failed to update player stats:', error.message);
        }
    }

    // ============================================
    // QUERY METHODS (for dashboard)
    // ============================================

    /**
     * Get all sessions for current player.
     * @param {number} limit - Maximum sessions to return
     * @returns {Promise<Array>} Array of sessions
     */
    async getPlayerSessions(limit = 50) {
        const playerId = playerService.getPlayerIdSilent();
        if (!playerId) return [];

        if (!await this._init()) return [];

        try {
            const sessionsRef = ref(this.db, DB_PATHS.SESSIONS);
            const q = query(
                sessionsRef,
                orderByChild('playerId'),
                equalTo(playerId),
                limitToLast(limit)
            );
            const snapshot = await get(q);

            if (!snapshot.exists()) return [];

            const sessions = [];
            snapshot.forEach(child => {
                sessions.push({ id: child.key, ...child.val() });
            });

            // Sort by timestamp descending
            return sessions.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.warn('Statistics: Failed to get sessions:', error.message);
            return [];
        }
    }

    /**
     * Get aggregated stats for current player.
     * @returns {Promise<object|null>} Player stats
     */
    async getPlayerStats() {
        const playerId = playerService.getPlayerIdSilent();
        if (!playerId) return null;

        if (!await this._init()) return null;

        try {
            const playerRef = ref(this.db, `${DB_PATHS.PLAYERS}/${playerId}`);
            const snapshot = await get(playerRef);

            if (!snapshot.exists()) return null;

            return { playerId, ...snapshot.val() };
        } catch (error) {
            console.warn('Statistics: Failed to get player stats:', error.message);
            return null;
        }
    }

    /**
     * Get sessions for a specific game.
     * @param {string} gameId - Game identifier
     * @param {number} limit - Maximum sessions to return
     * @returns {Promise<Array>} Array of sessions
     */
    async getGameSessions(gameId, limit = 50) {
        if (!await this._init()) return [];

        try {
            const sessionsRef = ref(this.db, DB_PATHS.SESSIONS);
            const q = query(
                sessionsRef,
                orderByChild('gameId'),
                equalTo(gameId),
                limitToLast(limit)
            );
            const snapshot = await get(q);

            if (!snapshot.exists()) return [];

            const sessions = [];
            snapshot.forEach(child => {
                sessions.push({ id: child.key, ...child.val() });
            });

            return sessions.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.warn('Statistics: Failed to get game sessions:', error.message);
            return [];
        }
    }

    /**
     * Get best scores for current player by game.
     * @returns {Promise<object>} Map of gameId to best score
     */
    async getBestScores() {
        const sessions = await this.getPlayerSessions(200);
        const bestScores = {};

        for (const session of sessions) {
            if (!bestScores[session.gameId] || session.score > bestScores[session.gameId].score) {
                bestScores[session.gameId] = {
                    score: session.score,
                    date: session.date,
                    correctCount: session.correctCount,
                    totalWords: session.wordsCompleted
                };
            }
        }

        return bestScores;
    }

    /**
     * Check if there's an active session.
     * @returns {boolean}
     */
    hasActiveSession() {
        return this.currentSession !== null;
    }

    /**
     * Cancel current session without saving.
     */
    cancelSession() {
        if (this.currentSession) {
            console.log('📊 Session cancelled');
            this.currentSession = null;
            this.startTime = null;
        }
    }

    // ============================================
    // ADMIN QUERY METHODS
    // ============================================

    /**
     * Get all players (admin).
     * @returns {Promise<Array>} Array of player objects
     */
    async getAllPlayers() {
        if (!await this._init()) return [];

        try {
            const playersRef = ref(this.db, DB_PATHS.PLAYERS);
            const snapshot = await get(playersRef);

            if (!snapshot.exists()) return [];

            const players = [];
            snapshot.forEach(child => {
                players.push({ playerId: child.key, ...child.val() });
            });

            // Sort by last seen descending
            return players.sort((a, b) =>
                new Date(b.lastSeen) - new Date(a.lastSeen)
            );
        } catch (error) {
            console.warn('Statistics: Failed to get all players:', error.message);
            return [];
        }
    }

    /**
     * Get all sessions (admin).
     * @param {number} limit - Maximum sessions to return
     * @returns {Promise<Array>} Array of sessions
     */
    async getAllSessions(limit = 100) {
        if (!await this._init()) return [];

        try {
            const sessionsRef = ref(this.db, DB_PATHS.SESSIONS);
            const q = query(sessionsRef, limitToLast(limit));
            const snapshot = await get(q);

            if (!snapshot.exists()) return [];

            const sessions = [];
            snapshot.forEach(child => {
                sessions.push({ id: child.key, ...child.val() });
            });

            // Sort by timestamp descending
            return sessions.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.warn('Statistics: Failed to get all sessions:', error.message);
            return [];
        }
    }

    /**
     * Get leaderboard for a specific game (admin).
     * @param {string} gameId - Game identifier
     * @param {number} limit - Maximum players to return
     * @returns {Promise<Array>} Array of {playerId, bestScore, date}
     */
    async getLeaderboard(gameId, limit = 10) {
        if (!await this._init()) return [];

        try {
            const sessionsRef = ref(this.db, DB_PATHS.SESSIONS);
            const q = query(
                sessionsRef,
                orderByChild('gameId'),
                equalTo(gameId)
            );
            const snapshot = await get(q);

            if (!snapshot.exists()) return [];

            // Group by player and find best score
            const playerBests = {};
            snapshot.forEach(child => {
                const session = child.val();
                if (!playerBests[session.playerId] ||
                    session.score > playerBests[session.playerId].score) {
                    playerBests[session.playerId] = {
                        playerId: session.playerId,
                        score: session.score,
                        date: session.date,
                        correctCount: session.correctCount,
                        totalWords: session.wordsCompleted
                    };
                }
            });

            // Convert to array and sort by score descending
            return Object.values(playerBests)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        } catch (error) {
            console.warn('Statistics: Failed to get leaderboard:', error.message);
            return [];
        }
    }

    /**
     * Get overview statistics (admin).
     * @returns {Promise<object>} Overview stats
     */
    async getOverviewStats() {
        if (!await this._init()) return null;

        try {
            const [players, sessions] = await Promise.all([
                this.getAllPlayers(),
                this.getAllSessions(500)
            ]);

            // Calculate game stats
            const gameStats = {};
            let totalPlayTime = 0;

            for (const session of sessions) {
                totalPlayTime += session.durationSeconds || 0;

                if (!gameStats[session.gameId]) {
                    gameStats[session.gameId] = {
                        sessions: 0,
                        totalScore: 0,
                        players: new Set()
                    };
                }
                gameStats[session.gameId].sessions++;
                gameStats[session.gameId].totalScore += session.score || 0;
                gameStats[session.gameId].players.add(session.playerId);
            }

            // Convert to final format
            const gameStatsArray = Object.entries(gameStats).map(([gameId, stats]) => ({
                gameId,
                sessions: stats.sessions,
                avgScore: Math.round(stats.totalScore / stats.sessions),
                uniquePlayers: stats.players.size
            })).sort((a, b) => b.sessions - a.sessions);

            // Find most active player
            const playerSessions = {};
            for (const session of sessions) {
                playerSessions[session.playerId] = (playerSessions[session.playerId] || 0) + 1;
            }
            const mostActivePlayer = Object.entries(playerSessions)
                .sort((a, b) => b[1] - a[1])[0];

            return {
                totalPlayers: players.length,
                totalSessions: sessions.length,
                totalPlayTimeSeconds: totalPlayTime,
                gameStats: gameStatsArray,
                mostActivePlayer: mostActivePlayer ? {
                    playerId: mostActivePlayer[0],
                    sessions: mostActivePlayer[1]
                } : null,
                recentActivity: sessions.slice(0, 10)
            };
        } catch (error) {
            console.warn('Statistics: Failed to get overview stats:', error.message);
            return null;
        }
    }
}

// Singleton instance
export const statisticsService = new StatisticsService();

// Also export the class for testing
export { StatisticsService };
