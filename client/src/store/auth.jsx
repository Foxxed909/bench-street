import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, setToken, getToken, clearTokens } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (!getToken()) {
          setLoading(false)
          return
        }
        
        const d = await api.get('/auth/me')
        if (d.user) {
          setUser(d.user)
        } else {
          clearTokens()
        }
      } catch (err) {
        // Token might be expired, try to refresh
        try {
          const refreshToken = getToken()
          if (refreshToken) {
            const refreshResponse = await api.post('/auth/refresh', { refreshToken })
            if (refreshResponse.token && refreshResponse.user) {
              setToken(refreshResponse.token, refreshResponse.refreshToken)
              setUser(refreshResponse.user)
            } else {
              clearTokens()
            }
          }
        } catch {
          clearTokens()
        }
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
      clearTokens()
      setUser(null)
      return null
    } catch (err) {
      // Try to refresh token
      const refreshToken = getToken()
      if (refreshToken) {
        try {
          const refreshResponse = await api.post('/auth/refresh', { refreshToken })
          if (refreshResponse.token && refreshResponse.user) {
            setToken(refreshResponse.token, refreshResponse.refreshToken)
            setUser(refreshResponse.user)
            return refreshResponse.user
          }
        } catch {
          // Refresh failed
        }
      }
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
