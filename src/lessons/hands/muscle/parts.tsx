/*
 * Pieces for film 3 (Muscles of Metal): a side-view robot finger that a timeline can curl,
 * gears with real teeth, a small electric motor (side and end views), weights, heat shimmer
 * and smoke, plus a few small helpers (forward kinematics, counters).
 *
 * Everything here lives in this film's folder; the shared kit is not touched.
 */
import type { ReactNode } from 'react'
import { C, MONO } from '../../../cine/palette'

/* ------------------------------------------------------------------ */
/* CSS loops for this film (they pause with the film)                    */
/* ------------------------------------------------------------------ */

export const MUSCLE_CSS = `
.mu-spin { transform-box: fill-box; transform-origin: center; animation: mu-spin 1.2s linear infinite; }
.mu-spin-slow { transform-box: fill-box; transform-origin: center; animation: mu-spin 7s linear infinite; }
.mu-spin-rev { transform-box: fill-box; transform-origin: center; animation: mu-spin 3s linear infinite reverse; }
@keyframes mu-spin { to { transform: rotate(360deg); } }
.mu-smoke { animation: mu-smoke 2.6s ease-out infinite; }
@keyframes mu-smoke {
  0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  15% { opacity: 0.55; }
  100% { transform: translate(-30px, -170px) scale(2.2); opacity: 0; }
}
.mu-shimmer { animation: mu-shimmer 1.8s ease-in-out infinite; }
@keyframes mu-shimmer {
  0% { transform: translate(0, 10px) scaleX(1); opacity: 0; }
  30% { opacity: 0.8; }
  100% { transform: translate(6px, -70px) scaleX(1.3); opacity: 0; }
}
.mu-flow { animation: mu-flow 1s linear infinite; }
@keyframes mu-flow { to { stroke-dashoffset: -48; } }
.mu-flow-slow { animation: mu-flow 2.4s linear infinite; }
.mu-bob { animation: mu-bob 1.3s ease-in-out infinite alternate; }
@keyframes mu-bob { from { transform: translate(0, 0); } to { transform: translate(0, -26px); } }
.mu-strain { animation: mu-strain 0.18s linear infinite alternate; }
@keyframes mu-strain { from { transform: translate(-1.5px, 0); } to { transform: translate(1.5px, 0.5px); } }
.mu-drop { animation: mu-drop 2s cubic-bezier(.5,0,1,.6) infinite; }
@keyframes mu-drop { 0% { transform: translate(0, -70px); opacity: 0; } 10% { opacity: 1; } 55% { transform: translate(0, 0); opacity: 1; } 70% { transform: translate(14px, -16px); opacity: 1; } 100% { transform: translate(40px, 30px); opacity: 0; } }
.mu-recoil { transform-box: view-box; animation: mu-recoil 2s ease-out infinite; }
@keyframes mu-recoil { 0%, 54% { transform: rotate(0deg); } 62% { transform: rotate(14deg); } 100% { transform: rotate(0deg); } }
.mu-crack { animation: mu-crack 2s steps(1) infinite; }
@keyframes mu-crack { 0%, 54% { opacity: 0; } 56%, 92% { opacity: 1; } 100% { opacity: 0; } }
.mu-push { animation: mu-push 2.4s ease-in-out infinite; }
@keyframes mu-push { 0%, 10% { transform: translate(40px, 0); } 45%, 70% { transform: translate(0, 0); } 100% { transform: translate(40px, 0); } }
.mu-yield { transform-box: view-box; animation: mu-yield 2.4s ease-in-out infinite; }
@keyframes mu-yield { 0%, 22% { transform: rotate(0deg); } 45%, 70% { transform: rotate(-22deg); } 100% { transform: rotate(0deg); } }
.mu-glowpulse { animation: mu-glowpulse 1.4s ease-in-out infinite alternate; }
@keyframes mu-glowpulse { from { opacity: 0.45; } to { opacity: 1; } }
.mu-coil { transform-box: fill-box; transform-origin: left center; animation: mu-coil 2.6s ease-in-out infinite; }
@keyframes mu-coil { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.8); } }
.mu-swell { transform-box: fill-box; transform-origin: center; animation: mu-swell 2.2s ease-in-out infinite; }
@keyframes mu-swell { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(0.86, 1.5); } }
.mu-shake { animation: mu-shake 0.4s linear 2; }
@keyframes mu-shake { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(-8px, 0); } 75% { transform: translate(8px, 0); } }
.flow-paused .mu-spin, .flow-paused .mu-spin-slow, .flow-paused .mu-spin-rev, .flow-paused .mu-smoke, .flow-paused .mu-shimmer,
.flow-paused .mu-flow, .flow-paused .mu-flow-slow, .flow-paused .mu-bob, .flow-paused .mu-strain, .flow-paused .mu-drop,
.flow-paused .mu-recoil, .flow-paused .mu-crack, .flow-paused .mu-push, .flow-paused .mu-yield, .flow-paused .mu-glowpulse,
.flow-paused .mu-coil, .flow-paused .mu-swell { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .mu-spin, .mu-spin-slow, .mu-spin-rev, .mu-smoke, .mu-shimmer, .mu-flow, .mu-flow-slow, .mu-bob, .mu-strain, .mu-drop,
  .mu-recoil, .mu-crack, .mu-push, .mu-yield, .mu-glowpulse, .mu-coil, .mu-swell { animation: none; }
}
`

export function MuscleStyle() {
  return <style>{MUSCLE_CSS}</style>
}

/* ------------------------------------------------------------------ */
/* A side-view robot finger                                             */
/* ------------------------------------------------------------------ */

export type Angles = [number, number, number]

const DEG = Math.PI / 180

/** Joint positions of a finger: base, knuckle..., tip (stage coordinates). Bends are positive toward the palm (clockwise on screen when the finger points right). */
export function fk(x: number, y: number, rot: number, lens: number[], angles: number[], s = 1) {
  const pts = [{ x, y, a: rot }]
  let a = rot
  let px = x
  let py = y
  for (let i = 0; i < lens.length; i++) {
    a += angles[i] ?? 0
    px += Math.cos(a * DEG) * lens[i] * s
    py += Math.sin(a * DEG) * lens[i] * s
    pts.push({ x: px, y: py, a })
  }
  return pts
}

/**
 * A white-shelled robot finger seen from the side, pointing along `rot` (0 = right), palm side
 * down (to the right of the pointing direction). Joints are groups named `${cls}-j0..2`, so
 * `fingerRig` can curl it from a timeline. `slots[i]` draws extra things in segment i's frame
 * (origin at that segment's joint, x along the segment, +y the palm side).
 */
export function RFinger({ x, y, rot = 0, s = 1, lens = [150, 105, 85], w = 46, angles = [0, 0, 0], cls, look = 'robot', slots = [], under, xray = 0 }: {
  x: number
  y: number
  rot?: number
  s?: number
  lens?: number[]
  w?: number
  angles?: number[]
  cls?: string
  look?: 'robot' | 'blueprint' | 'ghost'
  slots?: ReactNode[]
  /** Drawn first in segment frames (under the shell), e.g. a tendon. */
  under?: ReactNode[]
  xray?: number
}) {
  const seg = (i: number, child: ReactNode): ReactNode => {
    const L = lens[i]
    const wa = w * (1 - i * 0.1)
    const wb = w * (1 - (i + 1) * 0.1) * (i === 2 ? 0.92 : 1)
    const isTip = i === 2
    const shape = `M0 ${-wa / 2} L${L} ${-wb / 2} ${isTip ? `Q${L + wb * 0.75} ${-wb / 2} ${L + wb * 0.75} 0 Q${L + wb * 0.75} ${wb / 2} ${L} ${wb / 2}` : `L${L} ${wb / 2}`} L0 ${wa / 2} Z`
    const body =
      look === 'robot' ? (
        <>
          {under?.[i]}
          <path d={shape} fill={C.shell} opacity={1 - xray * 0.85} />
          <path d={`M${wa * 0.45} ${-wa / 2 + 5} L${L - 6} ${-wb / 2 + 5}`} stroke={C.white} strokeWidth={5} strokeLinecap="round" opacity={0.8 * (1 - xray)} />
          <path d={`M${wa * 0.45} ${wa / 2 - 6} L${L - 6} ${wb / 2 - 6}`} stroke={C.shellDark} strokeWidth={7} strokeLinecap="round" opacity={0.55 * (1 - xray)} />
          {xray > 0 && <path d={shape} fill="none" stroke={C.cyan} strokeWidth={2} opacity={xray} />}
          {isTip && <ellipse cx={L + wb * 0.1} cy={wb * 0.32} rx={wb * 0.62} ry={wb * 0.26} fill={C.rubber} opacity={1 - xray * 0.6} />}
          <circle r={wa * 0.52} fill={C.carbon} />
          <circle r={wa * 0.2} fill={C.metal} stroke={C.ink} strokeWidth={1.5} />
        </>
      ) : (
        <>
          {under?.[i]}
          <path d={shape} fill={look === 'ghost' ? 'none' : C.ink1} fillOpacity={0.7} stroke={look === 'ghost' ? C.cyanLight : C.cyan} strokeWidth={look === 'ghost' ? 2 : 2.2} strokeDasharray={look === 'ghost' ? '8 6' : undefined} />
          <circle r={wa * 0.32} fill="none" stroke={C.cyanLight} strokeWidth={2} opacity={look === 'ghost' ? 0.6 : 1} />
          <circle r={3} fill={C.cyanLight} />
        </>
      )
    return (
      <g className={cls ? `${cls}-j${i}` : undefined} transform={`rotate(${angles[i] ?? 0})`}>
        {body}
        {slots[i]}
        {i < 2 && <g transform={`translate(${L} 0)`}>{child}</g>}
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {seg(0, seg(1, seg(2, null)))}
    </g>
  )
}

/** Curls an RFinger (by its `cls`) from a timeline; every move is a fromTo from the planned angles. */
export function fingerRig(scope: Element | null, cls: string, start: Angles = [0, 0, 0]) {
  const state = { a0: start[0], a1: start[1], a2: start[2] }
  let planned = { ...state }
  const nodes = [0, 1, 2].map((i) => (scope ? [...scope.querySelectorAll(`.${cls}-j${i}`)] : []))
  const apply = () => {
    nodes[0].forEach((n) => n.setAttribute('transform', `rotate(${state.a0.toFixed(2)})`))
    nodes[1].forEach((n) => n.setAttribute('transform', `rotate(${state.a1.toFixed(2)})`))
    nodes[2].forEach((n) => n.setAttribute('transform', `rotate(${state.a2.toFixed(2)})`))
  }
  apply()
  const to = (tl: gsap.core.Timeline, a: Angles, at: gsap.Position, dur = 1, ease = 'power2.inOut') => {
    const from = { ...planned }
    const next = { a0: a[0], a1: a[1], a2: a[2] }
    planned = next
    tl.fromTo(state, from, { ...next, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
  }
  return { to, state }
}

/* ------------------------------------------------------------------ */
/* Gears                                                                */
/* ------------------------------------------------------------------ */

/** A spur gear outline centred on the origin: pitch radius r, n teeth. */
export function gearPath(r: number, n: number, depth?: number) {
  const m = (2 * r) / n
  const h = depth ?? m * 1.1
  const ro = r + h * 0.5
  const ri = r - h * 0.6
  const p = (2 * Math.PI) / n
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = i * p
    const at = (ang: number, rr: number) => `${(Math.cos(ang) * rr).toFixed(2)} ${(Math.sin(ang) * rr).toFixed(2)}`
    pts.push(at(a - p * 0.5, ri), at(a - p * 0.28, ri), at(a - p * 0.16, ro), at(a + p * 0.16, ro), at(a + p * 0.28, ri))
  }
  return `M${pts.join(' L')} Z`
}

/** A metal spur gear with a hub and spokes (or holes). */
export function Gear({ r, n, x = 0, y = 0, className, color = C.metal, dark = C.metalDark, holes = 6, hub = 0.22 }: { r: number; n: number; x?: number; y?: number; className?: string; color?: string; dark?: string; holes?: number; hub?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
        <path d={gearPath(r, n)} fill={dark} transform="translate(3 4)" opacity={0.6} />
        <path d={gearPath(r, n)} fill={color} />
        <circle r={r * 0.82} fill="none" stroke={dark} strokeWidth={Math.max(1.5, r * 0.025)} opacity={0.7} />
        {r > 60 &&
          Array.from({ length: holes }, (_, i) => {
            const a = (i / holes) * Math.PI * 2
            return <circle key={i} cx={Math.cos(a) * r * 0.52} cy={Math.sin(a) * r * 0.52} r={r * 0.17} fill={C.ink1} opacity={0.85} />
          })}
        <circle r={r * hub} fill={dark} />
        <circle r={r * hub * 0.45} fill={C.ink1} />
        <rect x={-r * hub * 0.12} y={-r * hub * 0.9} width={r * hub * 0.24} height={r * hub * 0.5} fill={C.ink1} />
      </g>
    </g>
  )
}

/** A planetary stage seen end-on: ring with inner teeth, three planets, a sun. */
export function Planetary({ x, y, r = 90, className }: { x: number; y: number; r?: number; className?: string }) {
  const sun = r * 0.28
  const pl = r * 0.3
  const orbit = sun + pl
  return (
    <g transform={`translate(${x} ${y})`} className={className}>
      <circle r={r + 14} fill={C.metalDark} />
      <circle r={r + 2} fill={C.ink1} />
      <path d={gearPath(r, 30)} fill="none" stroke={C.metal} strokeWidth={3} opacity={0.6} />
      <g className="mu-spin-slow">
        {[0, 120, 240].map((a) => (
          <g key={a} transform={`rotate(${a}) translate(${orbit} 0)`}>
            <path d={gearPath(pl, 9)} fill={C.metal} />
            <circle r={pl * 0.25} fill={C.ink1} />
          </g>
        ))}
        <path d={gearPath(sun, 9)} fill={C.amberLight} />
        <circle r={sun * 0.3} fill={C.ink1} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Motors                                                               */
/* ------------------------------------------------------------------ */

/**
 * A small brushed motor from the side, centred on the origin, about 300 x 150 at s = 1, shaft to
 * the right. Parts are separate groups (`${cls}-cap`, `-can`, `-magT`, `-magB`, `-coil`, `-shaft`)
 * so a timeline can explode it.
 */
export function MotorSide({ x = 0, y = 0, s = 1, cls = 'mtr', glow = 0, labelCan = true }: { x?: number; y?: number; s?: number; cls?: string; glow?: number; labelCan?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={`${cls}-shaft`}>
        <rect x={-140} y={-9} width={390} height={18} rx={6} fill="url(#cn-metal)" />
        <rect x={228} y={-12} width={10} height={24} rx={2} fill={C.metalDark} />
      </g>
      <g className={`${cls}-coil`}>
        <rect x={-112} y={-50} width={224} height={100} rx={14} fill="url(#cn-copper)" />
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${-104 + i * 10} -48 q 5 48 0 96`} stroke="#7a3d14" strokeWidth={2.2} fill="none" opacity={0.75} />
        ))}
        <rect x={-112} y={-50} width={224} height={14} rx={7} fill="#ffe0bd" opacity={0.35} />
        <rect x={-126} y={-26} width={16} height={52} rx={3} fill={C.metalDark} />
      </g>
      <g className={`${cls}-magT`}>
        <path d="M-122 -50 L-122 -66 Q0 -84 122 -66 L122 -50 Q0 -62 -122 -50 Z" fill={C.slate} />
        <path d="M-118 -66 Q0 -84 118 -66" stroke={C.mist} strokeWidth={3} fill="none" opacity={0.6} />
        <text x={0} y={-60} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={15} fontWeight={700}>N</text>
      </g>
      <g className={`${cls}-magB`}>
        <path d="M-122 50 L-122 66 Q0 84 122 66 L122 50 Q0 62 -122 50 Z" fill={C.ink4} />
        <path d="M-122 50 Q0 62 122 50" stroke={C.mist} strokeWidth={2} fill="none" opacity={0.5} />
        <text x={0} y={74} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={15} fontWeight={700}>S</text>
      </g>
      <g className={`${cls}-can`}>
        <rect x={-150} y={-78} width={300} height={156} rx={22} fill="url(#cn-metal)" />
        <rect x={-150} y={-78} width={300} height={156} rx={22} fill="none" stroke={C.metalDark} strokeWidth={3} />
        <rect x={-140} y={-66} width={280} height={14} rx={7} fill={C.white} opacity={0.35} />
        <rect x={60} y={-78} width={8} height={156} fill={C.metalDark} opacity={0.5} />
        {labelCan && <rect x={-90} y={-20} width={130} height={40} rx={4} fill={C.ink2} opacity={0.85} />}
        {labelCan && <rect x={-80} y={-6} width={70} height={5} rx={2} fill={C.amber} opacity={0.8} />}
        {labelCan && <rect x={-80} y={4} width={46} height={4} rx={2} fill={C.mist} opacity={0.5} />}
        {glow > 0 && <rect x={-150} y={-78} width={300} height={156} rx={22} fill={C.danger} opacity={glow * 0.55} />}
      </g>
      <g className={`${cls}-cap`}>
        <rect x={-176} y={-62} width={30} height={124} rx={8} fill={C.ink3} />
        <rect x={-182} y={-30} width={10} height={14} rx={2} fill={C.amberDark} />
        <rect x={-182} y={16} width={10} height={14} rx={2} fill={C.amberDark} />
        <path d="M-182 -23 q -40 0 -60 -30" stroke={C.danger} strokeWidth={4} fill="none" opacity={0.8} />
        <path d="M-182 23 q -40 0 -60 30" stroke={C.ink4} strokeWidth={4} fill="none" />
      </g>
    </g>
  )
}

/** A motor end-on (the face with the shaft), radius r, for lever tests. */
export function MotorFace({ x, y, r, glow = 0 }: { x: number; y: number; r: number; glow?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="url(#cn-metal)" />
      <circle r={r * 0.86} fill="none" stroke={C.metalDark} strokeWidth={Math.max(1.5, r * 0.04)} />
      {[45, 135, 225, 315].map((a) => (
        <circle key={a} cx={Math.cos(a * DEG) * r * 0.62} cy={Math.sin(a * DEG) * r * 0.62} r={r * 0.06} fill={C.ink2} />
      ))}
      <circle r={r * 0.24} fill={C.metalDark} />
      {glow > 0 && <circle r={r} fill={C.danger} opacity={glow * 0.5} />}
    </g>
  )
}

/** A stack of weights hanging from a hook at the origin: n blocks, each w wide. */
export function Weights({ n, w = 60, h = 22, lit = n, color = C.metalDark }: { n: number; w?: number; h?: number; lit?: number; color?: string }) {
  return (
    <g>
      <line x1={0} y1={0} x2={0} y2={18} stroke={C.mist} strokeWidth={2} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(0 ${18 + i * (h + 3)})`} opacity={i < lit ? 1 : 0.25}>
          <rect x={-w / 2} y={0} width={w} height={h} rx={4} fill={color} />
          <rect x={-w / 2} y={0} width={w} height={4} rx={2} fill={C.mist} opacity={0.6} />
        </g>
      ))}
    </g>
  )
}

/** Wavy heat lines rising from a point (CSS loop). */
export function Shimmer({ x, y, n = 4, spread = 40, className, color = C.amberLight }: { x: number; y: number; n?: number; spread?: number; className?: string; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} className={className} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${(i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) * 2} 0)`}>
          <path className="mu-shimmer" style={{ animationDelay: `${-i * 0.45}s` }} d="M0 0 q -8 -12 0 -24 q 8 -12 0 -24 q -8 -12 0 -24" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      ))}
    </g>
  )
}

/** Smoke puffs rising from a point (CSS loop). */
export function Smoke({ x, y, n = 5, className }: { x: number; y: number; n?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} className={className} pointerEvents="none" filter="url(#cn-dof-1)">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${(i - n / 2) * 14} 0)`}>
          <circle className="mu-smoke" style={{ animationDelay: `${-i * 0.52}s` }} r={22} fill={C.fog} />
        </g>
      ))}
    </g>
  )
}

/** A curved torque arrow around a centre (cx, cy), radius r, sweeping `sweep` degrees from `start`. */
export function TorqueArc({ cx, cy, r, start = -150, sweep = 120, width = 6, color = C.amber, className }: { cx: number; cy: number; r: number; start?: number; sweep?: number; width?: number; color?: string; className?: string }) {
  const a0 = start * DEG
  const a1 = (start + sweep) * DEG
  const x0 = cx + Math.cos(a0) * r
  const y0 = cy + Math.sin(a0) * r
  const x1 = cx + Math.cos(a1) * r
  const y1 = cy + Math.sin(a1) * r
  // the arrowhead: along the tangent at the end, sized to the line
  const dir = sweep > 0 ? 1 : -1
  const tx = -Math.sin(a1) * dir
  const ty = Math.cos(a1) * dir
  const h = 14 + Math.min(width, 16) * 1.1
  const nx = Math.cos(a1)
  const ny = Math.sin(a1)
  const head = `M${x1 + tx * h} ${y1 + ty * h} L${x1 + nx * h * 0.6} ${y1 + ny * h * 0.6} L${x1 - nx * h * 0.6} ${y1 - ny * h * 0.6} Z`
  return (
    <g className={className}>
      <path d={`M${x0} ${y0} A${r} ${r} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${x1} ${y1}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={head} fill={color} />
    </g>
  )
}

/** Tween a number and write it into the text of `sel` (formatted), as a fromTo so seeking works. */
export function count(tl: gsap.core.Timeline, scope: Element | null, sel: string, from: number, to: number, at: gsap.Position, dur: number, fmt: (v: number) => string, ease = 'power1.inOut') {
  const o = { v: from }
  const els = scope ? [...scope.querySelectorAll(sel)] : []
  const write = () => els.forEach((e) => (e.textContent = fmt(o.v)))
  tl.fromTo(o, { v: from }, { v: to, duration: dur, ease, immediateRender: false, onUpdate: write, onStart: write }, at)
}

/** A clamp. */
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
