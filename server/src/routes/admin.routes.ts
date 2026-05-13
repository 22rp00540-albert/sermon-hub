import { Role } from "@prisma/client";
import { Router } from "express";
import {
  approveUser,
  deleteMember,
  getAdminMetrics,
  listMembers,
  listPendingUsers,
  rejectUser,
} from "../controllers/admin.controller";
import {
  deleteAudioListeningSession,
  deleteVideoListeningSession,
  exportCountryLeaderboardCsv,
  exportCountryLeaderboardPdf,
  exportListeningReportCsv,
  exportListeningReportPdf,
  listCountryLeaderboard,
  listListeningReportCountries,
  listListeningReportRows,
  listListeningReportSermonTitles,
} from "../controllers/listeningReports.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireRole(Role.ADMIN));

router.get("/users/pending", listPendingUsers);
router.get("/users", listMembers);
router.get("/metrics", getAdminMetrics);
router.patch("/users/:id/approve", approveUser);
router.patch("/users/:id/reject", rejectUser);
router.delete("/users/:id", deleteMember);

router.get("/listening-reports/countries", listListeningReportCountries);
router.get("/listening-reports/country-leaderboard/export-pdf", exportCountryLeaderboardPdf);
router.get("/listening-reports/country-leaderboard/export", exportCountryLeaderboardCsv);
router.get("/listening-reports/country-leaderboard", listCountryLeaderboard);
router.get("/listening-reports/sermon-titles", listListeningReportSermonTitles);
router.get("/listening-reports/export-pdf", exportListeningReportPdf);
router.get("/listening-reports/export", exportListeningReportCsv);
router.get("/listening-reports", listListeningReportRows);
router.delete("/listening-reports/audio/:sessionId", deleteAudioListeningSession);
router.delete("/listening-reports/video/:sessionId", deleteVideoListeningSession);

export default router;
