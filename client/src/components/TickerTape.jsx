import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { usePrices } from '../store/prices.jsx'
import { money, pct, upDown } from '../lib/format.js'

export default function TickerTape() {
  const [models, setModels] = useState([])
  const { prices } = usePrices()

  useEffect(() => {
    api.get('/models').then((d) => setModels(d.models || [])).catch(() => {})
  }, [])

  if (!models.length) return null

  const items = models.map((m) => {
    const price = prices[m.id] ?? m.price
    const cp = m.prevClose ? ((price - m.prevClose) / m.prevClose) * 100 : 0
    return { ...m, price, cp }
  })

  const Row = ({ tag }) => (
    <div className="flex shrink-0">
      {items.map((m) => (
        <Link
          key={m.id + tag}
          to={`/m/${m.slug}`}
          className="flex items-center gap-2 px-4 py-1.5 border-r border-edge/40 hover:bg-panel2/50 transition-colors"
        >
          <span className="font-mono text-[11px] text-slate-400">{m.ticker}</span>
          <span className="font-mono text-[11px] text-slate-100">{money(m.price)}</span>
          <span className={`font-mono text-[11px] ${upDown(m.cp)}`}>{pct(m.cp)}</span>
        </Link>
      ))}
    </div>
  )

  return (
    <div className="border-b border-edge bg-panel/40 overflow-hidden">
      <div className="flex w-max animate-ticker whitespace-nowrap hover:[animation-play-state:paused]">
        <Row tag="a" />
        <Row tag="b" />
      </div>
    </div>
  )
}
