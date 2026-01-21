/**
 * Flashcards Game - English Vocabulary
 */
import { GameEngine } from '../shared/game-engine.js';

let game;

function initGame() {
    game = new GameEngine({
        gameId: 'english-flashcards',
        vocabularyType: 'english',
        elements: {
            lessonSelector: 'lessonSelector',
            correctScore: 'correctScore',
            wrongScore: 'wrongScore',
            progress: 'progress'
        },
        callbacks: {
            lessonSelectorOptions: {
                includeShuffleButton: true,
                onShuffle: () => game.shuffleCurrentItems()
            },
            onDisplayItem: (item, index, total) => {
                const cardElement = document.getElementById('card');
                cardElement.classList.remove('flipped');

                setTimeout(() => {
                    document.getElementById('question').textContent = item.english;
                    document.getElementById('answer').textContent = item.hebrew;
                    document.getElementById('progress').textContent = `קלף ${index + 1} מתוך ${total}`;
                }, 0);
            },
            onGameEnd: (results) => {
                // Hide game area
                document.querySelector('.card-container').style.display = 'none';
                document.querySelector('.progress').style.display = 'none';
                document.getElementById('answerButtons').style.display = 'none';
                const hint = document.querySelector('.hint');
                if (hint) hint.style.display = 'none';

                // Show final screen
                document.getElementById('finalScreen').style.display = 'block';
                document.getElementById('finalCorrect').textContent = results.correctCount;
                document.getElementById('finalWrong').textContent = results.wrongCount;

                // Show retry button if there are wrong cards
                const retryBtn = document.getElementById('retryWrongBtn');
                if (results.wrongItems.length > 0) {
                    retryBtn.style.display = 'inline-block';
                    retryBtn.textContent = `💪 תרגל רק מילים שטעיתי (${results.wrongItems.length} מילים)`;
                } else {
                    retryBtn.style.display = 'none';
                }
            },
            onRetryStart: () => {
                showGameArea();
            }
        }
    });

    game.init();
}

function showGameArea() {
    document.querySelector('.card-container').style.display = 'block';
    document.querySelector('.progress').style.display = 'block';
    document.getElementById('answerButtons').style.display = 'flex';
    const hint = document.querySelector('.hint');
    if (hint) hint.style.display = 'block';
    document.getElementById('finalScreen').style.display = 'none';
}

function speakWord() {
    const item = game.getCurrentItem();
    if (!item) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(item.english);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;

        const btn = document.querySelector('.speaker-btn');
        if (btn) {
            btn.classList.add('playing');
            utterance.onend = () => btn.classList.remove('playing');
        }

        window.speechSynthesis.speak(utterance);
    }
}

function flipCard() {
    document.getElementById('card').classList.toggle('flipped');
}

function markAnswer(isCorrect) {
    if (isCorrect) {
        game.recordCorrect();
    } else {
        game.recordWrong();
    }

    // Flip back to English if card is flipped
    const cardElement = document.getElementById('card');
    if (cardElement.classList.contains('flipped')) {
        cardElement.classList.remove('flipped');
        setTimeout(() => game.nextItem(), 300);
    } else {
        game.nextItem();
    }
}

function restartGame() {
    showGameArea();
    game.restartGame();
}

function retryWrongCards() {
    showGameArea();
    game.retryWrongItems();
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flipCard();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        game.nextItem();
    }
});

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Expose functions for onclick handlers
window.speakWord = speakWord;
window.flipCard = flipCard;
window.markAnswer = markAnswer;
window.restartGame = restartGame;
window.retryWrongCards = retryWrongCards;
