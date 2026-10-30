import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, useRefresh } from '../hooks'
import { useTournament } from '../tournament'
import MatchCard from '../components/MatchCard'
import QrCode from '../components/QrCode'
import { ArrowRight, Check } from '../components/Icons'
import { Alert, BracketTag, Button, Card, Loading, Page, SectionTitle } from '../components/Ui'
import { bracketCourtLabel, publicUrl } from '../utils'

const BANNER = {
  forming: ['bg-white text-ink ring-1 ring-line', 'Waiting for your partner', 'Send them the invite below. Your team is confirmed the moment they accept.'],
  confirmed: ['bg-lime text-ink', 'Confirmed', 'You have a spot. Show the ticket below at the entrance on game day.'],
  waitlist: ['bg-ink text-white', 'On the waitlist', 'All spots are taken. If a confirmed team drops out, the first team on the waitlist moves up automatically.'],
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div>
      <p className="label mb-1.5 text-ink/55">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()}
          className="w-full min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink" />
        <Button variant="outline" onClick={copy} className="shrink-0">{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
  )
}

export default function MyTeam() {
  const { refresh } = useRefresh()
  const { tapi, link, tournament } = useTournament()
  const matches = useApi(tapi.matches)
  const [entry, setEntry] = useState(undefined)
  const [error, setError] = useState(null)

  const load = useCallback(() => tapi.myEntry().then(setEntry).catch((e) => setError(e)), [tapi])
  useEffect(() => { load() }, [load])

  if (entry === undefined) return <Loading error={error} />

  if (!entry) {
    return (
      <Page kicker="My team" title="No team yet">
        <Card className="p-8 text-center">
          <p className="text-ink/65">You haven&apos;t registered a team for {tournament.name}. Create one or join your partner&apos;s with their code.</p>
          <Link to={link('/join')} className="mt-5 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold hover:bg-lime-deep">
            Enter the tournament <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </Page>
    )
  }

  const [bannerClass, bannerTitle, bannerText] = BANNER[entry.status] ?? BANNER.forming
  const inviteLink = publicUrl(link(`/join/${entry.invite_code}`))
  const ticketLink = entry.checkin_token ? publicUrl(`/checkin/${entry.checkin_token}`) : null
  const slot = entry.slot
  const myMatches = slot && matches.data ? matches.data.filter((m) => m.team1?.id === slot.id || m.team2?.id === slot.id) : []

  async function leave() {
    const msg = entry.is_captain
      ? 'Withdraw your team from the tournament? Your partner will be removed too.'
      : 'Leave this team? The captain will need a new partner.'
    if (!window.confirm(msg)) return
    try {
      await tapi.leaveEntry(entry.id)
      refresh()
      load()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Page kicker="My team" title={entry.name}
      intro={`${entry.captain_name} (captain)${entry.partner_name ? ` & ${entry.partner_name}` : ' · partner not joined yet'}`}>
      {error && <div className="mb-6"><Alert>{error.message}</Alert></div>}

      <div className={`mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6 ${bannerClass}`}>
        <div>
          <p className="label opacity-70">Status</p>
          <p className="display mt-1 text-2xl">
            {bannerTitle}
            {entry.position && entry.status !== 'forming' && <span className="opacity-60"> · #{entry.position}</span>}
          </p>
          <p className="mt-1 max-w-xl text-sm opacity-75">{bannerText}</p>
        </div>
        {slot && (
          <div className="rounded-xl bg-white/90 px-4 py-3 text-ink">
            <p className="label text-ink/55">Your slot</p>
            <p className="mt-1 flex items-center gap-2 font-semibold"><BracketTag bracket={slot.bracket}>{slot.code}</BracketTag> Bracket {slot.bracket} · {bracketCourtLabel(tournament, slot.bracket)}</p>
          </div>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {entry.status === 'forming' && entry.is_captain && (
          <section>
            <SectionTitle index="01" kicker="Invite" title="Bring your partner" />
            <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
              <QrCode value={inviteLink} size={150} caption="Partner scans to join" />
              <div className="w-full min-w-0 space-y-4">
                <div>
                  <p className="label text-ink/55">Invite code</p>
                  <p className="display mt-1 text-3xl tracking-[0.2em]">{entry.invite_code}</p>
                </div>
                <CopyField label="Invite link" value={inviteLink} />
              </div>
            </Card>
          </section>
        )}

        {ticketLink && (
          <section>
            <SectionTitle index={entry.status === 'forming' ? '02' : '01'} kicker="Game day" title="Check-in ticket" />
            <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
              <QrCode value={ticketLink} size={170} filename={`ticket-${entry.checkin_code}.png`} />
              <div className="space-y-3">
                <p className="text-sm text-ink/65">Show this QR at the entrance. An organizer scans it to check your team in. Both players can use it.</p>
                <div>
                  <p className="label text-ink/55">Ticket code</p>
                  <p className="display mt-1 text-2xl tracking-[0.15em]">{entry.checkin_code}</p>
                </div>
                {entry.checked_in_at ? (
                  <p className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1.5 text-sm font-semibold"><Check className="h-4 w-4" /> Checked in</p>
                ) : (
                  <p className="label text-ink/45">Not checked in yet</p>
                )}
              </div>
            </Card>
          </section>
        )}

        {slot && (
          <section className="lg:col-span-2">
            <SectionTitle index="★" kicker="Schedule" title="Your games" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myMatches.map((m) => <MatchCard key={m.id} match={m} myTeamId={slot.id} />)}
            </div>
          </section>
        )}
      </div>

      {!slot && (
        <div className="mt-10 border-t border-line pt-6">
          <Button variant="danger" onClick={leave}>{entry.is_captain ? 'Withdraw team' : 'Leave team'}</Button>
        </div>
      )}
    </Page>
  )
}
