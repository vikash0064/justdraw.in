const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
    createBoard,
    getBoards,
    getBoard,
    getRecentBoards,
    updateBoard,
    deleteBoard,
    searchBoards,
    getDsaStats,
} = require('../controllers/board.controller');

// ── Bespoke Data Structures & Algorithms (DSA) Optimization & Search endpoints ──
// NOTE: Must be defined prior to '/boards/:id' to prevent route collision
router.get('/boards/recent', protect, getRecentBoards);
router.get('/boards/search', searchBoards);
router.get('/boards/dsa/stats', getDsaStats);

// Public: allow guests to load a board by ID (serves via O(1) LRU Cache when warm)
router.get('/boards/:id', getBoard);

// Protected routes — require auth
router.post('/workspaces/:wsId/boards', protect, createBoard);
router.get('/workspaces/:wsId/boards', protect, getBoards);
router.route('/boards/:id').put(protect, updateBoard).delete(protect, deleteBoard);

module.exports = router;

