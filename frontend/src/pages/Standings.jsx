import { Fragment } from 'react'
import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import { Loading, Page } from '../components/Ui'
import { BRACKETS, courtLabel } from '../utils'

const COLUMNS = [['P', 'Played'], ['W', 'Wins'], ['L', 'Losses'], ['PF', 'Points for'], ['PA', 'Points against']]

export default function Standings() {
  const { tapi, tournament, myTeamId } = useTournament()
  const { data, error } = useApi(tapi.standings)
  if (!data) return <Loading error={error} />
  const { per_bracket: perBracket, wildcards } = data
  const intro = `Ranked by wins, then point difference, then points scored. ${wildcards
    ? `Bracket winners go through to the playoffs, plus the ${wildcards} best runner${wildcards > 1 ? 's' : ''}-up across all brackets.`
    : 'Teams above the qualification line go through to the playoffs.'}`

  return (
    <Page kicker="Group stage" title="Standings" intro={intro}>
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(data.brackets).map(([bracket, { court, complete, rows }]) => (
          <div key={bracket} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-md font-display text-xl font-extrabold ${BRACKETS[bracket].bg} ${BRACKETS[bracket].fg}`}>{bracket}</span>
                <div>
                  <p className="display text-base">Bracket {bracket}</p>
                  <p className="label text-ink/50">{courtLabel(tournament.courts, court)}</p>
                </div>
              </div>
              <span className={`label ${complete ? 'text-grass' : 'text-ink/45'}`}>{complete ? 'Final' : 'In progress'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="label text-left text-ink/45">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Pos</th>
                    <th className="py-2.5 font-medium">Team</th>
                    {COLUMNS.map(([abbr, title]) => <th key={abbr} className="px-2 py-2.5 text-center font-medium" title={title}>{abbr}</th>)}
                    <th className="px-4 py-2.5 text-right font-medium" title="Point difference">+/−</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.map((row) => {
                    const mine = row.team.id === myTeamId
                    return (
                      <Fragment key={row.team.id}>
                        <tr className={`border-t border-line ${mine ? 'bg-lime/25' : ''}`}>
                          <td className="px-4 py-3 font-display text-xl font-extrabold">{row.rank}</td>
                          <td className="py-3 font-sans">
                            <p className="font-bold">
                              {row.team.name}
                              {mine && <span className="label ml-2 rounded-full bg-lime px-1.5 text-ink">You</span>}
                              {row.qualified && row.rank > perBracket && <span className="label ml-2 rounded-full bg-ink px-1.5 text-lime">Wildcard</span>}
                            </p>
                            <p className="label text-ink/45">{row.team.code}</p>
                          </td>
                          <td className="px-2 text-center text-ink/60">{row.played}</td>
                          <td className="px-2 text-center font-semibold">{row.wins}</td>
                          <td className="px-2 text-center text-ink/60">{row.losses}</td>
                          <td className="px-2 text-center text-ink/60">{row.points_for}</td>
                          <td className="px-2 text-center text-ink/60">{row.points_against}</td>
                          <td className={`px-4 text-right font-semibold ${row.diff > 0 ? 'text-grass' : row.diff < 0 ? 'text-signal' : 'text-ink/40'}`}>
                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                          </td>
                        </tr>
                        {row.rank === perBracket && rows.length > perBracket && (
                          <tr aria-hidden="true">
                            <td colSpan={8} className="px-4">
                              <div className="flex items-center gap-2 py-1">
                                <span className="h-0 flex-1 border-t-2 border-dashed border-olive" />
                                <span className="label text-olive">Qualification line</span>
                                <span className="h-0 flex-1 border-t-2 border-dashed border-olive" />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}
