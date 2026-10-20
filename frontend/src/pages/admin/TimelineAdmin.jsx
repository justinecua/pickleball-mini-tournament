import { useState } from 'react'
import { useApi, useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import { Alert, Button, inputClass, Loading } from '../../components/Ui'

function Row({ event, onDone, isNew = false }) {
  const { tapi } = useTournament()
  const [form, setForm] = useState({
    order: event.order, start_time: event.start_time?.slice(0, 5) ?? '', end_time: event.end_time?.slice(0, 5) ?? '',
    activity: event.activity ?? '', games: event.games ?? '', details: event.details ?? '',
  })
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const input = `${inputClass} py-2`

  async function save(e) {
    e.preventDefault()
    setError(null)
    const body = { ...form, games: form.games === '' ? null : Number(form.games) }
    try {
      if (isNew) await tapi.createTimeline(body)
      else await tapi.updateTimeline(event.id, body)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${event.activity}" from the timeline?`)) return
    await tapi.deleteTimeline(event.id)
    onDone()
  }

  return (
    <form onSubmit={save} className={`grid gap-2 border-t border-line p-4 sm:grid-cols-12 sm:items-center ${isNew ? 'bg-lime/15' : ''}`}>
      <input className={`${input} sm:col-span-1`} type="number" min="0" value={form.order} onChange={set('order')} aria-label="Order" title="Order" />
      <input className={`${input} sm:col-span-2`} type="time" required value={form.start_time} onChange={set('start_time')} aria-label="Start" />
      <input className={`${input} sm:col-span-2`} type="time" required value={form.end_time} onChange={set('end_time')} aria-label="End" />
      <input className={`${input} sm:col-span-3`} required placeholder="Activity" value={form.activity} onChange={set('activity')} />
      <input className={`${input} sm:col-span-1`} type="number" min="0" placeholder="Games" value={form.games} onChange={set('games')} />
      <div className="flex gap-1 sm:col-span-3 sm:justify-end">
        <Button type="submit" variant={isNew ? 'lime' : 'dark'} className="px-4 py-2">{isNew ? 'Add' : 'Save'}</Button>
        {!isNew && <Button type="button" variant="danger" className="px-4 py-2" onClick={remove}>Delete</Button>}
      </div>
      <input className={`${input} sm:col-span-12`} placeholder="Details (optional)" value={form.details} onChange={set('details')} />
      {error && <div className="sm:col-span-12"><Alert>{error}</Alert></div>}
    </form>
  )
}

export default function TimelineAdmin() {
  const { tapi } = useTournament()
  const { data, error } = useApi(tapi.timeline)
  const { refresh } = useRefresh()
  const [newKey, setNewKey] = useState(0)
  if (!data) return <Loading error={error} />

  const nextOrder = Math.max(0, ...data.map((e) => e.order)) + 1
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm border border-line">
      <div className="hidden grid-cols-12 gap-2 bg-ink px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/70 sm:grid">
        <span className="col-span-1">#</span><span className="col-span-2">Start</span><span className="col-span-2">End</span>
        <span className="col-span-3">Activity</span><span className="col-span-1">Games</span>
      </div>
      {data.map((event) => (
        <Row key={`${event.id}-${event.order}-${event.start_time}-${event.activity}`} event={event} onDone={refresh} />
      ))}
      <Row key={`new-${newKey}`} isNew event={{ order: nextOrder }} onDone={() => { setNewKey((k) => k + 1); refresh() }} />
      <div className="p-4"><Alert tone="info">Rows are shown in “#” order on the overview page. Changing the courts, bracket size, first serve or game length rebuilds this list.</Alert></div>
    </div>
  )
}
