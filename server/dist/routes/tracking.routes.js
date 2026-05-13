"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tracking_controller_1 = require("../controllers/tracking.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/sermons/:sermonId/progress", auth_middleware_1.requireAuth, tracking_controller_1.saveListeningProgress);
exports.default = router;
