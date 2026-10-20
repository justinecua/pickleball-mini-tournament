import { useCallback, useMemo, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { RefreshContext } from './hooks'
import { TournamentProvider, useTournament } from './tournament'
import StatusTicker from './components/StatusTicker'
import { Alert, Loading, Page } from './components/Ui'
import Logo from './components/Logo'
import BallMotif from './components/BallMotif'
import Home from './pages/Home'
import HostTournament from './pages/HostTournament'
import InviteRedirect from './pages/InviteRedirect'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Standings from './pages/Standings'
import Knockout from './pages/Knockout'
import Teams from './pages/Teams'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import Manage from './pages/Manage'
import UsersAdmin from './pages/admin/UsersAdmin'
import Join from './pages/Join'
import MyTeam from './pages/MyTeam'
import CheckIn from './pages/CheckIn'

const TOURNAMENT_NAV = [
  { to: '', label: 'Overview', end: true },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/playoffs', label: 'Playoffs' },
  { to: '/teams', label: 'Teams' },
  { to: '/join', label: 'Register' },
]

const SITE_NAV = [
  { to: '/', label: 'Tournaments', end: true },
  { to: '/host', label: 'Host a tournament' },
]

const navClass = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-lime' : 'text-white/65 hover:text-white'}`

function UserMenu() {
  const { user, isAdmin, signOut } = useAuth()
  const t = useTournament()
  const navigate = useNavigate()
  if (!user) {
    return (
      <div className="flex items-center gap-2 lg:order-2">
        <Link to="/login" className="rounded-full px-3 py-2 text-sm font-medium text-white/75 hover:text-white">Log in</Link>
        <Link to="/register" className="rounded-full bg-lime px-5 py-2 text-sm font-semibold text-ink hover:bg-lime-deep">Sign up</Link>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 lg:order-2">
      {t && <NavLink to={t.link('/my-team')} className={navClass}>My team</NavLink>}
      {t?.isHost && <Link to={t.link('/manage')} className="rounded-full border border-lime/60 px-4 py-2 text-sm font-semibold text-lime hover:bg-lime hover:text-ink">Manage</Link>}
      {!t && isAdmin && <NavLink to="/admin/users" className={navClass}>Users</NavLink>}
      <NavLink to="/account" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-white hover:bg-white/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime font-display text-sm font-extrabold uppercase text-ink">
          {(user.first_name || user.username)[0]}
        </span>
        <span className="hidden sm:inline">{user.first_name || user.username}</span>
      </NavLink>
      <button onClick={async () => { await signOut(); navigate('/') }} className="label px-1 text-white/45 hover:text-white">Log out</button>
    </div>
  )
}

function Header() {
  const t = useTournament()
  const nav = t ? TOURNAMENT_NAV.map((item) => ({ ...item, to: t.link(item.to) })) : SITE_NAV
  return (
    <header className="sticky top-0 z-40 bg-forest/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Logo />
        <UserMenu />
        <nav className="-mx-2 flex w-full gap-1 overflow-x-auto lg:order-1 lg:mx-auto lg:w-auto">
          {nav.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>)}
        </nav>
      </div>
      {t && <StatusTicker />}
    </header>
  )
}

function Footer() {
  const { user } = useAuth()
  const groups = [
    { title: 'Explore', links: [{ to: '/', label: 'Tournaments' }, { to: '/host', label: 'Host a tournament' }] },
    {
      title: 'Account',
      links: user
        ? [{ to: '/account', label: 'My account' }]
        : [{ to: '/login', label: 'Log in' }, { to: '/register', label: 'Sign up' }],
    },
  ]
  return (
    <footer className="mt-12 bg-lime text-ink">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="display text-3xl sm:text-4xl">Every rally<br /><span className="text-ink/55">earns XP.</span></p>
          <p className="mt-3 max-w-md text-sm text-ink/70">Round robins and playoffs on as many courts as you have, at one venue or several.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-14 gap-y-8">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="label text-ink/55">{group.title}</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm font-semibold">
                {group.links.map((item) => <li key={item.to}><Link to={item.to} className="hover:underline">{item.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-ink">
        <div className="label mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-3 text-white/45 sm:px-6">
          <p>© {new Date().getFullYear()} PickleXP</p>
          <p>Developed by Justine Cua</p>
        </div>
      </div>
    </footer>
  )
}

function RequireAuth({ admin = false, children }) {
  const { user, ready, isAdmin } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return children
}

function RequireHost({ children }) {
  const { isHost, link } = useTournament()
  return isHost ? children : <Navigate to={link()} replace />
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <Loading />
  return user ? <Navigate to="/" replace /> : children
}

/** Pages under /t/:slug, once the tournament has loaded. */
function TournamentRoutes() {
  const { tournament, error, link } = useTournament()
  if (error?.status === 404) {
    return (
      <Page kicker="Tournaments" title="Not found">
        <Alert>There&apos;s no tournament at this address. It may have been renamed or removed.</Alert>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-olive hover:underline">Browse tournaments</Link>
      </Page>
    )
  }
  if (!tournament) return <Loading error={error} />
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="schedule" element={<Schedule />} />
      <Route path="standings" element={<Standings />} />
      <Route path="playoffs" element={<Knockout />} />
      <Route path="teams" element={<Teams />} />
      <Route path="join" element={<Join />} />
      <Route path="join/:code" element={<Join />} />
      <Route path="my-team" element={<RequireAuth><MyTeam /></RequireAuth>} />
      <Route path="manage/*" element={<RequireAuth><RequireHost><Manage /></RequireHost></RequireAuth>} />
      <Route path="*" element={<Navigate to={link()} replace />} />
    </Routes>
  )
}

function Shell() {
  const match = useMatch('/t/:slug/*')
  const slug = match?.params.slug
  const shell = (
    /* Full-height column so the footer sits at the bottom of the window on short pages. */
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* Becomes a column only around a `data-fill` page, so that page can grow and centre itself. */}
      <main className="relative flex-1 has-[>[data-fill]]:flex has-[>[data-fill]]:flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<RequireAuth><HostTournament /></RequireAuth>} />
          <Route path="/t/:slug/*" element={<TournamentRoutes />} />
          <Route path="/join/:code" element={<InviteRedirect />} />
          <Route path="/checkin/:token" element={<RequireAuth><CheckIn /></RequireAuth>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth admin><UsersAdmin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
  return slug ? <TournamentProvider key={slug} slug={slug}>{shell}</TournamentProvider> : shell
}

export default function App() {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const ctx = useMemo(() => ({ version, refresh }), [version, refresh])

  return (
    <AuthProvider>
      <RefreshContext.Provider value={ctx}>
        <BrowserRouter>
          <BallMotif />
          <Shell />
        </BrowserRouter>
      </RefreshContext.Provider>
    </AuthProvider>
  )
}
