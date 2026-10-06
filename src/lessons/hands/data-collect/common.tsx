/*
 * Small pieces this film repeats across its chapters: the cast's looks, a seekable "drive"
 * tween, a 2D jointed arm (the puppet and the robot arm), house icons, recolour filters, and
 * the lime map of data sources from the previous film (cheap / true to the robot / diverse).
 */
import type { ReactNode } from 'react'
import { C, MONO, SANS } from '../../../cine/palette'

/* ------------------------------------------------------------------ */
/* Cast                                                                 */
/* ------------------------------------------------------------------ */

export const KOFI = { headset: true, outfit: 'tee', top: '#3a6ea5', topDark: '#244a73', skin: C.skinC, skinDark: C.skinCDark, hair: 'buzz' } as const
export const NOOR = { hair: 'bun', top: '#9c4a2c', topDark: '#6a2e1a', skin: C.skinB, skinDark: C.skinBDark } as const
export const ADA = { hair: 'curls', glasses: true, top: '#2f5d62', topDark: '#1c3a3e', skin: C.skinC, skinDark: C.skinCDark } as const

/* ------------------------------------------------------------------ */
/* Timeline helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * A seekable procedural animation: tweens a proxy from 0 to 1 and calls `fn(u)` on every
 * update, so anything computed from u (a puppet's joints, a delayed follower) redraws
 * correctly when the film seeks.
 */
export function drive(tl: gsap.core.Timeline, at: number, dur: number, fn: (u: number) => void, ease = 'none') {
  const o = { u: 0 }
  tl.fromTo(o, { u: 0 }, { u: 1, duration: dur, ease, immediateRender: false, onUpdate: () => fn(o.u) }, at)
}

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const ease3 = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

/* ------------------------------------------------------------------ */
/* A 2D jointed arm                                                     */
/* ------------------------------------------------------------------ */

export type ArmAngles = [number, number, number]

/** Forward kinematics of Arm2D, in the arm's own (unscaled) frame: returns each joint point. */
export function armPoints(lens: [number, number, number], a: ArmAngles) {
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  let ang = 0
  let x = 0
  let y = 0
  for (let i = 0; i < 3; i++) {
    ang += a[i]
    const r = (ang * Math.PI) / 180
    x += Math.sin(r) * lens[i]
    y -= Math.cos(r) * lens[i]
    pts.push({ x, y })
  }
  return pts
}

/** Point the arm's three joints (degrees, clockwise from straight up). */
export function setArm(root: Element | null, cls: string, a: ArmAngles, lens: [number, number, number]) {
  if (!root) return
  root.querySelector(`.${cls}-j1`)?.setAttribute('transform', `rotate(${a[0].toFixed(2)})`)
  root.querySelector(`.${cls}-j2`)?.setAttribute('transform', `translate(0 ${-lens[0]}) rotate(${a[1].toFixed(2)})`)
  root.querySelector(`.${cls}-j3`)?.setAttribute('transform', `translate(0 ${-lens[1]}) rotate(${a[2].toFixed(2)})`)
}

/**
 * A three-joint arm standing on a base, drawn pointing up. `look`: a 3D-printed leader
 * (the puppet: orange plastic and hobby servos), or a white robot follower.
 * Animate with setArm(root, cls, angles, lens). `tip` is drawn at the end (in the end frame).
 */
export function Arm2D({ cls, x, y, s = 1, lens, look = 'robot', a = [0, 30, 20], tip }: { cls: string; x: number; y: number; s?: number; lens: [number, number, number]; look?: 'leader' | 'robot'; a?: ArmAngles; tip?: ReactNode }) {
  const leader = look === 'leader'
  const body = leader ? '#d9772b' : C.shell
  const bodyDark = leader ? '#8a4313' : C.shellDark
  const joint = leader ? C.ink2 : C.carbon
  const w = leader ? [22, 18, 14] : [30, 26, 20]
  const link = (len: number, wd: number) => (
    <>
      <rect x={-wd / 2} y={-len} width={wd} height={len} rx={wd / 2} fill={body} />
      <rect x={-wd / 2 + 3} y={-len + 6} width={wd * 0.28} height={len - 12} rx={2} fill={C.white} opacity={leader ? 0.25 : 0.6} />
      <rect x={wd / 2 - wd * 0.3} y={-len + 4} width={wd * 0.3} height={len - 8} rx={2} fill={bodyDark} opacity={0.5} />
    </>
  )
  const servo = (r: number) => (
    <>
      <circle r={r} fill={joint} />
      <circle r={r * 0.45} fill={leader ? C.slate : C.metal} />
    </>
  )
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-46 0 L46 0 L34 -22 L-34 -22 Z" fill={C.ink3} />
      <rect x={-46} y={-4} width={92} height={4} fill={C.keyDeep} opacity={0.4} />
      <g className={`${cls}-j1`} transform={`rotate(${a[0]})`}>
        {link(lens[0], w[0])}
        {servo(w[0] * 0.62)}
        <g className={`${cls}-j2`} transform={`translate(0 ${-lens[0]}) rotate(${a[1]})`}>
          {link(lens[1], w[1])}
          {servo(w[1] * 0.62)}
          <g className={`${cls}-j3`} transform={`translate(0 ${-lens[1]}) rotate(${a[2]})`}>
            {link(lens[2], w[2])}
            {servo(w[2] * 0.6)}
            <g transform={`translate(0 ${-lens[2]})`}>
              {tip ?? (
                <>
                  <rect x={-16} y={-10} width={32} height={12} rx={3} fill={joint} />
                  <rect x={-15} y={-34} width={8} height={26} rx={3} fill={body} />
                  <rect x={7} y={-34} width={8} height={26} rx={3} fill={body} />
                </>
              )}
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

/** A little house: roof and a window that can glow. */
export function House({ x, y, s = 1, className, glow = C.lime, lit = false }: { x: number; y: number; s?: number; className?: string; glow?: string; lit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-12 0 L-12 -14 L0 -24 L12 -14 L12 0 Z" fill={C.ink3} stroke={C.ink4} strokeWidth={1.2} />
      <rect className={className} x={-5} y={-12} width={10} height={9} fill={glow} opacity={lit ? 1 : 0} />
    </g>
  )
}

/** Recolour filters: draw anything as a flat red ghost, a lime trace, or a cyan wireframe. */
export function DcDefs() {
  const flat = (id: string, hex: string, a = 1) => {
    const n = parseInt(hex.slice(1), 16)
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    return (
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${a} 0`} />
      </filter>
    )
  }
  return (
    <defs>
      {flat('dc-red', C.danger, 0.55)}
      {flat('dc-lime', C.lime, 0.9)}
      {flat('dc-cyan', C.cyan, 0.5)}
      {flat('dc-ink', C.ink, 0.9)}
      {/* Only the bright lines of a drawing (bones, joint rings) survive, recoloured lime: a pose skeleton. */}
      <filter id="dc-limeline" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`0 0 0 0 ${0xb6 / 255} 0 0 0 0 ${0xf0 / 255} 0 0 0 0 ${0x3c / 255} 1.2 2.4 0.4 0 -0.9`} result="m" />
        <feComposite in="m" in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
  )
}

/* ------------------------------------------------------------------ */
/* The map of sources (from the data-gap film)                          */
/* ------------------------------------------------------------------ */

export const MAP = {
  top: { x: 800, y: 170 },
  left: { x: 380, y: 760 },
  right: { x: 1220, y: 760 },
}

/** The lime triangle: true to the robot (top), cheap (bottom left), diverse (bottom right). */
export function SourceMap({ className, hidden = false }: { className?: string; hidden?: boolean }) {
  const { top, left, right } = MAP
  return (
    <g className={className} opacity={hidden ? 0 : 1} pointerEvents="none">
      <path d={`M${top.x} ${top.y} L${right.x} ${right.y} L${left.x} ${left.y} Z`} fill={C.lime} fillOpacity={0.04} stroke={C.lime} strokeWidth={2.5} strokeOpacity={0.7} filter="url(#cn-bloom)" />
      <path d={`M${top.x} ${top.y} L${right.x} ${right.y} L${left.x} ${left.y} Z`} fill="none" stroke={C.limeLight} strokeWidth={1} strokeOpacity={0.5} strokeDasharray="2 10" />
      {[top, left, right].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill={C.lime} />
      ))}
      <text x={top.x} y={top.y - 30} textAnchor="middle" fill={C.limeLight} fontFamily={SANS} fontSize={30} fontWeight={600}>
        true to the robot
      </text>
      <text x={left.x - 10} y={left.y + 50} textAnchor="middle" fill={C.limeLight} fontFamily={SANS} fontSize={30} fontWeight={600}>
        cheap
      </text>
      <text x={right.x + 10} y={right.y + 50} textAnchor="middle" fill={C.limeLight} fontFamily={SANS} fontSize={30} fontWeight={600}>
        diverse
      </text>
    </g>
  )
}

/** Source icons for the map, drawn about 60 across, centred on (0, 0). */
export function SourceIcon({ kind, color = C.lime }: { kind: 'teleop' | 'glove' | 'video' | 'sim' | 'fleet'; color?: string }) {
  const st = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <g>
      <circle r={40} fill={C.ink1} stroke={color} strokeWidth={2.5} />
      {kind === 'teleop' && (
        <g {...st}>
          <path d="M-18 16 L-10 -4 L6 -14 L16 -4" />
          <circle cx={-10} cy={-4} r={3} fill={color} />
          <circle cx={6} cy={-14} r={3} fill={color} />
          <path d="M-24 18 H-4" />
        </g>
      )}
      {kind === 'glove' && (
        <g {...st}>
          <path d="M-14 20 L-14 -2 M-14 4 L-20 -6 M-8 -2 L-8 -20 M-1 -2 L-1 -24 M6 -2 L6 -20 M12 2 L12 -12 M-14 20 H12 L12 2" />
        </g>
      )}
      {kind === 'video' && (
        <g {...st}>
          <rect x={-20} y={-12} width={28} height={24} rx={4} />
          <path d="M8 -4 L20 -12 V12 L8 4" />
        </g>
      )}
      {kind === 'sim' && (
        <g {...st}>
          <path d="M-16 -6 L0 -16 L16 -6 L16 12 L0 22 L-16 12 Z M-16 -6 L0 4 L16 -6 M0 4 V22" />
        </g>
      )}
      {kind === 'fleet' && (
        <g {...st}>
          <circle cx={-10} cy={-8} r={6} />
          <path d="M-18 16 Q-10 2 -2 16" />
          <circle cx={12} cy={-8} r={6} />
          <path d="M4 16 Q12 2 20 16" />
        </g>
      )}
    </g>
  )
}

/** A short mono caption on the picture (no box), e.g. a timecode. */
export function Tag({ x, y, children, color = C.mist, size = 20, anchor = 'start', className, hidden = false }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; className?: string; hidden?: boolean }) {
  return (
    <text className={className} x={x} y={y} opacity={hidden ? 0 : 1} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} letterSpacing={1} pointerEvents="none" style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4} strokeOpacity={0.6}>
      {children}
    </text>
  )
}

/** A paper cup, centred on its base. */
export function PaperCup({ x = 0, y = 0, s = 1, className }: { x?: number; y?: number; s?: number; className?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={34} ry={7} fill="#000" opacity={0.4} filter="url(#cn-dof-1)" />
      <path d="M-26 0 L-34 -100 L34 -100 L26 0 Z" fill="#e9e2d2" />
      <path d="M6 0 L10 -100 L34 -100 L26 0 Z" fill="#b9ad95" opacity={0.7} />
      <rect x={-31} y={-70} width={62} height={22} fill={C.keyDeep} opacity={0.75} />
      <ellipse cx={0} cy={-100} rx={34} ry={7} fill="#f6f0e2" />
      <ellipse cx={0} cy={-100} rx={30} ry={5} fill="#5a3a22" />
    </g>
  )
}
