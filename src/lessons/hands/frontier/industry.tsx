/*
 * The industry map (chapter 2), reused when your own designs land on it (chapter 3):
 * how dexterous a hand is (up) against how cheap and tough it is (right).
 * Placements are a judgement from the research files (prices, cycle claims, DoF), not data.
 */
import { C, MONO, SANS } from '../../../cine/palette'
import { type Design, score } from './design'

/** The chart's frame on stage. */
export const CHART = { x0: 300, y0: 790, w: 1060, h: 640 }
export const at = (u: number, v: number) => ({ x: CHART.x0 + u * CHART.w, y: CHART.y0 - v * CHART.h })

export interface Maker {
  id: string
  name: string
  sub: string
  u: number
  v: number
  fingers: number
  /** Label to the left or right of the dot. */
  side: 'l' | 'r'
  crack?: boolean
  cluster?: boolean
}

export const MAKERS: Maker[] = [
  { id: 'robotiq', name: 'Robotiq gripper', sub: '1 motor · $ low · tough', u: 0.9, v: 0.08, fingers: 2, side: 'l' },
  { id: 'inspire', name: 'Inspire · AgiBot', sub: '6 motors · linkage + screw', u: 0.74, v: 0.36, fingers: 5, side: 'r' },
  { id: 'wuji', name: 'Wuji', sub: '20 motors in the joints', u: 0.5, v: 0.78, fingers: 5, side: 'r' },
  { id: 'sharpa', name: 'Sharpa', sub: '22 DoF · 1,000+ taxels a fingertip', u: 0.36, v: 0.9, fingers: 5, side: 'r' },
  { id: 'dexee', name: 'Shadow DEX-EE', sub: 'tough, tactile, very costly', u: 0.08, v: 0.8, fingers: 3, side: 'r' },
  { id: 'leap', name: 'LEAP · ORCA · Aero', sub: '$720-2,000 · fragile', u: 0.2, v: 0.6, fingers: 4, side: 'r', crack: true },
  { id: 'tesla', name: 'Tesla', sub: '', u: 0.56, v: 0.52, fingers: 5, side: 'l', cluster: true },
  { id: 'figure', name: 'Figure', sub: '', u: 0.66, v: 0.48, fingers: 5, side: 'r', cluster: true },
  { id: '1x', name: '1X', sub: '', u: 0.6, v: 0.63, fingers: 5, side: 'r', cluster: true },
  { id: 'atlas', name: 'Atlas', sub: '', u: 0.71, v: 0.6, fingers: 4, side: 'r', cluster: true },
]

/** Where one of your designs sits on the same map. */
export function placeDesign(d: Design) {
  const s = score(d)
  const cheap = Math.max(0, Math.min(1, 1 - Math.log10(s.cost / 400) / 2))
  const tough = Math.max(0, Math.min(1, Math.log10(s.cycles / 30_000) / Math.log10(10_000_000 / 30_000)))
  const u = Math.max(0.04, Math.min(0.96, 0.5 * cheap + 0.5 * tough))
  const v = Math.max(0.04, Math.min(0.96, 0.05 + 0.9 * Math.pow(s.dex / 100, 1.8)))
  let best = MAKERS[0]
  let bd = Infinity
  for (const m of MAKERS) {
    const dd = Math.hypot(m.u - u, m.v - v)
    if (dd < bd) {
      bd = dd
      best = m
    }
  }
  return { u, v, near: best }
}

/** A small flat hand icon: a palm and n fingers (2 = a gripper's jaws). */
export function MiniHand({ x, y, s = 1, fingers = 5, color = C.paper, opacity = 1 }: { x: number; y: number; s?: number; fingers?: number; color?: string; opacity?: number }) {
  if (fingers === 2) {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
        <rect x={-14} y={-4} width={28} height={14} rx={3} fill={color} />
        <rect x={-14} y={-26} width={7} height={24} rx={2} fill={color} />
        <rect x={7} y={-26} width={7} height={24} rx={2} fill={color} />
      </g>
    )
  }
  const n = fingers - 1
  const span = 26
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <rect x={-14} y={-6} width={26} height={22} rx={6} fill={color} />
      {Array.from({ length: n }, (_, i) => {
        const fx = -12 + (i + 0.5) * (span / n) - 2.5
        const len = [22, 25, 23, 18][i] ?? 20
        return <rect key={i} x={fx} y={-6 - len} width={5.5} height={len + 4} rx={2.7} fill={color} />
      })}
      <rect x={10} y={-2} width={6} height={17} rx={3} fill={color} transform="rotate(-38 13 8)" />
    </g>
  )
}

/** The axes, the empty corner and the makers. Every piece has a class (prefix-...) for the timeline. */
export function IndustryChart({ p, dim = [] }: { p: string; dim?: string[] }) {
  const { x0, y0, w, h } = CHART
  const corner = at(0.92, 0.92)
  return (
    <g pointerEvents="none">
      <g className={`${p}-axes`}>
        <rect x={x0} y={y0 - h} width={w} height={h} fill="url(#cn-grid)" opacity={0.6} />
        <line x1={x0} y1={y0} x2={x0 + w + 30} y2={y0} stroke={C.mist} strokeWidth={2.5} markerEnd="url(#cn-arrow)" />
        <line x1={x0} y1={y0} x2={x0} y2={y0 - h - 30} stroke={C.mist} strokeWidth={2.5} markerEnd="url(#cn-arrow)" />
        <text x={x0 + w} y={y0 + 46} textAnchor="end" fill={C.gold} fontFamily={SANS} fontSize={28} fontWeight={600}>
          cheap + tough →
        </text>
        <text x={x0 - 30} y={y0 - h} textAnchor="end" fill={C.bone} fontFamily={SANS} fontSize={28} fontWeight={600} transform={`rotate(-90 ${x0 - 30} ${y0 - h})`}>
          dexterous →
        </text>
      </g>
      <g className={`${p}-corner`} opacity={0}>
        <circle cx={corner.x} cy={corner.y} r={170} fill="url(#cn-pool-gold)" />
        <rect x={corner.x - 120} y={corner.y - 90} width={240} height={180} rx={20} fill="none" stroke={C.gold} strokeWidth={2.5} strokeDasharray="10 8" />
        <text x={corner.x} y={corner.y + 8} textAnchor="middle" fill={C.goldLight} fontFamily={SANS} fontSize={26} fontWeight={600}>
          nobody, yet
        </text>
      </g>
      <g className={`${p}-cluster`} opacity={0}>
        <ellipse cx={at(0.635, 0.555).x} cy={at(0.635, 0.555).y} rx={150} ry={92} fill={C.amber} fillOpacity={0.06} stroke={C.amber} strokeWidth={1.6} strokeDasharray="5 6" />
        <text x={at(0.635, 0.555).x - 40} y={at(0.635, 0.555).y + 124} textAnchor="end" fill={C.amberLight} fontFamily={SANS} fontSize={21}>
          in-house humanoid hands
        </text>
      </g>
      {MAKERS.map((m) => {
        const q = at(m.u, m.v)
        const faded = dim.includes(m.id)
        const tx = m.side === 'r' ? q.x + 34 : q.x - 34
        return (
          <g key={m.id} className={`${p}-dot ${p}-dot-${m.id}`} opacity={0}>
            <g opacity={faded ? 0.35 : 1}>
              <circle cx={q.x} cy={q.y} r={30} fill={C.ink1} stroke={m.cluster ? C.amber : C.gold} strokeWidth={2} />
              <MiniHand x={q.x} y={q.y + 8} s={0.78} fingers={m.fingers} color={C.paper} />
              {m.crack && <path d={`M${q.x + 14} ${q.y - 26} l-8 12 l8 6 l-10 14`} stroke={C.danger} strokeWidth={2.6} fill="none" strokeLinejoin="round" />}
              <text x={tx} y={q.y + (m.sub ? -2 : 8)} textAnchor={m.side === 'r' ? 'start' : 'end'} fill={m.cluster ? C.amberLight : C.goldLight} fontFamily={SANS} fontSize={m.cluster ? 22 : 25} fontWeight={600} stroke={C.ink} strokeWidth={5} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                {m.name}
              </text>
              {m.sub && (
                <text x={tx} y={q.y + 24} textAnchor={m.side === 'r' ? 'start' : 'end'} fill={C.mist} fontFamily={MONO} fontSize={16} stroke={C.ink} strokeWidth={4} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                  {m.sub}
                </text>
              )}
            </g>
          </g>
        )
      })}
    </g>
  )
}
