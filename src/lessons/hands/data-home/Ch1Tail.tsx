import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rng } from '../../../art2/fx'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, FiveMap, Label, Letterbox, Pool, Slider, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { ForeShelf, LabFloor, LabSky, LabWall, Workbench } from '../shared/sets'
import { Cat, FactoryLine, HomeSky, HouseIcon, KitchenWall, MiniKitchen, MoonStripes, Pan, PowerText, RingToy } from './props'
import { LongTailReading } from './readings'

export const CUES: Cue[] = [
  { id: 'house', say: 'Two in the morning, again. But this time, the robot is in someone’s home.' },
  { id: 'every', say: 'Every home is different. Different layouts, cupboards, light switches, clutter, pets and children. A factory can be rearranged to suit a robot. A home can’t.' },
  { id: 'tail', say: 'Engineers call it the long tail: a few things happen all the time, and thousands of things happen rarely. And rare things are where robots fail.' },
  { id: 'chain', say: 'And chores are long. Loading a dishwasher is dozens of steps. If each step works ninety-nine percent of the time, a twenty-step chore still fails about one time in five.' },
  { id: 'steps', say: 'Set how reliable each step is, and how long the chore is. How good does each step need to be for the whole chore to work nine times out of ten?', play: true },
  { id: 'safe', say: 'And failure in a home costs more. A dropped box in a warehouse is a retry. A dropped pan near a child is not.' },
]

const STATE = [
  'The film opens on the five-question map with the lime "Brain" ring glowing, then flies into the dark robotics lab from film 1 (rain on tall windows, Seven the white humanoid standing alone). The lab dissolves into a dark home kitchen at two in the morning: moonlight falls through window blinds in stripes across the floor and across Seven, a clock reads 2:00, the fridge light blinks, and a black cat sits on the kitchen island watching Seven with glowing eyes and a swishing tail. The camera pushes in slowly.',
  'A fast montage: the camera whip-pans through ten different kitchens, each with a different layout, colours, cupboard handles, light switches and clutter: one has a dog, one has toddler toys on the floor, one has a sock under a chair, one has laundry, one a cat. Then a calm factory line under cool light: identical boxes on a belt, identical gold robot arms evenly spaced. The point: a factory can be arranged around a robot; a home cannot.',
  'A blueprint chart grows: lime bars of how often things happen in a home. Tall bars on the left are labelled "cups, plates, doors". The camera dollies right along a tail of ever smaller bars that never seems to end, with rare items labelled: "a sticky jar", "a toy stuck in the dishwasher", "a cat on the laundry". Red crosses pop over the tail bars: rare things are where robots fail.',
  'A chain of 20 lime links across the screen, one link per step of loading a dishwasher (from "open the door" to "close it"), each marked 99%. A pulse of light runs along the chain five times; each run lights a little house below lime for success. On the fourth run link 13 snaps red and that house goes red. The formula appears: 0.99 to the power 20 is about 82%. The point: per-step reliability compounds over a long chore.',
  '',
  'A slow-motion close-up on a kitchen counter: a white robot hand holds a frying pan by the handle, steam rising. The handle slides through its fingers and the pan tips toward the counter edge. Blurred in the background, on the floor below the edge, a toddler\'s stacking-ring toy. The frame freezes just before the pan falls, with a red glow, then cuts to black. The point: in a home, failure can hurt people, so the reliability bar is far higher.',
]

/* ---------------- the world ---------------- */

const SEVEN = { x: 520, y: 800, s: 1.05 }
const ISLAND = { x: 1040, y: 640 }

/* the long tail */
const BARS = 160
const BAR_W = 34
const BAR_STEP = 44
const BAR_X0 = 160
const BASE_Y = 760
const barH = (i: number) => Math.max(5, 540 * Math.pow(i + 1, -0.9))
const barX = (i: number) => BAR_X0 + i * BAR_STEP
const TAIL_ITEMS: { i: number; text: string; ly: number }[] = [
  { i: 22, text: 'a sticky jar', ly: 520 },
  { i: 48, text: 'a toy stuck in the dishwasher', ly: 470 },
  { i: 80, text: 'a cat on the laundry', ly: 520 },
]

/* the chain */
const LINKS = 20
const CH_Y = 250
const CH_X0 = 182
const CH_STEP = 65
const linkX = (i: number) => CH_X0 + i * CH_STEP
const BREAK = 13
const RUNS = 5
const FAIL_RUN = 3
const RUN_HOUSE = (k: number) => ({ x: 800 + (k - 2) * 90, y: 690 })

/* the play */
const HOUSES = 20
const houseX = (i: number) => 230 + i * 60
const HOUSE_Y = 630
/** Which houses fail first as the whole-chore success drops: a fixed shuffle, so the row reads steadily. */
const ORDER = (() => {
  const r = rng(77)
  const a = Array.from({ length: HOUSES }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  const rank: number[] = []
  a.forEach((h, k) => (rank[h] = k))
  return rank
})()
/** Slider 0..1 to per-step success: equal steps in "nines", 90% to 99.9%. */
const pOf = (t: number) => 1 - Math.pow(10, -1 - 2 * t)
const tOf = (p: number) => (-Math.log10(1 - p) - 1) / 2
const N_MIN = 5
const N_MAX = 80
const PRESETS = [
  { n: 10, text: 'make coffee 10', tutor: 'coffee preset' },
  { n: 60, text: 'load dishwasher 60', tutor: 'dishwasher preset' },
  { n: 80, text: 'full laundry 80', tutor: 'laundry preset' },
]
const pct = (v: number) => (v >= 0.995 ? '99.5' : v < 0.01 ? '<1' : `${Math.round(v * 100)}`)

/** Wall-clock time, for throttling the learner's progress events. */
const clock = () => Date.now()

/* the close-up */
const GRIP = { x: 700, y: 380 }
const EDGE_X = 1110
const TOP_Y = 560

export function Ch1Tail({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const wide = useRef<SVGGElement>(null)
  const tailRef = useRef<SVGGElement>(null)
  const closeRef = useRef<SVGGElement>(null)
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 24, pitch: -12, roll: 0, s: 1.5 } })
  const panHand = useHandStore({ pose: GRASPS.power, view: { yaw: 14, pitch: -14, roll: 180, s: 1.8 } })

  /* the play's state */
  const [t, setT] = useState(0.5)
  const [n, setN] = useState(20)
  const [won, setWon] = useState(false)
  const lastEmit = useRef(0)
  const p = pOf(t)
  const whole = Math.pow(p, n)
  const live = cueIndex === 4
  const lime = Math.round(whole * HOUSES)

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(wide.current, { x: 800, y: 450, zoom: 1 })
      const tcam = camera(tailRef.current, { x: 800, y: 470, zoom: 1 })
      const ccam = camera(closeRef.current, { x: 800, y: 450, zoom: 1.05 })
      const seven = rig(root.current, 'seven', POSES.stand)

      tl.set('.c1-wide', { opacity: 0 }, 0)
      tl.set('.c1-mont, .c1-fact, .c1-tailg, .c1-chaing, .c1-close, .c1-play', { opacity: 0 }, 0)
      tl.set('.c1-black', { opacity: 0 }, 0)

      /* b0: the map, then film 1's lab, then the lab melts into a kitchen at night. */
      tl.addLabel('b0', 0)
      tl.fromTo('.c1-map', { scale: 1, opacity: 1 }, { scale: 2.8, duration: 1.6, ease: 'power2.in', transformOrigin: '50% 50%', immediateRender: false }, 0)
      fade(tl, '.c1-map', 0, 0.8, 0.4, 1)
      fade(tl, '.c1-wide', 1, 0.8, 0.4)
      fade(tl, '.c1-home', 0, 0, 0.01, 0)
      fade(tl, '.c1-lab', 1, 0, 0.01, 1)
      cam.to(tl, { x: 700, y: 520, zoom: 1.12 }, 0.8, 1.6, 'sine.inOut')
      tl.fromTo('.c1-flash', { opacity: 0 }, { opacity: 0.5, duration: 0.06, yoyo: true, repeat: 1, immediateRender: false }, 1.3)
      fade(tl, '.c1-lab', 0, 2.1, 0.9, 1)
      fade(tl, '.c1-home', 1, 2.1, 0.9)
      cam.to(tl, { x: 840, y: 560, zoom: 1.32 }, 2.4, 3.6, 'sine.inOut')
      seven.idle(tl, 0.8, 2)
      seven.to(tl, { head: 12, torso: 2 }, 3.2, 1.0, 'sine.inOut')
      seven.to(tl, { head: 6 }, 4.6, 1.0, 'sine.inOut')
      tl.fromTo('.c1-cateyes', { scaleY: 1 }, { scaleY: 0.1, duration: 0.12, yoyo: true, repeat: 1, transformOrigin: '50% 50%', immediateRender: false }, 4.2)

      /* b1: whip through ten kitchens, then the calm of a factory. */
      const b1 = 6
      tl.addLabel('b1', b1)
      tl.set('.c1-wide', { opacity: 0 }, b1)
      tl.set('.c1-mont', { opacity: 1 }, b1)
      tl.set('.c1-strip', { x: 0 }, b1)
      const HOLD = 0.42
      const WHIP = 0.2
      for (let k = 1; k < 10; k++) {
        const at = b1 + k * (HOLD + WHIP) - WHIP
        tl.fromTo('.c1-strip', { x: -(k - 1) * 1600 }, { x: -k * 1600, duration: WHIP, ease: 'power3.inOut', immediateRender: false }, at)
        tl.fromTo('.c1-streak', { opacity: 0 }, { opacity: 0.8, duration: WHIP / 2, yoyo: true, repeat: 1, immediateRender: false }, at)
      }
      tl.fromTo('.c1-strip', { scale: 1 }, { scale: 1.06, duration: 6.2, ease: 'none', transformOrigin: '50% 50%', immediateRender: false }, b1)
      const bf = b1 + 10 * (HOLD + WHIP)
      tl.fromTo('.c1-streak', { opacity: 0 }, { opacity: 0.9, duration: 0.12, yoyo: true, repeat: 1, immediateRender: false }, bf - 0.12)
      tl.set('.c1-mont', { opacity: 0 }, bf)
      tl.set('.c1-fact', { opacity: 1 }, bf)
      tl.fromTo('.c1-factin', { scale: 1.12 }, { scale: 1, duration: 4.6, ease: 'power2.out', transformOrigin: '50% 60%', immediateRender: false }, bf)
      tl.fromTo('.fl-boxes', { x: 0 }, { x: 160, duration: 4.6, ease: 'none', immediateRender: false }, bf)
      fade(tl, '.c1-lab-fact', 1, bf + 1.0, 0.6)

      /* b2: the long tail. */
      const b2 = b1 + 10.8
      tl.addLabel('b2', b2)
      fade(tl, '.c1-fact', 0, b2, 0.6, 1)
      fade(tl, '.c1-tailg', 1, b2, 0.6)
      tl.fromTo('.c1-bar', { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: 'power3.out', stagger: 0.012, transformOrigin: '50% 100%', immediateRender: false }, b2 + 0.2)
      fade(tl, '.c1-lab-head', 1, b2 + 1.1, 0.6)
      fade(tl, '.c1-axis', 1, b2 + 0.4, 0.6)
      tcam.to(tl, { x: 900, y: 480, zoom: 1.05 }, b2, 2.0)
      tcam.to(tl, { x: 4700, y: 520, zoom: 1.3 }, b2 + 2.1, 8.9, 'power1.inOut')
      TAIL_ITEMS.forEach((_, k) => fade(tl, `.c1-lab-tail${k}`, 1, b2 + 3.0 + k * 2.2, 0.6))
      fade(tl, '.c1-lab-more', 1, b2 + 9.2, 0.8)
      tl.fromTo('.c1-x', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)', stagger: 0.05, transformOrigin: '50% 50%', immediateRender: false }, b2 + 7.8)

      /* b3: a chore is a chain; one weak link and it fails. */
      const b3 = b2 + 11.2
      tl.addLabel('b3', b3)
      fade(tl, '.c1-tailg', 0, b3, 0.6, 1)
      fade(tl, '.c1-chaing', 1, b3, 0.6)
      fade(tl, '.c1-static', 1, b3, 0.01)
      tl.fromTo('.c1-link', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'back.out(2)', immediateRender: false }, b3 + 0.2)
      fade(tl, '.c1-lab-open, .c1-lab-close', 1, b3 + 1.3, 0.5)
      fade(tl, '.c1-runs', 1, b3 + 1.2, 0.5)
      const RUN = 1.85
      const r0 = b3 + 1.6
      for (let k = 0; k < RUNS; k++) {
        const at = r0 + k * RUN
        const last = k === FAIL_RUN ? BREAK : LINKS - 1
        tl.fromTo(`.c1-glow`, { opacity: 0 }, { opacity: 0, duration: 0.01, immediateRender: false }, at)
        for (let i = 0; i <= last; i++) {
          tl.fromTo(`.c1-glow-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.06, yoyo: true, repeat: 1, immediateRender: false }, at + i * 0.065)
        }
        const end = at + last * 0.065 + 0.1
        if (k === FAIL_RUN) {
          tl.fromTo(`.c1-red-${BREAK}`, { opacity: 0 }, { opacity: 1, duration: 0.1, immediateRender: false }, end)
          tl.fromTo(`.c1-lk-${BREAK}`, { y: 0, rotation: 0 }, { y: 70, rotation: 50, duration: 0.5, ease: 'power2.in', svgOrigin: `${linkX(BREAK)} ${CH_Y}`, immediateRender: false }, end + 0.05)
          tl.fromTo(`.c1-lk-${BREAK}`, { y: 70, rotation: 50 }, { y: 0, rotation: 0, duration: 0.3, ease: 'power2.out', svgOrigin: `${linkX(BREAK)} ${CH_Y}`, immediateRender: false }, at + RUN - 0.05)
          tl.fromTo(`.c1-red-${BREAK}`, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, at + RUN - 0.05)
          fade(tl, `.c1-run-red-${k}`, 1, end, 0.2)
        } else {
          fade(tl, `.c1-run-ok-${k}`, 1, end, 0.2)
        }
      }
      tl.fromTo('.c1-pct', { opacity: 0 }, { opacity: 0.85, duration: 0.3, stagger: 0.04, immediateRender: false }, b3 + 4.0)
      fade(tl, '.c1-formula', 1, b3 + 8.8, 0.8)
      tl.fromTo('.c1-formula', { scale: 0.9 }, { scale: 1, duration: 1.2, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, b3 + 8.8)
      tl.to({}, { duration: 0.1 }, b3 + 13.4)

      /* b4: the learner's turn: the same chain, now with dials. */
      const b4 = b3 + 13.5
      tl.addLabel('b4', b4)
      fade(tl, '.c1-static', 0, b4, 0.6, 1)
      fade(tl, '.c1-play', 1, b4 + 0.2, 0.8)
      tl.fromTo('.c1-ctrl', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.12, ease: 'power2.out', immediateRender: false }, b4 + 0.6)
      tl.to({}, { duration: 0.1 }, b4 + 2.4)

      /* b5: slow motion. The pan slips. Freeze. Black. */
      const b5 = b4 + 2.5
      tl.addLabel('b5', b5)
      fade(tl, '.c1-chaing, .c1-play', 0, b5, 0.5, 1)
      fade(tl, '.c1-close', 1, b5 + 0.2, 0.6)
      ccam.to(tl, { x: 840, y: 470, zoom: 1.18 }, b5, 6.4, 'sine.inOut')
      tl.fromTo('.c1-pan', { x: 0, rotation: 0 }, { x: 60, rotation: 4, duration: 2.0, ease: 'sine.in', svgOrigin: `${GRIP.x} ${GRIP.y}`, immediateRender: false }, b5 + 0.8)
      tl.fromTo('.c1-pan', { x: 60, rotation: 4 }, { x: 170, rotation: 21, duration: 2.6, ease: 'none', svgOrigin: `${GRIP.x} ${GRIP.y}`, immediateRender: false }, b5 + 2.8)
      panHand.to(tl, { pose: { ...GRASPS.power, index: [40, 52, 28, 0], middle: [42, 54, 30, 0], ring: [44, 52, 28, 0], little: [46, 50, 26, 2], thumb: [44, 26, 18, 14] }, touch: { index: 0.2, middle: 0.2 } }, b5 + 1.6, 2.4, 'sine.inOut')
      fade(tl, '.c1-slipglow', 1, b5 + 1.8, 1.2)
      fade(tl, '.c1-toysharp', 1, b5 + 3.0, 1.4)
      // freeze
      const fz = b5 + 5.4
      tl.fromTo('.c1-freeze', { opacity: 0 }, { opacity: 0.9, duration: 0.05, immediateRender: false }, fz)
      tl.to('.c1-freeze', { opacity: 0.0, duration: 0.25 }, fz + 0.05)
      fade(tl, '.c1-still', 1, fz, 0.2)
      fade(tl, '.c1-danger', 1, fz, 0.3)
      ccam.shake(tl, fz, 0.6, 0.3)
      letterbox(tl, '.c1-lb', true, fz - 0.6, 96, 0.8)
      tl.set('.c1-black', { opacity: 1 }, fz + 2.6)
      tl.to({}, { duration: 0.4 }, fz + 2.7)
    },
    [panHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.cat-tail', { rotation: 14, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0% 100%' })
    gsap.to('.kw-sec', { rotation: 360, duration: 60, repeat: -1, ease: 'none', svgOrigin: '0 0' })
    gsap.to('.c1-moon', { opacity: 0.55, duration: 3.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-steam', { y: -14, opacity: 0.4, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-tailglow', { opacity: 0.25, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-pulse', { opacity: 0.35, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 4) {
      reportState(
        `The learner's turn. A chain of ${n} lime links (one per step of a chore) runs across the top. Below it a big number shows how often the whole chore works: per-step success ${(p * 100).toFixed(2)}% to the power ${n} steps = ${(whole * 100).toFixed(1)}%. ` +
          `A row of 20 little houses shows 20 simulated attempts: ${lime} lime (worked), ${HOUSES - lime} red (failed). Two sliders: per-step success (90% to 99.9%, spaced by "nines") and number of steps (5 to 80), with presets "make coffee 10", "load dishwasher 60", "full laundry 80". ` +
          `Goal: make the 60-step dishwasher chore work at least 90% of the time. ${won ? 'The learner has done it.' : 'Not done yet.'} ` +
          `Correct answer: for 60 steps you need about 99.83% per step (0.9983^60 ≈ 90%); 99% per step gives only 55%, 99.5% gives 74%. ` +
          'Likely mix-ups: thinking 99% is "basically perfect"; forgetting to switch to 60 steps; thinking the whole-chore number falls linearly rather than compounding.',
      )
      setHints(['Try the dishwasher preset first.', 'Each extra nine after the decimal point matters a lot.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, n, p, whole, lime, won, reportState, setHints])

  /* ---------------- the play ---------------- */
  const check = (nt: number, nn: number) => {
    const w = Math.pow(pOf(nt), nn)
    if (cueIndex !== 4 || won) return
    if (clock() - lastEmit.current > 1500) {
      lastEmit.current = clock()
      emit({ type: 'progress', detail: `per-step ${(pOf(nt) * 100).toFixed(2)}%, ${nn} steps, whole chore ${(w * 100).toFixed(0)}%` })
    }
    if (nn >= 60 && w >= 0.895) {
      setWon(true)
      emit({ type: 'attempt', correct: true, detail: `found ${(pOf(nt) * 100).toFixed(2)}% per step gives ${(w * 100).toFixed(0)}% for ${nn} steps` })
      void say('For a sixty-step chore you need almost ninety-nine point nine percent on every single step. That’s why a demo that works once is a long way from a product.')
      onPlayDone()
    }
  }
  const onP = (v: number) => {
    if (!live) return
    setT(v)
    check(v, n)
  }
  const onN = (v: number) => {
    if (!live) return
    const nn = Math.round(N_MIN + v * (N_MAX - N_MIN))
    setN(nn)
    check(t, nn)
  }
  const preset = (nn: number) => {
    if (!live) return
    setN(nn)
    emit({ type: 'progress', detail: `chose the ${nn}-step preset` })
    check(t, nn)
  }

  /* static pieces, made once */
  const bars = useMemo(
    () =>
      Array.from({ length: BARS }, (_, i) => (
        <rect key={i} className="c1-bar" x={barX(i)} y={BASE_Y - barH(i)} width={BAR_W} height={barH(i)} rx={3} fill={C.lime} opacity={Math.max(0.25, 1 - i / 190)} />
      )),
    [],
  )
  const crosses = useMemo(
    () =>
      Array.from({ length: 24 }, (_, k) => {
        const i = 62 + k * 2
        const x = barX(i) + BAR_W / 2
        const y = BASE_Y - barH(i) - 26
        return (
          <g key={k} className="c1-x" opacity={0}>
            <path d={`M${x - 9} ${y - 9} L${x + 9} ${y + 9} M${x + 9} ${y - 9} L${x - 9} ${y + 9}`} stroke={C.danger} strokeWidth={4} strokeLinecap="round" />
          </g>
        )
      }),
    [],
  )
  const kitchens = useMemo(() => {
    const extras = [undefined, 'dog', 'kid', 'toys', undefined, 'sock', 'cat', 'laundry', undefined, 'toys'] as const
    return extras.map((e, k) => (
      <g key={k} transform={`translate(${k * 1600} 0)`}>
        <g clipPath="url(#dh-panel)">
          <MiniKitchen seed={k + 1} extra={e} />
        </g>
      </g>
    ))
  }, [])

  // a chain of `count` links fitting the row
  const chain = (count: number, cls: string, live = false) => {
    const step = Math.min(CH_STEP, 1240 / Math.max(1, count - 1))
    const x0 = 800 - (step * (count - 1)) / 2
    const sc = step / CH_STEP
    return Array.from({ length: count }, (_, i) => {
      const x = live ? x0 + i * step : linkX(i)
      const s = live ? sc : 1
      return (
        <g key={i} className={`${cls} c1-lk-${live ? 'l' : ''}${i}`}>
          {i % 2 === 0 ? (
            <ellipse cx={x} cy={CH_Y} rx={36 * s} ry={17 * Math.max(0.6, s)} fill="none" stroke={C.lime} strokeWidth={6 * Math.max(0.5, s)} />
          ) : (
            <rect x={x - 36 * s} y={CH_Y - 5} width={72 * s} height={10} rx={5} fill={C.limeDark} stroke={C.lime} strokeWidth={3 * Math.max(0.5, s)} />
          )}
        </g>
      )
    })
  }

  return (
    <g ref={root}>
      {/* ---------- the map, for a moment ---------- */}
      <g className="c1-map" pointerEvents="none">
        <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
        <FiveMap cx={800} cy={470} lit={['brain']} />
        <Hand3D store={mapHand} x={800} y={600} look="robot" arm={120} light={[0.6, -0.8]} />
      </g>

      {/* ---------- the wide shot: the lab, then the kitchen ---------- */}
      <g className="c1-wide" ref={wide} opacity={0} pointerEvents="none">
        <g data-depth="0.25">
          <g className="c1-lab">
            <LabSky flashClass="c1-flash" />
          </g>
          <g className="c1-home" opacity={0}>
            <HomeSky />
          </g>
        </g>
        <g data-depth="0.6">
          <g className="c1-lab">
            <LabWall />
          </g>
          <g className="c1-home" opacity={0}>
            <KitchenWall />
          </g>
        </g>
        <g data-depth="1">
          <g className="c1-lab">
            <LabFloor />
            <Workbench x={1230} y={640} w={520} />
          </g>
          <g className="c1-home" opacity={0}>
            {/* wooden floor */}
            <rect x={-600} y={760} width={2800} height={700} fill="#141b26" />
            {Array.from({ length: 16 }, (_, i) => (
              <line key={i} x1={-600 + i * 190} y1={760} x2={-900 + i * 260} y2={1100} stroke={C.ink} strokeWidth={3} opacity={0.6} />
            ))}
            <rect x={-600} y={760} width={2800} height={3} fill={C.rim} opacity={0.12} />
            <g className="c1-moon">
              <MoonStripes />
            </g>
            <Pool x={1100} y={320} r={600} color="rim" opacity={0.25} />
            <RingToy x={880} y={808} s={0.7} />
            {/* the island */}
            <rect x={ISLAND.x} y={ISLAND.y + 10} width={700} height={400} fill="#111824" />
            <rect x={ISLAND.x - 16} y={ISLAND.y - 6} width={720} height={18} fill="#222c3e" />
            <rect x={ISLAND.x - 16} y={ISLAND.y - 6} width={720} height={3} fill={C.rim} opacity={0.5} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={ISLAND.x + 20 + i * 180} y={ISLAND.y + 40} width={160} height={220} fill="none" stroke="#1b2434" strokeWidth={3} />
            ))}
            <path d={`M${ISLAND.x + 420} ${ISLAND.y - 6} q0 -40 30 -40 q20 0 26 30`} fill="none" stroke={C.slate} strokeWidth={0} />
            <g>
              <Cat x={1250} y={ISLAND.y - 6} s={1.05} />
              <g className="c1-cateyes">
                <circle cx={1250 - 34 * 1.05} cy={ISLAND.y - 6 - 110 * 1.05} r={10} fill={C.lime} opacity={0.15} />
              </g>
            </g>
          </g>
          <ellipse cx={SEVEN.x + 10} cy={SEVEN.y + 4} rx={110} ry={12} fill="#000" opacity={0.55} filter="url(#cn-dof-1)" />
          <Robot name="seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} pose={POSES.stand} light="cool-right" />
          <g className="c1-home" opacity={0}>
            {/* moonlight bars falling across Seven too */}
            <g style={{ mixBlendMode: 'screen' }} opacity={0.6}>
              {[0, 1, 2, 3].map((i) => (
                <path key={i} d={`M${SEVEN.x - 40} ${560 + i * 64} l120 -40 l0 18 l-120 40 Z`} fill={C.rim} opacity={0.12} />
              ))}
            </g>
          </g>
          <Dust x={-200} y={0} w={2000} h={800} count={34} seed={31} color={C.rim} size={0.8} />
        </g>
        <g data-depth="1.7">
          <g className="c1-lab">
            <ForeShelf x={1500} />
          </g>
          <g className="c1-home" opacity={0} filter="url(#cn-dof-3)">
            <path d="M-80 -100 L-80 330 Q-80 360 -50 360 L60 360" stroke={C.ink} strokeWidth={16} fill="none" />
            <path d="M40 360 l-60 0 l30 -40 Z" fill={C.ink} />
            <rect x={1380} y={700} width={40} height={300} fill={C.ink} />
            <rect x={1360} y={680} width={260} height={30} rx={8} fill={C.ink} />
          </g>
        </g>
      </g>

      {/* ---------- the montage ---------- */}
      <clipPath id="dh-panel">
        <rect x={0} y={0} width={1600} height={900} />
      </clipPath>
      <g className="c1-mont" opacity={0} pointerEvents="none">
        <g className="c1-strip">{kitchens}</g>
        <g className="c1-streak" opacity={0} pointerEvents="none">
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={-100 + ((i * 377) % 1500)} y={40 + i * 38} width={500 + ((i * 131) % 600)} height={3 + (i % 3) * 2} fill={C.paper} opacity={0.25} />
          ))}
          <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink} opacity={0.35} />
        </g>
      </g>
      <g className="c1-fact" opacity={0} pointerEvents="none">
        <g className="c1-factin">
          <FactoryLine />
        </g>
        <Label className="c1-lab-fact" x={980} y={500} tx={1080} ty={250} text="built around the robot" sub="same parts, same place, every time" color={C.gold} />
      </g>

      {/* ---------- the long tail ---------- */}
      <g className="c1-tailg" ref={tailRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c1-axis" opacity={0}>
            <line x1={120} y1={BASE_Y} x2={7400} y2={BASE_Y} stroke={C.mist} strokeWidth={2} opacity={0.5} />
            <line x1={120} y1={BASE_Y} x2={120} y2={180} stroke={C.mist} strokeWidth={2} opacity={0.5} />
            <text x={100} y={190} fill={C.mist} fontFamily={SANS} fontSize={22} textAnchor="end" transform="rotate(-90 100 190)">
              how often it happens →
            </text>
            <text x={170} y={BASE_Y + 44} fill={C.mist} fontFamily={SANS} fontSize={22}>
              every kind of thing in a home →
            </text>
          </g>
          <circle className="c1-tailglow" cx={260} cy={420} r={320} fill="url(#cn-pool-lime)" opacity={0.5} />
          {bars}
          {crosses}
          <Label className="c1-lab-head" x={barX(1) + 17} y={BASE_Y - barH(1) - 10} tx={barX(4)} ty={260} text="cups, plates, doors" sub="happen all the time" color={C.limeLight} />
          {TAIL_ITEMS.map((it, k) => (
            <Label key={it.text} className={`c1-lab-tail${k}`} x={barX(it.i) + 17} y={BASE_Y - barH(it.i) - 6} tx={barX(it.i) + 40} ty={it.ly} text={it.text} sub="rare" color={C.limeLight} />
          ))}
          <g className="c1-lab-more" opacity={0}>
            <text x={barX(118)} y={600} fill={C.mist} fontFamily={SANS} fontSize={26}>
              …and thousands more
            </text>
            {[0, 1, 2].map((i) => (
              <circle key={i} className="hd-blink" style={{ animationDelay: `${i * 0.3}s` }} cx={barX(124) + i * 30} cy={640} r={5} fill={C.lime} />
            ))}
          </g>
        </g>
      </g>

      {/* ---------- the chain, and the play ---------- */}
      <g className="c1-chaing" opacity={0} pointerEvents="none">
        <Blueprint opacity={0.8} />
        <g className="c1-static">
          {Array.from({ length: LINKS }, (_, i) => (
            <g key={i} className={`c1-lk-${i}`}>
              <g className="c1-link">
                {i % 2 === 0 ? (
                  <ellipse cx={linkX(i)} cy={CH_Y} rx={36} ry={17} fill="none" stroke={C.lime} strokeWidth={6} />
                ) : (
                  <rect x={linkX(i) - 36} y={CH_Y - 5} width={72} height={10} rx={5} fill={C.limeDark} stroke={C.lime} strokeWidth={3} />
                )}
              </g>
              <g className={`c1-glow c1-glow-${i}`} opacity={0}>
                <ellipse cx={linkX(i)} cy={CH_Y} rx={40} ry={22} fill={C.limeLight} opacity={0.6} filter="url(#cn-bloom)" />
              </g>
              <g className={`c1-red-${i}`} opacity={0}>
                <ellipse cx={linkX(i)} cy={CH_Y} rx={38} ry={19} fill="none" stroke={C.danger} strokeWidth={7} />
                <circle cx={linkX(i)} cy={CH_Y} r={50} fill="url(#cn-pool-danger)" />
              </g>
              <text className="c1-pct" x={linkX(i)} y={CH_Y + (i % 2 ? -32 : 46)} fill={C.limeLight} fontFamily={MONO} fontSize={15} textAnchor="middle" opacity={0}>
                99%
              </text>
            </g>
          ))}
          <Label className="c1-lab-open" x={linkX(0)} y={CH_Y - 20} tx={linkX(0) + 20} ty={140} text="open the door" color={C.limeLight} size={22} />
          <Label className="c1-lab-close" x={linkX(LINKS - 1)} y={CH_Y - 20} tx={linkX(LINKS - 1) - 20} ty={140} text="close it" color={C.limeLight} size={22} />
          <g className="c1-runs" opacity={0}>
            <text x={800} y={610} fill={C.mist} fontFamily={SANS} fontSize={22} textAnchor="middle">
              five tries at the chore
            </text>
            {Array.from({ length: RUNS }, (_, k) => {
              const h = RUN_HOUSE(k)
              return (
                <g key={k}>
                  <HouseIcon x={h.x} y={h.y} s={1.3} />
                  <g className={`c1-run-ok-${k}`} opacity={0}>
                    <HouseIcon x={h.x} y={h.y} s={1.3} fill={C.lime} stroke={C.limeLight} glow />
                  </g>
                  <g className={`c1-run-red-${k}`} opacity={0}>
                    <HouseIcon x={h.x} y={h.y} s={1.3} fill={C.danger} stroke={C.danger} glow />
                  </g>
                </g>
              )
            })}
          </g>
          <g className="c1-formula" opacity={0}>
            <PowerText x={800} y={490} base="0.99" exp="20" rest=" ≈ 82%" size={92} />
            <text x={800} y={540} fill={C.mist} fontFamily={SANS} fontSize={24} textAnchor="middle">
              twenty steps at 99% each: the whole chore works about 4 times in 5
            </text>
          </g>
        </g>
      </g>

      {/* ---------- the close-up: the pan ---------- */}
      <g className="c1-close" ref={closeRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#0c111b" />
          <g filter="url(#cn-dof-3)">
            {Array.from({ length: 48 }, (_, i) => (
              <rect key={i} x={-300 + (i % 12) * 150} y={180 + Math.floor(i / 12) * 90} width={144} height={84} fill="#1a2334" opacity={0.8} />
            ))}
            <rect x={-200} y={60} width={420} height={300} fill="#151d2b" />
            <rect x={1300} y={40} width={300} height={420} fill="#141b28" />
            <circle cx={1400} cy={200} r={40} fill={C.rim} opacity={0.3} />
            {/* the toddler's toy on the floor, far below the edge */}
            <g transform="translate(1340 820) scale(1.6)">
              <RingToy x={0} y={0} />
            </g>
            <rect x={-600} y={900} width={2800} height={400} fill="#141b26" />
          </g>
          <g className="c1-toysharp" opacity={0} filter="url(#cn-dof-1)">
            <g transform="translate(1340 820) scale(1.6)">
              <RingToy x={0} y={0} />
            </g>
          </g>
        </g>
        <g data-depth="1">
          <Pool x={760} y={420} r={620} color="key" opacity={0.75} />
          {/* counter top ending at the edge */}
          <rect x={-600} y={TOP_Y} width={EDGE_X + 600} height={700} fill="#1a2232" />
          <rect x={-600} y={TOP_Y} width={EDGE_X + 600} height={6} fill={C.keyDeep} opacity={0.6} />
          <rect x={EDGE_X - 6} y={TOP_Y} width={6} height={700} fill={C.rim} opacity={0.3} />
          {/* the hob */}
          <rect x={720} y={TOP_Y - 8} width={330} height={10} rx={3} fill="#0b0e14" />
          <ellipse cx={890} cy={TOP_Y - 6} rx={120} ry={8} fill={C.danger} opacity={0.35} filter="url(#cn-dof-1)" />
          <g className="c1-slipglow" opacity={0}>
            <Pool x={GRIP.x - 40} y={GRIP.y} r={160} color="danger" opacity={0.6} />
          </g>
          <g className="c1-pan">
            <g transform={`translate(${GRIP.x} ${GRIP.y})`}>
              <Pan />
              <g className="c1-steam" opacity={0.2}>
                <path d="M200 -40 q-14 -30 4 -60" stroke={C.paper} strokeWidth={3} fill="none" />
              </g>
            </g>
          </g>
          <Hand3D store={panHand} x={GRIP.x + 14} y={GRIP.y - 178} look="robot" arm={520} light={[0.8, -0.5]} />
          <g className="c1-danger" opacity={0}>
            <Pool x={EDGE_X + 40} y={TOP_Y + 20} r={360} color="danger" opacity={0.7} />
          </g>
        </g>
        <g className="c1-still" opacity={0} pointerEvents="none">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#0a0a12" opacity={0.35} style={{ mixBlendMode: 'saturation' }} />
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} opacity={0.15} />
        </g>
        <rect className="c1-freeze" x={-600} y={-500} width={2800} height={1900} fill={C.paper} opacity={0} pointerEvents="none" />
      </g>

      <rect className="c1-black" x={-600} y={-500} width={2800} height={1900} fill="#000" opacity={0} pointerEvents="none" />
      <g className="c1-play" opacity={0} pointerEvents={live ? 'auto' : 'none'}>
        <text className="c1-ctrl" x={800} y={130} fill={C.mist} fontFamily={SANS} fontSize={24} textAnchor="middle">
          goal: the 60-step dishwasher chore works at least 9 times in 10
        </text>
        <g>{chain(n, 'c1-dyn', true)}</g>
        <text x={800} y={186} fill={C.limeLight} fontFamily={MONO} fontSize={20} textAnchor="middle" opacity={0.8}>
          {n} steps
        </text>
        <g className="c1-ctrl">
          <text x={800} y={470} fill={whole >= 0.895 ? C.lime : whole < 0.5 ? C.danger : C.paper} fontFamily={SERIF} fontSize={140} fontWeight={600} textAnchor="middle" style={{ transition: 'fill 0.3s' }}>
            {pct(whole)}%
          </text>
          <PowerText x={800} y={540} base={`${(p * 100).toFixed(2)}%`} exp={`${n}`} rest="  → the whole chore works" size={30} color={C.mist} />
          {won && <circle className="c1-pulse" cx={800} cy={420} r={260} fill="url(#cn-pool-lime)" />}
        </g>
        <g className="c1-ctrl">
          {Array.from({ length: HOUSES }, (_, i) => {
            const ok = ORDER[i] < lime
            return <HouseIcon key={i} x={houseX(i) + 5} y={HOUSE_Y} s={1.05} fill={ok ? C.lime : C.danger} stroke={ok ? C.limeLight : C.danger} />
          })}
          <text x={800} y={HOUSE_Y + 36} fill={C.mist} fontFamily={SANS} fontSize={18} textAnchor="middle">
            20 tries: {lime} work, {HOUSES - lime} fail
          </text>
        </g>
        <g className="c1-ctrl">
          <Slider x={140} y={742} w={580} value={t} onChange={onP} color={C.lime} label="each step works" valueText={`${(p * 100).toFixed(2)}%`} tutor="per-step slider" disabled={!live} ticks={[{ at: 0, text: '90%' }, { at: 0.5, text: '99%' }, { at: tOf(0.995), text: '99.5%' }, { at: 1, text: '99.9%' }]} />
        </g>
        <g className="c1-ctrl">
          <Slider x={140} y={856} w={580} value={(n - N_MIN) / (N_MAX - N_MIN)} onChange={onN} color={C.lime} label="steps in the chore" valueText={`${n}`} tutor="steps slider" disabled={!live} />
          {PRESETS.map((pr, i) => (
            <Chip key={pr.n} x={960 + i * 248} y={846} w={236} h={50} text={pr.text} color={C.lime} active={n === pr.n} onClick={() => preset(pr.n)} tutor={pr.tutor} disabled={!live} />
          ))}
        </g>
      </g>

      <Vignette />
      <Letterbox className="c1-lb" />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'tail',
  title: 'The long tail',
  cues: CUES,
  Scene: Ch1Tail,
  deeper: [LongTailReading],
}
