import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format.js'

// Eases to each new value with requestAnimationFrame and flashes green/red — the
// numbers physically roll, like a real trading terminal.
export default function AnimatedNumber({ value, format = money, className = '', duration = 600 }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (from === to || to == null) return

    setFlash(to > from ? 'flash-up' : 'flash-down')
    const ft = setTimeout(() => setFlash(''), 700)

    let raf
    let start
    const tick = (ts) => {
      if (start === undefined) start = ts
      const p = Math.min(1, (ts - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * eased
      displayRef.current = v
      setDisplay(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        displayRef.current = to
        setDisplay(to)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(ft)
    }
  }, [value, duration])

  return <span className={`rounded px-1 ${flash} ${className}`}>{format(display)}</span>
}
