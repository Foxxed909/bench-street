import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setToken, getToken, getRefreshToken, clearTokens } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state on mount. /auth/me deliberately returns { user: null }
  // for an expired access token, so a valid refresh token must be tried explicitly.
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (getToken()) {
          const d = await api.get('/auth/me')
          if (d.user) {
            setUser(d.user)
            return
          }
        }

        const refreshToken = getRefreshToken()
        if (!refreshToken) {
          clearTokens()
          return
        }

        const refreshResponse = await api.post('/auth/refresh', { refreshToken })
        if (refreshResponse.token && refreshResponse.refreshToken && refreshResponse.user) {
          setToken(refreshResponse.token, refreshResponse.refreshToken)
          setUser(refreshResponse.user)
          return
        }
        clearTokens()
      } catch {
        clearTokens()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = useCallback(async (username, password) => {
    setError(null)
    try {
      const d = await api.post('/auth/login', { username, password })
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
    try {
      const d = await api.get('/auth/me')
      if (d.user) {
        setUser(d.user)
        return d.user
      }

      const refreshToken = getRefreshToken()
      if (refreshToken) {
        const refreshResponse = await api.post('/auth/refresh', { refreshToken })
        if (refreshResponse.token && refreshResponse.refreshToken && refreshResponse.user) {
          setToken(refreshResponse.token, refreshResponse.refreshToken)
          setUser(refreshResponse.user)
          return refreshResponse.user
        }
      }

      clearTokens()
      setUser(null)
      return null
    } catch (err) {
      clearTokens()
      setUser(null)
      throw err
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthCtx.Provider value={{ user, loading, error, login, logout, refresh, clearError }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
