"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVideoSermon = exports.updateVideoSermon = exports.streamVideoSermon = exports.createVideoSermon = exports.uploadVideoFile = exports.listVideoSermons = void 0;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const mailer_1 = require("../lib/mailer");
const objectStorage_1 = require("../lib/objectStorage");
const appSettings_1 = require("../lib/appSettings");
const prisma_1 = require("../lib/prisma");
const publicErrorMessage_1 = require("../lib/publicErrorMessage");
const videoSermonSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    scripture: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    createdDate: zod_1.z.string().min(1),
    preacherId: zod_1.z.number().int().positive(),
});
const isCloudVideoPath = (value) => /^sermons\/video\/.+/i.test(value.replace(/\\/g, "/"));
const isValidStoredVideoPath = (value) => {
    if (typeof value !== "string")
        return false;
    return isCloudVideoPath(value);
};
const persistUploadedVideo = async (file) => {
    if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
        throw new Error("Object storage is not configured. Set S3_* environment variables.");
    }
    const key = (0, objectStorage_1.createVideoObjectKey)(file.originalname);
    const contentType = file.mimetype || "video/mp4";
    if (file.buffer) {
        await (0, objectStorage_1.uploadObject)({
            key,
            body: file.buffer,
            contentType,
        });
        return key;
    }
    if (file.path) {
        try {
            await (0, objectStorage_1.uploadObject)({
                key,
                body: fs_1.default.createReadStream(file.path),
                contentType,
            });
            return key;
        }
        finally {
            if (fs_1.default.existsSync(file.path)) {
                fs_1.default.unlinkSync(file.path);
            }
        }
    }
    throw new Error("Invalid uploaded video file");
};
/** Runtime guard: old Prisma client (before `prisma generate`) has no `videoSermon` delegate. */
const videoSermonDb = (res) => {
    const db = prisma_1.prisma.videoSermon;
    if (!db) {
        res.status(503).json({ message: "Service unavailable." });
        return null;
    }
    return db;
};
const listVideoSermons = async (req, res) => {
    const raw = req.query.preacherId;
    const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    const preacherId = Number.isInteger(n) && n > 0 ? n : undefined;
    const db = videoSermonDb(res);
    if (!db)
        return;
    try {
        if (req.user?.role === client_1.Role.MEMBER && !(await (0, appSettings_1.getMemberVideoSermonsEnabled)())) {
            res.json([]);
            return;
        }
        const videos = await db.findMany({
            where: preacherId ? { preacherId } : undefined,
            include: { preacher: true },
            orderBy: { createdDate: "desc" },
        });
        res.json(videos.map((video) => ({
            id: video.id,
            title: video.title,
            scripture: video.scripture,
            description: video.description,
            createdDate: video.createdDate,
            preacher: video.preacher,
            videoUrl: video.videoUrl,
            videoStreamUrl: `/api/v1/videos/${video.id}/stream`,
        })));
    }
    catch (e) {
        console.error(e);
        res.status(503).json({ message: "Service unavailable." });
    }
};
exports.listVideoSermons = listVideoSermons;
const uploadVideoFile = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ message: "Video file is required" });
            return;
        }
        const videoUrl = await persistUploadedVideo(file);
        res.status(201).json({
            message: "Video uploaded",
            videoUrl,
            originalName: file.originalname,
        });
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : "Video upload failed";
        res.status(400).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
    }
};
exports.uploadVideoFile = uploadVideoFile;
const createVideoSermon = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const db = videoSermonDb(res);
        if (!db)
            return;
        if (!isValidStoredVideoPath(req.body.videoUrl)) {
            res.status(400).json({ message: "videoUrl is required. Upload video first via /videos/upload." });
            return;
        }
        const data = videoSermonSchema.parse({
            ...req.body,
            preacherId: Number(req.body.preacherId),
        });
        const video = await db.create({
            data: {
                title: data.title,
                scripture: data.scripture,
                description: data.description,
                createdDate: new Date(data.createdDate),
                preacherId: data.preacherId,
                uploadedById: req.user.userId,
                videoUrl: req.body.videoUrl,
            },
            include: { preacher: true },
        });
        if (await (0, appSettings_1.getMemberVideoSermonsEnabled)()) {
            const recipients = await prisma_1.prisma.user.findMany({
                where: { status: client_1.UserStatus.APPROVED, role: client_1.Role.MEMBER },
                select: { email: true },
            });
            await (0, mailer_1.sendApprovedMembersLibraryUploadEmail)(recipients.map((u) => u.email), "video", video.title);
        }
        res.status(201).json(video);
    }
    catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : "";
        const lower = msg.toLowerCase();
        if ((error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            (error.code === "P2021" || error.code === "P1003")) ||
            (lower.includes("does not exist") && lower.includes("table"))) {
            res.status(503).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(msg || "database") });
            return;
        }
        const raw = error instanceof Error ? error.message : "Invalid request";
        res.status(400).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
    }
};
exports.createVideoSermon = createVideoSermon;
const streamVideoSermon = async (req, res) => {
    const videoId = Number(req.params.id);
    if (Number.isNaN(videoId)) {
        res.status(400).json({ message: "Invalid video id" });
        return;
    }
    const db = videoSermonDb(res);
    if (!db)
        return;
    try {
        const video = await db.findUnique({ where: { id: videoId } });
        if (!video) {
            res.status(404).json({ message: "Video sermon not found" });
            return;
        }
        if (req.user?.role === client_1.Role.MEMBER && !(await (0, appSettings_1.getMemberVideoSermonsEnabled)())) {
            res.status(403).json({ message: "Video sermons are not available for members right now." });
            return;
        }
        if (!(0, objectStorage_1.isObjectStorageConfigured)()) {
            res.status(500).json({ message: "Object storage is not configured" });
            return;
        }
        const signedUrl = await (0, objectStorage_1.getObjectSignedUrl)(video.videoUrl, "inline");
        res.redirect(302, signedUrl);
    }
    catch (e) {
        console.error(e);
        res.status(503).json({ message: "Service unavailable." });
    }
};
exports.streamVideoSermon = streamVideoSermon;
const updateVideoSermon = async (req, res) => {
    const videoId = Number(req.params.id);
    if (Number.isNaN(videoId)) {
        res.status(400).json({ message: "Invalid video id" });
        return;
    }
    try {
        const db = videoSermonDb(res);
        if (!db)
            return;
        const existing = await db.findUnique({ where: { id: videoId } });
        if (!existing) {
            res.status(404).json({ message: "Video sermon not found" });
            return;
        }
        const data = videoSermonSchema.partial().parse({
            ...req.body,
            preacherId: req.body.preacherId ? Number(req.body.preacherId) : undefined,
        });
        const updated = await db.update({
            where: { id: videoId },
            data: {
                title: data.title,
                scripture: data.scripture,
                description: data.description,
                preacherId: data.preacherId,
                createdDate: data.createdDate ? new Date(data.createdDate) : undefined,
            },
            include: { preacher: true },
        });
        res.json(updated);
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : "Invalid request";
        res.status(400).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
    }
};
exports.updateVideoSermon = updateVideoSermon;
const deleteVideoSermon = async (req, res) => {
    const videoId = Number(req.params.id);
    if (Number.isNaN(videoId)) {
        res.status(400).json({ message: "Invalid video id" });
        return;
    }
    const db = videoSermonDb(res);
    if (!db)
        return;
    try {
        const video = await db.findUnique({ where: { id: videoId } });
        if (!video) {
            res.status(404).json({ message: "Video sermon not found" });
            return;
        }
        if ((0, objectStorage_1.isObjectStorageConfigured)()) {
            await (0, objectStorage_1.deleteObject)(video.videoUrl);
        }
        await db.delete({ where: { id: videoId } });
        res.json({ message: "Video sermon deleted", videoId });
    }
    catch (e) {
        console.error(e);
        res.status(503).json({ message: "Service unavailable." });
    }
};
exports.deleteVideoSermon = deleteVideoSermon;
