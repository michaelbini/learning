/**
 * Offline Indicator Component
 * Shows a banner when data is loaded from fallback (JSON/embedded) instead of Firebase
 */

export function createOfflineIndicator() {
    // Don't create duplicate
    if (document.getElementById('offline-indicator')) {
        return document.getElementById('offline-indicator');
    }

    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.innerHTML = '📡 מצב לא מקוון - נטען מקובץ מקומי';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #f59e0b;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        z-index: 9999;
        display: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(indicator);
    return indicator;
}

export function showOfflineIndicator(show = true) {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
    }
}

export function setOfflineIndicatorText(text) {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.innerHTML = text;
    }
}
