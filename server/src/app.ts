import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import preacherRoutes from "./routes/preacher.routes";
import sermonRoutes from "./routes/sermon.routes";
import settingsRoutes from "./routes/settings.routes";
import trackingRoutes from "./routes/tracking.routes";
import videoRoutes from "./routes/video.routes";
import { isObjectStorageConfigured } from "./lib/objectStorage";
import { publicServerErrorMessage } from "./lib/publicErrorMessage";
import { prisma } from "./lib/prisma";

dotenv.config({ path: path.resolve(__dirname, "../.env"), override: false });

const app = express();
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const servesClient = fs.existsSync(path.join(clientDistPath, "index.html"));

app.set("trust proxy", 1);

app.use(
  helmet({
    // Allow media resources (audio stream) to be consumed by the frontend origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: servesClient ? false : undefined,
  }),
);
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({
    ok: true,
    servesClient,
    objectStorage: isObjectStorageConfigured(),
  });
});

/** Confirms MySQL is reachable (unlike /health, which does not touch the DB). */
app.get("/api/v1/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "up" });
  } catch (err) {
    console.error(err);
    res.status(503).json({
      ok: false,
      database: "down",
      hint:
        "If host is mysql.railway.internal, set DATABASE_URL (or DATABASE_PUBLIC_URL) to Railway MYSQL_PUBLIC_URL on your host (e.g. Render).",
    });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/preachers", preacherRoutes);
app.use("/api/v1/sermons", sermonRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/tracking", trackingRoutes);

if (servesClient) {
  app.use(express.static(clientDistPath, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.status(404).send("Not found");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  console.error(err);
  const raw = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ message: publicServerErrorMessage(raw) });
});

export default app;
