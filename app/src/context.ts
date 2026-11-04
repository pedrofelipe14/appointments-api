import { createContext, useContext, useEffect, useRef } from 'react'
import type { Api, User } from './api'
import type { Lang, Strings } from './i18n'

export interface AppContext {
  api: Api
  user: User
  lang: Lang
  t: Strings
  /** Shows a failed call to the user (and logs out on an expired session). */
  fail: (error: unknown) => void
  /** Bumped after any change, so every list reloads. */
  revision: number
  changed: () => void
}

export const Ctx = createContext<AppContext | null>(null)

export function useApp(): AppContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside the app')
  return ctx
}

/** Runs `load` now, whenever `deps` change, and every `ms` while the tab is visible. */
export function usePoll(load: () => void, ms: number, deps: unknown[]) {
  const latest = useRef(load)
  latest.current = load
  useEffect(() => {
    latest.current()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') latest.current()
    }, ms)
    const onVisible = () => document.visibilityState === 'visible' && latest.current()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps])
}
