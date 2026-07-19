# Deploying Bench Street

## Production URLs

- **Canonical app:** https://benchstreet.vercel.app
- **Vercel project fallback:** https://client-xi-orcin.vercel.app
- **Railway API:** https://bench-street-api-production.up.railway.app
- **Health endpoint:** https://bench-street-api-production.up.railway.app/api/health
- **Repository:** https://github.com/Foxxed909/bench-street

All user-facing links should use `https://benchstreet.vercel.app`. The generated Vercel project
URL is retained only as a fallback origin and deployment diagnostic. The canonical alias is pinned
through `client/vercel.json`, so every production frontend deployment reclaims it automatically.
Do not pin public links to a one-off Vercel deployment URL; Deployment Protection can later leave
that URL returning 401 after its production status changes.

## Topology

| Piece | Runtime | Host |
|---|---|---|
| `client/` | Static React/Vite build | Vercel |
| `server/` | Node, Express, Socket.io, SQLite, background jobs | Railway |

The backend cannot be moved unchanged to Vercel serverless functions. It keeps persistent
WebSocket connections and runs signal-ingest, candle, Arena-settlement, and market-resolution
timers. It therefore needs an always-on process.

## Required environment variables

### Railway backend

```text
NODE_ENV=production
JWT_SECRET=<long random secret>
CLIENT_ORIGIN=https://benchstreet.vercel.app,https://client-xi-orcin.vercel.app
DATA_DIR=/data
ADMIN_USER_IDS=<comma-separated numeric user IDs that should be admins>
```

Production administration is pinned to immutable database user IDs, never public usernames.
Create or sign in to the intended account, read its `id` from `/api/auth/me`, set that number in
`ADMIN_USER_IDS`, and redeploy. Boot-time reconciliation grants configured IDs administrator rights
and revokes stale administrators. `ADMIN_USERNAMES` remains a development-only convenience.

Mount the Railway volume at `/data`. Without the volume, SQLite users, votes, trades, comments,
and positions disappear when the container filesystem is replaced on each deploy.

### Vercel frontend

```text
VITE_API_URL=https://bench-street-api-production.up.railway.app
```

The Vercel production environment must use the Railway API base URL above without a trailing
`/api`; the client adds `/api` and Socket.io paths itself.

## Deploy

Frontend:

```bash
cd client
vercel --prod
```

Backend:

```bash
cd server
railway up
```

Railway and Vercel may also deploy automatically when `main` changes, depending on the linked
project settings.

## Production verification

```bash
curl -fsS https://bench-street-api-production.up.railway.app/api/health
curl -I https://benchstreet.vercel.app
```

Then load the canonical app, sign in, and verify:

1. The Floor receives its opening Socket.io snapshot.
2. A trade uses the expected self-neutralized quote.
3. Prediction and Arena pools update live.
4. Administrator-only routes reject ordinary users and accept the configured admin account.

## Local development

```bash
npm run install:all
npm run dev
```

The server runs on `http://localhost:4000`; Vite runs on `http://localhost:5173` and proxies
`/api` plus `/socket.io` to the server. Leave `VITE_API_URL` empty locally.

## Alternative hosts

Render, Fly.io, or another always-on Node host can run `server/`, but persistent storage is not
optional. Configure a mounted disk for `DATA_DIR`, a strong `JWT_SECRET`, the exact frontend origin,
and explicit production admin user IDs. Replace the Railway API URL in Vercel only after the new
backend health endpoint and Socket.io connection have been verified.
