import { BarChart3 } from 'lucide-react'

// Curated benchmark scores for a model. `data` is { BridgeBench: 72, ... } or null.
export default function Benchmarks({ data, color = '#f0c04e' }) {
  const entries = data ? Object.entries(data) : []
  if (entries.length === 0) return null
  const avg = Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length)

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 label">
          <BarChart3 size={13} /> Benchmarks
        </div>
        <span className="text-xs text-slate-500">
          avg <span className="num font-semibold text-white">{avg}</span>
        </span>
      </div>
      <div className="space-y-2.5">
        {entries.map(([name, score]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-slate-400">{name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, score))}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`
                }}
              />
            </div>
            <span className="num w-8 shrink-0 text-right text-xs font-medium text-white">
              {score}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-600">
        BridgeBench is the live vibe-coding board; others mirror well-known evals. Curated snapshot.
      </p>
    </div>
  )
}
