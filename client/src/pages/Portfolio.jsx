import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import FlashNum from '../components/FlashNum.jsx'
import AnimatedNumber from '../components/AnimatedNumber.jsx'
import { money, pct, upDown } from '../lib/format.js'

export default function Portfolio() {
  const [data, setData] = useState(null)
  const [trades, setTrades] = useState([])
  const [err, setErr] = useState('')
  const { prices } = usePrices()

  function load() {
    setErr('')
    api.get('/portfolio').then(setData).catch((error) => setErr(error.message))
    api.get('/portfolio/trades').then((d) => setTrades(d.trades || [])).catch(() => {})
  }
  useEffect(load, [])

  // Recompute model holdings value/P&L live from socket prices. Cash and locked
  // stakes come from the server; an open bet remains part of net worth until settled.
  const view = useMemo(() => {
    if (!data) return null
    const positions = data.positions.map((p) => {
      const price = prices[p.modelId] ?? p.price
      const value = p.shares * price
      const cost = p.shares * p.avgCost
      return { ...p, price, value, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0 }
    })
    const holdingsValue = positions.reduce((a, p) => a + p.value, 0)
    const lockedStake = data.lockedStake || 0
    return {
      ...data,
      positions,
      holdingsValue,
      lockedStake,
      netWorth: data.cash + holdingsValue + lockedStake
    }
  }, [data, prices])

  if (err && !view) return <p className="text-down">{err}</p>
  if (!view) return <p className="text-slate-500">Loading…</p>

  const totalPnl = view.positions.reduce((a, p) => a + p.pnl, 0)

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tightest text-white">Portfolio</h1>
      {err && <p className="text-sm text-down">{err}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Net worth" value={view.netWorth} />
        <Stat label="Cash" value={view.cash} />
        <Stat label="Holdings" value={view.holdingsValue} />
        <Stat label="Open bets" value={view.lockedStake} />
        <Stat label="Open P&L" value={totalPnl} className={upDown(totalPnl)} />
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">
          Holdings
        </div>
        {view.positions.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No positions yet.{' '}
            <Link to="/" className="text-accent">
              Head to the Floor
            </Link>{' '}
            and buy something.
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-edge">
                <th className="py-2 px-4 font-medium">Model</th>
                <th className="px-4 font-medium text-right">Shares</th>
                <th className="px-4 font-medium text-right">Avg cost</th>
                <th className="px-4 font-medium text-right">Price</th>
                <th className="px-4 font-medium text-right">Value</th>
                <th className="px-4 font-medium text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {view.positions.map((p) => (
                <tr key={p.slug} className="border-b border-edge/50">
                  <td className="py-3 px-4">
                    <Link to={`/m/${p.slug}`} className="hover:text-accent">
                      <span className="font-mono text-xs text-slate-400">{p.ticker}</span>
                      <span className="block text-white">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 text-right font-mono">{p.shares}</td>
                  <td className="px-4 text-right font-mono text-slate-400">{money(p.avgCost)}</td>
                  <td className="px-4 text-right">
                    <FlashNum value={p.price} className="font-mono text-white" />
                  </td>
                  <td className="px-4 text-right">
                    <FlashNum value={p.value} className="font-mono text-white" />
                  </td>
                  <td className={`px-4 text-right font-mono ${upDown(p.pnl)}`}>
                    {money(p.pnl)} <span className="text-xs">({pct(p.pnlPct)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">
          Trade history
        </div>
        {trades.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No trades yet.</p>
        ) : (
          <table className="w-full min-w-[700px] text-sm">
            <tbody>
              {trades.map((t, i) => (
                <tr key={`${t.created_at}-${i}`} className="border-b border-edge/50">
                  <td className="py-2.5 px-4">
                    <span
                      className={`pill ${
                        t.side === 'buy' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="px-4 text-white">
                    {t.shares} <span className="font-mono text-slate-400">{t.ticker}</span>
                  </td>
                  <td className="px-4 text-right font-mono text-slate-400">@ {money(t.price)}</td>
                  <td className="px-4 text-right font-mono text-white">{money(t.total)}</td>
                  <td className="px-4 text-right text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, className = 'text-white' }) {
  return (
    <div className="card lift p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <AnimatedNumber value={value} className={`text-xl font-mono ${className}`} />
    </div>
  )
}
