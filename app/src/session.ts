// The login and the API URL survive a reload. Tokens last one hour; an expired one is dropped on load.

import type { User } from './api'

export interface Session {
  token: string
  expiresAt: number
  user: User
}

const SESSION = 'agenda-session'
const BASE = 'agenda-api'

export const DEFAULT_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function loadSession(now = Date.now()): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION) ?? 'null') as Session | null
    return s && s.expiresAt > now + 60_000 ? s : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION, JSON.stringify(session))
    else localStorage.removeItem(SESSION)
  } catch {
    // storage blocked: the session lasts until the tab closes
  }
}

export function loadBase(): string {
  try {
    return localStorage.getItem(BASE) ?? DEFAULT_BASE
  } catch {
    return DEFAULT_BASE
  }
}

export function saveBase(base: string) {
  try {
    localStorage.setItem(BASE, base)
  } catch {
    // not remembered
  }
}
