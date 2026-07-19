import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, Trophy, Clock, Zap } from 'lucide-react'
import { api } from '../lib/api.js'
import { socket } from '../lib/socket.js'
import { useAuth } from '../store/auth.jsx'
import { money, num, until } from '../lib/format.js'

export default function Arena() {
  const { user, refresh } = useAuth()
  const [battles, setBattles] = useState([])
  const [mine, setMine] = useState([])
  const [, setNow] = useState(0)

  function load() {
    api.get('/battles').then((d) => setBattles(d.battles)).catch(() => {})
    if (user) api.get('/battles/mine').then((d) => setMine(d.positions)).catch(() => {})
    else setMine([])
  }
  useEffect(load, [user])

  // Keep countdowns moving, accept instant pool updates, and retain a slow poll as
  // reconnect insurance for browsers that slept through a Socket.io event.
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000)
    const poll = setInterval(load, 15000)
    const onChanged = () => load()
    const onUpdated = ({ battle } = {}) => {
      if (!battle) return
      setBattles((current) => current.map((item) => (item.id === battle.id ? battle : item)))
    }
    socket.on('battle:updated', onUpdated)
    socket.on('battle:settled', onChanged)
    socket.on('battle:new', onChanged)
    return () => {
      clearInterval(t)
      clearInterval(poll)
      socket.off('battle:updated', onUpdated)
      socket.off('battle:settled', onChanged)
      socket.off('battle:new', onChanged)
    }
  }, [user])

  const onBet = () => {
    refresh()
    load()
  }
  // Open matchups lead; settled ones are capped to a short "recent results" strip
  // so the Arena reads as live, not a graveyard of finished fights.
  const openBattles = battles.filter((b) => b.status !== 'settled')
  const settled = battles.filter((b) => b.status === 'settled').slice(0, 6)

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tightest text-white flex items-center gap-2.5">
          <Swords className="text-accent" size={24} /> Arena
        </h1>
        <p className="text-sm text-slate-400">
          Head-to-head: back a model to win its matchup. The result is simulated from the latest
          Elo win probability, so upsets happen.
        </p>
      </div>

      {openBattles.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {openBattles.map((b, i) => (
            <div key={b.id} className="fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <BattleCard battle={b} user={user} onChange={onBet} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-slate-500">
          Spinning up fresh matchups… new battles open every few minutes.
        </div>
      )}

      {settled.length > 0 && (
        <div className="space-y-3">
          <h2 className="label flex items-center gap-1.5">
            <Trophy size={12} /> Recent results
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {settled.map((b, i) => (
              <div key={b.id} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <BattleCard battle={b} user={user} onChange={onBet} />
              </div>
            ))}
          </div>
        </div>
      )}

      {user && mine.length > 0 && <MyBattles positions={mine} />}
    </div>
  )
}

function Fighter({ side, selected, onSelect, settled, disabled, hasBets }) {
  const win = settled && side.won
  const lose = settled && !side.won
  return (
    <button
      disabled={disabled}
      onClick={onSelect}
      className={`flex-1 rounded-xl border p-3 text-center transition disabled:cursor-default ${
        win
          ? 'border-up bg-up/10'
          : lose
          ? 'border-edge opacity-50'
          : selected
          ? 'border-accent bg-panel2'
          : 'border-edge hover:border-slate-600'
      }`}
    >
      <div
        className="w-10 h-10 rounded-lg grid place-items-center text-xs font-bold mx-auto mb-2"
        style={{ background: `${side.color}22`, color: side.color }}
      >
        {side.ticker.slice(0, 2)}
      </div>
      <div className="text-white font-semibold text-sm leading-tight flex items-center justify-center gap-1">
        {win && <Trophy size={13} className="text-accent" />}
        {side.name}
      </div>
      <div className="text-[11px] text-slate-500 font-mono mt-0.5">Elo {num(side.elo, 0)}</div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs">
        {hasBets ? (
          <>
            <span className="font-mono text-white">{side.impliedPct}%</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{num(side.payout, 2)}×</span>
          </>
        ) : (
          <span className="font-mono text-slate-400">
            {side.eloProb}% <span className="text-slate-600">est</span>
          </span>
        )}
      </div>
    </button>
  )
}

function BattleCard({ battle, user, onChange }) {
  const [a, b] = battle.sides
  const [side, setSide] = useState(null)
  const [stake, setStake] = useState(50)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const open = battle.status === 'open'
  const settled = battle.status === 'settled'
  const sel = side === 'a' ? a : side === 'b' ? b : null

  async function placeBet() {
    setMsg(null)
    if (!user) return
    if (!side) return setMsg({ t: 'err', x: 'Pick a side first.' })
    const amount = Number(stake)
    if (!(amount > 0)) return setMsg({ t: 'err', x: 'Enter a stake.' })
    setBusy(true)
    try {
      await api.post(`/battles/${battle.id}/bet`, { side, stake: amount })
      setMsg({ t: 'ok', x: `Backed ${sel.ticker} with ${money(amount)}` })
      onChange()
    } catch (e) {
      setMsg({ t: 'err', x: e.message })
    } finally {
      setBusy(false)
    }
  }

  async function settleNow() {
    setBusy(true)
    try {
      await api.post(`/battles/${battle.id}/settle`, {})
      onChange()
    } catch (e) {
      setMsg({ t: 'err', x: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card lift p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="pill bg-panel2 text-slate-300">{battle.category}</span>
        {settled ? (
          <span className="flex items-center gap-1 text-[11px] text-up font-medium">
            <Trophy size={12} /> Settled
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Clock size={12} /> {open ? `closes in ${until(battle.closesAt)}` : 'settling…'}
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <Fighter
          side={a}
          selected={side === 'a'}
          onSelect={() => setSide('a')}
          settled={settled}
          disabled={!open}
          hasBets={battle.hasBets}
        />
        <div className="flex items-center text-slate-600 font-bold text-xs">VS</div>
        <Fighter
          side={b}
          selected={side === 'b'}
          onSelect={() => setSide('b')}
          settled={settled}
          disabled={!open}
          hasBets={battle.hasBets}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3">
        <span className="flex items-center gap-1">
          <Zap size={11} className="text-accent" /> Elo favorite:{' '}
          {a.eloProb >= b.eloProb ? a.ticker : b.ticker} {Math.max(a.eloProb, b.eloProb)}%
        </span>
        {battle.hasBets ? (
          <span>
            pool {money(battle.pool)} · {battle.traders}{' '}
            {battle.traders === 1 ? 'backer' : 'backers'}
          </span>
        ) : (
          <span>No bets yet</span>
        )}
      </div>

      <div className="mt-auto pt-4">
        {open &&
          (user ? (
            <div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="input pl-6 w-28"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                  />
                </div>
                <button disabled={busy} onClick={placeBet} className="btn-primary flex-1">
                  {sel ? `Back ${sel.ticker}` : 'Pick a side'}
                </button>
              </div>
              {sel && Number(stake) > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  To win ≈{' '}
                  <span className="font-mono text-up">{money(Number(stake) * sel.payout)}</span> if{' '}
                  {sel.ticker} wins
                </p>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm text-accent">
              Sign in to bet
            </Link>
          ))}

        {settled && (
          <div className="text-sm text-slate-300">
            Winner: <span className="text-up font-semibold">{(a.won ? a : b).name}</span>
          </div>
        )}

        {msg && <p className={`text-sm mt-2 ${msg.t === 'ok' ? 'text-up' : 'text-down'}`}>{msg.x}</p>}

        {user?.isAdmin && !settled && (
          <button
            disabled={busy}
            onClick={settleNow}
            className="mt-3 text-xs px-2 py-1 rounded border border-edge text-slate-300 hover:border-accent hover:text-accent transition"
          >
            Admin · settle now
          </button>
        )}
      </div>
    </div>
  )
}

function MyBattles({ positions }) {
  return (
    <div className="card overflow-x-auto">
      <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">My battles</div>
      <table className="w-full min-w-[620px] text-sm">
        <tbody>
          {positions.map((p) => {
            const settled = p.status === 'settled'
            return (
              <tr key={p.id} className="border-b border-edge/50">
                <td className="py-2.5 px-4 text-slate-300">{p.category}</td>
                <td className="px-4 text-white">
                  backed <span className="font-mono">{p.side_ticker}</span>
                </td>
                <td className="px-4 text-right font-mono text-slate-400">{money(p.stake)}</td>
                <td className="px-4 text-right">
                  {!settled ? (
                    <span className="text-xs text-slate-500">
                      {p.status === 'closing' ? 'settling' : 'open'}
                    </span>
                  ) : p.won ? (
                    <span className="font-mono text-up">won {money(p.payout)}</span>
                  ) : (
                    <span className="font-mono text-down">lost</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
