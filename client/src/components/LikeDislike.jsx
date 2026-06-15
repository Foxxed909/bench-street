import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../store/auth.jsx'
import { num } from '../lib/format.js'

// Like / dislike control. Net (likes − dislikes) drives a model's price.
// `myVote` is the signed-in user's stance: 1 liked, -1 disliked, 0 none.
export default function LikeDislike({ slug, likes, dislikes, myVote, onChange, size = 'md', disabled = false }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const sm = size === 'sm'

  async function cast(value, e) {
    e?.preventDefault()
    e?.stopPropagation()
    if (disabled) return
    if (!user) return nav('/login')
    if (busy) return
    setBusy(true)
    try {
      const r = await api.post(`/models/${slug}/vote`, { value })
      onChange?.(r.myVote, r.likes, r.dislikes)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const pad = sm ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
  const icon = sm ? 13 : 15
  const base =
    'inline-flex items-center gap-1 rounded-lg border transition active:scale-95 disabled:opacity-50'

  return (
    <div className={`inline-flex items-center gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <button
        onClick={(e) => cast(1, e)}
        disabled={busy || disabled}
        title={disabled ? 'Voting disabled' : myVote === 1 ? 'Remove your like' : 'Like'}
        className={`${base} ${pad} ${
          myVote === 1
            ? 'border-up/50 bg-up/15 text-up'
            : 'border-edge text-slate-400 hover:border-slate-500 hover:text-up'
        }`}
      >
        <ThumbsUp size={icon} className={myVote === 1 ? 'fill-up/30' : ''} />
        <span className="num text-xs">{num(likes ?? 0, 0)}</span>
      </button>
      <button
        onClick={(e) => cast(-1, e)}
        disabled={busy || disabled}
        title={disabled ? 'Voting disabled' : myVote === -1 ? 'Remove your dislike' : 'Dislike'}
        className={`${base} ${pad} ${
          myVote === -1
            ? 'border-down/50 bg-down/15 text-down'
            : 'border-edge text-slate-400 hover:border-slate-500 hover:text-down'
        }`}
      >
        <ThumbsDown size={icon} className={myVote === -1 ? 'fill-down/30' : ''} />
        <span className="num text-xs">{num(dislikes ?? 0, 0)}</span>
      </button>
    </div>
  )
}
