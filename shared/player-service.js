/**
 * PlayerService - Player identification for Learning Games
 *
 * Handles player name prompt and localStorage persistence.
 * - First visit: prompts for name
 * - Saves to localStorage forever
 * - Same name on different devices = aggregated stats
 */

const STORAGE_KEY = 'player_name';

class PlayerService {
    constructor() {
        this.playerId = null;
        this._checkResetParam();
    }

    /**
     * Check for ?reset-player URL parameter and clear name if present.
     */
    _checkResetParam() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('reset-player')) {
            this.clearPlayerId();
            // Remove the parameter from URL without reload
            params.delete('reset-player');
            const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.replaceState({}, '', newUrl);
        }
    }

    /**
     * Get the current player ID (name).
     * On first visit, prompts for name and saves to localStorage.
     * On subsequent visits, returns saved name without prompting.
     * Keeps prompting until a valid name is entered.
     *
     * @returns {string} Player name (lowercase, trimmed)
     */
    getPlayerId() {
        if (this.playerId) {
            return this.playerId;
        }

        let name = localStorage.getItem(STORAGE_KEY);

        if (!name) {
            // Keep prompting until valid name is entered
            while (!name || name.trim().length === 0) {
                name = prompt('🎮 Enter your name to track progress:');
                if (name) {
                    name = name.toLowerCase().trim();
                }
            }
            localStorage.setItem(STORAGE_KEY, name);
        }

        this.playerId = name;
        return name;
    }

    /**
     * Check if player has already registered a name.
     * Does NOT prompt - just checks localStorage.
     *
     * @returns {boolean} True if player name exists in localStorage
     */
    hasPlayerId() {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    /**
     * Get the player ID without prompting.
     * Returns null if no name is saved.
     *
     * @returns {string|null} Player name or null
     */
    getPlayerIdSilent() {
        if (this.playerId) {
            return this.playerId;
        }

        const name = localStorage.getItem(STORAGE_KEY);
        if (name) {
            this.playerId = name;
        }
        return name;
    }

    /**
     * Clear the stored player name.
     * Next call to getPlayerId() will prompt again.
     */
    clearPlayerId() {
        localStorage.removeItem(STORAGE_KEY);
        this.playerId = null;
    }

    /**
     * Manually set the player ID (useful for testing or admin).
     *
     * @param {string} name - The player name to set
     */
    setPlayerId(name) {
        if (name) {
            name = name.toLowerCase().trim();
            if (name.length > 0) {
                localStorage.setItem(STORAGE_KEY, name);
                this.playerId = name;
            }
        }
    }
}

// Singleton instance
export const playerService = new PlayerService();

// Also export the class for testing
export { PlayerService };
