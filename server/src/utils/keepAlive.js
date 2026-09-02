const https = require('https');
const http = require('http');

/**
 * Render Free Tier Auto Keep-Alive Service
 * Prevents Render web services from going to sleep (spinning down) after 15 minutes of inactivity.
 * Automatically detects Render URL or user-configured SERVER_URL and pings /api/health every 5 minutes.
 */
function startKeepAlive() {
    const PING_INTERVAL_MS = (parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES, 10) || 3) * 60 * 1000; // 3 minutes

    const getTargetUrl = () => {
        if (process.env.RENDER_EXTERNAL_URL) {
            return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
        }
        if (process.env.SERVER_URL) {
            return process.env.SERVER_URL.replace(/\/+$/, '');
        }
        if (process.env.RENDER_SERVICE_NAME) {
            return `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
        }
        return 'https://justdraw-in.onrender.com';
    };

    const targetBase = getTargetUrl();

    if (process.env.NODE_ENV !== 'production' && !process.env.RENDER) {
        console.log('[KeepAlive] Local development detected.');
        return;
    }

    const pingUrl = `${targetBase}/api/health`;

    console.log(`[KeepAlive] High-performance keep-alive active. Target: ${pingUrl} (every ${PING_INTERVAL_MS / 60000} mins)`);

    const doPing = () => {
        try {
            const urlObj = new URL(pingUrl);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.get(pingUrl, { timeout: 8000 }, (res) => {
                // Consume response data to free up memory
                res.resume();
            });

            req.on('error', (err) => {
                // Silent fail
            });

            req.on('timeout', () => {
                req.destroy();
            });
        } catch (e) {}
    };

    // Immediate warm-up ping after 5 seconds to keep DB connections hot
    setTimeout(doPing, 5000);
    setInterval(doPing, PING_INTERVAL_MS);
}

module.exports = { startKeepAlive };
