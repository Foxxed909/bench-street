# Deploy Bench Street API on Fly.io

You are **not** on your PC right now — that’s fine.  
All config files are already in the repo. When you have a terminal (or use Fly’s web UI later), follow these steps.

## What I prepared for you

- `server/Dockerfile` — production image with native `better-sqlite3` support
- `server/fly.toml` — always-on machine + persistent volume at `/data`
- `server/.dockerignore`

App name in config: **`bench-street-api`**  
Region default: **`iad`** (US East — change if you prefer)

## Prerequisites (one-time)

1. Create a free Fly account: https://fly.io/app/sign-up  
2. Install the CLI when you are back on a computer:

```bash
# macOS / Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

3. Log in:

```bash
fly auth login
```

## Deploy steps (from a computer)

```bash
# 1. Clone / pull latest
git clone https://github.com/Foxxed909/bench-street.git
cd bench-street/server

# 2. Create the app (uses the fly.toml already in the repo)
fly launch --no-deploy --copy-config --name bench-street-api
# Accept the defaults or pick a different region if prompted.

# 3. Create the persistent volume (same region as primary_region in fly.toml)
fly volumes create data --size 1 --region iad
# If you chose another region, replace iad with that code (e.g. lhr, ams, fra, sin).

# 4. Set required secrets
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  CLIENT_ORIGIN="https://benchstreet.vercel.app,https://client-xi-orcin.vercel.app" \
  STARTING_BALANCE="100000"

# 5. Deploy
fly deploy

# 6. Check health
curl https://bench-street-api.fly.dev/api/health
```

You should get a JSON health response.

## Point the frontend at the new API

1. Go to Vercel → your Bench Street project → Settings → Environment Variables
2. Set / update:

```
VITE_API_URL=https://bench-street-api.fly.dev
```

(no trailing slash)

3. Redeploy the frontend (Deployments → Redeploy, or push any commit).

## Useful commands later

```bash
fly status
fly logs
fly ssh console          # shell into the machine
fly volumes list
fly secrets list
fly scale memory 512     # if you need more RAM
```

## If the app name is taken

Change `app = "bench-street-api"` in `server/fly.toml` to something unique (e.g. `bench-street-api-foxx`) and re-run `fly launch --copy-config` / `fly deploy`.

## Notes

- SQLite lives on the volume at `/data/bench-street.db`
- Machine is configured to stay running (`auto_stop_machines = off`, `min_machines_running = 1`)
- Health check hits `/api/health`
- Free Fly allowance is usually enough for a small always-on API; watch usage in the dashboard
