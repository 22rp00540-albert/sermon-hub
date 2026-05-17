"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMember = exports.getAdminMetrics = exports.rejectUser = exports.approveUser = exports.listMembers = exports.listPendingUsers = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const listPendingUsers = async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        where: { role: client_1.Role.MEMBER, status: client_1.UserStatus.PENDING },
        select: {
            id: true,
            fullName: true,
            email: true,
            country: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    res.json(users);
};
exports.listPendingUsers = listPendingUsers;
const listMembers = async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        where: { role: client_1.Role.MEMBER },
        select: {
            id: true,
            fullName: true,
            email: true,
            country: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    res.json(users);
};
exports.listMembers = listMembers;
const approveUser = async (req, res) => {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
        res.status(400).json({ message: "Invalid user id" });
        return;
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { status: client_1.UserStatus.APPROVED },
    });
    res.json({ message: "User approved", userId: updated.id, status: updated.status });
};
exports.approveUser = approveUser;
const rejectUser = async (req, res) => {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
        res.status(400).json({ message: "Invalid user id" });
        return;
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { status: client_1.UserStatus.REJECTED },
    });
    res.json({ message: "User rejected", userId: updated.id, status: updated.status });
};
exports.rejectUser = rejectUser;
const getAdminMetrics = async (_req, res) => {
    const [members, approvedMembers, preachers, sermons, audioCompleted, videoCompleted] = await Promise.all([
        prisma_1.prisma.user.count({ where: { role: client_1.Role.MEMBER } }),
        prisma_1.prisma.user.count({
            where: { role: client_1.Role.MEMBER, status: client_1.UserStatus.APPROVED },
        }),
        prisma_1.prisma.preacher.count(),
        prisma_1.prisma.sermon.count(),
        prisma_1.prisma.listeningSession.count({ where: { completed: true } }),
        prisma_1.prisma.videoListeningSession.count({ where: { completed: true } }),
    ]);
    res.json({
        members,
        approvedMembers,
        preachers,
        sermons,
        completedSessions: audioCompleted + videoCompleted,
    });
};
exports.getAdminMetrics = getAdminMetrics;
const deleteMember = async (req, res) => {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
        res.status(400).json({ message: "Invalid user id" });
        return;
    }
    const member = await prisma_1.prisma.user.findFirst({
        where: { id: userId, role: client_1.Role.MEMBER },
        select: { id: true },
    });
    if (!member) {
        res.status(404).json({ message: "Member not found" });
        return;
    }
    await prisma_1.prisma.user.delete({ where: { id: userId } });
    res.json({ message: "Member deleted", userId });
};
exports.deleteMember = deleteMember;
