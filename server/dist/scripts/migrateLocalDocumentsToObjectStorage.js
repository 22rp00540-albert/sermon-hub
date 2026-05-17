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
const localDocumentPattern = /^uploads\/documents\/.+/i;
const normalize = (value) => value.replace(/\\/g, "/");
const getFolderFromStoredPath = (storedPath) => {
    const parts = normalize(storedPath).split("/");
    const folderIndex = parts.findIndex((part) => part === "documents");
    if (folderIndex >= 0 && parts[folderIndex + 1])
        return parts[folderIndex + 1];
    return "general";
};
const resolveLocalPath = (storedPath) => {
    const normalized = normalize(storedPath).replace(/^\/+/, "");
    const relative = normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
    return path_1.default.resolve(upload_1.uploadsDir, relative);
};
const getContentType = (fileName) => {
    const ext = path_1.default.extname(fileName).toLowerCase();
    if (ext === ".pdf")
        return "application/pdf";
    if (ext === ".docx")
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === ".doc")
        return "application/msword";
    if (ext === ".ppt")
        return "application/vnd.ms-powerpoint";
    if (ext === ".pptx")
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (ext === ".txt")
        return "text/plain";
    return "application/octet-stream";
};
const run = async () => {
    if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
        throw new Error("Object storage is not configured. Set S3_* environment variables in server/.env");
    }
    const docs = await prisma_1.prisma.sermonDocument.findMany({
        select: { id: true, filePath: true, originalName: true },
    });
    const localDocs = docs.filter((d) => localDocumentPattern.test(normalize(d.filePath)));
    if (localDocs.length === 0) {
        console.log("No local document records found. Nothing to migrate.");
        return;
    }
    let migrated = 0;
    let skipped = 0;
    for (const doc of localDocs) {
        const filePath = resolveLocalPath(doc.filePath);
        if (!fs_1.default.existsSync(filePath)) {
            console.warn(`Skipping document ${doc.id}: file missing -> ${filePath}`);
            skipped += 1;
            continue;
        }
        const fileBuffer = fs_1.default.readFileSync(filePath);
        const folderName = getFolderFromStoredPath(doc.filePath);
        const objectKey = (0, objectStorage_1.createDocumentObjectKey)(folderName, doc.originalName || path_1.default.basename(filePath));
        await (0, objectStorage_1.uploadObject)({
            key: objectKey,
            body: fileBuffer,
            contentType: getContentType(filePath),
            contentDisposition: "inline",
        });
        await prisma_1.prisma.sermonDocument.update({
            where: { id: doc.id },
            data: { filePath: objectKey },
        });
        migrated += 1;
        console.log(`Migrated document ${doc.id} -> ${objectKey}`);
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
