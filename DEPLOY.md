# Deploying Bench Street

## Live deployment

- **App (Vercel):** https://benchstreet.vercel.app
- **Secondary Vercel URL:** https://client-xi-orcin.vercel.app
- **API (Railway):** https://bench-street-api-production.up.railway.app
- **Health endpoint:** https://bench-street-api-production.up.railway.app/api/health
- **Repository:** https://github.com/Foxxed909/bench-street (private)

The app alias is pinned through `client/vercel.json`, so production deploys reclaim
`benchstreet.vercel.app` automatically. Do not pin the alias to a one-off deployment URL;
Vercel Deployment Protection can leave that URL returning 401 after its production status changes.

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
ADMIN_USERNAMES=<comma-separated usernames that should be admins>
```

`ADMIN_USERNAMES` is intentionally mandatory for production administration. Public signup never
promotes an account. Create the intended account, add its username to the allowlist, then redeploy
so boot-time reconciliation grants it admin rights and revokes stale admins.

Mount the Railway volume at `/data`. Without the volume, SQLite users, votes, trades, comments,
and positions disappear when the container filesystem is replaced.

### Vercel frontend

```text
VITE_API_URL=https://bench-street-api-production.up.railway.app
```

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

Railway may also redeploy automatically when the linked branch changes, depending on project
settings. After either backend deploy, verify `/api/health` and then load the Floor, sign in, and
confirm a Socket.io price snapshot arrives.

## Local development

```bash
npm run install:all
npm run dev
```

The server runs on `http://localhost:4000`; Vite runs on `http://localhost:5173` and proxies
`/api` plus `/socket.io` to the server. Leave `VITE_API_URL` empty locally.

## Alternative hosts

Render, Fly.io, or another always-on Node host can run `server/`, but persistent storage is not
optional. Configure a mounted disk for `DATA_DIR`, a strong `JWT_SECRET`, the exact client origin,
and an explicit admin allowlist. Free instances that sleep will also make the first API/socket
connection slow after idle periods.
