"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const preacher_routes_1 = __importDefault(require("./routes/preacher.routes"));
const sermon_routes_1 = __importDefault(require("./routes/sermon.routes"));
const tracking_routes_1 = __importDefault(require("./routes/tracking.routes"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env") });
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    // Allow media resources (audio stream) to be consumed by the frontend origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true });
});
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/admin", admin_routes_1.default);
app.use("/api/v1/preachers", preacher_routes_1.default);
app.use("/api/v1/sermons", sermon_routes_1.default);
app.use("/api/v1/tracking", tracking_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
});
app.use((err, _req, res, _next) => {
    if (res.headersSent)
        return;
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
});
exports.default = app;
