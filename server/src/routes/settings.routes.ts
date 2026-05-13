import { Router } from "express";
import { Role } from "@prisma/client";
import { getMemberLibrarySettings, patchMemberVideoSermonsSetting } from "../controllers/settings.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/member-library", requireAuth, getMemberLibrarySettings);
router.patch("/member-video-sermons", requireAuth, requireRole(Role.ADMIN), patchMemberVideoSermonsSetting);
/** Same handler as PATCH — some clients / proxies handle POST more reliably than PATCH. */
router.post("/member-video-sermons", requireAuth, requireRole(Role.ADMIN), patchMemberVideoSermonsSetting);

export default router;
