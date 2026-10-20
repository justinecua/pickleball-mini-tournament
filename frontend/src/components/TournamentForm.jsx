import { useState } from 'react'
import { inputClass } from './Ui'
import { BRACKETS } from '../utils'

export const MAX_COURTS = 8
export const TEAMS_PER_BRACKET = [3, 4, 5, 6]
const LETTERS = 'ABCDEFGH'

const sameVenue = (courts) => courts.every((c) => c.venue_name === courts[0].venue_name && c.address === courts[0].address)

/** How many teams reach the playoffs: 2 per bracket, trimmed down to a power of two (mirrors event/schedule.py). */
export function playoffSize(courts) {
  return 2 ** Math.floor(Math.log2(2 * courts))
}

/** "1 court · 4 teams · 6 games each · final" style summary of what the settings produce. */
export function FormatSummary({ courts, teamsPerBracket }) {
  const games = (teamsPerBracket * (teamsPerBracket - 1)) / 2
  const qualifiers = playoffSize(courts)
  const wildcards = (courts & (courts - 1)) === 0 ? 0 : qualifiers - courts
  const facts = [
    [`${courts * teamsPerBracket}`, 'teams'],
    [`${courts}`, courts === 1 ? 'bracket' : 'brackets'],
    [`${games}`, 'games per court'],
    [`${qualifiers}`, 'in the playoffs'],
  ]
  return (
    <div className="rounded-2xl bg-ink p-5 text-white">
      <p className="label text-lime">Your format</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map(([value, label]) => (
          <div key={label}>
            <dt className="sr-only">{label}</dt>
            <dd className="display text-3xl">{value}</dd>
            <dd className="text-xs text-white/60">{label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-white/65">
        Each court hosts one bracket and every team plays the others in it.{' '}
        {wildcards
          ? `Bracket winners go through, plus the ${wildcards} best runner${wildcards > 1 ? 's' : ''}-up.`
          : courts === 1 ? 'The top two meet in the final.' : 'The top two of each bracket go through.'}
      </p>
    </div>
  )
}

/** Number of courts, and where each one is. Court N hosts bracket N. */
export function CourtsEditor({ courts, onChange, error }) {
  const [shared, setShared] = useState(() => sameVenue(courts))
  const resize = (n) => {
    const count = Math.min(MAX_COURTS, Math.max(1, n))
    const template = shared ? courts[0] : { venue_name: '', address: '' }
    onChange(Array.from({ length: count }, (_, i) => courts[i] ?? { ...template }))
  }
  const setAll = (key, value) => onChange(courts.map((c) => ({ ...c, [key]: value })))
  const setOne = (i, key, value) => onChange(courts.map((c, j) => (j === i ? { ...c, [key]: value } : c)))
  const stepper = 'h-10 w-10 rounded-full border border-line bg-card text-lg font-bold hover:border-ink disabled:opacity-30'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="label block text-ink/55">Courts</span>
          <span className="text-xs text-ink/45">Up to {MAX_COURTS}. Each court hosts one bracket.</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={stepper} onClick={() => resize(courts.length - 1)} disabled={courts.length <= 1} aria-label="One court fewer">−</button>
          <span className="display w-10 text-center text-3xl">{courts.length}</span>
          <button type="button" className={stepper} onClick={() => resize(courts.length + 1)} disabled={courts.length >= MAX_COURTS} aria-label="One court more">+</button>
        </div>
      </div>

      {courts.length > 1 && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-olive" checked={shared}
            onChange={(e) => { setShared(e.target.checked); if (e.target.checked) onChange(courts.map(() => ({ ...courts[0] }))) }} />
          All courts are at the same venue
        </label>
      )}

      {shared ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Venue name" maxLength={120} value={courts[0].venue_name}
            onChange={(e) => setAll('venue_name', e.target.value)} aria-label="Venue name" />
          <input className={inputClass} placeholder="Address" maxLength={240} value={courts[0].address}
            onChange={(e) => setAll('address', e.target.value)} aria-label="Address" />
        </div>
      ) : (
        <ol className="space-y-2">
          {courts.map((court, i) => (
            <li key={i} className="grid items-center gap-2 rounded-xl border border-line bg-paper p-3 sm:grid-cols-[7rem_1fr_1.4fr]">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className={`h-3 w-3 rounded-full ${BRACKETS[LETTERS[i]].bg}`} /> Court {i + 1}
              </span>
              <input className={`${inputClass} py-2`} placeholder="Venue name" maxLength={120} value={court.venue_name}
                onChange={(e) => setOne(i, 'venue_name', e.target.value)} aria-label={`Court ${i + 1} venue`} />
              <input className={`${inputClass} py-2`} placeholder="Address" maxLength={240} value={court.address}
                onChange={(e) => setOne(i, 'address', e.target.value)} aria-label={`Court ${i + 1} address`} />
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-xs font-semibold text-signal">{[error].flat().join(' ')}</p>}
    </div>
  )
}

/** Courts as the API wants them (trimmed). */
export function cleanCourts(courts) {
  return courts.map((c) => ({ venue_name: c.venue_name.trim(), address: c.address.trim() }))
}
