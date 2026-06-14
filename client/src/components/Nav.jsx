import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuth } from '../store/auth.jsx'
import { money } from '../lib/format.js'

export default function Nav() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const link = ({ isActive }) =>
    `relative px-3 py-1.5 rounded-md text-sm font-medium transition ${
      isActive ? 'text-white' : 'text-slate-400 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="mr-5 flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#c8920f] text-ink">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 11.5 L6 7 L9 9.5 L14 4" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tightest text-white">
            Bench<span className="text-accent">Street</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5">
          <NavLink to="/" className={link} end>
            Floor
          </NavLink>
          <NavLink to="/predictions" className={link}>
            Predictions
          </NavLink>
          <NavLink to="/arena" className={link}>
            Arena
          </NavLink>
          <NavLink to="/leaderboard" className={link}>
            Leaderboard
          </NavLink>
          {user && (
            <NavLink to="/portfolio" className={link}>
              Portfolio
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5">
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
                onClick={() => {
                  logout()
                  nav('/')
                }}
                className="text-slate-500 transition hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
