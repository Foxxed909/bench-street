# Deploying Bench Street

## Production URLs

- **Canonical app:** https://benchstreet.vercel.app
- **Vercel project fallback:** https://client-xi-orcin.vercel.app
- **API (Render):** https://bench-street-api.onrender.com
- **Health endpoint:** https://bench-street-api.onrender.com/api/health
- **Repository:** https://github.com/Foxxed909/bench-street

All user-facing links should use `https://benchstreet.vercel.app`. The generated Vercel project
URL is retained only as a fallback origin and deployment diagnostic.

## Topology

| Piece | Runtime | Host |
|---|---|---|
| `client/` | Static React/Vite build | Vercel |
| `server/` | Node, Express, Socket.io, SQLite, background jobs | **Render** |

The backend cannot be moved unchanged to Vercel serverless functions. It keeps persistent
WebSocket connections and runs signal-ingest, candle, Arena-settlement, and market-resolution
timers. It therefore needs an always-on process.

## Required environment variables

### Render backend

Already configured via `render.yaml` / dashboard:

```text
NODE_ENV=production
DATA_DIR=./data
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
CLIENT_ORIGIN=https://benchstreet.vercel.app,https://client-xi-orcin.vercel.app
STARTING_BALANCE=100000
```

On the free plan there is no persistent disk — SQLite is wiped on sleep/restart.
Upgrade to Starter and mount a disk at `/data` for permanent data.

### Vercel frontend (required)

```text
VITE_API_URL=https://bench-street-api.onrender.com
```

No trailing slash. The client adds `/api` and Socket.io paths itself.

**How to set it (phone-friendly):**
1. Open https://vercel.com → your project (the one for `client-xi-orcin` / bench-street client)
2. **Settings** → **Environment Variables**
3. Add / edit `VITE_API_URL` = `https://bench-street-api.onrender.com`
4. Apply to **Production** (and Preview if you want)
5. **Deployments** → ⋮ on latest → **Redeploy** (important: env vars only apply on new builds)

## Deploy

Frontend (auto from GitHub, or):

```bash
cd client
vercel --prod
```

Backend: auto-deploys from `main` via Render Blueprint.

## Production verification

```bash
curl -fsS https://bench-street-api.onrender.com/api/health
# → {"ok":true,"models":75,...}

curl -I https://benchstreet.vercel.app
# or https://client-xi-orcin.vercel.app
```

Then load the app, confirm The Floor shows models, and test sign-in / a vote.

## Free plan caveats (Render)

- Service sleeps after ~15 min idle → first request can take 30–50s (cold start).
- No persistent disk → user accounts / votes reset on restart.
- For always-on + permanent data: upgrade to Starter and enable the disk block in `render.yaml`.

## Alternative: Fly.io

See `FLY.md` for a full always-on setup with a volume.
