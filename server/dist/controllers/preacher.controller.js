"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePreacher = exports.updatePreacher = exports.createPreacher = exports.listPreachers = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const preacherSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    bio: zod_1.z.string().optional(),
});
const listPreachers = async (_req, res) => {
    const preachers = await prisma_1.prisma.preacher.findMany({
        orderBy: { createdAt: "desc" },
    });
    res.json(preachers);
};
exports.listPreachers = listPreachers;
const createPreacher = async (req, res) => {
    try {
        const data = preacherSchema.parse(req.body);
        const preacher = await prisma_1.prisma.preacher.create({ data });
        res.status(201).json(preacher);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
};
exports.createPreacher = createPreacher;
const updatePreacher = async (req, res) => {
    const preacherId = Number(req.params.id);
    if (Number.isNaN(preacherId)) {
        res.status(400).json({ message: "Invalid preacher id" });
        return;
    }
    try {
        const data = preacherSchema.partial().parse(req.body);
        const preacher = await prisma_1.prisma.preacher.update({
            where: { id: preacherId },
            data,
        });
        res.json(preacher);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
};
exports.updatePreacher = updatePreacher;
const deletePreacher = async (req, res) => {
    const preacherId = Number(req.params.id);
    if (Number.isNaN(preacherId)) {
        res.status(400).json({ message: "Invalid preacher id" });
        return;
    }
    const sermonCount = await prisma_1.prisma.sermon.count({ where: { preacherId } });
    if (sermonCount > 0) {
        res.status(409).json({ message: "Cannot delete preacher with existing sermons" });
        return;
    }
    await prisma_1.prisma.preacher.delete({ where: { id: preacherId } });
    res.json({ message: "Preacher deleted", preacherId });
};
exports.deletePreacher = deletePreacher;
