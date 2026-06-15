import { useEffect, useState } from 'react'

// Timestamp-stamped freshness signal (a terminal staple): a cyan liveness dot + a
// ticking HH:MM:SS clock. Reads as "the system is watching and this is current".
// Optional `prefix` (e.g. "as of") turns it into an inline quote stamp.
export default function LiveClock({ prefix, className = '' }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const t = now.toLocaleTimeString('en-US', { hour12: false })
  return (
    <span className={`flex items-center gap-1.5 ${className}`} title="Live market time">
      <span className="live-dot" />
      {prefix && <span className="text-xs text-slate-500">{prefix}</span>}
      <span className="num text-xs text-slate-400">{t}</span>
    </span>
  )
}
