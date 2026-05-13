"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveListeningProgress = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const progressSchema = zod_1.z.object({
    progressSeconds: zod_1.z.number().int().nonnegative(),
    completed: zod_1.z.boolean().optional(),
});
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
                progressSeconds: data.progressSeconds,
                completed: Boolean(data.completed),
                completedAt: data.completed ? new Date() : null,
            },
            update: {
                progressSeconds: data.progressSeconds,
                completed: Boolean(data.completed),
                completedAt: data.completed ? new Date() : null,
            },
        });
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payload" });
    }
};
exports.saveListeningProgress = saveListeningProgress;
