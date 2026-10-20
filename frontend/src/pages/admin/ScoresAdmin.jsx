import { useState } from 'react'
import { useApi, useRefresh } from '../../hooks'
import { useTournament } from '../../tournament'
import MatchCard from '../../components/MatchCard'
import ScoreModal from '../../components/ScoreModal'
import { Button, Loading } from '../../components/Ui'
import { formatRange } from '../../utils'

const FILTERS = [['all', 'All'], ['open', 'Not final'], ['live', 'Live'], ['completed', 'Final']]

export default function ScoresAdmin() {
  const { tapi } = useTournament()
  const { data, error } = useApi(tapi.matches)
  const { refresh } = useRefresh()
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState(null)
  if (!data) return <Loading error={error} />

  const visible = data.filter((m) =>
    filter === 'all' ? true : filter === 'open' ? m.status !== 'completed' : m.status === filter)
  const slots = [...new Set(visible.map((m) => m.start_time))]

  async function resetAll() {
    if (!window.confirm('Clear every score and playoff pairing? Teams, users and event details are kept.')) return
    await tapi.resetResults()
    refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md bg-card p-1 border border-line">
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`rounded-md px-4 py-1.5 text-sm font-bold ${filter === key ? 'bg-ink text-paper' : 'text-ink/55 hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="danger" onClick={resetAll}>Reset all results</Button>
      </div>
      {slots.length === 0 && <p className="display py-10 text-center text-2xl text-ink/25">Nothing here</p>}
      {slots.map((slot) => {
        const matches = visible.filter((m) => m.start_time === slot)
        return (
          <section key={slot} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/60">
              {formatRange(slot, matches[0].end_time)} · {matches[0].stage_display}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {matches.map((m) => <MatchCard key={m.id} match={m} onSelect={setSelected} showTime={false} />)}
            </div>
          </section>
        )
      })}
      {selected && <ScoreModal match={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
