import path from "path";
import { defineConfig } from "prisma/config";

// Load `server/.env` for local `prisma migrate` / `prisma generate`. Use try/catch so a
// misconfigured Render *build* step that runs `prisma` before `npm install` does not fail
// on `Cannot find module 'dotenv'` — Render still injects `DATABASE_URL` into the environment.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch {
  // dotenv not installed yet or unavailable — rely on `process.env` only
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
