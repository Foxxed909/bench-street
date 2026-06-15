import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, ChevronUp } from 'lucide-react'
import { usePrices } from '../store/prices.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import Sparkline from './Sparkline.jsx'
import { num, pct, upDown } from '../lib/format.js'

// The Bench Street Index hero — a single living number for the whole market,
// with its own sparkline and the day's headline stats alongside.
export default function MarketStats({ models }) {
  const { prices, likes, dislikes } = usePrices()
  const [hist, setHist] = useState([])
  const lastPush = useRef(0)

  const live = models.map((m) => {
    const price = prices[m.id] ?? m.price
    const cp = m.prevClose ? ((price - m.prevClose) / m.prevClose) * 100 : 0
    const net = (likes[m.id] ?? m.likes ?? 0) - (dislikes[m.id] ?? m.dislikes ?? 0)
    return { ...m, price, cp, net }
  })

  // Only tradeable (active) models count toward the index — suspended/upcoming
  // models sit at $0 forever and would otherwise drag the headline number down.
  const tradeable = live.filter((m) => !m.status || m.status === 'active')
  const index = tradeable.length ? tradeable.reduce((a, m) => a + m.price, 0) / tradeable.length : 0
  const base = tradeable.length
    ? tradeable.reduce((a, m) => a + m.prevClose, 0) / tradeable.length
    : 0
  const indexCp = base ? ((index - base) / base) * 100 : 0
  const gainers = tradeable.filter((m) => m.cp > 0.01).length
  const losers = tradeable.filter((m) => m.cp < -0.01).length
  const topMover = [...tradeable].sort((a, b) => b.cp - a.cp)[0]
  const topRated = [...tradeable].sort((a, b) => b.net - a.net)[0]

  // Sample the index into a sparkline (throttled to ~1/sec). Hook must run every
  // render — keep it above any early return.
  useEffect(() => {
    if (!index) return
    const now = Date.now()
    if (now - lastPush.current < 900) return
    lastPush.current = now
    setHist((h) => [...h, index].slice(-60))
  }, [index])

  if (!models.length) return null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Hero index */}
      <div className="card lift relative overflow-hidden p-6 lg:col-span-2">
        <div className="absolute right-5 top-5 flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="label">live</span>
        </div>
        <div className="label mb-2">Bench Street Index · BSI</div>
        <div className="flex items-end gap-4">
          <AnimatedNumber
            value={index}
            format={(v) => num(v, 2)}
            className="num font-display text-5xl font-bold leading-none text-white"
          />
          <div className={`mb-1 flex items-center gap-1 text-sm font-medium ${upDown(indexCp)}`}>
            {indexCp >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span className="num">{pct(indexCp)}</span>
          </div>
        </div>
        <div className="mt-4 -mb-1">
          <Sparkline
            data={hist.length > 1 ? hist : tradeable.map((m) => m.price)}
            color={indexCp >= 0 ? '#27d18b' : '#fb5a6a'}
            width={560}
            height={56}
          />
        </div>
        <div className="mt-3 flex items-center gap-5 text-xs text-slate-500">
          <span>
            <span className="num text-up">{gainers}</span> advancing
          </span>
          <span>
            <span className="num text-down">{losers}</span> declining
          </span>
          <span>
            <span className="num text-slate-300">{models.length}</span> listed
          </span>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-rows-2 gap-4">
        <Highlight
          label="Top mover"
          model={topMover}
          icon={topMover?.cp >= 0 ? ArrowUpRight : ArrowDownRight}
          value={pct(topMover?.cp || 0)}
          tone={upDown(topMover?.cp || 0)}
        />
        <Highlight
          label="Top rated"
          model={topRated}
          icon={ChevronUp}
          value={`${topRated?.net > 0 ? '+' : ''}${num(topRated?.net || 0, 0)} net`}
          tone="text-accent"
        />
      </div>
    </div>
  )
}

function Highlight({ label, model, icon: Icon, value, tone }) {
  if (!model) return <div className="card" />
  return (
    <Link to={`/m/${model.slug}`} className="card lift flex flex-col justify-center p-4">
      <div className="label mb-2 flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
          style={{ background: `${model.color}22`, color: model.color }}
        >
          {model.ticker.slice(0, 2)}
        </span>
        <span className="truncate font-medium text-white">{model.name}</span>
      </div>
      <div className={`num mt-1.5 text-sm ${tone}`}>{value}</div>
    </Link>
  )
}
