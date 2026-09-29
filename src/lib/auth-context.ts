import { createContext, useContext } from 'react'
import type { Merchant } from './types'

export interface Session {
  apiKey: string
  merchant: Merchant
}

export interface AuthContextValue {
  session: Session | null
  login: (apiKey: string) => Promise<Merchant>
  replaceKey: (apiKey: string, merchant: Merchant) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For pages behind the login guard, where a session is guaranteed. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('No active session')
  return session
}
