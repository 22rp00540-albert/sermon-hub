import { Router } from "express";
import { saveListeningProgress, saveVideoListeningProgress } from "../controllers/tracking.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/sermons/:sermonId/progress", requireAuth, saveListeningProgress);
router.post("/videos/:videoId/progress", requireAuth, saveVideoListeningProgress);

export default router;
