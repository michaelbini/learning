/**
 * GameEngine - Shared game logic for Learning Games
 *
 * Provides common functionality for all games:
 * - Vocabulary loading (English/Hebrew)
 * - Score tracking
 * - Statistics integration
 * - Shuffle/retry functionality
 *
 * Usage:
 *   const game = new GameEngine({
 *       gameId: 'english-flashcards',
 *       vocabularyType: 'english', // or 'hebrew'
 *       elements: { ... },
 *       callbacks: { ... }
 *   });
 *   await game.init();
 */

import { vocabularyService } from './vocabulary-service.js';
import { createOfflineIndicator, showOfflineIndicator } from './offline-indicator.js';
import { statisticsService } from './statistics-service.js?v=5';

const ENCOURAGING_MESSAGES = [
    "🎉 מצוין!",
    "💪 כל הכבוד!",
    "⭐ נהדר!",
    "🌟 מעולה!",
    "👏 יפה מאוד!",
    "🔥 אש!",
    "🚀 פצצה!",
    "💎 מושלם!",
    "🏆 אלוף!",
    "✨ יפה!"
];

export class GameEngine {
    constructor(config) {
        this.gameId = config.gameId;
        this.vocabularyType = config.vocabularyType || 'english';
        this.elements = config.elements || {};
        this.callbacks = config.callbacks || {};

        // Game state
        this.vocabulary = [];
        this.items = []; // Current items (shuffled)
        this.currentIndex = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.skippedCount = 0;
        this.wrongItems = [];
        this.isRetryMode = false;
        this.hasAnswered = false;
        this.currentLesson = null;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async init() {
        createOfflineIndicator();

        vocabularyService.setStatusCallback(({ isOnline }) => {
            showOfflineIndicator(!isOnline);
        });

        await this.loadVocabulary();
    }

    async loadVocabulary() {
        let data = null;

        if (this.vocabularyType === 'english') {
            data = await vocabularyService.getEnglishVocabulary();
        } else if (this.vocabularyType === 'hebrew') {
            data = await vocabularyService.getHebrewSpelling();
        }

        if (data && data.vocabulary && data.vocabulary.length > 0) {
            this.vocabulary = data.vocabulary;

            // Check if LessonManager exists (for English games)
            if (typeof LessonManager !== 'undefined' && this.vocabularyType === 'english') {
                await LessonManager.init(data.vocabulary);
                if (this.elements.lessonSelector) {
                    LessonManager.createLessonSelector(
                        this.elements.lessonSelector,
                        (lesson) => this.onLessonChange(lesson),
                        this.callbacks.lessonSelectorOptions || {}
                    );
                }
                this.vocabulary = LessonManager.getCurrentVocabulary();
                this.currentLesson = LessonManager.getCurrentLesson();
            }

            console.log(`✅ Vocabulary loaded from ${vocabularyService.getLastSource()}`);
        } else {
            showOfflineIndicator(true);
            this.vocabulary = [];
            console.log('⚠️ Failed to load vocabulary');
        }

        this.startGame();
    }

    onLessonChange(lesson) {
        this.currentLesson = lesson;
        if (typeof LessonManager !== 'undefined') {
            this.vocabulary = LessonManager.getCurrentVocabulary();
        }
        this.resetScores();
        this.startGame();

        if (this.callbacks.onLessonChange) {
            this.callbacks.onLessonChange(lesson);
        }
    }

    // ============================================
    // GAME FLOW
    // ============================================

    startGame() {
        this.items = this.shuffleArray([...this.vocabulary]);
        this.currentIndex = 0;
        this.hasAnswered = false;

        // Start statistics session
        statisticsService.startSession(this.gameId, {
            totalWords: this.items.length,
            lesson: this.currentLesson,
            isRetryMode: this.isRetryMode,
            source: vocabularyService.getLastSource()
        });

        this.updateProgress();

        if (this.callbacks.onGameStart) {
            this.callbacks.onGameStart(this.items);
        }

        this.displayCurrentItem();
    }

    displayCurrentItem() {
        if (this.currentIndex >= this.items.length) {
            this.showFinalScreen();
            return;
        }

        this.hasAnswered = false;
        const item = this.items[this.currentIndex];

        if (this.callbacks.onDisplayItem) {
            this.callbacks.onDisplayItem(item, this.currentIndex, this.items.length);
        }

        this.updateProgress();
    }

    nextItem() {
        this.currentIndex++;
        this.displayCurrentItem();
    }

    // ============================================
    // ANSWER HANDLING
    // ============================================

    recordCorrect() {
        if (this.hasAnswered) return false;
        this.hasAnswered = true;

        this.correctCount++;
        statisticsService.recordAnswer('correct');
        this.updateScoreDisplay();

        if (this.callbacks.onCorrect) {
            this.callbacks.onCorrect(this.items[this.currentIndex]);
        }

        return true;
    }

    recordWrong() {
        if (this.hasAnswered) return false;
        this.hasAnswered = true;

        this.wrongCount++;
        statisticsService.recordAnswer('wrong');

        // Track wrong item for retry
        const item = this.items[this.currentIndex];
        if (!this.wrongItems.find(w => this.isSameItem(w, item))) {
            this.wrongItems.push(item);
        }

        this.updateScoreDisplay();

        if (this.callbacks.onWrong) {
            this.callbacks.onWrong(item);
        }

        return true;
    }

    recordSkipped() {
        if (this.hasAnswered) return false;
        this.hasAnswered = true;

        this.skippedCount++;
        statisticsService.recordAnswer('skipped');

        // Track skipped as wrong for retry
        const item = this.items[this.currentIndex];
        if (!this.wrongItems.find(w => this.isSameItem(w, item))) {
            this.wrongItems.push(item);
        }

        this.updateScoreDisplay();

        if (this.callbacks.onSkipped) {
            this.callbacks.onSkipped(item);
        }

        return true;
    }

    isSameItem(a, b) {
        // For English vocabulary
        if (a.english && b.english) {
            return a.english === b.english;
        }
        // For Hebrew spelling
        if (a.word && b.word) {
            return a.word === b.word;
        }
        return a === b;
    }

    // ============================================
    // GAME END
    // ============================================

    async showFinalScreen() {
        await statisticsService.endSession({
            correctCount: this.correctCount,
            wrongCount: this.wrongCount,
            skippedCount: this.skippedCount
        });

        const total = this.items.length;
        const percentage = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

        if (this.callbacks.onGameEnd) {
            this.callbacks.onGameEnd({
                correctCount: this.correctCount,
                wrongCount: this.wrongCount,
                skippedCount: this.skippedCount,
                total: total,
                percentage: percentage,
                wrongItems: this.wrongItems,
                isRetryMode: this.isRetryMode
            });
        }
    }

    restartGame() {
        this.resetScores();
        this.wrongItems = [];
        this.isRetryMode = false;
        this.startGame();
    }

    retryWrongItems() {
        if (this.wrongItems.length === 0) return;

        this.items = this.shuffleArray([...this.wrongItems]);
        this.wrongItems = [];
        this.resetScores();
        this.isRetryMode = true;
        this.currentIndex = 0;

        // Start new statistics session for retry
        statisticsService.startSession(this.gameId, {
            totalWords: this.items.length,
            lesson: this.currentLesson,
            isRetryMode: true,
            source: vocabularyService.getLastSource()
        });

        this.updateProgress();

        if (this.callbacks.onRetryStart) {
            this.callbacks.onRetryStart(this.items);
        }

        this.displayCurrentItem();
    }

    // ============================================
    // UI UPDATES
    // ============================================

    updateScoreDisplay() {
        if (this.elements.correctScore) {
            document.getElementById(this.elements.correctScore).textContent = this.correctCount;
        }
        if (this.elements.wrongScore) {
            document.getElementById(this.elements.wrongScore).textContent = this.wrongCount;
        }
        if (this.elements.skippedScore) {
            document.getElementById(this.elements.skippedScore).textContent = this.skippedCount;
        }
    }

    updateProgress() {
        if (this.elements.progress) {
            const el = document.getElementById(this.elements.progress);
            if (el) {
                el.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
            }
        }
    }

    resetScores() {
        this.correctCount = 0;
        this.wrongCount = 0;
        this.skippedCount = 0;
        this.updateScoreDisplay();
    }

    // ============================================
    // UTILITIES
    // ============================================

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    shuffleCurrentItems() {
        this.items = this.shuffleArray(this.items);
        this.currentIndex = 0;
        this.displayCurrentItem();
    }

    getRandomEncouragingMessage() {
        return ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
    }

    getCurrentItem() {
        return this.items[this.currentIndex];
    }

    getVocabulary() {
        return this.vocabulary;
    }

    getItems() {
        return this.items;
    }

    getWrongItems() {
        return this.wrongItems;
    }

    getStats() {
        return {
            correctCount: this.correctCount,
            wrongCount: this.wrongCount,
            skippedCount: this.skippedCount,
            total: this.items.length,
            currentIndex: this.currentIndex,
            isRetryMode: this.isRetryMode
        };
    }
}

// Export encouraging messages for direct use
export { ENCOURAGING_MESSAGES };
