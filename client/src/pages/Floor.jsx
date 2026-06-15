import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, RefreshCw, Star, X, Sparkles } from 'lucide-react'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import { useAuth } from '../store/auth.jsx'
import { useWatchlist } from '../lib/watchlist.js'
import Sparkline from '../components/Sparkline.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'
import LikeDislike from '../components/LikeDislike.jsx'
import WatchStar from '../components/WatchStar.jsx'
import MarketStats from '../components/MarketStats.jsx'
import { pct, upDown, ago, isNew } from '../lib/format.js'

const ts = (d) => (d ? new Date(d).getTime() || 0 : 0)
const SORTS = {
  // Upcoming (not-yet-released) models float to the very top, then newest by date.
  new: (a, b) => {
    const ua = a.status === 'upcoming' ? 1 : 0
    const ub = b.status === 'upcoming' ? 1 : 0
    if (ua !== ub) return ub - ua
    return ts(b.releasedAt) - ts(a.releasedAt)
  },
  price: (a, b) => b.livePrice - a.livePrice,
  gainers: (a, b) => b.liveChangePct - a.liveChangePct,
  losers: (a, b) => a.liveChangePct - b.liveChangePct,
  rated: (a, b) => b.net - a.net
}

// Small status/recency badge shown next to a model's name.
function StatusBadge({ m }) {
  if (m.status === 'suspended') return <span className="pill bg-amber-500/15 text-amber-300">suspended</span>
  if (m.status === 'upcoming') return <span className="pill bg-sky-500/15 text-sky-300">soon</span>
  if (isNew(m.releasedAt)) return <span className="pill bg-accent/15 text-accent">new</span>
  return null
}

export default function Floor() {
  const [models, setModels] = useState([])
  const [signals, setSignals] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const [company, setCompany] = useState('All')
  const [watchOnly, setWatchOnly] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { prices, history, likes, dislikes } = usePrices()
  const { user } = useAuth()
  const watch = useWatchlist()
  const searchRef = useRef(null)

  function load() {
    api
      .get('/models')
      .then((d) => {
        setModels(d.models || [])
        setSignals(d.signals || null)
      })
      .catch(() => {})
  }
  useEffect(load, [user])

  // "/" focuses search from anywhere; Esc clears + blurs it.
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQ('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function patchVote(id, myVote, likeCount, dislikeCount) {
    setModels((ms) =>
      ms.map((m) => (m.id === id ? { ...m, myVote, likes: likeCount, dislikes: dislikeCount } : m))
    )
  }

  async function refreshSignals() {
    setRefreshing(true)
    try {
      await api.post('/admin/refresh-signals', {})
      load()
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false)
    }
  }

  const companies = useMemo(
    () => ['All', ...Array.from(new Set(models.map((m) => m.company))).sort()],
    [models]
  )

  const rows = useMemo(() => {
    return models
      .map((m) => {
        const price = prices[m.id] ?? m.price
        const changePct = m.prevClose ? ((price - m.prevClose) / m.prevClose) * 100 : 0
        const liveLikes = likes[m.id] ?? m.likes ?? 0
        const liveDislikes = dislikes[m.id] ?? m.dislikes ?? 0
        return {
          ...m,
          livePrice: price,
          liveChangePct: changePct,
          liveLikes,
          liveDislikes,
          net: liveLikes - liveDislikes
        }
      })
      .filter((m) => (company === 'All' ? true : m.company === company))
      .filter((m) => (watchOnly ? watch.has(m.slug) : true))
      .filter((m) => `${m.name} ${m.company} ${m.ticker}`.toLowerCase().includes(q.toLowerCase()))
      .sort(SORTS[sort])
  }, [models, prices, likes, dislikes, q, sort, company, watchOnly, watch])

  return (
    <div className="space-y-6 fade-up">
      <IntroBanner user={user} />

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tightest text-white">The Floor</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-400">{models.length} AI models · live</p>
            {signals?.updatedAt && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="live-dot" />
                signals {ago(signals.updatedAt)}
                {user?.isAdmin && (
                  <button
                    onClick={refreshSignals}
                    disabled={refreshing}
                    className="ml-1 text-slate-500 hover:text-accent transition"
                    title="Refresh live signals"
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="input w-36 cursor-pointer"
            title="Filter by company"
          >
            {companies.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All companies' : c}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              ref={searchRef}
              className="input pl-9 w-52"
              placeholder="Search…  ( / )"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <MarketStats models={models} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 px-3 py-2.5 border-b border-edge">
          {[
            ['new', 'Newest'],
            ['price', 'Price'],
            ['gainers', 'Gainers'],
            ['losers', 'Losers'],
            ['rated', 'Top rated']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                sort === key ? 'bg-panel2 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setWatchOnly((v) => !v)}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition ${
              watchOnly ? 'bg-accent/15 text-accent' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Show only your watchlist"
          >
            <Star size={12} className={watchOnly ? 'fill-accent' : ''} /> Watchlist
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="label text-left border-b border-edge">
              <th className="py-2.5 px-4 w-10 font-medium">#</th>
              <th className="px-2 font-medium">Model</th>
              <th className="px-4 font-medium text-right">Price</th>
              <th className="px-4 font-medium text-right">24h</th>
              <th className="px-4 font-medium text-center hidden sm:table-cell">Sentiment</th>
              <th className="px-4 font-medium text-right hidden md:table-cell">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const inactive = m.status && m.status !== 'active'
              return (
                <tr
                  key={m.id}
                  className="group border-b border-edge/40 transition last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="num px-4 py-3 text-xs text-slate-600">{i + 1}</td>
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <WatchStar slug={m.slug} />
                      <Link to={`/m/${m.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold ring-1 ring-inset ring-white/5"
                          style={{ background: `${m.color}1f`, color: m.color }}
                        >
                          {m.ticker.slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-white transition group-hover:text-accent">
                              {m.name}
                            </span>
                            <StatusBadge m={m} />
                            {m.openSource && <span className="pill bg-up/15 text-up">open</span>}
                            {m.liveSignals && <span className="pill bg-accent/15 text-accent">live</span>}
                          </span>
                          <span className="block text-xs text-slate-500">
                            <span className="num">{m.ticker}</span> · {m.company}
                          </span>
                        </span>
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 text-right">
                    <AnimatedNumber value={m.livePrice} duration={450} className="num text-white" />
                  </td>
                  <td className={`px-4 text-right num ${upDown(m.liveChangePct)}`}>
                    {pct(m.liveChangePct)}
                  </td>
                  <td className="hidden px-4 sm:table-cell">
                    <div className="flex justify-center">
                      <LikeDislike
                        slug={m.slug}
                        likes={m.liveLikes}
                        dislikes={m.liveDislikes}
                        myVote={m.myVote}
                        onChange={(mv, l, d) => patchVote(m.id, mv, l, d)}
                        size="sm"
                        disabled={inactive}
                      />
                    </div>
                  </td>
                  <td className="hidden px-4 md:table-cell">
                    <div className="flex justify-end">
                      <Sparkline
                        data={history[m.id]}
                        color={m.liveChangePct >= 0 ? '#27d18b' : '#fb5a6a'}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            {watchOnly
              ? 'Nothing on your watchlist yet — tap the ☆ next to any model.'
              : 'No models match your filters.'}
          </div>
        )}

        <div className="border-t border-edge px-4 py-2 text-xs text-slate-600">
          Showing {rows.length} of {models.length} models
        </div>
      </div>
    </div>
  )
}

// One-time onboarding banner explaining the votes-set-the-price mechanic.
function IntroBanner({ user }) {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem('bs_intro_dismissed') !== '1'
    } catch {
      return true
    }
  })
  if (!show) return null
  function dismiss() {
    try {
      localStorage.setItem('bs_intro_dismissed', '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-gradient-to-br from-accent/10 to-transparent px-5 py-4">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 text-slate-500 hover:text-white"
        title="Dismiss"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="text-sm">
          <div className="font-semibold text-white">Welcome to Bench Street</div>
          <p className="mt-0.5 text-slate-300">
            Trade AI models like stocks — with play money. Every model starts at{' '}
            <span className="font-mono text-white">$0</span> and moves on the crowd's votes: like 👍
            to push it up, dislike 👎 to pull it down. Once a model has a price, you can buy and sell.
          </p>
          {!user && (
            <Link to="/login" className="btn-primary mt-3 inline-block">
              Sign up — start with $100k
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
