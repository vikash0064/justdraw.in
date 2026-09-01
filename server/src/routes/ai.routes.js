/**
 * AI Routes
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getUsage, getTemplates, wireframeToCode, generateDiagram } = require('../controllers/ai.controller');

router.get('/usage', protect, getUsage);
router.get('/templates', getTemplates); // Public — guests can see templates
router.post('/wireframe-to-code', protect, wireframeToCode);
router.post('/generate-diagram', generateDiagram);

module.exports = router;
