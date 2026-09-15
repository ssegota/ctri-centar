import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    api.get('/auth/me')
      .then((d) => { if (alive) setUser(d.user) })
      .catch(() => { if (alive) setUser(null) })
      .finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  const login = useCallback(async (username, password) => {
    const d = await api.post('/auth/login', { username, password })
    setUser(d.user)
    return d.user
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const d = await api.get('/auth/me')
      setUser(d.user)
      return d.user
    } catch {
      setUser(null)
      return null
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      refresh,
      setUser,
      isAdmin: user?.role === 'admin',
      mustChangePassword: !!user?.mustChangePassword,
    }),
    [user, ready, login, logout, refresh],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
