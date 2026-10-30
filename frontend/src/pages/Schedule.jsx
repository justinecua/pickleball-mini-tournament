import { useState } from 'react'
import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import MatchCard from '../components/MatchCard'
import ScoreModal from '../components/ScoreModal'
import { Alert, Loading, Page, SectionTitle } from '../components/Ui'
import { BRACKETS, formatRange, formatTime } from '../utils'

const ROUNDS = [
  { stages: ['R16'], title: 'Round of 16' },
  { stages: ['QF'], title: 'Quarterfinals' },
  { stages: ['SF'], title: 'Semifinals' },
  { stages: ['F', '3P'], title: 'Finals' },
]

/** Round robin first, then each playoff round this tournament has. */
function sections(matches, tournament) {
  const { courts, teams_per_bracket: perBracket, advancement } = tournament
  const n = courts.length
  const qualify = advancement.wildcards
    ? `Bracket winners plus the ${advancement.wildcards} best runner${advancement.wildcards > 1 ? 's' : ''}-up.`
    : n === 1 ? 'The top two from the round robin.' : 'Top two from each bracket.'
  const list = [{
    stages: ['RR'], title: 'Round robin',
    subtitle: `${n === 1 ? 'One bracket on one court.' : 'Brackets share a pair of courts and take turns, so no team plays two games in a row.'} Every team plays the other ${perBracket - 1} in its bracket.`,
  }]
  let first = true
  for (const round of ROUNDS) {
    const games = matches.filter((m) => round.stages.includes(m.stage))
    if (!games.length) continue
    const used = Math.max(...games.map((m) => m.court))
    const where = round.stages[0] === 'F'
      ? (games.length > 1 ? 'Championship on Court 1, third place on Court 2.' : 'Championship on Court 1.')
      : used === n ? (n === 1 ? 'Court 1.' : `All ${n} courts.`) : `Courts 1–${used}.${used < n ? ` Other courts on standby.` : ''}`
    list.push({ ...round, subtitle: first ? `${qualify} ${where}` : where })
    first = false
  }
  return list.map((section, i) => ({ ...section, index: String(i + 1).padStart(2, '0') }))
}

/** Timetable: one row per time slot, one column per court. Scrolls sideways when there are many courts. */
function Timetable({ matches, select, myTeamId, tournament, showCourtHeader }) {
  const slots = [...new Set(matches.map((m) => m.start_time))]
  const courts = tournament.courts.map((c) => c.number)
  // Large screens only: phones stack each slot's games instead.
  const cols = { '--cols': `6rem repeat(${courts.length}, minmax(13rem, 1fr))` }
  return (
    <div className="overflow-hidden rounded-xl border border-ink">
      <div className="lg:overflow-x-auto">
        <div className="lg:min-w-max">
          {showCourtHeader && (
            <div className="hidden border-b border-ink bg-ink text-paper lg:grid lg:[grid-template-columns:var(--cols)]" style={cols}>
              <span className="label px-3 py-3 text-white/40">Time</span>
              {courts.map((court, i) => {
                const brackets = tournament.brackets.filter((b) => tournament.bracket_courts?.[b]?.includes(court) ?? b === tournament.brackets[i])
                return (
                  <span key={court} className="flex min-w-0 flex-col justify-center border-l border-white/10 px-3 py-3">
                    <span className="flex items-center gap-2">
                      {brackets.map((b) => <span key={b} className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-white/50 ${BRACKETS[b].bg}`} />)}
                      <span className="font-display text-xl font-black uppercase">Court {court}</span>
                      <span className="label text-white/50">{brackets.length > 1 ? `Brackets ${brackets.join(' & ')}` : `Bracket ${brackets[0]}`}</span>
                    </span>
                    {tournament.courts[i]?.venue_name && <span className="mt-0.5 truncate pl-5 text-xs text-white/50">{tournament.courts[i].venue_name}</span>}
                  </span>
                )
              })}
            </div>
          )}
          {slots.map((slot, row) => {
            const inSlot = matches.filter((m) => m.start_time === slot)
            return (
              <div key={slot} style={cols}
                className={`grid gap-3 p-3 lg:gap-0 lg:p-0 lg:[grid-template-columns:var(--cols)] ${row ? 'border-t border-line' : ''} ${row % 2 ? 'bg-paper-deep/50' : 'bg-paper'}`}>
                <div className="flex items-baseline gap-2 lg:flex-col lg:gap-0 lg:px-3 lg:py-3">
                  <span className="font-mono text-sm font-semibold">{formatTime(slot)}</span>
                  <span className="label text-ink/40">to {formatTime(inSlot[0].end_time).replace(/ (AM|PM)$/, '')}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:contents">
                  {courts.map((court) => {
                    const m = inSlot.find((x) => x.court === court)
                    return (
                      <div key={court} className={`lg:border-l lg:border-line lg:p-2 ${m ? '' : 'hidden lg:block'}`}>
                        {m ? <MatchCard match={m} onSelect={select} showTime={false} myTeamId={myTeamId} />
                          : <div className="label flex h-full min-h-20 items-center justify-center text-ink/30">Standby</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Schedule() {
  const { tapi, tournament, isHost, myTeamId } = useTournament()
  const { data, error } = useApi(tapi.matches)
  const [selected, setSelected] = useState(null)
  if (!data) return <Loading error={error} />

  const select = isHost ? setSelected : undefined

  return (
    <Page kicker="Match schedule" title="The timetable">
      <div className="mb-10 max-w-3xl">
        <Alert tone="info">
          {isHost
            ? 'Host mode: select any match to enter or update its score.'
            : `Games are ${tournament.game_minutes} minutes max. Please be at your court 10 minutes before your slot.`}
          {myTeamId && ' Your team’s matches are outlined and tagged “You”.'}
        </Alert>
      </div>

      {sections(data, tournament).map((section) => {
        const matches = data.filter((m) => section.stages.includes(m.stage))
        return (
          <section key={section.index} className="mb-14 last-of-type:mb-0">
            <SectionTitle index={section.index}
              kicker={formatRange(matches[0]?.start_time, matches[matches.length - 1]?.end_time)}
              title={section.title} subtitle={section.subtitle} />
            <Timetable matches={matches} select={select} myTeamId={myTeamId} tournament={tournament} showCourtHeader={section.stages[0] === 'RR'} />
          </section>
        )
      })}

      {selected && <ScoreModal match={selected} onClose={() => setSelected(null)} />}
    </Page>
  )
}
