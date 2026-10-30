import { useState } from 'react'
import { useApi, useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import { Alert, Button, Card, inputClass, Loading, SectionTitle } from '../../components/Ui'
import { BRACKETS, bracketCourtLabel } from '../../utils'

function TeamForm({ team }) {
  const { tapi } = useTournament()
  const { refresh } = useRefresh()
  const [form, setForm] = useState({ name: team.name, player1: team.player1, player2: team.player2 })
  const [state, setState] = useState('idle')
  const dirty = form.name !== team.name || form.player1 !== team.player1 || form.player2 !== team.player2
  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setState('idle') }

  async function save(e) {
    e.preventDefault()
    setState('saving')
    try {
      await tapi.updateTeam(team.id, form)
      setState('saved')
      refresh()
    } catch {
      setState('error')
    }
  }

  const input = `${inputClass} py-2`
  return (
    <form onSubmit={save} className="space-y-1.5 border-t border-line p-4">
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-lg font-black text-ink/25">{team.seed}</span>
        <input className={`${input} font-semibold`} value={form.name} required maxLength={80} onChange={set('name')} aria-label={`${team.code} team name`} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 pl-9">
        <input className={input} placeholder="Player 1" value={form.player1} maxLength={80} onChange={set('player1')} />
        <input className={input} placeholder="Player 2" value={form.player2} maxLength={80} onChange={set('player2')} />
      </div>
      {(dirty || state !== 'idle') && (
        <div className="flex items-center justify-end gap-2 pl-9 text-xs font-bold">
          {state === 'saved' && !dirty && <span className="text-olive">Saved ✓</span>}
          {state === 'error' && <span className="text-red-600">Could not save</span>}
          {dirty && (
            <button disabled={state === 'saving'} className="rounded-md bg-ink px-4 py-1.5 text-paper disabled:opacity-50">Save</button>
          )}
        </div>
      )}
    </form>
  )
}

const EMPTY = { name: '', player1: '', player2: '' }

/** Before the draw: the host adds teams by name. They join the field like registered teams. */
function AddTeam({ registration }) {
  const { tapi } = useTournament()
  const { refresh } = useRefresh()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const full = registration.confirmed >= registration.capacity

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await tapi.addEntry(form)
      setForm(EMPTY)
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr_auto]">
        <input className={inputClass} required maxLength={80} placeholder="Team name" value={form.name} onChange={set('name')} />
        <input className={inputClass} maxLength={80} placeholder="Player 1" value={form.player1} onChange={set('player1')} />
        <input className={inputClass} maxLength={80} placeholder="Player 2" value={form.player2} onChange={set('player2')} />
        <Button type="submit" disabled={busy}>Add team</Button>
      </form>
      <p className="mt-3 text-xs text-ink/50">
        {full ? 'The field is full, so new teams go on the waitlist. Add courts or teams per bracket to make room.'
          : `${registration.capacity - registration.confirmed} of ${registration.capacity} spots left. Teams are placed into brackets by the draw.`}
      </p>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
    </Card>
  )
}

function FieldList({ entries }) {
  const { tapi } = useTournament()
  const { refresh } = useRefresh()
  const [error, setError] = useState(null)
  const active = entries.filter((e) => e.status !== 'withdrawn')

  async function remove(entry) {
    if (!window.confirm(`Remove ${entry.name} from the tournament?`)) return
    setError(null)
    try {
      await tapi.removeEntry(entry.id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!active.length) return <p className="text-sm text-ink/55">No teams yet. Add some above or share the registration link.</p>
  return (
    <>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {active.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{e.name}
                {e.added_by_host && <span className="label ml-2 rounded-full bg-paper-deep px-1.5 text-ink/60">Added by host</span>}
              </p>
              <p className="text-sm text-ink/55">{[e.captain_name, e.partner_name].filter(Boolean).join(' & ') || 'Players TBA'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="label text-ink/50">{e.status_display}{e.position && e.status !== 'forming' ? ` #${e.position}` : ''}</span>
              <button onClick={() => remove(e)} className="text-xs font-bold text-signal hover:underline">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function TeamsAdmin() {
  const { tapi, tournament } = useTournament()
  const teams = useApi(tapi.teams)
  const entries = useApi(tapi.entries)
  if (!teams.data || !entries.data) return <Loading error={teams.error || entries.error} />
  const reg = tournament.registration

  if (!reg.drawn) {
    return (
      <div className="space-y-10">
        <section>
          <SectionTitle index="01" kicker="Before the draw" title="Add a team"
            subtitle="For teams signing up in person or by message. Players don't need an account." />
          <AddTeam registration={reg} />
        </section>
        <section>
          <SectionTitle index="02" kicker={`${reg.confirmed} confirmed · ${reg.waitlist} waitlist`} title="The field" />
          <FieldList entries={entries.data} />
        </section>
      </div>
    )
  }

  return (
    <>
      <p className="mb-4 text-sm text-ink/60">The draw is made. Rename teams or fix player names in their bracket slots.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {tournament.brackets.map((bracket) => (
          <div key={bracket} className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <span className={`h-3 w-3 rounded-full ${BRACKETS[bracket].bg}`} />
              <p className="display text-lg">Bracket {bracket} <span className="label text-ink/45">{bracketCourtLabel(tournament, bracket)}</span></p>
            </div>
            {teams.data.filter((t) => t.bracket === bracket).map((team) => <TeamForm key={team.id} team={team} />)}
          </div>
        ))}
      </div>
    </>
  )
}
