"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteObject = exports.getObjectSignedUrl = exports.getAudioObjectSignedUrl = exports.deleteAudioObject = exports.uploadObject = exports.uploadAudioObject = exports.createDocumentObjectKey = exports.createAudioObjectKey = exports.isObjectStorageConfigured = void 0;
const crypto_1 = require("crypto");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3Bucket = process.env.S3_BUCKET || "";
const s3Region = process.env.S3_REGION || "auto";
const s3Endpoint = process.env.S3_ENDPOINT || undefined;
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || "";
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
const signedUrlExpirySeconds = Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 3600);
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
let s3Client = null;
const createClient = () => new client_s3_1.S3Client({
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
const sanitizeFileName = (name) => name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "");
const isObjectStorageConfigured = () => Boolean(s3Bucket && s3AccessKeyId && s3SecretAccessKey && (s3Endpoint || s3Region));
exports.isObjectStorageConfigured = isObjectStorageConfigured;
const createAudioObjectKey = (originalName) => {
    const safeName = sanitizeFileName(originalName || "audio");
    return `sermons/audio/${Date.now()}-${(0, crypto_1.randomUUID)()}-${safeName}`;
};
exports.createAudioObjectKey = createAudioObjectKey;
const createDocumentObjectKey = (folderName, originalName) => {
    const safeFolder = sanitizeFileName(folderName || "general").toLowerCase() || "general";
    const safeName = sanitizeFileName(originalName || "document");
    return `sermons/documents/${safeFolder}/${Date.now()}-${(0, crypto_1.randomUUID)()}-${safeName}`;
};
exports.createDocumentObjectKey = createDocumentObjectKey;
const uploadAudioObject = async (params) => {
    await getClient().send(new client_s3_1.PutObjectCommand({
        Bucket: s3Bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType || "audio/mpeg",
    }));
};
exports.uploadAudioObject = uploadAudioObject;
const uploadObject = async (params) => {
    await getClient().send(new client_s3_1.PutObjectCommand({
        Bucket: s3Bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ContentDisposition: params.contentDisposition,
    }));
};
exports.uploadObject = uploadObject;
const deleteAudioObject = async (key) => {
    await getClient().send(new client_s3_1.DeleteObjectCommand({
        Bucket: s3Bucket,
        Key: key,
    }));
};
exports.deleteAudioObject = deleteAudioObject;
const getAudioObjectSignedUrl = async (key) => (0, s3_request_presigner_1.getSignedUrl)(getClient(), new client_s3_1.GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
}), { expiresIn: signedUrlExpirySeconds });
exports.getAudioObjectSignedUrl = getAudioObjectSignedUrl;
const getObjectSignedUrl = async (key, contentDisposition = "inline") => (0, s3_request_presigner_1.getSignedUrl)(getClient(), new client_s3_1.GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ResponseContentDisposition: contentDisposition,
}), { expiresIn: signedUrlExpirySeconds });
exports.getObjectSignedUrl = getObjectSignedUrl;
const deleteObject = async (key) => {
    await getClient().send(new client_s3_1.DeleteObjectCommand({
        Bucket: s3Bucket,
        Key: key,
    }));
};
exports.deleteObject = deleteObject;
