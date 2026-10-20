import { useEffect } from 'react'

export default function Modal({ title, eyebrow, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-night/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-card text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-ink px-6 py-4 text-paper">
          <div>
            {eyebrow && <p className="label text-lime">{eyebrow}</p>}
            <h3 className="display mt-1 text-2xl">{title}</h3>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-white/50 hover:text-white" aria-label="Close">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
