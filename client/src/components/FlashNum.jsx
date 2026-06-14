import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format.js'

// Flashes green/red for a moment whenever its value changes — the heartbeat of a
// live trading screen.
export default function FlashNum({ value, format = money, className = '' }) {
  const prev = useRef(value)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    if (prev.current != null && value !== prev.current) {
      setFlash(value > prev.current ? 'flash-up' : 'flash-down')
      const id = setTimeout(() => setFlash(''), 700)
      prev.current = value
      return () => clearTimeout(id)
    }
    prev.current = value
  }, [value])

  return <span className={`rounded px-1 ${flash} ${className}`}>{format(value)}</span>
}
