import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useApi } from '../hooks'
import { ArrowRight, Bolt, Court, Pin, Trophy } from '../components/Icons'
import { Card, CourtDiagram, Loading, SectionTitle } from '../components/Ui'
import { formatTime } from '../utils'

const MY_STATUS = { confirmed: 'You’re in', waitlist: 'Waitlisted', forming: 'Team forming' }

/** Calendar-page stub: month over day, or a dash while the date is TBD. */
function DateStub({ date }) {
  const d = date ? new Date(`${date}T00:00:00`) : null
  return (
    <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-lime text-ink">
      <span className="label text-[10px] text-ink/70">{d ? d.toLocaleDateString(undefined, { month: 'short' }) : 'Date'}</span>
      <span className="display text-2xl leading-none">{d ? d.getDate() : '—'}</span>
    </div>
  )
}

function TournamentCard({ t }) {
  const reg = t.registration
  const state = reg.drawn ? ['Brackets set', 'bg-white/10 text-white'] : reg.open ? ['Open', 'bg-lime text-ink'] : ['Closed', 'bg-white/10 text-white/70']
  const pct = reg.capacity ? Math.min(100, (reg.confirmed / reg.capacity) * 100) : 0
  const left = Math.max(0, reg.capacity - reg.confirmed)
  return (
    <Link to={t.can_manage ? `/t/${t.slug}/manage` : `/t/${t.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-ink hover:shadow-lg">
      <div className="court-grid relative bg-forest-night p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <DateStub date={t.date} />
          <div className="flex flex-wrap justify-end gap-1">
            {t.is_host && <span className="label rounded-full bg-white px-2 py-0.5 text-ink">Hosting</span>}
            {t.can_manage && !t.is_host && <span className="label rounded-full bg-white/15 px-2 py-0.5 text-white">Admin</span>}
            {t.my_status && <span className="label rounded-full bg-lime px-2 py-0.5 text-ink">{MY_STATUS[t.my_status]}</span>}
            <span className={`label rounded-full px-2 py-0.5 ${state[1]}`}>{state[0]}</span>
          </div>
        </div>
        <p className="display mt-5 text-2xl leading-tight">{t.name}</p>
        <p className="mt-1 text-xs text-white/55">{t.date ? formatTime(t.start_time) : 'Date to be announced'}</p>
      </div>
      <div className="perforation" />
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-start gap-2 text-sm text-ink/70">
          <Pin className="mt-0.5 h-4 w-4 shrink-0 text-olive" />
          <span>{t.venues.length ? t.venues.join(' · ') : 'Venue TBD'}</span>
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink/70">
          <Court className="h-4 w-4 shrink-0 text-olive" /> {t.courts} court{t.courts === 1 ? '' : 's'}
        </p>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">{reg.confirmed}<span className="text-ink/40"> / {reg.capacity} teams</span></span>
            <span className="text-ink/50">{reg.drawn ? 'Draw made' : left ? `${left} spot${left === 1 ? '' : 's'} left` : 'Full'}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
            <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="truncate text-xs text-ink/45">{t.host ? `Hosted by ${t.host.name}` : ''}</span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper transition group-hover:bg-lime"><ArrowRight className="h-4 w-4" /></span>
        </div>
      </div>
    </Link>
  )
}

const FEATURES = [
  { icon: Trophy, title: 'Round robin to finals', text: 'Pools feed straight into quarterfinals, semis and a final.' },
  { icon: Court, title: 'Every court, one schedule', text: 'Spread games across courts and venues without clashes.' },
  { icon: Bolt, title: 'Scores as they happen', text: 'Players follow results and standings from their phones.' },
]

const SAMPLE_MATCH = { bracket: 'C', status: 'live', team1: { name: 'Dink Dynasty' }, score1: 9, team2: { name: 'Net Gains' }, score2: 7 }
const SAMPLE_STANDINGS = [['Dink Dynasty', 3, 0], ['Net Gains', 2, 1], ['Third Shot Drop', 1, 2], ['Kitchen Crew', 0, 3]]

/** Illustration of a live court and its pool table, built from the real components. */
function HeroPreview() {
  return (
    <div className="court-grid rounded-3xl bg-forest-night p-4 shadow-xl sm:p-6">
      <CourtDiagram match={SAMPLE_MATCH} court={2} className="aspect-[5/3] w-full" />
      <div className="mt-4 rounded-2xl bg-card p-4 text-ink">
        <div className="flex items-center justify-between">
          <p className="label text-ink/55">Bracket C</p>
          <p className="label text-ink/40">W – L</p>
        </div>
        <ol className="mt-2 divide-y divide-line text-sm">
          {SAMPLE_STANDINGS.map(([name, w, l], i) => (
            <li key={name} className="flex items-center gap-3 py-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < 2 ? 'bg-lime' : 'bg-paper-deep text-ink/60'}`}>{i + 1}</span>
              <span className="flex-1 font-medium">{name}</span>
              <span className="font-mono text-ink/60">{w} – {l}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const { data, error } = useApi(api.tournaments)
  if (!data) return <Loading error={error} />
  const hosting = data.filter((t) => t.is_host)
  const others = data.filter((t) => !t.is_host)

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div>
          <h1 className="display text-4xl text-white sm:text-6xl">Find a game or <span className="text-lime">host your own.</span></h1>
          <p className="mt-5 max-w-lg text-white/65">
            Sign up for a tournament near you, or set one up and let PickleXP handle the brackets, schedule and scores.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/host" className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-deep">
              Host a tournament <ArrowRight className="h-4 w-4" />
            </Link>
            {!user && (
              <Link to="/register" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:border-lime hover:text-lime">
                Sign up
              </Link>
            )}
          </div>
        </div>
        <HeroPreview />
      </section>

      <section className="mx-auto mb-14 grid max-w-6xl gap-3 px-4 sm:grid-cols-3 sm:px-6">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-ink"><Icon className="h-4 w-4" /></span>
            <p className="mt-4 font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-white/55">{text}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {hosting.length > 0 && (
          <section className="mb-12">
            <SectionTitle kicker={`${hosting.length} event${hosting.length === 1 ? '' : 's'}`} title="You’re hosting" dark />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hosting.map((t) => <TournamentCard key={t.slug} t={t} />)}
            </div>
          </section>
        )}
        <section>
          <SectionTitle kicker={others.length ? `${others.length} event${others.length === 1 ? '' : 's'}` : null} title="Tournaments" dark />
          {others.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((t) => <TournamentCard key={t.slug} t={t} />)}
            </div>
          ) : (
            <Card className="border-dashed p-10 text-center">
              <p className="display text-2xl">No tournaments yet</p>
              <p className="mt-2 text-sm text-ink/60">
                <Link to="/host" className="font-semibold text-olive underline underline-offset-2">Host one</Link> and share the link with your players.
              </p>
            </Card>
          )}
        </section>
      </div>
    </>
  )
}
