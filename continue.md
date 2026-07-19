# Bench Street — Continue Here (handoff) — ✅ SHIPPED 2026-06-15

> **DONE.** This whole plan was built, deployed, and verified live on 2026-06-15 (v1.0).
> Kept for history. See `public.md` / `private.md` v1.0 entries for the as-built notes.
> Roster is 32 models, Fable/Mythos suspended, research bets live, Newest-on-top default.
>
> ---
>
> Written 2026-06-15 mid-task because the laptop hit 17% with no charger. Everything
> needed to resume is in this file. Nothing has been built yet for this batch — the
> codebase is still at v0.9 (52-model tier matrix). This doc is the plan + decisions.

---

## TL;DR — what to do next

Pick up the latest request: **clean up the model roster to real per-family naming, mark
the suspended Anthropic models, add a betting system, sort newest-on-top.** All decisions
are locked (below). Read the **Build plan** and execute it top to bottom, then deploy +
verify on https://benchstreet.vercel.app.

---

## The request (user's words, 2026-06-15)

> "do a websearch on when anthropic revoked all access for claude fable 5 and mythos 5
> + make the unreleased models like (coming soon) cuz if users see GPT 5.6 Max (there's
> no max for GPT) i think only pro, and add a betting system (research), and the newer
> models should be on top."

The user corrected me: I had said Mythos 5 was fictional. **It is real.** I was wrong.

---

## Websearch findings (done — these are real events)

- **2026-06-09** — Anthropic released **Claude Fable 5** (public, safeguarded) and
  **Claude Mythos 5** (restricted-access: cybersecurity/scientific research). Same
  underlying model; Fable has safety classifiers, Mythos doesn't. Fable priced
  **$10/$50 per Mtok** (in/out), 1M context, up to 128k output. Fable hit **#1 on Arena
  across Agent, Text, and Code**.
- **2026-06-12** — A **US government export directive** named both models and ordered
  access suspended for any foreign national (incl. Anthropic's own foreign-national
  staff). Anthropic can't filter foreign nationals from US users in real time, so it
  **shut both down for everyone**. Trigger: a reported narrow **jailbreak** on Fable 5.
- **All other models (Opus 4.8, etc.) are unaffected.** Anthropic believes it's a
  misunderstanding and is working to restore access.

Sources (for the suspended-model news blurb in the UI):
- https://www.anthropic.com/news/fable-mythos-access (Anthropic statement)
- https://www.cnbc.com/2026/06/12/anthropic-disables-access-to-fable-5-and-mythos-5-to-comply-with-government-directive.html
- https://www.anthropic.com/news/claude-fable-5-mythos-5 (launch)

---

## Decisions locked (via AskUserQuestion)

1. **Variants → real per-family naming.** Drop the fake low/medium/high/xhigh/max matrix.
   Each lab gets its real lineup. ~52 models → ~32.
2. **Betting → both** price-move bets *and* ranking/benchmark bets. (Build on the existing
   parimutuel market engine — do NOT build a third system from scratch.)
3. **Pulled models → "Access suspended" badge** + news blurb, listed but NOT tradeable.
4. (My call, no question) **Newest-on-top**: add a release date, make "Newest" the default
   Floor sort, show a "New" badge on recent releases.

---

## New roster (replaces TIER_BASES/TIERS/TIER_MODELS in seed.js)

Keep all 22 `BASE_ROSTER` models. Replace the tier matrix with these **10 real variants**
(= 32 total). `apiPrice` is blended $/Mtok (costFactor caps at 2.0 once ≥ $10 → $10/vote).

| slug | name | company | ticker | apiPrice | elo | bench | released_at | status |
|------|------|---------|--------|---------:|----:|------:|-------------|--------|
| gpt-5-5 | GPT-5.5 | OpenAI | GPT55 | 7.0 | 1405 | 93 | 2026-03-10 | active |
| gpt-5-5-pro | GPT-5.5 Pro | OpenAI | GPT55P | 14.0 | 1418 | 95 | 2026-03-10 | active |
| gpt-5-6 | GPT-5.6 | OpenAI | GPT56 | 8.0 | 1420 | 94 | 2026-05-20 | active |
| gpt-5-6-pro | GPT-5.6 Pro | OpenAI | GPT56P | 16.0 | 1432 | 96 | 2026-05-20 | active |
| grok-4-3 | Grok 4.3 | xAI | GROK43 | 6.5 | 1398 | 91 | 2026-05-01 | active |
| grok-4-3-heavy | Grok 4.3 Heavy | xAI | GRK43H | 13.0 | 1414 | 93 | 2026-05-01 | active |
| gemini-3-5-pro | Gemini 3.5 Pro | Google | GEM35P | 7.5 | 1412 | 93 | 2026-04-15 | active |
| gemini-3-5-flash | Gemini 3.5 Flash | Google | GEM35F | 0.6 | 1352 | 86 | 2026-04-15 | active |
| claude-fable-5 | Claude Fable 5 | Anthropic | FABL5 | 20.0 | 1440 | 96 | 2026-06-09 | **suspended** |
| claude-mythos-5 | Claude Mythos 5 | Anthropic | MYTH5 | 22.0 | 1450 | 97 | 2026-06-09 | **suspended** |

Notes:
- Colors: OpenAI `#10a37f`/`#0e8f6f`, xAI `#5b6470`, Google `#4285f4`/`#3b78e0`,
  Anthropic `#d97757` (fable) / `#b5532f` (mythos, slightly darker). vol ~0.010–0.013.
- Fable blended: 0.75×10 + 0.25×50 = **$20** (matches `blendedPrice()` weighting in ingest.js).
- `status_note` for both: `"Access suspended 2026-06-12 under a US government export
  directive. Anthropic is working to restore access."`
- **Delete the old `mythos-5`** (company 'Mythos', the fictional one) — replaced by
  `claude-mythos-5` under Anthropic.
- Give BASE_ROSTER models plausible older `released_at` so "Newest" sort is meaningful
  (e.g. 2025-09 … 2026-02). Anything earlier than ~45 days ago won't get the "New" badge.

---

## Build plan (ordered)

### Backend

1. **`server/src/db.js`** — add migrations (additive columns):
   ```js
   ensureColumn('models', 'status', "status TEXT NOT NULL DEFAULT 'active'")
   ensureColumn('models', 'status_note', 'status_note TEXT')
   ensureColumn('models', 'released_at', 'released_at TEXT')
   ```

2. **`server/src/seed.js`** —
   - Delete `TIER_BASES`, `TIERS`, `TIER_MODELS`. Add a `VARIANTS` array (the 10 above)
     with `releaseDate`/`status`/`statusNote` fields. `ROSTER = [...BASE_ROSTER, ...VARIANTS]`.
   - Add `released_at` to BASE_ROSTER entries too.
   - **Make the model upsert run every boot (idempotent), not just when empty** — so an
     existing prod DB migrates without a force-reseed. Move the `insModel` loop out of the
     `if (modelCount===0||force)` guard (the `ON CONFLICT DO UPDATE` already makes it safe).
     Add `status`, `status_note`, `released_at` to the INSERT + the DO UPDATE SET clause.
   - **Guard signal seeding to new models only** (don't append a signal row every boot):
     only `insSignal.run(...)` if that model has zero rows in `model_signals`.
   - **Reconcile (delete stale models)** every boot: delete any model whose slug is NOT in
     the new ROSTER (cleans out the 30 tier slugs + old `mythos-5`). Cascades to that
     model's holdings/votes/comments/candles — fine, market is fresh at $0.
     ```js
     const keep = new Set(ROSTER.map(m => m.slug))
     for (const r of db.prepare('SELECT id, slug FROM models').all())
       if (!keep.has(r.slug)) db.prepare('DELETE FROM models WHERE id = ?').run(r.id)
     ```
   - Keep `setBenchmarks` + add a `setStatus`/`setReleased` update in the same loop.

3. **`server/src/resolver.js`** — add new auto-resolver kinds in `decide()`:
   - `{ kind:'bench_top', key:'BridgeBench', candidates:[slugs] }` → at close, resolve to
     the candidate model with the highest `benchmarks[key]` (label = model name). Reads
     `models.benchmarks` JSON.
   - `{ kind:'price_top', candidates:[slugs] }` → at close, resolve to the candidate with
     the highest `models.price` (label = model name).
   - (optional) `{ kind:'price_lead', a, b }` → at close, higher price wins (mirror of
     `elo_lead`).
   Use the same `outcomeByLabel(market.id, modelName)` pattern. Guard: skip if data missing.

4. **`server/src/seed.js` (MARKETS)** — add 3 betting markets:
   - `bridgebench-top-2026` · category **"Benchmarks"** · multi-outcome among
     `[gpt-5-6-pro, gemini-3-5-pro, grok-4-3-heavy, o4, claude-opus-4-8]` ·
     resolver `{kind:'bench_top', key:'BridgeBench', candidates:[...same...]}` · closesAt END.
     Question: "Which model tops BridgeBench at year-end 2026?"
   - `most-valued-2026` · category **"Price action"** · multi-outcome among the same set ·
     resolver `{kind:'price_top', candidates:[...]}` · closesAt END.
     Question: "Most valued model on Bench Street at year-end 2026?"
   - `fable-restored-2026` · category **"News"** · binary YES/NO · admin-resolved (no
     resolver) · closesAt END. Question: "Will Anthropic restore Fable 5 & Mythos 5 access
     in 2026?" rules = the suspension summary. (Topical, ties to the live news.)

5. **`server/src/routes/models.js`** —
   - `SELECT`: add `m.status, m.status_note, m.released_at`.
   - `decorate()`: expose `status: m.status`, `statusNote: m.status_note`,
     `releasedAt: m.released_at`.
   - **Vote route**: reject suspended — after loading model, if `status==='suspended'`
     return `400 { error: 'model access is suspended' }`.

6. **`server/src/routes/trade.js`** — defensive: block trades on suspended models
   (`if (model.status === 'suspended') return res.status(400)...`). (Already blocked by
   price≤0, but make it explicit + a clear message.)

### Frontend

7. **`client/src/lib/format.js`** —
   - Remove `splitTier` + `TIER_WORDS` (tiers are gone).
   - Add `isNew(releasedAt)` → `releasedAt && (Date.now() - new Date(releasedAt)) < 45*864e5`.

8. **`client/src/pages/Floor.jsx`** —
   - Remove `TIER_TONE` + `splitTier` import/use; render `m.name` whole.
   - Add `new` sort: `(a,b) => new Date(b.releasedAt||0) - new Date(a.releasedAt||0)`.
     Make `new` the **default** `useState('new')`. Add tab `['new','Newest']` first.
   - Row badges: `isNew(m.releasedAt)` → `<span className="pill bg-accent/15 text-accent">new</span>`.
     `m.status==='suspended'` → `<span className="pill bg-amber-500/15 text-amber-300">suspended</span>`.
   - Suspended rows: disable the `<LikeDislike>` (pass a `disabled` prop or hide) and they
     already can't trade (no price). Keep them visible.

9. **`client/src/pages/ModelDetail.jsx`** —
   - Remove `splitTier`; render `model.name` whole.
   - If `model.status==='suspended'`: amber banner card at top — "Access suspended" +
     `model.statusNote` + link to the Anthropic statement. Disable `<LikeDislike>` and the
     trade buttons with a clear note.
   - Show `Released {date}` in the header subtitle (use `model.releasedAt`).

10. **`client/src/components/LikeDislike.jsx`** — accept a `disabled` prop; when true,
    render counts but make buttons non-interactive (opacity-40, no onClick).

11. **`client/src/pages/Predictions.jsx`** — no structural change needed; the new
    "Benchmarks" / "Price action" / "News" categories appear automatically as filter
    chips. Optional polish: tweak the page subtitle to mention model-price & benchmark bets.

12. (Optional) **`client/src/components/Nav.jsx`** — could rename "Predictions" → "Bets"
    or add a "Bets" entry. Low priority; the user didn't ask for a nav change.

---

## Deploy + verify

```bash
# Backend (Railway) — service name is required
cd "C:/Users/WhitePC/Rooms/Coderoom/Bench-Street/server"
railway up --service bench-street-api
# (idempotent seed migrates prod on boot; no force needed if step 2 is done right.
#  If models look stale, run a one-off:  node src/seed.js  with force=true)

# Frontend (Vercel) — re-claims benchstreet.vercel.app via vercel.json "alias"
cd "C:/Users/WhitePC/Rooms/Coderoom/Bench-Street/client"
vercel --prod
# Do NOT use `vercel alias set` to a raw deploy URL — it 401s when it loses prod status.
```

Verify on https://benchstreet.vercel.app (use Playwright, check console = 0 errors):
- [ ] ~32 models (not 52); no `*-low/-medium/-high/-xhigh/-max` slugs; no fictional `mythos-5`.
- [ ] GPT shows base + Pro only (no "Max"). Grok base + Heavy. Gemini Pro + Flash.
- [ ] Claude Fable 5 & Mythos 5 present with **suspended** badge, not tradeable,
      detail page shows the suspension banner + news link.
- [ ] Newest models sort to the top by default; recent ones show a **new** badge.
- [ ] Predictions page has new **Benchmarks / Price action / News** markets; the
      BridgeBench bet resolves on real seeded benchmark data; "restore Fable 5" market exists.
- [ ] All prices still $0 until votes (votes-from-zero rule intact).

---

## Gotchas (carry forward)

- **Working dir**: this project is `C:/Users/WhitePC/Rooms/Coderoom/Bench-Street` — a
  *sibling* of the cwd the session opened in (`.../Coderoom/Super Intelligence low`).
  Use absolute paths.
- **Railway** needs `--service bench-street-api` (multiple resources on the project).
- **Vercel** alias is pinned in `client/vercel.json` `"alias"`; just `vercel --prod`.
- **VITE_API_URL BOM** bug already fixed (`.trim()` in api.js + socket.js). Don't pipe
  env vars via PowerShell `$x | vercel env add` (injects U+FEFF).
- **Admin** = first registered user (locally: the configured dev admin account).
- Don't commit `.env`; don't install new deps without asking.
- After shipping: update `public.md`, `private.md`, and the
  `bench-street-project` memory file with a **v1.0** entry.

---

## After it's done — public.md changelog stub (v1.0)

- Real model lineups (GPT base+Pro, Grok base+Heavy, Gemini Pro+Flash) replacing the
  synthetic effort-tier matrix.
- Claude Fable 5 & Mythos 5 listed with an "Access suspended" badge reflecting the real
  2026-06-12 US-government directive (not tradeable, with a news link).
- New betting markets: benchmark-leader bets (BridgeBench) and most-valued-model bets,
  plus a "will access be restored?" market.
- Newest models sort to the top; "new" badge on recent releases.
