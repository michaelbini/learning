/**
 * Quiz Game - English Vocabulary
 */
import { GameEngine, ENCOURAGING_MESSAGES } from '../shared/game-engine.js';

let game;
let questions = [];
let hasAnswered = false;

function initGame() {
    game = new GameEngine({
        gameId: 'english-quiz',
        vocabularyType: 'english',
        elements: {
            lessonSelector: 'lessonSelector',
            correctScore: 'correctScore',
            wrongScore: 'wrongScore'
        },
        callbacks: {
            onGameStart: (items) => {
                // Generate questions with multiple choice options
                questions = items.map(word => generateQuestion(word, game.getVocabulary()));
            },
            onDisplayItem: (item, index, total) => {
                hasAnswered = false;
                const question = questions[index];

                document.getElementById('question').textContent = question.question;
                document.getElementById('questionNumber').textContent = `${index + 1}/${total}`;
                document.getElementById('feedback').textContent = '';
                document.getElementById('feedback').className = 'feedback';
                document.getElementById('nextBtn').disabled = true;

                const optionsContainer = document.getElementById('options');
                optionsContainer.innerHTML = '';

                question.options.forEach(option => {
                    const button = document.createElement('button');
                    button.className = 'option-btn';
                    button.textContent = option;
                    button.onclick = () => checkAnswer(option, button, question);
                    optionsContainer.appendChild(button);
                });
            },
            onGameEnd: (results) => {
                document.getElementById('gameArea').style.display = 'none';
                document.getElementById('finalScore').style.display = 'block';

                document.getElementById('finalScoreText').textContent = `${results.correctCount}`;

                if (results.isRetryMode) {
                    document.getElementById('finalScoreSubtext').textContent = `נכונות מתוך ${results.total} מילים שתרגלת`;
                } else {
                    document.getElementById('finalScoreSubtext').textContent = `נכונות מתוך ${results.total} שאלות`;
                }

                // Add performance message
                let message = '';
                if (results.percentage >= 90) message = '🏆 מדהים!';
                else if (results.percentage >= 70) message = '⭐ מצוין!';
                else if (results.percentage >= 50) message = '👍 יפה!';
                else message = '💪 כדאי לתרגל עוד';

                document.getElementById('finalScoreText').innerHTML += `<br>${message}`;

                // Show retry button if there are wrong answers
                const retryBtn = document.getElementById('retryBtn');
                if (results.wrongItems.length > 0 && !results.isRetryMode) {
                    retryBtn.style.display = 'block';
                    retryBtn.textContent = `💪 תרגל רק מילים שטעיתי בהן (${results.wrongItems.length} מילים)`;
                } else {
                    retryBtn.style.display = 'none';
                }
            },
            onRetryStart: (items) => {
                questions = items.map(word => generateQuestion(word, game.getVocabulary()));
                showGameArea();
            }
        }
    });

    game.init();
}

function generateQuestion(word, vocabulary) {
    const wrongAnswers = vocabulary
        .filter(w => w.hebrew !== word.hebrew)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.hebrew);

    const allOptions = shuffleArray([word.hebrew, ...wrongAnswers]);

    return {
        question: word.english,
        correctAnswer: word.hebrew,
        options: allOptions
    };
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function checkAnswer(selectedAnswer, button, question) {
    if (hasAnswered) return;
    hasAnswered = true;

    const feedback = document.getElementById('feedback');
    const allButtons = document.querySelectorAll('.option-btn');

    allButtons.forEach(btn => btn.disabled = true);

    if (selectedAnswer === question.correctAnswer) {
        button.classList.add('correct');
        game.recordCorrect();

        const randomMessage = ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
        feedback.innerHTML = `<span class="celebration">${randomMessage}</span>`;
        feedback.className = 'feedback correct';

        // Auto-advance after 1 second
        setTimeout(() => game.nextItem(), 1000);
    } else {
        button.classList.add('wrong');
        game.recordWrong();

        feedback.innerHTML = `❌ לא נכון<br><small style="font-size: 0.7em;">התשובה הנכונה: ${question.correctAnswer}</small>`;
        feedback.className = 'feedback wrong';

        // Highlight correct answer
        allButtons.forEach(btn => {
            if (btn.textContent === question.correctAnswer) {
                btn.classList.add('correct');
            }
        });

        document.getElementById('nextBtn').disabled = false;
    }
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
        if (btn) {
            btn.classList.add('playing');
            utterance.onend = () => btn.classList.remove('playing');
        }

        window.speechSynthesis.speak(utterance);
    }
}

function nextQuestion() {
    game.nextItem();
}

function showGameArea() {
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('finalScore').style.display = 'none';
}

function restartGame() {
    showGameArea();
    game.restartGame();
}

function retryWrongWords() {
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
window.nextQuestion = nextQuestion;
window.restartGame = restartGame;
window.retryWrongWords = retryWrongWords;
