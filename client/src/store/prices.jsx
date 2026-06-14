import { createContext, useContext, useEffect, useState } from 'react'
import { socket } from '../lib/socket.js'

const PricesCtx = createContext({ prices: {}, history: {}, votes: {} })
const MAX_POINTS = 48

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState({})
  const [history, setHistory] = useState({})
  const [votes, setVotes] = useState({})

  useEffect(() => {
    function apply(models) {
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
      setVotes((prev) => {
        const next = { ...prev }
        for (const m of models) if (m.votes != null) next[m.id] = m.votes
        return next
      })
    }
    const onPrices = (p) => apply(p.models)
    const onSnapshot = (s) => apply(s.models)
    socket.on('prices', onPrices)
    socket.on('snapshot', onSnapshot)
    return () => {
      socket.off('prices', onPrices)
      socket.off('snapshot', onSnapshot)
    }
  }, [])

  return (
    <PricesCtx.Provider value={{ prices, history, votes }}>{children}</PricesCtx.Provider>
  )
}

export const usePrices = () => useContext(PricesCtx)
