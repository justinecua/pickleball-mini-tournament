import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Bumped after every write so all mounted views refetch.
export const RefreshContext = createContext({ version: 0, refresh: () => {} })

export function useRefresh() {
  return useContext(RefreshContext)
}

export function useApi(loader) {
  const { version } = useRefresh()
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const load = useCallback(() => {
    loader()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState((s) => ({ ...s, error, loading: false })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load, version])

  // Keep spectators' screens current while matches are being scored elsewhere.
  useEffect(() => {
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  return state
}
