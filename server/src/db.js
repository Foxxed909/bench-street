import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADMIN_USERNAMES } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// DATA_DIR lets the deploy point the SQLite file at a persistent volume (Railway
// mounts one at an absolute path). Falls back to a local ./data dir for dev.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'bench-street.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    cash          REAL NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    company     TEXT NOT NULL,
    ticker      TEXT NOT NULL,
    open_source INTEGER NOT NULL DEFAULT 0,
    color       TEXT,
    fundamental REAL NOT NULL DEFAULT 0,
    price       REAL NOT NULL DEFAULT 0,
    prev_close  REAL NOT NULL DEFAULT 0,
    volatility  REAL NOT NULL DEFAULT 0.008,
    created_at  TEXT NOT NULL
  );

  -- A snapshot of raw signals per model. Latest row (by captured_at) is current.
  CREATE TABLE IF NOT EXISTS model_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id    INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    elo         REAL,
    usage       REAL,   -- OpenRouter-style usage / market share (%)
    bench       REAL,   -- composite benchmark score 0..100
    downloads   REAL,   -- HuggingFace downloads (open models)
    api_price   REAL,   -- blended $/Mtok (lower is "cheaper")
    captured_at TEXT NOT NULL
  );

  -- 1-minute OHLC candles for charting. t = epoch seconds floored to the minute.
  CREATE TABLE IF NOT EXISTS price_candles (
    model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    t        INTEGER NOT NULL,
    open     REAL NOT NULL,
    high     REAL NOT NULL,
    low      REAL NOT NULL,
    close    REAL NOT NULL,
    PRIMARY KEY (model_id, t)
  );

  CREATE TABLE IF NOT EXISTS holdings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id  INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    shares    REAL NOT NULL DEFAULT 0,
    avg_cost  REAL NOT NULL DEFAULT 0,
    UNIQUE (user_id, model_id)
  );

  CREATE TABLE IF NOT EXISTS trades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id   INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    side       TEXT NOT NULL,   -- 'buy' | 'sell'
    shares     REAL NOT NULL,
    price      REAL NOT NULL,
    total      REAL NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Prediction markets (parimutuel pools).
  CREATE TABLE IF NOT EXISTS markets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT UNIQUE NOT NULL,
    question   TEXT NOT NULL,
    category   TEXT,
    status     TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed' | 'resolved'
    resolution TEXT NOT NULL DEFAULT 'admin',  -- 'auto' | 'admin'
    closes_at  TEXT,
    resolved_outcome_id INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS market_outcomes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    pool      REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS market_positions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id  INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    outcome_id INTEGER NOT NULL REFERENCES market_outcomes(id) ON DELETE CASCADE,
    stake      REAL NOT NULL,
    settled    INTEGER NOT NULL DEFAULT 0,
    payout     REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- Head-to-head battles (Arena): two models, parimutuel sides, Elo-settled.
  CREATE TABLE IF NOT EXISTS battles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model_a_id  INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    model_b_id  INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    category    TEXT,
    status      TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'settled'
    pool_a      REAL NOT NULL DEFAULT 0,
    pool_b      REAL NOT NULL DEFAULT 0,
    closes_at   TEXT,
    winner_id   INTEGER,
    win_prob_a  REAL,
    created_at  TEXT NOT NULL,
    settled_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS battle_bets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    battle_id     INTEGER NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    side_model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    stake         REAL NOT NULL,
    settled       INTEGER NOT NULL DEFAULT 0,
    payout        REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  -- Community votes: each user can vote once per model (toggleable). Votes drive price.
  CREATE TABLE IF NOT EXISTS votes (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id   INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, model_id)
  );

  -- Free-text comments users leave on a model's page.
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id   INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_signals_model ON model_signals(model_id, captured_at);
  CREATE INDEX IF NOT EXISTS idx_candles_model ON price_candles(model_id, t);
  CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_battlebets_user ON battle_bets(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_votes_model ON votes(model_id);
  CREATE INDEX IF NOT EXISTS idx_comments_model ON comments(model_id, created_at);
`)

// --- Lightweight migrations (additive columns on existing DBs) --------------
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}
// Demand pressure (legacy; retired in favour of votes — kept dormant to avoid a drop).
ensureColumn('models', 'demand', 'demand REAL NOT NULL DEFAULT 0')
// Denormalized count of community votes (legacy = likes; kept for back-compat).
ensureColumn('models', 'vote_count', 'vote_count INTEGER NOT NULL DEFAULT 0')
// Like / dislike tallies. Net (likes − dislikes) drives price.
ensureColumn('models', 'like_count', 'like_count INTEGER NOT NULL DEFAULT 0')
ensureColumn('models', 'dislike_count', 'dislike_count INTEGER NOT NULL DEFAULT 0')
// A vote's stance: +1 like, -1 dislike. One row per user per model.
ensureColumn('votes', 'value', 'value INTEGER NOT NULL DEFAULT 1')
// Curated named benchmark scores (JSON: {"BridgeBench":72,"SWE-bench":68,...}).
ensureColumn('models', 'benchmarks', 'benchmarks TEXT')
// Lifecycle: 'active' (tradeable) | 'suspended' (listed, not tradeable). status_note
// carries the human explanation (e.g. the Fable/Mythos export suspension).
ensureColumn('models', 'status', "status TEXT NOT NULL DEFAULT 'active'")
ensureColumn('models', 'status_note', 'status_note TEXT')
// Release date (ISO) — drives the "Newest" sort + "new" badge.
ensureColumn('models', 'released_at', 'released_at TEXT')
// Reasoning-effort tier ('low' | 'medium' | 'high') for reasoning models; null otherwise.
ensureColumn('models', 'effort', 'effort TEXT')
// Quality-based opening line: a starting net-vote equivalent so a model opens at a
// sensible price (ranked by its benchmark standing) instead of $0. Real votes add on top.
ensureColumn('models', 'base_votes', 'base_votes INTEGER NOT NULL DEFAULT 0')
// Carry any legacy like tally forward into like_count once.
db.exec('UPDATE models SET like_count = vote_count WHERE like_count = 0 AND vote_count > 0')
// Live signal-feed mapping (OpenRouter / HuggingFace ids).
ensureColumn('models', 'openrouter_id', 'openrouter_id TEXT')
ensureColumn('models', 'hf_id', 'hf_id TEXT')
// Admin flag for resolving markets / refreshing signals.
ensureColumn('users', 'is_admin', 'is_admin INTEGER NOT NULL DEFAULT 0')
// Polymarket-style resolution criteria text on each market.
ensureColumn('markets', 'rules', 'rules TEXT')
// Machine-readable auto-resolution spec (JSON) for feed-settled markets.
ensureColumn('markets', 'resolver', 'resolver TEXT')
// Reconcile admin flags against the configured allowlist (see config.js) on every
// boot: promote any user whose name is on the list, and never anyone else. This is
// idempotent and the SAME source of truth auth.js uses at signup — they can't drift.
{
  const promote = db.prepare('UPDATE users SET is_admin = 1 WHERE LOWER(username) = ? AND is_admin = 0')
  for (const name of ADMIN_USERNAMES) promote.run(name)
}

export default db
