import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Glow, Motes, Stars, Vignette, rng, type GlowColor } from '../../art2/fx'
import { N } from '../../art2/palette'
import { Equation, terms } from '../../art2/props'
import { Lantern, Moon, Skyline } from '../../art2/scenery'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Customer, Layla } from './art'
import { BalancePlay, equationText, isLevel, type Balance, type Move, type Side } from './balance'

export const CUES: Cue[] = [
  { id: 'intro', say: 'Time to put it all together. Three scales, three mystery sacks. Keep every scale balanced, and find what each sack weighs.' },
  { id: 'p1', say: 'First: three sacks balance twelve weights.', play: true },
  { id: 'p2', say: 'Next: two sacks and three weights balance thirteen weights.', play: true },
  { id: 'p3-intro', say: 'Now the big one. This scale has sacks on both sides!' },
  { id: 'p3', say: 'Sacks are things too. Can you still get one sack all alone?', play: true },
  { id: 'wow', say: 'You just solved an equation with the unknown on both sides. For hundreds of years, that was cutting-edge math.' },
]

/*
 * The night market, laid out as one long street. Each scale stands at its own "station",
 * D apart. A station is drawn in stage coordinates (its scale at x = 800) and shifted by
 * k * D, so when the camera rests on station k the station's transform is exactly the
 * identity and the playable scale's pointer maths lines up with the stage.
 */
const D = 1400
/** The table top, where each scale's base stands. */
const BASE = 600
const S = 0.8
/** The equation on the table cloth. */
const EQ = { y: 690, size: 44 }
const PIVOT = { x: 800, y: BASE - 360 * S }
/** Roughly where the things on each pan sit when the scale is level. */
const PAN = { l: 800 - 300 * S, r: 800 + 300 * S, y: BASE - (360 - 210 + 7) * S - 36 }
/** Where the answers float in the final shot, and how big they grow. */
const ANS = { y: 192, scale: 1.8 }

interface Puzzle {
  cue: number
  value: number
  start: Balance
  /** The usual finished state, for a deep link that skips the learner's own. */
  solved: Balance
  tutor: string
  answer: string
  /** Said once the learner has done it. */
  done: string
  setup: string
  method: string
  mixup: string
  hints: string[]
}

const PUZZLES: Puzzle[] = [
  {
    cue: 1,
    value: 4,
    start: { left: { sacks: 3, weights: 0 }, right: { sacks: 0, weights: 12 } },
    solved: { left: { sacks: 1, weights: 0 }, right: { sacks: 0, weights: 4 } },
    tutor: 'the first scale',
    answer: 'x = 4',
    done: 'One sack balances four weights. x equals 4.',
    setup: 'Scale 1 of 3: left pan 3 mystery sacks, right pan 12 weights, level (3x = 12).',
    method: 'Drag the glowing line down through the scale to split both sides into 3 equal parts, or take sacks off and the matching weights off the other side (1 sack with 4 weights).',
    mixup: 'trying to split after taking something off only one side (the scale is tipped, so it will not split), or answering 12 or 9 instead of sharing the 12 weights among 3 sacks.',
    hints: ['Twelve weights are holding up three sacks. How could you share the weights out fairly?', 'The glowing line above the scale splits both sides into equal parts. Try dragging it down.'],
  },
  {
    cue: 2,
    value: 5,
    start: { left: { sacks: 2, weights: 3 }, right: { sacks: 0, weights: 13 } },
    solved: { left: { sacks: 1, weights: 0 }, right: { sacks: 0, weights: 5 } },
    tutor: 'the second scale',
    answer: 'x = 5',
    done: 'x equals 5. Undo the plus 3, then split.',
    setup: 'Scale 2 of 3: left pan 2 sacks and 3 weights, right pan 13 weights, level (2x + 3 = 13).',
    method: 'Take 3 weights off each side (2x = 10), then split both sides into 2 equal parts (x = 5).',
    mixup: 'splitting before taking the 3 extra weights off both sides (it will not split while weights sit with the sacks), or taking the 3 weights off the left side only so the scale tips. Common wrong answers: 10 (forgot to split) or 6.5 (halved 13 first).',
    hints: [
      'Only sacks can be split into equal parts. What else is sitting with the sacks?',
      'Whatever you take off one side, take the same off the other side, and the scale stays level.',
      'Once the sacks are alone, drag the glowing line down to split both sides.',
    ],
  },
  {
    cue: 4,
    value: 3,
    start: { left: { sacks: 3, weights: 1 }, right: { sacks: 1, weights: 7 } },
    solved: { left: { sacks: 1, weights: 0 }, right: { sacks: 0, weights: 3 } },
    tutor: 'the big scale',
    answer: 'x = 3',
    done: 'x equals 3. You took a sack off both sides, just like a weight.',
    setup: 'Scale 3 of 3, the big one: left pan 3 sacks and 1 weight, right pan 1 sack and 7 weights, level (3x + 1 = x + 7). The unknown is on both sides.',
    method: 'Take 1 sack off each side (2x + 1 = 7), take 1 weight off each side (2x = 6), then split both sides into 2 equal parts (x = 3).',
    mixup: 'not seeing that a sack can be taken off both sides just like a weight, or taking a sack off one side only so the scale tips. Common wrong answer: 2 (ignoring the sack on the right, 3x = 6).',
    hints: [
      'A sack is a thing on the scale, just like a weight. You can take one off, if you do the same to the other side.',
      'Try to get all the sacks onto one side by taking the same thing off both sides.',
      'When the sacks are alone on one side, drag the glowing line down to split both sides.',
    ],
  },
]

/** Short, literal lines when the world pushes back. At most two per puzzle, each said once. */
const FEEDBACK = {
  tipped: "The scale tipped. The two sides aren't equal anymore.",
  splitTipped: 'The scale is tipped. Make it level before you split it.',
  splitWeights: 'Not yet. There are still weights sitting with the sacks.',
  splitBoth: 'Not yet. There are sacks on both sides.',
  splitNone: 'There are no sacks left to share out. Put them back on the scale.',
} as const
type FeedbackKind = keyof typeof FEEDBACK

const STATE: string[] = [
  'Back at the Baghdad night market, a wide shot: three brass balance scales stand far apart in a row, each on its own little table with a barrel on each side. Scale 1: 3 sacks vs 12 weights. Scale 2: 2 sacks and 3 weights vs 13 weights. Scale 3, the big one: 3 sacks and 1 weight vs 1 sack and 7 weights. All three are level. Layla and a customer watch from between the tables. The camera glides to the first scale. Answers: 4, 5 and 3.',
  '',
  '',
  'The camera walks on to the third scale, the big one, which has sacks on BOTH sides: left 3 sacks and 1 weight, right 1 sack and 7 weights (3x + 1 = x + 7), level. The lanterns brighten and a drumroll of little lights flies into the scale. The learner gets to play with it next. The answer is x = 3.',
  '',
  'The camera pulls back to all three scales, each solved, with its answer rising above it in glowing tiles: x = 4, x = 5, x = 3. Lanterns blaze, paper lanterns rise, fireworks of light burst in the sky, and the camera tilts up to the stars.',
]

/* ------------------------------------------------------------------ */
/* The camera                                                           */
/* ------------------------------------------------------------------ */

/** Where the camera looks (world point at the centre of the stage) and how far in it is (log of the zoom). */
interface Cam {
  cx: number
  cy: number
  lz: number
}
const AT = (k: number): Cam => ({ cx: 800 + k * D, cy: 450, lz: 0 })
const WIDE_IN: Cam = { cx: 800 + D, cy: 250, lz: Math.log(0.4) }
const WIDE: Cam = { cx: 800 + D, cy: 190, lz: Math.log(0.44) }
const STARS_CAM: Cam = { cx: 800 + D, cy: -1000, lz: Math.log(0.5) }
/** Layers from far to near, with how strongly each follows the camera (1 = the scales). */
const LAYERS: [string, number][] = [
  ['sky', 0.15],
  ['far', 0.35],
  ['mid', 0.65],
  ['sub', 1],
  ['fg', 1.3],
]

/* ------------------------------------------------------------------ */
/* Places for things                                                    */
/* ------------------------------------------------------------------ */

/** Lantern posts between the tables, and the garland that sags between them. */
const POSTS = [0, 1, 2, 3].map((j) => 100 + j * D)
const ROPE = { top: -10, sag: 250 }
const ropeY = (x: number) => {
  const t = (((x - 100) % D) + D) % D / D
  return ROPE.top + 2 * t * (1 - t) * ROPE.sag
}
/** The two lanterns over each table, which light up when that scale is solved. */
const LAMPS = [470, 1130]

/** The drumroll of little lights around the big scale (station-local). */
const DRUM = Array.from({ length: 16 }, (_, i) => {
  const a = Math.PI + 0.12 + (i / 15) * (Math.PI - 0.24)
  return { x: 800 + 500 * Math.cos(a), y: 520 + 300 * Math.sin(a) }
})

/** Paper lanterns that rise from the market at the end (world). */
const SKY_LANTERNS = (() => {
  const r = rng(77)
  return Array.from({ length: 15 }, (_, i) => ({
    x: 300 + i * 260 + r() * 120,
    y: 360 + r() * 160,
    rise: 1500 + r() * 800,
    s: 0.9 + r() * 0.8,
    delay: r() * 1.6,
    dur: 4 + r() * 0.4,
    drift: (r() - 0.5) * 160,
  }))
})()

/** Fireworks of light: where, how big, and when (seconds into the last cue). */
const FIREWORKS = [
  { x: 1450, y: -330, r: 250, c: N.skyLight, at: 3.0 },
  { x: 3050, y: -420, r: 280, c: N.violetLight, at: 3.6 },
  { x: 2250, y: -900, r: 330, c: N.leafLight, at: 4.3 },
  { x: 1150, y: -1150, r: 270, c: N.cream, at: 5.0 },
  { x: 3350, y: -1250, r: 300, c: N.skyLight, at: 5.6 },
  { x: 1900, y: -1550, r: 280, c: N.violetLight, at: 6.2 },
  { x: 2800, y: -1700, r: 260, c: N.white, at: 6.8 },
]

const sideWords = (s: Side) => {
  const parts = [s.sacks ? `${s.sacks} sack${s.sacks > 1 ? 's' : ''}` : '', s.weights ? `${s.weights} weight${s.weights > 1 ? 's' : ''}` : ''].filter(Boolean)
  return parts.length ? parts.join(' and ') : 'nothing'
}

const moveWords = (m: Move) =>
  m.kind === 'remove'
    ? `took a ${m.item} off the ${m.side} pan`
    : m.kind === 'add'
      ? `put a ${m.item} on the ${m.side} pan`
      : m.kind === 'split'
        ? `split both sides into ${m.parts} equal parts`
        : `tried to split (${m.reason})`

/** Why a split was refused when the scale was level. */
function notReady(b: Balance): FeedbackKind {
  if (b.left.sacks > 0 && b.right.sacks > 0) return 'splitBoth'
  const sackSide = b.left.sacks > 0 ? b.left : b.right.sacks > 0 ? b.right : null
  if (!sackSide) return 'splitNone'
  return 'splitWeights'
}

/* ------------------------------------------------------------------ */
/* The scene                                                            */
/* ------------------------------------------------------------------ */

export function Ch6Challenge({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const [mountCue] = useState(cueIndex)
  /** The last puzzle whose scale the camera has arrived at. */
  const [ready, setReady] = useState(-1)
  const [solved, setSolved] = useState<(Balance | null)[]>([null, null, null])
  const [now, setNow] = useState<Balance[]>(() => PUZZLES.map((p) => p.start))
  const [cheer, setCheer] = useState(false)
  const [burst, setBurst] = useState(-1)
  const solvedRef = useRef([false, false, false])
  const said = useRef<FeedbackKind[][]>([[], [], []])
  const tipTimer = useRef(0)
  const cheerTimer = useRef(0)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    if (!el) return
    const layers = LAYERS.map(([name, p]) => [el.querySelector(`.ch6-L-${name}`), p] as const)
    const fgEl = el.querySelector('.ch6-L-fg')

    // The camera is a plain object; every layer follows it, the far ones less (parallax).
    const cam: Cam = { ...WIDE_IN }
    const apply = () => {
      for (const [layer, p] of layers) {
        if (!layer) continue
        const zl = Math.exp(cam.lz * p)
        const cx = 800 + (cam.cx - 800) * p
        const cy = 450 + (cam.cy - 450) * p
        layer.setAttribute('transform', `matrix(${zl} 0 0 ${zl} ${800 - zl * cx} ${450 - zl * cy})`)
      }
      // Things right in front of the lens slip out of view when the camera pulls back.
      fgEl?.setAttribute('opacity', String(Math.max(0, Math.min(1, (Math.exp(cam.lz) - 0.55) / 0.17))))
    }
    let cur: Cam = { ...WIDE_IN }
    const move = (at: number, dur: number, to: Partial<Cam>, ease = 'power2.inOut') => {
      const from: Partial<Cam> = {}
      for (const key of Object.keys(to) as (keyof Cam)[]) from[key] = cur[key]
      tl.fromTo(cam, from, { ...to, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
      cur = { ...cur, ...to }
    }
    /** Walk along the market to station k: a glide sideways that eases back a little in the middle. */
    const walk = (at: number, k: number, dur = 2.1) => {
      move(at, dur, { cx: 800 + k * D }, 'power2.inOut')
      move(at, dur / 2, { lz: Math.log(0.8) }, 'sine.inOut')
      move(at + dur / 2, dur / 2, { lz: 0 }, 'sine.inOut')
    }
    const later = { immediateRender: false }
    const pulse = (sel: string, at: number, dur = 1.4, peak = 1) =>
      tl.fromTo(sel, { opacity: 0 }, { opacity: peak, duration: dur / 2, yoyo: true, repeat: 1, ease: 'sine.inOut', ...later }, at)
    /** Puzzle k is finished: its solved copy fades in on top, then the playable one (and its trays) fades away. */
    const settle = (k: number, at: number) => {
      tl.fromTo(`.ch6-done-${k}`, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.inOut', ...later }, at)
      tl.fromTo(`.ch6-live-${k}`, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.inOut', ...later }, at + 0.45)
    }

    // Start: a wide view of the market street, nothing highlighted, nothing celebrating yet.
    tl.set(cam, { ...WIDE_IN })
    tl.set('.ch6-hi', { opacity: 0 })
    tl.set('.ch6-done', { opacity: 0 })
    tl.set('.ch6-live', { opacity: 1 })
    tl.set('.ch6-board', { opacity: 1 })
    PUZZLES.forEach((_, k) => tl.set(`.ch6-ans-${k}`, { opacity: 0, y: 0, scale: 1, svgOrigin: `800 ${EQ.y}` }))
    tl.set('.ch6-amb', { opacity: 0.5 })
    tl.set('.ch6-boss', { opacity: 0 })
    tl.set('.ch6-wash', { opacity: 0.35 })
    tl.set('.ch6-dm', { opacity: 0, scale: 0, x: 0, y: 0, svgOrigin: '0 0' })
    tl.set('.ch6-flash', { opacity: 0 })
    tl.set('.ch6-flash-ring', { scale: 0.3, svgOrigin: `${PIVOT.x} ${PIVOT.y}` })
    tl.set('.ch6-sl', { opacity: 0, x: 0, y: 0 })
    tl.set(['.ch6-fwt', '.ch6-fwf', '.ch6-fwr', '.ch6-fwd'], { opacity: 0 })
    FIREWORKS.forEach((f, i) => {
      tl.set(`.ch6-fwr-${i}`, { scale: 0.15, svgOrigin: `${f.x} ${f.y}` })
      tl.set(`.ch6-fwd-${i}`, { scale: 0.2, y: 0, svgOrigin: `${f.x} ${f.y}` })
    })

    // 0. Wide on all three scales. The light finds each scale, then each scale's sacks, then the camera glides to the first.
    tl.addLabel('b0', 0)
    move(0, 4.6, { cy: WIDE.cy, lz: WIDE.lz }, 'sine.inOut')
    ;[0, 1, 2].forEach((k) => pulse(`.ch6-hi-scale-${k}`, 1.8 + k * 0.3, 1.5, 0.9))
    ;[0, 1, 2].forEach((k) => pulse(`.ch6-hi-l-${k}`, 3.2 + k * 0.3, 1.4))
    pulse('.ch6-hi-r-2', 3.95, 1.4)
    move(4.6, 2.9, { cx: AT(0).cx, cy: AT(0).cy, lz: 0 }, 'power2.inOut')

    // 1. Puzzle 1. The camera is already here, so the scale is the learner's straight away.
    tl.addLabel('b1', 7.6)
    const b1 = tl.labels.b1
    tl.call(() => setReady(0), undefined, b1 + 0.05)
    pulse('.ch6-hi-l-0', b1 + 0.4, 1.3)
    pulse('.ch6-hi-r-0', b1 + 1.3, 1.3)

    // 2. Walk on to the second scale. It becomes playable the moment the camera stops.
    tl.addLabel('b2', b1 + 2.6)
    const b2 = tl.labels.b2
    settle(0, b2)
    walk(b2 + 0.2, 1)
    pulse('.ch6-hi-l-1', b2 + 1.0, 1.5)
    tl.call(() => setReady(1), undefined, b2 + 2.35)
    pulse('.ch6-hi-r-1', b2 + 2.4, 1.3)

    // 3. The big one: walk on, the lanterns brighten, a drumroll of motes flies into the scale.
    tl.addLabel('b3', b2 + 3.7)
    const b3 = tl.labels.b3
    settle(1, b3)
    walk(b3 + 0.1, 2)
    tl.to('.ch6-amb', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, b3 + 0.8)
    tl.to('.ch6-boss', { opacity: 1, duration: 1.2, ease: 'power2.out' }, b3 + 1.0)
    tl.to('.ch6-wash-2', { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, b3 + 1.0)
    tl.fromTo('.ch6-dm', { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'back.out(3)', stagger: 0.06, ...later }, b3 + 1.2)
    pulse('.ch6-hi-l-2', b3 + 2.3, 1.5)
    pulse('.ch6-hi-r-2', b3 + 2.6, 1.5)
    tl.fromTo('.ch6-dm', { y: 0 }, { y: -14, duration: 0.07, yoyo: true, repeat: 7, ease: 'sine.inOut', stagger: 0.015, ...later }, b3 + 2.2)
    tl.to('.ch6-dm', { x: (i: number) => PIVOT.x - DRUM[i].x, y: (i: number) => PIVOT.y - DRUM[i].y, scale: 0.4, duration: 0.42, ease: 'power3.in', stagger: 0.012 }, b3 + 3.0)
    tl.to('.ch6-dm', { opacity: 0, duration: 0.12 }, b3 + 3.6)
    tl.fromTo('.ch6-flash', { opacity: 0 }, { opacity: 1, duration: 0.1, ...later }, b3 + 3.6)
    tl.fromTo('.ch6-flash-ring', { scale: 0.3 }, { scale: 2.2, duration: 0.8, ease: 'power2.out', ...later }, b3 + 3.6)
    tl.to('.ch6-flash', { opacity: 0, duration: 0.6, ease: 'power1.in' }, b3 + 3.8)
    pulse('.ch6-hi-scale-2', b3 + 3.6, 1.2, 1)

    // 4. Puzzle 3: the boss lights settle down so the scale is the brightest thing again.
    tl.addLabel('b4', b3 + 4.4)
    const b4 = tl.labels.b4
    tl.call(() => setReady(2), undefined, b4 + 0.05)
    tl.to('.ch6-boss', { opacity: 0.55, duration: 1, ease: 'power1.inOut' }, b4 + 0.2)
    tl.to('.ch6-wash-2', { opacity: 0.6, duration: 1, ease: 'power1.inOut' }, b4 + 0.2)

    // 5. Pull back to all three, answers rise, the market celebrates, and the camera tilts up to the stars.
    tl.addLabel('b5', b4 + 1.3)
    const b5 = tl.labels.b5
    settle(2, b5)
    move(b5 + 0.2, 2.4, { cx: WIDE.cx, cy: WIDE.cy, lz: WIDE.lz }, 'power2.inOut')
    PUZZLES.forEach((_, k) => {
      const at = b5 + 1.5 + k * 0.35
      tl.to(`.ch6-board-${k}`, { opacity: 0, duration: 0.4 }, at)
      tl.fromTo(`.ch6-ans-${k}`, { opacity: 0 }, { opacity: 1, duration: 0.3, ...later }, at)
      tl.fromTo(`.ch6-ans-${k}`, { y: 0, scale: 1 }, { y: ANS.y - EQ.y, scale: ANS.scale, duration: 1.1, ease: 'back.out(1.3)', ...later }, at)
    })
    tl.to('.ch6-boss', { opacity: 1, duration: 0.8 }, b5 + 2.4)
    tl.to('.ch6-wash', { opacity: 0.9, duration: 0.8 }, b5 + 2.4)
    SKY_LANTERNS.forEach((l, i) => {
      const at = b5 + 2.4 + l.delay
      tl.fromTo(`.ch6-sl-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.8, ...later }, at)
      tl.fromTo(`.ch6-sl-${i}`, { x: 0, y: 0 }, { x: l.drift, y: -l.rise, duration: l.dur, ease: 'power1.in', ...later }, at)
    })
    FIREWORKS.forEach((f, i) => {
      const at = b5 + f.at
      tl.set(`.ch6-fwt-${i}`, { opacity: 1 }, at)
      tl.fromTo(`.ch6-fwt-${i}`, { strokeDashoffset: 0.18 }, { strokeDashoffset: -0.95, duration: 0.6, ease: 'power2.out', ...later }, at)
      tl.to(`.ch6-fwt-${i}`, { opacity: 0, duration: 0.15 }, at + 0.55)
      const pop = at + 0.6
      tl.fromTo(`.ch6-fwf-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.12, yoyo: true, repeat: 1, repeatDelay: 0.1, ease: 'power1.out', ...later }, pop)
      tl.fromTo(`.ch6-fwr-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.1, ...later }, pop)
      tl.fromTo(`.ch6-fwr-${i}`, { scale: 0.15 }, { scale: 1, duration: 0.9, ease: 'power3.out', ...later }, pop)
      tl.to(`.ch6-fwr-${i}`, { opacity: 0, duration: 0.6, ease: 'power1.in' }, pop + 0.5)
      tl.fromTo(`.ch6-fwd-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.1, ...later }, pop + 0.05)
      tl.fromTo(`.ch6-fwd-${i}`, { scale: 0.2 }, { scale: 1.12, duration: 1.1, ease: 'power3.out', ...later }, pop + 0.05)
      tl.fromTo(`.ch6-fwd-${i}`, { y: 0 }, { y: 60, duration: 1.6, ease: 'power1.in', ...later }, pop + 0.3)
      tl.to(`.ch6-fwd-${i}`, { opacity: 0, duration: 0.8, ease: 'power1.in' }, pop + 0.9)
    })
    move(b5 + 4.8, 3.4, { cy: STARS_CAM.cy, lz: STARS_CAM.lz }, 'power2.inOut')
    tl.addLabel('b6', b5 + 8.4)

    apply()
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  // A little burst of light from a scale the moment it is solved.
  useLayoutEffect(() => {
    if (burst < 0) return
    const ctx = gsap.context(() => {
      const t = gsap.timeline()
      t.fromTo(`.ch6-burst-${burst}`, { opacity: 1 }, { opacity: 0, duration: 0.6, delay: 0.9, ease: 'power1.in' }, 0)
      t.fromTo(`.ch6-burst-${burst} .ch6-bring`, { scale: 0.3, svgOrigin: `${PIVOT.x} ${PIVOT.y}` }, { scale: 1.9, duration: 1.3, ease: 'power2.out' }, 0)
      t.fromTo(
        `.ch6-burst-${burst} .ch6-spark`,
        { x: 0, y: 0, scale: 0.3, svgOrigin: '0 0' },
        { x: (i: number) => Math.cos((i / 12) * Math.PI * 2) * 260, y: (i: number) => Math.sin((i / 12) * Math.PI * 2) * 200, scale: 1, duration: 1.1, ease: 'power3.out' },
        0,
      )
    }, root)
    return () => ctx.revert()
  }, [burst])

  // Timers belong to the cue they were started in.
  useEffect(() => () => window.clearTimeout(tipTimer.current), [cueIndex])
  useEffect(() => () => window.clearTimeout(cheerTimer.current), [])

  // What Pip sees, and hints for the learner's turns.
  useEffect(() => {
    const k = PUZZLES.findIndex((p) => p.cue === cueIndex)
    if (k < 0) {
      reportState(STATE[cueIndex] ?? '')
      return
    }
    const p = PUZZLES[k]
    const b = now[k]
    reportState(
      `The balance challenge, a game at the night market. ${p.setup} The sack's hidden weight, the correct answer: x = ${p.value}. ` +
        `The learner takes things off either pan (drag away, or tap; they go to the tray on that side), can put them back, and can drag the glowing line down to split both sides into equal parts when only sacks are on one side and only weights on the other. ` +
        `${ready >= k ? 'The scale is playable now.' : 'The camera is still arriving at the scale.'} ` +
        `Right now: left pan ${sideWords(b.left)}, right pan ${sideWords(b.right)}, ${isLevel(b, p.value) ? 'level' : 'tipped'} (${equationText(b, p.value)}). ` +
        `${solved[k] ? 'Solved: one sack is alone and the scale is level.' : `One way to solve it: ${p.method}`} Likely mix-up: ${p.mixup}`,
    )
    setHints(p.hints)
  }, [cueIndex, now, solved, ready, reportState, setHints])

  const feedback = (k: number, kind: FeedbackKind) => {
    const done = said.current[k]
    if (done.length >= 2 || done.includes(kind)) return
    done.push(kind)
    void say(FEEDBACK[kind])
  }

  const onMove = (k: number) => (b: Balance, m: Move) => {
    if (solvedRef.current[k]) return
    const p = PUZZLES[k]
    setNow((n) => n.map((x, i) => (i === k ? b : x)))
    window.clearTimeout(tipTimer.current)
    if (m.kind === 'split-blocked') {
      const why: FeedbackKind = m.reason === 'tipped' ? 'splitTipped' : notReady(b)
      emit({ type: 'attempt', correct: false, detail: `scale ${k + 1}: tried to split ${equationText(b, p.value)}, but ${m.reason === 'tipped' ? 'the scale was tipped' : 'it was not only sacks on one side and only weights on the other'}` })
      feedback(k, why)
      return
    }
    emit({ type: 'progress', detail: `scale ${k + 1}: ${moveWords(m)}, now ${equationText(b, p.value)}` })
    if (!isLevel(b, p.value)) {
      // Tipping is often just the middle of a good move, so only speak up if it stays tipped.
      tipTimer.current = window.setTimeout(() => {
        emit({ type: 'attempt', correct: false, detail: `scale ${k + 1}: left the scale tipped at ${equationText(b, p.value)}` })
        feedback(k, 'tipped')
      }, 2600)
    }
  }

  const onSolved = (k: number) => (b: Balance) => {
    if (solvedRef.current[k]) return
    solvedRef.current[k] = true
    window.clearTimeout(tipTimer.current)
    setNow((n) => n.map((x, i) => (i === k ? b : x)))
    setSolved((s) => s.map((x, i) => (i === k ? b : x)))
    setBurst(k)
    setCheer(true)
    window.clearTimeout(cheerTimer.current)
    cheerTimer.current = window.setTimeout(() => setCheer(false), 3400)
    emit({ type: 'attempt', correct: true, detail: `scale ${k + 1}: got one sack alone and level, x = ${PUZZLES[k].value}` })
    void say(PUZZLES[k].done)
    onPlayDone()
  }

  const station = (k: number) => {
    const p = PUZZLES[k]
    const K = p.cue
    // The playable scale lives until its solved copy has faded in over it.
    const liveOn = mountCue <= K && cueIndex <= K + 1
    const near = cueIndex >= K && cueIndex <= K + 1
    const traysOn = (near || (k === 0 && cueIndex === 0)) && cueIndex <= K + 1
    const doneOn = cueIndex > K
    const final = solved[k] ?? p.solved
    const lit = cueIndex > K || !!solved[k]
    const myTurn = cueIndex === K && ready >= k && !solved[k]
    return (
      <g key={k} transform={`translate(${k * D} 0)`}>
        {/* warm pool of light around the table */}
        <g className={`ch6-wash ch6-wash-${k}`} opacity={0.35}>
          <Glow x={800} y={BASE - 60} r={560} color="warm" opacity={0.45} />
        </g>
        <ellipse cx={800} cy={812} rx={560} ry={60} fill={N.sandLight} opacity={0.07} />

        {/* the two lanterns over this table: dark until its scale is solved */}
        {LAMPS.map((lx, i) => (
          <g key={lx} transform={`translate(${lx} ${ropeY(lx + k * D)})`}>
            <g className="sway" style={{ animationDelay: `${-(k * 1.3 + i * 0.8)}s` }}>
              <DarkLantern y={62} rope={62} s={1.15} />
              <g style={{ opacity: lit ? 1 : 0, transition: 'opacity 1.2s ease' }}>
                <Lantern y={62} rope={62} s={1.15} color={N.sand} />
                <Glow y={62} r={150} color="warm" opacity={0.55} />
              </g>
            </g>
          </g>
        ))}

        <Barrel x={800 - 600 * S} />
        <Barrel x={800 + 600 * S} />
        <Table />

        {/* highlights that the timeline brings up at the moment they are said */}
        <g className={`ch6-hi ch6-hi-scale-${k}`} opacity={0}>
          <Glow x={800} y={BASE - 250} r={400} color="teal" opacity={0.75} />
        </g>
        <g className={`ch6-hi ch6-hi-l-${k}`} opacity={0}>
          <Glow x={PAN.l} y={PAN.y} r={170} color="pink" />
        </g>
        <g className={`ch6-hi ch6-hi-r-${k}`} opacity={0}>
          <Glow x={PAN.r} y={PAN.y} r={170} color={(k === 2 ? 'pink' : 'warm') as GlowColor} />
        </g>

        <g className={`ch6-live ch6-live-${k}`}>
          {liveOn && (
            <BalancePlay
              key={`p${k}`}
              x={800}
              y={BASE}
              s={S}
              value={p.value}
              start={p.start}
              active={myTurn}
              canSplit={near}
              trays={traysOn}
              equation={near ? EQ : undefined}
              glow
              tutor={p.tutor}
              onMove={onMove(k)}
              onSolved={onSolved(k)}
            />
          )}
          {cueIndex < K && <Equation terms={terms(equationText(p.start, p.value))} x={800} y={EQ.y} size={EQ.size} />}
        </g>
        <g className={`ch6-done ch6-done-${k}`} opacity={0}>
          {doneOn && <BalancePlay key={`done${k}`} x={800} y={BASE} s={S} value={p.value} start={final} active={false} trays={false} glow tutor={p.tutor} />}
          <g className={`ch6-board ch6-board-${k}`}>{doneOn && <Equation terms={terms(equationText(final, p.value))} x={800} y={EQ.y} size={EQ.size} />}</g>
        </g>

        {/* the answer, which rises out of the table cloth at the end */}
        <g className={`ch6-ans ch6-ans-${k}`} opacity={0} pointerEvents="none">
          <Glow x={800} y={EQ.y} r={190} color="cool" opacity={0.7} />
          <Equation terms={terms(p.answer)} x={800} y={EQ.y} size={EQ.size} tutor={k === 0 ? 'the answers' : undefined} />
        </g>

        {/* solved! a ring of balance and sparks */}
        <g className={`ch6-burst-${k}`} opacity={0} pointerEvents="none">
          <g className="ch6-bring">
            <circle cx={PIVOT.x} cy={PIVOT.y} r={150} fill="none" stroke={N.tealLight} strokeWidth={8} opacity={0.9} />
            <Glow x={PIVOT.x} y={PIVOT.y} r={220} color="teal" opacity={0.6} />
          </g>
          <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
            {Array.from({ length: 12 }, (_, i) => (
              <g key={i} className="ch6-spark">
                <circle r={18} fill={N.cream} opacity={0.25} />
                <path d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill={N.white} />
              </g>
            ))}
          </g>
        </g>

        {k === 2 && (
          <g pointerEvents="none">
            {DRUM.map((m, i) => (
              <g key={i} transform={`translate(${m.x} ${m.y})`}>
                <g className="ch6-dm" opacity={0}>
                  <Glow r={34} color="cool" opacity={0.9} />
                  <path d="M0 -15 L3.5 -3.5 L15 0 L3.5 3.5 L0 15 L-3.5 3.5 L-15 0 L-3.5 -3.5 Z" fill={N.skyLight} />
                  <circle r={4} fill={N.white} />
                </g>
              </g>
            ))}
            <g className="ch6-flash" opacity={0}>
              <Glow x={PIVOT.x} y={PIVOT.y} r={300} color="warm" opacity={0.9} />
              <g className="ch6-flash-ring">
                <circle cx={PIVOT.x} cy={PIVOT.y} r={150} fill="none" stroke={N.white} strokeWidth={7} />
              </g>
            </g>
          </g>
        )}
      </g>
    )
  }

  const layla = cheer || cueIndex === 5 ? 'cheer' : cueIndex === 0 ? 'wave' : 'down'
  const customer = cheer || cueIndex === 5 ? 'cheer' : cueIndex === 0 ? 'wave' : cueIndex === 3 ? 'point' : 'down'

  return (
    <g ref={root}>
      {/* Sky: barely moves, so the market slides across it */}
      <g className="ch6-L ch6-L-sky">
        <rect x={-500} y={-700} width={3400} height={2000} fill="url(#fx-sky-night)" />
        <circle cx={300} cy={60} r={520} fill={N.violet} opacity={0.12} filter="url(#fx-blur-big)" />
        <circle cx={1700} cy={-100} r={600} fill={N.sky} opacity={0.08} filter="url(#fx-blur-big)" />
        <circle cx={1000} cy={-420} r={500} fill={N.violetDark} opacity={0.14} filter="url(#fx-blur-big)" />
        <g transform="translate(-400 -660)">
          <Stars w={3200} h={1280} count={300} seed={61} />
        </g>
        <Moon x={380} y={110} r={46} />
      </g>

      {/* Far rooftops of Baghdad */}
      <g className="ch6-L ch6-L-far">
        <Skyline y={600} seed={9} color={N.night2} scale={1.35} windows={0.16} windowColor={N.sandLight} width={3900} x={-650} />
      </g>

      {/* The back row of the market */}
      <g className="ch6-L ch6-L-mid">
        <BackMarket />
      </g>

      {/* The street with the three scales */}
      <g className="ch6-L ch6-L-sub">
        <Floor />
        <g pointerEvents="none">
          {FIREWORKS.map((f, i) => (
            <Firework key={i} i={i} {...f} />
          ))}
          {SKY_LANTERNS.map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) scale(${l.s})`}>
              <g className={`ch6-sl ch6-sl-${i}`} opacity={0}>
                <g className="float" style={{ animationDelay: `${-i * 0.7}s` }}>
                  <SkyLantern />
                </g>
              </g>
            </g>
          ))}
        </g>

        {/* posts and the garland of lights */}
        <g pointerEvents="none">
          {POSTS.map((x) => (
            <Post key={x} x={x} />
          ))}
          {POSTS.slice(0, -1).map((x) => (
            <path key={x} d={`M${x} ${ROPE.top} Q${x + D / 2} ${ROPE.top + ROPE.sag} ${x + D} ${ROPE.top}`} stroke={N.night0} strokeWidth={4} fill="none" />
          ))}
          <g className="ch6-amb" opacity={0.5}>
            {POSTS.slice(0, -1).flatMap((x) =>
              Array.from({ length: 19 }, (_, i) => {
                const bx = x + ((i + 1) / 20) * D
                return <circle key={`${x}-${i}`} cx={bx} cy={ropeY(bx) + 8} r={26} fill={N.cream} opacity={0.18} />
              }),
            )}
            {POSTS.map((x) => (
              <Glow key={x} x={x + 52} y={330} r={170} color="warm" opacity={0.6} />
            ))}
          </g>
          {POSTS.slice(0, -1).flatMap((x) =>
            Array.from({ length: 19 }, (_, i) => {
              const bx = x + ((i + 1) / 20) * D
              return <circle key={`${x}-${i}`} cx={bx} cy={ropeY(bx) + 8} r={6} fill={N.cream} />
            }),
          )}
          {/* extra lanterns for the big one */}
          <g className="ch6-boss" opacity={0}>
            <Glow x={800 + 2 * D} y={BASE - 120} r={700} color="warm" opacity={0.35} />
            {[280, 640, 960, 1320].map((lx, i) => (
              <g key={lx} transform={`translate(${lx + 2 * D} ${ropeY(lx + 2 * D)})`}>
                <g className="sway" style={{ animationDelay: `${-i * 0.9}s` }}>
                  <Lantern y={44} rope={44} s={0.85} color={i % 2 ? N.cream : N.sand} />
                </g>
              </g>
            ))}
          </g>
        </g>

        {/* the three tables, nearest-in-time first so Pip finds the current scale's parts first */}
        {[2, 1, 0].map(station)}

        {/* the onlookers */}
        <g pointerEvents="none">
          <g className="breathe">
            <Layla x={1440} y={812} s={0.85} flip pose={layla} face={cheer || cueIndex === 5 ? 'wow' : 'smile'} />
          </g>
          <g className="breathe" style={{ animationDelay: '-1.4s' }}>
            <Customer x={2960} y={812} s={0.85} pose={customer} face={cheer || cueIndex === 5 || cueIndex === 3 ? 'wow' : 'smile'} />
          </g>
        </g>

        <Crowd cheer={cueIndex === 5} />

        <g pointerEvents="none" transform="translate(-300 -300)">
          <Motes w={4800} h={1100} count={60} seed={23} color={N.cream} />
        </g>
      </g>

      {/* Right in front of the lens: dark, soft shapes that slide past faster than everything else */}
      <g className="ch6-L ch6-L-fg" pointerEvents="none">
        <g filter="url(#fx-soft)">
          {[0, 1, 2].map((k) => (
            <g key={k} transform={`translate(${1.3 * k * D} 0)`}>
              <rect x={-170} y={905} width={360} height={900} rx={18} fill={N.shadow} />
              <Jar x={40} y={915} s={1.5} />
              <rect x={1430} y={905} width={360} height={900} rx={18} fill={N.shadow} />
              <Basket x={1600} y={915} s={1.4} />
              <path d={`M-260 -30 Q520 110 1860 -30`} stroke={N.night0} strokeWidth={6} fill="none" />
              {Array.from({ length: 11 }, (_, i) => {
                const t = (i + 0.5) / 11
                const bx = -260 + t * 2120
                const by = -30 + 2 * t * (1 - t) * 140
                return <path key={i} d={`M${bx - 26} ${by} L${bx + 26} ${by} L${bx} ${by + 50} Z`} fill={i % 2 ? N.violetDark : N.night2} />
              })}
            </g>
          ))}
        </g>
      </g>

      <Vignette />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Local art                                                            */
/* ------------------------------------------------------------------ */

/** A lantern hanging dark, before its scale is solved. Same shape as the kit's Lantern. */
function DarkLantern({ y = 0, s = 1, rope = 60 }: { y?: number; s?: number; rope?: number }) {
  return (
    <g transform={`translate(0 ${y}) scale(${s})`}>
      <line x1={0} y1={-rope} x2={0} y2={-24} stroke={N.night0} strokeWidth={3} />
      <path d="M-10 -26 H10 L14 -16 H-14 Z" fill={N.stoneDark} />
      <path d="M-14 -16 Q-22 6 -12 22 H12 Q22 6 14 -16 Z" fill={N.night3} />
      <path d="M2 -16 Q8 6 4 22 H12 Q22 6 14 -16 Z" fill={N.night1} opacity={0.6} />
      <path d="M-12 22 H12 L8 30 H-8 Z" fill={N.stoneDark} />
    </g>
  )
}

/** A wooden barrel standing on the street, its lid where a scale's tray rests. */
function Barrel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <ellipse cy={822} rx={92} ry={15} fill={N.shadow} opacity={0.5} />
      <path d="M-70 614 Q-86 717 -70 820 H70 Q86 717 70 614 Z" fill={N.wood} />
      <path d="M24 614 H70 Q86 717 70 820 H30 Q46 717 24 614 Z" fill={N.woodDark} opacity={0.75} />
      <path d="M-54 624 Q-66 717 -54 810" stroke={N.woodLight} strokeWidth={7} fill="none" opacity={0.45} strokeLinecap="round" />
      {[648, 782].map((hy) => (
        <path key={hy} d={`M${-78} ${hy} Q0 ${hy + 10} 78 ${hy} V${hy + 12} Q0 ${hy + 22} -78 ${hy + 12} Z`} fill={N.stoneDark} />
      ))}
      <ellipse cy={614} rx={70} ry={11} fill={N.woodLight} />
      <ellipse cy={615} rx={56} ry={7} fill={N.wood} />
    </g>
  )
}

/** The little table under each scale, with a cloth hanging in front for the equation. */
function Table() {
  const scallops = Array.from({ length: 8 }, (_, i) => 1064 - i * 66)
  return (
    <g>
      <ellipse cx={800} cy={826} rx={330} ry={26} fill={N.shadow} opacity={0.5} />
      <path d="M566 620 L548 822 H576 L590 620 Z" fill={N.woodDark} />
      <path d="M1034 620 L1052 822 H1024 L1010 620 Z" fill={N.woodDark} />
      <rect x={516} y={598} width={568} height={26} rx={9} fill={N.woodLight} />
      <rect x={516} y={614} width={568} height={10} rx={5} fill={N.woodDark} opacity={0.5} />
      <path d={`M536 622 H1064 V732 ${scallops.map((x) => `Q${x - 33} 760 ${x - 66} 732`).join(' ')} Z`} fill={N.night2} />
      <path d={`M536 716 H1064 V732 ${scallops.map((x) => `Q${x - 33} 760 ${x - 66} 732`).join(' ')} Z`} fill={N.violetDark} opacity={0.75} />
      <rect x={536} y={622} width={528} height={10} fill={N.night1} opacity={0.6} />
      {scallops.map((x) => (
        <circle key={x} cx={x - 33} cy={752} r={6} fill={N.stoneLight} opacity={0.8} />
      ))}
    </g>
  )
}

/** The street: dark cobbles, lighter towards the front. */
function Floor() {
  const r = rng(5)
  const rows = [
    { y: 712, h: 10, w: 70 },
    { y: 728, h: 14, w: 90 },
    { y: 750, h: 18, w: 110 },
    { y: 778, h: 22, w: 130 },
    { y: 812, h: 28, w: 150 },
    { y: 852, h: 34, w: 170 },
    { y: 900, h: 40, w: 190 },
    { y: 954, h: 46, w: 210 },
  ]
  return (
    <g pointerEvents="none">
      <rect x={-2600} y={700} width={9600} height={2200} fill={N.night1} />
      <rect x={-2600} y={700} width={9600} height={14} fill={N.night0} opacity={0.6} />
      {rows.map((row, j) => {
        const stones: { x: number; w: number }[] = []
        let x = -1400 + r() * row.w
        while (x < 5900) {
          const w = row.w * (0.7 + r() * 0.5)
          stones.push({ x, w })
          x += w + 8 + j * 1.5
        }
        return (
          <g key={j} opacity={0.32 + j * 0.05}>
            {stones.map((s, i) => (
              <rect key={i} x={s.x} y={row.y} width={s.w} height={row.h} rx={row.h / 2.4} fill={N.night2} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** The back row of the market: stalls with awnings and warm doorways, softened by haze. */
function BackMarket() {
  const r = rng(44)
  const awnings = [N.violetDark, N.skyDark, N.stoneDark, N.leafDark, N.sandDark, N.dusk]
  const stalls = Array.from({ length: 13 }, (_, i) => ({ x: -620 + i * 420, w: 340, c: awnings[i % awnings.length], h: 250 + r() * 50, lamp: r() > 0.35 }))
  return (
    <g pointerEvents="none">
      <rect x={-900} y={740} width={6600} height={1000} fill={N.night0} />
      {stalls.map((s, i) => {
        const top = 760 - s.h
        const mid = s.x + s.w / 2
        const sw = s.w / 6
        return (
          <g key={i}>
            <rect x={s.x + s.w} y={top - 20} width={80} height={s.h + 60} fill={N.night3} />
            <path d={`M${s.x + s.w - 6} ${top - 20} Q${s.x + s.w + 40} ${top - 86} ${s.x + s.w + 86} ${top - 20} Z`} fill={N.night3} />
            <rect x={s.x} y={top} width={s.w} height={s.h} fill={N.night2} />
            <Glow x={mid} y={top + s.h - 80} r={150} color="warm" opacity={0.4} />
            <path d={`M${mid - 70} 760 V${top + 120} A70 70 0 0 1 ${mid + 70} ${top + 120} V760 Z`} fill={N.night0} />
            <path d={`M${mid - 56} 760 V${top + 126} A56 56 0 0 1 ${mid + 56} ${top + 126} V760 Z`} fill={N.sandDark} opacity={0.45} />
            {[-1, 1].map((side) => (
              <g key={side}>
                <rect x={mid + side * 120 - 34} y={top + 120} width={68} height={8} fill={N.night3} />
                <ellipse cx={mid + side * 120 - 12} cy={top + 108} rx={16} ry={14} fill={N.night3} />
                <ellipse cx={mid + side * 120 + 14} cy={top + 110} rx={12} ry={11} fill={N.night3} />
              </g>
            ))}
            {Array.from({ length: 6 }, (_, j) => (
              <path key={j} d={`M${s.x + j * sw} ${top - 24} h${sw} v42 q${-sw / 2} 18 ${-sw} 0 Z`} fill={j % 2 ? N.stone : s.c} opacity={0.85} />
            ))}
            <rect x={s.x - 8} y={top - 34} width={s.w + 16} height={14} rx={5} fill={N.night3} />
            {s.lamp && (
              <g transform={`translate(${s.x + 40} ${top + 40})`}>
                <g className="sway" style={{ animationDelay: `${-i * 0.6}s` }}>
                  <Lantern rope={30} s={0.6} color={N.sand} />
                </g>
              </g>
            )}
          </g>
        )
      })}
      <rect x={-900} y={300} width={6600} height={1100} fill={N.night1} opacity={0.38} />
    </g>
  )
}

/** A tall lantern post between two tables. */
function Post({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 11} y={ROPE.top - 30} width={22} height={850 - ROPE.top} fill={N.woodDark} />
      <rect x={x - 11} y={ROPE.top - 30} width={7} height={850 - ROPE.top} fill={N.wood} opacity={0.6} />
      <circle cx={x} cy={ROPE.top - 34} r={14} fill={N.woodDark} />
      <ellipse cx={x} cy={822} rx={44} ry={9} fill={N.shadow} opacity={0.45} />
      <path d={`M${x} 262 H${x + 54} V272 H${x} Z`} fill={N.woodDark} />
      <g transform={`translate(${x + 52} 272)`}>
        <g className="sway" style={{ animationDelay: `${-x / 700}s` }}>
          <Lantern y={58} rope={58} s={1} color={N.cream} />
        </g>
      </g>
    </g>
  )
}

/** A paper sky lantern, about 50 wide. */
function SkyLantern() {
  return (
    <g>
      <Glow y={-6} r={70} color="warm" opacity={0.75} />
      <path d="M-24 -40 Q0 -50 24 -40 L18 26 H-18 Z" fill={N.cream} />
      <path d="M6 -46 Q18 -44 24 -40 L18 26 H6 Z" fill={N.sandLight} opacity={0.85} />
      <rect x={-19} y={22} width={38} height={6} rx={3} fill={N.sandDark} />
      <circle cy={14} r={7} fill={N.white} />
    </g>
  )
}

/** A burst of light in the sky: a rising trail, a flash, rays and drifting sparks. */
function Firework({ i, x, y, r, c }: { i: number; x: number; y: number; r: number; c: string }) {
  const rays = 18
  return (
    <g>
      <path className={`ch6-fwt ch6-fwt-${i}`} d={`M${x - 70} ${y + 640} Q${x - 20} ${y + 300} ${x} ${y}`} pathLength={1} strokeDasharray="0.18 1.2" strokeDashoffset={0.18} stroke={N.cream} strokeWidth={7} strokeLinecap="round" fill="none" opacity={0} />
      <g className={`ch6-fwf ch6-fwf-${i}`} opacity={0}>
        <Glow x={x} y={y} r={r * 1.5} color="cool" />
      </g>
      <g className={`ch6-fwr ch6-fwr-${i}`} opacity={0}>
        {Array.from({ length: rays }, (_, j) => {
          const a = (j / rays) * Math.PI * 2 + i
          const len = j % 2 ? 0.7 : 1
          return (
            <g key={j}>
              <line x1={x + Math.cos(a) * r * 0.28} y1={y + Math.sin(a) * r * 0.28} x2={x + Math.cos(a) * r * len} y2={y + Math.sin(a) * r * len} stroke={c} strokeWidth={j % 2 ? 5 : 7} strokeLinecap="round" opacity={j % 2 ? 0.75 : 1} />
              <circle cx={x + Math.cos(a) * r * len} cy={y + Math.sin(a) * r * len} r={j % 2 ? 5 : 7} fill={N.white} />
            </g>
          )
        })}
        <circle cx={x} cy={y} r={r * 0.14} fill={N.white} opacity={0.85} />
      </g>
      <g className={`ch6-fwd ch6-fwd-${i}`} opacity={0}>
        {Array.from({ length: rays }, (_, j) => {
          const a = ((j + 0.5) / rays) * Math.PI * 2 + i
          return (
            <g key={j}>
              <circle cx={x + Math.cos(a) * r * 1.12} cy={y + Math.sin(a) * r * 1.12} r={18} fill={c} opacity={0.3} />
              <circle cx={x + Math.cos(a) * r * 1.12} cy={y + Math.sin(a) * r * 1.12} r={7} fill={N.white} />
            </g>
          )
        })}
      </g>
    </g>
  )
}

/** A row of market-goers seen from behind, in front of the tables: only the wide shots show them. */
function Crowd({ cheer }: { cheer: boolean }) {
  const r = rng(808)
  const people = Array.from({ length: 30 }, (_, i) => ({ x: 120 + i * 142 + r() * 60, s: 0.95 + r() * 0.35, y: 1200 + r() * 40, up: r() > 0.35, d: r() }))
  return (
    <g pointerEvents="none">
      {people.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          <g className="float" style={{ animationDelay: `${-p.d * 5}s`, animationDuration: `${cheer ? 0.9 + p.d * 0.5 : 4 + p.d * 2}s` }}>
            {cheer && p.up && (
              <g stroke={N.night0} strokeWidth={22} strokeLinecap="round" fill="none">
                <path d="M-40 -150 Q-62 -200 -56 -250" />
                <path d="M40 -150 Q62 -200 56 -250" />
              </g>
            )}
            <path d="M-70 0 Q-74 -130 -40 -150 Q0 -160 40 -150 Q74 -130 70 0 Z" fill={N.night0} />
            <circle cy={-190} r={44} fill={N.night0} />
            <path d="M-40 -212 Q-20 -236 12 -232" stroke={N.night3} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
          </g>
        </g>
      ))}
    </g>
  )
}

/** A big clay jar in silhouette, right by the lens. */
function Jar({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-30 -150 H30 V-136 Q70 -110 70 -60 Q70 0 0 0 Q-70 0 -70 -60 Q-70 -110 -30 -136 Z" fill={N.shadow} />
      <rect x={-36} y={-160} width={72} height={14} rx={6} fill={N.shadow} />
    </g>
  )
}

/** A woven basket in silhouette, right by the lens. */
function Basket({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-90 -90 H90 L70 0 H-70 Z" fill={N.shadow} />
      <path d="M-70 -90 Q0 -170 70 -90" stroke={N.shadow} strokeWidth={10} fill="none" />
    </g>
  )
}

export const ch6: Chapter = {
  id: 'challenge',
  title: 'The balance challenge',
  cues: CUES,
  Scene: Ch6Challenge,
  enter: { type: 'zoom', x: 800, y: 450 },
}
