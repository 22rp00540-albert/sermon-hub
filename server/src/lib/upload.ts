import fs from "fs";
import multer from "multer";
import path from "path";

// Keep uploads folder stable regardless of where server is started from.
export const uploadsDir = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const audioUploadsDir = path.join(uploadsDir, "audio");
const videoUploadsDir = path.join(uploadsDir, "video");
const documentUploadsDir = path.join(uploadsDir, "documents");

if (!fs.existsSync(audioUploadsDir)) {
  fs.mkdirSync(audioUploadsDir, { recursive: true });
}

if (!fs.existsSync(videoUploadsDir)) {
  fs.mkdirSync(videoUploadsDir, { recursive: true });
}

if (!fs.existsSync(documentUploadsDir)) {
  fs.mkdirSync(documentUploadsDir, { recursive: true });
}

const buildStorage = (destinationDir: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destinationDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const sanitized = file.originalname.replace(/\s+/g, "-");
      cb(null, `${unique}-${sanitized}`);
    },
  });

const audioMimePattern = /^(audio\/|video\/mp4$)/i;

const audioFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (audioMimePattern.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only audio files are allowed"));
};

const videoMimePattern = /^video\//i;

const videoFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (videoMimePattern.test(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only video files are allowed"));
};

const documentStorage = buildStorage(documentUploadsDir);

const fieldStorage = multer.diskStorage({
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

export const upload = multer({ storage: fieldStorage });
export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
});
export const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
export const uploadVideo = multer({
  storage: buildStorage(videoUploadsDir),
  fileFilter: videoFileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 },
});
