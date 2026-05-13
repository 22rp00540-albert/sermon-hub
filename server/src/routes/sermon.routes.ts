import { Role } from "@prisma/client";
import { Router } from "express";
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

router.get("/", requireAuth, listSermons);
router.get("/:id/stream", requireAuth, streamSermonAudio);
router.get("/:id/documents", requireAuth, listSermonDocuments);
router.get("/:id/document/:documentId", requireAuth, viewSermonDocument);
router.post("/audio", requireAuth, requireRole(Role.ADMIN), uploadAudio.single("audio"), uploadSermonAudio);
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
  uploadDocuments.array("documents", 30),
  uploadSermonDocuments,
);
router.delete(
  "/:id/document/:documentId",
  requireAuth,
  requireRole(Role.ADMIN),
  deleteSermonDocument,
);

export default router;
