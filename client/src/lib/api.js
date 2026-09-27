import { clearInternalSession, internalRequest } from './internalEngine.js'

const TOKEN_KEY = 'bs_token'
const REFRESH_TOKEN_KEY = 'bs_refresh_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token, refreshToken = null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)

    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Browser storage can be blocked in hardened contexts.
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Ignore storage failures.
  }
  clearInternalSession()
}

// Benchstreet Internal is deliberately same-origin and backendless.
// Keep the old api.get/post/del surface so every existing page can use the
// same contracts while the implementation is local-first.
export const api = {
  get: (path) => internalRequest('GET', path),
  post: (path, body) => internalRequest('POST', path, body),
  del: (path) => internalRequest('DELETE', path)
}
