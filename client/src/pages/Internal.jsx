import { useMemo, useRef, useState } from 'react'
import { Database, Download, HardDrive, RefreshCw, Upload, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  exportInternalState,
  getInternalStats,
  importInternalState,
  resetInternalState
} from '../lib/internalEngine.js'
import { useAuth } from '../store/auth.jsx'
import { ago, num } from '../lib/format.js'

function bytes(n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

export default function Internal() {
  const { user, logout, refresh } = useAuth()
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState(null)
  const inputRef = useRef(null)
  const nav = useNavigate()
  const stats = useMemo(() => getInternalStats(), [tick, user])

  function downloadSnapshot() {
    const blob = new Blob([exportInternalState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'benchstreet-internal-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
    setMsg({ type: 'ok', text: 'Snapshot exported.' })
  }

  async function importSnapshot(file) {
    if (!file) return
    try {
      const text = await file.text()
      importInternalState(text)
      await refresh()
      setTick((n) => n + 1)
      setMsg({ type: 'ok', text: 'Snapshot imported. Your desk is live.' })
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function resetDesk() {
    if (!window.confirm('Reset Benchstreet Internal on this browser? This removes the local profile, trades, votes, bets and comments.')) {
      return
    }
    resetInternalState()
    logout()
    nav('/login')
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="pill bg-accent/15 text-accent">internal</span>
            <span className="pill bg-up/10 text-up">backendless</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tightest text-white">Internal Desk</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Benchstreet runs as one Vercel-hosted client with its exchange engine and persistence in this browser.
            No Render, Railway, API origin, database server or Socket.IO process is required.
          </p>
        </div>
        <button onClick={() => setTick((n) => n + 1)} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh stats
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Database size={16} />} label="Models" value={stats.models} />
        <Stat icon={<Zap size={16} />} label="Markets" value={stats.markets} />
        <Stat icon={<RefreshCw size={16} />} label="Trades" value={stats.trades} />
        <Stat icon={<HardDrive size={16} />} label="Local state" value={bytes(stats.storageBytes)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Snapshot controls</h2>
          <p className="mt-1 text-sm text-slate-400">
            Browser storage is durable across reloads, but clearing site data removes it. Export a snapshot whenever you want a portable backup.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={downloadSnapshot} className="btn-primary flex items-center gap-2">
              <Download size={14} /> Export JSON
            </button>
            <button onClick={() => inputRef.current?.click()} className="btn-secondary flex items-center gap-2">
              <Upload size={14} /> Import JSON
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => importSnapshot(e.target.files?.[0])}
            />
          </div>

          {msg && (
            <p className={'mt-3 text-sm ' + (msg.type === 'ok' ? 'text-up' : 'text-down')}>{msg.text}</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold text-white">Runtime</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Trader" value={stats.user || 'not initialized'} />
            <Row label="Battles" value={String(stats.battles)} />
            <Row label="Comments" value={String(stats.comments)} />
            <Row label="Last state write" value={stats.updatedAt ? ago(stats.updatedAt) : '—'} />
            <Row label="Persistence" value="localStorage" />
            <Row label="Network API" value="none" good />
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-edge px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">What changed in Internal</h2>
        </div>
        <div className="grid gap-px bg-edge sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Same exchange UI', 'Floor, model pages, portfolio, predictions, Arena and leaderboard stay on the same visual system.'],
            ['Local exchange engine', 'Votes reprice models, trades update cost basis, and self-votes are excluded from execution quotes.'],
            ['Local prediction pools', 'Prediction odds and battle pools move with your stakes and settle back into your desk balance.'],
            ['Instant local events', 'The old Socket.IO surface is replaced by an in-app event bus, so updates still feel live.'],
            ['Portable state', 'Export or import the full market snapshot as JSON from this page.'],
            ['One deployment', 'Vercel only serves the app; there is no separately operated backend to keep awake or pay for.']
          ].map(([title, text]) => (
            <div key={title} className="bg-panel p-4">
              <div className="text-sm font-semibold text-white">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-down/20 bg-down/[0.04] p-5">
        <h2 className="font-display text-lg font-semibold text-white">Reset local market</h2>
        <p className="mt-1 text-sm text-slate-400">
          Use this only when you want a completely fresh $100k desk. Export first if you may want the current state later.
        </p>
        <button onClick={resetDesk} className="mt-3 rounded-lg border border-down/30 px-3 py-2 text-sm text-down transition hover:bg-down/10">
          Reset Benchstreet Internal
        </button>
      </section>
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-500">{icon}<span className="label">{label}</span></div>
      <div className="num mt-2 text-2xl text-white">{typeof value === 'number' ? num(value, 0) : value}</div>
    </div>
  )
}

function Row({ label, value, good }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge/50 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={'font-mono text-xs ' + (good ? 'text-up' : 'text-slate-300')}>{value}</span>
    </div>
  )
}
