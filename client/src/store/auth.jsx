import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearTokens, setToken } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .get('/auth/me')
      .then((d) => {
        if (!alive) return
        setUser(d.user || null)
        if (d.user) setToken('internal-session', 'internal-session')
      })
      .catch(() => {
        if (alive) setUser(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (username) => {
    setError(null)
    try {
      const d = await api.post('/auth/login', { username })
      setToken(d.token, d.refreshToken)
      setUser(d.user)
      return d
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    const d = await api.get('/auth/me')
    setUser(d.user || null)
    if (d.user) setToken('internal-session', 'internal-session')
    return d.user || null
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthCtx.Provider value={{ user, loading, error, login, logout, refresh, clearError }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
