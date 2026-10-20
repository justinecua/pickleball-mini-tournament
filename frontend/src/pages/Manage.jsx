import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useTournament } from '../tournament'
import { Award, Calendar, Check, Clock, Megaphone, Users } from '../components/Icons'
import { Page } from '../components/Ui'
import InfoAdmin from './admin/InfoAdmin'
import TeamsAdmin from './admin/TeamsAdmin'
import TimelineAdmin from './admin/TimelineAdmin'
import AnnouncementsAdmin from './admin/AnnouncementsAdmin'
import ScoresAdmin from './admin/ScoresAdmin'
import RegistrationsAdmin from './admin/RegistrationsAdmin'

const TABS = [
  ['registrations', 'Registrations', Check],
  ['settings', 'Event & courts', Calendar],
  ['teams', 'Teams', Users],
  ['scores', 'Scores', Award],
  ['announcements', 'Notices', Megaphone],
  ['timeline', 'Run of show', Clock],
]

export default function Manage() {
  const { tournament, link } = useTournament()
  return (
    <Page kicker="Host desk" title={tournament.name} intro="Everything players see comes from here: courts and venues, teams, the draw, scores, notices and the run of show.">
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-36 lg:flex-col lg:self-start">
          {TABS.map(([path, label, Icon]) => (
            <NavLink key={path} to={link(`/manage/${path}`)}
              className={({ isActive }) => `flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'bg-ink text-paper' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Routes>
            <Route index element={<Navigate to="registrations" replace />} />
            <Route path="registrations" element={<RegistrationsAdmin />} />
            <Route path="settings" element={<InfoAdmin />} />
            <Route path="teams" element={<TeamsAdmin />} />
            <Route path="scores" element={<ScoresAdmin />} />
            <Route path="announcements" element={<AnnouncementsAdmin />} />
            <Route path="timeline" element={<TimelineAdmin />} />
          </Routes>
        </div>
      </div>
    </Page>
  )
}
