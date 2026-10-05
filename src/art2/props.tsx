import type { ReactNode } from 'react'
import { Glow, Shadow } from './fx'
import { FONT2, N } from './palette'

/* ------------------------------------------------------------------ */
/* Balance scale                                                       */
/* ------------------------------------------------------------------ */

/** Height of the pivot above the scale's base, half the beam length, and how far the pans hang. */
export const SCALE = { H: 360, L: 300, DROP: 210 }

/** Transforms for a scale tilted `deg` degrees (positive: the right side goes down). */
export function scaleTransforms(deg: number) {
  const t = (deg * Math.PI) / 180
  const { H, L } = SCALE
  return {
    beam: `rotate(${deg} 0 ${-H})`,
    panL: `translate(${-L * Math.cos(t)} ${-H - L * Math.sin(t)})`,
    panR: `translate(${L * Math.cos(t)} ${-H + L * Math.sin(t)})`,
  }
}

/** Sets a rendered <Scale>'s tilt directly, for GSAP timelines: `onUpdate: () => tiltScale(el, p.deg)`. */
export function tiltScale(scaleEl: Element | null, deg: number) {
  if (!scaleEl) return
  const t = scaleTransforms(deg)
  scaleEl.querySelector('.sc-beam')?.setAttribute('transform', t.beam)
  scaleEl.querySelector('.sc-pan-l')?.setAttribute('transform', t.panL)
  scaleEl.querySelector('.sc-pan-r')?.setAttribute('transform', t.panR)
}

/** How far a scale tips when the right side is heavier by `diff` (negative: the left is heavier). */
export function tiltFor(diff: number) {
  if (diff === 0) return 0
  return Math.sign(diff) * Math.min(13, 4 + Math.abs(diff) * 1.6)
}

function Pan({ className, transform, children, glow }: { className: string; transform: string; children?: ReactNode; glow?: boolean }) {
  const { DROP } = SCALE
  return (
    <g className={className} transform={transform}>
      <path d={`M0 0 L-118 ${DROP} M0 0 L118 ${DROP} M0 0 L0 ${DROP - 8}`} stroke={N.brassDark} strokeWidth={3} opacity={0.9} />
      <circle r={9} fill={N.brass} />
      {glow && <Glow y={DROP + 10} r={170} color="teal" opacity={0.6} />}
      <path d={`M-140 ${DROP} Q0 ${DROP + 70} 140 ${DROP} Z`} fill={N.brass} />
      <path d={`M40 ${DROP} Q110 ${DROP + 26} 140 ${DROP} Z`} fill={N.brassDark} opacity={0.6} />
      <rect x={-146} y={DROP - 7} width={292} height={12} rx={6} fill={N.brassLight} />
      <g className="sc-load" transform={`translate(0 ${DROP - 7})`}>
        {children}
      </g>
    </g>
  )
}

/**
 * A brass balance scale standing on its base at the origin, about 520 tall and 600 wide.
 * What sits on each pan goes in `left` / `right`, drawn with (0, 0) at the middle of the pan's top.
 * Tilt with the `tilt` prop, or with tiltScale() from a timeline.
 */
export function Scale({ tilt = 0, left, right, glow = false, className = 'scale', tutor }: { tilt?: number; left?: ReactNode; right?: ReactNode; glow?: boolean; className?: string; tutor?: string }) {
  const { H, L } = SCALE
  const t = scaleTransforms(tilt)
  return (
    <g className={className} data-tutor={tutor}>
      <Shadow y={4} w={260} opacity={0.45} />
      {/* base and post */}
      <path d="M-110 0 Q-100 -34 -40 -40 H40 Q100 -34 110 0 Z" fill={N.brass} />
      <path d="M30 -40 H40 Q100 -34 110 0 H60 Q70 -24 30 -40 Z" fill={N.brassDark} opacity={0.7} />
      <rect x={-14} y={-H} width={28} height={H - 36} rx={8} fill={N.brass} />
      <rect x={4} y={-H} width={10} height={H - 36} fill={N.brassDark} opacity={0.6} />
      <rect x={-10} y={-H} width={6} height={H - 36} fill={N.brassLight} opacity={0.7} />
      {/* beam */}
      <g className="sc-beam" transform={t.beam}>
        <rect x={-L - 10} y={-H - 9} width={2 * L + 20} height={18} rx={9} fill={N.brass} />
        <rect x={-L - 10} y={-H + 1} width={2 * L + 20} height={8} rx={4} fill={N.brassDark} opacity={0.55} />
        <rect x={-L} y={-H - 7} width={2 * L} height={5} rx={2.5} fill={N.brassLight} opacity={0.8} />
        {/* the pointer shows level */}
        <path d={`M-7 ${-H - 8} L0 ${-H - 64} L7 ${-H - 8} Z`} fill={N.teal} />
      </g>
      <circle cy={-H} r={20} fill={N.brass} />
      <circle cy={-H} r={9} fill={N.brassDark} />
      <circle cx={-5} cy={-H - 6} r={5} fill={N.brassLight} />
      <Pan className="sc-pan-l" transform={t.panL} glow={glow}>
        {left}
      </Pan>
      <Pan className="sc-pan-r" transform={t.panR} glow={glow}>
        {right}
      </Pan>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Things on the scale                                                  */
/* ------------------------------------------------------------------ */

/** A brass weight worth 1, standing on (0, 0); about 52 wide and 56 tall. */
export function Weight({ x = 0, y = 0, s = 1, className, tutor }: { x?: number; y?: number; s?: number; className?: string; tutor?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <path d="M-24 0 Q-26 -30 -14 -40 H14 Q26 -30 24 0 Z" fill={N.gold} />
      <path d="M6 -40 H14 Q26 -30 24 0 H10 Q16 -24 6 -40 Z" fill={N.goldDark} />
      <path d="M-16 -36 Q-22 -22 -18 -6" stroke={N.goldLight} strokeWidth={5} fill="none" strokeLinecap="round" />
      <rect x={-17} y={-46} width={34} height={8} rx={4} fill={N.goldDark} />
      <circle cy={-52} r={7} fill="none" stroke={N.goldDark} strokeWidth={4} />
    </g>
  )
}

/** Where `n` weights sit on a pan: rows of up to `perRow`, bottom row first, centred. Pair with <Weight s={0.9}>. */
export function weightSpots(n: number, perRow = 6, w = 46, h = 50): [number, number][] {
  const spots: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, n - row * perRow)
    const col = i % perRow
    spots.push([(col - (inRow - 1) / 2) * w, -row * h])
  }
  return spots
}

/** A sealed sack with an "x" tag: the unknown. Standing on (0, 0); about 96 wide and 110 tall. */
export function Sack({ x = 0, y = 0, s = 1, label = 'x', className, tutor, open = false }: { x?: number; y?: number; s?: number; label?: string; className?: string; tutor?: string; open?: boolean }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <Glow y={-50} r={80} color="pink" opacity={0.35} />
      <path d="M-30 -84 Q-56 -62 -48 -24 Q-44 0 0 0 Q44 0 48 -24 Q56 -62 30 -84 Z" fill={N.pink} />
      <path d="M12 -84 H30 Q56 -62 48 -24 Q44 0 0 0 Q34 -10 32 -40 Q30 -66 12 -84 Z" fill={N.pinkDark} />
      <path d="M-30 -74 Q-46 -50 -38 -20" stroke={N.pinkLight} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.8} />
      {open ? (
        <path d="M-34 -84 Q0 -100 34 -84 Q0 -74 -34 -84 Z" fill={N.pinkDark} />
      ) : (
        <>
          <path d="M-22 -86 Q-26 -104 -10 -110 L10 -110 Q26 -104 22 -86 Z" fill={N.pink} />
          <rect x={-26} y={-92} width={52} height={10} rx={5} fill={N.gold} />
        </>
      )}
      <g transform="translate(26 -64) rotate(12)">
        <rect x={-6} y={-2} width={44} height={40} rx={9} fill={N.cream} />
        <circle cx={2} cy={8} r={3.5} fill={N.pinkDark} />
        <text x={20} y={30} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={34} fill={N.pinkDark}>
          {label}
        </text>
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Writing it down                                                      */
/* ------------------------------------------------------------------ */

export type TermKind = 'x' | 'num' | 'op' | 'eq' | 'neq'

export interface Term {
  t: string
  k: TermKind
  /** Becomes the class `term-<id>`, so a timeline can move one piece. */
  id?: string
}

const TERM_STYLE: Record<TermKind, { fill: string; text: string; glow?: 'pink' | 'warm' | 'teal' }> = {
  x: { fill: N.pink, text: N.white, glow: 'pink' },
  num: { fill: N.gold, text: N.night0, glow: 'warm' },
  op: { fill: 'none', text: N.white },
  eq: { fill: N.teal, text: N.night0, glow: 'teal' },
  /** "Not equal": the balance is broken. Coral, so it never looks like the teal equals. */
  neq: { fill: N.coral, text: N.night0 },
}

/** Rough width of a term at a given font size, for laying out a line. */
export function termWidth(term: Term, size: number) {
  const chars = term.t.length
  return term.k === 'op' ? size * 0.75 : Math.max(size * 1.15, chars * size * 0.62 + size * 0.6)
}

/**
 * An equation written as coloured tiles: unknowns pink, numbers gold, equals teal.
 * Centred on (x, y). Each term is a <g class="term term-<id>"> for animating.
 */
export function Equation({ terms, x = 800, y = 450, size = 64, gap = 16, className, tutor }: { terms: Term[]; x?: number; y?: number; size?: number; gap?: number; className?: string; tutor?: string }) {
  const widths = terms.map((t) => termWidth(t, size))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (terms.length - 1)
  let cx = -total / 2
  return (
    <g className={className} transform={`translate(${x} ${y})`} data-tutor={tutor}>
      {terms.map((term, i) => {
        const w = widths[i]
        const st = TERM_STYLE[term.k]
        const left = cx
        cx += w + gap
        const h = size * 1.3
        return (
          <g key={i} className={`term${term.id ? ` term-${term.id}` : ''}`} transform={`translate(${left + w / 2} 0)`}>
            {st.glow && <Glow r={size * 1.2} color={st.glow} opacity={0.35} />}
            {st.fill !== 'none' && (
              <>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.32} fill={st.fill} />
                <rect x={-w / 2} y={h / 2 - h * 0.22} width={w} height={h * 0.22} rx={h * 0.11} fill={N.shadow} opacity={0.18} />
                <rect x={-w / 2 + 10} y={-h / 2 + 7} width={w - 20} height={h * 0.14} rx={h * 0.07} fill={N.white} opacity={0.3} />
              </>
            )}
            <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={st.text}>
              {term.t}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Parses a simple equation like "2x + 3 = x + 10" into tiles. */
export function terms(src: string): Term[] {
  return src
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ t, k: t === '=' ? 'eq' : t === '≠' ? 'neq' : /x/.test(t) ? 'x' : /^[+−\-×÷]$/.test(t) ? 'op' : 'num' }) as Term)
}

/* ------------------------------------------------------------------ */
/* The number machine                                                   */
/* ------------------------------------------------------------------ */

/**
 * A machine that does one operation to whatever goes in. Centred on (0, 0), about
 * 440 wide and 480 tall. Things drop into the funnel on top at (-90, -240) and come out
 * of the pipe on the right at (260, 68). The gears turn while `running`.
 */
export function NumberMachine({ op = '+3', running = false, tutor }: { op?: string; running?: boolean; tutor?: string }) {
  return (
    <g data-tutor={tutor}>
      <Shadow y={160} w={440} opacity={0.4} />
      {/* input funnel on top, output pipe on the right */}
      <path d="M-150 -236 H-30 L-62 -150 H-118 Z" fill={N.stone} />
      <path d="M-70 -236 H-30 L-62 -150 H-82 Z" fill={N.stoneDark} />
      <rect x={-156} y={-246} width={132} height={16} rx={8} fill={N.stoneLight} />
      <rect x={170} y={36} width={84} height={64} rx={12} fill={N.stone} />
      <rect x={170} y={76} width={84} height={24} rx={8} fill={N.stoneDark} />
      <ellipse cx={256} cy={68} rx={14} ry={34} fill={N.stoneLight} />
      <ellipse cx={258} cy={68} rx={8} ry={26} fill={N.night0} />
      {/* body */}
      <rect x={-180} y={-150} width={360} height={300} rx={36} fill={N.violet} />
      <path d="M60 -150 H144 Q180 -150 180 -114 V114 Q180 150 144 150 H40 Q100 40 60 -150 Z" fill={N.violetDark} />
      <rect x={-160} y={-138} width={140} height={14} rx={7} fill={N.violetLight} opacity={0.7} />
      {/* screen */}
      <rect x={-120} y={-110} width={240} height={110} rx={20} fill={N.night0} />
      <Glow y={-55} r={110} color="teal" opacity={0.45} />
      <text y={-28} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={76} fill={N.tealLight}>
        {op}
      </text>
      {/* gear window */}
      <rect x={-120} y={20} width={240} height={100} rx={20} fill={N.night1} />
      <g transform="translate(-50 70)">
        <g className={running ? 'spin' : undefined}>
          <Gear r={34} color={N.gold} />
        </g>
      </g>
      <g transform="translate(26 62)">
        <g className={running ? 'spin-rev' : undefined}>
          <Gear r={26} color={N.coral} />
        </g>
      </g>
      <g transform="translate(84 84)">
        <g className={running ? 'spin' : undefined}>
          <Gear r={18} color={N.teal} />
        </g>
      </g>
      {/* lights */}
      {[110, 140].map((lx, i) => (
        <circle key={i} cx={lx} cy={-130} r={7} fill={i % 2 ? N.gold : N.pink} className={running ? 'blink-light' : undefined} />
      ))}
    </g>
  )
}

function Gear({ r, color }: { r: number; color: string }) {
  const teeth = Math.round(r / 4)
  return (
    <g>
      {Array.from({ length: teeth }, (_, i) => (
        <rect key={i} x={-r * 0.16} y={-r - 6} width={r * 0.32} height={14} rx={3} fill={color} transform={`rotate(${(360 / teeth) * i})`} />
      ))}
      <circle r={r} fill={color} />
      <circle r={r * 0.35} fill={N.night1} />
    </g>
  )
}

/** An open book. Origin at the spine's bottom; about 300 wide. `diagram` draws al-Khwarizmi's squares. */
export function Book({ x = 0, y = 0, s = 1, diagram = false }: { x?: number; y?: number; s?: number; diagram?: boolean }) {
  const lines = (side: -1 | 1) =>
    Array.from({ length: diagram && side === 1 ? 2 : 6 }, (_, i) => (
      <path key={i} d={`M${side * 22} ${-150 + i * 20} q${side * 30} -6 ${side * 60} 0 t${side * 60} 0`} stroke={N.woodDark} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.55} />
    ))
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow y={4} w={320} opacity={0.4} />
      <path d="M0 -10 Q-80 -24 -160 -8 V-178 Q-80 -194 0 -178 Z" fill={N.cream} />
      <path d="M0 -10 Q80 -24 160 -8 V-178 Q80 -194 0 -178 Z" fill={N.sandLight} />
      <path d="M-160 -8 Q-80 -24 0 -10 Q80 -24 160 -8 V4 Q80 -12 0 2 Q-80 -12 -160 4 Z" fill={N.coralDark} />
      {lines(-1)}
      {lines(1)}
      {diagram && (
        <g transform="translate(90 -78)">
          <rect x={-34} y={-34} width={48} height={48} fill={N.pink} opacity={0.85} />
          <rect x={14} y={-34} width={20} height={48} fill={N.gold} opacity={0.9} />
          <rect x={-34} y={14} width={48} height={20} fill={N.gold} opacity={0.9} />
          <rect x={14} y={14} width={20} height={20} fill={N.teal} opacity={0.9} />
        </g>
      )}
    </g>
  )
}

/** Bold text with a soft dark halo so it reads on any background. */
export function Title({ x = 800, y = 450, size = 56, color = N.white, weight = 800, children, anchor = 'middle', className }: { x?: number; y?: number; size?: number; color?: string; weight?: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; className?: string }) {
  return (
    <text className={className} x={x} y={y} textAnchor={anchor} fontFamily={FONT2} fontWeight={weight} fontSize={size} fill={color} stroke={N.shadow} strokeWidth={size * 0.14} strokeOpacity={0.35} paintOrder="stroke" strokeLinejoin="round">
      {children}
    </text>
  )
}
