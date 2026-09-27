import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const PricesCtx = createContext({ prices: {}, history: {}, likes: {}, dislikes: {} })
const MAX_POINTS = 48

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState({})
  const [history, setHistory] = useState({})
  const [likes, setLikes] = useState({})
  const [dislikes, setDislikes] = useState({})

  useEffect(() => {
    let cancelled = false

    function apply(models) {
      if (cancelled) return
      setPrices((prev) => {
        const next = { ...prev }
        for (const m of models) next[m.id] = m.price
        return next
      })
      setHistory((prev) => {
        const next = { ...prev }
        for (const m of models) {
          const arr = (next[m.id] || []).concat(m.price)
          next[m.id] = arr.slice(-MAX_POINTS)
        }
        return next
      })
      setLikes((prev) => {
        const next = { ...prev }
        for (const m of models) next[m.id] = m.likes
        return next
      })
      setDislikes((prev) => {
        const next = { ...prev }
        for (const m of models) next[m.id] = m.dislikes
        return next
      })
    }

    async function load() {
      try {
        const d = await api.get('/models')
        apply(d.models || [])
      } catch {
        // Keep the last good board if browser storage is temporarily unavailable.
      }
    }

    const onState = () => load()
    load()
    const poll = setInterval(load, 15000)
    window.addEventListener('benchstreet:state', onState)

    return () => {
      cancelled = true
      clearInterval(poll)
      window.removeEventListener('benchstreet:state', onState)
    }
  }, [])

  return (
    <PricesCtx.Provider value={{ prices, history, likes, dislikes }}>{children}</PricesCtx.Provider>
  )
}

export const usePrices = () => useContext(PricesCtx)
