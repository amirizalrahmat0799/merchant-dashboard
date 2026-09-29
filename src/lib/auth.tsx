import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { merchantApi } from './api'
import { AuthContext, type Session } from './auth-context'
import type { Merchant } from './types'

const STORAGE_KEY = 'pgs.session'

/**
 * The API key is kept in sessionStorage: it survives a page refresh but is cleared when the tab
 * closes, and never lands in localStorage. (A production dashboard would use an httpOnly session
 * cookie issued by a backend-for-frontend instead of holding a secret key in the browser.)
 */
function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)

  const login = useCallback(async (apiKey: string) => {
    const merchant = await merchantApi.me(apiKey.trim())
    const next = { apiKey: apiKey.trim(), merchant: { ...merchant, apiKey: undefined } }
    setSession(next)
    writeSession(next)
    return merchant
  }, [])

  const replaceKey = useCallback((apiKey: string, merchant: Merchant) => {
    const next = { apiKey, merchant: { ...merchant, apiKey: undefined } }
    setSession(next)
    writeSession(next)
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    writeSession(null)
  }, [])

  const value = useMemo(() => ({ session, login, replaceKey, logout }), [session, login, replaceKey, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
