import { createContext, useContext, useEffect, useState } from 'react'
import { socket } from '../lib/socket.js'

const PricesCtx = createContext({ prices: {}, history: {}, likes: {}, dislikes: {} })
const MAX_POINTS = 48

export function PricesProvider({ children }) {
  const [prices, setPrices] = useState({})
  const [history, setHistory] = useState({})
  const [likes, setLikes] = useState({})
  const [dislikes, setDislikes] = useState({})

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
      setLikes((prev) => {
        const next = { ...prev }
        for (const m of models) if (m.likes != null) next[m.id] = m.likes
        return next
      })
      setDislikes((prev) => {
        const next = { ...prev }
        for (const m of models) if (m.dislikes != null) next[m.id] = m.dislikes
        return next
      })
    }
    const onPrices = (p) => apply(p.models)
    const onSnapshot = (s) => apply(s.models)
    // Ask for a fresh snapshot on every (re)connect — and immediately if the socket
    // already connected before this effect mounted — so the board is never empty.
    const onConnect = () => socket.emit('request-snapshot')
    socket.on('prices', onPrices)
    socket.on('snapshot', onSnapshot)
    socket.on('connect', onConnect)
    if (socket.connected) socket.emit('request-snapshot')
    return () => {
      socket.off('prices', onPrices)
      socket.off('snapshot', onSnapshot)
      socket.off('connect', onConnect)
    }
  }, [])

  return (
    <PricesCtx.Provider value={{ prices, history, likes, dislikes }}>{children}</PricesCtx.Provider>
  )
}

export const usePrices = () => useContext(PricesCtx)
