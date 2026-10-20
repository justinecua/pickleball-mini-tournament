const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`
const TOKEN_KEY = 'pmt-token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: stay logged in for this tab only */
  }
}

export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

async function request(path, { body, method = 'GET' } = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) setToken(null)
    const fields = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    const message = fields.detail
      || (Array.isArray(data) ? data.join(' ') : Object.values(fields).flat().join(' '))
      || `Request failed (${res.status})`
    throw new ApiError(message, res.status, fields)
  }
  return data
}

export const api = {
  // accounts
  register: (body) => request('/auth/register/', { method: 'POST', body }),
  login: (body) => request('/auth/login/', { method: 'POST', body }),
  logout: () => request('/auth/logout/', { method: 'POST' }),
  me: () => request('/auth/me/'),
  updateMe: (body) => request('/auth/me/', { method: 'PATCH', body }),

  // tournaments
  tournaments: () => request('/tournaments/'),
  createTournament: (body) => request('/tournaments/', { method: 'POST', body }),

  // invite codes and tickets work without knowing the tournament
  invite: (code) => request(`/entries/invite/${encodeURIComponent(code)}/`),
  joinEntry: (code) => request('/entries/join/', { method: 'POST', body: { code } }),
  ticket: (token) => request(`/checkin/${encodeURIComponent(token)}/`),
  checkIn: (token) => request(`/checkin/${encodeURIComponent(token)}/`, { method: 'POST' }),

  // site admin
  users: () => request('/users/'),
  updateUser: (id, body) => request(`/users/${id}/`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/users/${id}/`, { method: 'DELETE' }),
}

/** Endpoints for one tournament, under /api/t/<slug>/. */
export function tournamentApi(slug) {
  const t = (path, options) => request(`/t/${encodeURIComponent(slug)}${path}`, options)
  return {
    tournament: () => t('/'),
    update: (body) => t('/', { method: 'PATCH', body }),
    remove: () => t('/', { method: 'DELETE' }),

    // public data
    summary: () => t('/summary/'),
    timeline: () => t('/timeline/'),
    teams: () => t('/teams/'),
    matches: (stage) => t(`/matches/${stage ? `?stage=${stage}` : ''}`),
    standings: () => t('/standings/'),
    announcements: () => t('/announcements/'),

    // host
    updateTeam: (id, body) => t(`/teams/${id}/`, { method: 'PATCH', body }),
    updateMatch: (id, body) => t(`/matches/${id}/`, { method: 'PATCH', body }),
    resetMatch: (id) => t(`/matches/${id}/reset/`, { method: 'POST' }),
    resetResults: () => t('/reset-results/', { method: 'POST' }),
    createTimeline: (body) => t('/timeline/', { method: 'POST', body }),
    updateTimeline: (id, body) => t(`/timeline/${id}/`, { method: 'PATCH', body }),
    deleteTimeline: (id) => t(`/timeline/${id}/`, { method: 'DELETE' }),
    createAnnouncement: (body) => t('/announcements/', { method: 'POST', body }),
    updateAnnouncement: (id, body) => t(`/announcements/${id}/`, { method: 'PATCH', body }),
    deleteAnnouncement: (id) => t(`/announcements/${id}/`, { method: 'DELETE' }),
    addEntry: (body) => t('/entries/add/', { method: 'POST', body }),
    removeEntry: (id) => t(`/entries/${id}/remove/`, { method: 'POST' }),
    soloPlayers: () => t('/host/solo/'),
    pairPlayers: (body) => t('/host/pair/', { method: 'POST', body }),
    runDraw: () => t('/host/draw/', { method: 'POST' }),
    swapSlots: (teamA, teamB) => t('/host/swap/', { method: 'POST', body: { team_a: teamA, team_b: teamB } }),

    // registration
    entries: () => t('/entries/'),
    myEntry: () => t('/entries/mine/'),
    createEntry: (name) => t('/entries/', { method: 'POST', body: { name } }),
    leaveEntry: (id) => t(`/entries/${id}/leave/`, { method: 'POST' }),
  }
}
