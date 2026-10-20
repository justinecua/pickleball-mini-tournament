import { Link } from 'react-router-dom'
import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import { formatRange } from '../utils'

/** One-line status under the header: which tournament, what is live or next, overall progress. */
export default function StatusTicker() {
  const { tapi, link, tournament } = useTournament()
  const { data } = useApi(tapi.summary)
  if (!data) return <div className="h-9 bg-forest-night" />
  const { live, up_next: next, completed_matches: done, total_matches: total } = data
  const current = live[0] ?? next[0]
  const pct = total ? (done / total) * 100 : 0
  return (
    <div className="relative bg-forest-night text-white">
      <div className="mx-auto flex h-9 max-w-6xl items-center gap-4 overflow-hidden px-4 sm:px-6">
        <Link to={link()} className="hidden max-w-[16rem] shrink-0 truncate text-xs font-semibold text-white hover:text-lime sm:block">
          {tournament?.name ?? data.info.name}
        </Link>
        {live.length > 0 ? (
          <span className="label flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-2 py-0.5 text-ink"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" /> {live.length} live</span>
        ) : (
          <span className="label shrink-0 text-lime">{current ? 'Next' : 'Complete'}</span>
        )}
        {current && (
          <span className="truncate text-xs text-white/75">
            {formatRange(current.start_time, current.end_time)} · {current.stage_display}
            {current.team1 && current.team2 && ` · ${current.team1.name} v ${current.team2.name}`}
          </span>
        )}
        <span className="label ml-auto shrink-0 text-white/45">Game {done}/{total}</span>
      </div>
      <span className="absolute bottom-0 left-0 h-0.5 bg-lime transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
