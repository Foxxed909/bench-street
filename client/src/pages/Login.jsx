import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth.jsx'

export default function Login() {
  const { user, login, error, clearError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  // Sync global error state with local error state
  useEffect(() => {
    if (error) {
      setErr(error)
    }
  }, [error])

  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setErr('')
    clearError()
    setBusy(true)
    try {
      await login(username.trim(), password)
      nav('/')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm fade-up">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#c8920f] text-ink">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M2 11.5 L6 7 L9 9.5 L14 4" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="font-display text-xl font-bold tracking-tightest text-white">
          Bench<span className="text-accent">Street</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">The AI model exchange</p>
      </div>
      <div className="card p-6">
        <h1 className="mb-1 font-display text-xl font-bold text-white">
          Welcome back
        </h1>
        <p className="mb-5 text-sm text-slate-400">
          Sign in to trade and bet.
        </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          disabled={busy}
        />
        <input
          className="input"
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {err && <p className="text-down text-sm">{err}</p>}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? '\u2026' : 'Sign in'}
        </button>
      </form>
      </div>
      <p className="mt-4 text-center text-xs text-slate-600">
        Play money only \u2014 no real funds, no card, no spam.
      </p>
    </div>
  )
}
