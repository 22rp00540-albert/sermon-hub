"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/member-library", auth_middleware_1.requireAuth, settings_controller_1.getMemberLibrarySettings);
router.patch("/member-video-sermons", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), settings_controller_1.patchMemberVideoSermonsSetting);
/** Same handler as PATCH — some clients / proxies handle POST more reliably than PATCH. */
router.post("/member-video-sermons", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), settings_controller_1.patchMemberVideoSermonsSetting);
exports.default = router;
