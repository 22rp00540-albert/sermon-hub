"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const preacher_routes_1 = __importDefault(require("./routes/preacher.routes"));
const sermon_routes_1 = __importDefault(require("./routes/sermon.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const tracking_routes_1 = __importDefault(require("./routes/tracking.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const objectStorage_1 = require("./lib/objectStorage");
const publicErrorMessage_1 = require("./lib/publicErrorMessage");
const prisma_1 = require("./lib/prisma");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env"), override: false });
const app = (0, express_1.default)();
const clientDistPath = path_1.default.resolve(__dirname, "../../client/dist");
const servesClient = fs_1.default.existsSync(path_1.default.join(clientDistPath, "index.html"));
app.set("trust proxy", 1);
app.use((0, helmet_1.default)({
    // Allow media resources (audio stream) to be consumed by the frontend origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: servesClient ? false : undefined,
}));
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.get("/api/v1/health", (_req, res) => {
    res.json({
        ok: true,
        servesClient,
        objectStorage: (0, objectStorage_1.isObjectStorageConfigured)(),
        storage: (0, objectStorage_1.getObjectStorageConfigSummary)(),
    });
});
app.get("/api/v1/health/storage", async (_req, res) => {
    const summary = (0, objectStorage_1.getObjectStorageConfigSummary)();
    const test = await (0, objectStorage_1.testObjectStorageConnection)();
    res.status(test.ok ? 200 : 503).json({
        ok: test.ok,
        message: test.message,
        ...summary,
    });
});
/** Confirms MySQL is reachable (unlike /health, which does not touch the DB). */
app.get("/api/v1/health/db", async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true, database: "up" });
    }
    catch (err) {
        console.error(err);
        res.status(503).json({
            ok: false,
            database: "down",
            hint: "If host is mysql.railway.internal, set DATABASE_URL (or DATABASE_PUBLIC_URL) to Railway MYSQL_PUBLIC_URL on your host (e.g. Render).",
        });
    }
});
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/admin", admin_routes_1.default);
app.use("/api/v1/preachers", preacher_routes_1.default);
app.use("/api/v1/sermons", sermon_routes_1.default);
app.use("/api/v1/settings", settings_routes_1.default);
app.use("/api/v1/videos", video_routes_1.default);
app.use("/api/v1/tracking", tracking_routes_1.default);
if (servesClient) {
    app.use(express_1.default.static(clientDistPath, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.sendFile(path_1.default.join(clientDistPath, "index.html"));
    });
}
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    res.status(404).send("Not found");
});
app.use((err, _req, res, _next) => {
    if (res.headersSent)
        return;
    console.error(err);
    const raw = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message: (0, publicErrorMessage_1.publicServerErrorMessage)(raw) });
});
exports.default = app;
