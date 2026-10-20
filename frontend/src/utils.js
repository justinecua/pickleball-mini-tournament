export function formatTime(value) {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatRange(start, end) {
  if (!start) return ''
  return `${formatTime(start).replace(/ (AM|PM)$/, '')}–${formatTime(end)}`
}

export function formatDate(value) {
  if (!value) return 'TBD'
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// A lime, B forest, C sage, D slate, then E-H for bigger events. `fg` is the text colour on top of each.
export const BRACKETS = {
  A: { bg: 'bg-lime', fg: 'text-ink', text: 'text-olive', border: 'border-lime', hex: '#bfd63f', lines: '#29332e' },
  B: { bg: 'bg-ink', fg: 'text-lime', text: 'text-ink', border: 'border-ink', hex: '#29332e', lines: '#ffffff' },
  C: { bg: 'bg-sage', fg: 'text-white', text: 'text-sage', border: 'border-sage', hex: '#7c9c70', lines: '#ffffff' },
  D: { bg: 'bg-slate', fg: 'text-white', text: 'text-slate', border: 'border-slate', hex: '#56707a', lines: '#ffffff' },
  E: { bg: 'bg-clay', fg: 'text-white', text: 'text-clay', border: 'border-clay', hex: '#b06f3c', lines: '#ffffff' },
  F: { bg: 'bg-harbor', fg: 'text-white', text: 'text-harbor', border: 'border-harbor', hex: '#3f6f8f', lines: '#ffffff' },
  G: { bg: 'bg-plum', fg: 'text-white', text: 'text-plum', border: 'border-plum', hex: '#7a5884', lines: '#ffffff' },
  H: { bg: 'bg-sand', fg: 'text-ink', text: 'text-ink', border: 'border-sand', hex: '#d9c58e', lines: '#29332e' },
}
export const KNOCKOUT_COLOR = { bg: 'bg-forest-deep', fg: 'text-lime', text: 'text-ink', border: 'border-ink', hex: '#2e3a36', lines: '#bfd63f' }

export function bracketOf(match) {
  return match.bracket ? BRACKETS[match.bracket] : KNOCKOUT_COLOR
}

export function describeSource(source) {
  if (!source) return 'TBD'
  if (source.includes(':')) {
    const [kind, code] = source.split(':')
    const pretty = code === 'F' ? 'Final' : code.replace(/-?(\d+)$/, ' $1')
    return `${kind === 'W' ? 'Winner' : 'Loser'} ${pretty}`
  }
  if (source[0] === 'S') return `Seed ${source.slice(1)}`
  const place = source[1] === '1' ? '1st' : '2nd'
  return `${place} in Bracket ${source[0]}`
}

/** "Court 2 · North Park" style label; the venue only when the court has one. */
export function courtLabel(courts, number) {
  const venue = courts?.[number - 1]?.venue_name
  return venue ? `Court ${number} · ${venue}` : `Court ${number}`
}

export function mapsUrl(court) {
  const query = [court.venue_name, court.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function playerNames(team) {
  return [team?.player1, team?.player2].filter(Boolean).join(' & ')
}

/** Absolute link for QR codes. Set VITE_PUBLIC_URL when phones must reach this site (LAN IP or deployed URL). */
export function publicUrl(path) {
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '')
  return `${base}${path}`
}
