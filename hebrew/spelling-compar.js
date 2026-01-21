/**
 * Hebrew Spelling Comparison Game
 */
import { vocabularyService } from '../shared/vocabulary-service.js';
import { createOfflineIndicator, showOfflineIndicator } from '../shared/offline-indicator.js';
import { statisticsService } from '../shared/statistics-service.js';

// Word pairs database
let wordPairs = [];

// Load word pairs from vocabulary service
async function loadWordPairs() {
    createOfflineIndicator();

    // Disable start button while loading
    const startBtn = document.querySelector('#gameSetup .btn-primary');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = '⏳ טוען מילים...';
    }

    vocabularyService.setStatusCallback(({ isOnline }) => {
        showOfflineIndicator(!isOnline);
    });

    const data = await vocabularyService.getHebrewVocabulary('./vocabulary.json');

    if (data && data.wordPairs && data.wordPairs.length > 0) {
        wordPairs = data.wordPairs;
        console.log('✅ Word pairs loaded from ' + vocabularyService.getLastSource());
        console.log('📊 Total pairs loaded:', wordPairs.length);

        // Enable start button
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = 'התחל משחק';
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

// Update title based on game type
function updateTitle() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('type') || 'words';

    const titles = {
        'words': 'משחק זיהוי כתיב',
        'numbers': 'משחק כתיב מספרים'
    };

    const title = titles[gameType] || 'משחק זיהוי כתיב נכון';
    document.querySelector('h1').textContent = '🎯 ' + title + ' 🎯';
    document.title = title;
}

// Initialize on page load
window.addEventListener('load', function() {
    updateTitle();
    loadWordPairs();
});

// Game state
let gameMode = 'easy';
let currentPairIndex = 0;
let correctScore = 0;
let wrongScore = 0;
let totalScore = 0;
let streak = 0;
let maxStreak = 0;
let questionNumber = 1;
let totalQuestions = 10;
let gamePairs = [];
let correctPosition = 1;
let hasAnswered = false;
let timerInterval = null;
let timeLeft = 10;
let hintsUsed = 0;

// Select game mode
function selectMode(mode) {
    gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.mode-btn').classList.add('active');

    if (mode === 'timed') {
        totalQuestions = 20;
    } else {
        totalQuestions = 10;
    }
}

// Start game
function startGame() {
    if (!wordPairs || wordPairs.length === 0) {
        alert('אנא המתן, המילים עדיין נטענות...');
        console.error('❌ Cannot start game - wordPairs not loaded yet');
        return;
    }

    console.log('🎮 Starting game with', wordPairs.length, 'word pairs available');

    // Reset state
    correctScore = 0;
    wrongScore = 0;
    totalScore = 0;
    streak = 0;
    maxStreak = 0;
    questionNumber = 1;
    hintsUsed = 0;
    hasAnswered = false;

    // Update UI
    document.getElementById('gameSetup').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('correctScore').textContent = '0';
    document.getElementById('wrongScore').textContent = '0';
    document.getElementById('totalScore').textContent = '0';
    document.getElementById('accuracy').textContent = '100';
    document.getElementById('currentQuestion').textContent = '1';
    document.getElementById('totalQuestions').textContent = totalQuestions;

    // Prepare word pairs
    preparePairs();

    if (!gamePairs || gamePairs.length === 0) {
        alert('לא נמצאו מילים מתאימות לרמת הקושי שנבחרה. אנא נסה רמה אחרת.');
        document.getElementById('gameSetup').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        console.error('❌ No game pairs found after preparePairs()');
        return;
    }

    console.log('🎮 Game starting with', gamePairs.length, 'pairs');

    // Start statistics session
    statisticsService.startSession('hebrew-spelling-compare', {
        totalWords: totalQuestions,
        difficulty: gameMode,
        source: vocabularyService.getLastSource()
    });

    showQuestion();

    if (gameMode === 'timed') {
        document.getElementById('timerBar').classList.add('active');
        startTimer();
    }
}

// Prepare word pairs for the game
function preparePairs() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameType = urlParams.get('type') || 'words';
    let difficulty = gameMode === 'timed' ? 'medium' : gameMode;

    console.log(`📊 Preparing pairs - Type: ${gameType}, Difficulty: ${difficulty}`);
    console.log(`📊 Total wordPairs available: ${wordPairs.length}`);

    // Filter by type and difficulty
    let availablePairs = wordPairs.filter(pair =>
        pair.difficulty === difficulty && pair.type === gameType
    );

    console.log(`📊 Available pairs after filtering: ${availablePairs.length}`);

    // If not enough pairs, use all pairs of this type
    if (availablePairs.length < totalQuestions) {
        console.log('⚠️ Not enough pairs for selected difficulty, using all available pairs for this type');
        availablePairs = wordPairs.filter(pair => pair.type === gameType);
    }

    // Shuffle and select pairs
    availablePairs = shuffleArray(availablePairs);
    gamePairs = availablePairs.slice(0, totalQuestions);

    console.log(`✅ Selected ${gamePairs.length} pairs for the game`);
}

// Show current question
function showQuestion() {
    if (questionNumber > totalQuestions) {
        endGame();
        return;
    }

    hasAnswered = false;
    const pair = gamePairs[questionNumber - 1];

    if (!pair) {
        console.error('❌ No word pair found for question', questionNumber);
        alert('שגיאה: לא נמצאו מילים למשחק. נסה לרענן את הדף.');
        return;
    }

    // Clear previous state
    document.querySelectorAll('.word-card').forEach(card => {
        card.classList.remove('correct', 'incorrect', 'selected', 'disabled');
    });
    document.querySelectorAll('.feedback-icon').forEach(icon => {
        icon.className = 'feedback-icon';
        icon.textContent = '';
    });
    document.getElementById('explanation').classList.remove('show');
    document.querySelectorAll('.hint-text').forEach(hint => {
        hint.classList.remove('show');
    });

    // Display example sentence
    if (pair.example) {
        document.getElementById('sentenceText').textContent = pair.example;
    } else {
        document.getElementById('sentenceText').textContent = 'בחר את האיות הנכון';
    }

    // Randomly position correct and incorrect words
    correctPosition = Math.random() < 0.5 ? 1 : 2;

    if (correctPosition === 1) {
        document.getElementById('word1').textContent = pair.word;
        document.getElementById('word2').textContent = pair.typo;
    } else {
        document.getElementById('word1').textContent = pair.typo;
        document.getElementById('word2').textContent = pair.word;
    }

    // Update progress
    document.getElementById('currentQuestion').textContent = questionNumber;
    const progress = ((questionNumber - 1) / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';

    if (gameMode === 'timed') {
        resetTimer();
    }
}

// Handle card selection
function selectCard(cardNumber) {
    if (hasAnswered) return;

    hasAnswered = true;
    stopTimer();

    const card = document.getElementById(`card${cardNumber}`);
    const otherCard = document.getElementById(`card${cardNumber === 1 ? 2 : 1}`);
    const feedback = document.getElementById(`feedback${cardNumber}`);
    const otherFeedback = document.getElementById(`feedback${cardNumber === 1 ? 2 : 1}`);

    card.classList.add('selected');
    document.querySelectorAll('.word-card').forEach(c => c.classList.add('disabled'));

    const isCorrect = cardNumber === correctPosition;

    if (isCorrect) {
        correctScore++;
        streak++;
        statisticsService.recordAnswer('correct');
        totalScore += 10 + (streak * 2);

        card.classList.add('correct');
        feedback.textContent = '✓';
        feedback.className = 'feedback-icon show-correct';

        document.getElementById('correctScore').textContent = correctScore;
        document.getElementById('totalScore').textContent = totalScore;

        if (streak > maxStreak) {
            maxStreak = streak;
        }

        if (streak >= 3) {
            document.getElementById('streakIndicator').style.display = 'inline-block';
            document.getElementById('streakCount').textContent = streak;
        }

    } else {
        wrongScore++;
        streak = 0;
        statisticsService.recordAnswer('wrong');

        card.classList.add('incorrect');
        otherCard.classList.add('correct');

        feedback.textContent = '✗';
        feedback.className = 'feedback-icon show-incorrect';
        otherFeedback.textContent = '✓';
        otherFeedback.className = 'feedback-icon show-correct';

        document.getElementById('wrongScore').textContent = wrongScore;
        document.getElementById('streakIndicator').style.display = 'none';

        // Show explanation
        const pair = gamePairs[questionNumber - 1];
        document.getElementById('explanationText').textContent = pair.hint;
        document.getElementById('explanation').classList.add('show');
    }

    // Update accuracy
    const accuracy = Math.round((correctScore / questionNumber) * 100);
    document.getElementById('accuracy').textContent = accuracy;

    // Auto advance after delay
    const delay = isCorrect ? 2000 : 3000;
    setTimeout(() => {
        if (questionNumber < totalQuestions) {
            nextQuestion();
        } else {
            endGame();
        }
    }, delay);
}

// Show hint
function showHint(cardNumber, event) {
    event.stopPropagation();

    if (hasAnswered) return;

    const hintElement = document.getElementById(`hint${cardNumber}`);
    const word = document.getElementById(`word${cardNumber}`).textContent;
    const pair = gamePairs[questionNumber - 1];

    let hintText = '';
    if (word === pair.word) {
        hintText = 'זו המילה הנכונה! 👍';
    } else {
        hintText = 'שים לב לאיות... 🤔';
    }

    hintElement.textContent = hintText;
    hintElement.classList.add('show');

    hintsUsed++;
    totalScore = Math.max(0, totalScore - 2);
    document.getElementById('totalScore').textContent = totalScore;

    setTimeout(() => {
        hintElement.classList.remove('show');
    }, 3000);
}

// Next question
function nextQuestion() {
    questionNumber++;
    showQuestion();
}

// Skip question
function skipQuestion() {
    if (hasAnswered) {
        nextQuestion();
    } else {
        wrongScore++;
        statisticsService.recordAnswer('skipped');
        document.getElementById('wrongScore').textContent = wrongScore;
        nextQuestion();
    }
}

// Timer functions
function startTimer() {
    timeLeft = 10;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            stopTimer();
            if (!hasAnswered) {
                skipQuestion();
            }
        }
    }, 1000);
}

function resetTimer() {
    stopTimer();
    startTimer();
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerFill = document.getElementById('timerFill');
    const percentage = (timeLeft / 10) * 100;
    timerFill.style.width = percentage + '%';

    if (timeLeft <= 3) {
        timerFill.className = 'timer-fill danger';
    } else if (timeLeft <= 6) {
        timerFill.className = 'timer-fill warning';
    } else {
        timerFill.className = 'timer-fill';
    }
}

// End game
async function endGame() {
    stopTimer();

    await statisticsService.endSession({
        correctCount: correctScore,
        wrongCount: wrongScore
    });

    const accuracy = totalQuestions > 0 ? Math.round((correctScore / totalQuestions) * 100) : 0;
    let medal = '';

    if (accuracy >= 90) {
        medal = '🏆';
    } else if (accuracy >= 75) {
        medal = '🥇';
    } else if (accuracy >= 60) {
        medal = '🥈';
    } else if (accuracy >= 40) {
        medal = '🥉';
    } else {
        medal = '⭐';
    }

    document.getElementById('medal').textContent = medal;
    document.getElementById('finalScore').textContent = totalScore;
    document.getElementById('finalCorrect').textContent = correctScore;
    document.getElementById('finalWrong').textContent = wrongScore;
    document.getElementById('finalAccuracy').textContent = accuracy;
    document.getElementById('maxStreak').textContent = maxStreak;

    document.getElementById('gameOverModal').showModal();
}

// New game
function newGame() {
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('gameSetup').style.display = 'block';
    document.getElementById('gameOverModal').close();
    stopTimer();
}

// Play again
function playAgain() {
    document.getElementById('gameOverModal').close();
    startGame();
}

// Utility function to shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Expose functions for onclick handlers
window.selectMode = selectMode;
window.startGame = startGame;
window.selectCard = selectCard;
window.nextQuestion = nextQuestion;
window.skipQuestion = skipQuestion;
window.newGame = newGame;
window.playAgain = playAgain;
