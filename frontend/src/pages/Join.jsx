import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useRefresh } from '../hooks'
import { useTournament } from '../tournament'
import { ArrowRight, Check, Users } from '../components/Icons'
import { Alert, Button, Card, Field, inputClass, Loading, Page, SectionTitle } from '../components/Ui'

export function RegistrationMeter({ registration }) {
  const { confirmed, capacity, waitlist, open, drawn } = registration
  const pct = capacity ? Math.min(100, (confirmed / capacity) * 100) : 0
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label text-ink/55">Teams confirmed</p>
        <span className={`label shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 ${open ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>
          {drawn ? 'Drawn' : open ? 'Open' : 'Closed'}
        </span>
      </div>
      <p className="display mt-2 text-3xl">{confirmed}<span className="text-ink/30"> / {capacity}</span></p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-deep">
        <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink/60">
        {confirmed >= capacity ? `Full. ${waitlist} team${waitlist === 1 ? '' : 's'} on the waitlist.` : `${capacity - confirmed} spots left.`}
      </p>
    </Card>
  )
}

const steps = (capacity) => [
  ['Sign up', 'Create a free account, or log in if you have one.'],
  ['Create your team', 'Name it and get an invite link for your partner.'],
  ['Partner joins', `Your team is confirmed the moment they accept. The first ${capacity} teams get in.`],
]

function GuestPanel({ invite, from, capacity }) {
  return (
    <Card className="p-6 sm:p-8">
      {invite ? (
        <>
          <p className="label text-olive">You&apos;re invited</p>
          <p className="display mt-2 text-2xl">{invite.captain_name} wants you on <span className="text-olive">{invite.name}</span></p>
          <p className="mt-3 text-sm text-ink/60">Sign up or log in to accept. You&apos;ll come straight back here.</p>
        </>
      ) : (
        <ol className="space-y-4">
          {steps(capacity).map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime font-display text-sm font-extrabold">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ink/60">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/register" state={{ from }} className="rounded-full bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-deep">Sign up</Link>
        <Link to="/login" state={{ from }} className="rounded-full border border-ink/25 px-6 py-3 text-sm font-semibold hover:border-ink">I have an account</Link>
      </div>
    </Card>
  )
}

function CreateTeam({ disabled, onDone }) {
  const { tapi } = useTournament()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await tapi.createEntry(name)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Card className="p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime"><Users className="h-5 w-5" /></span>
      <p className="display mt-4 text-lg">Create a team</p>
      <p className="mt-1 text-sm text-ink/60">You&apos;ll be the captain and get a link to send your partner.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <Field label="Team name">
          <input className={inputClass} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen Kings" />
        </Field>
        <Button type="submit" disabled={busy || disabled}>Create team</Button>
      </form>
    </Card>
  )
}

function JoinWithCode({ disabled, initialCode = '', onDone }) {
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.joinEntry(code)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Card className="p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-lime"><ArrowRight className="h-5 w-5" /></span>
      <p className="display mt-4 text-lg">Join a team</p>
      <p className="mt-1 text-sm text-ink/60">Got a code from your partner? Enter it here.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}
        <Field label="Invite code">
          <input className={`${inputClass} font-display uppercase tracking-[0.3em]`} required maxLength={8} value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
        </Field>
        <Button type="submit" variant="ink" disabled={busy || disabled}>Join team</Button>
      </form>
    </Card>
  )
}

function LookingForPartner() {
  const { user, reloadUser } = useAuth()
  const [note, setNote] = useState(user.partner_note || '')
  const [busy, setBusy] = useState(false)
  async function save(on) {
    setBusy(true)
    try {
      await api.updateMe({ looking_for_partner: on, partner_note: note })
      await reloadUser()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="p-6">
      <p className="display text-lg">No partner yet?</p>
      <p className="mt-1 text-sm text-ink/60">Add yourself to the partner list and an organizer will pair you with another solo player.</p>
      {user.looking_for_partner ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1.5 text-sm font-semibold"><Check className="h-4 w-4" /> You&apos;re on the list</span>
          <Button variant="ghost" disabled={busy} onClick={() => save(false)}>Remove me</Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className={inputClass} maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Skill level or availability (optional)" />
          <Button variant="outline" disabled={busy} onClick={() => save(true)} className="shrink-0">Add me</Button>
        </div>
      )}
    </Card>
  )
}

export default function Join() {
  const { code } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const { refresh } = useRefresh()
  const { tapi, link, slug, tournament } = useTournament()
  const [invite, setInvite] = useState({ data: null, error: null })
  const [mine, setMine] = useState(undefined)

  useEffect(() => {
    if (!code) return
    api.invite(code).then((data) => setInvite({ data, error: null })).catch((error) => setInvite({ data: null, error }))
  }, [code])

  const loadMine = useCallback(() => {
    if (!user) return
    tapi.myEntry().then(setMine).catch(() => setMine(null))
  }, [user, tapi])
  useEffect(() => { loadMine() }, [loadMine])

  // An invite for another tournament: go there instead.
  if (invite.data && invite.data.tournament.slug !== slug) return <Navigate to={`/t/${invite.data.tournament.slug}/join/${code}`} replace />
  if (!ready || (user && mine === undefined)) return <Loading />
  const reg = tournament.registration
  const entry = user ? mine : null
  const closed = !reg.open
  const done = () => { refresh(); navigate(link('/my-team')) }

  return (
    <Page kicker="Registration" title="Enter the tournament"
      intro={`${tournament.name} · doubles · ${reg.capacity} teams. Grab a partner, register your team, and you're in.`}>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <RegistrationMeter registration={reg} />
          {closed && <Alert tone="info">{reg.drawn ? 'The draw has been made and brackets are set.' : 'Registration is closed right now.'}</Alert>}
        </div>

        <div className="lg:col-span-8">
          {code && invite.error && <div className="mb-4"><Alert>That invite link isn&apos;t valid. Check the code with your partner.</Alert></div>}

          {!user ? (
            <GuestPanel invite={invite.data} from={location.pathname} capacity={reg.capacity} />
          ) : entry ? (
            <Card className="p-6 sm:p-8">
              <p className="label text-olive">You&apos;re registered</p>
              <p className="display mt-2 text-2xl">{entry.name}</p>
              <p className="mt-2 text-sm text-ink/60">{entry.status_display}. Manage your team, invite link and check-in ticket on your team page.</p>
              <Link to={link('/my-team')} className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold hover:bg-lime-deep">
                Go to my team <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          ) : code && invite.data ? (
            <Card className="p-6 sm:p-8">
              <p className="label text-olive">Invitation</p>
              <p className="display mt-2 text-2xl">Join <span className="text-olive">{invite.data.name}</span>?</p>
              <p className="mt-2 text-sm text-ink/60">
                Captain: {invite.data.captain_name}. {invite.data.partner_name ? 'This team already has two players.' : 'Accepting confirms your team.'}
              </p>
              <div className="mt-6 max-w-sm">
                <JoinWithCode disabled={closed || !!invite.data.partner_name} initialCode={code.toUpperCase()} onDone={done} />
              </div>
            </Card>
          ) : (
            <>
              <SectionTitle kicker="Choose one" title="How are you playing?" />
              <div className="grid gap-4 md:grid-cols-2">
                <CreateTeam disabled={closed} onDone={done} />
                <JoinWithCode disabled={closed} onDone={done} />
              </div>
              {!closed && <div className="mt-4"><LookingForPartner /></div>}
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
