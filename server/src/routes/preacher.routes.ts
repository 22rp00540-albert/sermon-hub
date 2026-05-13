import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createPreacher,
  deletePreacher,
  listPreachers,
  updatePreacher,
} from "../controllers/preacher.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, listPreachers);
router.post("/", requireAuth, requireRole(Role.ADMIN), createPreacher);
router.patch("/:id", requireAuth, requireRole(Role.ADMIN), updatePreacher);
router.delete("/:id", requireAuth, requireRole(Role.ADMIN), deletePreacher);

export default router;
