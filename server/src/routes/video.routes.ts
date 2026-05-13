import { Role } from "@prisma/client";
import multer from "multer";
import { Router } from "express";
import {
  createVideoSermon,
  deleteVideoSermon,
  listVideoSermons,
  streamVideoSermon,
  updateVideoSermon,
  uploadVideoFile,
} from "../controllers/video.controller";
import { uploadVideo } from "../lib/upload";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const uploadVideoMiddleware = uploadVideo.single("video");

router.get("/", requireAuth, listVideoSermons);
router.get("/:id/stream", requireAuth, streamVideoSermon);
router.post("/upload", requireAuth, requireRole(Role.ADMIN), (req, res, next) => {
  uploadVideoMiddleware(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: "Video is too large. Max size is 1GB." });
        return;
      }
      res.status(400).json({ message: "Video upload failed. Please check the file and try again." });
      return;
    }
    const message = err instanceof Error ? err.message : "Video upload failed.";
    res.status(400).json({ message });
  });
}, uploadVideoFile);
router.post("/", requireAuth, requireRole(Role.ADMIN), createVideoSermon);
router.patch("/:id", requireAuth, requireRole(Role.ADMIN), updateVideoSermon);
router.delete("/:id", requireAuth, requireRole(Role.ADMIN), deleteVideoSermon);

export default router;
