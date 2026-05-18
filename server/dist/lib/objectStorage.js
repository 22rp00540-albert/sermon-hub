"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteObject = exports.getObjectSignedUrl = exports.getAudioObjectSignedUrl = exports.deleteAudioObject = exports.uploadObject = exports.uploadAudioObject = exports.createDocumentObjectKey = exports.createVideoObjectKey = exports.createAudioObjectKey = exports.testObjectStorageConnection = exports.getObjectStorageConfigSummary = exports.isObjectStorageConfigured = exports.getMissingObjectStorageEnvVars = void 0;
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
const getMissingObjectStorageEnvVars = () => {
    const missing = [];
    if (!s3Bucket.trim())
        missing.push("S3_BUCKET");
    if (!s3AccessKeyId.trim())
        missing.push("S3_ACCESS_KEY_ID");
    if (!s3SecretAccessKey.trim())
        missing.push("S3_SECRET_ACCESS_KEY");
    if (!s3Endpoint && !s3Region)
        missing.push("S3_ENDPOINT or S3_REGION");
    return missing;
};
exports.getMissingObjectStorageEnvVars = getMissingObjectStorageEnvVars;
const isObjectStorageConfigured = () => (0, exports.getMissingObjectStorageEnvVars)().length === 0;
exports.isObjectStorageConfigured = isObjectStorageConfigured;
const getObjectStorageConfigSummary = () => ({
    configured: (0, exports.isObjectStorageConfigured)(),
    missingEnvVars: (0, exports.getMissingObjectStorageEnvVars)(),
    bucket: s3Bucket || null,
    endpoint: s3Endpoint || null,
    region: s3Region,
    forcePathStyle,
    hasAccessKey: Boolean(s3AccessKeyId),
    hasSecretKey: Boolean(s3SecretAccessKey),
});
exports.getObjectStorageConfigSummary = getObjectStorageConfigSummary;
/** Verifies R2/S3 credentials and bucket access (call on startup or health check). */
const testObjectStorageConnection = async () => {
    if (!(0, exports.isObjectStorageConfigured)()) {
        const missing = (0, exports.getMissingObjectStorageEnvVars)();
        return {
            ok: false,
            message: `Missing environment variable(s): ${missing.join(", ")}`,
        };
    }
    try {
        await getClient().send(new client_s3_1.HeadBucketCommand({ Bucket: s3Bucket }));
        return { ok: true, message: `Connected to bucket "${s3Bucket}"` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown storage error";
        return { ok: false, message: msg };
    }
};
exports.testObjectStorageConnection = testObjectStorageConnection;
const createAudioObjectKey = (originalName) => {
    const safeName = sanitizeFileName(originalName || "audio");
    return `sermons/audio/${Date.now()}-${(0, crypto_1.randomUUID)()}-${safeName}`;
};
exports.createAudioObjectKey = createAudioObjectKey;
const createVideoObjectKey = (originalName) => {
    const safeName = sanitizeFileName(originalName || "video");
    return `sermons/video/${Date.now()}-${(0, crypto_1.randomUUID)()}-${safeName}`;
};
exports.createVideoObjectKey = createVideoObjectKey;
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
