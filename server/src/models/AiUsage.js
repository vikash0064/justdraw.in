/**
 * AI Usage tracking model — records every AI operation for tier limits and analytics
 */
const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Board',
        },
        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
        },
        prompt: {
            type: String,
            maxlength: 2000,
        },
        provider: {
            type: String,
            enum: ['gemini', 'openai', 'anthropic'],
            default: 'gemini',
        },
        model: {
            type: String,
            default: 'gemini-2.0-flash',
        },
        toolCalls: {
            type: Number,
            default: 0,
        },
        promptTokens: {
            type: Number,
            default: 0,
        },
        completionTokens: {
            type: Number,
            default: 0,
        },
        totalTokens: {
            type: Number,
            default: 0,
        },
        success: {
            type: Boolean,
            default: true,
        },
        error: {
            type: String,
        },
    },
    { timestamps: true }
);

// Index for usage queries
aiUsageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
