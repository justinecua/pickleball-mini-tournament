import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())

  useEffect(() => {
    if (!getToken()) return
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  const signIn = useCallback(async (credentials) => {
    const { token, user } = await api.login(credentials)
    setToken(token)
    setUser(user)
    return user
  }, [])

  const signUp = useCallback(async (details) => {
    const { token, user } = await api.register(details)
    setToken(token)
    setUser(user)
    return user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setToken(null)
      setUser(null)
    }
  }, [])

  const reloadUser = useCallback(() => api.me().then(setUser), [])

  const value = useMemo(
    () => ({ user, ready, isAdmin: !!user?.is_staff, signIn, signUp, signOut, reloadUser }),
    [user, ready, signIn, signUp, signOut, reloadUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
