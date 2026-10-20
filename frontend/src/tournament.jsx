import { createContext, useCallback, useContext, useMemo } from 'react'
import { tournamentApi } from './api'
import { useApi } from './hooks'

const TournamentContext = createContext(null)

/** Loads one tournament (by its slug in the URL) for every page underneath. Remount with key={slug}. */
export function TournamentProvider({ slug, children }) {
  const tapi = useMemo(() => tournamentApi(slug), [slug])
  const { data, error } = useApi(tapi.tournament)
  const link = useCallback((path = '') => `/t/${slug}${path}`, [slug])
  const value = useMemo(() => ({
    slug,
    tapi,
    link,
    tournament: data,
    error,
    isHost: !!data?.is_host,
    myTeamId: data?.my_team?.id,
  }), [slug, tapi, link, data, error])
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
}

/** The current tournament, or null outside /t/:slug. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTournament() {
  return useContext(TournamentContext)
}
