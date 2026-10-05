import { useEffect, useRef, useState, type ReactNode } from 'react'
import { At, Bundle, Hills, Label, Sky, Stick, SvgButton } from '../art/kit'
import { C, FONT } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import { toStage, useDrag } from '../engine/svg'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Stop 5: Together and apart (the teal "How do amounts change?" branch).
 * Same bundles and mats as Stop 4: a bundle of ten (coral ribbon) lives in the tens
 * column, loose sticks (teal) live in the ones column. Adding puts bundles with bundles
 * and sticks with sticks; ten loose sticks get tied into a new bundle. Taking away runs
 * it backwards, untying a bundle when there are not enough loose sticks. Then the same
 * moves on a number line, and a seesaw game where the student balances two amounts.
 */

const BEATS = [
  { id: 'change', say: 'Now that amounts have names, we can see how they change. Putting amounts together is called adding.' },
  { id: 'add', say: 'Two bundles and five sticks, plus one bundle and three sticks. Bundles go with bundles. Sticks go with sticks. That makes three bundles and eight sticks: 38.' },
  { id: 'overflow', say: 'Sometimes the loose sticks overflow. Seven sticks plus five sticks is twelve loose sticks. Ten of them get tied into a brand new bundle! That makes 32.' },
  { id: 'predict', say: 'Your turn! Two bundles and five sticks. Take away three sticks. How many are left? Tap your guess.', challenge: true, quick: true },
  { id: 'take-apart', say: 'Taking away is adding run backwards. To take seven from 32, there are only two loose sticks. So we untie a bundle into ten loose sticks. Now there are twelve. Take away seven, and 25 are left.' },
  { id: 'number-line', say: 'On a number line, adding is jumping forward, and taking away is jumping back. 25 plus 13 is one big jump of ten, then three small jumps, to 38. 32 take away 7 is seven small jumps back, to 25.' },
  { id: 'balance', say: 'Now you try! The seesaw only balances when both sides have the same amount. Add or take away bundles and sticks on the right side until it balances.', challenge: true },
]

/** Loose sticks are teal (the ones). Sticks inside a bundle keep the plain wood colour. */
const LOOSE = C.teal

type P = { x: number; y: number }
type PKind = 'bundle' | 'stick'
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const plus = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y })

/* ------------------------------------------------------------------ place-value mats (watch beats) */

const MAT_W = 440
const MAT_H = 300
const HEAD = 54
const TENS_W = 206
/** Piece scale on the watch-beat mats. */
const PS = 0.76

/** Where the k-th bundle sits in a mat's tens column (mat-local). */
function tensSlot(k: number): P {
  return { x: 37 + (k % 3) * 66, y: HEAD + 66 + Math.floor(k / 3) * 90 }
}
/** Where the k-th loose stick sits in a mat's ones column: rows of ten, split five and five. */
function onesSlot(k: number): P {
  const c = k % 10
  return { x: TENS_W + 17.5 + c * 21 + (c >= 5 ? 10 : 0), y: HEAD + 66 + Math.floor(k / 10) * 90 }
}
/** Stick i of a bundle, laid out the way the kit's Bundle draws it. */
function bundleStick(i: number, scale: number) {
  return { dx: (i - 4.5) * 7 * scale, r: (i - 4.5) * 1.2 }
}

const MATS = { A: { x: 50, y: 250 }, B: { x: 580, y: 250 }, R: { x: 1110, y: 250 } } as const
const EQ_Y = 650
const CARD_X = { A: 270, B: 800, R: 1330 }
/** The bundle-tying spot in the together mat: the middle of the first row of sticks. */
const TIE_AT = plus(MATS.R, { x: TENS_W + 117, y: HEAD + 66 })

interface Move {
  key: string
  kind: PKind
  from: P
  to: P
}

const SET1: Move[] = [
  { key: 'a1b0', kind: 'bundle', from: plus(MATS.A, tensSlot(0)), to: plus(MATS.R, tensSlot(0)) },
  { key: 'a1b1', kind: 'bundle', from: plus(MATS.A, tensSlot(1)), to: plus(MATS.R, tensSlot(1)) },
  { key: 'b1b0', kind: 'bundle', from: plus(MATS.B, tensSlot(0)), to: plus(MATS.R, tensSlot(2)) },
  ...range(5).map((k): Move => ({ key: `a1s${k}`, kind: 'stick', from: plus(MATS.A, onesSlot(k)), to: plus(MATS.R, onesSlot(k)) })),
  ...range(3).map((k): Move => ({ key: `b1s${k}`, kind: 'stick', from: plus(MATS.B, onesSlot(k)), to: plus(MATS.R, onesSlot(5 + k)) })),
]

const SET2: Move[] = [
  { key: 'a2b0', kind: 'bundle', from: plus(MATS.A, tensSlot(0)), to: plus(MATS.R, tensSlot(0)) },
  { key: 'b2b0', kind: 'bundle', from: plus(MATS.B, tensSlot(0)), to: plus(MATS.R, tensSlot(1)) },
  ...range(7).map((k): Move => ({ key: `a2s${k}`, kind: 'stick', from: plus(MATS.A, onesSlot(k)), to: plus(MATS.R, onesSlot(k)) })),
  ...range(5).map((k): Move => ({ key: `b2s${k}`, kind: 'stick', from: plus(MATS.B, onesSlot(k)), to: plus(MATS.R, onesSlot(7 + k)) })),
]
/** The ten sticks that overflow and get tied, in the order they sit in the ones column. */
const TIED = [...range(7).map((k) => `a2s${k}`), 'b2s0', 'b2s1', 'b2s2']

/* Take-apart panel: everything inside one scaled group, in mat-local units. */
const TAKE_G = 'translate(280 200) scale(1.15)'
const UNTIE_AT = { x: TENS_W + 117, y: HEAD + 156 }
function zoneSlot(j: number): P {
  return { x: 590 + j * 38 + (j >= 5 ? 20 : 0), y: 185 }
}

/* Number lines. */
const NL_TOP = 420
const NL_BOT = 770
const nx = (n: number) => 150 + (n - 20) * 65

/* ------------------------------------------------------------------ the scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const show = (sel: string | string[], at: number, dur = 0.4) => tl.to(sel, { opacity: 1, duration: dur }, at)
      const hide = (sel: string | string[], at: number, dur = 0.4) => tl.to(sel, { opacity: 0, duration: dur }, at)
      const pop = (sel: string, at: number) => tl.to(sel, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, at)
      const unpop = (sel: string | string[], at: number) => tl.to(sel, { opacity: 0, scale: 0.3, duration: 0.3, ease: 'power1.in' }, at)
      const pulse = (sel: string, at: number) => {
        tl.to(sel, { scale: 1.35, duration: 0.22, ease: 'sine.out' }, at)
        tl.to(sel, { scale: 1, duration: 0.3, ease: 'sine.in' }, at + 0.22)
      }
      const glow = (sel: string | string[], at: number, hold: number) => {
        tl.to(sel, { opacity: 1, duration: 0.3 }, at)
        tl.to(sel, { opacity: 0, duration: 0.4 }, at + hold)
      }
      const hop = (sel: string, from: P, to: P, at: number, dur = 0.9, lift = 150) => {
        const peak = Math.min(from.y, to.y) - lift
        tl.to(sel, { x: to.x, duration: dur, ease: 'power1.inOut' }, at)
        tl.to(sel, { y: peak, duration: dur / 2, ease: 'sine.out' }, at)
        tl.to(sel, { y: to.y, duration: dur / 2, ease: 'sine.in' }, at + dur / 2)
      }
      const slide = (sel: string, to: P & { r?: number }, at: number, dur = 0.6) =>
        tl.to(sel, { x: to.x, y: to.y, rotation: to.r ?? 0, duration: dur, ease: 'power2.inOut' }, at)

      /* ---------- starting state */
      tl.set(['.panel-add', '.panel-predict', '.panel-take', '.panel-line'], { opacity: 0 }, 0)
      tl.set('.hd', { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' }, 0)
      tl.set('.popper', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
      tl.set('.fader', { opacity: 0 }, 0)
      tl.set(['.mat-A', '.mat-B', '.mat-R'], { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' }, 0)
      tl.set(['.matin-A', '.matin-B'], { opacity: 1 }, 0)
      for (const m of [...SET1, ...SET2]) tl.set(`.pc-${m.key}`, { x: m.from.x, y: m.from.y, rotation: 0, opacity: 0, transformOrigin: '50% 50%' }, 0)
      tl.set('.tn-pc', { opacity: 1 }, 0)
      tl.set('.pc-nb2', { x: TIE_AT.x, y: TIE_AT.y, opacity: 0 }, 0)
      tl.set('.pc-rb2', { x: TIE_AT.x, y: TIE_AT.y, opacity: 0, scale: 0.01, transformOrigin: '50% 50%' }, 0)
      // take-apart pieces (local units of the scaled group)
      tl.set('.pc-tb0', { x: tensSlot(0).x, y: tensSlot(0).y }, 0)
      tl.set('.pc-tb1', { x: tensSlot(1).x, y: tensSlot(1).y }, 0)
      tl.set('.pc-ts0', { x: onesSlot(0).x, y: onesSlot(0).y }, 0)
      tl.set('.pc-ts1', { x: onesSlot(1).x, y: onesSlot(1).y }, 0)
      for (let i = 0; i < 10; i++) {
        const b = bundleStick(i, PS)
        tl.set(`.pc-u${i}`, { x: tensSlot(2).x + b.dx, y: tensSlot(2).y, rotation: b.r, transformOrigin: '50% 50%' }, 0)
        tl.set(`.tn-u${i}`, { opacity: 0 }, 0)
      }
      tl.set('.pc-rbT', { x: tensSlot(2).x, y: tensSlot(2).y, rotation: 0, opacity: 1, transformOrigin: '50% 50%' }, 0)
      // number lines
      tl.set(['.nl-ax-top', '.nl-ax-bot'], { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set('.arc', { opacity: 0, attr: { 'stroke-dashoffset': 1 } }, 0)
      tl.set('.hp-top', { x: nx(25), y: NL_TOP, opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
      tl.set('.hp-bot', { x: nx(32), y: NL_BOT, opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)

      /* ---------- b0: how do amounts change? two groups appear. */
      let T = 0.01
      tl.addLabel('b0', T)
      show('.panel-add', T, 0.5)
      tl.to('.hd0', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 0.2)
      tl.to('.mat-A', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 1.2)
      tl.to(SET1.filter((m) => m.key.startsWith('a')).map((m) => `.pc-${m.key}`), { opacity: 1, duration: 0.35, stagger: 0.06 }, T + 1.5)
      tl.to('.mat-B', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 2.3)
      tl.to(SET1.filter((m) => m.key.startsWith('b')).map((m) => `.pc-${m.key}`), { opacity: 1, duration: 0.35, stagger: 0.06 }, T + 2.6)
      tl.to('.hd0', { opacity: 0, scale: 0.85, duration: 0.3 }, T + 4.4)
      tl.to('.hd1', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 4.6)
      pop('.sg-plus', T + 5.7)
      pulse('.sg-plus', T + 6.3)

      /* ---------- b1: 25 + 13. bundles with bundles, sticks with sticks. */
      T += 7.6
      tl.addLabel('b1', T)
      glow('.ring-A', T, 1.9)
      pop('.bd-A1t', T + 0.4)
      pop('.bd-A1o', T + 0.9)
      pop('.cd-A1', T + 1.4)
      pulse('.sg-plus', T + 2.0)
      glow('.ring-B', T + 2.2, 1.9)
      pop('.bd-B1t', T + 2.6)
      pop('.bd-B1o', T + 3.0)
      pop('.cd-B1', T + 3.5)
      tl.to('.mat-R', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 4.2)
      pop('.sg-eq', T + 4.4)
      glow(['.cg-A-t', '.cg-B-t', '.cg-R-t'], T + 4.5, 1.8)
      SET1.filter((m) => m.kind === 'bundle').forEach((m, i) => hop(`.pc-${m.key}`, m.from, m.to, T + 4.7 + i * 0.22, 1.0, 170))
      unpop(['.bd-A1t', '.bd-B1t'], T + 5.3)
      pop('.bd-R1t', T + 6.1)
      glow(['.cg-A-o', '.cg-B-o', '.cg-R-o'], T + 6.3, 1.8)
      SET1.filter((m) => m.kind === 'stick').forEach((m, i) => hop(`.pc-${m.key}`, m.from, m.to, T + 6.4 + i * 0.12, 0.85, 170))
      unpop(['.bd-A1o', '.bd-B1o'], T + 7.0)
      pop('.bd-R1o', T + 7.9)
      tl.to(['.matin-A', '.matin-B'], { opacity: 0.5, duration: 0.5 }, T + 8.1)
      pulse('.bd-R1t', T + 8.6)
      pulse('.bd-R1o', T + 9.4)
      pop('.cd-R1', T + 10.3)
      glow('.ring-R', T + 10.6, 1.2)

      /* ---------- b2: 17 + 15. the ones overflow and ten get tied. */
      T += 12.4
      tl.addLabel('b2', T)
      tl.to('.hd1', { opacity: 0, scale: 0.85, duration: 0.3 }, T)
      tl.to('.hd2', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 0.3)
      hide(SET1.map((m) => `.pc-${m.key}`), T)
      unpop(['.cd-R1', '.bd-R1t', '.bd-R1o', '.cd-A1', '.cd-B1'], T)
      tl.to(['.matin-A', '.matin-B'], { opacity: 1, duration: 0.4 }, T + 0.2)
      tl.to(SET2.map((m) => `.pc-${m.key}`), { opacity: 1, duration: 0.35, stagger: 0.03 }, T + 0.4)
      pop('.cd-A2', T + 0.5)
      pop('.cd-B2', T + 0.6)
      pop('.bd-A2t', T + 0.7)
      pop('.bd-A2o', T + 0.8)
      pop('.bd-B2t', T + 0.9)
      pop('.bd-B2o', T + 1.0)
      glow(['.cg-A-t', '.cg-B-t', '.cg-R-t'], T + 1.2, 1.3)
      SET2.filter((m) => m.kind === 'bundle').forEach((m, i) => hop(`.pc-${m.key}`, m.from, m.to, T + 1.3 + i * 0.22, 1.0, 170))
      unpop(['.bd-A2t', '.bd-B2t'], T + 1.9)
      pop('.bd-R2t', T + 2.5)
      glow(['.cg-A-o', '.cg-B-o', '.cg-R-o'], T + 2.6, 1.9)
      SET2.filter((m) => m.kind === 'stick').forEach((m, i) => hop(`.pc-${m.key}`, m.from, m.to, T + 2.7 + i * 0.1, 0.8, 170))
      unpop(['.bd-A2o', '.bd-B2o'], T + 3.4)
      tl.to(['.matin-A', '.matin-B'], { opacity: 0.5, duration: 0.5 }, T + 4.2)
      pop('.bd-R2o12', T + 4.5)
      pulse('.bd-R2o12', T + 5.0)
      show('.row10', T + 5.6, 0.3)
      TIED.forEach((key, i) => {
        const b = bundleStick(i, PS)
        slide(`.pc-${key}`, { x: TIE_AT.x + b.dx, y: TIE_AT.y, r: b.r }, T + 6.3 + i * 0.03, 0.7)
        tl.to(`.tn-${key}`, { opacity: 0, duration: 0.4 }, T + 6.6)
      })
      hide('.row10', T + 6.4, 0.3)
      tl.to('.pc-rb2', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.2)' }, T + 7.2)
      tl.set([...TIED.map((k) => `.pc-${k}`), '.pc-rb2'], { opacity: 0 }, T + 7.75)
      tl.set('.pc-nb2', { opacity: 1 }, T + 7.75)
      hop('.pc-nb2', TIE_AT, plus(MATS.R, tensSlot(2)), T + 7.9, 1.0, 120)
      slide('.pc-b2s3', plus(MATS.R, onesSlot(0)), T + 8.6)
      slide('.pc-b2s4', plus(MATS.R, onesSlot(1)), T + 8.65)
      unpop('.bd-R2o12', T + 8.8)
      pop('.bd-R2o2', T + 9.0)
      unpop('.bd-R2t', T + 9.0)
      pop('.bd-R2t3', T + 9.2)
      pop('.cd-R2', T + 10.0)
      glow('.ring-R', T + 10.3, 1.2)

      /* ---------- b3: quick prediction (the pieces belong to the Predict component). */
      T += 12.6
      tl.addLabel('b3', T)
      hide('.panel-add', T, 0.5)
      tl.to('.hd2', { opacity: 0, scale: 0.85, duration: 0.3 }, T)
      show('.panel-predict', T + 0.4, 0.5)

      /* ---------- b4: 32 - 7, untie a bundle. */
      T += 1.2
      tl.addLabel('b4', T)
      hide('.panel-predict', T, 0.4)
      show('.panel-take', T + 0.3, 0.5)
      tl.to('.hd4', { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, T + 0.4)
      pop('.tk-cd32', T + 0.8)
      pop('.tk-bdt3', T + 1.0)
      pop('.tk-bdo2', T + 1.2)
      pop('.tk-minus', T + 2.6)
      pop('.tk-cd7', T + 2.9)
      glow('.tk-cg-o', T + 4.4, 2.0)
      pulse('.tk-bdo2', T + 5.5)
      glow('.tk-cg-t', T + 6.8, 1.2)
      for (let i = 0; i < 10; i++) {
        const b = bundleStick(i, PS)
        slide(`.pc-u${i}`, { x: UNTIE_AT.x + b.dx, y: UNTIE_AT.y, r: b.r }, T + 6.9, 0.8)
      }
      slide('.pc-rbT', UNTIE_AT, T + 6.9, 0.8)
      tl.to('.pc-rbT', { scale: 1.25, duration: 0.25, ease: 'sine.out' }, T + 7.75)
      tl.to('.pc-rbT', { y: UNTIE_AT.y - 90, x: UNTIE_AT.x + 50, rotation: 60, scale: 1, opacity: 0, duration: 0.6, ease: 'power1.out' }, T + 8.0)
      unpop('.tk-bdt3', T + 8.0)
      pop('.tk-bdt2', T + 8.2)
      for (let i = 0; i < 10; i++) {
        slide(`.pc-u${i}`, onesSlot(2 + i), T + 8.6 + i * 0.07, 0.8)
        tl.to(`.tn-u${i}`, { opacity: 1, duration: 0.5 }, T + 8.8 + i * 0.07)
      }
      unpop('.tk-bdo2', T + 10.2)
      pop('.tk-bdo12', T + 10.4)
      pulse('.tk-bdo12', T + 10.9)
      for (let j = 0; j < 7; j++) hop(`.pc-u${j + 3}`, onesSlot(5 + j), zoneSlot(j), T + 12.0 + j * 0.15, 0.8, 70)
      pop('.tk-zone7', T + 13.4)
      unpop('.tk-bdo12', T + 13.5)
      pop('.tk-bdo5', T + 13.7)
      pop('.tk-eq', T + 14.4)
      pop('.tk-cd25', T + 14.7)
      glow('.tk-ring', T + 15.0, 1.0)

      /* ---------- b5: the same moves on number lines. */
      T += 16.4
      tl.addLabel('b5', T)
      hide('.panel-take', T, 0.5)
      tl.to('.hd4', { opacity: 0, scale: 0.85, duration: 0.3 }, T)
      show('.panel-line', T + 0.3, 0.5)
      tl.to('.nl-ax-top', { scaleX: 1, duration: 0.8, ease: 'power2.out' }, T + 0.6)
      tl.to('.nl-ax-bot', { scaleX: 1, duration: 0.8, ease: 'power2.out' }, T + 0.8)
      show(['.nl-lb-top', '.nl-lb-bot'], T + 1.3)
      show('.nl-tt-top', T + 1.4)
      show('.nl-tt-bot', T + 3.6)
      pop('.nl-eqa-top', T + 6.0)
      pop('.hp-top', T + 6.2)
      const arc = (sel: string, at: number, dur: number) => {
        tl.set(sel, { opacity: 1 }, at)
        tl.to(sel, { attr: { 'stroke-dashoffset': 0 }, duration: dur, ease: 'none' }, at)
      }
      arc('.arc-t0', T + 7.2, 1.0)
      hop('.hp-top', { x: nx(25), y: NL_TOP }, { x: nx(35), y: NL_TOP }, T + 7.2, 1.0, 150)
      show(['.hl-t10', '.mi-t0'], T + 7.7)
      for (let k = 1; k <= 3; k++) {
        const at = T + 8.5 + (k - 1) * 0.55
        arc(`.arc-t${k}`, at, 0.45)
        hop('.hp-top', { x: nx(34 + k), y: NL_TOP }, { x: nx(35 + k), y: NL_TOP }, at, 0.45, 50)
        show(`.mi-t${k}`, at + 0.2, 0.3)
      }
      show('.hl-t3', T + 10.0)
      pop('.nl-eqb-top', T + 10.8)
      show('.nh-38', T + 10.8)
      pop('.nl-eqa-bot', T + 12.0)
      pop('.hp-bot', T + 12.2)
      for (let k = 0; k < 7; k++) {
        const at = T + 12.6 + k * 0.45
        arc(`.arc-b${k}`, at, 0.4)
        hop('.hp-bot', { x: nx(32 - k), y: NL_BOT }, { x: nx(31 - k), y: NL_BOT }, at, 0.4, 50)
        show(`.mi-b${k}`, at + 0.2, 0.3)
      }
      show('.hl-b7', T + 14.4)
      pop('.nl-eqb-bot', T + 15.9)
      show('.nh-25', T + 15.9)

      /* ---------- b6: the seesaw game (drawn by the Balance component). */
      T += 16.8
      tl.addLabel('b6', T)
      hide('.panel-line', T, 0.5)
      tl.to({}, { duration: 1 }, T)
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <Sky />
      <Hills />

      <AddPanel />
      <PredictPanel />
      <TakePanel />
      <LinePanel />

      <At x={800} y={110}><g className="hd hd0"><Pill text="How do amounts change?" /></g></At>
      <At x={800} y={110}><g className="hd hd1"><Pill text="Putting together is adding" /></g></At>
      <At x={800} y={110}><g className="hd hd2"><Pill text="Ten loose sticks make a new bundle" /></g></At>
      <At x={800} y={110}><g className="hd hd4"><Pill text="Taking away is adding, run backwards" /></g></At>

      {id === 'predict' && <Predict {...props} />}
      {id === 'balance' && <Balance {...props} />}
    </g>
  )
}

/* ------------------------------------------------------------------ shared pieces of art */

/** A place-value mat: a coral tens column and a teal ones column. Origin at its top-left. */
function MatFrame({
  id,
  w = MAT_W,
  h = MAT_H,
  head = HEAD,
  tensW = TENS_W,
  label = 30,
}: {
  id?: string
  w?: number
  h?: number
  head?: number
  tensW?: number
  label?: number
}) {
  const r = 26
  return (
    <g>
      <rect x={0} y={8} width={w} height={h} rx={r} fill={C.ink} opacity={0.14} />
      <rect x={0} y={0} width={w} height={h} rx={r} fill={C.cream} />
      <path d={`M 0 ${r} Q 0 0 ${r} 0 L ${tensW} 0 L ${tensW} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} Z`} fill={C.coral} opacity={0.1} />
      <path d={`M ${tensW} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${tensW} ${h} Z`} fill={C.teal} opacity={0.1} />
      <path d={`M 0 ${r} Q 0 0 ${r} 0 L ${tensW} 0 L ${tensW} ${head} L 0 ${head} Z`} fill={C.coral} opacity={0.3} />
      <path d={`M ${tensW} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${head} L ${tensW} ${head} Z`} fill={C.teal} opacity={0.3} />
      {id && (
        <g>
          <rect className={`fader cg-${id}-t`} x={4} y={head} width={tensW - 6} height={h - head - 4} rx={18} fill={C.coral} fillOpacity={0.3} opacity={0} />
          <rect className={`fader cg-${id}-o`} x={tensW + 2} y={head} width={w - tensW - 6} height={h - head - 4} rx={18} fill={C.teal} fillOpacity={0.3} opacity={0} />
        </g>
      )}
      <line x1={tensW} y1={6} x2={tensW} y2={h - 6} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="6 8" opacity={0.35} />
      <At x={tensW / 2 - (id ? 12 : 0)} y={head / 2 + 2}><Label text="tens" size={label} color={C.coralDark} /></At>
      <At x={tensW + (w - tensW) / 2 - (id ? 12 : 0)} y={head / 2 + 2}><Label text="ones" size={label} color={C.tealDark} /></At>
      {id && <rect className={`fader ring-${id}`} x={-8} y={-8} width={w + 16} height={h + 16} rx={r + 8} fill="none" stroke={C.sun} strokeWidth={9} opacity={0} />}
    </g>
  )
}

/** A count badge in a column header: coral for bundles, teal for loose sticks. */
function Badge({ n, color }: { n: number; color: string }) {
  return (
    <g>
      <circle r={n >= 10 ? 25 : 21} fill={color} />
      <text y={2} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={C.white}>
        {n}
      </text>
    </g>
  )
}
const badgeT = { x: TENS_W - 26, y: HEAD / 2 }
const badgeO = { x: MAT_W - 30, y: HEAD / 2 }

/** Tens digits are coral and ones digits teal, matching the columns. */
const digitFill = (len: number, k: number) => (len - k === 2 ? C.coralDark : len - k === 1 ? C.tealDark : C.ink)

function Digits({ s, size }: { s: string; size: number }) {
  const isNum = /^\d+$/.test(s)
  return (
    <text textAnchor="middle" dominantBaseline="middle" y={size * 0.04} fontFamily={FONT} fontWeight={800} fontSize={size}>
      {isNum ? [...s].map((d, k) => <tspan key={k} fill={digitFill(s.length, k)}>{d}</tspan>) : <tspan fill={C.inkSoft}>{s}</tspan>}
    </text>
  )
}

/** A white number card, used for each number in an equation. */
function NumCard({ value, size = 70 }: { value: number | string; size?: number }) {
  const s = String(value)
  const w = Math.max(size * 0.62 * s.length + 44, size * 1.4)
  const h = size * 1.45
  return (
    <g>
      <rect x={-w / 2} y={-h / 2 + 6} width={w} height={h} rx={20} fill={C.ink} opacity={0.14} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={20} fill={C.white} />
      <Digits s={s} size={size} />
    </g>
  )
}

/** An equation as text, with two-colour digits. */
function EqText({ text, size, anchor = 'middle' }: { text: string; size: number; anchor?: 'start' | 'middle' | 'end' }) {
  const toks = text.split(' ')
  return (
    <text textAnchor={anchor} dominantBaseline="middle" fontFamily={FONT} fontWeight={800} fontSize={size} fill={C.ink}>
      {toks.map((tok, i) => (
        <tspan key={i}>
          {i > 0 ? ' ' : ''}
          {/^\d+$/.test(tok) ? [...tok].map((d, k) => <tspan key={k} fill={digitFill(tok.length, k)}>{d}</tspan>) : tok}
        </tspan>
      ))}
    </text>
  )
}

function Sign({ text, size = 72 }: { text: string; size?: number }) {
  return <Label text={text} size={size} color={C.ink} />
}

/** A heading pill in the branch colour. */
function Pill({ text, size = 44 }: { text: string; size?: number }) {
  const w = text.length * size * 0.62 + 96
  return (
    <g>
      <rect x={-w / 2} y={-34} width={w} height={74} rx={37} fill={C.ink} opacity={0.12} />
      <rect x={-w / 2} y={-38} width={w} height={74} rx={37} fill={C.white} stroke={C.teal} strokeWidth={5} />
      <At y={0}><Label text={text} size={size} /></At>
    </g>
  )
}

/** A loose stick drawn on top of a wood stick, so the teal tint can fade as it joins a bundle. */
function DuoStick({ name }: { name: string }) {
  return (
    <g>
      <Stick />
      <g className={`tn-${name} tn-pc`}>
        <Stick color={LOOSE} />
      </g>
    </g>
  )
}

function RibbonArt() {
  return (
    <g>
      <rect x={-40} y={-8} width={80} height={16} rx={6} fill={C.coral} />
      <circle cx={0} cy={0} r={9} fill={C.coral} stroke={C.white} strokeWidth={2} />
    </g>
  )
}

/** A piece the timeline moves: GSAP sets its x and y. */
function PieceEl({ name, kind, s = PS }: { name: string; kind: PKind | 'ribbon'; s?: number }) {
  return (
    <g className={`pc-${name}`}>
      <g transform={`scale(${s})`}>{kind === 'bundle' ? <Bundle /> : kind === 'ribbon' ? <RibbonArt /> : <DuoStick name={name} />}</g>
    </g>
  )
}

/* ------------------------------------------------------------------ watch panels */

function AddPanel() {
  const mats = [
    { k: 'A' as const, tutor: 'first group mat' },
    { k: 'B' as const, tutor: 'second group mat' },
    { k: 'R' as const, tutor: 'together mat' },
  ]
  const tRow = plus(MATS.R, { x: onesSlot(0).x - 16, y: onesSlot(0).y - 49 })
  return (
    <g className="panel-add">
      {mats.map(({ k, tutor }) => (
        <g key={k} className={`mat-${k}`}>
          <At x={MATS[k].x} y={MATS[k].y} data-tutor={tutor}>
            <g className={k === 'R' ? undefined : `matin-${k}`}>
              <MatFrame id={k} />
            </g>
          </At>
        </g>
      ))}
      {/* column count badges */}
      {(
        [
          ['A1t', 'A', 'T', 2], ['A1o', 'A', 'O', 5], ['B1t', 'B', 'T', 1], ['B1o', 'B', 'O', 3], ['R1t', 'R', 'T', 3], ['R1o', 'R', 'O', 8],
          ['A2t', 'A', 'T', 1], ['A2o', 'A', 'O', 7], ['B2t', 'B', 'T', 1], ['B2o', 'B', 'O', 5],
          ['R2t', 'R', 'T', 2], ['R2t3', 'R', 'T', 3], ['R2o12', 'R', 'O', 12], ['R2o2', 'R', 'O', 2],
        ] as const
      ).map(([name, m, col, n]) => {
        const p = plus(MATS[m], col === 'T' ? badgeT : badgeO)
        return (
          <At key={name} x={p.x} y={p.y}>
            <g className={`popper bd-${name}`}><Badge n={n} color={col === 'T' ? C.coral : C.teal} /></g>
          </At>
        )
      })}
      {/* the equation, each number under its group */}
      <g data-tutor="the equation">
        <At x={CARD_X.A} y={EQ_Y}><g className="popper cd-A1"><NumCard value={25} /></g></At>
        <At x={CARD_X.A} y={EQ_Y}><g className="popper cd-A2"><NumCard value={17} /></g></At>
        <At x={535} y={EQ_Y}><g className="popper sg-plus"><Sign text="+" /></g></At>
        <At x={CARD_X.B} y={EQ_Y}><g className="popper cd-B1"><NumCard value={13} /></g></At>
        <At x={CARD_X.B} y={EQ_Y}><g className="popper cd-B2"><NumCard value={15} /></g></At>
        <At x={1065} y={EQ_Y}><g className="popper sg-eq"><Sign text="=" /></g></At>
        <At x={CARD_X.R} y={EQ_Y}><g className="popper cd-R1"><NumCard value={38} /></g></At>
        <At x={CARD_X.R} y={EQ_Y}><g className="popper cd-R2"><NumCard value={32} /></g></At>
      </g>
      {/* a dashed loop around the first ten loose sticks, just before they are tied */}
      <rect className="fader row10" x={tRow.x} y={tRow.y} width={onesSlot(9).x - onesSlot(0).x + 32} height={98} rx={18} fill="none" stroke={C.coralDark} strokeWidth={5} strokeDasharray="10 9" opacity={0} />
      {SET1.map((m) => <PieceEl key={m.key} name={m.key} kind={m.kind} />)}
      {SET2.map((m) => <PieceEl key={m.key} name={m.key} kind={m.kind} />)}
      <PieceEl name="rb2" kind="ribbon" />
      <PieceEl name="nb2" kind="bundle" />
    </g>
  )
}

/** The prediction mat. The Predict component draws the pieces on it. */
function PredictPanel() {
  return (
    <g className="panel-predict">
      <g transform={TAKE_G}>
        <MatFrame />
      </g>
    </g>
  )
}

const EQ_ROW = { a: 540, op: 655, b: 760, eq: 865, c: 980, y: 675 }

function TakePanel() {
  return (
    <g className="panel-take">
      <g transform={TAKE_G}>
        <g data-tutor="the mat">
          <MatFrame id="tk" />
        </g>
        <At x={badgeT.x} y={badgeT.y}><g className="popper tk-bdt3"><Badge n={3} color={C.coral} /></g></At>
        <At x={badgeT.x} y={badgeT.y}><g className="popper tk-bdt2"><Badge n={2} color={C.coral} /></g></At>
        <At x={badgeO.x} y={badgeO.y}><g className="popper tk-bdo2"><Badge n={2} color={C.teal} /></g></At>
        <At x={badgeO.x} y={badgeO.y}><g className="popper tk-bdo12"><Badge n={12} color={C.teal} /></g></At>
        <At x={badgeO.x} y={badgeO.y}><g className="popper tk-bdo5"><Badge n={5} color={C.teal} /></g></At>
        <g data-tutor="taken away">
          <rect x={540} y={50} width={340} height={250} rx={26} fill={C.white} opacity={0.55} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="10 10" />
          <At x={710} y={94}><Label text="taken away" size={28} color={C.inkSoft} weight={700} /></At>
          <At x={710} y={262}><g className="popper tk-zone7"><Badge n={7} color={C.teal} /></g></At>
        </g>
        <PieceEl name="tb0" kind="bundle" />
        <PieceEl name="tb1" kind="bundle" />
        <PieceEl name="ts0" kind="stick" />
        <PieceEl name="ts1" kind="stick" />
        {range(10).map((i) => <PieceEl key={i} name={`u${i}`} kind="stick" />)}
        <PieceEl name="rbT" kind="ribbon" />
      </g>
      <g data-tutor="the equation">
        <At x={EQ_ROW.a} y={EQ_ROW.y}><g className="popper tk-cd32"><NumCard value={32} /></g></At>
        <At x={EQ_ROW.op} y={EQ_ROW.y}><g className="popper tk-minus"><Sign text="−" /></g></At>
        <At x={EQ_ROW.b} y={EQ_ROW.y}><g className="popper tk-cd7"><NumCard value={7} /></g></At>
        <At x={EQ_ROW.eq} y={EQ_ROW.y}><g className="popper tk-eq"><Sign text="=" /></g></At>
        <At x={EQ_ROW.c} y={EQ_ROW.y}><g className="popper tk-cd25"><NumCard value={25} /></g></At>
      </g>
    </g>
  )
}

function NumberLine({ y, name, marks }: { y: number; name: string; marks: number[] }) {
  return (
    <g>
      <g className={`nl-ax-${name}`}>
        <line x1={nx(20) - 40} y1={y} x2={nx(40) + 40} y2={y} stroke={C.inkSoft} strokeWidth={6} strokeLinecap="round" />
        {range(21).map((i) => {
          const big = i % 5 === 0
          return <line key={i} x1={nx(20 + i)} y1={y - (big ? 18 : 10)} x2={nx(20 + i)} y2={y + (big ? 18 : 10)} stroke={C.inkSoft} strokeWidth={big ? 5 : 3} strokeLinecap="round" />
        })}
      </g>
      <g className={`fader nl-lb-${name}`}>
        {range(21)
          .map((i) => 20 + i)
          .filter((n) => n % 5 === 0 || marks.includes(n))
          .map((n) => (
            <At key={n} x={nx(n)} y={y + 46}>
              <Label text={String(n)} size={32} color={marks.includes(n) ? C.ink : C.inkSoft} weight={marks.includes(n) ? 800 : 700} />
            </At>
          ))}
      </g>
    </g>
  )
}

function HopArc({ cls, a, b, y, h, color }: { cls: string; a: number; b: number; y: number; h: number; color: string }) {
  const x1 = nx(a)
  const x2 = nx(b)
  return (
    <path
      className={`arc ${cls}`}
      d={`M ${x1} ${y - 4} Q ${(x1 + x2) / 2} ${y - 4 - 2 * h} ${x2} ${y - 4}`}
      pathLength={1}
      strokeDasharray="1 2"
      stroke={color}
      strokeWidth={6}
      fill="none"
      opacity={0}
    />
  )
}

function LinePanel() {
  return (
    <g className="panel-line" data-tutor="the number lines">
      <rect x={50} y={112} width={1500} height={760} rx={40} fill={C.cream} />
      {/* adding: forward */}
      <g className="fader nl-tt-top">
        <At x={110} y={180}><Label text="Adding jumps forward" size={44} anchor="start" /></At>
        <path d="M 690 180 L 770 180 M 746 160 L 772 180 L 746 200" stroke={C.teal} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <At x={1290} y={180}><g className="popper nl-eqa-top"><EqText text="25 + 13" size={54} anchor="end" /></g></At>
      <At x={1310} y={180}><g className="popper nl-eqb-top"><EqText text="= 38" size={54} anchor="start" /></g></At>
      <NumberLine y={NL_TOP} name="top" marks={[38]} />
      <HopArc cls="arc-t0" a={25} b={35} y={NL_TOP} h={150} color={C.coral} />
      {[1, 2, 3].map((k) => <HopArc key={k} cls={`arc-t${k}`} a={34 + k} b={35 + k} y={NL_TOP} h={50} color={C.teal} />)}
      <g className="fader hl-t10"><At x={nx(30)} y={NL_TOP - 186}><Label text="+10" size={36} color={C.coralDark} /></At></g>
      <g className="fader mi-t0"><At x={nx(30)} y={NL_TOP - 70} s={0.5}><Bundle /></At></g>
      {[1, 2, 3].map((k) => (
        <g key={k} className={`fader mi-t${k}`}><At x={nx(34.5 + k)} y={NL_TOP - 26} s={0.3}><Stick color={LOOSE} /></At></g>
      ))}
      <g className="fader hl-t3"><At x={nx(36.5)} y={NL_TOP - 90}><Label text="+3" size={36} color={C.tealDark} /></At></g>
      <g className="fader nh-38"><circle cx={nx(38)} cy={NL_TOP + 46} r={30} fill="none" stroke={C.sun} strokeWidth={6} /></g>

      {/* taking away: back */}
      <g className="fader nl-tt-bot">
        <At x={110} y={562}><Label text="Taking away jumps back" size={44} anchor="start" /></At>
        <path d="M 830 562 L 750 562 M 774 542 L 748 562 L 774 582" stroke={C.coral} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <At x={1290} y={562}><g className="popper nl-eqa-bot"><EqText text="32 − 7" size={54} anchor="end" /></g></At>
      <At x={1310} y={562}><g className="popper nl-eqb-bot"><EqText text="= 25" size={54} anchor="start" /></g></At>
      <NumberLine y={NL_BOT} name="bot" marks={[32]} />
      {range(7).map((k) => <HopArc key={k} cls={`arc-b${k}`} a={32 - k} b={31 - k} y={NL_BOT} h={50} color={C.teal} />)}
      {range(7).map((k) => (
        <g key={k} className={`fader mi-b${k}`}><At x={nx(31.5 - k)} y={NL_BOT - 26} s={0.3}><Stick color={LOOSE} /></At></g>
      ))}
      <g className="fader hl-b7"><At x={nx(28.5)} y={NL_BOT - 90}><Label text="−7" size={36} color={C.tealDark} /></At></g>
      <g className="fader nh-25"><circle cx={nx(25)} cy={NL_BOT + 46} r={30} fill="none" stroke={C.sun} strokeWidth={6} /></g>

      <g className="hp-top"><circle r={15} fill={C.ink} stroke={C.white} strokeWidth={4} /></g>
      <g className="hp-bot"><circle r={15} fill={C.ink} stroke={C.white} strokeWidth={4} /></g>
    </g>
  )
}

/* ------------------------------------------------------------------ CSS-driven movement for the games */

interface Pose {
  x: number
  y: number
  r?: number
  s?: number
  o?: number
}

/**
 * Moves its children to `to` with a CSS transition. With `from`, it first renders there and
 * then glides to `to`. Used only inside the interactive parts, never on timeline elements.
 */
function Mover({
  to,
  from,
  dur = 0.5,
  delay = 0,
  ease = 'cubic-bezier(.3,1.25,.5,1)',
  instant = false,
  children,
  ...rest
}: {
  to: Pose
  from?: Pose
  dur?: number
  delay?: number
  ease?: string
  instant?: boolean
  children: ReactNode
  'data-tutor'?: string
}) {
  const [arrived, setArrived] = useState(!from)
  useEffect(() => {
    if (arrived) return
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setArrived(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [arrived])
  const p = arrived || !from ? to : from
  return (
    <g
      style={{
        transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r ?? 0}deg) scale(${p.s ?? 1})`,
        opacity: p.o ?? 1,
        transition: instant ? 'none' : `transform ${dur}s ${ease} ${delay}s, opacity ${dur}s ease ${delay}s`,
      }}
      {...rest}
    >
      {children}
    </g>
  )
}

/* ------------------------------------------------------------------ quick prediction: 25 take away 3 */

const PREDICT_LINES: Record<number, string> = {
  22: 'Yes! Five sticks take away three leaves two. Two bundles and two sticks: 22.',
  25: 'Good guess! But three sticks went away, so there are fewer. Two bundles and two sticks: 22.',
  28: 'Good guess! 28 would be adding three. Taking away leaves fewer: two bundles and two sticks, 22.',
}

function Predict({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [pick, setPick] = useState<number | null>(null)
  const [gone, setGone] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  useEffect(() => {
    setHints([
      'Look at the loose sticks in the ones column. How many are there?',
      'Taking away makes an amount smaller. Which choices are smaller than 25?',
      'Three sticks leave the ones column. The two bundles stay where they are.',
    ])
  }, [setHints])

  useEffect(() => {
    reportState(
      `Quick prediction. A mat shows 25 as 2 bundles (tens) and 5 loose sticks (ones). The question: take away 3 sticks, how many are left? Choices: 22, 25, 28. ${
        pick === null ? 'The student has not picked yet.' : `The student picked ${pick}. Three sticks then left the mat, leaving 2 bundles and 2 sticks.`
      } Correct answer: 22. Any guess is accepted here; it is a low-stakes warm-up. Likely mix-ups: 28 (adding 3 instead of taking away), or 25 (thinking nothing changes).`,
    )
  }, [pick, reportState])

  const choose = (n: number) => {
    if (pick !== null) return
    setPick(n)
    emit({ type: 'progress', detail: `guessed ${n} for 25 take away 3 (answer 22)` })
    say(PREDICT_LINES[n])
    timers.current.push(window.setTimeout(() => setGone(true), 300))
    timers.current.push(window.setTimeout(onChallengeDone, 7200))
  }

  return (
    <Mover from={{ x: 0, y: 0, o: 0 }} to={{ x: 0, y: 0, o: 1 }} dur={0.5} delay={0.4}>
      <g transform={TAKE_G} data-tutor="the mat">
        {[0, 1].map((k) => (
          <At key={k} x={tensSlot(k).x} y={tensSlot(k).y} s={PS}><Bundle /></At>
        ))}
        {[0, 1].map((k) => (
          <At key={k} x={onesSlot(k).x} y={onesSlot(k).y} s={PS}><Stick color={LOOSE} /></At>
        ))}
        {[2, 3, 4].map((k, j) => (
          <Mover key={k} to={gone ? { x: 468 + j * 26, y: 130 - j * 4, r: 12, o: 0.28 } : { ...onesSlot(k) }} dur={0.8} delay={j * 0.18} ease="cubic-bezier(.4,0,.3,1)">
            <g transform={`scale(${PS})`}><Stick color={LOOSE} /></g>
          </Mover>
        ))}
        <At x={badgeT.x} y={badgeT.y}><Badge n={2} color={C.coral} /></At>
        <At x={badgeO.x} y={badgeO.y}>
          <Mover key={gone ? 'two' : 'five'} from={{ x: 0, y: 0, s: 0.4, o: 0 }} to={{ x: 0, y: 0 }} dur={0.4} delay={gone ? 1.1 : 0}>
            <Badge n={gone ? 2 : 5} color={C.teal} />
          </Mover>
        </At>
      </g>

      <g data-tutor="the equation">
        <At x={EQ_ROW.a} y={EQ_ROW.y}><NumCard value={25} /></At>
        <At x={EQ_ROW.op} y={EQ_ROW.y}><Sign text="−" /></At>
        <At x={EQ_ROW.b} y={EQ_ROW.y}><NumCard value={3} /></At>
        <At x={EQ_ROW.eq} y={EQ_ROW.y}><Sign text="=" /></At>
        <At x={EQ_ROW.c} y={EQ_ROW.y}>
          <Mover key={gone ? 'ans' : 'q'} from={{ x: 0, y: 0, s: 0.4, o: 0 }} to={{ x: 0, y: 0 }} dur={0.45} delay={gone ? 1.4 : 0}>
            <NumCard value={gone ? 22 : '?'} />
          </Mover>
        </At>
      </g>

      <g data-tutor="the question">
        <rect x={930} y={196} width={580} height={346} rx={36} fill={C.white} opacity={0.95} />
        <At x={1220} y={262}><Label text="Take away 3 sticks." size={38} color={C.inkSoft} weight={700} /></At>
        <At x={1220} y={330}><Label text="How many are left?" size={44} /></At>
        {[22, 25, 28].map((n, i) => (
          <g key={n}>
            {gone && n === 22 && <rect x={1050 + i * 170 - 88} y={398} width={176} height={104} rx={52} fill="none" stroke={C.sun} strokeWidth={7} />}
            <SvgButton
              x={1050 + i * 170}
              y={450}
              w={150}
              h={86}
              size={44}
              label={String(n)}
              color={[C.violet, C.teal, C.coral][i]}
              onClick={() => choose(n)}
              disabled={pick !== null && pick !== n && !(gone && n === 22)}
              tutor={`${n} button`}
            />
          </g>
        ))}
      </g>
    </Mover>
  )
}

/* ------------------------------------------------------------------ the seesaw game */

const ROUNDS = [
  { left: 15, rb: 0, rs: 8 },
  { left: 32, rb: 4, rs: 0 },
  { left: 26, rb: 1, rs: 9 },
]

const BALANCE_HINTS = [
  [
    'Look at the seesaw. The lower side has more. Does the right side need more, or less?',
    'Count each side the bundle way: a bundle is ten, a loose stick is one. How far apart are they?',
    'Try adding loose sticks one at a time and watch the seesaw. If you get ten or more loose sticks, tie ten into a bundle.',
  ],
  [
    'Look at the seesaw. Which side is lower? The lower side has more.',
    'Count each side: four bundles is forty. How far is that from the left side?',
    'There are no loose sticks to take away. Tap a bundle to untie it into ten loose sticks, then drag some off.',
  ],
  [
    'Which side is lower? Does the right side need more, or less?',
    'Count each side the bundle way, then find how far apart they are.',
    'When you have ten or more loose sticks, press the Tie 10 button to make a new bundle.',
  ],
]

const TRAY_W = 460
const TRAY_H = 256
const TRAY_HEAD = 46
const TRAY_TENS = 200
/** Piece scale on the seesaw trays. */
const BPS = 0.66
const PIVOT = { x: 800, y: 610 }
const ARM = 400
const TRAY_L = { x: PIVOT.x - ARM - TRAY_W / 2, y: PIVOT.y - 120 - TRAY_H }
const TRAY_R = { x: PIVOT.x + ARM - TRAY_W / 2, y: PIVOT.y - 120 - TRAY_H }
const BUNDLE_BOX = { x: 1110, y: 832 }
const STICK_BOX = { x: 1380, y: 832 }
/** Where ten loose sticks gather to be tied (tray-local). */
const CL = { x: TRAY_TENS + 130, y: TRAY_HEAD + 40 }
const TILT = 'transform 0.9s cubic-bezier(.34,1.45,.55,1)'

function tTens(k: number): P {
  return { x: 38 + (k % 3) * 62, y: TRAY_HEAD + 40 + Math.floor(k / 3) * 68 }
}
function tOnes(k: number): P {
  const c = k % 10
  return { x: TRAY_TENS + 30.5 + c * 21 + (c >= 5 ? 10 : 0), y: TRAY_HEAD + 40 + Math.floor(k / 10) * 68 }
}

interface Piece {
  id: number
  kind: PKind
  /** Where a new piece starts before gliding to its spot (tray-local). */
  from?: Pose
  /** True for sticks that just came out of a bundle, so they start wood-coloured. */
  wood?: boolean
}

type Phase = 'play' | 'busy' | 'won'

interface Game {
  round: number
  right: Piece[]
  phase: Phase
  gather: number[]
  tieRibbon: boolean
  pops: { id: number; x: number; y: number }[]
  needTie: boolean
  banner: string | null
  untied: boolean
  tied: boolean
  wrongSaid: boolean
  leftSaid: boolean
  tapSaid: boolean
}

const countOf = (ps: Piece[], kind: PKind) => ps.filter((p) => p.kind === kind).length
const totalOf = (ps: Piece[]) => countOf(ps, 'bundle') * 10 + countOf(ps, 'stick')
const startOf = (r: number) => ROUNDS[r].rb * 10 + ROUNDS[r].rs

/** Piece ids only need to be unique, so one counter serves every round. */
let pieceIds = 1
const makePiece = (kind: PKind, extra: Partial<Piece> = {}): Piece => ({ id: pieceIds++, kind, ...extra })

function freshRound(r: number): Game {
  return {
    round: r,
    right: [...range(ROUNDS[r].rb).map(() => makePiece('bundle')), ...range(ROUNDS[r].rs).map(() => makePiece('stick'))],
    phase: 'play',
    gather: [],
    tieRibbon: false,
    pops: [],
    needTie: false,
    banner: null,
    untied: false,
    tied: false,
    wrongSaid: false,
    leftSaid: false,
    tapSaid: false,
  }
}

/** What Pip is told about the seesaw: both amounts, the pieces, the difference, the answer and the mix-ups. */
function describeBalance(g: Game) {
  const L = ROUNDS[g.round].left
  const R0 = startOf(g.round)
  const bundles = countOf(g.right, 'bundle')
  const loose = countOf(g.right, 'stick')
  const total = bundles * 10 + loose
  const change = total - R0
  const need = L - total
  const roundTip = [
    'From the start the answer is to add 7 (8 and 7 more makes 15): for example add 7 loose sticks and then tie ten of the 15 loose sticks into a bundle, or add 1 bundle and take away 3 sticks.',
    'From the start the answer is to take away 8 (40 take away 8 leaves 32). The right side starts as 4 bundles and no loose sticks, so the student must tap a bundle to untie it into ten loose sticks, then drag 8 sticks off, leaving 3 bundles and 2 sticks. Taking away a whole bundle and adding back 2 sticks also works.',
    'From the start the answer is to add 7 (19 and 7 more makes 26). 9 loose sticks plus 7 is 16 loose sticks, so ten of them must be tied into a new bundle, giving 2 bundles and 6 sticks.',
  ][g.round]
  const seen: string[] = []
  if (g.round === 1 && total > R0) seen.push('The student is adding, but this round needs taking away.')
  if (g.round === 1 && total < L && !g.untied && bundles < 4) seen.push('They took away a whole bundle (ten) instead of untying it.')
  if (g.round !== 1 && total > L && bundles > ROUNDS[g.round].rb) seen.push('They added a bundle; they may be counting a bundle as one stick instead of ten.')
  if (g.needTie) seen.push(`It balances, but there are ${loose} loose sticks: the student should press "Tie 10 into a bundle" to finish the round.`)
  return [
    `Seesaw balance game, round ${g.round + 1} of 3.`,
    `Left side (fixed): ${L}, shown as ${Math.floor(L / 10)} bundles and ${L % 10} loose sticks.`,
    `Right side now: ${total}, shown as ${bundles} bundle${bundles === 1 ? '' : 's'} and ${loose} loose stick${loose === 1 ? '' : 's'} (it started at ${R0}; change so far ${change >= 0 ? '+' : ''}${change}).`,
    total > L ? 'The right side is heavier, so the seesaw tips down on the right.' : total < L ? 'The left side is heavier, so the seesaw tips down on the left.' : 'Both sides are equal and the seesaw is level.',
    `Difference: ${Math.abs(need)}. ${need > 0 ? `Right now the right side needs ${need} more.` : need < 0 ? `Right now the right side has ${-need} too many.` : ''}`,
    `Answer: ${roundTip}`,
    g.phase === 'won' ? 'This round is solved.' : '',
    seen.join(' '),
    'Likely mix-ups: adding when they should take away (the lower side has more), forgetting to untie a bundle when there are no loose sticks to take away, or counting a bundle as one instead of ten.',
    'Controls: drag bundles and sticks from the boxes onto the right mat, drag pieces off the mat to take them away, tap a bundle on the right to untie it, and press "Tie 10 into a bundle" when there are ten or more loose sticks.',
  ]
    .filter(Boolean)
    .join(' ')
}

function Balance({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [g, setG] = useState<Game>(() => freshRound(0))
  /** The latest game state, for event handlers and timers. */
  const live = useRef(g)
  const commit = (next: Game) => {
    live.current = next
    setG(next)
  }
  /** Copies the latest state, lets `fn` change the copy, then commits it. */
  const update = (fn: (d: Game) => void) => {
    const c = live.current
    const d: Game = { ...c, right: [...c.right], gather: [...c.gather], pops: [...c.pops] }
    fn(d)
    commit(d)
  }
  const [ghost, setGhost] = useState<{ kind: PKind; x: number; y: number } | null>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  const rightRef = useRef<SVGGElement>(null)
  const rightHit = useRef<SVGRectElement>(null)
  const leftHit = useRef<SVGRectElement>(null)

  const L = ROUNDS[g.round].left
  const R0 = startOf(g.round)
  const bundles = countOf(g.right, 'bundle')
  const loose = countOf(g.right, 'stick')
  const total = bundles * 10 + loose
  const change = total - R0
  const balanced = total === L
  const angle = Math.max(-16, Math.min(16, (total - L) * 2.2))
  const rad = (angle * Math.PI) / 180
  const rdx = ARM * Math.cos(rad) - ARM
  const rdy = ARM * Math.sin(rad)

  useEffect(() => {
    setHints(BALANCE_HINTS[g.round])
  }, [g.round, setHints])

  useEffect(() => {
    reportState(describeBalance(g))
  }, [g, reportState])

  /** Converts a stage point into the right tray's own coordinates. */
  const toLocal = (q: P): P => {
    const el = rightRef.current
    const svg = el?.ownerSVGElement
    const m = el?.getScreenCTM()
    const s = svg?.getScreenCTM()
    if (!m || !s) return { x: q.x - TRAY_R.x - rdx, y: q.y - TRAY_R.y - rdy }
    const pt = new DOMPoint(q.x, q.y).matrixTransform(s).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }
  const inside = (el: Element | null, q: P, pad: number) => {
    if (!el) return false
    const r = el.getBoundingClientRect()
    const a = toStage(el, r.left, r.top)
    const b = toStage(el, r.right, r.bottom)
    return q.x > a.x - pad && q.x < b.x + pad && q.y > a.y - pad && q.y < b.y + pad
  }

  /** The round is solved: say the equation in words, then move on. */
  const win = (d: Game) => {
    const target = ROUNDS[d.round].left
    const from = startOf(d.round)
    const ch = target - from
    d.phase = 'won'
    d.needTie = false
    d.banner = ch >= 0 ? `${from} + ${ch} = ${target}` : `${from} − ${-ch} = ${target}`
    emit({ type: 'attempt', correct: true, detail: `balanced round ${d.round + 1}: ${d.banner}` })
    const words = ch >= 0 ? `${from} and ${ch} more makes ${target}.` : `${from} take away ${-ch} leaves ${target}.`
    const idea =
      d.round === 1
        ? d.untied
          ? ' Untying a bundle gave you sticks to take away.'
          : ' You took away just the right amount.'
        : d.tied
          ? ' Ten loose sticks became a new bundle.'
          : ' You added just the right amount.'
    const last = d.round === ROUNDS.length - 1
    say(`Balanced! ${words}${idea}${last ? ' You balanced all three!' : ''}`)
    const round = d.round
    if (last) later(onChallengeDone, 4200)
    else
      later(() => {
        commit(freshRound(round + 1))
        say(`Round ${round + 2}. Make it balance again!`)
      }, 7200)
  }

  /** After any change on the right: balanced, closer, or further away? */
  const review = (d: Game, prevTotal: number, detail: string) => {
    const target = ROUNDS[d.round].left
    const t = totalOf(d.right)
    const before = Math.abs(prevTotal - target)
    const now = Math.abs(t - target)
    if (now === 0) {
      const ls = countOf(d.right, 'stick')
      if (ls >= 10) {
        if (!d.needTie) say(`It balances! Both sides make ${target}. Now tie ten loose sticks into a bundle, just like the left side.`)
        d.needTie = true
        emit({ type: 'progress', detail: `${detail}; it balances, but ${ls} loose sticks still need tying` })
        return 'tie'
      }
      win(d)
      return 'won'
    }
    d.needTie = false
    if (now > before) {
      emit({ type: 'attempt', correct: false, detail: `${detail}, which moved the right side further from ${target} (now ${t})` })
      if (!d.wrongSaid) {
        d.wrongSaid = true
        say(t > target ? 'Whoa, now the right side is too heavy. See how the seesaw tips?' : 'Hmm, now the right side is too light. See how the seesaw tips?')
      }
    } else {
      emit({ type: 'progress', detail: `${detail} (right side now ${t}, target ${target})` })
    }
    return 'play'
  }

  const addPiece = (kind: PKind, at: P | null) => {
    const c = live.current
    if (c.phase !== 'play') return
    if (kind === 'bundle' && countOf(c.right, 'bundle') >= 9) return say('The tens side is full!')
    if (kind === 'stick' && countOf(c.right, 'stick') >= 30) return say('That is a lot of loose sticks! Try tying ten into a bundle.')
    const box = kind === 'bundle' ? BUNDLE_BOX : STICK_BOX
    const f = toLocal(at ?? { x: box.x, y: box.y - 40 })
    update((d) => {
      const prev = totalOf(d.right)
      d.right = [...d.right, makePiece(kind, { from: { x: f.x, y: f.y } })]
      review(d, prev, kind === 'bundle' ? 'added a bundle (ten)' : 'added a loose stick (one)')
    })
  }

  const removePiece = (p: Piece) => {
    if (live.current.phase !== 'play') return
    update((d) => {
      const prev = totalOf(d.right)
      d.right = d.right.filter((q) => q.id !== p.id)
      review(d, prev, p.kind === 'bundle' ? 'took away a whole bundle (ten)' : 'took away a loose stick (one)')
    })
  }

  const untie = (p: Piece) => {
    const c = live.current
    if (c.phase !== 'play') return
    if (countOf(c.right, 'stick') > 20) return say('There are lots of loose sticks already. Try tying ten into a bundle first.')
    const k = c.right.filter((q) => q.kind === 'bundle').findIndex((q) => q.id === p.id)
    if (k < 0) return
    const pos = tTens(k)
    const prev = totalOf(c.right)
    update((d) => {
      d.right = [
        ...d.right.filter((q) => q.id !== p.id),
        ...range(10).map((i) => {
          const b = bundleStick(i, BPS)
          return makePiece('stick', { from: { x: pos.x + b.dx, y: pos.y, r: b.r }, wood: true })
        }),
      ]
      d.pops = [...d.pops, { id: p.id, x: pos.x, y: pos.y }]
      d.phase = 'busy'
      d.untied = true
    })
    say('Untied! One bundle became ten loose sticks.')
    later(
      () =>
        update((d) => {
          d.pops = d.pops.filter((q) => q.id !== p.id)
          d.phase = 'play'
          review(d, prev, 'untied a bundle into ten loose sticks')
        }),
      800,
    )
  }

  const tie = () => {
    const c = live.current
    if (c.phase !== 'play') return
    const ls = c.right.filter((q) => q.kind === 'stick')
    if (ls.length < 10) return
    if (countOf(c.right, 'bundle') >= 9) return say('The tens side is full!')
    const ten = ls.slice(0, 10).map((q) => q.id)
    update((d) => {
      d.gather = ten
      d.phase = 'busy'
    })
    later(() => update((d) => void (d.tieRibbon = true)), 600)
    later(() => {
      let result = 'play'
      update((d) => {
        const prev = totalOf(d.right)
        d.right = [...d.right.filter((q) => !ten.includes(q.id)), makePiece('bundle', { from: { x: CL.x, y: CL.y } })]
        d.gather = []
        d.tieRibbon = false
        d.phase = 'play'
        d.tied = true
        result = review(d, prev, 'tied ten loose sticks into a bundle')
      })
      if (result !== 'won') say('Tied! Ten loose sticks make one bundle.')
    }, 1150)
  }

  const tapPiece = (p: Piece) => {
    if (p.kind === 'bundle') return untie(p)
    if (live.current.tapSaid) return
    update((d) => void (d.tapSaid = true))
    say('To take a stick away, drag it off the mat.')
  }
  const dropPiece = (p: Piece, q: P) => {
    if (inside(rightHit.current, q, 20)) return
    removePiece(p)
  }
  const releaseSupply = (kind: PKind, q: P | null) => {
    if (!q) return addPiece(kind, null)
    if (inside(rightHit.current, q, 40)) return addPiece(kind, q)
    if (inside(leftHit.current, q, 30) && !live.current.leftSaid) {
      update((d) => void (d.leftSaid = true))
      say('The left side stays the same. Change the right side.')
    }
  }

  // Poses for the right side's pieces.
  let bi = 0
  let si = 0
  const placed = g.right.map((p) => {
    if (p.kind === 'bundle') return { p, pose: { ...tTens(bi++), r: 0 } as Pose, wood: false }
    const gi = g.gather.indexOf(p.id)
    const slot = si++
    if (gi >= 0) {
      const b = bundleStick(gi, BPS)
      return { p, pose: { x: CL.x + b.dx, y: CL.y, r: b.r } as Pose, wood: true }
    }
    return { p, pose: { ...tOnes(slot), r: 0 } as Pose, wood: false }
  })
  const enabled = g.phase === 'play'
  const won = g.phase === 'won'
  const showTie = loose >= 10 && !won

  return (
    <Mover from={{ x: 0, y: 0, o: 0 }} to={{ x: 0, y: 0, o: 1 }} dur={0.6} delay={0.3}>
      <ellipse cx={800} cy={430} rx={700} ry={300} fill={C.sunGlow} style={{ opacity: balanced ? 0.4 : 0, transition: 'opacity 0.6s' }} />

      {/* round */}
      <g>
        <rect x={40} y={28} width={270} height={64} rx={32} fill={C.white} opacity={0.92} />
        <At x={175} y={61}><Label text={`Round ${g.round + 1} of 3`} size={32} /></At>
      </g>

      {/* the seesaw */}
      <g data-tutor="the seesaw">
        <ellipse cx={PIVOT.x} cy={752} rx={150} ry={16} fill={C.shadow} />
        <path d={`M ${PIVOT.x} ${PIVOT.y - 6} L ${PIVOT.x - 96} 750 L ${PIVOT.x + 96} 750 Z`} fill={C.woodDark} />
        <path d={`M ${PIVOT.x} ${PIVOT.y - 6} L ${PIVOT.x - 40} 750 L ${PIVOT.x} 750 Z`} fill={C.ink} opacity={0.12} />
        <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
          <g style={{ transform: `rotate(${angle}deg)`, transition: TILT }}>
            <rect x={-470} y={-15} width={940} height={30} rx={15} fill={C.wood} />
            <rect x={-470} y={5} width={940} height={10} rx={5} fill={C.woodDark} opacity={0.35} />
          </g>
          <circle r={20} fill={C.mustard} stroke={C.white} strokeWidth={4} />
        </g>
      </g>

      {/* a little chick walks across a balanced seesaw, behind the posts */}
      {won && (
        <g transform={`translate(${PIVOT.x} ${PIVOT.y - 15})`}>
          <Mover from={{ x: -290, y: 0 }} to={{ x: 290, y: 0 }} dur={3.2} ease="linear">
            <g className="bob"><Chick /></g>
          </Mover>
        </g>
      )}

      {/* left side: fixed */}
      <g style={{ transform: `translate(${-rdx}px, ${-rdy}px)`, transition: TILT }}>
        <g transform={`translate(${TRAY_L.x} ${TRAY_L.y})`} data-tutor="left side">
          <TrayPost />
          <MatFrame w={TRAY_W} h={TRAY_H} head={TRAY_HEAD} tensW={TRAY_TENS} />
          <rect ref={leftHit} x={0} y={0} width={TRAY_W} height={TRAY_H} fill="none" />
          {range(Math.floor(L / 10)).map((k) => (
            <At key={`b${k}`} x={tTens(k).x} y={tTens(k).y} s={BPS}><Bundle /></At>
          ))}
          {range(L % 10).map((k) => (
            <At key={`s${k}`} x={tOnes(k).x} y={tOnes(k).y} s={BPS}><Stick color={LOOSE} /></At>
          ))}
          <rect x={-6} y={-6} width={TRAY_W + 12} height={TRAY_H + 12} rx={32} fill="none" stroke={C.sun} strokeWidth={8} style={{ opacity: balanced ? 1 : 0, transition: 'opacity 0.5s' }} />
          <At x={TRAY_W / 2} y={TRAY_H + 62} data-tutor="left number"><NumCard value={L} size={56} /></At>
        </g>
      </g>

      {/* right side: the student's */}
      <g style={{ transform: `translate(${rdx}px, ${rdy}px)`, transition: TILT }}>
        <g ref={rightRef} transform={`translate(${TRAY_R.x} ${TRAY_R.y})`} data-tutor="right side">
          <TrayPost />
          <MatFrame w={TRAY_W} h={TRAY_H} head={TRAY_HEAD} tensW={TRAY_TENS} />
          <rect ref={rightHit} x={0} y={0} width={TRAY_W} height={TRAY_H} fill="none" />
          <rect x={-6} y={-6} width={TRAY_W + 12} height={TRAY_H + 12} rx={32} fill="none" stroke={C.sun} strokeWidth={8} style={{ opacity: balanced ? 1 : 0, transition: 'opacity 0.5s' }} />
          <At x={TRAY_W / 2} y={TRAY_H + 62} data-tutor="right number"><NumCard value={total} size={56} /></At>
          {change !== 0 && (
            <At x={TRAY_W / 2 + 140} y={TRAY_H + 62} data-tutor="change on the right">
              <rect x={-58} y={-32} width={116} height={64} rx={32} fill={C.mustard} />
              <Label text={`${change > 0 ? '+' : '−'}${Math.abs(change)}`} size={36} />
            </At>
          )}
          {placed.map(({ p, pose, wood }) => (
            <TrayPiece
              key={p.id}
              piece={p}
              pose={pose}
              wood={wood}
              enabled={enabled}
              toLocal={toLocal}
              onTap={tapPiece}
              onDrop={dropPiece}
            />
          ))}
          {g.tieRibbon && (
            <Mover from={{ x: CL.x, y: CL.y, s: 0.05 }} to={{ x: CL.x, y: CL.y, s: BPS }} dur={0.35}>
              <RibbonArt />
            </Mover>
          )}
          {g.pops.map((q) => (
            <Mover key={q.id} from={{ x: q.x, y: q.y, s: BPS }} to={{ x: q.x + 40, y: q.y - 90, r: 50, s: BPS, o: 0 }} dur={0.7} ease="ease-out">
              <RibbonArt />
            </Mover>
          ))}
        </g>
      </g>

      {/* the equals sign between the two numbers, once they match */}
      <At x={PIVOT.x} y={TRAY_L.y + TRAY_H + 62}>
        <Mover to={{ x: 0, y: 0, s: balanced ? 1 : 0.2, o: balanced ? 1 : 0 }} dur={0.45}>
          <circle r={42} fill={C.white} stroke={C.sun} strokeWidth={6} />
          <Label text="=" size={60} color={C.tealDark} />
        </Mover>
      </At>

      {g.banner && (
        <At x={800} y={170}>
          <Mover from={{ x: 0, y: 0, s: 0.4, o: 0 }} to={{ x: 0, y: 0 }} dur={0.5}>
            <rect x={-200} y={-46} width={400} height={92} rx={46} fill={C.white} stroke={C.teal} strokeWidth={5} />
            <EqText text={g.banner} size={54} />
          </Mover>
        </At>
      )}

      {/* supplies and the tie button */}
      <SupplyBox kind="bundle" at={BUNDLE_BOX} enabled={enabled} onGhost={(q) => setGhost(q && { kind: 'bundle', ...q })} onRelease={(q) => releaseSupply('bundle', q)} />
      <SupplyBox kind="stick" at={STICK_BOX} enabled={enabled} onGhost={(q) => setGhost(q && { kind: 'stick', ...q })} onRelease={(q) => releaseSupply('stick', q)} />
      {showTie && (
        <g>
          {g.needTie && (
            <g transform="translate(540 832)">
              <g className="pulse"><rect x={-238} y={-52} width={476} height={104} rx={52} fill={C.sunGlow} /></g>
            </g>
          )}
          <SvgButton x={540} y={832} w={440} h={84} size={32} label="Tie 10 into a bundle" color={C.coral} onClick={tie} disabled={!enabled} tutor="Tie 10 into a bundle button" />
        </g>
      )}
      {ghost && (
        <g transform={`translate(${ghost.x} ${ghost.y}) scale(${BPS * 1.12})`} style={{ pointerEvents: 'none' }}>
          {ghost.kind === 'bundle' ? <Bundle /> : <Stick color={LOOSE} />}
        </g>
      )}
    </Mover>
  )
}

/** The post under a tray, from the tray down to the seesaw plank. */
function TrayPost() {
  return (
    <g>
      <rect x={TRAY_W / 2 - 9} y={TRAY_H - 4} width={18} height={124} rx={6} fill={C.woodDark} />
      <rect x={TRAY_W / 2 - 34} y={TRAY_H + 106} width={68} height={16} rx={6} fill={C.woodDark} />
    </g>
  )
}

function TrayStick({ wood, startWood }: { wood: boolean; startWood: boolean }) {
  const [w, setW] = useState(wood || startWood)
  useEffect(() => {
    const t = window.setTimeout(() => setW(wood), wood ? 0 : 220)
    return () => window.clearTimeout(t)
  }, [wood])
  return (
    <g>
      <Stick />
      <g style={{ opacity: w ? 0 : 1, transition: 'opacity 0.45s' }}>
        <Stick color={LOOSE} />
      </g>
    </g>
  )
}

function TrayPiece({
  piece,
  pose,
  wood,
  enabled,
  toLocal,
  onTap,
  onDrop,
}: {
  piece: Piece
  pose: Pose
  wood: boolean
  enabled: boolean
  toLocal: (q: P) => P
  onTap: (p: Piece) => void
  onDrop: (p: Piece, q: P) => void
}) {
  const [dragAt, setDragAt] = useState<P | null>(null)
  const start = useRef<P | null>(null)
  const moved = useRef(false)
  const drag = useDrag({
    onStart: (q) => {
      start.current = q
      moved.current = false
    },
    onMove: (q) => {
      const s = start.current
      if (!s) return
      if (!moved.current && Math.hypot(q.x - s.x, q.y - s.y) < 14) return
      moved.current = true
      setDragAt(toLocal(q))
    },
    onEnd: (q) => {
      const wasDrag = moved.current
      start.current = null
      moved.current = false
      setDragAt(null)
      if (wasDrag) onDrop(piece, q)
      else onTap(piece)
    },
  })
  const bundle = piece.kind === 'bundle'
  const to: Pose = dragAt ? { x: dragAt.x, y: dragAt.y, r: 0, s: 1.12 } : pose
  return (
    <Mover to={to} from={piece.from} instant={!!dragAt} dur={0.5}>
      <g {...(enabled ? drag : {})} data-tutor={bundle ? 'a bundle on the right' : 'a loose stick on the right'}>
        <rect x={bundle ? -31 : -10.5} y={-36} width={bundle ? 62 : 21} height={72} fill="transparent" />
        <g transform={`scale(${BPS})`}>{bundle ? <Bundle /> : <TrayStick wood={wood} startWood={!!piece.wood} />}</g>
      </g>
    </Mover>
  )
}

/** A wooden box of bundles or sticks. Drag from it, or tap it to add one. */
function SupplyBox({
  kind,
  at,
  enabled,
  onGhost,
  onRelease,
}: {
  kind: PKind
  at: P
  enabled: boolean
  onGhost: (q: P | null) => void
  onRelease: (q: P | null) => void
}) {
  const start = useRef<P | null>(null)
  const moved = useRef(false)
  const drag = useDrag({
    onStart: (q) => {
      start.current = q
      moved.current = false
    },
    onMove: (q) => {
      const s = start.current
      if (!s) return
      if (!moved.current && Math.hypot(q.x - s.x, q.y - s.y) < 12) return
      moved.current = true
      onGhost(q)
    },
    onEnd: (q) => {
      const m = moved.current
      start.current = null
      moved.current = false
      onGhost(null)
      onRelease(m ? q : null)
    },
  })
  const bundle = kind === 'bundle'
  return (
    <g transform={`translate(${at.x} ${at.y})`} {...(enabled ? drag : {})} data-tutor={bundle ? 'bundle box' : 'stick box'}>
      <rect x={-118} y={-112} width={236} height={170} fill="transparent" />
      {bundle
        ? [-62, 0, 62].map((x, i) => <At key={i} x={x} y={-44} s={0.6} rotate={(i - 1) * 8}><Bundle /></At>)
        : range(7).map((i) => <At key={i} x={-63 + i * 21} y={-46} s={0.6} rotate={(i - 3) * 4}><Stick color={LOOSE} /></At>)}
      <rect x={-108} y={-38} width={216} height={88} rx={14} fill={C.ink} opacity={0.15} />
      <rect x={-108} y={-44} width={216} height={88} rx={14} fill={C.wood} />
      <rect x={-108} y={-44} width={216} height={14} rx={7} fill={C.woodDark} opacity={0.5} />
      <At y={6}><Label text={bundle ? 'bundles' : 'sticks'} size={34} color={C.white} /></At>
    </g>
  )
}

/** A small yellow chick, feet at the origin, facing right. */
function Chick() {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={24} ry={5} fill={C.shadow} />
      <line x1={-8} y1={-14} x2={-10} y2={0} stroke={C.mustardDark} strokeWidth={4} strokeLinecap="round" />
      <line x1={8} y1={-14} x2={10} y2={0} stroke={C.mustardDark} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={0} cy={-36} rx={27} ry={25} fill={C.mustard} />
      <path d="M -18 -40 Q -4 -30 -20 -22" stroke={C.mustardDark} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M -2 -60 Q 2 -72 9 -60" stroke={C.mustardDark} strokeWidth={4} fill="none" strokeLinecap="round" />
      <circle cx={11} cy={-44} r={7} fill={C.white} />
      <circle cx={13} cy={-43} r={3.6} fill={C.ink} />
      <path d="M 25 -38 L 36 -34 L 25 -30 Z" fill={C.coral} />
      <circle cx={8} cy={-30} r={4} fill={C.coral} opacity={0.5} />
    </g>
  )
}

export const stop5: Stop = {
  id: 'change',
  title: 'Together and apart',
  branch: 'change',
  beats: BEATS,
  Scene,
}
