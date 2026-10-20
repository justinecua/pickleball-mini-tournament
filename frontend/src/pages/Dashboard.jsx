import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useApi } from '../hooks'
import { useTournament } from '../tournament'
import MatchCard from '../components/MatchCard'
import ScoreModal from '../components/ScoreModal'
import { ArrowRight } from '../components/Icons'
import { Card, CourtDiagram, Loading, Page, SectionTitle } from '../components/Ui'
import { courtLabel, formatDate, formatRange, formatTime, mapsUrl, playerNames } from '../utils'

const STAGES = [
  { key: 'RR', name: 'Round robin', stages: ['RR'] },
  { key: 'R16', name: 'Round of 16', stages: ['R16'] },
  { key: 'QF', name: 'Quarterfinals', stages: ['QF'] },
  { key: 'SF', name: 'Semifinals', stages: ['SF'] },
  { key: 'F', name: 'Finals', stages: ['F', '3P'] },
]

/** Courts grouped by venue, in court order: [{ venue_name, address, numbers: [1, 2] }]. */
function venues(courts) {
  const groups = []
  for (const c of courts) {
    const found = groups.find((g) => g.venue_name === c.venue_name && g.address === c.address)
    if (found) found.numbers.push(c.number)
    else groups.push({ venue_name: c.venue_name, address: c.address, numbers: [c.number] })
  }
  return groups
}

/** The match to show on each court: live first, else the next unfinished, else the last played. */
function courtMatches(matches, courts) {
  return Array.from({ length: courts }, (_, i) => {
    const onCourt = matches.filter((m) => m.court === i + 1)
    return onCourt.find((m) => m.status === 'live')
      ?? onCourt.find((m) => m.status !== 'completed')
      ?? onCourt[onCourt.length - 1]
  })
}

function Fact({ label, value }) {
  return (
    <div className="rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
      <span className="label mr-2 text-lime">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  )
}

function Hero({ info, registration, user, link }) {
  const pct = registration.capacity ? Math.min(100, (registration.confirmed / registration.capacity) * 100) : 0
  const places = venues(info.courts).filter((v) => v.venue_name)
  return (
    <section className="mx-auto max-w-5xl px-4 pb-10 pt-10 text-center sm:px-6 sm:pt-14">
      {info.host && <p className="label text-lime">Hosted by {info.host.name}</p>}
      <h1 className="display mx-auto mt-3 max-w-4xl text-4xl text-white sm:text-6xl">{info.name}</h1>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Fact label="Date" value={formatDate(info.date)} />
        <Fact label={places.length > 1 ? 'Venues' : 'Venue'} value={places.length > 1 ? `${places.length} venues` : places[0]?.venue_name || 'TBD'} />
        <Fact label="First serve" value={formatTime(info.start_time)} />
        <Fact label="Format" value={`${info.courts.length} court${info.courts.length === 1 ? '' : 's'} · ${info.game_minutes} min games`} />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={link('/schedule')} className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-ink hover:bg-lime-deep">
          Full schedule <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to={link('/standings')} className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:border-lime hover:text-lime">
          Standings
        </Link>
      </div>

      {!registration.drawn && (
        <Link to={link(user ? '/my-team' : '/join')}
          className="group mx-auto mt-8 flex max-w-xl items-center gap-4 rounded-2xl bg-forest-night/80 p-4 text-left ring-1 ring-white/10 hover:ring-lime/60">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label text-lime">{registration.open ? 'Registration open' : 'Registration closed'}</p>
              <p className="text-xs text-white/60">{registration.confirmed} / {registration.capacity} teams</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink group-hover:bg-lime-deep">
            {user ? 'My team' : 'Enter'} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
    </section>
  )
}

function Courts({ info, matches, onSelect }) {
  const courts = courtMatches(matches, info.courts.length)
  const anyLive = courts.some((m) => m?.status === 'live')
  const slot = courts.find(Boolean)
  return (
    <section className="mx-auto max-w-6xl px-2 sm:px-4">
      <div className="court-grid rounded-[1.75rem] bg-forest-night p-4 text-white ring-1 ring-white/10 sm:rounded-[2.5rem] sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label text-lime">{slot ? slot.stage_display : 'All courts clear'}</p>
            <h2 className="display mt-2 text-2xl sm:text-3xl">{anyLive ? 'On court now' : 'Next on court'}</h2>
          </div>
          {slot && <p className="rounded-full bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10">{formatRange(slot.start_time, slot.end_time)}</p>}
        </div>
        <div className={`grid gap-3 lg:gap-4 ${courts.length === 1 ? 'mx-auto max-w-xl' : courts.length === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {courts.map((m, i) => {
            const diagram = <CourtDiagram match={m} court={i + 1} className="aspect-[5/3] w-full" />
            return (
              <figure key={i} className="min-w-0">
                {onSelect && m ? (
                  <button onClick={() => onSelect(m)} className="block w-full rounded-xl text-left ring-offset-2 ring-offset-forest-night hover:ring-2 hover:ring-lime">{diagram}</button>
                ) : diagram}
                <figcaption className="mt-2 flex items-center justify-between gap-2 px-1 text-xs text-white/55">
                  <span className="truncate">
                    {m ? (m.bracket ? `Bracket ${m.bracket} · Match ${m.match_no}` : m.label) : 'No match'}
                    {info.courts[i]?.venue_name && <span className="text-white/35"> · {info.courts[i].venue_name}</span>}
                  </span>
                  {m?.status === 'completed' && <span className="label text-lime">Final</span>}
                </figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StageTracker({ matches }) {
  const stages = STAGES.filter((stage) => matches.some((m) => stage.stages.includes(m.stage)))
  const edge = `${50 / stages.length}%`
  return (
    <ol className="relative grid grid-cols-2 gap-y-8 py-8 md:[grid-template-columns:var(--stages)]"
      style={{ '--stages': `repeat(${stages.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className="absolute top-[3.25rem] hidden h-0.5 bg-ink/20 md:block" style={{ left: edge, right: edge }} />
      {stages.map((stage, i) => {
        const list = matches.filter((m) => stage.stages.includes(m.stage))
        const done = list.filter((m) => m.status === 'completed').length
        const live = list.some((m) => m.status === 'live')
        const state = done === list.length ? 'done' : live || done > 0 ? 'play' : 'next'
        const first = list[0]
        const last = list[list.length - 1]
        return (
          <li key={stage.key} className="relative flex min-w-0 flex-col items-center px-2 text-center">
            <span className={`relative flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-extrabold ${
              state === 'done' ? 'bg-ink text-lime' : state === 'play' ? 'bg-white text-ink ring-4 ring-ink' : 'bg-lime text-ink ring-2 ring-ink/30'}`}>
              {state === 'done' ? '✓' : i + 1}
            </span>
            <p className="display mt-3 text-sm sm:text-base">{stage.name}</p>
            <p className="label mt-1 text-ink/55">{first && formatRange(first.start_time, last.end_time)}</p>
            <p className="mt-1 text-xs font-medium text-ink/70">{done}/{list.length} games{state === 'play' ? ' · in play' : ''}</p>
          </li>
        )
      })}
    </ol>
  )
}

function RunOfShow({ events, activeStart }) {
  const total = events.reduce((n, e) => n + (e.games ?? 0), 0)
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:[grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))]">
      {events.map((e) => {
        const active = activeStart && e.start_time <= activeStart && activeStart < e.end_time
        return (
          <li key={e.id} className={`flex min-w-0 flex-col rounded-2xl p-4 ${active ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>
            <p className={`text-xs font-semibold ${active ? 'text-ink/70' : 'text-lime'}`}>{formatRange(e.start_time, e.end_time)}</p>
            <p className="mt-2 font-semibold leading-snug">{e.activity}</p>
            {e.details && <p className={`mt-1 text-xs ${active ? 'text-ink/60' : 'text-white/45'}`}>{e.details}</p>}
            <p className={`label mt-auto pt-4 ${active ? 'text-ink' : 'text-white/50'}`}>
              {active ? 'Now · ' : ''}{e.games ? `${e.games} games` : '—'}
            </p>
          </li>
        )
      })}
      <li className="sr-only">Total: {total} games</li>
    </ol>
  )
}

function Results({ placements }) {
  const places = [['1st', 'Champion', placements.champion], ['2nd', 'Runner-up', placements.runner_up], ['3rd', 'Third place', placements.third_place]]
    .filter(([, , team]) => team)
  if (!places.length) return null
  return (
    <section className="mb-12">
      <SectionTitle index="★" kicker="Final results" title="The podium" />
      <div className="grid gap-4 sm:grid-cols-3">
        {places.map(([place, title, team], i) => (
          <div key={place} className={`rounded-xl border p-5 ${i === 0 ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>
            <p className={`display text-5xl ${i === 0 ? 'text-lime' : ''}`}>{place}</p>
            <p className={`label mt-2 ${i === 0 ? 'text-white/70' : 'text-ink/50'}`}>{title}</p>
            <p className="mt-1 text-xl font-bold">{team.name}</p>
            <p className={`text-sm ${i === 0 ? 'text-white/70' : 'text-ink/55'}`}>{playerNames(team) || team.code}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Bulletin({ announcements, className = '' }) {
  return (
    <section className={className}>
      <SectionTitle index="03" kicker="Bulletin" title="Notices" />
      <ol className="grid gap-3 md:grid-cols-2">
        {announcements.map((a, i) => (
          <li key={a.id} className={`flex gap-4 rounded-xl border p-5 ${a.pinned ? 'border-ink bg-card shadow-[5px_5px_0_0_#bfd63f]' : 'border-line bg-card'}`}>
            <span className="display text-3xl text-ink/15">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <p className="label text-ink/50">
                {a.pinned && <span className="mr-2 rounded-full bg-lime px-2 py-0.5 text-ink">Pinned</span>}
                {new Date(a.created_at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-lg font-bold leading-snug">{a.title}</p>
              {a.body && <p className="mt-1 whitespace-pre-line text-sm text-ink/65">{a.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function GuestCta() {
  const perks = ['Your team highlighted on every page', 'Your next games up front', 'Notices from organizers']
  return (
    <section className="grid items-center gap-6 rounded-2xl bg-lime p-6 text-ink sm:p-8 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <p className="label text-ink/60">Playing tonight?</p>
        <p className="display mt-2 text-2xl">Track your team</p>
      </div>
      <ul className="space-y-1.5 text-sm lg:col-span-5">
        {perks.map((p) => <li key={p} className="flex gap-2"><span>→</span>{p}</li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3 lg:justify-end">
        <Link to="/register" className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-ink-soft">Create a free account</Link>
        <Link to="/login" className="text-sm font-semibold text-ink/70 hover:text-ink">Log in</Link>
      </div>
    </section>
  )
}

/** Where to go: one card per venue, with its courts and a map link. */
function Venues({ courts }) {
  const groups = venues(courts).filter((v) => v.venue_name || v.address)
  if (!groups.length) return null
  return (
    <section className="mb-12">
      <SectionTitle index="◎" kicker={`${courts.length} court${courts.length === 1 ? '' : 's'}`} title={groups.length > 1 ? 'Venues' : 'Venue'} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((v) => (
          <div key={`${v.venue_name}|${v.address}`} className="flex flex-col rounded-xl border border-line bg-card p-5">
            <p className="label text-ink/50">{v.numbers.length > 1 ? `Courts ${v.numbers.join(', ')}` : courtLabel(null, v.numbers[0])}</p>
            <p className="mt-1 text-lg font-bold leading-snug">{v.venue_name || 'Venue'}</p>
            {v.address && <p className="mt-1 text-sm text-ink/60">{v.address}</p>}
            <a href={mapsUrl(v)} target="_blank" rel="noreferrer"
              className="label mt-auto inline-flex items-center gap-1 pt-4 text-olive hover:underline">
              Directions <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { tapi, link, tournament, isHost } = useTournament()
  const summary = useApi(tapi.summary)
  const timeline = useApi(tapi.timeline)
  const matches = useApi(tapi.matches)
  const [selected, setSelected] = useState(null)

  if (!summary.data || !timeline.data || !matches.data) return <Loading error={summary.error || timeline.error || matches.error} />
  const { info, live, up_next: upNext, placements, announcements, registration } = summary.data
  const myTeam = tournament.my_team
  const myNext = myTeam
    ? matches.data.filter((m) => m.status !== 'completed' && (m.team1?.id === myTeam.id || m.team2?.id === myTeam.id)).slice(0, 2)
    : []
  const select = isHost ? setSelected : undefined

  return (
    <>
      <Hero info={info} registration={registration} user={user} link={link} />
      <Courts info={info} matches={matches.data} onSelect={select} />
      <div className="mt-8 bg-lime text-ink"><div className="mx-auto max-w-6xl px-4 sm:px-6"><StageTracker matches={matches.data} /></div></div>

      <Page>
        <Results placements={placements} />

        {myNext.length > 0 && (
          <section className="mb-12">
            <SectionTitle index="★" kicker="Your team" title={myTeam.name} subtitle={playerNames(myTeam)} />
            <div className="grid gap-3 sm:grid-cols-2">
              {myNext.map((m) => <MatchCard key={m.id} match={m} myTeamId={myTeam.id} onSelect={select} />)}
            </div>
          </section>
        )}

        <section className="mb-12">
          <SectionTitle index="01" kicker={upNext.length ? formatRange(upNext[0].start_time, upNext[0].end_time) : 'Complete'}
            title={live.length ? 'Live & next' : 'Up next'}
            action={<Link to={link('/schedule')} className="label inline-flex items-center gap-1 hover:text-olive">Schedule <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          {live.length + upNext.filter((m) => m.status !== 'live').length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {live.map((m) => <MatchCard key={m.id} match={m} onSelect={select} myTeamId={myTeam?.id} />)}
              {upNext.filter((m) => m.status !== 'live').map((m) => <MatchCard key={m.id} match={m} onSelect={select} showTime={false} myTeamId={myTeam?.id} />)}
            </div>
          ) : (
            <Card className="p-8 text-center"><p className="display text-2xl">That&apos;s a wrap</p></Card>
          )}
        </section>

        <Venues courts={info.courts} />

        <section className={announcements.length || !user ? 'mb-12' : ''}>
          <SectionTitle index="02" kicker={`Tonight · ${timeline.data.reduce((n, e) => n + (e.games ?? 0), 0)} games`} title="Run of show" />
          <RunOfShow events={timeline.data} activeStart={upNext[0]?.start_time} />
        </section>

        {announcements.length > 0 && <Bulletin announcements={announcements} className={user ? '' : 'mb-12'} />}
        {!user && <GuestCta />}
      </Page>

      {selected && <ScoreModal match={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
