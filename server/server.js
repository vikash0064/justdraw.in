require('dotenv').config();
const { initProviders } = require('./src/services/ai.service');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const initSocket = require('./src/sockets');

// Route imports
const authRoutes = require('./src/routes/auth.routes');
const workspaceRoutes = require('./src/routes/workspace.routes');
const boardRoutes = require('./src/routes/board.routes');
const pageRoutes = require('./src/routes/page.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const exportRoutes = require('./src/routes/export.routes');
const statsRoutes = require('./src/routes/stats.routes');
const aiRoutes = require('./src/routes/ai.routes');
const commentRoutes = require('./src/routes/comment.routes');

// ── App setup ──
const app = express();
const server = http.createServer(app);
const compression = require('compression');

// ── Socket.io ──
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ── Middleware ──
app.use(compression({ threshold: 512 })); // Compress all responses > 512 bytes
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const passport = require('passport');
require('./src/config/passport');
app.use(passport.initialize());

const fs = require('fs');

// ── Health & Keep-Alive Routes ──
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', boardRoutes);
app.use('/api', pageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/comments', commentRoutes);

// ── Serve Static Frontend (Single Deployment Mode) ──
const clientDistCandidates = [
    path.join(__dirname, '../client/dist'),
    path.join(__dirname, 'client/dist'),
    path.join(__dirname, 'public'),
    path.join(__dirname, 'dist')
];

const clientDistPath = clientDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html')));

if (clientDistPath) {
    console.log(`[Frontend] Serving static frontend from: ${clientDistPath}`);
    
    // 1. Serve hashed asset bundles with long cache
    app.use('/assets', express.static(path.join(clientDistPath, 'assets'), {
        maxAge: '1y',
        immutable: true
    }));

    // 2. Return 404 for missing assets (never fall back to index.html for .js/.css)
    app.use('/assets/*', (req, res) => {
        res.status(404).type('text/plain').send('Asset not found');
    });

    // 3. Static assets in root (favicon, logos, etc.)
    app.use(express.static(clientDistPath));

    // 4. SPA fallback: Serve index.html with NO-CACHE headers to always fetch latest version
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health') || req.path.startsWith('/socket.io') || req.path.startsWith('/assets')) {
            return next();
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({ status: 'ok', message: 'justdraw backend server is active. Build frontend with `npm run build` in client directory to serve UI.', timestamp: new Date().toISOString() });
    });
}

// ── Global error handler ──
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
    });
});

// ── Start server ──
const PORT = process.env.PORT || 5000;
const { startKeepAlive } = require('./src/utils/keepAlive');

const start = async () => {
    try {
        await connectDB();
        initProviders();
        initSocket(io);

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            // Initialize silent keep-alive for Render free tier hosting
            startKeepAlive();
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

start();
