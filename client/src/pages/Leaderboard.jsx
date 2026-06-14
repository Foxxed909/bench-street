import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { api } from '../lib/api.js'
import { money } from '../lib/format.js'
import { useAuth } from '../store/auth.jsx'

export default function Leaderboard() {
  const [rows, setRows] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    api.get('/leaderboard').then((d) => setRows(d.leaderboard)).catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tightest text-white">Leaderboard</h1>
        <p className="text-sm text-slate-400">Ranked by net worth — cash plus holdings.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-edge">
              <th className="py-2.5 px-4 font-medium w-12">#</th>
              <th className="px-4 font-medium">Trader</th>
              <th className="px-4 font-medium text-right">Cash</th>
              <th className="px-4 font-medium text-right">Holdings</th>
              <th className="px-4 font-medium text-right">Net worth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.username}
                className={`border-b border-edge/50 ${
                  user && r.username === user.username ? 'bg-accent/5' : ''
                }`}
              >
                <td className="py-3 px-4">
                  {i === 0 ? (
                    <Trophy size={16} className="text-accent" />
                  ) : (
                    <span className="text-slate-500">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 text-white">{r.username}</td>
                <td className="px-4 text-right font-mono text-slate-400">{money(r.cash)}</td>
                <td className="px-4 text-right font-mono text-slate-400">
                  {money(r.holdingsValue)}
                </td>
                <td className="px-4 text-right font-mono text-white">{money(r.netWorth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
