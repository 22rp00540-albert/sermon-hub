import { Role } from "@prisma/client";
import multer from "multer";
import { Router, type Request, type Response, type NextFunction } from "express";
import {
  createSermon,
  deleteSermon,
  deleteSermonDocument,
  listSermonDocuments,
  listSermons,
  streamSermonAudio,
  updateSermon,
  uploadSermonAudio,
  uploadSermonDocuments,
  viewSermonDocument,
} from "../controllers/sermon.controller";
import { uploadAudio, uploadDocuments } from "../lib/upload";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();

const handleMulterError = (err: unknown, res: Response) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "File is too large. Audio max 200MB, documents max 50MB each." });
      return;
    }
    res.status(400).json({ message: "Upload failed. Please check the file and try again." });
    return;
  }
  const message = err instanceof Error ? err.message : "Upload failed.";
  res.status(400).json({ message });
};

const wrapMulter =
  (middleware: (req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (err) {
        handleMulterError(err, res);
        return;
      }
      next();
    });
  };

router.get("/", requireAuth, listSermons);
router.get("/:id/stream", requireAuth, streamSermonAudio);
router.get("/:id/documents", requireAuth, listSermonDocuments);
router.get("/:id/document/:documentId", requireAuth, viewSermonDocument);
router.post(
  "/audio",
  requireAuth,
  requireRole(Role.ADMIN),
  wrapMulter(uploadAudio.single("audio")),
  uploadSermonAudio,
);
router.post("/", requireAuth, requireRole(Role.ADMIN), createSermon);
router.patch(
  "/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadAudio.single("audio"),
  updateSermon,
);
router.delete("/:id", requireAuth, requireRole(Role.ADMIN), deleteSermon);
router.post(
  "/:id/documents",
  requireAuth,
  requireRole(Role.ADMIN),
  wrapMulter(uploadDocuments.array("documents", 30)),
  uploadSermonDocuments,
);
router.delete(
  "/:id/document/:documentId",
  requireAuth,
  requireRole(Role.ADMIN),
  deleteSermonDocument,
);

export default router;
