import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  createDocumentObjectKey,
  isObjectStorageConfigured,
  uploadObject,
} from "../lib/objectStorage";
import { prisma } from "../lib/prisma";
import { uploadsDir } from "../lib/upload";

const localDocumentPattern = /^uploads\/documents\/.+/i;

const normalize = (value: string) => value.replace(/\\/g, "/");

const getFolderFromStoredPath = (storedPath: string) => {
  const parts = normalize(storedPath).split("/");
  const folderIndex = parts.findIndex((part) => part === "documents");
  if (folderIndex >= 0 && parts[folderIndex + 1]) return parts[folderIndex + 1];
  return "general";
};

const resolveLocalPath = (storedPath: string) => {
  const normalized = normalize(storedPath).replace(/^\/+/, "");
  const relative = normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
  return path.resolve(uploadsDir, relative);
};

const getContentType = (fileName: string) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
};

const run = async () => {
  if (!isObjectStorageConfigured()) {
    throw new Error("Object storage is not configured. Set S3_* environment variables in server/.env");
  }

  const docs = await (prisma as any).sermonDocument.findMany({
    select: { id: true, filePath: true, originalName: true },
  });

  const localDocs = (docs as any[]).filter((d) => localDocumentPattern.test(normalize(d.filePath)));
  if (localDocs.length === 0) {
    console.log("No local document records found. Nothing to migrate.");
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of localDocs) {
    const filePath = resolveLocalPath(doc.filePath);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping document ${doc.id}: file missing -> ${filePath}`);
      skipped += 1;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const folderName = getFolderFromStoredPath(doc.filePath);
    const objectKey = createDocumentObjectKey(folderName, doc.originalName || path.basename(filePath));
    await uploadObject({
      key: objectKey,
      body: fileBuffer,
      contentType: getContentType(filePath),
      contentDisposition: "inline",
    });

    await (prisma as any).sermonDocument.update({
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
    await prisma.$disconnect();
  });
