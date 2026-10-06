import { useCallback, useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { Glow, Motes, Stars, Vignette, rng } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Title } from '../../art2/props'
import { Moon } from '../../art2/scenery'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Bundle, Pebble, PlaceNumber, Sheep, Stick } from './art'

export const CUES: Cue[] = [
  { id: 'look-back', say: "Look how far you've come. You matched like Ama, gave amounts their names, bundled by ten, and put amounts together and took them apart." },
  { id: 'tree', say: 'Every idea you learned today is a branch on a giant tree: the tree of math. And it keeps on growing.' },
  { id: 'patterns', say: "The 'What comes next?' branch is all about patterns, like day, night, day, night. It will grow soon." },
  { id: 'shapes', say: "The 'How big, and what shape?' branch measures things, from paper clips to planets." },
  { id: 'algebra', say: "And the 'How do amounts change?' branch grows all the way up to algebra, where you find a secret number called x." },
  { id: 'end', say: 'Every big idea starts small. Yours started with a pebble.' },
]

/*
 * The finale. A night over Ama's hill, with one pebble glowing on the hilltop. Four lanterns
 * float up, one for each idea of the lesson, and light up as they are named. Then a tree grows
 * out of the pebble: the trunk is matching, the four branches are the four big questions, and
 * the lanterns settle on the two branches we explored. The camera visits the two buds still to
 * come, climbs the change branch up to a bud called "Solving for x" (the next lesson), and
 * glides all the way back down the trunk to the pebble, which glows gold.
 *
 * Everything below the sky is one world in stage-sized units; a camera (cx, cy, zoom) moves
 * through it. The sky and the far hills sit behind it and move less, for depth.
 */

type P = [number, number]
type Bez = [P, P, P, P]

const bez = (b: Bez, t: number): P => {
  const u = 1 - t
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return [w[0] * b[0][0] + w[1] * b[1][0] + w[2] * b[2][0] + w[3] * b[3][0], w[0] * b[0][1] + w[1] * b[1][1] + w[2] * b[2][1] + w[3] * b[3][1]]
}
const bezAngle = (b: Bez, t: number) => {
  const a = bez(b, Math.max(0, t - 0.01))
  const c = bez(b, Math.min(1, t + 0.01))
  return (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI
}
const bezD = (b: Bez) => `M${b[0][0]} ${b[0][1]} C${b[1][0]} ${b[1][1]} ${b[2][0]} ${b[2][1]} ${b[3][0]} ${b[3][1]}`
/** The first part of a curve, from its start to t (de Casteljau). */
const bezHead = (b: Bez, t: number): Bez => {
  const lerp = (p: P, q: P): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  const a = lerp(b[0], b[1])
  const m = lerp(b[1], b[2])
  const c = lerp(a, m)
  const e = lerp(c, lerp(m, lerp(b[2], b[3])))
  return [b[0], a, c, e]
}

/* ------------------------------------------------------------------ */
/* The tree, in world units                                             */
/* ------------------------------------------------------------------ */

/** The pebble on the hilltop, where the tree takes root. */
const PEB: P = [800, 787]
/** Where the four big branches leave the trunk. */
const FORK: P = [800, 470]

type BranchId = 'A' | 'B' | 'C' | 'D'
interface Branch {
  id: BranchId
  b: Bez
  w: number
  lit: boolean
  tutor: string
  sway: string
}

/** How many? (left, lit), What comes next? (up left, bud), How do amounts change? (up right, lit), How big? What shape? (right, bud). */
const BR: Record<BranchId, Branch> = {
  A: { id: 'A', b: [[786, 526], [700, 508], [560, 462], [440, 432]], w: 24, lit: true, tutor: 'the How many? branch', sway: '-2.1s' },
  B: { id: 'B', b: [[790, 478], [764, 404], [702, 318], [620, 254]], w: 18, lit: false, tutor: 'the What comes next? branch', sway: '-0.7s' },
  C: { id: 'C', b: [[810, 478], [852, 404], [930, 320], [1010, 232]], w: 22, lit: true, tutor: 'the How do amounts change? branch', sway: '-3.3s' },
  D: { id: 'D', b: [[814, 546], [900, 536], [1030, 498], [1150, 472]], w: 18, lit: false, tutor: 'the How big? What shape? branch', sway: '-1.5s' },
}
const ORDER: BranchId[] = ['B', 'D', 'A', 'C']

/** The change branch keeps growing, up and up, to Solving for x. */
const EXT: Bez = [[1010, 232], [1062, 80], [984, -150], [1030, -300]]
const XTIP = EXT[3]
/** Where the little balance scale stands, just above the Solving for x bud. */
const XSCALE: P = [XTIP[0] + 4, XTIP[1] - 120]

/* Lanterns: one for each idea of the lesson. */
const LR = 54

interface Lantern {
  /** The point it hangs from (or, for the one in the fork, the top of the orb). */
  anchor: P
  /** String length. */
  s: number
  /** Where it floats in the sky before the tree grows. */
  sky: P
  branch: BranchId | null
  tutor: string
}

const onBranch = (id: BranchId, t: number): P => {
  const [x, y] = bez(BR[id].b, t)
  return [Math.round(x), Math.round(y)]
}

/** 0 sheep and pebble (matching), 1 the gold 7 (names), 2 a bundle of ten, 3 sticks put together and taken apart. */
const LANS: Lantern[] = [
  { anchor: [FORK[0], FORK[1] - LR], s: 0, sky: [850, 382], branch: null, tutor: 'the sheep and pebble lantern (matching)' },
  { anchor: onBranch('A', 0.45), s: 22, sky: [612, 405], branch: 'A', tutor: 'the gold 7 lantern (names for amounts)' },
  { anchor: onBranch('A', 0.86), s: 26, sky: [376, 446], branch: 'A', tutor: 'the bundle of ten lantern' },
  { anchor: onBranch('C', 0.68), s: 30, sky: [1100, 414], branch: 'C', tutor: 'the adding sticks lantern' },
]
const lanCentre = (L: Lantern): P => [L.anchor[0], L.anchor[1] + L.s + LR]
const skyOffset = (L: Lantern): P => {
  const [x, y] = lanCentre(L)
  return [L.sky[0] - x, L.sky[1] - y]
}

/* Leaves along the two lit branches, the change branch's long climb, and the new growth at the end of cue 2. */
interface LeafSpot {
  x: number
  y: number
  a: number
  s: number
  light: boolean
  t: number
}

function leavesOn(b: Bez, ts: number[], avoid: number[], seed: number, size = 1): LeafSpot[] {
  const r = rng(seed)
  return ts.map((t, i) => {
    const [x, y] = bez(b, t)
    const th = bezAngle(b, t)
    const rad = (d: number) => (d * Math.PI) / 180
    const up = Math.sin(rad(th - 52)) < Math.sin(rad(th + 52)) ? th - 52 : th + 52
    const down = up === th - 52 ? th + 52 : th - 52
    const nearString = avoid.some((a) => Math.abs(a - t) < 0.1)
    const a = i % 2 === 0 || nearString ? up : down
    return { x, y, a: a + (r() - 0.5) * 18, s: size * (0.78 + r() * 0.4), light: r() > 0.45, t }
  })
}

/** Side twigs on the lit branches, so the tree looks full. */
const twig = (id: BranchId, t: number, dx: number, dy: number): Bez => {
  const [x, y] = bez(BR[id].b, t)
  return [[x, y], [x + dx * 0.2, y + dy * 0.45], [x + dx * 0.6, y + dy * 0.85], [x + dx, y + dy]]
}
const TWIGS: { id: 'A' | 'C'; b: Bez }[] = [
  { id: 'A', b: twig('A', 0.3, -30, -74) },
  { id: 'A', b: twig('A', 0.64, -64, -70) },
  { id: 'C', b: twig('C', 0.4, -50, -76) },
]

const LEAVES: Record<'A' | 'C' | 'E', LeafSpot[]> = {
  A: [
    ...leavesOn(BR.A.b, [0.16, 0.24, 0.34, 0.4, 0.52, 0.58, 0.7, 0.76, 0.82, 0.92, 0.97, 1], [0.45, 0.86], 5),
    ...leavesOn(TWIGS[0].b, [0.55, 0.85, 1], [], 6, 1.05),
    ...leavesOn(TWIGS[1].b, [0.45, 0.75, 1], [], 7, 1.05),
  ],
  C: [
    ...leavesOn(BR.C.b, [0.2, 0.28, 0.48, 0.54, 0.6, 0.76, 0.82, 0.88, 0.95, 1], [0.68], 9),
    ...leavesOn(TWIGS[2].b, [0.5, 0.8, 1], [], 10, 1.05),
  ],
  E: leavesOn(EXT, [0.3, 0.38, 0.47, 0.55, 0.63, 0.71, 0.79, 0.87], [], 13, 0.9),
}
/** The tree keeps on growing: fresh leaves at the tips and up the trunk. */
const NEW_LEAVES: LeafSpot[] = [
  { x: 444, y: 432, a: -160, s: 0.7, light: true, t: 0 },
  { x: 446, y: 433, a: 150, s: 0.6, light: true, t: 0 },
  { x: 1008, y: 236, a: -40, s: 0.7, light: true, t: 0 },
  { x: 1006, y: 236, a: -130, s: 0.62, light: true, t: 0 },
  { x: 783, y: 640, a: -150, s: 0.6, light: true, t: 0 },
  { x: 817, y: 600, a: -30, s: 0.6, light: true, t: 0 },
]

/* The pattern beside the What comes next? bud, and the shapes beside the How big? bud. */
const PATTERN: { x: number; y: number; kind: 'sun' | 'moon' | 'q' }[] = [
  { x: 296, y: 318, kind: 'sun' },
  { x: 374, y: 300, kind: 'moon' },
  { x: 452, y: 292, kind: 'sun' },
  { x: 530, y: 300, kind: 'moon' },
  { x: 594, y: 336, kind: 'q' },
]
const SHAPES: { x: number; y: number; kind: 'triangle' | 'ruler' | 'clip' | 'planet' }[] = [
  { x: 1086, y: 600, kind: 'triangle' },
  { x: 1220, y: 616, kind: 'ruler' },
  { x: 1352, y: 606, kind: 'clip' },
  { x: 1468, y: 572, kind: 'planet' },
]

/* The camera at the start of each cue. */
const CAM0 = { cx: 780, cy: 566, z: Math.log(1.26) }

const STATE: string[] = [
  "A starry night over Ama's hill. One pebble glows softly on the hilltop. Four round lanterns float up into the sky one at a time, each lighting up as its idea is named: a sheep with a pebble joined by a teal line (matching), a gold 7 tile (giving amounts names), a bundle of ten sticks with a violet ribbon (bundling by ten), and sticks sliding together and apart (adding and taking away). Nothing to answer here: it is a look back at the whole lesson.",
  'A tree grows out of the pebble on the hilltop: the tree of math. The trunk is labelled Matching, and the sheep-and-pebble lantern sits in the fork where the branches meet. The four branches are the four big questions. "How many?" (left) and "How do amounts change?" (upper right) are leafy and lit, because the learner explored them today: the gold 7 and the bundle-of-ten lanterns hang on How many?, and the adding-sticks lantern hangs on How do amounts change?. "What comes next?" (upper left) and "How big? What shape?" (right) are still closed buds.',
  'The camera moves close to the "What comes next?" bud. It glows, and a tiny pattern appears beside it: sun, moon, sun, moon, and a pink question mark for what comes next (it would be a sun). Then the bud dims again: this branch grows in a later lesson.',
  'The camera moves to the "How big? What shape?" bud. It glows, with a triangle, a ruler, a paper clip and a little planet around it: measuring and shapes, from paper clips to planets. This branch also grows in a later lesson.',
  'The "How do amounts change?" branch grows up and up, out of the top of the first picture, to a glowing bud labelled "Solving for x". Above the bud a little balance scale is tipped; a pink x tile drops onto its empty pan and the scale balances. That is the next lesson, Solving for x (algebra), where x is a secret number we find.',
  'The camera glides all the way down the trunk to the single pebble at the root, which glows warm gold. A quiet ending: every big idea starts small, and this one started with a pebble. The end screen comes next.',
]

/* Ambient loops for this chapter. GSAP moves outer groups; these run on inner ones. */
const CSS = `
.c6-sway { animation: c6-sway 6.5s ease-in-out infinite; }
.c6-sway-b { animation: c6-sway-b 5.2s ease-in-out infinite; }
.c6-swing { animation: c6-swing 3.8s ease-in-out infinite; }
.c6-rock { animation: c6-rock 4.6s ease-in-out infinite; }
.c6-throb { animation: c6-throb 3.2s ease-in-out infinite; }
.c6-twinkle { transform-box: fill-box; transform-origin: center; animation: c6-twinkle 2.6s ease-in-out infinite; }
@keyframes c6-sway { 0%, 100% { transform: rotate(-0.6deg); } 50% { transform: rotate(0.6deg); } }
@keyframes c6-sway-b { 0%, 100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
@keyframes c6-swing { 0%, 100% { transform: rotate(-3.5deg); } 50% { transform: rotate(3.5deg); } }
@keyframes c6-rock { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes c6-throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes c6-twinkle { 0%, 100% { opacity: 0.15; transform: scale(0.55); } 50% { opacity: 1; transform: scale(1); } }
.flow-paused .c6-sway, .flow-paused .c6-sway-b, .flow-paused .c6-swing, .flow-paused .c6-rock, .flow-paused .c6-throb, .flow-paused .c6-twinkle { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .c6-sway, .c6-sway-b, .c6-swing, .c6-rock, .c6-throb, .c6-twinkle { animation: none; }
}
`

/** Rotate an inner group about a point of its parent's space with a CSS loop. */
const pivot = (x: number, y: number, delay?: string): CSSProperties => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px`, animationDelay: delay })

/* ------------------------------------------------------------------ */
/* Little pictures                                                      */
/* ------------------------------------------------------------------ */

function Leaf({ l, cls }: { l: LeafSpot; cls: string }) {
  return (
    <g transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.a.toFixed(1)}) scale(${l.s.toFixed(2)})`}>
      <g className={cls}>
        <path d="M0 0 C10 -14 34 -16 50 0 C34 16 10 14 0 0 Z" fill={l.light ? N.leaf : N.leafDark} />
        <path d="M6 0 Q26 -3 44 0" stroke={l.light ? N.leafLight : N.leaf} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
      </g>
    </g>
  )
}

/** A closed bud pointing up from (0, 0). */
function BudShape({ big = false }: { big?: boolean }) {
  return (
    <g>
      <path d="M0 -4 C-17 -14 -16 -44 0 -62 C16 -44 17 -14 0 -4 Z" fill={big ? N.cream : N.sandLight} />
      <path d="M-3 -10 C-9 -24 -7 -42 0 -56" stroke={N.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.55} />
      <path d="M0 4 C-24 -2 -24 -30 -9 -44 C-12 -26 -8 -12 0 4 Z" fill={N.leafDark} />
      <path d="M0 4 C24 -2 24 -30 9 -44 C12 -26 8 -12 0 4 Z" fill={N.leaf} />
      <circle cy={6} r={8} fill={N.leafDark} />
    </g>
  )
}

/** One stroke of a branch with a thicker base; every path carries `cls` so it grows with dashoffset. */
function BranchStroke({ b, w, cls }: { b: Bez; w: number; cls: string }) {
  const d = bezD(b)
  const base = bezD(bezHead(b, 0.4))
  const common = { fill: 'none', strokeLinecap: 'round' as const, pathLength: 1, strokeDasharray: '1 2' }
  return (
    <g>
      <path className={cls} d={base} stroke={N.woodDark} strokeWidth={w * 1.5} {...common} />
      <path className={cls} d={d} stroke={N.woodDark} strokeWidth={w} {...common} />
      <path className={cls} d={d} stroke={N.wood} strokeWidth={w * 0.42} opacity={0.85} transform="translate(-1 -3)" {...common} />
      <path className={cls} d={d} stroke={N.woodLight} strokeWidth={w * 0.16} opacity={0.6} transform="translate(-2 -6)" {...common} />
    </g>
  )
}

function SunIcon() {
  return (
    <g>
      <Glow r={60} color="warm" opacity={0.45} />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M0 -25 V-33" stroke={N.sand} strokeWidth={6} strokeLinecap="round" transform={`rotate(${i * 45})`} />
      ))}
      <circle r={19} fill={N.sand} />
      <circle r={14} fill={N.sandLight} />
      <circle cx={-5} cy={-5} r={5} fill={N.cream} opacity={0.8} />
    </g>
  )
}

function MoonIcon() {
  return (
    <g>
      <Glow r={56} color="cool" opacity={0.6} />
      <path d="M4 -22 A22 22 0 1 0 4 22 A28 28 0 0 1 4 -22 Z" fill={N.cream} transform="translate(4 0)" />
      <circle cx={-6} cy={6} r={3.5} fill={N.sandLight} opacity={0.7} />
    </g>
  )
}

function ShapeIcon({ kind }: { kind: (typeof SHAPES)[number]['kind'] }) {
  if (kind === 'triangle')
    return (
      <g>
        <Glow r={90} color="cool" opacity={0.5} />
        <path d="M0 -50 L44 26 L-44 26 Z" fill={N.leaf} stroke={N.leafLight} strokeWidth={6} strokeLinejoin="round" />
        <path d="M0 -28 L22 12" stroke={N.leafLight} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      </g>
    )
  if (kind === 'ruler')
    return (
      <g transform="rotate(-8)">
        <Glow r={90} color="cool" opacity={0.45} />
        <rect x={-70} y={-16} width={140} height={34} rx={7} fill={N.sandDark} />
        <rect x={-70} y={-18} width={140} height={32} rx={7} fill={N.sand} />
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={`M${-60 + i * 12} -18 v${i % 5 === 0 ? 16 : 9}`} stroke={N.woodDark} strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
    )
  if (kind === 'clip')
    return (
      <g>
        <Glow r={90} color="cool" opacity={0.45} />
        <g transform="scale(1.35) translate(-44 0)">
          <path d="M20 14 L68 14 A14 14 0 0 0 68 -14 L14 -14 A10 10 0 0 0 14 6 L60 6 A4 4 0 0 0 60 -2 L24 -2" stroke={N.mist} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </g>
    )
  return (
    <g>
      <Glow r={90} color="cool" opacity={0.55} />
      <ellipse rx={56} ry={13} fill="none" stroke={N.sandLight} strokeWidth={6} transform="rotate(-14)" opacity={0.55} />
      <circle r={30} fill={N.sky} />
      <path d="M-30 0 A30 30 0 0 0 30 0 A30 12 0 0 1 -30 0 Z" fill={N.skyDark} opacity={0.5} />
      <circle cx={-10} cy={-12} r={8} fill={N.skyLight} opacity={0.7} />
      <path d="M-55 13 A56 13 0 0 0 55 -13" fill="none" stroke={N.sandLight} strokeWidth={6} strokeLinecap="round" transform="rotate(-14)" />
    </g>
  )
}

/** What each lantern holds. */
function LanternIcon({ i }: { i: number }) {
  if (i === 0)
    return (
      <g>
        <Sheep x={-12} y={24} s={0.44} />
        <Pebble x={31} y={12} s={0.95} seed={2} />
        <g className="c6-link">
          <path className="c6-link-line" d="M-4 -20 Q22 -42 31 -2" stroke={N.teal} strokeWidth={5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 2" />
        </g>
      </g>
    )
  if (i === 1) return <PlaceNumber value={7} x={0} y={0} size={56} />
  if (i === 2) return <Bundle x={0} y={40} s={0.54} />
  return (
    <g>
      <g className="c6-add-l">
        {[-38, -26].map((x) => (
          <Stick key={x} x={x} y={30} s={0.42} />
        ))}
      </g>
      <g className="c6-add-r">
        {[10, 22, 34].map((x) => (
          <Stick key={x} x={x} y={30} s={0.42} />
        ))}
      </g>
    </g>
  )
}

/** A round glass lantern centred on (0, 0). Its glow, icon and bright rim are animated by class. */
function Orb({ i, hang }: { i: number; hang: boolean }) {
  return (
    <g>
      <g className={`c6-oglow c6-oglow${i}`}>
        <g className="c6-throb" style={{ animationDelay: `${-i * 0.8}s` }}>
          <Glow r={150} color={i === 1 ? 'warm' : 'cool'} opacity={0.9} />
        </g>
      </g>
      {hang && <path d={`M-15 ${-LR - 2} H15 L11 ${-LR - 13} H-11 Z`} fill={N.woodDark} />}
      <circle r={LR} fill={N.night0} opacity={0.82} />
      <circle r={LR - 6} fill={N.night2} opacity={0.5} />
      <g className={`c6-oicon c6-oicon${i}`}>
        <LanternIcon i={i} />
      </g>
      <circle r={LR} fill="none" stroke={N.mist} strokeWidth={3} opacity={0.45} />
      <circle className={`c6-orim c6-orim${i}`} r={LR} fill="none" stroke={N.cream} strokeWidth={4.5} />
      <path d={`M${-LR * 0.72} ${-LR * 0.36} A${LR * 0.8} ${LR * 0.8} 0 0 1 ${-LR * 0.3} ${-LR * 0.74}`} stroke={N.white} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.3} />
    </g>
  )
}

function LanternOn({ i }: { i: number }) {
  const L = LANS[i]
  const hang = L.s > 0
  return (
    <g transform={`translate(${L.anchor[0]} ${L.anchor[1]})`}>
      <g className={`c6-lan c6-lan${i}`} data-tutor={L.tutor}>
        <g className={hang ? 'c6-swing' : 'c6-rock'} style={{ ...pivot(0, 0), animationDelay: `${-i * 1.3}s` }}>
          {hang && <line className={`c6-str c6-str${i}`} x1={0} y1={0} x2={0} y2={L.s - 8} stroke={N.mist} strokeWidth={3} strokeLinecap="round" opacity={0.8} />}
          <g transform={`translate(0 ${L.s + LR})`}>
            <Orb i={i} hang={hang} />
          </g>
        </g>
      </g>
    </g>
  )
}

/** The little balance scale of Solving for x: base at (0, 0), pivot 118 up. The beam starts tipped; the x tile drops on and it levels. */
function XScale() {
  return (
    <g data-tutor="the little balance scale">
      <path d="M-58 0 Q-52 -17 -18 -19 H18 Q52 -17 58 0 Z" fill={N.brass} />
      <path d="M18 -19 Q52 -17 58 0 H30 Q34 -12 18 -19 Z" fill={N.brassDark} opacity={0.6} />
      <rect x={-7} y={-118} width={14} height={102} rx={5} fill={N.brass} />
      <rect x={1} y={-118} width={5} height={102} fill={N.brassDark} opacity={0.6} />
      <g className="c6-beam">
        <rect x={-92} y={-124} width={184} height={12} rx={6} fill={N.brass} />
        <rect x={-88} y={-122} width={176} height={4} rx={2} fill={N.brassLight} opacity={0.8} />
        <path d="M-5 -124 L0 -160 L5 -124 Z" fill={N.teal} />
      </g>
      <g className="c6-level">
        <Glow y={-150} r={60} color="teal" />
      </g>
      <circle cy={-118} r={11} fill={N.brass} />
      <circle cy={-118} r={5} fill={N.brassDark} />
      {[-1, 1].map((side) => (
        <g key={side} className={side < 0 ? 'c6-pan-l' : 'c6-pan-r'}>
          <path d={`M${side * 80} -118 L${side * 80 - 28} -62 M${side * 80} -118 L${side * 80 + 28} -62`} stroke={N.brassDark} strokeWidth={2.5} />
          <path d={`M${side * 80 - 34} -62 H${side * 80 + 34} Q${side * 80 + 30} -44 ${side * 80} -42 Q${side * 80 - 30} -44 ${side * 80 - 34} -62 Z`} fill={N.brass} />
          {side > 0 &&
            [62, 80, 98].map((wx) => (
              <g key={wx}>
                <rect x={wx - 8} y={-86} width={16} height={24} rx={4} fill={N.gold} />
                <rect x={wx + 2} y={-86} width={6} height={24} rx={3} fill={N.goldDark} opacity={0.6} />
                <rect x={wx - 4} y={-92} width={8} height={7} rx={3} fill={N.goldDark} />
              </g>
            ))}
          {side < 0 && (
            <g className="c6-xtile" data-tutor="the pink x">
              <g className="c6-xpink">
                <Glow x={-80} y={-86} r={70} color="pink" />
              </g>
              <rect x={-104} y={-111} width={48} height={49} rx={13} fill={N.pink} />
              <rect x={-100} y={-108} width={40} height={8} rx={4} fill={N.pinkLight} opacity={0.6} />
              <text x={-80} y={-74} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={42} fill={N.white}>
                x
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  )
}

/** A four-point sparkle. */
function Sparkle({ x, y, r = 10, delay = 0, color = N.white }: { x: number; y: number; r?: number; delay?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="c6-twinkle" style={{ animationDelay: `${delay}s` }}>
        <path d={`M0 ${-r} L${r * 0.22} ${-r * 0.22} L${r} 0 L${r * 0.22} ${r * 0.22} L0 ${r} L${-r * 0.22} ${r * 0.22} L${-r} 0 L${-r * 0.22} ${-r * 0.22} Z`} fill={color} />
      </g>
    </g>
  )
}

function Label({ cls, tutor, children }: { cls: string; tutor: string; children: ReactNode }) {
  return (
    <g className={`c6-lbl ${cls}`} data-tutor={tutor}>
      {children}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chapter                                                          */
/* ------------------------------------------------------------------ */

export function Ch6Tree({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const uid = 'c6' + useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    if (!el) return
    const one = (sel: string) => el.querySelector(sel)

    /* --- The camera: (cx, cy) of the world sits at the stage centre, zoomed by e^z. --- */
    const cam = { ...CAM0 }
    const last: Record<'cx' | 'cy' | 'z', number> = { ...CAM0 }
    const layers: [Element | null, number][] = [
      [one('.c6-cam'), 1],
      [one('.c6-mid'), 0.6],
      [one('.c6-far'), 0.18],
    ]
    const applyCam = () => {
      for (const [node, k] of layers) {
        if (!node) continue
        const s = Math.exp(cam.z * k)
        const cx = 800 + (cam.cx - 800) * k
        const cy = 450 + (cam.cy - 450) * k
        node.setAttribute('transform', `translate(800 450) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`)
      }
    }
    /** Moves one camera number from wherever the previous move left it, so seeking any way redraws correctly. */
    const camTo = (key: 'cx' | 'cy' | 'z', v: number, at: number, dur: number, ease = 'power2.inOut') => {
      tl.fromTo(cam, { [key]: last[key] }, { [key]: v, duration: dur, ease, immediateRender: false, onUpdate: applyCam }, at)
      last[key] = v
    }
    const fly = (x: number, y: number, z: number, at: number, dur: number, ease = 'power2.inOut') => {
      camTo('cx', x, at, dur, ease)
      camTo('cy', y, at, dur, ease)
      camTo('z', Math.log(z), at, dur, ease)
    }

    /* --- Start: a bare hilltop with the pebble; no tree yet, lanterns below the sky. --- */
    tl.set('.c6-trunk', { scaleY: 0, svgOrigin: `${PEB[0]} ${PEB[1] + 6}` }, 0)
    tl.set('.c6-roots', { scale: 0, svgOrigin: `${PEB[0]} ${PEB[1] + 6}` }, 0)
    tl.set(['.c6-br', '.c6-link-line'], { strokeDashoffset: 1.05 }, 0)
    tl.set(['.c6-leaf', '.c6-bud', '.c6-newleaf'], { scale: 0, svgOrigin: '0 0' }, 0)
    tl.set(['.c6-pat', '.c6-shp'], { scale: 0.3, opacity: 0, svgOrigin: '0 0' }, 0)
    tl.set('.c6-xscale', { scale: 0.3, opacity: 0, svgOrigin: '0 -40' }, 0)
    tl.set('.c6-beam', { rotation: 10, svgOrigin: '0 -118' }, 0)
    tl.set('.c6-pan-l', { y: -14 }, 0)
    tl.set('.c6-pan-r', { y: 14 }, 0)
    tl.set('.c6-xtile', { y: -110, opacity: 0 }, 0)
    tl.set('.c6-lbl', { opacity: 0, y: 14 }, 0)
    tl.set('.c6-oicon', { opacity: 0.3, scale: 1, svgOrigin: '0 0' }, 0)
    tl.set('.c6-pulse', { opacity: 0, y: 0 }, 0)
    tl.set(
      ['.c6-budglow', '.c6-litglow', '.c6-halo', '.c6-oglow', '.c6-orim', '.c6-str', '.c6-xglow', '.c6-level', '.c6-xpink', '.c6-peb-cool', '.c6-peb-warm', '.c6-peb-gold', '.c6-peb-spark', '.c6-hush', '.c6-glints'],
      { opacity: 0 },
      0,
    )
    LANS.forEach((L, i) => {
      const [dx, dy] = skyOffset(L)
      tl.set(`.c6-lan${i}`, { x: dx - 150, y: dy + 120, opacity: 0 }, 0)
    })

    /* 0. Look back: one lantern for each idea floats up and lights up as it is named. */
    tl.addLabel('b0', 0)
    fly(792, 552, 1.2, 0, 9.6, 'sine.inOut')
    tl.to('.c6-peb-cool', { opacity: 0.7, duration: 1.4, ease: 'sine.inOut' }, 0.2)
    const rise: [number, number, number][] = [
      // lantern, floats in at, lights up at (when its idea is said)
      [0, 1.0, 2.4],
      [1, 3.0, 4.5],
      [2, 4.4, 5.7],
      [3, 6.0, 7.1],
    ]
    rise.forEach(([i, at, lit]) => {
      const [dx, dy] = skyOffset(LANS[i])
      tl.to(`.c6-lan${i}`, { opacity: 1, duration: 0.7, ease: 'power1.out' }, at)
      tl.to(`.c6-lan${i}`, { x: dx, y: dy, duration: 1.8, ease: 'sine.out' }, at)
      tl.to(`.c6-oglow${i}`, { opacity: 1, duration: 0.7, ease: 'power2.out' }, lit)
      tl.to(`.c6-orim${i}`, { opacity: 1, duration: 0.4 }, lit)
      tl.to(`.c6-oicon${i}`, { opacity: 1, scale: 1.2, duration: 0.3, ease: 'power2.out' }, lit)
      tl.to(`.c6-oicon${i}`, { scale: 1, duration: 0.55, ease: 'back.out(3)' }, lit + 0.3)
    })
    // One sheep, one pebble: the matching line.
    tl.to('.c6-link-line', { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut' }, 2.6)
    // Put together, then taken apart.
    tl.to('.c6-add-l', { x: 12, duration: 0.6, ease: 'power2.inOut' }, 7.5)
    tl.to('.c6-add-r', { x: -12, duration: 0.6, ease: 'power2.inOut' }, 7.5)
    tl.to('.c6-add-l', { x: 0, duration: 0.6, ease: 'power2.inOut' }, 8.8)
    tl.to('.c6-add-r', { x: 0, duration: 0.6, ease: 'power2.inOut' }, 8.8)

    /* 1. The tree grows out of the pebble, and the lanterns settle on it. */
    const b1 = 9.8
    tl.addLabel('b1', b1)
    fly(800, 470, 1.06, b1, 2.8)
    tl.to('.c6-peb-cool', { opacity: 1, duration: 0.4 }, b1 + 0.2)
    tl.to('.c6-roots', { scale: 1, duration: 0.8, ease: 'back.out(1.6)' }, b1 + 0.3)
    tl.to('.c6-trunk', { scaleY: 1, duration: 1.4, ease: 'power2.out' }, b1 + 0.4)
    tl.to('.c6-pulse', { opacity: 1, duration: 0.2 }, b1 + 0.4)
    tl.to('.c6-pulse', { y: FORK[1] - PEB[1] + 20, duration: 1.4, ease: 'power2.out' }, b1 + 0.4)
    tl.to('.c6-pulse', { opacity: 0, duration: 0.4 }, b1 + 1.6)
    const growAt: Record<BranchId, number> = { A: 1.45, D: 1.55, B: 1.7, C: 1.8 }
    ORDER.forEach((id) => tl.to(`.c6-br-${id}`, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.out' }, b1 + growAt[id]))
    tl.to('.c6-br-tA', { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, b1 + growAt.A + 0.5)
    tl.to('.c6-br-tC', { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, b1 + growAt.C + 0.5)
    tl.to('.c6-leaf-A', { scale: 1, duration: 0.4, ease: 'back.out(2.5)', stagger: 0.06 }, b1 + 2.1)
    tl.to('.c6-leaf-C', { scale: 1, duration: 0.4, ease: 'back.out(2.5)', stagger: 0.06 }, b1 + 2.3)
    tl.to('.c6-bud-D', { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, b1 + 2.45)
    tl.to('.c6-bud-B', { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, b1 + 2.6)
    tl.to(['.c6-litglow', '.c6-glints'], { opacity: 1, duration: 1.2 }, b1 + 2.6)
    tl.to(['.c6-budglow-B', '.c6-budglow-D'], { opacity: 0.25, duration: 1 }, b1 + 2.8)
    const settle: [number, number][] = [
      [2, 1.8],
      [1, 2.0],
      [3, 2.2],
      [0, 2.5],
    ]
    settle.forEach(([i, at]) => {
      tl.to(`.c6-lan${i}`, { x: 0, duration: 1.5, ease: 'sine.inOut' }, b1 + at)
      tl.to(`.c6-lan${i}`, { y: 0, duration: 1.5, ease: 'power1.inOut' }, b1 + at)
      if (LANS[i].s > 0) tl.to(`.c6-str${i}`, { opacity: 1, duration: 0.4 }, b1 + at + 1.25)
    })
    tl.to('.c6-halo', { opacity: 1, duration: 1.8, ease: 'sine.inOut' }, b1 + 3.6)
    // The tree of math: its trunk and four big questions.
    const fadeUp = (sel: string, at: number, to = 1) => tl.to(sel, { opacity: to, y: 0, duration: 0.6, ease: 'power2.out' }, at)
    fadeUp('.c6-lbl-trunk', b1 + 4.3)
    fadeUp('.c6-lbl-A', b1 + 4.6)
    fadeUp('.c6-lbl-C', b1 + 4.8)
    fadeUp('.c6-lbl-B', b1 + 5.0, 0.7)
    fadeUp('.c6-lbl-D', b1 + 5.2, 0.7)
    // And it keeps on growing.
    tl.to('.c6-newleaf', { scale: 1, duration: 0.45, ease: 'back.out(2.5)', stagger: 0.1 }, b1 + 6.9)
    tl.to(['.c6-bud-B', '.c6-bud-D'], { scale: 1.18, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b1 + 7.2)

    /* 2. The What comes next? bud: sun, moon, sun, moon, ... then it rests again. */
    const b2 = b1 + 8.4
    tl.addLabel('b2', b2)
    fly(510, 306, 1.7, b2, 1.9)
    tl.to('.c6-budglow-B', { opacity: 1, duration: 0.8 }, b2 + 0.8)
    tl.to('.c6-bud-B', { scale: 1.3, duration: 0.6, ease: 'back.out(2)' }, b2 + 0.8)
    tl.to('.c6-lbl-B', { opacity: 1, duration: 0.5 }, b2 + 0.8)
    ;[3.6, 4.0, 4.4, 4.8, 5.4].forEach((t, k) => tl.to(`.c6-pat${k}`, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.5)' }, b2 + t))
    tl.to('.c6-pat', { opacity: 0, duration: 0.7 }, b2 + 6.3)
    tl.to('.c6-budglow-B', { opacity: 0.25, duration: 0.8 }, b2 + 6.2)
    tl.to('.c6-bud-B', { scale: 1, duration: 0.6, ease: 'power2.inOut' }, b2 + 6.2)
    tl.to('.c6-lbl-B', { opacity: 0.7, duration: 0.6 }, b2 + 6.4)

    /* 3. The How big? What shape? bud: from paper clips to planets. */
    const b3 = b2 + 7.2
    tl.addLabel('b3', b3)
    camTo('cx', 1180, b3, 2.0)
    camTo('cy', 556, b3, 2.0)
    camTo('z', Math.log(1.38), b3, 1.0, 'sine.inOut')
    camTo('z', Math.log(1.7), b3 + 1.0, 1.0, 'sine.inOut')
    tl.to('.c6-budglow-D', { opacity: 1, duration: 0.8 }, b3 + 1.0)
    tl.to('.c6-bud-D', { scale: 1.3, duration: 0.6, ease: 'back.out(2)' }, b3 + 1.0)
    tl.to('.c6-lbl-D', { opacity: 1, duration: 0.5 }, b3 + 1.0)
    ;[1.9, 3.0, 4.2, 5.0].forEach((t, k) => tl.to(`.c6-shp${k}`, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, b3 + t))

    /* 4. The change branch grows up and up, to Solving for x. */
    const b4 = b3 + 5.9
    tl.addLabel('b4', b4)
    tl.to('.c6-shp', { opacity: 0, duration: 0.6 }, b4)
    tl.to('.c6-budglow-D', { opacity: 0.25, duration: 0.8 }, b4)
    tl.to('.c6-bud-D', { scale: 1, duration: 0.6, ease: 'power2.inOut' }, b4)
    tl.to('.c6-lbl-D', { opacity: 0.7, duration: 0.6 }, b4 + 0.2)
    fly(960, 326, 1.45, b4, 2.0)
    tl.to('.c6-litglow-C', { scale: 1.25, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut', svgOrigin: '930 330' }, b4 + 1.0)
    const grow = { at: b4 + 2.3, dur: 3.0 }
    tl.to('.c6-br-E', { strokeDashoffset: 0, duration: grow.dur, ease: 'sine.inOut' }, grow.at)
    // Each leaf pops as the growing tip passes it (inverse of sine.inOut).
    LEAVES.E.forEach((l, k) => {
      const p = Math.acos(1 - 2 * l.t) / Math.PI
      tl.to(`.c6-leaf-E${k}`, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' }, grow.at + grow.dur * p - 0.05)
    })
    camTo('cx', 960, grow.at, 3.2, 'sine.inOut')
    camTo('cy', -334, grow.at + 0.1, 3.3, 'sine.inOut')
    camTo('z', Math.log(1.55), grow.at, 3.3, 'sine.inOut')
    tl.to('.c6-bud-X', { scale: 1, duration: 0.55, ease: 'back.out(2.5)' }, b4 + 5.0)
    tl.to('.c6-xglow', { opacity: 1, duration: 0.9 }, b4 + 5.2)
    tl.to('.c6-xscale', { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, b4 + 5.5)
    fadeUp('.c6-lbl-X', b4 + 5.9)
    // A secret number called x: it drops onto the empty pan, and the scale balances.
    tl.to('.c6-xtile', { opacity: 1, duration: 0.2 }, b4 + 7.4)
    tl.to('.c6-xtile', { y: 0, duration: 0.5, ease: 'bounce.out' }, b4 + 7.4)
    tl.to('.c6-xpink', { opacity: 1, duration: 0.5 }, b4 + 7.8)
    tl.to('.c6-beam', { rotation: 0, duration: 1.0, ease: 'elastic.out(1, 0.45)' }, b4 + 7.8)
    tl.to('.c6-pan-l', { y: 0, duration: 1.0, ease: 'elastic.out(1, 0.45)' }, b4 + 7.8)
    tl.to('.c6-pan-r', { y: 0, duration: 1.0, ease: 'elastic.out(1, 0.45)' }, b4 + 7.8)
    tl.to('.c6-level', { opacity: 1, duration: 0.3 }, b4 + 8.2)
    tl.to('.c6-level', { opacity: 0.35, duration: 0.6 }, b4 + 8.5)

    /* 5. All the way back down the trunk, to the pebble, which glows gold. Then a quiet beat. */
    const b5 = b4 + 9.1
    tl.addLabel('b5', b5)
    camTo('cx', 800, b5, 1.9, 'sine.inOut')
    camTo('cy', 774, b5, 3.6, 'power2.inOut')
    camTo('z', Math.log(1.15), b5, 1.3, 'sine.inOut')
    camTo('z', Math.log(3), b5 + 1.3, 2.4, 'power2.inOut')
    tl.to('.c6-lbl', { opacity: 0, duration: 1.0 }, b5 + 1.4)
    tl.to('.c6-hush', { opacity: 1, duration: 2.2, ease: 'sine.inOut' }, b5 + 1.8)
    tl.to('.c6-peb-cool', { opacity: 0, duration: 0.9 }, b5 + 3.1)
    tl.to('.c6-peb-warm', { opacity: 1, duration: 1.2, ease: 'power2.out' }, b5 + 3.1)
    tl.to('.c6-peb-gold', { opacity: 1, duration: 0.9, ease: 'power2.out' }, b5 + 3.2)
    tl.to('.c6-peb-spark', { opacity: 1, duration: 0.8 }, b5 + 3.6)
    tl.addLabel('b6', b5 + 6.6)

    applyCam()
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  const lit = (id: BranchId) => BR[id].lit

  return (
    <g ref={root}>
      <style>{CSS}</style>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="-1400" x2="0" y2="980" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={N.space} />
          <stop offset="0.5" stopColor={N.night0} />
          <stop offset="0.8" stopColor={N.night1} />
          <stop offset="1" stopColor={N.dusk} />
        </linearGradient>
      </defs>

      {/* The sky, far away: it barely moves with the camera */}
      <g className="c6-far">
        <rect x={-1600} y={-1800} width={4800} height={3800} fill={`url(#${uid}-sky)`} />
        <circle cx={300} cy={120} r={460} fill={N.sky} opacity={0.07} filter="url(#fx-blur-big)" />
        <circle cx={1300} cy={-300} r={420} fill={N.sky} opacity={0.06} filter="url(#fx-blur-big)" />
        <g transform="translate(-700 -1400)">
          <Stars w={3000} h={2200} count={340} seed={66} />
        </g>
        <Sparkle x={240} y={190} r={12} delay={-0.4} />
        <Sparkle x={1460} y={330} r={10} delay={-1.6} />
        <Sparkle x={560} y={-120} r={13} delay={-0.9} />
        <Sparkle x={1180} y={-40} r={11} delay={-2.1} />
        <Sparkle x={980} y={110} r={9} delay={-1.2} />
        <Moon x={1340} y={150} r={42} />
      </g>

      {/* Distant hills */}
      <g className="c6-mid">
        <path d="M-900 760 C-500 690 -100 700 260 728 C560 684 880 676 1180 712 C1480 680 1900 692 2500 744 V1600 H-900 Z" fill="#22337a" />
        <path d="M-900 800 C-400 744 120 752 520 780 C900 744 1300 748 1700 770 C2000 760 2300 770 2500 790 V1600 H-900 Z" fill="#1b2a66" />
      </g>

      {/* The world, which the camera moves through */}
      <g className="c6-cam">
        {/* light from the tree */}
        <g className="c6-halo">
          <Glow x={800} y={420} r={640} color="cool" opacity={0.42} />
          <Glow x={800} y={780} r={300} color="cool" opacity={0.3} />
        </g>
        {(['A', 'C'] as const).map((id) => (
          <g key={id} className={`c6-litglow c6-litglow-${id}`}>
            {[0.35, 0.65, 0.95].map((t) => {
              const [x, y] = bez(BR[id].b, t)
              return <Glow key={t} x={x} y={y} r={120} color="cool" opacity={0.5} />
            })}
          </g>
        ))}

        {/* Ama's hill */}
        <path d="M-1200 1040 C-200 880 420 792 800 792 C1180 792 1800 880 2800 1040 V1900 H-1200 Z" fill={N.night1} />
        <path d="M-200 900 C200 830 520 793 800 793 C1080 793 1400 830 1800 900" stroke={N.night2} strokeWidth={6} fill="none" />
        {[
          [330, 836],
          [560, 806],
          [1040, 806],
          [1290, 834],
        ].map(([x, y]) => (
          <path key={x} d={`M${x - 14} ${y + 4} Q${x - 10} ${y - 14} ${x - 4} ${y + 4} M${x - 2} ${y + 4} Q${x + 2} ${y - 18} ${x + 8} ${y + 4} M${x + 8} ${y + 4} Q${x + 14} ${y - 10} ${x + 18} ${y + 4}`} stroke={N.night2} strokeWidth={4} fill="none" strokeLinecap="round" />
        ))}
        <g transform="translate(420 846)">
          <g className="breathe">
            <Sheep s={0.62} flip tutor="a sleeping sheep" />
          </g>
        </g>
        <g transform="translate(1300 878)">
          <g className="breathe" style={{ animationDelay: '-1.4s' }}>
            <Sheep s={0.55} />
          </g>
        </g>

        {/* The four branches, behind the trunk. Each sways gently about where it leaves the trunk. */}
        {ORDER.map((id) => {
          const br = BR[id]
          const [bx, by] = br.b[0]
          const tip = br.b[3]
          return (
            <g key={id} data-tutor={br.tutor}>
              <g className={lit(id) ? 'c6-sway' : 'c6-sway-b'} style={pivot(bx, by, br.sway)}>
                <BranchStroke b={br.b} w={br.w} cls={`c6-br c6-br-${id}`} />
                {TWIGS.filter((t) => t.id === id).map((t, k) => (
                  <BranchStroke key={k} b={t.b} w={9} cls={`c6-br c6-br-t${id}`} />
                ))}
                {id === 'C' && (
                  <g data-tutor="the branch growing up to Solving for x">
                    <BranchStroke b={EXT} w={16} cls="c6-br c6-br-E" />
                    {LEAVES.E.map((l, k) => (
                      <Leaf key={k} l={l} cls={`c6-leaf c6-leaf-E c6-leaf-E${k}`} />
                    ))}
                    <g className="c6-xglow">
                      <g className="c6-throb">
                        <Glow x={XTIP[0]} y={XTIP[1] - 90} r={300} color="cool" opacity={0.9} />
                        <Glow x={XTIP[0]} y={XTIP[1] - 30} r={110} color="warm" opacity={0.35} />
                      </g>
                    </g>
                    <g transform={`translate(${XTIP[0]} ${XTIP[1]}) rotate(${((bezAngle(EXT, 1) + 90) * 0.3).toFixed(1)}) scale(1.5)`}>
                      <g className="c6-bud c6-bud-X" data-tutor="the Solving for x bud">
                        <BudShape big />
                      </g>
                    </g>
                    <g transform={`translate(${XSCALE[0]} ${XSCALE[1]}) scale(0.85)`}>
                      <g className="c6-xscale">
                        <circle cy={-80} r={136} fill={N.night0} opacity={0.4} />
                        <circle cy={-80} r={136} fill="none" stroke={N.cream} strokeWidth={4} opacity={0.65} />
                        <XScale />
                      </g>
                    </g>
                  </g>
                )}
                {lit(id) &&
                  LEAVES[id as 'A' | 'C'].map((l, k) => <Leaf key={k} l={l} cls={`c6-leaf c6-leaf-${id}`} />)}
                {!lit(id) && (
                  <g transform={`translate(${tip[0]} ${tip[1]})`}>
                    <g className={`c6-budglow c6-budglow-${id}`}>
                      <g className="c6-throb">
                        <Glow r={160} color="cool" />
                        <Glow r={70} color="cool" />
                      </g>
                    </g>
                    <g transform={`rotate(${((bezAngle(br.b, 1) + 90) * 0.55).toFixed(1)})`}>
                      <g className={`c6-bud c6-bud-${id}`} data-tutor={id === 'B' ? 'the What comes next? bud' : 'the How big? What shape? bud'}>
                        <BudShape />
                      </g>
                    </g>
                  </g>
                )}
                {LANS.map((L, i) => (L.branch === id ? <LanternOn key={i} i={i} /> : null))}
              </g>
            </g>
          )
        })}

        {/* little lights twinkling in the lit branches */}
        <g className="c6-glints">
          {[
            [560, 420],
            [690, 470],
            [470, 400],
            [900, 300],
            [990, 210],
            [870, 380],
          ].map(([x, y], i) => (
            <Sparkle key={i} x={x} y={y} r={8} delay={-i * 0.7} color={N.cream} />
          ))}
        </g>

        {/* The trunk: matching. It grows from the pebble. */}
        <g className="c6-roots">
          {/* tapered roots that hug the hilltop */}
          <path d="M772 780 C738 786 698 796 646 813 C698 808 736 808 768 808 Z" fill={N.woodDark} />
          <path d="M828 780 C862 786 902 796 954 813 C902 808 864 808 832 808 Z" fill={N.woodDark} />
          <path d="M788 790 C778 804 760 818 738 830 C764 826 784 816 800 804 Z" fill={N.woodDark} />
          <path d="M812 790 C822 804 840 818 862 830 C836 826 816 816 800 804 Z" fill={N.woodDark} />
          <path d="M690 801 C722 792 748 786 770 784" stroke={N.woodLight} strokeWidth={4} fill="none" opacity={0.45} strokeLinecap="round" />
        </g>
        <g className="c6-trunk" data-tutor="the trunk (matching)">
          <path d="M732 802 Q764 788 766 744 C770 680 774 590 778 470 L822 470 C826 590 830 680 834 744 Q836 788 868 802 Z" fill={N.woodDark} />
          <path d="M808 802 Q815 770 815 744 C816 680 817 590 815 470 L822 470 C826 590 830 680 834 744 Q836 788 868 802 Z" fill={N.shadow} opacity={0.22} />
          <path d="M756 790 Q770 772 773 744 C776 680 780 590 784 478" stroke={N.woodLight} strokeWidth={6} fill="none" opacity={0.55} strokeLinecap="round" />
          <path d="M795 770 C796 710 798 650 797 590 M805 720 C806 690 807 650 806 620" stroke={N.wood} strokeWidth={3} fill="none" opacity={0.6} strokeLinecap="round" />
        </g>
        <g className="c6-pulse">
          <Glow x={PEB[0]} y={PEB[1] - 20} r={70} color="cool" />
          <circle cx={PEB[0]} cy={PEB[1] - 20} r={8} fill={N.white} />
        </g>
        {NEW_LEAVES.map((l, k) => (
          <Leaf key={k} l={l} cls="c6-newleaf" />
        ))}

        {/* The matching lantern sits in the fork, where every branch begins */}
        <LanternOn i={0} />

        {/* Names on the tree */}
        <Label cls="c6-lbl-trunk" tutor="Matching label">
          <Title x={846} y={718} size={42} anchor="start">
            Matching
          </Title>
        </Label>
        <Label cls="c6-lbl-A" tutor="How many? label">
          <Title x={394} y={448} size={42} anchor="end">
            How many?
          </Title>
        </Label>
        <Label cls="c6-lbl-B" tutor="What comes next? label">
          <Title x={548} y={186} size={40} color={N.mist}>
            What comes next?
          </Title>
        </Label>
        <Label cls="c6-lbl-C" tutor="How do amounts change? label">
          <Title x={1052} y={232} size={40} anchor="start">
            How do amounts
          </Title>
          <Title x={1052} y={278} size={40} anchor="start">
            change?
          </Title>
        </Label>
        <Label cls="c6-lbl-D" tutor="How big? What shape? label">
          <Title x={1196} y={470} size={40} anchor="start" color={N.mist}>
            How big?
          </Title>
          <Title x={1196} y={516} size={40} anchor="start" color={N.mist}>
            What shape?
          </Title>
        </Label>
        <Label cls="c6-lbl-X" tutor="Solving for x label">
          <Title x={XTIP[0] - 88} y={XTIP[1] - 16} size={46} anchor="end">
            Solving for <tspan fill={N.pink}>x</tspan>
          </Title>
        </Label>

        {/* What comes next? A tiny pattern */}
        <g data-tutor="the sun and moon pattern">
          {PATTERN.map((p, k) => (
            <g key={k} transform={`translate(${p.x} ${p.y})`}>
              <g className={`c6-pat c6-pat${k}`}>
                {p.kind === 'sun' && <SunIcon />}
                {p.kind === 'moon' && <MoonIcon />}
                {p.kind === 'q' && (
                  <g>
                    <Glow r={60} color="pink" opacity={0.6} />
                    <text y={18} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={54} fill={N.pink} stroke={N.shadow} strokeOpacity={0.35} strokeWidth={7} paintOrder="stroke">
                      ?
                    </text>
                  </g>
                )}
              </g>
            </g>
          ))}
        </g>

        {/* How big? What shape? From paper clips to planets */}
        {SHAPES.map((p, k) => (
          <g key={k} transform={`translate(${p.x} ${p.y})`} data-tutor={`the ${p.kind === 'clip' ? 'paper clip' : p.kind}`}>
            <g className={`c6-shp c6-shp${k}`}>
              <g className="float" style={{ animationDelay: `${-k * 1.1}s` }}>
                <ShapeIcon kind={p.kind} />
              </g>
            </g>
          </g>
        ))}

        <Motes w={1600} h={760} count={18} seed={31} color={N.skyLight} />

        {/* At the very end, everything but the pebble grows quiet */}
        <g className="c6-hush" pointerEvents="none">
          <rect x={-2000} y={-2000} width={5600} height={4800} fill={N.shadow} opacity={0.38} />
        </g>

        {/* The pebble at the root */}
        <g data-tutor="the pebble at the root">
          <g className="c6-peb-cool">
            <Glow x={PEB[0]} y={PEB[1]} r={110} color="cool" />
          </g>
          <g className="c6-peb-warm">
            <g className="c6-throb">
              <Glow x={PEB[0]} y={PEB[1] - 4} r={150} color="warm" opacity={0.75} />
            </g>
            <Glow x={PEB[0]} y={PEB[1]} r={64} color="warm" />
          </g>
          <Pebble x={PEB[0]} y={PEB[1]} s={1.5} seed={0} />
          <g className="c6-peb-gold" transform={`translate(${PEB[0]} ${PEB[1]}) scale(1.5) rotate(-15)`}>
            <ellipse cy={4} rx={17} ry={12} fill={N.goldDark} />
            <ellipse rx={17} ry={12} fill={N.gold} />
            <ellipse cx={-3} cy={-2} rx={11} ry={7} fill={N.goldLight} opacity={0.8} />
            <ellipse cx={-5} cy={-4} rx={7} ry={3.5} fill={N.white} opacity={0.7} />
          </g>
          <g className="c6-peb-spark">
            <Sparkle x={PEB[0] - 52} y={PEB[1] - 34} r={10} delay={-0.3} color={N.goldLight} />
            <Sparkle x={PEB[0] + 48} y={PEB[1] - 46} r={8} delay={-1.2} color={N.goldLight} />
            <Sparkle x={PEB[0] + 10} y={PEB[1] - 66} r={7} delay={-2} color={N.cream} />
          </g>
        </g>
      </g>

      <Vignette />
    </g>
  )
}

export const ch6: Chapter = {
  id: 'tree',
  title: 'Your knowledge tree',
  cues: CUES,
  Scene: Ch6Tree,
  enter: { type: 'dissolve' },
}
