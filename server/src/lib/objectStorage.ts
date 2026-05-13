import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "stream";

const s3Bucket = process.env.S3_BUCKET || "";
const s3Region = process.env.S3_REGION || "auto";
const s3Endpoint = process.env.S3_ENDPOINT || undefined;
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || "";
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
const signedUrlExpirySeconds = Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 3600);
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

let s3Client: S3Client | null = null;

const createClient = () =>
  new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    },
  });

const getClient = () => {
  if (!s3Client) {
    s3Client = createClient();
  }
  return s3Client;
};

const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "");

export const isObjectStorageConfigured = () =>
  Boolean(s3Bucket && s3AccessKeyId && s3SecretAccessKey && (s3Endpoint || s3Region));

export const createAudioObjectKey = (originalName: string) => {
  const safeName = sanitizeFileName(originalName || "audio");
  return `sermons/audio/${Date.now()}-${randomUUID()}-${safeName}`;
};

export const createVideoObjectKey = (originalName: string) => {
  const safeName = sanitizeFileName(originalName || "video");
  return `sermons/video/${Date.now()}-${randomUUID()}-${safeName}`;
};

export const createDocumentObjectKey = (folderName: string, originalName: string) => {
  const safeFolder = sanitizeFileName(folderName || "general").toLowerCase() || "general";
  const safeName = sanitizeFileName(originalName || "document");
  return `sermons/documents/${safeFolder}/${Date.now()}-${randomUUID()}-${safeName}`;
};

export const uploadAudioObject = async (params: {
  key: string;
  body: Buffer;
  contentType?: string;
}) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType || "audio/mpeg",
    }),
  );
};

export const uploadObject = async (params: {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  contentDisposition?: string;
}) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ContentDisposition: params.contentDisposition,
    }),
  );
};

export const deleteAudioObject = async (key: string) => {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    }),
  );
};

export const getAudioObjectSignedUrl = async (key: string) =>
  getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    }),
    { expiresIn: signedUrlExpirySeconds },
  );

export const getObjectSignedUrl = async (key: string, contentDisposition: "inline" | "attachment" = "inline") =>
  getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition,
    }),
    { expiresIn: signedUrlExpirySeconds },
  );

export const deleteObject = async (key: string) => {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    }),
  );
};
