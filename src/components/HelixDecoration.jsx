import { useEffect, useState } from 'react'

/**
 * Central background DNA helix + bokeh, sitting behind the whole app so it
 * shows through the frosted-glass panels (see index.css/.frosted-panel).
 *
 * The "3D" depth is genuine parametric math, not a visual trick: a double
 * helix rotates around a vertical axis. Viewed from a fixed side camera, a
 * point at angle t has screen position x(t) = sin(t) (its left-right sway)
 * and depth z(t) = cos(t) (how far toward/away from the viewer it currently
 * is). So every bead's size/opacity is driven by the SAME angle that drives
 * its x-position — front-of-spiral beads render bigger and brighter,
 * back-of-spiral beads smaller and dimmer. The two strands are exactly a
 * half-turn (π) apart, so when one is at the front the other is at the back,
 * same as a real double helix.
 *
 * Static geometry (no per-frame JS): the whole spiral is precomputed once,
 * then a single CSS transform (vertical drift, seamless-looping because the
 * geometry is periodic) creates the sense of continuous rotation passing by.
 */

const TURN_HEIGHT = 140 // px of vertical travel per full 360° turn
const NUM_TURNS = 13 // 12 visible + 1 extra above for the seamless loop
const BEADS_PER_TURN = 8 // 45° steps — dotted, not a solid line
const VIEW_WIDTH = 120
const CENTER_X = VIEW_WIDTH / 2
const AMPLITUDE = 40
const MIN_RADIUS = 1
const MAX_RADIUS = 3.2
const MIN_OPACITY = 0.18
const MAX_OPACITY = 0.95
const TOTAL_HEIGHT = NUM_TURNS * TURN_HEIGHT

const depthFactor = (t) => (Math.cos(t) + 1) / 2 // 0 = back of spiral, 1 = front

function strandBeads(phaseOffset) {
  const beads = []
  const totalBeads = NUM_TURNS * BEADS_PER_TURN
  for (let i = 0; i < totalBeads; i++) {
    const t = (i / BEADS_PER_TURN) * 2 * Math.PI
    const y = (t / (2 * Math.PI)) * TURN_HEIGHT - TURN_HEIGHT // shift up by one turn for the loop margin
    const depth = depthFactor(t + phaseOffset)
    beads.push({
      x: CENTER_X + AMPLITUDE * Math.sin(t + phaseOffset),
      y,
      r: MIN_RADIUS + depth * (MAX_RADIUS - MIN_RADIUS),
      opacity: MIN_OPACITY + depth * (MAX_OPACITY - MIN_OPACITY),
    })
  }
  return beads
}

function rungs(beadsA, beadsB) {
  // A rung every 2nd bead (~every 90°) connecting the two strands at that
  // moment — small dotted connectors (three tiny beads), not a solid bar,
  // to stay consistent with the "particle" language of the reference.
  const list = []
  for (let i = 0; i < beadsA.length; i += 2) {
    const a = beadsA[i]
    const b = beadsB[i]
    const avgOpacity = ((a.opacity + b.opacity) / 2) * 0.6 // rungs recede slightly behind the main strands
    for (let f = 0.25; f <= 0.75; f += 0.25) {
      list.push({
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        r: 1,
        opacity: avgOpacity,
      })
    }
  }
  return list
}

const strandA = strandBeads(0)
const strandB = strandBeads(Math.PI)
const rungBeads = rungs(strandA, strandB)

// Bokeh: sparse, softly blurred background specks for depth. Positions are
// hand-picked (not random-per-render) so the layout is stable across renders.
const BOKEH = [
  { x: 20, y: 60, r: 10, delay: 0 }, { x: 95, y: 140, r: 6, delay: 1.2 },
  { x: 10, y: 260, r: 14, delay: 2.4 }, { x: 105, y: 340, r: 5, delay: 0.6 },
  { x: 30, y: 430, r: 8, delay: 3.1 }, { x: 92, y: 510, r: 12, delay: 1.8 },
  { x: 8, y: 610, r: 6, delay: 0.3 }, { x: 108, y: 690, r: 9, delay: 2.9 },
  { x: 22, y: 780, r: 13, delay: 1.1 }, { x: 98, y: 860, r: 5, delay: 3.6 },
  { x: 12, y: 950, r: 7, delay: 0.9 }, { x: 100, y: 1030, r: 11, delay: 2.1 },
  { x: 25, y: 1120, r: 6, delay: 3.3 }, { x: 90, y: 1200, r: 9, delay: 0.5 },
  { x: 15, y: 1290, r: 14, delay: 1.6 }, { x: 105, y: 1370, r: 5, delay: 2.7 },
  { x: 35, y: 1460, r: 8, delay: 3.9 }, { x: 95, y: 1540, r: 12, delay: 1.4 },
]

export default function HelixDecoration() {
  // Extra guard on top of prefers-reduced-motion / CSS-level throttling: pause
  // the (cheap) CSS animation outright while the tab isn't visible.
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden flex justify-center ${hidden ? 'anim-paused' : ''}`}
    >
      {/* Single SVG so bokeh and spiral share one coordinate system — avoids
          the layout ambiguity of stacking two absolutely-positioned SVGs
          with conflicting inset/explicit-size rules. Only the spiral <g>
          carries the drift animation; the bokeh <g> is independent. */}
      <svg width={VIEW_WIDTH} height={TOTAL_HEIGHT} viewBox={`0 0 ${VIEW_WIDTH} ${TOTAL_HEIGHT}`} className="shrink-0">
        <defs>
          <filter id="bokeh-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        <g className="spiral-drift text-blue-500/80 dark:text-blue-400/70">
          {rungBeads.map((b, i) => (
            <circle key={`r${i}`} cx={b.x} cy={b.y} r={b.r} fill="currentColor" opacity={b.opacity} />
          ))}
          {strandA.map((b, i) => (
            <circle key={`a${i}`} cx={b.x} cy={b.y} r={b.r} fill="currentColor" opacity={b.opacity} />
          ))}
          {strandB.map((b, i) => (
            <circle key={`b${i}`} cx={b.x} cy={b.y} r={b.r} fill="currentColor" opacity={b.opacity} />
          ))}
        </g>

        <g className="text-sky-400/70 dark:text-sky-300/50">
          {BOKEH.map((b, i) => (
            <circle
              key={i}
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="currentColor"
              filter="url(#bokeh-blur)"
              className="bokeh-speck"
              style={{ animationDelay: `${b.delay}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
