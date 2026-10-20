import { BRACKETS, KNOCKOUT_COLOR } from '../utils'

/**
 * Page shell: an optional title block on the forest background, then the content on a
 * white rounded sheet.
 */
export function Page({ kicker, title, intro, className = '', children }) {
  return (
    <>
      {title && (
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
          {kicker && <p className="label text-lime">{kicker}</p>}
          <h1 className="display mt-2 text-4xl text-white sm:text-6xl">{title}</h1>
          {intro && <p className="mt-4 max-w-2xl text-white/65">{intro}</p>}
        </div>
      )}
      <div className={`mx-auto max-w-6xl px-2 sm:px-4 ${title ? '' : 'pt-6'}`}>
        <div className={`rounded-[1.75rem] bg-paper px-4 py-8 text-ink shadow-2xl shadow-black/20 sm:rounded-[2.5rem] sm:px-8 sm:py-12 ${className}`}>
          {children}
        </div>
      </div>
    </>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-2xl border border-line bg-card text-ink ${className}`}>{children}</div>
}

/** Heading inside a sheet: small lime-marked kicker over a wide bold title. */
export function SectionTitle({ index, kicker, title, subtitle, action, dark = false }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {(index || kicker) && (
          <p className={`label mb-2 flex items-center gap-2 ${dark ? 'text-white/60' : 'text-ink/55'}`}>
            {index && <span className={dark ? 'text-lime' : 'text-olive'}>{index}</span>}
            {kicker}
          </p>
        )}
        <h2 className={`display text-2xl sm:text-4xl ${dark ? 'text-white' : 'text-ink'}`}>{title}</h2>
        {subtitle && <p className={`mt-2 max-w-2xl text-sm ${dark ? 'text-white/60' : 'text-ink/60'}`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function BracketTag({ bracket, children }) {
  const c = BRACKETS[bracket] ?? KNOCKOUT_COLOR
  return (
    <span className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${c.bg} ${c.fg}`}>
      {children ?? bracket}
    </span>
  )
}

export function StatusBadge({ status }) {
  if (status === 'live') {
    return (
      <span className="label inline-flex items-center gap-1.5 rounded-full bg-lime px-2 py-0.5 text-ink">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" /> Live
      </span>
    )
  }
  if (status === 'completed') return <span className="label rounded-full bg-ink px-2 py-0.5 text-lime">Final</span>
  return <span className="label rounded-full bg-paper-deep px-2 py-0.5 text-ink/50">Sched.</span>
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-lime text-ink hover:bg-lime-deep',
    ink: 'bg-ink text-white hover:bg-ink-soft',
    ghost: 'text-ink hover:bg-ink/5',
    outline: 'border border-ink/30 text-ink hover:border-ink',
    danger: 'border border-signal/50 text-signal hover:bg-signal hover:text-white',
  }
  // Older call sites used these names.
  const alias = { lime: 'primary', dark: 'ink' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[alias[variant] ?? variant]} ${className}`}
      {...props}
    />
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-olive focus:ring-2 focus:ring-lime/50 focus:outline-none'

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block text-ink/55">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink/45">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-signal">{[error].flat().join(' ')}</span>}
    </label>
  )
}

export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'border-signal bg-signal/10 text-signal',
    info: 'border-lime bg-lime/20 text-ink',
    success: 'border-grass bg-grass/10 text-grass',
  }
  return <div className={`rounded-xl border-l-4 px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>
}

export function Loading({ error }) {
  if (error) {
    return (
      <Page>
        <Alert>
          <p className="font-semibold">Could not reach the tournament server.</p>
          <p className="mt-1 opacity-80">{error.message}. Make sure Django is running on port 8000.</p>
        </Alert>
      </Page>
    )
  }
  // Full window height so the footer stays below the fold until the page's content arrives
  // (otherwise it flashes up the screen and jumps down on every refresh).
  return (
    <div className="flex min-h-screen justify-center pt-32" role="status" aria-label="Loading">
      <span className="h-10 w-10 animate-bounce rounded-full bg-lime" />
    </div>
  )
}

/**
 * Top-down pickleball court (20 × 44 ft) with each team named on its half.
 * The kitchen (non-volley zone) is 7 ft each side of the net.
 */
export function CourtDiagram({ match, court, className = '' }) {
  const c = match?.bracket ? BRACKETS[match.bracket] : KNOCKOUT_COLOR
  const color = c.hex
  const ln = c.lines
  const team = (t, src) => t?.name ?? (src ? '—' : 'Open')
  const live = match?.status === 'live'
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ backgroundColor: color }}>
      <svg viewBox="0 0 200 120" className="block h-full w-full" aria-hidden="true">
        <rect x="8" y="8" width="184" height="104" fill="none" stroke={ln} strokeOpacity=".9" strokeWidth="1.6" />
        <line x1="100" y1="4" x2="100" y2="116" stroke={ln} strokeWidth="2.4" />
        <line x1="70.7" y1="8" x2="70.7" y2="112" stroke={ln} strokeOpacity=".9" strokeWidth="1.2" />
        <line x1="129.3" y1="8" x2="129.3" y2="112" stroke={ln} strokeOpacity=".9" strokeWidth="1.2" />
        <line x1="8" y1="60" x2="70.7" y2="60" stroke={ln} strokeOpacity=".9" strokeWidth="1.2" />
        <line x1="129.3" y1="60" x2="192" y2="60" stroke={ln} strokeOpacity=".9" strokeWidth="1.2" />
        <rect x="70.7" y="8" width="58.6" height="104" fill="#000" fillOpacity=".12" />
      </svg>
      <div className="absolute inset-0 grid grid-cols-2 text-white">
        {[[match?.team1, match?.team1_source, match?.score1], [match?.team2, match?.team2_source, match?.score2]].map(([t, src, score], i) => (
          <div key={i} className={`flex min-w-0 flex-col justify-center px-1.5 sm:px-3 ${i ? 'items-end text-right' : 'items-start'}`}>
            {score != null && <span className="mb-1 font-display text-4xl font-black leading-none drop-shadow">{score}</span>}
            <span className="max-w-full truncate rounded-md bg-black/55 px-1 py-0.5 text-[10px] font-semibold sm:px-1.5 sm:text-xs">{team(t, src)}</span>
          </div>
        ))}
      </div>
      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span className="label rounded-full bg-black/45 px-2 py-0.5 text-white">Court {court}</span>
        {live && <span className="label rounded-full bg-white px-2 py-0.5 text-ink">Live</span>}
      </div>
    </div>
  )
}
