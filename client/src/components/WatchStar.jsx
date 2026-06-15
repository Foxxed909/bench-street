import { Star } from 'lucide-react'
import { toggleWatch, useWatchlist } from '../lib/watchlist.js'

// A star toggle that adds/removes a model from the local watchlist. Stops the
// click from bubbling so it works inside row links.
export default function WatchStar({ slug, size = 15, className = '' }) {
  const watch = useWatchlist()
  const on = watch.has(slug)
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleWatch(slug)
      }}
      title={on ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`transition active:scale-90 ${
        on ? 'text-accent' : 'text-slate-600 hover:text-slate-300'
      } ${className}`}
    >
      <Star size={size} className={on ? 'fill-accent' : ''} />
    </button>
  )
}
