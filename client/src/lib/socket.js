import { io } from 'socket.io-client'

// Production: set VITE_API_URL to the backend origin. In dev it's undefined →
// same-origin connection, which Vite proxies to the Express server on :4000.
const API_BASE = import.meta.env.VITE_API_URL || undefined

export const socket = io(API_BASE, { autoConnect: true, transports: ['websocket', 'polling'] })
