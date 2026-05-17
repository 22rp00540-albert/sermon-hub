"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchMemberVideoSermonsSetting = exports.getMemberLibrarySettings = void 0;
const zod_1 = require("zod");
const appSettings_1 = require("../lib/appSettings");
const publicErrorMessage_1 = require("../lib/publicErrorMessage");
const getMemberLibrarySettings = async (_req, res) => {
    try {
        const memberVideoSermonsEnabled = await (0, appSettings_1.getMemberVideoSermonsEnabled)();
        res.json({ memberVideoSermonsEnabled });
    }
    catch (error) {
        console.error(error);
        const raw = error instanceof Error ? error.message : "settings";
        res.status(503).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
    }
};
exports.getMemberLibrarySettings = getMemberLibrarySettings;
const patchMemberVideoSchema = zod_1.z.object({
    enabled: zod_1.z.union([zod_1.z.boolean(), zod_1.z.literal(0), zod_1.z.literal(1)]).transform((v) => v === true || v === 1),
});
const patchMemberVideoSermonsSetting = async (req, res) => {
    const parsed = patchMemberVideoSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Request body must include enabled: boolean" });
        return;
    }
    try {
        const memberVideoSermonsEnabled = await (0, appSettings_1.setMemberVideoSermonsEnabled)(parsed.data.enabled);
        res.json({ memberVideoSermonsEnabled });
    }
    catch (error) {
        console.error(error);
        const raw = error instanceof Error ? error.message : "settings";
        res.status(503).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
    }
};
exports.patchMemberVideoSermonsSetting = patchMemberVideoSermonsSetting;
