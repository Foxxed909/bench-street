import { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, getToken } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const d = await api.post('/auth/login', { username, password })
    setToken(d.token)
    setUser(d.user)
    return d
  }
  async function signup(username, password) {
    const d = await api.post('/auth/signup', { username, password })
    setToken(d.token)
    setUser(d.user)
    return d
  }
  function logout() {
    setToken(null)
    setUser(null)
  }
  async function refresh() {
    const d = await api.get('/auth/me')
    setUser(d.user)
    return d.user
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
