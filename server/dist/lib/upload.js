"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocuments = exports.uploadAudio = exports.upload = exports.uploadsDir = void 0;
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// Keep uploads folder stable regardless of where server is started from.
exports.uploadsDir = path_1.default.resolve(__dirname, "../../uploads");
if (!fs_1.default.existsSync(exports.uploadsDir)) {
    fs_1.default.mkdirSync(exports.uploadsDir, { recursive: true });
}
const audioUploadsDir = path_1.default.join(exports.uploadsDir, "audio");
const documentUploadsDir = path_1.default.join(exports.uploadsDir, "documents");
if (!fs_1.default.existsSync(audioUploadsDir)) {
    fs_1.default.mkdirSync(audioUploadsDir, { recursive: true });
}
if (!fs_1.default.existsSync(documentUploadsDir)) {
    fs_1.default.mkdirSync(documentUploadsDir, { recursive: true });
}
const buildStorage = (destinationDir) => multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, destinationDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const sanitized = file.originalname.replace(/\s+/g, "-");
        cb(null, `${unique}-${sanitized}`);
    },
});
const audioMimePattern = /^(audio\/|video\/mp4$)/i;
const audioFileFilter = (_req, file, cb) => {
    if (audioMimePattern.test(file.mimetype)) {
        cb(null, true);
        return;
    }
    cb(new Error("Only audio files are allowed"));
};
const documentStorage = buildStorage(documentUploadsDir);
const fieldStorage = multer_1.default.diskStorage({
    destination: (_req, file, cb) => {
        const destinationDir = file.fieldname === "audio" ? audioUploadsDir : documentUploadsDir;
        cb(null, destinationDir);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const sanitized = file.originalname.replace(/\s+/g, "-");
        cb(null, `${unique}-${sanitized}`);
    },
});
exports.upload = (0, multer_1.default)({ storage: fieldStorage });
exports.uploadAudio = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: audioFileFilter,
    limits: { fileSize: 200 * 1024 * 1024 },
});
exports.uploadDocuments = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});
