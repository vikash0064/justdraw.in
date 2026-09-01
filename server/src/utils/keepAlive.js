const https = require('https');
const http = require('http');

/**
 * Render Free Tier Auto Keep-Alive Service
 * Prevents Render web services from going to sleep (spinning down) after 15 minutes of inactivity.
 * Automatically detects Render URL or user-configured SERVER_URL and pings /api/health every 5 minutes.
 */
function startKeepAlive() {
    const PING_INTERVAL_MS = (parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES, 10) || 5) * 60 * 1000; // Default: 5 minutes

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
        return null;
    };

    const targetBase = getTargetUrl();

    if (!targetBase && process.env.NODE_ENV !== 'production') {
        console.log('[KeepAlive] Local development detected. Set RENDER_EXTERNAL_URL or SERVER_URL in production to enable auto-ping.');
        return;
    }

    const pingUrl = `${targetBase || 'http://localhost:' + (process.env.PORT || 5000)}/api/health`;

    console.log(`[KeepAlive] Silent keep-alive service initialized. Target: ${pingUrl} (every ${PING_INTERVAL_MS / 60000} mins)`);

    const doPing = () => {
        try {
            const urlObj = new URL(pingUrl);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.get(pingUrl, { timeout: 15000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Silent successful heartbeat
                        if (process.env.DEBUG_KEEPALIVE === 'true') {
                            console.log(`[KeepAlive] Heartbeat OK at ${new Date().toISOString()}`);
                        }
                    } else {
                        console.warn(`[KeepAlive] Ping received status ${res.statusCode}`);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
            });

            req.on('error', (err) => {
                // Silently swallow errors during cold spinup or network hiccups so server never crashes
                if (process.env.DEBUG_KEEPALIVE === 'true') {
                    console.warn(`[KeepAlive] Ping notice: ${err.message}`);
                }
            });
        } catch (err) {
            // Ignore parse errors
        }
    };

    // First ping after 1 minute of startup, then every 5 minutes
    setTimeout(() => {
        doPing();
        setInterval(doPing, PING_INTERVAL_MS);
    }, 60 * 1000);
}

module.exports = { startKeepAlive };
