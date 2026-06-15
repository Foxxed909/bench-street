# Deploying Bench Street

## ✅ Live deployment (2026-06-15)
- **App (Vercel):** https://benchstreet.vercel.app (alias of the `client` project;
  `client-xi-orcin.vercel.app` still works too)
- **API (Railway):** https://bench-street-api-production.up.railway.app  (health: `/api/health`)
- **Repo:** https://github.com/Foxxed909/bench-street (private)
- **URL alias:** `benchstreet.vercel.app` is pinned via `client/vercel.json` `"alias"`, so every
  `vercel --prod` re-claims it for the new production deployment. Don't use `vercel alias set`
  to a raw deployment URL — that one loses production status and starts returning 401
  (Deployment Protection). The vercel.json alias is the durable way.
- Frontend built with `VITE_API_URL` → the Railway API; backend `CLIENT_ORIGIN=*`,
  `NODE_ENV=production`, generated `JWT_SECRET`.
- Redeploy frontend: `cd client && vercel --prod`. Redeploy backend: `cd server && railway up`
  (or it redeploys on Railway when you change variables).
- Notes: the Vercel project is named `client` (from the folder); rename in the dashboard if you
  want a prettier URL. Railway runs on trial credits — if they run out the API stops; the
  Render blueprint below is the free fallback.

---



Two pieces, two hosts:

| Piece | What it is | Host |
|-------|-----------|------|
| **client/** | Static Vite/React build | **Vercel** |
| **server/** | Node + Express + **Socket.io** + SQLite, with always-on tick loops | **Render** (or Railway / Fly) — NOT Vercel |

> Why not all-Vercel? The server needs persistent WebSockets + background `setInterval`
> loops (price ticks, signal cron, auto-resolvers). Vercel is serverless and freezes
> functions between requests, which breaks all of that. So the backend needs an always-on host.

The code is already deploy-ready: the client reads `VITE_API_URL` for the backend base
(empty in dev → Vite proxy), and the server reads `PORT`, `CLIENT_ORIGIN`, `JWT_SECRET`.

---

## 1. Put this folder in its own GitHub repo
The repo root should be `Bench-Street/` (with `client/`, `server/`, `render.yaml`).
```bash
cd Bench-Street
git init && git add . && git commit -m "Bench Street"
gh repo create bench-street --public --source=. --push   # gh CLI, user Foxxed909
```
(Railway/Fly can deploy straight from the local folder via their CLI if you'd rather skip GitHub.)

## 2. Deploy the backend (Render)
- Render → **New → Blueprint** → pick the repo. `render.yaml` configures everything
  (root `server/`, `npm install`, `npm run start`, health check `/api/health`, a generated
  `JWT_SECRET`, `CLIENT_ORIGIN=*`).
- Deploy, then copy the service URL, e.g. `https://bench-street-api.onrender.com`.
- Sanity check: open `…/api/health` → `{"ok":true}`.

**Railway alternative (no GitHub, stays awake better):**
```bash
cd server && railway init && railway up
railway variables set NODE_ENV=production CLIENT_ORIGIN=* JWT_SECRET=$(openssl rand -hex 24)
```

## 3. Deploy the frontend (Vercel)
- Vercel → **New Project** → same repo → set **Root Directory = `client`**
  (Vite is auto-detected; `client/vercel.json` adds the SPA rewrite so routes like `/m/gpt-5-2` work).
- Add env var **`VITE_API_URL`** = your backend URL from step 2.
- Deploy → you get e.g. `https://bench-street.vercel.app`.

## 4. (optional) Lock down CORS
Set the backend's `CLIENT_ORIGIN` to your exact Vercel URL and redeploy, instead of `*`.

---

## Free-tier caveats (be aware)
- **Render free sleeps** after ~15 min idle; first hit cold-starts (~30–60s) and the process
  restarts, which **re-seeds the DB** (votes/trades/users reset; models/markets return).
- **SQLite is ephemeral** on free hosts. For real persistence: a paid instance with a disk
  mounted at `server/data`, or migrate to a hosted Postgres (Neon/Supabase).
- For an always-on, persistent deploy, Railway/Fly with a volume (or a small paid Render
  instance + Disk) is the move.

## Local dev is unchanged
`npm run dev` still works (client :5173, server :4000) — `VITE_API_URL` empty → Vite proxy.
