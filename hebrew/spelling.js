/**
 * Hebrew Spelling Game
 */
import { vocabularyService } from '../shared/vocabulary-service.js';
import { createOfflineIndicator, showOfflineIndicator } from '../shared/offline-indicator.js';
import { statisticsService } from '../shared/statistics-service.js?v=5';

// Word Banks with Difficulty Levels
let wordsByDifficulty = {
    easy: [],
    medium: [],
    hard: [],
    expert: []
};

// Current words based on difficulty
let currentWords = [];
let currentDifficulty = 'medium';

// Game State
let gameWords = [];
let currentWord = '';
let correctCount = 0;
let wrongCount = 0;
let streakCount = 0;
let isPlaying = false;

// Load vocabulary from Firebase/JSON
async function loadVocabulary() {
    createOfflineIndicator();

    // Disable start button while loading
    const startBtn = document.querySelector('#setupArea .btn-primary');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = '⏳ טוען מילים...';
    }

    vocabularyService.setStatusCallback(({ isOnline }) => {
        showOfflineIndicator(!isOnline);
    });

    const data = await vocabularyService.getHebrewVocabulary('./vocabulary.json');

    if (data && data.wordPairs && data.wordPairs.length > 0) {
        wordsByDifficulty = {
            easy: [],
            medium: [],
            hard: [],
            expert: []
        };

        data.wordPairs.forEach(pair => {
            if (pair.word && pair.difficulty && pair.type === 'words') {
                if (wordsByDifficulty[pair.difficulty]) {
                    wordsByDifficulty[pair.difficulty].push(pair.word);
                }
            }
        });

        wordsByDifficulty.expert = [...wordsByDifficulty.hard];
        currentWords = wordsByDifficulty[currentDifficulty];
        console.log('✅ Vocabulary loaded from ' + vocabularyService.getLastSource());

        // Enable start button
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '▶️ התחל משחק';
        }
        return;
    }

    showOfflineIndicator(true);
    console.log('⚠️ Failed to load vocabulary');

    // Show error on button
    if (startBtn) {
        startBtn.textContent = '❌ שגיאה בטעינה';
    }
}

// Difficulty Selection
function setDifficulty(level) {
    currentDifficulty = level;
    currentWords = wordsByDifficulty[level];

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-level="${level}"]`).classList.add('active');
}

// Start Game
function startGame() {
    gameWords = [...currentWords];

    if (gameWords.length === 0) {
        alert('אין מילים במשחק');
        return;
    }

    correctCount = 0;
    wrongCount = 0;
    streakCount = 0;

    statisticsService.startSession('hebrew-spelling', {
        totalWords: gameWords.length,
        difficulty: currentDifficulty,
        source: vocabularyService.getLastSource()
    });

    document.getElementById('setupArea').style.display = 'none';
    document.getElementById('gameArea').classList.add('active');
    document.getElementById('totalWords').textContent = gameWords.length;
    document.getElementById('correctScore').textContent = '0';
    document.getElementById('wrongScore').textContent = '0';
    document.getElementById('streakScore').textContent = '0';

    const difficultyNames = {
        'easy': 'קל 😊',
        'medium': 'בינוני 🎯',
        'hard': 'קשה 💪',
        'expert': 'מומחה 🏆'
    };
    document.getElementById('difficultyDisplay').textContent = difficultyNames[currentDifficulty] || 'מותאם אישית';

    isPlaying = true;
    document.getElementById('checkBtn').style.display = 'inline-block';
    document.getElementById('wordInput').disabled = false;

    showNewWord();
}

function showNewWord() {
    currentWord = gameWords[Math.floor(Math.random() * gameWords.length)];
    const card = document.getElementById('card');
    const wordDisplay = document.getElementById('wordDisplay');
    const inputContainer = document.getElementById('inputContainer');
    const wordInput = document.getElementById('wordInput');

    card.classList.remove('flipped');
    wordDisplay.textContent = currentWord;
    wordInput.value = '';
    inputContainer.classList.remove('show');
    document.getElementById('checkBtn').disabled = true;
    wordInput.disabled = true;
}

function checkAnswer() {
    const userAnswer = document.getElementById('wordInput').value.trim();

    if (userAnswer === currentWord) {
        correctCount++;
        streakCount++;
        statisticsService.recordAnswer('correct');
        document.getElementById('correctScore').textContent = correctCount;
        document.getElementById('streakScore').textContent = streakCount;
        showFeedback(true);

        if (streakCount % 5 === 0) {
            showCelebration();
        }
    } else {
        wrongCount++;
        streakCount = 0;
        statisticsService.recordAnswer('wrong');
        document.getElementById('wrongScore').textContent = wrongCount;
        document.getElementById('streakScore').textContent = streakCount;
        document.getElementById('wordDisplay').textContent = `הנכונה: ${currentWord}`;
        document.getElementById('card').classList.remove('flipped');
        showFeedback(false);
    }

    setTimeout(() => showNewWord(), 2000);
}

function speakWord() {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(currentWord);
        utterance.lang = 'he-IL';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
    }
}

function showFeedback(isCorrect) {
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isCorrect ? 'success' : 'error'}`;
    feedback.textContent = isCorrect ? '✓' : '✗';
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 800);
}

function showCelebration() {
    const celebration = document.createElement('div');
    celebration.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 60px; color: #ffd700;
        animation: celebrate 1s ease; z-index: 2000;
    `;
    celebration.textContent = `🏆 רצף של ${streakCount}! 🏆`;
    document.body.appendChild(celebration);

    setTimeout(() => celebration.remove(), 2000);
}

async function newGame() {
    if (statisticsService.hasActiveSession()) {
        await statisticsService.endSession({
            correctCount: correctCount,
            wrongCount: wrongCount
        });
    }

    document.getElementById('setupArea').style.display = 'block';
    document.getElementById('gameArea').classList.remove('active');
    isPlaying = false;
}

// Card flip handler
document.getElementById('card').addEventListener('click', function() {
    if (isPlaying && !this.classList.contains('flipped')) {
        this.classList.add('flipped');
        document.getElementById('inputContainer').classList.add('show');
        document.getElementById('wordInput').disabled = false;
        document.getElementById('checkBtn').disabled = false;
        document.getElementById('wordInput').focus();
    }
});

// Enter key support
document.getElementById('wordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !document.getElementById('checkBtn').disabled) {
        checkAnswer();
    }
});

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes celebrate {
        0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); }
        50% { transform: translate(-50%, -50%) scale(1.2) rotate(180deg); }
        100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize on page load
window.addEventListener('load', loadVocabulary);

// Expose functions for onclick handlers
window.setDifficulty = setDifficulty;
window.startGame = startGame;
window.checkAnswer = checkAnswer;
window.speakWord = speakWord;
window.newGame = newGame;
