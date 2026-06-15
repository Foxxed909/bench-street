import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, CheckCircle2, Clock, ShieldCheck, Zap } from 'lucide-react'
import { api } from '../lib/api.js'
import { socket } from '../lib/socket.js'
import { useAuth } from '../store/auth.jsx'
import { money, num, until } from '../lib/format.js'

export default function Predictions() {
  const { user, refresh } = useAuth()
  const [markets, setMarkets] = useState([])
  const [mine, setMine] = useState([])
  const [cat, setCat] = useState('All')
  const [err, setErr] = useState('')

  function load() {
    api.get('/markets').then((d) => setMarkets(d.markets)).catch((e) => setErr(e.message))
    if (user) api.get('/markets/mine').then((d) => setMine(d.positions)).catch(() => {})
  }
  useEffect(load, [user])

  // Live refresh when the auto-resolver settles a market.
  useEffect(() => {
    const onResolved = () => load()
    socket.on('market:resolved', onResolved)
    return () => socket.off('market:resolved', onResolved)
  }, [user])

  const cats = useMemo(
    () => ['All', ...Array.from(new Set(markets.map((m) => m.category)))],
    [markets]
  )
  const shown = useMemo(() => {
    const rank = { open: 0, closed: 1, resolved: 2 }
    return markets
      .filter((m) => cat === 'All' || m.category === cat)
      .sort((a, b) => (rank[a.status] - rank[b.status]) || b.volume - a.volume)
  }, [markets, cat])

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tightest text-white">Predictions</h1>
        <p className="text-sm text-slate-400">
          Bet on AI events — releases, capability milestones, benchmark leaders, and which model
          ends the year most valued. Odds shift as the pool fills.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              cat === c
                ? 'bg-white text-black border-white'
                : 'border-edge text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {err && <p className="text-down text-sm">{err}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {shown.map((m, i) => (
          <div key={m.id} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <MarketCard
              market={m}
              user={user}
              onChange={() => {
                refresh()
                load()
              }}
            />
          </div>
        ))}
      </div>

      {user && mine.length > 0 && <MyBets positions={mine} />}
    </div>
  )
}

function StatusBadge({ status, closesAt }) {
  if (status === 'resolved')
    return (
      <span className="flex items-center gap-1 text-[11px] text-up font-medium">
        <CheckCircle2 size={12} /> Resolved
      </span>
    )
  if (status === 'closed')
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
        <Lock size={12} /> Closed
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
      <Clock size={12} /> ends {new Date(closesAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
    </span>
  )
}

function MarketCard({ market, user, onChange }) {
  const isBinary = market.isBinary
  const yes = market.outcomes.find((o) => o.label === 'Yes')
  const [sel, setSel] = useState(isBinary ? yes.id : market.outcomes[0].id)
  const [stake, setStake] = useState(50)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const open = market.status === 'open'

  const selected = market.outcomes.find((o) => o.id === sel) || market.outcomes[0]
  const chance = isBinary ? yes.impliedPct : Math.max(...market.outcomes.map((o) => o.impliedPct))

  async function bet() {
    setMsg(null)
    const amount = Number(stake)
    if (!(amount > 0)) return setMsg({ t: 'err', x: 'Enter a stake.' })
    setBusy(true)
    try {
      await api.post(`/markets/${market.slug}/bet`, { outcomeId: sel, stake: amount })
      setMsg({ t: 'ok', x: `Bet ${money(amount)} on “${selected.label}”` })
      onChange()
    } catch (e) {
      setMsg({ t: 'err', x: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function resolve(outcomeId) {
    if (busy) return
    setBusy(true)
    try {
      await api.post(`/markets/${market.slug}/resolve`, { outcomeId })
      onChange()
    } catch (e) {
      setMsg({ t: 'err', x: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card lift p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="pill bg-panel2 text-slate-300">{market.category}</span>
          {market.autoResolvable && (
            <span className="pill bg-accent/15 text-accent flex items-center gap-0.5">
              <Zap size={9} /> auto
            </span>
          )}
        </div>
        <StatusBadge status={market.status} closesAt={market.closesAt} />
      </div>

      <div className="flex items-start gap-3 mb-4">
        <h3 className="text-white font-semibold leading-snug flex-1">{market.question}</h3>
        {isBinary && market.status !== 'resolved' && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-white leading-none">{Math.round(chance)}%</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">chance</div>
          </div>
        )}
      </div>

      {market.status === 'resolved' ? (
        <div className="mb-3 rounded-lg border border-up/30 bg-up/10 px-3 py-2 text-sm text-up flex items-center gap-2">
          <CheckCircle2 size={15} /> Resolved: <span className="font-semibold">{market.winnerLabel}</span>
        </div>
      ) : isBinary ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {market.outcomes.map((o) => {
            const active = sel === o.id
            const isYes = o.label === 'Yes'
            return (
              <button
                key={o.id}
                disabled={!open}
                onClick={() => setSel(o.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                  active
                    ? isYes
                      ? 'border-up bg-up/15'
                      : 'border-down bg-down/15'
                    : 'border-edge hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${isYes ? 'text-up' : 'text-down'}`}>{o.label}</span>
                  <span className="font-mono text-sm text-white">{o.impliedPct}%</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{num(o.payout, 2)}× payout</div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {market.outcomes.map((o) => {
            const active = sel === o.id
            return (
              <button
                key={o.id}
                disabled={!open}
                onClick={() => setSel(o.id)}
                className={`w-full rounded-lg border px-3 py-2 transition disabled:opacity-50 ${
                  active ? 'border-accent bg-panel2' : 'border-edge hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-white">{o.label}</span>
                  <span className="font-mono text-slate-300">
                    {o.impliedPct}% · {num(o.payout, 2)}×
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-ink overflow-hidden">
                  <div className="bar h-full bg-gradient-to-r from-accent/60 to-accent" style={{ width: `${o.impliedPct}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-auto">
        {open ? (
          user ? (
            <div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    className="input pl-6 w-28"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                  />
                </div>
                <button disabled={busy} onClick={bet} className="btn-primary flex-1">
                  Bet on {selected.label}
                </button>
              </div>
              {Number(stake) > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  To win ≈{' '}
                  <span className="font-mono text-up">{money(Number(stake) * selected.payout)}</span>{' '}
                  at current odds
                </p>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm text-accent">
              Sign in to bet
            </Link>
          )
        ) : market.status === 'closed' ? (
          <p className="text-xs text-slate-500">Trading closed — awaiting resolution.</p>
        ) : null}

        {msg && (
          <p className={`text-sm mt-2 ${msg.t === 'ok' ? 'text-up' : 'text-down'}`}>{msg.x}</p>
        )}

        {market.rules && (
          <details className="mt-3 group">
            <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300 list-none flex items-center gap-1">
              <ShieldCheck size={12} /> Resolution criteria
            </summary>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{market.rules}</p>
          </details>
        )}

        {user?.isAdmin && market.status !== 'resolved' && (
          <div className="mt-3 pt-3 border-t border-edge/70">
            <div className="text-[10px] uppercase tracking-wider text-accent/80 mb-1.5">
              Admin · {market.autoResolvable ? 'override resolve to' : 'resolve to'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {market.outcomes.map((o) => (
                <button
                  key={o.id}
                  disabled={busy}
                  onClick={() => resolve(o.id)}
                  className="text-xs px-2 py-1 rounded border border-edge text-slate-300 hover:border-accent hover:text-accent transition"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MyBets({ positions }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">My bets</div>
      <table className="w-full text-sm">
        <tbody>
          {positions.map((p) => {
            const settled = p.status === 'resolved'
            const won = settled && p.won
            return (
              <tr key={p.id} className="border-b border-edge/50">
                <td className="py-2.5 px-4 text-slate-300 max-w-sm">{p.question}</td>
                <td className="px-4 text-white">{p.outcome}</td>
                <td className="px-4 text-right font-mono text-slate-400">{money(p.stake)}</td>
                <td className="px-4 text-right">
                  {!settled ? (
                    <span className="text-xs text-slate-500">open</span>
                  ) : won ? (
                    <span className="font-mono text-up">won {money(p.payout)}</span>
                  ) : (
                    <span className="font-mono text-down">lost</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
