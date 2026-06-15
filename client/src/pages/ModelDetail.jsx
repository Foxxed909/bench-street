import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import { useAuth } from '../store/auth.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'
import LikeDislike from '../components/LikeDislike.jsx'
import Benchmarks from '../components/Benchmarks.jsx'
import Comments from '../components/Comments.jsx'
import { money, num, pct, compact, upDown, splitTier } from '../lib/format.js'

// Live signals shown for transparency. API price scales each vote's value; the
// rest are context only.
const SIGNALS = [
  { key: 'apiPrice', label: 'API $/Mtok', fmt: (v) => money(v), note: 'sets vote value' },
  { key: 'elo', label: 'LMArena ELO', fmt: (v) => num(v, 0) },
  { key: 'usage', label: 'Usage share', fmt: (v) => `${num(v, 1)}%` },
  { key: 'downloads', label: 'HF downloads', fmt: (v) => compact(v) }
]

export default function ModelDetail() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { user, refresh } = useAuth()
  const { prices, likes, dislikes } = usePrices()

  const [model, setModel] = useState(null)
  const [chart, setChart] = useState([])
  const [position, setPosition] = useState(null)
  const [voteRate, setVoteRate] = useState(5)
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
        setChart((d.candles || []).map((c) => ({ t: c.t * 1000, price: c.close })))
        seeded.current = true
      })
      .catch((e) => setErr(e.message))
    loadPosition()
  }, [slug, user])

  const livePrice = model ? prices[model.id] ?? model.price : null
  const liveLikes = model ? likes[model.id] ?? model.likes ?? 0 : 0
  const liveDislikes = model ? dislikes[model.id] ?? model.dislikes ?? 0 : 0
  const net = liveLikes - liveDislikes

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
  const perVote = model.perVoteValue ?? voteRate
  const costMult = voteRate ? perVote / voteRate : 1
  const canTrade = livePrice > 0
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
                  <h1 className="text-xl font-bold text-white">{splitTier(model.name).base}</h1>
                  {splitTier(model.name).tier && (
                    <span className="pill bg-accent/15 text-accent">
                      {splitTier(model.name).tier}
                    </span>
                  )}
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
              {chart.length >= 2 ? (
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
              ) : (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <div className="num text-2xl text-slate-500">{money(livePrice)}</div>
                    <p className="mt-1 text-xs text-slate-600">
                      No price history yet — votes will move this chart.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price breakdown */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-1">Why this price</h2>
            <p className="text-xs text-slate-500 mb-4">
              Price is the crowd's net verdict. It launches at $0 and moves{' '}
              {money(perVote)} per net vote — the {money(voteRate)} base scaled ×{num(costMult, 2)} by
              this model's token price. Dislikes pull it back down.
            </p>

            {/* The formula, as factor chips */}
            <div className="flex flex-wrap items-stretch gap-2 text-center">
              <Factor
                label="Net votes"
                value={`${net > 0 ? '+' : ''}${num(net, 0)}`}
                sub={`${num(liveLikes, 0)} 👍 · ${num(liveDislikes, 0)} 👎`}
              />
              <Op>×</Op>
              <Factor
                label="Per vote"
                value={money(perVote)}
                sub={`${money(voteRate)} × ${num(costMult, 2)}`}
              />
              <Op>=</Op>
              <Factor label="Price" value={money(livePrice)} accent />
            </div>

            {net <= 0 && (
              <div className="mt-3 rounded-lg border border-edge bg-ink/40 px-3 py-2 text-sm text-slate-400">
                {liveLikes === 0 && liveDislikes === 0
                  ? `No votes yet — this model sits at ${money(0)}. Be the first to value it.`
                  : `Net sentiment is ${num(net, 0)}, so the price floors at ${money(0)}.`}
              </div>
            )}

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
                        {s.note && (
                          <span className="text-[9px] uppercase tracking-wide text-accent/80 font-mono">
                            {s.note}
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

          <Benchmarks data={model.benchmarks} color={model.color} />

          <Comments slug={slug} />
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
              <button
                disabled={busy || !canTrade}
                onClick={() => trade('buy')}
                className="btn-buy disabled:opacity-40"
              >
                Buy
              </button>
              <button
                disabled={busy || !canTrade}
                onClick={() => trade('sell')}
                className="btn-sell disabled:opacity-40"
              >
                Sell
              </button>
            </div>

            {!canTrade && (
              <p className="text-xs text-slate-500 mt-3">
                No price yet — this model needs votes before it can be traded.
              </p>
            )}

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
            <div className="label mb-3">Community sentiment</div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="num text-3xl font-bold text-white">
                  {net > 0 ? '+' : ''}
                  {num(net, 0)}
                </div>
                <div className="text-xs text-slate-500">
                  net · {model.approval != null ? `${model.approval}% approval` : 'no votes yet'}
                </div>
              </div>
              <LikeDislike
                slug={slug}
                likes={liveLikes}
                dislikes={liveDislikes}
                myVote={model.myVote}
                onChange={(myVote, l, d) =>
                  setModel((mm) => ({
                    ...mm,
                    myVote,
                    likes: l,
                    dislikes: d,
                    approval: l + d ? Math.round((l / (l + d)) * 100) : null
                  }))
                }
              />
            </div>
            {/* approval bar */}
            {liveLikes + liveDislikes > 0 && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-down/30">
                <div
                  className="h-full rounded-full bg-up"
                  style={{ width: `${(liveLikes / (liveLikes + liveDislikes)) * 100}%` }}
                />
              </div>
            )}
            <p className="text-xs text-slate-500 mt-3">
              Each net vote moves the price {money(perVote)}. Like to push it up, dislike to pull it
              down.
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
