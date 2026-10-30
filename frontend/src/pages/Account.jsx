import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useApi } from '../hooks'
import { ArrowRight } from '../components/Icons'
import { Alert, Button, Card, Field, inputClass, Page, SectionTitle } from '../components/Ui'
import { formatDate } from '../utils'

const MY_STATUS = { confirmed: 'Confirmed', waitlist: 'Waitlist', forming: 'Waiting for partner' }

export default function Account() {
  const { user, isAdmin, reloadUser } = useAuth()
  const tournaments = useApi(api.tournaments)
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email })
  const [state, setState] = useState({ status: 'idle', errors: {} })
  const mine = (tournaments.data ?? []).filter((t) => t.can_manage || t.my_status)

  async function save(e) {
    e.preventDefault()
    setState({ status: 'saving', errors: {} })
    try {
      await api.updateMe(form)
      await reloadUser()
      setState({ status: 'saved', errors: {} })
    } catch (err) {
      setState({ status: 'idle', errors: err.fields })
    }
  }

  return (
    <Page kicker={<>{isAdmin ? 'Site admin' : 'Player'}</>} title={<>{user.first_name || user.username}</>} intro={<>@{user.username}</>}>

      <div className="grid gap-10 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <SectionTitle index="01" kicker="Profile" title="Details" />
          <Card className="p-6">
            <form onSubmit={save} className="flex flex-col gap-4">
              {state.status === 'saved' && <Alert tone="success">Profile saved.</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" error={state.errors.first_name}>
                  <input className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </Field>
                <Field label="Last name" error={state.errors.last_name}>
                  <input className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </Field>
              </div>
              <Field label="Email" error={state.errors.email}>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Button type="submit" variant="ink" className="self-start" disabled={state.status === 'saving'}>Save changes</Button>
            </form>
          </Card>
        </section>

        <section className="lg:col-span-7">
          <SectionTitle index="02" kicker={isAdmin ? 'Site admin · every tournament' : 'Hosting & playing'} title={isAdmin ? 'Tournaments' : 'My tournaments'} />
          {mine.length ? (
            <ul className="space-y-3">
              {mine.map((t) => (
                <li key={t.slug}>
                  <Link to={t.can_manage ? `/t/${t.slug}/manage` : `/t/${t.slug}/my-team`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card p-5 hover:border-ink">
                    <div className="min-w-0">
                      <p className="label text-ink/50">{formatDate(t.date)}</p>
                      <p className="mt-1 truncate text-lg font-bold">{t.name}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {t.is_host && <span className="label rounded-full bg-ink px-2 py-0.5 text-lime">Host</span>}
                        {t.can_manage && !t.is_host && <span className="label rounded-full bg-paper-deep px-2 py-0.5 text-ink/70">Admin</span>}
                        {t.my_status && <span className="label rounded-full bg-lime px-2 py-0.5 text-ink">{MY_STATUS[t.my_status]}</span>}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-ink/40" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="border-dashed p-10 text-center">
              <p className="display text-2xl">Nothing yet</p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-ink/60">
                Tournaments you host or play in show up here.
              </p>
              <div className="mt-5 flex justify-center gap-4">
                <Link to="/" className="label inline-flex items-center gap-1 text-olive hover:underline">Browse tournaments <ArrowRight className="h-3.5 w-3.5" /></Link>
                <Link to="/host" className="label inline-flex items-center gap-1 text-olive hover:underline">Host one <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </Card>
          )}
        </section>
      </div>
    </Page>
  )
}
