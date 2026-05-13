/**
 * Load `.env` before any route/controller imports (so SMTP and DB URLs exist at startup).
 * Imported first from `index.ts` only.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
