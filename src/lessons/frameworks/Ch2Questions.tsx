import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Person } from '../../art2/characters'
import { Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Title } from '../../art2/props'
import { Moon } from '../../art2/scenery'
import { useDrag } from '../../engine/svg'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Hand, Sheep, Valley } from './art'

export const CUES: Cue[] = [
  { id: 'more-questions', say: 'Matching pebbles worked. But as people built villages and markets, they kept running into new questions.' },
  { id: 'four-questions', say: 'Almost every question they asked was one of four big ones.' },
  { id: 'how-many', say: "How many? Counting things, like Ama's sheep." },
  { id: 'change', say: 'How do amounts change? Like when you get more apples, or give some away.' },
  { id: 'next', say: 'What comes next? Like day, night, day, night, or the seasons.' },
  { id: 'shape', say: 'How big, and what shape? Like whether a couch will fit through the door.' },
  {
    id: 'everywhere',
    say: 'Bakers, builders, astronauts and game makers use these four questions every day. Every bit of math you will ever learn helps answer one of them.',
  },
  {
    id: 'which-question',
    say: 'Now you try! Each card is a real-life puzzle. Drag it to the big question that helps solve it.',
    play: true,
  },
]

/*
 * Chapter 2: the map of math.
 *
 * Dawn in Ama's valley, a little further along. A time-lapse: huts grow into a village and then a
 * market town, and pink question marks pop up over people's heads. The camera rises into the
 * night sky, the question marks float up after it, and they gather into four big glowing
 * questions, laid out 2 x 2. The camera visits each one in turn while a little window beside it
 * plays an example, pulls back to tie four jobs onto the map, and settles on the 2 x 2 map, where
 * the learner sorts real-life puzzle cards onto the questions.
 *
 * The four questions keep their place from cue 2 to the end; "How many?" is centred at exactly
 * (420, 300), the point chapter 3 zooms into.
 */

/* ------------------------------------------------------------------ */
/* The four big questions                                               */
/* ------------------------------------------------------------------ */

type QId = 'howMany' | 'change' | 'next' | 'shape'

interface Question {
  id: QId
  x: number
  y: number
  words: string[]
  name: string
  where: string
  icon: string
  /** Said when a card is dropped here but belongs somewhere else: what this question is about. */
  about: string
}

const QUESTIONS: Question[] = [
  {
    id: 'howMany',
    x: 420,
    y: 300,
    words: ['How many?'],
    name: 'How many?',
    where: 'top left',
    icon: 'a hand holding up three fingers',
    about: 'How many? is about counting what is there.',
  },
  {
    id: 'change',
    x: 1180,
    y: 300,
    words: ['How do amounts', 'change?'],
    name: 'How do amounts change?',
    where: 'top right',
    icon: 'a basket of apples with a plus and a minus',
    about: 'How do amounts change? is about getting more, or giving some away.',
  },
  {
    id: 'next',
    x: 420,
    y: 640,
    words: ['What comes', 'next?'],
    name: 'What comes next?',
    where: 'bottom left',
    icon: 'the sun and the moon taking turns',
    about: 'What comes next? is about patterns that repeat.',
  },
  {
    id: 'shape',
    x: 1180,
    y: 640,
    words: ['How big?', 'What shape?'],
    name: 'How big? What shape?',
    where: 'bottom right',
    icon: 'a ruler and a triangle',
    about: 'How big? What shape? is about size, and whether things fit.',
  },
]
const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q])) as Record<QId, Question>
const IDS: QId[] = ['howMany', 'change', 'next', 'shape']

/** Each question is an island of light this big (half-widths). */
const RX = 250
const RY = 145
/** The icon medallion sits above the island's centre. */
const MED = { y: -56, r: 66 }

/* ------------------------------------------------------------------ */
/* Camera                                                               */
/* ------------------------------------------------------------------ */

/** How far the camera rises from the valley into the sky. */
const RISE = 900
/** The valley's gentle push-in during the time-lapse. */
const DRIFT = { s: 1.15, x: 900, y: 800 }
const drifted = (x: number, y: number) => ({ x: DRIFT.x + DRIFT.s * (x - DRIFT.x), y: DRIFT.y + DRIFT.s * (y - DRIFT.y) })

/** Camera on the sky: matrix(scale, 0, 0, scale, x, y). */
interface Cam {
  x: number
  y: number
  scale: number
}
const HOME: Cam = { x: 0, y: 0, scale: 1 }
const FOCUS_S = 1.4
/** Push in on one question: it sits to one side and its example window opens on the other. */
function focusOn(q: Question): Cam {
  const tx = q.x < 800 ? 450 : 1150
  return { x: tx - FOCUS_S * q.x, y: 450 - FOCUS_S * q.y, scale: FOCUS_S }
}
const WIDE_S = 0.78
const WIDE: Cam = { x: 800 - WIDE_S * 800, y: 450 - WIDE_S * 450, scale: WIDE_S }
const wideAt = (q: Question) => ({ x: WIDE.x + WIDE_S * q.x, y: WIDE.y + WIDE_S * q.y })

/** Where each question's example window opens (stage coordinates), and how big it is. */
const EX_R = 265
const EX_AT: Record<QId, { x: number; y: number }> = {
  howMany: { x: 1140, y: 450 },
  change: { x: 460, y: 450 },
  next: { x: 1140, y: 450 },
  shape: { x: 460, y: 450 },
}

/* ------------------------------------------------------------------ */
/* The village                                                          */
/* ------------------------------------------------------------------ */

/** Huts that grow into houses, standing on the middle hill (valley coordinates). */
const HOMES = [
  { x: 640, y: 700, wall: N.cream, roof: N.woodDark },
  { x: 790, y: 716, wall: N.sandLight, roof: '#6b7894' },
  { x: 950, y: 721, wall: N.cream, roof: N.wood },
  { x: 1110, y: 713, wall: '#f1e6d6', roof: N.sandDark },
  { x: 1270, y: 692, wall: N.sandLight, roof: N.woodDark },
  { x: 1430, y: 666, wall: N.cream, roof: '#6b7894' },
]
const FAR_HOMES = [
  { x: 1050, y: 596 },
  { x: 1180, y: 575 },
  { x: 1320, y: 573 },
]
/** Market stalls on the near meadow: the counter top is at y. */
const STALLS = [
  { x: 640, y: 812, a: N.sky, goods: 'bread' as const },
  { x: 990, y: 812, a: N.leaf, goods: 'apples' as const },
  { x: 1340, y: 812, a: N.sand, goods: 'pots' as const },
]

interface Villager {
  tutor: string
  x: number
  y: number
  s: number
  flip?: boolean
  robe: [string, string, string]
  skin: [string, string]
  head: 'hair' | 'hijab' | 'cap'
  headColor: string
  headDark: string
  pose: 'down' | 'wave' | 'point' | 'hold'
  face?: 'smile' | 'wow' | 'think'
  /** Which big question this person's question mark flies to. */
  q: QId
}

const VILLAGERS: Villager[] = [
  { tutor: 'the builder', x: 500, y: 872, s: 0.48, flip: true, robe: [N.sand, N.sandLight, N.sandDark], skin: [N.skin2, N.skin2Dark], head: 'cap', headColor: N.white, headDark: N.mist, pose: 'hold', face: 'think', q: 'shape' },
  { tutor: 'a shopper at the bread stall', x: 748, y: 878, s: 0.45, flip: true, robe: [N.leaf, N.leafLight, N.leafDark], skin: [N.skin1, N.skin1Dark], head: 'hijab', headColor: N.sky, headDark: N.skyDark, pose: 'point', face: 'think', q: 'howMany' },
  { tutor: 'a child looking at the sky', x: 868, y: 876, s: 0.36, robe: [N.sky, N.skyLight, N.skyDark], skin: [N.skin3, N.skin3Dark], head: 'hair', headColor: N.night0, headDark: N.space, pose: 'wave', face: 'wow', q: 'next' },
  { tutor: 'a shopper at the apple stall', x: 1098, y: 878, s: 0.45, flip: true, robe: [N.stone, N.stoneLight, N.stoneDark], skin: [N.skin2, N.skin2Dark], head: 'hair', headColor: N.woodDark, headDark: N.night0, pose: 'hold', face: 'think', q: 'change' },
  { tutor: 'a shopper at the pot stall', x: 1452, y: 878, s: 0.45, flip: true, robe: [N.wood, N.woodLight, N.woodDark], skin: [N.skin3, N.skin3Dark], head: 'hijab', headColor: N.sandLight, headDark: N.sand, pose: 'point', face: 'think', q: 'howMany' },
]

/** Where each villager's question mark floats, in stage coordinates (the valley is pushed in by then). */
const QM_AT = VILLAGERS.map((v) => drifted(v.x, v.y - (206 + 40) * v.s - 46))

/* ------------------------------------------------------------------ */
/* Jobs that use the questions                                          */
/* ------------------------------------------------------------------ */

type JobKind = 'baker' | 'builder' | 'astronaut' | 'gamer'
const JOB_R = 108
const JOBS: { kind: JobKind; x: number; y: number; links: QId[]; uses: string }[] = [
  { kind: 'baker', x: 800, y: 118, links: ['howMany', 'change'], uses: 'counts cookies, and bakes more' },
  { kind: 'builder', x: 800, y: 780, links: ['next', 'shape'], uses: 'lays bricks in a pattern and measures walls' },
  { kind: 'astronaut', x: 160, y: 465, links: ['howMany', 'next'], uses: 'counts down, and knows where the planets go next' },
  { kind: 'gamer', x: 1440, y: 465, links: ['change', 'shape'], uses: 'makes points go up and down, and draws shapes' },
]

/** A light line from a job's window to the edge of one question's island (camera pulled back). */
function linkLine(j: { x: number; y: number }, q: Question) {
  const b = wideAt(q)
  const dx = b.x - j.x
  const dy = b.y - j.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const edge = (1 / Math.sqrt((ux / RX) ** 2 + (uy / RY) ** 2)) * WIDE_S + 6
  return { x1: j.x + ux * (JOB_R + 10), y1: j.y + uy * (JOB_R + 10), x2: b.x - ux * edge, y2: b.y - uy * edge }
}

/* ------------------------------------------------------------------ */
/* The sorting game                                                     */
/* ------------------------------------------------------------------ */

interface PuzzleCard {
  id: string
  answer: QId
  /** Read aloud when the card is dealt, or tapped. */
  read: string
  /** The few words on the card. */
  lines: string[]
  short: string
  Pic: () => ReactNode
  /** Said when it lands on the right question. */
  right: string
  hints: string[]
  mixup: string
}

const FINAL_LINE = 'Every real-life puzzle fits one of the four big questions.'
const NOWHERE_LINE = 'Drop it right onto one of the four big questions.'

const CARD_W = 300
const CARD_H = 236
const CHIP_S = 0.34
const DECK = { x: 800, y: 470 }

/** Where a sorted card sits on its question: beside the icon, left then right. */
function chipSpot(id: QId, k: number) {
  const q = Q[id]
  return { x: q.x + (k === 0 ? -168 : 168), y: q.y - 30 }
}

/** Which question (if any) a stage point is over. Generous, and the nearest one wins. */
function questionAt(p: { x: number; y: number }): QId | null {
  let best: QId | null = null
  let bd = 1
  for (const q of QUESTIONS) {
    const dx = (p.x - q.x) / (RX + 50)
    const dy = (p.y - q.y) / (RY + 60)
    const d = dx * dx + dy * dy
    if (d <= bd) {
      bd = d
      best = q.id
    }
  }
  return best
}

/* ------------------------------------------------------------------ */
/* What Pip sees                                                        */
/* ------------------------------------------------------------------ */

const STATE: string[] = [
  "A time-lapse in Ama's valley at dawn. The sun comes up, little huts appear on the hill and grow into a village of houses, then market stalls (bread, apples, pots) and people trading. Pink question marks pop up over five people's heads: a builder by a half-built wall, shoppers at each stall, and a child looking up at the sky. The pink question marks are the questions people ran into.",
  'Night falls and the camera rises from the village into the starry sky. The five pink question marks float up and gather into four big glowing islands of light, laid out 2 x 2: top left (a hand holding up 3 fingers), top right (a basket of apples with a plus and a minus), bottom left (the sun and moon taking turns), bottom right (a ruler and a triangle). Their words are not shown yet.',
  'The camera pushes in on the top-left island, whose words now read "How many?". Beside it a round window shows three sheep trotting in one at a time; a gold number tile pops up over each one as it is counted: 1, 2, 3.',
  'The camera moves to the top-right island: "How do amounts change?". Its window shows a basket with 3 green apples and a gold tile showing 3. Two apples drop in (the tile changes to 5), then a friend\'s hand takes one away (the tile changes to 4).',
  'The camera moves to the bottom-left island: "What comes next?". Its window flips from day to night and back: sun, moon, sun, moon tokens line up along the bottom, and a pink question mark sits at the end of the row: what comes next?',
  'The camera moves to the bottom-right island: "How big? What shape?". Its window shows a couch that is too wide for a doorway (its ends flash coral where they stick out). It tips up on its end, now it is narrow enough, and the doorway glows teal: it fits.',
  'The camera pulls back to show all four big questions. Four round windows pop up around them: a baker (top), a builder (bottom), an astronaut (left) and a game maker (right), each joined by lines of light to the two questions they use. Then the camera settles back on the four questions, which all glow: every bit of math helps answer one of them.',
  '',
]

/* ================================================================== */
/* Scene                                                                */
/* ================================================================== */

export function Ch2Questions(props: ChapterProps) {
  const { cueIndex, playing, onAnimDone, reportState, setHints } = props
  const root = useRef<SVGGElement>(null)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const pop = (sel: string, at: number, dur = 0.5, ease = 'back.out(2)') => tl.to(sel, { scale: 1, duration: dur, ease }, at)

    /* ---------- starting state: Ama's valley at dawn, nothing built yet ---------- */
    tl.set('.q2-world', { y: 0 }, 0)
    tl.set('.q2-drift', { scale: 1, svgOrigin: `${DRIFT.x} ${DRIFT.y}` }, 0)
    tl.set('.vl-dusk', { opacity: 1 }, 0)
    tl.set('.vl-land-night', { opacity: 0.45 }, 0)
    tl.set('.vl-night', { opacity: 0 }, 0)
    tl.set('.vl-moon', { opacity: 1 }, 0)
    tl.set('.vl-night > circle', { opacity: 0.12 }, 0)
    tl.set('.vl-sun', { y: 330 }, 0)
    tl.set('.vl-clouds', { x: 0 }, 0)
    tl.set('.q2-hi', { opacity: 0 }, 0)
    // Each piece grows from its own foot; the origin is set once, with the starting scale.
    HOMES.forEach((h, i) => tl.set([`.q2-hut-${i}`, `.q2-house-${i}`], { scale: 0, svgOrigin: `${h.x} ${h.y}` }, 0))
    FAR_HOMES.forEach((h, i) => tl.set(`.q2-farhouse-${i}`, { scale: 0, svgOrigin: `${h.x} ${h.y}` }, 0))
    STALLS.forEach((st, i) => tl.set(`.q2-stall-${i}`, { scale: 0, svgOrigin: `${st.x} ${st.y + 64}` }, 0))
    tl.set('.q2-win', { opacity: 0 }, 0)
    tl.set('.q2-town', { opacity: 1 }, 0)
    tl.set('.q2-pp', { opacity: 0, y: 26 }, 0)
    tl.set('.q2-seller', { y: 70 }, 0)
    tl.set(['.q2-loaf', '.q2-pay'], { opacity: 0, x: 0, y: 0 }, 0)
    QM_AT.forEach((p, i) => tl.set(`.q2-qm-${i}`, { x: p.x, y: p.y, opacity: 1 }, 0))
    tl.set('.q2-qmpop', { scale: 0, svgOrigin: '0 0' }, 0)

    tl.set('.q2-sky', { y: -RISE }, 0)
    tl.set('.q2-skycam', { ...HOME, svgOrigin: '0 0' }, 0)
    tl.set('.q2-map', { opacity: 0 }, 0)
    IDS.forEach((id) => {
      tl.set(`.q2-isl-${id}`, { scale: 0.3, opacity: 0, svgOrigin: '0 0' }, 0)
      tl.set(`.q2-ring-${id}`, { scale: 0.7, opacity: 0, svgOrigin: '0 0' }, 0)
      tl.set(`.q2-dim-${id}`, { opacity: 1 }, 0)
      tl.set(`.q2-glow-${id}`, { opacity: 0.5 }, 0)
      tl.set(`.q2-words-${id}`, { opacity: 0, scale: 0.8, svgOrigin: '0 60' }, 0)
      tl.set(`.q2-tpulse-${id}`, { scale: 1, svgOrigin: '0 0' }, 0)
      tl.set(`.q2-ex-${id}`, { opacity: 0, scale: 0.55, svgOrigin: '0 0' }, 0)
    })
    // the examples
    ;[0, 1, 2].forEach((i) => {
      tl.set(`.q2-hm-sheep-${i}`, { x: 470 - (i - 1) * 150, '--walk': 0 }, 0)
      tl.set(`.q2-hm-tile-${i}`, { scale: 0, svgOrigin: `${(i - 1) * 150} 10` }, 0)
    })
    tl.set(['.q2-ch-add-0', '.q2-ch-add-1'], { y: -380 }, 0)
    tl.set('.q2-ch-give', { x: 0, y: 0, opacity: 1 }, 0)
    tl.set('.q2-ch-hand', { x: 200 }, 0)
    tl.set(['.q2-ch-n5', '.q2-ch-n4', '.q2-ch-plus', '.q2-ch-minus'], { opacity: 0 }, 0)
    tl.set('.q2-ch-n3', { opacity: 1 }, 0)
    tl.set('.q2-ch-tile', { scale: 1, svgOrigin: '0 -150' }, 0)
    tl.set('.q2-nx-night', { opacity: 0 }, 0)
    tl.set('.q2-nx-sun', { y: 0, opacity: 1 }, 0)
    tl.set('.q2-nx-moon', { y: 220, opacity: 0 }, 0)
    for (let i = 0; i < 5; i++) tl.set(`.q2-nx-t${i}`, { scale: 0, svgOrigin: `${-168 + i * 84} 142` }, 0)
    tl.set('.q2-sh-couch', { x: -125, y: 92 }, 0)
    tl.set('.q2-sh-tip', { rotation: 0, svgOrigin: '0 0' }, 0)
    tl.set(['.q2-sh-over', '.q2-sh-fit'], { opacity: 0 }, 0)
    // the jobs
    JOBS.forEach((j, i) => {
      tl.set(`.q2-job-${i}`, { scale: 0, svgOrigin: `${j.x} ${j.y}` }, 0)
      j.links.forEach((_, k) => tl.set(`.q2-link-${i}-${k}`, { attr: { 'stroke-dashoffset': 1 }, opacity: 1 }, 0))
    })

    /* ---------- 0. The time-lapse: huts, a village, a market town, and questions ---------- */
    tl.addLabel('b0', 0)
    tl.to('.q2-drift', { scale: DRIFT.s, duration: 5.2, ease: 'sine.inOut' }, 0.3)
    tl.to('.vl-clouds', { x: -200, duration: 6.8, ease: 'none' }, 0)
    tl.to('.vl-dusk', { opacity: 0, duration: 1.8, ease: 'sine.inOut' }, 1.1)
    tl.to('.vl-land-night', { opacity: 0, duration: 1.6, ease: 'sine.inOut' }, 1.1)
    tl.to('.vl-sun', { y: 0, duration: 2.2, ease: 'power2.out' }, 1.0)
    HOMES.forEach((_, i) => pop(`.q2-hut-${i}`, 1.45 + i * 0.15, 0.45, 'back.out(2.4)'))
    HOMES.forEach((_, i) => {
      const at = 2.75 + i * 0.12
      tl.to(`.q2-hut-${i}`, { scale: 0, duration: 0.25, ease: 'power2.in' }, at)
      pop(`.q2-house-${i}`, at + 0.15, 0.5, 'back.out(2)')
    })
    FAR_HOMES.forEach((_, i) => pop(`.q2-farhouse-${i}`, 3.0 + i * 0.12, 0.45))
    STALLS.forEach((_, i) => pop(`.q2-stall-${i}`, 3.4 + i * 0.22, 0.55, 'back.out(1.8)'))
    tl.to('.q2-seller', { y: 0, duration: 0.45, ease: 'back.out(2)', stagger: 0.2 }, 3.9)
    tl.to('.q2-pp', { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)', stagger: 0.14 }, 4.0)
    // trading: a loaf goes to a shopper, a pebble goes back to pay for it
    tl.to('.q2-loaf', { opacity: 1, duration: 0.15 }, 4.5)
    tl.to('.q2-loaf', { x: 74, duration: 0.6, ease: 'power1.inOut' }, 4.6)
    tl.to('.q2-loaf', { y: -40, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 }, 4.6)
    tl.to('.q2-pay', { opacity: 1, duration: 0.15 }, 5.0)
    tl.to('.q2-pay', { x: -84, duration: 0.6, ease: 'power1.inOut' }, 5.05)
    tl.to('.q2-pay', { y: -36, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 }, 5.05)
    tl.to('.q2-bob', { y: -8, duration: 0.18, ease: 'sine.inOut', yoyo: true, repeat: 3, stagger: 0.1 }, 4.6)
    // the questions pop up over people's heads
    QM_AT.forEach((_, i) => tl.to(`.q2-qm-${i} .q2-qmpop`, { scale: 1, duration: 0.45, ease: 'back.out(2.6)' }, 5.2 + i * 0.22))

    /* ---------- 1. Up into the sky: the questions gather into four big ones ---------- */
    tl.addLabel('b1', 6.8)
    const b1 = 6.8
    tl.to('.q2-town', { opacity: 0.5, duration: 1.0, ease: 'sine.inOut' }, b1 + 0.1)
    tl.to('.q2-win', { opacity: 1, duration: 0.5, stagger: 0.04 }, b1 + 0.3)
    tl.to('.vl-night', { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, b1 + 0.1)
    tl.to('.vl-land-night', { opacity: 1, duration: 1.1, ease: 'sine.inOut' }, b1 + 0.1)
    tl.to('.q2-hi', { opacity: 1, duration: 1.2 }, b1 + 0.4)
    tl.to('.q2-world', { y: RISE, duration: 2.6, ease: 'power2.inOut' }, b1 + 0.15)
    tl.to('.q2-sky', { y: 0, duration: 2.6, ease: 'power2.inOut' }, b1 + 0.15)
    tl.to(['.vl-moon', '.vl-night > circle'], { opacity: 0, duration: 0.5 }, b1 + 2.2)
    // four constellation rings take shape in the sky as we arrive
    IDS.forEach((id, i) => tl.to(`.q2-ring-${id}`, { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' }, b1 + 1.4 + i * 0.15))
    // the question marks drift up as the town sinks away, then fly to their big question
    QM_AT.forEach((p, i) => tl.to(`.q2-qm-${i}`, { y: p.y - 120 - i * 14, duration: 2.2, ease: 'sine.inOut' }, b1 + 0.1))
    const born = new Set<QId>()
    VILLAGERS.forEach((v, i) => {
      const q = Q[v.q]
      const at = b1 + 2.2 + i * 0.2
      tl.to(`.q2-qm-${i}`, { x: q.x, y: q.y + MED.y, duration: 0.75, ease: 'power2.inOut' }, at)
      tl.to(`.q2-qm-${i} .q2-qmpop`, { scale: 0.45, duration: 0.75, ease: 'power2.in' }, at)
      tl.to(`.q2-qm-${i}`, { opacity: 0, duration: 0.2 }, at + 0.68)
      if (!born.has(v.q)) {
        born.add(v.q)
        tl.to(`.q2-isl-${v.q}`, { scale: 1, opacity: 1, duration: 0.65, ease: 'back.out(1.7)' }, at + 0.62)
      } else {
        tl.to(`.q2-tpulse-${v.q}`, { scale: 1.06, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }, at + 0.66)
      }
    })

    /* ---------- 2-5. Each question lights up, with a little example beside it ---------- */
    const visit = (id: QId, prev: QId | null, at: number) => {
      tl.to('.q2-skycam', { ...focusOn(Q[id]), duration: 1.3, ease: 'power2.inOut' }, at)
      IDS.forEach((o) => tl.to(`.q2-dim-${o}`, { opacity: o === id ? 1 : 0.08, duration: 0.7 }, at + 0.1))
      tl.to(`.q2-glow-${id}`, { opacity: 1, duration: 0.8 }, at + 0.3)
      tl.to(`.q2-words-${id}`, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, at + 0.2)
      if (prev) {
        tl.to(`.q2-glow-${prev}`, { opacity: 0.5, duration: 0.6 }, at)
        tl.to(`.q2-ex-${prev}`, { opacity: 0, scale: 0.7, duration: 0.4, ease: 'power2.in' }, at)
      }
      tl.to(`.q2-ex-${id}`, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, at + 0.55)
    }

    // 2. How many? Three sheep trot in and are counted.
    tl.addLabel('b2', b1 + 4.4)
    const b2 = b1 + 4.4
    visit('howMany', null, b2)
    ;[0, 1, 2].forEach((i) => {
      const at = b2 + 0.9 + i * 0.5
      const dur = 0.6 + (620 - 150 * i) / 1000
      tl.set(`.q2-hm-sheep-${i}`, { '--walk': 1 }, at)
      tl.to(`.q2-hm-sheep-${i}`, { x: 0, duration: dur, ease: 'power1.out' }, at)
      tl.set(`.q2-hm-sheep-${i}`, { '--walk': 0 }, at + dur)
      tl.to(`.q2-hm-tile-${i}`, { scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, at + dur - 0.05)
    })

    // 3. How do amounts change? More apples, then one given away.
    tl.addLabel('b3', b2 + 3.4)
    const b3 = b2 + 3.4
    visit('change', 'howMany', b3)
    ;[0, 1].forEach((i) => tl.to(`.q2-ch-add-${i}`, { y: 0, duration: 0.6, ease: 'bounce.out' }, b3 + 2.2 + i * 0.22))
    tl.to('.q2-ch-plus', { opacity: 1, duration: 0.25 }, b3 + 2.4)
    tl.to('.q2-ch-n3', { opacity: 0, duration: 0.15 }, b3 + 2.9)
    tl.to('.q2-ch-n5', { opacity: 1, duration: 0.15 }, b3 + 2.9)
    tl.to('.q2-ch-tile', { scale: 1.25, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, b3 + 2.9)
    tl.to('.q2-ch-plus', { opacity: 0, duration: 0.3 }, b3 + 3.5)
    tl.to('.q2-ch-hand', { x: 0, duration: 0.5, ease: 'power2.out' }, b3 + 3.7)
    tl.to('.q2-ch-give', { x: 192, duration: 0.5, ease: 'power1.inOut' }, b3 + 4.15)
    tl.to('.q2-ch-give', { y: -44, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, b3 + 4.15)
    tl.to('.q2-ch-minus', { opacity: 1, duration: 0.25 }, b3 + 4.3)
    tl.to('.q2-ch-n5', { opacity: 0, duration: 0.15 }, b3 + 4.55)
    tl.to('.q2-ch-n4', { opacity: 1, duration: 0.15 }, b3 + 4.55)
    tl.to('.q2-ch-tile', { scale: 1.25, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, b3 + 4.55)
    tl.to(['.q2-ch-hand', '.q2-ch-give'], { x: '+=190', duration: 0.5, ease: 'power2.in' }, b3 + 4.8)

    // 4. What comes next? Day, night, day, night, ?
    tl.addLabel('b4', b3 + 5.4)
    const b4 = b3 + 5.4
    visit('next', 'change', b4)
    const flip = (night: boolean, at: number) => {
      tl.to('.q2-nx-night', { opacity: night ? 1 : 0, duration: 0.3 }, at)
      tl.to('.q2-nx-sun', { y: night ? 220 : 0, opacity: night ? 0 : 1, duration: 0.4, ease: 'power2.inOut' }, at)
      tl.to('.q2-nx-moon', { y: night ? 0 : 220, opacity: night ? 1 : 0, duration: 0.4, ease: 'power2.inOut' }, at)
    }
    tl.to('.q2-nx-t0', { scale: 1, duration: 0.35, ease: 'back.out(2.6)' }, b4 + 1.5)
    ;[1, 2, 3].forEach((i) => {
      flip(i % 2 === 1, b4 + 1.5 + i * 0.55)
      tl.to(`.q2-nx-t${i}`, { scale: 1, duration: 0.35, ease: 'back.out(2.6)' }, b4 + 1.6 + i * 0.55)
    })
    tl.to('.q2-nx-t4', { scale: 1, duration: 0.5, ease: 'back.out(3)' }, b4 + 3.9)

    // 5. How big? What shape? The couch is too wide, tips up, and fits.
    tl.addLabel('b5', b4 + 4.8)
    const b5 = b4 + 4.8
    visit('shape', 'next', b5)
    tl.to('.q2-sh-couch', { x: 120, duration: 1.0, ease: 'power2.inOut' }, b5 + 1.4)
    tl.to('.q2-sh-couch', { x: 108, duration: 0.08, ease: 'power1.out', yoyo: true, repeat: 3 }, b5 + 2.4)
    tl.to('.q2-sh-over', { opacity: 1, duration: 0.25 }, b5 + 2.45)
    tl.to('.q2-sh-over', { opacity: 0, duration: 0.3 }, b5 + 3.3)
    tl.to('.q2-sh-tip', { rotation: -90, duration: 0.7, ease: 'back.out(1.5)' }, b5 + 3.4)
    tl.to('.q2-sh-couch', { y: 16, duration: 0.7, ease: 'power2.out' }, b5 + 3.4)
    tl.to('.q2-sh-fit', { opacity: 1, duration: 0.4 }, b5 + 4.1)

    /* ---------- 6. Pull back: four jobs tie onto the map, then settle on the four questions ---------- */
    tl.addLabel('b6', b5 + 5.4)
    const b6 = b5 + 5.4
    tl.to('.q2-skycam', { ...WIDE, duration: 1.2, ease: 'power2.inOut' }, b6)
    tl.to('.q2-ex-shape', { opacity: 0, scale: 0.7, duration: 0.4, ease: 'power2.in' }, b6)
    IDS.forEach((id) => {
      tl.to(`.q2-dim-${id}`, { opacity: 1, duration: 0.6 }, b6 + 0.2)
      tl.to(`.q2-glow-${id}`, { opacity: 0.5, duration: 0.6 }, b6 + 0.2)
    })
    const jobAt = [0.3, 0.8, 1.4, 2.1]
    JOBS.forEach((j, i) => {
      tl.to(`.q2-job-${i}`, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, b6 + jobAt[i])
      j.links.forEach((id, k) => {
        const at = b6 + Math.max(1.2, jobAt[i] + 0.4) + k * 0.15
        tl.to(`.q2-link-${i}-${k}`, { attr: { 'stroke-dashoffset': 0 }, duration: 0.5, ease: 'power1.inOut' }, at)
        tl.to(`.q2-tpulse-${id}`, { scale: 1.06, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, at + 0.45)
      })
    })
    tl.to('.q2-job', { scale: 0, duration: 0.45, ease: 'back.in(1.6)', stagger: 0.08 }, b6 + 4.7)
    tl.to('.q2-link', { opacity: 0, duration: 0.4 }, b6 + 4.7)
    tl.to('.q2-skycam', { ...HOME, duration: 1.5, ease: 'power2.inOut' }, b6 + 5.0)
    tl.to('.q2-map', { opacity: 0.6, duration: 1.0 }, b6 + 6.2)
    IDS.forEach((id, i) => {
      tl.to(`.q2-glow-${id}`, { opacity: 1, duration: 0.4, ease: 'power2.out' }, b6 + 6.4 + i * 0.25)
      tl.to(`.q2-tpulse-${id}`, { scale: 1.06, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, b6 + 6.4 + i * 0.25)
      tl.to(`.q2-glow-${id}`, { opacity: 0.6, duration: 0.8 }, b6 + 7.6 + i * 0.1)
    })

    /* ---------- 7. The sorting game: the map calms down so the cards stand out ---------- */
    tl.addLabel('b7', b6 + 8.8)
    const b7 = b6 + 8.8
    tl.to('.q2-map', { opacity: 0.35, duration: 0.6 }, b7)
    tl.addLabel('b8', b7 + 0.7)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useEffect(() => {
    if (cueIndex === 7) return
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  const t = (name: string, on: boolean) => (on ? name : undefined)

  return (
    <g ref={root}>
      <defs>
        <linearGradient id="q2-high" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.night0} />
          <stop offset="0.6" stopColor={N.space} />
          <stop offset="1" stopColor={N.space} />
        </linearGradient>
        <radialGradient id="q2-bloom-v">
          <stop offset="0" stopColor={N.dusk} stopOpacity="0.45" />
          <stop offset="1" stopColor={N.dusk} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="q2-bloom-s">
          <stop offset="0" stopColor={N.sky} stopOpacity="0.14" />
          <stop offset="1" stopColor={N.sky} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="q2-plate" cx="0.5" cy="0.25" r="0.8">
          <stop offset="0" stopColor={N.night3} />
          <stop offset="0.7" stopColor={N.night1} />
          <stop offset="1" stopColor={N.night0} />
        </radialGradient>
      </defs>

      {/* The valley and the town, with the night sky above them; the camera rises through it */}
      <g className="q2-world" pointerEvents="none">
        <g className="q2-drift">
          <Valley time="dusk">
            <Town tutor={cueIndex === 0} />
          </Valley>
          {/* the sky above the valley; it overlaps the valley's own sky a little so no seam shows */}
          <rect x={-500} y={-2000} width={2600} height={1705} fill="url(#q2-high)" />
          <g className="q2-hi">
            <circle cx={300} cy={-700} r={620} fill="url(#q2-bloom-v)" />
            <circle cx={1350} cy={-420} r={560} fill="url(#q2-bloom-s)" />
            <Stars w={1700} h={1300} y={-1300} count={170} seed={23} />
          </g>
        </g>
      </g>

      {/* The four big questions, high in the sky */}
      <g className="q2-sky">
        <g className="q2-skycam">
          <path
            className="q2-map"
            d={`M${Q.howMany.x} ${Q.howMany.y} H${Q.change.x} V${Q.shape.y} H${Q.next.x} Z`}
            fill="none"
            stroke={N.mist}
            strokeWidth={5}
            strokeDasharray="2 18"
            strokeLinecap="round"
          />
          {QUESTIONS.map((q) => (
            <Island key={q.id} q={q} tutor={cueIndex >= 1} />
          ))}
        </g>
      </g>

      {/* The villagers' questions, which float up into the sky */}
      <g pointerEvents="none">
        {VILLAGERS.map((_, i) => (
          <g key={i} className={`q2-qm q2-qm-${i}`}>
            <g className="q2-qmpop">
              <QBubble seed={i} />
            </g>
          </g>
        ))}
      </g>

      {/* The examples, each in a round window beside its question */}
      <g pointerEvents="none">
        <Window id="howMany" tutor={t('three sheep being counted', cueIndex === 2)}>
          <ExHowMany />
        </Window>
        <Window id="change" tutor={t('a basket of apples', cueIndex === 3)}>
          <ExChange />
        </Window>
        <Window id="next" tutor={t('day and night taking turns', cueIndex === 4)}>
          <ExNext />
        </Window>
        <Window id="shape" tutor={t('a couch and a doorway', cueIndex === 5)}>
          <ExShape />
        </Window>
      </g>

      {/* People who use the four questions every day */}
      <g pointerEvents="none">
        {JOBS.map((j, i) =>
          j.links.map((id, k) => {
            const l = linkLine(j, Q[id])
            return (
              <line
                key={`${i}-${k}`}
                className={`q2-link q2-link-${i}-${k}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                pathLength={1}
                strokeDasharray="1 1"
                stroke={N.skyLight}
                strokeWidth={7}
                strokeLinecap="round"
                filter="url(#fx-glow)"
              />
            )
          }),
        )}
        {JOBS.map((j, i) => (
          <g key={j.kind} className={`q2-job q2-job-${i}`} data-tutor={t(`the ${j.kind === 'gamer' ? 'game maker' : j.kind}`, cueIndex === 6)}>
            <JobWindow kind={j.kind} x={j.x} y={j.y} />
          </g>
        ))}
      </g>

      {cueIndex === 7 && <SortGame {...props} scope={root} />}

      <g pointerEvents="none">
        <Motes count={14} seed={5} />
      </g>
      <Vignette />
    </g>
  )
}

/* ================================================================== */
/* The sorting game                                                     */
/* ================================================================== */

function SortGame({ cueIndex, onPlayDone, say, emit, reportState, setHints, scope }: ChapterProps & { scope: RefObject<SVGGElement | null> }) {
  const [idx, setIdx] = useState(0)
  const [tries, setTries] = useState<QId[][]>(() => CARDS.map(() => []))
  const [hover, setHover] = useState<QId | null>(null)
  const [held, setHeld] = useState(false)
  const outer = useRef<SVGGElement>(null)
  const inner = useRef<SVGGElement>(null)
  const burst = useRef<SVGGElement>(null)
  const pos = useRef({ ...DECK })
  const grab = useRef({ dx: 0, dy: 0, sx: 0, sy: 0, moved: 0 })
  const dragging = useRef(false)
  const busy = useRef(true)
  const hoverRef = useRef<QId | null>(null)
  const idxRef = useRef(0)
  const readFirst = useRef(false)
  const lastRead = useRef(0)
  const toldNowhere = useRef(false)
  const done = idx >= CARDS.length
  const card = CARDS[Math.min(idx, CARDS.length - 1)]
  const myTurn = cueIndex === 7 && !done
  idxRef.current = idx


  // The first card is read out as soon as the narrator has finished the instructions.
  useEffect(() => {
    if (readFirst.current) return
    readFirst.current = true
    lastRead.current = Date.now()
    void say(CARDS[0].read)
  }, [say])

  useEffect(() => {
    if (!done) setHints(CARDS[idx].hints)
    else setHints([])
  }, [idx, done, setHints])

  useEffect(() => {
    const qs = QUESTIONS.map((q) => `"${q.name}" (${q.where}, ${q.icon})`).join('; ')
    const list = CARDS.map((c, k) => {
      const tried = tries[k].map((id) => `"${Q[id].name}"`).join(', then ')
      const status =
        k < idx
          ? `sorted correctly${tried ? `, after first trying ${tried} (it drifted back)` : ' on the first try'}`
          : k === idx
            ? `the card in the middle right now${tried ? `; already tried ${tried} (it drifted back)` : ', not tried yet'}`
            : 'still in the pile'
      return `${k + 1}) "${c.read}" (card shows ${c.lines.join(' ')}) belongs on "${Q[c.answer].name}". Status: ${status}.`
    }).join(' ')
    const now = done
      ? 'All six cards are sorted onto the right questions. The game is finished.'
      : `Card ${idx + 1} of 6 is in the middle. Correct answer: "${Q[card.answer].name}". Likely mix-up: the learner ${card.mixup}. Do not tell the learner which question; ask what the puzzle wants to find out.`
    reportState(
      `Sorting game on the map of math. Four big glowing questions sit 2 x 2: ${qs}. One puzzle card at a time sits in the middle; the learner drags it onto the big question that helps solve it (tapping it reads it aloud). A right card shrinks onto that question with a teal glow; a card dropped on another question drifts back to the middle and the narrator says what that question is about. Cards: ${list} ${now}`,
    )
  }, [idx, tries, done, card, reportState])

  // Each new card is dealt into the middle of the map.
  useLayoutEffect(() => {
    if (done) return
    const o = outer.current
    const n = inner.current
    if (!o || !n) return
    pos.current = { ...DECK }
    busy.current = true
    const tw = gsap.context(() => {
      gsap.set(o, { x: DECK.x, y: DECK.y })
      gsap.fromTo(
        n,
        { scale: 0.6, opacity: 0, rotation: -8, y: 60, svgOrigin: '0 0' },
        { scale: 1, opacity: 1, rotation: 0, y: 0, duration: 0.55, ease: 'back.out(1.7)', delay: idx === 0 ? 0.5 : 0.1, onComplete: () => void (busy.current = false) },
      )
    })
    return () => tw.revert()
  }, [idx, done])

  // A sorted card lands: a ring of teal light, and its question glows teal for a moment.
  const celebrate = (id: QId, at: { x: number; y: number }) => {
    const b = burst.current
    const r = scope.current
    if (b) {
      gsap.killTweensOf(b)
      gsap.set(b, { x: at.x, y: at.y })
      gsap.fromTo(b.firstElementChild, { scale: 0.5, opacity: 1, svgOrigin: '0 0' }, { scale: 1.9, opacity: 0, duration: 0.8, ease: 'power2.out' })
    }
    const teal = r?.querySelector(`.q2-teal-${id}`)
    if (teal) gsap.fromTo(teal, { opacity: 0 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 1, repeatDelay: 0.4, ease: 'sine.inOut' })
  }

  const pulse = (id: QId) => {
    const el = scope.current?.querySelector(`.q2-pulse-${id}`)
    if (el) gsap.fromTo(el, { scale: 1, svgOrigin: '0 0' }, { scale: 1.05, duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut' })
  }

  const moveCard = (x: number, y: number, scale: number, duration: number, ease = 'power2.out', onComplete?: () => void) => {
    pos.current = { x, y }
    gsap.killTweensOf(outer.current)
    gsap.to(outer.current, { x, y, duration, ease })
    gsap.to(inner.current, { scale, rotation: 0, duration, ease, onComplete })
  }

  const driftBack = () => {
    busy.current = true
    moveCard(DECK.x, DECK.y, 1, 0.7, 'back.out(1.2)', () => void (busy.current = false))
  }

  const drop = (p: { x: number; y: number }) => {
    const target = questionAt(p) ?? questionAt(pos.current)
    if (!target) {
      const far = grab.current.moved > 140
      driftBack()
      if (far && !toldNowhere.current) {
        toldNowhere.current = true
        void say(NOWHERE_LINE)
      }
      return
    }
    const right = target === card.answer
    emit({ type: 'attempt', correct: right, detail: `put "${card.short}" on ${Q[target].name}` })
    if (!right) {
      setTries((all) => all.map((a, k) => (k === idx ? [...a, target] : a)))
      driftBack()
      pulse(target)
      void say(Q[target].about)
      return
    }
    busy.current = true
    emit({ type: 'progress', detail: `sorted card ${idx + 1} of 6` })
    const k = CARDS.slice(0, idx).filter((c) => c.answer === target).length
    const spot = chipSpot(target, k)
    const last = idx === CARDS.length - 1
    const here = idx
    moveCard(spot.x, spot.y, CHIP_S, 0.5, 'power2.inOut', () => {
      celebrate(target, spot)
      setIdx(here + 1)
      if (last) {
        void say(FINAL_LINE)
        onPlayDone()
      }
    })
    if (!last) {
      void say(card.right).then(() => {
        if (idxRef.current === here + 1) {
          lastRead.current = Date.now()
          void say(CARDS[here + 1].read)
        }
      })
    }
  }

  const drag = useDrag({
    onStart: (p) => {
      if (!myTurn || busy.current) return
      dragging.current = true
      grab.current = { dx: pos.current.x - p.x, dy: pos.current.y - p.y, sx: p.x, sy: p.y, moved: 0 }
      setHeld(true)
      gsap.to(inner.current, { scale: 1.06, rotation: -3, duration: 0.15, ease: 'power2.out' })
    },
    onMove: (p) => {
      if (!dragging.current) return
      const g = grab.current
      g.moved = Math.max(g.moved, Math.hypot(p.x - g.sx, p.y - g.sy))
      const x = p.x + g.dx
      const y = p.y + g.dy
      pos.current = { x, y }
      gsap.killTweensOf(outer.current)
      gsap.set(outer.current, { x, y })
      const h = questionAt(p)
      if (h !== hoverRef.current) {
        hoverRef.current = h
        setHover(h)
      }
    },
    onEnd: (p) => {
      if (!dragging.current) return
      dragging.current = false
      hoverRef.current = null
      setHover(null)
      setHeld(false)
      // A tap reads the card out again; a drag drops it.
      if (grab.current.moved < 14) {
        moveCard(DECK.x, DECK.y, 1, 0.3, 'back.out(2)')
        if (Date.now() - lastRead.current > 2500) {
          lastRead.current = Date.now()
          void say(card.read)
        }
        return
      }
      drop(p)
    },
  })

  const placed = CARDS.slice(0, idx)
  const left = CARDS.length - idx - 1

  return (
    <g>
      {hover && (
        <ellipse cx={Q[hover].x} cy={Q[hover].y} rx={RX + 22} ry={RY + 22} fill="none" stroke={N.white} strokeWidth={8} strokeDasharray="22 14" strokeLinecap="round" opacity={0.9} pointerEvents="none" />
      )}

      {IDS.map((id) => {
        const mine = placed.filter((c) => c.answer === id)
        return mine.map((c, k) => {
          const s = chipSpot(id, k)
          return (
            <g key={c.id} transform={`translate(${s.x} ${s.y})`} data-tutor={`card on ${Q[id].name}: ${c.short}`} pointerEvents="none">
              <Glow r={84} color="teal" opacity={0.55} />
              <g transform={`scale(${CHIP_S})`}>
                <CardFace card={c} edge={N.teal} lifted={false} chip />
              </g>
            </g>
          )
        })
      })}

      <g ref={burst} pointerEvents="none">
        <circle r={70} fill="none" stroke={N.tealLight} strokeWidth={8} opacity={0} />
      </g>

      {!done && (
        <g>
          {Array.from({ length: Math.min(left, 2) }, (_, k) => {
            const o = (Math.min(left, 2) - k) * 9
            return (
              <g key={k} transform={`translate(${DECK.x + o} ${DECK.y + o})`} pointerEvents="none">
                <CardBack />
              </g>
            )
          })}
          <g ref={outer} {...drag} className={myTurn ? 'hot' : undefined} data-tutor="the puzzle card">
            <g ref={inner}>
              {myTurn && !held && (
                <rect className="hot-ring" x={-CARD_W / 2 - 8} y={-CARD_H / 2 - 8} width={CARD_W + 16} height={CARD_H + 16} rx={32} fill="none" stroke={N.mist} strokeWidth={5} />
              )}
              <CardFace card={card} edge={N.sandDark} lifted={held} />
            </g>
          </g>
        </g>
      )}
    </g>
  )
}

/** The back of a card still in the pile: another puzzle waiting. */
function CardBack() {
  return (
    <g>
      <rect x={-CARD_W / 2} y={-CARD_H / 2 + 8} width={CARD_W} height={CARD_H} rx={26} fill={N.shadow} opacity={0.25} />
      <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={26} fill={N.sandLight} stroke={N.sandDark} strokeWidth={5} />
      <rect x={-CARD_W / 2 + 16} y={-CARD_H / 2 + 16} width={CARD_W - 32} height={CARD_H - 32} rx={16} fill="none" stroke={N.sand} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" />
      <circle r={54} fill={N.cream} />
      <text y={26} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={76} fill={N.pink}>
        ?
      </text>
    </g>
  )
}

function CardFace({ card, edge, lifted, chip = false }: { card: PuzzleCard; edge: string; lifted: boolean; chip?: boolean }) {
  const n = card.lines.length
  if (chip) {
    // A sorted card, shrunk onto its question: just the picture, framed in teal.
    return (
      <g>
        <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={26} fill={N.white} stroke={edge} strokeWidth={14} />
        <g transform="scale(1.08)">{card.Pic()}</g>
      </g>
    )
  }
  return (
    <g>
      <rect x={-CARD_W / 2} y={-CARD_H / 2 + (lifted ? 18 : 8)} width={CARD_W} height={CARD_H} rx={26} fill={N.shadow} opacity={lifted ? 0.35 : 0.25} />
      <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={26} fill={N.cream} stroke={edge} strokeWidth={5} />
      <rect x={-130} y={-104} width={260} height={112} rx={18} fill={N.white} />
      <g transform="translate(0 -48)">{card.Pic()}</g>
      {card.lines.map((line, k) => (
        <text key={k} x={0} y={n === 1 ? 70 : 52 + k * 40} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={36} fill={N.night0}>
          {line}
        </text>
      ))}
    </g>
  )
}

/* ================================================================== */
/* The islands of light                                                 */
/* ================================================================== */

function Island({ q, tutor }: { q: Question; tutor: boolean }) {
  const two = q.words.length > 1
  return (
    <g transform={`translate(${q.x} ${q.y})`} data-tutor={tutor ? `the "${q.name}" question` : undefined}>
      <g className={`q2-dim-${q.id}`}>
        {/* the constellation ring that forms first */}
        <g className={`q2-ring-${q.id}`}>
          <g className="tw2">
            <ellipse rx={RX + 30} ry={RY + 30} fill="none" stroke={N.mist} strokeOpacity={0.5} strokeWidth={4} strokeDasharray="1 22" strokeLinecap="round" />
          </g>
          {[200, 250, 300, 20, 70, 120].map((a, i) => {
            const r = (a * Math.PI) / 180
            return (
              <g key={a} transform={`translate(${((RX + 30) * Math.cos(r)).toFixed(1)} ${((RY + 30) * Math.sin(r)).toFixed(1)})`}>
                <circle r={10} fill={N.skyLight} opacity={0.25} />
                <path d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z" fill={N.white} className={i % 2 ? 'tw2 tw2-1' : 'tw2 tw2-2'} />
              </g>
            )
          })}
        </g>
        <g className={`q2-isl-${q.id}`}>
          <g className={`q2-tpulse-${q.id}`}>
            <g className={`q2-pulse-${q.id}`}>
              <g className={`q2-glow-${q.id}`}>
                <Glow r={360} color="cool" opacity={0.75} />
              </g>
              <g className={`q2-teal-${q.id}`} opacity={0}>
                <Glow r={340} color="teal" opacity={0.9} />
              </g>
              <ellipse rx={RX + 18} ry={RY + 18} fill={N.skyLight} opacity={0.07} />
              <ellipse rx={RX} ry={RY} fill="url(#q2-plate)" />
              <ellipse rx={RX - 16} ry={RY - 16} fill="none" stroke={N.skyLight} strokeOpacity={0.14} strokeWidth={10} />
              <ellipse rx={RX} ry={RY} fill="none" stroke={N.skyLight} strokeOpacity={0.6} strokeWidth={4} />
              {/* the icon */}
              <g transform={`translate(0 ${MED.y})`}>
                <circle r={MED.r + 10} fill={N.skyLight} opacity={0.12} />
                <circle r={MED.r} fill={N.night0} />
                <circle r={MED.r} fill="none" stroke={N.mist} strokeWidth={5} />
                <QIcon id={q.id} />
              </g>
              {/* the words */}
              <g className={`q2-words-${q.id}`}>
                {two ? (
                  <>
                    <Title x={0} y={50} size={46}>
                      {q.words[0]}
                    </Title>
                    <Title x={0} y={98} size={46}>
                      {q.words[1]}
                    </Title>
                  </>
                ) : (
                  <Title x={0} y={76} size={54}>
                    {q.words[0]}
                  </Title>
                )}
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

function Apple({ x = 0, y = 0, r = 26 }: { x?: number; y?: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={N.leaf} />
      <path d={`M${r * 0.15} ${-r} A${r} ${r} 0 0 1 ${r * 0.15} ${r} A${r * 1.1} ${r * 1.1} 0 0 0 ${r * 0.15} ${-r} Z`} fill={N.leafDark} opacity={0.6} />
      <ellipse cx={-r * 0.38} cy={-r * 0.35} rx={r * 0.28} ry={r * 0.18} fill={N.leafLight} opacity={0.85} />
      <rect x={-r * 0.08} y={-r * 1.3} width={r * 0.16} height={r * 0.42} rx={r * 0.08} fill={N.woodDark} />
      <path d={`M0 ${-r * 1.05} Q${r * 0.5} ${-r * 1.45} ${r * 0.7} ${-r * 1.0} Q${r * 0.3} ${-r * 0.95} 0 ${-r * 1.05} Z`} fill={N.leafDark} />
    </g>
  )
}

function PlusMinus({ x, y, minus = false, r = 14 }: { x: number; y: number; minus?: boolean; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={N.white} />
      <rect x={-r * 0.6} y={-r * 0.16} width={r * 1.2} height={r * 0.32} rx={r * 0.16} fill={N.night0} />
      {!minus && <rect x={-r * 0.16} y={-r * 0.6} width={r * 0.32} height={r * 1.2} rx={r * 0.16} fill={N.night0} />}
    </g>
  )
}

function SunDisc({ r = 18 }: { r?: number }) {
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={-r * 0.12} y={-r * 1.65} width={r * 0.24} height={r * 0.45} rx={r * 0.12} fill={N.cream} transform={`rotate(${i * 45})`} />
      ))}
      <circle r={r} fill={N.cream} />
      <circle r={r * 0.72} fill={N.sandLight} opacity={0.7} />
    </g>
  )
}

function Crescent({ r = 16, bg = N.night0 }: { r?: number; bg?: string }) {
  return (
    <g>
      <circle r={r} fill={N.cream} />
      <circle cx={r * 0.5} cy={-r * 0.25} r={r * 0.86} fill={bg} />
    </g>
  )
}

function QIcon({ id }: { id: QId }) {
  if (id === 'howMany') return <Hand x={6} y={48} s={0.4} fingers={3} />
  if (id === 'change') {
    return (
      <g>
        <Apple x={-20} y={4} r={15} />
        <Apple x={20} y={4} r={15} />
        <Apple x={0} y={-8} r={15} />
        <path d="M-40 12 H40 L32 42 H-32 Z" fill={N.wood} />
        <rect x={-44} y={8} width={88} height={10} rx={5} fill={N.woodLight} />
        <path d="M-28 26 H28 M-24 34 H24" stroke={N.woodDark} strokeWidth={3} strokeLinecap="round" />
        <PlusMinus x={-38} y={-30} />
        <PlusMinus x={38} y={-30} minus />
      </g>
    )
  }
  if (id === 'next') {
    return (
      <g>
        <g transform="translate(-20 -14)">
          <SunDisc r={15} />
        </g>
        <g transform="translate(22 18)">
          <Crescent r={17} />
        </g>
        <path d="M14 -34 Q42 -30 42 -6" fill="none" stroke={N.mist} strokeWidth={4} strokeLinecap="round" />
        <path d="M36 -12 L42 -2 L48 -12" fill="none" stroke={N.mist} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-12 36 Q-42 32 -42 8" fill="none" stroke={N.mist} strokeWidth={4} strokeLinecap="round" />
        <path d="M-48 14 L-42 4 L-36 14" fill="none" stroke={N.mist} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )
  }
  return (
    <g>
      <path d="M-34 32 L34 32 L-34 -30 Z" fill={N.skyLight} fillOpacity={0.25} stroke={N.skyLight} strokeWidth={5} strokeLinejoin="round" />
      <g transform="rotate(-32) translate(8 2)">
        <rect x={-46} y={-11} width={92} height={22} rx={4} fill={N.sandLight} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={-38 + i * 9.5} y={-11} width={3} height={i % 2 ? 7 : 11} fill={N.woodDark} />
        ))}
      </g>
    </g>
  )
}

/** A villager's question: a little bubble with a pink question mark. Centred on (0, 0). */
function QBubble({ seed }: { seed: number }) {
  return (
    <g className="float" style={{ animationDelay: `${-seed * 0.7}s`, animationDuration: '2.6s' }}>
      <Glow r={70} color="pink" opacity={0.75} />
      <path d="M-8 26 L0 44 L10 26 Z" fill={N.white} />
      <circle r={32} fill={N.white} />
      <text y={16} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={48} fill={N.pink}>
        ?
      </text>
    </g>
  )
}

/* ================================================================== */
/* The town                                                             */
/* ================================================================== */

function Hut() {
  return (
    <g>
      <ellipse cy={3} rx={44} ry={7} fill={N.shadow} opacity={0.25} />
      <rect x={-34} y={-46} width={68} height={48} rx={6} fill={N.sandLight} />
      <path d="M-10 2 V-22 Q0 -32 10 -22 V2 Z" fill={N.woodDark} />
      <path d="M-48 -40 L0 -96 L48 -40 Q0 -30 -48 -40 Z" fill={N.sandDark} />
      <path d="M-30 -46 L0 -82 M0 -36 L0 -90 M30 -46 L0 -82" stroke={N.wood} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
    </g>
  )
}

function House({ wall, roof, i }: { wall: string; roof: string; i: number }) {
  return (
    <g>
      <ellipse cy={3} rx={58} ry={8} fill={N.shadow} opacity={0.25} />
      <rect x={-48} y={-82} width={96} height={84} fill={wall} />
      <rect x={18} y={-82} width={30} height={84} fill={N.shadow} opacity={0.1} />
      <path d="M-60 -78 L0 -134 L60 -78 Z" fill={roof} />
      <path d="M0 -134 L60 -78 L44 -78 Z" fill={N.shadow} opacity={0.18} />
      {i % 2 === 0 && <rect x={22} y={-128} width={14} height={30} fill={N.woodDark} />}
      <path d="M-14 2 V-34 Q0 -48 14 -34 V2 Z" fill={N.woodDark} />
      <rect x={-38} y={-66} width={20} height={20} rx={4} fill={N.night1} />
      <rect x={20} y={-66} width={20} height={20} rx={4} fill={N.night1} />
    </g>
  )
}

function Loaf({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse rx={24} ry={13} fill={N.sand} />
      <ellipse cx={-4} cy={-4} rx={16} ry={6} fill={N.sandLight} opacity={0.7} />
      <path d="M-12 -6 L-6 4 M-2 -8 L4 2 M8 -7 L13 2" stroke={N.sandDark} strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

function MarketStall({ a }: { a: string }) {
  const w = 230
  const n = 6
  const sw = w / n
  return (
    <g>
      <rect x={-w / 2 + 6} y={-176} width={14} height={240} fill={N.woodDark} />
      <rect x={w / 2 - 20} y={-176} width={14} height={240} fill={N.woodDark} />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${-w / 2 + i * sw} -196 h${sw} v48 q${-sw / 2} 20 ${-sw} 0 Z`} fill={i % 2 ? N.cream : a} />
      ))}
      <rect x={-w / 2 - 8} y={-210} width={w + 16} height={18} rx={7} fill={N.woodDark} />
    </g>
  )
}

function StallFront({ goods }: { goods: 'bread' | 'apples' | 'pots' }) {
  const w = 230
  return (
    <g>
      {goods === 'bread' && [-70, -20, 30].map((x) => <Loaf key={x} x={x} y={-12} />)}
      {goods === 'apples' &&
        [-96, -68, -40, 40, 68, 96, -82, -54, 54, 82].map((x, i) => <Apple key={i} x={x} y={i < 6 ? -12 : -36} r={14} />)}
      {goods === 'pots' &&
        [-70, -10, 50].map((x, i) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <path d={`M-18 0 Q-26 -26 -12 -38 H12 Q26 -26 18 0 Z`} fill={i === 1 ? N.stone : N.woodLight} />
            <rect x={-14} y={-44} width={28} height={8} rx={4} fill={i === 1 ? N.stoneDark : N.wood} />
          </g>
        ))}
      <rect x={-w / 2 - 12} y={-6} width={w + 24} height={18} rx={7} fill={N.woodLight} />
      <rect x={-w / 2} y={12} width={w} height={52} fill={N.wood} />
      <rect x={-w / 2} y={12} width={w} height={10} fill={N.woodDark} opacity={0.6} />
      {[-70, 0, 70].map((x) => (
        <rect key={x} x={x - 26} y={30} width={52} height={26} rx={6} fill={N.woodDark} opacity={0.35} />
      ))}
    </g>
  )
}

const SELLERS = [
  { robe: [N.cream, N.white, N.sandLight], skin: [N.skin1, N.skin1Dark], head: 'hair' as const, hc: N.woodDark, tutor: 'the baker' },
  { robe: [N.leaf, N.leafLight, N.leafDark], skin: [N.skin3, N.skin3Dark], head: 'hijab' as const, hc: N.sand, tutor: 'the fruit seller' },
  { robe: [N.sky, N.skyLight, N.skyDark], skin: [N.skin2, N.skin2Dark], head: 'cap' as const, hc: N.wood, tutor: 'the pot seller' },
]

function Town({ tutor }: { tutor: boolean }) {
  const t = (name: string) => (tutor ? name : undefined)
  const lit = [...HOMES.map((h) => ({ x: h.x, y: h.y, s: 0.78 })), ...FAR_HOMES.map((h) => ({ x: h.x, y: h.y, s: 0.55 }))]
  return (
    <g>
      <g className="q2-town">
        <TownBody t={t} />
      </g>
      {/* windows light up as night falls */}
      {lit.map((h, i) =>
        [-38, 20].map((wx) => (
          <g key={`${i}-${wx}`} className="q2-win">
            <rect x={h.x + wx * h.s - 4} y={h.y - 66 * h.s - 4} width={20 * h.s + 8} height={20 * h.s + 8} rx={6} fill={N.cream} opacity={0.25} />
            <rect x={h.x + wx * h.s} y={h.y - 66 * h.s} width={20 * h.s} height={20 * h.s} rx={3} fill={N.cream} />
          </g>
        )),
      )}
    </g>
  )
}

function TownBody({ t }: { t: (name: string) => string | undefined }) {
  return (
    <g>
      <clipPath id="q2-sclip">
        <rect x={-200} y={-400} width={400} height={464} />
      </clipPath>
      {/* Ama's flock, still grazing on the hill */}
      <Sheep x={150} y={692} s={0.5} flip tutor={t("Ama's sheep")} />
      <Sheep x={262} y={684} s={0.46} flip />
      <Sheep x={372} y={682} s={0.42} />

      {FAR_HOMES.map((h, i) => (
        <g key={i} className={`q2-farhouse q2-farhouse-${i}`}>
          <g transform={`translate(${h.x} ${h.y}) scale(0.55)`}>
            <House wall={i === 1 ? N.sandLight : N.cream} roof={i === 1 ? N.wood : '#6b7894'} i={i + 1} />
          </g>
        </g>
      ))}
      {HOMES.map((h, i) => (
        <g key={i}>
          <g className={`q2-hut q2-hut-${i}`}>
            <g transform={`translate(${h.x} ${h.y}) scale(0.8)`}>
              <Hut />
            </g>
          </g>
          <g className={`q2-house q2-house-${i}`}>
            <g transform={`translate(${h.x} ${h.y}) scale(0.78)`}>
              <House wall={h.wall} roof={h.roof} i={i} />
            </g>
          </g>
        </g>
      ))}

      {/* the builder's half-built wall */}
      <g className="q2-pp">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].slice(0, 4 - row).map((k) => (
            <rect key={`${row}-${k}`} x={330 + k * 34 + (row % 2) * 17} y={846 - row * 22} width={32} height={20} rx={3} fill={(row + k) % 2 ? N.wood : N.woodLight} />
          )),
        )}
      </g>

      {STALLS.map((s, i) => {
        const p = SELLERS[i]
        return (
          <g key={i} className={`q2-stall q2-stall-${i}`} data-tutor={t(`a market stall with ${s.goods}`)}>
            <g transform={`translate(${s.x} ${s.y})`}>
              <MarketStall a={s.a} />
              <g clipPath="url(#q2-sclip)">
                <g className="q2-seller" data-tutor={t(p.tutor)}>
                  <Person x={0} y={64} s={0.55} robe={p.robe[0]} robeLight={p.robe[1]} robeDark={p.robe[2]} skin={p.skin[0]} skinDark={p.skin[1]} head={p.head} headColor={p.hc} headDark={N.woodDark} pose={i === 1 ? 'point' : 'down'} flip={i === 1} />
                </g>
              </g>
              <StallFront goods={s.goods} />
            </g>
          </g>
        )
      })}

      {/* trading: a loaf for a pebble */}
      <g className="q2-loaf">
        <Loaf x={662} y={790} />
      </g>
      <g className="q2-pay">
        <g transform="translate(748 800)">
          <ellipse rx={12} ry={9} fill={N.stoneLight} />
          <ellipse cx={-3} cy={-3} rx={5} ry={2.5} fill={N.white} opacity={0.6} />
        </g>
      </g>

      {VILLAGERS.map((v, i) => (
        <g key={i} className="q2-pp" data-tutor={t(v.tutor)}>
          <g className="q2-bob">
            <Person
              x={v.x}
              y={v.y}
              s={v.s}
              flip={v.flip}
              robe={v.robe[0]}
              robeLight={v.robe[1]}
              robeDark={v.robe[2]}
              skin={v.skin[0]}
              skinDark={v.skin[1]}
              head={v.head}
              headColor={v.headColor}
              headDark={v.headDark}
              pose={v.pose}
              face={v.face}
            />
          </g>
        </g>
      ))}
    </g>
  )
}

/* ================================================================== */
/* The example windows                                                  */
/* ================================================================== */

function Window({ id, tutor, children }: { id: QId; tutor?: string; children: ReactNode }) {
  const at = EX_AT[id]
  return (
    <g transform={`translate(${at.x} ${at.y})`} data-tutor={tutor}>
      <g className={`q2-ex-${id}`}>
        <Glow r={EX_R * 1.45} color="cool" opacity={0.55} />
        <circle r={EX_R + 14} fill={N.night0} opacity={0.6} />
        <clipPath id={`q2-clip-${id}`}>
          <circle r={EX_R} />
        </clipPath>
        <g clipPath={`url(#q2-clip-${id})`}>{children}</g>
        <circle r={EX_R} fill="none" stroke={N.mist} strokeWidth={8} />
        <g className="tw2">
          <circle r={EX_R + 22} fill="none" stroke={N.skyLight} strokeOpacity={0.45} strokeWidth={4} strokeDasharray="1 20" strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

/** A day meadow for the example windows: sky, a far hill and grass from `ground` down. */
function DayMeadow({ ground = 90 }: { ground?: number }) {
  return (
    <g>
      <rect x={-300} y={-300} width={600} height={600} fill="url(#fx-sky-day)" />
      <circle cx={150} cy={-150} r={40} fill={N.cream} opacity={0.9} />
      <path d={`M-300 ${ground - 40} Q-120 ${ground - 110} 60 ${ground - 50} T300 ${ground - 60} V300 H-300 Z`} fill="#86cfa0" />
      <path d={`M-300 ${ground + 8} Q0 ${ground - 26} 300 ${ground + 4} V300 H-300 Z`} fill="#6ccb88" />
      <path d={`M-300 ${ground + 20} Q0 ${ground - 14} 300 ${ground + 16} V300 H-300 Z`} fill="#3c9c5d" />
    </g>
  )
}

function NumTile({ n, x = 0, y = 0, size = 52 }: { n: number; x?: number; y?: number; size?: number }) {
  const w = size * 1.15
  const h = size * 1.38
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow r={size * 1.5} color="warm" opacity={0.7} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.26} fill={N.gold} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.15} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.night0}>
        {n}
      </text>
    </g>
  )
}

function ExHowMany() {
  return (
    <g>
      <DayMeadow ground={110} />
      {[0, 1, 2].map((i) => (
        <g key={i} className={`q2-hm-sheep-${i}`}>
          <Sheep x={(i - 1) * 150} y={168} s={0.85} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <g key={i} className={`q2-hm-tile-${i}`}>
          <NumTile n={i + 1} x={(i - 1) * 150} y={10} />
        </g>
      ))}
    </g>
  )
}

function ExChange() {
  const base = 150
  return (
    <g>
      <DayMeadow ground={120} />
      {/* apples already in the basket */}
      <Apple x={-82} y={base - 92} />
      <Apple x={-24} y={base - 96} />
      <Apple x={34} y={base - 92} />
      {/* two more drop in */}
      <g className="q2-ch-add-0">
        <Apple x={-54} y={base - 138} />
      </g>
      <g className="q2-ch-give">
        <g className="q2-ch-add-1">
          <Apple x={8} y={base - 140} />
        </g>
      </g>
      {/* the basket */}
      <path d={`M-120 ${base - 78} H72 L56 ${base} H-104 Z`} fill={N.wood} />
      <rect x={-128} y={base - 86} width={208} height={18} rx={9} fill={N.woodLight} />
      {[-90, -54, -18, 18, 50].map((x) => (
        <path key={x} d={`M${x} ${base - 68} L${x + 4} ${base - 4}`} stroke={N.woodDark} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      ))}
      {/* a friend's hand comes for one apple */}
      <g className="q2-ch-hand">
        <g transform={`translate(330 ${base - 150}) rotate(-90)`}>
          <Hand s={0.62} fingers={5} skin={N.skin1} skinDark={N.skin1Dark} />
        </g>
      </g>
      {/* how many apples: the amount and its name */}
      <g className="q2-ch-tile">
        <g className="q2-ch-n3">
          <NumTile n={3} x={-24} y={-150} size={58} />
        </g>
        <g className="q2-ch-n5">
          <NumTile n={5} x={-24} y={-150} size={58} />
        </g>
        <g className="q2-ch-n4">
          <NumTile n={4} x={-24} y={-150} size={58} />
        </g>
      </g>
      <g className="q2-ch-plus">
        <PlusMinus x={-120} y={-150} r={26} />
      </g>
      <g className="q2-ch-minus">
        <PlusMinus x={-120} y={-150} r={26} minus />
      </g>
    </g>
  )
}

function ExNext() {
  const xs = [-168, -84, 0, 84, 168]
  return (
    <g>
      <rect x={-300} y={-300} width={600} height={600} fill="url(#fx-sky-day)" />
      <g className="q2-nx-night">
        <rect x={-300} y={-300} width={600} height={600} fill="url(#fx-sky-night)" />
        <Stars w={540} h={260} y={-270} count={40} seed={31} />
      </g>
      <g className="q2-nx-sun">
        <g transform="translate(0 -110)">
          <Glow r={150} color="warm" opacity={0.8} />
          <SunDisc r={46} />
        </g>
      </g>
      <g className="q2-nx-moon">
        <Moon x={0} y={-110} r={48} />
      </g>
      <path d="M-300 70 Q-120 0 60 50 T300 40 V300 H-300 Z" fill="#3c9c5d" />
      <g className="q2-nx-night">
        <path d="M-300 70 Q-120 0 60 50 T300 40 V300 H-300 Z" fill={N.night1} />
      </g>
      <rect x={-300} y={98} width={600} height={88} fill={N.night0} opacity={0.6} />
      {xs.map((x, i) => (
        <g key={i} className={`q2-nx-t${i}`}>
          <g transform={`translate(${x} 142)`}>
            {i === 4 ? (
              <g>
                <Glow r={64} color="pink" opacity={0.9} />
                <circle r={34} fill={N.night0} stroke={N.pink} strokeWidth={4} strokeDasharray="7 6" />
                <text y={16} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={46} fill={N.pink}>
                  ?
                </text>
              </g>
            ) : i % 2 === 0 ? (
              <SunDisc r={22} />
            ) : (
              <Crescent r={26} bg={N.night0} />
            )}
          </g>
        </g>
      ))}
    </g>
  )
}

function Couch() {
  return (
    <g>
      <rect x={-112} y={-58} width={224} height={62} rx={22} fill={N.skyDark} />
      <rect x={-125} y={-12} width={250} height={60} rx={18} fill={N.sky} />
      <rect x={-96} y={-22} width={92} height={30} rx={12} fill={N.skyLight} />
      <rect x={4} y={-22} width={92} height={30} rx={12} fill={N.skyLight} />
      <rect x={-136} y={-34} width={36} height={78} rx={16} fill={N.skyDark} />
      <rect x={100} y={-34} width={36} height={78} rx={16} fill={N.skyDark} />
      <rect x={-112} y={46} width={14} height={14} rx={4} fill={N.woodDark} />
      <rect x={98} y={46} width={14} height={14} rx={4} fill={N.woodDark} />
    </g>
  )
}

function ExShape() {
  const door = { x: 120, w: 150, top: -140, floor: 152 }
  return (
    <g>
      <rect x={-300} y={-300} width={600} height={600} fill={N.cream} />
      <rect x={-300} y={60} width={600} height={100} fill={N.sandLight} />
      <rect x={-300} y={56} width={600} height={10} fill={N.sand} />
      <rect x={-300} y={door.floor} width={600} height={150} fill={N.wood} />
      <rect x={-300} y={door.floor} width={600} height={10} fill={N.woodDark} />
      {/* the doorway */}
      <rect x={door.x - door.w / 2 - 16} y={door.top - 16} width={door.w + 32} height={door.floor - door.top + 16} rx={6} fill={N.woodDark} />
      <rect x={door.x - door.w / 2} y={door.top} width={door.w} height={door.floor - door.top} fill={N.night1} />
      <g className="q2-sh-fit">
        <Glow x={door.x} y={(door.top + door.floor) / 2} r={240} color="teal" opacity={0.8} />
        <rect x={door.x - door.w / 2 - 8} y={door.top - 8} width={door.w + 16} height={door.floor - door.top + 8} rx={6} fill="none" stroke={N.teal} strokeWidth={10} />
      </g>
      {/* the couch: too wide lying down, it fits on its end */}
      <g className="q2-sh-couch">
        <g className="q2-sh-tip">
          <Couch />
        </g>
      </g>
      <g className="q2-sh-over">
        <rect x={door.x - 136} y={92 - 58} width={136 - door.w / 2} height={120} rx={12} fill={N.coral} opacity={0.6} />
        <rect x={door.x + door.w / 2} y={92 - 58} width={136 - door.w / 2} height={120} rx={12} fill={N.coral} opacity={0.6} />
      </g>
    </g>
  )
}

/* ================================================================== */
/* The jobs                                                             */
/* ================================================================== */

function JobWindow({ kind, x, y }: { kind: JobKind; x: number; y: number }) {
  const id = `q2-jclip-${kind}`
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow r={JOB_R * 1.7} color="cool" opacity={0.6} />
      <clipPath id={id}>
        <circle r={JOB_R} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <g transform={`scale(${JOB_R / 92})`}>
          <JobScene kind={kind} />
        </g>
      </g>
      <circle r={JOB_R} fill="none" stroke={N.mist} strokeWidth={6} />
    </g>
  )
}

function JobScene({ kind }: { kind: JobKind }) {
  if (kind === 'baker') {
    return (
      <g>
        <rect x={-100} y={-100} width={200} height={200} fill="#f3dcc0" />
        <path d="M-100 -20 H-40 V100 H-100 Z" fill={N.stone} />
        <path d="M-92 40 Q-70 0 -48 40 Z" fill={N.night1} />
        <Glow x={-70} y={36} r={40} color="warm" opacity={0.7} />
        <Person x={14} y={82} s={0.5} robe={N.white} robeLight={N.white} robeDark={N.mist} skin={N.skin1} skinDark={N.skin1Dark} head="hair" headColor={N.woodDark} headDark={N.night0} pose="hold" holding={<BunTray />} />
        {/* chef's hat */}
        <g transform={`translate(14 ${82 - 0.5 * 236})`}>
          <rect x={-18} y={-18} width={36} height={16} rx={4} fill={N.white} />
          <circle cx={-12} cy={-24} r={12} fill={N.white} />
          <circle cx={4} cy={-30} r={14} fill={N.white} />
          <circle cx={16} cy={-22} r={11} fill={N.white} />
        </g>
      </g>
    )
  }
  if (kind === 'builder') {
    return (
      <g>
        <rect x={-100} y={-100} width={200} height={200} fill="url(#fx-sky-day)" />
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 6 }, (_, k) => (
            <rect key={`${row}-${k}`} x={-110 + k * 40 + (row % 2) * 20} y={10 + row * 22} width={38} height={20} rx={3} fill={(row + k) % 2 ? N.wood : N.woodLight} />
          )),
        )}
        <Person x={0} y={84} s={0.5} robe={N.sand} robeLight={N.sandLight} robeDark={N.sandDark} skin={N.skin2} skinDark={N.skin2Dark} head="cap" headColor={N.white} headDark={N.mist} pose="hold" holding={<Ruler />} />
      </g>
    )
  }
  if (kind === 'astronaut') {
    return (
      <g>
        <rect x={-100} y={-100} width={200} height={200} fill={N.night0} />
        <Stars w={200} h={200} y={-100} count={24} seed={4} />
        <circle cx={52} cy={-46} r={24} fill={N.sky} />
        <ellipse cx={52} cy={-46} rx={40} ry={9} fill="none" stroke={N.skyLight} strokeWidth={4} transform="rotate(-18 52 -46)" />
        <Person x={-8} y={96} s={0.5} robe={N.white} robeLight={N.white} robeDark={N.mist} skin={N.skin3} skinDark={N.skin3Dark} head="hair" headColor={N.night0} headDark={N.space} pose="wave" face="wow" />
        <g transform={`translate(-8 ${96 - 0.5 * 206})`}>
          <circle r={28} fill={N.skyLight} opacity={0.22} />
          <circle r={28} fill="none" stroke={N.mist} strokeWidth={5} />
          <path d="M-16 -14 Q-6 -22 6 -20" stroke={N.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
    )
  }
  return (
    <g>
      <rect x={-100} y={-100} width={200} height={200} fill={N.night1} />
      <rect x={-80} y={-78} width={160} height={92} rx={10} fill={N.night0} stroke={N.mist} strokeWidth={4} />
      <rect x={-56} y={-34} width={18} height={18} fill={N.leaf} />
      <rect x={-52} y={-44} width={10} height={10} fill={N.leafLight} />
      <rect x={-70} y={-16} width={140} height={8} fill={N.sky} />
      <path d="M10 -40 L28 -58 L46 -40 Z" fill={N.skyLight} />
      <rect x={52} y={-66} width={20} height={6} rx={3} fill={N.leafLight} />
      <Person x={0} y={118} s={0.46} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} skin={N.skin2} skinDark={N.skin2Dark} head="hair" headColor={N.night0} headDark={N.space} pose="hold" holding={<GamePad />} />
    </g>
  )
}

function BunTray() {
  return (
    <g>
      <rect x={-74} y={-120} width={148} height={12} rx={6} fill={N.stone} />
      {[-48, 0, 48].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={-134} rx={20} ry={14} fill={N.sand} />
          <ellipse cx={x - 5} cy={-139} rx={9} ry={4} fill={N.sandLight} />
        </g>
      ))}
    </g>
  )
}

function Ruler() {
  return (
    <g>
      <rect x={-84} y={-124} width={168} height={24} rx={4} fill={N.sandLight} />
      {Array.from({ length: 15 }, (_, i) => (
        <rect key={i} x={-76 + i * 11} y={-124} width={3} height={i % 2 ? 8 : 13} fill={N.woodDark} />
      ))}
    </g>
  )
}

function GamePad() {
  return (
    <g>
      <rect x={-70} y={-136} width={140} height={50} rx={24} fill={N.stone} />
      <rect x={-50} y={-115} width={30} height={8} rx={3} fill={N.night0} />
      <rect x={-39} y={-126} width={8} height={30} rx={3} fill={N.night0} />
      <circle cx={30} cy={-118} r={7} fill={N.sky} />
      <circle cx={46} cy={-104} r={7} fill={N.white} />
    </g>
  )
}

/* ================================================================== */
/* Card pictures (about 250 x 100, centred)                            */
/* ================================================================== */

function Kid({ x, y, skin, hair }: { x: number; y: number; skin: string; hair: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={22} fill={skin} />
      <path d="M-22 -2 C-24 -30 24 -30 22 -2 C14 -14 -14 -14 -22 -2 Z" fill={hair} />
      <circle cx={-8} cy={2} r={3} fill={N.night0} />
      <circle cx={8} cy={2} r={3} fill={N.night0} />
      <path d="M-7 10 Q0 15 7 10" stroke={N.night0} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Cookie({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={17} fill={N.sand} stroke={N.sandDark} strokeWidth={3} />
      <circle cx={-6} cy={-4} r={3} fill={N.woodDark} />
      <circle cx={6} cy={-6} r={3} fill={N.woodDark} />
      <circle cx={2} cy={6} r={3} fill={N.woodDark} />
    </g>
  )
}

function PicCookies() {
  const kids = [
    { x: -80, skin: N.skin2, hair: N.woodDark },
    { x: 0, skin: N.skin1, hair: N.night0 },
    { x: 80, skin: N.skin3, hair: N.night1 },
  ]
  return (
    <g>
      {kids.map((k) => (
        <Kid key={k.x} x={k.x} y={-18} skin={k.skin} hair={k.hair} />
      ))}
      {kids.map((k) => (
        <Cookie key={k.x} x={k.x} y={32} />
      ))}
    </g>
  )
}

function Marble({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill={c} />
      <circle cx={x - 4} cy={y - 5} r={4} fill={N.white} opacity={0.6} />
    </g>
  )
}

function PicMarbles() {
  const five = [
    [-110, -14],
    [-80, -14],
    [-50, -14],
    [-95, 14],
    [-65, 14],
  ]
  const three = [
    [46, -14],
    [76, -14],
    [61, 14],
  ]
  const cs = [N.sky, N.leaf, N.skyDark, N.stone, N.leafDark]
  return (
    <g>
      {five.map(([x, y], k) => (
        <Marble key={k} x={x} y={y} c={cs[k]} />
      ))}
      <rect x={-14} y={-3} width={28} height={6} rx={3} fill={N.night0} />
      <rect x={-3} y={-14} width={6} height={28} rx={3} fill={N.night0} />
      {three.map(([x, y], k) => (
        <Marble key={k} x={x} y={y} c={cs[(k + 2) % 5]} />
      ))}
    </g>
  )
}

function PicBeads() {
  const beads = [N.leaf, N.sky, N.leaf, N.sky]
  const yy = (x: number) => 4 + (x * x) / 1600
  return (
    <g>
      <path d="M-124 14 Q0 -6 124 14" stroke={N.stoneDark} strokeWidth={3} fill="none" />
      {beads.map((c, k) => {
        const x = -96 + k * 46
        return (
          <g key={k}>
            <circle cx={x} cy={yy(x) - 4} r={20} fill={c} />
            <circle cx={x - 6} cy={yy(x) - 10} r={5} fill={N.white} opacity={0.5} />
          </g>
        )
      })}
      <circle cx={92} cy={yy(92) - 4} r={22} fill={N.white} stroke={N.pink} strokeWidth={3} strokeDasharray="5 5" />
      <text x={92} y={yy(92) + 9} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={36} fill={N.pink}>
        ?
      </text>
    </g>
  )
}

function PicCouch() {
  return (
    <g>
      <g transform="translate(-50 20) scale(0.5)">
        <Couch />
      </g>
      <g transform="translate(78 48)">
        <rect x={-38} y={-100} width={76} height={100} fill={N.woodDark} />
        <rect x={-28} y={-90} width={56} height={90} fill={N.night1} />
      </g>
    </g>
  )
}

function Star5({ x, y, c, r = 16 }: { x: number; y: number; c: string; r?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return <polygon points={pts} fill={c} strokeLinejoin="round" />
}

function PicStickers() {
  const stay = [
    [-108, -16],
    [-74, -16],
    [-108, 18],
    [-74, 18],
  ]
  const gone = [
    [14, -16],
    [14, 18],
  ]
  const col = (k: number) => (k % 2 ? N.sky : N.leaf)
  return (
    <g>
      {stay.map(([x, y], k) => (
        <Star5 key={k} x={x} y={y} c={col(k)} />
      ))}
      <path d="M-44 0 L-14 0 M-24 -10 L-12 0 L-24 10" stroke={N.night0} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {gone.map(([x, y], k) => (
        <Star5 key={k} x={x} y={y} c={col(k)} />
      ))}
      <Kid x={84} y={4} skin={N.skin2} hair={N.night0} />
    </g>
  )
}

function PicMoon() {
  return (
    <g>
      <rect x={-124} y={-46} width={248} height={92} rx={20} fill={N.night1} />
      <circle cx={-84} cy={0} r={22} fill={N.cream} />
      <g transform="translate(-28 0)">
        <Crescent r={22} bg={N.night1} />
      </g>
      <circle cx={28} cy={0} r={22} fill={N.cream} />
      <circle cx={84} cy={0} r={22} fill="none" stroke={N.pink} strokeWidth={3} strokeDasharray="5 5" />
      <text x={84} y={13} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={36} fill={N.pink}>
        ?
      </text>
    </g>
  )
}

const CARDS: PuzzleCard[] = [
  {
    id: 'cookies',
    answer: 'howMany',
    read: 'Is there a cookie for every kid?',
    lines: ['A cookie for', 'every kid?'],
    short: 'a cookie for every kid',
    Pic: PicCookies,
    right: 'Yes! You match and count. A how many question.',
    hints: [
      'Look at the kids and the cookies. What do we need to find out?',
      'Is anything being added, taken away, repeated or measured? Or are we checking that there are enough?',
      'Remember Ama giving one pebble to each sheep.',
    ],
    mixup: 'may choose "How do amounts change?" because cookies get handed out, but the puzzle only asks if there is one cookie for each kid, which is matching and counting',
  },
  {
    id: 'marbles',
    answer: 'change',
    read: 'You had 5 marbles, and you won 3 more.',
    lines: ['Win 3 more!'],
    short: '5 marbles and won 3 more',
    Pic: PicMarbles,
    right: 'Yes! Winning more changes how many you have.',
    hints: [
      'What happens to your pile of marbles?',
      'Does your pile stay the same, or does it get bigger?',
      'Which big question is about getting more, or giving some away?',
    ],
    mixup: 'often chooses "How many?" because the card has numbers on it, but the amount is changing (getting bigger)',
  },
  {
    id: 'beads',
    answer: 'next',
    read: 'Green bead, blue bead, green bead, blue bead. Which bead goes on the end?',
    lines: ['Which bead', 'goes here?'],
    short: 'green and blue beads',
    Pic: PicBeads,
    right: 'Yes! Green, blue, green, blue is a pattern.',
    hints: ['Say the bead colours out loud, in order.', 'Green, blue, green, blue. Does it repeat?', 'Which big question has the sun and moon taking turns?'],
    mixup: 'may choose "How many?" or "How do amounts change?" because beads are being added to the string, but the puzzle is about a repeating pattern',
  },
  {
    id: 'couch',
    answer: 'shape',
    read: 'Will this couch fit through the door?',
    lines: ['Will it fit?'],
    short: 'the couch and the door',
    Pic: PicCouch,
    right: 'Yes! That is all about size and shape.',
    hints: ['Picture carrying the couch to the door.', 'What could make a couch get stuck in a doorway?', 'Which big question has a ruler on it?'],
    mixup: 'may not see this as a math question at all; it is about size and shape',
  },
  {
    id: 'stickers',
    answer: 'change',
    read: 'You had 6 stickers, and gave 2 to a friend.',
    lines: ['Give 2 away'],
    short: 'gave 2 of 6 stickers away',
    Pic: PicStickers,
    right: 'Yes! Giving some away changes the amount.',
    hints: [
      'What happens to your stickers?',
      'After you give some away, do you still have the same number?',
      'Which big question has the apple basket with a plus and a minus?',
    ],
    mixup: 'often chooses "How many?" because of the numbers, but the amount changes (some are given away)',
  },
  {
    id: 'moon',
    answer: 'next',
    read: 'The moon is full, then thin, then full again. When will it be full again?',
    lines: ['When is it', 'full again?'],
    short: 'when the moon is full again',
    Pic: PicMoon,
    right: FINAL_LINE,
    hints: [
      'Full, thin, full again. Does that remind you of something that repeats?',
      'The card asks when, not how big.',
      'Which big question has the sun and moon taking turns?',
    ],
    mixup: 'may choose "How big? What shape?" because the moon looks like different shapes, but the card asks when, and the answer comes from a repeating pattern',
  },
]

export const ch2: Chapter = {
  id: 'map',
  title: 'The map of math',
  cues: CUES,
  Scene: Ch2Questions,
  enter: { type: 'pan', dir: 'left' },
}
