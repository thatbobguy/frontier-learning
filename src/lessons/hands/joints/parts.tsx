/*
 * Helpers for the "Joints and Freedom" film: a tweenable number store (so a GSAP timeline can
 * drive any drawing that React renders), a planar finger drawn side-on (bone blueprint,
 * robot or human), the adaptive-finger solver used by the wrap play, and a soft chime.
 */
import { useEffect, useReducer, useRef, type ReactNode } from 'react'
import { isMuted } from '../../../engine/narrator'
import { C, MONO } from '../../../cine/palette'
import { chain, type Pt } from './geom'

const rad = (d: number) => (d * Math.PI) / 180

export { chain, solveAdaptive, gap, type Pt, type Obstacle, type AdaptiveFinger } from './geom'

/* ------------------------------------------------------------------ */
/* A store of numbers a timeline can tween (fromTo, so seeking redraws) */
/* ------------------------------------------------------------------ */

export type Vals = Record<string, number>

export interface ValStore<T extends Vals> {
  state: T
  subscribe: (fn: () => void) => () => void
  notify: () => void
  /** Tween to new values on a timeline, from wherever the last planned move left them. */
  to: (tl: gsap.core.Timeline, next: Partial<T>, at: gsap.Position, dur?: number, ease?: string) => void
  /** Set values right now (for plays). */
  set: (next: Partial<T>) => void
}

export function makeVals<T extends Vals>(init: T): ValStore<T> {
  const state = { ...init }
  let planned = { ...init }
  const subs = new Set<() => void>()
  const notify = () => subs.forEach((f) => f())
  return {
    state,
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    notify,
    to: (tl, next, at, dur = 1, ease = 'power2.inOut') => {
      const from = { ...planned }
      const target = { ...planned, ...next } as T
      planned = target
      tl.fromTo(state, { ...from }, { ...target, duration: dur, ease, immediateRender: false, onUpdate: notify }, at)
    },
    set: (next) => {
      Object.assign(state, next)
      notify()
    },
  }
}

export function useVals<T extends Vals>(init: T) {
  const ref = useRef<ValStore<T> | null>(null)
  if (!ref.current) ref.current = makeVals(init)
  return ref.current
}

/** Re-render whenever the store changes; returns its live values. */
export function useLive<T extends Vals>(store: ValStore<T>) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  return store.state
}

/** Draws children from a store's live values, re-rendering only this piece. */
export function Live<T extends Vals>({ store, children }: { store: ValStore<T>; children: (s: T) => ReactNode }) {
  const s = useLive(store)
  return <>{children(s)}</>
}

/* ------------------------------------------------------------------ */
/* A planar finger, side-on                                             */
/* ------------------------------------------------------------------ */

/** A capsule (rounded bar) from a to b, half-width w. */
export function bar(a: Pt, b: Pt, w: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy) || 1
  const nx = (-dy / l) * w
  const ny = (dx / l) * w
  const f = (n: number) => n.toFixed(1)
  return `M${f(a.x + nx)} ${f(a.y + ny)} L${f(b.x + nx)} ${f(b.y + ny)} A${w} ${w} 0 0 1 ${f(b.x - nx)} ${f(b.y - ny)} L${f(a.x - nx)} ${f(a.y - ny)} A${w} ${w} 0 0 1 ${f(a.x + nx)} ${f(a.y + ny)} Z`
}

/** A straight bar from a to b, half-width w, square at a and rounded at b when `round`. */
export function slab(a: Pt, b: Pt, w: number, round = false) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy) || 1
  const nx = (-dy / l) * w
  const ny = (dx / l) * w
  const f = (n: number) => n.toFixed(1)
  const end = round ? `A${w} ${w} 0 0 1 ${f(b.x - nx)} ${f(b.y - ny)}` : `L${f(b.x - nx)} ${f(b.y - ny)}`
  return `M${f(a.x + nx)} ${f(a.y + ny)} L${f(b.x + nx)} ${f(b.y + ny)} ${end} L${f(a.x - nx)} ${f(a.y - ny)} Z`
}

export type FingerLook = 'bone' | 'robot' | 'human' | 'ghost' | 'adaptive'

/** A side-on finger: three links and three pin joints. */
export function Finger2D({ x, y, a0 = 0, lens, q, look = 'bone', w = 22, dir = 1, color, className, opacity = 1, tipPad = true }: {
  x: number
  y: number
  a0?: number
  lens: number[]
  q: number[]
  look?: FingerLook
  /** Half-width of the links. */
  w?: number
  dir?: number
  color?: string
  className?: string
  opacity?: number
  tipPad?: boolean
}) {
  const pts = chain(x, y, a0, lens, q, dir)
  const links = lens.map((_, i) => ({ a: pts[i], b: pts[i + 1], w: w * (1 - i * 0.1) }))
  if (look === 'ghost') {
    const c = color ?? C.mist
    return (
      <g className={className} opacity={opacity} pointerEvents="none">
        {links.map((l, i) => (
          <path key={i} d={bar(l.a, l.b, l.w)} fill={c} fillOpacity={0.06} stroke={c} strokeWidth={2.5} strokeDasharray="10 8" />
        ))}
      </g>
    )
  }
  if (look === 'human') {
    return (
      <g className={className} opacity={opacity} pointerEvents="none">
        {links.map((l, i) => (
          <path key={i} d={bar(l.a, l.b, l.w)} fill={C.skinB} />
        ))}
        {links.map((l, i) => (
          <path key={`h${i}`} d={bar({ x: l.a.x, y: l.a.y - l.w * 0.35 }, { x: l.b.x, y: l.b.y - l.w * 0.35 }, l.w * 0.4)} fill={C.skinA} opacity={0.35} />
        ))}
        {pts.slice(1, 3).map((p, i) => (
          <path key={`c${i}`} d={`M${p.x - 4} ${p.y - w * 0.7} q 6 ${w * 0.7} 0 ${w * 1.4}`} stroke={C.skinBDark} strokeWidth={2} fill="none" opacity={0.7} transform={`rotate(${angleAt(pts, i + 1)} ${p.x} ${p.y})`} />
        ))}
        {/* the nail */}
        <path d={bar(lerpPt(pts[2], pts[3], 0.55), lerpPt(pts[2], pts[3], 0.92), w * 0.32)} fill="#e7b9a0" opacity={0.85} transform={`translate(${-Math.sin(rad(angleAt(pts, 3))) * w * -0.45} ${Math.cos(rad(angleAt(pts, 3))) * w * -0.45})`} />
      </g>
    )
  }
  const robot = look === 'robot' || look === 'adaptive'
  const line = color ?? C.bone
  return (
    <g className={className} opacity={opacity} pointerEvents="none">
      {links.map((l, i) =>
        robot ? (
          <g key={i}>
            <path d={bar(l.a, l.b, l.w)} fill={C.shell} />
            <path d={bar(lerpPt(l.a, l.b, 0.12), lerpPt(l.b, l.a, 0.12), l.w * 0.45)} fill={C.white} opacity={0.5} transform={`translate(0 ${-l.w * 0.3})`} />
            <path d={bar(l.a, l.b, l.w)} fill="none" stroke={C.shellDark} strokeWidth={2} />
          </g>
        ) : (
          <g key={i}>
            <path d={slab(inset(l.a, l.b, w * 0.6 * (1 - i * 0.1)), i === links.length - 1 ? l.b : inset(l.b, l.a, w * 0.55 * (1 - i * 0.1)), l.w * 0.6, i === links.length - 1)} fill={C.ink2} fillOpacity={0.9} stroke={line} strokeWidth={3} strokeLinejoin="round" />
            <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={line} strokeWidth={2} opacity={0.35} strokeDasharray="6 6" />
          </g>
        ),
      )}
      {tipPad && robot && <circle cx={lerpPt(pts[2], pts[3], 0.88).x} cy={lerpPt(pts[2], pts[3], 0.88).y} r={w * 0.62} fill={C.rubber} />}
      {pts.slice(0, 3).map((p, i) => (
        <g key={`j${i}`}>
          <circle cx={p.x} cy={p.y} r={w * (robot ? 0.78 : 0.7) * (1 - i * 0.1)} fill={robot ? C.carbon : C.ink1} stroke={robot ? C.ink : line} strokeWidth={robot ? 1.5 : 3} />
          <circle cx={p.x} cy={p.y} r={w * 0.22} fill={robot ? C.metal : line} />
        </g>
      ))}
    </g>
  )
}

/** The point d along from a toward b. */
export function inset(a: Pt, b: Pt, d: number): Pt {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: a.x + ((b.x - a.x) / l) * d, y: a.y + ((b.y - a.y) / l) * d }
}

export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
/** Direction (degrees) of the link arriving at point i. */
export function angleAt(pts: Pt[], i: number) {
  const a = pts[Math.max(0, i - 1)]
  const b = pts[Math.min(pts.length - 1, Math.max(1, i))]
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** An arc of radius r around (x, y) from angle a1 to a2 (degrees). */
export function arc(x: number, y: number, r: number, a1: number, a2: number) {
  const p = (a: number) => `${(x + Math.cos(rad(a)) * r).toFixed(1)} ${(y + Math.sin(rad(a)) * r).toFixed(1)}`
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0
  const sweep = a2 > a1 ? 1 : 0
  return `M${p(a1)} A${r} ${r} 0 ${large} ${sweep} ${p(a2)}`
}

/* ------------------------------------------------------------------ */
/* Small things                                                         */
/* ------------------------------------------------------------------ */

let audio: AudioContext | null = null
/** A soft two-note chime when something locks into place (silent when the film is muted). */
export function chime(high = false) {
  if (isMuted()) return
  try {
    audio = audio ?? new AudioContext()
    const t = audio.currentTime
    ;[0, 0.09].forEach((dt, i) => {
      const o = audio!.createOscillator()
      const g = audio!.createGain()
      o.type = 'sine'
      o.frequency.value = (high ? 1046 : 784) * (i ? 1.5 : 1)
      g.gain.setValueAtTime(0, t + dt)
      g.gain.linearRampToValueAtTime(0.08, t + dt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.7)
      o.connect(g).connect(audio!.destination)
      o.start(t + dt)
      o.stop(t + dt + 0.75)
    })
  } catch {
    /* no audio: the visual lock is enough */
  }
}

/** A tick mark that draws itself (stroke-dash) when its class is tweened. */
export function Tick({ x, y, s = 1, color = C.lime, className }: { x: number; y: number; s?: number; color?: string; className?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} opacity={0} pointerEvents="none">
      <circle r={26} fill={C.ink1} fillOpacity={0.8} stroke={color} strokeWidth={3} />
      <path d="M-11 1 L-3 9 L12 -8" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** A mono caption for a small diagram (a counter, an axis name). */
export function Mono({ x, y, children, color = C.mist, size = 20, anchor = 'start', className, opacity }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; className?: string; opacity?: number }) {
  return (
    <text className={className} x={x} y={y} opacity={opacity} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} pointerEvents="none" style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4} strokeOpacity={0.5}>
      {children}
    </text>
  )
}
