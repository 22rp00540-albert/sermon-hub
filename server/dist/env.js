"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Load `.env` before any route/controller imports (so SMTP and DB URLs exist at startup).
 * Imported first from `index.ts` only.
 */
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const RAILWAY_INTERNAL_DB = "railway.internal";
// Do not let a local `.env` override platform env (e.g. Render, Railway).
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env"), override: false });
const publicUrl = process.env.DATABASE_PUBLIC_URL?.trim();
let dbUrl = process.env.DATABASE_URL?.trim();
/**
 * Railway exposes MYSQL_URL (private, *.railway.internal) and MYSQL_PUBLIC_URL (internet).
 * Render (and other hosts outside Railway) must use the public URL for Prisma.
 * Optional: set DATABASE_PUBLIC_URL on Render to MYSQL_PUBLIC_URL if DATABASE_URL is still internal.
 */
if (dbUrl?.includes(RAILWAY_INTERNAL_DB) && publicUrl && !publicUrl.includes(RAILWAY_INTERNAL_DB)) {
    process.env.DATABASE_URL = publicUrl;
    dbUrl = publicUrl;
}
if (process.env.RENDER === "true" && dbUrl?.includes(RAILWAY_INTERNAL_DB)) {
    throw new Error("DATABASE_URL still points at Railway's private host (mysql.railway.internal). " +
        "On Render: Environment → set DATABASE_URL to Railway's MYSQL_PUBLIC_URL (host like *.proxy.rlwy.net, port may not be 3306). " +
        "Or set DATABASE_PUBLIC_URL to MYSQL_PUBLIC_URL and redeploy.");
}
if (process.env.RENDER === "true" && process.env.NODE_ENV === "production") {
    const bucket = process.env.S3_BUCKET?.trim();
    if (bucket && bucket !== "sermon-audio") {
        console.warn(`S3_BUCKET is "${bucket}" — expected "sermon-audio" for your R2 bucket.`);
    }
}
