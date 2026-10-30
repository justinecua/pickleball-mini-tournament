import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useApi } from '../hooks'
import { Check } from '../components/Icons'
import { Alert, BracketTag, Button, Card, Loading, Page } from '../components/Ui'

/** Opened by scanning a team's ticket QR. The host checks the team in; everyone else sees the ticket status. */
export default function CheckIn() {
  const { token } = useParams()
  const { user } = useAuth()
  const tournaments = useApi(api.tournaments)
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.ticket(token).then(setTicket).catch(setError)
  }, [token])

  async function checkIn() {
    setBusy(true)
    setError(null)
    try {
      setTicket(await api.checkIn(token))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (!ticket && !error) return <Loading />
  if (!ticket) {
    return (
      <Page kicker="Check-in" title="Ticket not found">
        <Alert>{error.message}</Alert>
      </Page>
    )
  }

  const event = tournaments.data?.find((t) => t.slug === ticket.tournament.slug)
  const isHost = user?.is_staff || !!event?.is_host
  const desk = `/t/${ticket.tournament.slug}/manage/registrations`
  const done = !!ticket.checked_in_at
  return (
    <Page kicker={`Check-in · ${ticket.tournament.name}`} title={ticket.name}>
      <div className="mx-auto max-w-lg">
        <Card className="overflow-hidden">
          <div className={`p-6 text-center ${done ? 'bg-lime' : ticket.valid ? 'bg-ink text-white' : 'bg-signal text-white'}`}>
            {done ? <Check className="mx-auto h-12 w-12" /> : null}
            <p className="display mt-2 text-2xl">
              {done ? 'Checked in' : ticket.valid ? 'Valid ticket' : ticket.status_display}
            </p>
            {done && <p className="mt-1 text-sm opacity-70">{new Date(ticket.checked_in_at).toLocaleTimeString()}</p>}
          </div>
          <div className="space-y-3 p-6">
            <div className="flex justify-between gap-4 text-sm"><span className="text-ink/55">Captain</span><span className="font-semibold">{ticket.captain_name}</span></div>
            <div className="flex justify-between gap-4 text-sm"><span className="text-ink/55">Partner</span><span className="font-semibold">{ticket.partner_name || '—'}</span></div>
            {ticket.slot && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-ink/55">Slot</span>
                <span className="flex items-center gap-2 font-semibold"><BracketTag bracket={ticket.slot.bracket}>{ticket.slot.code}</BracketTag> Bracket {ticket.slot.bracket}</span>
              </div>
            )}
            {error && <Alert>{error.message}</Alert>}
            {isHost ? (
              !done && ticket.valid && <Button className="mt-2 w-full py-4 text-base" disabled={busy} onClick={checkIn}>Check in team</Button>
            ) : (
              <p className="pt-2 text-center text-sm text-ink/60">Show this ticket to the host at the entrance.</p>
            )}
          </div>
        </Card>
        {isHost && <Link to={desk} className="mt-6 block text-center text-sm font-semibold text-olive hover:underline">Back to registrations</Link>}
      </div>
    </Page>
  )
}
