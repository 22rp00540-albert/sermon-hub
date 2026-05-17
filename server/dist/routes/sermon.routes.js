"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const sermon_controller_1 = require("../controllers/sermon.controller");
const upload_1 = require("../lib/upload");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const handleMulterError = (err, res) => {
    if (err instanceof multer_1.default.MulterError) {
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
const wrapMulter = (middleware) => (req, res, next) => {
    middleware(req, res, (err) => {
        if (err) {
            handleMulterError(err, res);
            return;
        }
        next();
    });
};
router.get("/", auth_middleware_1.requireAuth, sermon_controller_1.listSermons);
router.get("/:id/stream", auth_middleware_1.requireAuth, sermon_controller_1.streamSermonAudio);
router.get("/:id/documents", auth_middleware_1.requireAuth, sermon_controller_1.listSermonDocuments);
router.get("/:id/document/:documentId", auth_middleware_1.requireAuth, sermon_controller_1.viewSermonDocument);
router.post("/audio", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), wrapMulter(upload_1.uploadAudio.single("audio")), sermon_controller_1.uploadSermonAudio);
router.post("/", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), sermon_controller_1.createSermon);
router.patch("/:id", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), upload_1.uploadAudio.single("audio"), sermon_controller_1.updateSermon);
router.delete("/:id", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), sermon_controller_1.deleteSermon);
router.post("/:id/documents", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), wrapMulter(upload_1.uploadDocuments.array("documents", 30)), sermon_controller_1.uploadSermonDocuments);
router.delete("/:id/document/:documentId", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(client_1.Role.ADMIN), sermon_controller_1.deleteSermonDocument);
exports.default = router;
