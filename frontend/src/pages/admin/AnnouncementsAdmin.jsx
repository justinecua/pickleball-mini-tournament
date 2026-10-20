import { useState } from 'react'
import { useApi, useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import { Alert, Button, Card, Field, inputClass, Loading } from '../../components/Ui'

const EMPTY = { title: '', body: '', pinned: false }

export default function AnnouncementsAdmin() {
  const { tapi } = useTournament()
  const { data, error } = useApi(tapi.announcements)
  const { refresh } = useRefresh()
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [formError, setFormError] = useState(null)
  if (!data) return <Loading error={error} />

  async function submit(e) {
    e.preventDefault()
    setFormError(null)
    try {
      if (editing) await tapi.updateAnnouncement(editing, form)
      else await tapi.createAnnouncement(form)
      setForm(EMPTY)
      setEditing(null)
      refresh()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return
    await tapi.deleteAnnouncement(a.id)
    refresh()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <Card className="p-6 lg:col-span-2">
        <h3 className="display mb-5 text-xl">{editing ? 'Edit announcement' : 'New announcement'}</h3>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {formError && <Alert>{formError}</Alert>}
          <Field label="Title">
            <input className={inputClass} required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea rows={4} className={inputClass} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-4 w-4 accent-olive" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            Pin to the top of the overview
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="lime">{editing ? 'Save changes' : 'Post announcement'}</Button>
            {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel</Button>}
          </div>
        </form>
      </Card>
      <div className="space-y-3 lg:col-span-3">
        {data.length === 0 && <p className="display py-10 text-center text-2xl text-ink/25">No announcements yet</p>}
        {data.map((a) => (
          <div key={a.id} className={`rounded-xl p-5 ${a.pinned ? 'bg-ink text-white' : 'bg-card border border-line'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                  {a.pinned && '📌 Pinned · '}{new Date(a.created_at).toLocaleString()}
                </p>
                <p className="text-lg font-black">{a.title}</p>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm opacity-90">{a.body}</p>}
              </div>
              <div className="flex shrink-0 gap-1 text-xs font-bold">
                <button className="rounded-md px-3 py-1 ring-1 ring-current hover:opacity-70"
                  onClick={() => { setEditing(a.id); setForm({ title: a.title, body: a.body, pinned: a.pinned }) }}>Edit</button>
                <button className="rounded-md px-3 py-1 ring-1 ring-current hover:opacity-70" onClick={() => remove(a)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
