/*
 * Shared pieces for the robot hands films: on-picture labels, letterbox bars, drifting dust,
 * the five-question map every film flies back to, an egg, a lamp, a blueprint backdrop,
 * ambient loops that pause with the film, and small play controls (slider, chip, readout).
 *
 * Scenes still draw their own sets; these are the bits every film repeats, so the course
 * looks like one film.
 */
import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { rng } from '../../../art2/fx'
import { useDrag } from '../../../engine/svg'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'

/* ------------------------------------------------------------------ */
/* Text on the picture                                                  */
/* ------------------------------------------------------------------ */

/**
 * A short label sitting on the picture with a thin leader line from the thing it names
 * (x, y) to the text (tx, ty). No box. Starts hidden when `hidden` is set, so a timeline
 * can fade it in by class.
 */
export function Label({ x, y, tx, ty, text, sub, color = C.fog, size = 26, anchor, className, hidden = true, dot = true }: {
  x: number
  y: number
  tx: number
  ty: number
  text: ReactNode
  sub?: ReactNode
  color?: string
  size?: number
  anchor?: 'start' | 'middle' | 'end'
  className?: string
  hidden?: boolean
  dot?: boolean
}) {
  const a = anchor ?? (tx >= x ? 'start' : 'end')
  const pad = a === 'start' ? 8 : a === 'end' ? -8 : 0
  return (
    <g className={className} opacity={hidden ? 0 : 1} pointerEvents="none">
      {(tx !== x || ty !== y) && <path d={`M${x} ${y} L${tx} ${ty}`} stroke={color} strokeWidth={1.6} opacity={0.7} fill="none" />}
      {dot && <circle cx={x} cy={y} r={4} fill={color} />}
      <text x={tx + pad} y={ty + size * 0.35} fill={color} fontFamily={SANS} fontSize={size} fontWeight={500} textAnchor={a} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={5} strokeOpacity={0.55}>
        {text}
      </text>
      {sub && (
        <text x={tx + pad} y={ty + size * 0.35 + size * 1.05} fill={color} opacity={0.7} fontFamily={MONO} fontSize={size * 0.68} textAnchor={a} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={4} strokeOpacity={0.5}>
          {sub}
        </text>
      )}
    </g>
  )
}

/** A big serif title line, centred, for title cards and key numbers. */
export function Big({ x = 800, y = 450, size = 120, color = C.paper, children, className, hidden = true, italic = false }: { x?: number; y?: number; size?: number; color?: string; children: ReactNode; className?: string; hidden?: boolean; italic?: boolean }) {
  return (
    <text className={className} x={x} y={y} opacity={hidden ? 0 : 1} fill={color} fontFamily={SERIF} fontSize={size} fontWeight={600} fontStyle={italic ? 'italic' : undefined} textAnchor="middle" letterSpacing={-1} pointerEvents="none">
      {children}
    </text>
  )
}

/** A data readout in mono, e.g. a counter or a measured value. */
export function Readout({ x, y, children, color = C.lime, size = 28, anchor = 'start', className, hidden = false }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; className?: string; hidden?: boolean }) {
  return (
    <text className={className} x={x} y={y} opacity={hidden ? 0 : 1} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} pointerEvents="none" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </text>
  )
}

/* ------------------------------------------------------------------ */
/* Film grammar                                                         */
/* ------------------------------------------------------------------ */

/** Black bars for dramatic beats. Slide them in with `letterbox(tl, '.lb', true, at)`. */
export function Letterbox({ className = 'lb', h = 96 }: { className?: string; h?: number }) {
  return (
    <g className={className} pointerEvents="none">
      <rect className={`${className}-t`} x={-50} y={-h} width={1700} height={h} fill="#000" />
      <rect className={`${className}-b`} x={-50} y={900} width={1700} height={h} fill="#000" />
    </g>
  )
}

export function letterbox(tl: gsap.core.Timeline, scope: string, on: boolean, at: gsap.Position, h = 96, dur = 1.2) {
  tl.fromTo(`${scope}-t`, { y: on ? 0 : h }, { y: on ? h : 0, duration: dur, ease: 'power2.inOut', immediateRender: false }, at)
  tl.fromTo(`${scope}-b`, { y: on ? 0 : -h }, { y: on ? -h : 0, duration: dur, ease: 'power2.inOut', immediateRender: false }, at)
}

/** Fade a set of elements in (or out) with a fromTo, so seeking back redraws. */
export function fade(tl: gsap.core.Timeline, target: gsap.TweenTarget, to: number, at: gsap.Position, dur = 0.6, from?: number) {
  tl.fromTo(target, { opacity: from ?? (to > 0 ? 0 : 1) }, { opacity: to, duration: dur, ease: 'power1.inOut', immediateRender: false }, at)
}

/** Dust in the air or in a light beam: small motes drifting on a CSS loop (keeps moving while George talks). */
export function Dust({ x = 0, y = 0, w = 1600, h = 900, count = 30, seed = 5, color = C.keyLight, size = 1 }: { x?: number; y?: number; w?: number; h?: number; count?: number; seed?: number; color?: string; size?: number }) {
  const r = rng(seed)
  return (
    <g pointerEvents="none" transform={`translate(${x} ${y})`}>
      {Array.from({ length: count }, (_, i) => {
        const s = (0.8 + r() * 2.2) * size
        return (
          <g key={i} transform={`translate(${r() * w} ${r() * h})`}>
            <g className="mote" style={{ animationDelay: `${-r() * 14}s`, animationDuration: `${12 + r() * 12}s` }}>
              <circle r={s * 2.6} fill={color} opacity={0.1} />
              <circle r={s} fill={color} opacity={0.65} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** A cone of light from a point (a lamp, a window) with soft edges. */
export function Beam({ x, y, w1 = 30, w2 = 520, len = 700, angle = 0, fill = 'url(#cn-beam-key)', opacity = 0.55, className }: { x: number; y: number; w1?: number; w2?: number; len?: number; angle?: number; fill?: string; opacity?: number; className?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${angle})`} pointerEvents="none" style={{ mixBlendMode: 'screen' }}>
      <path d={`M${-w1 / 2} 0 L${w1 / 2} 0 L${w2 / 2} ${len} L${-w2 / 2} ${len} Z`} fill={fill} opacity={opacity} filter="url(#cn-dof-2)" />
    </g>
  )
}

/** A soft round pool of coloured light. */
export function Pool({ x, y, r = 300, color = 'key', opacity = 1, className }: { x: number; y: number; r?: number; color?: 'key' | 'rim' | 'amber' | 'cyan' | 'magenta' | 'lime' | 'gold' | 'danger' | 'paper' | 'dark'; opacity?: number; className?: string }) {
  return <circle className={className} cx={x} cy={y} r={r} fill={`url(#cn-pool-${color})`} opacity={opacity} pointerEvents="none" />
}

/** A dark blueprint space: deep ink with a faint grid, for diagrams that grow out of real things. */
export function Blueprint({ className, opacity = 1 }: { className?: string; opacity?: number }) {
  return (
    <g className={className} opacity={opacity} pointerEvents="none">
      <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
      <rect x={-800} y={-600} width={3200} height={2100} fill="url(#cn-grid)" opacity={0.5} />
      <rect x={-800} y={-600} width={3200} height={2100} fill="url(#cn-grid-big)" opacity={0.8} />
      <circle cx={800} cy={450} r={900} fill="url(#cn-pool-rim)" opacity={0.25} />
    </g>
  )
}

/** Edge darkening; put it last, above the world, under the UI. */
export function Vignette({ strength = 1 }: { strength?: number }) {
  return <rect x={0} y={0} width={1600} height={900} fill="url(#cn-vignette)" opacity={strength} pointerEvents="none" />
}

/* ------------------------------------------------------------------ */
/* Ambient motion                                                       */
/* ------------------------------------------------------------------ */

/**
 * Loops that keep the world alive (a breathing figure, a flickering screen, rain) and that
 * hold still when the film is paused. `setup` runs once inside a GSAP context scoped to
 * `root`; return nothing, just create repeating tweens (repeat: -1).
 */
export function useAmbient(root: RefObject<Element | null>, playing: boolean, setup: () => void) {
  const ctx = useRef<gsap.Context | null>(null)
  const tweens = useRef<gsap.core.Animation[]>([])
  useLayoutEffect(() => {
    const c = gsap.context(() => setup(), root.current ?? undefined)
    ctx.current = c
    tweens.current = c.getTweens()
    return () => c.revert()
    // Set up once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    for (const t of tweens.current) {
      if (playing) t.resume()
      else t.pause()
    }
  }, [playing])
}

/* ------------------------------------------------------------------ */
/* Props that recur across films                                        */
/* ------------------------------------------------------------------ */

/** An egg lying on its side, lit from the upper left. `crack` 0..1 draws the crack; `broken` shows the spill. */
export function Egg({ x = 0, y = 0, s = 1, className, crackClass, spillClass }: { x?: number; y?: number; s?: number; className?: string; crackClass?: string; spillClass?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={4} cy={34} rx={46} ry={8} fill="#000" opacity={0.45} filter="url(#cn-dof-1)" />
      {spillClass && (
        <g className={spillClass} opacity={0}>
          <ellipse cx={30} cy={34} rx={70} ry={10} fill="#f3e6b8" opacity={0.85} />
          <ellipse cx={22} cy={30} rx={20} ry={9} fill="#f2a516" />
          <ellipse cx={17} cy={27} rx={6} ry={3} fill="#ffd36a" />
        </g>
      )}
      <path d="M0 -38 C 26 -38 40 -6 40 10 C 40 30 22 38 0 38 C -22 38 -40 30 -40 10 C -40 -6 -26 -38 0 -38 Z" fill="#efe4cf" />
      <path d="M0 -38 C 26 -38 40 -6 40 10 C 40 30 22 38 0 38 C 18 30 26 14 24 0 C 22 -18 14 -32 0 -38 Z" fill="#c9b79a" opacity={0.7} />
      <ellipse cx={-14} cy={-14} rx={9} ry={14} fill="#fffaf0" opacity={0.75} transform="rotate(20 -14 -14)" />
      {crackClass && (
        <path className={crackClass} d="M-38 6 L-24 -2 L-16 10 L-4 -4 L6 8 L16 -6 L26 4 L39 -2" fill="none" stroke="#5b4a33" strokeWidth={2.4} strokeLinejoin="round" strokeDasharray="120" strokeDashoffset="120" />
      )}
    </g>
  )
}

/** A desk lamp (arm and shade) whose light points down-left; the glow is drawn separately with Pool/Beam. */
export function DeskLamp({ x = 0, y = 0, s = 1, flip = false, light = true }: { x?: number; y?: number; s?: number; flip?: boolean; light?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={50} ry={9} fill={C.ink2} />
      <path d="M0 -6 L-14 -150 L-120 -230" fill="none" stroke={C.ink3} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={-14} cy={-150} r={9} fill={C.ink4} />
      <g transform="translate(-120 -230) rotate(28)">
        <path d="M-50 40 L50 40 L26 -18 L-26 -18 Z" fill={C.ink3} />
        <path d="M-26 -18 L26 -18 L50 40 L36 40 L16 -10 L-16 -10 Z" fill={C.ink4} opacity={0.6} />
        {light && <ellipse cx={0} cy={40} rx={46} ry={8} fill={C.keyLight} />}
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The map of five questions                                            */
/* ------------------------------------------------------------------ */

export type Q = 'shape' | 'muscle' | 'tendons' | 'touch' | 'brain' | 'wall'

/** The five questions and the wall, with their colours and short names, as installed in film 1. */
export const QUESTIONS: { id: Q; n: string; name: string; field: string; color: string }[] = [
  { id: 'shape', n: '1', name: 'Shape', field: 'kinematics', color: C.bone },
  { id: 'muscle', n: '2', name: 'Muscle', field: 'actuation', color: C.amber },
  { id: 'tendons', n: '3', name: 'Tendons', field: 'transmission', color: C.cyan },
  { id: 'touch', n: '4', name: 'Touch', field: 'sensing', color: C.magenta },
  { id: 'brain', n: '5', name: 'Brain', field: 'control + data', color: C.lime },
  { id: 'wall', n: '', name: 'The wall', field: 'manufacturing', color: C.gold },
]

/**
 * The map of the course: five tilted orbit rings around the hand at (cx, cy), and the gold
 * wall around them all. Put a Hand3D at the centre yourself. Each ring is a group with class
 * `${prefix}-ring-${id}` (its label `${prefix}-lab-${id}`), drawn dim; light one by tweening
 * its opacity and `--glow`, or pass `lit` for a still frame.
 */
export function FiveMap({ cx = 800, cy = 470, prefix = 'fm', lit = [], labels = true, hidden = false }: { cx?: number; cy?: number; prefix?: string; lit?: Q[]; labels?: boolean; hidden?: boolean }) {
  const rings = QUESTIONS.filter((q) => q.id !== 'wall')
  return (
    <g className={prefix} opacity={hidden ? 0 : 1} transform={`translate(${cx} ${cy})`} pointerEvents="none">
      {rings.map((q, i) => {
        const rx = 250 + i * 62
        const ry = rx * 0.34
        const tilt = -14 + i * 7
        const on = lit.includes(q.id)
        // Where the label sits on the ring: spread around so they don't collide.
        const a = (-150 + i * 62) * (Math.PI / 180)
        const lx = Math.cos(a) * rx
        const ly = Math.sin(a) * ry
        const r = (tilt * Math.PI) / 180
        const px = lx * Math.cos(r) - ly * Math.sin(r)
        const py = lx * Math.sin(r) + ly * Math.cos(r)
        return (
          <g key={q.id}>
            <g className={`${prefix}-ring-${q.id}`} opacity={on ? 1 : 0.22}>
              <ellipse rx={rx} ry={ry} transform={`rotate(${tilt})`} fill="none" stroke={q.color} strokeWidth={on ? 3 : 2} filter={on ? 'url(#cn-bloom)' : undefined} />
              <circle cx={px} cy={py} r={9} fill={q.color} />
            </g>
            {labels && (
              <g className={`${prefix}-lab-${q.id}`} opacity={on ? 1 : 0.35}>
                <text x={px + (px > 0 ? 18 : -18)} y={py - 6} textAnchor={px > 0 ? 'start' : 'end'} fill={q.color} fontFamily={SANS} fontSize={30} fontWeight={600} stroke={C.ink} strokeWidth={6} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                  {q.n}. {q.name}
                </text>
                <text x={px + (px > 0 ? 18 : -18)} y={py + 22} textAnchor={px > 0 ? 'start' : 'end'} fill={q.color} opacity={0.7} fontFamily={MONO} fontSize={18} stroke={C.ink} strokeWidth={5} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                  {q.field}
                </text>
              </g>
            )}
          </g>
        )
      })}
      <g className={`${prefix}-ring-wall`} opacity={lit.includes('wall') ? 1 : 0.18}>
        <circle r={620} fill="none" stroke={C.gold} strokeWidth={10} strokeDasharray="2 14" strokeLinecap="round" opacity={0.9} />
        <circle r={620} fill="none" stroke={C.gold} strokeWidth={2} />
        {labels && (
          <text className={`${prefix}-lab-wall`} y={-636} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={24} fontWeight={600} letterSpacing={4}>
            THE WALL · BUILD A MILLION, CHEAPLY, THAT LAST
          </text>
        )}
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Play controls                                                        */
/* ------------------------------------------------------------------ */

/**
 * A horizontal slider drawn on the picture. `value` is 0..1; `onChange` gets 0..1.
 * Drag the knob or click the track.
 */
export function Slider({ x, y, w = 420, value, onChange, color = C.cyan, label, valueText, disabled, tutor, ticks }: {
  x: number
  y: number
  w?: number
  value: number
  onChange: (v: number) => void
  color?: string
  label?: ReactNode
  valueText?: ReactNode
  disabled?: boolean
  tutor?: string
  ticks?: { at: number; text: string }[]
}) {
  const set = (px: number) => onChange(Math.max(0, Math.min(1, (px - x) / w)))
  const drag = useDrag({ onStart: (p) => !disabled && set(p.x), onMove: (p) => !disabled && set(p.x) })
  const kx = x + value * w
  return (
    <g data-tutor={tutor} opacity={disabled ? 0.45 : 1}>
      {label && (
        <text x={x} y={y - 26} fill={C.fog} fontFamily={SANS} fontSize={22} fontWeight={500}>
          {label}
        </text>
      )}
      {valueText && (
        <text x={x + w} y={y - 26} fill={color} fontFamily={MONO} fontSize={22} textAnchor="end">
          {valueText}
        </text>
      )}
      <g {...(disabled ? {} : drag)}>
        <rect x={x - 16} y={y - 22} width={w + 32} height={44} fill="transparent" />
        <rect x={x} y={y - 3} width={w} height={6} rx={3} fill={C.ink3} />
        <rect x={x} y={y - 3} width={Math.max(0, kx - x)} height={6} rx={3} fill={color} />
        {ticks?.map((t) => (
          <g key={t.text}>
            <line x1={x + t.at * w} x2={x + t.at * w} y1={y + 10} y2={y + 18} stroke={C.mist} strokeWidth={2} />
            <text x={x + t.at * w} y={y + 40} fill={C.mist} fontFamily={MONO} fontSize={16} textAnchor="middle">
              {t.text}
            </text>
          </g>
        ))}
        <circle cx={kx} cy={y} r={20} fill={C.ink1} stroke={color} strokeWidth={4} />
        <circle cx={kx} cy={y} r={7} fill={color} />
      </g>
    </g>
  )
}

/** A pill button on the picture. */
export function Chip({ x, y, w = 200, h = 54, text, onClick, color = C.cyan, active = false, disabled = false, tutor, className }: {
  x: number
  y: number
  w?: number
  h?: number
  text: ReactNode
  onClick?: () => void
  color?: string
  active?: boolean
  disabled?: boolean
  tutor?: string
  className?: string
}) {
  return (
    <g
      className={className}
      data-tutor={tutor}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick?.()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      opacity={disabled ? 0.4 : 1}
    >
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={active ? color : C.ink1} fillOpacity={active ? 0.9 : 0.85} stroke={color} strokeWidth={2.5} />
      <text x={x} y={y + 8} textAnchor="middle" fill={active ? C.ink : color} fontFamily={SANS} fontSize={22} fontWeight={600} pointerEvents="none">
        {text}
      </text>
    </g>
  )
}

/** A horizontal meter with a label and a number. `value` 0..1. */
export function Meter({ x, y, w = 300, value, color = C.amber, label, valueText, mark }: { x: number; y: number; w?: number; value: number; color?: string; label?: ReactNode; valueText?: ReactNode; mark?: number }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <g pointerEvents="none">
      {label && (
        <text x={x} y={y - 12} fill={C.fog} fontFamily={SANS} fontSize={20}>
          {label}
        </text>
      )}
      {valueText && (
        <text x={x + w} y={y - 12} fill={color} fontFamily={MONO} fontSize={20} textAnchor="end">
          {valueText}
        </text>
      )}
      <rect x={x} y={y} width={w} height={12} rx={6} fill={C.ink3} />
      <rect x={x} y={y} width={w * v} height={12} rx={6} fill={color} />
      {mark !== undefined && <line x1={x + w * mark} x2={x + w * mark} y1={y - 6} y2={y + 18} stroke={C.paper} strokeWidth={2} strokeDasharray="3 3" />}
    </g>
  )
}
