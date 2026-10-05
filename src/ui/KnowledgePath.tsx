import { BRANCH_COLORS, C } from '../art/palette'
import type { Stop } from '../engine/types'

function colorFor(stop: Stop) {
  if (stop.branch === 'origin' || stop.branch === 'map') return C.ink
  return BRANCH_COLORS[stop.branch]
}

/**
 * The knowledge path strip across the top of the lesson. The core stops sit on one
 * line; the teaser branches fork off the end. Any stop can be tapped to jump there.
 */
export function KnowledgePath({
  stops,
  current,
  visited,
  onJump,
}: {
  stops: Stop[]
  current: number
  visited: Set<number>
  onJump: (index: number) => void
}) {
  const core = stops.map((s, i) => ({ s, i })).filter(({ s }) => !s.teaser)
  const teasers = stops.map((s, i) => ({ s, i })).filter(({ s }) => s.teaser)
  const W = 1000
  const left = 60
  const coreEnd = teasers.length ? 680 : W - 60
  const step = core.length > 1 ? (coreEnd - left) / (core.length - 1) : 0
  const pos = new Map<number, { x: number; y: number }>()
  core.forEach(({ i }, k) => pos.set(i, { x: left + k * step, y: 46 }))
  teasers.forEach(({ i }, k) => pos.set(i, { x: 800, y: teasers.length === 1 ? 46 : 22 + k * 48 }))
  const lastCore = pos.get(core[core.length - 1]?.i ?? 0)!

  return (
    <nav className="kpath" aria-label="Knowledge path">
      <svg viewBox={`0 0 ${W} 96`} preserveAspectRatio="xMidYMid meet">
        <line x1={left} y1={46} x2={lastCore.x} y2={46} stroke="var(--path-line)" strokeWidth={6} strokeLinecap="round" />
        {teasers.map(({ i }) => {
          const p = pos.get(i)!
          return (
            <path
              key={i}
              d={`M ${lastCore.x} 46 C ${lastCore.x + 60} 46 ${p.x - 70} ${p.y} ${p.x} ${p.y}`}
              stroke="var(--path-line)"
              strokeWidth={4}
              strokeDasharray="2 9"
              strokeLinecap="round"
              fill="none"
            />
          )
        })}
        {stops.map((s, i) => {
          const p = pos.get(i)!
          const isCurrent = i === current
          const done = visited.has(i)
          const color = colorFor(s)
          const r = s.teaser ? 11 : 15
          return (
            <g
              key={s.id}
              transform={`translate(${p.x} ${p.y})`}
              className="kpath-node"
              onClick={() => onJump(i)}
              role="button"
              aria-label={`Go to ${s.title}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCurrent && <circle r={r + 9} fill={color} opacity={0.25} className="pulse" />}
              <circle r={r} fill={done || isCurrent ? color : 'var(--path-empty)'} stroke={color} strokeWidth={4} />
              {done && !isCurrent && <path d="M -6 0 l 4 5 l 8 -9" stroke="#fff" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              <text
                x={s.teaser ? r + 10 : 0}
                y={s.teaser ? 5 : 40}
                textAnchor={s.teaser ? 'start' : 'middle'}
                className={isCurrent ? 'kpath-label on' : 'kpath-label'}
              >
                {s.title}
              </text>
            </g>
          )
        })}
      </svg>
    </nav>
  )
}
