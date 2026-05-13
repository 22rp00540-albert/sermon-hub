"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const objectStorage_1 = require("../lib/objectStorage");
const prisma_1 = require("../lib/prisma");
const upload_1 = require("../lib/upload");
const localAudioPattern = /^uploads\/(audio\/)?[^/]+$/i;
const normalize = (value) => value.replace(/\\/g, "/");
const resolveLocalPath = (storedPath) => {
    const normalized = normalize(storedPath).replace(/^\/+/, "");
    const relative = normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
    return path_1.default.resolve(upload_1.uploadsDir, relative);
};
const getContentType = (filePath) => {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === ".m4a" || ext === ".mp4")
        return "audio/mp4";
    if (ext === ".wav")
        return "audio/wav";
    if (ext === ".ogg")
        return "audio/ogg";
    if (ext === ".aac")
        return "audio/aac";
    if (ext === ".webm")
        return "audio/webm";
    if (ext === ".flac")
        return "audio/flac";
    return "audio/mpeg";
};
const run = async () => {
    if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
        throw new Error("Object storage is not configured. Set S3_* environment variables in server/.env");
    }
    const sermons = await prisma_1.prisma.sermon.findMany({
        select: { id: true, audioUrl: true, title: true },
    });
    const localSermons = sermons.filter((s) => localAudioPattern.test(normalize(s.audioUrl)));
    if (localSermons.length === 0) {
        console.log("No local audio records found. Nothing to migrate.");
        return;
    }
    let migrated = 0;
    let skipped = 0;
    for (const sermon of localSermons) {
        const filePath = resolveLocalPath(sermon.audioUrl);
        if (!fs_1.default.existsSync(filePath)) {
            console.warn(`Skipping sermon ${sermon.id} (${sermon.title}): file missing -> ${filePath}`);
            skipped += 1;
            continue;
        }
        const fileBuffer = fs_1.default.readFileSync(filePath);
        const objectKey = (0, objectStorage_1.createAudioObjectKey)(path_1.default.basename(filePath));
        await (0, objectStorage_1.uploadAudioObject)({
            key: objectKey,
            body: fileBuffer,
            contentType: getContentType(filePath),
        });
        await prisma_1.prisma.sermon.update({
            where: { id: sermon.id },
            data: { audioUrl: objectKey },
        });
        migrated += 1;
        console.log(`Migrated sermon ${sermon.id} (${sermon.title}) -> ${objectKey}`);
    }
    console.log(`Done. Migrated: ${migrated}, Skipped: ${skipped}`);
};
run()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
