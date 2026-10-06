/*
 * Pieces for film 5 (the wall): the night factory, its machines, the parts they make, price
 * tags, gears, and a counter helper for MONO readouts that a timeline can scrub.
 */
import type { ReactNode } from 'react'
import { rng } from '../../../art2/fx'
import { C, MONO, SANS } from '../../../cine/palette'
import { Beam, Dust, Pool } from '../shared/kit'

/* ------------------------------------------------------------------ */
/* Timeline helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Tween a number shown as text (a clock, a counter, a price). A fromTo on a proxy, so seeking
 * back redraws the earlier value. `sel` is found inside `scope` at build time.
 */
export function count(tl: gsap.core.Timeline, scope: Element | null, sel: string, from: number, to: number, at: gsap.Position, dur: number, fmt: (v: number) => string, ease = 'none') {
  const els = scope ? [...scope.querySelectorAll(sel)] : []
  if (!els.length) return
  const o = { v: from }
  tl.fromTo(o, { v: from }, {
    v: to,
    duration: dur,
    ease,
    immediateRender: false,
    onUpdate: () => {
      const t = fmt(o.v)
      for (const el of els) el.textContent = t
    },
  }, at)
}

export const money = (v: number) => '$' + Math.round(v).toLocaleString('en-US')
export const moneyK = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M` : v >= 1e4 ? `$${Math.round(v / 1000)}k` : money(v))

/* ------------------------------------------------------------------ */
/* Shapes                                                               */
/* ------------------------------------------------------------------ */

/** A spur gear outline centred on 0,0. */
export function gearPath(r: number, teeth: number, depth = r * 0.18, hole = r * 0.3) {
  const pts: string[] = []
  const n = teeth * 4
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = i % 4
    const rr = k === 0 || k === 1 ? r : r - depth
    pts.push(`${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`)
  }
  const h = hole
  return `M${pts.join(' L')} Z M${h} 0 A${h} ${h} 0 1 0 ${-h} 0 A${h} ${h} 0 1 0 ${h} 0 Z`
}

/** A gear, drawn shiny (metal) or dull (the oversized "green" part before sintering). */
export function Gear({ x = 0, y = 0, r = 40, teeth = 14, fill = 'url(#cn-metal)', stroke = C.metalDark, className, opacity = 1 }: { x?: number; y?: number; r?: number; teeth?: number; fill?: string; stroke?: string; className?: string; opacity?: number }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`} opacity={opacity}>
      <path d={gearPath(r, teeth)} fill={fill} fillRule="evenodd" stroke={stroke} strokeWidth={1.5} />
      <circle r={r * 0.55} fill="none" stroke={stroke} strokeWidth={1.2} opacity={0.6} />
    </g>
  )
}

/** A finger segment shell seen from the side: a rounded body with a joint boss at each end. Centred on 0,0, about 200 x 64 at s=1. */
export const FINGER_SHELL = 'M-100 -18 Q-100 -32 -84 -32 L70 -26 Q100 -24 100 0 Q100 24 70 26 L-84 32 Q-100 32 -100 18 Z'
export function FingerShell({ x = 0, y = 0, s = 1, rot = 0, fill = 'url(#cn-shell)', stroke = C.shellDark, className, holes = true }: { x?: number; y?: number; s?: number; rot?: number; fill?: string; stroke?: string; className?: string; holes?: boolean }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d={FINGER_SHELL} fill={fill} stroke={stroke} strokeWidth={2 / s} />
      <path d="M-80 -20 L60 -15" stroke={C.white} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
      {holes && (
        <>
          <circle cx={-76} cy={0} r={11} fill={C.ink2} stroke={stroke} strokeWidth={2} />
          <circle cx={74} cy={0} r={9} fill={C.ink2} stroke={stroke} strokeWidth={2} />
        </>
      )}
    </g>
  )
}

/** A small hanging price tag on a string. (x, y) is where the string is tied. */
export function PriceTag({ x, y, text, color = C.gold, size = 30, len = 46, className, textClass, rot = 0 }: { x: number; y: number; text: ReactNode; color?: string; size?: number; len?: number; className?: string; textClass?: string; rot?: number }) {
  const w = Math.max(80, (String(text).length + 1) * size * 0.62)
  const h = size * 1.5
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 L0 ${len}`} stroke={color} strokeWidth={1.6} opacity={0.8} />
      <g transform={`translate(0 ${len})`}>
        <path d={`M${-w / 2 + 12} 0 L${w / 2 - 12} 0 L${w / 2} 12 L${w / 2} ${h} L${-w / 2} ${h} L${-w / 2} 12 Z`} fill={C.ink1} stroke={color} strokeWidth={2.5} />
        <circle cx={0} cy={9} r={4} fill="none" stroke={color} strokeWidth={2} />
        <text className={textClass} x={0} y={h * 0.5 + size * 0.5 + 4} textAnchor="middle" fill={color} fontFamily={MONO} fontSize={size} fontWeight={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {text}
        </text>
      </g>
    </g>
  )
}

/** A steel mould block with a finger-shaped cavity, seen at a slight angle. Centred on 0,0, about 340 x 220. */
export function MouldBlock({ x = 0, y = 0, s = 1, className, glowClass }: { x?: number; y?: number; s?: number; className?: string; glowClass?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={118} rx={200} ry={18} fill="#000" opacity={0.6} filter="url(#cn-dof-1)" />
      {/* top face */}
      <path d="M-170 -70 L-110 -110 L190 -110 L130 -70 Z" fill="#b8c2d0" />
      {/* the cavity in the top face */}
      <g transform="translate(10 -90) scale(0.62 0.16)">
        <path d={FINGER_SHELL} fill={C.ink2} stroke={C.metalDark} strokeWidth={6} />
      </g>
      {glowClass && (
        <g className={glowClass} opacity={0}>
          <g transform="translate(10 -90) scale(0.62 0.16)">
            <path d={FINGER_SHELL} fill={C.keyLight} filter="url(#cn-bloom)" />
          </g>
        </g>
      )}
      {/* front and side */}
      <rect x={-170} y={-70} width={300} height={180} fill="url(#cn-metal)" />
      <path d="M130 -70 L190 -110 L190 70 L130 110 Z" fill={C.metalDark} />
      {/* guide pins, bolts, the parting line */}
      {[-140, 100].map((bx) => (
        <circle key={bx} cx={bx} cy={-40} r={9} fill={C.metalDark} stroke="#dfe6ef" strokeWidth={1.5} />
      ))}
      {[-140, -60, 20, 100].map((bx) => (
        <circle key={bx} cx={bx} cy={80} r={6} fill={C.ink3} />
      ))}
      <line x1={-170} x2={130} y1={20} y2={20} stroke={C.ink2} strokeWidth={2} />
      <path d="M-160 -60 L120 -60" stroke={C.white} strokeWidth={3} opacity={0.5} />
      <rect x={-170} y={-70} width={300} height={180} fill="none" stroke={C.ink3} strokeWidth={2} />
    </g>
  )
}

/** A tiny robot (for a fleet): head, body and arms in one shape. `on` colours it lit; the class lets a scene dim it. */
export function MiniBot({ x, y, s = 1, className, color = C.shell }: { x: number; y: number; s?: number; className?: string; color?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-9} y={-44} width={18} height={14} rx={5} fill={color} />
      <rect x={-6} y={-40} width={12} height={4} rx={2} fill={C.cyan} />
      <rect x={-12} y={-28} width={24} height={26} rx={6} fill={color} />
      <rect x={-17} y={-26} width={5} height={20} rx={2.5} fill={color} opacity={0.8} />
      <rect x={12} y={-26} width={5} height={20} rx={2.5} fill={color} opacity={0.8} />
      <rect x={-10} y={-2} width={7} height={18} rx={3} fill={color} opacity={0.85} />
      <rect x={3} y={-2} width={7} height={18} rx={3} fill={color} opacity={0.85} />
    </g>
  )
}

/** A flat, graphic robot hand (palm plus four fingers and a thumb), fingers up. Each finger is its own group so a scene can pop one out. */
export function FlatHand({ x = 0, y = 0, s = 1, prefix, fill = 'url(#cn-shell)' }: { x?: number; y?: number; s?: number; prefix: string; fill?: string }) {
  const fingers = [-66, -22, 22, 66]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* the thumb */}
      <g transform="translate(-100 40) rotate(-38)">
        <rect x={-20} y={-120} width={40} height={120} rx={20} fill={fill} stroke={C.shellDark} strokeWidth={2} />
        <line x1={-20} x2={20} y1={-62} y2={-62} stroke={C.carbon} strokeWidth={4} />
      </g>
      {/* the palm */}
      <path d="M-96 -10 Q-96 -30 -76 -30 L76 -30 Q96 -30 96 -10 L90 120 Q86 150 56 150 L-56 150 Q-86 150 -90 120 Z" fill={fill} stroke={C.shellDark} strokeWidth={2} />
      <path d="M-70 0 L70 0" stroke={C.shellMid} strokeWidth={3} />
      <rect x={-60} y={150} width={120} height={60} fill={C.carbon} />
      {fingers.map((fx, i) => (
        <g key={i} className={`${prefix}-finger ${prefix}-finger-${i}`}>
          <g className={`${prefix}-fingerbody-${i}`}>
            <rect x={fx - 19} y={-218} width={38} height={196} rx={19} fill={fill} stroke={C.shellDark} strokeWidth={2} />
            {[-160, -96].map((jy) => (
              <line key={jy} x1={fx - 19} x2={fx + 19} y1={jy} y2={jy} stroke={C.carbon} strokeWidth={4} />
            ))}
            <rect x={fx - 13} y={-212} width={8} height={170} rx={4} fill={C.white} opacity={0.45} />
          </g>
        </g>
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The factory at night                                                 */
/* ------------------------------------------------------------------ */

/** The far wall and roof of a factory hall: trusses, high windows, hanging sodium lamps and haze. */
export function FactoryBack({ seed = 3 }: { seed?: number }) {
  const r = rng(seed)
  return (
    <g pointerEvents="none">
      <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
      <rect x={-800} y={-600} width={3200} height={1100} fill="url(#cn-wall)" />
      {/* high windows: a faint blue night */}
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i}>
          <rect x={-500 + i * 230} y={30} width={170} height={110} fill={C.rimDeep} opacity={0.12} />
          <rect x={-500 + i * 230 + 82} y={30} width={6} height={110} fill={C.ink} />
          <rect x={-500 + i * 230} y={82} width={170} height={5} fill={C.ink} />
        </g>
      ))}
      {/* roof trusses */}
      <g stroke={C.ink3} strokeWidth={6} fill="none" opacity={0.9}>
        <path d="M-800 170 H2400" />
        <path d="M-800 0 H2400" />
        {Array.from({ length: 26 }, (_, i) => (
          <path key={i} d={`M${-800 + i * 130} 170 L${-735 + i * 130} 0 L${-670 + i * 130} 170`} />
        ))}
      </g>
      {/* hanging lamps and their cones */}
      {[-200, 260, 800, 1340, 1800].map((lx, i) => (
        <g key={lx} className={i % 2 ? 'hd-flicker' : undefined}>
          <line x1={lx} x2={lx} y1={170} y2={250} stroke={C.ink3} strokeWidth={3} />
          <path d={`M${lx - 34} 270 L${lx + 34} 270 L${lx + 20} 250 L${lx - 20} 250 Z`} fill={C.ink3} />
          <ellipse cx={lx} cy={271} rx={30} ry={5} fill={C.keyLight} />
          <Beam x={lx} y={270} w1={60} w2={520} len={560} opacity={0.18} />
        </g>
      ))}
      {/* haze */}
      <Pool x={800} y={420} r={900} color="key" opacity={0.18} />
      <Pool x={200} y={300} r={500} color="rim" opacity={0.12} />
      {/* far machines, soft */}
      <g filter="url(#cn-dof-2)">
        {Array.from({ length: 16 }, (_, i) => {
          const w = 70 + r() * 80
          const h = 90 + r() * 90
          const x = -400 + i * 170 + r() * 40
          return (
            <g key={i}>
              <rect x={x} y={560 - h} width={w} height={h + 40} fill={C.ink2} />
              <rect x={x + 10} y={560 - h + 14} width={14} height={8} fill={r() > 0.5 ? C.lime : C.key} opacity={0.5} />
            </g>
          )
        })}
      </g>
    </g>
  )
}

/**
 * Two long rows of dark machines receding to a vanishing point, with status lights that blink.
 * Returns the near machines biggest. `skip` leaves one slot empty (for a hero machine drawn by the scene).
 */
export function FactoryRows({ vx = 800, vy = 470, seed = 8, skip }: { vx?: number; vy?: number; seed?: number; skip?: [number, number] }) {
  const r = rng(seed)
  const rows: ReactNode[] = []
  for (const side of [-1, 1]) {
    for (let k = 7; k >= 0; k--) {
      if (skip && skip[0] === side && skip[1] === k) continue
      // depth: k = 0 nearest
      const z = Math.pow(0.72, k)
      const cx = vx + side * (240 + 380 * z) * 1
      const base = vy + 330 * z
      const w = 300 * z
      const h = 230 * z
      const lit = r() > 0.6
      rows.push(
        <g key={`${side}-${k}`} opacity={0.45 + 0.55 * z}>
          <ellipse cx={cx} cy={base + 4} rx={w * 0.6} ry={10 * z} fill="#000" opacity={0.5} />
          <rect x={cx - w / 2} y={base - h} width={w} height={h} fill={C.ink2} />
          <rect x={cx - w / 2} y={base - h} width={w} height={6 * z + 1} fill={C.ink4} />
          <rect x={cx - w / 2 + w * 0.12} y={base - h * 0.78} width={w * 0.46} height={h * 0.36} fill={C.ink} stroke={C.ink4} strokeWidth={2 * z} />
          <rect x={cx + w * 0.2} y={base - h * 0.74} width={w * 0.14} height={h * 0.1} fill={C.ink3} />
          <circle className="hd-blink" style={{ animationDelay: `${-r() * 2}s`, animationDuration: `${1.2 + r() * 2}s` }} cx={cx + w * 0.38} cy={base - h * 0.85} r={4 * z + 1} fill={lit ? C.lime : C.key} />
          {lit && <rect x={cx - w / 2 + w * 0.12} y={base - h * 0.78} width={w * 0.46} height={h * 0.36} fill={C.key} opacity={0.08} />}
        </g>,
      )
    }
  }
  return <g pointerEvents="none">{rows}</g>
}

/** The factory floor: dark polished concrete, gold safety lines running to the vanishing point. */
export function FactoryFloor({ vx = 800, vy = 470, y = 560 }: { vx?: number; vy?: number; y?: number }) {
  return (
    <g pointerEvents="none">
      <rect x={-800} y={y} width={3200} height={900} fill="url(#cn-floor)" />
      {[-1, 1].map((s) => (
        <path key={s} d={`M${vx + s * 60} ${y} L${vx + s * 600} ${y + 600}`} stroke={C.gold} strokeWidth={6} opacity={0.35} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${vx - 20 - i * 10} ${y + 20 + i * i * 40} h${40 + i * 20}`} stroke={C.gold} strokeWidth={3 + i} opacity={0.18} />
      ))}
      <ellipse cx={vx} cy={y + 160} rx={700} ry={90} fill={C.key} opacity={0.05} filter="url(#cn-dof-2)" />
      <Dust x={-200} y={y - 400} w={2000} h={500} count={30} seed={vy} color={C.keyLight} size={0.7} />
    </g>
  )
}

/** A CNC machine seen from outside: a box with a lit window, the spindle inside, coolant mist. */
export function CNCBox({ x, y, s = 1, glowClass }: { x: number; y: number; s?: number; glowClass?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <g className={glowClass}>
        <Pool x={0} y={-120} r={360} color="key" opacity={0.9} />
      </g>
      <ellipse cx={0} cy={6} rx={200} ry={14} fill="#000" opacity={0.6} />
      <rect x={-170} y={-260} width={340} height={260} fill={C.ink3} />
      <rect x={-170} y={-260} width={340} height={8} fill={C.slate} />
      {/* the window: warm light, the spindle, mist */}
      <rect x={-130} y={-220} width={190} height={150} fill={C.keyDeep} opacity={0.5} />
      <rect x={-130} y={-220} width={190} height={150} fill="url(#cn-pool-key)" />
      <rect x={-48} y={-220} width={24} height={70} fill={C.metalDark} />
      <rect x={-42} y={-150} width={12} height={34} fill={C.metal} />
      <rect x={-100} y={-100} width={130} height={22} fill={C.metal} />
      <g opacity={0.7}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} className="hd-drift" style={{ animationDelay: `${-i * 1.3}s` }} cx={-60 + i * 14} cy={-120 + (i % 3) * 8} r={6 + (i % 3) * 3} fill={C.paper} opacity={0.18} />
        ))}
      </g>
      <rect x={-130} y={-220} width={190} height={150} fill="none" stroke={C.ink1} strokeWidth={6} />
      {/* control panel */}
      <rect x={80} y={-220} width={70} height={110} fill={C.ink1} />
      <rect x={88} y={-210} width={54} height={36} fill={C.lime} opacity={0.35} className="hd-flicker" />
      <circle cx={100} cy={-150} r={6} fill={C.danger} />
      <circle cx={124} cy={-150} r={6} fill={C.lime} className="hd-blink" />
      <rect x={-170} y={-40} width={340} height={40} fill={C.ink2} />
    </g>
  )
}

/** CSS loops for this film (they pause with the film like the shared ones). */
export function FactoryCSS() {
  return (
    <style>{`
.f5-chip { animation: f5-chip 0.7s linear infinite; }
@keyframes f5-chip {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(260deg); opacity: 0; }
}
.f5-spin { transform-box: fill-box; transform-origin: center; animation: f5-spin 0.25s linear infinite; }
@keyframes f5-spin { from { transform: translateX(0); } to { transform: translateX(-16px); } }
.f5-turn { transform-box: fill-box; transform-origin: center; animation: f5-turn 8s linear infinite; }
@keyframes f5-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.f5-heat { animation: f5-heat 1.8s ease-in-out infinite alternate; }
@keyframes f5-heat { from { opacity: 0.55; } to { opacity: 1; } }
.f5-rise { animation: f5-rise 3.4s linear infinite; }
@keyframes f5-rise { 0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: 0.6; } 100% { transform: translate(-12px, -120px); opacity: 0; } }
.flow-paused .f5-chip, .flow-paused .f5-spin, .flow-paused .f5-turn, .flow-paused .f5-heat, .flow-paused .f5-rise { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .f5-chip, .f5-spin, .f5-turn, .f5-heat, .f5-rise { animation: none; } }
`}</style>
  )
}

/** A label-less caption in the corner, in MONO, for "source" notes on the picture. */
export function SourceNote({ x, y, children, className, anchor = 'start', color = C.mist }: { x: number; y: number; children: ReactNode; className?: string; anchor?: 'start' | 'middle' | 'end'; color?: string }) {
  return (
    <text className={className} x={x} y={y} fill={color} opacity={0} fontFamily={SANS} fontSize={20} fontStyle="italic" textAnchor={anchor} pointerEvents="none">
      {children}
    </text>
  )
}
