// Small stroke icons (24×24 grid) so the app needs no icon package.
function Icon({ children, className = 'h-5 w-5', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export const ArrowRight = (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Icon>
export const ArrowUpRight = (p) => <Icon {...p}><path d="M7 17 17 7M8 7h9v9" /></Icon>
export const Trophy = (p) => <Icon {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></Icon>
export const Users = (p) => <Icon {...p}><circle cx="9" cy="7" r="4" /><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 3.13a4 4 0 0 1 0 7.75M22 21v-1a6 6 0 0 0-4-5.66" /></Icon>
export const Calendar = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
export const Pin = (p) => <Icon {...p}><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></Icon>
export const Clock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
export const Bolt = (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></Icon>
export const Award = (p) => <Icon {...p}><circle cx="12" cy="8" r="6" /><path d="M8.5 13 7 22l5-3 5 3-1.5-9" /></Icon>
export const Court = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 15h18M12 4v5M12 15v5" /></Icon>
export const Ball = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="9" cy="9" r=".6" fill="currentColor" /><circle cx="15" cy="9" r=".6" fill="currentColor" /><circle cx="12" cy="13" r=".6" fill="currentColor" /><circle cx="8.5" cy="15.5" r=".6" fill="currentColor" /><circle cx="15.5" cy="15.5" r=".6" fill="currentColor" /></Icon>
export const Megaphone = (p) => <Icon {...p}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></Icon>
export const Shield = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
export const Eye = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
export const Check = (p) => <Icon {...p}><path d="m5 12 5 5L20 7" /></Icon>
