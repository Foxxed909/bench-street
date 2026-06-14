import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../store/auth.jsx'
import { num } from '../lib/format.js'

// Toggleable upvote. `count` is the live vote total (from the prices store);
// `voted` is whether the signed-in user has voted. Calls back with the server truth.
export default function VoteButton({ slug, count, voted, onChange, size = 'md' }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  async function toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return nav('/login')
    if (busy) return
    setBusy(true)
    try {
      const r = await api.post(`/models/${slug}/vote`, {})
      onChange?.(r.voted, r.votes)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const compact = size === 'sm'
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={voted ? 'Remove your vote' : 'Vote for this model'}
      className={`inline-flex items-center gap-1 rounded-lg border transition active:scale-95 ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      } ${
        voted
          ? 'border-up/40 bg-up/15 text-up'
          : 'border-edge text-slate-400 hover:border-slate-500 hover:text-white'
      }`}
    >
      <ChevronUp size={compact ? 13 : 15} className={voted ? 'fill-up' : ''} />
      <span className="num text-xs">{num(count ?? 0, 0)}</span>
    </button>
  )
}
