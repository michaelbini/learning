/**
 * Statistics Dashboard
 */
import { statisticsService } from '../shared/statistics-service.js';
import { playerService } from '../shared/player-service.js';

// Game name mapping
const GAME_NAMES = {
    'english-flashcards': { name: 'קלפים - אנגלית', icon: '🎴' },
    'english-quiz': { name: 'חידון - אנגלית', icon: '❓' },
    'english-typing': { name: 'הקלדה - אנגלית', icon: '⌨️' },
    'english-board': { name: 'לוח - אנגלית', icon: '🎮' },
    'hebrew-spelling': { name: 'איות - עברית', icon: '✏️' },
    'hebrew-spelling-compare': { name: 'השוואת איות - עברית', icon: '🔤' }
};

function getGameDisplay(gameId) {
    const game = GAME_NAMES[gameId] || { name: gameId, icon: '🎮' };
    return `<span class="game-icon">${game.icon}</span> ${game.name}`;
}

function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0} שניות`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours} שעות ${minutes % 60} דקות`;
    }
    return `${minutes} דקות`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short'
    });
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
}

async function loadDashboard() {
    const playerId = playerService.getPlayerIdSilent();

    if (!playerId) {
        document.getElementById('playerNameDisplay').innerHTML = '<span>אורח</span>';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('noPlayerState').style.display = 'block';
        return;
    }

    document.getElementById('playerNameDisplay').innerHTML = `<span>👤 ${playerId}</span>`;

    // Load player stats
    const playerStats = await statisticsService.getPlayerStats();
    if (playerStats) {
        document.getElementById('totalSessions').textContent = playerStats.totalSessions || 0;
        document.getElementById('totalTime').textContent = formatDuration(playerStats.totalPlayTime);
        document.getElementById('gamesPlayed').textContent = playerStats.gamesPlayed?.length || 0;
    } else {
        document.getElementById('totalSessions').textContent = '0';
        document.getElementById('totalTime').textContent = '0 דקות';
        document.getElementById('gamesPlayed').textContent = '0';
    }

    // Load recent sessions
    const sessions = await statisticsService.getPlayerSessions(20);

    // Calculate average score
    if (sessions.length > 0) {
        const avgScore = Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length);
        document.getElementById('avgScore').textContent = `${avgScore}%`;
    } else {
        document.getElementById('avgScore').textContent = '-';
    }

    // Load best scores
    const bestScores = await statisticsService.getBestScores();
    renderBestScores(bestScores);

    // Render sessions table
    renderSessions(sessions);
}

function renderBestScores(bestScores) {
    const container = document.getElementById('bestScoresGrid');

    if (!bestScores || Object.keys(bestScores).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎯</div>
                <p>עדיין אין שיאים. שחק משחק כדי לראות שיאים!</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const [gameId, data] of Object.entries(bestScores)) {
        const game = GAME_NAMES[gameId] || { name: gameId, icon: '🎮' };
        html += `
            <div class="best-score-card">
                <div class="game-name">${game.icon} ${game.name}</div>
                <div class="score">${data.score}%</div>
                <div class="date">${data.correctCount}/${data.totalWords} | ${formatDate(data.date)}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderSessions(sessions) {
    const container = document.getElementById('sessionsContainer');

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <p>עדיין אין משחקים. שחק משחק כדי לראות היסטוריה!</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="sessions-table">
            <thead>
                <tr>
                    <th>תאריך</th>
                    <th>משחק</th>
                    <th>ציון</th>
                    <th>נכון/שגוי</th>
                    <th>זמן</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const session of sessions) {
        const scoreClass = getScoreClass(session.score);
        html += `
            <tr>
                <td>${formatDate(session.date)}</td>
                <td>${getGameDisplay(session.gameId)}</td>
                <td class="score-cell ${scoreClass}">${session.score}%</td>
                <td>${session.correctCount}/${session.correctCount + session.wrongCount}</td>
                <td>${formatDuration(session.durationSeconds)}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Change player function
function changePlayer() {
    if (confirm('האם אתה בטוח שברצונך להחליף שחקן?')) {
        playerService.clearPlayerId();
        window.location.href = '../index.html';
    }
}

// Expose to global scope for onclick
window.changePlayer = changePlayer;

// Load on page ready
loadDashboard();
