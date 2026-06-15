import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Trash2 } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../store/auth.jsx'
import { ago } from '../lib/format.js'

const MAX = 500

// Community comments for a single model. Anyone can read; signed-in users post.
export default function Comments({ slug }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api
      .get(`/models/${slug}/comments`)
      .then((d) => alive && setComments(d.comments || []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  async function post(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setErr('')
    try {
      const d = await api.post(`/models/${slug}/comments`, { body: text })
      setComments((c) => [d.comment, ...c])
      setBody('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    setComments((c) => c.filter((x) => x.id !== id))
    try {
      await api.del(`/models/${slug}/comments/${id}`)
    } catch {
      /* best-effort; refetch on next mount */
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-1.5 label">
        <MessageSquare size={13} /> Discussion
        <span className="ml-1 text-slate-600">{comments.length}</span>
      </div>

      {user ? (
        <form onSubmit={post} className="mb-5">
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder={`What do you think about this model, ${user.username}?`}
            maxLength={MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-600">
              {body.length}/{MAX}
            </span>
            <button disabled={busy || !body.trim()} className="btn-buy px-4 py-1.5 disabled:opacity-40">
              Post
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-down">{err}</p>}
        </form>
      ) : (
        <p className="mb-5 text-sm text-slate-500">
          <Link to="/login" className="text-accent">
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-slate-600">No comments yet — start the conversation.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel2 text-xs font-bold uppercase text-slate-300">
                {c.username.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{c.username}</span>
                  <span className="text-[11px] text-slate-600">{ago(c.createdAt)}</span>
                  {c.mine && (
                    <button
                      onClick={() => remove(c.id)}
                      title="Delete"
                      className="ml-auto text-slate-600 transition hover:text-down"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-300">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
