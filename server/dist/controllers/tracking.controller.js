"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveVideoListeningProgress = exports.saveListeningProgress = void 0;
const zod_1 = require("zod");
const listeningCompletion_1 = require("../lib/listeningCompletion");
const prisma_1 = require("../lib/prisma");
const progressSchema = zod_1.z.object({
    progressSeconds: zod_1.z.number().int().nonnegative(),
    completed: zod_1.z.boolean().optional(),
    durationSeconds: zod_1.z.number().int().positive().optional(),
    /** Seconds of actual playback (client); required for trustworthy "completed". */
    engagedWatchSeconds: zod_1.z.number().min(0).optional(),
});
function mergeMediaDuration(incoming, previous) {
    if (incoming != null && incoming >= 1) {
        return Math.max(incoming, previous ?? 0);
    }
    if (previous != null && previous >= 1)
        return previous;
    return null;
}
function nextCompletedState(args) {
    if (args.existingCompleted) {
        return { completed: true, completedAt: args.existingCompletedAt };
    }
    const ok = (0, listeningCompletion_1.resolveListeningCompletion)({
        clientWantsComplete: Boolean(args.clientCompleted),
        progressSeconds: args.mergedProgressSeconds,
        engagedWatchSeconds: args.engagedWatchSeconds,
        previousProgressSeconds: args.existingProgressSeconds,
        previousCompleted: false,
        mediaDurationSeconds: args.mediaDurationSeconds,
    });
    if (!ok) {
        return { completed: false, completedAt: null };
    }
    return { completed: true, completedAt: new Date() };
}
const saveListeningProgress = async (req, res) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const sermonId = Number(req.params.sermonId);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    try {
        const data = progressSchema.parse(req.body);
        const existing = await prisma_1.prisma.listeningSession.findUnique({
            where: {
                userId_sermonId: {
                    userId: req.user.userId,
                    sermonId,
                },
            },
            select: {
                mediaDurationSeconds: true,
                progressSeconds: true,
                completed: true,
                completedAt: true,
            },
        });
        const mediaDurationSeconds = mergeMediaDuration(data.durationSeconds, existing?.mediaDurationSeconds);
        const mergedProgressSeconds = Math.max(existing?.progressSeconds ?? 0, data.progressSeconds);
        const { completed, completedAt } = nextCompletedState({
            existingCompleted: Boolean(existing?.completed),
            existingCompletedAt: existing?.completedAt ?? null,
            existingProgressSeconds: existing?.progressSeconds ?? 0,
            clientCompleted: data.completed,
            mergedProgressSeconds,
            engagedWatchSeconds: data.engagedWatchSeconds,
            mediaDurationSeconds,
        });
        const updated = await prisma_1.prisma.listeningSession.upsert({
            where: {
                userId_sermonId: {
                    userId: req.user.userId,
                    sermonId,
                },
            },
            create: {
                userId: req.user.userId,
                sermonId,
                progressSeconds: mergedProgressSeconds,
                completed,
                completedAt,
                mediaDurationSeconds,
            },
            update: {
                progressSeconds: mergedProgressSeconds,
                completed,
                completedAt,
                mediaDurationSeconds,
            },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payload" });
    }
};
exports.saveListeningProgress = saveListeningProgress;
const saveVideoListeningProgress = async (req, res) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const videoId = Number(req.params.videoId);
    if (Number.isNaN(videoId)) {
        res.status(400).json({ message: "Invalid video id" });
        return;
    }
    try {
        const data = progressSchema.parse(req.body);
        const existing = await prisma_1.prisma.videoListeningSession.findUnique({
            where: {
                userId_videoSermonId: {
                    userId: req.user.userId,
                    videoSermonId: videoId,
                },
            },
            select: {
                mediaDurationSeconds: true,
                progressSeconds: true,
                completed: true,
                completedAt: true,
            },
        });
        const mediaDurationSeconds = mergeMediaDuration(data.durationSeconds, existing?.mediaDurationSeconds);
        const mergedProgressSeconds = Math.max(existing?.progressSeconds ?? 0, data.progressSeconds);
        const { completed, completedAt } = nextCompletedState({
            existingCompleted: Boolean(existing?.completed),
            existingCompletedAt: existing?.completedAt ?? null,
            existingProgressSeconds: existing?.progressSeconds ?? 0,
            clientCompleted: data.completed,
            mergedProgressSeconds,
            engagedWatchSeconds: data.engagedWatchSeconds,
            mediaDurationSeconds,
        });
        const updated = await prisma_1.prisma.videoListeningSession.upsert({
            where: {
                userId_videoSermonId: {
                    userId: req.user.userId,
                    videoSermonId: videoId,
                },
            },
            create: {
                userId: req.user.userId,
                videoSermonId: videoId,
                progressSeconds: mergedProgressSeconds,
                completed,
                completedAt,
                mediaDurationSeconds,
            },
            update: {
                progressSeconds: mergedProgressSeconds,
                completed,
                completedAt,
                mediaDurationSeconds,
            },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payload" });
    }
};
exports.saveVideoListeningProgress = saveVideoListeningProgress;
