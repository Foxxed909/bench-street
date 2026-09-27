const STORAGE_KEY = 'benchstreet_internal_state_v1'
const SESSION_KEY = 'benchstreet_internal_session'
const VERSION = 1
const STARTING_BALANCE = 100000
const VOTE_RATE = 5
const COST_REF = 5
const COST_MIN = 0.5
const COST_MAX = 2
const SENTIMENT_MAX_TILT = 0.15

const MODEL_SEED = [
  ['gpt-5-6', 'GPT-5.6 Sol', 'OpenAI', 'GPT56', false, '#10a37f', 1444, 12.1, 96, null, 11.25, '2026-07-09', null, 'active'],
  ['gpt-5-6-pro', 'GPT-5.6 Sol Pro', 'OpenAI', 'GPT56P', false, '#0e8f6f', 1452, 4.7, 97, null, 22.5, '2026-07-09', null, 'active'],
  ['gpt-5-6-terra', 'GPT-5.6 Terra', 'OpenAI', 'GPT56T', false, '#17b389', 1406, 8.8, 92, null, 5.63, '2026-07-09', null, 'active'],
  ['gpt-5-6-luna', 'GPT-5.6 Luna', 'OpenAI', 'GPT56L', false, '#1fc094', 1368, 10.3, 87, null, 2.25, '2026-07-09', null, 'active'],
  ['gemini-omni', 'Gemini Omni', 'Google', 'GEMOM', false, '#4285f4', 1430, 9.8, 95, null, 9.0, '2026-05-20', null, 'active'],
  ['gemini-3-5-pro', 'Gemini 3.5 Pro', 'Google', 'GEM35P', false, '#4285f4', 1412, 7.3, 93, null, 7.5, '2026-04-15', null, 'active'],
  ['gemini-3-5-flash', 'Gemini 3.5 Flash', 'Google', 'GEM35F', false, '#3b78e0', 1352, 8.1, 86, null, 2.33, '2026-04-15', null, 'active'],
  ['grok-4-5', 'Grok 4.5', 'xAI', 'GROK45', false, '#5b6470', 1420, 6.9, 93, null, 3.0, '2026-07-08', null, 'active'],
  ['grok-4-3-heavy', 'Grok 4.3 Heavy', 'xAI', 'GRK43H', false, '#7a828d', 1414, 3.9, 93, null, 13.0, '2026-05-01', null, 'active'],
  ['kimi-k3', 'Kimi K3', 'Moonshot', 'KIMI3', true, '#16b8f3', 1428, 6.1, 94, 350000, 1.6, '2026-07-16', null, 'active'],
  ['deepseek-r2', 'DeepSeek R2', 'DeepSeek', 'DSR2', true, '#3a57e8', 1348, 8.4, 90, 8800000, 0.7, '2026-01-05', 'high', 'active'],
  ['glm-5-2', 'GLM-5.2', 'Zhipu AI', 'GLM52', true, '#2f6fed', 1368, 6.2, 91, 6100000, 1.73, '2026-06-15', null, 'active'],
  ['qwen3-max', 'Qwen3 Max', 'Alibaba', 'QWNMX', false, '#615ced', 1340, 7.1, 88, null, 2.4, '2025-12-10', 'high', 'active'],
  ['llama-4-maverick', 'Llama 4 Maverick', 'Meta', 'LLM4M', true, '#1877f2', 1289, 5.2, 81, 9100000, 0.5, '2025-09-25', null, 'active'],
  ['muse-spark', 'Muse Spark', 'Meta', 'MUSE', true, '#1877f2', 1361, 4.6, 88, 5200000, 0.5, '2026-04-08', null, 'active'],
  ['mistral-large-3', 'Mistral Large 3', 'Mistral', 'MSL3', true, '#ff7000', 1271, 3.0, 80, 2800000, 2.0, '2025-10-30', null, 'active'],
  ['command-a-plus', 'Command A+', 'Cohere', 'CMDAP', false, '#39c5bb', 1305, 2.2, 82, null, 3.0, '2026-05-20', null, 'active'],
  ['claude-fable-5', 'Claude Fable 5', 'Anthropic', 'FABL5', false, '#d97757', 1440, 5.5, 96, null, 20.0, '2026-06-09', null, 'suspended'],
  ['claude-mythos-5', 'Claude Mythos 5', 'Anthropic', 'MYTH5', false, '#b5532f', 1450, 4.1, 97, null, 22.0, '2026-06-09', null, 'suspended']
]

const MARKET_SEED = [
  {
    slug: 'gpt-6-2026',
    category: 'Releases',
    closesAt: '2026-12-31T23:59:00Z',
    question: 'Will OpenAI release a model branded “GPT-6” in 2026?',
    rules: 'Resolves YES if OpenAI publicly releases a model officially branded GPT-6 before 2027-01-01 UTC.',
    outcomes: [['Yes', 3200], ['No', 6800]]
  },
  {
    slug: 'gemini-4-2026',
    category: 'Releases',
    closesAt: '2026-12-31T23:59:00Z',
    question: 'Will Google release Gemini 4 in 2026?',
    rules: 'Resolves YES if Google releases a model branded Gemini 4 before 2027-01-01 UTC.',
    outcomes: [['Yes', 4100], ['No', 5900]]
  },
  {
    slug: 'open-weights-1-2026',
    category: 'Open weights',
    closesAt: '2026-12-31T23:59:00Z',
    question: 'Will an open-weights model reach #1 on a major public AI leaderboard in 2026?',
    rules: 'Resolve using a documented public overall leaderboard result before 2027-01-01 UTC.',
    outcomes: [['Yes', 3600], ['No', 6400]]
  },
  {
    slug: 'benchstreet-year-end',
    category: 'Bench Street',
    closesAt: '2026-12-31T23:59:00Z',
    question: 'Which model will finish 2026 with the highest Bench Street price?',
    rules: 'Resolves to the highest public Bench Street model price at 23:59 UTC on 2026-12-31.',
    outcomes: [['GPT-5.6 Sol Pro', 2800], ['Claude Mythos 5', 2400], ['Gemini Omni', 2100], ['Kimi K3', 1500], ['Grok 4.5', 1200]]
  },
  {
    slug: 'elo-1550-2026',
    category: 'Capability',
    closesAt: '2026-12-31T23:59:00Z',
    question: 'Will any tracked model break 1550 Elo in 2026?',
    rules: 'Resolves YES if a tracked model reaches a documented 1550+ Elo score before year end.',
    outcomes: [['Yes', 3300], ['No', 6700]]
  }
]

const BATTLE_SEED = [
  ['Frontier', 'gpt-5-6-pro', 'gemini-omni', 42],
  ['Reasoning', 'gpt-5-6', 'grok-4-5', 58],
  ['Open weights', 'kimi-k3', 'deepseek-r2', 71],
  ['Fast lane', 'gpt-5-6-luna', 'gemini-3-5-flash', 86]
]

const BOT_SEED = [
  ['quant_fox', 112430],
  ['latentbull', 108920],
  ['benchmarkmaxi', 104650],
  ['tokenbear', 101880],
  ['evals_only', 98840]
]

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const isoNow = () => new Date().toISOString()

function hashNumber(text) {
  let h = 2166136261
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function perVoteValue(tokenPrice) {
  if (tokenPrice == null || Number.isNaN(Number(tokenPrice))) return VOTE_RATE
  const factor = clamp(Number(tokenPrice) / COST_REF, COST_MIN, COST_MAX)
  return round2(VOTE_RATE * factor)
}

function sentimentBoost(score) {
  return 1 + clamp(Number(score || 0), -1, 1) * SENTIMENT_MAX_TILT
}

function priceFor(net, tokenPrice, sentiment) {
  return round2(Math.max(0, Number(net || 0)) * perVoteValue(tokenPrice) * sentimentBoost(sentiment))
}

function publicPrice(model) {
  return priceFor(
    Number(model.baseVotes || 0) + Number(model.likes || 0) - Number(model.dislikes || 0),
    model.tokenPrice,
    model.sentiment
  )
}

function executionPrice(model, myVote) {
  const stance = myVote === 1 || myVote === -1 ? myVote : 0
  return priceFor(
    Number(model.baseVotes || 0) + Number(model.likes || 0) - Number(model.dislikes || 0) - stance,
    model.tokenPrice,
    model.sentiment
  )
}

function benchmarksFor(model) {
  const jitter = (key) => (hashNumber(model.slug + key) % 7) - 3
  const score = (offset, key) => clamp(Math.round(model.bench + offset + jitter(key)), 20, 99)
  return {
    BridgeBench: score(-2, 'BridgeBench'),
    'SWE-bench': score(-7, 'SWE-bench'),
    GPQA: score(5, 'GPQA'),
    AIME: score(-3, 'AIME'),
    MMLU: score(7, 'MMLU')
  }
}

function makeModels() {
  return MODEL_SEED.map((row, index) => {
    const [slug, name, company, ticker, openSource, color, elo, usage, bench, downloads, tokenPrice, releasedAt, effort, status] = row
    const likes = 16 + (hashNumber(slug + 'likes') % 28)
    const dislikes = 5 + (hashNumber(slug + 'dislikes') % 12)
    const baseVotes = 10 + Math.round((bench - 70) / 3)
    const sentiment = ((hashNumber(slug + 'sentiment') % 31) - 15) / 100
    const model = {
      id: index + 1,
      slug,
      name,
      company,
      ticker,
      openSource,
      color,
      elo,
      usage,
      bench,
      downloads,
      tokenPrice,
      releasedAt,
      effort,
      status,
      statusNote: status === 'suspended' ? 'Temporarily suspended in this internal scenario. Trading and voting are disabled.' : null,
      likes,
      dislikes,
      baseVotes,
      sentiment
    }
    const price = publicPrice(model)
    const drift = ((hashNumber(slug + 'prev') % 9) - 4) / 100
    model.prevClose = round2(price / (1 + drift || 1))
    return model
  })
}

function makeMarkets() {
  let outcomeId = 1
  return MARKET_SEED.map((m, index) => ({
    id: index + 1,
    slug: m.slug,
    category: m.category,
    closesAt: m.closesAt,
    question: m.question,
    rules: m.rules,
    status: 'open',
    resolvedOutcomeId: null,
    outcomes: m.outcomes.map(([label, pool]) => ({ id: outcomeId++, label, pool }))
  }))
}

function makeBattles(models) {
  const bySlug = new Map(models.map((m) => [m.slug, m]))
  const now = Date.now()
  return BATTLE_SEED.map(([category, aSlug, bSlug, minutes], index) => ({
    id: index + 1,
    category,
    modelA: bySlug.get(aSlug).id,
    modelB: bySlug.get(bSlug).id,
    closesAt: new Date(now + minutes * 60 * 1000).toISOString(),
    status: 'open',
    poolA: 0,
    poolB: 0,
    winnerId: null
  }))
}

function freshState() {
  const models = makeModels()
  return {
    version: VERSION,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    user: null,
    votes: {},
    models,
    holdings: {},
    trades: [],
    markets: makeMarkets(),
    marketPositions: [],
    battles: makeBattles(models),
    battlePositions: [],
    comments: {},
    bots: BOT_SEED.map(([username, netWorth], i) => ({
      id: i + 10,
      username,
      cash: round2(netWorth * 0.52),
      holdingsValue: round2(netWorth * 0.41),
      lockedStake: round2(netWorth * 0.07),
      netWorth
    })),
    meta: {
      signalsUpdatedAt: isoNow(),
      eventSeq: 1
    }
  }
}

function loadState() {
  if (typeof localStorage === 'undefined') return freshState()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.models)) {
      const state = freshState()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return state
    }
    return parsed
  } catch {
    const state = freshState()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore hardened storage contexts.
    }
    return state
  }
}

function saveState(state) {
  state.updatedAt = isoNow()
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  return state
}

function sessionActive() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(SESSION_KEY) === '1'
}

function setSession(active) {
  if (typeof localStorage === 'undefined') return
  if (active) localStorage.setItem(SESSION_KEY, '1')
  else localStorage.removeItem(SESSION_KEY)
}

function broadcast(event, payload) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('benchstreet:socket', { detail: { event, payload } }))
  window.dispatchEvent(new CustomEvent('benchstreet:state'))
}

function fail(message, status) {
  const error = new Error(message)
  error.status = status || 400
  throw error
}

function requireUser(state) {
  if (!sessionActive() || !state.user) fail('Not authenticated', 401)
  return state.user
}

function publicUser(state) {
  if (!state.user) return null
  return {
    id: state.user.id,
    username: state.user.username,
    email: null,
    cash: round2(state.user.cash),
    isAdmin: true
  }
}

function modelBySlug(state, slug) {
  return state.models.find((m) => m.slug === slug)
}

function modelById(state, id) {
  return state.models.find((m) => m.id === Number(id))
}

function modelView(state, model) {
  const myVote = Number(state.votes[model.slug] || 0)
  const price = publicPrice(model)
  const total = model.likes + model.dislikes
  return {
    id: model.id,
    slug: model.slug,
    name: model.name,
    company: model.company,
    ticker: model.ticker,
    openSource: !!model.openSource,
    color: model.color,
    price,
    executionPrice: executionPrice(model, myVote),
    selfVoteExcluded: myVote !== 0,
    prevClose: model.prevClose,
    tokenPrice: model.tokenPrice,
    perVoteValue: perVoteValue(model.tokenPrice),
    likes: model.likes,
    dislikes: model.dislikes,
    net: model.likes - model.dislikes,
    approval: total ? Math.round((model.likes / total) * 100) : null,
    myVote,
    status: model.status || 'active',
    statusNote: model.statusNote || null,
    releasedAt: model.releasedAt,
    effort: model.effort || null,
    baseVotes: model.baseVotes,
    liveSignals: true,
    sentiment: model.sentiment,
    change: round2(price - model.prevClose),
    changePct: model.prevClose ? round2(((price - model.prevClose) / model.prevClose) * 100) : 0,
    benchmarks: benchmarksFor(model),
    signals: {
      elo: model.elo,
      usage: model.usage,
      bench: model.bench,
      downloads: model.downloads,
      apiPrice: model.tokenPrice
    }
  }
}

function candlesFor(model) {
  const end = publicPrice(model)
  const start = model.prevClose || end
  const now = Math.floor(Date.now() / 60000) * 60
  return Array.from({ length: 48 }, (_, i) => {
    const t = now - (47 - i) * 1800
    const progress = i / 47
    const wobble = Math.sin(i * 0.9 + model.id) * Math.max(0.4, end * 0.005)
    const close = round2(start + (end - start) * progress + wobble)
    return { t, open: close, high: round2(close * 1.003), low: round2(close * 0.997), close }
  })
}

function lockedStake(state) {
  const market = state.marketPositions.filter((p) => !p.settled).reduce((sum, p) => sum + p.stake, 0)
  const battles = state.battlePositions.filter((p) => !p.settled).reduce((sum, p) => sum + p.stake, 0)
  return round2(market + battles)
}

function portfolio(state) {
  const user = requireUser(state)
  const positions = Object.entries(state.holdings)
    .filter(([, h]) => h.shares > 0)
    .map(([slug, h]) => {
      const model = modelBySlug(state, slug)
      const myVote = Number(state.votes[slug] || 0)
      const price = executionPrice(model, myVote)
      const value = round2(h.shares * price)
      const cost = round2(h.shares * h.avgCost)
      return {
        modelId: model.id,
        slug,
        name: model.name,
        ticker: model.ticker,
        color: model.color,
        shares: h.shares,
        avgCost: h.avgCost,
        price,
        publicPrice: publicPrice(model),
        perVoteValue: perVoteValue(model.tokenPrice),
        baseVotes: model.baseVotes,
        likes: model.likes,
        dislikes: model.dislikes,
        myVote,
        selfVoteExcluded: myVote !== 0,
        value,
        cost,
        pnl: round2(value - cost),
        pnlPct: cost ? round2(((value - cost) / cost) * 100) : 0
      }
    })
    .sort((a, b) => b.value - a.value)
  const holdingsValue = round2(positions.reduce((sum, p) => sum + p.value, 0))
  const locked = lockedStake(state)
  return {
    cash: round2(user.cash),
    holdingsValue,
    lockedStake: locked,
    netWorth: round2(user.cash + holdingsValue + locked),
    positions
  }
}

function shapeMarket(market) {
  const total = market.outcomes.reduce((sum, o) => sum + o.pool, 0) || 1
  const status = market.status === 'resolved'
    ? 'resolved'
    : Date.parse(market.closesAt) <= Date.now()
      ? 'closed'
      : 'open'
  const winner = market.outcomes.find((o) => o.id === market.resolvedOutcomeId)
  return {
    id: market.id,
    slug: market.slug,
    question: market.question,
    category: market.category,
    rules: market.rules,
    status,
    resolution: 'manual',
    autoResolvable: false,
    closesAt: market.closesAt,
    resolvedOutcomeId: market.resolvedOutcomeId,
    winnerLabel: winner ? winner.label : null,
    isBinary: market.outcomes.length === 2 && market.outcomes[0].label === 'Yes' && market.outcomes[1].label === 'No',
    traders: 1,
    volume: round2(total),
    pool: round2(total),
    outcomes: market.outcomes.map((o) => ({
      id: o.id,
      label: o.label,
      pool: round2(o.pool),
      impliedPct: round2((o.pool / total) * 100),
      payout: round2(total / Math.max(o.pool, 1))
    }))
  }
}

function eloWinProb(a, b) {
  return 1 / (1 + Math.pow(10, (Number(b || 1200) - Number(a || 1200)) / 400))
}

function battleStatus(battle) {
  if (battle.status === 'settled') return 'settled'
  return Date.parse(battle.closesAt) <= Date.now() ? 'closing' : 'open'
}

function shapeBattle(state, battle) {
  const a = modelById(state, battle.modelA)
  const b = modelById(state, battle.modelB)
  const total = battle.poolA + battle.poolB
  const denom = total || 1
  const shapedSide = (key, model, pool, other) => ({
    key,
    id: model.id,
    slug: model.slug,
    name: model.name,
    ticker: model.ticker,
    color: model.color,
    price: publicPrice(model),
    status: model.status,
    elo: model.elo,
    pool: round2(pool),
    impliedPct: round2((pool / denom) * 100),
    payout: round2(denom / Math.max(pool, 1)),
    eloProb: round2(eloWinProb(model.elo, other.elo) * 100),
    won: battle.winnerId === model.id
  })
  return {
    id: battle.id,
    category: battle.category,
    status: battleStatus(battle),
    closesAt: battle.closesAt,
    pool: round2(total),
    hasBets: total > 0,
    traders: total > 0 ? 1 : 0,
    winnerId: battle.winnerId,
    sides: [
      shapedSide('a', a, battle.poolA, b),
      shapedSide('b', b, battle.poolB, a)
    ]
  }
}

function settleMarket(state, market, outcomeId) {
  const winner = market.outcomes.find((o) => o.id === Number(outcomeId))
  if (!winner) fail('invalid outcome')
  if (market.status === 'resolved') fail('market already resolved')
  const totalPool = market.outcomes.reduce((sum, o) => sum + o.pool, 0)
  const winnerPool = winner.pool || 1
  let paidOut = 0
  for (const p of state.marketPositions.filter((p) => p.marketId === market.id && !p.settled)) {
    p.settled = true
    if (p.outcomeId === winner.id) {
      p.payout = round2(p.stake * (totalPool / winnerPool))
      paidOut += p.payout
      state.user.cash = round2(state.user.cash + p.payout)
    } else {
      p.payout = 0
    }
  }
  market.status = 'resolved'
  market.resolvedOutcomeId = winner.id
  return { winner: winner.label, paidOut: round2(paidOut) }
}

function settleBattle(state, battle) {
  if (battle.status === 'settled') fail('battle already settled')
  const a = modelById(state, battle.modelA)
  const b = modelById(state, battle.modelB)
  const pA = eloWinProb(a.elo, b.elo)
  const roll = ((hashNumber(String(battle.id) + String(state.meta.eventSeq++)) % 10000) / 10000)
  const winnerId = roll <= pA ? a.id : b.id
  const total = battle.poolA + battle.poolB
  const winnerPool = winnerId === a.id ? battle.poolA : battle.poolB
  for (const p of state.battlePositions.filter((p) => p.battleId === battle.id && !p.settled)) {
    p.settled = true
    if (p.sideModelId === winnerId && winnerPool > 0) {
      p.payout = round2(p.stake * (total / winnerPool))
      state.user.cash = round2(state.user.cash + p.payout)
    } else {
      p.payout = 0
    }
  }
  battle.status = 'settled'
  battle.winnerId = winnerId
}

function marketMine(state) {
  requireUser(state)
  return state.marketPositions.slice().reverse().map((p) => {
    const market = state.markets.find((m) => m.id === p.marketId)
    const outcome = market.outcomes.find((o) => o.id === p.outcomeId)
    return {
      id: p.id,
      stake: p.stake,
      settled: p.settled,
      payout: p.payout || 0,
      created_at: p.createdAt,
      outcome_id: p.outcomeId,
      slug: market.slug,
      question: market.question,
      status: shapeMarket(market).status,
      closes_at: market.closesAt,
      resolved_outcome_id: market.resolvedOutcomeId,
      outcome: outcome.label,
      won: market.resolvedOutcomeId != null && p.outcomeId === market.resolvedOutcomeId
    }
  })
}

function battleMine(state) {
  requireUser(state)
  return state.battlePositions.slice().reverse().map((p) => {
    const battle = state.battles.find((b) => b.id === p.battleId)
    const sideModel = modelById(state, p.sideModelId)
    return {
      id: p.id,
      stake: p.stake,
      settled: p.settled,
      payout: p.payout || 0,
      created_at: p.createdAt,
      side_model_id: p.sideModelId,
      battle_id: battle.id,
      status: battleStatus(battle),
      closes_at: battle.closesAt,
      winner_id: battle.winnerId,
      category: battle.category,
      side_ticker: sideModel.ticker,
      side_name: sideModel.name,
      won: battle.winnerId != null && battle.winnerId === p.sideModelId
    }
  })
}

function leaderboard(state) {
  const rows = state.bots.map((b) => ({ ...b }))
  if (state.user) {
    const p = sessionActive() ? portfolio(state) : (() => {
      const old = sessionActive()
      if (!old) setSession(true)
      try { return portfolio(state) } finally { if (!old) setSession(false) }
    })()
    rows.push({
      username: state.user.username,
      cash: p.cash,
      holdingsValue: p.holdingsValue,
      lockedStake: p.lockedStake,
      netWorth: p.netWorth
    })
  }
  return rows.sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username)).slice(0, 50)
}

function validatePositiveMoney(value, label) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0.01 || Math.round(amount * 100) !== amount * 100) {
    fail((label || 'amount') + ' must be at least $0.01 and use at most 2 decimal places')
  }
  return round2(amount)
}

function routeParts(path) {
  return String(path || '/').split('?')[0].split('/').filter(Boolean)
}

export async function internalRequest(method, path, body) {
  const state = loadState()
  const verb = String(method || 'GET').toUpperCase()
  const parts = routeParts(path)

  if (verb === 'GET' && path === '/auth/me') {
    return { user: sessionActive() ? publicUser(state) : null }
  }

  if (verb === 'POST' && path === '/auth/login') {
    const username = String(body && body.username || '').trim()
    if (!/^[a-zA-Z0-9_-]{2,20}$/.test(username)) {
      fail('Use 2–20 letters, numbers, dashes or underscores for your internal handle.')
    }
    if (!state.user) {
      state.user = { id: 1, username, cash: STARTING_BALANCE, createdAt: isoNow() }
      saveState(state)
    } else if (state.user.username.toLowerCase() !== username.toLowerCase()) {
      fail('This browser already has an internal desk for ' + state.user.username + '. Reset it from Internal Desk to start over.')
    }
    setSession(true)
    const user = publicUser(state)
    broadcast('session:changed', { user })
    return { token: 'internal-session', refreshToken: 'internal-session', user }
  }

  if (verb === 'POST' && path === '/auth/refresh') {
    if (!state.user) fail('No internal profile found', 401)
    setSession(true)
    return { token: 'internal-session', refreshToken: 'internal-session', user: publicUser(state) }
  }

  if (verb === 'GET' && path === '/models') {
    return {
      models: state.models.map((m) => modelView(state, m)).sort((a, b) => b.price - a.price),
      signals: { updatedAt: state.meta.signalsUpdatedAt, mode: 'internal' },
      voteRate: VOTE_RATE
    }
  }

  if (parts[0] === 'models' && parts.length >= 2) {
    const slug = parts[1]
    const model = modelBySlug(state, slug)
    if (!model) fail('model not found', 404)

    if (parts.length === 2 && verb === 'GET') {
      return { model: modelView(state, model), candles: candlesFor(model), voteRate: VOTE_RATE }
    }

    if (parts.length === 3 && parts[2] === 'vote' && verb === 'POST') {
      requireUser(state)
      if (model.status !== 'active') fail('voting is disabled for this model')
      const want = Number(body && body.value)
      if (want !== 1 && want !== -1) fail('value must be 1 or -1')
      const current = Number(state.votes[slug] || 0)
      if (current === want) {
        if (want === 1) model.likes -= 1
        else model.dislikes -= 1
        delete state.votes[slug]
      } else {
        if (current === 1) model.likes -= 1
        if (current === -1) model.dislikes -= 1
        if (want === 1) model.likes += 1
        else model.dislikes += 1
        state.votes[slug] = want
      }
      saveState(state)
      const view = modelView(state, model)
      broadcast('prices', { t: Date.now(), models: [{ id: model.id, price: view.price, likes: model.likes, dislikes: model.dislikes }] })
      return { ok: true, myVote: view.myVote, likes: model.likes, dislikes: model.dislikes, price: view.price, executionPrice: view.executionPrice }
    }

    if (parts.length === 3 && parts[2] === 'comments' && verb === 'GET') {
      const comments = (state.comments[slug] || []).slice().reverse().map((c) => ({
        id: c.id,
        body: c.body,
        username: c.username,
        createdAt: c.createdAt,
        mine: !!state.user && c.username === state.user.username
      }))
      return { comments }
    }

    if (parts.length === 3 && parts[2] === 'comments' && verb === 'POST') {
      const user = requireUser(state)
      const text = String(body && body.body || '').trim()
      if (!text) fail('comment cannot be empty')
      if (text.length > 500) fail('comment too long (max 500)')
      const list = state.comments[slug] || (state.comments[slug] = [])
      const comment = { id: state.meta.eventSeq++, body: text, username: user.username, createdAt: isoNow() }
      list.push(comment)
      saveState(state)
      broadcast('comment:new', { slug, comment })
      return { comment: { ...comment, mine: true } }
    }

    if (parts.length === 4 && parts[2] === 'comments' && verb === 'DELETE') {
      const user = requireUser(state)
      const list = state.comments[slug] || []
      const index = list.findIndex((c) => String(c.id) === String(parts[3]))
      if (index < 0) fail('comment not found', 404)
      if (list[index].username !== user.username && !user.isAdmin) fail('not your comment', 403)
      list.splice(index, 1)
      saveState(state)
      broadcast('comment:deleted', { slug, id: parts[3] })
      return { ok: true }
    }
  }

  if (verb === 'POST' && path === '/trade') {
    const user = requireUser(state)
    const slug = String(body && body.slug || '')
    const side = String(body && body.side || '')
    const shares = Number(body && body.shares)
    if (side !== 'buy' && side !== 'sell') fail("side must be 'buy' or 'sell'")
    if (!Number.isFinite(shares) || shares <= 0 || shares > 1000000) fail('shares must be a positive finite number')
    const model = modelBySlug(state, slug)
    if (!model) fail('model not found', 404)
    if (model.status !== 'active') fail('trading is disabled for this model')
    const myVote = Number(state.votes[slug] || 0)
    const price = executionPrice(model, myVote)
    const total = round2(price * shares)
    const holding = state.holdings[slug] || { shares: 0, avgCost: 0 }
    if (side === 'buy') {
      if (user.cash + 1e-9 < total) fail('insufficient funds')
      const newShares = Number((holding.shares + shares).toFixed(6))
      const avgCost = newShares ? (holding.avgCost * holding.shares + total) / newShares : 0
      state.holdings[slug] = { shares: newShares, avgCost: avgCost }
      user.cash = round2(user.cash - total)
    } else {
      if (holding.shares + 1e-9 < shares) fail('not enough shares')
      const remaining = Number((holding.shares - shares).toFixed(6))
      if (remaining <= 0) delete state.holdings[slug]
      else state.holdings[slug] = { ...holding, shares: remaining }
      user.cash = round2(user.cash + total)
    }
    state.trades.unshift({
      id: state.meta.eventSeq++,
      side,
      shares,
      price,
      total,
      created_at: isoNow(),
      slug,
      ticker: model.ticker,
      name: model.name
    })
    state.trades = state.trades.slice(0, 100)
    saveState(state)
    broadcast('portfolio:changed', { slug })
    return {
      ok: true,
      executed: { side, shares, price, publicPrice: publicPrice(model), selfVoteExcluded: myVote !== 0, total },
      cash: user.cash
    }
  }

  if (verb === 'GET' && path === '/portfolio') {
    return portfolio(state)
  }

  if (verb === 'GET' && path === '/portfolio/trades') {
    requireUser(state)
    return { trades: state.trades.slice(0, 100) }
  }

  if (verb === 'GET' && path === '/markets') {
    return { markets: state.markets.map(shapeMarket) }
  }

  if (verb === 'GET' && path === '/markets/mine') {
    return { positions: marketMine(state) }
  }

  if (parts[0] === 'markets' && parts.length === 3) {
    const market = state.markets.find((m) => m.slug === parts[1])
    if (!market) fail('market not found', 404)

    if (parts[2] === 'bet' && verb === 'POST') {
      const user = requireUser(state)
      if (shapeMarket(market).status !== 'open') fail('market is closed')
      const stake = validatePositiveMoney(body && body.stake, 'stake')
      const outcome = market.outcomes.find((o) => o.id === Number(body && body.outcomeId))
      if (!outcome) fail('invalid outcome')
      if (user.cash + 1e-9 < stake) fail('insufficient funds')
      user.cash = round2(user.cash - stake)
      outcome.pool = round2(outcome.pool + stake)
      state.marketPositions.push({
        id: state.meta.eventSeq++,
        marketId: market.id,
        outcomeId: outcome.id,
        stake,
        settled: false,
        payout: 0,
        createdAt: isoNow()
      })
      saveState(state)
      const shaped = shapeMarket(market)
      broadcast('market:updated', { slug: market.slug, market: shaped })
      return { ok: true, market: shaped, cash: user.cash }
    }

    if (parts[2] === 'resolve' && verb === 'POST') {
      requireUser(state)
      const result = settleMarket(state, market, body && body.outcomeId)
      saveState(state)
      const shaped = shapeMarket(market)
      broadcast('market:resolved', { slug: market.slug, winner: result.winner })
      return { ok: true, market: shaped, winner: result.winner, paidOut: result.paidOut, refunded: 0 }
    }
  }

  if (verb === 'GET' && path === '/battles') {
    return { battles: state.battles.map((b) => shapeBattle(state, b)) }
  }

  if (verb === 'GET' && path === '/battles/mine') {
    return { positions: battleMine(state) }
  }

  if (parts[0] === 'battles' && parts.length === 3) {
    const battle = state.battles.find((b) => String(b.id) === String(parts[1]))
    if (!battle) fail('battle not found', 404)

    if (parts[2] === 'bet' && verb === 'POST') {
      const user = requireUser(state)
      if (battleStatus(battle) !== 'open') fail('battle is closed')
      const side = body && body.side
      if (side !== 'a' && side !== 'b') fail("side must be 'a' or 'b'")
      const stake = validatePositiveMoney(body && body.stake, 'stake')
      if (user.cash + 1e-9 < stake) fail('insufficient funds')
      const a = modelById(state, battle.modelA)
      const b = modelById(state, battle.modelB)
      if (a.status !== 'active' || b.status !== 'active') fail('battle is unavailable because a model is not active')
      user.cash = round2(user.cash - stake)
      if (side === 'a') battle.poolA = round2(battle.poolA + stake)
      else battle.poolB = round2(battle.poolB + stake)
      state.battlePositions.push({
        id: state.meta.eventSeq++,
        battleId: battle.id,
        sideModelId: side === 'a' ? a.id : b.id,
        stake,
        settled: false,
        payout: 0,
        createdAt: isoNow()
      })
      saveState(state)
      const shaped = shapeBattle(state, battle)
      broadcast('battle:updated', { id: battle.id, battle: shaped })
      return { ok: true, battle: shaped, cash: user.cash }
    }

    if (parts[2] === 'settle' && verb === 'POST') {
      requireUser(state)
      settleBattle(state, battle)
      saveState(state)
      const shaped = shapeBattle(state, battle)
      broadcast('battle:settled', { id: battle.id, winnerId: battle.winnerId })
      return { ok: true, battle: shaped }
    }
  }

  if (verb === 'GET' && path === '/leaderboard') {
    return { leaderboard: leaderboard(state) }
  }

  if (verb === 'POST' && path === '/admin/refresh-signals') {
    requireUser(state)
    for (const model of state.models) {
      const n = hashNumber(model.slug + String(state.meta.eventSeq++))
      model.elo = Math.round(model.elo + ((n % 5) - 2))
      model.usage = round2(Math.max(0, model.usage + (((n >> 3) % 7) - 3) * 0.1))
      model.sentiment = clamp(model.sentiment + (((n >> 5) % 5) - 2) * 0.01, -0.35, 0.35)
    }
    state.meta.signalsUpdatedAt = isoNow()
    saveState(state)
    broadcast('prices', { t: Date.now(), models: state.models.map((m) => ({ id: m.id, price: publicPrice(m), likes: m.likes, dislikes: m.dislikes })) })
    return { ok: true, updatedAt: state.meta.signalsUpdatedAt }
  }

  fail('Unknown internal API route: ' + verb + ' ' + path, 404)
}

export function clearInternalSession() {
  setSession(false)
  broadcast('session:changed', { user: null })
}

export function exportInternalState() {
  return JSON.stringify(loadState(), null, 2)
}

export function importInternalState(text) {
  const parsed = JSON.parse(String(text || ''))
  if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.models) || !Array.isArray(parsed.markets)) {
    fail('This is not a compatible Benchstreet Internal snapshot.')
  }
  saveState(parsed)
  setSession(!!parsed.user)
  broadcast('internal:imported', {})
  return parsed
}

export function resetInternalState() {
  const state = freshState()
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    localStorage.removeItem(SESSION_KEY)
  }
  broadcast('internal:reset', {})
  return state
}

export function getInternalStats() {
  const state = loadState()
  const serialized = JSON.stringify(state)
  return {
    models: state.models.length,
    markets: state.markets.length,
    battles: state.battles.length,
    trades: state.trades.length,
    comments: Object.values(state.comments).reduce((sum, list) => sum + list.length, 0),
    storageBytes: new Blob([serialized]).size,
    updatedAt: state.updatedAt,
    user: state.user ? state.user.username : null
  }
}
