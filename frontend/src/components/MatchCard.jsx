import { BracketTag, StatusBadge } from './Ui'
import { bracketOf, describeSource, formatRange } from '../utils'

function TeamRow({ team, source, score, isWinner, decided, highlight }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${decided && !isWinner ? 'text-ink/35' : ''}`}>
      <div className="flex min-w-0 items-center gap-2">
        {team ? (
          <>
            <BracketTag bracket={team.bracket}>{team.code}</BracketTag>
            <span className={`truncate ${isWinner ? 'font-bold' : 'font-medium'}`}>{team.name}</span>
            {highlight && <span className="label shrink-0 rounded-full bg-lime px-1.5 text-ink">You</span>}
          </>
        ) : (
          <span className="truncate pr-1 text-sm text-ink/40">{describeSource(source)}</span>
        )}
      </div>
      <span className={`w-9 shrink-0 text-right font-display text-2xl font-black leading-none tabular-nums ${isWinner ? 'text-olive' : ''}`}>
        {score ?? ''}
      </span>
    </div>
  )
}

const SHORT_LABEL = { F: 'Final', '3P': '3rd place' }

/** A match "ticket": stub header with court and time, perforation, then the two teams. */
export default function MatchCard({ match, onSelect, showTime = true, myTeamId }) {
  const decided = match.status === 'completed'
  const mine = myTeamId && (match.team1?.id === myTeamId || match.team2?.id === myTeamId)
  const color = bracketOf(match)
  const Tag = onSelect ? 'button' : 'div'
  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      onClick={onSelect ? () => onSelect(match) : undefined}
      className={`group relative block w-full overflow-hidden rounded-xl border bg-card text-left text-ink transition
        ${match.status === 'live' ? 'border-lime shadow-[0_0_0_3px_rgb(191_214_63/0.55)]' : mine ? 'border-ink shadow-[0_0_0_3px_rgb(191_214_63/0.55)]' : 'border-line'}
        ${onSelect ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${color.bg}`} />
      <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-3">
        <span className="label text-ink/60">
          <span className="text-ink">{match.stage === 'RR' ? `M${match.match_no}` : SHORT_LABEL[match.stage] ?? match.label}</span> · Ct {match.court}
          {showTime && <> · {formatRange(match.start_time, match.end_time)}</>}
        </span>
        <StatusBadge status={match.status} />
      </div>
      <div className="perforation mx-0" />
      <div className="pb-2 pl-4 pr-3 pt-1.5">
        <TeamRow team={match.team1} source={match.team1_source} score={match.score1} decided={decided}
          isWinner={decided && match.winner_id === match.team1?.id} highlight={myTeamId && match.team1?.id === myTeamId} />
        <TeamRow team={match.team2} source={match.team2_source} score={match.score2} decided={decided}
          isWinner={decided && match.winner_id === match.team2?.id} highlight={myTeamId && match.team2?.id === myTeamId} />
      </div>
    </Tag>
  )
}
