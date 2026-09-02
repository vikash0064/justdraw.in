const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const passport = require('passport');
const {
    register,
    login,
    getMe,
    registerValidation,
    loginValidation,
} = require('../controllers/auth.controller');

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);

// ── Google OAuth Routes ──
router.get('/google', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #121214; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <h2 style="color: #ff6b6b; margin-bottom: 10px;">Google OAuth Configuration Required</h2>
                <p style="color: #a5a7b5; max-width: 500px; line-height: 1.5;">
                    Please add your <b>GOOGLE_CLIENT_ID</b> and <b>GOOGLE_CLIENT_SECRET</b> into <code>server/.env</code>.
                </p>
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="margin-top: 20px; padding: 10px 20px; background: #6965db; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    ← Back to Login
                </a>
            </div>
        `);
    }

    // Preserve where user came from so they don't get stuck on localhost after login
    const returnTo = req.query.return_to || req.headers.referer || '';
    const state = returnTo ? Buffer.from(returnTo).toString('base64') : undefined;

    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state
    })(req, res, next);
});

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, generate JWT
        const token = req.user.generateToken();

        // Default redirect destination
        let clientUrl = process.env.CLIENT_URL || 'https://justdraw-in.onrender.com';

        // If state was preserved, return user to their origin
        if (req.query.state) {
            try {
                const decoded = Buffer.from(req.query.state, 'base64').toString('utf-8');
                if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
                    const parsed = new URL(decoded);
                    clientUrl = parsed.origin;
                }
            } catch (e) {
                console.error('Error decoding OAuth state:', e);
            }
        }

        // Return clean auto-closing bridge script for popups (PWA friendly) + fallback redirect for standard windows
        res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating with justdraw...</title>
  <style>
    body { background: #0c0d14; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .loader { text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <div style="font-size: 15px; font-weight: 600;">Connecting to justdraw...</div>
  </div>
  <script>
    const token = "${token}";
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({ type: 'JUSTDRAW_GOOGLE_AUTH_TOKEN', token: token }, '*');
        setTimeout(() => window.close(), 150);
      } catch (e) {
        window.location.href = "${clientUrl}/?token=" + token;
      }
    } else {
      window.location.href = "${clientUrl}/?token=" + token;
    }
  </script>
</body>
</html>`);
    }
);

module.exports = router;
