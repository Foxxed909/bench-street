const handlers = new Map()

function bucket(event) {
  if (!handlers.has(event)) handlers.set(event, new Set())
  return handlers.get(event)
}

function dispatch(event, payload) {
  for (const fn of bucket(event)) {
    try {
      fn(payload)
    } catch {
      // A bad subscriber should not break the local event stream.
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('benchstreet:socket', (e) => {
    const event = e.detail?.event
    if (event) dispatch(event, e.detail?.payload)
  })
}

export const socket = {
  connected: true,
  on(event, fn) {
    bucket(event).add(fn)
    return this
  },
  off(event, fn) {
    bucket(event).delete(fn)
    return this
  },
  emit(event, payload) {
    // Existing components emit request-snapshot on connect. Internal mode keeps
    // state synchronised through the API/state event, so this is intentionally
    // a lightweight local event.
    dispatch(event, payload)
    return this
  }
}
