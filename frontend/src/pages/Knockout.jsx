import { useState } from 'react'
import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import MatchCard from '../components/MatchCard'
import ScoreModal from '../components/ScoreModal'
import { Loading, Page } from '../components/Ui'
import { courtLabel, formatRange } from '../utils'

const ROUNDS = [['R16', 'Round of 16'], ['QF', 'Quarterfinals'], ['SF', 'Semifinals'], ['F', 'Finals']]

/**
 * Elbow joining two matches to the next round. Placed in a connector column spanning
 * the same rows as the pair, so the arms land on the centres of both matches.
 */
function Elbow({ col, rows }) {
  return (
    <div className="relative hidden lg:block" style={{ gridColumn: col, gridRow: rows }}>
      <span className="absolute bottom-1/4 left-0 top-1/4 w-1/2 rounded-r-md border-y-2 border-r-2 border-ink" />
      <span className="absolute right-0 top-1/2 w-1/2 border-t-2 border-ink" />
    </div>
  )
}

function RoundHeader({ title, time, col }) {
  return (
    <div className="mb-5 border-b border-ink pb-2" style={{ gridColumn: col }}>
      <p className="display text-2xl">{title}</p>
      <p className="label text-ink/50">{time}</p>
    </div>
  )
}

export default function Knockout() {
  const { tapi, tournament, isHost, myTeamId } = useTournament()
  const { data, error } = useApi(tapi.matches)
  const [selected, setSelected] = useState(null)
  if (!data) return <Loading error={error} />

  const select = isHost ? setSelected : undefined
  const card = (m) => <MatchCard match={m} onSelect={select} showTime={false} myTeamId={myTeamId} />
  const rounds = ROUNDS
    .map(([stage, title]) => ({ stage, title, games: data.filter((m) => m.stage === stage) }))
    .filter((r) => r.games.length)
  const final = data.find((m) => m.code === 'F')
  const third = data.find((m) => m.code === '3P')
  const champion = final?.winner_id ? [final.team1, final.team2].find((t) => t.id === final.winner_id) : null
  const range = (m) => (m ? formatRange(m.start_time, m.end_time) : '')
  const first = rounds[0]?.games.length ?? 1
  const columns = rounds.map((_, i) => (i ? '2.5rem 1fr' : '1fr')).join(' ')
  const intro = tournament.advancement.wildcards
    ? 'Bracket winners and the best runners-up, seeded by record. Winners move right; slots fill in automatically as results come in.'
    : 'The top two from each bracket. Winners move right; slots fill in automatically as results come in.'

  const finalBox = final && (
    <div className="rounded-2xl bg-ink p-3 text-white">
      <p className="label mb-2 px-1 text-lime">Championship · {courtLabel(tournament.courts, final.court)}</p>
      {card(final)}
      <p className="display mt-4 px-1 text-xl">
        Champion: {champion ? <span className="text-lime">{champion.name}</span> : 'TBD'}
      </p>
    </div>
  )

  return (
    <Page kicker="Single elimination" title="Playoffs" intro={tournament.courts.length === 1 ? 'The top two from the round robin meet in the final.' : intro}>

      {/* Large screens: one grid, a row per first-round match, connector columns between rounds. */}
      <div className="hidden lg:grid lg:gap-y-4" style={{ gridTemplateColumns: columns }}>
        {rounds.map((round, r) => <RoundHeader key={round.stage} title={round.title} time={range(round.games[0])} col={2 * r + 1} />)}
        {rounds.map((round, r) => {
          const span = 2 ** r
          const col = 2 * r + 1
          const games = round.stage === 'F' ? [final] : round.games
          return games.map((m, j) => (
            <div key={m.id} className="flex flex-col justify-center" style={{ gridColumn: col, gridRow: `${2 + j * span} / span ${span}` }}>
              {round.stage === 'F' ? finalBox : card(m)}
            </div>
          ))
        })}
        {rounds.slice(0, -1).map((round, r) => {
          const span = 2 ** (r + 1)
          return Array.from({ length: round.games.length / 2 }, (_, j) => (
            <Elbow key={`${round.stage}-${j}`} col={2 * r + 2} rows={`${2 + j * span} / span ${span}`} />
          ))
        })}
        {third && (
          <div style={{ gridColumn: 2 * rounds.length - 1, gridRow: 2 + first }} className="mt-6">
            <p className="label mb-2 text-ink/50">Third place · {courtLabel(tournament.courts, third.court)} · {range(third)}</p>
            {card(third)}
          </div>
        )}
      </div>

      {/* Small screens: rounds stacked. */}
      <div className="space-y-10 lg:hidden">
        {rounds.map((round) => (
          <section key={round.stage}>
            <RoundHeader title={round.title} time={range(round.games[0])} />
            <div className="grid gap-3 sm:grid-cols-2">
              {(round.stage === 'F' ? [final, third].filter(Boolean) : round.games).map((m) => <div key={m.id}>{card(m)}</div>)}
            </div>
          </section>
        ))}
        {champion && <p className="display text-2xl">Champion: <span className="text-olive">{champion.name}</span></p>}
      </div>

      {selected && <ScoreModal match={selected} onClose={() => setSelected(null)} />}
    </Page>
  )
}
