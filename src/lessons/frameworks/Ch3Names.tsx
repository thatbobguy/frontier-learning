import gsap from 'gsap'
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Glow, Motes, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Title } from '../../art2/props'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Ama, Bag, Hand, NumberLine, Pebble, Sheep, Valley } from './art'

/*
 * Chapter 3: Numbers are names.
 * Ama tries to carry a pebble for every sheep, fish and jar of grain, and the sack squashes
 * her flat. The spilled pebbles rise into the night sky, where each small amount gets a gold
 * name. Seven pebbles, seven fingers and seven marks count up together: the same amount,
 * named "seven", and 7 is only one way of writing it. Then the amounts line up into a number
 * line, where further along means more. At sunrise Zorp's alien market lands in the meadow,
 * and the learner fills baskets from Zorp's chart: a number is a name for an amount,
 * whatever the symbol.
 */

export const CUES: Cue[] = [
  { id: 'heavy', say: 'Matching works. But imagine carrying a pebble for every sheep, every fish, and every jar of grain. That gets heavy!' },
  { id: 'names', say: 'So people gave each amount a name. This many is one. This many is two. This many is three.' },
  { id: 'same-seven', say: 'Seven pebbles, seven fingers, seven marks. They look different, but it is the same amount. That amount has a name: seven.' },
  { id: 'symbols', say: 'The squiggle 7 is just a symbol, a way to write that amount. People in different places wrote seven in different ways.' },
  { id: 'find-seven', say: 'Your turn! Tap the pile that has seven.', play: true, quick: true },
  { id: 'number-line', say: 'Numbers have an order too. Line up one more pebble each time, and you get a number line. Each step to the right is one more.' },
  { id: 'further-is-more', say: 'The further along the line, the bigger the number. Seven is further than three, so seven is more.' },
  {
    id: 'alien-market',
    say: "Now you try! Zorp the alien trader writes numbers with Zorp symbols. Use Zorp's chart to fill each basket with the right number of star fruits.",
    play: true,
  },
]

/** What the world says back on the learner's turns. Fixed lines, so they can be recorded. */
const FIND_LINES = {
  right: 'Yes! That pile has seven.',
  nine: 'That pile has nine. Try another one!',
  five: 'That pile has five. Try another one!',
} as const

const MARKET_LINES = {
  over: 'That basket is too full.',
  under: 'That basket is not full enough.',
  first: 'Yes! The swirl means three.',
  done: 'Yes! A number is a name for an amount, whatever symbol you use.',
} as const

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

type Pt = { x: number; y: number }

/** A small seeded random generator, so scattered piles look the same every time. */
function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** n points scattered inside an ellipse, at least minD apart. */
function scatter(n: number, rx: number, ry: number, minD: number, seed: number): Pt[] {
  const r = seeded(seed)
  let d = minD
  for (let attempt = 0; attempt < 40; attempt++) {
    const pts: Pt[] = []
    let tries = 0
    while (pts.length < n && tries < 5000) {
      tries++
      const x = (r() * 2 - 1) * rx
      const y = (r() * 2 - 1) * ry
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < d)) continue
      pts.push({ x, y })
    }
    if (pts.length === n) return pts
    d *= 0.95
  }
  return Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * d, y: 0 }))
}

function starPath(R: number, r: number, points = 5) {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${(rad * Math.cos(a)).toFixed(1)} ${(rad * Math.sin(a)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/** A pointer position in the local coordinates of `el` (which may sit inside a moving camera group). */
function toLocal(el: SVGGraphicsElement, clientX: number, clientY: number): Pt {
  const m = el.getScreenCTM()
  if (!m) return { x: 0, y: 0 }
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}

/* ------------------------------------------------------------------ */
/* Layout (stage coordinates)                                           */
/* ------------------------------------------------------------------ */

// Cue 1: Ama and the sack that keeps growing.
const AMA = { x: 470, y: 792, s: 1.15 }
/** The bottom of the bag when Ama holds it over her head. */
const BAG_Y = AMA.y - 238 * AMA.s
/** How big the bag is after each kind of thing gets its pebbles. */
const BAG_G = [0.9, 1.45, 2.0, 2.6]
const SQUASH = 0.5
const bagMouth = (g: number, drop = 0) => BAG_Y + drop - 92 * AMA.s * g

const SHEEP: Pt[] = [
  { x: 930, y: 806 },
  { x: 1085, y: 790 },
  { x: 1240, y: 808 },
  { x: 1395, y: 792 },
]
const SHEEP_S = 0.82
const POSTS = [975, 1465]
const ropeY = (x: number) => {
  const t = (x - POSTS[0]) / (POSTS[1] - POSTS[0])
  return 532 + 80 * t * (1 - t)
}
const FISH_X = [1050, 1135, 1220, 1305, 1390]
const JARS: Pt[] = [
  { x: 95, y: 818 },
  { x: 195, y: 834 },
  { x: 295, y: 818 },
]
/** Every thing that gets a pebble, in the order the narration names them. */
const ITEMS: (Pt & { g: number })[] = [
  ...SHEEP.map((p) => ({ x: p.x - 4, y: p.y - 56, g: 0 })),
  ...FISH_X.map((x) => ({ x, y: ropeY(x) + 52, g: 1 })),
  ...JARS.map((p) => ({ x: p.x, y: p.y - 48, g: 2 })),
]
/** Where the pebbles land when the sack bursts. */
const SPILL: Pt[] = [
  { x: 165, y: 868 },
  { x: 250, y: 880 },
  { x: 335, y: 858 },
  { x: 380, y: 884 },
  { x: 590, y: 862 },
  { x: 650, y: 884 },
  { x: 715, y: 852 },
  { x: 790, y: 876 },
  { x: 860, y: 856 },
  { x: 560, y: 892 },
]
/** How far the land sinks when the camera tilts up to the night sky. */
const SINK = 560

// Cue 2: one, two, three.
const NAMES = [
  { x: 400, word: 'one', pts: [[0, 0]] },
  {
    x: 800,
    word: 'two',
    pts: [
      [-50, 8],
      [50, -8],
    ],
  },
  {
    x: 1200,
    word: 'three',
    pts: [
      [-56, 24],
      [56, 20],
      [0, -38],
    ],
  },
] as const
const NAME_Y = 400
const NAME_TILE_Y = 610

// Cue 3: seven pebbles, seven fingers, seven marks.
const PILE = { x: 330, y: 560 }
const PILE7: Pt[] = [
  { x: -102, y: 26 },
  { x: -84, y: -46 },
  { x: -36, y: 84 },
  { x: -16, y: 10 },
  { x: 0, y: -64 },
  { x: 70, y: 34 },
  { x: 84, y: -42 },
]
const HAND_Y = 772
const HS = 1.15
const HANDS = [
  { x: 712, fingers: 5, flip: true },
  { x: 902, fingers: 2, flip: false },
]
const FINGER_GEOM: [number, number, number, number][] = [
  [-30, -120, 92, -8],
  [-4, -126, 102, -1],
  [22, -122, 94, 6],
  [44, -110, 74, 14],
]
/** A raised fingertip of <Hand>, in the hand's own coordinates (0-3 fingers, 4 the thumb). */
function tipLocal(i: number): Pt {
  if (i === 4) return { x: -90, y: -119 }
  const [bx, by, len, ang] = FINGER_GEOM[i]
  const a = (ang * Math.PI) / 180
  const l = len - 12
  return { x: bx + l * Math.sin(a), y: by - l * Math.cos(a) }
}
const TIPS: Pt[] = HANDS.flatMap((h) =>
  Array.from({ length: h.fingers }, (_, i) => {
    const t = tipLocal(i)
    return { x: h.x + (h.flip ? -1 : 1) * HS * t.x, y: HAND_Y + HS * t.y }
  }),
).sort((a, b) => a.x - b.x)
const SLATE = { x: 1280, y: 565, w: 380, h: 250 }
const MARKS = ['M1150 495 L1146 635', 'M1190 495 L1188 635', 'M1230 495 L1232 635', 'M1270 495 L1274 635', 'M1122 614 L1300 514', 'M1360 495 L1358 635', 'M1400 495 L1402 635']
const MARK_C: Pt[] = [
  { x: 1148, y: 565 },
  { x: 1189, y: 565 },
  { x: 1231, y: 565 },
  { x: 1272, y: 565 },
  { x: 1211, y: 564 },
  { x: 1359, y: 565 },
  { x: 1401, y: 565 },
]
const LINK_A = 'M360 462 Q540 320 712 490'
const LINK_B = 'M900 490 Q1080 320 1250 432'
const SEVEN_TILE = { x: 800, y: 190 }

// Cue 4: other ways to write seven.
const MID_PILE = { x: 800, y: 660 }
const GLYPH7 = { x: 800, y: 400 }
type GlyphKind = 'rome' | 'china' | 'arabic' | 'maya'
const CARDS: { kind: GlyphKind; x: number; y: number; place: string; tutor: string }[] = [
  { kind: 'rome', x: 330, y: 290, place: 'Rome', tutor: 'seven written in old Rome: VII' },
  { kind: 'china', x: 330, y: 650, place: 'China', tutor: 'seven written in China' },
  { kind: 'arabic', x: 1270, y: 290, place: 'Baghdad', tutor: 'seven written in Baghdad' },
  { kind: 'maya', x: 1270, y: 650, place: 'Mexico', tutor: 'seven written by the Maya: a bar and two dots' },
]
const CARD_W = 260
const CARD_H = 250

// Cue 5: which pile has seven?
const FIND = [
  { n: 9, x: 330, seed: 11, tutor: 'the left pile' },
  { n: 5, x: 800, seed: 23, tutor: 'the middle pile' },
  { n: 7, x: 1270, seed: 41, tutor: 'the right pile' },
]
const FIND_PTS = FIND.map((p) => scatter(p.n, 150, 96, 64, p.seed))
const FIND_Y = 490
const COUNT_STEP = 0.32
const countMs = (n: number) => (0.6 + n * COUNT_STEP + 0.7) * 1000

// Cues 6 and 7: the number line.
const NL = { x: 200, y: 650, unit: 120 }
const nx = (k: number) => NL.x + NL.unit * k
const colY = (j: number) => NL.y - 38 - j * 32
const ROW3_Y = NL.y - 58
const ROW7_Y = NL.y - 140

// Cue 8: Zorp's market.
type Kind = 'swirl' | 'eye' | 'bolt'
const ZORP_AMOUNT: Record<Kind, number> = { swirl: 3, eye: 5, bolt: 8 }
const ZORP_NAME: Record<Kind, string> = { swirl: 'big swirl', eye: 'eye', bolt: 'little zigzag bolt' }
const CHART_ORDER: Kind[] = ['swirl', 'eye', 'bolt']
const ROUNDS: { kind: Kind; n: number }[] = [
  { kind: 'swirl', n: ZORP_AMOUNT.swirl },
  { kind: 'bolt', n: ZORP_AMOUNT.bolt },
]
/** The chart piles: the 3 spread out wide and the 8 packed tight, so looks can't stand in for counting. */
const CHART_PILES: Record<Kind, Pt[]> = {
  swirl: [
    { x: -64, y: -40 },
    { x: 62, y: -28 },
    { x: -4, y: 42 },
  ],
  eye: [
    { x: -54, y: -34 },
    { x: 14, y: -44 },
    { x: 66, y: 4 },
    { x: -32, y: 30 },
    { x: 34, y: 44 },
  ],
  bolt: [
    { x: -40, y: -32 },
    { x: 0, y: -38 },
    { x: 40, y: -30 },
    { x: -56, y: 6 },
    { x: -16, y: 2 },
    { x: 24, y: 4 },
    { x: -34, y: 40 },
    { x: 8, y: 40 },
  ],
}
const CHART = { x: 40, y: 120, w: 440, h: 640 }
const ROWS_Y = [262, 448, 634]
const COUNTER_Y = 640
const BASKET = { x: 1185, y: 532 }
const ZORP = { x: 1420, y: 700, s: 1.15 }
const SUPPLY: Pt[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 780 + (i - 2) * 96, y: 602 })),
  ...[0, 1, 2, 3].map((i) => ({ x: 780 + (i - 1.5) * 96, y: 530 })),
  ...[0, 1, 2].map((i) => ({ x: 780 + (i - 1) * 96, y: 458 })),
]
/** Where fruits sit in a basket, relative to the middle of its rim. */
const SLOTS: Pt[] = [...[-104, -52, 0, 52, 104].map((x) => ({ x, y: -14 })), ...[-78, -26, 26, 78].map((x) => ({ x, y: -48 })), ...[-52, 0, 52].map((x) => ({ x, y: -82 }))]
const inBasketZone = (p: Pt) => p.x > BASKET.x - 180 && p.x < BASKET.x + 180 && p.y > BASKET.y - 170 && p.y < BASKET.y + 130
const SETTLE_MS = 1900

const STATE: string[] = [
  'Ama the shepherd stands in her sunny valley holding her little pebble bag, then lifts it over her head. Sheep trot in, fish hang on a drying line and jars of grain stand nearby; each one lights up gold and sends one pebble flying into her bag. The bag swells huge, she wobbles, and it squashes her flat. Pebbles spill over the meadow. Carrying a pebble for every single thing gets far too heavy.',
  "The sun sets and the camera tilts up into the night sky. Pebbles rise from the meadow into three small groups: 1 pebble with a gold name tile 'one', 2 pebbles named 'two', 3 pebbles named 'three'. Each amount gets a name.",
  "Three groups side by side in the night sky: a pile of 7 pebbles, two hands holding up 5 and 2 fingers, and 7 chalk tally marks on a slate (a bundle of five and two more). They count up together one at a time, each lighting gold in step. Teal links join the three groups: the same amount. A gold tile 'seven' appears above them: that amount's name.",
  "The 7 pebbles gather in the middle under a big gold 7 that writes itself, with the gold tile 'seven' above. Around them four cards show other ways people wrote seven: Roman VII (Rome), Chinese 七 (China), Eastern Arabic ٧ (Baghdad), and the Maya's bar and two dots (Mexico). Dotted teal lines join every card to the same pile of 7.",
  '',
  'Pebbles pop up in columns: 1 pebble, then 2, then 3, up to 10, one more each time. The columns sink into a number line from 0 to 10 with gold numbers. A pebble hops along the line from 0 to 10, one step at a time, with +1 over each hop: each step right is one more.',
  'On the number line, 7 lights up and a row of 7 pebbles slides along to it; then 3 lights up with a row of 3 pebbles. The stretch of line from 3 to 7 glows, and the 4 extra pebbles in the row of 7 light up: 7 is further along, so 7 is more than 3.',
  '',
]

const FIND_HINTS = [
  'Pick a pile and count its pebbles one at a time.',
  'Seven is one whole hand of fingers and two more.',
  'Touch each pebble with your eyes as you count, so you never count one twice.',
]
const MARKET_HINTS = [
  "Look at the symbol on the basket's tag. Find the same symbol on Zorp's chart.",
  'The star fruits next to that symbol on the chart show how many it means. Put one in the basket for each one on the chart.',
  'Tap a star fruit in the basket to take it back out. A big symbol does not have to mean a big amount.',
]

/* ------------------------------------------------------------------ */
/* Small pieces of art                                                  */
/* ------------------------------------------------------------------ */

/** A fish hanging head down from a drying line by its tail at (x, y). */
function HangingFish({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 12} stroke={N.woodDark} strokeWidth={3} />
      <g transform={`translate(${x} ${y + 52}) rotate(90)`}>
        <path d="M-30 0 L-46 -16 L-42 0 L-46 16 Z" fill={N.skyDark} />
        <ellipse cx={2} cy={0} rx={34} ry={18} fill={N.sky} />
        <ellipse cx={4} cy={6} rx={26} ry={8} fill={N.skyLight} opacity={0.8} />
        <path d="M-2 -16 Q8 -28 18 -16 Z" fill={N.skyDark} />
        <circle cx={22} cy={-5} r={5} fill={N.white} />
        <circle cx={23} cy={-5} r={2.6} fill={N.night0} />
      </g>
    </g>
  )
}

/** A clay jar heaped with grain, standing on (x, y). */
function GrainJar({ x, y, s = 1.25 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={30} ry={6} fill={N.shadow} opacity={0.3} />
      <path d="M-20 -58 C-44 -40 -42 -6 -18 0 L18 0 C42 -6 44 -40 20 -58 Z" fill={N.woodLight} />
      <path d="M8 -58 L20 -58 C44 -40 42 -6 18 0 L6 0 C26 -10 28 -40 8 -58 Z" fill={N.wood} />
      <path d="M-26 -30 Q0 -22 26 -30" stroke={N.woodDark} strokeWidth={4} fill="none" opacity={0.6} />
      <rect x={-22} y={-68} width={44} height={14} rx={6} fill={N.wood} />
      <path d="M-20 -68 Q0 -92 20 -68 Z" fill={N.sandLight} />
      {[-10, 0, 10].map((gx) => (
        <circle key={gx} cx={gx} cy={-72 - (gx === 0 ? 6 : 0)} r={3} fill={N.sand} />
      ))}
    </g>
  )
}

/** A gold name tile, centred on (x, y): an amount's name. */
function NameTile({ x, y, word, size = 64, tutor }: { x: number; y: number; word: string; size?: number; tutor?: string }) {
  const w = Math.max(size * 1.5, word.length * size * 0.58 + size * 0.9)
  const h = size * 1.42
  return (
    <g data-tutor={tutor}>
      <Glow x={x} y={y} r={w * 0.85} color="warm" opacity={0.5} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h * 0.3} fill={N.gold} />
      <rect x={x - w / 2} y={y + h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.goldDark} opacity={0.55} />
      <rect x={x - w / 2 + 10} y={y - h / 2 + 7} width={w - 20} height={h * 0.13} rx={h * 0.06} fill={N.white} opacity={0.35} />
      <text x={x} y={y + size * 0.3} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.night0}>
        {word}
      </text>
    </g>
  )
}

/** Other ways people wrote seven, drawn as shapes (centred on the origin, about 120 wide). */
function Glyph({ kind }: { kind: GlyphKind }) {
  const c = N.gold
  if (kind === 'rome') {
    return (
      <g stroke={c} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M-66 -44 L-40 46 L-14 -44" />
        <path d="M18 -44 V46 M54 -44 V46" />
        <path d="M-78 -44 H-54 M-26 -44 H-2 M8 -44 H28 M44 -44 H64 M8 46 H28 M44 46 H64" strokeWidth={8} />
      </g>
    )
  }
  if (kind === 'china') {
    return (
      <g stroke={c} strokeWidth={15} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-50 -2 L52 -22" />
        <path d="M-10 -56 L-10 26 Q-10 46 12 46 L40 46 Q52 46 52 28" />
      </g>
    )
  }
  if (kind === 'arabic') {
    return <path d="M-34 -46 L0 46 L34 -46" stroke={c} strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
  return (
    <g fill={c}>
      <circle cx={-26} cy={-24} r={15} />
      <circle cx={26} cy={-24} r={15} />
      <rect x={-62} y={8} width={124} height={28} rx={13} />
    </g>
  )
}

/** One of Zorp's number symbols, centred on the origin. The swirl is drawn biggest, the bolt smallest. */
function ZorpSymbol({ kind, color = N.gold }: { kind: Kind; color?: string }) {
  if (kind === 'swirl') {
    const pts: string[] = []
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      const a = t * 2.3 * Math.PI * 2
      const r = 5 + 50 * t
      pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`)
    }
    return <path d={`M ${pts.join(' L ')}`} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
  if (kind === 'eye') {
    return (
      <g>
        <path d="M-40 0 Q0 -34 40 0 Q0 34 -40 0 Z" stroke={color} strokeWidth={9} fill="none" strokeLinejoin="round" />
        <circle r={9} fill={color} />
      </g>
    )
  }
  return <path d="M8 -24 L-10 2 L8 2 L-7 24" stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
}

const LIME = { base: '#c9e04a', light: '#f0f8a8', dark: '#7f9a22' }

/** A star fruit, centred on the origin. */
function StarFruit({ r = 27 }: { r?: number }) {
  return (
    <g>
      <ellipse cy={r * 0.9} rx={r * 0.85} ry={r * 0.22} fill={N.shadow} opacity={0.25} />
      <path d={starPath(r, r * 0.6)} fill={LIME.base} stroke={LIME.dark} strokeWidth={r * 0.13} strokeLinejoin="round" />
      <path d={starPath(r * 0.52, r * 0.3)} fill={LIME.light} opacity={0.85} />
      <circle r={r * 0.1} fill={LIME.dark} />
    </g>
  )
}

const STRAW = '#e8c27a'
const STRAW_DARK = '#a8792f'
const STRAW_LIGHT = '#f7dea6'

function BasketBack() {
  return <ellipse cx={0} cy={0} rx={150} ry={24} fill={STRAW_DARK} />
}

function BasketFront() {
  return (
    <g pointerEvents="none">
      <ellipse cx={0} cy={108} rx={132} ry={12} fill={N.shadow} opacity={0.3} />
      <path d="M-150 0 L150 0 L120 104 Q0 114 -120 104 Z" fill={STRAW} />
      {[34, 68].map((y) => (
        <path key={y} d={`M${-150 + y * 0.31} ${y} Q0 ${y + 12} ${150 - y * 0.31} ${y}`} stroke={STRAW_DARK} strokeWidth={5} fill="none" opacity={0.55} />
      ))}
      {[-90, -30, 30, 90].map((x) => (
        <line key={x} x1={x} y1={6} x2={x * 0.8} y2={104} stroke={STRAW_DARK} strokeWidth={4} opacity={0.4} />
      ))}
      <rect x={-156} y={-10} width={312} height={22} rx={11} fill={STRAW_LIGHT} stroke={STRAW_DARK} strokeWidth={3} />
    </g>
  )
}

type Mood = 'happy' | 'puzzled' | 'oops' | 'cheer'

/** Zorp, a friendly alien trader with eyes on stalks, standing on (0, 0); about 300 tall. */
function Zorp({ mood }: { mood: Mood }) {
  const up = mood === 'cheer'
  const hand = (x: number, y: number) => (
    <g transform={`translate(${x} ${y})`}>
      <circle r={15} fill={N.leaf} />
      {[-34, 0, 34].map((a) => (
        <rect key={a} x={-5} y={-30} width={10} height={20} rx={5} fill={N.leaf} transform={`rotate(${a})`} />
      ))}
    </g>
  )
  return (
    <g data-tutor="Zorp the alien trader">
      {/* eyes on stalks */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={`M${s * 28} -218 Q${s * 40} -262 ${s * 58} -284`} stroke={N.leafDark} strokeWidth={9} fill="none" strokeLinecap="round" />
          <circle cx={s * 58} cy={-292} r={18} fill={N.white} />
          <circle cx={s * 58 + (mood === 'puzzled' ? -s * 4 : 3)} cy={mood === 'puzzled' ? -296 : -290} r={8} fill={N.night0} />
        </g>
      ))}
      {/* the left arm (rests on the counter, or cheers) */}
      {up ? (
        <g>
          <path d="M-80 -110 Q-120 -150 -128 -214" stroke={N.leaf} strokeWidth={24} fill="none" strokeLinecap="round" />
          {hand(-128, -222)}
        </g>
      ) : (
        <g>
          <path d="M-82 -96 Q-118 -76 -120 -46" stroke={N.leaf} strokeWidth={24} fill="none" strokeLinecap="round" />
          {hand(-120, -40)}
        </g>
      )}
      {/* body */}
      <path d="M-92 40 C-104 -100 -72 -228 0 -230 C72 -228 104 -100 92 40 Z" fill={N.leaf} />
      <path d="M30 -222 C82 -200 104 -100 92 40 L52 40 C72 -60 66 -170 30 -222 Z" fill={N.leafDark} opacity={0.45} />
      <path d="M-50 -200 C-76 -170 -86 -120 -84 -70" stroke={N.leafLight} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.7} />
      <circle cx={-52} cy={-34} r={9} fill={N.leafDark} opacity={0.45} />
      <circle cx={-34} cy={-8} r={6} fill={N.leafDark} opacity={0.45} />
      <circle cx={58} cy={-150} r={7} fill={N.leafDark} opacity={0.45} />
      {/* scarf */}
      <path d="M-84 -112 Q0 -86 84 -112 L88 -88 Q0 -62 -88 -88 Z" fill={N.sky} />
      <path d="M38 -96 L64 -38 L42 -42 L32 -92 Z" fill={N.skyDark} />
      {/* big eye */}
      <circle cy={-172} r={36} fill={N.white} />
      <circle cx={mood === 'puzzled' ? -6 : 4} cy={mood === 'puzzled' ? -180 : -168} r={17} fill={N.night0} />
      <circle cx={mood === 'puzzled' ? 0 : 10} cy={mood === 'puzzled' ? -186 : -175} r={6} fill={N.white} />
      {mood === 'puzzled' && <path d="M-34 -222 Q-4 -236 30 -218" stroke={N.leafDark} strokeWidth={7} fill="none" strokeLinecap="round" />}
      {/* mouth */}
      {mood === 'happy' && <path d="M-26 -126 Q0 -104 26 -126" stroke={N.night0} strokeWidth={6} fill="none" strokeLinecap="round" />}
      {mood === 'cheer' && (
        <g>
          <path d="M-30 -130 Q0 -84 30 -130 Z" fill={N.night0} />
          <ellipse cx={0} cy={-104} rx={12} ry={6} fill={N.leafDark} />
        </g>
      )}
      {mood === 'puzzled' && <path d="M-22 -116 Q-11 -126 0 -116 T22 -116" stroke={N.night0} strokeWidth={6} fill="none" strokeLinecap="round" />}
      {mood === 'oops' && <ellipse cx={0} cy={-116} rx={11} ry={14} fill={N.night0} />}
      {/* the right arm: GSAP waves it around the shoulder */}
      <g className="c3-zorp-wave">
        {up ? (
          <g>
            <path d="M80 -110 Q120 -150 128 -214" stroke={N.leaf} strokeWidth={24} fill="none" strokeLinecap="round" />
            {hand(128, -222)}
          </g>
        ) : (
          <g>
            <path d="M82 -96 Q118 -76 120 -46" stroke={N.leaf} strokeWidth={24} fill="none" strokeLinecap="round" />
            {hand(120, -40)}
          </g>
        )}
      </g>
    </g>
  )
}

/** Zorp's stall: a flying saucer for a roof, a canvas back wall, and blinking lights. */
function SaucerStall() {
  const lights = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (0.06 + (0.88 * i) / 12)
    return { x: 1310 - 395 * Math.cos(a), y: 168 + 30 * Math.sin(a), c: [N.cream, N.skyLight, N.leafLight][i % 3] }
  })
  return (
    <g data-tutor="Zorp's flying saucer stall">
      {/* canvas back wall */}
      <rect x={960} y={190} width={780} height={460} fill={N.cream} />
      {[1040, 1150, 1260, 1370, 1480, 1590].map((x) => (
        <path key={x} d={`M${x} 196 Q${x + 18} 420 ${x} 646`} stroke={N.sandLight} strokeWidth={14} fill="none" opacity={0.8} />
      ))}
      <rect x={960} y={190} width={780} height={40} fill={N.shadow} opacity={0.12} />
      {/* legs */}
      {[968, 1652].map((x) => (
        <g key={x}>
          <rect x={x - 10} y={170} width={20} height={480} rx={8} fill={N.stoneDark} />
          <rect x={x - 6} y={170} width={6} height={480} rx={3} fill={N.stoneLight} opacity={0.7} />
        </g>
      ))}
      {/* dome and disc */}
      <path d="M1150 152 A160 116 0 0 1 1470 152 Z" fill={N.skyLight} opacity={0.9} />
      <path d="M1190 132 A120 80 0 0 1 1290 64" stroke={N.white} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.7} />
      <ellipse cx={1310} cy={170} rx={410} ry={50} fill={N.stone} />
      <ellipse cx={1310} cy={156} rx={404} ry={38} fill={N.stoneLight} />
      <ellipse cx={1310} cy={150} rx={300} ry={20} fill={N.mist} opacity={0.8} />
      {lights.map((l, i) => (
        <g key={i} className={i % 2 ? 'blink-light' : undefined}>
          <circle cx={l.x} cy={l.y} r={14} fill={l.c} opacity={0.3} />
          <circle cx={l.x} cy={l.y} r={8} fill={l.c} />
        </g>
      ))}
    </g>
  )
}

/** Triangle flags on a string, for a market-day feel. */
function Bunting({ x1, y1, x2, y2, sag = 70, n = 9 }: { x1: number; y1: number; x2: number; y2: number; sag?: number; n?: number }) {
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2 + sag
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2,
    y: (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * cy + t * t * y2,
  })
  const cols = [N.sky, N.cream, N.leaf, N.sandLight]
  return (
    <g>
      <path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} stroke={N.woodDark} strokeWidth={3} fill="none" />
      {Array.from({ length: n }, (_, i) => {
        const p = at((i + 0.5) / n)
        return <path key={i} d={`M${p.x - 18} ${p.y} L${p.x + 18} ${p.y} L${p.x} ${p.y + 40} Z`} fill={cols[i % cols.length]} />
      })}
    </g>
  )
}

/** Zorp's chart on an easel: each Zorp symbol next to the pile of star fruits it means. */
function ZorpChart() {
  return (
    <g data-tutor="Zorp's chart">
      <g className="c3-chart-glow">
        <Glow x={CHART.x + CHART.w / 2} y={CHART.y + CHART.h / 2} r={460} color="warm" opacity={0.8} />
      </g>
      {/* easel legs */}
      <path
        d={`M${CHART.x + 70} ${CHART.y + CHART.h - 20} L${CHART.x + 40} 812 M${CHART.x + CHART.w - 70} ${CHART.y + CHART.h - 20} L${CHART.x + CHART.w - 40} 812`}
        stroke={N.woodDark}
        strokeWidth={16}
        strokeLinecap="round"
      />
      <ellipse cx={CHART.x + CHART.w / 2} cy={814} rx={230} ry={14} fill={N.shadow} opacity={0.25} />
      <rect x={CHART.x - 10} y={CHART.y - 10} width={CHART.w + 20} height={CHART.h + 20} rx={30} fill={N.woodDark} />
      <rect x={CHART.x} y={CHART.y} width={CHART.w} height={CHART.h} rx={24} fill={N.night1} />
      {/* a little Zorp face says whose chart it is */}
      <g transform={`translate(${CHART.x + CHART.w / 2} ${CHART.y + 34})`}>
        <circle r={22} fill={N.leaf} />
        <circle cy={-2} r={10} fill={N.white} />
        <circle cx={1} cy={-1} r={5} fill={N.night0} />
        <path d="M-14 -16 L-22 -32 M14 -16 L22 -32" stroke={N.leafDark} strokeWidth={4} strokeLinecap="round" />
        <circle cx={-22} cy={-34} r={5} fill={N.white} />
        <circle cx={22} cy={-34} r={5} fill={N.white} />
      </g>
      {CHART_ORDER.map((k, r) => {
        const y = ROWS_Y[r]
        return (
          <g key={k} data-tutor={`the ${ZORP_NAME[k]} row of Zorp's chart`}>
            <rect
              className={`c3-row-glow c3-row-glow-${k}`}
              x={CHART.x + 10}
              y={y - 84}
              width={CHART.w - 20}
              height={168}
              rx={22}
              fill={N.gold}
              fillOpacity={0.12}
              stroke={N.goldLight}
              strokeWidth={6}
              opacity={0}
            />
            <g className={`c3-chart-symglow-${r}`} opacity={0}>
              <Glow x={128} y={y} r={110} color="warm" />
            </g>
            <rect x={62} y={y - 66} width={132} height={132} rx={20} fill={N.night0} />
            <g transform={`translate(128 ${y})`}>
              <ZorpSymbol kind={k} />
            </g>
            <rect x={208} y={y - 14} width={36} height={9} rx={4} fill={N.teal} />
            <rect x={208} y={y + 6} width={36} height={9} rx={4} fill={N.teal} />
            <rect x={258} y={y - 74} width={208} height={148} rx={20} fill={N.night0} />
            {CHART_PILES[k].map((q, j) => (
              <g key={j} transform={`translate(${362 + q.x} ${y + q.y})`}>
                <StarFruit r={19} />
              </g>
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** A drawstring, a patch and a growing heap of pebbles, so Ama's bag reads as a big sack. */
const HEAP: Pt[][] = [
  [
    { x: -14, y: -92 },
    { x: 13, y: -91 },
  ],
  [
    { x: -28, y: -94 },
    { x: 0, y: -97 },
    { x: 28, y: -93 },
  ],
  [
    { x: -14, y: -104 },
    { x: 15, y: -105 },
  ],
  [
    { x: 1, y: -115 },
    { x: -26, y: -103 },
    { x: 29, y: -104 },
  ],
]

function SackDetails() {
  return (
    <g transform={`translate(${AMA.x} ${BAG_Y}) scale(${AMA.s})`} pointerEvents="none">
      {HEAP.map((row, k) => (
        <g key={k} className={`c3-heap c3-heap-${k}`}>
          {row.map((q, j) => (
            <Pebble key={j} x={q.x} y={q.y} s={0.62} seed={k * 3 + j} />
          ))}
        </g>
      ))}
      <path d="M-44 -78 Q0 -66 44 -78" stroke={N.sandDark} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M26 -73 Q44 -62 40 -42" stroke={N.sandDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M26 -73 Q32 -58 25 -46" stroke={N.sandDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={26} cy={-73} r={6} fill={N.sandDark} />
      <g transform="rotate(-8 -24 -40)">
        <rect x={-38} y={-54} width={28} height={26} rx={5} fill={N.woodLight} />
        <rect x={-34} y={-50} width={20} height={18} rx={3} fill="none" stroke={N.woodDark} strokeWidth={2} strokeDasharray="4 3" />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Cue 5: tap the pile that has seven                                    */
/* ------------------------------------------------------------------ */

function FindPiles({ active, counted, onTap }: { active: boolean; counted: number[]; onTap: (i: number) => void }) {
  return (
    <g>
      {FIND.map((p, i) => {
        const on = counted.includes(i)
        const right = on && p.n === 7
        const rowX = (j: number) => p.x + (j - (p.n - 1) / 2) * 46
        const tileDelay = 0.6 + p.n * COUNT_STEP + 0.1
        return (
          <g key={i} className={`c3-find-${i}`}>
            <g onClick={() => onTap(i)} style={{ cursor: active && !on ? 'pointer' : 'default' }} data-tutor={p.tutor} role="button" aria-label={`${p.tutor}`}>
              <g style={{ opacity: right ? 1 : 0, transition: 'opacity 0.5s' }}>
                <Glow x={p.x} y={FIND_Y} r={340} color="warm" />
              </g>
              <ellipse cx={p.x} cy={FIND_Y} rx={210} ry={150} fill={N.night2} opacity={0.6} />
              <ellipse cx={p.x} cy={FIND_Y} rx={210} ry={150} fill="none" stroke={right ? N.gold : N.night3} strokeWidth={right ? 8 : 3} style={{ transition: 'stroke 0.4s' }} />
              {active && counted.length === 0 && <ellipse className="hot-ring" cx={p.x} cy={FIND_Y} rx={200} ry={142} fill="none" stroke={N.mist} strokeWidth={4} />}
              {/* a gold light under each pebble as it is counted */}
              {FIND_PTS[i].map((_, j) => (
                <g key={`g${j}`} style={{ opacity: on ? 1 : 0, transition: `opacity 0.2s ${on ? 0.6 + j * COUNT_STEP : 0}s` }}>
                  <Glow x={rowX(j)} y={FIND_Y} r={34} color="warm" />
                </g>
              ))}
              {FIND_PTS[i].map((q, j) => (
                <g
                  key={`p${j}`}
                  style={{
                    transform: on ? `translate(${rowX(j)}px, ${FIND_Y}px)` : `translate(${p.x + q.x}px, ${FIND_Y + q.y}px)`,
                    transition: `transform 0.45s ease-in-out ${on ? j * 0.05 : 0}s`,
                  }}
                >
                  <Pebble s={on ? 1.2 : 1.75} seed={j + i * 3} />
                </g>
              ))}
              {FIND_PTS[i].map((_, j) => (
                <g key={`n${j}`} style={{ opacity: on ? 1 : 0, transition: `opacity 0.2s ${on ? 0.6 + j * COUNT_STEP : 0}s` }}>
                  <Title x={rowX(j)} y={FIND_Y - 34} size={36} color={N.goldLight}>
                    {String(j + 1)}
                  </Title>
                </g>
              ))}
              <g style={{ opacity: on ? 1 : 0, transition: `opacity 0.35s ${on ? tileDelay : 0}s` }}>
                <NameTile x={p.x} y={FIND_Y + 100} word={String(p.n)} size={60} tutor={on ? `this pile has ${p.n}` : undefined} />
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Cue 8: Zorp's market                                                  */
/* ------------------------------------------------------------------ */

type MarketProps = Pick<ChapterProps, 'say' | 'emit' | 'reportState' | 'setHints' | 'onPlayDone'> & { active: boolean }

function ZorpMarket({ active, say, emit, reportState, setHints, onPlayDone }: MarketProps) {
  const host = useRef<SVGGElement>(null)
  const basketMove = useRef<SVGGElement>(null)
  const basketShake = useRef<SVGGElement>(null)
  const zorpReact = useRef<SVGGElement>(null)
  const beam = useRef<SVGPolygonElement>(null)
  const [round, setRound] = useState(0)
  const [inBasket, setInBasket] = useState<number[]>([])
  const [held, setHeld] = useState<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const [status, setStatus] = useState<'idle' | 'over' | 'under' | 'right'>('idle')
  const [mood, setMood] = useState<Mood>('happy')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const told = useRef({ over: 0, under: 0 })
  // The basket's flight up the beam and back is drawn by hand, around the basket's foot,
  // so GSAP's origin smoothing cannot leave it parked off stage.
  const pose = useRef({ y: 0, s: 1, o: 1 })
  const applyPose = () => {
    const el = basketMove.current
    if (!el) return
    const { y, s, o } = pose.current
    const ox = BASKET.x
    const oy = BASKET.y + 108
    el.setAttribute('transform', `translate(${ox} ${oy + y}) scale(${s}) translate(${-ox} ${-oy})`)
    el.setAttribute('opacity', String(o))
  }
  const timers = useRef<number[]>([])
  const live = useRef({ inBasket, active })
  live.current = { inBasket, active }
  const { kind, n: target } = ROUNDS[round]
  const canPlay = active && !busy && !finished

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // What Pip sees on this turn.
  useEffect(() => {
    if (!active) return
    setHints(MARKET_HINTS)
    const feedback =
      status === 'over'
        ? ' Zorp just checked: the basket is too full.'
        : status === 'under'
          ? ' Zorp just checked: the basket is not full enough.'
          : status === 'right'
            ? ' Zorp just checked: it is right.'
            : ''
    reportState(
      `Zorp's market game, basket ${round + 1} of ${ROUNDS.length}${finished ? ' (all done)' : ''}. Zorp's chart on the easel at the left shows: the big swirl symbol means 3 star fruits, the eye means 5, the little zigzag bolt means 8 (the pile of 3 is spread out wide, the pile of 8 packed tight). ` +
        `The basket on the counter has a tag with the ${ZORP_NAME[kind]}, so the correct answer is ${target} star fruits. The basket holds ${inBasket.length} now.${feedback} ` +
        `The learner taps or drags star fruits from the pyramid on the counter into the basket; tapping a fruit in the basket takes it back out. Zorp checks a moment after the learner stops. ` +
        `Likely mix-up: going by the symbol's size (thinking the big swirl means a lot or the little bolt means a little) instead of reading the chart, or miscounting the chart pile.`,
    )
  }, [active, round, kind, target, inBasket.length, status, finished, reportState, setHints])

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  // A moment after the learner stops, Zorp checks the basket.
  useEffect(() => {
    if (!canPlay || held || status !== 'idle' || inBasket.length === 0) return
    const t = window.setTimeout(() => {
      const count = inBasket.length
      if (count === target) {
        setStatus('right')
        setMood('cheer')
        setBusy(true)
        emit({ type: 'attempt', correct: true, detail: `filled the ${ZORP_NAME[kind]} basket with ${count} star fruits` })
        if (zorpReact.current) gsap.fromTo(zorpReact.current, { y: 0 }, { y: -40, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 3 })
        if (round < ROUNDS.length - 1) {
          void say(MARKET_LINES.first)
          later(2200, () => {
            if (beam.current) gsap.to(beam.current, { opacity: 0.6, duration: 0.3 })
            gsap.to(pose.current, { y: -330, s: 0.3, o: 0, duration: 1.0, ease: 'power2.in', delay: 0.3, onUpdate: applyPose })
          })
          later(3700, () => {
            setRound((r) => r + 1)
            setInBasket([])
            setStatus('idle')
            setMood('happy')
            gsap.fromTo(pose.current, { y: -330, s: 0.3, o: 0 }, { y: 0, s: 1, o: 1, duration: 1.0, ease: 'power2.out', onUpdate: applyPose })
            if (beam.current) gsap.to(beam.current, { opacity: 0, duration: 0.4, delay: 1.0 })
          })
          later(4800, () => setBusy(false))
        } else {
          setFinished(true)
          void say(MARKET_LINES.done)
          onPlayDone()
        }
        return
      }
      const over = count > target
      setStatus(over ? 'over' : 'under')
      setMood(over ? 'oops' : 'puzzled')
      emit({ type: 'attempt', correct: false, detail: `put ${count} star fruits in the ${ZORP_NAME[kind]} basket (it means ${target}): ${over ? 'too full' : 'not full enough'}` })
      if (over) {
        if (basketShake.current)
          gsap.fromTo(basketShake.current, { rotation: 0 }, { rotation: 4, duration: 0.09, yoyo: true, repeat: 7, ease: 'sine.inOut', svgOrigin: `${BASKET.x} ${BASKET.y + 108}` })
        if (told.current.over < 2) {
          told.current.over++
          void say(MARKET_LINES.over)
        }
      } else {
        if (zorpReact.current) gsap.fromTo(zorpReact.current, { rotation: 0 }, { rotation: -8, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', svgOrigin: `${ZORP.x} ${ZORP.y}` })
        if (told.current.under < 2) {
          told.current.under++
          void say(MARKET_LINES.under)
        }
      }
      // Point at where the answer lives: the tag and its row on the chart.
      const row = host.current?.querySelector(`.c3-row-glow-${kind}`)
      const tag = host.current?.querySelector('.c3-tag-glow')
      if (row) gsap.fromTo(row, { opacity: 0 }, { opacity: 1, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' })
      if (tag) gsap.fromTo(tag, { opacity: 0 }, { opacity: 1, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' })
    }, SETTLE_MS)
    return () => window.clearTimeout(t)
    // `say`, `emit` and `onPlayDone` are stable callbacks from the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlay, held, status, inBasket, target, kind, round])

  const place = (id: number, toBasket: boolean) => {
    const has = live.current.inBasket.includes(id)
    if (toBasket === has) return
    setInBasket((b) => (toBasket ? [...b, id] : b.filter((k) => k !== id)))
    setStatus('idle')
    setMood('happy')
    emit({ type: 'progress', detail: `${toBasket ? 'put a star fruit in' : 'took a star fruit out of'} the basket; it now holds ${live.current.inBasket.length + (toBasket ? 1 : -1)}` })
  }

  const down = (id: number) => (e: ReactPointerEvent<SVGGElement>) => {
    if (!canPlay || !host.current) return
    e.preventDefault()
    e.stopPropagation()
    const el = host.current
    const p0 = toLocal(el, e.clientX, e.clientY)
    let moved = 0
    setHeld({ id, x: p0.x, y: p0.y, moved: false })
    const move = (ev: PointerEvent) => {
      const p = toLocal(el, ev.clientX, ev.clientY)
      moved = Math.max(moved, Math.hypot(p.x - p0.x, p.y - p0.y))
      setHeld({ id, x: p.x, y: p.y, moved: moved > 12 })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setHeld(null)
      if (!live.current.active) return
      const p = toLocal(el, ev.clientX, ev.clientY)
      const has = live.current.inBasket.includes(id)
      // A tap moves a fruit across; a drag puts it wherever it is dropped.
      place(id, moved < 12 ? !has : inBasketZone(p))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const lit = status === 'right'
  const dragging = held?.moved ? held : null
  const fruit = (id: number, x: number, y: number, inside: boolean) => (
    <g
      key={`${round}-${id}`}
      transform={`translate(${x} ${y})`}
      onPointerDown={down(id)}
      style={{ cursor: canPlay ? 'pointer' : 'default', touchAction: 'none' }}
      opacity={dragging?.id === id ? 0.3 : 1}
      data-tutor={inside ? 'a star fruit in the basket' : 'a star fruit on the counter'}
    >
      <circle r={46} fill="transparent" />
      {lit && inside && <Glow r={60} color="warm" />}
      <StarFruit />
    </g>
  )
  const supply = SUPPLY.map((p, id) => ({ p, id })).filter(({ id }) => !inBasket.includes(id))

  return (
    <g ref={host}>
      <ZorpChart />
      <Bunting x1={490} y1={118} x2={960} y2={196} sag={70} n={8} />
      <SaucerStall />
      {/* the tractor beam that carries a finished basket up into the saucer */}
      <polygon ref={beam} points={`${BASKET.x - 40},200 ${BASKET.x + 40},200 ${BASKET.x + 180},${COUNTER_Y} ${BASKET.x - 180},${COUNTER_Y}`} fill={N.skyLight} opacity={0} pointerEvents="none" />

      {/* Zorp, behind the counter */}
      <g className="c3-zorp-pop">
        <g ref={zorpReact}>
          <g transform={`translate(${ZORP.x} ${ZORP.y}) scale(${ZORP.s})`}>
            <Zorp mood={mood} />
          </g>
        </g>
      </g>

      {/* the counter, running on to the next stall */}
      <g data-tutor="Zorp's counter">
        <rect x={540} y={COUNTER_Y} width={1200} height={26} rx={8} fill={N.woodLight} />
        <rect x={550} y={COUNTER_Y + 26} width={1180} height={260} fill={N.wood} />
        <rect x={550} y={COUNTER_Y + 26} width={1180} height={14} fill={N.woodDark} opacity={0.6} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={585 + i * 236} y={COUNTER_Y + 66} width={196} height={150} rx={14} fill={N.woodDark} opacity={0.3} />
        ))}
      </g>

      {/* the star fruit pyramid */}
      <g data-tutor="the pile of star fruits">
        <g className="c3-supply-glow" opacity={0}>
          <Glow x={780} y={530} r={260} color="warm" />
        </g>
        <rect x={571} y={COUNTER_Y - 12} width={418} height={18} rx={9} fill={N.sandDark} />
        <rect x={579} y={COUNTER_Y - 12} width={402} height={7} rx={3} fill={N.sandLight} opacity={0.7} />
        {supply.map(({ p, id }) => fruit(id, p.x, p.y, false))}
        {active && !busy && !finished && inBasket.length === 0 && <circle className="hot-ring" cx={SUPPLY[11].x} cy={SUPPLY[11].y} r={46} fill="none" stroke={N.white} strokeWidth={4} />}
      </g>

      {/* the basket, with Zorp's symbol on its tag */}
      <g className="c3-basket-intro">
        <g ref={basketMove}>
          <g ref={basketShake} data-tutor="the basket">
            {lit && <Glow x={BASKET.x} y={BASKET.y} r={260} color="warm" />}
            <g transform={`translate(${BASKET.x} ${BASKET.y})`}>
              <BasketBack />
            </g>
            {inBasket.map((id, j) => {
              const s = SLOTS[Math.min(j, SLOTS.length - 1)]
              return fruit(id, BASKET.x + s.x, BASKET.y + s.y - (j >= SLOTS.length ? 30 : 0), true)
            })}
            <g transform={`translate(${BASKET.x} ${BASKET.y})`}>
              <BasketFront />
              <g data-tutor={`the basket's tag: Zorp's ${ZORP_NAME[kind]} symbol`}>
                <path d="M-30 0 L0 22 L30 0" stroke={N.woodDark} strokeWidth={3} fill="none" />
                <g className="c3-tag-glow" opacity={0}>
                  <Glow y={66} r={110} color="warm" />
                </g>
                <rect x={-58} y={18} width={116} height={96} rx={16} fill={N.night1} stroke={N.woodDark} strokeWidth={4} />
                <g transform="translate(0 66) scale(0.8)">
                  <ZorpSymbol kind={kind} />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* the fruit being dragged follows the finger */}
      {dragging && (
        <g transform={`translate(${dragging.x} ${dragging.y}) scale(1.15)`} pointerEvents="none">
          <StarFruit />
        </g>
      )}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chapter                                                          */
/* ------------------------------------------------------------------ */

export function Ch3Names({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const uid = useId().replace(/:/g, '')
  const [counted, setCounted] = useState<number[]>([])
  const [found, setFound] = useState(false)
  const foundRef = useRef(false)
  const cueRef = useRef(cueIndex)
  cueRef.current = cueIndex
  const timers = useRef<number[]>([])
  const findTurn = cueIndex === 4 && !found

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const build = useCallback((tl: gsap.core.Timeline) => {
    const LAND = ['.vl-land-day', '.vl-land-night', '.c3-ground']
    const amaOrigin = `${AMA.x} ${AMA.y}`
    const bagOrigin = `${AMA.x} ${BAG_Y}`

    /* ---------------- starting state ---------------- */
    tl.set('.c3-flash', { opacity: 1 }, 0)
    tl.set(['.vl-dusk', '.vl-night', '.vl-land-night', '.c3-sky-motes'], { opacity: 0 }, 0)
    tl.set(['.vl-clouds', '.vl-moon', '.c3-cue1'], { opacity: 1 }, 0)
    tl.set('.vl-sun', { y: 0 }, 0)
    tl.set(LAND, { y: 0 }, 0)
    tl.set('.c3-market', { opacity: 0 }, 0)
    tl.set('.c3-shake', { y: 0 }, 0)
    // cue 1
    tl.set('.c3-ama-hold', { opacity: 1 }, 0)
    tl.set(['.c3-ama-cheer', '.c3-ama-wow', '.c3-bag', '.c3-dizzy', '.c3-item-glow', '.c3-spill'], { opacity: 0 }, 0)
    tl.set('.c3-chest-bag', { opacity: 1, y: 0 }, 0)
    tl.set('.c3-bag', { y: 0 }, 0)
    tl.set('.c3-bag-grow', { scale: 0.6, svgOrigin: bagOrigin }, 0)
    tl.set('.c3-bag-squish', { scaleX: 1, scaleY: 1, svgOrigin: bagOrigin }, 0)
    tl.set('.c3-heap', { opacity: 0 }, 0)
    tl.set('.c3-ama-hop', { y: 0 }, 0)
    tl.set('.c3-ama-sway', { rotation: 0, x: 0, svgOrigin: amaOrigin }, 0)
    tl.set('.c3-ama-squash', { scaleX: 1, scaleY: 1, svgOrigin: amaOrigin }, 0)
    SHEEP.forEach((_, i) => {
      tl.set(`.c3-sheep-${i}`, { x: 760 + i * 40, '--walk': 1 }, 0)
      tl.set(`.c3-sheep-hop-${i}`, { y: 0 }, 0)
    })
    FISH_X.forEach((x, i) => tl.set(`.c3-fish-${i}`, { scale: 0, svgOrigin: `${x} ${ropeY(x)}` }, 0))
    JARS.forEach((p, i) => tl.set(`.c3-jar-${i}`, { scale: 0, svgOrigin: `${p.x} ${p.y}` }, 0))
    ITEMS.forEach((it, k) => tl.set(`.c3-fly-${k}`, { x: it.x, y: it.y, opacity: 0 }, 0))
    const drop = (AMA.y - BAG_Y) * (1 - SQUASH)
    const spillFrom = { x: AMA.x, y: bagMouth(BAG_G[3], drop) + 20 }
    SPILL.forEach((_, i) => tl.set(`.c3-spill-${i}`, { x: spillFrom.x, y: spillFrom.y }, 0))
    tl.set('.c3-puff', { opacity: 0, scale: 0.3, svgOrigin: `${AMA.x} ${AMA.y}` }, 0)
    // the sky: groups waiting off stage
    tl.set(['.c3-names', '.c3-seven', '.c3-symbols', '.c3-find', '.c3-nl'], { opacity: 0 }, 0)
    tl.set('.c3-sky-out', { y: 0 }, 0)
    NAMES.forEach((g, k) => g.pts.forEach((q, j) => tl.set(`.c3-name-peb-${k}-${j}`, { x: 1100 - (g.x + q[0] * 1.2) + j * 30, y: 1060 - (NAME_Y + q[1] * 1.2), opacity: 0 }, 0)))
    tl.set('.c3-name-glow', { opacity: 0 }, 0)
    NAMES.forEach((g, k) => tl.set(`.c3-name-tile-${k}`, { opacity: 0, scale: 0.4, svgOrigin: `${g.x} ${NAME_TILE_Y}` }, 0))
    PILE7.forEach((q, i) => tl.set(`.c3-s7-peb-${i}`, { scale: 0, x: 0, y: 0, svgOrigin: `${PILE.x + q.x} ${PILE.y + q.y}` }, 0))
    tl.set('.c3-s7-pile-glow', { opacity: 0, x: 0, y: 0 }, 0)
    tl.set('.c3-s7-hands', { y: 360, opacity: 0 }, 0)
    tl.set('.c3-s7-slate', { opacity: 0, x: 0, scale: 0.85, svgOrigin: `${SLATE.x} ${SLATE.y}` }, 0)
    tl.set('.c3-s7-mark', { attr: { 'stroke-dashoffset': 1 } }, 0)
    tl.set('.c3-cnt', { opacity: 1 }, 0)
    tl.set('.c3-link-dot', { opacity: 0 }, 0)
    for (let k = 0; k < 7; k++) tl.set([`.c3-cnt-peb-${k}`, `.c3-cnt-fin-${k}`, `.c3-cnt-mark-${k}`], { opacity: 0 }, 0)
    tl.set('.c3-link', { attr: { 'stroke-dashoffset': 1 }, opacity: 1 }, 0)
    tl.set('.c3-seven-tile', { opacity: 0, scale: 0.4, y: 0, svgOrigin: `${SEVEN_TILE.x} ${SEVEN_TILE.y}` }, 0)
    tl.set('.c3-glyph7', { attr: { 'stroke-dashoffset': 1 } }, 0)
    tl.set(['.c3-glyph7-glow', '.c3-mid-glow'], { opacity: 0 }, 0)
    CARDS.forEach((c, k) => tl.set(`.c3-card-${k}`, { opacity: 0, scale: 0.4, svgOrigin: `${c.x} ${c.y}` }, 0))
    tl.set('.c3-card-link', { opacity: 0 }, 0)
    FIND.forEach((_, i) => tl.set(`.c3-find-${i}`, { opacity: 0, y: -90 }, 0))
    tl.set('.c3-nl-cliprect', { attr: { width: 0 } }, 0)
    tl.set('.c3-nl-cam', { scale: 1, svgOrigin: '800 600' }, 0)
    for (let k = 1; k <= 10; k++) {
      for (let j = 0; j < k; j++) tl.set(`.c3-col-${k}-${j}`, { scale: 0, y: 0, opacity: 1, svgOrigin: `${nx(k)} ${colY(j)}` }, 0)
    }
    for (let k = 0; k <= 10; k++) {
      tl.set(`.nl-tick-${k}`, { scaleY: 0, transformOrigin: '50% 50%' }, 0)
      tl.set(`.nl-label-${k}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
    }
    tl.set('.c3-hop', { x: nx(0), y: NL.y - 24, opacity: 0 }, 0)
    tl.set('.c3-plus', { opacity: 0, y: 10 }, 0)
    tl.set('.c3-sweep', { x: nx(0), opacity: 0 }, 0)
    tl.set(['.c3-ring-3', '.c3-ring-7'], { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
    for (let j = 0; j < 7; j++) tl.set(`.c3-row7-${j}`, { x: -(nx(j + 1) - nx(0)), opacity: 0, y: 0 }, 0)
    for (let j = 0; j < 3; j++) tl.set(`.c3-row3-${j}`, { x: -(nx(j + 1) - nx(0)), opacity: 0 }, 0)
    tl.set('.c3-gap', { scaleX: 0, svgOrigin: `${nx(3)} ${NL.y}`, opacity: 1 }, 0)
    tl.set('.c3-gap-arc', { attr: { 'stroke-dashoffset': 1 } }, 0)
    tl.set('.c3-extra-glow', { opacity: 0 }, 0)
    // the market
    tl.set('.c3-zorp-pop', { y: 320 }, 0)
    tl.set('.c3-zorp-wave', { rotation: 0, svgOrigin: '82 -100' }, 0)
    tl.set(['.c3-chart-glow', '.c3-supply-glow', '.c3-tag-glow'], { opacity: 0 }, 0)
    CHART_ORDER.forEach((_, r) => tl.set(`.c3-chart-symglow-${r}`, { opacity: 0 }, 0))
    tl.set('.c3-basket-intro', { scaleX: 1, scaleY: 1, svgOrigin: `${BASKET.x} ${BASKET.y + 108}` }, 0)

    /* ---------------- 1. heavy ---------------- */
    tl.addLabel('b0', 0)
    // We arrive out of the glowing "How many?": the light settles into a sunny valley.
    tl.to('.c3-flash', { opacity: 0, duration: 2.2, ease: 'power2.out' }, 0.3)
    tl.fromTo('.c3-valley-drift', { scale: 1.1, svgOrigin: '700 620' }, { scale: 1, duration: 4, ease: 'power2.out' }, 0)
    // "But imagine carrying...": Ama swings her bag up over her head.
    tl.to('.c3-chest-bag', { y: -110, opacity: 0, duration: 0.25, ease: 'power2.in' }, 1.5)
    tl.set('.c3-ama-hold', { opacity: 0 }, 1.66)
    tl.set(['.c3-ama-cheer', '.c3-bag'], { opacity: 1 }, 1.66)
    tl.to('.c3-bag-grow', { scale: BAG_G[0], duration: 0.4, ease: 'back.out(3)' }, 1.66)
    tl.to('.c3-ama-hop', { y: -24, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.6)
    // Sheep trot in.
    SHEEP.forEach((_, i) => {
      tl.to(`.c3-sheep-${i}`, { x: 0, duration: 1.4, ease: 'power1.out' }, 1.7 + i * 0.12)
      tl.set(`.c3-sheep-${i}`, { '--walk': 0 }, 3.1 + i * 0.12)
    })
    tl.to('.c3-fish', { scale: 1, duration: 0.35, ease: 'back.out(2.5)', stagger: 0.07 }, 3.9)
    tl.to('.c3-jar', { scale: 1, duration: 0.35, ease: 'back.out(2.5)', stagger: 0.08 }, 5.0)

    // A pebble flies from every thing into the bag, and the bag swells.
    const groupStart = [3.2, 4.4, 5.6]
    const step = [0.16, 0.12, 0.16]
    const sq = (g: number) => 1 - 0.035 * g
    ITEMS.forEach((it, k) => {
      const idx = ITEMS.slice(0, k).filter((o) => o.g === it.g).length
      const at = groupStart[it.g] + idx * step[it.g]
      const ty = bagMouth(BAG_G[it.g], (AMA.y - BAG_Y) * (1 - sq(it.g))) + 12
      const tx = AMA.x + ((k % 3) - 1) * 14
      tl.to(`.c3-item-glow-${k}`, { opacity: 1, duration: 0.15 }, at - 0.1)
      tl.to(`.c3-item-glow-${k}`, { opacity: 0, duration: 0.5 }, at + 0.45)
      tl.set(`.c3-fly-${k}`, { opacity: 1 }, at)
      tl.to(`.c3-fly-${k}`, { x: tx, duration: 0.7, ease: 'power1.inOut' }, at)
      tl.to(`.c3-fly-${k}`, { y: Math.min(it.y, ty) - 110, duration: 0.35, ease: 'power2.out' }, at)
      tl.to(`.c3-fly-${k}`, { y: ty, duration: 0.35, ease: 'power2.in' }, at + 0.35)
      tl.set(`.c3-fly-${k}`, { opacity: 0 }, at + 0.7)
    })
    // The heap in the sack's mouth grows as the pebbles land.
    ;[3.75, 4.5, 5.75, 6.75].forEach((at, k) => tl.to(`.c3-heap-${k}`, { opacity: 1, duration: 0.15 }, at))
    ;[4.38, 5.6, 6.6].forEach((at, g) => {
      tl.to('.c3-bag-grow', { scale: BAG_G[g + 1], duration: 0.35, ease: 'back.out(3)' }, at)
      tl.to('.c3-ama-squash', { scaleY: sq(g + 1), scaleX: 1 + 0.015 * (g + 1), duration: 0.3, ease: 'power2.out' }, at)
      tl.to('.c3-bag', { y: (AMA.y - BAG_Y) * (1 - sq(g + 1)), duration: 0.3, ease: 'power2.out' }, at)
    })
    tl.set('.c3-ama-cheer', { opacity: 0 }, 5.9)
    tl.set('.c3-ama-wow', { opacity: 1 }, 5.9)
    // "That gets heavy!": she staggers, then the sack squashes her flat.
    ;[-5, 6, -7, 7].forEach((r, i) => tl.to('.c3-ama-sway', { rotation: r, x: r * 5, duration: 0.2, ease: 'sine.inOut' }, 6.8 + i * 0.2))
    tl.to('.c3-ama-sway', { rotation: 0, x: 0, duration: 0.12, ease: 'sine.in' }, 7.6)
    tl.to('.c3-ama-squash', { scaleY: SQUASH, scaleX: 1.32, duration: 0.16, ease: 'power3.in' }, 7.7)
    tl.to('.c3-bag', { y: drop, duration: 0.16, ease: 'power3.in' }, 7.7)
    tl.to('.c3-bag-squish', { scaleY: 0.82, scaleX: 1.08, duration: 0.08, ease: 'power2.out' }, 7.86)
    tl.to('.c3-bag-squish', { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 7.94)
    tl.to('.c3-shake', { y: 10, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' }, 7.86)
    tl.to('.c3-puff', { opacity: 0.9, scale: 1, duration: 0.18, ease: 'power2.out' }, 7.86)
    tl.to('.c3-puff', { opacity: 0, scale: 1.5, duration: 0.5, ease: 'power1.in' }, 8.04)
    SPILL.forEach((p, i) => {
      const at = 7.9 + i * 0.03
      tl.set(`.c3-spill-${i}`, { opacity: 1 }, at)
      tl.to(`.c3-spill-${i}`, { x: p.x, duration: 0.7, ease: 'power1.out' }, at)
      tl.to(`.c3-spill-${i}`, { y: spillFrom.y - 140 - (i % 3) * 30, duration: 0.3, ease: 'power2.out' }, at)
      tl.to(`.c3-spill-${i}`, { y: p.y, duration: 0.4, ease: 'bounce.out' }, at + 0.3)
    })
    SHEEP.forEach((_, i) => tl.to(`.c3-sheep-hop-${i}`, { y: -36, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, 7.9 + i * 0.05))
    tl.to('.c3-dizzy', { opacity: 1, duration: 0.25 }, 8.1)

    /* ---------------- 2. names ---------------- */
    tl.addLabel('b1', 8.8)
    const b1 = tl.labels.b1
    // The sun goes down and the camera tilts up into the night sky.
    tl.to('.vl-dusk', { opacity: 1, duration: 1.3, ease: 'sine.inOut' }, b1)
    tl.to('.vl-clouds', { opacity: 0, duration: 1.0 }, b1)
    tl.to('.vl-sun', { y: 420, duration: 2.0, ease: 'power1.in' }, b1)
    tl.to('.vl-land-night', { opacity: 1, duration: 1.3, ease: 'sine.inOut' }, b1 + 0.5)
    tl.to('.vl-night', { opacity: 1, duration: 1.3, ease: 'sine.inOut' }, b1 + 0.9)
    tl.to(LAND, { y: SINK, duration: 2.0, ease: 'power2.inOut' }, b1 + 0.3)
    tl.to('.c3-sky-motes', { opacity: 1, duration: 1.5 }, b1 + 1.2)
    tl.set('.c3-names', { opacity: 1 }, b1)
    // Pebbles rise from the meadow into three groups, and each amount gets its gold name.
    const rise = [2.0, 3.9, 5.5]
    const tile = [3.6, 5.2, 6.8]
    NAMES.forEach((g, k) => {
      tl.to(`.c3-name-glow-${k}`, { opacity: 1, duration: 0.6 }, b1 + rise[k] + 0.2)
      g.pts.forEach((_, j) => {
        tl.set(`.c3-name-peb-${k}-${j}`, { opacity: 1 }, b1 + rise[k] + j * 0.12)
        tl.to(`.c3-name-peb-${k}-${j}`, { x: 0, y: 0, duration: 0.85, ease: 'back.out(1.3)' }, b1 + rise[k] + j * 0.12)
      })
      tl.to(`.c3-name-tile-${k}`, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, b1 + tile[k])
    })

    /* ---------------- 3. same-seven ---------------- */
    tl.addLabel('b2', b1 + 7.4)
    const b2 = tl.labels.b2
    tl.to('.c3-names', { opacity: 0, y: -70, duration: 0.5, ease: 'power2.in' }, b2)
    tl.to('.vl-moon', { opacity: 0, duration: 0.8 }, b2)
    tl.set('.c3-seven', { opacity: 1 }, b2)
    tl.to('.c3-s7-pile-glow', { opacity: 1, duration: 0.5 }, b2 + 0.1)
    PILE7.forEach((_, i) => tl.to(`.c3-s7-peb-${i}`, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, b2 + 0.15 + i * 0.07))
    tl.to('.c3-s7-hands', { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.3)' }, b2 + 0.8)
    tl.to('.c3-s7-slate', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, b2 + 1.4)
    MARKS.forEach((_, i) => tl.to(`.c3-s7-mark-${i}`, { attr: { 'stroke-dashoffset': 0 }, duration: 0.13, ease: 'power1.out' }, b2 + 1.65 + i * 0.12))
    // They count up together, one to one: pebble, finger and mark light up in step.
    for (let k = 0; k < 7; k++) {
      const at = b2 + 3.0 + k * 0.3
      tl.to([`.c3-cnt-peb-${k}`, `.c3-cnt-fin-${k}`, `.c3-cnt-mark-${k}`], { opacity: 1, duration: 0.12 }, at)
      tl.to([`.c3-cnt-peb-${k}`, `.c3-cnt-fin-${k}`, `.c3-cnt-mark-${k}`], { opacity: 0.85, duration: 0.3 }, at + 0.2)
    }
    // "...the same amount": teal links join them.
    tl.to('.c3-link', { attr: { 'stroke-dashoffset': 0 }, duration: 0.7, ease: 'power1.inOut' }, b2 + 5.0)
    tl.to('.c3-link-dot', { opacity: 1, duration: 0.2, stagger: 0.1 }, b2 + 5.0)
    // "...a name: seven."
    tl.to('.c3-seven-tile', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, b2 + 7.4)

    /* ---------------- 4. symbols ---------------- */
    tl.addLabel('b3', b2 + 8.2)
    const b3 = tl.labels.b3
    tl.to('.c3-s7-hands', { y: 380, opacity: 0, duration: 0.6, ease: 'power2.in' }, b3)
    tl.to('.c3-s7-slate', { x: 260, opacity: 0, duration: 0.6, ease: 'power2.in' }, b3)
    tl.to(['.c3-link', '.c3-link-dot', '.c3-cnt'], { opacity: 0, duration: 0.4 }, b3)
    const dx = MID_PILE.x - PILE.x
    const dy = MID_PILE.y - PILE.y
    PILE7.forEach((_, i) => tl.to(`.c3-s7-peb-${i}`, { x: dx, y: dy, duration: 0.9, ease: 'power2.inOut' }, b3 + 0.1 + i * 0.04))
    tl.to('.c3-s7-pile-glow', { x: dx, y: dy, duration: 0.9, ease: 'power2.inOut' }, b3 + 0.1)
    tl.to('.c3-seven-tile', { y: -50, scale: 0.88, duration: 0.8, ease: 'power2.inOut' }, b3 + 0.2)
    tl.set('.c3-symbols', { opacity: 1 }, b3)
    // The squiggle 7 writes itself.
    tl.to('.c3-glyph7-glow', { opacity: 1, duration: 0.8 }, b3 + 0.6)
    tl.to('.c3-glyph7', { attr: { 'stroke-dashoffset': 0 }, duration: 1.0, ease: 'power1.inOut' }, b3 + 0.6)
    // "...a way to write that amount."
    tl.to('.c3-mid-glow', { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b3 + 4.0)
    // Other places, other ways.
    CARDS.forEach((_, k) => {
      tl.to(`.c3-card-${k}`, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, b3 + 5.4 + k * 0.5)
      tl.to(`.c3-card-link-${k}`, { opacity: 0.85, duration: 0.3 }, b3 + 5.55 + k * 0.5)
    })

    /* ---------------- 5. find-seven ---------------- */
    tl.addLabel('b4', b3 + 7.6)
    const b4 = tl.labels.b4
    tl.to(['.c3-symbols', '.c3-seven'], { opacity: 0, duration: 0.5 }, b4)
    tl.set('.c3-find', { opacity: 1 }, b4)
    FIND.forEach((_, i) => tl.to(`.c3-find-${i}`, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)' }, b4 + 0.4 + i * 0.18))

    /* ---------------- 6. number-line ---------------- */
    tl.addLabel('b5', b4 + 1.9)
    const b5 = tl.labels.b5
    tl.to('.c3-find', { opacity: 0, y: 40, duration: 0.5, ease: 'power2.in' }, b5)
    tl.set('.c3-nl', { opacity: 1 }, b5)
    // One more pebble each time.
    for (let k = 1; k <= 10; k++) {
      for (let j = 0; j < k; j++) tl.to(`.c3-col-${k}-${j}`, { scale: 1, duration: 0.22, ease: 'back.out(2)' }, b5 + 1.9 + (k - 1) * 0.3 + j * 0.02)
    }
    // ...and they become a number line.
    tl.to('.c3-nl-cliprect', { attr: { width: 1800 }, duration: 0.9, ease: 'power2.inOut' }, b5 + 4.9)
    for (let k = 0; k <= 10; k++) tl.to(`.nl-tick-${k}`, { scaleY: 1, duration: 0.25, ease: 'back.out(2)' }, b5 + 5.0 + k * 0.06)
    tl.to('.nl-label-0', { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, b5 + 5.3)
    for (let k = 1; k <= 10; k++) {
      const at = b5 + 5.3 + (k - 1) * 0.1
      for (let j = 0; j < k; j++) {
        tl.to(`.c3-col-${k}-${j}`, { y: NL.y + 40 - colY(j), scale: 0.25, opacity: 0, duration: 0.42, ease: 'power2.in' }, at + j * 0.015)
      }
      tl.to(`.nl-label-${k}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, at + 0.38)
    }
    // Each step to the right is one more.
    tl.to('.c3-hop', { opacity: 1, duration: 0.3 }, b5 + 6.9)
    for (let k = 1; k <= 10; k++) {
      const at = b5 + 7.2 + (k - 1) * 0.26
      tl.to('.c3-hop', { x: nx(k), duration: 0.24, ease: 'none' }, at)
      tl.to('.c3-hop', { y: NL.y - 86, duration: 0.12, ease: 'power2.out' }, at)
      tl.to('.c3-hop', { y: NL.y - 24, duration: 0.12, ease: 'power2.in' }, at + 0.12)
      tl.to(`.c3-plus-${k}`, { opacity: 1, y: 0, duration: 0.15 }, at + 0.04)
      tl.to(`.c3-plus-${k}`, { opacity: 0, duration: 0.4 }, at + 0.6)
      tl.to(`.nl-label-${k}`, { scale: 1.3, duration: 0.1, yoyo: true, repeat: 1 }, at + 0.22)
    }

    /* ---------------- 7. further-is-more ---------------- */
    tl.addLabel('b6', b5 + 9.9)
    const b6 = tl.labels.b6
    tl.to('.c3-hop', { opacity: 0, duration: 0.3 }, b6)
    tl.to('.c3-nl-cam', { scale: 1.12, duration: 1.6, ease: 'power2.inOut' }, b6)
    // A light runs along the line: further along, bigger.
    tl.to('.c3-sweep', { opacity: 1, duration: 0.3 }, b6 + 0.2)
    tl.to('.c3-sweep', { x: nx(10), duration: 2.4, ease: 'sine.inOut' }, b6 + 0.2)
    tl.to('.c3-sweep', { opacity: 0, duration: 0.4 }, b6 + 2.4)
    for (let k = 0; k <= 10; k++) tl.to(`.nl-label-${k}`, { scale: 1 + 0.03 * k + 0.15, duration: 0.14, yoyo: true, repeat: 1 }, b6 + 0.3 + k * 0.22)
    // "Seven..."
    tl.to('.c3-ring-7', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }, b6 + 3.3)
    for (let j = 0; j < 7; j++) tl.to(`.c3-row7-${j}`, { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, b6 + 3.4 + j * 0.06)
    // "...than three"
    tl.to('.c3-ring-3', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }, b6 + 4.6)
    for (let j = 0; j < 3; j++) tl.to(`.c3-row3-${j}`, { x: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, b6 + 4.7 + j * 0.06)
    // "...so seven is more": the gap from 3 to 7 lights up.
    tl.to('.c3-gap', { scaleX: 1, duration: 0.6, ease: 'power2.out' }, b6 + 5.4)
    tl.to('.c3-gap-arc', { attr: { 'stroke-dashoffset': 0 }, duration: 0.25, stagger: 0.12 }, b6 + 5.5)
    tl.to('.c3-extra-glow', { opacity: 1, duration: 0.25, stagger: 0.1 }, b6 + 5.9)
    for (let j = 3; j < 7; j++) tl.to(`.c3-row7-${j}`, { y: -16, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, b6 + 5.9 + (j - 3) * 0.1)

    /* ---------------- 8. alien-market ---------------- */
    tl.addLabel('b7', b6 + 6.9)
    const b7 = tl.labels.b7
    // The sky content floats away as a new day dawns and the camera tilts back down.
    tl.to('.c3-sky-out', { y: -820, duration: 1.2, ease: 'power1.in' }, b7)
    tl.to('.c3-sky-motes', { opacity: 0, duration: 1.0 }, b7 + 0.4)
    tl.to('.vl-night', { opacity: 0, duration: 1.3, ease: 'sine.inOut' }, b7 + 0.2)
    tl.to('.vl-dusk', { opacity: 0, duration: 1.2, ease: 'sine.inOut' }, b7 + 1.2)
    tl.to('.vl-land-night', { opacity: 0, duration: 1.6, ease: 'sine.inOut' }, b7 + 0.5)
    tl.to('.vl-sun', { y: 0, duration: 2.2, ease: 'power2.out' }, b7 + 0.4)
    tl.to('.vl-clouds', { opacity: 1, duration: 1.0 }, b7 + 1.4)
    tl.set('.c3-cue1', { opacity: 0 }, b7)
    tl.set('.c3-market', { opacity: 1 }, b7)
    tl.to(LAND, { y: 0, duration: 1.9, ease: 'power2.inOut' }, b7 + 0.45)
    // "Zorp the alien trader" pops up behind the counter and waves.
    tl.to('.c3-zorp-pop', { y: 0, duration: 0.6, ease: 'back.out(1.8)' }, b7 + 1.8)
    tl.to('.c3-zorp-wave', { rotation: -128, duration: 0.3, ease: 'power2.out' }, b7 + 2.3)
    tl.to('.c3-zorp-wave', { rotation: -108, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, b7 + 2.6)
    tl.to('.c3-zorp-wave', { rotation: 0, duration: 0.35, ease: 'power2.inOut' }, b7 + 3.4)
    // "...writes numbers with Zorp symbols."
    tl.to('.c3-tag-glow', { opacity: 1, duration: 0.3, yoyo: true, repeat: 1 }, b7 + 3.3)
    CHART_ORDER.forEach((_, r) => tl.to(`.c3-chart-symglow-${r}`, { opacity: 1, duration: 0.25, yoyo: true, repeat: 1 }, b7 + 3.8 + r * 0.25))
    // "Use Zorp's chart..."
    tl.to('.c3-chart-glow', { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b7 + 5.0)
    // "...to fill each basket..."
    tl.to('.c3-basket-intro', { scaleY: 0.86, scaleX: 1.06, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, b7 + 6.5)
    // "...with the right number of star fruits."
    tl.to('.c3-supply-glow', { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b7 + 8.4)
    tl.addLabel('b8', b7 + 9.4)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  // What Pip sees.
  useEffect(() => {
    if (cueIndex === 7) return // Zorp's market reports for itself.
    if (cueIndex === 4) {
      setHints(FIND_HINTS)
      const tried = counted.map((i) => `${FIND[i].tutor} (${FIND[i].n})`)
      reportState(
        `Quick tap: three scattered piles of pebbles in the night sky. The left pile has 9, the middle pile has 5, the right pile has 7. The learner should tap the right pile, the one with 7. ` +
          (tried.length ? `Tapped so far (each tapped pile lines its pebbles up and counts them, with its total in a gold tile): ${tried.join(', ')}.` : 'Nothing tapped yet.') +
          (found ? ' They found the pile of seven.' : '') +
          ' Likely mix-up: guessing by how big or spread out a pile looks instead of counting.',
      )
      return
    }
    reportState(STATE[cueIndex] ?? '')
  }, [cueIndex, counted, found, reportState, setHints])

  const tapPile = (i: number) => {
    if (!findTurn || counted.includes(i)) return
    setCounted((c) => [...c, i])
    const p = FIND[i]
    const ms = countMs(p.n)
    if (p.n === 7) {
      setFound(true)
      foundRef.current = true
      emit({ type: 'attempt', correct: true, detail: 'tapped the pile of 7' })
      timers.current.push(
        window.setTimeout(() => {
          if (cueRef.current !== 4) return
          void say(FIND_LINES.right)
          onPlayDone()
        }, ms),
      )
      return
    }
    emit({ type: 'attempt', correct: false, detail: `tapped the pile of ${p.n}` })
    timers.current.push(
      window.setTimeout(() => {
        if (cueRef.current !== 4 || foundRef.current) return
        void say(p.n === 9 ? FIND_LINES.nine : FIND_LINES.five)
      }, ms),
    )
  }

  return (
    <g ref={root}>
      <g className="c3-shake">
        <g className="c3-valley-drift">
          <Valley time="day">
            <g className="c3-ground">
              <g className="c3-cue1">
                <Cue1World />
              </g>
              <g className="c3-market">
                <ZorpMarket active={cueIndex === 7} say={say} emit={emit} reportState={reportState} setHints={setHints} onPlayDone={onPlayDone} />
              </g>
            </g>
          </Valley>
        </g>
      </g>

      <g className="c3-sky-motes">
        <Motes count={22} seed={9} color={N.mist} />
      </g>

      {/* The night sky, where the ideas happen */}
      <g className="c3-sky-out">
        <NamesGroups />
        <SevenBoard />
        <SymbolsBoard />
        <g className="c3-find">
          <FindPiles active={findTurn} counted={counted} onTap={tapPile} />
        </g>
        <NumberLineBoard uid={uid} />
      </g>

      {/* The warm light we arrive through */}
      <g className="c3-flash" pointerEvents="none">
        <rect x={0} y={0} width={1600} height={900} fill={N.cream} opacity={0.35} />
        <Glow x={800} y={450} r={1100} color="warm" />
      </g>
      <Vignette />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The pieces of each picture                                           */
/* ------------------------------------------------------------------ */

function Cue1World() {
  const fly: ReactNode[] = ITEMS.map((_, k) => (
    <g key={k} className={`c3-fly c3-fly-${k}`}>
      <Pebble s={1.1} seed={k} />
    </g>
  ))
  return (
    <g>
      {/* fish on a drying line */}
      <g data-tutor="the fish on the drying line">
        {POSTS.map((x) => (
          <g key={x}>
            <rect x={x - 7} y={518} width={14} height={190} rx={6} fill={N.woodDark} />
            <rect x={x - 4} y={518} width={4} height={190} rx={2} fill={N.wood} />
          </g>
        ))}
        <path d={`M${POSTS[0]} 532 Q${(POSTS[0] + POSTS[1]) / 2} 572 ${POSTS[1]} 532`} stroke={N.woodDark} strokeWidth={3} fill="none" />
        {FISH_X.map((x, i) => {
          const k = SHEEP.length + i
          return (
            <g key={x}>
              <g className={`c3-item-glow c3-item-glow-${k}`}>
                <Glow x={x} y={ropeY(x) + 52} r={80} color="warm" />
              </g>
              <g className={`c3-fish c3-fish-${i}`}>
                <HangingFish x={x} y={ropeY(x)} />
              </g>
            </g>
          )
        })}
      </g>
      {/* jars of grain */}
      <g data-tutor="the jars of grain">
        {JARS.map((p, i) => {
          const k = SHEEP.length + FISH_X.length + i
          return (
            <g key={i}>
              <g className={`c3-item-glow c3-item-glow-${k}`}>
                <Glow x={p.x} y={p.y - 48} r={80} color="warm" />
              </g>
              <g className={`c3-jar c3-jar-${i}`}>
                <GrainJar x={p.x} y={p.y} />
              </g>
            </g>
          )
        })}
      </g>
      {/* sheep */}
      <g data-tutor="the sheep">
        {SHEEP.map((p, i) => (
          <g key={i} className={`c3-sheep-${i}`}>
            <g className={`c3-item-glow c3-item-glow-${i}`}>
              <Glow x={p.x} y={p.y - 56} r={90} color="warm" />
            </g>
            <g className={`c3-sheep-hop-${i}`}>
              <Sheep x={p.x} y={p.y} s={SHEEP_S} />
            </g>
          </g>
        ))}
      </g>

      {/* Ama with her bag */}
      <g className="c3-ama-hop" data-tutor="Ama with her sack of pebbles">
        <g className="c3-ama-sway">
          <g className="c3-bag">
            <g className="c3-bag-grow">
              <g className="c3-bag-squish">
                <Bag x={AMA.x} y={BAG_Y} s={AMA.s} open tutor="Ama's huge sack of pebbles" />
                <SackDetails />
              </g>
            </g>
          </g>
          <g className="c3-ama-squash">
            <g className="c3-ama-hold">
              <Ama x={AMA.x} y={AMA.y} s={AMA.s} staff={false} pose="hold" face="smile" />
            </g>
            <g className="c3-ama-cheer">
              <Ama x={AMA.x} y={AMA.y} s={AMA.s} staff={false} pose="cheer" face="smile" />
            </g>
            <g className="c3-ama-wow">
              <Ama x={AMA.x} y={AMA.y} s={AMA.s} staff={false} pose="cheer" face="wow" />
            </g>
            <g className="c3-chest-bag">
              <Bag x={AMA.x} y={AMA.y - 84 * AMA.s} s={0.62 * AMA.s} />
            </g>
          </g>
        </g>
      </g>
      {/* dust and dizzy stars when the sack lands */}
      <g className="c3-puff">
        {[-1, 1].map((side) => [0, 1, 2].map((i) => <circle key={`${side}${i}`} cx={AMA.x + side * (150 + i * 46)} cy={AMA.y - 14 - (i % 2) * 18} r={36 - i * 7} fill={N.sandLight} opacity={0.8} />))}
      </g>
      {/* dizzy stars spin around Ama's squashed head */}
      <g className="c3-dizzy">
        <g transform={`translate(${AMA.x} ${AMA.y - 150})`}>
          <g className="spin">
            <circle r={80} fill="none" />
            {[0, 120, 240].map((a) => (
              <g key={a} transform={`rotate(${a}) translate(80 0)`}>
                <circle r={16} fill={N.white} opacity={0.25} />
                <path d="M0 -17 L5 -5 L17 0 L5 5 L0 17 L-5 5 L-17 0 L-5 -5 Z" fill={N.white} />
              </g>
            ))}
          </g>
        </g>
      </g>
      {SPILL.map((_, i) => (
        <g key={i} className={`c3-spill c3-spill-${i}`}>
          <Pebble s={1.2} seed={i + 2} />
        </g>
      ))}
      {fly}
    </g>
  )
}

function NamesGroups() {
  return (
    <g className="c3-names">
      {NAMES.map((g, k) => (
        <g key={k} data-tutor={`the group named ${g.word}`}>
          <g className={`c3-name-glow c3-name-glow-${k}`}>
            <Glow x={g.x} y={NAME_Y} r={190} color="warm" opacity={0.55} />
          </g>
          {g.pts.map((q, j) => (
            <g key={j} className={`c3-name-peb-${k}-${j}`}>
              <Pebble x={g.x + q[0] * 1.2} y={NAME_Y + q[1] * 1.2} s={2.8} seed={k + j} />
            </g>
          ))}
          <g className={`c3-name-tile-${k}`}>
            <NameTile x={g.x} y={NAME_TILE_Y} word={g.word} size={76} tutor={`the name ${g.word}`} />
          </g>
        </g>
      ))}
    </g>
  )
}

function SevenBoard() {
  return (
    <g className="c3-seven">
      {/* seven pebbles */}
      <g className="c3-s7-pile-glow">
        <Glow x={PILE.x} y={PILE.y} r={220} color="warm" opacity={0.45} />
      </g>
      <g data-tutor="seven pebbles">
        {PILE7.map((q, i) => (
          <g key={i} className={`c3-s7-peb-${i}`}>
            <g className="c3-cnt">
              <g className={`c3-cnt-peb-${i}`}>
                <Glow x={PILE.x + q.x} y={PILE.y + q.y} r={62} color="warm" />
                <ellipse cx={PILE.x + q.x} cy={PILE.y + q.y + 3} rx={40} ry={30} fill="none" stroke={N.goldLight} strokeWidth={4} />
              </g>
            </g>
            <Pebble x={PILE.x + q.x} y={PILE.y + q.y} s={1.9} seed={i} />
          </g>
        ))}
      </g>

      {/* seven fingers: a whole hand and two more */}
      <g className="c3-s7-hands" data-tutor="seven fingers: five on one hand and two on the other">
        <Glow x={800} y={600} r={240} color="warm" opacity={0.35} />
        {HANDS.map((h) => (
          <Hand key={h.x} x={h.x} y={HAND_Y} s={HS} fingers={h.fingers} flip={h.flip} />
        ))}
        {TIPS.map((t, i) => (
          <g key={i} className="c3-cnt">
            <g className={`c3-cnt-fin-${i}`}>
              <Glow x={t.x} y={t.y} r={46} color="warm" />
              <circle cx={t.x} cy={t.y} r={18} fill="none" stroke={N.goldLight} strokeWidth={5} />
            </g>
          </g>
        ))}
      </g>

      {/* seven marks on a slate */}
      <g className="c3-s7-slate" data-tutor="seven tally marks">
        <rect x={SLATE.x - SLATE.w / 2 - 10} y={SLATE.y - SLATE.h / 2 - 10} width={SLATE.w + 20} height={SLATE.h + 20} rx={30} fill={N.woodDark} />
        <rect x={SLATE.x - SLATE.w / 2} y={SLATE.y - SLATE.h / 2} width={SLATE.w} height={SLATE.h} rx={22} fill={N.night0} />
        {MARKS.map((d, i) => (
          <path key={i} className={`c3-s7-mark c3-s7-mark-${i}`} d={d} pathLength={1} strokeDasharray="1 1" stroke={N.cream} strokeWidth={13} strokeLinecap="round" fill="none" />
        ))}
        {/* each mark turns gold as it is counted */}
        {MARK_C.map((c, i) => (
          <g key={`c${i}`} className="c3-cnt">
            <g className={`c3-cnt-mark-${i}`}>
              <Glow x={c.x} y={c.y} r={60} color="warm" opacity={0.7} />
              <path d={MARKS[i]} stroke={N.gold} strokeWidth={13} strokeLinecap="round" fill="none" />
            </g>
          </g>
        ))}
      </g>

      {/* teal links: the same amount */}
      <g data-tutor="teal links: the same amount">
        {[LINK_A, LINK_B].map((d) => (
          <g key={d}>
            <g opacity={0.25}>
              <path className="c3-link" d={d} pathLength={1} strokeDasharray="1 1" stroke={N.teal} strokeWidth={22} strokeLinecap="round" fill="none" filter="url(#fx-soft)" />
            </g>
            <path className="c3-link" d={d} pathLength={1} strokeDasharray="1 1" stroke={N.teal} strokeWidth={9} strokeLinecap="round" fill="none" />
          </g>
        ))}
        {[
          [360, 462],
          [712, 490],
          [900, 490],
          [1250, 432],
        ].map(([x, y]) => (
          <circle key={x} className="c3-link-dot" cx={x} cy={y} r={13} fill={N.tealLight} stroke={N.teal} strokeWidth={4} />
        ))}
      </g>

      <g className="c3-seven-tile">
        <NameTile x={SEVEN_TILE.x} y={SEVEN_TILE.y} word="seven" size={84} tutor="the name seven" />
      </g>
    </g>
  )
}

function SymbolsBoard() {
  return (
    <g className="c3-symbols">
      <g className="c3-mid-glow">
        <Glow x={MID_PILE.x} y={MID_PILE.y} r={230} color="warm" />
      </g>
      {/* teal dotted lines: every card names the same pile */}
      {CARDS.map((c, k) => {
        const ux = MID_PILE.x - c.x
        const uy = MID_PILE.y - c.y
        const len = Math.hypot(ux, uy)
        const sx = c.x + (ux / len) * 150
        const sy = c.y + (uy / len) * 150
        const ex = MID_PILE.x - (ux / len) * 140
        const ey = MID_PILE.y - (uy / len) * 120
        return <line key={k} className={`c3-card-link c3-card-link-${k}`} x1={sx} y1={sy} x2={ex} y2={ey} stroke={N.teal} strokeWidth={6} strokeLinecap="round" strokeDasharray="2 16" />
      })}
      {/* the squiggle 7 */}
      <g className="c3-glyph7-glow">
        <Glow x={GLYPH7.x} y={GLYPH7.y} r={200} color="warm" opacity={0.8} />
      </g>
      <path
        className="c3-glyph7"
        d={`M${GLYPH7.x - 66} ${GLYPH7.y - 96} H${GLYPH7.x + 66} L${GLYPH7.x - 6} ${GLYPH7.y + 104}`}
        pathLength={1}
        strokeDasharray="1 1"
        stroke={N.gold}
        strokeWidth={32}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        data-tutor="the symbol 7"
      />
      {CARDS.map((c, k) => (
        <g key={k} className={`c3-card-${k}`} data-tutor={c.tutor}>
          <rect x={c.x - CARD_W / 2} y={c.y - CARD_H / 2 + 8} width={CARD_W} height={CARD_H} rx={30} fill={N.shadow} opacity={0.4} />
          <rect x={c.x - CARD_W / 2} y={c.y - CARD_H / 2} width={CARD_W} height={CARD_H} rx={30} fill={N.night1} stroke={N.night3} strokeWidth={4} />
          <Glow x={c.x} y={c.y - 30} r={110} color="warm" opacity={0.35} />
          <g transform={`translate(${c.x} ${c.y - 30})`}>
            <Glyph kind={c.kind} />
          </g>
          <Title x={c.x} y={c.y + 92} size={38} color={N.cream} weight={700}>
            {c.place}
          </Title>
        </g>
      ))}
    </g>
  )
}

function NumberLineBoard({ uid }: { uid: string }) {
  return (
    <g className="c3-nl">
      <g className="c3-nl-cam">
        <clipPath id={`${uid}-nl`}>
          <rect className="c3-nl-cliprect" x={120} y={NL.y - 90} width={0} height={220} />
        </clipPath>
        <g className="c3-sweep">
          <Glow x={0} y={NL.y} r={150} color="warm" />
        </g>
        {[3, 7].map((k) => (
          <g key={k} className={`c3-ring-${k}`} data-tutor={k === 3 ? 'three on the number line' : 'seven on the number line'}>
            <Glow x={nx(k)} y={NL.y + 42} r={90} color="warm" opacity={0.7} />
            <circle cx={nx(k)} cy={NL.y + 42} r={40} fill={N.night0} fillOpacity={0.5} stroke={N.goldLight} strokeWidth={6} />
          </g>
        ))}
        <g clipPath={`url(#${uid}-nl)`}>
          <NumberLine x={NL.x} y={NL.y} from={0} to={10} unit={NL.unit} size={44} />
        </g>
        {/* columns: one more pebble each time */}
        {Array.from({ length: 10 }, (_, i) => {
          const k = i + 1
          return (
            <g key={k} data-tutor={`a column of ${k} pebbles`}>
              {Array.from({ length: k }, (_, j) => (
                <g key={j} className={`c3-col-${k}-${j}`}>
                  <Pebble x={nx(k)} y={colY(j)} s={1.4} seed={j + k} />
                </g>
              ))}
            </g>
          )
        })}
        {/* +1 over every hop */}
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} className={`c3-plus c3-plus-${i + 1}`}>
            <Title x={nx(i) + 60} y={NL.y - 110} size={36} color={N.goldLight}>
              +1
            </Title>
          </g>
        ))}
        <g className="c3-hop" data-tutor="a pebble hopping along the number line">
          <Pebble s={1.3} seed={3} />
        </g>
        {/* further is more */}
        <g className="c3-gap" data-tutor="the stretch from three to seven">
          <rect x={nx(3)} y={NL.y - 9} width={nx(7) - nx(3)} height={18} rx={9} fill={N.goldLight} filter="url(#fx-glow)" />
        </g>
        {[3, 4, 5, 6].map((k) => (
          <path
            key={k}
            className="c3-gap-arc"
            d={`M${nx(k) + 8} ${NL.y - 18} Q${nx(k) + 60} ${NL.y - 64} ${nx(k + 1) - 8} ${NL.y - 18}`}
            pathLength={1}
            strokeDasharray="1 1"
            stroke={N.goldLight}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <g data-tutor="a row of seven pebbles">
          {Array.from({ length: 7 }, (_, j) => (
            <g key={j} className={`c3-row7-${j}`}>
              {j >= 3 && (
                <g className="c3-extra-glow">
                  <Glow x={nx(j + 1)} y={ROW7_Y} r={64} color="warm" />
                </g>
              )}
              <Pebble x={nx(j + 1)} y={ROW7_Y} s={1.8} seed={j} />
            </g>
          ))}
        </g>
        <g data-tutor="a row of three pebbles">
          {Array.from({ length: 3 }, (_, j) => (
            <g key={j} className={`c3-row3-${j}`}>
              <Pebble x={nx(j + 1)} y={ROW3_Y} s={1.8} seed={j + 4} />
            </g>
          ))}
        </g>
      </g>
    </g>
  )
}

export const ch3: Chapter = {
  id: 'names',
  title: 'Numbers are names',
  cues: CUES,
  Scene: Ch3Names,
  enter: { type: 'zoom', x: 420, y: 300 },
}
