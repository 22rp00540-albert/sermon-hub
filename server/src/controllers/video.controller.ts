import { Prisma, Role, UserStatus } from "@prisma/client";
import { Request, Response } from "express";
import fs from "fs";
import { z } from "zod";
import { sendApprovedMembersLibraryUploadEmail } from "../lib/mailer";
import {
  createVideoObjectKey,
  deleteObject,
  getObjectSignedUrl,
  isObjectStorageConfigured,
  uploadObject,
} from "../lib/objectStorage";
import { getMemberVideoSermonsEnabled } from "../lib/appSettings";
import { prisma } from "../lib/prisma";
import { publicServerErrorMessage } from "../lib/publicErrorMessage";

const videoSermonSchema = z.object({
  title: z.string().min(2),
  scripture: z.string().min(2),
  description: z.string().optional(),
  createdDate: z.string().min(1),
  preacherId: z.number().int().positive(),
});

const isCloudVideoPath = (value: string) => /^sermons\/video\/.+/i.test(value.replace(/\\/g, "/"));

const isValidStoredVideoPath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return isCloudVideoPath(value);
};

const persistUploadedVideo = async (file: Express.Multer.File) => {
  if (!isObjectStorageConfigured()) {
    throw new Error("Object storage is not configured. Set S3_* environment variables.");
  }
  const key = createVideoObjectKey(file.originalname);
  const contentType = file.mimetype || "video/mp4";

  if (file.buffer) {
    await uploadObject({
      key,
      body: file.buffer,
      contentType,
    });
    return key;
  }

  if (file.path) {
    try {
      await uploadObject({
        key,
        body: fs.createReadStream(file.path),
        contentType,
      });
      return key;
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }

  throw new Error("Invalid uploaded video file");
};

/** Runtime guard: old Prisma client (before `prisma generate`) has no `videoSermon` delegate. */
const videoSermonDb = (res: Response) => {
  const db = (prisma as unknown as { videoSermon?: typeof prisma.videoSermon }).videoSermon;
  if (!db) {
    res.status(503).json({ message: "Service unavailable." });
    return null;
  }
  return db;
};

export const listVideoSermons = async (req: Request, res: Response) => {
  const raw = req.query.preacherId;
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  const preacherId = Number.isInteger(n) && n > 0 ? n : undefined;
  const db = videoSermonDb(res);
  if (!db) return;
  try {
    if (req.user?.role === Role.MEMBER && !(await getMemberVideoSermonsEnabled())) {
      res.json([]);
      return;
    }

    const videos = await db.findMany({
      where: preacherId ? { preacherId } : undefined,
      include: { preacher: true },
      orderBy: { createdDate: "desc" },
    });

    res.json(
      videos.map((video) => ({
        id: video.id,
        title: video.title,
        scripture: video.scripture,
        description: video.description,
        createdDate: video.createdDate,
        preacher: video.preacher,
        videoUrl: video.videoUrl,
        videoStreamUrl: `/api/v1/videos/${video.id}/stream`,
      })),
    );
  } catch (e) {
    console.error(e);
    res.status(503).json({ message: "Service unavailable." });
  }
};

export const uploadVideoFile = async (req: Request, res: Response) => {
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
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Video upload failed";
    res.status(400).json({ message: publicServerErrorMessage(raw) });
  }
};

export const createVideoSermon = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const db = videoSermonDb(res);
    if (!db) return;

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

    if (await getMemberVideoSermonsEnabled()) {
      const recipients = await prisma.user.findMany({
        where: { status: UserStatus.APPROVED, role: Role.MEMBER },
        select: { email: true },
      });
      await sendApprovedMembersLibraryUploadEmail(recipients.map((u) => u.email), "video", video.title);
    }

    res.status(201).json(video);
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "";
    const lower = msg.toLowerCase();
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P1003")) ||
      (lower.includes("does not exist") && lower.includes("table"))
    ) {
      res.status(503).json({ message: publicServerErrorMessage(msg || "database") });
      return;
    }
    const raw = error instanceof Error ? error.message : "Invalid request";
    res.status(400).json({ message: publicServerErrorMessage(raw) });
  }
};

export const streamVideoSermon = async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  if (Number.isNaN(videoId)) {
    res.status(400).json({ message: "Invalid video id" });
    return;
  }

  const db = videoSermonDb(res);
  if (!db) return;

  try {
    const video = await db.findUnique({ where: { id: videoId } });
    if (!video) {
      res.status(404).json({ message: "Video sermon not found" });
      return;
    }

    if (req.user?.role === Role.MEMBER && !(await getMemberVideoSermonsEnabled())) {
      res.status(403).json({ message: "Video sermons are not available for members right now." });
      return;
    }

    if (!isObjectStorageConfigured()) {
      res.status(500).json({ message: "Object storage is not configured" });
      return;
    }

    const signedUrl = await getObjectSignedUrl(video.videoUrl, "inline");
    res.redirect(302, signedUrl);
  } catch (e) {
    console.error(e);
    res.status(503).json({ message: "Service unavailable." });
  }
};

export const updateVideoSermon = async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  if (Number.isNaN(videoId)) {
    res.status(400).json({ message: "Invalid video id" });
    return;
  }

  try {
    const db = videoSermonDb(res);
    if (!db) return;

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
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Invalid request";
    res.status(400).json({ message: publicServerErrorMessage(raw) });
  }
};

export const deleteVideoSermon = async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  if (Number.isNaN(videoId)) {
    res.status(400).json({ message: "Invalid video id" });
    return;
  }

  const db = videoSermonDb(res);
  if (!db) return;

  try {
    const video = await db.findUnique({ where: { id: videoId } });
    if (!video) {
      res.status(404).json({ message: "Video sermon not found" });
      return;
    }

    if (isObjectStorageConfigured()) {
      await deleteObject(video.videoUrl);
    }

    await db.delete({ where: { id: videoId } });
    res.json({ message: "Video sermon deleted", videoId });
  } catch (e) {
    console.error(e);
    res.status(503).json({ message: "Service unavailable." });
  }
};
