import type { CSSProperties, ReactNode } from 'react'
import { Person, type PersonProps } from '../../art2/characters'
import { Bloom, Glow, Stars, rng } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Moon } from '../../art2/scenery'
import './frameworks.css'

/*
 * The cast, places and things of "The Frameworks of Mathematics", shared by every chapter
 * so they always look the same.
 *
 * Colour rule for this lesson (ages 7 to 8):
 *   gold   an amount and its name: number tiles, counted things lighting up
 *   teal   a match, "the same", balance
 *   coral  missing, not the same, tipping
 *   pink   the question we are trying to answer (question marks)
 *   violet a bundle of ten: the ribbon on a bundle and the tens digit
 * Clothes, buildings and scenery stay out of those five.
 */

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

type CastProps = Omit<PersonProps, 'skin' | 'skinDark' | 'robe' | 'robeLight' | 'robeDark' | 'head' | 'headColor' | 'headDark' | 'beard' | 'holding'>

/** A shepherd's crook held in the right hand of a Person in the "hold" pose. */
function Crook() {
  return (
    <g>
      <path d="M58 0 V-300 Q58 -352 96 -352 Q132 -352 132 -316" stroke={N.woodDark} strokeWidth={12} fill="none" strokeLinecap="round" />
      <path d="M54 -6 V-296 Q54 -344 92 -346" stroke={N.woodLight} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
    </g>
  )
}

/** Ama, the shepherd who invented counting with pebbles. Feet at (x, y), about 250 tall. */
export function Ama({ staff = true, pose, ...p }: CastProps & { staff?: boolean }) {
  return (
    <Person
      {...p}
      pose={pose ?? (staff ? 'hold' : 'down')}
      head="hair"
      headColor={N.night0}
      headDark={N.space}
      skin={N.skin3}
      skinDark={N.skin3Dark}
      robe={N.sky}
      robeLight={N.skyLight}
      robeDark={N.skyDark}
      holding={staff ? <Crook /> : undefined}
    />
  )
}

/* ------------------------------------------------------------------ */
/* The valley: Ama's hills, from morning to night                       */
/* ------------------------------------------------------------------ */

interface LandColors {
  crest: string
  mountain: string
  mountainShade: string
  far: string
  mid: string
  midShade: string
  near: string
  nearRim: string
  tree: string
  treeLight: string
  trunk: string
}

const DAY: LandColors = {
  crest: '#eaf6ff',
  mountain: '#9cc0ee',
  mountainShade: '#86aae0',
  far: '#86cfa0',
  mid: '#55b676',
  midShade: '#47a266',
  near: '#3c9c5d',
  nearRim: '#6ccb88',
  tree: '#2f8a50',
  treeLight: '#4fae6c',
  trunk: N.woodDark,
}

const NIGHT: LandColors = {
  crest: N.night3,
  mountain: N.night2,
  mountainShade: N.night1,
  far: '#22337a',
  mid: '#1b2a66',
  midShade: '#162257',
  near: N.night1,
  nearRim: N.night2,
  tree: N.night0,
  treeLight: N.night1,
  trunk: N.night0,
}

/** Where the meadow is flat enough to stand on, by x. Things on the ground in the valley stand on GROUND_Y. */
export const GROUND_Y = 772

function Tree({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: LandColors }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 2 Q-7 -40 -3 -62 L4 -62 Q7 -40 6 2 Z" fill={c.trunk} />
      <path d="M-4 -40 L-18 -58 M3 -50 L14 -66" stroke={c.trunk} strokeWidth={4} strokeLinecap="round" />
      <path d="M-44 -78 Q-50 -112 -22 -124 Q-6 -146 18 -132 Q46 -128 46 -100 Q56 -74 34 -62 Q12 -52 -10 -58 Q-40 -54 -44 -78 Z" fill={c.tree} />
      <g filter="url(#fx-wet)">
        <path d="M-40 -84 Q-44 -112 -20 -120 Q-4 -138 14 -128 Q-6 -122 -12 -104 Q-30 -100 -40 -84 Z" fill={c.treeLight} opacity={0.75} />
        <path d="M-24 -96 Q-14 -112 2 -110 Q-8 -102 -10 -92 Z" fill={c.treeLight} opacity={0.6} />
        <path d="M20 -126 Q44 -120 44 -98 Q52 -76 32 -64 Q12 -54 -8 -60 Q22 -70 28 -92 Q30 -110 20 -126 Z" fill={c.trunk} opacity={0.3} />
      </g>
    </g>
  )
}

function Land({ c, air }: { c: LandColors; air: string }) {
  return (
    <g>
      {/* far mountains, with snow-light on the lit faces and haze at their feet */}
      <path d="M-60 600 L120 430 L230 520 L380 380 L560 560 L700 470 L860 600 Z" fill={c.mountain} />
      <path d="M380 380 L560 560 L470 560 Q440 470 380 380 Z" fill={c.mountainShade} />
      <path d="M120 430 L230 520 L180 540 Q160 480 120 430 Z" fill={c.mountainShade} />
      <path d="M900 600 L1080 450 L1180 520 L1330 400 L1500 540 L1660 470 V600 Z" fill={c.mountain} />
      <path d="M1330 400 L1500 540 L1420 560 Q1390 470 1330 400 Z" fill={c.mountainShade} />
      <path d="M1080 450 L1180 520 L1130 540 Q1110 490 1080 450 Z" fill={c.mountainShade} />
      <path d="M380 380 L330 440 L352 436 L366 452 Z M1330 400 L1290 444 L1312 440 L1322 456 Z" fill={c.crest} opacity={0.6} />
      <rect x={-60} y={430} width={1720} height={210} fill={`url(#${air})`} />
      {/* rolling hills, far to near, each paler and hazier than the one in front */}
      <path d="M-60 640 Q200 560 460 620 T980 600 T1660 610 V900 H-60 Z" fill={c.far} />
      <path d="M-60 640 Q200 560 460 620 T980 600 T1660 610" stroke={c.crest} strokeWidth={5} fill="none" opacity={0.45} />
      <Tree x={300} y={598} s={0.55} c={c} />
      <Tree x={340} y={604} s={0.42} c={c} />
      <Tree x={1180} y={598} s={0.5} c={c} />
      <rect x={-60} y={560} width={1720} height={200} fill={`url(#${air})`} opacity={0.6} />
      <path d="M-60 712 Q260 640 620 690 T1300 676 T1660 690 V900 H-60 Z" fill={c.mid} />
      <path d="M-60 712 Q260 640 620 690 T1300 676 T1660 690" stroke={c.crest} strokeWidth={6} fill="none" opacity={0.4} />
      <g filter="url(#fx-wet)">
        <path d="M900 690 Q1100 660 1300 676 T1660 690 V726 Q1300 704 900 724 Z" fill={c.midShade} opacity={0.7} />
        <path d="M300 676 Q440 664 620 690 Q480 700 300 690 Z" fill={c.midShade} opacity={0.55} />
      </g>
      <Tree x={1420} y={688} s={0.8} c={c} />
      <Tree x={150} y={690} s={0.75} c={c} />
      {/* the near meadow */}
      <path d={`M-60 ${GROUND_Y + 8} Q400 ${GROUND_Y - 30} 800 ${GROUND_Y} T1660 ${GROUND_Y} V960 H-60 Z`} fill={c.nearRim} />
      <path d={`M-60 ${GROUND_Y + 20} Q400 ${GROUND_Y - 18} 800 ${GROUND_Y + 12} T1660 ${GROUND_Y + 12} V960 H-60 Z`} fill={c.near} />
      <rect x={-60} y={GROUND_Y + 40} width={1720} height={160} fill="url(#fx-cloth-ao)" opacity={0.8} />
      <Grass c={c} />
    </g>
  )
}

/** Short painted grass strokes across the near meadow, lighter at the back and darker in front. */
function Grass({ c }: { c: LandColors }) {
  const r = rng(77)
  const blades = Array.from({ length: 140 }, () => {
    const x = -40 + r() * 1680
    const y = GROUND_Y + 14 + Math.pow(r(), 1.4) * 120
    const h = 6 + ((y - GROUND_Y) / 120) * 14 * (0.6 + r() * 0.6)
    const lean = (r() - 0.5) * 8
    return { x, y, h, lean, lit: r() < 0.5 }
  })
  return (
    <g strokeLinecap="round" fill="none">
      {blades.map((b, i) => (
        <path key={i} d={`M${b.x} ${b.y} q${b.lean * 0.4} ${-b.h * 0.6} ${b.lean} ${-b.h}`} stroke={b.lit ? c.nearRim : c.tree} strokeWidth={2.4} opacity={b.lit ? 0.55 : 0.4} />
      ))}
    </g>
  )
}

/** Little flowers and grass tufts on the near meadow (daytime only). */
function Meadow() {
  const spots: [number, number, string][] = [
    [90, 830, N.cream],
    [260, 860, N.sandLight],
    [470, 820, N.cream],
    [690, 870, N.sandLight],
    [980, 840, N.cream],
    [1210, 875, N.sandLight],
    [1450, 830, N.cream],
  ]
  return (
    <g>
      {spots.map(([x, y, col], i) => (
        <g key={i}>
          <path d={`M${x - 14} ${y + 6} Q${x - 10} ${y - 10} ${x - 4} ${y + 6} M${x - 2} ${y + 6} Q${x + 2} ${y - 14} ${x + 8} ${y + 6}`} stroke="#2e8a4f" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={x + 18} cy={y - 2} r={5} fill={col} />
          <circle cx={x + 18} cy={y - 2} r={2} fill={N.sand} />
        </g>
      ))}
    </g>
  )
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.92}>
      <ellipse cx={0} cy={0} rx={90} ry={26} fill={N.white} />
      <circle cx={-34} cy={-12} r={30} fill={N.white} />
      <circle cx={14} cy={-24} r={38} fill={N.white} />
      <ellipse cx={0} cy={10} rx={84} ry={12} fill="#c4dcf5" />
      <path d="M-70 8 Q-20 -6 40 2 Q70 4 84 10 Q40 22 -60 18 Z" fill="#a9c6ea" opacity={0.5} />
      <ellipse cx={-6} cy={-40} rx={22} ry={8} fill={N.white} opacity={0.9} />
    </g>
  )
}

/**
 * Ama's valley: sky, sun and moon, mountains, rolling hills and a flat meadow to stand on
 * (at GROUND_Y). It holds three times of day at once; animate their opacity to move
 * through the day:
 *   .vl-day (bright sky, sun, clouds, green hills), .vl-dusk (warm sky over it),
 *   .vl-night (night sky, moon, stars, dark hills).
 * `time` sets which one shows at first. The sun is .vl-sun (it can sink) and the moon .vl-moon.
 */
export function Valley({ time = 'day', children }: { time?: 'day' | 'dusk' | 'night'; children?: ReactNode }) {
  return (
    <g className="valley">
      <defs>
        <linearGradient id="vl-air-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8ecff" stopOpacity="0" />
          <stop offset="1" stopColor="#d8ecff" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="vl-air-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.dusk} stopOpacity="0" />
          <stop offset="1" stopColor={N.dusk} stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="vl-ray" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1240 190) scale(900)">
          <stop offset="0" stopColor={N.cream} stopOpacity="0.5" />
          <stop offset="1" stopColor={N.cream} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="vl-day">
        <rect x={-400} y={-300} width={2400} height={1500} fill="url(#fx-sky-day)" />
        <g className="vl-sun">
          <Glow x={1240} y={190} r={260} color="warm" opacity={0.7} />
          <circle cx={1240} cy={190} r={64} fill={N.goldLight} />
          <circle cx={1240} cy={190} r={52} fill={N.cream} />
          {/* soft shafts of light falling from the sun */}
          <path d="M1240 190 L560 900 L760 900 Z M1240 190 L960 900 L1080 900 Z M1240 190 L1400 900 L1560 900 Z" fill="url(#vl-ray)" opacity={0.35} />
        </g>
        <g className="vl-clouds">
          <Cloud x={330} y={170} />
          <Cloud x={820} y={110} s={0.7} />
          <Cloud x={1460} y={300} s={0.6} />
        </g>
      </g>
      <g className="vl-dusk" opacity={time === 'dusk' ? 1 : 0}>
        <rect x={-400} y={-300} width={2400} height={1500} fill="url(#fx-sky-dawn)" />
      </g>
      <g className="vl-night" opacity={time === 'night' ? 1 : 0}>
        <rect x={-400} y={-300} width={2400} height={1500} fill="url(#fx-sky-night)" />
        <Bloom x={260} y={160} r={420} color="violet" opacity={0.12} />
        <g className="vl-stars">
          <Stars h={560} count={110} seed={12} />
        </g>
        <g className="vl-moon">
          <Moon x={330} y={150} r={50} />
        </g>
      </g>
      {/* the land, in day colours with a night copy laid over it */}
      <g className="vl-land-day">
        <Land c={DAY} air="vl-air-day" />
        <Meadow />
      </g>
      <g className="vl-land-night" opacity={time === 'night' ? 1 : time === 'dusk' ? 0.45 : 0}>
        <Land c={NIGHT} air="vl-air-night" />
      </g>
      {children}
    </g>
  )
}

/**
 * A low dry-stone wall seen from the side, with a wooden gate in the middle.
 * The wall stands on (x, y) and is `w` wide. The gate leaf is .pen-gate: it swings open
 * by squashing it with scaleX towards its hinge on the left edge of the gap.
 */
export function Pen({ x = 0, y = 0, w = 560, gap = 130, s = 1, tutor = 'the stone pen' }: { x?: number; y?: number; w?: number; gap?: number; s?: number; tutor?: string }) {
  const stones: [number, number, number][] = []
  const half = w / 2
  for (let row = 0; row < 3; row++) {
    const h = 26
    const yy = -row * h - h / 2 - 2
    for (let sx = -half + (row % 2) * 22; sx < half - 10; sx += 46) {
      if (Math.abs(sx + 20) < gap / 2 + 18) continue
      stones.push([sx + 20, yy, row])
    }
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <ellipse cx={0} cy={4} rx={half + 30} ry={14} fill={N.shadow} opacity={0.25} />
      {stones.map(([sx, sy, row], i) => (
        <g key={i}>
          <ellipse cx={sx} cy={sy} rx={25} ry={15} fill={row === 2 ? '#c9c1bb' : '#a99f9c'} />
          <ellipse cx={sx + 6} cy={sy + 5} rx={18} ry={8} fill="#7b706f" opacity={0.55} />
          <ellipse cx={sx - 8} cy={sy - 6} rx={9} ry={4} fill={N.white} opacity={0.25} />
        </g>
      ))}
      {/* gate posts */}
      {[-gap / 2 - 4, gap / 2 + 4].map((px) => (
        <g key={px}>
          <rect x={px - 9} y={-112} width={18} height={114} rx={6} fill={N.woodDark} />
          <rect x={px - 5} y={-108} width={6} height={106} rx={3} fill={N.wood} />
        </g>
      ))}
      {/* the gate leaf */}
      <g className="pen-gate" style={{ transformBox: 'fill-box', transformOrigin: 'left center' } as CSSProperties}>
        {[-78, -48].map((gy) => (
          <rect key={gy} x={-gap / 2 + 5} y={gy} width={gap - 10} height={14} rx={6} fill={N.woodLight} />
        ))}
        {[-gap / 2 + 18, 0, gap / 2 - 18].map((gx) => (
          <rect key={gx} x={gx - 6} y={-92} width={12} height={74} rx={5} fill={N.wood} />
        ))}
        <path d={`M${-gap / 2 + 12} -24 L${gap / 2 - 12} -84`} stroke={N.wood} strokeWidth={10} strokeLinecap="round" />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Sheep, pebbles and the bag                                           */
/* ------------------------------------------------------------------ */

/**
 * A fluffy sheep standing on (0, 0), facing left (flip to face right); about 130 wide and 110 tall.
 * Set the CSS variable --walk to 1 on it (or on any group around it) and its legs and body
 * trot on the spot; 0 stands still. GSAP can set it: tl.set(el, { '--walk': 1 }).
 */
export function Sheep({ x = 0, y = 0, s = 1, flip = false, className, tutor, wool = N.cream, style }: { x?: number; y?: number; s?: number; flip?: boolean; className?: string; tutor?: string; wool?: string; style?: CSSProperties }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} data-tutor={tutor} style={style}>
      <ellipse cy={3} rx={56} ry={9} fill={N.shadow} opacity={0.28} />
      {/* legs: far pair darker, near pair in front */}
      <g className="sheep-leg-b">
        <rect x={20} y={-34} width={11} height={36} rx={5} fill={N.night0} />
      </g>
      <g className="sheep-leg-f">
        <rect x={-30} y={-34} width={11} height={36} rx={5} fill={N.night0} />
      </g>
      <g className="sheep-bob">
        {/* tail */}
        <circle cx={58} cy={-58} r={13} fill={wool} />
        {/* the fleece: a cloud of overlapping puffs */}
        {[
          [-34, -58, 24],
          [-12, -74, 27],
          [16, -76, 27],
          [40, -64, 24],
          [-28, -44, 22],
          [36, -44, 22],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={wool} />
        ))}
        <ellipse cx={4} cy={-52} rx={54} ry={30} fill={wool} />
        <g filter="url(#fx-wet)">
          <path d="M-46 -40 Q-20 -24 20 -26 Q50 -28 58 -46 Q60 -28 40 -24 Q4 -14 -30 -22 Q-46 -28 -46 -40 Z" fill={N.sandDark} opacity={0.45} />
          <ellipse cx={10} cy={-38} rx={44} ry={12} fill={N.sand} opacity={0.35} />
          <path d="M30 -84 Q62 -76 62 -50 Q52 -66 30 -70 Z" fill={N.sandDark} opacity={0.3} />
        </g>
        {[
          [-30, -66, 9],
          [-6, -86, 10],
          [22, -88, 9],
          [42, -74, 8],
          [-14, -70, 7],
          [12, -72, 7],
        ].map(([cx, cy, r], i) => (
          <circle key={`h${i}`} cx={cx} cy={cy} r={r} fill={N.white} opacity={0.55} />
        ))}
        {[
          [-20, -56],
          [6, -60],
          [30, -54],
          [-4, -44],
          [22, -42],
        ].map(([cx, cy], i) => (
          <path key={`c${i}`} d={`M${cx - 7} ${cy} q7 -6 14 0`} stroke={N.sandDark} strokeWidth={1.6} fill="none" opacity={0.35} strokeLinecap="round" />
        ))}
        {/* head */}
        <g className="sheep-head">
          <ellipse cx={-62} cy={-68} rx={12} ry={7} fill={N.night1} transform="rotate(-24 -62 -68)" />
          <path d="M-40 -74 Q-58 -80 -68 -60 Q-76 -40 -66 -32 Q-58 -26 -50 -32 Q-36 -46 -40 -74 Z" fill={N.night1} />
          <path d="M-66 -56 Q-74 -40 -66 -32 Q-58 -27 -51 -33 Q-62 -38 -66 -56 Z" fill={N.night2} opacity={0.9} />
          <path d="M-46 -70 Q-56 -72 -62 -62" stroke={N.mist} strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" />
          <circle cx={-46} cy={-77} r={11} fill={wool} />
          <circle cx={-50} cy={-81} r={5} fill={N.white} opacity={0.6} />
          <ellipse cx={-58} cy={-58} rx={4.2} ry={3.6} fill={N.cream} />
          <circle cx={-59} cy={-58} r={2.4} fill={N.night0} />
          <circle cx={-60} cy={-59} r={0.9} fill={N.white} />
          <path d="M-63 -61 Q-58 -64 -54 -61" stroke={N.night0} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M-70 -37 q2 2 5 1" stroke={N.night0} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <ellipse cx={-36} cy={-66} rx={12} ry={6} fill={N.night1} transform="rotate(22 -36 -66)" />
        </g>
      </g>
    </g>
  )
}

/** A smooth counting pebble centred on (0, 0), about 34 wide. `seed` varies its shade a little. */
export function Pebble({ x = 0, y = 0, s = 1, seed = 0, className, tutor }: { x?: number; y?: number; s?: number; seed?: number; className?: string; tutor?: string }) {
  const tints = [N.stoneLight, '#d4cfe8', '#c7bfdf', '#ddd6ea']
  const tilt = ((seed * 37) % 30) - 15
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <g transform={`rotate(${tilt})`}>
        <ellipse cy={4} rx={17} ry={12} fill={N.stoneDark} />
        <ellipse rx={17} ry={12} fill={tints[seed % tints.length]} />
        <ellipse cx={-5} cy={-4} rx={7} ry={3.5} fill={N.white} opacity={0.6} />
      </g>
    </g>
  )
}

/** Ama's leather pebble bag standing on (0, 0), about 110 wide and 120 tall. */
export function Bag({ x = 0, y = 0, s = 1, open = false, className, tutor = "Ama's pebble bag" }: { x?: number; y?: number; s?: number; open?: boolean; className?: string; tutor?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <ellipse cy={4} rx={58} ry={10} fill={N.shadow} opacity={0.3} />
      <path d="M-40 -88 Q-66 -50 -56 -18 Q-48 2 0 2 Q48 2 56 -18 Q66 -50 40 -88 Z" fill={N.wood} />
      <path d="M14 -88 H40 Q66 -50 56 -18 Q48 2 0 2 Q38 -12 38 -44 Q36 -70 14 -88 Z" fill={N.woodDark} />
      <path d="M-40 -76 Q-54 -50 -48 -22" stroke={N.woodLight} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.8} />
      {open ? (
        <>
          <ellipse cy={-90} rx={44} ry={13} fill={N.woodDark} />
          <ellipse cy={-88} rx={36} ry={8} fill={N.night0} />
        </>
      ) : (
        <>
          <path d="M-30 -90 Q-34 -112 -14 -118 L14 -118 Q34 -112 30 -90 Z" fill={N.wood} />
          <rect x={-36} y={-98} width={72} height={11} rx={5} fill={N.sandDark} />
          <path d="M30 -94 Q52 -96 50 -70" stroke={N.sandDark} strokeWidth={5} fill="none" strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Hands                                                               */
/* ------------------------------------------------------------------ */

/**
 * A friendly open hand, palm towards us, wrist at (0, 0) and fingers up; about 150 wide and 230 tall.
 * `fingers` (0 to 5) are raised in counting order: index, middle, ring, little, then thumb.
 * Each raised finger is .finger-1 ... .finger-5 in that order, for lighting them up one at a time.
 * `flip` makes it a left hand.
 */
export function Hand({ x = 0, y = 0, s = 1, fingers = 5, flip = false, skin = N.skin2, skinDark = N.skin2Dark, className, tutor }: { x?: number; y?: number; s?: number; fingers?: number; flip?: boolean; skin?: string; skinDark?: string; className?: string; tutor?: string }) {
  // [base x, base y, length, angle] for index, middle, ring, little; the thumb is drawn apart.
  const F: [number, number, number, number][] = [
    [-30, -120, 92, -8],
    [-4, -126, 102, -1],
    [22, -122, 94, 6],
    [44, -110, 74, 14],
  ]
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} data-tutor={tutor}>
      <rect x={-34} y={-40} width={70} height={46} rx={18} fill={skinDark} />
      {F.map(([bx, by, len, ang], i) => {
        const up = i < fingers
        return (
          <g key={i} className={up ? `finger-${i + 1}` : undefined} transform={`translate(${bx} ${by}) rotate(${ang})`}>
            {up ? (
              <>
                <rect x={-12} y={-len} width={24} height={len + 20} rx={12} fill={skin} />
                <rect x={3} y={-len + 4} width={9} height={len + 14} rx={4.5} fill={skinDark} opacity={0.55} />
                <rect x={-7} y={-len + 4} width={13} height={16} rx={6} fill={N.cream} opacity={0.4} />
                <path d={`M-7 ${-len * 0.62} q7 3 14 0 M-6 ${-len * 0.3} q6 2.5 12 0`} stroke={skinDark} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
              </>
            ) : (
              <rect x={-12} y={-10} width={24} height={34} rx={12} fill={skinDark} />
            )}
          </g>
        )
      })}
      <path d="M-56 -112 Q-58 -40 -30 -20 Q0 -4 30 -20 Q60 -40 58 -112 Z" fill={skin} />
      <g filter="url(#fx-wet)">
        <path d="M20 -112 Q58 -112 58 -100 Q60 -40 30 -20 Q10 -10 -4 -12 Q30 -30 34 -66 Q36 -96 20 -112 Z" fill={skinDark} opacity={0.6} />
        <path d="M-46 -104 Q-50 -60 -30 -38 Q-40 -64 -38 -104 Z" fill={N.cream} opacity={0.25} />
      </g>
      <path d="M-40 -64 Q-4 -40 34 -64" stroke={skinDark} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      <path d="M-30 -86 Q-10 -76 10 -88" stroke={skinDark} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.4} />
      {/* thumb */}
      <g className={fingers >= 5 ? 'finger-5' : undefined} transform="translate(-52 -70)">
        {fingers >= 5 ? (
          <>
            <rect x={-12} y={-70} width={24} height={86} rx={12} fill={skin} transform="rotate(-38)" />
            <rect x={-7} y={-64} width={14} height={13} rx={6} fill={N.cream} opacity={0.55} transform="rotate(-38)" />
          </>
        ) : (
          <rect x={-12} y={-36} width={24} height={52} rx={12} fill={skinDark} transform="rotate(30)" />
        )}
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Sticks, bundles and two-digit numbers                                */
/* ------------------------------------------------------------------ */

/** One loose counting stick, standing upright on (0, 0); 14 wide and 140 tall. */
export function Stick({ x = 0, y = 0, s = 1, rot = 0, className, tutor }: { x?: number; y?: number; s?: number; rot?: number; className?: string; tutor?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} data-tutor={tutor}>
      <rect x={-7} y={-140} width={14} height={140} rx={7} fill={N.wood} />
      <rect x={-7} y={-140} width={6} height={140} rx={3} fill={N.woodLight} />
      <ellipse cy={-136} rx={6} ry={4} fill={N.sandLight} />
    </g>
  )
}

/** Ten sticks tied with a violet ribbon, standing on (0, 0); about 96 wide and 150 tall. */
export function Bundle({ x = 0, y = 0, s = 1, className, tutor }: { x?: number; y?: number; s?: number; className?: string; tutor?: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} data-tutor={tutor}>
      <ellipse cy={3} rx={50} ry={8} fill={N.shadow} opacity={0.28} />
      {Array.from({ length: 10 }, (_, i) => {
        const k = i - 4.5
        return <Stick key={i} x={k * 8} y={0} rot={k * 0.7} />
      })}
      <rect x={-46} y={-82} width={92} height={18} rx={8} fill={N.violet} />
      <rect x={-46} y={-82} width={92} height={6} rx={3} fill={N.violetLight} opacity={0.8} />
      <path d="M0 -74 Q-26 -98 -30 -76 Q-26 -60 0 -74 Q26 -98 30 -76 Q26 -60 0 -74 Z" fill={N.violetDark} />
      <circle cy={-74} r={6} fill={N.violetLight} />
    </g>
  )
}

/**
 * A two-digit number as tiles: the tens digit violet (bundles of ten), the ones digit gold
 * (loose ones). Centred on (x, y). The tiles are .pv-tens and .pv-ones.
 */
export function PlaceNumber({ value, x = 800, y = 450, size = 72, className, tutor }: { value: number; x?: number; y?: number; size?: number; className?: string; tutor?: string }) {
  const tens = Math.floor(value / 10)
  const ones = value % 10
  const w = size * 1.05
  const h = size * 1.3
  const tile = (cls: string, cx: number, digit: number, fill: string, ink: string) => (
    <g className={cls} transform={`translate(${cx} 0)`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.28} fill={fill} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      <rect x={-w / 2 + 8} y={-h / 2 + 6} width={w - 16} height={h * 0.13} rx={h * 0.06} fill={N.white} opacity={0.3} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={ink}>
        {digit}
      </text>
    </g>
  )
  return (
    <g className={className} transform={`translate(${x} ${y})`} data-tutor={tutor}>
      {tens > 0 && tile('pv-tens', -w / 2 - 5, tens, N.violet, N.white)}
      {tile('pv-ones', tens > 0 ? w / 2 + 5 : 0, ones, N.gold, N.night0)}
    </g>
  )
}

/**
 * A number line from `from` to `to`, starting at (x, y), `unit` pixels per one.
 * Every tick is .nl-tick-<n> and every label .nl-label-<n>, so a timeline can light one up.
 * Labels show every `labelEvery`; tens get taller ticks.
 */
export function NumberLine({ x = 200, y = 700, from = 0, to = 10, unit = 120, labelEvery = 1, size = 34, className, tutor = 'the number line' }: { x?: number; y?: number; from?: number; to?: number; unit?: number; labelEvery?: number; size?: number; className?: string; tutor?: string }) {
  const len = (to - from) * unit
  const ticks = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <g className={className} transform={`translate(${x} ${y})`} data-tutor={tutor}>
      <rect x={-20} y={-5} width={len + 50} height={10} rx={5} fill={N.cream} />
      <path d={`M${len + 30} -18 L${len + 54} 0 L${len + 30} 18 Z`} fill={N.cream} />
      {ticks.map((n) => {
        const tx = (n - from) * unit
        const big = n % 10 === 0
        return (
          <g key={n}>
            <rect className={`nl-tick-${n}`} x={tx - 3} y={big ? -26 : -16} width={6} height={big ? 52 : 32} rx={3} fill={N.cream} />
            {(n - from) % labelEvery === 0 && (
              <text className={`nl-label-${n}`} x={tx} y={big ? 66 : 56} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.gold}>
                {n}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
