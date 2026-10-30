import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, tournamentApi } from '../../api'
import { useApi, useRefresh } from '../../hooks'
import { Alert, Loading, Page } from '../../components/Ui'
import { formatDate } from '../../utils'

const STATUS = {
  drawn: ['Drawn', 'bg-ink text-white'],
  open: ['Open', 'bg-lime text-ink'],
  closed: ['Closed', 'bg-paper-deep text-ink/70'],
}

/** Site admin: every tournament on PickleXP, whoever hosts it, with Manage and Delete. */
export default function TournamentsAdmin() {
  const tournaments = useApi(api.tournaments)
  const { refresh } = useRefresh()
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  if (!tournaments.data) return <Loading error={tournaments.error} />

  async function remove(t) {
    if (window.prompt(`This deletes the tournament, its teams, games and notices for good. Type the name to confirm:\n\n${t.name}`) !== t.name) return
    setError(null)
    try {
      await tournamentApi(t.slug).remove()
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const q = query.toLowerCase()
  const visible = tournaments.data.filter((t) => [t.name, t.host?.name, t.slug].some((v) => v?.toLowerCase().includes(q)))

  return (
    <Page kicker="Site admin" title="Tournaments" intro="Every tournament on PickleXP. As a site admin you can manage any of them.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input className="w-full max-w-xs rounded-md border-0 bg-card px-4 py-2 text-sm border border-line focus:border-olive focus:ring-2 focus:ring-lime/50 focus:outline-none"
          placeholder="Search tournaments…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <p className="text-sm font-bold text-ink/60">{tournaments.data.length} {tournaments.data.length === 1 ? 'tournament' : 'tournaments'}</p>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="overflow-x-auto rounded-xl bg-card shadow-sm border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ink text-left text-[11px] uppercase tracking-wider text-white/70">
            <tr>
              <th className="px-5 py-3 font-semibold">Tournament</th>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Teams</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-ink/45">No tournaments found.</td></tr>}
            {visible.map((t) => {
              const reg = t.registration
              const [label, style] = STATUS[reg.drawn ? 'drawn' : reg.open ? 'open' : 'closed']
              return (
                <tr key={t.slug} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link to={`/t/${t.slug}`} className="font-semibold hover:underline">{t.name}</Link>
                    <p className="text-xs text-ink/55">{t.host ? `Hosted by ${t.host.name}` : 'No host'} · {t.courts} court{t.courts === 1 ? '' : 's'}</p>
                  </td>
                  <td className="px-3 text-ink/60">{t.date ? formatDate(t.date) : 'TBA'}</td>
                  <td className="px-3">
                    <span className="font-semibold">{reg.confirmed}</span><span className="text-ink/45"> / {reg.capacity}</span>
                    {(reg.waitlist > 0 || reg.forming > 0) && (
                      <p className="text-xs text-ink/50">{[reg.waitlist && `${reg.waitlist} waitlist`, reg.forming && `${reg.forming} forming`].filter(Boolean).join(' · ')}</p>
                    )}
                  </td>
                  <td className="px-3"><span className={`label rounded-full px-2 py-0.5 ${style}`}>{label}</span></td>
                  <td className="whitespace-nowrap px-5 text-right">
                    <Link to={`/t/${t.slug}/manage`} className="mr-4 text-xs font-bold text-olive hover:underline">Manage</Link>
                    <button onClick={() => remove(t)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Page>
  )
}
