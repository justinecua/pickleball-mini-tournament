import { useState } from 'react'
import { useRefresh } from '../hooks'
import { useTournament } from '../tournament'
import Modal from './Modal'
import { Alert, BracketTag, Button } from './Ui'
import { courtLabel, describeSource, formatRange, playerNames } from '../utils'

function ScoreInput({ team, source, value, onChange }) {
  const step = (d) => onChange(Math.max(0, (Number(value) || 0) + d))
  const stepper = 'h-9 w-9 rounded-md border border-line bg-card text-lg font-bold hover:border-ink'
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-paper p-3">
      <div className="min-w-0">
        {team ? (
          <>
            <div className="flex items-center gap-2">
              <BracketTag bracket={team.bracket}>{team.code}</BracketTag>
              <span className="truncate font-bold">{team.name}</span>
            </div>
            {playerNames(team) && <p className="mt-1 truncate text-xs text-ink/55">{playerNames(team)}</p>}
          </>
        ) : (
          <span className="text-ink/40">{describeSource(source)}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => step(-1)} className={stepper} aria-label="Minus one">−</button>
        <input
          type="number" min="0" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-12 w-16 rounded-md border border-line bg-card text-center font-display text-2xl font-black focus:border-olive focus:ring-2 focus:ring-lime/50 focus:outline-none"
        />
        <button type="button" onClick={() => step(1)} className={stepper} aria-label="Plus one">+</button>
      </div>
    </div>
  )
}

export default function ScoreModal({ match, onClose }) {
  const { refresh } = useRefresh()
  const { tapi, tournament } = useTournament()
  const [score1, setScore1] = useState(match.score1 ?? '')
  const [score2, setScore2] = useState(match.score2 ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const playable = match.team1 && match.team2

  async function submit(action) {
    setSaving(true)
    setError(null)
    try {
      if (action === 'reset') {
        await tapi.resetMatch(match.id)
      } else {
        await tapi.updateMatch(match.id, {
          score1: score1 === '' ? null : Number(score1),
          score2: score2 === '' ? null : Number(score2),
          status: action,
        })
      }
      refresh()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={match.label}
      eyebrow={`${match.stage_display} · ${courtLabel(tournament.courts, match.court)} · ${formatRange(match.start_time, match.end_time)}`}
      onClose={onClose}
    >
      <div className="space-y-2">
        <ScoreInput team={match.team1} source={match.team1_source} value={score1} onChange={setScore1} />
        <ScoreInput team={match.team2} source={match.team2_source} value={score2} onChange={setScore2} />
      </div>
      <div className="mt-3 space-y-2">
        {!playable && <Alert tone="info">Teams for this match are decided once the earlier games are finished.</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="flex-1" disabled={saving || !playable} onClick={() => submit('completed')}>Save final score</Button>
        <Button variant="danger" disabled={saving || !playable} onClick={() => submit('live')}>Mark live</Button>
        {match.status !== 'scheduled' && (
          <Button variant="ghost" disabled={saving} onClick={() => submit('reset')}>Clear</Button>
        )}
      </div>
    </Modal>
  )
}
