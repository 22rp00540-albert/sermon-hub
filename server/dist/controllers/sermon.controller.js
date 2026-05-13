"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSermonDocument = exports.deleteSermon = exports.updateSermon = exports.viewSermonDocument = exports.uploadSermonDocuments = exports.listSermonDocuments = exports.streamSermonAudio = exports.createSermon = exports.uploadSermonAudio = exports.listSermons = void 0;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const mailer_1 = require("../lib/mailer");
const objectStorage_1 = require("../lib/objectStorage");
const prisma_1 = require("../lib/prisma");
const upload_1 = require("../lib/upload");
const sermonSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    scripture: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    createdDate: zod_1.z.string().min(1),
    preacherId: zod_1.z.number().int().positive(),
});
const resolveStoredPath = (stored) => {
    const sanitized = stored.replace(/\\/g, "/").replace(/^\/+/, "");
    const relative = sanitized.startsWith("uploads/") ? sanitized.slice("uploads/".length) : sanitized;
    return path_1.default.resolve(upload_1.uploadsDir, relative);
};
const toStoredPath = (fileName, folder) => path_1.default.posix.join("uploads", folder, fileName);
const isLocalAudioPath = (value) => /^uploads\/audio\/[^/]+$/i.test(value.replace(/\\/g, "/"));
const isCloudAudioPath = (value) => /^sermons\/audio\/.+/i.test(value.replace(/\\/g, "/"));
const isCloudDocumentPath = (value) => /^sermons\/documents\/.+/i.test(value.replace(/\\/g, "/"));
const isValidStoredAudioPath = (value) => {
    if (typeof value !== "string")
        return false;
    return isLocalAudioPath(value) || isCloudAudioPath(value);
};
const isLocalDocumentPath = (value) => /^uploads\/documents\/[^/]+$/i.test(value.replace(/\\/g, "/"));
const normalizePathSlashes = (value) => value.replace(/\\/g, "/");
const persistUploadedAudio = async (file) => {
    if (file.buffer) {
        if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
            throw new Error("Object storage is not configured. Set S3_* environment variables.");
        }
        const key = (0, objectStorage_1.createAudioObjectKey)(file.originalname);
        await (0, objectStorage_1.uploadAudioObject)({
            key,
            body: file.buffer,
            contentType: file.mimetype,
        });
        return key;
    }
    if (file.filename) {
        return toStoredPath(file.filename, "audio");
    }
    throw new Error("Invalid uploaded audio file");
};
const sanitizeFolderName = (raw) => raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "") || "general";
const getDocumentFolderName = (filePath) => {
    const normalized = normalizePathSlashes(filePath);
    const parts = normalized.split("/");
    const folderIndex = parts.findIndex((part) => part === "documents");
    if (folderIndex >= 0 && parts[folderIndex + 1])
        return parts[folderIndex + 1];
    return "general";
};
const getDocumentContentType = (fileName) => {
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
const persistUploadedDocument = async (file, folderName) => {
    if (file.buffer) {
        if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
            throw new Error("Object storage is not configured. Set S3_* environment variables.");
        }
        const key = (0, objectStorage_1.createDocumentObjectKey)(folderName, file.originalname);
        await (0, objectStorage_1.uploadObject)({
            key,
            body: file.buffer,
            contentType: getDocumentContentType(file.originalname),
            contentDisposition: "inline",
        });
        return key;
    }
    if (file.filename) {
        return toStoredPath(file.filename, "documents");
    }
    throw new Error("Invalid uploaded document file");
};
const getAudioContentType = (filePath) => {
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
const listSermons = async (req, res) => {
    const preacherId = req.query.preacherId ? Number(req.query.preacherId) : undefined;
    const sermons = await prisma_1.prisma.sermon.findMany({
        where: preacherId ? { preacherId } : undefined,
        include: { preacher: true, documents: true },
        orderBy: { createdDate: "desc" },
    });
    res.json(sermons.map((sermon) => ({
        id: sermon.id,
        title: sermon.title,
        scripture: sermon.scripture,
        description: sermon.description,
        createdDate: sermon.createdDate,
        preacher: sermon.preacher,
        audioUrl: sermon.audioUrl,
        audioStreamUrl: `/api/v1/sermons/${sermon.id}/stream`,
        hasDocument: sermon.documents.length > 0,
        documentsCount: sermon.documents.length,
    })));
};
exports.listSermons = listSermons;
const uploadSermonAudio = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: "Audio file is required" });
            return;
        }
        const audioUrl = await persistUploadedAudio(file);
        res.status(201).json({
            message: "Audio uploaded",
            audioUrl,
            originalName: file.originalname,
            streamUrl: null,
        });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Audio upload failed" });
    }
};
exports.uploadSermonAudio = uploadSermonAudio;
const createSermon = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const audioUrlFromBody = isValidStoredAudioPath(req.body.audioUrl)
            ? normalizePathSlashes(req.body.audioUrl)
            : undefined;
        if (!audioUrlFromBody) {
            res.status(400).json({ message: "audioUrl is required. Upload audio first via /sermons/audio." });
            return;
        }
        const data = sermonSchema.parse({
            ...req.body,
            preacherId: Number(req.body.preacherId),
        });
        const sermon = await prisma_1.prisma.sermon.create({
            data: {
                createdDate: new Date(data.createdDate),
                title: data.title,
                scripture: data.scripture,
                description: data.description,
                preacherId: data.preacherId,
                audioUrl: audioUrlFromBody,
                uploadedById: req.user.userId,
            },
            include: { preacher: true },
        });
        const recipients = await prisma_1.prisma.user.findMany({
            where: { status: client_1.UserStatus.APPROVED, role: client_1.Role.MEMBER },
            select: { email: true },
        });
        await (0, mailer_1.sendNewSermonNotification)(recipients.map((u) => u.email), sermon.title);
        res.status(201).json(sermon);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
};
exports.createSermon = createSermon;
const streamSermonAudio = async (req, res) => {
    const sermonId = Number(req.params.id);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    const sermon = await prisma_1.prisma.sermon.findUnique({ where: { id: sermonId } });
    if (!sermon) {
        res.status(404).json({ message: "Sermon not found" });
        return;
    }
    if (isCloudAudioPath(sermon.audioUrl)) {
        if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
            res.status(500).json({ message: "Object storage is not configured" });
            return;
        }
        const signedUrl = await (0, objectStorage_1.getAudioObjectSignedUrl)(sermon.audioUrl);
        res.redirect(302, signedUrl);
        return;
    }
    const filePath = resolveStoredPath(sermon.audioUrl);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ message: "Audio file not found" });
        return;
    }
    const stat = fs_1.default.statSync(filePath);
    const range = req.headers.range;
    const contentType = getAudioContentType(filePath);
    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = Number(startStr);
        const end = endStr ? Number(endStr) : stat.size - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= stat.size || start > end) {
            res.status(416).json({ message: "Invalid range" });
            return;
        }
        const chunkSize = end - start + 1;
        const stream = fs_1.default.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": contentType,
            "Content-Disposition": "inline",
        });
        stream.pipe(res);
        return;
    }
    res.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": stat.size,
        "Content-Type": contentType,
        "Content-Disposition": "inline",
    });
    fs_1.default.createReadStream(filePath).pipe(res);
};
exports.streamSermonAudio = streamSermonAudio;
const listSermonDocuments = async (req, res) => {
    const sermonId = Number(req.params.id);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    const folder = typeof req.query.folder === "string" ? sanitizeFolderName(req.query.folder) : undefined;
    const docs = await prisma_1.prisma.sermonDocument.findMany({
        where: { sermonId },
        orderBy: { createdAt: "asc" },
    });
    const mapped = docs.map((doc) => ({
        ...doc,
        folderName: getDocumentFolderName(doc.filePath),
    }));
    if (folder) {
        res.json(mapped.filter((doc) => doc.folderName === folder));
        return;
    }
    res.json(mapped);
};
exports.listSermonDocuments = listSermonDocuments;
const uploadSermonDocuments = async (req, res) => {
    const sermonId = Number(req.params.id);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    const sermon = await prisma_1.prisma.sermon.findUnique({ where: { id: sermonId } });
    if (!sermon) {
        res.status(404).json({ message: "Sermon not found" });
        return;
    }
    const files = req.files || [];
    if (files.length === 0) {
        res.status(400).json({ message: "No document files uploaded" });
        return;
    }
    const folderName = typeof req.body.folderName === "string" && req.body.folderName.trim() !== ""
        ? sanitizeFolderName(req.body.folderName)
        : "general";
    const storedDocuments = await Promise.all(files.map(async (file) => ({
        sermonId,
        filePath: await persistUploadedDocument(file, folderName),
        originalName: file.originalname,
    })));
    const created = await prisma_1.prisma.sermonDocument.createMany({
        data: storedDocuments,
    });
    const recipients = await prisma_1.prisma.user.findMany({
        where: { status: client_1.UserStatus.APPROVED, role: client_1.Role.MEMBER },
        select: { email: true },
    });
    await (0, mailer_1.sendNewSermonNotification)(recipients.map((u) => u.email), `${sermon.title} (new documents)`);
    res.status(201).json({ message: "Documents uploaded", count: created.count, folderName });
};
exports.uploadSermonDocuments = uploadSermonDocuments;
const viewSermonDocument = async (req, res) => {
    const docId = Number(req.params.documentId);
    if (Number.isNaN(docId)) {
        res.status(400).json({ message: "Invalid document id" });
        return;
    }
    const document = await prisma_1.prisma.sermonDocument.findUnique({ where: { id: docId } });
    if (!document) {
        res.status(404).json({ message: "Document not found" });
        return;
    }
    if (isCloudDocumentPath(document.filePath)) {
        if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
            res.status(500).json({ message: "Object storage is not configured" });
            return;
        }
        const signedUrl = await (0, objectStorage_1.getObjectSignedUrl)(document.filePath, "inline");
        res.redirect(302, signedUrl);
        return;
    }
    const filePath = resolveStoredPath(document.filePath);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ message: "Document file missing" });
        return;
    }
    const ext = path_1.default.extname(filePath).toLowerCase();
    const contentType = ext === ".pdf"
        ? "application/pdf"
        : ext === ".docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    fs_1.default.createReadStream(filePath).pipe(res);
};
exports.viewSermonDocument = viewSermonDocument;
const updateSermon = async (req, res) => {
    const sermonId = Number(req.params.id);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    try {
        const audioFile = req.file;
        const existing = await prisma_1.prisma.sermon.findUnique({ where: { id: sermonId } });
        if (!existing) {
            res.status(404).json({ message: "Sermon not found" });
            return;
        }
        const data = sermonSchema.partial().parse({
            ...req.body,
            preacherId: req.body.preacherId ? Number(req.body.preacherId) : undefined,
        });
        const updated = await prisma_1.prisma.sermon.update({
            where: { id: sermonId },
            data: {
                title: data.title,
                scripture: data.scripture,
                description: data.description,
                preacherId: data.preacherId,
                createdDate: data.createdDate ? new Date(data.createdDate) : undefined,
                audioUrl: audioFile ? await persistUploadedAudio(audioFile) : undefined,
            },
            include: { preacher: true },
        });
        if (audioFile) {
            if (isCloudAudioPath(existing.audioUrl) && (0, objectStorage_1.isObjectStorageConfigured)()) {
                await (0, objectStorage_1.deleteAudioObject)(existing.audioUrl);
            }
            else {
                const previousAudioPath = resolveStoredPath(existing.audioUrl);
                if (fs_1.default.existsSync(previousAudioPath))
                    fs_1.default.unlinkSync(previousAudioPath);
            }
        }
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
};
exports.updateSermon = updateSermon;
const deleteSermon = async (req, res) => {
    const sermonId = Number(req.params.id);
    if (Number.isNaN(sermonId)) {
        res.status(400).json({ message: "Invalid sermon id" });
        return;
    }
    const sermon = await prisma_1.prisma.sermon.findUnique({
        where: { id: sermonId },
        include: { documents: true },
    });
    if (!sermon) {
        res.status(404).json({ message: "Sermon not found" });
        return;
    }
    if (isCloudAudioPath(sermon.audioUrl) && (0, objectStorage_1.isObjectStorageConfigured)()) {
        await (0, objectStorage_1.deleteAudioObject)(sermon.audioUrl);
    }
    else {
        const audioPath = resolveStoredPath(sermon.audioUrl);
        if (fs_1.default.existsSync(audioPath))
            fs_1.default.unlinkSync(audioPath);
    }
    for (const doc of sermon.documents) {
        if (isCloudDocumentPath(doc.filePath) && (0, objectStorage_1.isObjectStorageConfigured)()) {
            await (0, objectStorage_1.deleteObject)(doc.filePath);
        }
        else if (isLocalDocumentPath(doc.filePath)) {
            const docPath = resolveStoredPath(doc.filePath);
            if (fs_1.default.existsSync(docPath))
                fs_1.default.unlinkSync(docPath);
        }
    }
    await prisma_1.prisma.sermon.delete({ where: { id: sermonId } });
    res.json({ message: "Sermon deleted", sermonId });
};
exports.deleteSermon = deleteSermon;
const deleteSermonDocument = async (req, res) => {
    const sermonId = Number(req.params.id);
    const docId = Number(req.params.documentId);
    if (Number.isNaN(sermonId) || Number.isNaN(docId)) {
        res.status(400).json({ message: "Invalid ids" });
        return;
    }
    const document = await prisma_1.prisma.sermonDocument.findFirst({
        where: { id: docId, sermonId },
    });
    if (!document) {
        res.status(404).json({ message: "Document not found" });
        return;
    }
    if (isCloudDocumentPath(document.filePath) && (0, objectStorage_1.isObjectStorageConfigured)()) {
        await (0, objectStorage_1.deleteObject)(document.filePath);
    }
    else {
        const filePath = resolveStoredPath(document.filePath);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
    }
    await prisma_1.prisma.sermonDocument.delete({ where: { id: docId } });
    res.json({ message: "Document deleted", documentId: docId });
};
exports.deleteSermonDocument = deleteSermonDocument;
