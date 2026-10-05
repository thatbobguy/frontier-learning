import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alien, At, Cloud, Hills, Label, Pebble, Sheep, Shepherd, Sky, Sun, SvgButton, Tree } from '../art/kit'
import { C, FONT } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import { useDrag } from '../engine/svg'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Stop 3: Numbers are names.
 * Carrying a pebble for everything gets heavy, so people named amounts. Seven pebbles,
 * seven fingers and seven marks match one for one: the same amount, named "seven". The
 * squiggle 7 is only one way to write it. Then the amounts line up in order: columns of
 * pebbles fade into a number line, where further along means more. Last, Zorp's market
 * checks that a symbol is just a name for an amount, whatever it looks like.
 */

const BEATS = [
  { id: 'heavy', say: 'Matching works. But imagine carrying a pebble for every sheep, every fish, and every jar of grain. That gets heavy!' },
  { id: 'names', say: 'So people gave each amount a name. This many is one. This many is two. This many is three.' },
  { id: 'same-seven', say: 'Seven pebbles, seven fingers, seven marks. They look different, but it is the same amount. That amount has a name: seven.' },
  { id: 'symbols', say: 'The squiggle 7 is just a symbol, a way to write that amount. People in different places wrote seven in different ways.' },
  { id: 'find-seven', say: 'Your turn! Tap the pile that has seven.', challenge: true, quick: true },
  { id: 'number-line', say: 'Numbers have an order too. Line up one more pebble each time, and you get a number line. Each step to the right is one more.' },
  { id: 'further-is-more', say: 'The further along the line, the bigger the number. Seven is further than three, so seven is more.' },
  {
    id: 'alien-market',
    say: "Now you try! Zorp the alien trader writes numbers with Zorp symbols. Use Zorp's chart to fill each basket with the right number of star fruits.",
    challenge: true,
  },
]

/* ---------------------------------------------------------------- helpers */

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

function starPath(cx: number, cy: number, R: number, r: number, points = 5) {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

const SKIN = '#C98B5E'
const SKIN_DARK = '#A86F47'

/* ---------------------------------------------------------------- layout */

// Beat 1: Ama and the heavy sack.
const AMA = { x: 820, y: 800 }
const SACK = { x: -60, y: -135 } // bottom centre of the sack, on Ama's back (Ama's own coordinates)
const SACK_TOP = 206
const SACK_SIZES = [0.5, 0.8, 1.1, 1.45]
const THINK = { x: 1030, y: 120, w: 500, h: 520 }
const THINK_ROWS = [215, 380, 545]
const THINK_COLS = [1115, 1225, 1335, 1445]

// Beat 2: one, two, three.
const NAME_PILES = [
  { x: 400, word: 'one', pts: [{ x: 0, y: 0 }] },
  { x: 800, word: 'two', pts: [{ x: -38, y: 8 }, { x: 36, y: -8 }] },
  { x: 1200, word: 'three', pts: [{ x: -44, y: 18 }, { x: 42, y: 14 }, { x: -2, y: -30 }] },
]

// Beat 3: seven pebbles, seven fingers, seven marks.
const colX = (i: number) => 430 + i * 100
const ROW_MARKS = 200
const ROW_PEBBLES = 410
const HAND_Y = 845
const HAND_S = 1.3
const HANDS = [
  { x: 650, mirror: false, up: [true, true, true, true, true] }, // thumb, index, middle, ring, pinky
  { x: 990, mirror: true, up: [false, true, true, false, false] },
]

// Beat 4: the seven pile with ways of writing seven around it.
const PILE = { x: 800, y: 530, r: 130 }
const PILE7 = scatter(7, 92, 78, 54, 77)
const CARD_W = 240
const CARD_H = 210
const CARDS = [
  { kind: 'ours', x: 800, y: 200, label: 'today' },
  { kind: 'egypt', x: 360, y: 320, label: 'old Egypt' },
  { kind: 'rome', x: 1240, y: 320, label: 'old Rome' },
  { kind: 'china', x: 360, y: 735, label: 'China' },
  { kind: 'maya', x: 1240, y: 735, label: 'the Maya' },
] as const

// Beats 6 and 7: the number line.
const NL_Y = 700
const nx = (k: number) => 200 + 120 * k

/* ---------------------------------------------------------------- scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const sackTopY = (s: number) => AMA.y + SACK.y - SACK_TOP * s + 18

      // Starting state.
      tl.set(['.board', '.names', '.symbols', '.nl', '.think', '.oof', '.sweat'], { opacity: 0 }, 0)
      tl.set(['.world', '.s7'], { opacity: 1 }, 0)
      tl.set('.ama', { x: -320, opacity: 0 }, 0)
      tl.set('.ama-strain', { scaleX: 1, scaleY: 1, rotation: 0, transformOrigin: '50% 100%' }, 0)
      tl.set('.sack', { scale: SACK_SIZES[0], transformOrigin: '50% 100%' }, 0)
      tl.set('.think', { scale: 0.6, transformOrigin: '0% 100%' }, 0)
      tl.set('.oof', { scale: 0.3, transformOrigin: '0% 100%' }, 0)
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          tl.set(`.item-${r}-${c}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
          tl.set(`.fly-${r * 4 + c}`, { x: THINK_COLS[c], y: THINK_ROWS[r] + 30, opacity: 0 }, 0)
        }
      }
      NAME_PILES.forEach((p, k) => {
        tl.set(`.n-mat-${k}`, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, 0)
        p.pts.forEach((_, j) => tl.set(`.n-peb-${k}-${j}`, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, 0))
        tl.set(`.n-word-${k}`, { opacity: 0, y: 30 }, 0)
      })
      tl.set('.n-title', { opacity: 0, y: -20 }, 0)
      for (let i = 0; i < 7; i++) {
        tl.set(`.s7-peb-${i}`, { x: 0, y: 0, opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, 0)
        tl.set(`.s7-mark-${i}`, { opacity: 0, scaleY: 0, transformOrigin: '50% 100%' }, 0)
        tl.set([`.s7-la-${i}`, `.s7-lb-${i}`], { opacity: 0 }, 0)
      }
      tl.set('.s7-hands', { opacity: 0, y: 120 }, 0)
      tl.set(['.s7-lab-peb', '.s7-lab-fin', '.s7-lab-mark', '.s7-brace', '.s7-same'], { opacity: 0 }, 0)
      tl.set('.s7-word', { opacity: 0, x: 0, y: 0, scale: 0.4, transformOrigin: '50% 50%' }, 0)
      tl.set('.sym-mat', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, 0)
      CARDS.forEach((_, k) => {
        tl.set(`.sym-card-${k}`, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, 0)
        tl.set(`.sym-line-${k}`, { opacity: 0 }, 0)
      })
      for (let k = 1; k <= 10; k++) {
        tl.set(`.nl-col-${k}`, { opacity: 1, scaleX: 1, scaleY: 1, transformOrigin: '50% 100%' }, 0)
        for (let j = 0; j < k; j++) tl.set(`.nl-p-${k}-${j}`, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, 0)
        tl.set(`.nl-plus-${k}`, { opacity: 0, y: 10 }, 0)
      }
      for (let k = 0; k <= 10; k++) {
        tl.set(`.nl-tick-${k}`, { scaleY: 0, transformOrigin: '50% 50%' }, 0)
        tl.set(`.nl-num-${k}`, { opacity: 0, y: -14, scale: 1, transformOrigin: '50% 50%' }, 0)
      }
      tl.set('.nl-axis', { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set('.nl-hop', { x: nx(0), y: NL_Y, opacity: 0 }, 0)
      tl.set(['.nl-arrow'], { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set(['.nl-bar3', '.nl-bar7'], { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set(['.nl-bigger', '.nl-lab3', '.nl-lab7', '.nl-more'], { opacity: 0 }, 0)
      tl.set(['.nl-ring3', '.nl-ring7'], { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, 0)

      // b0: Ama hauls a sack that gets heavier with every pebble.
      tl.addLabel('b0', 0.01)
      tl.to('.ama', { x: 0, opacity: 1, duration: 1.2, ease: 'power2.out' }, 'b0')
      tl.fromTo('.ama-hop', { y: 0 }, { y: -8, duration: 0.15, repeat: 7, yoyo: true, ease: 'sine.inOut' }, 'b0')
      tl.to('.think', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 'b0+=1.3')
      for (let r = 0; r < 3; r++) {
        const start = 2.0 + r * 1.85
        for (let c = 0; c < 4; c++) {
          tl.to(`.item-${r}-${c}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, `b0+=${start + c * 0.1}`)
          const k = r * 4 + c
          const at = `b0+=${start + 0.55 + c * 0.14}`
          tl.to(`.fly-${k}`, { opacity: 1, duration: 0.08 }, at)
          tl.to(`.fly-${k}`, { x: AMA.x + SACK.x, duration: 0.6, ease: 'none' }, at)
          tl.to(`.fly-${k}`, { y: sackTopY(SACK_SIZES[r]), duration: 0.6, ease: 'back.in(1.6)' }, at)
          tl.to(`.fly-${k}`, { opacity: 0, duration: 0.08 }, `b0+=${start + 1.12 + c * 0.14}`)
        }
        tl.to('.sack', { scale: SACK_SIZES[r + 1], duration: 0.35, ease: 'back.out(2.5)' }, `b0+=${start + 1.6}`)
        tl.to('.ama-strain', { scaleY: 1 - 0.03 * (r + 1), scaleX: 1 + 0.015 * (r + 1), duration: 0.3 }, '<')
      }
      // "That gets heavy!"
      tl.to('.think', { opacity: 0, duration: 0.4 }, 'b0+=7.7')
      tl.to('.ama-strain', { rotation: -3, duration: 0.11, repeat: 5, yoyo: true, ease: 'sine.inOut' }, 'b0+=7.8')
      tl.to('.ama-strain', { rotation: 4, scaleY: 0.86, duration: 0.3, ease: 'power2.out' }, '>')
      tl.to('.oof', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b0+=8.0')
      tl.to('.sweat', { opacity: 1, duration: 0.2 }, 'b0+=8.3')
      tl.fromTo('.sweat-drip', { y: 0 }, { y: 16, duration: 0.6, repeat: 1, ease: 'power1.in' }, 'b0+=8.3')

      // b1: each amount gets a name.
      tl.addLabel('b1', '+=0.4')
      tl.to('.board', { opacity: 1, duration: 0.6 }, 'b1')
      tl.to('.names', { opacity: 1, duration: 0.3 }, 'b1+=0.3')
      tl.to('.n-title', { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, 'b1+=0.6')
      NAME_PILES.forEach((p, k) => {
        const at = 3.0 + k * 1.7
        tl.to(`.n-mat-${k}`, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, `b1+=${at}`)
        p.pts.forEach((_, j) => tl.to(`.n-peb-${k}-${j}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, `b1+=${at + 0.25 + j * 0.18}`))
        tl.to(`.n-word-${k}`, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, `b1+=${at + 1.0}`)
      })
      tl.to({}, { duration: 0.4 }, 'b1+=8.0')

      // b2: seven pebbles, seven fingers, seven marks, matched one for one.
      tl.addLabel('b2', '+=0.3')
      tl.to('.names', { opacity: 0, duration: 0.4 }, 'b2')
      tl.to('.s7-lab-peb', { opacity: 1, duration: 0.3 }, 'b2+=0.3')
      for (let i = 0; i < 7; i++) tl.to(`.s7-peb-${i}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, `b2+=${0.35 + i * 0.09}`)
      tl.to('.s7-hands', { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.4)' }, 'b2+=1.3')
      tl.to('.s7-lab-fin', { opacity: 1, duration: 0.3 }, '<')
      tl.to('.s7-lab-mark', { opacity: 1, duration: 0.3 }, 'b2+=2.2')
      for (let i = 0; i < 7; i++) tl.to(`.s7-mark-${i}`, { opacity: 1, scaleY: 1, duration: 0.18, ease: 'power2.out' }, `b2+=${2.2 + i * 0.12}`)
      for (let i = 0; i < 7; i++) {
        tl.to(`.s7-la-${i}`, { opacity: 1, duration: 0.25 }, `b2+=${3.4 + i * 0.32}`)
        tl.to(`.s7-lb-${i}`, { opacity: 1, duration: 0.25 }, '<')
        tl.to(`.s7-peb-${i}`, { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1 }, '<')
      }
      tl.to('.s7-brace', { opacity: 1, duration: 0.4 }, 'b2+=5.8')
      tl.to('.s7-same', { opacity: 1, duration: 0.4 }, '<0.2')
      tl.to('.s7-word', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 'b2+=7.0')
      tl.to({}, { duration: 0.6 }, 'b2+=7.6')

      // b3: the seven pile, with ways of writing seven around it.
      tl.addLabel('b3', '+=0.3')
      tl.to(['.s7-hands', '.s7-marks', '.s7-lines', '.s7-lab-peb', '.s7-lab-fin', '.s7-lab-mark', '.s7-brace', '.s7-same'], { opacity: 0, duration: 0.4 }, 'b3')
      tl.to('.symbols', { opacity: 1, duration: 0.3 }, 'b3')
      tl.to('.sym-mat', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b3+=0.2')
      for (let i = 0; i < 7; i++) {
        tl.to(`.s7-peb-${i}`, { x: PILE.x + PILE7[i].x - colX(i), y: PILE.y + PILE7[i].y - ROW_PEBBLES, duration: 0.7, ease: 'power2.inOut' }, `b3+=${0.2 + i * 0.04}`)
      }
      tl.to('.s7-word', { x: PILE.x - 1340, y: PILE.y + 190 - 440, scale: 0.6, duration: 0.7, ease: 'power2.inOut' }, 'b3+=0.2')
      tl.to('.sym-line-0', { opacity: 1, duration: 0.3 }, 'b3+=1.2')
      tl.to('.sym-card-0', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 'b3+=1.3')
      for (let k = 1; k < CARDS.length; k++) {
        tl.to(`.sym-line-${k}`, { opacity: 1, duration: 0.3 }, `b3+=${4.4 + (k - 1) * 1.0}`)
        tl.to(`.sym-card-${k}`, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, '<0.1')
      }
      tl.to({}, { duration: 0.6 }, 'b3+=8.2')

      // b4: quick tap (the piles are drawn by FindSeven).
      tl.addLabel('b4', '+=0.3')
      tl.to(['.symbols', '.s7'], { opacity: 0, duration: 0.3 }, 'b4')

      // b5: columns of one more pebble each time fade into a number line.
      tl.addLabel('b5', '+=0.4')
      tl.to('.nl', { opacity: 1, duration: 0.2 }, 'b5')
      for (let k = 1; k <= 10; k++) {
        for (let j = 0; j < k; j++) {
          tl.to(`.nl-p-${k}-${j}`, { opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(2)' }, `b5+=${0.3 + (k - 1) * 0.38 + j * 0.025}`)
        }
      }
      for (let k = 1; k <= 10; k++) {
        tl.to(`.nl-col-${k}`, { scaleY: 0.04, scaleX: 0.3, opacity: 0, duration: 0.55, ease: 'power2.in' }, `b5+=${4.6 + k * 0.04}`)
      }
      tl.to('.nl-axis', { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 'b5+=4.7')
      for (let k = 0; k <= 10; k++) {
        tl.to(`.nl-tick-${k}`, { scaleY: 1, duration: 0.25, ease: 'back.out(2)' }, `b5+=${5.1 + k * 0.04}`)
        tl.to(`.nl-num-${k}`, { opacity: 1, y: 0, duration: 0.3 }, `b5+=${5.3 + k * 0.06}`)
      }
      tl.to('.nl-hop', { opacity: 1, duration: 0.3 }, 'b5+=6.2')
      for (let k = 1; k <= 10; k++) {
        const at = 6.5 + (k - 1) * 0.34
        tl.to('.nl-hop', { x: nx(k), duration: 0.3, ease: 'none' }, `b5+=${at}`)
        tl.to('.nl-hop', { y: NL_Y - 56, duration: 0.15, ease: 'power1.out' }, `b5+=${at}`)
        tl.to('.nl-hop', { y: NL_Y, duration: 0.15, ease: 'power1.in' }, `b5+=${at + 0.15}`)
        tl.to(`.nl-plus-${k}`, { opacity: 1, y: 0, duration: 0.2 }, `b5+=${at + 0.05}`)
        tl.to(`.nl-num-${k}`, { scale: 1.3, duration: 0.12, yoyo: true, repeat: 1 }, `b5+=${at + 0.28}`)
      }

      // b6: further along means more.
      tl.addLabel('b6', '+=0.5')
      tl.to(['.nl-hop', '.nl-pluses'], { opacity: 0, duration: 0.3 }, 'b6')
      tl.to('.nl-arrow', { scaleX: 1, duration: 1.2, ease: 'power1.inOut' }, 'b6+=0.3')
      tl.to('.nl-bigger', { opacity: 1, duration: 0.3 }, 'b6+=1.3')
      tl.to('.nl-ring3', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 'b6+=2.8')
      tl.to('.nl-bar3', { scaleX: 1, duration: 0.8, ease: 'power1.inOut' }, 'b6+=2.9')
      tl.to('.nl-lab3', { opacity: 1, duration: 0.3 }, 'b6+=3.6')
      tl.to('.nl-ring7', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 'b6+=4.1')
      tl.to('.nl-bar7', { scaleX: 1, duration: 1.3, ease: 'power1.inOut' }, 'b6+=4.2')
      tl.to('.nl-lab7', { opacity: 1, duration: 0.3 }, 'b6+=5.4')
      tl.to('.nl-more', { opacity: 1, duration: 0.4 }, 'b6+=6.1')
      tl.to('.nl-bar7', { scaleY: 1.15, duration: 0.2, yoyo: true, repeat: 1, transformOrigin: '0% 50%' }, 'b6+=6.3')
      tl.to({}, { duration: 0.6 }, 'b6+=6.8')

      // b7: Zorp's market (drawn by AlienMarket).
      tl.addLabel('b7', '+=0.4')
      tl.to(['.nl', '.board'], { opacity: 0, duration: 0.5 }, 'b7')
      tl.addLabel('end', '+=0.3')
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <HeavyWorld />
      <g className="board">
        <rect x={0} y={0} width={1600} height={900} fill={C.cream} />
        <rect x={40} y={34} width={250} height={64} rx={32} fill={C.coral} />
        <At x={165} y={68}><Label text="How many?" size={32} color={C.white} /></At>
      </g>
      <NamesBoard />
      <SymbolsBoard />
      <SevenBoard />
      <NumberLine />

      {id === 'find-seven' && <FindSeven {...props} />}
      {id === 'alien-market' && <AlienMarket {...props} />}
    </g>
  )
}

/* ---------------------------------------------------------------- beat 1: heavy */

function HeavyWorld() {
  const items: ((c: number) => ReactNode)[] = [
    () => <At y={-8} s={0.58}><Sheep blink={false} /></At>,
    (c) => <At s={1.3}><Fish tint={c % 2 ? C.sky : C.teal} /></At>,
    () => <At s={1.3}><Jar /></At>,
  ]
  return (
    <g className="world">
      <Sky />
      <At x={210} y={150}><Sun r={60} /></At>
      <At x={560} y={150} s={0.8}><Cloud /></At>
      <Hills />
      <At x={120} y={650} s={0.75}><Tree /></At>
      <g className="ama" data-tutor="Ama with a heavy sack">
        <At x={AMA.x} y={AMA.y}>
          <g className="ama-hop">
            <g className="ama-strain">
              <At x={SACK.x} y={SACK.y}>
                <g className="sack"><Sack /></g>
              </At>
              <Shepherd />
              <path d="M 34 -166 L -44 -72" stroke={C.woodDark} strokeWidth={12} strokeLinecap="round" />
            </g>
          </g>
        </At>
      </g>
      <g className="sweat">
        <g className="sweat-drip">
          <path d="M 878 540 q 16 24 0 32 q -16 -8 0 -32 Z" fill={C.sky} />
          <path d="M 762 556 q 13 20 0 27 q -13 -7 0 -27 Z" fill={C.sky} />
        </g>
      </g>
      <g className="oof">
        <At x={880} y={520}>
          <rect x={0} y={-80} width={180} height={84} rx={36} fill={C.white} />
          <path d="M 0 0 L 14 -20 L 40 -10 Z" fill={C.white} />
          <At x={90} y={-38}><Label text="Oof!" size={44} /></At>
        </At>
      </g>
      <g className="think" data-tutor="things to keep track of">
        <circle cx={892} cy={540} r={9} fill={C.white} opacity={0.94} />
        <circle cx={935} cy={575} r={14} fill={C.white} opacity={0.94} />
        <circle cx={992} cy={605} r={20} fill={C.white} opacity={0.94} />
        <rect x={THINK.x} y={THINK.y} width={THINK.w} height={THINK.h} rx={60} fill={C.white} opacity={0.94} />
        {THINK_ROWS.map((y, r) =>
          THINK_COLS.map((x, c) => (
            <g key={`${r}-${c}`} className={`item-${r}-${c}`}>
              <At x={x} y={y}>{items[r](c)}</At>
            </g>
          )),
        )}
      </g>
      <g>
        {Array.from({ length: 12 }, (_, k) => (
          <g key={k} className={`fly-${k}`}>
            <g transform="scale(1.1)"><Pebble seed={k} /></g>
          </g>
        ))}
      </g>
    </g>
  )
}

/** A big cloth sack of pebbles. Origin at the bottom centre, about 200 wide and 180 tall. */
function Sack() {
  return (
    <g>
      <path d="M -62 -150 C -128 -112 -124 -2 -60 2 L 60 2 C 124 -2 128 -112 62 -150 Z" fill={C.clay} />
      <path d="M -70 -120 C -100 -80 -96 -24 -54 -12" stroke={C.clayDark} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.45} />
      {[
        [-40, -60],
        [20, -95],
        [48, -40],
        [-10, -30],
      ].map(([x, y], i) => (
        <path key={i} d={`M ${x - 14} ${y} q 14 -12 28 0`} stroke={C.clayDark} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} />
      ))}
      <path d="M -46 -148 Q -22 -158 -24 -174 L 24 -174 Q 22 -158 46 -148 Z" fill={C.clayDark} />
      <path d="M -24 -172 L -52 -200 Q 0 -190 52 -200 L 24 -172 Z" fill={C.clay} />
      <ellipse cx={0} cy={-197} rx={46} ry={9} fill={C.clayDark} />
      <ellipse cx={-20} cy={-202} rx={15} ry={11} fill={C.stone} />
      <ellipse cx={8} cy={-206} rx={14} ry={11} fill={C.stoneDark} />
      <ellipse cx={30} cy={-200} rx={13} ry={10} fill="#B9B2A7" />
      <rect x={-36} y={-170} width={72} height={14} rx={7} fill={C.mustard} />
    </g>
  )
}

function Fish({ tint = C.sky }: { tint?: string }) {
  return (
    <g>
      <path d="M -26 0 L -46 -18 L -42 0 L -46 18 Z" fill={tint} />
      <ellipse cx={4} cy={0} rx={34} ry={20} fill={tint} />
      <path d="M 0 -18 Q 8 -30 18 -18 Z" fill={tint} />
      <circle cx={22} cy={-5} r={5} fill={C.white} />
      <circle cx={23} cy={-5} r={2.6} fill={C.ink} />
      <path d="M -6 -10 Q 0 0 -6 10" stroke={C.white} strokeWidth={3} fill="none" opacity={0.6} strokeLinecap="round" />
    </g>
  )
}

function Jar() {
  return (
    <g>
      <ellipse cx={0} cy={34} rx={26} ry={5} fill={C.shadow} />
      <path d="M -18 -26 C -40 -10 -38 30 -16 34 L 16 34 C 38 30 40 -10 18 -26 Z" fill={C.clay} />
      <rect x={-20} y={-36} width={40} height={14} rx={6} fill={C.clayDark} />
      {[-10, 0, 10].map((x) => (
        <ellipse key={x} cx={x} cy={-38} rx={7} ry={5} fill={C.mustard} />
      ))}
      <path d="M -24 4 Q 0 12 24 4" stroke={C.clayDark} strokeWidth={4} fill="none" opacity={0.6} />
    </g>
  )
}

/* ---------------------------------------------------------------- beat 2: names */

function NamesBoard() {
  return (
    <g className="names">
      <g className="n-title">
        <At x={800} y={215}><Label text="Each amount gets a name" size={56} /></At>
      </g>
      {NAME_PILES.map((p, k) => (
        <g key={k} data-tutor={`the pile named ${p.word}`}>
          <g className={`n-mat-${k}`}>
            <ellipse cx={p.x} cy={480} rx={160} ry={120} fill="#F4DFBF" />
          </g>
          {p.pts.map((q, j) => (
            <g key={j} className={`n-peb-${k}-${j}`}>
              <At x={p.x + q.x * 1.15} y={480 + q.y * 1.15} s={2}><Pebble seed={k + j} /></At>
            </g>
          ))}
          <g className={`n-word-${k}`}>
            <At x={p.x} y={680}><Label text={p.word} size={80} color={C.coralDark} /></At>
          </g>
        </g>
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- beat 3: same seven */

const FINGERS = [
  // index, middle, ring, pinky for a right hand seen palm-on (thumb on the left)
  { x: -36, len: 80, rot: -12 },
  { x: -12, len: 90, rot: -4 },
  { x: 12, len: 84, rot: 4 },
  { x: 36, len: 66, rot: 12 },
]
const THUMB = { x: -54, y: -80, len: 64, rot: -50 }
const FINGER_BASE = -128

function rad(deg: number) {
  return (deg * Math.PI) / 180
}

/** Fingertips that are held up, left to right, in stage coordinates. */
function fingerTips(hand: (typeof HANDS)[number]): Pt[] {
  const local: Pt[] = []
  if (hand.up[0]) local.push({ x: THUMB.x + THUMB.len * Math.sin(rad(THUMB.rot)), y: THUMB.y - THUMB.len * Math.cos(rad(THUMB.rot)) })
  FINGERS.forEach((f, i) => {
    if (hand.up[i + 1]) local.push({ x: f.x + f.len * Math.sin(rad(f.rot)), y: FINGER_BASE - f.len * Math.cos(rad(f.rot)) })
  })
  const pts = local.map((p) => ({ x: hand.x + (hand.mirror ? -1 : 1) * HAND_S * p.x, y: HAND_Y + HAND_S * p.y }))
  return pts.sort((a, b) => a.x - b.x)
}

const TIPS = HANDS.flatMap(fingerTips)

/** A cartoon hand, palm towards us, wrist at the origin. `up` lists thumb, index, middle, ring, pinky. */
function Hand({ up }: { up: boolean[] }) {
  return (
    <g>
      {FINGERS.map((f, i) =>
        up[i + 1] ? (
          <g key={i} transform={`translate(${f.x} ${FINGER_BASE}) rotate(${f.rot})`}>
            <rect x={-11} y={-f.len - 2} width={22} height={f.len + 20} rx={11} fill={SKIN} />
            <ellipse cx={0} cy={-f.len + 8} rx={6} ry={7} fill={C.white} opacity={0.35} />
          </g>
        ) : (
          <rect key={i} x={f.x - 11} y={FINGER_BASE - 24} width={22} height={34} rx={11} fill={SKIN} stroke={SKIN_DARK} strokeWidth={3} />
        ),
      )}
      {up[0] ? (
        <g transform={`translate(${THUMB.x} ${THUMB.y}) rotate(${THUMB.rot})`}>
          <rect x={-12} y={-THUMB.len - 2} width={24} height={THUMB.len + 20} rx={12} fill={SKIN} />
          <ellipse cx={0} cy={-THUMB.len + 8} rx={6} ry={7} fill={C.white} opacity={0.35} />
        </g>
      ) : null}
      <rect x={-60} y={-142} width={120} height={122} rx={42} fill={SKIN} />
      {!up[0] && <rect x={-50} y={-92} width={70} height={26} rx={13} fill={SKIN} stroke={SKIN_DARK} strokeWidth={2} strokeOpacity={0.6} transform="rotate(-12 -15 -79)" />}
      <path d="M -30 -60 Q 0 -48 26 -64" stroke={SKIN_DARK} strokeWidth={3} fill="none" opacity={0.5} strokeLinecap="round" />
      <rect x={-48} y={-34} width={96} height={110} rx={16} fill={C.sky} />
      <rect x={-48} y={-34} width={96} height={18} rx={9} fill={C.skyDark} />
    </g>
  )
}

function SevenBoard() {
  return (
    <g className="s7">
      <g className="s7-lab-mark"><At x={350} y={ROW_MARKS} ><Label text="marks" size={34} color={C.inkSoft} weight={700} anchor="end" /></At></g>
      <g className="s7-lab-peb"><At x={350} y={ROW_PEBBLES}><Label text="pebbles" size={34} color={C.inkSoft} weight={700} anchor="end" /></At></g>
      <g className="s7-lab-fin"><At x={350} y={720}><Label text="fingers" size={34} color={C.inkSoft} weight={700} anchor="end" /></At></g>
      <g className="s7-lines">
        {TIPS.map((t, i) => (
          <g key={i}>
            <line className={`s7-la-${i}`} x1={colX(i)} y1={ROW_MARKS + 58} x2={colX(i)} y2={ROW_PEBBLES - 34} stroke={C.coral} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" />
            <line className={`s7-lb-${i}`} x1={colX(i)} y1={ROW_PEBBLES + 34} x2={t.x} y2={t.y - 16} stroke={C.coral} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" />
          </g>
        ))}
      </g>
      <g className="s7-marks" data-tutor="seven marks">
        {TIPS.map((_, i) => (
          <g key={i} className={`s7-mark-${i}`}>
            <line x1={colX(i) - 4} y1={ROW_MARKS - 45} x2={colX(i) + 4} y2={ROW_MARKS + 45} stroke={C.ink} strokeWidth={11} strokeLinecap="round" />
          </g>
        ))}
      </g>
      <g className="s7-hands" data-tutor="seven fingers">
        {HANDS.map((h, k) => (
          <g key={k} transform={`translate(${h.x} ${HAND_Y}) scale(${h.mirror ? -HAND_S : HAND_S} ${HAND_S})`}>
            <Hand up={h.up} />
          </g>
        ))}
      </g>
      <g data-tutor="seven pebbles">
        {TIPS.map((_, i) => (
          <g key={i} className={`s7-peb-${i}`}>
            <At x={colX(i)} y={ROW_PEBBLES} s={1.5}><Pebble seed={i} /></At>
          </g>
        ))}
      </g>
      <g className="s7-brace">
        <path d="M 1100 150 Q 1132 150 1132 200 L 1132 410 Q 1132 450 1164 450 Q 1132 450 1132 490 L 1132 760 Q 1132 810 1100 810" stroke={C.coral} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="s7-same">
        <At x={1340} y={530}><Label text="same amount" size={36} color={C.inkSoft} weight={700} /></At>
      </g>
      <g className="s7-word" data-tutor="the word seven">
        <At x={1340} y={440}><Label text="seven" size={100} color={C.coralDark} /></At>
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- beat 4: symbols */

function cardLine(cx: number, cy: number) {
  const dx = cx - PILE.x
  const dy = cy - PILE.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const tx = dx === 0 ? Infinity : CARD_W / 2 / Math.abs(dx)
  const ty = dy === 0 ? Infinity : CARD_H / 2 / Math.abs(dy)
  const t = 1 - Math.min(tx, ty)
  return {
    x1: PILE.x + ux * (PILE.r + 12),
    y1: PILE.y + uy * (PILE.r + 12),
    x2: PILE.x + dx * t - ux * 12,
    y2: PILE.y + dy * t - uy * 12,
  }
}

function SevenGlyph({ kind }: { kind: (typeof CARDS)[number]['kind'] }) {
  switch (kind) {
    case 'ours':
      return (
        <text textAnchor="middle" dominantBaseline="middle" y={8} fontFamily={FONT} fontWeight={800} fontSize={130} fill={C.ink}>
          7
        </text>
      )
    case 'rome':
      return (
        <text textAnchor="middle" dominantBaseline="middle" y={6} fontFamily="Georgia, 'Times New Roman', serif" fontWeight={700} fontSize={92} fill={C.ink}>
          VII
        </text>
      )
    case 'egypt':
      return (
        <g>
          {[-39, -13, 13, 39].map((x) => (
            <rect key={`t${x}`} x={x - 5} y={-56} width={10} height={46} rx={5} fill={C.ink} />
          ))}
          {[-26, 0, 26].map((x) => (
            <rect key={`b${x}`} x={x - 5} y={4} width={10} height={46} rx={5} fill={C.ink} />
          ))}
        </g>
      )
    case 'maya':
      return (
        <g>
          <circle cx={-26} cy={-22} r={14} fill={C.ink} />
          <circle cx={26} cy={-22} r={14} fill={C.ink} />
          <rect x={-62} y={6} width={124} height={26} rx={12} fill={C.ink} />
        </g>
      )
    case 'china':
      return (
        <g stroke={C.ink} strokeWidth={15} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -54 -8 L 52 -28" />
          <path d="M -12 -62 L -12 26 Q -12 50 12 50 L 42 50 Q 56 50 56 30" />
        </g>
      )
  }
}

function SymbolsBoard() {
  return (
    <g className="symbols">
      {CARDS.map((c, k) => {
        const l = cardLine(c.x, c.y)
        return <line key={k} className={`sym-line-${k}`} {...l} stroke={C.coral} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" />
      })}
      <g className="sym-mat" data-tutor="the pile of seven pebbles">
        <circle cx={PILE.x} cy={PILE.y} r={PILE.r} fill="#F4DFBF" stroke={C.coral} strokeWidth={5} />
      </g>
      {CARDS.map((c, k) => (
        <g key={k} className={`sym-card-${k}`} data-tutor={`seven written ${c.kind === 'ours' ? 'our way' : `by ${c.label}`}`}>
          <rect x={c.x - CARD_W / 2} y={c.y - CARD_H / 2 + 6} width={CARD_W} height={CARD_H} rx={28} fill={C.ink} opacity={0.12} />
          <rect x={c.x - CARD_W / 2} y={c.y - CARD_H / 2} width={CARD_W} height={CARD_H} rx={28} fill={C.white} />
          <At x={c.x} y={c.y - 22}><SevenGlyph kind={c.kind} /></At>
          <At x={c.x} y={c.y + 74}><Label text={c.label} size={30} color={C.inkSoft} weight={700} /></At>
        </g>
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- beat 5: find seven */

const FIND_PILES = [
  { n: 9, x: 330, name: 'left pile', pts: scatter(9, 150, 100, 54, 11) },
  { n: 5, x: 800, name: 'middle pile', pts: scatter(5, 150, 100, 60, 23) },
  { n: 7, x: 1270, name: 'right pile', pts: scatter(7, 150, 100, 56, 41) },
]
const FIND_Y = 530

function FindSeven({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [tried, setTried] = useState<number[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    setHints([
      'Pick one pile and match each pebble to one finger.',
      'Seven is all the fingers on one hand and two more.',
      'Try lining the pebbles of a pile up in your head, then match them to your fingers.',
    ])
  }, [setHints])

  useEffect(() => {
    const triedNames = tried.map((i) => `${FIND_PILES[i].name} (${FIND_PILES[i].n})`)
    reportState(
      `Quick tap: three scattered piles of pebbles. The left pile has 9, the middle pile has 5, the right pile has 7. The student should tap the right pile, the one with 7. ${
        triedNames.length ? `Already tapped (and lined up so they can be checked): ${triedNames.join(', ')}.` : 'Nothing tapped yet.'
      }${done ? ' They found the pile of seven.' : ''} Likely mix-up: guessing by how big or spread out a pile looks instead of matching each pebble to a finger.`,
    )
  }, [tried, done, reportState])

  const tap = (i: number) => {
    if (done) return
    const p = FIND_PILES[i]
    if (p.n === 7) {
      setDone(true)
      emit({ type: 'attempt', correct: true, detail: 'tapped the pile of seven' })
      say('Yes! You matched it to seven.')
      window.setTimeout(onChallengeDone, 2200)
      return
    }
    if (!tried.includes(i)) setTried((t) => [...t, i])
    emit({ type: 'attempt', correct: false, detail: `tapped the pile of ${p.n}` })
    say('Not quite. To check, match each pebble to one finger, or line the pebbles up. Then try again!')
  }

  return (
    <g>
      <At x={800} y={215}><Label text="Which pile has seven?" size={52} /></At>
      {FIND_PILES.map((p, i) => {
        const lined = tried.includes(i)
        const right = done && p.n === 7
        return (
          <g key={i} onClick={() => tap(i)} style={{ cursor: done ? 'default' : 'pointer' }} data-tutor={p.name} role="button">
            <ellipse cx={p.x} cy={FIND_Y} rx={215} ry={160} fill="#F4DFBF" stroke={right ? C.teal : 'none'} strokeWidth={right ? 10 : 0} />
            {p.pts.map((q, j) => {
              const tx = lined ? p.x + (j - (p.n - 1) / 2) * 42 : p.x + q.x
              const ty = lined ? FIND_Y : FIND_Y + q.y
              const s = lined ? 1.15 : 1.4
              return (
                <g key={j} style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})`, transition: 'transform 0.6s ease' }}>
                  <Pebble seed={j + i} />
                </g>
              )
            })}
            {right && (
              <At x={p.x} y={FIND_Y + 205}><Label text="seven" size={56} color={C.tealDark} /></At>
            )}
          </g>
        )
      })}
    </g>
  )
}

/* ---------------------------------------------------------------- beats 6 and 7: the number line */

function NumberLine() {
  return (
    <g className="nl">
      {Array.from({ length: 10 }, (_, i) => {
        const k = i + 1
        return (
          <g key={k} className={`nl-col-${k}`}>
            {Array.from({ length: k }, (_, j) => (
              <g key={j} className={`nl-p-${k}-${j}`}>
                <At x={nx(k)} y={NL_Y - 28 - j * 40} s={1.25}><Pebble seed={j + k} /></At>
              </g>
            ))}
          </g>
        )
      })}
      <g className="nl-arrow">
        <line x1={nx(0) + 10} y1={430} x2={nx(10)} y2={430} stroke={C.coral} strokeWidth={10} strokeLinecap="round" />
        <path d={`M ${nx(10) - 10} 408 L ${nx(10) + 22} 430 L ${nx(10) - 10} 452`} stroke={C.coral} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="nl-bigger">
        <At x={nx(10) + 20} y={380}><Label text="bigger" size={44} color={C.coralDark} anchor="end" /></At>
      </g>
      <g className="nl-bar7" data-tutor="the bar for seven">
        <Bar n={7} y={510} color={C.coral} />
      </g>
      <g className="nl-bar3" data-tutor="the bar for three">
        <Bar n={3} y={590} color={C.teal} />
      </g>
      <g className="nl-lab7"><At x={nx(7) + 22} y={541}><Label text="seven" size={40} color={C.coralDark} anchor="start" /></At></g>
      <g className="nl-lab3"><At x={nx(3) + 22} y={621}><Label text="three" size={40} color={C.tealDark} anchor="start" /></At></g>
      <g className="nl-more">
        <At x={800} y={200}><Label text="7 is more than 3" size={60} /></At>
      </g>
      <g data-tutor="the number line">
        <g className="nl-axis">
          <line x1={nx(0) - 30} y1={NL_Y} x2={nx(10) + 50} y2={NL_Y} stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
          <path d={`M ${nx(10) + 34} ${NL_Y - 18} L ${nx(10) + 58} ${NL_Y} L ${nx(10) + 34} ${NL_Y + 18}`} stroke={C.ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {Array.from({ length: 11 }, (_, k) => (
          <g key={k}>
            <g className={`nl-tick-${k}`}>
              <line x1={nx(k)} y1={NL_Y - 20} x2={nx(k)} y2={NL_Y + 20} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
            </g>
            <g className={`nl-num-${k}`}>
              <At x={nx(k)} y={NL_Y + 62}><Label text={String(k)} size={48} /></At>
            </g>
          </g>
        ))}
      </g>
      <g className="nl-ring3"><circle cx={nx(3)} cy={NL_Y + 62} r={38} fill="none" stroke={C.teal} strokeWidth={7} /></g>
      <g className="nl-ring7"><circle cx={nx(7)} cy={NL_Y + 62} r={38} fill="none" stroke={C.coral} strokeWidth={7} /></g>
      <g className="nl-pluses">
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} className={`nl-plus-${i + 1}`}>
            <At x={nx(i) + 60} y={NL_Y - 100}><Label text="+1" size={32} color={C.coralDark} /></At>
          </g>
        ))}
      </g>
      <g className="nl-hop" data-tutor="the hopping marker">
        <circle cx={0} cy={-44} r={22} fill={C.coral} />
        <path d="M -15 -32 L 15 -32 L 0 -8 Z" fill={C.coral} />
        <circle cx={0} cy={-44} r={9} fill={C.white} />
      </g>
    </g>
  )
}

/** A bar of n steps, each step one pebble long, starting at 0 on the number line. */
function Bar({ n, y, color }: { n: number; y: number; color: string }) {
  const h = 62
  return (
    <g>
      <rect x={nx(0)} y={y} width={nx(n) - nx(0)} height={h} rx={14} fill={color} />
      {Array.from({ length: n - 1 }, (_, i) => (
        <line key={i} x1={nx(i + 1)} y1={y + 8} x2={nx(i + 1)} y2={y + h - 8} stroke={C.white} strokeWidth={4} opacity={0.7} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <At key={`p${i}`} x={nx(i) + 60} y={y + h / 2}><Pebble seed={i} /></At>
      ))}
    </g>
  )
}

/* ---------------------------------------------------------------- beat 8: Zorp's market */

type Kind = 'swirl' | 'eye' | 'bolt'
const ZORP: Record<Kind, { amount: number; name: string }> = {
  swirl: { amount: 3, name: 'big swirl' },
  eye: { amount: 5, name: 'eye' },
  bolt: { amount: 8, name: 'little bolt' },
}
const CHART_ORDER: Kind[] = ['swirl', 'eye', 'bolt']
const MARKET_ROUNDS: { kind: Kind; mode: 'fill' | 'name' }[] = [
  { kind: 'eye', mode: 'fill' },
  { kind: 'bolt', mode: 'fill' },
  { kind: 'swirl', mode: 'name' },
]
const NAME_TILES: Kind[] = ['bolt', 'swirl', 'eye']

/** The chart piles: the 3 is spread wide and the 8 packed tight, so looks cannot stand in for amounts. */
const CHART_PILES: Record<Kind, Pt[]> = {
  swirl: [{ x: -80, y: -45 }, { x: 78, y: -28 }, { x: -6, y: 50 }],
  eye: [{ x: -58, y: -38 }, { x: 18, y: -50 }, { x: 74, y: 2 }, { x: -32, y: 30 }, { x: 40, y: 48 }],
  bolt: [
    { x: -40, y: -36 }, { x: 2, y: -40 }, { x: 44, y: -32 }, { x: -58, y: 6 },
    { x: -16, y: 2 }, { x: 26, y: 4 }, { x: -36, y: 44 }, { x: 8, y: 42 },
  ],
}

const CHART = { x: 20, y: 100, w: 470, h: 780 }
const CHART_ROWS = [295, 518, 741]
const COUNTER_Y = 540
const ZORP_POS = { x: 1400, y: 640, s: 1.25 }
const BASKET = { x: 1120, y: 700 }
const BASKET_R3 = { x: 1170, y: 700 }
const CLOTH = { x: 540, y: 600, w: 360, h: 240 }
const SUPPLY: Pt[] = (() => {
  const r = seeded(5)
  const pts: Pt[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      pts.push({
        x: CLOTH.x + CLOTH.w / 2 + (col - 1.5) * 84 + (row % 2 ? 14 : -14) + (r() - 0.5) * 18,
        y: CLOTH.y + CLOTH.h / 2 + (row - 1) * 72 + (r() - 0.5) * 16,
      })
    }
  }
  return pts
})()
const ZORP_BASKET: Pt[] = [{ x: -96, y: -30 }, { x: 4, y: -74 }, { x: 100, y: -34 }]

function basketSlot(j: number): Pt {
  const row = j < 6 ? 0 : 1
  const col = j % 6
  return { x: BASKET.x - 105 + col * 42 + (row ? 14 : 0), y: BASKET.y - 16 - row * 40 }
}

function inBasketZone(p: Pt) {
  return p.x > BASKET.x - 180 && p.x < BASKET.x + 180 && p.y > BASKET.y - 150 && p.y < BASKET.y + 120
}

/** One of Zorp's made-up number symbols, centred on the origin. The swirl is the biggest. */
function ZorpSymbol({ kind, color = C.violetDark }: { kind: Kind; color?: string }) {
  if (kind === 'swirl') {
    const pts: string[] = []
    const turns = 2.3
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      const a = t * turns * Math.PI * 2
      const r = 5 + 52 * t
      pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`)
    }
    return <path d={`M ${pts.join(' L ')}`} stroke={color} strokeWidth={11} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
  if (kind === 'eye') {
    return (
      <g>
        <path d="M -40 0 Q 0 -34 40 0 Q 0 34 -40 0 Z" stroke={color} strokeWidth={9} fill="none" strokeLinejoin="round" />
        <circle r={9} fill={color} />
      </g>
    )
  }
  return <path d="M 7 -22 L -9 2 L 7 2 L -6 22" stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
}

function StarFruit({ r = 22 }: { r?: number }) {
  return (
    <g>
      <ellipse cx={0} cy={r * 0.85} rx={r * 0.9} ry={r * 0.25} fill={C.shadow} />
      <path d={starPath(0, 0, r, r * 0.58)} fill={C.mustard} stroke={C.mustardDark} strokeWidth={r * 0.16} strokeLinejoin="round" />
      <path d={starPath(0, 0, r * 0.5, r * 0.3)} fill="#FFE08A" />
      <circle r={r * 0.12} fill={C.mustardDark} />
    </g>
  )
}

const STRAW = '#EBC877'
const STRAW_DARK = '#B5832F'
const STRAW_LIGHT = '#F7DE9F'

function BasketBack() {
  return <ellipse cx={0} cy={0} rx={150} ry={24} fill={STRAW_DARK} />
}

function BasketFront() {
  return (
    <g pointerEvents="none">
      <ellipse cx={0} cy={112} rx={130} ry={14} fill={C.ink} opacity={0.25} />
      <path d="M -150 0 L 150 0 L 118 104 Q 0 116 -118 104 Z" fill={STRAW} />
      {[34, 68].map((y) => (
        <path key={y} d={`M ${-150 + y * 0.31} ${y} Q 0 ${y + 12} ${150 - y * 0.31} ${y}`} stroke={STRAW_DARK} strokeWidth={5} fill="none" opacity={0.6} />
      ))}
      {[-90, -30, 30, 90].map((x) => (
        <line key={x} x1={x} y1={6} x2={x * 0.8} y2={104} stroke={STRAW_DARK} strokeWidth={4} opacity={0.45} />
      ))}
      <rect x={-156} y={-10} width={312} height={22} rx={11} fill={STRAW_LIGHT} stroke={STRAW_DARK} strokeWidth={3} />
    </g>
  )
}

/** A speech bubble with its tail pointing to (tx, ty). */
function SpeechBubble({ x, y, w, h, tx, ty, text, size }: { x: number; y: number; w: number; h: number; tx: number; ty: number; text: string; size: number }) {
  return (
    <g data-tutor="Zorp's speech bubble">
      <path d={`M ${x + w - 90} ${y + h - 4} L ${tx} ${ty} L ${x + w - 40} ${y + h - 4} Z`} fill={C.white} />
      <rect x={x} y={y} width={w} height={h} rx={h / 2.4} fill={C.white} />
      <At x={x + w / 2} y={y + h / 2 + 2}><Label text={text} size={size} /></At>
    </g>
  )
}

function AlienMarket({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [round, setRound] = useState(0)
  const [basket, setBasket] = useState<number[]>([])
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null)
  const [status, setStatus] = useState<'idle' | 'right' | 'miss'>('idle')
  const [glow, setGlow] = useState<Kind | null>(null)
  const [picked, setPicked] = useState<Kind | null>(null)
  const timer = useRef<number | null>(null)
  const { kind, mode } = MARKET_ROUNDS[round]
  const target = ZORP[kind].amount

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    setHints(
      mode === 'fill'
        ? [
            "Find Zorp's symbol on the chart. The pile next to it shows how many it means.",
            'Match one star fruit in your basket to one star fruit in that chart pile. Keep going until every chart fruit has a partner.',
            'Do not go by how big the symbol looks. Only the pile next to it on the chart tells you how many.',
          ]
        : [
            "Look at Zorp's basket, then look at the piles on the chart.",
            "Match each fruit in Zorp's basket to one fruit in a chart pile. The pile that comes out even, with none left over, is the one.",
            'A symbol can look big or small. Only its pile on the chart tells you how many it means.',
          ],
    )
  }, [mode, setHints])

  useEffect(() => {
    const key = "Zorp's chart: the big swirl symbol (drawn biggest) means 3 star fruits, the medium eye symbol means 5, the little bolt symbol (drawn smallest) means 8. On the chart the pile of 3 is spread out wide and the pile of 8 is packed tight, on purpose."
    const mix = "Likely mix-up: going by the symbol's size (thinking the little bolt is a small amount or the big swirl a big one), or by how spread out a chart pile looks, instead of matching one fruit to one fruit with the chart pile."
    if (mode === 'fill') {
      reportState(
        `Zorp's market game, basket ${round + 1} of 3. ${key} Zorp is holding up the ${ZORP[kind].name} symbol, so the correct answer is ${target} star fruits. The student drags star fruits from the pile on the cloth into the basket (dragging one back out removes it), then taps Give to Zorp. The basket now has ${basket.length} star fruit${basket.length === 1 ? '' : 's'}.${
          status === 'miss' ? ` Their last basket was not right; the ${ZORP[kind].name} row of the chart is now highlighted.` : ''
        }${status === 'right' ? ' They got it right.' : ''} ${mix}`,
      )
    } else {
      reportState(
        `Zorp's market game, round 3 of 3 (reverse). ${key} Zorp has handed over a basket with 3 star fruits (spread out) and asks which symbol it is. The student taps one of three symbol tiles: little bolt, big swirl, eye. Correct answer: the big swirl (3).${
          picked && picked !== 'swirl' ? ` They last picked the ${ZORP[picked].name}, which is wrong.` : ''
        }${status === 'right' ? ' They picked the big swirl, which is right.' : ''} ${mix}`,
      )
    }
  }, [round, kind, mode, target, basket.length, status, picked, reportState])

  const busy = status === 'right'

  const dropFruit = (i: number, p: Pt) => {
    setDrag(null)
    if (busy) return
    const has = basket.includes(i)
    if (inBasketZone(p) && !has) {
      setBasket((b) => [...b, i])
      if (status === 'miss') setStatus('idle')
      emit({ type: 'progress', detail: 'put a star fruit in the basket' })
    } else if (!inBasketZone(p) && has) {
      setBasket((b) => b.filter((k) => k !== i))
      if (status === 'miss') setStatus('idle')
      emit({ type: 'progress', detail: 'took a star fruit out of the basket' })
    }
  }

  const give = () => {
    if (busy) return
    const n = basket.length
    const ok = n === target
    emit({ type: 'attempt', correct: ok, detail: `gave ${n} star fruits for the ${ZORP[kind].name} (${target})` })
    if (ok) {
      setStatus('right')
      setGlow(null)
      say(
        round === 0
          ? 'Yes! Your basket matches the eye pile, one fruit for one fruit. That is five!'
          : 'Yes! Eight star fruits, just like the bolt pile. A little symbol can mean a lot!',
      )
      timer.current = window.setTimeout(() => {
        setRound((r) => r + 1)
        setBasket([])
        setStatus('idle')
        say(round === 0 ? "Next basket! Look at Zorp's new symbol." : 'Now Zorp gives you a basket. Which Zorp symbol is it? Tap it.')
      }, 5600)
      return
    }
    setStatus('miss')
    setGlow(kind)
    const other = CHART_ORDER.find((k) => k !== kind && ZORP[k].amount === n)
    if (n === 0) {
      say("The basket is empty! Drag some star fruits into it first. Use the pile next to Zorp's symbol on the chart.")
    } else if (other) {
      say(`Hmm, that is how many the ${ZORP[other].name} means. Zorp is holding up the ${ZORP[kind].name}. Match your basket to its pile on the chart, one fruit for one fruit.`)
    } else if (n < target) {
      say("Zorp checks the chart. Your basket has fewer than the pile next to Zorp's symbol. Match them up, one fruit for one fruit, to see how many more you need.")
    } else {
      say("Zorp checks the chart. Your basket has more than the pile next to Zorp's symbol. Match them up, one fruit for one fruit, and take out the extras.")
    }
  }

  const pick = (k: Kind) => {
    if (busy) return
    setPicked(k)
    const ok = k === kind
    emit({ type: 'attempt', correct: ok, detail: `picked the ${ZORP[k].name} for a basket of 3` })
    if (ok) {
      setStatus('right')
      setGlow(null)
      say('Yes! Three fruits match the big swirl. A big symbol can name a small amount!')
      timer.current = window.setTimeout(onChallengeDone, 2600)
      return
    }
    setStatus('miss')
    setGlow(k)
    say(
      k === 'bolt'
        ? "The little bolt looks small, but look at its pile on the chart. Match Zorp's fruits to it, one for one. Do they come out even?"
        : "Match Zorp's fruits to the pile next to the eye, one for one. Do they come out even? If not, try another pile.",
    )
  }

  const bubble =
    mode === 'fill'
      ? status === 'right'
        ? 'Thank you!'
        : status === 'miss'
          ? 'Hmm, not this many.'
          : 'This many, please!'
      : status === 'right'
        ? 'Yes! Thank you!'
        : status === 'miss'
          ? 'Hmm, look again.'
          : 'Which symbol is this?'

  const fruitPos = (i: number): Pt => {
    const j = basket.indexOf(i)
    return j >= 0 ? basketSlot(j) : SUPPLY[i]
  }
  const bPos = mode === 'fill' ? BASKET : BASKET_R3

  return (
    <g>
      <Sky top="#B8ACF4" low="#ECE8FF" />
      <g>
        <circle cx={610} cy={190} r={58} fill="#F9C7B8" />
        <circle cx={592} cy={172} r={14} fill="#F2A996" opacity={0.7} />
        <circle cx={628} cy={210} r={9} fill="#F2A996" opacity={0.7} />
        <ellipse cx={610} cy={190} rx={98} ry={22} fill="none" stroke="#FFE39A" strokeWidth={8} transform="rotate(-14 610 190)" />
      </g>
      <rect x={0} y={760} width={1600} height={140} fill="#9C8FD9" />

      {/* Zorp behind the counter, holding up the symbol on a sign */}
      <At x={ZORP_POS.x} y={ZORP_POS.y} s={ZORP_POS.s} data-tutor="Zorp the alien trader"><Alien /></At>
      <line x1={1505} y1={528} x2={1490} y2={318} stroke={C.woodDark} strokeWidth={12} strokeLinecap="round" />
      <circle cx={1505} cy={526} r={20} fill="#5CCB8A" />
      <g data-tutor="Zorp's sign">
        <rect x={1395} y={148} width={190} height={176} rx={22} fill={C.woodDark} />
        <rect x={1405} y={158} width={170} height={156} rx={16} fill={C.cream} />
        <At x={1490} y={236}>
          {mode === 'fill' ? <ZorpSymbol kind={kind} /> : <Label text="?" size={96} color={C.violetDark} />}
        </At>
      </g>
      <SpeechBubble x={720} y={250} w={540} h={110} tx={1312} ty={410} text={bubble} size={36} />

      {/* the counter */}
      <rect x={500} y={COUNTER_Y} width={1100} height={360} fill={C.wood} />
      <rect x={500} y={COUNTER_Y} width={1100} height={30} fill={C.woodLight} />
      {[640, 740, 840].map((y) => (
        <line key={y} x1={500} y1={y} x2={1600} y2={y} stroke={C.woodDark} strokeWidth={4} opacity={0.3} />
      ))}

      <ZorpChart glow={glow} />

      {mode === 'fill' ? (
        <g>
          <rect x={CLOTH.x} y={CLOTH.y} width={CLOTH.w} height={CLOTH.h} rx={26} fill={C.teal} data-tutor="the star fruit pile" />
          <At x={bPos.x} y={bPos.y}><BasketBack /></At>
          <g data-tutor="the basket">
            <At x={bPos.x} y={bPos.y}><BasketFront /></At>
          </g>
          {SUPPLY.map((_, i) => {
            const p = fruitPos(i)
            return (
              <DraggableFruit
                key={`${round}-${i}`}
                i={i}
                x={p.x}
                y={p.y}
                hidden={drag?.i === i}
                disabled={busy}
                onMove={(q) => setDrag({ i, ...q })}
                onDrop={(q) => dropFruit(i, q)}
              />
            )
          })}
          {drag && (
            <g transform={`translate(${drag.x} ${drag.y}) scale(1.15)`} pointerEvents="none">
              <StarFruit />
            </g>
          )}
          <SvgButton x={1440} y={700} w={290} h={80} label="Give to Zorp" color={C.violet} onClick={give} disabled={busy || basket.length === 0} tutor="Give to Zorp button" />
        </g>
      ) : (
        <g>
          <At x={bPos.x} y={bPos.y}><BasketBack /></At>
          <g data-tutor="Zorp's basket">
            {ZORP_BASKET.map((q, j) => (
              <At key={j} x={bPos.x + q.x} y={bPos.y + q.y}><StarFruit /></At>
            ))}
            <At x={bPos.x} y={bPos.y}><BasketFront /></At>
          </g>
          {NAME_TILES.map((k, t) => {
            const x = 600 + t * 160
            const chosen = picked === k
            const stroke = chosen ? (status === 'right' ? C.teal : C.coral) : 'none'
            return (
              <g key={k} onClick={() => pick(k)} style={{ cursor: busy ? 'default' : 'pointer' }} data-tutor={`${ZORP[k].name} symbol button`} role="button">
                <rect x={x - 70} y={642} width={140} height={156} rx={22} fill={C.ink} opacity={0.18} />
                <rect x={x - 70} y={636} width={140} height={156} rx={22} fill={C.white} stroke={stroke} strokeWidth={chosen ? 8 : 0} />
                <At x={x} y={714} s={0.95}><ZorpSymbol kind={k} /></At>
              </g>
            )
          })}
        </g>
      )}
      {status === 'right' && (
        <g>
          <circle cx={bPos.x} cy={bPos.y - 140} r={36} fill={C.teal} stroke={C.white} strokeWidth={5} />
          <path d={`M ${bPos.x - 17} ${bPos.y - 140} l 12 12 l 22 -24`} stroke={C.white} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  )
}

function ZorpChart({ glow }: { glow: Kind | null }) {
  return (
    <g data-tutor="Zorp's chart">
      <rect x={CHART.x} y={CHART.y + 8} width={CHART.w} height={CHART.h} rx={30} fill={C.ink} opacity={0.15} />
      <rect x={CHART.x} y={CHART.y} width={CHART.w} height={CHART.h} rx={30} fill={C.cream} stroke={C.violet} strokeWidth={6} />
      <At x={CHART.x + CHART.w / 2} y={CHART.y + 58}><Label text="Zorp's chart" size={42} color={C.violetDark} /></At>
      {CHART_ORDER.map((k, r) => {
        const y = CHART_ROWS[r]
        const lit = glow === k
        return (
          <g key={k} data-tutor={`${ZORP[k].name} row of the chart`}>
            <rect x={CHART.x + 14} y={y - 96} width={CHART.w - 28} height={192} rx={24} fill={lit ? '#FFF0C2' : 'none'} stroke={lit ? C.mustard : 'none'} strokeWidth={lit ? 7 : 0} />
            <rect x={40} y={y - 82} width={150} height={164} rx={20} fill={C.white} />
            <At x={115} y={y}><ZorpSymbol kind={k} /></At>
            <At x={213} y={y + 2}><Label text="=" size={44} color={C.inkSoft} /></At>
            <rect x={236} y={y - 82} width={236} height={164} rx={20} fill={C.teal} opacity={0.9} />
            {CHART_PILES[k].map((q, j) => (
              <At key={j} x={354 + q.x} y={y + q.y}><StarFruit r={17} /></At>
            ))}
          </g>
        )
      })}
    </g>
  )
}

function DraggableFruit({
  i,
  x,
  y,
  hidden,
  disabled,
  onMove,
  onDrop,
}: {
  i: number
  x: number
  y: number
  hidden: boolean
  disabled: boolean
  onMove: (p: Pt) => void
  onDrop: (p: Pt) => void
}) {
  // While dragging, this stays in place (so it keeps the pointer) and a copy follows the finger.
  const drag = useDrag({ onMove: (p) => !disabled && onMove(p), onEnd: onDrop })
  return (
    <g transform={`translate(${x} ${y})`} {...drag} opacity={hidden ? 0.25 : 1} data-tutor={`star fruit ${i + 1}`}>
      <circle r={37} fill="transparent" />
      <StarFruit />
    </g>
  )
}

export const stop3: Stop = {
  id: 'names',
  title: 'Numbers are names',
  branch: 'howMany',
  beats: BEATS,
  Scene,
}
