/**
 * A hand in 3D, drawn in SVG: a jointed skeleton (palm, four fingers with three joints each,
 * a thumb with four), posed by joint angles, turned by a camera, and painted as depth-sorted
 * shaded capsules. One model draws a human hand, a white-shelled robot hand, an x-ray/blueprint
 * hand, or bare bones, so the course can morph from one to the other.
 *
 * Animate it through a store, which a GSAP timeline tweens:
 *   const hand = useHandStore({ pose: GRASPS.open, view: { yaw: -20, pitch: 10, s: 2 } })
 *   <Hand3D store={hand} x={800} y={600} look="robot" />
 *   hand.to(tl, { pose: GRASPS.power }, 'b2', 1.2)
 */
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { C } from './palette'

// ---------------------------------------------------------------- math

type V3 = [number, number, number]
type M3 = [number, number, number, number, number, number, number, number, number]

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
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const Rx = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
const Ry = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
const Rz = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}
const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

// ---------------------------------------------------------------- the hand

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'little'
export const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'little']

/**
 * Joint angles in degrees.
 * Fingers: [knuckle (MCP) bend, middle joint (PIP) bend, end joint (DIP) bend, spread].
 * Thumb: [swing across the palm (opposition), lift off the palm, MCP bend, IP bend].
 */
export interface HandPose {
  thumb: [number, number, number, number]
  index: [number, number, number, number]
  middle: [number, number, number, number]
  ring: [number, number, number, number]
  little: [number, number, number, number]
  /** Wrist bend (positive toward the palm) and side tilt. */
  wrist: [number, number]
}

export interface HandView {
  /** Turn left/right, tip toward/away, roll, in degrees. */
  yaw: number
  pitch: number
  roll: number
  /** Size: 1 is about a real hand at 1 px per mm. */
  s: number
}

export const GRASPS = {
  open: { thumb: [0, 10, 0, 0], index: [0, 0, 0, 6], middle: [0, 0, 0, 0], ring: [0, 0, 0, 5], little: [0, 0, 0, 10], wrist: [0, 0] },
  relaxed: { thumb: [18, 20, 10, 10], index: [14, 18, 10, 3], middle: [18, 24, 12, 0], ring: [22, 28, 14, 3], little: [26, 30, 16, 6], wrist: [8, 0] },
  spread: { thumb: [-6, 4, 0, 0], index: [-4, 0, 0, 16], middle: [-4, 0, 0, 0], ring: [-4, 0, 0, 14], little: [-4, 0, 0, 26], wrist: [-6, 0] },
  fist: { thumb: [62, 30, 40, 30], index: [86, 100, 60, 0], middle: [88, 102, 62, 0], ring: [88, 100, 60, 0], little: [86, 96, 58, 0], wrist: [0, 0] },
  /** Wrapping a cylinder (a bottle, a hammer handle). */
  power: { thumb: [60, 34, 26, 16], index: [52, 70, 36, 0], middle: [56, 72, 38, 0], ring: [58, 72, 36, 0], little: [60, 70, 34, 2], wrist: [6, 0] },
  /** Thumb tip to index tip, others curled out of the way. */
  pinch: { thumb: [58, 34, 14, 18], index: [42, 46, 22, 0], middle: [56, 74, 50, 0], ring: [66, 84, 56, 0], little: [72, 88, 56, 0], wrist: [4, 0] },
  /** Thumb, index and middle: holding a pen or a grape. */
  tripod: { thumb: [56, 32, 16, 16], index: [40, 44, 20, 2], middle: [44, 46, 22, 0], ring: [64, 82, 56, 0], little: [70, 86, 56, 0], wrist: [4, 0] },
  point: { thumb: [44, 26, 30, 24], index: [0, 4, 2, 2], middle: [86, 100, 62, 0], ring: [88, 100, 60, 0], little: [86, 96, 58, 0], wrist: [0, 0] },
  /** Flat fingers squeezing a card against the thumb. */
  lateral: { thumb: [30, 10, 6, 6], index: [68, 64, 30, 0], middle: [72, 70, 32, 0], ring: [76, 74, 34, 0], little: [80, 76, 34, 0], wrist: [0, 0] },
  /** Hook: carrying a bag. */
  hook: { thumb: [4, 10, 0, 0], index: [6, 92, 60, 0], middle: [6, 94, 62, 0], ring: [6, 92, 60, 0], little: [6, 90, 58, 0], wrist: [0, 0] },
  /** A gripper's view of the world: everything moves together. */
  claw: { thumb: [40, 20, 20, 20], index: [40, 40, 30, 0], middle: [40, 40, 30, 0], ring: [40, 40, 30, 0], little: [40, 40, 30, 0], wrist: [0, 0] },
} satisfies Record<string, HandPose>

interface FingerGeo {
  base: V3
  lens: [number, number, number]
  radii: [number, number, number, number]
  /** Which way spreading moves this finger in x. */
  spreadSign: number
}

const GEO: Record<Exclude<FingerName, 'thumb'>, FingerGeo> = {
  index: { base: [27, 92, 0], lens: [44, 26, 20], radii: [10, 9, 8, 7], spreadSign: 1 },
  middle: { base: [8.5, 96, 0], lens: [48, 30, 22], radii: [10.5, 9.5, 8.4, 7.2], spreadSign: 0.2 },
  ring: { base: [-10, 93, 0], lens: [45, 28, 21], radii: [10, 9, 8, 7], spreadSign: -1 },
  little: { base: [-27, 86, 0], lens: [36, 21, 18], radii: [9, 8, 7, 6], spreadSign: -1 },
}
const THUMB = { base: [32, 16, 4] as V3, lens: [42, 32, 26] as [number, number, number], radii: [14, 11.5, 10, 8.5] }
const PALM = { w: 72, len: 92, depth: 26 }

export interface Seg {
  a: V3
  b: V3
  ra: number
  rb: number
  /** Joint index along the finger: 0 = metacarpal (thumb) / proximal, 1, 2. */
  k: number
  finger: FingerName | 'arm'
}

/** The 3D points of every segment, in hand space (wrist at the origin, fingers up +y, palm facing +z). */
export function handSegments(p: HandPose, mirror = false): { segs: Seg[]; palm: V3[]; H: M3; tips: Record<FingerName, V3> } {
  const H = mul(Rx(p.wrist[0]), Rz(p.wrist[1]))
  const segs: Seg[] = []
  const tips = {} as Record<FingerName, V3>
  for (const name of ['index', 'middle', 'ring', 'little'] as const) {
    const g = GEO[name]
    const [mcp, pip, dip, spread] = p[name]
    let pt = app(H, g.base)
    let acc = 0
    const base = mul(H, Rz(-spread * g.spreadSign))
    const bends = [mcp, pip, dip]
    for (let k = 0; k < 3; k++) {
      acc += bends[k]
      const R = mul(base, Rx(acc))
      const nxt = add(pt, app(R, [0, g.lens[k], 0]))
      segs.push({ a: pt, b: nxt, ra: g.radii[k], rb: g.radii[k + 1], k, finger: name })
      pt = nxt
    }
    tips[name] = pt
  }
  // Thumb: the metacarpal swings out of the palm plane (opposition), then two bends.
  const [opp, lift, mcp, ip] = p.thumb
  const T0 = mul(H, mul(Ry(-opp * 0.9), mul(Rz(-38 + lift * 0.3), Rx(18 + lift * 0.6))))
  let pt = app(H, THUMB.base)
  const bends = [0, mcp, ip]
  let acc = 0
  for (let k = 0; k < 3; k++) {
    acc += bends[k]
    // thumb joints bend about an axis tilted from the finger axes, so it curls across the palm
    const R = mul(T0, mul(Ry(-28), mul(Rx(acc), Ry(28))))
    const nxt = add(pt, app(R, [0, THUMB.lens[k], 0]))
    segs.push({ a: pt, b: nxt, ra: THUMB.radii[k], rb: THUMB.radii[k + 1], k, finger: 'thumb' })
    pt = nxt
  }
  tips.thumb = pt
  const { w, len, depth } = PALM
  const corners: V3[] = []
  for (const z of [-depth / 2, depth / 2])
    for (const [x, y] of [
      [-w / 2 + 2, 6],
      [w / 2 - 2, 6],
      [w / 2 + 2, len - 4],
      [-w / 2, len - 12],
    ])
      corners.push(app(H, [x, y, z]))
  if (mirror) {
    const m = (v: V3): V3 => [-v[0], v[1], v[2]]
    segs.forEach((s) => {
      s.a = m(s.a)
      s.b = m(s.b)
    })
    for (const k of FINGERS) tips[k] = m(tips[k])
    return { segs, palm: corners.map(m), H, tips }
  }
  return { segs, palm: corners, H, tips }
}

// ---------------------------------------------------------------- the store (what GSAP tweens)

export interface HandState {
  pose: HandPose
  view: HandView
  /** 0..1 per finger: how hard each fingertip presses (lights the tactile pads). */
  touch: Record<FingerName, number>
  /** 0..1: how much of the robot's insides show (x-ray). */
  xray: number
  /** 0..1 per finger: tendon tension glow. */
  pull: Record<FingerName, number>
}

const ZERO = { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }

export interface HandStore {
  state: HandState
  subscribe: (fn: () => void) => () => void
  notify: () => void
  /** Tween to a new state. Pass only what changes. */
  to: (tl: gsap.core.Timeline, next: { pose?: Partial<HandPose>; view?: Partial<HandView>; touch?: Partial<Record<FingerName, number>>; pull?: Partial<Record<FingerName, number>>; xray?: number }, at: gsap.Position, dur?: number, ease?: string) => void
}

const flat = (s: HandState) => {
  const o: Record<string, number> = {}
  for (const f of [...FINGERS, 'wrist'] as const) (s.pose[f] as number[]).forEach((v, i) => (o[`p_${f}_${i}`] = v))
  for (const k of ['yaw', 'pitch', 'roll', 's'] as const) o[`v_${k}`] = s.view[k]
  for (const f of FINGERS) {
    o[`t_${f}`] = s.touch[f]
    o[`u_${f}`] = s.pull[f]
  }
  o.xray = s.xray
  return o
}
const unflat = (o: Record<string, number>, s: HandState) => {
  for (const f of [...FINGERS, 'wrist'] as const) (s.pose[f] as number[]).forEach((_, i) => ((s.pose[f] as number[])[i] = o[`p_${f}_${i}`]))
  for (const k of ['yaw', 'pitch', 'roll', 's'] as const) s.view[k] = o[`v_${k}`]
  for (const f of FINGERS) {
    s.touch[f] = o[`t_${f}`]
    s.pull[f] = o[`u_${f}`]
  }
  s.xray = o.xray
}

const clonePose = (p: HandPose): HandPose => ({
  thumb: [...p.thumb],
  index: [...p.index],
  middle: [...p.middle],
  ring: [...p.ring],
  little: [...p.little],
  wrist: [...p.wrist],
})

export function makeHandStore(init: { pose?: HandPose; view?: Partial<HandView>; xray?: number } = {}): HandStore {
  const state: HandState = {
    pose: clonePose(init.pose ?? GRASPS.relaxed),
    view: { yaw: 0, pitch: 0, roll: 0, s: 1, ...init.view },
    touch: { ...ZERO },
    pull: { ...ZERO },
    xray: init.xray ?? 0,
  }
  const subs = new Set<() => void>()
  const notify = () => subs.forEach((f) => f())
  let planned = flat(state)
  const live = flat(state)
  const to: HandStore['to'] = (tl, next, at, dur = 1, ease = 'power2.inOut') => {
    const from = { ...planned }
    const tmp: HandState = { pose: clonePose(state.pose), view: { ...state.view }, touch: { ...state.touch }, pull: { ...state.pull }, xray: state.xray }
    unflat(from, tmp)
    if (next.pose) Object.assign(tmp.pose, clonePose({ ...tmp.pose, ...next.pose } as HandPose))
    if (next.view) Object.assign(tmp.view, next.view)
    if (next.touch) Object.assign(tmp.touch, next.touch)
    if (next.pull) Object.assign(tmp.pull, next.pull)
    if (next.xray !== undefined) tmp.xray = next.xray
    const target = flat(tmp)
    planned = target
    tl.fromTo(live, { ...from }, {
      ...target,
      duration: dur,
      ease,
      immediateRender: false,
      onUpdate: () => {
        unflat(live, state)
        notify()
      },
    }, at)
  }
  return {
    state,
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    notify,
    to,
  }
}

/** A hand store that lives as long as the component. */
export function useHandStore(init: Parameters<typeof makeHandStore>[0] = {}) {
  const ref = useRef<HandStore | null>(null)
  if (!ref.current) ref.current = makeHandStore(init)
  return ref.current
}

// ---------------------------------------------------------------- drawing

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p: number, s: number) => (p >> s) & 255
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * Math.max(0, Math.min(1, t)))
  return `rgb(${m(16)},${m(8)},${m(0)})`
}

/** The outline of a tapered capsule between two screen circles. */
function capsule(ax: number, ay: number, ra: number, bx: number, by: number, rb: number) {
  const dx = bx - ax
  const dy = by - ay
  const d = Math.hypot(dx, dy)
  if (d < Math.abs(ra - rb) + 0.5) {
    const r = Math.max(ra, rb)
    const cx = ra > rb ? ax : bx
    const cy = ra > rb ? ay : by
    return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  }
  const ux = dx / d
  const uy = dy / d
  const a = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)))
  const base = Math.atan2(uy, ux)
  const p = (cx: number, cy: number, r: number, t: number) => `${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`
  const t1 = base + a
  const t2 = base - a
  return `M${p(ax, ay, ra, t1)} L${p(bx, by, rb, t1)} A${rb} ${rb} 0 0 0 ${p(bx, by, rb, t2)} L${p(ax, ay, ra, t2)} A${ra} ${ra} 0 1 0 ${p(ax, ay, ra, t1)} Z`
}

export type HandLook = 'robot' | 'human' | 'xray' | 'bones' | 'silhouette'

export interface Hand3DProps {
  store: HandStore
  x?: number
  y?: number
  look?: HandLook
  /** Mirror for a left hand. */
  left?: boolean
  /** Draw the forearm, this long (0 = none). */
  arm?: number
  /** Show the tendons running from the forearm to each fingertip. */
  tendons?: boolean
  /** Colour of the robot's shells. */
  shell?: string
  /** Light direction in screen space (from the light). */
  light?: [number, number]
  /** Called each frame with the projected fingertip positions (stage coordinates). */
  onTips?: (tips: Record<FingerName, { x: number; y: number; z: number }>) => void
  className?: string
  /** Data name for Pip to point at. */
  tutor?: string
}

/** Turns hand-space points into stage points: view rotation, then a gentle perspective. */
function projector(view: HandView, x0: number, y0: number) {
  const V = mul(Rz(view.roll), mul(Rx(view.pitch), Ry(view.yaw)))
  const f = 900
  return (v: V3) => {
    const r = app(V, v)
    const k = (f / (f - r[2] * view.s)) * view.s
    return { x: x0 + r[0] * k, y: y0 - r[1] * k, z: r[2], k, r }
  }
}

export function Hand3D({ store, x = 800, y = 600, look = 'robot', left = false, arm = 150, tendons = false, shell = C.shell, light = [-0.6, -0.8], onTips, className, tutor }: Hand3DProps) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const st = store.state
  const proj = projector(st.view, x, y)
  const { segs, palm, H, tips } = handSegments(st.pose, left)
  const [lx, ly] = light
  const ll = Math.hypot(lx, ly) || 1
  const L = { x: lx / ll, y: ly / ll }

  useEffect(() => {
    if (!onTips) return
    const out = {} as Record<FingerName, { x: number; y: number; z: number }>
    for (const f of FINGERS) {
      const q = proj(tips[f])
      out[f] = { x: q.x, y: q.y, z: q.z }
    }
    onTips(out)
  })

  const els: { z: number; el: React.ReactNode }[] = []
  const xr = st.xray
  const isRobot = look === 'robot'
  const isHuman = look === 'human'
  const line = look === 'xray' || look === 'bones'
  const skin = C.skinB
  const skinDark = C.skinBDark

  // ---- forearm
  if (arm > 0) {
    const a = proj(app(H, [0, 0, 0]))
    const elbow: V3 = [0, -arm, -4]
    const b = proj(elbow)
    const ra = 30 * a.k
    const rb = 34 * b.k
    const d = capsule(b.x, b.y, rb, a.x, a.y, ra)
    els.push({
      z: -999,
      el: (
        <g key="arm">
          {line ? (
            <path d={d} fill={C.ink1} fillOpacity={0.6} stroke={C.cyan} strokeWidth={1.5} strokeOpacity={0.6} />
          ) : (
            <>
              <path d={d} fill={isHuman ? skin : look === 'silhouette' ? C.ink : C.carbon} />
              {isRobot && <path d={capsule(b.x, b.y, rb * 0.92, a.x, a.y, ra * 0.92)} fill="url(#cn-shell)" opacity={0.92 * (1 - xr)} />}
              {isHuman && <path d={capsule(b.x - L.x * rb * 0.35, b.y - L.y * rb * 0.35, rb * 0.5, a.x - L.x * ra * 0.35, a.y - L.y * ra * 0.35, ra * 0.5)} fill={C.skinA} opacity={0.35} />}
            </>
          )}
          {isRobot && xr > 0.01 && (
            // actuators packed in the forearm
            <g opacity={xr}>
              {[0, 1, 2].map((i) => {
                const t = 0.18 + i * 0.26
                const p1 = proj([-14, -arm * (1 - t), 4])
                const p2 = proj([14, -arm * (1 - t) + 16, 4])
                return <rect key={i} x={Math.min(p1.x, p2.x) - 6} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x) + 12} height={Math.abs(p2.y - p1.y) + 4} rx={4} fill={C.amberDark} stroke={C.amber} strokeWidth={1.5} />
              })}
            </g>
          )}
        </g>
      ),
    })
  }

  // ---- palm: a rounded box, faces shaded by which way they point
  const P2 = palm.map(proj)
  const faces: [number[], string][] = [
    [[4, 5, 6, 7], 'front'], // palm side (+z)
    [[0, 3, 2, 1], 'back'],
    [[0, 1, 5, 4], 'bottom'],
    [[1, 2, 6, 5], 'thumbside'],
    [[2, 3, 7, 6], 'top'],
    [[3, 0, 4, 7], 'outside'],
  ]
  const palmZ = P2.reduce((n, q) => n + q.z, 0) / 8
  const palmEls: React.ReactNode[] = []
  for (const [idx, name] of faces) {
    const pts = idx.map((i) => P2[i])
    const cross = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x)
    const visible = left ? cross > 0 : cross < 0
    if (!visible) continue
    const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')} Z`
    // light from the upper left: faces whose screen normal points that way are brighter
    const cx = pts.reduce((n, q) => n + q.x, 0) / 4
    const cy = pts.reduce((n, q) => n + q.y, 0) / 4
    const pc = P2.reduce((n, q) => n + q.x, 0) / 8
    const pcy = P2.reduce((n, q) => n + q.y, 0) / 8
    const nl = Math.hypot(cx - pc, cy - pcy) || 1
    const facing = name === 'front' || name === 'back' ? 0.25 : -((cx - pc) * L.x + (cy - pcy) * L.y) / nl
    let fill: string
    if (line) fill = C.ink1
    else if (look === 'silhouette') fill = C.ink
    else if (isHuman) fill = mix(skinDark, skin, 0.55 + facing * 0.45)
    else if (name === 'front') fill = mix(C.ink1, C.rubber, 0.8 + facing * 0.2)
    else if (name === 'back') fill = shell
    else fill = mix(C.shellDark, shell, 0.5 + facing * 0.5)
    const r = isHuman ? 10 : 6
    palmEls.push(
      <path
        key={name}
        d={d}
        fill={fill}
        stroke={line ? C.cyan : fill}
        strokeWidth={line ? 1.5 : r * 2 * st.view.s}
        strokeLinejoin="round"
        strokeOpacity={line ? 0.8 : 1}
      />,
    )
    if (isRobot && name === 'front') {
      // the palm's grip pad and two screws
      palmEls.push(<path key="pad" d={d} fill="none" stroke={C.slate} strokeWidth={2} transform={`translate(${(cx * 0.1).toFixed(1)} ${(cy * 0.1).toFixed(1)}) scale(0.9)`} opacity={0.6} />)
    }
  }
  els.push({ z: palmZ, el: <g key="palm">{palmEls}</g> })

  // ---- finger segments
  segs.forEach((sg, i) => {
    const a = proj(sg.a)
    const b = proj(sg.b)
    const ra = sg.ra * a.k * (isHuman ? 1 : 0.92)
    const rb = sg.rb * b.k * (isHuman ? 1 : 0.92)
    const d = capsule(a.x, a.y, ra, b.x, b.y, rb)
    const z = (a.z + b.z) / 2
    const ax = b.x - a.x
    const ay = b.y - a.y
    const al = Math.hypot(ax, ay) || 1
    // a cylinder is brightest on the side that faces the light
    const side = { x: -ay / al, y: ax / al }
    const lit = side.x * L.x + side.y * L.y
    const off = lit > 0 ? -1 : 1
    const hx = side.x * off * Math.min(ra, rb) * 0.42
    const hy = side.y * off * Math.min(ra, rb) * 0.42
    const isTip = sg.k === 2
    const touch = st.touch[sg.finger as FingerName] ?? 0
    const parts: React.ReactNode[] = []
    if (line) {
      parts.push(<path key="o" d={d} fill={C.ink1} fillOpacity={0.55} stroke={look === 'bones' ? C.bone : C.cyan} strokeWidth={1.6} />)
      parts.push(<circle key="j" cx={a.x} cy={a.y} r={ra * 0.42} fill="none" stroke={C.cyanLight} strokeWidth={1.6} />)
      if (look === 'bones') parts.push(<line key="bone" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.bone} strokeWidth={ra * 0.6} strokeLinecap="round" opacity={0.85} />)
    } else if (look === 'silhouette') {
      parts.push(<path key="o" d={d} fill={C.ink} />)
    } else if (isHuman) {
      parts.push(<path key="o" d={d} fill={skin} />)
      parts.push(<path key="h" d={capsule(a.x + hx, a.y + hy, ra * 0.45, b.x + hx, b.y + hy, rb * 0.45)} fill={C.skinA} opacity={0.45} />)
      parts.push(<path key="s" d={capsule(a.x - hx * 1.2, a.y - hy * 1.2, ra * 0.5, b.x - hx * 1.2, b.y - hy * 1.2, rb * 0.5)} fill={skinDark} opacity={0.45} />)
      parts.push(<path key="c" d={`M${(a.x - side.x * ra * 0.5).toFixed(1)} ${(a.y - side.y * ra * 0.5).toFixed(1)} L${(a.x + side.x * ra * 0.5).toFixed(1)} ${(a.y + side.y * ra * 0.5).toFixed(1)}`} stroke={skinDark} strokeWidth={1.4} opacity={0.6} />)
    } else {
      // robot: dark joint, white shell, rubber fingertip pad
      parts.push(<circle key="j" cx={a.x} cy={a.y} r={ra * 0.98} fill={C.carbon} />)
      parts.push(<path key="o" d={capsule(a.x + (ax / al) * ra * 0.55, a.y + (ay / al) * ra * 0.55, ra * 0.92, b.x - (ax / al) * rb * (isTip ? 0 : 0.4), b.y - (ay / al) * rb * (isTip ? 0 : 0.4), rb * 0.92)} fill={shell} opacity={1 - xr * 0.8} />)
      parts.push(<path key="h" d={capsule(a.x + hx * 1.1 + (ax / al) * ra * 0.6, a.y + hy * 1.1 + (ay / al) * ra * 0.6, ra * 0.32, b.x + hx * 1.1, b.y + hy * 1.1, rb * 0.32)} fill={C.white} opacity={0.7 * (1 - xr)} />)
      parts.push(<path key="s" d={capsule(a.x - hx * 1.3, a.y - hy * 1.3, ra * 0.45, b.x - hx * 1.3, b.y - hy * 1.3, rb * 0.45)} fill={C.shellDark} opacity={0.5 * (1 - xr)} />)
      parts.push(<circle key="ax" cx={a.x} cy={a.y} r={ra * 0.36} fill={C.metal} stroke={C.ink} strokeWidth={1} />)
      if (isTip) parts.push(<circle key="pad" cx={b.x - (ax / al) * rb * 0.2} cy={b.y - (ay / al) * rb * 0.2} r={rb * 0.75} fill={C.rubber} opacity={0.9 * (1 - xr)} />)
      if (xr > 0.01) {
        parts.push(<path key="xo" d={d} fill="none" stroke={C.cyan} strokeWidth={1.4} opacity={xr} />)
        parts.push(<line key="xb" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.cyanLight} strokeWidth={1.2} strokeDasharray="4 4" opacity={xr * 0.8} />)
      }
    }
    if (isTip && touch > 0.01) {
      parts.push(
        <g key="t" filter="url(#cn-bloom)">
          <circle cx={b.x} cy={b.y} r={rb * (0.9 + touch * 0.5)} fill={C.magenta} opacity={0.25 + touch * 0.55} />
          <circle cx={b.x} cy={b.y} r={rb * 0.45} fill={C.magentaLight} opacity={touch} />
        </g>,
      )
    }
    els.push({ z, el: <g key={`s${i}`}>{parts}</g> })
  })

  els.sort((p, q) => p.z - q.z)

  // ---- tendons, drawn on top: from the forearm, along the palm side, to each fingertip
  const tendonEls: React.ReactNode[] = []
  if (tendons || st.xray > 0.3) {
    for (const f of FINGERS) {
      const fs = segs.filter((s) => s.finger === f)
      const pull = st.pull[f]
      const pts = [proj(app(H, [f === 'thumb' ? 16 : (GEO[f as 'index'].base[0] * 0.5), -arm * 0.7, 6])), proj(app(H, [f === 'thumb' ? 18 : GEO[f as 'index'].base[0] * 0.7, 8, 10]))]
      fs.forEach((s) => pts.push(proj(s.a), proj(add(s.a, scl(add(s.b, scl(s.a, -1)), 0.5)))))
      pts.push(proj(fs[fs.length - 1].b))
      const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')}`
      tendonEls.push(
        <path key={f} d={d} fill="none" stroke={pull > 0.05 ? C.cyanLight : C.cyan} strokeWidth={1.6 + pull * 2.4} strokeOpacity={0.55 + pull * 0.45} strokeLinejoin="round" filter={pull > 0.05 ? 'url(#cn-bloom)' : undefined} />,
      )
    }
  }

  return (
    <g className={className} data-tutor={tutor}>
      {els.map((e) => e.el)}
      {tendonEls}
    </g>
  )
}

/** Where a fingertip is on stage, for placing objects in the hand. */
export function tipOnStage(store: HandStore, finger: FingerName, x: number, y: number, left = false) {
  const { tips } = handSegments(store.state.pose, left)
  const q = projector(store.state.view, x, y)(tips[finger])
  return { x: q.x, y: q.y }
}

export const useHandSegments = (p: HandPose) => useMemo(() => handSegments(p), [p])
export { I as IDENTITY }
