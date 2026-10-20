import { Link } from 'react-router-dom'

/** Lime disc holding a dark ball, with a wide wordmark. `onLime` flips colours for the lime footer. */
export default function Logo({ onLime = false }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <svg viewBox="0 0 32 32" className="h-10 w-10 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill={onLime ? '#29332e' : '#bfd63f'} />
        <circle cx="16" cy="16" r="9.5" fill={onLime ? '#bfd63f' : '#29332e'} />
        <g fill={onLime ? '#29332e' : '#bfd63f'}>
          <circle cx="12.6" cy="12.4" r="1.6" /><circle cx="19.2" cy="12" r="1.6" /><circle cx="16" cy="16.6" r="1.6" />
          <circle cx="12" cy="19.8" r="1.6" /><circle cx="20" cy="20.2" r="1.6" />
        </g>
      </svg>
      <span className={`font-display text-xl font-extrabold uppercase leading-none tracking-tight ${onLime ? 'text-ink' : 'text-white'}`}>
        Pickle<span className={onLime ? 'text-ink/70' : 'text-lime'}>XP</span>
      </span>
    </Link>
  )
}
