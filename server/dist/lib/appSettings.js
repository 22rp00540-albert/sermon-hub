"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberVideoSermonsEnabled = getMemberVideoSermonsEnabled;
exports.setMemberVideoSermonsEnabled = setMemberVideoSermonsEnabled;
const client_1 = require("@prisma/client");
const prisma_1 = require("./prisma");
async function getMemberVideoSermonsEnabled() {
    const row = await prisma_1.prisma.appSettings.findUnique({ where: { id: 1 } });
    if (!row) {
        await prisma_1.prisma.appSettings.create({
            data: { id: 1, memberVideoSermonsEnabled: false },
        });
        return false;
    }
    return row.memberVideoSermonsEnabled;
}
/**
 * Persist member video access. Uses updateMany + create fallback instead of upsert
 * (more reliable on some MySQL + Prisma setups).
 */
async function setMemberVideoSermonsEnabled(enabled) {
    const updated = await prisma_1.prisma.appSettings.updateMany({
        where: { id: 1 },
        data: { memberVideoSermonsEnabled: enabled },
    });
    if (updated.count === 0) {
        try {
            await prisma_1.prisma.appSettings.create({
                data: { id: 1, memberVideoSermonsEnabled: enabled },
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                await prisma_1.prisma.appSettings.updateMany({
                    where: { id: 1 },
                    data: { memberVideoSermonsEnabled: enabled },
                });
            }
            else {
                throw e;
            }
        }
    }
    const row = await prisma_1.prisma.appSettings.findUnique({ where: { id: 1 } });
    return Boolean(row?.memberVideoSermonsEnabled);
}
