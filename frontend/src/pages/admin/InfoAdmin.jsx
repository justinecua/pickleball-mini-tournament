import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import { Alert, Button, Card, Field, inputClass, SectionTitle } from '../../components/Ui'
import { cleanCourts, CourtsEditor, FormatSummary, TEAMS_PER_BRACKET } from '../../components/TournamentForm'
import { withAdminOverride } from '../../utils'

const FIELDS = ['name', 'date', 'start_time', 'game_minutes', 'teams_per_bracket', 'format', 'notes']

/** Event details, courts and format. Saving a new court count or bracket size rebuilds the schedule. */
export default function InfoAdmin() {
  const { tournament, tapi, slug } = useTournament()
  const { refresh } = useRefresh()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, tournament[k] ?? ''])))
  const [courts, setCourts] = useState(() => tournament.courts.map(({ venue_name, address }) => ({ venue_name, address })))
  const [state, setState] = useState({ status: 'idle', errors: {} })
  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setState({ status: 'idle', errors: {} }) }
  const resizing = courts.length !== tournament.courts.length || Number(form.teams_per_bracket) !== tournament.teams_per_bracket

  async function save(e) {
    e.preventDefault()
    if (resizing && tournament.registration.drawn
      && !window.confirm('Changing courts or teams per bracket rebuilds the brackets and undoes the draw. Continue?')) return
    setState({ status: 'saving', errors: {} })
    try {
      const saved = await withAdminOverride(isAdmin, (force) => tapi.update({
        ...form, date: form.date || null, game_minutes: Number(form.game_minutes),
        teams_per_bracket: Number(form.teams_per_bracket), courts: cleanCourts(courts), force,
      }))
      setState({ status: 'saved', errors: {} })
      if (saved.slug !== slug) navigate(`/t/${saved.slug}/manage/settings`, { replace: true })
      else refresh()
    } catch (err) {
      setState({ status: 'idle', errors: err.fields })
    }
  }

  async function remove() {
    if (window.prompt(`This deletes the tournament, its teams, games and notices for good. Type the name to confirm:\n\n${tournament.name}`) !== tournament.name) return
    try {
      await tapi.remove()
      navigate('/', { replace: true })
    } catch (err) {
      setState({ status: 'idle', errors: { detail: err.message } })
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <form onSubmit={save} className="space-y-6">
        {state.status === 'saved' && <Alert tone="success">Saved. Players see the changes right away.</Alert>}
        {state.errors.detail && <Alert>{state.errors.detail}</Alert>}

        <Card className="space-y-5 p-6 sm:p-8">
          <Field label="Tournament name" error={state.errors.name} hint="Renaming also changes the tournament's web address.">
            <input className={inputClass} required maxLength={120} value={form.name} onChange={set('name')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Date" error={state.errors.date} hint="Leave empty to show TBD.">
              <input type="date" className={inputClass} value={form.date} onChange={set('date')} />
            </Field>
            <Field label="First serve" error={state.errors.start_time}>
              <input type="time" className={inputClass} value={form.start_time?.slice(0, 5)} onChange={set('start_time')} />
            </Field>
            <Field label="Game length (min)" error={state.errors.game_minutes}>
              <input type="number" min="5" className={inputClass} value={form.game_minutes} onChange={set('game_minutes')} />
            </Field>
          </div>
          <Field label="Format" error={state.errors.format}>
            <input className={inputClass} value={form.format} onChange={set('format')} />
          </Field>
          <Field label="Notes for players" error={state.errors.notes}>
            <textarea rows={3} className={inputClass} value={form.notes} onChange={set('notes')} />
          </Field>
        </Card>

        <Card className="space-y-6 p-6 sm:p-8">
          <CourtsEditor courts={courts} onChange={setCourts} error={state.errors.courts} />
          <Field label="Teams per bracket" error={state.errors.teams_per_bracket}>
            <div className="mt-1 flex gap-2">
              {TEAMS_PER_BRACKET.map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, teams_per_bracket: n })}
                  className={`h-11 w-14 rounded-xl border text-lg font-bold ${Number(form.teams_per_bracket) === n ? 'border-ink bg-ink text-lime' : 'border-line bg-card hover:border-ink'}`}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <FormatSummary courts={courts.length} teamsPerBracket={Number(form.teams_per_bracket)} />
          {resizing && (
            <Alert tone="info">
              Saving rebuilds the brackets, games and run of show for the new size{tournament.registration.drawn ? ' and undoes the draw' : ''}.
              Registered teams keep their places in the queue. This isn&apos;t possible once scores have been entered.
            </Alert>
          )}
        </Card>

        <Button type="submit" variant="lime" disabled={state.status === 'saving'}>Save changes</Button>
      </form>

      <section>
        <SectionTitle kicker="Danger zone" title="Delete tournament" />
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="max-w-md text-sm text-ink/65">Removes the tournament, its teams, games, registrations and notices. Player accounts are kept.</p>
          <Button variant="danger" onClick={remove}>Delete tournament</Button>
        </Card>
      </section>
    </div>
  )
}
