import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alien, At, Bubble, Bundle, Cloud, Hills, Label, Shepherd, Sky, Stick, Sun, SvgButton } from '../art/kit'
import { C, FONT } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import { useDrag } from '../engine/svg'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Stop 4: Bundling by ten (place value).
 * A messy pile of 34 sticks is slow to count. Tying sticks into bundles of ten turns it into
 * 3 bundles and 4 loose sticks, which we write as 34: where a digit sits says whether it counts
 * bundles or loose ones. The same sticks then move onto a place-value mat, a second mat (43),
 * and a number line, so every new picture is linked to the real sticks.
 * Colour code all stop long: tens and bundles are coral, ones and loose sticks are teal.
 */

const BEATS = [
  { id: 'pile', say: 'Counting one by one gets slow when there are lots of things. Look at this big pile of sticks.' },
  { id: 'guess', say: 'Your turn! About how many sticks are here? Take a guess.', challenge: true, quick: true },
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
    challenge: true,
  },
]

/** What Pip sees during the watch beats (the challenges report their own state). */
const WATCH_STATE: Record<string, string> = {
  pile: 'A messy pile of 34 sticks lies on a blanket. A few sticks get counted one by one (1, 2, 3, 4) to show how slow that is.',
  bundle:
    'Sticks leave the pile ten at a time. The first ten are counted 1 to 10 and tied with a coral ribbon into a bundle. Three bundles of ten form (each with a coral "10" tag) and 4 loose sticks are left over.',
  'why-ten':
    'Two hands appear and their fingers light up one by one, counting to ten, then "= one bundle" with a bundle of ten. People bundle by ten because we have ten fingers. The 3 bundles and 4 loose sticks are still below.',
  'tens-ones':
    'A place-value mat: a coral "tens" column holding the 3 bundles and a teal "ones" column holding the 4 loose sticks. Below, the number 34 appears: a coral 3 linked to the tens column and a teal 4 linked to the ones column.',
  'place-matters':
    'Two mats side by side. Left: 34 (3 bundles, 4 loose sticks). Right: 43 (4 bundles, 3 loose sticks). The digits 3 and 4 fly across and swap places, changing colour to match their new column. 43 is more because it has more bundles of ten.',
  'number-line':
    'A number line from 0 to 50. A ball makes three big coral jumps of ten (0 to 10 to 20 to 30), one under each bundle, then four small teal hops of one (31, 32, 33, 34), one under each loose stick, landing on 34.',
}

const TENS = C.coral
const ONES = C.teal

/* ---------------------------------------------------------------- layout */

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The messy pile: 34 sticks scattered on the right of the blanket. */
const PILE = (() => {
  const r = seeded(11)
  return Array.from({ length: 34 }, () => {
    const a = r() * Math.PI * 2
    const d = Math.pow(r(), 0.75)
    return { x: 1090 + Math.cos(a) * d * 270, y: 615 + Math.sin(a) * d * 115, r: -88 + r() * 176 }
  })
})()
/** The order the sticks tumble into the pile. */
const DROP_ORDER = (() => {
  const r = seeded(5)
  const ids = Array.from({ length: 34 }, (_, i) => i)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
})()

/** The story sticks are drawn a little bigger than the kit's, so the pile reads clearly. */
const K = 1.25
const TAG_Y = -108
const B_HOME = [
  { x: 260, y: 680 },
  { x: 405, y: 680 },
  { x: 550, y: 680 },
]
const LOOSE_HOME = [0, 1, 2, 3].map((j) => ({ x: 690 + j * 52, y: 680 }))
/** Where the first ten sticks line up to be counted. */
const ROW = (n: number) => ({ x: 150 + n * 56, y: 680 })

/** Stick n's place inside a tied bundle (matches the kit's Bundle for ten). */
function formOffset(size: number, n: number) {
  if (size === 4) return { x: (n - 1.5) * 9, r: (n - 1.5) * 2.5 }
  return { x: (n - 4.5) * 7, r: (n - 4.5) * 1.2 }
}

/** Place-value mat centred on cx. */
function matGeo(cx: number) {
  return {
    board: { x: cx - 380, y: 90, w: 760, h: 730 },
    tens: { x: cx - 360, y: 120, w: 430, h: 470, cx: cx - 145 },
    ones: { x: cx + 90, y: 120, w: 270, h: 470, cx: cx + 225 },
    dTens: { x: cx + 25, y: 700 },
    dOnes: { x: cx + 135, y: 700 },
  }
}
const MA_B4 = 800
const MA_B5 = 400
const MB = 1200
const MAT_Y = 385
const bunOnMat = (cx: number, k: number, count: number) => ({ x: cx - 145 + (k - (count - 1) / 2) * (count > 3 ? 104 : 118), y: MAT_Y })
const looseOnMat = (cx: number, j: number, count: number) => ({ x: cx + 225 + (j - (count - 1) / 2) * 52, y: MAT_Y })

/** Number line 0 to 50. */
const NL = { x0: 150, unit: 26, y: 700 }
const nx = (v: number) => NL.x0 + v * NL.unit
const NL_BUN_Y = 470
const NL_STICK_Y = 588

/** Hands for "why ten". */
const HANDS = { lx: 480, rx: 860, y: 470 }

/* ---------------------------------------------------------------- the scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone, reportState } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const DROP = 420
      /* ---- starting state */
      tl.set('.sticks', { opacity: 1 }, 0)
      B_HOME.forEach((b, k) => tl.set(`.bun-${k}`, { x: b.x, y: b.y, opacity: 1 }, 0))
      for (let i = 0; i < 30; i++) {
        const b = B_HOME[Math.floor(i / 10)]
        const p = PILE[i]
        tl.set(`.st-${i}`, { x: p.x - b.x, y: p.y - b.y - DROP, rotation: p.r - 40, opacity: 0, transformOrigin: '50% 50%' }, 0)
      }
      for (let j = 0; j < 4; j++) {
        const p = PILE[30 + j]
        tl.set(`.loose-${j}`, { x: p.x, y: p.y - DROP, rotation: p.r - 40, opacity: 0, transformOrigin: '50% 50%' }, 0)
      }
      tl.set('.rib', { scaleX: 0, opacity: 0, transformOrigin: '50% 50%' }, 0)
      tl.set(['.tag10', '.cnum', '.demo', '.hnum', '.ma-d3', '.ma-d4', '.nl-mark', '.nl-34', '.mb-piece'], { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, 0)
      tl.set(['.lit', '.h-eq', '.hands', '.mat-a', '.mat-b', '.ma-link', '.ma-lab', '.ma-glow', '.mb-link', '.mb-lab', '.mb-glow', '.fly', '.more', '.nline', '.nl-ticks', '.hopper'], { opacity: 0 }, 0)
      tl.set('.mat-a', { x: 0, y: 0 }, 0)
      const ga = matGeo(MA_B5)
      tl.set('.fly-3', { x: ga.dTens.x, y: ga.dTens.y }, 0)
      tl.set('.fly-4', { x: ga.dOnes.x, y: ga.dOnes.y }, 0)
      tl.set(['.fly-3-c', '.fly-4-t'], { opacity: 1 }, 0)
      tl.set(['.fly-3-t', '.fly-4-c'], { opacity: 0 }, 0)
      tl.set('.nl-axis', { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set(['.arc', '.hop'], { opacity: 0, strokeDashoffset: 1 }, 0)
      tl.set('.hopper', { x: nx(0), y: NL.y - 16 }, 0)

      /* ---- b0: a messy pile tumbles down, then slow one-by-one counting */
      tl.addLabel('b0', 0.01)
      DROP_ORDER.forEach((i, n) => {
        const at = `b0+=${0.2 + n * 0.07}`
        const target = i < 30 ? `.st-${i}` : `.loose-${i - 30}`
        const y = i < 30 ? PILE[i].y - B_HOME[Math.floor(i / 10)].y : PILE[i].y
        tl.to(target, { opacity: 1, duration: 0.12 }, at)
        tl.to(target, { y, rotation: PILE[i].r, duration: 0.55, ease: 'power2.in' }, at)
      })
      for (let j = 0; j < 4; j++) {
        tl.to(`.demo-${j}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, `b0+=${3.6 + j * 0.85}`)
      }
      tl.to('.demo', { opacity: 0, duration: 0.4 }, 'b0+=7.1')

      /* ---- b1: quick guess (the panel is a React component) */
      tl.addLabel('b1', '+=0.2')
      tl.to({}, { duration: 0.3 }, 'b1')

      /* ---- b2: count ten, tie a bundle; again; again */
      tl.addLabel('b2', '+=0.2')
      const b0 = B_HOME[0]
      for (let n = 0; n < 10; n++) {
        const t = 0.5 + n * 0.3
        const row = ROW(n)
        tl.to(`.st-${n}`, { x: row.x - b0.x, y: row.y - b0.y, rotation: 0, duration: 0.3, ease: 'power2.out' }, `b2+=${t}`)
        tl.to(`.cnum-${n}`, { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(2.5)' }, `b2+=${t + 0.22}`)
      }
      tl.to('.cnum', { opacity: 0, duration: 0.3 }, 'b2+=3.65')
      const tie = (k: number, at: number) => {
        tl.to(`.rib-${k}`, { opacity: 1, duration: 0.05 }, `b2+=${at}`)
        tl.to(`.rib-${k}`, { scaleX: 1, duration: 0.35, ease: 'back.out(2)' }, `b2+=${at}`)
        tl.to(`.tag10-${k}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, `b2+=${at + 0.35}`)
      }
      for (let n = 0; n < 10; n++) {
        const f = formOffset(10, n)
        tl.to(`.st-${n}`, { x: f.x * K, y: 0, rotation: f.r, duration: 0.45, ease: 'power2.inOut' }, 'b2+=3.65')
      }
      tie(0, 4.1)
      ;[1, 2].forEach((k) => {
        const start = k === 1 ? 4.7 : 6.3
        for (let n = 0; n < 10; n++) {
          const f = formOffset(10, n)
          tl.to(`.st-${k * 10 + n}`, { x: f.x * K, y: 0, rotation: f.r, duration: 0.45, ease: 'power2.inOut' }, `b2+=${start + n * 0.07}`)
        }
        tie(k, start + 1.1)
      })
      LOOSE_HOME.forEach((p, j) => {
        tl.to(`.loose-${j}`, { x: p.x, y: p.y, rotation: 0, duration: 0.5, ease: 'power2.inOut' }, `b2+=${8.0 + j * 0.1}`)
      })

      /* ---- b3: why ten? fingers light up one by one */
      tl.addLabel('b3', '+=0.3')
      tl.fromTo('.hands', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 'b3')
      for (let n = 0; n < 10; n++) {
        const at = `b3+=${0.9 + n * 0.4}`
        tl.to(`.lit-${n}`, { opacity: 1, duration: 0.2 }, at)
        tl.to(`.hnum-${n}`, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2.5)' }, at)
      }
      tl.to('.h-eq', { opacity: 1, duration: 0.5 }, 'b3+=5.0')

      /* ---- b4: the tens and ones mat, then 34 */
      tl.addLabel('b4', '+=0.4')
      tl.to('.hands', { opacity: 0, duration: 0.4 }, 'b4')
      tl.fromTo('.mat-a', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, 'b4+=0.2')
      for (let k = 0; k < 3; k++) {
        const p = bunOnMat(MA_B4, k, 3)
        tl.to(`.bun-${k}`, { x: p.x, y: p.y, duration: 0.6, ease: 'power2.inOut' }, `b4+=${0.8 + k * 0.3}`)
      }
      for (let j = 0; j < 4; j++) {
        const p = looseOnMat(MA_B4, j, 4)
        tl.to(`.loose-${j}`, { x: p.x, y: p.y, duration: 0.5, ease: 'power2.inOut' }, `b4+=${2.0 + j * 0.2}`)
      }
      tl.to('.ma-link', { opacity: 1, duration: 0.4 }, 'b4+=3.9')
      tl.to('.ma-d3', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b4+=4.3')
      tl.to('.ma-d4', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b4+=4.6')
      tl.to('.ma-glow-t', { opacity: 1, duration: 0.4 }, 'b4+=6.2')
      tl.to('.ma-d3', { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1 }, 'b4+=6.2')
      tl.to('.ma-lab-t', { opacity: 1, duration: 0.4 }, 'b4+=6.4')
      tl.to('.ma-glow-t', { opacity: 0, duration: 0.4 }, 'b4+=9.0')
      tl.to('.ma-glow-o', { opacity: 1, duration: 0.4 }, 'b4+=9.0')
      tl.to('.ma-d4', { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1 }, 'b4+=9.0')
      tl.to('.ma-lab-o', { opacity: 1, duration: 0.4 }, 'b4+=9.2')
      tl.to({}, { duration: 0.2 }, 'b4+=11.2')

      /* ---- b5: 34 and 43, same digits, different places */
      tl.addLabel('b5', '+=0.3')
      tl.to('.ma-glow', { opacity: 0, duration: 0.3 }, 'b5')
      tl.to('.mat-a', { x: MA_B5 - MA_B4, duration: 0.9, ease: 'power2.inOut' }, 'b5+=0.2')
      for (let k = 0; k < 3; k++) tl.to(`.bun-${k}`, { x: bunOnMat(MA_B5, k, 3).x, duration: 0.9, ease: 'power2.inOut' }, 'b5+=0.2')
      for (let j = 0; j < 4; j++) tl.to(`.loose-${j}`, { x: looseOnMat(MA_B5, j, 4).x, duration: 0.9, ease: 'power2.inOut' }, 'b5+=0.2')
      tl.fromTo('.mat-b', { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.6 }, 'b5+=0.9')
      const gb = matGeo(MB)
      tl.to('.fly', { opacity: 1, duration: 0.1 }, 'b5+=2.4')
      tl.to('.fly-3', { x: gb.dOnes.x, duration: 1.3, ease: 'power1.inOut' }, 'b5+=2.5')
      tl.to('.fly-3', { y: gb.dOnes.y - 190, duration: 0.65, ease: 'power2.out' }, 'b5+=2.5')
      tl.to('.fly-3', { y: gb.dOnes.y, duration: 0.65, ease: 'power2.in' }, 'b5+=3.15')
      tl.to('.fly-3-c', { opacity: 0, duration: 0.6 }, 'b5+=2.9')
      tl.to('.fly-3-t', { opacity: 1, duration: 0.6 }, 'b5+=2.9')
      tl.to('.fly-4', { x: gb.dTens.x, duration: 1.3, ease: 'power1.inOut' }, 'b5+=2.5')
      tl.to('.fly-4', { y: gb.dTens.y - 80, duration: 0.65, ease: 'power2.out' }, 'b5+=2.5')
      tl.to('.fly-4', { y: gb.dTens.y, duration: 0.65, ease: 'power2.in' }, 'b5+=3.15')
      tl.to('.fly-4-t', { opacity: 0, duration: 0.6 }, 'b5+=2.9')
      tl.to('.fly-4-c', { opacity: 1, duration: 0.6 }, 'b5+=2.9')
      tl.to('.mb-link', { opacity: 1, duration: 0.4 }, 'b5+=3.9')
      for (let k = 0; k < 4; k++) tl.to(`.mb-bun-${k}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, `b5+=${4.6 + k * 0.3}`)
      for (let j = 0; j < 3; j++) tl.to(`.mb-st-${j}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, `b5+=${5.9 + j * 0.2}`)
      tl.to('.mb-lab', { opacity: 1, duration: 0.4 }, 'b5+=6.4')
      tl.to('.mb-glow', { opacity: 1, duration: 0.4 }, 'b5+=7.3')
      tl.fromTo('.more', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 'b5+=7.5')

      /* ---- b6: the number line, bundles above big jumps, sticks above small steps */
      tl.addLabel('b6', '+=0.5')
      tl.to(['.mat-a', '.mat-b', '.fly', '.more'], { opacity: 0, duration: 0.5 }, 'b6')
      tl.to('.nline', { opacity: 1, duration: 0.5 }, 'b6+=0.3')
      tl.to('.nl-axis', { scaleX: 1, duration: 0.7, ease: 'power2.out' }, 'b6+=0.4')
      tl.to('.nl-ticks', { opacity: 1, duration: 0.5 }, 'b6+=0.8')
      for (let k = 0; k < 3; k++) {
        tl.to(`.bun-${k}`, { x: nx(10 * k + 5), y: NL_BUN_Y, opacity: 0.35, duration: 0.8, ease: 'power2.inOut' }, 'b6+=0.3')
      }
      for (let j = 0; j < 4; j++) {
        tl.to(`.loose-${j}`, { x: nx(30.5 + j), y: NL_STICK_Y, opacity: 0.35, duration: 0.8, ease: 'power2.inOut' }, 'b6+=0.3')
      }
      tl.to('.hopper', { opacity: 1, duration: 0.3 }, 'b6+=1.2')
      for (let k = 0; k < 3; k++) {
        const t = 1.6 + k * 0.85
        tl.to(`.bun-${k}`, { opacity: 1, duration: 0.25 }, `b6+=${t}`)
        tl.to(`.arc-${k}`, { opacity: 1, duration: 0.05 }, `b6+=${t}`)
        tl.to(`.arc-${k}`, { strokeDashoffset: 0, duration: 0.7, ease: 'none' }, `b6+=${t}`)
        tl.to('.hopper', { x: nx(10 * k + 10), duration: 0.7, ease: 'none' }, `b6+=${t}`)
        tl.to('.hopper', { y: NL.y - 16 - 150, duration: 0.35, ease: 'sine.out' }, `b6+=${t}`)
        tl.to('.hopper', { y: NL.y - 16, duration: 0.35, ease: 'sine.in' }, `b6+=${t + 0.35}`)
      }
      for (let j = 0; j < 4; j++) {
        const t = 4.2 + j * 0.4
        tl.to(`.loose-${j}`, { opacity: 1, duration: 0.2 }, `b6+=${t}`)
        tl.to(`.hop-${j}`, { opacity: 1, duration: 0.05 }, `b6+=${t}`)
        tl.to(`.hop-${j}`, { strokeDashoffset: 0, duration: 0.32, ease: 'none' }, `b6+=${t}`)
        tl.to('.hopper', { x: nx(31 + j), duration: 0.32, ease: 'none' }, `b6+=${t}`)
        tl.to('.hopper', { y: NL.y - 16 - 40, duration: 0.16, ease: 'sine.out' }, `b6+=${t}`)
        tl.to('.hopper', { y: NL.y - 16, duration: 0.16, ease: 'sine.in' }, `b6+=${t + 0.16}`)
      }
      tl.to('.hopper', { opacity: 0, duration: 0.25 }, 'b6+=5.85')
      tl.to('.nl-mark', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }, 'b6+=5.85')
      tl.to('.nl-34', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b6+=6.0')

      /* ---- b7: the shop game takes the stage */
      tl.addLabel('b7', '+=0.6')
      tl.to(['.nline', '.sticks'], { opacity: 0, duration: 0.4 }, 'b7')
      tl.addLabel('end', '+=0.2')
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  useEffect(() => {
    const b = BEATS[beatIndex]
    if (!b || b.challenge) return
    reportState(WATCH_STATE[b.id] ?? '')
  }, [beatIndex, reportState])

  return (
    <g ref={root}>
      <Backdrop />
      <MatA />
      <MatB />
      <NumberLine />
      <StickWorld />
      <FlyDigits />
      <g className="more">
        <Pill x={MB} y={48} text="43 is more!" color={C.mustardDark} size={40} h={64} />
      </g>
      <g className="cnums">
        {Array.from({ length: 10 }, (_, n) => (
          <g key={n} className={`cnum cnum-${n}`}>
            <NumBadge x={ROW(n).x} y={ROW(n).y - 95} n={n + 1} color={n === 9 ? TENS : C.ink} />
          </g>
        ))}
      </g>
      <g className="demos">
        {[0, 1, 2, 3].map((j) => (
          <g key={j} className={`demo demo-${j}`}>
            <NumBadge x={PILE[30 + j].x} y={PILE[30 + j].y - 40} n={j + 1} color={C.ink} />
          </g>
        ))}
      </g>
      <HandsPanel />

      {id === 'guess' && <GuessPile {...props} />}
      {id === 'bundle-builder' && <BundleBuilder {...props} />}
    </g>
  )
}

/* ---------------------------------------------------------------- watch-segment art */

function Backdrop() {
  return (
    <g>
      <Sky />
      <At x={1400} y={150}>
        <Sun r={56} />
      </At>
      <At x={250} y={130} s={0.8}>
        <Cloud />
      </At>
      <At x={880} y={95} s={0.6}>
        <Cloud />
      </At>
      <Hills />
      <rect x={90} y={380} width={1420} height={490} rx={48} fill={C.cream} stroke="#EAD8B5" strokeWidth={6} />
    </g>
  )
}

/** A rounded label pill. */
function Pill({ x, y, text, color, size = 40, h = 62, textColor = C.white }: { x: number; y: number; text: string; color: string; size?: number; h?: number; textColor?: string }) {
  const w = text.length * size * 0.62 + 48
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={color} />
      <At x={x} y={y + 2}>
        <Label text={text} size={size} color={textColor} />
      </At>
    </g>
  )
}

/** A small round number badge (used for counting one by one). */
function NumBadge({ x, y, n, color }: { x: number; y: number; n: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={22} fill={C.white} stroke={color} strokeWidth={3} />
      <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={color}>
        {n}
      </text>
    </g>
  )
}

/** The coral "10" tag that rides above every bundle of ten. */
function TenTag({ y = -86, text = '10', color = TENS }: { y?: number; text?: string; color?: string }) {
  return (
    <g>
      <rect x={-36} y={y - 22} width={72} height={44} rx={22} fill={color} />
      <text x={0} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={C.white}>
        {text}
      </text>
    </g>
  )
}

function Ribbon({ size, color }: { size: number; color: string }) {
  const half = size === 10 ? 40 : 24
  return (
    <g>
      <rect x={-half} y={-8} width={half * 2} height={16} rx={6} fill={color} />
      <circle cx={0} cy={0} r={size === 10 ? 9 : 7} fill={color} stroke={C.white} strokeWidth={2} />
    </g>
  )
}

/** The 34 real sticks: three bundles-to-be and four that stay loose. */
function StickWorld() {
  return (
    <g className="sticks">
      {[0, 1, 2].map((k) => (
        <g key={k} className={`bun bun-${k}`} data-tutor={`bundle ${k + 1}`}>
          {Array.from({ length: 10 }, (_, n) => (
            <g key={n} className={`st st-${k * 10 + n}`}>
              <g transform={`scale(${K})`}>
                <Stick />
              </g>
            </g>
          ))}
          <g className={`rib rib-${k}`}>
            <g transform={`scale(${K})`}>
              <Ribbon size={10} color={TENS} />
            </g>
          </g>
          <g className={`tag10 tag10-${k}`}>
            <TenTag y={TAG_Y} />
          </g>
        </g>
      ))}
      {[0, 1, 2, 3].map((j) => (
        <g key={j} className={`loose loose-${j}`} data-tutor={`loose stick ${j + 1}`}>
          <g transform={`scale(${K})`}>
            <Stick />
          </g>
        </g>
      ))}
    </g>
  )
}

/** The board and columns of a place-value mat (the pieces are drawn separately). */
function MatBoard({ cx }: { cx: number }) {
  const g = matGeo(cx)
  return (
    <g>
      <rect x={g.board.x} y={g.board.y + 10} width={g.board.w} height={g.board.h} rx={40} fill={C.shadow} />
      <rect x={g.board.x} y={g.board.y} width={g.board.w} height={g.board.h} rx={40} fill={C.white} />
      <rect x={g.tens.x} y={g.tens.y} width={g.tens.w} height={g.tens.h} rx={28} fill={TENS} fillOpacity={0.1} stroke={TENS} strokeOpacity={0.6} strokeWidth={4} />
      <rect x={g.ones.x} y={g.ones.y} width={g.ones.w} height={g.ones.h} rx={28} fill={ONES} fillOpacity={0.1} stroke={ONES} strokeOpacity={0.6} strokeWidth={4} />
      <Pill x={g.tens.cx} y={175} text="tens" color={TENS} size={44} h={66} />
      <Pill x={g.ones.cx} y={175} text="ones" color={ONES} size={44} h={66} />
    </g>
  )
}

function MatLinks({ cx }: { cx: number }) {
  const g = matGeo(cx)
  return (
    <g>
      <path d={`M ${g.tens.cx} 598 Q ${g.tens.cx + 40} 628 ${g.dTens.x - 34} 630`} stroke={TENS} strokeWidth={7} fill="none" strokeDasharray="10 10" strokeLinecap="round" />
      <path d={`M ${g.ones.cx} 598 Q ${g.ones.cx - 30} 628 ${g.dOnes.x + 34} 630`} stroke={ONES} strokeWidth={7} fill="none" strokeDasharray="10 10" strokeLinecap="round" />
    </g>
  )
}

/** Mat A: 34. Its bundles and sticks are the real ones from the pile. */
function MatA() {
  const g = matGeo(MA_B4)
  return (
    <g className="mat-a" data-tutor="the tens and ones mat for 34">
      <MatBoard cx={MA_B4} />
      <rect className="ma-glow ma-glow-t" x={g.tens.x - 6} y={g.tens.y - 6} width={g.tens.w + 12} height={g.tens.h + 12} rx={32} fill="none" stroke={TENS} strokeWidth={10} />
      <rect className="ma-glow ma-glow-o" x={g.ones.x - 6} y={g.ones.y - 6} width={g.ones.w + 12} height={g.ones.h + 12} rx={32} fill="none" stroke={ONES} strokeWidth={10} />
      <g className="ma-link">
        <MatLinks cx={MA_B4} />
      </g>
      <g className="ma-lab ma-lab-t">
        <At x={g.tens.cx} y={545}>
          <Label text="3 bundles" size={38} color={C.coralDark} />
        </At>
      </g>
      <g className="ma-lab ma-lab-o">
        <At x={g.ones.cx} y={545}>
          <Label text="4 loose" size={38} color={C.tealDark} />
        </At>
      </g>
      <g className="ma-d3">
        <At x={g.dTens.x} y={g.dTens.y}>
          <Label text="3" size={180} color={TENS} />
        </At>
      </g>
      <g className="ma-d4">
        <At x={g.dOnes.x} y={g.dOnes.y}>
          <Label text="4" size={180} color={ONES} />
        </At>
      </g>
    </g>
  )
}

/** Mat B: 43, drawn whole (its digits fly over from mat A). */
function MatB() {
  const g = matGeo(MB)
  return (
    <g className="mat-b" data-tutor="the tens and ones mat for 43">
      <MatBoard cx={MB} />
      <rect className="mb-glow" x={g.tens.x - 6} y={g.tens.y - 6} width={g.tens.w + 12} height={g.tens.h + 12} rx={32} fill="none" stroke={C.mustard} strokeWidth={12} />
      <g className="mb-link">
        <MatLinks cx={MB} />
      </g>
      {[0, 1, 2, 3].map((k) => {
        const p = bunOnMat(MB, k, 4)
        return (
          <g key={k} className={`mb-piece mb-bun-${k}`}>
            <At x={p.x} y={p.y}>
              <g transform={`scale(${K})`}>
                <Bundle ribbon={TENS} />
              </g>
              <TenTag y={TAG_Y} />
            </At>
          </g>
        )
      })}
      {[0, 1, 2].map((j) => {
        const p = looseOnMat(MB, j, 3)
        return (
          <g key={j} className={`mb-piece mb-st-${j}`}>
            <At x={p.x} y={p.y} s={K}>
              <Stick />
            </At>
          </g>
        )
      })}
      <g className="mb-lab">
        <At x={g.tens.cx} y={545}>
          <Label text="4 bundles" size={38} color={C.coralDark} />
        </At>
        <At x={g.ones.cx} y={545}>
          <Label text="3 loose" size={38} color={C.tealDark} />
        </At>
      </g>
    </g>
  )
}

/** Copies of 3 and 4 that fly from mat A to mat B, taking the colour of their new place. */
function FlyDigits() {
  return (
    <g className="fly">
      <g className="fly-3">
        <g className="fly-3-c">
          <Label text="3" size={180} color={TENS} />
        </g>
        <g className="fly-3-t">
          <Label text="3" size={180} color={ONES} />
        </g>
      </g>
      <g className="fly-4">
        <g className="fly-4-t">
          <Label text="4" size={180} color={ONES} />
        </g>
        <g className="fly-4-c">
          <Label text="4" size={180} color={TENS} />
        </g>
      </g>
    </g>
  )
}

function NumberLine() {
  const ticks = Array.from({ length: 51 }, (_, v) => v)
  return (
    <g className="nline" data-tutor="the number line">
      <rect x={70} y={335} width={1460} height={535} rx={40} fill={C.white} />
      <g className="nl-axis">
        <line x1={nx(0) - 24} y1={NL.y} x2={nx(50) + 30} y2={NL.y} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      </g>
      <g className="nl-ticks">
        {ticks.map((v) => {
          const h = v % 10 === 0 ? 34 : v % 5 === 0 ? 22 : 12
          return <line key={v} x1={nx(v)} y1={NL.y - h / 2} x2={nx(v)} y2={NL.y + h / 2} stroke={C.ink} strokeWidth={v % 10 === 0 ? 5 : 3} strokeLinecap="round" />
        })}
        {[0, 10, 20, 30, 40, 50].map((v) => (
          <At key={v} x={nx(v)} y={NL.y + 56}>
            <Label text={String(v)} size={40} color={C.inkSoft} />
          </At>
        ))}
      </g>
      {[0, 1, 2].map((k) => (
        <path
          key={k}
          className={`arc arc-${k}`}
          d={`M ${nx(10 * k)} ${NL.y} Q ${nx(10 * k + 5)} ${NL.y - 300} ${nx(10 * k + 10)} ${NL.y}`}
          stroke={TENS}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      {[0, 1, 2, 3].map((j) => (
        <path
          key={j}
          className={`hop hop-${j}`}
          d={`M ${nx(30 + j)} ${NL.y} Q ${nx(30.5 + j)} ${NL.y - 80} ${nx(31 + j)} ${NL.y}`}
          stroke={ONES}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
        />
      ))}
      <g className="nl-mark">
        <circle cx={nx(34)} cy={NL.y} r={14} fill={C.mustard} stroke={C.ink} strokeWidth={4} />
      </g>
      <g className="nl-34">
        <At x={nx(34) - 27} y={NL.y + 122}>
          <Label text="3" size={84} color={TENS} />
        </At>
        <At x={nx(34) + 27} y={NL.y + 122}>
          <Label text="4" size={84} color={ONES} />
        </At>
      </g>
      <g className="hopper">
        <circle r={15} fill={C.mustard} stroke={C.white} strokeWidth={4} />
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- hands (why ten) */

const SKIN = '#EDBB8F'
const SKIN_LINE = '#D69F70'
const FINGERS = [
  { x: -54, h: 80, rot: -14, w: 30 },
  { x: -18, h: 104, rot: -5, w: 32 },
  { x: 18, h: 116, rot: 3, w: 32 },
  { x: 54, h: 102, rot: 11, w: 32 },
]
const THUMB = { x: 62, y: -44, h: 92, rot: 40, w: 36 }

interface Digit {
  bx: number
  by: number
  h: number
  rot: number
  w: number
}

/** The five digits of a hand in screen order, left to right. */
function handDigits(mirror: boolean): Digit[] {
  const left: Digit[] = [...FINGERS.map((f) => ({ bx: f.x, by: -100, h: f.h, rot: f.rot, w: f.w })), { bx: THUMB.x, by: THUMB.y, h: THUMB.h, rot: THUMB.rot, w: THUMB.w }]
  if (!mirror) return left
  return left.map((d) => ({ ...d, bx: -d.bx, rot: -d.rot })).reverse()
}

function tipOf(d: Digit, hx: number, hy: number, extra: number) {
  const a = (d.rot * Math.PI) / 180
  const L = d.h + extra
  return { x: hx + d.bx + Math.sin(a) * L, y: hy + d.by - Math.cos(a) * L }
}

function Hand({ hx, hy, mirror, n0 }: { hx: number; hy: number; mirror: boolean; n0: number }) {
  const ds = handDigits(mirror)
  return (
    <g>
      {ds.map((d, i) => (
        <g key={i} transform={`translate(${hx + d.bx} ${hy + d.by}) rotate(${d.rot})`}>
          <rect x={-d.w / 2} y={-d.h} width={d.w} height={d.h + 40} rx={d.w / 2} fill={SKIN} stroke={SKIN_LINE} strokeWidth={3} />
          <g className={`lit lit-${n0 + i}`}>
            <rect x={-d.w / 2} y={-d.h} width={d.w} height={d.h + 40} rx={d.w / 2} fill={ONES} stroke={C.tealDark} strokeWidth={3} />
          </g>
        </g>
      ))}
      <rect x={hx - 75} y={hy - 128} width={150} height={140} rx={48} fill={SKIN} />
      <path d={`M ${hx - 40} ${hy - 60} Q ${hx} ${hy - 44} ${hx + 36} ${hy - 62}`} stroke={SKIN_LINE} strokeWidth={4} fill="none" strokeLinecap="round" />
      <rect x={hx - 60} y={hy} width={120} height={46} rx={14} fill={C.sky} />
    </g>
  )
}

function HandsPanel() {
  const left = handDigits(false)
  const right = handDigits(true)
  const labels = [
    ...left.map((d) => tipOf(d, HANDS.lx, HANDS.y, 36)),
    ...right.map((d) => tipOf(d, HANDS.rx, HANDS.y, 36)),
  ]
  return (
    <g className="hands" data-tutor="the two hands">
      <rect x={320} y={40} width={1010} height={495} rx={40} fill={C.white} opacity={0.96} />
      <At x={825} y={98}>
        <Label text="Why ten?" size={50} />
      </At>
      <Hand hx={HANDS.lx} hy={HANDS.y} mirror={false} n0={0} />
      <Hand hx={HANDS.rx} hy={HANDS.y} mirror n0={5} />
      {labels.map((p, n) => (
        <g key={n} className={`hnum hnum-${n}`}>
          <NumBadge x={p.x} y={p.y} n={n + 1} color={n === 9 ? TENS : C.tealDark} />
        </g>
      ))}
      <g className="h-eq">
        <At x={1015} y={330}>
          <Label text="=" size={84} color={C.inkSoft} />
        </At>
        <At x={1160} y={335} s={1.3}>
          <Bundle ribbon={TENS} />
          <TenTag y={-78} />
        </At>
        <At x={1160} y={460}>
          <Label text="one bundle" size={38} color={C.coralDark} />
        </At>
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- quick guess */

function GuessPile({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    setHints([
      'Just take a guess. Any guess is fine here!',
      'Look at how big the pile is. Is it a few sticks, or lots?',
      'Pick the button that feels closest. We will find out soon.',
    ])
    reportState(
      'A messy pile of sticks lies on a blanket (really 34 sticks, but the student is not told). The student is asked to guess about how many: "About 20", "About 35" or "About 50". Any guess is accepted: the point is to feel that counting a messy pile one by one is slow and easy to lose track of. Do not tell them the exact number yet.',
    )
  }, [reportState, setHints])
  const pick = (choice: string) => {
    if (picked) return
    setPicked(choice)
    emit({ type: 'progress', detail: `guessed ${choice}` })
    say('Good guess! It is hard to be sure, though. Counting a messy pile is slow, and it is easy to lose track. So people found a trick.')
    timer.current = window.setTimeout(onChallengeDone, 6200)
  }
  const choices = ['About 20', 'About 35', 'About 50']
  const colors = [C.violet, C.sky, C.leaf]
  return (
    <g>
      <rect x={320} y={118} width={960} height={225} rx={36} fill={C.white} opacity={0.96} />
      <At x={800} y={182}>
        <Label text="About how many sticks?" size={50} />
      </At>
      {choices.map((c, i) => (
        <SvgButton key={c} x={560 + i * 240} y={280} w={220} label={c} color={colors[i]} onClick={() => pick(c)} disabled={!!picked && picked !== c} tutor={`${c} button`} />
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- the shop game */

interface Round {
  price: number
  size: 10 | 4
  keeper: 'ama' | 'zorp'
}
const ROUNDS: Round[] = [
  { price: 23, size: 10, keeper: 'ama' },
  { price: 40, size: 10, keeper: 'ama' },
  { price: 13, size: 4, keeper: 'zorp' },
]
const HINTS = [
  [
    'Look at the price tag. What does each digit tell you?',
    'The first digit of the price counts bundles of ten. The last digit counts loose sticks.',
    'If ten loose sticks are on the counter, tie them into one bundle. One bundle is one piece instead of ten.',
  ],
  [
    'Look at the 0 in 40. What does a zero in the ones place mean?',
    'The 4 in 40 sits in the tens place. Does it count bundles or loose sticks?',
    'Count by tens as you add bundles: 10, 20, 30... Stop when you reach the price.',
  ],
  [
    'Count the dots on the price tag. How many sticks does Zorp want?',
    "Zorp's bundles hold four sticks, not ten. Count by fours: 4, 8, ...",
    'Use as many bundles of four as you can without going past the price. Then add loose sticks for the rest.',
  ],
]
const ZORP_INTRO = "Now Zorp runs the shop! Zorp counts on one hand, so Zorp's people bundle by four. Pay Zorp this many sticks, with as few pieces as you can."

const S = 0.85
const MAX_BUNDLES = 10
const TRAY_T = { x: 310, y: 345, w: 430, h: 321 }
const TRAY_O = { x: 760, y: 345, w: 420, h: 321 }
const COUNTER = { x0: 290, x1: 1200, y0: 318, y1: 690 }
const bundleSlot = (i: number) => ({ x: 361 + (i % 5) * 82, y: 458 + Math.floor(i / 5) * 106 })
function layoutFor(size: number) {
  const perRow = size === 10 ? 10 : 8
  const group = size === 10 ? 5 : 4
  return { perRow, group, maxLoose: perRow * 3 }
}
function stickSlot(i: number, size: number) {
  const { perRow, group } = layoutFor(size)
  const col = i % perRow
  const row = Math.floor(i / perRow)
  const width = (perRow - 1) * 28 + (perRow / group - 1) * 22
  return { x: 970 - width / 2 + col * 28 + Math.floor(col / group) * 22, y: 454 + row * 84 }
}
const bestFor = (r: Round) => ({ b: Math.floor(r.price / r.size), l: r.price % r.size })

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
function numberWord(n: number) {
  if (n < 20) return WORDS[n]
  if (n >= 100) return String(n)
  const t = Math.floor(n / 10)
  const o = n % 10
  return o ? `${TENS_WORDS[t]}-${WORDS[o]}` : TENS_WORDS[t]
}

type Verdict = { ok: boolean; kind: 'right' | 'extra' | 'swapped' | 'face-value' | 'base-ten' | 'off'; line: string; bubble: string }

/** What the shopkeeper makes of a payment. */
function judge(round: number, b: number, l: number, extraTries: number): Verdict {
  const r = ROUNDS[round]
  const best = bestFor(r)
  const total = b * r.size + l
  const zorp = r.keeper === 'zorp'
  const counted = zorp ? numberWord(total) : String(total)
  const who = zorp ? 'Zorp counts' : 'The shopkeeper counts'
  const over = total > r.price ? 'That is too much!' : 'That is not enough!'
  const bubble = `I count ${counted}.`
  if (total === r.price && b === best.b && l === best.l) {
    const line = [
      'Yes! Two bundles of ten and three loose sticks make 23. The 2 counts bundles, and the 3 counts loose ones.',
      'Yes! Four bundles and no loose sticks make 40. The 0 says there are zero loose ones.',
      'Yes! Three bundles of four make twelve, and one more makes thirteen. You bundled by four, just like Zorp!',
    ][round]
    return { ok: true, kind: 'right', line, bubble: 'Thank you!' }
  }
  if (total === r.price) {
    const tip = extraTries >= 1 ? ` ${zorp ? 'Four' : 'Ten'} loose sticks can be tied into one bundle.` : ''
    return { ok: false, kind: 'extra', line: `That is the right amount! Can you pay with fewer pieces?${tip}`, bubble: 'Right amount!' }
  }
  if (round === 0 && b === 3 && l === 2) {
    return { ok: false, kind: 'swapped', line: `${who} 32. That is too much! The 2 and the 3 got mixed up. In 23, which digit tells how many bundles?`, bubble }
  }
  if (round === 0) {
    return { ok: false, kind: 'off', line: `${who} ${counted}. ${over} Compare your bundles with the 2 in 23, and your loose sticks with the 3.`, bubble }
  }
  if (round === 1 && b === 0 && l === 4) {
    return { ok: false, kind: 'face-value', line: `${who} 4. That is not enough! The 4 in 40 sits in the tens place. So what does it count?`, bubble }
  }
  if (round === 1 && b === 4) {
    return { ok: false, kind: 'off', line: `${who} ${counted}. That is too much! What does the 0 in 40 tell you about loose sticks?`, bubble }
  }
  if (round === 1) {
    return { ok: false, kind: 'off', line: `${who} ${counted}. ${over} Compare your bundles with the 4 in 40, and your loose sticks with the 0.`, bubble }
  }
  if (b === 1 && l === 3) {
    return { ok: false, kind: 'base-ten', line: "Zorp counts seven. That is not enough! Zorp's bundles hold four sticks, not ten. Count the dots on the tag.", bubble }
  }
  return { ok: false, kind: 'off', line: `${who} ${counted}. ${over} Each of Zorp's bundles is four sticks. Count the dots on the tag.`, bubble }
}

function describeShop(round: number, bundles: number, loose: number, tieShown: boolean, tying: boolean, solved: boolean, lastPay: string) {
  const r = ROUNDS[round]
  const best = bestFor(r)
  const total = bundles * r.size + loose
  const zorp = r.keeper === 'zorp'
  const keeper = zorp ? 'Zorp the alien (four fingers on each hand) runs the shop' : 'Ama runs the shop'
  const price = zorp
    ? 'The price tag shows a row of thirteen dots and the word "thirteen" (no numeral on purpose), so the price is 13 sticks.'
    : `The price tag says ${r.price} (the tens digit ${Math.floor(r.price / 10)} in coral, the ones digit ${r.price % 10} in teal).`
  const unit = zorp
    ? "bundles of FOUR (violet ribbons; Zorp's people bundle by four because Zorp counts on one four-fingered hand)"
    : 'bundles of ten (coral ribbons)'
  const mixup = [
    'Likely mix-ups: paying 23 loose sticks (right amount, too many pieces), or swapping which digit means bundles (3 bundles and 2 sticks = 32).',
    'Likely mix-ups: paying 4 loose sticks (reading the 4 as ones and forgetting it sits in the tens place), or adding loose sticks when the 0 means none.',
    'Likely mix-ups: still bundling by ten, e.g. paying 1 bundle and 3 loose sticks from copying 13 as tens and ones (with bundles of four that is only seven sticks); paying 13 loose sticks (right amount, too many pieces); or repeating round 1 with 2 bundles and 3 loose (only eleven). The idea to check: count by fours, 4, 8, 12, then one more makes 13.',
  ][round]
  return [
    `Shop game ("bundle builder"), round ${round + 1} of 3. ${keeper}. ${price}`,
    `The student pays with ${unit} and loose sticks, dragging (or tapping) them from two boxes onto the counter; tapping a piece on the counter, or dragging it off, takes it back. The counter sorts pieces into a left side for bundles ("${zorp ? 'bundles of 4' : 'tens'}") and a right side for loose sticks ("ones"), each with a count badge.`,
    `On the counter now: ${bundles} bundle${bundles === 1 ? '' : 's'} and ${loose} loose stick${loose === 1 ? '' : 's'}, which is ${total} sticks in ${bundles + loose} pieces.${tieShown ? ` A "Tie ${r.size} into a bundle" button is showing.` : ''}${tying ? ' Some sticks are being tied into a bundle right now.' : ''}`,
    `Correct answer (fewest pieces): ${best.b} bundle${best.b === 1 ? '' : 's'} of ${r.size} and ${best.l} loose stick${best.l === 1 ? '' : 's'} (${best.b + best.l} pieces).`,
    mixup,
    lastPay ? `Last payment: ${lastPay}.` : 'They have not pressed Pay yet this round.',
    solved ? 'This round is solved.' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

type Kind = 'bundle' | 'stick'
interface DragState {
  kind: Kind
  from: 'bin' | 'counter'
  index: number
  x: number
  y: number
  sx: number
  sy: number
  ox: number
  oy: number
}
interface TieJob {
  id: number
  from: { x: number; y: number }[]
  to: { x: number; y: number }
  size: number
  ribbon: string
}

function BundleBuilder({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [round, setRound] = useState(0)
  const [bundles, setBundles] = useState(0)
  const [loose, setLoose] = useState(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [tie, setTie] = useState<TieJob | null>(null)
  const [solved, setSolved] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [lastPay, setLastPay] = useState('')
  const dragRef = useRef<DragState | null>(null)
  const extraTries = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const r = ROUNDS[round]
  const zorp = r.keeper === 'zorp'
  const bundleColor = zorp ? C.violet : TENS
  const lay = layoutFor(r.size)
  const total = bundles * r.size + loose
  const busy = solved || !!tie
  const canTie = !busy && loose >= r.size

  useEffect(() => {
    setHints(HINTS[round])
  }, [round, setHints])

  useEffect(() => {
    reportState(describeShop(round, bundles, loose, canTie, !!tie, solved, lastPay))
  }, [round, bundles, loose, canTie, tie, solved, lastPay, reportState])

  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d
    setDrag(d)
  }
  const inCounter = (p: { x: number; y: number }) => p.x > COUNTER.x0 && p.x < COUNTER.x1 && p.y > COUNTER.y0 && p.y < COUNTER.y1

  const add = (kind: Kind) => {
    if (busy) return
    if (kind === 'bundle') {
      if (bundles >= MAX_BUNDLES) {
        say('The bundle side is full!')
        return
      }
      setBundles(bundles + 1)
    } else {
      if (loose >= lay.maxLoose) {
        say(`The loose side is full! Try tying ${zorp ? 'four' : 'ten'} loose sticks into a bundle.`)
        return
      }
      setLoose(loose + 1)
    }
    setBubble(null)
    emit({ type: 'progress', detail: kind === 'bundle' ? 'put a bundle on the counter' : 'put a loose stick on the counter' })
  }
  const remove = (kind: Kind) => {
    if (busy) return
    if (kind === 'bundle') setBundles((b) => Math.max(0, b - 1))
    else setLoose((l) => Math.max(0, l - 1))
    setBubble(null)
    emit({ type: 'progress', detail: kind === 'bundle' ? 'took a bundle back' : 'took a loose stick back' })
  }

  const binHandlers = (kind: Kind) => ({
    onStart: (p: { x: number; y: number }) => {
      if (busy) return
      setDragBoth({ kind, from: 'bin', index: -1, x: p.x, y: p.y, sx: p.x, sy: p.y, ox: 0, oy: 0 })
    },
    onMove: (p: { x: number; y: number }) => {
      const d = dragRef.current
      if (d) setDragBoth({ ...d, x: p.x, y: p.y })
    },
    onEnd: (p: { x: number; y: number }) => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      const moved = Math.hypot(p.x - d.sx, p.y - d.sy)
      if (moved < 12 || inCounter(p)) add(kind)
    },
  })

  const pieceHandlers = (kind: Kind, index: number, slot: { x: number; y: number }) => ({
    onStart: (p: { x: number; y: number }) => {
      if (busy) return
      setDragBoth({ kind, from: 'counter', index, x: p.x, y: p.y, sx: p.x, sy: p.y, ox: slot.x - p.x, oy: slot.y - p.y })
    },
    onMove: (p: { x: number; y: number }) => {
      const d = dragRef.current
      if (d) setDragBoth({ ...d, x: p.x, y: p.y })
    },
    onEnd: (p: { x: number; y: number }) => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      const moved = Math.hypot(p.x - d.sx, p.y - d.sy)
      if (moved < 12 || !inCounter(p)) remove(kind)
    },
  })

  const doTie = () => {
    if (!canTie) return
    if (bundles >= MAX_BUNDLES) {
      say('The bundle side is full!')
      return
    }
    const from = Array.from({ length: r.size }, (_, k) => stickSlot(loose - r.size + k, r.size))
    setLoose(loose - r.size)
    setBubble(null)
    setTie({ id: Date.now(), from, to: bundleSlot(bundles), size: r.size, ribbon: bundleColor })
    emit({ type: 'progress', detail: `tied ${r.size} loose sticks into a bundle` })
  }
  const tieDone = () => {
    setBundles((b) => b + 1)
    setTie(null)
  }

  const pay = () => {
    if (busy) return
    if (bundles + loose === 0) {
      say('The counter is empty. Put some bundles or sticks on it first.')
      return
    }
    const v = judge(round, bundles, loose, extraTries.current)
    if (v.kind === 'extra') extraTries.current++
    emit({ type: 'attempt', correct: v.ok, detail: `paid ${bundles} bundle(s) of ${r.size} and ${loose} loose stick(s), ${total} in all, for a price of ${r.price} (${v.kind})` })
    setLastPay(`${bundles} bundle(s) and ${loose} loose stick(s) = ${total} sticks (${v.kind === 'right' ? 'correct' : v.kind === 'extra' ? 'right amount but more pieces than needed' : 'wrong amount'})`)
    setBubble(v.bubble)
    say(v.line)
    if (!v.ok) return
    setSolved(true)
    if (round < ROUNDS.length - 1) {
      const next = round + 1
      later(() => {
        setRound(next)
        setBundles(0)
        setLoose(0)
        setSolved(false)
        setLastPay('')
        extraTries.current = 0
        if (ROUNDS[next].keeper === 'zorp') {
          setBubble('We bundle by four!')
          say(ZORP_INTRO)
        } else {
          setBubble(null)
          say('Here comes a new price. Pay with as few pieces as you can.')
        }
      }, 6600)
    } else {
      later(onChallengeDone, 4600)
    }
  }

  const bubbleW = bubble ? Math.max(240, bubble.length * 34 * 0.62 + 64) : 0

  return (
    <g>
      <ShopBackdrop />
      {zorp ? (
        <At x={1400} y={400} data-tutor="Zorp the shopkeeper">
          <Alien waving />
        </At>
      ) : (
        <At x={1400} y={418} data-tutor="Ama the shopkeeper">
          <Shepherd />
        </At>
      )}
      <CounterTop />
      <ShopItem round={round} sold={solved} />
      <PriceTag round={round} />

      <Tray box={TRAY_T} color={bundleColor} label={zorp ? 'bundles of 4' : 'tens'} count={bundles} tutor="the bundle side of the counter" />
      <Tray box={TRAY_O} color={ONES} label="ones" count={loose} tutor="the loose stick side of the counter" />
      {Array.from({ length: bundles }, (_, i) => {
        const slot = bundleSlot(i)
        const lifted = drag?.from === 'counter' && drag.kind === 'bundle' && drag.index === i
        const pos = lifted && drag ? { x: drag.x + drag.ox, y: drag.y + drag.oy } : slot
        return <CounterPiece key={`b${round}-${i}`} kind="bundle" size={r.size} ribbon={bundleColor} x={pos.x} y={pos.y} handlers={pieceHandlers('bundle', i, slot)} />
      })}
      {Array.from({ length: loose }, (_, i) => {
        const slot = stickSlot(i, r.size)
        const lifted = drag?.from === 'counter' && drag.kind === 'stick' && drag.index === i
        const pos = lifted && drag ? { x: drag.x + drag.ox, y: drag.y + drag.oy } : slot
        return <CounterPiece key={`s${round}-${i}`} kind="stick" size={r.size} ribbon={bundleColor} x={pos.x} y={pos.y} handlers={pieceHandlers('stick', i, slot)} />
      })}
      {tie && <TieAnim key={tie.id} job={tie} onDone={tieDone} />}

      <Bin kind="bundle" x={330} size={r.size} color={bundleColor} label={zorp ? 'bundles of 4' : 'bundles of 10'} handlers={binHandlers('bundle')} tutor="the box of bundles" />
      <Bin kind="stick" x={780} size={r.size} color={ONES} label="loose sticks" handlers={binHandlers('stick')} tutor="the box of loose sticks" />

      {canTie && <SvgButton x={970} y={290} w={430} h={76} size={30} label={`Tie ${r.size} into a bundle`} color={bundleColor} onClick={doTie} tutor="Tie into a bundle button" />}
      <SvgButton x={1390} y={505} w={280} h={110} size={52} label="Pay" color={C.leaf} onClick={pay} disabled={busy} tutor="Pay button" />
      <rect x={1255} y={767} width={270} height={66} rx={33} fill={C.cream} />
      <At x={1390} y={801}>
        <Label text={`Shop ${round + 1} of 3`} size={34} color={C.inkSoft} weight={700} />
      </At>

      {bubble && (
        <At x={1328} y={196}>
          <Bubble text={bubble} w={bubbleW} h={80} size={34} tail="right" />
        </At>
      )}

      {drag?.from === 'bin' && (
        <g transform={`translate(${drag.x} ${drag.y})`} pointerEvents="none">
          <g transform={`scale(${S * 1.1})`}>{drag.kind === 'bundle' ? <PieceBundle size={r.size} ribbon={bundleColor} /> : <Stick />}</g>
        </g>
      )}
    </g>
  )
}

function ShopBackdrop() {
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill="#EBCFA6" />
      <rect x={0} y={0} width={1600} height={340} fill="#FCEBD2" />
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i}>
          <rect x={i * 100} y={0} width={100} height={52} fill={i % 2 ? C.cream : C.mustard} />
          <ellipse cx={i * 100 + 50} cy={52} rx={50} ry={18} fill={i % 2 ? C.cream : C.mustard} />
        </g>
      ))}
    </g>
  )
}

function CounterTop() {
  return (
    <g>
      <rect x={0} y={330} width={1600} height={345} fill={C.wood} />
      <rect x={0} y={318} width={1600} height={26} rx={6} fill={C.woodLight} />
      <rect x={0} y={668} width={1600} height={26} fill={C.woodDark} />
    </g>
  )
}

function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/** The thing for sale, sitting on the counter. */
function ShopItem({ round, sold }: { round: number; sold: boolean }) {
  return (
    <g data-tutor="the thing for sale">
      {round === 0 && (
        <g>
          {[
            [128, 270],
            [170, 264],
            [212, 270],
            [149, 244],
            [191, 244],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={22} fill={C.berry} />
              <circle cx={x - 7} cy={y - 7} r={6} fill={C.white} opacity={0.35} />
              <path d={`M ${x} ${y - 20} q 6 -10 14 -10`} stroke={C.leaf} strokeWidth={5} fill="none" strokeLinecap="round" />
            </g>
          ))}
          <path d="M 98 272 L 242 272 L 224 330 L 116 330 Z" fill={C.wood} stroke={C.woodDark} strokeWidth={4} strokeLinejoin="round" />
          <path d="M 108 292 L 232 292 M 114 312 L 226 312" stroke={C.woodDark} strokeWidth={3} opacity={0.6} />
        </g>
      )}
      {round === 1 && (
        <g>
          <ellipse cx={170} cy={284} rx={80} ry={48} fill={C.leaf} />
          {[-48, -16, 16, 48].map((dx) => (
            <path key={dx} d={`M ${170 + dx} 240 Q ${170 + dx * 1.25} 284 ${170 + dx} 328`} stroke="#2E8A52" strokeWidth={8} fill="none" strokeLinecap="round" />
          ))}
          <ellipse cx={142} cy={262} rx={18} ry={9} fill={C.white} opacity={0.35} />
        </g>
      )}
      {round === 2 && (
        <g>
          <ellipse cx={170} cy={318} rx={74} ry={16} fill={C.violetDark} />
          <path d={starPath(170, 262, 56, 26)} fill={C.mustard} stroke={C.mustardDark} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={152} cy={250} r={7} fill={C.white} opacity={0.5} />
        </g>
      )}
      {sold && (
        <g>
          <circle cx={250} cy={222} r={28} fill={ONES} stroke={C.white} strokeWidth={4} />
          <path d="M 237 222 l 9 9 l 17 -18" stroke={C.white} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

function PriceTag({ round }: { round: number }) {
  const r = ROUNDS[round]
  return (
    <g data-tutor="the price tag">
      <line x1={420} y1={48} x2={400} y2={120} stroke={C.inkSoft} strokeWidth={4} />
      <line x1={610} y1={48} x2={630} y2={120} stroke={C.inkSoft} strokeWidth={4} />
      <path d="M 336 212 Q 280 240 236 250" stroke={C.inkSoft} strokeWidth={3} fill="none" strokeDasharray="2 7" strokeLinecap="round" />
      {r.keeper === 'zorp' ? (
        <rect x={313} y={114} width={404} height={186} rx={26} fill={C.white} stroke={C.mustard} strokeWidth={7} />
      ) : (
        <rect x={333} y={114} width={364} height={186} rx={26} fill={C.white} stroke={C.mustard} strokeWidth={7} />
      )}
      <At x={515} y={150}>
        <Label text="Price" size={32} color={C.inkSoft} weight={700} />
      </At>
      {r.keeper === 'zorp' ? (
        <g>
          {Array.from({ length: r.price }, (_, i) => (
            <circle key={i} cx={515 + (i - (r.price - 1) / 2) * 28} cy={212} r={10} fill={C.ink} />
          ))}
          <At x={515} y={262}>
            <Label text={numberWord(r.price)} size={42} />
          </At>
        </g>
      ) : (
        <text x={515} y={232} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={120}>
          <tspan fill={TENS}>{Math.floor(r.price / 10)}</tspan>
          <tspan fill={ONES}>{r.price % 10}</tspan>
        </text>
      )}
    </g>
  )
}

function Tray({ box, color, label, count, tutor }: { box: { x: number; y: number; w: number; h: number }; color: string; label: string; count: number; tutor: string }) {
  const size = label.length > 6 ? 30 : 38
  const w = label.length * size * 0.62 + 48
  return (
    <g data-tutor={tutor}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={26} fill={C.cream} stroke={color} strokeWidth={5} />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={26} fill={color} opacity={0.08} />
      <Pill x={box.x + 22 + w / 2} y={box.y + 42} text={label} color={color} size={size} h={56} />
      <circle cx={box.x + box.w - 46} cy={box.y + 42} r={32} fill={color} />
      <text x={box.x + box.w - 46} y={box.y + 44} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={40} fill={C.white}>
        {count}
      </text>
    </g>
  )
}

/** Four sticks tied with a ribbon: Zorp's kind of bundle. */
function Bundle4({ ribbon }: { ribbon: string }) {
  return (
    <g>
      {[0, 1, 2, 3].map((n) => {
        const f = formOffset(4, n)
        return (
          <g key={n} transform={`translate(${f.x} 0) rotate(${f.r})`}>
            <Stick />
          </g>
        )
      })}
      <Ribbon size={4} color={ribbon} />
    </g>
  )
}

function PieceBundle({ size, ribbon }: { size: number; ribbon: string }) {
  return size === 4 ? <Bundle4 ribbon={ribbon} /> : <Bundle ribbon={ribbon} />
}

type DragFns = {
  onStart: (p: { x: number; y: number }) => void
  onMove: (p: { x: number; y: number }) => void
  onEnd: (p: { x: number; y: number }) => void
}

function CounterPiece({ kind, size, ribbon, x, y, handlers }: { kind: Kind; size: number; ribbon: string; x: number; y: number; handlers: DragFns }) {
  const drag = useDrag(handlers)
  return (
    <g transform={`translate(${x} ${y})`} {...drag}>
      {kind === 'bundle' ? <rect x={-41} y={-50} width={82} height={100} fill="transparent" /> : <rect x={-14} y={-42} width={28} height={84} fill="transparent" />}
      <g transform={`scale(${S})`}>{kind === 'bundle' ? <PieceBundle size={size} ribbon={ribbon} /> : <Stick />}</g>
    </g>
  )
}

/** A crate with an endless supply of bundles or loose sticks. */
function Bin({ kind, x, size, color, label, handlers, tutor }: { kind: Kind; x: number; size: number; color: string; label: string; handlers: DragFns; tutor: string }) {
  const drag = useDrag(handlers)
  const w = 390
  const pieces =
    kind === 'bundle'
      ? [
          { dx: 80, dy: 718, r: -10 },
          { dx: 160, dy: 708, r: 4 },
          { dx: 240, dy: 712, r: -4 },
          { dx: 315, dy: 720, r: 9 },
        ]
      : Array.from({ length: 13 }, (_, i) => ({ dx: 50 + i * 24, dy: 716 + ((i * 7) % 3) * 6, r: ((i * 37) % 30) - 15 }))
  const plateW = label.length * 32 * 0.62 + 44
  return (
    <g {...drag} data-tutor={tutor}>
      <rect x={x} y={704} width={w} height={34} rx={10} fill={C.woodDark} />
      {pieces.map((p, i) => (
        <At key={i} x={x + p.dx} y={p.dy} rotate={p.r} s={0.8}>
          {kind === 'bundle' ? <PieceBundle size={size} ribbon={color} /> : <Stick />}
        </At>
      ))}
      <rect x={x} y={730} width={w} height={140} rx={16} fill={C.wood} />
      <path d={`M ${x + 14} 780 H ${x + w - 14} M ${x + 14} 830 H ${x + w - 14}`} stroke={C.woodDark} strokeWidth={4} opacity={0.35} />
      <rect x={x + w / 2 - plateW / 2} y={772} width={plateW} height={56} rx={28} fill={color} />
      <At x={x + w / 2} y={802}>
        <Label text={label} size={32} color={C.white} />
      </At>
    </g>
  )
}

/** Gathers loose sticks together, ties a ribbon round them, and carries the bundle to the bundle side. */
function TieAnim({ job, onDone }: { job: TieJob; onDone: () => void }) {
  const ref = useRef<SVGGElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  useLayoutEffect(() => {
    const cx = job.from.reduce((s, p) => s + p.x, 0) / job.from.length
    const cy = job.from.reduce((s, p) => s + p.y, 0) / job.from.length
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done.current() })
      job.from.forEach((p, i) => {
        const f = formOffset(job.size, i)
        tl.set(`.ts-${i}`, { x: p.x, y: p.y, rotation: 0, transformOrigin: '50% 50%' }, 0)
        tl.to(`.ts-${i}`, { x: cx + f.x * S, y: cy, rotation: f.r, duration: 0.45, ease: 'power2.inOut' }, 0.05)
      })
      tl.set('.tr', { x: cx, y: cy, scaleX: 0, opacity: 1, transformOrigin: '50% 50%' }, 0)
      tl.to('.tr', { scaleX: 1, duration: 0.3, ease: 'back.out(2)' }, 0.55)
      tl.to('.tall', { x: job.to.x - cx, y: job.to.y - cy, duration: 0.55, ease: 'power2.inOut' }, 1.05)
    }, ref)
    return () => ctx.revert()
  }, [job])
  return (
    <g ref={ref} pointerEvents="none">
      <g className="tall">
        {job.from.map((_, i) => (
          <g key={i} className={`ts-${i}`}>
            <g transform={`scale(${S})`}>
              <Stick />
            </g>
          </g>
        ))}
        <g className="tr" opacity={0}>
          <g transform={`scale(${S})`}>
            <Ribbon size={job.size} color={job.ribbon} />
          </g>
        </g>
      </g>
    </g>
  )
}

export const stop4: Stop = {
  id: 'bundles',
  title: 'Bundling by ten',
  branch: 'howMany',

  beats: BEATS,
  Scene,
}
