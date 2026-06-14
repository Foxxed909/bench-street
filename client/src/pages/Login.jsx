import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth.jsx'

export default function Login() {
  const { user, login, signup } = useAuth()
  const [mode, setMode] = useState('signup')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  if (user) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (mode === 'login') await login(username.trim(), password)
      else await signup(username.trim(), password)
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
          {mode === 'login' ? 'Welcome back' : 'Open an account'}
        </h1>
        <p className="mb-5 text-sm text-slate-400">
          {mode === 'login'
            ? 'Sign in to trade and bet.'
            : 'Start with $100,000 in play credits — no real money.'}
        </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          className="input"
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-down text-sm">{err}</p>}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
        <button
          onClick={() => {
            setErr('')
            setMode(mode === 'login' ? 'signup' : 'login')
          }}
          className="mt-4 text-sm text-slate-400 transition hover:text-white"
        >
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
