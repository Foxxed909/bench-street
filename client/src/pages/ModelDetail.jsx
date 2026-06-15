import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronUp } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import { useAuth } from '../store/auth.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'
import VoteButton from '../components/VoteButton.jsx'
import { money, num, pct, compact, upDown } from '../lib/format.js'

// Live signals shown for transparency. ELO + API price feed the price formula;
// the rest are context.
const SIGNALS = [
  { key: 'apiPrice', label: 'API $/Mtok', fmt: (v) => money(v), drives: true },
  { key: 'elo', label: 'LMArena ELO', fmt: (v) => num(v, 0), drives: true },
  { key: 'usage', label: 'Usage share', fmt: (v) => `${num(v, 1)}%` },
  { key: 'bench', label: 'Benchmarks', fmt: (v) => `${num(v, 0)}/100` },
  { key: 'downloads', label: 'HF downloads', fmt: (v) => compact(v) }
]

export default function ModelDetail() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { user, refresh } = useAuth()
  const { prices, votes } = usePrices()

  const [model, setModel] = useState(null)
  const [chart, setChart] = useState([])
  const [position, setPosition] = useState(null)
  const [voteRate, setVoteRate] = useState(5)
  const [priceMultiplier, setPriceMultiplier] = useState(50)
  const [err, setErr] = useState('')
  const [shares, setShares] = useState(1)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const seeded = useRef(false)

  function loadPosition() {
    if (!user) return setPosition(null)
    api
      .get('/portfolio')
      .then((d) => setPosition(d.positions.find((p) => p.slug === slug) || null))
      .catch(() => {})
  }

  useEffect(() => {
    seeded.current = false
    api
      .get(`/models/${slug}`)
      .then((d) => {
        setModel(d.model)
        setVoteRate(d.voteRate ?? 5)
        setPriceMultiplier(d.priceMultiplier ?? 50)
        setChart(d.candles.map((c) => ({ t: c.t * 1000, price: c.close })))
        seeded.current = true
      })
      .catch((e) => setErr(e.message))
    loadPosition()
  }, [slug, user])

  const livePrice = model ? prices[model.id] ?? model.price : null
  const liveVotes = model ? votes[model.id] ?? model.votes ?? 0 : 0

  useEffect(() => {
    if (!model || !seeded.current || livePrice == null) return
    setChart((prev) => {
      const last = prev[prev.length - 1]
      if (last && Math.abs(last.price - livePrice) < 1e-9) return prev
      return [...prev, { t: Date.now(), price: livePrice }].slice(-300)
    })
  }, [livePrice, model])

  const changePct = useMemo(() => {
    if (!model || livePrice == null) return 0
    return model.prevClose ? ((livePrice - model.prevClose) / model.prevClose) * 100 : 0
  }, [model, livePrice])

  async function trade(side) {
    setMsg(null)
    if (!user) return nav('/login')
    const qty = Number(shares)
    if (!(qty > 0)) return setMsg({ type: 'err', text: 'Enter a share amount.' })
    setBusy(true)
    try {
      const r = await api.post('/trade', { slug, side, shares: qty })
      await refresh()
      loadPosition()
      setMsg({
        type: 'ok',
        text: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${model.ticker} @ ${money(
          r.executed.price
        )}`
      })
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setBusy(false)
    }
  }

  if (err) return <p className="text-down">{err}</p>
  if (!model) return <p className="text-slate-500">Loading…</p>

  const up = changePct >= 0
  const maxShares = user && livePrice ? Math.floor(user.cash / livePrice) : 0
  const estCost = (Number(shares) || 0) * (livePrice || 0)

  return (
    <div className="fade-up">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"
      >
        <ArrowLeft size={15} /> The Floor
      </Link>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Header + chart */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span
                className="w-11 h-11 rounded-xl grid place-items-center text-sm font-bold shrink-0"
                style={{ background: `${model.color}22`, color: model.color }}
              >
                {model.ticker.slice(0, 2)}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{model.name}</h1>
                  {model.openSource && <span className="pill bg-up/15 text-up">open</span>}
                </div>
                <p className="text-sm text-slate-400">
                  {model.company} · <span className="font-mono">{model.ticker}</span>
                </p>
              </div>
              <div className="ml-auto text-right">
                <AnimatedNumber
                  value={livePrice}
                  className="text-2xl font-mono text-white tabular-nums"
                />
                <div className={`text-sm font-mono ${upDown(changePct)}`}>{pct(changePct)}</div>
              </div>
            </div>

            <div className="h-72 mt-5 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={up ? '#27d18b' : '#fb5a6a'} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={up ? '#27d18b' : '#fb5a6a'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(t) =>
                      new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                    stroke="#3a4a63"
                    fontSize={11}
                    minTickGap={48}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="#3a4a63"
                    fontSize={11}
                    width={54}
                    tickFormatter={(v) => `$${num(v, 0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f1622',
                      border: '1px solid #1e2a3d',
                      borderRadius: 8,
                      fontSize: 12
                    }}
                    labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                    formatter={(v) => [money(v), 'Price']}
                  />
                  <ReferenceLine
                    y={model.fundamental}
                    stroke="#f0c04e"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={up ? '#27d18b' : '#fb5a6a'}
                    strokeWidth={2}
                    fill="url(#grad)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              <span className="text-accent">— —</span> fundamental value {money(model.fundamental)} ·
              the cost × quality fair price the market pulls back toward.
            </p>
          </div>

          {/* Price breakdown */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Why this price</h2>
            <p className="text-xs text-slate-500 mb-4">
              A model is worth its token economics × its quality, then the crowd adds
              conviction. Fundamental = blended API price ($/Mtok) × quality (ELO) ×{' '}
              {priceMultiplier}.
            </p>

            {/* The formula, as factor chips */}
            <div className="flex flex-wrap items-stretch gap-2 text-center">
              <Factor
                label="API $/Mtok"
                value={model.tokenPrice != null ? money(model.tokenPrice) : '—'}
              />
              <Op>×</Op>
              <Factor
                label="Quality (ELO)"
                value={model.eloFactor != null ? `${num(model.eloFactor, 2)}×` : '1.00×'}
                sub={model.signals.elo != null ? num(model.signals.elo, 0) : null}
              />
              <Op>×</Op>
              <Factor label="Multiplier" value={`${priceMultiplier}`} />
              <Op>=</Op>
              <Factor label="Fundamental" value={money(model.fundamental)} accent />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-up/25 bg-up/5 px-3 py-2 text-sm">
              <span className="text-slate-300">
                Fundamental {money(model.fundamental)} + {num(liveVotes, 0)} votes ×{' '}
                {money(voteRate)}
              </span>
              <span className="num font-semibold text-up">+{money(liveVotes * voteRate)}</span>
            </div>

            {/* Live signals reference */}
            <div className="mt-5 pt-4 border-t border-edge">
              <div className="label mb-3">Live signals</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SIGNALS.map((s) => {
                  const v = model.signals[s.key]
                  if (v == null) return null
                  return (
                    <div key={s.key} className="bg-ink/60 border border-edge rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-400">{s.label}</span>
                        {s.drives && (
                          <span className="text-[9px] uppercase tracking-wide text-accent/80 font-mono">
                            drives price
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-mono text-white">{s.fmt(v)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Trade ticket + flow */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Trade</h2>
              {position && (
                <span className="text-xs text-slate-400">
                  You own <span className="font-mono text-white">{position.shares}</span>
                </span>
              )}
            </div>

            <label className="label">Shares</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input mt-1 mb-2 font-mono"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
            />
            <div className="flex gap-1.5 mb-3">
              {[1, 5, 10].map((n) => (
                <button key={n} onClick={() => setShares(n)} className="btn-ghost flex-1 py-1">
                  {n}
                </button>
              ))}
              <button
                onClick={() => setShares(maxShares)}
                disabled={!user}
                className="btn-ghost flex-1 py-1"
              >
                Max
              </button>
            </div>

            <div className="flex justify-between text-sm mb-3">
              <span className="text-slate-400">Est. cost</span>
              <span className="font-mono text-white">{money(estCost)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => trade('buy')} className="btn-buy">
                Buy
              </button>
              <button disabled={busy} onClick={() => trade('sell')} className="btn-sell">
                Sell
              </button>
            </div>

            {msg && (
              <p className={`text-sm mt-3 ${msg.type === 'ok' ? 'text-up' : 'text-down'}`}>
                {msg.text}
              </p>
            )}
            {!user && (
              <p className="text-xs text-slate-500 mt-3">
                <Link to="/login" className="text-accent">
                  Sign in
                </Link>{' '}
                to trade — you start with $100k.
              </p>
            )}
            {position && (
              <div className="mt-4 pt-4 border-t border-edge grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-slate-400">Avg cost</span>
                <span className="text-right font-mono text-white">{money(position.avgCost)}</span>
                <span className="text-slate-400">Market value</span>
                <span className="text-right font-mono text-white">
                  {money(position.shares * livePrice)}
                </span>
                <span className="text-slate-400">Open P&L</span>
                <span
                  className={`text-right font-mono ${upDown(
                    position.shares * livePrice - position.shares * position.avgCost
                  )}`}
                >
                  {money(position.shares * livePrice - position.shares * position.avgCost)}
                </span>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-1.5 label mb-3">
              <ChevronUp size={13} /> Community votes
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="num text-3xl font-bold text-white">{num(liveVotes, 0)}</div>
                <div className="text-xs text-slate-500">
                  supporters · {money(liveVotes * voteRate)} of price
                </div>
              </div>
              <VoteButton
                slug={slug}
                count={liveVotes}
                voted={model.votedByMe}
                onChange={(voted, count) =>
                  setModel((mm) => ({ ...mm, votedByMe: voted, votes: count }))
                }
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Every vote adds {money(voteRate)} to this model's price. Toggle yours anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Factor({ label, value, sub, accent }) {
  return (
    <div
      className={`flex-1 min-w-[88px] rounded-lg border p-3 ${
        accent ? 'border-accent/40 bg-accent/5' : 'border-edge bg-ink/60'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-lg ${accent ? 'text-accent' : 'text-white'}`}>{value}</div>
      {sub != null && <div className="text-[10px] text-slate-600 font-mono">{sub}</div>}
    </div>
  )
}

function Op({ children }) {
  return (
    <div className="grid place-items-center text-slate-600 font-mono text-lg px-0.5">{children}</div>
  )
}
