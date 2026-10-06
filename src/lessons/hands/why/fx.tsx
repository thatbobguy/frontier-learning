/*
 * Helpers for film 1 (chapters 2 to 4): a copy of Hand3D's camera so overlays can sit
 * exactly on the drawn hand (joint arcs, tendons, muscles, pulleys, motors, touch dots),
 * and a pointer drag that works in a camera layer's own coordinates.
 */
import { useEffect, useReducer, type PointerEvent as ReactPointerEvent } from 'react'
import { rng } from '../../../art2/fx'
import { FINGERS, handSegments, type FingerName, type HandPose, type HandStore, type HandView } from '../../../cine/hand3d'
import { C } from '../../../cine/palette'

type V3 = [number, number, number]
type M3 = number[]

const rad = (d: number) => (d * Math.PI) / 180
const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
]
const app = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
const Rx = (d: number): M3 => [1, 0, 0, 0, Math.cos(rad(d)), -Math.sin(rad(d)), 0, Math.sin(rad(d)), Math.cos(rad(d))]
const Ry = (d: number): M3 => [Math.cos(rad(d)), 0, Math.sin(rad(d)), 0, 1, 0, -Math.sin(rad(d)), 0, Math.cos(rad(d))]
const Rz = (d: number): M3 => [Math.cos(rad(d)), -Math.sin(rad(d)), 0, Math.sin(rad(d)), Math.cos(rad(d)), 0, 0, 0, 1]

export interface Pt {
  x: number
  y: number
  k: number
}

/** The same projection Hand3D uses: hand space to stage, for a hand drawn at (x0, y0). */
export function projector(view: HandView, x0: number, y0: number) {
  const V = mul(Rz(view.roll), mul(Rx(view.pitch), Ry(view.yaw)))
  const f = 900
  return (v: V3): Pt => {
    const r = app(V, v)
    const k = (f / (f - r[2] * view.s)) * view.s
    return { x: x0 + r[0] * k, y: y0 - r[1] * k, k }
  }
}

/** Where a fingertip (or the wrist) lands on stage for a given pose and view. */
export function tipAt(pose: HandPose, view: HandView, x0: number, y0: number, finger: FingerName | 'wrist') {
  const pr = projector(view, x0, y0)
  if (finger === 'wrist') return pr([0, 0, 0])
  return pr(handSegments(pose).tips[finger])
}

/** Re-render whenever the hand store changes. */
export function useStore(store: HandStore) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  return store.state
}

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`
}

/**
 * Overlays drawn on top of a Hand3D sharing the same store and placement. Each part has its
 * own class so a timeline can fade it: `${cls}-arc-i`, `${cls}-tendons`, `${cls}-muscle-<id>`,
 * `${cls}-pulleys`, `${cls}-motors`, `${cls}-axes`, `${cls}-sleeve`.
 */
export function HandOverlay({ store, x, y, arm, cls, show }: {
  store: HandStore
  x: number
  y: number
  arm: number
  cls: string
  show: { arcs?: boolean; tendons?: boolean; muscles?: boolean; pulleys?: boolean; motors?: boolean; axes?: boolean; sleeve?: boolean; cables?: boolean }
}) {
  const st = useStore(store)
  const pr = projector(st.view, x, y)
  const { segs, H } = handSegments(st.pose)
  const els: React.ReactNode[] = []

  const wrist = pr([0, 0, 0])
  const elbow = pr([0, -arm, -4])

  if (show.sleeve) {
    // a dark see-through sleeve over the forearm, so what's inside can glow
    const ra = 30 * wrist.k * 0.9
    const rb = 34 * elbow.k * 0.9
    els.push(
      <g key="sleeve" className={`${cls}-sleeve`} opacity={0}>
        <path d={`M${wrist.x - ra} ${wrist.y} L${elbow.x - rb} ${elbow.y} L${elbow.x + rb} ${elbow.y} L${wrist.x + ra} ${wrist.y} Z`} fill={C.ink} opacity={0.62} />
        <path d={`M${wrist.x - ra} ${wrist.y} L${elbow.x - rb} ${elbow.y} M${wrist.x + ra} ${wrist.y} L${elbow.x + rb} ${elbow.y}`} stroke={C.keyLight} strokeWidth={2} opacity={0.35} />
      </g>,
    )
  }

  if (show.muscles) {
    // spindle-shaped muscle bellies in the forearm: [id, x across the forearm, z depth, width]
    const bellies: [string, number, number, number][] = [
      ['extensor', -19, -8, 9],
      ['deep', -4, 6, 12],
      ['thumb', 15, 6, 8],
    ]
    for (const [id, bx, bz, w] of bellies) {
      const a = pr([bx * 0.7, -arm * 0.18, bz])
      const b = pr([bx, -arm * 0.8, bz])
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l = Math.hypot(dx, dy) || 1
      const nx = (-dy / l) * w * a.k
      const ny = (dx / l) * w * a.k
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const d = `M${a.x} ${a.y} Q${m.x + nx * 2} ${m.y + ny * 2} ${b.x} ${b.y} Q${m.x - nx * 2} ${m.y - ny * 2} ${a.x} ${a.y} Z`
      const pulled = id === 'deep' ? Math.max(st.pull.index, st.pull.middle) : id === 'thumb' ? st.pull.thumb : 0
      els.push(
        <g key={id} className={`${cls}-muscle-${id}`} opacity={0}>
          <path d={d} fill={C.amberDark} opacity={id === 'extensor' ? 0.45 : 0.75} />
          <path d={d} fill="none" stroke={C.amber} strokeWidth={2} strokeDasharray={id === 'extensor' ? '6 5' : undefined} />
          {/* fibres */}
          {[-0.5, 0, 0.5].map((t) => (
            <path key={t} d={`M${a.x} ${a.y} Q${m.x + nx * t * 1.6} ${m.y + ny * t * 1.6} ${b.x} ${b.y}`} fill="none" stroke={C.amberLight} strokeWidth={1} opacity={0.5} />
          ))}
          <path d={d} fill={C.amber} opacity={0.15 + pulled * 0.6} filter="url(#cn-bloom)" />
        </g>,
      )
    }
  }

  if (show.tendons || show.cables) {
    const paths: React.ReactNode[] = []
    for (const f of FINGERS) {
      const fs = segs.filter((s) => s.finger === f)
      const pull = st.pull[f]
      const bx = f === 'thumb' ? 16 : f === 'index' ? 13.5 : f === 'middle' ? 4 : f === 'ring' ? -5 : -13.5
      const pts = [pr([bx * 0.6, -arm * 0.62, 6]), pr(app(H, [f === 'thumb' ? 18 : bx * 1.4, 8, 10]))]
      fs.forEach((s) => {
        pts.push(pr(s.a))
        pts.push(pr([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2 + 4]))
      })
      pts.push(pr(fs[fs.length - 1].b))
      const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')}`
      paths.push(<path key={`${f}g`} d={d} fill="none" stroke={C.cyan} strokeWidth={6 + pull * 6} opacity={0.12 + pull * 0.3} strokeLinejoin="round" strokeLinecap="round" />)
      paths.push(<path key={f} d={d} fill="none" stroke={pull > 0.05 ? C.cyanLight : C.cyan} strokeWidth={2 + pull * 2.2} opacity={0.75 + pull * 0.25} strokeLinejoin="round" strokeLinecap="round" />)
    }
    els.push(
      <g key="tendons" className={`${cls}-${show.cables ? 'cables' : 'tendons'}`} opacity={0}>
        {paths}
      </g>,
    )
  }

  if (show.pulleys) {
    const bands: React.ReactNode[] = []
    for (const s of segs) {
      if (s.finger === 'thumb' || s.k > 1) continue
      const a = pr(s.a)
      const b = pr(s.b)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l = Math.hypot(dx, dy) || 1
      const r = s.ra * a.k * 0.95
      const nx = (-dy / l) * r
      const ny = (dx / l) * r
      bands.push(<path key={`${s.finger}${s.k}`} d={`M${mx - nx} ${my - ny} L${mx + nx} ${my + ny}`} stroke={C.cyanLight} strokeWidth={5} strokeLinecap="round" opacity={0.9} />)
    }
    els.push(
      <g key="pulleys" className={`${cls}-pulleys`} opacity={0}>
        {bands}
      </g>,
    )
  }

  if (show.arcs) {
    segs.forEach((s, i) => {
      const a = pr(s.a)
      const b = pr(s.b)
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const r = Math.max(14, s.ra * a.k * 1.7)
      els.push(
        <g key={`arc${i}`} className={`${cls}-arc ${cls}-arc-${i}`} opacity={0}>
          <circle cx={a.x} cy={a.y} r={4} fill={C.cyanLight} />
          <path d={arcPath(a.x, a.y, r, ang - 0.75, ang + 0.75)} fill="none" stroke={C.cyan} strokeWidth={2.4} markerEnd="url(#cn-arrow)" />
        </g>,
      )
    })
  }

  if (show.axes) {
    // each joint's rotation axis, drawn as a short bone-white rod through the joint
    const rods: React.ReactNode[] = []
    segs.forEach((s, i) => {
      const a = pr(s.a)
      const b = pr(s.b)
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l = Math.hypot(dx, dy) || 1
      const r = s.ra * a.k * 1.5
      const nx = (-dy / l) * r
      const ny = (dx / l) * r
      rods.push(
        <g key={i}>
          <circle cx={a.x} cy={a.y} r={s.ra * a.k * 0.75} fill={C.bone} opacity={0.35} filter="url(#cn-bloom)" />
          <path d={`M${a.x - nx} ${a.y - ny} L${a.x + nx} ${a.y + ny}`} stroke={C.bone} strokeWidth={2.5} strokeDasharray="5 4" />
          <circle cx={a.x} cy={a.y} r={3.5} fill={C.bone} />
        </g>,
      )
    })
    els.push(
      <g key="axes" className={`${cls}-axes`} opacity={0}>
        {rods}
      </g>,
    )
  }

  if (show.motors) {
    const blocks: React.ReactNode[] = []
    for (let i = 0; i < 4; i++) {
      const t = 0.5 + i * 0.12
      const p1 = pr([-13, -arm * (1 - t), 8])
      const p2 = pr([13, -arm * (1 - t) + 20, 8])
      blocks.push(
        <g key={i}>
          <rect x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)} rx={5} fill={C.amberDark} stroke={C.amber} strokeWidth={2} />
          <rect x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)} rx={5} fill={C.amber} opacity={0.5} filter="url(#cn-bloom)" />
        </g>,
      )
    }
    els.push(
      <g key="motors" className={`${cls}-motors`} opacity={0}>
        {blocks}
      </g>,
    )
  }

  return <g pointerEvents="none">{els}</g>
}

/**
 * Touch receptors as magenta dots over the palm and fingers, densest at the fingertips.
 * Positions are fixed for the pose and view given (draw the hand in that pose).
 */
export function TouchDots({ pose, view, x, y, cls, seed = 7 }: { pose: HandPose; view: HandView; x: number; y: number; cls: string; seed?: number }) {
  const pr = projector(view, x, y)
  const { segs, palm } = handSegments(pose)
  const r = rng(seed)
  // Five groups, so they can fade in from the palm out to the tips.
  const groups: string[] = ['', '', '', '', '']
  const dot = (g: number, px: number, py: number, s: number) => {
    groups[g] += `M${(px - s).toFixed(1)} ${py.toFixed(1)}a${s} ${s} 0 1 0 ${2 * s} 0a${s} ${s} 0 1 0 ${-2 * s} 0`
  }
  // the palm: the front face (corners 4..7)
  const f = palm.slice(4, 8)
  for (let i = 0; i < 380; i++) {
    const u = r()
    const v = r()
    const top = [f[0][0] + (f[1][0] - f[0][0]) * u, f[0][1] + (f[1][1] - f[0][1]) * u, f[0][2]]
    const bot = [f[3][0] + (f[2][0] - f[3][0]) * u, f[3][1] + (f[2][1] - f[3][1]) * u, f[3][2]]
    const q = pr([top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v, top[2] + 6])
    dot(0, q.x, q.y, 1.3)
  }
  for (const s of segs) {
    const n = s.k === 2 ? 300 : s.k === 1 ? 90 : 70
    const g = s.k === 2 ? 3 : s.k + 1
    for (let i = 0; i < n; i++) {
      // tips: crowd toward the end of the last segment
      const t = s.k === 2 ? 1 - Math.pow(r(), 1.8) * 0.95 : r()
      const side = (r() - 0.5) * 1.5
      const p: V3 = [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t, s.a[2] + (s.b[2] - s.a[2]) * t]
      const rad0 = s.ra + (s.rb - s.ra) * t
      const q = pr([p[0] + side * rad0, p[1], p[2] + rad0 * 0.7])
      dot(g, q.x, q.y, s.k === 2 ? 1.1 : 1.3)
    }
    if (s.k === 2) {
      const tip = pr(s.b)
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * s.rb * tip.k * 0.9
        dot(4, tip.x + Math.cos(a) * d, tip.y + Math.sin(a) * d, 1)
      }
    }
  }
  return (
    <g pointerEvents="none">
      {groups.map((d, i) => (
        <path key={i} className={`${cls} ${cls}-${i}`} d={d} fill={i >= 3 ? C.magentaLight : C.magenta} opacity={0} />
      ))}
    </g>
  )
}

/**
 * Pointer drag in the coordinates of `layer` (a camera layer or any group), mouse and touch.
 * Spread the result on the thing being dragged.
 */
export function dragIn(layer: () => Element | null, h: { start?: (p: { x: number; y: number }) => void; move: (p: { x: number; y: number }) => void; end?: (p: { x: number; y: number }) => void }) {
  const at = (cx: number, cy: number) => {
    const el = layer() as SVGGraphicsElement | null
    const m = el?.getScreenCTM()
    if (!m) return { x: cx, y: cy }
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  return {
    onPointerDown: (e: ReactPointerEvent<Element>) => {
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      h.start?.(at(e.clientX, e.clientY))
      const move = (ev: PointerEvent) => h.move(at(ev.clientX, ev.clientY))
      const up = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', move as EventListener)
        target.removeEventListener('pointerup', up as EventListener)
        target.removeEventListener('pointercancel', up as EventListener)
        h.end?.(at(ev.clientX, ev.clientY))
      }
      target.addEventListener('pointermove', move as EventListener)
      target.addEventListener('pointerup', up as EventListener)
      target.addEventListener('pointercancel', up as EventListener)
    },
    style: { cursor: 'grab', touchAction: 'none' as const },
  }
}

const ZERO5 = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }

/**
 * Put a hand store back to its opening state at the very start of a timeline. A store
 * remembers where its last planned tween ended, so when React builds the timeline twice
 * (StrictMode, remounts) the first tweens would otherwise start from the old ending.
 */
export function resetHand(tl: gsap.core.Timeline, store: HandStore, init: { pose: HandPose; view: HandView; xray?: number }) {
  store.to(tl, { pose: init.pose, view: init.view, touch: ZERO5, pull: ZERO5, xray: init.xray ?? 0 }, 0, 0.001, 'none')
  Object.assign(store.state.pose, { ...init.pose, thumb: [...init.pose.thumb], index: [...init.pose.index], middle: [...init.pose.middle], ring: [...init.pose.ring], little: [...init.pose.little], wrist: [...init.pose.wrist] })
  Object.assign(store.state.view, init.view)
  Object.assign(store.state.touch, ZERO5)
  Object.assign(store.state.pull, ZERO5)
  store.state.xray = init.xray ?? 0
  store.notify()
}

/** Draw something that follows a hand's fingertips (re-renders with the store, not the scene). */
export function AtTips({ store, x, y, render }: { store: HandStore; x: number; y: number; render: (tips: Record<FingerName, Pt>) => React.ReactNode }) {
  const st = useStore(store)
  const pr = projector(st.view, x, y)
  const { tips } = handSegments(st.pose)
  const out = {} as Record<FingerName, Pt>
  for (const f of FINGERS) out[f] = pr(tips[f])
  return <g pointerEvents="none">{render(out)}</g>
}
