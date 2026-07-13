const TOKEN_KEY = 'bs_token'
// Production: set VITE_API_URL to the backend base URL. Empty in dev → Vite proxy to :4000.
// .trim() strips any stray whitespace/BOM (U+FEFF counts as whitespace in JS) so a
// corrupted env var can't turn an absolute URL into a broken relative one.
const API_BASE = (import.meta.env.VITE_API_URL || '').trim()

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. The request
    // will remain unauthenticated instead of crashing the entire React tree.
  }
}

async function request(path, opts = {}) {
  const headers = { Accept: 'application/json', ...(opts.headers || {}) }
  // Bodyless public reads do not need Content-Type. Setting it on every GET creates
  // a needless CORS preflight against the separately hosted Railway API.
  if (opts.body != null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers })
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  // A 200 that isn't JSON means we hit the wrong origin (e.g. an SPA HTML fallback),
  // not the API — treat it as an error so callers don't get an empty shape.
  if (!isJson) throw new Error('API returned a non-JSON response')
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' })
}
