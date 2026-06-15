import { useEffect, useState } from 'react'

// A tiny client-only watchlist: a set of model slugs persisted in localStorage,
// shared across components via a module-level pub/sub (no backend, no auth needed).
const KEY = 'bs_watchlist'
const listeners = new Set()

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

let current = read()

export function toggleWatch(slug) {
  const next = new Set(current)
  if (next.has(slug)) next.delete(slug)
  else next.add(slug)
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    /* ignore quota / private mode */
  }
  for (const l of listeners) l(current)
}

// Reactive view of the watchlist set. Re-renders any component on change.
export function useWatchlist() {
  const [set, setSet] = useState(current)
  useEffect(() => {
    const l = (s) => setSet(s)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return set
}
