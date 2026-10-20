import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import { Loading, Page } from '../components/Ui'
import { BRACKETS, courtLabel, playerNames } from '../utils'

function RegisteredTeams({ entries }) {
  const groups = [
    ['confirmed', 'Confirmed'], ['waitlist', 'Waitlist'], ['forming', 'Waiting for a partner'],
  ]
  return (
    <Page kicker="The field" title="Teams" intro="Registered teams so far. Brackets and seeds are set by the draw once registration closes.">
      <div className="space-y-10">
        {groups.map(([status, label]) => {
          const list = entries.filter((e) => e.status === status)
          if (!list.length) return null
          return (
            <section key={status}>
              <div className="mb-3 flex items-baseline justify-between border-b border-ink/15 pb-2">
                <h2 className="display text-xl">{label}</h2>
                <span className="label text-ink/50">{list.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((e) => (
                  <div key={e.id} className="rounded-xl border border-line bg-card p-4">
                    <p className="label text-ink/45">{e.position ? `#${e.position}` : 'Forming'}</p>
                    <p className="mt-3 text-lg font-bold leading-tight">{e.name}</p>
                    <p className="mt-1 text-sm text-ink/55">{e.captain_name}{e.partner_name ? ` & ${e.partner_name}` : ''}</p>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
        {!entries.length && <p className="text-ink/55">No teams have registered yet.</p>}
      </div>
    </Page>
  )
}

export default function Teams() {
  const { tapi, tournament, myTeamId } = useTournament()
  const { data, error } = useApi(tapi.teams)
  const entries = useApi(tapi.entries)
  if (!data || !entries.data) return <Loading error={error || entries.error} />
  if (!tournament.registration.drawn) return <RegisteredTeams entries={entries.data} />

  return (
    <Page kicker="The field" title="Teams" intro={<>{data.length} doubles teams, {data.length * 2} players, {tournament.teams_per_bracket} per bracket. Seeds set the round-robin order.</>}>
      <div className="space-y-10">
        {tournament.brackets.map((bracket, i) => (
          <section key={bracket}>
            <div className="mb-3 flex items-center gap-3 border-b border-ink pb-2">
              <span className={`h-4 w-4 rounded-full ${BRACKETS[bracket].bg}`} />
              <h2 className="display text-xl">Bracket {bracket}</h2>
              <span className="label text-ink/50">{courtLabel(tournament.courts, i + 1)}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.filter((t) => t.bracket === bracket).map((team) => (
                <div key={team.id} className={`relative overflow-hidden rounded-xl border bg-card p-4 ${team.id === myTeamId ? 'border-lime shadow-[0_0_0_3px_rgb(191_214_63/0.55)]' : 'border-line'}`}>
                  <span className={`display absolute -right-1 -top-3 text-5xl opacity-15 ${BRACKETS[bracket].text}`}>{team.seed}</span>
                  <p className="label text-ink/45">Seed {team.seed} · {team.code}</p>
                  <p className="mt-6 text-lg font-bold leading-tight">{team.name}</p>
                  <p className="mt-1 text-sm text-ink/55">{playerNames(team) || 'Players TBA'}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}
