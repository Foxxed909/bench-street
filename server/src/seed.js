import db from './db.js'
import { recomputePrices } from './pricing.js'

// Illustrative seed roster. ELO / usage / benchmarks are curated snapshots (no free
// real-time source). api_price and downloads are seeded here but get overwritten with
// LIVE data by the signal feed (see ingest.js): each model is mapped to a real
// OpenRouter id (pricing) and, for open models, a HuggingFace repo (downloads).
const BASE_ROSTER = [
  { slug: 'gpt-5-2',         name: 'GPT-5.2',            company: 'OpenAI',    ticker: 'GPT52', open: 0, color: '#10a37f', elo: 1372, usage: 16.4, bench: 91, downloads: null,      apiPrice: 9.0,  vol: 0.010 },
  { slug: 'gpt-5-mini',      name: 'GPT-5 mini',         company: 'OpenAI',    ticker: 'GPT5M', open: 0, color: '#10a37f', elo: 1318, usage: 11.2, bench: 84, downloads: null,      apiPrice: 1.2,  vol: 0.009 },
  { slug: 'o4',              name: 'o4',                 company: 'OpenAI',    ticker: 'O4',    open: 0, color: '#0e8a6c', elo: 1361, usage: 6.1,  bench: 93, downloads: null,      apiPrice: 14.0, vol: 0.012 },
  { slug: 'claude-opus-4-8', name: 'Claude Opus 4.8',    company: 'Anthropic', ticker: 'OPUS',  open: 0, color: '#d97757', elo: 1379, usage: 9.7,  bench: 92, downloads: null,      apiPrice: 15.0, vol: 0.010 },
  { slug: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', company: 'Anthropic', ticker: 'SON46', open: 0, color: '#c96544', elo: 1352, usage: 12.9, bench: 88, downloads: null,    apiPrice: 3.0,  vol: 0.008 },
  { slug: 'claude-haiku-4-5', name: 'Claude Haiku 4.5',  company: 'Anthropic', ticker: 'HAIKU', open: 0, color: '#b85636', elo: 1301, usage: 5.4,  bench: 79, downloads: null,     apiPrice: 1.0,  vol: 0.009 },
  { slug: 'gemini-3-pro',    name: 'Gemini 3 Pro',       company: 'Google',    ticker: 'GEM3P', open: 0, color: '#4285f4', elo: 1374, usage: 13.8, bench: 92, downloads: null,      apiPrice: 7.0,  vol: 0.010 },
  { slug: 'gemini-3-flash',  name: 'Gemini 3 Flash',     company: 'Google',    ticker: 'GEM3F', open: 0, color: '#3b78e0', elo: 1322, usage: 8.9,  bench: 83, downloads: null,      apiPrice: 0.6,  vol: 0.009 },
  { slug: 'gemma-3-27b',     name: 'Gemma 3 27B',        company: 'Google',    ticker: 'GMA3',  open: 1, color: '#5a9bf5', elo: 1248, usage: 2.1,  bench: 72, downloads: 4200000,  apiPrice: 0.3,  vol: 0.011 },
  { slug: 'grok-4',          name: 'Grok 4',             company: 'xAI',       ticker: 'GROK4', open: 0, color: '#5b6470', elo: 1356, usage: 4.7,  bench: 89, downloads: null,      apiPrice: 6.0,  vol: 0.013 },
  { slug: 'grok-4-mini',     name: 'Grok 4 mini',        company: 'xAI',       ticker: 'GRK4M', open: 0, color: '#7a828d', elo: 1294, usage: 2.6,  bench: 78, downloads: null,      apiPrice: 0.8,  vol: 0.012 },
  { slug: 'llama-4-maverick', name: 'Llama 4 Maverick',  company: 'Meta',      ticker: 'LLM4M', open: 1, color: '#1877f2', elo: 1289, usage: 5.2,  bench: 81, downloads: 9100000,  apiPrice: 0.5,  vol: 0.012 },
  { slug: 'llama-4-scout',   name: 'Llama 4 Scout',      company: 'Meta',      ticker: 'LLM4S', open: 1, color: '#3b8ef5', elo: 1252, usage: 3.3,  bench: 74, downloads: 6400000,  apiPrice: 0.3,  vol: 0.011 },
  { slug: 'mistral-large-3', name: 'Mistral Large 3',    company: 'Mistral',   ticker: 'MSL3',  open: 1, color: '#ff7000', elo: 1271, usage: 3.0,  bench: 80, downloads: 2800000,  apiPrice: 2.0,  vol: 0.011 },
  { slug: 'mixtral-8x22',    name: 'Mixtral 8x22',       company: 'Mistral',   ticker: 'MX822', open: 1, color: '#ff8a33', elo: 1218, usage: 1.7,  bench: 70, downloads: 5100000,  apiPrice: 0.6,  vol: 0.012 },
  { slug: 'deepseek-v4',     name: 'DeepSeek V4',        company: 'DeepSeek',  ticker: 'DSV4',  open: 1, color: '#4d6bfe', elo: 1333, usage: 7.8,  bench: 87, downloads: 12500000, apiPrice: 0.4,  vol: 0.014 },
  { slug: 'deepseek-r2',     name: 'DeepSeek R2',        company: 'DeepSeek',  ticker: 'DSR2',  open: 1, color: '#3a57e8', elo: 1348, usage: 6.5,  bench: 90, downloads: 8800000,  apiPrice: 0.7,  vol: 0.015 },
  { slug: 'qwen3-max',       name: 'Qwen3 Max',          company: 'Alibaba',   ticker: 'QWNMX', open: 0, color: '#615ced', elo: 1340, usage: 4.4,  bench: 88, downloads: null,      apiPrice: 2.4,  vol: 0.012 },
  { slug: 'qwen3-235b',      name: 'Qwen3 235B',         company: 'Alibaba',   ticker: 'QWN235', open: 1, color: '#7b77f0', elo: 1305, usage: 3.6,  bench: 85, downloads: 7300000,  apiPrice: 0.5,  vol: 0.012 },
  { slug: 'nova-pro',        name: 'Nova Pro',           company: 'Amazon',    ticker: 'NOVA',  open: 0, color: '#ff9900', elo: 1268, usage: 2.2,  bench: 76, downloads: null,      apiPrice: 2.0,  vol: 0.010 },
  { slug: 'command-a',       name: 'Command A',          company: 'Cohere',    ticker: 'CMDA',  open: 0, color: '#39c5bb', elo: 1262, usage: 1.4,  bench: 75, downloads: null,      apiPrice: 2.5,  vol: 0.011 },
  { slug: 'phi-4',           name: 'Phi-4',              company: 'Microsoft', ticker: 'PHI4',  open: 1, color: '#00a4ef', elo: 1224, usage: 1.1,  bench: 71, downloads: 3900000,  apiPrice: 0.2,  vol: 0.013 }
]

// Latest frontier bases that ship in reasoning-effort tiers (low → max). Each
// tier scales token price, Elo and benchmarks: more thinking costs more and
// scores higher. Expanded into the roster below.
const TIER_BASES = [
  { slug: 'gpt-5-5',       name: 'GPT-5.5',        company: 'OpenAI',    ticker: 'GPT55', color: '#10a37f', elo: 1402, bench: 93, apiPrice: 7.0,  vol: 0.011 },
  { slug: 'gpt-5-6',       name: 'GPT-5.6',        company: 'OpenAI',    ticker: 'GPT56', color: '#0e8f6f', elo: 1418, bench: 94, apiPrice: 8.0,  vol: 0.012 },
  { slug: 'claude-fable-5', name: 'Claude Fable 5', company: 'Anthropic', ticker: 'FABL5', color: '#d97757', elo: 1426, bench: 95, apiPrice: 16.0, vol: 0.010 },
  { slug: 'mythos-5',      name: 'Mythos 5',       company: 'Mythos',    ticker: 'MYTH5', color: '#9b6dff', elo: 1389, bench: 90, apiPrice: 5.0,  vol: 0.012 },
  { slug: 'gemini-3-5-pro', name: 'Gemini 3.5 Pro', company: 'Google',   ticker: 'GEM35', color: '#4285f4', elo: 1410, bench: 93, apiPrice: 7.5,  vol: 0.010 },
  { slug: 'grok-4-3',      name: 'Grok 4.3',       company: 'xAI',       ticker: 'GROK43', color: '#5b6470', elo: 1396, bench: 91, apiPrice: 6.5,  vol: 0.013 }
]

const TIERS = [
  { suf: 'low',    tag: 'low',    short: 'Lo', priceMul: 0.45, eloAdj: -48, benchAdj: -13 },
  { suf: 'medium', tag: 'medium', short: 'Md', priceMul: 0.7,  eloAdj: -24, benchAdj: -7 },
  { suf: 'high',   tag: 'high',   short: 'Hi', priceMul: 1.0,  eloAdj: 0,   benchAdj: 0 },
  { suf: 'xhigh',  tag: 'xhigh',  short: 'Xh', priceMul: 1.6,  eloAdj: 12,  benchAdj: 4 },
  { suf: 'max',    tag: 'max',    short: 'Mx', priceMul: 2.4,  eloAdj: 22,  benchAdj: 6 }
]

const TIER_MODELS = TIER_BASES.flatMap((b) =>
  TIERS.map((t) => ({
    slug: `${b.slug}-${t.suf}`,
    name: `${b.name} ${t.tag}`,
    company: b.company,
    ticker: `${b.ticker}${t.short}`,
    open: 0,
    color: b.color,
    elo: b.elo + t.eloAdj,
    usage: 0,
    bench: Math.max(40, Math.min(99, b.bench + t.benchAdj)),
    downloads: null,
    apiPrice: +(b.apiPrice * t.priceMul).toFixed(2),
    vol: b.vol
  }))
)

const ROSTER = [...BASE_ROSTER, ...TIER_MODELS]

// Curated benchmark suite shown per model. Scores derive from each model's
// composite quality (`bench`) with a per-benchmark bias + a stable jitter, so
// they're varied but deterministic (no reseed drift). BridgeBench is the live
// vibe-coding board (bridgebench.ai); the rest mirror well-known evals.
const BENCH_DEFS = [
  { key: 'BridgeBench', off: -2 },
  { key: 'SWE-bench', off: -7 },
  { key: 'GPQA', off: 5 },
  { key: 'AIME', off: -3 },
  { key: 'MMLU', off: 7 }
]

function hashJitter(s) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 7) - 3 // -3..+3
}

function benchmarksFor(model) {
  const base = model.bench ?? 70
  const out = {}
  for (const b of BENCH_DEFS) {
    out[b.key] = Math.max(20, Math.min(99, Math.round(base + b.off + hashJitter(model.slug + b.key))))
  }
  return JSON.stringify(out)
}

// Roster slug -> real provider ids. `or` = OpenRouter id (live pricing for every model);
// `hf` = HuggingFace repo (live downloads, open models only). Best-match to current real
// models in this timeline; unmatched ids simply fall back to the curated seed value.
const PROVIDER_IDS = {
  'gpt-5-2':          { or: 'openai/gpt-5.2',                  hf: null },
  'gpt-5-mini':       { or: 'openai/gpt-5.4-mini',             hf: null },
  'o4':               { or: 'openai/gpt-5.2-pro',              hf: null },
  'claude-opus-4-8':  { or: 'anthropic/claude-opus-4.8',       hf: null },
  'claude-sonnet-4-6':{ or: 'anthropic/claude-sonnet-4.6',     hf: null },
  'claude-haiku-4-5': { or: 'anthropic/claude-haiku-4.5',      hf: null },
  'gemini-3-pro':     { or: 'google/gemini-3.1-pro-preview',   hf: null },
  'gemini-3-flash':   { or: 'google/gemini-3-flash-preview',   hf: null },
  'gemma-3-27b':      { or: 'google/gemma-4-31b-it',           hf: 'google/gemma-3-27b-it' },
  'grok-4':           { or: 'x-ai/grok-4.3',                   hf: null },
  'grok-4-mini':      { or: 'x-ai/grok-4.20',                  hf: null },
  'llama-4-maverick': { or: 'meta-llama/llama-4-maverick',     hf: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct' },
  'llama-4-scout':    { or: 'meta-llama/llama-4-scout',        hf: 'meta-llama/Llama-4-Scout-17B-16E-Instruct' },
  'mistral-large-3':  { or: 'mistralai/mistral-large-2512',    hf: null },
  'mixtral-8x22':     { or: 'mistralai/mixtral-8x22b-instruct', hf: 'mistralai/Mixtral-8x22B-Instruct-v0.1' },
  'deepseek-v4':      { or: 'deepseek/deepseek-v4-pro',        hf: 'deepseek-ai/DeepSeek-V3' },
  'deepseek-r2':      { or: 'deepseek/deepseek-r1-0528',       hf: 'deepseek-ai/DeepSeek-R1' },
  'qwen3-max':        { or: 'qwen/qwen3.7-max',                hf: null },
  'qwen3-235b':       { or: 'qwen/qwen3.5-122b-a10b',          hf: 'Qwen/Qwen3-235B-A22B' },
  'nova-pro':         { or: 'amazon/nova-pro-v1',              hf: null },
  'command-a':        { or: 'cohere/command-a',                hf: null },
  'phi-4':            { or: 'microsoft/phi-4',                 hf: 'microsoft/phi-4' }
}

// Polymarket-style markets on real AI events: releases, capability milestones,
// company actions, leaderboard races. Binary unless multi-outcome. Seed pools set the
// opening implied odds. `rules` states the resolution criteria.
const YN = (yes, no) => [
  { label: 'Yes', pool: yes },
  { label: 'No', pool: no }
]
const END = '2026-12-31T23:59:00Z'
const MARKETS = [
  { slug: 'gpt-6-2026', category: 'Releases', closesAt: END,
    question: 'Will OpenAI release a model branded “GPT-6” in 2026?',
    rules: 'Resolves YES if OpenAI publicly releases a model officially branded “GPT-6” (not a GPT-5.x point release) before 2027-01-01 UTC.',
    outcomes: YN(3000, 7000) },
  { slug: 'claude-opus-5-2026', category: 'Releases', closesAt: END,
    question: 'Will Anthropic ship Claude Opus 5 in 2026?',
    rules: 'Resolves YES if Anthropic makes a model named “Claude Opus 5” generally available before 2027-01-01 UTC.',
    outcomes: YN(4200, 5800) },
  { slug: 'gemini-4-2026', category: 'Releases', closesAt: END,
    question: 'Will Google release Gemini 4 in 2026?',
    rules: 'Resolves YES if Google releases a model branded “Gemini 4” (any tier) before 2027-01-01 UTC.',
    outcomes: YN(3800, 6200) },
  { slug: 'llama-5-2026', category: 'Open weights', closesAt: END,
    question: 'Will Meta release Llama 5 with open weights in 2026?',
    rules: 'Resolves YES if Meta publishes downloadable open weights for a model branded “Llama 5” before 2027-01-01 UTC.',
    outcomes: YN(5500, 4500) },
  { slug: 'elo-1400-2026', category: 'Capability', closesAt: END,
    resolution: 'auto', resolver: { kind: 'elo_threshold', value: 1400 },
    question: 'Will any model exceed 1400 on the LMArena leaderboard in 2026?',
    rules: 'Auto-resolves YES the moment any model in the index reaches a live LMArena Elo of 1400+; otherwise NO at close.',
    outcomes: YN(4800, 5200) },
  { slug: 'elo-1550-2026', category: 'Capability', closesAt: END,
    resolution: 'auto', resolver: { kind: 'elo_threshold', value: 1550 },
    question: 'Will any model break 1550 on LMArena in 2026?',
    rules: 'Auto-resolves YES the moment any model in the index reaches a live LMArena Elo of 1550+; otherwise NO at close.',
    outcomes: YN(3600, 6400) },
  { slug: 'opus-vs-gpt-elo', category: 'Head-to-head', closesInMin: 8,
    resolution: 'auto', resolver: { kind: 'elo_lead', a: 'claude-opus-4-8', b: 'gpt-5-2' },
    question: 'Higher LMArena Elo at close: Claude Opus 4.8 or GPT-5.2?',
    rules: 'Auto-resolves at close to whichever of the two has the higher live LMArena Elo.',
    outcomes: [
      { label: 'Claude Opus 4.8', pool: 2600 },
      { label: 'GPT-5.2', pool: 2400 }
    ] },
  { slug: 'open-tops-arena-2026', category: 'Open vs Closed', closesAt: END,
    question: 'Will an open-weights model reach #1 on LMArena in 2026?',
    rules: 'Resolves YES if a model with publicly downloadable weights holds the #1 overall text rank on LMArena at any point in 2026.',
    outcomes: YN(2700, 7300) },
  { slug: 'swebench-90-2026', category: 'Capability', closesAt: END,
    question: 'Will a model top 90% on SWE-bench Verified in 2026?',
    rules: 'Resolves YES if a credible report shows a model scoring above 90% on SWE-bench Verified before 2027-01-01 UTC.',
    outcomes: YN(4600, 5400) },
  { slug: 'api-price-war-2026', category: 'Pricing', closesAt: END,
    question: 'Will frontier API prices fall more than 50% during 2026?',
    rules: 'Resolves YES if the blended $/Mtok of a top-3 LMArena model drops by >50% versus its 2026-01-01 price.',
    outcomes: YN(4000, 6000) },
  { slug: 'imo-gold-2026', category: 'Milestone', closesAt: '2026-07-31T23:59:00Z',
    question: 'Will an AI achieve gold-medal performance at the 2026 IMO?',
    rules: 'Resolves YES if an AI system achieves a gold-medal-equivalent score on the 2026 International Mathematical Olympiad under recognized conditions.',
    outcomes: YN(6200, 3800) },
  { slug: 'openai-ipo-2026', category: 'Company', closesAt: END,
    question: 'Will OpenAI announce an IPO in 2026?',
    rules: 'Resolves YES if OpenAI publicly files for or formally announces an initial public offering in 2026.',
    outcomes: YN(1500, 8500) },
  { slug: 'top-lab-q3-2026', category: 'Leaderboard', closesAt: '2026-09-30T23:59:00Z',
    question: 'Which lab has the #1 LMArena model at the end of Q3 2026?',
    rules: 'Resolves to the lab whose model holds the #1 overall text rank on LMArena on 2026-09-30 UTC.',
    outcomes: [
      { label: 'OpenAI', pool: 3400 },
      { label: 'Anthropic', pool: 3100 },
      { label: 'Google', pool: 2600 },
      { label: 'xAI', pool: 1200 },
      { label: 'Other', pool: 700 }
    ] }
]

// Head-to-head battles. closesInMin from seed time; the auto-settle loop resolves them
// by Elo win-probability when they close (admin can force-settle sooner).
const BATTLES = [
  { a: 'gpt-5-2', b: 'claude-opus-4-8', category: 'Reasoning', poolA: 1200, poolB: 1100, closesInMin: 9 },
  { a: 'gemini-3-pro', b: 'grok-4', category: 'Coding', poolA: 900, poolB: 700, closesInMin: 6 },
  { a: 'deepseek-r2', b: 'o4', category: 'Math', poolA: 600, poolB: 800, closesInMin: 13 },
  { a: 'claude-sonnet-4-6', b: 'gpt-5-mini', category: 'Creative writing', poolA: 1000, poolB: 1000, closesInMin: 4 }
]

export function seedDatabase({ force = false } = {}) {
  const now = new Date().toISOString()
  const modelCount = db.prepare('SELECT COUNT(*) AS n FROM models').get().n

  if (modelCount === 0 || force) {
    const insModel = db.prepare(`
      INSERT INTO models (slug, name, company, ticker, open_source, color, volatility, created_at)
      VALUES (@slug, @name, @company, @ticker, @open, @color, @vol, @created_at)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name, company = excluded.company, ticker = excluded.ticker,
        open_source = excluded.open_source, color = excluded.color, volatility = excluded.volatility
    `)
    const insSignal = db.prepare(`
      INSERT INTO model_signals (model_id, elo, usage, bench, downloads, api_price, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const idBySlug = db.prepare('SELECT id FROM models WHERE slug = ?')
    const setBenchmarks = db.prepare('UPDATE models SET benchmarks = ? WHERE id = ?')
    const insModels = db.transaction(() => {
      for (const m of ROSTER) {
        insModel.run({ ...m, created_at: now })
        // On upsert-conflict lastInsertRowid is unreliable, so resolve id by slug.
        const modelId = idBySlug.get(m.slug).id
        insSignal.run(modelId, m.elo, m.usage, m.bench, m.downloads, m.apiPrice, now)
        setBenchmarks.run(benchmarksFor(m), modelId)
      }
    })
    insModels()
  }

  // Always backfill provider ids (so existing DBs get the live-feed mapping too).
  const setIds = db.prepare('UPDATE models SET openrouter_id = @or, hf_id = @hf WHERE slug = @slug')
  db.transaction(() => {
    for (const [slug, ids] of Object.entries(PROVIDER_IDS)) {
      setIds.run({ slug, or: ids.or, hf: ids.hf })
    }
  })()

  // Drop earlier placeholder markets that the richer set supersedes (only if unbet).
  for (const slug of ['gpt-6-by-2027', 'open-model-tops-arena-2026']) {
    const m = db.prepare('SELECT id FROM markets WHERE slug = ?').get(slug)
    if (m) {
      const bets = db.prepare('SELECT COUNT(*) AS n FROM market_positions WHERE market_id = ?').get(m.id).n
      if (bets === 0) db.prepare('DELETE FROM markets WHERE id = ?').run(m.id)
    }
  }

  // Seed any markets missing by slug (idempotent — adds new ones to existing DBs).
  {
    const insMarket = db.prepare(`
      INSERT INTO markets (slug, question, category, rules, resolution, resolver, closes_at, created_at)
      VALUES (@slug, @question, @category, @rules, @resolution, @resolver, @closesAt, @created_at)
      ON CONFLICT(slug) DO NOTHING
    `)
    const insOutcome = db.prepare('INSERT INTO market_outcomes (market_id, label, pool) VALUES (?, ?, ?)')
    db.transaction(() => {
      for (const mk of MARKETS) {
        const closesAt =
          mk.closesAt || (mk.closesInMin ? new Date(Date.now() + mk.closesInMin * 60000).toISOString() : null)
        const info = insMarket.run({
          slug: mk.slug,
          question: mk.question,
          category: mk.category,
          rules: mk.rules || null,
          resolution: mk.resolution || 'admin',
          resolver: mk.resolver ? JSON.stringify(mk.resolver) : null,
          closesAt,
          created_at: now
        })
        if (info.changes === 0) continue
        for (const o of mk.outcomes) insOutcome.run(info.lastInsertRowid, o.label, o.pool)
      }
    })()

    // Backfill resolution/resolver/rules on markets that already existed (DO NOTHING
    // skips updates), so auto-resolution specs reach pre-existing DBs.
    const backfill = db.prepare(
      `UPDATE markets SET resolution = @resolution, resolver = @resolver, rules = COALESCE(rules, @rules)
         WHERE slug = @slug AND status != 'resolved'`
    )
    db.transaction(() => {
      for (const mk of MARKETS) {
        backfill.run({
          slug: mk.slug,
          resolution: mk.resolution || 'admin',
          resolver: mk.resolver ? JSON.stringify(mk.resolver) : null,
          rules: mk.rules || null
        })
      }
    })()
  }

  // Seed battles if none exist.
  if (db.prepare('SELECT COUNT(*) AS n FROM battles').get().n === 0) {
    const idBySlug = {}
    for (const r of db.prepare('SELECT id, slug FROM models').all()) idBySlug[r.slug] = r.id
    const insBattle = db.prepare(`
      INSERT INTO battles (model_a_id, model_b_id, category, pool_a, pool_b, closes_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    db.transaction(() => {
      for (const b of BATTLES) {
        const a = idBySlug[b.a]
        const bb = idBySlug[b.b]
        if (!a || !bb) continue
        const closesAt = new Date(Date.now() + b.closesInMin * 60000).toISOString()
        insBattle.run(a, bb, b.category, b.poolA, b.poolB, closesAt, now)
      }
    })()
  }

  // Price = votes × per-vote value → $0 on a fresh roster. prev_close tracks it
  // so day-one 24h reads 0%.
  recomputePrices()
  db.prepare('UPDATE models SET prev_close = price').run()

  return {
    seeded: modelCount === 0 || force,
    models: ROSTER.length,
    markets: MARKETS.length,
    battles: BATTLES.length
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('seed.js')
if (isMain) {
  const result = seedDatabase({ force: true })
  console.log('[seed]', result)
  process.exit(0)
}
