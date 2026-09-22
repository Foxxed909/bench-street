const TOKEN_KEY = 'bs_token'
const REFRESH_TOKEN_KEY = 'bs_refresh_token'
// Production: set VITE_API_URL to the backend base URL. Empty in dev  Vite proxy to :4000.
// .trim() strips any stray whitespace/BOM (U+FEFF counts as whitespace in JS) so a
// corrupted env var can't turn an absolute URL into a broken relative one.
const API_BASE = (import.meta.env.VITE_API_URL || '').trim()

// Token management with refresh support
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
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The request
    // will remain unauthenticated instead of crashing the entire React tree.
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Ignore storage errors
  }
}

// Flag to prevent infinite refresh loops
let isRefreshing = false
let refreshQueue = []

// Handle token refresh
async function handleTokenRefresh(originalRequest) {
  if (isRefreshing) {
    // Queue the request to be retried after refresh completes
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject, originalRequest })
    })
  }
  
  isRefreshing = true
  const refreshToken = getRefreshToken()
  
  if (!refreshToken) {
    clearTokens()
    isRefreshing = false
    throw new Error('Session expired. Please sign in again.')
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })
    
    const isJson = (response.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await response.json().catch(() => ({})) : {}
    
    if (!response.ok) {
      clearTokens()
      throw new Error(data.error || 'Failed to refresh session')
    }
    
    if (data.token && data.refreshToken) {
      setToken(data.token, data.refreshToken)
      
      // Process queued requests
      for (const queued of refreshQueue) {
        try {
          const result = await queued.originalRequest()
          queued.resolve(result)
        } catch (err) {
          queued.reject(err)
        }
      }
      refreshQueue = []
      
      return data.token
    } else {
      clearTokens()
      throw new Error('Invalid refresh response')
    }
  } catch (error) {
    clearTokens()
    throw error
  } finally {
    isRefreshing = false
  }
}

async function request(path, opts = {}) {
  const headers = { Accept: 'application/json', ...(opts.headers || {}) }
  // Bodyless public reads do not need Content-Type. Setting it on every GET creates
  // a needless CORS preflight against the separately hosted Railway API.
  if (opts.body != null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  let token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers })
  
  // Handle 401 errors by attempting token refresh
  if (res.status === 401) {
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json().catch(() => ({})) : {}
    
    // Only attempt refresh if token was expired
    if (data.expired || data.error?.includes('expired') || data.error?.includes('Token expired')) {
      try {
        const newToken = await handleTokenRefresh(() => request(path, opts))
        if (newToken) {
          // Retry the original request with the new token
          headers.Authorization = `Bearer ${newToken}`
          return await fetch(`${API_BASE}/api${path}`, { ...opts, headers }).then(async (retryRes) => {
            const retryIsJson = (retryRes.headers.get('content-type') || '').includes('application/json')
            const retryData = retryIsJson ? await retryRes.json().catch(() => ({})) : {}
            if (!retryRes.ok) throw new Error(retryData.error || `Request failed (${retryRes.status})`)
            if (!retryIsJson) throw new Error('API returned a non-JSON response')
            return retryData
          })
        }
      } catch (refreshError) {
        // If refresh failed, throw the original error
        throw new Error(data.error || `Request failed (${res.status})`)
      }
    }
  }
  
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  // A 200 that isn't JSON means we hit the wrong origin (e.g. an SPA HTML fallback),
  // not the API \u2014 treat it as an error so callers don't get an empty shape.
  if (!isJson) throw new Error('API returned a non-JSON response')
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' })
}
