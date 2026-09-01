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
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, generate JWT
        const token = req.user.generateToken();

        // Redirect to frontend with token in URL
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(`${clientUrl}/?token=${token}`);
    }
);

module.exports = router;
