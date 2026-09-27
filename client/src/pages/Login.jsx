import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { HardDrive, ShieldCheck } from 'lucide-react'
import { useAuth } from '../store/auth.jsx'

export default function Login() {
  const { user, login, error, clearError } = useAuth()
  const [username, setUsername] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (error) setErr(error)
  }, [error])

  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setErr('')
    clearError()
    setBusy(true)
    try {
      await login(username.trim())
      nav('/')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-14 max-w-sm fade-up">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#c8920f] text-ink">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M2 11.5 L6 7 L9 9.5 L14 4" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="font-display text-xl font-bold tracking-tightest text-white">
          Bench<span className="text-accent">Street</span> <span className="text-slate-500">Internal</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Local-first AI model exchange</p>
      </div>

      <div className="card p-6">
        <h1 className="mb-1 font-display text-xl font-bold text-white">Initialize your desk</h1>
        <p className="mb-5 text-sm text-slate-400">
          Pick a trader handle. Your $100k play-money desk, votes, trades and bets stay in this browser.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            placeholder="Trader handle"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="off"
            disabled={busy}
          />
          {err && <p className="text-down text-sm">{err}</p>}
          <button disabled={busy || username.trim().length < 2} className="btn-primary w-full">
            {busy ? '…' : 'Open internal desk'}
          </button>
        </form>

        <div className="mt-5 space-y-2 border-t border-edge pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <HardDrive size={13} className="text-accent" />
            No Render/Railway API. State persists with browser storage.
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-up" />
            No password or real-money account is created.
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-600">
        Internal build · play money only · export your snapshot from Internal Desk
      </p>
    </div>
  )
}
