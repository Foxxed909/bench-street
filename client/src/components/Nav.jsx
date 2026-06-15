import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Wallet, Menu, X } from 'lucide-react'
import { useAuth } from '../store/auth.jsx'
import { money } from '../lib/format.js'
import LiveClock from './LiveClock.jsx'

const LINKS = [
  ['/', 'Floor', true],
  ['/predictions', 'Predictions', false],
  ['/arena', 'Arena', false],
  ['/leaderboard', 'Leaderboard', false]
]

export default function Nav() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  const link = ({ isActive }) =>
    `relative px-3 py-1.5 rounded-md text-sm font-medium transition ${
      isActive ? 'text-white' : 'text-slate-400 hover:text-white'
    }`
  const mlink = ({ isActive }) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive ? 'bg-panel2 text-white' : 'text-slate-300 hover:bg-white/[0.04]'
    }`

  function doLogout() {
    logout()
    nav('/')
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="mr-5 flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#c8920f] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 11.5 L6 7 L9 9.5 L14 4" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tightest text-white">
            Bench<span className="text-accent">Street</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {LINKS.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={link}>
              {label}
            </NavLink>
          ))}
          {user && (
            <NavLink to="/portfolio" className={link}>
              Portfolio
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <LiveClock className="hidden md:flex" />
          <span className="hidden h-4 w-px bg-edge md:block" />
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-panel px-3 py-1.5 shadow-raise">
                <Wallet size={14} className="text-up" />
                <span className="num text-up">{money(user.cash)}</span>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-panel2 text-[11px] font-semibold text-slate-300">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                {user.isAdmin && <span className="pill bg-accent/15 text-accent">admin</span>}
              </div>
              <button
                onClick={doLogout}
                className="hidden text-slate-500 transition hover:text-white md:block"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="hidden btn-primary md:inline-flex">
              Sign in
            </Link>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.06] text-slate-300 transition hover:text-white md:hidden"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] bg-ink/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <nav className="space-y-1">
            {LINKS.map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end} className={mlink} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
            {user && (
              <NavLink to="/portfolio" className={mlink} onClick={() => setOpen(false)}>
                Portfolio
              </NavLink>
            )}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <LiveClock />
            {user ? (
              <button onClick={doLogout} className="text-sm text-slate-400 hover:text-white">
                Log out
              </button>
            ) : (
              <Link to="/login" className="btn-primary" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
