import { useId, type ReactNode } from 'react'
import { C, FONT } from './palette'

/*
 * The art kit. Every piece is drawn around its own origin with no transform of its own,
 * so a scene can place it with <At> and animate a wrapping <g> with GSAP.
 *
 * Ambient loops (bobbing, blinking, twinkling) are CSS classes from index.css and only go
 * on inner groups, never on a group GSAP moves, because both would fight over `transform`.
 */

/** Places children at (x, y), optionally scaled and mirrored. */
export function At({
  x = 0,
  y = 0,
  s = 1,
  flip = false,
  rotate = 0,
  className,
  children,
  ...rest
}: {
  x?: number
  y?: number
  s?: number
  flip?: boolean
  rotate?: number
  className?: string
  children: ReactNode
  'data-tutor'?: string
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${flip ? -s : s} ${s})`}
      className={className}
      {...rest}
    >
      {children}
    </g>
  )
}

export function GroundShadow({ rx = 50, ry = 9, y = 0 }: { rx?: number; ry?: number; y?: number }) {
  return <ellipse cx={0} cy={y} rx={rx} ry={ry} fill={C.shadow} />
}

/* ------------------------------------------------------------------ backgrounds */

export function Sky({ top = C.skyDay, low = C.skyDayLow }: { top?: string; low?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <g>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1600} height={900} fill={`url(#sky${id})`} />
    </g>
  )
}

/** Rolling hills along the bottom of the stage. */
export function Hills({
  far = C.hillFar,
  near = C.grass,
  front = C.grassLight,
}: {
  far?: string
  near?: string
  front?: string
}) {
  return (
    <g>
      <path d="M0 560 C 220 470 420 500 620 560 C 820 620 1000 470 1250 500 C 1420 520 1520 560 1600 540 L1600 900 L0 900 Z" fill={far} />
      <path d="M0 650 C 260 590 520 600 760 650 C 1000 700 1260 600 1600 640 L1600 900 L0 900 Z" fill={near} />
      <path d="M0 760 C 300 730 600 745 900 765 C 1200 785 1400 740 1600 755 L1600 900 L0 900 Z" fill={front} opacity={0.6} />
    </g>
  )
}

export function Sun({ r = 70 }: { r?: number }) {
  return (
    <g>
      <circle r={r * 1.9} fill={C.sunGlow} opacity={0.25} />
      <circle r={r * 1.4} fill={C.sunGlow} opacity={0.45} />
      <circle r={r} fill={C.sun} />
    </g>
  )
}

export function Moon({ r = 50 }: { r?: number }) {
  return (
    <g>
      <circle r={r * 1.9} fill={C.moon} opacity={0.08} />
      <circle r={r * 1.35} fill={C.moon} opacity={0.12} />
      <circle r={r} fill={C.moon} />
      <circle cx={-r * 0.3} cy={-r * 0.2} r={r * 0.18} fill="#EDE0B4" />
      <circle cx={r * 0.25} cy={r * 0.3} r={r * 0.12} fill="#EDE0B4" />
      <circle cx={r * 0.35} cy={-r * 0.35} r={r * 0.08} fill="#EDE0B4" />
    </g>
  )
}

const STAR_SPOTS = [
  [90, 80], [210, 150], [330, 60], [460, 190], [560, 90], [700, 140], [820, 50], [930, 170],
  [1050, 90], [1170, 200], [1290, 70], [1400, 160], [1520, 90], [150, 260], [640, 260],
  [1010, 270], [1350, 290], [380, 320], [1180, 330], [780, 300],
]

export function Stars() {
  return (
    <g>
      {STAR_SPOTS.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={i % 3 === 0 ? 3.5 : 2.2} fill={C.star} className="twinkle" style={{ animationDelay: `${(i * 0.37) % 3}s` }} />
        </g>
      ))}
    </g>
  )
}

export function Cloud({ s = 1, opacity = 0.95 }: { s?: number; opacity?: number }) {
  return (
    <g transform={`scale(${s})`} opacity={opacity}>
      <circle cx={-50} cy={10} r={34} fill={C.white} />
      <circle cx={-10} cy={-12} r={46} fill={C.white} />
      <circle cx={40} cy={4} r={38} fill={C.white} />
      <rect x={-84} y={10} width={160} height={34} rx={17} fill={C.white} />
    </g>
  )
}

export function Tree({ s = 1, night = false }: { s?: number; night?: boolean }) {
  const leaf = night ? C.hillNight : C.leaf
  const leafLight = night ? '#3B7A70' : C.grass
  return (
    <g transform={`scale(${s})`}>
      <GroundShadow rx={60} ry={10} />
      <path d="M -14 0 L -10 -120 L 10 -120 L 14 0 Z" fill={night ? '#5B3B26' : C.woodDark} />
      <circle cx={0} cy={-170} r={70} fill={leaf} />
      <circle cx={-48} cy={-130} r={44} fill={leaf} />
      <circle cx={50} cy={-135} r={46} fill={leaf} />
      <circle cx={-18} cy={-195} r={34} fill={leafLight} opacity={0.7} />
    </g>
  )
}

export function Bush({ s = 1, color = C.grassDark }: { s?: number; color?: string }) {
  return (
    <g transform={`scale(${s})`}>
      <circle cx={-30} cy={-20} r={30} fill={color} />
      <circle cx={10} cy={-34} r={38} fill={color} />
      <circle cx={46} cy={-18} r={28} fill={color} />
      <rect x={-60} y={-24} width={134} height={24} fill={color} />
    </g>
  )
}

/** A wooden sheep pen with an open gate on the right. Origin at the bottom-left post. */
export function Pen({ w = 420, night = false }: { w?: number; night?: boolean }) {
  const wood = night ? '#7A5536' : C.wood
  const dark = night ? '#5B3B26' : C.woodDark
  const posts = Math.round(w / 70)
  return (
    <g>
      {Array.from({ length: posts + 1 }, (_, i) => (
        <rect key={i} x={i * (w / posts) - 7} y={-110} width={14} height={110} rx={5} fill={dark} />
      ))}
      <rect x={0} y={-92} width={w - 80} height={14} rx={6} fill={wood} />
      <rect x={0} y={-50} width={w - 80} height={14} rx={6} fill={wood} />
    </g>
  )
}

/* ------------------------------------------------------------------ characters */

/** A fluffy sheep facing right, standing on y = 60. */
export function Sheep({ wool = C.wool, blink = true }: { wool?: string; blink?: boolean }) {
  return (
    <g>
      <GroundShadow rx={58} ry={9} y={62} />
      {[-32, -12, 14, 32].map((x) => (
        <rect key={x} x={x - 5} y={22} width={11} height={42} rx={5} fill={C.sheepFace} />
      ))}
      <circle cx={-36} cy={4} r={28} fill={wool} />
      <circle cx={-10} cy={-14} r={31} fill={wool} />
      <circle cx={20} cy={-10} r={29} fill={wool} />
      <circle cx={36} cy={8} r={24} fill={wool} />
      <circle cx={2} cy={14} r={30} fill={wool} />
      <circle cx={-28} cy={20} r={22} fill={wool} />
      <path d="M -50 26 Q 0 46 50 22" stroke={C.woolShade} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.8} />
      <g transform="translate(56 -6) rotate(12)">
        <ellipse cx={-14} cy={-18} rx={13} ry={6} fill={C.sheepFace} transform="rotate(-35 -14 -18)" />
        <ellipse cx={0} cy={0} rx={19} ry={24} fill={C.sheepFace} />
        <circle cx={-6} cy={-24} r={12} fill={wool} />
        <circle cx={6} cy={-22} r={10} fill={wool} />
        <g className={blink ? 'blink' : undefined}>
          <circle cx={6} cy={-4} r={6.5} fill={C.white} />
          <circle cx={8} cy={-3} r={3.4} fill={C.ink} />
        </g>
        <circle cx={10} cy={10} r={4} fill={C.coral} opacity={0.5} />
      </g>
    </g>
  )
}

/** Ama the shepherd, feet at the origin, about 290 tall. */
export function Shepherd({ holdingBag = false }: { holdingBag?: boolean }) {
  const skin = '#A0663F'
  return (
    <g>
      <GroundShadow rx={70} ry={11} y={2} />
      {/* staff */}
      <rect x={66} y={-262} width={10} height={264} rx={5} fill={C.woodDark} />
      <path d="M 71 -262 C 71 -300 116 -300 116 -266 C 116 -250 100 -246 96 -256" stroke={C.woodDark} strokeWidth={10} fill="none" strokeLinecap="round" />
      {/* robe */}
      <path d="M -42 -168 Q 0 -182 42 -168 L 64 -6 Q 0 8 -64 -6 Z" fill={C.teal} />
      <path d="M -50 -60 Q 0 -48 54 -62 L 62 -10 Q 0 4 -62 -10 Z" fill={C.tealDark} opacity={0.5} />
      <rect x={-46} y={-118} width={92} height={16} rx={8} fill={C.mustard} />
      {/* arms */}
      <path d="M -40 -160 Q -78 -120 -60 -84" stroke={C.teal} strokeWidth={26} fill="none" strokeLinecap="round" />
      <path d="M 40 -160 Q 70 -140 70 -118" stroke={C.teal} strokeWidth={26} fill="none" strokeLinecap="round" />
      <circle cx={-58} cy={-80} r={14} fill={skin} />
      <circle cx={72} cy={-116} r={14} fill={skin} />
      {holdingBag && (
        <g transform="translate(-58 -64)">
          <PebbleBag />
        </g>
      )}
      {/* head */}
      <rect x={-12} y={-186} width={24} height={20} fill={skin} />
      <circle cx={0} cy={-214} r={40} fill={skin} />
      <path d="M -44 -212 C -46 -270 46 -270 44 -212 C 34 -236 -34 -236 -44 -212 Z" fill={C.coral} />
      <path d="M 38 -224 C 60 -220 62 -196 52 -184" stroke={C.coral} strokeWidth={12} fill="none" strokeLinecap="round" />
      <g className="blink">
        <ellipse cx={-14} cy={-210} rx={4.5} ry={6} fill={C.ink} />
        <ellipse cx={14} cy={-210} rx={4.5} ry={6} fill={C.ink} />
      </g>
      <circle cx={-24} cy={-196} r={6} fill={C.coral} opacity={0.45} />
      <circle cx={24} cy={-196} r={6} fill={C.coral} opacity={0.45} />
      <path d="M -10 -192 Q 0 -184 10 -192" stroke={C.ink} strokeWidth={3.5} fill="none" strokeLinecap="round" />
    </g>
  )
}

export type PipMood = 'idle' | 'talking' | 'listening' | 'thinking'

/** Pip the owl, the tutor. Centred on the origin, about 130 tall. */
export function Pip({ mood = 'idle' }: { mood?: PipMood }) {
  return (
    <g className={`pip pip-${mood}`}>
      <ellipse cx={0} cy={66} rx={44} ry={7} fill={C.shadow} />
      <path d="M -30 -50 L -40 -78 L -12 -58 Z" fill={C.violetDark} />
      <path d="M 30 -50 L 40 -78 L 12 -58 Z" fill={C.violetDark} />
      <ellipse cx={0} cy={4} rx={52} ry={58} fill={C.violet} />
      <ellipse cx={-48} cy={14} rx={14} ry={30} fill={C.violetDark} transform="rotate(14 -48 14)" className="pip-wing-l" />
      <ellipse cx={48} cy={14} rx={14} ry={30} fill={C.violetDark} transform="rotate(-14 48 14)" className="pip-wing-r" />
      <ellipse cx={0} cy={22} rx={32} ry={34} fill={C.cream} />
      <path d="M -14 24 q 4 4 8 0 M 2 34 q 4 4 8 0 M -10 42 q 4 4 8 0" stroke={C.boneDark} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <g className="pip-eyes">
        <circle cx={-19} cy={-14} r={19} fill={C.white} />
        <circle cx={19} cy={-14} r={19} fill={C.white} />
        <circle cx={-16} cy={-12} r={9} fill={C.ink} className="pip-pupil" />
        <circle cx={22} cy={-12} r={9} fill={C.ink} className="pip-pupil" />
        <circle cx={-13} cy={-16} r={3} fill={C.white} />
        <circle cx={25} cy={-16} r={3} fill={C.white} />
      </g>
      <g className="pip-beak">
        <path d="M -8 2 L 8 2 L 0 14 Z" fill={C.mustard} />
        <path d="M -6 8 L 6 8 L 0 16 Z" fill={C.mustardDark} className="pip-beak-low" />
      </g>
      <path d="M -16 58 l -6 8 M -10 58 l 0 9 M -4 58 l 6 8" stroke={C.mustard} strokeWidth={4} strokeLinecap="round" />
      <path d="M 4 58 l -6 8 M 10 58 l 0 9 M 16 58 l 6 8" stroke={C.mustard} strokeWidth={4} strokeLinecap="round" />
    </g>
  )
}

/** Zorp, a friendly alien trader with four fingers on each hand. Feet at the origin, about 230 tall. */
export function Alien({ waving = false }: { waving?: boolean }) {
  const body = '#5CCB8A'
  const dark = '#3EA56C'
  return (
    <g>
      <GroundShadow rx={70} ry={11} y={2} />
      <line x1={0} y1={-200} x2={0} y2={-236} stroke={dark} strokeWidth={6} strokeLinecap="round" />
      <circle cx={0} cy={-242} r={10} fill={C.coral} className="twinkle" />
      <path d="M -70 -10 C -80 -150 -40 -205 0 -205 C 40 -205 80 -150 70 -10 Q 0 6 -70 -10 Z" fill={body} />
      <ellipse cx={0} cy={-60} rx={40} ry={34} fill={'#8FE0B0'} />
      <g className="blink">
        <circle cx={0} cy={-148} r={26} fill={C.white} />
        <circle cx={4} cy={-146} r={12} fill={C.ink} />
        <circle cx={-32} cy={-170} r={10} fill={C.white} />
        <circle cx={-30} cy={-169} r={5} fill={C.ink} />
        <circle cx={32} cy={-170} r={10} fill={C.white} />
        <circle cx={34} cy={-169} r={5} fill={C.ink} />
      </g>
      <path d="M -18 -108 Q 0 -94 18 -108" stroke={C.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
      <FourFingerHand x={-82} y={-90} />
      <g className={waving ? 'wave' : undefined}>
        <FourFingerHand x={84} y={waving ? -150 : -90} mirror />
      </g>
    </g>
  )
}

function FourFingerHand({ x, y, mirror = false }: { x: number; y: number; mirror?: boolean }) {
  const body = '#5CCB8A'
  return (
    <g transform={`translate(${x} ${y}) scale(${mirror ? -1 : 1} 1)`}>
      <circle r={16} fill={body} />
      {[-30, -10, 10, 30].map((a) => (
        <rect key={a} x={-4} y={-34} width={8} height={22} rx={4} fill={body} transform={`rotate(${a - 10})`} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ props */

const PEBBLE_SHAPES = [
  { rx: 17, ry: 13, rot: -8, fill: C.stone },
  { rx: 15, ry: 12, rot: 12, fill: C.stoneDark },
  { rx: 18, ry: 12, rot: 4, fill: '#B9B2A7' },
  { rx: 14, ry: 13, rot: -15, fill: '#9A9FB0' },
]

/** A small round pebble. `seed` picks one of a few shapes and greys. */
export function Pebble({ seed = 0, glow = false }: { seed?: number; glow?: boolean }) {
  const p = PEBBLE_SHAPES[Math.abs(seed) % PEBBLE_SHAPES.length]
  return (
    <g transform={`rotate(${p.rot})`}>
      {glow && <ellipse rx={p.rx + 12} ry={p.ry + 12} fill={C.sunGlow} opacity={0.7} className="pulse" />}
      <ellipse cx={0} cy={4} rx={p.rx} ry={p.ry * 0.7} fill={C.shadow} />
      <ellipse rx={p.rx} ry={p.ry} fill={p.fill} />
      <ellipse cx={-p.rx * 0.35} cy={-p.ry * 0.4} rx={p.rx * 0.35} ry={p.ry * 0.22} fill={C.white} opacity={0.45} />
    </g>
  )
}

/** A cloth pouch for pebbles. Origin at the bottom centre, about 90 tall. */
export function PebbleBag({ open = false }: { open?: boolean }) {
  return (
    <g>
      <GroundShadow rx={44} ry={7} y={2} />
      <path d="M -40 -50 C -60 -10 -46 4 0 4 C 46 4 60 -10 40 -50 Z" fill={C.clay} />
      <path d="M -30 -40 C -42 -14 -30 -4 -6 -2" stroke={C.clayDark} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.5} />
      {open ? (
        <ellipse cx={0} cy={-56} rx={38} ry={11} fill={C.clayDark} />
      ) : (
        <path d="M -34 -52 Q 0 -78 34 -52 Q 0 -60 -34 -52 Z" fill={C.clayDark} />
      )}
      <path d="M -20 -60 Q 0 -54 20 -60" stroke={C.mustard} strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** One counting stick, standing upright and centred on the origin, 96 tall. */
export function Stick({ color = C.woodLight }: { color?: string }) {
  return (
    <g>
      <rect x={-5} y={-48} width={10} height={96} rx={5} fill={color} />
      <rect x={-1.5} y={-40} width={3} height={80} rx={1.5} fill={C.woodDark} opacity={0.25} />
    </g>
  )
}

/** Ten sticks tied together with a ribbon, centred on the origin. */
export function Bundle({ ribbon = C.coral }: { ribbon?: string }) {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`translate(${(i - 4.5) * 7} 0) rotate(${(i - 4.5) * 1.2})`}>
          <Stick />
        </g>
      ))}
      <rect x={-40} y={-8} width={80} height={16} rx={6} fill={ribbon} />
      <circle cx={0} cy={0} r={9} fill={ribbon} stroke={C.white} strokeWidth={2} />
    </g>
  )
}

/** An old bone with tally notches carved in it. Centred on the origin, about 260 wide. */
export function NotchedBone({ notches = 9 }: { notches?: number }) {
  return (
    <g>
      <path
        d="M -110 -16 C -140 -46 -160 -6 -132 0 C -160 6 -140 46 -110 16 L 110 16 C 140 46 160 6 132 0 C 160 -6 140 -46 110 -16 Z"
        fill={C.bone}
      />
      <path d="M -100 10 L 100 10" stroke={C.boneDark} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      {Array.from({ length: notches }, (_, i) => (
        <line key={i} x1={-80 + i * (160 / Math.max(1, notches - 1))} y1={-12} x2={-84 + i * (160 / Math.max(1, notches - 1))} y2={10} stroke={C.woodDark} strokeWidth={4} strokeLinecap="round" />
      ))}
    </g>
  )
}

/** A small clay counting token. Kinds: cone, ball, disc. */
export function ClayToken({ kind = 'ball' }: { kind?: 'cone' | 'ball' | 'disc' }) {
  return (
    <g>
      <ellipse cx={0} cy={18} rx={22} ry={5} fill={C.shadow} />
      {kind === 'cone' && <path d="M -18 16 L 0 -24 L 18 16 Q 0 22 -18 16 Z" fill={C.clay} />}
      {kind === 'ball' && <circle cx={0} cy={0} r={18} fill={C.clay} />}
      {kind === 'disc' && <ellipse cx={0} cy={4} rx={22} ry={12} fill={C.clay} />}
      <circle cx={-6} cy={-4} r={4} fill={C.white} opacity={0.35} />
    </g>
  )
}

/** A simple thought or speech bubble with text. Origin at the bubble's tail tip. */
export function Bubble({ text, w = 260, h = 86, size = 34, tail = 'left' }: { text: string; w?: number; h?: number; size?: number; tail?: 'left' | 'right' | 'none' }) {
  const bx = tail === 'right' ? -w + 30 : -30
  return (
    <g>
      <rect x={bx} y={-h - 26} width={w} height={h} rx={h / 2.4} fill={C.white} />
      {tail !== 'none' && <path d={tail === 'left' ? 'M 0 0 L 6 -32 L 40 -30 Z' : 'M 0 0 L -6 -32 L -40 -30 Z'} fill={C.white} />}
      <text x={bx + w / 2} y={-h / 2 - 26 + size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={size} fill={C.ink}>
        {text}
      </text>
    </g>
  )
}

/** A title card label, for words that appear in the scene. */
export function Label({
  text,
  size = 48,
  color = C.ink,
  weight = 800,
  anchor = 'middle',
}: {
  text: string
  size?: number
  color?: string
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text textAnchor={anchor} fontFamily={FONT} fontWeight={weight} fontSize={size} fill={color} dominantBaseline="middle">
      {text}
    </text>
  )
}

/** A rounded SVG button for choices inside a scene. */
export function SvgButton({
  x,
  y,
  w,
  h = 72,
  label,
  color = C.coral,
  onClick,
  disabled = false,
  size = 30,
  tutor,
}: {
  x: number
  y: number
  w: number
  h?: number
  label: string
  color?: string
  onClick: () => void
  disabled?: boolean
  size?: number
  tutor?: string
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={disabled ? undefined : 'svg-button'}
      onClick={disabled ? undefined : onClick}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      opacity={disabled ? 0.45 : 1}
      data-tutor={tutor}
      role="button"
    >
      <rect x={-w / 2} y={-h / 2 + 6} width={w} height={h} rx={h / 2} fill={C.ink} opacity={0.18} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={color} />
      <text textAnchor="middle" dominantBaseline="middle" y={2} fontFamily={FONT} fontWeight={800} fontSize={size} fill={C.white}>
        {label}
      </text>
    </g>
  )
}
