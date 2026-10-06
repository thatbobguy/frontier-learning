import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type ArmPose, type Face, Person } from '../../art2/characters'
import { Glow, Vignette, rng } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { useDrag } from '../../engine/svg'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Bundle, Hand, NumberLine, PlaceNumber, Stick, Valley } from './art'

/*
 * Chapter 4: Bundling by ten.
 * Next stall along from Zorp's, in the same sunny market. The shopkeeper tips out a messy pile of
 * 34 sticks; counting one by one is slow, so ten sticks at a time fly together and get tied with a
 * violet ribbon. Ten fingers explain why ten. The same real sticks then become the tiles 34 (violet
 * tens, gold ones), are compared with 43, and jump along a number line. Last, the learner pays the
 * shopkeeper with bundles and loose sticks, using as few pieces as they can.
 */

export const CUES: Cue[] = [
  { id: 'pile', say: 'Counting one by one gets slow when there are lots of things. Look at this big pile of sticks.' },
  { id: 'guess', say: 'Your turn! About how many sticks are here? Take a guess.', play: true, quick: true },
  { id: 'bundle', say: 'Here is the trick. Count ten sticks and tie them into a bundle. Then do it again, and again.' },
  { id: 'why-ten', say: 'Why ten? Look at your hands! Ten fingers made ten an easy number to count to.' },
  {
    id: 'tens-ones',
    say: 'Now the messy pile is three bundles and four loose sticks. We write that as 34. The 3 tells how many bundles of ten. The 4 tells how many loose ones.',
  },
  { id: 'place-matters', say: 'Where a digit sits changes what it means. 34 and 43 use the same digits, but 43 has four bundles. That is more!' },
  { id: 'number-line', say: 'On a number line, 34 is three big jumps of ten, then four small steps of one.' },
  {
    id: 'bundle-builder',
    say: 'Now you try! Pay the shopkeeper using bundles of ten and loose sticks. Use as few pieces as you can.',
    play: true,
  },
]

/* ------------------------------------------------------------------ */
/* Lines the world says back (fixed, so they can be pre-recorded)       */
/* ------------------------------------------------------------------ */

const GUESS_LINE = 'Good guess! Counting one by one would take ages!'

const SHOP = {
  less: 'Not enough yet.',
  more: 'That is too much.',
  fewer: "That's right, but could you use fewer pieces?",
  tie: 'Ten loose sticks can be tied into one bundle.',
  less40: 'Not enough. Look at the colour of the 4.',
  more23: 'Too much. Look at the colour of the 2.',
  more15: 'Too much. Look at the colour of the 1.',
  full: 'There is no more room for those.',
  ribbon: 'The ribbon ties ten loose sticks together.',
} as const

const WIN = [
  'Two bundles and three sticks. That is 23!',
  'Four bundles and no loose sticks. That is 40!',
  'One bundle and five sticks make 15. Bundles count tens, and sticks count ones!',
] as const

/* ------------------------------------------------------------------ */
/* Where things are (stage coordinates)                                 */
/* ------------------------------------------------------------------ */

type Pt = { x: number; y: number }

/** The counter's top edge: everything on the counter stands here. */
const CY = 640
/** The shopkeeper stands behind the counter; feet hidden. */
const KEEP = { x: 1460, y: CY + 117, s: 1.3 }
/** The sack the pile comes out of: drawn standing on (x, y), tipped around its lower left corner. */
const SACK = { x: 1460, y: CY, px: 1405, py: CY }
const MOUTH = { x: 1296, y: 565 }

/** A stick is drawn centred on its group's origin, so GSAP can spin it about its middle. */
const HALF = 70

/** The messy pile: 34 sticks heaped on the counter at all angles. */
const PILE = (() => {
  const r = rng(34)
  return Array.from({ length: 34 }, () => {
    const h = Math.pow(r(), 1.5)
    const half = 300 * (1 - 0.7 * h)
    const x = 850 + (r() * 2 - 1) * half
    const sign = r() < 0.5 ? -1 : 1
    const rot = sign * (24 + r() * 64)
    const a = (rot * Math.PI) / 180
    const y = CY - 4 - HALF * Math.abs(Math.cos(a)) - 7 * Math.abs(Math.sin(a)) - h * 105
    return { x, y, r: rot }
  })
})()

/** The order the sticks tumble out of the sack. */
const POUR = (() => {
  const r = rng(5)
  const ids = Array.from({ length: 34 }, (_, i) => i)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
})()

/** Four sticks near the front of the pile, left to right, for counting one by one. */
const DEMO = (() => {
  const front = PILE.map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.y - a.y)
    .slice(0, 12)
    .sort((a, b) => a.x - b.x)
  return [1, 4, 7, 10].map((k) => front[k].i)
})()

/** Where the three bundles and the four loose sticks stand once the pile is sorted. */
const B_HOME: Pt[] = [300, 420, 540].map((x) => ({ x, y: CY }))
const L_HOME: Pt[] = [0, 1, 2, 3].map((j) => ({ x: 640 + j * 36, y: CY }))

/** Stick n of a bundle standing on b, like the kit's Bundle. `spread` > 1 leaves gaps before the tie. */
function inBundle(b: Pt, n: number, spread = 1) {
  const k = n - 4.5
  const rot = k * 0.7
  const a = (rot * Math.PI) / 180
  return { x: b.x + k * 8 * spread + HALF * Math.sin(a), y: b.y - HALF * Math.cos(a), r: rot }
}

/** The tiles for 34 (cue 5), one PlaceNumber cut in two so each tile can move on its own. */
const PN34 = { x: 520, y: 300, size: 120 }
const TW = PN34.size * 1.05
const T3: Pt = { x: PN34.x - TW / 2 - 5, y: PN34.y }
const T4: Pt = { x: PN34.x + TW / 2 + 5, y: PN34.y }

/** Cue 6: the 34 slides left and 43 is built on the right. */
const SLIDE = -110
const PN43 = { x: 1060, y: 300 }
const U4: Pt = { x: PN43.x - TW / 2 - 5, y: PN43.y }
const U3: Pt = { x: PN43.x + TW / 2 + 5, y: PN43.y }
const B43 = [800, 920, 1040, 1160]
const S43 = [1260, 1296, 1332]

/** Hands for "why ten". */
const HS = 1.55
const HL: Pt = { x: 900, y: 960 }
const HR: Pt = { x: 1260, y: 960 }
const HC: Pt = { x: 1080, y: 360 }

/** The number line on the chalkboard (cue 7). */
const NL = { x0: 210, unit: 27, y: 540 }
const nx = (v: number) => NL.x0 + v * NL.unit
const B_BOARD: Pt[] = [5, 15, 25].map((v) => ({ x: nx(v), y: 372 }))
const LS = 0.72
const L_BOARD: Pt[] = [0, 1, 2, 3].map((j) => ({ x: nx(30.5 + j), y: 492 }))
const PN_BOARD = { x: nx(34), y: 250, s: 0.667 }

/* Finger geometry, copied from the kit's Hand so lights land on the fingertips. */
const FING: [number, number, number, number][] = [
  [-30, -120, 92, -8],
  [-4, -126, 102, -1],
  [22, -122, 94, 6],
  [44, -110, 74, 14],
]
function fingerTip(f: number): Pt {
  if (f === 5) {
    const a = (-38 * Math.PI) / 180
    return { x: -52 + 70 * Math.sin(a), y: -70 - 70 * Math.cos(a) }
  }
  const [bx, by, len, ang] = FING[f - 1]
  const a = (ang * Math.PI) / 180
  return { x: bx + len * Math.sin(a), y: by - len * Math.cos(a) }
}
/** Ten fingers counted left to right across both hands: [hand, finger class]. */
const COUNT_ORDER: ['L' | 'R', number][] = [
  ['L', 4],
  ['L', 3],
  ['L', 2],
  ['L', 1],
  ['L', 5],
  ['R', 5],
  ['R', 1],
  ['R', 2],
  ['R', 3],
  ['R', 4],
]
const TIPS: Pt[] = COUNT_ORDER.map(([h, f]) => {
  const t = fingerTip(f)
  const at = h === 'L' ? HL : HR
  return { x: at.x + HS * (h === 'L' ? -t.x : t.x), y: at.y + HS * t.y }
})

/* ------------------------------------------------------------------ */
/* What Pip sees                                                        */
/* ------------------------------------------------------------------ */

const STATE: string[] = [
  'A sunny market stall, next along from Zorp\'s. The shopkeeper (green robe, straw hat) tips a sack and a big messy pile of 34 sticks tumbles onto the counter at all angles. Four sticks light up and get counted one by one (1, 2, 3, 4) to show how slow that is. The camera pushes in on the pile and a pink question mark appears: how many?',
  '',
  'Sticks fly out of the pile ten at a time. Each ten is counted on a gold counter (1 to 10) and tied with a violet ribbon into a bundle, with a snap. It happens three times: three bundles of ten, and 4 loose sticks left over, standing in a row.',
  'Two big hands rise up. Their fingers light up gold one at a time, counting 1 to 10 on a gold tile. The 10 flies to the first bundle, which glows violet: ten fingers, one bundle of ten. People bundle by ten because we have ten fingers.',
  'The 3 bundles and 4 loose sticks stand on the counter. Violet sparks fly from the bundles into a violet tile 3, and gold sparks from the loose sticks into a gold tile 4: together they read 34. A violet link joins the 3 to the bundles (each bundle glows in turn) and a gold link joins the 4 to the loose sticks (each lights up in turn).',
  'Two numbers side by side. Left: 34 with its 3 bundles and 4 loose sticks. Right: copies of the digits swap places and colours to make 43 (violet 4, gold 3), then 4 bundles and 3 loose sticks drop in under it. The fourth bundle glows: 43 has one more bundle of ten than 34, so 43 is more.',
  'A chalkboard rises with a number line from 0 to 40. The three bundles jump onto it as three big violet jumps of ten (0 to 10, 10 to 20, 20 to 30), then the four loose sticks as four small gold steps of one (31, 32, 33, 34). A gold dot lands on 34, under the tiles 3 and 4.',
]

/* ------------------------------------------------------------------ */
/* Little pieces of art                                                 */
/* ------------------------------------------------------------------ */

/** The violet ribbon of a bundle of ten, drawn exactly like the kit's Bundle (base at the origin). */
function Ribbon() {
  return (
    <g>
      <rect x={-46} y={-82} width={92} height={18} rx={8} fill={N.violet} />
      <rect x={-46} y={-82} width={92} height={6} rx={3} fill={N.violetLight} opacity={0.8} />
      <path d="M0 -74 Q-26 -98 -30 -76 Q-26 -60 0 -74 Q26 -98 30 -76 Q26 -60 0 -74 Z" fill={N.violetDark} />
      <circle cy={-74} r={6} fill={N.violetLight} />
    </g>
  )
}

/** A gold number tile (an amount and its name). */
function NumTile({ x = 0, y = 0, n, size = 48 }: { x?: number; y?: number; n: number; size?: number }) {
  const w = Math.max(size * 1.3, String(n).length * size * 0.62 + size * 0.7)
  const h = size * 1.35
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.3} fill={N.gold} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.night0}>
        {n}
      </text>
    </g>
  )
}

/** A gold counter that ticks 1 to 10: one tile with ten stacked numbers, shown one at a time. */
function Counter({ x, y, cls, size = 52 }: { x: number; y: number; cls: string; size?: number }) {
  const w = 2 * size * 0.62 + size * 0.7
  const h = size * 1.35
  return (
    <g className={cls} transform={`translate(${x} ${y})`}>
      <Glow r={size * 1.6} color="warm" opacity={0.55} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.3} fill={N.gold} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      {Array.from({ length: 10 }, (_, n) => (
        <text key={n} className={`${cls}-n ${cls}-${n}`} y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.night0}>
          {n + 1}
        </text>
      ))}
    </g>
  )
}

/** A soft white cloud. */
function Puff({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.92}>
      <ellipse rx={90} ry={26} fill={N.white} />
      <circle cx={-34} cy={-12} r={30} fill={N.white} />
      <circle cx={14} cy={-24} r={38} fill={N.white} />
      <ellipse cy={10} rx={84} ry={12} fill="#d9ecff" />
    </g>
  )
}

/** A little far-off market stall, standing on (x, y). */
function FarStall({ x, y, s = 1, stripe }: { x: number; y: number; s?: number; stripe: string }) {
  const w = 220
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-w / 2 + 6} y={-150} width={12} height={150} fill={N.woodDark} />
      <rect x={w / 2 - 18} y={-150} width={12} height={150} fill={N.woodDark} />
      <rect x={-w / 2 - 6} y={-62} width={w + 12} height={62} rx={6} fill={N.wood} />
      <rect x={-w / 2 - 10} y={-70} width={w + 20} height={14} rx={6} fill={N.woodLight} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${-w / 2 + (i * w) / 6} -176 h${w / 6} v40 q${-w / 12} 16 ${-w / 6} 0 Z`} fill={i % 2 ? N.cream : stripe} />
      ))}
      <rect x={-w / 2 - 6} y={-186} width={w + 12} height={14} rx={6} fill={N.woodDark} />
    </g>
  )
}

/** The shopkeeper: green robe, straw hat (no lesson colours on their clothes). Stands behind the counter. */
function Shopkeeper({ pose, face }: { pose: ArmPose; face: Face }) {
  return (
    <g transform={`translate(${KEEP.x} ${KEEP.y}) scale(${KEEP.s})`}>
      <Person flip pose={pose} face={face} skin={N.skin2} skinDark={N.skin2Dark} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} head="hair" headColor={N.woodDark} headDark={N.woodDark} />
      <g transform="translate(0 -206)">
        <ellipse cy={-30} rx={66} ry={13} fill={N.sandDark} />
        <ellipse cy={-33} rx={62} ry={11} fill={N.sand} />
        <path d="M-36 -34 Q-36 -78 0 -80 Q36 -78 36 -34 Z" fill={N.sandLight} />
        <path d="M10 -78 Q36 -74 36 -34 H18 Q22 -60 10 -78 Z" fill={N.sand} />
        <rect x={-36} y={-48} width={72} height={11} rx={4} fill={N.leafDark} />
      </g>
    </g>
  )
}

/** The burlap sack the sticks come out of, standing on (0, 0). */
function Sack() {
  return (
    <g>
      <path d="M-52 0 Q-64 -60 -40 -104 L40 -104 Q64 -60 52 0 Z" fill={N.sandDark} />
      <path d="M20 -104 H40 Q64 -60 52 0 H26 Q44 -50 20 -104 Z" fill={N.woodLight} opacity={0.5} />
      <path d="M-38 -94 Q-52 -60 -44 -14" stroke={N.sandLight} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.7} />
      <ellipse cy={-104} rx={42} ry={11} fill={N.woodDark} />
      {[-20, -4, 12, 26].map((sx, i) => (
        <g key={i} transform={`translate(${sx} -104) rotate(${-14 + i * 9})`}>
          <rect x={-5} y={-40} width={10} height={44} rx={5} fill={N.wood} />
          <rect x={-5} y={-40} width={4} height={44} rx={2} fill={N.woodLight} />
        </g>
      ))}
    </g>
  )
}

/** A chalk slate hanging on a string from (0, 0). Its face is 240 by 150. */
function Slate({ n, w = 240, h = 150, size = 84, drop = 120 }: { n: number; w?: number; h?: number; size?: number; drop?: number }) {
  return (
    <g>
      <path d={`M0 -40 V${drop} M${-w * 0.28} ${drop + 6} L0 ${drop - 34} L${w * 0.28} ${drop + 6}`} stroke={N.woodDark} strokeWidth={4} fill="none" strokeLinejoin="round" />
      <rect x={-w / 2} y={drop} width={w} height={h} rx={22} fill={N.woodDark} />
      <rect x={-w / 2 + 12} y={drop + 12} width={w - 24} height={h - 24} rx={14} fill={N.night1} />
      <rect x={-w / 2 + 22} y={drop + 20} width={w - 44} height={8} rx={4} fill={N.white} opacity={0.08} />
      <text x={0} y={drop + h / 2 + size * 0.34} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.cream}>
        {n}
      </text>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The market around us                                                 */
/* ------------------------------------------------------------------ */

function Market() {
  const flags = Array.from({ length: 21 }, (_, i) => i)
  const flagCols = [N.skyLight, N.cream, N.leafLight, N.sandLight]
  const sag = (x: number) => 104 + 40 * Math.sin((x / 1600) * Math.PI)
  return (
    <g>
      {/* far stalls along the street, a little hazy */}
      <g>
        <FarStall x={200} y={604} s={0.62} stripe={N.skyLight} />
        <FarStall x={660} y={600} s={0.5} stripe={N.leafLight} />
        <FarStall x={1110} y={604} s={0.58} stripe={N.sandLight} />
        <rect x={-400} y={430} width={2400} height={220} fill={N.white} opacity={0.16} />
      </g>
      <Puff x={560} y={150} s={0.55} />
      {/* bunting across the top */}
      <path d={`M-20 ${sag(-20)} ${flags.map((i) => `L${i * 80} ${sag(i * 80)}`).join(' ')} L1620 ${sag(1620)}`} stroke={N.woodDark} strokeWidth={3} fill="none" />
      {flags.map((i) => {
        const x = i * 80 + 40
        const y = sag(x)
        return <path key={i} d={`M${x - 22} ${y - 2} L${x + 22} ${y - 2} L${x} ${y + 36} Z`} fill={flagCols[i % flagCols.length]} />
      })}
      {/* awning posts */}
      <rect x={24} y={40} width={26} height={620} rx={8} fill={N.woodDark} />
      <rect x={1550} y={40} width={26} height={620} rx={8} fill={N.woodDark} />
      <rect x={30} y={40} width={8} height={620} rx={4} fill={N.wood} />
      <rect x={1556} y={40} width={8} height={620} rx={4} fill={N.wood} />
    </g>
  )
}

/** The striped awning we stand under, across the top of the stage. */
function Awning() {
  return (
    <g>
      {Array.from({ length: 17 }, (_, i) => (
        <path key={i} d={`M${i * 100 - 50} 0 h100 v52 q-50 30 -100 0 Z`} fill={i % 2 ? N.cream : N.sky} />
      ))}
      <rect x={-60} y={0} width={1720} height={14} fill={N.skyDark} opacity={0.5} />
    </g>
  )
}

/** The counter: a cream cloth over the top, wooden front below. */
function Counter2() {
  return (
    <g>
      <rect x={-400} y={650} width={2400} height={600} fill={N.wood} />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={-60 + i * 210} y={704} width={170} height={300} rx={14} fill={N.woodDark} opacity={0.22} />
      ))}
      <rect x={-400} y={596} width={2400} height={46} fill={N.cream} />
      <rect x={-400} y={596} width={2400} height={6} fill={N.sandLight} />
      <rect x={-400} y={636} width={2400} height={8} fill={N.sandLight} opacity={0.8} />
      {Array.from({ length: 34 }, (_, i) => (
        <path key={i} d={`M${i * 60 - 220} 642 h60 v12 q-30 20 -60 0 Z`} fill={N.skyLight} />
      ))}
    </g>
  )
}

/** Market things close to us at the bottom corners, for depth. */
function Foreground() {
  return (
    <g pointerEvents="none">
      {/* a crate of melons, bottom left */}
      <g transform="translate(-30 760)">
        {[30, 100, 168].map((mx, i) => (
          <g key={i}>
            <ellipse cx={mx} cy={-6 - (i % 2) * 10} rx={44} ry={36} fill={N.leaf} />
            <path d={`M${mx - 20} ${-36 - (i % 2) * 10} Q${mx - 26} ${-6} ${mx - 20} ${24}`} stroke={N.leafDark} strokeWidth={7} fill="none" />
            <path d={`M${mx + 14} ${-38 - (i % 2) * 10} Q${mx + 20} ${-6} ${mx + 14} ${26}`} stroke={N.leafDark} strokeWidth={7} fill="none" />
          </g>
        ))}
        <rect x={-30} y={10} width={250} height={160} rx={12} fill={N.woodDark} />
        <rect x={-30} y={10} width={250} height={18} rx={8} fill={N.wood} />
        <path d="M-20 70 H210 M-20 120 H210" stroke={N.wood} strokeWidth={10} opacity={0.6} />
      </g>
      {/* clay pots, bottom right */}
      <g transform="translate(1500 900)">
        <path d="M-70 0 Q-110 -90 -60 -150 H40 Q90 -90 50 0 Z" fill={N.sandDark} />
        <path d="M10 -150 H40 Q90 -90 50 0 H20 Q56 -80 10 -150 Z" fill={N.woodLight} opacity={0.5} />
        <rect x={-70} y={-172} width={120} height={26} rx={10} fill={N.sand} />
        <path d="M80 0 Q60 -60 100 -96 H170 Q200 -60 180 0 Z" fill={N.sand} />
        <rect x={92} y={-112} width={90} height={20} rx={8} fill={N.sandLight} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chapter                                                          */
/* ------------------------------------------------------------------ */

type Mood = 'wait' | 'count' | 'less' | 'more' | 'fewer' | 'yes'
const MOODS: Record<Mood, [ArmPose, Face]> = {
  wait: ['down', 'smile'],
  count: ['point', 'think'],
  less: ['hold', 'calm'],
  more: ['think', 'wow'],
  fewer: ['think', 'think'],
  yes: ['cheer', 'smile'],
}
const KEEP_POSE: [ArmPose, Face][] = [
  ['down', 'smile'],
  ['think', 'think'],
  ['down', 'wow'],
  ['wave', 'smile'],
  ['point', 'smile'],
  ['down', 'wow'],
  ['point', 'smile'],
]

const GUESSES = [20, 35, 50] as const

export function Ch4Bundles({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const [guess, setGuess] = useState<number | undefined>(() => (typeof memory.bundleGuess === 'number' ? memory.bundleGuess : undefined))
  const [picked, setPicked] = useState(false)
  const [mood, setMood] = useState<Mood>('wait')
  const [done, setDone] = useState(false)
  const guessing = cueIndex === 1 && !picked
  const myTurn = cueIndex === 7 && !done

  const build = useCallback((tl: gsap.core.Timeline) => {
    const later = { immediateRender: false }
    const st = (i: number) => `.c4-st-${i}`
    const cam = (s: number, cx: number, cy: number, at: number, dur = 1.4, ease = 'power3.inOut') =>
      tl.to('.c4-cam', { scale: s, x: 800 - s * cx, y: 450 - s * cy, duration: dur, ease }, at)
    const bounce = (sel: string, at: number, lift = 20) => {
      tl.to(sel, { y: -lift, duration: 0.14, ease: 'power2.out' }, at)
      tl.to(sel, { y: 0, duration: 0.45, ease: 'bounce.out' }, at + 0.14)
    }

    /* ---------------- the starting state ---------------- */
    tl.set('.c4-cam', { svgOrigin: '0 0', x: 0, y: 0, scale: 1 }, 0)
    tl.set('.c4-keep-a', { opacity: 1 }, 0)
    tl.set('.c4-keep-b', { opacity: 0 }, 0)
    tl.set('.c4-sack', { rotation: 0, x: 0, y: 0, opacity: 1, svgOrigin: `${SACK.px} ${SACK.py}` }, 0)
    for (let i = 0; i < 34; i++) tl.set(st(i), { x: MOUTH.x, y: MOUTH.y, rotation: -70, scale: 1, opacity: 0, transformOrigin: '50% 50%' }, 0)
    B_HOME.forEach((b, k) => {
      tl.set(`.c4-rib-${k}`, { x: b.x, y: b.y, scaleX: 0, opacity: 0, transformOrigin: '50% 50%' }, 0)
      tl.set(`.c4-bsh-${k}`, { x: b.x, y: b.y, opacity: 0 }, 0)
      tl.set(`.c4-burst-${k}`, { opacity: 0, scale: 0.3, svgOrigin: `${b.x} ${b.y - 74}` }, 0)
      tl.set(`.c4-bun-${k}`, { y: 0 }, 0)
    })
    tl.set(['.c4-bglow', '.c4-lglow', '.c4-dg', '.c4-cnt-0', '.c4-cnt-1', '.c4-cnt-2', '.c4-cnt-0-n', '.c4-cnt-1-n', '.c4-cnt-2-n', '.c4-hc-n', '.c4-fg', '.c4-links34 > g', '.c4-spk'], { opacity: 0 }, 0)
    tl.set('.c4-db', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
    tl.set('.c4-q', { opacity: 0, scale: 0.3, svgOrigin: '850 400' }, 0)
    tl.set('.c4-slates', { y: -360, opacity: 0 }, 0)
    tl.set('.c4-recall', { y: -300, opacity: 0 }, 0)
    tl.set('.c4-hands', { y: 520 }, 0)
    COUNT_ORDER.forEach(([h, f]) => tl.set(`.c4-hand-${h} .finger-${f} > rect:first-child`, { attr: { fill: N.skin1 } }, 0))
    tl.set('.c4-hcount', { x: 0, y: 0, scale: 1, opacity: 0, svgOrigin: `${HC.x} ${HC.y}` }, 0)
    tl.set('.c4-g34', { x: 0, y: 0, opacity: 1 }, 0)
    tl.set(['.c4-t3 .pv-ones', '.c4-t4 .pv-tens', '.c4-f3v .pv-ones', '.c4-f4g .pv-tens', '.c4-u3 .pv-tens', '.c4-u4 .pv-ones'], { opacity: 0 }, 0)
    tl.set('.c4-t3', { x: 0, y: 0, opacity: 0, scale: 0.3, svgOrigin: `${T3.x} ${T3.y}` }, 0)
    tl.set('.c4-t4', { x: 0, y: 0, opacity: 0, scale: 0.3, svgOrigin: `${T4.x} ${T4.y}` }, 0)
    tl.set(['.c4-t3g', '.c4-t4g'], { opacity: 0 }, 0)
    tl.set(['.c4-f3v', '.c4-f4g'], { x: 0, y: 0, opacity: 0 }, 0)
    tl.set('.c4-u3', { x: T3.x + SLIDE - U3.x, y: 0, opacity: 0, scale: 1, svgOrigin: `${U3.x} ${U3.y}` }, 0)
    tl.set('.c4-u4', { x: T4.x + SLIDE - U4.x, y: 0, opacity: 0, scale: 1, svgOrigin: `${U4.x} ${U4.y}` }, 0)
    tl.set('.c4-g43', { opacity: 1 }, 0)
    tl.set(['.c4-b43', '.c4-s43'], { y: -420, opacity: 0 }, 0)
    tl.set(['.c4-links43 > g', '.c4-x43'], { opacity: 0 }, 0)
    tl.set('.c4-board', { y: 560 }, 0)
    tl.set(['.c4-arc', '.c4-step'], { opacity: 0, strokeDashoffset: 1 }, 0)
    tl.set('.c4-dline', { opacity: 0, strokeDashoffset: 1 }, 0)
    tl.set('.c4-ball', { x: nx(0), y: NL.y - 16, opacity: 0 }, 0)
    tl.set('.c4-mark', { opacity: 0, scale: 0.3, svgOrigin: `${nx(34)} ${NL.y}` }, 0)
    tl.set('.c4-board .nl-tick-34', { attr: { fill: N.cream } }, 0)
    tl.set('.c4-game', { opacity: 0 }, 0)
    tl.set('.c4-mat', { opacity: 0 }, 0)
    tl.set('.c4-item', { y: -520, opacity: 0 }, 0)
    tl.set('.c4-tag', { y: -440 }, 0)
    tl.set(['.c4-baskets', '.c4-spool'], { y: 320 }, 0)

    /* ---------------- 0. The pile ---------------- */
    tl.addLabel('b0', 0)
    tl.to('.c4-sack', { rotation: -80, duration: 0.45, ease: 'back.out(1.6)' }, 0.25)
    POUR.forEach((i, n) => {
      const t = 0.5 + n * 0.045
      const p = PILE[i]
      const apex = Math.min(p.y, MOUTH.y) - 80 - (n % 5) * 16
      tl.set(st(i), { opacity: 1 }, t)
      tl.to(st(i), { x: p.x, duration: 0.62, ease: 'power1.out' }, t)
      tl.to(st(i), { y: apex, duration: 0.26, ease: 'power2.out' }, t)
      tl.to(st(i), { y: p.y, duration: 0.36, ease: 'power2.in' }, t + 0.26)
      tl.to(st(i), { rotation: p.r, duration: 0.62, ease: 'power1.out' }, t)
    })
    tl.to('.c4-sack', { y: 190, duration: 0.5, ease: 'power2.in' }, 2.6)
    tl.to('.c4-keep-a', { opacity: 0, duration: 0.25 }, 2.75)
    tl.to('.c4-keep-b', { opacity: 1, duration: 0.25 }, 2.75)
    DEMO.forEach((_, n) => {
      const t = 2.9 + n * 0.6
      tl.to(`.c4-dg-${n}`, { opacity: 1, duration: 0.2 }, t)
      tl.to(`.c4-db-${n}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, t)
    })
    tl.to(['.c4-dg', '.c4-db'], { opacity: 0, duration: 0.4 }, 5.3)
    cam(1.3, 850, 480, 5.0, 1.5)
    tl.to('.c4-q', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, 6.3)

    /* ---------------- 1. The guess: slates swing down ---------------- */
    const B1 = 7.6
    tl.addLabel('b1', B1)
    tl.to('.c4-slates', { y: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.4)' }, B1 + 0.1)
    tl.to('.c4-q', { opacity: 0, scale: 0.5, duration: 0.35 }, B1 + 0.1)

    /* ---------------- 2. Bundle by ten ---------------- */
    const B2 = B1 + 1.2
    tl.addLabel('b2', B2)
    tl.to('.c4-slates', { y: -380, opacity: 0, duration: 0.6, ease: 'power2.in' }, B2)
    cam(1.22, 700, 520, B2 + 0.1, 1.3)
    const tie = (k: number, at: number) => {
      for (let n = 0; n < 10; n++) {
        const f = inBundle(B_HOME[k], n, 1)
        tl.to(st(k * 10 + n), { x: f.x, y: f.y, rotation: f.r, duration: 0.14, ease: 'power3.in' }, at)
      }
      tl.set(`.c4-rib-${k}`, { opacity: 1 }, at + 0.08)
      tl.to(`.c4-rib-${k}`, { scaleX: 1, duration: 0.3, ease: 'back.out(3)' }, at + 0.08)
      tl.to(`.c4-burst-${k}`, { keyframes: [{ opacity: 0.95, scale: 0.4, duration: 0.01 }, { opacity: 0, scale: 2.3, duration: 0.5, ease: 'power2.out' }] }, at + 0.14)
      tl.to(`.c4-bsh-${k}`, { opacity: 1, duration: 0.3 }, at + 0.1)
      tl.to(`.c4-cnt-${k}`, { opacity: 0, duration: 0.3 }, at + 0.2)
      bounce(`.c4-bun-${k}`, at + 0.12)
    }
    const gather = (k: number, start: number, gap: number, dur: number) => {
      tl.to(`.c4-cnt-${k}`, { opacity: 1, duration: 0.2 }, start)
      for (let n = 0; n < 10; n++) {
        const t = start + n * gap
        const f = inBundle(B_HOME[k], n, 1.6)
        tl.to(st(k * 10 + n), { x: f.x, y: f.y, rotation: f.r, duration: dur, ease: 'power2.out' }, t)
        tl.set(`.c4-cnt-${k}-${n}`, { opacity: 1 }, t + dur * 0.8)
        if (n > 0) tl.set(`.c4-cnt-${k}-${n - 1}`, { opacity: 0 }, t + dur * 0.8)
      }
    }
    gather(0, B2 + 0.6, 0.28, 0.34)
    tie(0, B2 + 3.65)
    gather(1, B2 + 4.25, 0.075, 0.38)
    tie(1, B2 + 5.4)
    gather(2, B2 + 5.9, 0.075, 0.38)
    tie(2, B2 + 7.05)
    L_HOME.forEach((p, j) => tl.to(st(30 + j), { x: p.x, y: p.y - HALF, rotation: 0, duration: 0.5, ease: 'power2.inOut' }, B2 + 7.45 + j * 0.1))

    /* ---------------- 3. Why ten? Ten fingers ---------------- */
    const B3 = B2 + 8.3
    tl.addLabel('b3', B3)
    cam(1, 800, 450, B3, 1.1)
    tl.to('.c4-hands', { y: 0, duration: 0.9, ease: 'back.out(1.3)' }, B3 + 0.2)
    tl.to('.c4-hcount', { opacity: 1, duration: 0.3 }, B3 + 1.1)
    COUNT_ORDER.forEach(([h, f], i) => {
      const t = B3 + 1.3 + i * 0.3
      tl.to(`.c4-hand-${h} .finger-${f} > rect:first-child`, { attr: { fill: N.gold }, duration: 0.15 }, t)
      tl.to(`.c4-fg-${i}`, { opacity: 1, duration: 0.2 }, t)
      tl.set(`.c4-hc-${i}`, { opacity: 1 }, t)
      if (i > 0) tl.set(`.c4-hc-${i - 1}`, { opacity: 0 }, t)
    })
    tl.to('.c4-hcount', { x: B_HOME[0].x - HC.x, y: 420 - HC.y, scale: 0.7, duration: 0.8, ease: 'power2.inOut' }, B3 + 4.5)
    tl.to('.c4-bglow-0', { opacity: 1, duration: 0.4 }, B3 + 5.2)
    bounce('.c4-bun-0', B3 + 5.2)
    tl.to('.c4-hcount', { opacity: 0, duration: 0.4 }, B3 + 5.7)

    /* ---------------- 4. Three bundles and four loose: 34 ---------------- */
    const B4 = B3 + 6.3
    tl.addLabel('b4', B4)
    tl.to('.c4-hands', { y: 560, duration: 0.7, ease: 'power2.in' }, B4)
    tl.to('.c4-bglow-0', { opacity: 0, duration: 0.4 }, B4)
    cam(1.12, 560, 450, B4 + 0.2, 1.4)
    B_HOME.forEach((_, k) => bounce(`.c4-bun-${k}`, B4 + 1.7 + k * 0.3, 16))
    L_HOME.forEach((p, j) => {
      tl.to(st(30 + j), { y: p.y - HALF - 16, duration: 0.12, ease: 'power2.out' }, B4 + 2.8 + j * 0.15)
      tl.to(st(30 + j), { y: p.y - HALF, duration: 0.3, ease: 'bounce.out' }, B4 + 2.92 + j * 0.15)
    })
    // sparks fly up from the real sticks into the tiles
    B_HOME.forEach((b, k) => {
      const at = B4 + 4.1 + k * 0.12
      tl.set(`.c4-spk-t-${k}`, { x: b.x, y: b.y - 74, opacity: 1 }, at)
      tl.to(`.c4-spk-t-${k}`, { x: T3.x, y: T3.y, duration: 0.5, ease: 'power2.in' }, at)
      tl.set(`.c4-spk-t-${k}`, { opacity: 0 }, at + 0.5)
    })
    tl.to('.c4-t3', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, B4 + 4.75)
    L_HOME.forEach((p, j) => {
      const at = B4 + 4.4 + j * 0.1
      tl.set(`.c4-spk-o-${j}`, { x: p.x, y: p.y - 140, opacity: 1 }, at)
      tl.to(`.c4-spk-o-${j}`, { x: T4.x, y: T4.y, duration: 0.45, ease: 'power2.in' }, at)
      tl.set(`.c4-spk-o-${j}`, { opacity: 0 }, at + 0.45)
    })
    tl.to('.c4-t4', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, B4 + 5.0)
    tl.to('.c4-recall', { y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' }, B4 + 5.4)
    // the 3 counts bundles
    tl.to('.c4-t3g', { opacity: 1, duration: 0.4 }, B4 + 6.1)
    tl.to('.c4-t3', { scale: 1.16, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, B4 + 6.1)
    tl.to(['.c4-l34-t', '.c4-o34-t'], { opacity: 1, duration: 0.4 }, B4 + 6.2)
    tl.fromTo('.c4-l34-t path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut', ...later }, B4 + 6.2)
    B_HOME.forEach((_, k) => tl.to(`.c4-bglow-${k}`, { opacity: 1, duration: 0.3 }, B4 + 6.7 + k * 0.4))
    // the 4 counts loose ones
    tl.to('.c4-t3g', { opacity: 0, duration: 0.4 }, B4 + 8.8)
    tl.to('.c4-bglow', { opacity: 0.35, duration: 0.4 }, B4 + 8.8)
    tl.to('.c4-t4g', { opacity: 1, duration: 0.4 }, B4 + 8.9)
    tl.to('.c4-t4', { scale: 1.16, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, B4 + 8.9)
    tl.to(['.c4-l34-o', '.c4-o34-o'], { opacity: 1, duration: 0.4 }, B4 + 9.0)
    tl.fromTo('.c4-l34-o path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut', ...later }, B4 + 9.0)
    L_HOME.forEach((_, j) => tl.to(`.c4-lglow-${j}`, { opacity: 1, duration: 0.25 }, B4 + 9.4 + j * 0.3))

    /* ---------------- 5. 34 and 43 ---------------- */
    const B5 = B4 + 11.4
    tl.addLabel('b5', B5)
    tl.to('.c4-recall', { y: -300, opacity: 0, duration: 0.5, ease: 'power2.in' }, B5)
    tl.to(['.c4-bglow', '.c4-lglow', '.c4-t4g'], { opacity: 0, duration: 0.4 }, B5)
    cam(1, 800, 450, B5, 1.2)
    tl.to('.c4-g34', { x: SLIDE, duration: 1.0, ease: 'power2.inOut' }, B5 + 0.1)
    // copies of the digits hop over, taking the colour of their new place
    tl.set(['.c4-f3v', '.c4-f4g'], { x: SLIDE, opacity: 1 }, B5 + 1.2)
    const fly = 1.3
    tl.to('.c4-f3v', { x: U3.x - T3.x, duration: fly, ease: 'power1.inOut' }, B5 + 1.25)
    tl.to('.c4-f3v', { y: -150, duration: fly / 2, ease: 'power2.out' }, B5 + 1.25)
    tl.to('.c4-f3v', { y: 0, duration: fly / 2, ease: 'power2.in' }, B5 + 1.25 + fly / 2)
    tl.to('.c4-u3', { x: 0, duration: fly, ease: 'power1.inOut' }, B5 + 1.25)
    tl.to('.c4-u3', { y: -150, duration: fly / 2, ease: 'power2.out' }, B5 + 1.25)
    tl.to('.c4-u3', { y: 0, duration: fly / 2, ease: 'power2.in' }, B5 + 1.25 + fly / 2)
    tl.to('.c4-f3v', { opacity: 0, duration: 0.5 }, B5 + 1.65)
    tl.to('.c4-u3', { opacity: 1, duration: 0.5 }, B5 + 1.65)
    tl.to('.c4-f4g', { x: U4.x - T4.x, duration: fly, ease: 'power1.inOut' }, B5 + 1.25)
    tl.to('.c4-f4g', { y: -40, duration: fly / 2, ease: 'power2.out' }, B5 + 1.25)
    tl.to('.c4-f4g', { y: 0, duration: fly / 2, ease: 'power2.in' }, B5 + 1.25 + fly / 2)
    tl.to('.c4-u4', { x: 0, duration: fly, ease: 'power1.inOut' }, B5 + 1.25)
    tl.to('.c4-u4', { y: -40, duration: fly / 2, ease: 'power2.out' }, B5 + 1.25)
    tl.to('.c4-u4', { y: 0, duration: fly / 2, ease: 'power2.in' }, B5 + 1.25 + fly / 2)
    tl.to('.c4-f4g', { opacity: 0, duration: 0.5 }, B5 + 1.65)
    tl.to('.c4-u4', { opacity: 1, duration: 0.5 }, B5 + 1.65)
    // same digits
    tl.to(['.c4-t3', '.c4-t4'], { scale: 1.12, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, B5 + 3.0)
    tl.to(['.c4-u4', '.c4-u3'], { scale: 1.12, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, B5 + 3.7)
    // 43 has four bundles
    B43.forEach((_, k) => tl.to(`.c4-b43-${k}`, { y: 0, opacity: 1, duration: 0.6, ease: 'bounce.out' }, B5 + 4.9 + k * 0.3))
    S43.forEach((_, j) => tl.to(`.c4-s43-${j}`, { y: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }, B5 + 6.1 + j * 0.15))
    tl.to(['.c4-l43-t', '.c4-o43-t'], { opacity: 1, duration: 0.4 }, B5 + 5.9)
    tl.fromTo('.c4-l43-t path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ...later }, B5 + 5.9)
    tl.to(['.c4-l43-o', '.c4-o43-o'], { opacity: 1, duration: 0.4 }, B5 + 6.5)
    tl.fromTo('.c4-l43-o path', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ...later }, B5 + 6.5)
    // that is more: the extra bundle lights up
    tl.to('.c4-x43', { opacity: 1, duration: 0.4 }, B5 + 7.0)
    bounce('.c4-b43-3', B5 + 7.1, 26)

    /* ---------------- 6. The number line ---------------- */
    const B6 = B5 + 8.6
    tl.addLabel('b6', B6)
    tl.to('.c4-g43', { opacity: 0, duration: 0.5 }, B6)
    tl.to('.c4-links34 > g', { opacity: 0, duration: 0.4 }, B6)
    tl.to('.c4-g34', { x: 0, duration: 0.8, ease: 'power2.inOut' }, B6 + 0.1)
    tl.to('.c4-board', { y: 0, duration: 1.0, ease: 'back.out(1.1)' }, B6 + 0.2)
    tl.to('.c4-t3', { x: PN_BOARD.x - 45 - T3.x, y: PN_BOARD.y - T3.y, scale: PN_BOARD.s, duration: 0.9, ease: 'power2.inOut' }, B6 + 0.9)
    tl.to('.c4-t4', { x: PN_BOARD.x + 45 - T4.x, y: PN_BOARD.y - T4.y, scale: PN_BOARD.s, duration: 0.9, ease: 'power2.inOut' }, B6 + 0.9)
    tl.set('.c4-ball', { opacity: 1 }, B6 + 1.5)
    B_BOARD.forEach((b, k) => {
      const t = B6 + 1.75 + k * 0.62
      for (let n = 0; n < 10; n++) {
        const f = inBundle(b, n, 1)
        tl.to(st(k * 10 + n), { x: f.x, y: f.y, rotation: f.r, duration: 0.55, ease: 'power2.inOut' }, t - 0.2)
      }
      tl.to(`.c4-rib-${k}`, { x: b.x, y: b.y, duration: 0.55, ease: 'power2.inOut' }, t - 0.2)
      tl.to(`.c4-bsh-${k}`, { opacity: 0, duration: 0.2 }, t - 0.2)
      tl.set(`.c4-arc-${k}`, { opacity: 1 }, t)
      tl.to(`.c4-arc-${k}`, { strokeDashoffset: 0, duration: 0.55, ease: 'none' }, t)
      tl.to('.c4-ball', { x: nx(10 * k + 10), duration: 0.55, ease: 'none' }, t)
      tl.to('.c4-ball', { y: NL.y - 16 - 150, duration: 0.275, ease: 'sine.out' }, t)
      tl.to('.c4-ball', { y: NL.y - 16, duration: 0.275, ease: 'sine.in' }, t + 0.275)
    })
    L_BOARD.forEach((p, j) => {
      const t = B6 + 3.75 + j * 0.34
      tl.to(st(30 + j), { x: p.x, y: p.y - HALF * LS, scale: LS, duration: 0.4, ease: 'power2.inOut' }, t - 0.15)
      tl.set(`.c4-step-${j}`, { opacity: 1 }, t)
      tl.to(`.c4-step-${j}`, { strokeDashoffset: 0, duration: 0.3, ease: 'none' }, t)
      tl.to('.c4-ball', { x: nx(31 + j), duration: 0.3, ease: 'none' }, t)
      tl.to('.c4-ball', { y: NL.y - 16 - 40, duration: 0.15, ease: 'sine.out' }, t)
      tl.to('.c4-ball', { y: NL.y - 16, duration: 0.15, ease: 'sine.in' }, t + 0.15)
    })
    tl.to('.c4-ball', { opacity: 0, duration: 0.2 }, B6 + 5.15)
    tl.to('.c4-mark', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, B6 + 5.15)
    tl.to('.c4-board .nl-tick-34', { attr: { fill: N.gold }, duration: 0.2 }, B6 + 5.15)
    tl.set('.c4-dline', { opacity: 1 }, B6 + 5.3)
    tl.to('.c4-dline', { strokeDashoffset: 0, duration: 0.4, ease: 'power1.inOut' }, B6 + 5.3)
    tl.to(['.c4-t3', '.c4-t4'], { scale: PN_BOARD.s * 1.15, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, B6 + 5.5)

    /* ---------------- 7. The shop: pay the shopkeeper ---------------- */
    const B7 = B6 + 6.2
    tl.addLabel('b7', B7)
    tl.to('.c4-board', { y: 560, duration: 0.8, ease: 'power2.in' }, B7)
    tl.to('.c4-g34', { y: 260, opacity: 0, duration: 0.7, ease: 'power2.in' }, B7)
    tl.set('.c4-game', { opacity: 1 }, B7)
    tl.to('.c4-mat', { opacity: 1, duration: 0.5 }, B7 + 0.5)
    tl.to('.c4-item', { y: 0, opacity: 1, duration: 0.8, ease: 'bounce.out' }, B7 + 0.8)
    tl.to('.c4-tag', { y: 0, duration: 1.0, ease: 'back.out(1.5)' }, B7 + 1.1)
    tl.to('.c4-baskets', { y: 0, duration: 0.8, ease: 'back.out(1.4)' }, B7 + 1.3)
    tl.to('.c4-spool', { y: 0, duration: 0.8, ease: 'back.out(1.4)' }, B7 + 1.5)
    tl.addLabel('b8', B7 + 2.4)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  // What Pip sees in the cues that only play.
  useEffect(() => {
    if (cueIndex === 1) {
      reportState(
        'Quick guess: three chalk slates hang above the pile of sticks on the counter, showing 20, 35 and 50. The learner taps the one that feels closest to how many sticks there are. Any guess is fine (there are really 34; do not tell them yet). The point is to feel that counting a messy pile one by one is slow.' +
          (picked && guess !== undefined ? ` They picked ${guess}.` : ' They have not picked yet.'),
      )
      setHints(['Any guess is fine here. Just pick the slate that feels closest.', 'Is the pile a few sticks, or lots of sticks?'])
    } else if (cueIndex === 4) {
      reportState(STATE[4] + (guess !== undefined ? ` The learner's earlier guess, ${guess}, hangs on a little slate in the top left corner, so they can see how close it was to 34.` : ''))
    } else if (cueIndex !== 7) {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, picked, guess, reportState, setHints])

  const pick = (g: number) => {
    if (!guessing) return
    setPicked(true)
    setGuess(g)
    memory.bundleGuess = g
    emit({ type: 'progress', detail: `guessed about ${g} sticks` })
    void say(GUESS_LINE)
    onPlayDone()
  }

  const onFinish = useCallback(() => {
    setDone(true)
    onPlayDone()
  }, [onPlayDone])

  const [pose, face] = cueIndex === 7 ? MOODS[mood] : (KEEP_POSE[cueIndex] ?? KEEP_POSE[0])

  return (
    <g ref={root}>
      <g className="c4-cam">
        <Valley time="day" />
        <Market />

        {/* the shopkeeper behind the counter, first with the sack */}
        <g className="c4-keep-a" pointerEvents="none">
          <Shopkeeper pose="hold" face="smile" />
        </g>
        <g className="c4-keep-b" data-tutor="the shopkeeper">
          <g className="breathe">
            <Shopkeeper pose={pose} face={face} />
          </g>
        </g>
        <g className="c4-sack" pointerEvents="none">
          <g transform={`translate(${SACK.x} ${SACK.y})`}>
            <Sack />
          </g>
        </g>

        <Board />
        <Counter2 />

        {/* the pink question: how many? */}
        <g className="c4-q" pointerEvents="none">
          <g transform="translate(850 400)">
            <g className="float">
              <text textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={130} fill={N.pink} stroke={N.white} strokeWidth={10} paintOrder="stroke">
                ?
              </text>
            </g>
          </g>
        </g>

        <Foreground />
        <Sticks34 />
        <Group43 />
        <Hands />
        <Awning />
      </g>

      {/* Things in front of the camera: the guess slates, the guess coming back, and the shop game */}
      <GuessSlates active={guessing} chosen={picked ? guess : undefined} onPick={pick} />
      <g className="c4-recall" pointerEvents="none" data-tutor="your guess">
        {guess !== undefined && (
          <g transform="translate(150 -30)">
            <g className="sway">
              <Slate n={guess} w={170} h={110} size={64} drop={100} />
            </g>
          </g>
        )}
      </g>
      <ShopGame active={myTurn} say={say} emit={emit} reportState={reportState} setHints={setHints} onMood={setMood} onFinish={onFinish} />

      <g opacity={0.35} pointerEvents="none">
        <Vignette />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The story sticks: one pile, then 3 bundles and 4 loose, then 34      */
/* ------------------------------------------------------------------ */

function Sticks34() {
  const tileGlow = (p: Pt, cls: string, color: 'violet' | 'warm') => (
    <g className={cls}>
      <Glow x={p.x} y={p.y} r={150} color={color} opacity={0.9} />
    </g>
  )
  return (
    <g className="c4-g34" data-tutor="the sticks" pointerEvents="none">
      {/* the links between the tiles and the real sticks (cue 5) */}
      <g className="c4-links34">
        <g className="c4-o34-t">
          <rect x={244} y={474} width={352} height={186} rx={28} fill={N.violet} fillOpacity={0.1} stroke={N.violet} strokeWidth={5} strokeDasharray="14 10" />
        </g>
        <g className="c4-o34-o">
          <rect x={620} y={482} width={158} height={178} rx={28} fill={N.gold} fillOpacity={0.12} stroke={N.goldDark} strokeWidth={5} strokeDasharray="14 10" />
        </g>
        <g className="c4-l34-t">
          <path d={`M${B_HOME[1].x} 470 Q${B_HOME[1].x + 6} 420 ${T3.x} ${T3.y + 86}`} stroke={N.violet} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" />
        </g>
        <g className="c4-l34-o">
          <path d={`M${L_HOME[1].x + 18} 478 Q${L_HOME[1].x} 420 ${T4.x + 10} ${T4.y + 86}`} stroke={N.goldDark} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" />
        </g>
      </g>

      {/* three bundles-to-be */}
      {B_HOME.map((b, k) => (
        <g key={k} className={`c4-bun c4-bun-${k}`} data-tutor={`bundle of ten ${k + 1}`}>
          <g className={`c4-bglow c4-bglow-${k}`}>
            <Glow x={b.x} y={b.y - 80} r={130} color="violet" />
          </g>
          <g className={`c4-bsh-${k}`}>
            <ellipse cy={3} rx={50} ry={8} fill={N.shadow} opacity={0.28} />
          </g>
          {Array.from({ length: 10 }, (_, n) => (
            <g key={n} className={`c4-st c4-st-${k * 10 + n}`}>
              <Stick y={HALF} />
            </g>
          ))}
          <g className={`c4-rib c4-rib-${k}`}>
            <Ribbon />
          </g>
          <g className={`c4-burst-${k}`}>
            <circle cx={b.x} cy={b.y - 74} r={44} fill="none" stroke={N.violetLight} strokeWidth={6} />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line key={a} x1={b.x} y1={b.y - 74 - 58} x2={b.x} y2={b.y - 74 - 76} stroke={N.white} strokeWidth={5} strokeLinecap="round" transform={`rotate(${a} ${b.x} ${b.y - 74})`} />
            ))}
          </g>
        </g>
      ))}

      {/* four loose sticks */}
      <g className="c4-loose" data-tutor="the 4 loose sticks">
        {L_HOME.map((p, j) => (
          <g key={j} className={`c4-lglow c4-lglow-${j}`}>
            <Glow x={p.x} y={p.y - 70} r={70} color="warm" />
          </g>
        ))}
        {L_HOME.map((_, j) => (
          <g key={j} className={`c4-st c4-st-${30 + j}`}>
            <Stick y={HALF} />
          </g>
        ))}
      </g>

      {/* counting one by one (cue 1) */}
      {DEMO.map((i, n) => (
        <g key={i}>
          <g className={`c4-dg c4-dg-${n}`}>
            <Glow x={PILE[i].x} y={PILE[i].y} r={80} color="warm" />
          </g>
          <g className={`c4-db c4-db-${n}`}>
            <NumTile x={PILE[i].x} y={PILE[i].y - 92} n={n + 1} size={44} />
          </g>
        </g>
      ))}

      {/* the count for each bundle as it is gathered */}
      {B_HOME.map((b, k) => (
        <Counter key={k} x={b.x} y={b.y - 222} cls={`c4-cnt-${k}`} size={50} />
      ))}

      {/* sparks that carry the bundles and sticks up into the tiles */}
      {B_HOME.map((_, k) => (
        <g key={k} className={`c4-spk c4-spk-t-${k}`}>
          <circle r={26} fill={N.violetLight} opacity={0.35} />
          <circle r={12} fill={N.violet} stroke={N.white} strokeWidth={3} />
        </g>
      ))}
      {L_HOME.map((_, j) => (
        <g key={j} className={`c4-spk c4-spk-o-${j}`}>
          <circle r={22} fill={N.goldLight} opacity={0.4} />
          <circle r={10} fill={N.gold} stroke={N.white} strokeWidth={3} />
        </g>
      ))}

      {/* 34: the violet 3 counts bundles, the gold 4 counts loose sticks */}
      {tileGlow(T3, 'c4-t3g', 'violet')}
      {tileGlow(T4, 'c4-t4g', 'warm')}
      <g className="c4-t3" data-tutor="the 3 (bundles of ten)">
        <PlaceNumber value={34} x={PN34.x} y={PN34.y} size={PN34.size} />
      </g>
      <g className="c4-t4" data-tutor="the 4 (loose sticks)">
        <PlaceNumber value={34} x={PN34.x} y={PN34.y} size={PN34.size} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* 43, built beside 34 (cue 6)                                          */
/* ------------------------------------------------------------------ */

function Group43() {
  return (
    <g className="c4-g43" pointerEvents="none">
      <g className="c4-links43">
        <g className="c4-o43-t">
          <rect x={744} y={474} width={472} height={186} rx={28} fill={N.violet} fillOpacity={0.1} stroke={N.violet} strokeWidth={5} strokeDasharray="14 10" />
        </g>
        <g className="c4-o43-o">
          <rect x={1240} y={482} width={112} height={178} rx={28} fill={N.gold} fillOpacity={0.12} stroke={N.goldDark} strokeWidth={5} strokeDasharray="14 10" />
        </g>
        <g className="c4-l43-t">
          <path d={`M${B43[1] + 40} 470 Q${B43[1] + 50} 420 ${U4.x} ${U4.y + 86}`} stroke={N.violet} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" />
        </g>
        <g className="c4-l43-o">
          <path d={`M${S43[1]} 478 Q${S43[1] - 20} 410 ${U3.x + 20} ${U3.y + 86}`} stroke={N.goldDark} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" />
        </g>
      </g>
      <g className="c4-x43">
        <Glow x={B43[3]} y={CY - 80} r={150} color="violet" />
      </g>
      {B43.map((x, k) => (
        <g key={k} className={`c4-b43 c4-b43-${k}`}>
          <Bundle x={x} y={CY} tutor={`43: bundle of ten ${k + 1}`} />
        </g>
      ))}
      {S43.map((x, j) => (
        <g key={j} className={`c4-s43 c4-s43-${j}`}>
          <Stick x={x} y={CY} tutor="43: a loose stick" />
        </g>
      ))}
      <g className="c4-u4" data-tutor="the 4 in 43 (bundles of ten)">
        <PlaceNumber value={43} x={PN43.x} y={PN43.y} size={PN34.size} />
      </g>
      <g className="c4-u3" data-tutor="the 3 in 43 (loose sticks)">
        <PlaceNumber value={43} x={PN43.x} y={PN43.y} size={PN34.size} />
      </g>
      {/* the digits of 34 in flight */}
      <g className="c4-f3v">
        <PlaceNumber value={34} x={PN34.x} y={PN34.y} size={PN34.size} />
      </g>
      <g className="c4-f4g">
        <PlaceNumber value={34} x={PN34.x} y={PN34.y} size={PN34.size} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Ten fingers (cue 4)                                                  */
/* ------------------------------------------------------------------ */

function Hands() {
  return (
    <g className="c4-hands" data-tutor="two hands, ten fingers" pointerEvents="none">
      {TIPS.map((p, i) => (
        <g key={i} className={`c4-fg c4-fg-${i}`}>
          <Glow x={p.x} y={p.y - 10} r={64} color="warm" />
        </g>
      ))}
      <g className="c4-hand-L">
        <Hand x={HL.x} y={HL.y} s={HS} flip skin={N.skin1} skinDark={N.skin1Dark} />
      </g>
      <g className="c4-hand-R">
        <Hand x={HR.x} y={HR.y} s={HS} skin={N.skin1} skinDark={N.skin1Dark} />
      </g>
      <g className="c4-hcount">
        <Counter x={HC.x} y={HC.y} cls="c4-hc" size={86} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chalkboard with the number line (cue 7)                          */
/* ------------------------------------------------------------------ */

function Board() {
  return (
    <g className="c4-board" data-tutor="the number line" pointerEvents="none">
      <rect x={134} y={124} width={1236} height={620} rx={30} fill={N.woodDark} />
      <rect x={150} y={140} width={1204} height={600} rx={20} fill={N.night1} />
      <rect x={170} y={154} width={1164} height={10} rx={5} fill={N.white} opacity={0.07} />
      <NumberLine x={NL.x0} y={NL.y} from={0} to={40} unit={NL.unit} labelEvery={10} size={40} />
      {[0, 1, 2].map((k) => (
        <path
          key={k}
          className={`c4-arc c4-arc-${k}`}
          d={`M${nx(10 * k)} ${NL.y - 6} Q${nx(10 * k + 5)} ${NL.y - 306} ${nx(10 * k + 10)} ${NL.y - 6}`}
          stroke={N.violet}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      {[0, 1, 2, 3].map((j) => (
        <path
          key={j}
          className={`c4-step c4-step-${j}`}
          d={`M${nx(30 + j)} ${NL.y - 6} Q${nx(30.5 + j)} ${NL.y - 86} ${nx(31 + j)} ${NL.y - 6}`}
          stroke={N.gold}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      <path className="c4-dline" d={`M${PN_BOARD.x} ${PN_BOARD.y + 60} V${NL.y - 30}`} stroke={N.goldLight} strokeWidth={5} strokeDasharray="1 1" pathLength={1} fill="none" strokeLinecap="round" opacity={0} />
      <g className="c4-mark">
        <Glow x={nx(34)} y={NL.y} r={60} color="warm" />
        <circle cx={nx(34)} cy={NL.y} r={15} fill={N.gold} stroke={N.white} strokeWidth={4} />
      </g>
      <g className="c4-ball">
        <circle r={22} fill={N.goldLight} opacity={0.35} />
        <circle r={13} fill={N.gold} stroke={N.white} strokeWidth={4} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The quick guess (cue 2)                                              */
/* ------------------------------------------------------------------ */

function GuessSlates({ active, chosen, onPick }: { active: boolean; chosen: number | undefined; onPick: (g: number) => void }) {
  return (
    <g className="c4-slates">
      {GUESSES.map((g, i) => {
        const on = chosen === g
        return (
          <g key={g} transform={`translate(${520 + i * 280} 0)`}>
            <g className="sway" style={{ animationDelay: `${-i * 1.3}s` }}>
              <g
                onClick={() => onPick(g)}
                className={active ? 'hot' : undefined}
                style={{ cursor: active ? 'pointer' : 'default', opacity: chosen !== undefined && !on ? 0.3 : 1, transition: 'opacity 0.4s' }}
                data-tutor={`the slate that says ${g}`}
              >
                {on && <Glow y={195} r={200} color="warm" />}
                <rect x={-130} y={100} width={260} height={180} fill="transparent" />
                <Slate n={g} />
                {on && <rect x={-128} y={112} width={256} height={166} rx={28} fill="none" stroke={N.gold} strokeWidth={7} />}
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The shop game (cue 8)                                                */
/* ------------------------------------------------------------------ */

type Kind = 'bundle' | 'stick'
interface Piece {
  id: number
  from: Pt
}
interface Ghost {
  id: number
  kind: Kind
  from: Pt
  to: Pt
}
interface TieJob {
  id: number
  from: Pt[]
  to: Pt
}
type DragFns = { onStart: (p: Pt) => void; onMove: (p: Pt) => void; onEnd: (p: Pt) => void }
interface Drag {
  kind: Kind
  src: 'basket' | 'mat'
  id: number
  p: Pt
  start: Pt
  off: Pt
}

const ROUNDS = [
  { price: 23, item: 'melon' },
  { price: 40, item: 'kite' },
  { price: 15, item: 'honey jar' },
] as const

const HINTS: string[][] = [
  ['Look at the price tag. What colour is each digit?', 'The violet digit counts bundles of ten. The gold digit counts loose sticks.', 'If ten loose sticks are on the counter, the ribbon can tie them into one bundle.'],
  ['What does the 0 in 40 tell you about loose sticks?', 'The 4 is violet. Violet means bundles of ten.', 'Count by tens as you add bundles: 10, 20, 30...'],
  ['Look at the colours on the price tag.', 'The 1 is violet, so it counts bundles. The 5 is gold, so it counts loose sticks.', 'Ten loose sticks are the same as one bundle.'],
]

const MIXUPS = [
  'Likely mix-ups: paying 3 bundles and 2 sticks (32, the digits swapped), or 23 loose sticks (right amount, too many pieces).',
  'Likely mix-ups: paying just 4 loose sticks (reading the 4 as ones), or 4 bundles plus some loose sticks (forgetting the 0 means none).',
  'Likely mix-ups: paying 15 loose sticks (right amount, too many pieces), or 5 bundles and 1 stick (51, the digits swapped).',
]

/** Where pieces can be dropped to pay: the counter in front of the shopkeeper. */
const MAT = { x0: 370, x1: 1110, y0: 380, y1: 720 }
const MAX_B = 6
const MAX_S = 40
const PS = 0.8
const bSlot = (i: number): Pt => ({ x: 450 + i * 58, y: CY })
const sSlot = (i: number): Pt => {
  const row = Math.floor(i / 20)
  const col = i % 20
  return { x: 824 + col * 12.5 + Math.floor(col / 5) * 9 + row * 5, y: CY - row * 26 }
}
const BASKET_B: Pt = { x: 290, y: 800 }
const BASKET_S: Pt = { x: 580, y: 800 }
const SPOOL: Pt = { x: 850, y: 806 }
const ITEM: Pt = { x: 1235, y: CY }
const TAG: Pt = { x: 1235, y: 250 }
const BUBBLE: Pt = { x: 1460, y: 300 }
const inMat = (p: Pt) => p.x > MAT.x0 && p.x < MAT.x1 && p.y > MAT.y0 && p.y < MAT.y1

interface GameProps {
  active: boolean
  say: ChapterProps['say']
  emit: ChapterProps['emit']
  reportState: ChapterProps['reportState']
  setHints: ChapterProps['setHints']
  onMood: (m: Mood) => void
  onFinish: () => void
}

function ShopGame({ active, say, emit, reportState, setHints, onMood, onFinish }: GameProps) {
  const [round, setRound] = useState(0)
  const [bundles, setBundles] = useState<Piece[]>([])
  const [sticks, setSticks] = useState<Piece[]>([])
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [tie, setTie] = useState<TieJob | null>(null)
  const [counted, setCounted] = useState(0)
  const [bubble, setBubble] = useState<number | null>(null)
  const [paid, setPaid] = useState(false)
  const [away, setAway] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wiggle, setWiggle] = useState(0)
  const [lastPay, setLastPay] = useState('')
  const [touched, setTouched] = useState(false)

  const nextId = useRef(1)
  const idle = useRef(0)
  const countTimers = useRef<number[]>([])
  const timers = useRef<number[]>([])
  const told = useRef<Record<string, number>>({})
  const dragRef = useRef<Drag | null>(null)
  const live = useRef({ round, bundles, sticks, tie: false, paid: false })
  live.current = { round, bundles, sticks, tie: !!tie, paid }

  const price = ROUNDS[round].price
  const best = { b: Math.floor(price / 10), l: price % 10 }
  const canAct = active && !paid && !tie

  useEffect(
    () => () => {
      window.clearTimeout(idle.current)
      countTimers.current.forEach((t) => window.clearTimeout(t))
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  useEffect(() => {
    if (active) setHints(HINTS[round])
  }, [active, round, setHints])

  useEffect(() => {
    if (!active && !paid) return
    const b = bundles.length
    const l = sticks.length
    reportState(
      [
        `The shop game, round ${round + 1} of 3. A ${ROUNDS[round].item} costs ${price}: the price tag shows ${best.b} on a violet tile (bundles of ten) and ${best.l} on a gold tile (loose sticks).`,
        'The learner pays by tapping or dragging bundles of ten and loose sticks from two baskets onto the counter (tapping a piece on the counter, or dragging it off, takes it back). Tapping the violet ribbon spool ties ten loose sticks on the counter into one bundle. When the learner stops for a moment, the shopkeeper counts the payment out loud in a speech bubble and says if it is too much, not enough, or right but with too many pieces.',
        `On the counter now: ${b} bundle${b === 1 ? '' : 's'} and ${l} loose stick${l === 1 ? '' : 's'}, which is ${b * 10 + l} sticks in ${b + l} pieces.`,
        `Correct answer (fewest pieces): ${best.b} bundle${best.b === 1 ? '' : 's'} of ten and ${best.l} loose stick${best.l === 1 ? '' : 's'}.`,
        MIXUPS[round],
        lastPay ? `Last time the shopkeeper counted: ${lastPay}.` : '',
        paid ? 'This round is paid.' : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }, [active, round, bundles, sticks, paid, lastPay, price, best.b, best.l, reportState])

  const tell = (key: keyof typeof SHOP, max = 99) => {
    const n = told.current[key] ?? 0
    if (n >= max) return
    told.current[key] = n + 1
    void say(SHOP[key])
  }

  const stopCount = () => {
    window.clearTimeout(idle.current)
    countTimers.current.forEach((t) => window.clearTimeout(t))
    countTimers.current = []
  }

  /** Something changed on the counter: the shopkeeper waits a moment, then counts. */
  const changed = (b: number, l: number) => {
    stopCount()
    setBubble(null)
    setCounted(0)
    onMood('wait')
    if (b + l === 0) return
    const total = b * 10 + l
    idle.current = window.setTimeout(startCount, total >= ROUNDS[live.current.round].price ? 900 : 2600)
  }

  const startCount = () => {
    const s = live.current
    if (dragRef.current || s.tie || s.paid) {
      idle.current = window.setTimeout(startCount, 800)
      return
    }
    const b = s.bundles.length
    const l = s.sticks.length
    if (b + l === 0) return
    onMood('count')
    setBubble(0)
    setCounted(0)
    let t = 150
    for (let i = 1; i <= b + l; i++) {
      t += i <= b ? 420 : l > 12 ? 110 : 170
      const value = i <= b ? i * 10 : b * 10 + (i - b)
      countTimers.current.push(
        window.setTimeout(() => {
          setCounted(i)
          setBubble(value)
        }, t),
      )
    }
    countTimers.current.push(window.setTimeout(() => judge(b, l), t + 380))
  }

  const judge = (b: number, l: number) => {
    const r = live.current.round
    const p = ROUNDS[r].price
    const bb = Math.floor(p / 10)
    const bl = p % 10
    const total = b * 10 + l
    const what = `${b} bundle(s) and ${l} loose stick(s), ${total} in all`
    setLastPay(`${what} (price ${p})`)
    if (total === p && b === bb && l === bl) {
      win(r, b, l)
      return
    }
    if (total === p) {
      onMood('fewer')
      emit({ type: 'attempt', correct: false, detail: `paid ${what}: the right amount, but more pieces than needed` })
      if ((told.current.fewer ?? 0) === 0) tell('fewer')
      else tell('tie')
      return
    }
    if (total > p) {
      onMood('more')
      emit({ type: 'attempt', correct: false, detail: `paid ${what}: too much for ${p}` })
      if (r === 0 && b === 3 && l === 2) tell('more23')
      else if (r === 2 && b === 5 && l === 1) tell('more15')
      else tell('more', 3)
      return
    }
    onMood('less')
    if (r === 1 && b === 0 && l === 4) {
      emit({ type: 'attempt', correct: false, detail: `paid ${what}: read the 4 in 40 as loose sticks` })
      tell('less40')
    } else {
      emit({ type: 'progress', detail: `the shopkeeper counted ${what}: not enough yet for ${p}` })
      tell('less', 1)
    }
  }

  const win = (r: number, b: number, l: number) => {
    setPaid(true)
    onMood('yes')
    emit({ type: 'attempt', correct: true, detail: `paid ${b} bundle(s) and ${l} loose stick(s) for ${ROUNDS[r].price}, the fewest pieces` })
    const t0 = Date.now()
    const line = say(WIN[r])
    if (r === ROUNDS.length - 1) {
      onFinish()
      return
    }
    later(() => setAway(true), 1000)
    void line.then(() => later(nextRound, Math.max(300, 2800 - (Date.now() - t0))))
  }

  const nextRound = () => {
    told.current = {}
    setRound((r) => Math.min(ROUNDS.length - 1, r + 1))
    setBundles([])
    setSticks([])
    setPaid(false)
    setAway(false)
    setBubble(null)
    setCounted(0)
    setLastPay('')
    onMood('wait')
  }

  const add = (kind: Kind, from: Pt) => {
    if (!canAct) return
    setTouched(true)
    if (kind === 'bundle') {
      if (bundles.length >= MAX_B) {
        tell('full', 2)
        return
      }
      const nb = [...bundles, { id: nextId.current++, from }]
      setBundles(nb)
      changed(nb.length, sticks.length)
    } else {
      if (sticks.length >= MAX_S) {
        tell('full', 2)
        return
      }
      const ns = [...sticks, { id: nextId.current++, from }]
      setSticks(ns)
      changed(bundles.length, ns.length)
    }
    emit({ type: 'progress', detail: kind === 'bundle' ? 'put a bundle of ten on the counter' : 'put a loose stick on the counter' })
  }

  const remove = (kind: Kind, id: number, from: Pt) => {
    if (!canAct) return
    const home = kind === 'bundle' ? BASKET_B : BASKET_S
    setGhosts((g) => [...g, { id: nextId.current++, kind, from, to: { x: home.x, y: home.y - 40 } }])
    if (kind === 'bundle') {
      const nb = bundles.filter((p) => p.id !== id)
      setBundles(nb)
      changed(nb.length, sticks.length)
    } else {
      const ns = sticks.filter((p) => p.id !== id)
      setSticks(ns)
      changed(bundles.length, ns.length)
    }
    emit({ type: 'progress', detail: kind === 'bundle' ? 'took a bundle back' : 'took a loose stick back' })
  }

  const doTie = () => {
    if (!canAct) return
    if (sticks.length < 10) {
      setWiggle((w) => w + 1)
      tell('ribbon', 1)
      return
    }
    if (bundles.length >= MAX_B) {
      tell('full', 2)
      return
    }
    stopCount()
    setBubble(null)
    setCounted(0)
    onMood('wait')
    const from = Array.from({ length: 10 }, (_, k) => sSlot(sticks.length - 10 + k))
    setSticks(sticks.slice(0, -10))
    setTie({ id: nextId.current++, from, to: bSlot(bundles.length) })
    emit({ type: 'progress', detail: 'tied ten loose sticks into a bundle' })
  }
  const tieDone = () => {
    const to = tie?.to ?? bSlot(bundles.length)
    setTie(null)
    const nb = [...live.current.bundles, { id: nextId.current++, from: to }]
    setBundles(nb)
    changed(nb.length, live.current.sticks.length)
  }

  const setDragBoth = (d: Drag | null) => {
    dragRef.current = d
    setDrag(d)
  }
  const basketHandlers = (kind: Kind) => ({
    onStart: (p: Pt) => {
      if (!canAct) return
      setDragBoth({ kind, src: 'basket', id: 0, p, start: p, off: { x: 0, y: 20 } })
    },
    onMove: (p: Pt) => {
      const d = dragRef.current
      if (d) setDragBoth({ ...d, p })
    },
    onEnd: (p: Pt) => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      const moved = Math.hypot(p.x - d.start.x, p.y - d.start.y)
      if (moved < 12) add(kind, kind === 'bundle' ? { x: BASKET_B.x, y: BASKET_B.y - 60 } : { x: BASKET_S.x, y: BASKET_S.y - 60 })
      else if (inMat(p)) add(kind, { x: p.x + d.off.x, y: p.y + d.off.y })
    },
  })
  const pieceHandlers = (kind: Kind, id: number, slot: Pt) => ({
    onStart: (p: Pt) => {
      if (!canAct) return
      setDragBoth({ kind, src: 'mat', id, p, start: p, off: { x: slot.x - p.x, y: slot.y - p.y } })
    },
    onMove: (p: Pt) => {
      const d = dragRef.current
      if (d) setDragBoth({ ...d, p })
    },
    onEnd: (p: Pt) => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      const moved = Math.hypot(p.x - d.start.x, p.y - d.start.y)
      if (moved < 12) remove(kind, id, slot)
      else if (!inMat(p)) remove(kind, id, { x: p.x + d.off.x, y: p.y + d.off.y })
    },
  })
  const lastStick = sticks[sticks.length - 1]
  const looseHandlers = {
    onStart: (p: Pt) => {
      if (!canAct || !lastStick) return
      const slot = sSlot(sticks.length - 1)
      setDragBoth({ kind: 'stick', src: 'mat', id: lastStick.id, p, start: p, off: { x: slot.x - p.x, y: slot.y - p.y + 50 } })
    },
    onMove: (p: Pt) => {
      const d = dragRef.current
      if (d) setDragBoth({ ...d, p })
    },
    onEnd: (p: Pt) => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      const moved = Math.hypot(p.x - d.start.x, p.y - d.start.y)
      if (moved < 12) remove('stick', d.id, sSlot(sticks.length - 1))
      else if (!inMat(p)) remove('stick', d.id, { x: p.x + d.off.x, y: p.y + d.off.y })
    },
  }
  const looseDrag = useDrag(looseHandlers)

  const lifted = (kind: Kind, id: number) => drag?.src === 'mat' && drag.kind === kind && drag.id === id
  const hot = canAct && bundles.length + sticks.length === 0 && round === 0 && !touched
  const canTie = canAct && sticks.length >= 10

  return (
    <g className="c4-game">
      {/* the payment cloth on the counter */}
      <g className="c4-mat" data-tutor="the counter where you pay">
        <path d={`M${MAT.x0 + 30} 604 H${MAT.x1 - 30} L${MAT.x1 - 10} 650 H${MAT.x0 + 10} Z`} fill={N.sandLight} />
        <path d={`M${MAT.x0 + 30} 604 H${MAT.x1 - 30} L${MAT.x1 - 10} 650 H${MAT.x0 + 10} Z`} fill="none" stroke={N.sandDark} strokeWidth={3} strokeDasharray="10 8" opacity={0.6} />
      </g>

      {/* the thing for sale, and its price */}
      <g className="c4-item" data-tutor={`the ${ROUNDS[round].item} for sale`}>
        <ItemDrop key={round} kind={round} sold={paid} />
      </g>
      <g className="c4-tag">
        <g transform={`translate(${TAG.x} 56)`}>
          <g className="sway">
            <PriceTag price={price} paid={paid} round={round} />
          </g>
        </g>
      </g>

      {/* what is on the counter */}
      <g className="c4-pieces">
        {bundles.map((p, i) => {
          const slot = bSlot(i)
          const up = lifted('bundle', p.id)
          const at = up && drag ? { x: drag.p.x + drag.off.x, y: drag.p.y + drag.off.y } : slot
          return (
            <MatBundle key={p.id} at={at} from={p.from} counted={counted > i} away={away} instant={up} handlers={pieceHandlers('bundle', p.id, slot)} active={canAct} />
          )
        })}
        {/* the back row of loose sticks first, then the front row */}
        {[1, 0].map((row) =>
          sticks.map((p, i) => {
            if (Math.floor(i / 20) !== row) return null
            const up = lifted('stick', p.id)
            const slot = sSlot(i)
            const at = up && drag ? { x: drag.p.x + drag.off.x, y: drag.p.y + drag.off.y } : slot
            return <MatStick key={p.id} at={at} from={p.from} counted={counted > bundles.length + i} away={away} instant={up} />
          }),
        )}
        {sticks.length > 0 && (
          <g {...looseDrag} style={{ ...looseDrag.style, cursor: canAct ? 'pointer' : 'default' }} data-tutor="the loose sticks on the counter">
            <rect x={804} y={470} width={300} height={190} fill="transparent" />
          </g>
        )}
        {tie && <TieAnim key={tie.id} job={tie} onDone={tieDone} />}
        {ghosts.map((g) => (
          <GhostPiece key={g.id} g={g} onDone={() => setGhosts((gs) => gs.filter((x) => x.id !== g.id))} />
        ))}
      </g>

      {/* the shopkeeper's count */}
      {bubble !== null && (
        <g pointerEvents="none" data-tutor="what the shopkeeper counted">
          <SpeechBubble value={bubble} />
        </g>
      )}

      {/* our baskets and the ribbon, in front of the counter */}
      <g className="c4-baskets">
        <Basket at={BASKET_B} kind="bundle" handlers={basketHandlers('bundle')} hot={hot} active={canAct} />
        <Basket at={BASKET_S} kind="stick" handlers={basketHandlers('stick')} hot={hot} active={canAct} />
      </g>
      <g className="c4-spool">
        <Spool hot={canTie} wiggle={wiggle} onTap={doTie} active={canAct} />
      </g>

      {/* a piece being carried from a basket */}
      {drag?.src === 'basket' && (
        <g transform={`translate(${drag.p.x + drag.off.x} ${drag.p.y + drag.off.y})`} pointerEvents="none">
          {drag.kind === 'bundle' ? <Bundle s={PS * 1.1} /> : <Stick s={PS * 1.1} />}
        </g>
      )}
    </g>
  )
}

/** Flies in from where it was dropped or picked, then hops when the shopkeeper counts it. */
function usePieceMotion(at: Pt, from: Pt, counted: boolean) {
  const fly = useRef<SVGGElement>(null)
  const hop = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    const el = fly.current
    const dx = from.x - at.x
    const dy = from.y - at.y
    if (!el || Math.hypot(dx, dy) < 2) return
    const tl = gsap.timeline()
    tl.fromTo(el, { x: dx }, { x: 0, duration: 0.45, ease: 'power1.inOut' }, 0)
    tl.fromTo(el, { y: dy }, { y: Math.min(0, dy) - 70, duration: 0.2, ease: 'power2.out' }, 0)
    tl.to(el, { y: 0, duration: 0.25, ease: 'power2.in' }, 0.2)
    return () => {
      tl.kill()
    }
    // Only when the piece first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!counted || !hop.current) return
    const tw = gsap.fromTo(hop.current, { y: 0 }, { y: -16, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' })
    return () => {
      tw.kill()
    }
  }, [counted])
  return { fly, hop }
}

function MatBundle({ at, from, counted, away, instant, handlers, active }: { at: Pt; from: Pt; counted: boolean; away: boolean; instant: boolean; handlers: DragFns; active: boolean }) {
  const { fly, hop } = usePieceMotion(at, from, counted)
  const drag = useDrag(handlers)
  return (
    <g
      style={{
        transform: `translate(${at.x + (away ? 240 : 0)}px, ${at.y}px)`,
        transition: instant ? 'none' : 'transform 0.35s ease-out, opacity 0.5s',
        opacity: away ? 0 : 1,
      }}
    >
      <g ref={fly}>
        <g ref={hop}>
          {counted && <Glow y={-70} r={80} color="violet" />}
          <g {...drag} style={{ ...drag.style, cursor: active ? 'grab' : 'default' }} data-tutor="a bundle of ten on the counter">
            <rect x={-44} y={-140} width={88} height={150} fill="transparent" />
            <Bundle s={PS} />
          </g>
        </g>
      </g>
    </g>
  )
}

function MatStick({ at, from, counted, away, instant }: { at: Pt; from: Pt; counted: boolean; away: boolean; instant: boolean }) {
  const { fly, hop } = usePieceMotion(at, from, counted)
  return (
    <g
      pointerEvents="none"
      style={{
        transform: `translate(${at.x + (away ? 240 : 0)}px, ${at.y}px)`,
        transition: instant ? 'none' : 'transform 0.35s ease-out, opacity 0.5s',
        opacity: away ? 0 : 1,
      }}
    >
      <g ref={fly}>
        <g ref={hop}>
          {counted && <Glow y={-56} r={34} color="warm" />}
          <Stick s={PS} />
        </g>
      </g>
    </g>
  )
}

/** A piece going back into its basket. */
function GhostPiece({ g, onDone }: { g: Ghost; onDone: () => void }) {
  const ref = useRef<SVGGElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  useLayoutEffect(() => {
    if (!ref.current) return
    const tl = gsap.timeline({ onComplete: () => done.current() })
    tl.fromTo(ref.current, { x: g.from.x, y: g.from.y, opacity: 1 }, { x: g.to.x, y: g.to.y, duration: 0.45, ease: 'power2.in' }, 0)
    tl.to(ref.current, { opacity: 0, duration: 0.15 }, 0.32)
    return () => {
      tl.kill()
    }
  }, [g])
  return (
    <g ref={ref} pointerEvents="none">
      {g.kind === 'bundle' ? <Bundle s={PS} /> : <Stick s={PS} />}
    </g>
  )
}

/** Ten loose sticks gather, a violet ribbon snaps round them, and the new bundle joins the others. */
function TieAnim({ job, onDone }: { job: TieJob; onDone: () => void }) {
  const ref = useRef<SVGGElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  useLayoutEffect(() => {
    const cx = job.from.reduce((s, p) => s + p.x, 0) / job.from.length
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done.current() })
      job.from.forEach((p, i) => {
        const k = i - 4.5
        tl.fromTo(`.tj-${i}`, { x: p.x, y: p.y }, { x: cx + k * 8 * PS * 1.7, y: CY, duration: 0.4, ease: 'power2.inOut' }, i * 0.02)
        tl.to(`.tj-${i}`, { x: cx + k * 8 * PS, duration: 0.14, ease: 'power3.in' }, 0.62)
      })
      tl.fromTo('.tj-rib', { x: cx, y: CY, scaleX: 0, opacity: 1, transformOrigin: '50% 50%' }, { scaleX: 1, duration: 0.28, ease: 'back.out(3)' }, 0.68)
      tl.fromTo('.tj-burst', { x: cx, y: CY - 74 * PS, scale: 0.4, opacity: 0.95, transformOrigin: '50% 50%' }, { scale: 2.2, opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.72)
      tl.to('.tj-all', { x: job.to.x - cx, duration: 0.5, ease: 'power2.inOut' }, 1.15)
    }, ref)
    return () => ctx.revert()
  }, [job])
  return (
    <g ref={ref} pointerEvents="none">
      <g className="tj-all">
        {job.from.map((_, i) => (
          <g key={i} className={`tj-${i}`}>
            <Stick s={PS} />
          </g>
        ))}
        <g className="tj-rib" opacity={0}>
          <g transform={`scale(${PS})`}>
            <Ribbon />
          </g>
        </g>
        <g className="tj-burst" opacity={0}>
          <circle r={40} fill="none" stroke={N.violetLight} strokeWidth={6} />
        </g>
      </g>
    </g>
  )
}

/** A woven basket of bundles or loose sticks: tap it, or drag from it. */
function Basket({ at, kind, handlers, hot, active }: { at: Pt; kind: Kind; handlers: DragFns; hot: boolean; active: boolean }) {
  const drag = useDrag(handlers)
  const w = 230
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <g {...drag} className={active ? 'hot' : undefined} style={{ ...drag.style, cursor: active ? 'grab' : 'default' }} data-tutor={kind === 'bundle' ? 'the basket of bundles of ten' : 'the basket of loose sticks'}>
        <rect x={-w / 2 - 10} y={-170} width={w + 20} height={270} fill="transparent" />
        {hot && <ellipse className="hot-ring" cy={-20} rx={150} ry={120} fill="none" stroke={N.white} strokeWidth={5} />}
        <ellipse cy={96} rx={w / 2 + 6} ry={14} fill={N.shadow} opacity={0.3} />
        <ellipse cy={-40} rx={w / 2} ry={24} fill={N.woodDark} />
        {kind === 'bundle'
          ? [-70, 0, 70].map((bx, i) => (
              <g key={i} transform={`translate(${bx} ${-28 + Math.abs(bx) * 0.12}) rotate(${bx * 0.12})`}>
                <Bundle s={0.72} />
              </g>
            ))
          : Array.from({ length: 11 }, (_, i) => (
              <g key={i} transform={`translate(${-80 + i * 16} ${-26 + ((i * 7) % 3) * 4}) rotate(${(i - 5) * 4})`}>
                <Stick s={0.72} />
              </g>
            ))}
        <path d={`M${-w / 2} -40 L${-w / 2 + 18} 90 Q0 104 ${w / 2 - 18} 90 L${w / 2} -40 Q0 -16 ${-w / 2} -40 Z`} fill={N.sand} />
        <path d={`M${w / 2 - 50} -30 L${w / 2} -40 L${w / 2 - 18} 90 Q${w / 2 - 50} 96 ${w / 2 - 80} 98 Z`} fill={N.sandDark} opacity={0.45} />
        {[-6, 26, 58].map((yy) => (
          <path key={yy} d={`M${-w / 2 + 6} ${yy} Q0 ${yy + 22} ${w / 2 - 6} ${yy}`} stroke={N.sandDark} strokeWidth={5} fill="none" opacity={0.7} />
        ))}
        <path d={`M${-w / 2} -40 Q0 -16 ${w / 2} -40`} stroke={N.sandLight} strokeWidth={12} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}

/** A spool of violet ribbon: it ties ten loose sticks on the counter into a bundle. */
function Spool({ hot, wiggle, onTap, active }: { hot: boolean; wiggle: number; onTap: () => void; active: boolean }) {
  const inner = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!wiggle || !inner.current) return
    const tw = gsap.fromTo(inner.current, { rotation: 0, svgOrigin: `${SPOOL.x} ${SPOOL.y}` }, { rotation: 10, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' })
    return () => {
      tw.kill()
    }
  }, [wiggle])
  return (
    <g onClick={onTap} className={active ? 'hot' : undefined} style={{ cursor: active ? 'pointer' : 'default' }} data-tutor="the violet ribbon spool (ties ten loose sticks into a bundle)">
      <rect x={SPOOL.x - 80} y={SPOOL.y - 100} width={160} height={180} fill="transparent" />
      {hot && <Glow x={SPOOL.x} y={SPOOL.y - 10} r={120} color="violet" />}
      {hot && <circle className="hot-ring" cx={SPOOL.x} cy={SPOOL.y - 10} r={78} fill="none" stroke={N.violetLight} strokeWidth={6} />}
      <g ref={inner}>
        <ellipse cx={SPOOL.x} cy={SPOOL.y + 60} rx={70} ry={12} fill={N.shadow} opacity={0.3} />
        <path d={`M${SPOOL.x + 30} ${SPOOL.y + 10} Q${SPOOL.x + 90} ${SPOOL.y + 30} ${SPOOL.x + 70} ${SPOOL.y + 62}`} stroke={N.violet} strokeWidth={16} fill="none" strokeLinecap="round" />
        <rect x={SPOOL.x - 56} y={SPOOL.y - 70} width={112} height={22} rx={10} fill={N.woodDark} />
        <rect x={SPOOL.x - 44} y={SPOOL.y - 52} width={88} height={92} rx={14} fill={N.violet} />
        <rect x={SPOOL.x - 44} y={SPOOL.y - 52} width={30} height={92} rx={12} fill={N.violetLight} opacity={0.6} />
        {[-30, -8, 14].map((dy) => (
          <path key={dy} d={`M${SPOOL.x - 44} ${SPOOL.y + dy} H${SPOOL.x + 44}`} stroke={N.violetDark} strokeWidth={3} opacity={0.5} />
        ))}
        <rect x={SPOOL.x - 56} y={SPOOL.y + 36} width={112} height={22} rx={10} fill={N.woodDark} />
      </g>
    </g>
  )
}

/** The price tag, hanging from the awning on a string. (0, 0) is where the string is tied. */
function PriceTag({ price, paid, round }: { price: number; paid: boolean; round: number }) {
  const flip = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!flip.current || round === 0) return
    const tw = gsap.fromTo(flip.current, { scaleX: 0, transformOrigin: '50% 50%' }, { scaleX: 1, duration: 0.5, ease: 'back.out(2)' })
    return () => {
      tw.kill()
    }
  }, [round])
  const y = TAG.y - 56
  return (
    <g data-tutor="the price tag">
      <path d={`M0 0 V${y - 70}`} stroke={N.woodDark} strokeWidth={4} />
      <g ref={flip}>
        <rect x={-118} y={y - 78} width={236} height={160} rx={28} fill={N.woodDark} />
        <rect x={-108} y={y - 68} width={216} height={140} rx={22} fill={N.cream} />
        <circle cx={0} cy={y - 56} r={7} fill={N.woodDark} />
        <PlaceNumber value={price} x={0} y={y + 10} size={76} />
      </g>
      {paid && (
        <g>
          <circle cx={104} cy={y - 64} r={34} fill={N.teal} stroke={N.white} strokeWidth={5} />
          <path d={`M${88} ${y - 64} l12 12 l22 -24`} stroke={N.night0} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

/** The shopkeeper's count, in a speech bubble. */
function SpeechBubble({ value }: { value: number }) {
  const w = value >= 10 ? 210 : 150
  return (
    <g transform={`translate(${BUBBLE.x} ${BUBBLE.y})`}>
      <path d="M-10 52 L6 92 L24 52 Z" fill={N.white} />
      <rect x={-w / 2} y={-62} width={w} height={118} rx={34} fill={N.white} />
      <PlaceNumber value={value} x={0} y={-4} size={64} />
    </g>
  )
}

/** The thing for sale. A new one drops onto the counter each round, and it goes to the learner when paid. */
function ItemDrop({ kind, sold }: { kind: number; sold: boolean }) {
  const ref = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    if (!ref.current || kind === 0) return
    const tw = gsap.fromTo(ref.current, { y: -500, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'bounce.out', delay: 0.2 })
    return () => {
      tw.kill()
    }
  }, [kind])
  useEffect(() => {
    if (!sold || !ref.current) return
    const tw = gsap.to(ref.current, { x: -760, y: 380, scale: 0.5, opacity: 0, duration: 1.1, ease: 'power2.in', delay: 1.0, svgOrigin: `${ITEM.x} ${ITEM.y}` })
    return () => {
      tw.kill()
    }
  }, [sold])
  return (
    <g ref={ref}>
      <g transform={`translate(${ITEM.x} ${ITEM.y})`}>
        <ellipse cy={4} rx={80} ry={11} fill={N.shadow} opacity={0.25} />
        {kind === 0 && (
          <g>
            <ellipse cy={-62} rx={84} ry={64} fill={N.leaf} />
            {[-56, -20, 20, 56].map((dx) => (
              <path key={dx} d={`M${dx * 0.9} -122 Q${dx * 1.3} -62 ${dx * 0.9} -2`} stroke={N.leafDark} strokeWidth={10} fill="none" strokeLinecap="round" />
            ))}
            <ellipse cx={-40} cy={-92} rx={22} ry={11} fill={N.white} opacity={0.35} />
            <path d="M0 -124 q6 -18 20 -20" stroke={N.woodDark} strokeWidth={7} fill="none" strokeLinecap="round" />
          </g>
        )}
        {kind === 1 && (
          <g>
            <path d="M-50 0 Q-30 -30 -40 -60" stroke={N.skyDark} strokeWidth={5} fill="none" />
            {[-46, -40, -36].map((yy, i) => (
              <path key={i} d={`M${-62 + i * 8} ${yy + i * 14} l12 -8 l0 16 Z`} fill={i % 2 ? N.cream : N.skyLight} />
            ))}
            <g transform="translate(20 -112) rotate(12)">
              <path d="M0 -84 L62 0 L0 84 L-62 0 Z" fill={N.sky} />
              <path d="M0 -84 L62 0 L0 0 Z" fill={N.skyLight} />
              <path d="M0 0 L-62 0 L0 84 Z" fill={N.skyDark} />
              <path d="M0 -84 V84 M-62 0 H62" stroke={N.cream} strokeWidth={5} />
            </g>
          </g>
        )}
        {kind === 2 && (
          <g>
            <path d="M-50 -16 Q-58 -80 -40 -104 H40 Q58 -80 50 -16 Q48 0 0 0 Q-48 0 -50 -16 Z" fill={N.sand} />
            <path d="M14 -104 H40 Q58 -80 50 -16 Q48 0 0 0 Q36 -8 34 -40 Q32 -80 14 -104 Z" fill={N.sandDark} opacity={0.55} />
            <rect x={-44} y={-126} width={88} height={26} rx={10} fill={N.wood} />
            <rect x={-30} y={-78} width={60} height={42} rx={10} fill={N.cream} />
            <path d="M-14 -58 q14 -14 28 0" stroke={N.woodDark} strokeWidth={5} fill="none" strokeLinecap="round" />
            <ellipse cx={-30} cy={-70} rx={8} ry={20} fill={N.white} opacity={0.35} />
          </g>
        )}
      </g>
    </g>
  )
}

export const ch4: Chapter = {
  id: 'bundles',
  title: 'Bundling by ten',
  cues: CUES,
  Scene: Ch4Bundles,
  enter: { type: 'pan', dir: 'left' },
}
