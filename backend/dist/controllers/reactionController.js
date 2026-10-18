"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatReactions = formatReactions;
exports.toggleReaction = toggleReaction;
exports.getReactions = getReactions;
const prisma_1 = __importDefault(require("../config/prisma"));
const friendTaskController_1 = require("./friendTaskController");
const ALLOWED_EMOJIS = ['FIRE', 'STRONG', 'CLAP', 'CELEBRATE'];
/**
 * Format reaction list into aggregate counts and user's active reactions
 */
function formatReactions(reactions, currentUserId) {
    const counts = {
        FIRE: 0,
        STRONG: 0,
        CLAP: 0,
        CELEBRATE: 0
    };
    const userReactions = [];
    for (const r of reactions) {
        const emoji = r.emoji;
        if (counts[emoji] !== undefined) {
            counts[emoji]++;
        }
        if (r.userId === currentUserId && ALLOWED_EMOJIS.includes(emoji)) {
            if (!userReactions.includes(emoji)) {
                userReactions.push(emoji);
            }
        }
    }
    return {
        counts,
        userReactions,
        totalCount: reactions.length
    };
}
/**
 * Toggle an emoji reaction on a study note (Requirement 6)
 * Supported: FIRE (🔥), STRONG (💪), CLAP (👏), CELEBRATE (🎉)
 */
async function toggleReaction(req, res) {
    try {
        const userId = req.user.userId;
        const { completionId } = req.params;
        const { emoji } = req.body;
        if (!ALLOWED_EMOJIS.includes(emoji)) {
            return res.status(400).json({
                success: false,
                error: `Invalid reaction emoji. Allowed: ${ALLOWED_EMOJIS.join(', ')}`
            });
        }
        // Verify task completion exists and has a study note
        const completion = await prisma_1.default.taskCompletion.findUnique({
            where: { id: completionId },
            select: { id: true, userId: true, studyNote: true }
        });
        if (!completion) {
            return res.status(404).json({ success: false, error: 'Study note not found or was deleted.' });
        }
        // Verify requester is note owner OR accepted friend
        const isOwner = completion.userId === userId;
        const isFriend = await (0, friendTaskController_1.areFriends)(userId, completion.userId);
        if (!isOwner && !isFriend) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden. You can only react to notes from accepted friends.'
            });
        }
        // Check if reaction of this type already exists for this user on this completion
        const existing = await prisma_1.default.studyNoteReaction.findUnique({
            where: {
                userId_completionId_emoji: {
                    userId,
                    completionId,
                    emoji
                }
            }
        });
        if (existing) {
            // Toggle off: remove reaction
            await prisma_1.default.studyNoteReaction.delete({
                where: { id: existing.id }
            });
        }
        else {
            // Add reaction
            await prisma_1.default.studyNoteReaction.create({
                data: {
                    userId,
                    completionId,
                    emoji
                }
            });
        }
        // Fetch all current reactions for this completion to return updated authoritative state
        const allReactions = await prisma_1.default.studyNoteReaction.findMany({
            where: { completionId },
            select: { id: true, userId: true, emoji: true }
        });
        const formatted = formatReactions(allReactions, userId);
        return res.json({
            success: true,
            message: existing ? 'Reaction removed.' : 'Reaction added.',
            completionId,
            ...formatted
        });
    }
    catch (err) {
        console.error('toggleReaction error:', err);
        return res.status(500).json({ success: false, error: 'Failed to update reaction.' });
    }
}
/**
 * Get reactions for a study note
 */
async function getReactions(req, res) {
    try {
        const userId = req.user.userId;
        const { completionId } = req.params;
        const completion = await prisma_1.default.taskCompletion.findUnique({
            where: { id: completionId },
            select: { id: true, userId: true }
        });
        if (!completion) {
            return res.status(404).json({ success: false, error: 'Study note not found.' });
        }
        const isOwner = completion.userId === userId;
        const isFriend = await (0, friendTaskController_1.areFriends)(userId, completion.userId);
        if (!isOwner && !isFriend) {
            return res.status(403).json({ success: false, error: 'Forbidden.' });
        }
        const allReactions = await prisma_1.default.studyNoteReaction.findMany({
            where: { completionId },
            select: { id: true, userId: true, emoji: true }
        });
        const formatted = formatReactions(allReactions, userId);
        return res.json({
            success: true,
            completionId,
            ...formatted
        });
    }
    catch (err) {
        console.error('getReactions error:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve reactions.' });
    }
}
