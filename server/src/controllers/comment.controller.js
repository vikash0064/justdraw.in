/**
 * Comment Controller — CRUD for threaded comments
 */
const Comment = require('../models/Comment');

/**
 * GET /api/comments/:boardId — Get all comments for a board
 */
const getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ board: req.params.boardId })
            .populate('user', 'name email avatar')
            .populate('parentComment')
            .sort({ createdAt: 1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch comments' });
    }
};

/**
 * POST /api/comments — Create a comment
 */
const createComment = async (req, res) => {
    try {
        const { boardId, pageId, elementId, x, y, text, parentComment } = req.body;

        const comment = await Comment.create({
            board: boardId,
            page: pageId || undefined,
            user: req.user._id,
            elementId,
            x,
            y,
            text,
            parentComment: parentComment || undefined,
        });

        const populated = await Comment.findById(comment._id)
            .populate('user', 'name email avatar');

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create comment' });
    }
};

/**
 * PATCH /api/comments/:id/resolve — Toggle resolve
 */
const resolveComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        comment.resolved = !comment.resolved;
        await comment.save();
        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update comment' });
    }
};

/**
 * DELETE /api/comments/:id
 */
const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Only author or admin can delete
        if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }

        // Also delete child replies
        await Comment.deleteMany({ parentComment: comment._id });
        await Comment.findByIdAndDelete(req.params.id);

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete comment' });
    }
};

/**
 * PATCH /api/comments/:id — Update comment position or text
 */
const updateComment = async (req, res) => {
    try {
        const { x, y, text } = req.body;
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        if (x !== undefined) comment.x = x;
        if (y !== undefined) comment.y = y;
        if (text !== undefined) comment.text = text;

        await comment.save();
        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update comment' });
    }
};

module.exports = {
    getComments,
    createComment,
    resolveComment,
    deleteComment,
    updateComment,
};
