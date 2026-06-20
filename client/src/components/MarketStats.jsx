import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { usePrices } from '../store/prices.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import Sparkline from './Sparkline.jsx'
import { num, pct, upDown } from '../lib/format.js'

// The Bench Street Index hero + headline stats, laid out as a bento: one large
// living-index tile spanning a 2×2 block, with four equal stat tiles filling the
// rest so the space tiles cleanly (no ragged stacking).
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

  // Index over models that actually have a price (active + priced). Suspended /
  // unpriced models would otherwise drag the headline number toward zero.
  const tradeable = live.filter((m) => !m.status || m.status === 'active')
  const priced = tradeable.filter((m) => m.price > 0)
  const index = priced.length ? priced.reduce((a, m) => a + m.price, 0) / priced.length : 0
  const base = priced.length ? priced.reduce((a, m) => a + (m.prevClose || 0), 0) / priced.length : 0
  const indexCp = base ? ((index - base) / base) * 100 : 0
  const gainers = tradeable.filter((m) => m.cp > 0.01).length
  const losers = tradeable.filter((m) => m.cp < -0.01).length
  // Biggest absolute mover, but only if it actually moved — otherwise the tile
  // would crown something "+0.00%" and read as a frozen board.
  const moved = [...tradeable].sort((a, b) => Math.abs(b.cp) - Math.abs(a.cp))[0]
  const topMover = moved && Math.abs(moved.cp) > 0.01 ? moved : null
  const topRated = [...tradeable].sort((a, b) => b.net - a.net)[0]

  useEffect(() => {
    if (!index) return
    const now = Date.now()
    if (now - lastPush.current < 900) return
    lastPush.current = now
    setHist((h) => [...h, index].slice(-60))
  }, [index])

  if (!models.length) return null

  return (
    <div className="grid auto-rows-[minmax(0,1fr)] grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2">
      {/* Hero index — spans a 2×2 block */}
      <div className="card relative col-span-2 row-span-2 overflow-hidden p-6">
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
        <div className="mt-5 -mb-1">
          <Sparkline
            data={hist.length > 1 ? hist : priced.map((m) => m.price)}
            color={indexCp >= 0 ? '#27d18b' : '#fb5a6a'}
            width={560}
            height={64}
          />
        </div>
        <div className="mt-4 flex items-center gap-5 text-xs text-slate-400">
          <span>
            <span className="num text-up">{gainers}</span> advancing
          </span>
          <span>
            <span className="num text-down">{losers}</span> declining
          </span>
          <span>
            <span className="num text-slate-200">{priced.length}</span> priced ·{' '}
            <span className="num text-slate-200">{models.length}</span> listed
          </span>
        </div>
      </div>

      {/* Four equal stat tiles */}
      {topMover ? (
        <ModelTile
          label="Top mover"
          model={topMover}
          icon={topMover.cp >= 0 ? ArrowUpRight : ArrowDownRight}
          value={pct(topMover.cp)}
          tone={upDown(topMover.cp)}
        />
      ) : (
        <div className="card flex flex-col justify-between p-4">
          <div className="label flex items-center gap-1.5">
            <Minus size={12} /> Top mover
          </div>
          <div className="num mt-2 text-2xl font-bold leading-none text-slate-400">Flat</div>
          <div className="mt-1.5 text-[11px] text-slate-500">no movement yet</div>
        </div>
      )}
      <ModelTile
        label="Top rated"
        model={topRated}
        icon={ChevronUp}
        value={`${topRated?.net > 0 ? '+' : ''}${num(topRated?.net || 0, 0)} net`}
        tone="text-accent"
      />
      <CountTile label="Advancing" value={gainers} icon={TrendingUp} tone="text-up" />
      <CountTile label="Declining" value={losers} icon={TrendingDown} tone="text-down" />
    </div>
  )
}

function ModelTile({ label, model, icon: Icon, value, tone }) {
  if (!model) return <div className="card" />
  return (
    <Link to={`/m/${model.slug}`} className="card lift flex flex-col justify-between p-4">
      <div className="label flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold ring-1 ring-inset ring-white/5"
          style={{ background: `${model.color}22`, color: model.color }}
        >
          {model.ticker.slice(0, 2)}
        </span>
        <span className="truncate text-sm font-medium text-white">{model.name}</span>
      </div>
      <div className={`num mt-1.5 text-sm ${tone}`}>{value}</div>
    </Link>
  )
}

function CountTile({ label, value, icon: Icon, tone }) {
  return (
    <div className="card flex flex-col justify-between p-4">
      <div className="label flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </div>
      <div className={`num mt-2 text-3xl font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-1.5 text-[11px] text-slate-500">models today</div>
    </div>
  )
}
