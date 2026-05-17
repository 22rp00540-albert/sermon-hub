"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const upload_1 = require("../lib/upload");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const uploadVideoMiddleware = upload_1.uploadVideo.single("video");
router.get("/", auth_middleware_1.requireAuth, video_controller_1.listVideoSermons);
router.get("/:id/stream", auth_middleware_1.requireAuth, video_controller_1.streamVideoSermon);
router.post("/upload", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), (req, res, next) => {
    uploadVideoMiddleware(req, res, (err) => {
        if (!err) {
            next();
            return;
        }
        if (err instanceof multer_1.default.MulterError) {
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
}, video_controller_1.uploadVideoFile);
router.post("/", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), video_controller_1.createVideoSermon);
router.patch("/:id", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), video_controller_1.updateVideoSermon);
router.delete("/:id", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), video_controller_1.deleteVideoSermon);
exports.default = router;
