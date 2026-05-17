# Deploy to Render (sermon-hub-web.onrender.com)

## One-time setup on Render

1. **Delete** the old **Static Site** service (if you have one) — it cannot run uploads or the API.
2. Create a **Web Service** from this GitHub repo (or use **Blueprint** with `render.yaml`).
3. In **Environment**, add these **secret** variables (paste your real values):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Railway **public** MySQL URL (`*.proxy.rlwy.net`) — not `railway.internal` |
| `JWT_SECRET` | Long random string (keep the same after first deploy) |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 API token access key |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 API token secret |

These are already set in `render.yaml` (no need to re-enter unless you change them):

- `S3_BUCKET` = `sermon-audio`
- `S3_ENDPOINT` = `https://7e7c5e484c61d5de19b902427130604f.r2.cloudflarestorage.com`
- `S3_REGION` = `auto`
- `S3_FORCE_PATH_STYLE` = `true`
- `MEMBER_PORTAL_URL` = `https://sermon-hub-web.onrender.com`

4. **Build command:** `npm run build:render`  
5. **Start command:** `npm run start:render`  
6. **Health check path:** `/api/v1/health`

## R2 CORS (once per bucket)

In Cloudflare → R2 → bucket **sermon-audio** → Settings → CORS, paste `server/cloudflare-r2-cors.json`.

## After deploy — test

| URL | Expected |
|-----|----------|
| `/api/v1/health` | `"ok": true`, `"objectStorage": true` |
| `/api/v1/health/storage` | Connected to bucket `sermon-audio` |
| `/api/v1/health/db` | `"database": "up"` |
| `/login` | Login page works |

## Push updates

```bash
git add .
git commit -m "Deploy: API + frontend + R2 sermon-audio"
git push
```

Render will rebuild automatically if auto-deploy is enabled.

## Local check (optional)

```bash
cd server
# Copy server/.env.example to server/.env and fill secrets
npm run check:storage
```
