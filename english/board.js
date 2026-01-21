/**
 * Board Game - English Vocabulary
 */
import { GameEngine, ENCOURAGING_MESSAGES } from '../shared/game-engine.js';

let game;
let tiles = [];
let currentTileIndex = null;

function initGame() {
    game = new GameEngine({
        gameId: 'english-board',
        vocabularyType: 'english',
        elements: {
            lessonSelector: 'lessonSelector',
            correctScore: 'correctCount',
            wrongScore: 'wrongCount'
        },
        callbacks: {
            onGameStart: (items) => {
                initBoard(items);
            },
            onGameEnd: (results) => {
                document.getElementById('finalCorrect').textContent = results.correctCount;
                document.getElementById('finalWrong').textContent = results.wrongCount;
                document.getElementById('finalScore').textContent = `${results.percentage}%`;
                document.getElementById('completeScreen').classList.add('active');
            }
        }
    });

    game.init();
}

function initBoard(items) {
    const board = document.getElementById('board');
    board.innerHTML = '';

    // Create tiles with questions
    tiles = items.map((word, index) => ({
        id: index,
        word: word,
        status: 'unanswered',
        question: generateQuestion(word, game.getVocabulary())
    }));

    // Create tile elements
    tiles.forEach((tile, index) => {
        const tileElement = document.createElement('div');
        tileElement.className = 'tile';
        tileElement.innerHTML = `
            <span class="tile-number">#${index + 1}</span>
            <span>${index + 1}</span>
        `;
        tileElement.onclick = () => openQuiz(index);
        board.appendChild(tileElement);
    });

    updateScoreboard();
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

function openQuiz(tileIndex) {
    const tile = tiles[tileIndex];

    // Don't open if already answered
    if (tile.status !== 'unanswered') return;

    currentTileIndex = tileIndex;
    const modal = document.getElementById('quizModal');
    const question = tile.question;

    // Set question
    document.getElementById('modalQuestion').textContent = question.question;
    document.getElementById('modalFeedback').textContent = '';
    document.getElementById('modalFeedback').className = 'feedback';

    // Create options
    const optionsContainer = document.getElementById('modalOptions');
    optionsContainer.innerHTML = '';

    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.onclick = () => checkAnswer(option, button);
        optionsContainer.appendChild(button);
    });

    modal.showModal();
}

function checkAnswer(selectedAnswer, button) {
    const tile = tiles[currentTileIndex];
    const question = tile.question;
    const feedback = document.getElementById('modalFeedback');
    const allButtons = document.querySelectorAll('.option-btn');

    allButtons.forEach(btn => btn.disabled = true);

    if (selectedAnswer === question.correctAnswer) {
        button.classList.add('correct');
        tile.status = 'correct';
        game.recordCorrect();

        const randomMessage = ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
        feedback.textContent = randomMessage;
        feedback.className = 'feedback correct';
    } else {
        button.classList.add('wrong');
        tile.status = 'wrong';
        game.recordWrong();

        feedback.innerHTML = `❌ לא נכון<br><small style="font-size: 0.7em;">התשובה הנכונה: ${question.correctAnswer}</small>`;
        feedback.className = 'feedback wrong';

        // Highlight correct answer
        allButtons.forEach(btn => {
            if (btn.textContent === question.correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    // Close modal and update board after delay
    setTimeout(() => {
        closeQuiz();
        updateBoard();
        updateScoreboard();

        // Check if all tiles answered
        if (tiles.every(t => t.status !== 'unanswered')) {
            setTimeout(() => game.showFinalScreen(), 500);
        }
    }, 1500);
}

function closeQuiz() {
    document.getElementById('quizModal').close();
}

function updateBoard() {
    const boardTiles = document.querySelectorAll('.tile');
    tiles.forEach((tile, index) => {
        const tileElement = boardTiles[index];

        if (tile.status === 'correct') {
            tileElement.classList.add('correct', 'answered');
            tileElement.innerHTML = `
                <span class="tile-number">#${index + 1}</span>
                <span class="tile-icon">✅</span>
            `;
        } else if (tile.status === 'wrong') {
            tileElement.classList.add('wrong', 'answered');
            tileElement.innerHTML = `
                <span class="tile-number">#${index + 1}</span>
                <span class="tile-icon">❌</span>
            `;
        }
    });
}

function updateScoreboard() {
    const stats = game.getStats();
    document.getElementById('correctCount').textContent = stats.correctCount;
    document.getElementById('wrongCount').textContent = stats.wrongCount;
    document.getElementById('totalAnswered').textContent = `${stats.correctCount + stats.wrongCount}/${tiles.length}`;
}

function restartGame() {
    document.getElementById('completeScreen').classList.remove('active');
    game.restartGame();
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Expose functions for onclick handlers
window.restartGame = restartGame;
