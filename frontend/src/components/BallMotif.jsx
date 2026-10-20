/** Huge faint pickleball drifting behind the page, tone-on-tone with the forest background. */
export default function BallMotif() {
  const holes = [[38, 30], [62, 28], [50, 50], [30, 58], [70, 60], [45, 75], [60, 82], [22, 40], [78, 42]]
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true"
      className="pointer-events-none fixed -right-[18vw] top-[8vh] -z-10 h-[90vh] w-[90vh] text-forest-deep">
      <circle cx="50" cy="50" r="48" fill="currentColor" />
      {holes.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#354139" />)}
    </svg>
  )
}
