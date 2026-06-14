import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import { useAuth } from '../store/auth.jsx'
import Sparkline from '../components/Sparkline.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'
import VoteButton from '../components/VoteButton.jsx'
import MarketStats from '../components/MarketStats.jsx'
import { pct, upDown, ago } from '../lib/format.js'

const SORTS = {
  price: (a, b) => b.livePrice - a.livePrice,
  gainers: (a, b) => b.liveChangePct - a.liveChangePct,
  losers: (a, b) => a.liveChangePct - b.liveChangePct,
  voted: (a, b) => b.liveVotes - a.liveVotes
}

export default function Floor() {
  const [models, setModels] = useState([])
  const [signals, setSignals] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('price')
  const [refreshing, setRefreshing] = useState(false)
  const { prices, history, votes } = usePrices()
  const { user } = useAuth()

  function load() {
    api.get('/models').then((d) => {
      setModels(d.models)
      setSignals(d.signals)
    })
  }
  useEffect(load, [user])

  function patchVote(id, voted, count) {
    setModels((ms) => ms.map((m) => (m.id === id ? { ...m, votedByMe: voted, votes: count } : m)))
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

  const rows = useMemo(() => {
    return models
      .map((m) => {
        const price = prices[m.id] ?? m.price
        const changePct = m.prevClose ? ((price - m.prevClose) / m.prevClose) * 100 : 0
        return {
          ...m,
          livePrice: price,
          liveChangePct: changePct,
          liveVotes: votes[m.id] ?? m.votes ?? 0
        }
      })
      .filter((m) => `${m.name} ${m.company} ${m.ticker}`.toLowerCase().includes(q.toLowerCase()))
      .sort(SORTS[sort])
  }, [models, prices, votes, q, sort])

  return (
    <div className="space-y-6 fade-up">
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
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            className="input pl-9 w-56"
            placeholder="Search models…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <MarketStats models={models} />

      <div className="card overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-edge">
          {[
            ['price', 'Price'],
            ['gainers', 'Gainers'],
            ['losers', 'Losers'],
            ['voted', 'Most voted']
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
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="label text-left border-b border-edge">
              <th className="py-2.5 px-4 w-10 font-medium">#</th>
              <th className="px-2 font-medium">Model</th>
              <th className="px-4 font-medium text-right">Price</th>
              <th className="px-4 font-medium text-right">24h</th>
              <th className="px-4 font-medium text-center hidden sm:table-cell">Votes</th>
              <th className="px-4 font-medium text-right hidden md:table-cell">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={m.id}
                className="group border-b border-edge/40 transition last:border-0 hover:bg-white/[0.02]"
              >
                <td className="num px-4 py-3 text-xs text-slate-600">{i + 1}</td>
                <td className="px-2">
                  <Link to={`/m/${m.slug}`} className="flex items-center gap-3">
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
                        {m.openSource && <span className="pill bg-up/15 text-up">open</span>}
                        {m.liveSignals && <span className="pill bg-accent/15 text-accent">live</span>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        <span className="num">{m.ticker}</span> · {m.company}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 text-right">
                  <AnimatedNumber value={m.livePrice} duration={450} className="num text-white" />
                </td>
                <td className={`px-4 text-right num ${upDown(m.liveChangePct)}`}>
                  {pct(m.liveChangePct)}
                </td>
                <td className="hidden px-4 sm:table-cell">
                  <div className="flex justify-center">
                    <VoteButton
                      slug={m.slug}
                      count={m.liveVotes}
                      voted={m.votedByMe}
                      onChange={(voted, count) => patchVote(m.id, voted, count)}
                      size="sm"
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
