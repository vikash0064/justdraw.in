/**
 * Comment Routes
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getComments, createComment, resolveComment, deleteComment, updateComment } = require('../controllers/comment.controller');

router.get('/:boardId', protect, getComments);
router.post('/', protect, createComment);
router.patch('/:id/resolve', protect, resolveComment);
router.patch('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);

module.exports = router;
