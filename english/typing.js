/**
 * Typing Game - English Vocabulary
 */
import { GameEngine, ENCOURAGING_MESSAGES } from '../shared/game-engine.js';

let game;
let hasAnswered = false;

function initGame() {
    game = new GameEngine({
        gameId: 'english-typing',
        vocabularyType: 'english',
        elements: {
            lessonSelector: 'lessonSelector',
            correctScore: 'correctScore',
            wrongScore: 'wrongScore'
        },
        callbacks: {
            onDisplayItem: (item, index, total) => {
                hasAnswered = false;

                document.getElementById('englishWord').textContent = item.english;
                document.getElementById('progressText').textContent = `מילה ${index + 1} מתוך ${total}`;
                document.getElementById('answerInput').value = '';
                document.getElementById('answerInput').className = 'answer-input';
                document.getElementById('answerInput').disabled = false;
                document.getElementById('feedback').innerHTML = '';
                document.getElementById('feedback').className = 'feedback';

                document.getElementById('submitBtn').style.display = 'inline-block';
                document.getElementById('skipBtn').style.display = 'inline-block';
                document.getElementById('nextBtn').style.display = 'none';

                document.getElementById('answerInput').focus();
            },
            onGameEnd: (results) => {
                document.getElementById('gameArea').style.display = 'none';
                document.getElementById('completeScreen').style.display = 'block';

                document.getElementById('finalCorrect').textContent = results.correctCount;
                document.getElementById('finalWrong').textContent = results.wrongCount;
                document.getElementById('finalSkipped').textContent = results.skippedCount;
                document.getElementById('finalPercentage').textContent = `${results.percentage}%`;

                // Show retry button if there are wrong words
                const retryBtn = document.getElementById('retryWrongBtn');
                if (results.wrongItems.length > 0) {
                    retryBtn.style.display = 'inline-block';
                    retryBtn.textContent = `💪 תרגל מילים שטעית (${results.wrongItems.length} מילים)`;
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

    // Enter key support
    document.getElementById('answerInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (!hasAnswered) {
                checkAnswer();
            } else {
                nextWord();
            }
        }
    });
}

function normalizeHebrew(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isAnswerCorrect(userAnswer, correctAnswer) {
    const normalized1 = normalizeHebrew(userAnswer);
    const normalized2 = normalizeHebrew(correctAnswer);

    if (normalized1 === normalized2) return true;

    // Check if correctAnswer has multiple options (separated by comma)
    const options = correctAnswer.split(',').map(opt => normalizeHebrew(opt));
    return options.some(opt => opt === normalized1);
}

function speakWord() {
    const item = game.getCurrentItem();
    if (!item) return;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(item.english);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;

        const btn = document.getElementById('speakerBtn');
        btn.classList.add('playing');
        utterance.onend = () => btn.classList.remove('playing');

        window.speechSynthesis.speak(utterance);
    }
}

function checkAnswer() {
    if (hasAnswered) return;

    const userAnswer = document.getElementById('answerInput').value.trim();
    if (!userAnswer) {
        alert('אנא הקלד תשובה');
        return;
    }

    hasAnswered = true;
    const item = game.getCurrentItem();
    const input = document.getElementById('answerInput');
    const feedback = document.getElementById('feedback');

    input.disabled = true;
    document.getElementById('submitBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'inline-block';

    if (isAnswerCorrect(userAnswer, item.hebrew)) {
        input.classList.add('correct');
        game.recordCorrect();

        const randomMessage = ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
        feedback.innerHTML = `<div class="feedback-icon">✅</div><div>${randomMessage}</div>`;
        feedback.className = 'feedback correct';
    } else {
        input.classList.add('wrong');
        game.recordWrong();

        feedback.innerHTML = `
            <div class="feedback-icon">❌</div>
            <div>לא נכון</div>
            <div class="correct-answer">התשובה הנכונה: ${item.hebrew}</div>
        `;
        feedback.className = 'feedback wrong';
    }
}

function skipWord() {
    if (hasAnswered) return;

    hasAnswered = true;
    const item = game.getCurrentItem();
    const feedback = document.getElementById('feedback');

    game.recordSkipped();

    feedback.innerHTML = `
        <div class="feedback-icon">⏭️</div>
        <div>דילגת</div>
        <div class="correct-answer">התשובה: ${item.hebrew}</div>
    `;
    feedback.className = 'feedback';

    document.getElementById('answerInput').disabled = true;
    document.getElementById('submitBtn').style.display = 'none';
    document.getElementById('skipBtn').style.display = 'none';
    document.getElementById('nextBtn').style.display = 'inline-block';
}

function nextWord() {
    game.nextItem();
}

function showGameArea() {
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('completeScreen').style.display = 'none';
}

function restartGame() {
    showGameArea();
    game.restartGame();
}

function retryWrong() {
    showGameArea();
    game.retryWrongItems();
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Expose functions for onclick handlers
window.speakWord = speakWord;
window.checkAnswer = checkAnswer;
window.skipWord = skipWord;
window.nextWord = nextWord;
window.restartGame = restartGame;
window.retryWrong = retryWrong;
