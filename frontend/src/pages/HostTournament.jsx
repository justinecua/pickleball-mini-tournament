import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useRefresh } from '../hooks'
import { Alert, Button, Card, Field, inputClass, Page } from '../components/Ui'
import { cleanCourts, CourtsEditor, FormatSummary, TEAMS_PER_BRACKET } from '../components/TournamentForm'

export default function HostTournament() {
  const navigate = useNavigate()
  const { refresh } = useRefresh()
  const [form, setForm] = useState({ name: '', date: '', start_time: '18:00', game_minutes: 20, teams_per_bracket: 4 })
  const [courts, setCourts] = useState(() => Array.from({ length: 4 }, () => ({ venue_name: '', address: '' })))
  const [state, setState] = useState({ busy: false, errors: {} })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, errors: {} })
    try {
      const t = await api.createTournament({
        ...form, date: form.date || null, game_minutes: Number(form.game_minutes),
        teams_per_bracket: Number(form.teams_per_bracket), courts: cleanCourts(courts),
      })
      refresh()
      navigate(`/t/${t.slug}/manage`)
    } catch (err) {
      setState({ busy: false, errors: err.fields })
    }
  }

  return (
    <Page kicker="New tournament" title="Host a tournament"
      intro="Set your courts and format. PickleXP builds the brackets, the round robin, the playoffs and the run of show. You can change everything later.">
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {state.errors.detail && <Alert>{state.errors.detail}</Alert>}
          <Card className="space-y-5 p-6">
            <Field label="Tournament name" error={state.errors.name}>
              <input className={inputClass} required maxLength={120} placeholder="e.g. Spring Doubles Open" value={form.name} onChange={set('name')} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date" error={state.errors.date} hint="Optional">
                <input type="date" className={inputClass} value={form.date} onChange={set('date')} />
              </Field>
              <Field label="First serve" error={state.errors.start_time}>
                <input type="time" className={inputClass} required value={form.start_time} onChange={set('start_time')} />
              </Field>
              <Field label="Game length (min)" error={state.errors.game_minutes}>
                <input type="number" min="5" className={inputClass} required value={form.game_minutes} onChange={set('game_minutes')} />
              </Field>
            </div>
          </Card>
          <Card className="p-6">
            <CourtsEditor courts={courts} onChange={setCourts} error={state.errors.courts} />
          </Card>
          <Card className="p-6">
            <Field label="Teams per bracket" error={state.errors.teams_per_bracket} hint="Every team plays every other team in its bracket.">
              <div className="mt-1 flex gap-2">
                {TEAMS_PER_BRACKET.map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, teams_per_bracket: n })}
                    className={`h-11 w-14 rounded-xl border text-lg font-bold ${Number(form.teams_per_bracket) === n ? 'border-ink bg-ink text-lime' : 'border-line bg-card hover:border-ink'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-5">
          <div className="lg:sticky lg:top-36">
            <FormatSummary courts={courts.length} teamsPerBracket={Number(form.teams_per_bracket)} />
            <Button type="submit" className="mt-4 w-full py-3.5 text-base" disabled={state.busy}>
              {state.busy ? 'Creating…' : 'Create tournament'}
            </Button>
            <p className="mt-3 text-center text-xs text-ink/50">You&apos;ll be the host. Add teams or open registration next.</p>
          </div>
        </div>
      </form>
    </Page>
  )
}
