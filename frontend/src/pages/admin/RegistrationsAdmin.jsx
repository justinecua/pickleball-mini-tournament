import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi, useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import Modal from '../../components/Modal'
import QrCode from '../../components/QrCode'
import { Check } from '../../components/Icons'
import { Alert, BracketTag, Button, Card, inputClass, Loading, SectionTitle } from '../../components/Ui'
import { publicUrl } from '../../utils'
import { RegistrationMeter } from '../Join'

const STATUS_STYLE = {
  confirmed: 'bg-lime text-ink',
  waitlist: 'bg-ink text-white',
  forming: 'bg-paper-deep text-ink/70',
  withdrawn: 'bg-transparent text-ink/40 line-through',
}

function ManualCheckIn() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/checkin/${code.trim()}`) }} className="flex gap-2">
      <input className={`${inputClass} uppercase tracking-[0.2em]`} maxLength={8} placeholder="Code" value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Button type="submit" variant="ink" className="shrink-0">Check in</Button>
    </form>
  )
}

function PairForm({ solo, onDone }) {
  const { tapi } = useTournament()
  const [form, setForm] = useState({ user_a: '', user_b: '', name: '' })
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      await tapi.pairPlayers({ ...form, user_a: Number(form.user_a), user_b: Number(form.user_b) })
      setForm({ user_a: '', user_b: '', name: '' })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }
  if (solo.length < 2) return <p className="text-sm text-ink/55">{solo.length ? 'One player is waiting for a partner.' : 'No one is looking for a partner.'}</p>
  const select = (key) => (
    <select className={inputClass} required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
      <option value="">Choose player</option>
      {solo.map((p) => <option key={p.id} value={p.id}>{p.name}{p.note ? ` (${p.note})` : ''}</option>)}
    </select>
  )
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      {select('user_a')}{select('user_b')}
      <input className={inputClass} placeholder="Team name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Button type="submit">Pair</Button>
      {error && <div className="sm:col-span-4"><Alert>{error}</Alert></div>}
    </form>
  )
}

function SwapForm({ teams, onDone }) {
  const { tapi } = useTournament()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      await tapi.swapSlots(Number(a), Number(b))
      setA(''); setB('')
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }
  const select = (value, set) => (
    <select className={inputClass} required value={value} onChange={(e) => set(e.target.value)}>
      <option value="">Slot</option>
      {teams.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}
    </select>
  )
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      {select(a, setA)}{select(b, setB)}
      <Button type="submit" variant="outline">Swap</Button>
      {error && <div className="sm:col-span-3"><Alert>{error}</Alert></div>}
    </form>
  )
}

export default function RegistrationsAdmin() {
  const { refresh } = useRefresh()
  const { tapi, link, tournament } = useTournament()
  const summary = useApi(tapi.summary)
  const entries = useApi(tapi.entries)
  const solo = useApi(tapi.soloPlayers)
  const teams = useApi(tapi.teams)
  const [confirmDraw, setConfirmDraw] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  if (!summary.data || !entries.data || !solo.data || !teams.data) {
    return <Loading error={summary.error || entries.error || solo.error || teams.error} />
  }
  const reg = summary.data.registration
  const list = entries.data
  const checkedIn = list.filter((e) => e.checked_in).length
  const letters = tournament.brackets
  const bracketRange = letters.length === 1 ? 'bracket A' : `brackets ${letters[0]}–${letters[letters.length - 1]}`
  const slotRange = `${letters[0]}1–${letters[letters.length - 1]}${tournament.teams_per_bracket}`
  const joinUrl = publicUrl(link('/join'))

  async function toggleOpen() {
    setError(null)
    try {
      await tapi.update({ registration_open: !reg.open })
      refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  async function draw() {
    setError(null)
    try {
      await tapi.runDraw()
      setMessage(`Draw complete: ${reg.confirmed} teams placed into ${bracketRange}.`)
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmDraw(false)
    }
  }

  return (
    <div className="space-y-12">
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <RegistrationMeter registration={reg} />
          {!reg.drawn && (
            <Button variant={reg.open ? 'outline' : 'primary'} className="w-full" onClick={toggleOpen}>
              {reg.open ? 'Close registration' : 'Open registration'}
            </Button>
          )}
        </div>
        <Card className="flex flex-col items-center p-5 text-center">
          <p className="label text-ink/55">Poster QR</p>
          <QrCode value={joinUrl} size={150} filename={`${tournament.slug}-join-qr.png`} className="mt-3" />
          <p className="mt-2 break-all text-xs text-ink/45">{joinUrl}</p>
        </Card>
        <Card className="p-5">
          <p className="label text-ink/55">Game-day check-in</p>
          <p className="display mt-2 text-3xl">{checkedIn}<span className="text-ink/30"> / {reg.confirmed}</span></p>
          <p className="mb-4 mt-1 text-sm text-ink/60">Scan a team&apos;s ticket with your phone camera, or type the code printed under it.</p>
          <ManualCheckIn />
        </Card>
      </div>

      <section>
        <SectionTitle index="01" kicker="Bracket draw" title={reg.drawn ? 'Draw made' : 'Run the draw'}
          subtitle={reg.drawn
            ? 'Teams are placed. You can still swap two slots until the first score is entered.'
            : `Shuffles all confirmed teams into slots ${slotRange}. Any empty slots show as “Open slot”. This also clears any scores.`} />
        {reg.drawn ? (
          <Card className="p-5"><SwapForm teams={teams.data} onDone={refresh} /></Card>
        ) : (
          <Button disabled={!reg.confirmed} onClick={() => setConfirmDraw(true)}>Run draw with {reg.confirmed} team{reg.confirmed === 1 ? '' : 's'}</Button>
        )}
      </section>

      <section>
        <SectionTitle index="02" kicker={`${list.length} registrations`} title="Teams" />
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="label bg-ink text-left text-white/70">
              <tr>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-3 py-3 font-semibold">Players</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Slot</th>
                <th className="px-4 py-3 font-semibold">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/45">No teams yet. Share the poster QR, or add teams on the Teams tab.</td></tr>}
              {list.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{e.name}</p>
                    <p className="label text-ink/40">{e.added_by_host ? 'Added by host' : `Code ${e.invite_code}`}</p>
                  </td>
                  <td className="px-3 text-ink/70">{e.captain_name}{e.partner_name ? ` & ${e.partner_name}` : ''}</td>
                  <td className="px-3">
                    <span className={`label rounded-full px-2 py-0.5 ${STATUS_STYLE[e.status]}`}>
                      {e.status_display}{e.position && e.status !== 'forming' ? ` #${e.position}` : ''}
                    </span>
                  </td>
                  <td className="px-3">{e.slot ? <BracketTag bracket={e.slot.bracket}>{e.slot.code}</BracketTag> : <span className="text-ink/30">—</span>}</td>
                  <td className="px-4">
                    {e.checked_in ? <span className="inline-flex items-center gap-1 font-semibold text-olive"><Check className="h-4 w-4" /> Yes</span>
                      : e.status === 'confirmed' && e.checkin_token
                        ? <a href={`/checkin/${e.checkin_token}`} className="text-sm font-semibold text-olive hover:underline">Check in</a>
                        : <span className="text-ink/30">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle index="03" kicker={`${solo.data.length} waiting`} title="Looking for a partner" />
        <Card className="p-5">
          {solo.data.length > 0 && (
            <ul className="mb-5 flex flex-wrap gap-2">
              {solo.data.map((p) => (
                <li key={p.id} className="rounded-full bg-paper px-3 py-1.5 text-sm">
                  <span className="font-semibold">{p.name}</span>{p.note && <span className="text-ink/55"> · {p.note}</span>}
                </li>
              ))}
            </ul>
          )}
          <PairForm solo={solo.data} onDone={refresh} />
        </Card>
      </section>

      {confirmDraw && (
        <Modal title="Run the draw?" eyebrow="Bracket draw" onClose={() => setConfirmDraw(false)}>
          <p className="text-sm text-ink/70">
            {reg.confirmed} confirmed team{reg.confirmed === 1 ? '' : 's'} will be shuffled into slots {slotRange}.
            {reg.confirmed < reg.capacity && ` ${reg.capacity - reg.confirmed} slot(s) will stay open.`} Registration closes and players can no longer change teams.
          </p>
          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={draw}>Run draw</Button>
            <Button variant="ghost" onClick={() => setConfirmDraw(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
