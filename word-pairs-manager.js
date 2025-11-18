// word-pairs-manager.js - Shared word pairs management functionality
// כלול קובץ זה בכל משחק כדי לתמוך בזוגות מילים

const WordPairsManager = {
    wordPairs: {},

    // Initialize and load word pairs
    async init(embeddedWordPairs) {
        try {
            const response = await fetch('vocabulary.json');
            if (response.ok) {
                const data = await response.json();

                // Check if new structure (with wordPairs object)
                if (data.wordPairs) {
                    this.wordPairs = data.wordPairs;
                    console.log('✅ Word pairs loaded from external JSON file');
                } else {
                    // Old structure - direct object
                    this.wordPairs = data;
                    console.log('✅ Word pairs loaded from external JSON file (legacy structure)');
                }
            } else {
                console.log('ℹ️ No external JSON found, using embedded word pairs');
                this.wordPairs = embeddedWordPairs;
            }
        } catch (error) {
            console.log('ℹ️ Using embedded word pairs');
            this.wordPairs = embeddedWordPairs;
        }
    },

    // Get word pairs for specific difficulty
    getWordPairs(difficulty) {
        // New structure: array with difficulty property
        if (Array.isArray(this.wordPairs)) {
            return this.wordPairs.filter(pair => pair.difficulty === difficulty);
        }
        // Legacy structure: nested object
        return this.wordPairs[difficulty] || [];
    },

    // Get all difficulties
    getDifficulties() {
        // New structure: extract unique difficulties from array
        if (Array.isArray(this.wordPairs)) {
            const difficulties = [...new Set(this.wordPairs.map(pair => pair.difficulty))];
            return difficulties.sort(); // Sort for consistency
        }
        // Legacy structure: object keys
        return Object.keys(this.wordPairs);
    },

    // Get word pairs count for a difficulty
    getCount(difficulty) {
        const pairs = this.getWordPairs(difficulty);
        return pairs.length;
    },

    // Get all word pairs (useful for random selection across all difficulties)
    getAllWordPairs() {
        if (Array.isArray(this.wordPairs)) {
            return this.wordPairs;
        }
        // Legacy: flatten object
        return Object.values(this.wordPairs).flat();
    }
};
