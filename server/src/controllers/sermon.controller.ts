import { Role, UserStatus } from "@prisma/client";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { sendApprovedMembersLibraryUploadEmail } from "../lib/mailer";
import {
  createAudioObjectKey,
  createDocumentObjectKey,
  deleteAudioObject,
  deleteObject,
  getAudioObjectSignedUrl,
  getObjectSignedUrl,
  isObjectStorageConfigured,
  uploadAudioObject,
  uploadObject,
} from "../lib/objectStorage";
import { prisma } from "../lib/prisma";
import { uploadsDir } from "../lib/upload";

const sermonSchema = z.object({
  title: z.string().min(2),
  scripture: z.string().min(2),
  description: z.string().optional(),
  createdDate: z.string().min(1),
  preacherId: z.number().int().positive(),
});

const resolveStoredPath = (stored: string) => {
  const sanitized = stored.replace(/\\/g, "/").replace(/^\/+/, "");
  const relative = sanitized.startsWith("uploads/") ? sanitized.slice("uploads/".length) : sanitized;
  return path.resolve(uploadsDir, relative);
};

const toStoredPath = (fileName: string, folder: "audio" | "documents") =>
  path.posix.join("uploads", folder, fileName);

const isLocalAudioPath = (value: string) => /^uploads\/audio\/[^/]+$/i.test(value.replace(/\\/g, "/"));
const isCloudAudioPath = (value: string) => /^sermons\/audio\/.+/i.test(value.replace(/\\/g, "/"));
const isCloudDocumentPath = (value: string) => /^sermons\/documents\/.+/i.test(value.replace(/\\/g, "/"));

const isValidStoredAudioPath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return isLocalAudioPath(value) || isCloudAudioPath(value);
};

const isLocalDocumentPath = (value: string) => /^uploads\/documents\/[^/]+$/i.test(value.replace(/\\/g, "/"));

const normalizePathSlashes = (value: string) => value.replace(/\\/g, "/");

const persistUploadedAudio = async (file: Express.Multer.File) => {
  if (file.buffer) {
    if (!isObjectStorageConfigured()) {
      throw new Error(
        "Object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT on Render (or in server/.env locally).",
      );
    }
    const key = createAudioObjectKey(file.originalname);
    await uploadAudioObject({
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

const sanitizeFolderName = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "") || "general";

const getDocumentFolderName = (filePath: string) => {
  const normalized = normalizePathSlashes(filePath);
  const parts = normalized.split("/");
  const folderIndex = parts.findIndex((part) => part === "documents");
  if (folderIndex >= 0 && parts[folderIndex + 1]) return parts[folderIndex + 1];
  return "general";
};

const getDocumentContentType = (fileName: string) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
};

const persistUploadedDocument = async (file: Express.Multer.File, folderName: string) => {
  if (file.buffer) {
    if (!isObjectStorageConfigured()) {
      throw new Error(
        "Object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT on Render (or in server/.env locally).",
      );
    }
    const key = createDocumentObjectKey(folderName, file.originalname);
    await uploadObject({
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
const getAudioContentType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".aac") return "audio/aac";
  if (ext === ".webm") return "audio/webm";
  if (ext === ".flac") return "audio/flac";
  return "audio/mpeg";
};

export const listSermons = async (req: Request, res: Response) => {
  const preacherId = req.query.preacherId ? Number(req.query.preacherId) : undefined;

  const sermons = await prisma.sermon.findMany({
    where: preacherId ? { preacherId } : undefined,
    include: { preacher: true, documents: true },
    orderBy: { createdDate: "desc" },
  });

  res.json(
    sermons.map((sermon) => ({
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
    })),
  );
};

export const uploadSermonAudio = async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Audio upload failed" });
  }
};

export const createSermon = async (req: Request, res: Response) => {
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

    const sermon = await prisma.sermon.create({
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

    const recipients = await prisma.user.findMany({
      where: { status: UserStatus.APPROVED, role: Role.MEMBER },
      select: { email: true },
    });
    await sendApprovedMembersLibraryUploadEmail(recipients.map((u) => u.email), "audio", sermon.title);

    res.status(201).json(sermon);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
  }
};

export const streamSermonAudio = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  const sermon = await prisma.sermon.findUnique({ where: { id: sermonId } });
  if (!sermon) {
    res.status(404).json({ message: "Sermon not found" });
    return;
  }

  if (isCloudAudioPath(sermon.audioUrl)) {
    if (!isObjectStorageConfigured()) {
      res.status(500).json({ message: "Object storage is not configured" });
      return;
    }
    const signedUrl = await getAudioObjectSignedUrl(sermon.audioUrl);
    res.redirect(302, signedUrl);
    return;
  }

  const filePath = resolveStoredPath(sermon.audioUrl);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: "Audio file not found" });
    return;
  }

  const stat = fs.statSync(filePath);
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
    const stream = fs.createReadStream(filePath, { start, end });
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
  fs.createReadStream(filePath).pipe(res);
};

export const listSermonDocuments = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  const folder = typeof req.query.folder === "string" ? sanitizeFolderName(req.query.folder) : undefined;
  const docs = await prisma.sermonDocument.findMany({
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

export const uploadSermonDocuments = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  const sermon = await prisma.sermon.findUnique({ where: { id: sermonId } });
  if (!sermon) {
    res.status(404).json({ message: "Sermon not found" });
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    res.status(400).json({ message: "No document files uploaded" });
    return;
  }

  const folderName =
    typeof req.body.folderName === "string" && req.body.folderName.trim() !== ""
      ? sanitizeFolderName(req.body.folderName)
      : "general";

  const storedDocuments = await Promise.all(
    files.map(async (file) => ({
      sermonId,
      filePath: await persistUploadedDocument(file, folderName),
      originalName: file.originalname,
    })),
  );

  const created = await prisma.sermonDocument.createMany({
    data: storedDocuments,
  });

  const recipients = await prisma.user.findMany({
    where: { status: UserStatus.APPROVED, role: Role.MEMBER },
    select: { email: true },
  });
  await sendApprovedMembersLibraryUploadEmail(recipients.map((u) => u.email), "documents", sermon.title);

  res.status(201).json({ message: "Documents uploaded", count: created.count, folderName });
};

export const viewSermonDocument = async (req: Request, res: Response) => {
  const docId = Number(req.params.documentId);
  if (Number.isNaN(docId)) {
    res.status(400).json({ message: "Invalid document id" });
    return;
  }

  const document = await prisma.sermonDocument.findUnique({ where: { id: docId } });
  if (!document) {
    res.status(404).json({ message: "Document not found" });
    return;
  }

  if (isCloudDocumentPath(document.filePath)) {
    if (!isObjectStorageConfigured()) {
      res.status(500).json({ message: "Object storage is not configured" });
      return;
    }
    const signedUrl = await getObjectSignedUrl(document.filePath, "inline");
    res.redirect(302, signedUrl);
    return;
  }

  const filePath = resolveStoredPath(document.filePath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: "Document file missing" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", "inline");
  fs.createReadStream(filePath).pipe(res);
};

export const updateSermon = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  try {
    const audioFile = req.file;
    const existing = await prisma.sermon.findUnique({ where: { id: sermonId } });
    if (!existing) {
      res.status(404).json({ message: "Sermon not found" });
      return;
    }

    const data = sermonSchema.partial().parse({
      ...req.body,
      preacherId: req.body.preacherId ? Number(req.body.preacherId) : undefined,
    });

    const updated = await prisma.sermon.update({
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
      if (isCloudAudioPath(existing.audioUrl) && isObjectStorageConfigured()) {
        await deleteAudioObject(existing.audioUrl);
      } else {
        const previousAudioPath = resolveStoredPath(existing.audioUrl);
        if (fs.existsSync(previousAudioPath)) fs.unlinkSync(previousAudioPath);
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
  }
};

export const deleteSermon = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  const sermon = await prisma.sermon.findUnique({
    where: { id: sermonId },
    include: { documents: true },
  });
  if (!sermon) {
    res.status(404).json({ message: "Sermon not found" });
    return;
  }

  if (isCloudAudioPath(sermon.audioUrl) && isObjectStorageConfigured()) {
    await deleteAudioObject(sermon.audioUrl);
  } else {
    const audioPath = resolveStoredPath(sermon.audioUrl);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }

  for (const doc of sermon.documents) {
    if (isCloudDocumentPath(doc.filePath) && isObjectStorageConfigured()) {
      await deleteObject(doc.filePath);
    } else if (isLocalDocumentPath(doc.filePath)) {
      const docPath = resolveStoredPath(doc.filePath);
      if (fs.existsSync(docPath)) fs.unlinkSync(docPath);
    }
  }

  await prisma.sermon.delete({ where: { id: sermonId } });
  res.json({ message: "Sermon deleted", sermonId });
};

export const deleteSermonDocument = async (req: Request, res: Response) => {
  const sermonId = Number(req.params.id);
  const docId = Number(req.params.documentId);
  if (Number.isNaN(sermonId) || Number.isNaN(docId)) {
    res.status(400).json({ message: "Invalid ids" });
    return;
  }

  const document = await prisma.sermonDocument.findFirst({
    where: { id: docId, sermonId },
  });
  if (!document) {
    res.status(404).json({ message: "Document not found" });
    return;
  }

  if (isCloudDocumentPath(document.filePath) && isObjectStorageConfigured()) {
    await deleteObject(document.filePath);
  } else {
    const filePath = resolveStoredPath(document.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await prisma.sermonDocument.delete({ where: { id: docId } });
  res.json({ message: "Document deleted", documentId: docId });
};
