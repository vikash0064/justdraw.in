/**
 * Comment model — threaded comments pinned to canvas elements or coordinates
 */
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
    {
        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Board',
            required: true,
            index: true,
        },
        page: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Page',
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Pin location — either element ID or canvas coordinates
        elementId: {
            type: String,
        },
        x: {
            type: Number,
        },
        y: {
            type: Number,
        },
        text: {
            type: String,
            required: [true, 'Comment text is required'],
            maxlength: 2000,
        },
        // Thread support
        parentComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
        },
        resolved: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

commentSchema.index({ board: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
