const PERIOD = 100 // height (svg units) of one repeating DNA "rung" cycle
// Indices -1..19: one extra period above the visible area so the seamless
// loop (see .helix-drift in index.css) never reveals empty space at the top.
const PERIOD_INDICES = Array.from({ length: 21 }, (_, i) => i - 1)
const TOTAL_HEIGHT = 1900 // covers realistic desktop viewport heights

/** One period of a two-strand DNA ladder: two mirrored wave paths + 2 rungs. */
function HelixPeriod({ y }) {
  return (
    <g transform={`translate(0, ${y})`}>
      <path d="M4,0 C4,25 40,25 40,50 C40,75 4,75 4,100" fill="none" strokeWidth="2" stroke="currentColor" />
      <path d="M40,0 C40,25 4,25 4,50 C4,75 40,75 40,100" fill="none" strokeWidth="2" stroke="currentColor" />
      <line x1="4" y1="0" x2="40" y2="0" strokeWidth="1.5" stroke="currentColor" />
      <line x1="40" y1="50" x2="4" y2="50" strokeWidth="1.5" stroke="currentColor" />
    </g>
  )
}

/**
 * Purely decorative DNA double-helix strips filling the empty side margins
 * on wide viewports (the app's content column is capped at max-w-md).
 * - Fixed + pointer-events-none + behind content (-z-10): structurally
 *   cannot overlap or intercept taps on anything, at any viewport width.
 * - Hidden below `lg` — mobile has no real "sides", so it's simply absent
 *   there rather than rendered faintly (mobile readability wins).
 * - CSS-only drift animation (see .helix-drift in index.css), which is
 *   disabled under prefers-reduced-motion. No JS animation loop.
 * - `currentColor` + Tailwind text-color classes make it theme-aware.
 */
export default function HelixDecoration() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-4 -z-10 hidden w-11 overflow-hidden text-blue-100/80 lg:block dark:text-slate-800/60"
      >
        <svg width="44" height={TOTAL_HEIGHT} viewBox={`0 0 44 ${TOTAL_HEIGHT}`} className="helix-drift">
          {PERIOD_INDICES.map((i) => (
            <HelixPeriod key={i} y={i * PERIOD} />
          ))}
        </svg>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-4 -z-10 hidden w-11 overflow-hidden text-blue-100/80 lg:block dark:text-slate-800/60"
      >
        <svg width="44" height={TOTAL_HEIGHT} viewBox={`0 0 44 ${TOTAL_HEIGHT}`} className="helix-drift">
          {PERIOD_INDICES.map((i) => (
            <HelixPeriod key={i} y={i * PERIOD} />
          ))}
        </svg>
      </div>
    </>
  )
}
