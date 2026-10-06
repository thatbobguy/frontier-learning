/*
 * Props and helpers for film 4 (touch). Kept in this folder so the shared kit stays as is.
 */
import { useEffect, useReducer, type ReactNode } from 'react'
import { handSegments, FINGERS, type HandStore, type HandView } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'

/* ------------------------------------------------------------------ */
/* Timeline helpers                                                     */
/* ------------------------------------------------------------------ */

/** A number that counts on the timeline and writes itself into a text element (seeks correctly). */
export function ticker(tl: gsap.core.Timeline, el: Element | null | undefined, from: number, to: number, at: gsap.Position, dur: number, fmt: (v: number) => string, ease = 'none') {
  const o = { v: from }
  tl.fromTo(
    o,
    { v: from },
    {
      v: to,
      duration: dur,
      ease,
      immediateRender: false,
      onUpdate: () => {
        if (el) el.textContent = fmt(o.v)
      },
    },
    at,
  )
}

/** Draws a path on (stroke-dashoffset from its length to 0). Give the path pathLength={1}. */
export function draw(tl: gsap.core.Timeline, target: gsap.TweenTarget, at: gsap.Position, dur = 1, ease = 'power1.inOut', from = 1, to = 0) {
  tl.fromTo(target, { strokeDashoffset: from }, { strokeDashoffset: to, duration: dur, ease, immediateRender: false }, at)
}

export const stopwatch = (s: number) => {
  const whole = Math.floor(s)
  const tenth = Math.floor((s - whole) * 10)
  return `00:${String(whole).padStart(2, '0')}.${tenth}`
}

/* ------------------------------------------------------------------ */
/* Projecting a Hand3D's joints (the kit keeps its projector private)   */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number]
const rad = (d: number) => (d * Math.PI) / 180
function rot(view: HandView) {
  const { yaw, pitch, roll } = view
  const cy = Math.cos(rad(yaw)), sy = Math.sin(rad(yaw))
  const cx = Math.cos(rad(pitch)), sx = Math.sin(rad(pitch))
  const cz = Math.cos(rad(roll)), sz = Math.sin(rad(roll))
  return (v: V3): V3 => {
    // Ry, then Rx, then Rz (the same order as hand3d.tsx)
    const a: V3 = [cy * v[0] + sy * v[2], v[1], -sy * v[0] + cy * v[2]]
    const b: V3 = [a[0], cx * a[1] - sx * a[2], sx * a[1] + cx * a[2]]
    return [cz * b[0] - sz * b[1], sz * b[0] + cz * b[1], b[2]]
  }
}
export function projectHand(view: HandView, x0: number, y0: number) {
  const R = rot(view)
  return (v: V3) => {
    const r = R(v)
    const k = (900 / (900 - r[2] * view.s)) * view.s
    return { x: x0 + r[0] * k, y: y0 - r[1] * k }
  }
}

/** Re-render when a hand store changes. */
export function useStoreTick(store: HandStore) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
}

/**
 * Ghostly lines over a Hand3D tracing each finger's joints, with an angle readout at each
 * joint of the index finger: what proprioception "sees".
 */
export function JointGhost({ store, x, y, color = C.bone, read = C.magentaLight, numbers = true, className }: { store: HandStore; x: number; y: number; color?: string; read?: string; numbers?: boolean; className?: string }) {
  useStoreTick(store)
  const st = store.state
  const P = projectHand(st.view, x, y)
  const { segs } = handSegments(st.pose)
  const out: ReactNode[] = []
  for (const f of FINGERS) {
    const fs = segs.filter((s) => s.finger === f)
    const pts = [fs[0].a, ...fs.map((s) => s.b)].map(P)
    out.push(<polyline key={`l${f}`} points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={2.6} strokeOpacity={0.75} strokeDasharray="7 5" />)
    pts.slice(0, 3).forEach((p, k) => {
      out.push(<circle key={`j${f}${k}`} cx={p.x} cy={p.y} r={7} fill="none" stroke={read} strokeWidth={2} opacity={0.85} />)
    })
    if (numbers && f === 'index') {
      const ang = st.pose.index
      pts.slice(0, 3).forEach((p, k) => {
        out.push(
          <text key={`n${k}`} x={p.x + 16} y={p.y + 6} fill={read} fontFamily={MONO} fontSize={24} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4}>
            {ang[k].toFixed(1)}°
          </text>,
        )
      })
    }
  }
  return (
    <g className={className} pointerEvents="none">
      {out}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Props                                                                */
/* ------------------------------------------------------------------ */

/** A matchbox lying flat, seen from the front and a little above. (x, y) is the bottom centre. */
export function Matchbox({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={130} ry={10} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
      <path d="M-120 0 L120 0 L136 -26 L-104 -26 Z" fill="#7a3a20" />
      <rect x={-120} y={-24} width={240} height={26} fill="#a8482a" />
      {/* the striker strip */}
      <rect x={-120} y={-24} width={240} height={9} fill="#3b2a22" />
      <rect x={-120} y={-24} width={240} height={9} fill="url(#cn-hatch)" opacity={0.6} />
      <path d="M-104 -26 L136 -26 L120 0" fill="none" stroke="#d9774a" strokeWidth={2} opacity={0.6} />
      <text x={0} y={-2} textAnchor="middle" fill="#f3d9b0" fontFamily={SANS} fontSize={11} letterSpacing={3} opacity={0.8}>
        SAFETY MATCHES
      </text>
    </g>
  )
}

/** A wooden match pointing left, head at (0, 0). */
export function Match({ len = 150, burnt = false }: { len?: number; burnt?: boolean }) {
  return (
    <g>
      <rect x={4} y={-3.5} width={len} height={7} rx={2} fill="#e8c88f" />
      <rect x={4} y={-3.5} width={len} height={2.5} fill="#fff1cf" opacity={0.6} />
      <ellipse cx={4} cy={0} rx={10} ry={7} fill={burnt ? '#2b1d16' : '#b8322a'} />
      <ellipse cx={1} cy={-2} rx={4} ry={2.4} fill={burnt ? '#4a3a30' : '#e3584a'} />
    </g>
  )
}

/** A flame, base at (0, 0), pointing up. Scale it with a parent to flare. */
export function Flame({ className }: { className?: string }) {
  return (
    <g className={className} pointerEvents="none">
      <circle r={120} fill="url(#cn-pool-key)" />
      <g filter="url(#cn-bloom)">
        <path d="M0 6 C -22 -6 -14 -40 0 -66 C 14 -40 22 -6 0 6 Z" fill={C.key} />
        <path d="M0 4 C -12 -4 -8 -26 0 -42 C 8 -26 12 -4 0 4 Z" fill={C.keyLight} />
        <ellipse cx={0} cy={0} rx={5} ry={7} fill="#7fb6ff" opacity={0.8} />
      </g>
    </g>
  )
}

/** A drinking glass, base at (0, 0). */
export function Glass({ w = 120, h = 210 }: { w?: number; h?: number }) {
  const t = w * 0.08
  return (
    <g>
      <path d={`M${-w / 2} ${-h} L${-w / 2 + t} 0 L${w / 2 - t} 0 L${w / 2} ${-h} Z`} fill={C.rim} opacity={0.12} />
      <path d={`M${-w / 2 + t * 0.6} ${-h * 0.55} L${-w / 2 + t * 1.2} -4 L${w / 2 - t * 1.2} -4 L${w / 2 - t * 0.6} ${-h * 0.55} Z`} fill={C.rimDeep} opacity={0.35} />
      <path d={`M${-w / 2} ${-h} L${-w / 2 + t} 0 L${w / 2 - t} 0 L${w / 2} ${-h}`} fill="none" stroke={C.cyanLight} strokeWidth={2.5} opacity={0.8} />
      <ellipse cx={0} cy={-h} rx={w / 2} ry={9} fill="none" stroke={C.cyanLight} strokeWidth={2} opacity={0.8} />
      <ellipse cx={0} cy={-h * 0.55} rx={w / 2 - t * 0.6} ry={7} fill={C.rim} opacity={0.3} />
      <path d={`M${-w / 2 + 14} ${-h + 20} L${-w / 2 + 20} -20`} stroke={C.white} strokeWidth={5} opacity={0.35} strokeLinecap="round" />
    </g>
  )
}

/** A ceramic egg cup, top rim at (0, 0). */
export function EggCup({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx={0} cy={86} rx={52} ry={9} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
      <path d="M-46 0 Q-44 40 -12 52 L-14 70 Q-40 74 -40 84 L40 84 Q40 74 14 70 L12 52 Q44 40 46 0 Z" fill={C.ink4} />
      <path d="M-46 0 Q-44 40 -12 52 L-14 70 Q-40 74 -40 84 L-20 84 Q-24 74 -4 70 L-2 52 Q-30 40 -30 0 Z" fill={C.slate} opacity={0.7} />
      <ellipse cx={0} cy={0} rx={46} ry={8} fill={C.ink2} />
      <path d="M-46 0 Q0 12 46 0" fill="none" stroke={C.mist} strokeWidth={2} opacity={0.5} />
    </g>
  )
}

/**
 * A big robot finger seen from the side, pointing down from (0, 0): two shells, a dark
 * joint, a rubber fingertip pad. `pad` colours the pad (magenta for a feeling skin).
 */
export function BigFinger({ len = 260, w = 70, padClass, padColor = C.rubber, flip = false, className }: { len?: number; w?: number; padClass?: string; padColor?: string; flip?: boolean; className?: string }) {
  const l1 = len * 0.52
  return (
    <g className={className} transform={flip ? 'scale(-1 1)' : undefined}>
      <rect x={-w / 2} y={0} width={w} height={l1} rx={w / 2.4} fill="url(#cn-shell)" />
      <rect x={-w / 2 + 6} y={6} width={w * 0.22} height={l1 - 16} rx={6} fill={C.white} opacity={0.6} />
      <circle cx={0} cy={l1} r={w * 0.42} fill={C.carbon} />
      <circle cx={0} cy={l1} r={w * 0.16} fill={C.metal} />
      <path d={`M${-w / 2 + 2} ${l1 + 14} L${w / 2 - 2} ${l1 + 14} L${w / 2 - 6} ${len - w / 2} Q0 ${len + w * 0.25} ${-w / 2 + 6} ${len - w / 2} Z`} fill="url(#cn-shell)" />
      {/* the pad faces inward (+x) */}
      <path className={padClass} d={`M${w / 2 - 14} ${len - w * 1.2} Q${w / 2 + 6} ${len - w * 0.6} ${w / 2 - 8} ${len - w * 0.1} Q${w * 0.1} ${len + w * 0.18} ${w * 0.05} ${len - w * 0.2} Q${w * 0.18} ${len - w * 0.8} ${w / 2 - 14} ${len - w * 1.2} Z`} fill={padColor} />
    </g>
  )
}

/** A thin label for a mono readout line (no box). */
export function Mono({ x, y, children, color = C.lime, size = 22, anchor = 'start', className, opacity }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; className?: string; opacity?: number }) {
  return (
    <text className={className} x={x} y={y} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} opacity={opacity} style={{ fontVariantNumeric: 'tabular-nums', paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4} strokeOpacity={0.6} pointerEvents="none">
      {children}
    </text>
  )
}

/** A soft dark room: deep wall, a faint window of rain light far behind, blurred clutter. */
export function DimRoom({ warm = true }: { warm?: boolean }) {
  return (
    <g pointerEvents="none">
      <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
      <g filter="url(#cn-dof-3)" opacity={0.75}>
        <rect x={-120} y={40} width={260} height={480} fill={C.ink3} />
        <rect x={1360} y={30} width={320} height={520} fill={C.ink3} />
        <circle cx={1480} cy={200} r={44} fill={C.rim} opacity={0.3} />
        <circle cx={20} cy={240} r={30} fill={warm ? C.key : C.rim} opacity={0.25} />
        <circle cx={1220} cy={140} r={20} fill={C.rim} opacity={0.35} />
        <rect x={300} y={120} width={160} height={260} fill={C.ink2} />
      </g>
    </g>
  )
}

/** Scale an element about a stage point on the timeline (sets its transform attribute; seeks correctly). */
export function zoom(tl: gsap.core.Timeline, el: Element | null | undefined, cx: number, cy: number, from: number, to: number, at: gsap.Position, dur: number, ease = 'power2.out') {
  const o = { s: from }
  const apply = () => el?.setAttribute('transform', `translate(${cx} ${cy}) scale(${o.s.toFixed(4)}) translate(${-cx} ${-cy})`)
  tl.fromTo(o, { s: from }, { s: to, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
}
