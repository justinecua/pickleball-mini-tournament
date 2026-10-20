import { CourtDiagram } from '../components/Ui'

export default function AuthLayout({ eyebrow, title, accent, footer, children }) {
  return (
    <div data-fill className="mx-auto flex min-h-[calc(100svh-6.5rem)] w-full max-w-6xl flex-1 items-center justify-center px-2 py-10 sm:px-4">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl bg-card text-ink shadow-xl md:grid-cols-2">
        <div className="court-grid relative hidden flex-col justify-between bg-forest-night p-10 text-white md:flex">
          <div>
            <p className="display mt-4 text-3xl">Your seat at every<br /><span className="text-lime">court.</span></p>
            <p className="mt-5 max-w-xs text-sm text-white/60">
              Follow the brackets, get your team&apos;s games front and center, and catch every notice from the organizers.
            </p>
          </div>
          <CourtDiagram court={1} className="mt-10 aspect-[5/3] w-full" />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          {eyebrow && <p className="label mb-2 text-olive">{eyebrow}</p>}
          <h1 className="display mb-8 text-3xl sm:text-4xl">{title}{accent && <> {accent}</>}</h1>
          {children}
          {footer && <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink/60">{footer}</p>}
        </div>
      </div>
    </div>
  )
}
