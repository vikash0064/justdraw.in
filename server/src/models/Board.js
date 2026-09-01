const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Board title is required'],
            trim: true,
            maxlength: 100,
        },
        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        mode: {
            type: String,
            enum: ['whiteboard', 'architecture', 'er', 'notes'],
            default: 'whiteboard',
        },
    },
    { timestamps: true }
);

boardSchema.index({ workspace: 1, updatedAt: -1 });
boardSchema.index({ workspace: 1, createdAt: -1 });
boardSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Board', boardSchema);
