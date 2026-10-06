/*
 * Props and helpers for "How Robots Learn": top-down tabletops (the drift course, the vase),
 * a top-down gripper, Ada's monitor, little kitchens, the cast, and a path follower for
 * timelines.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { rng } from '../../../art2/fx'
import { C, MONO, SANS } from '../../../cine/palette'
import { Pool } from '../shared/kit'
import type { Pt } from './sim'

/* ------------------------------------------------------------------ */
/* The cast                                                             */
/* ------------------------------------------------------------------ */

export const ADA = { hair: 'curls', glasses: true, top: '#2f5d62', topDark: '#1c3a3e', skin: C.skinC, skinDark: C.skinCDark } as const
export const KOFI = { headset: true, outfit: 'tee', top: '#3a6ea5', topDark: '#244a73', skin: C.skinC } as const

/* ------------------------------------------------------------------ */
/* Timeline helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Move an element along a polyline (stage points) between `at` and `at + dur`, seekable.
 * Optionally turn it to face along the path, and report progress.
 */
export function along(tl: gsap.core.Timeline, el: Element | null, pts: Pt[], at: number, dur: number, opts: { ease?: string; rotate?: boolean; from?: number; to?: number; onT?: (t: number, p: Pt) => void } = {}) {
  if (!el || pts.length < 2) return
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const L = cum[cum.length - 1] || 1
  const proxy = { t: opts.from ?? 0 }
  const apply = () => {
    const d = proxy.t * L
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const k = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)))
    const a = pts[i - 1]
    const b = pts[i]
    const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    const rot = opts.rotate ? (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI : 0
    el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})${opts.rotate ? ` rotate(${rot.toFixed(1)})` : ''}`)
    opts.onT?.(proxy.t, p)
  }
  tl.fromTo(proxy, { t: opts.from ?? 0 }, { t: opts.to ?? 1, duration: dur, ease: opts.ease ?? 'none', immediateRender: false, onUpdate: apply }, at)
}

/** Draw a path on with its stroke (needs pathLength=1 on the element). */
export function drawOn(tl: gsap.core.Timeline, target: gsap.TweenTarget, at: number, dur: number, ease = 'power1.inOut') {
  tl.fromTo(target, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease, immediateRender: false }, at)
}

/**
 * Calls `cb(dt)` every animation frame while `active` (for plays that run a live simulation).
 * Pass `active = false` while the film is paused so the simulation holds still.
 */
export function useTicker(active: boolean, cb: (dt: number) => void) {
  const cbRef = useRef(cb)
  useLayoutEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    if (!active) return
    let id = 0
    let last = performance.now()
    const f = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      cbRef.current(dt)
      id = requestAnimationFrame(f)
    }
    id = requestAnimationFrame(f)
    return () => cancelAnimationFrame(id)
  }, [active])
}

/* ------------------------------------------------------------------ */
/* Top-down tabletop                                                    */
/* ------------------------------------------------------------------ */

/** A wooden tabletop seen from straight above, lit by a lamp pool. */
export function TopTable({ x, y, w, h, seed = 3, lampX, lampY }: { x: number; y: number; w: number; h: number; seed?: number; lampX?: number; lampY?: number }) {
  const r = rng(seed)
  return (
    <g pointerEvents="none">
      {/* the floor far below, in shadow */}
      <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
      <rect x={x + 18} y={y + 26} width={w} height={h} rx={14} fill="#000" opacity={0.7} filter="url(#cn-dof-2)" />
      <rect x={x} y={y} width={w} height={h} rx={14} fill="#3a2a1e" />
      {/* grain */}
      {Array.from({ length: 26 }, (_, i) => {
        const gy = y + 12 + (i / 26) * (h - 24) + r() * 8
        return <path key={i} d={`M${x + 10} ${gy} Q ${x + w * 0.3} ${gy + (r() - 0.5) * 14} ${x + w * 0.6} ${gy + (r() - 0.5) * 10} T ${x + w - 10} ${gy + (r() - 0.5) * 8}`} stroke="#2a1d14" strokeWidth={1 + r() * 2.5} fill="none" opacity={0.7} />
      })}
      <rect x={x} y={y} width={w} height={h} rx={14} fill="none" stroke="#5a412c" strokeWidth={6} />
      <Pool x={lampX ?? x + w * 0.55} y={lampY ?? y + h * 0.4} r={Math.max(w, h) * 0.62} color="key" opacity={0.75} />
      <rect x={x} y={y} width={w} height={h} rx={14} fill="url(#cn-pool-dark)" opacity={0.2} />
    </g>
  )
}

/** A mug seen from above. */
export function TopCup({ x = 0, y = 0, s = 1, rot = 0, color = '#d9d2c3', className }: { x?: number; y?: number; s?: number; rot?: number; color?: string; className?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse cx={8} cy={10} rx={34} ry={34} fill="#000" opacity={0.45} filter="url(#cn-dof-1)" />
      <path d="M26 -10 q 26 0 26 12 q 0 12 -26 12" fill="none" stroke={color} strokeWidth={8} />
      <circle r={30} fill={color} />
      <circle r={24} fill="#3b2416" />
      <circle r={24} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={4} />
      <ellipse cx={-8} cy={-8} rx={9} ry={5} fill="#8a5a3a" opacity={0.5} />
      <path d="M-22 -14 A 26 26 0 0 1 4 -28" stroke={C.white} strokeOpacity={0.6} strokeWidth={3} fill="none" />
    </g>
  )
}

/** A vase of flowers seen from above. */
export function TopVase({ x = 0, y = 0, s = 1, className }: { x?: number; y?: number; s?: number; className?: string }) {
  const petals = (cx: number, cy: number, c: string, rr: number) => (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-rr} rx={rr * 0.55} ry={rr} fill={c} transform={`rotate(${a})`} />
      ))}
      <circle r={rr * 0.5} fill={C.gold} />
    </g>
  )
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={12} cy={16} r={62} fill="#000" opacity={0.5} filter="url(#cn-dof-2)" />
      <circle r={56} fill="#2d5d73" />
      <circle r={56} fill="none" stroke="#7fb8cf" strokeWidth={4} opacity={0.6} />
      <circle r={40} fill="#173847" />
      {/* leaves and flowers spilling over */}
      {[20, 95, 160, 230, 300].map((a, i) => (
        <ellipse key={a} cx={0} cy={-44} rx={10} ry={30} fill={i % 2 ? '#3f7a3a' : '#2f6b33'} transform={`rotate(${a})`} />
      ))}
      {petals(-14, -10, '#e86a6a', 14)}
      {petals(20, 8, '#f2e3c4', 12)}
      {petals(-4, 26, '#e86a6a', 11)}
      {petals(24, -26, '#c86ad8', 10)}
      <path d="M-40 -30 A 56 56 0 0 1 10 -54" stroke={C.white} strokeOpacity={0.5} strokeWidth={3} fill="none" />
    </g>
  )
}

/** A two-finger gripper seen from above, pointing along +x (rotate it to face its heading). */
export function TopGripper({ color = C.shell, accent = C.cyan, open = 1, className, glow }: { color?: string; accent?: string; open?: number; className?: string; glow?: string }) {
  const g = 10 + open * 10
  return (
    <g className={className}>
      {glow && <circle r={46} fill={glow} opacity={0.18} />}
      <ellipse cx={4} cy={8} rx={34} ry={26} fill="#000" opacity={0.45} filter="url(#cn-dof-1)" />
      {/* the wrist and arm going back */}
      <rect x={-70} y={-11} width={60} height={22} rx={8} fill={C.shellDark} />
      <rect x={-22} y={-24} width={30} height={48} rx={10} fill={color} />
      <rect x={-18} y={-20} width={6} height={40} rx={3} fill={C.white} opacity={0.5} />
      {/* fingers */}
      <rect x={4} y={-g - 8} width={30} height={8} rx={3} fill={C.carbon} />
      <rect x={4} y={g} width={30} height={8} rx={3} fill={C.carbon} />
      <circle cx={-6} cy={0} r={5} fill={accent} />
    </g>
  )
}

/** Tabletop clutter for the obstacle course. */
export function TopThing({ kind, x, y, rot = 0, s = 1, className }: { kind: 'book' | 'bottle' | 'plant' | 'box' | 'jar' | 'tape'; x: number; y: number; rot?: number; s?: number; className?: string }) {
  const body = (() => {
    switch (kind) {
      case 'book':
        return (
          <>
            <rect x={-34} y={-24} width={68} height={48} rx={3} fill="#7a3b3b" />
            <rect x={-34} y={-24} width={10} height={48} fill="#5a2828" />
            <rect x={-18} y={-10} width={36} height={4} fill={C.goldLight} opacity={0.6} />
          </>
        )
      case 'bottle':
        return (
          <>
            <circle r={24} fill="#2f6d5a" />
            <circle r={24} fill="none" stroke="#7fd1b3" strokeWidth={3} opacity={0.5} />
            <circle r={10} fill="#1d2b33" />
          </>
        )
      case 'plant':
        return (
          <>
            <circle r={24} fill="#6b4a33" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx={0} cy={-20} rx={9} ry={20} fill={a % 120 ? '#3f7a3a' : '#2f6b33'} transform={`rotate(${a})`} />
            ))}
          </>
        )
      case 'box':
        return (
          <>
            <rect x={-28} y={-28} width={56} height={56} rx={3} fill="#a07b4f" />
            <path d="M-28 0 H28" stroke="#d8c39a" strokeWidth={6} opacity={0.7} />
          </>
        )
      case 'jar':
        return (
          <>
            <circle r={20} fill="#c9a64a" opacity={0.85} />
            <circle r={16} fill="#8a5a1a" />
          </>
        )
      case 'tape':
        return (
          <>
            <circle r={20} fill="#b8b8b8" />
            <circle r={10} fill="#3a2a1e" />
          </>
        )
    }
  })()
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse cx={8} cy={10} rx={32} ry={28} fill="#000" opacity={0.45} filter="url(#cn-dof-1)" />
      {body}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Screens                                                              */
/* ------------------------------------------------------------------ */

/** A monitor bezel with a glowing screen; children are drawn on the screen (screen coordinates = stage). */
export function Monitor({ x, y, w, h, children, className }: { x: number; y: number; w: number; h: number; children?: ReactNode; className?: string }) {
  return (
    <g className={className}>
      <rect x={x - 40} y={y - 40} width={w + 80} height={h + 80} fill={C.cyan} opacity={0.05} filter="url(#cn-dof-3)" />
      <rect x={x - 18} y={y - 18} width={w + 36} height={h + 36} rx={14} fill="#07090f" stroke={C.ink3} strokeWidth={2} />
      <rect x={x} y={y} width={w} height={h} fill="#08111c" />
      <g className="hd-flicker">{children}</g>
      <rect x={x} y={y} width={w} height={h} fill="url(#cn-pool-rim)" opacity={0.08} pointerEvents="none" />
      <path d={`M${x} ${y} L${x + w * 0.4} ${y} L${x} ${y + h * 0.5} Z`} fill={C.white} opacity={0.025} pointerEvents="none" />
      <rect x={x + w / 2 - 50} y={y + h + 18} width={100} height={60} fill="#07090f" />
      <rect x={x + w / 2 - 140} y={y + h + 74} width={280} height={14} rx={6} fill="#07090f" />
    </g>
  )
}

/** A tiny camera frame thumbnail of a tabletop (for training pairs). */
export function Thumb({ x, y, w = 96, h = 64, seed = 1 }: { x: number; y: number; w?: number; h?: number; seed?: number }) {
  const r = rng(seed)
  const cx = x + w * (0.3 + r() * 0.4)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#2a1f17" />
      <rect x={x} y={y + h * 0.62} width={w} height={h * 0.38} fill="#3d2c1f" />
      <ellipse cx={cx} cy={y + h * 0.6} rx={w * 0.09} ry={h * 0.14} fill="#d9d2c3" />
      <rect x={x + w * (0.1 + r() * 0.5)} y={y + h * 0.2} width={w * 0.22} height={h * 0.16} rx={3} fill={C.shellMid} />
      <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={C.slate} strokeWidth={1.5} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Kitchens                                                             */
/* ------------------------------------------------------------------ */

const WALLS = ['#3b4a5e', '#5a4636', '#3d5a4a', '#5b3e4e', '#4a4a5e', '#5e5236', '#36505e', '#4e3b36']
const UNITS = ['#d7d2c5', '#7b8fa6', '#a3714f', '#2f3b4c', '#c2b280', '#6f8f72', '#b46b5a', '#e6e1d6']

/** A little kitchen, drawn in a w x h box at (x, y); the seed varies colours and layout. */
export function MiniKitchen({ x, y, w = 120, h = 90, seed = 1, className, children }: { x: number; y: number; w?: number; h?: number; seed?: number; className?: string; children?: ReactNode }) {
  const r = rng(seed * 13 + 5)
  const wall = WALLS[Math.floor(r() * WALLS.length)]
  const unit = UNITS[Math.floor(r() * UNITS.length)]
  const winX = x + w * (0.15 + r() * 0.45)
  const counterY = y + h * 0.62
  const hasHob = r() > 0.4
  return (
    <g className={className}>
      <rect x={x} y={y} width={w} height={h} fill={wall} />
      <rect x={winX} y={y + h * 0.12} width={w * 0.28} height={h * 0.3} fill="#0d1b2c" stroke={C.ink2} strokeWidth={2} />
      <circle cx={winX + w * 0.2} cy={y + h * 0.2} r={w * 0.025} fill={C.keyLight} opacity={0.8} />
      {/* upper cabinets */}
      <rect x={x + (winX > x + w * 0.4 ? w * 0.05 : w * 0.6)} y={y + h * 0.08} width={w * 0.32} height={h * 0.24} fill={unit} opacity={0.9} />
      {/* counter and lower units */}
      <rect x={x} y={counterY} width={w} height={h * 0.05} fill={C.ink4} />
      <rect x={x} y={counterY + h * 0.05} width={w} height={h * 0.33} fill={unit} />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={x + w * f} x2={x + w * f} y1={counterY + h * 0.07} y2={y + h - 2} stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.5} />
      ))}
      {hasHob && <rect x={x + w * 0.62} y={counterY - h * 0.02} width={w * 0.22} height={h * 0.03} fill={C.ink} />}
      <rect x={x + w * (0.12 + r() * 0.3)} y={counterY - h * 0.12} width={w * 0.07} height={h * 0.12} rx={2} fill={r() > 0.5 ? '#d9d2c3' : '#e8b44a'} />
      {children}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={C.ink} strokeWidth={3} />
    </g>
  )
}

/** A small stack of demo tiles (lime), `n` tall. */
export function DemoStack({ x, y, n, size = 8, gap = 2, cols = 1, className }: { x: number; y: number; n: number; size?: number; gap?: number; cols?: number; className?: string }) {
  return (
    <g className={className}>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x + (i % cols) * (size + gap)} y={y - Math.floor(i / cols) * (size + gap) - size} width={size} height={size} rx={1.5} fill={C.lime} opacity={0.55 + ((i * 37) % 10) / 25} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Little chart pieces                                                  */
/* ------------------------------------------------------------------ */

export function Axis({ x, y, w, h, xLabel, yLabel, color = C.fog }: { x: number; y: number; w: number; h: number; xLabel?: string; yLabel?: string; color?: string }) {
  return (
    <g pointerEvents="none">
      <path d={`M${x} ${y} V${y + h} H${x + w}`} fill="none" stroke={color} strokeWidth={2} />
      {xLabel && (
        <text x={x + w} y={y + h + 26} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={17}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={x - 10} y={y - 12} fill={C.mist} fontFamily={SANS} fontSize={17}>
          {yLabel}
        </text>
      )}
    </g>
  )
}

/** A small mono caption. */
export function Tag({ x, y, children, color = C.mist, size = 18, anchor = 'start', className }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; className?: string }) {
  return (
    <text className={className} x={x} y={y} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} pointerEvents="none" style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4} strokeOpacity={0.6}>
      {children}
    </text>
  )
}
