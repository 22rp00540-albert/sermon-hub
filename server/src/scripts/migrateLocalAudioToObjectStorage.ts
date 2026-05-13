import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  createAudioObjectKey,
  isObjectStorageConfigured,
  uploadAudioObject,
} from "../lib/objectStorage";
import { prisma } from "../lib/prisma";
import { uploadsDir } from "../lib/upload";

const localAudioPattern = /^uploads\/(audio\/)?[^/]+$/i;

const normalize = (value: string) => value.replace(/\\/g, "/");

const resolveLocalPath = (storedPath: string) => {
  const normalized = normalize(storedPath).replace(/^\/+/, "");
  const relative = normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
  return path.resolve(uploadsDir, relative);
};

const getContentType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".aac") return "audio/aac";
  if (ext === ".webm") return "audio/webm";
  if (ext === ".flac") return "audio/flac";
  return "audio/mpeg";
};

const run = async () => {
  if (!isObjectStorageConfigured()) {
    throw new Error("Object storage is not configured. Set S3_* environment variables in server/.env");
  }

  const sermons = await prisma.sermon.findMany({
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
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping sermon ${sermon.id} (${sermon.title}): file missing -> ${filePath}`);
      skipped += 1;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const objectKey = createAudioObjectKey(path.basename(filePath));
    await uploadAudioObject({
      key: objectKey,
      body: fileBuffer,
      contentType: getContentType(filePath),
    });

    await prisma.sermon.update({
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
    await prisma.$disconnect();
  });
