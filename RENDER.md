# Deploy Bench Street API on Render

You can do almost everything from a phone browser.

## 1. Sign up / log in

Go to: https://dashboard.render.com  
Sign up with GitHub (recommended — one-click repo access).

## 2. Deploy with the Blueprint

1. In the Render dashboard click **New** → **Blueprint**
2. Connect the repo **Foxxed909/bench-street** (if not already connected)
3. Render will read `render.yaml` from the root
4. Review the service `bench-street-api`
5. Click **Apply**

Render will build and deploy automatically.

## 3. After the first deploy

1. Open the service → **Logs** and wait until it says ready / listening
2. Copy the service URL (looks like `https://bench-street-api-xxxx.onrender.com`)
3. Test health (browser or any tool):

   ```
   https://YOUR-SERVICE.onrender.com/api/health
   ```

   You should see a JSON response (not 404).

## 4. Point the frontend at it (Vercel)

1. Go to Vercel → your Bench Street project → **Settings** → **Environment Variables**
2. Add / edit:

   | Key            | Value                                      |
   |----------------|--------------------------------------------|
   | `VITE_API_URL` | `https://YOUR-SERVICE.onrender.com`        |

   (no trailing slash, no `/api`)

3. Apply to **Production**
4. Go to **Deployments** → ⋮ on the latest → **Redeploy**

## 5. Important free-plan limits

| Issue | What happens | Fix |
|-------|--------------|-----|
| Sleeps after ~15 min idle | First request after sleep is slow (cold start) | Upgrade to **Starter** |
| No persistent disk on free | SQLite data is wiped on every restart/deploy | Upgrade to **Starter** and enable the disk section in `render.yaml` |

For a real always-on trading-style app you will eventually want **Starter** (a few $/month).

### Enabling the disk (when you upgrade)

1. In `render.yaml` change `plan: free` → `plan: starter`
2. Uncomment the `disk:` block
3. Push to `main` (or edit in the Render dashboard → Disks)
4. Redeploy

## 6. Optional secrets / admins later

In the Render service → **Environment**:

- `ADMIN_USER_IDS` = numeric user IDs (comma-separated) once you have accounts
- You can rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` if needed (users will need to log in again)

## Quick checklist

- [ ] Render blueprint applied
- [ ] `/api/health` returns OK
- [ ] Vercel `VITE_API_URL` updated
- [ ] Frontend redeployed
- [ ] Floor shows models again

That’s it. Once health is green and Vercel is updated, the app should work again.
