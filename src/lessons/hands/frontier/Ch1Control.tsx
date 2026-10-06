import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, handSegments, tipOnStage, useHandStore, type FingerName } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, FiveMap, Label, Pool, Readout, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { projector } from './designHand'
import { ControlReading } from './readings'

export const CUES: Cue[] = [
  { id: 'last', say: 'Last question: brain. Even a perfect hand is useless until something tells every joint what to do.' },
  { id: 'stiff', say: 'The simplest controller says: go to this angle, exactly. In free air that’s perfect. But touch something solid a millimetre early, and it pushes as hard as it can to get there.' },
  { id: 'spring', say: 'So most hands now behave like a spring instead: aim for an angle, but give way when something pushes back. Engineers call it impedance control.' },
  { id: 'soft', say: 'Set the stiffness. The hand must thread a peg into a hole it can’t quite see, without jamming or wobbling.', play: true },
  { id: 'learn', say: 'And who sets those targets, thousands of times a second? Increasingly, not a programmer. A neural network, trained on data.' },
  { id: 'needs', say: 'That changes what a good hand is. It must survive thousands of hours of clumsy practice, behave like its simulation, and be cheap enough that a lab can buy fifty.' },
]

const STATE = [
  'The five-question map from film 1: five tilted coloured rings around a robot hand. The lime ring, number 5 "Brain: control + data", flares bright while the others dim. The camera dives into the hand, which becomes a big x-ray robot hand: lime signal pulses race from the forearm along wires to every joint motor, faster and faster. The point: a hand needs something telling every joint what to do, many times a second.',
  'Side view of one big robot finger (three segments) above a solid steel block. A dashed lime ghost finger shows the target angle, which is slightly inside the block. Under position control the real finger slams onto the block a millimetre early and keeps driving: an amber force arrow grows huge, the block cracks red and the finger’s gear sparks. Label: force = stiffness × error. The point: a position controller is infinitely stubborn, so a tiny error in contact becomes a huge force.',
  'Same finger and block, but now a cyan spring sits inside each joint. The finger closes, touches the block and stops, its springs compressing a little; a small, steady amber force arrow. Label: τ = K·(target − angle). The point: impedance control makes the finger act like a spring around its target: aim for an angle, but give way when pushed. Low K is gentle, high K is stiff.',
  '',
  'The lime pulses resolve into a glowing lime neural network behind the x-ray hand. The camera drifts right to Ada, the data scientist, alone at a monitor in the dark, her face lit by scrolling training curves; on the wall behind her a small course tree has its lime data branch pulsing but not yet opened. The point: today a neural network trained on data usually sets the joint targets, not a hand-written program.',
  'A rack of six identical cheap 3D-printed robot hands practising in parallel, each with a ticking attempt counter. One keeps smashing a block and shaking. A lime wireframe "sim" hand is overlaid on another, nearly matching it. A gold price tag reads about $2,000 each (LEAP Hand). Labels: survive practice, match the sim, cheap enough to buy many. The point: learning changes what a good hand is: rugged, simulatable and cheap enough to buy many.',
]

const HINTS = ['Too stiff, and the peg fights the edge of the hole.', 'Too soft, and it can’t aim at all. Look for the middle.']

/* ---------------------------------------------------------------- the finger diagram */

/** The side-view finger: base pivot and segment lengths (stage units). */
const FB = { x: 380, y: 300 }
const FL = [250, 185, 135]
/** Joint angles: open, touching the block, and the target the position controller wants. */
const OPEN = 3
const TOUCH = 15.6
const TARGET = 23
const BLOCK = { x: 760, y: 560, w: 420, h: 200 }

function fingerTip(theta: number) {
  let x = FB.x
  let y = FB.y
  let a = 0
  for (const l of FL) {
    a += theta
    x += l * Math.cos((a * Math.PI) / 180)
    y += l * Math.sin((a * Math.PI) / 180)
  }
  return { x, y }
}

/** One robot finger, side-on: three shells on dark joints. Rotated joint by joint by the timeline. */
function SideFinger({ cls, ghost = false, springs = false }: { cls: string; ghost?: boolean; springs?: boolean }) {
  const seg = (x0: number, len: number, r0: number, r1: number) =>
    ghost ? (
      <path d={`M${x0 + r0 * 0.6} ${FB.y - r0} L${x0 + len} ${FB.y - r1} A${r1} ${r1} 0 0 1 ${x0 + len} ${FB.y + r1} L${x0 + r0 * 0.6} ${FB.y + r0} Z`} fill={C.lime} fillOpacity={0.06} stroke={C.lime} strokeWidth={2.5} strokeDasharray="10 7" />
    ) : (
      <g>
        <path d={`M${x0 + r0 * 0.6} ${FB.y - r0} L${x0 + len} ${FB.y - r1} A${r1} ${r1} 0 0 1 ${x0 + len} ${FB.y + r1} L${x0 + r0 * 0.6} ${FB.y + r0} Z`} fill="url(#cn-shell)" />
        <path d={`M${x0 + r0 * 0.8} ${FB.y + r0 * 0.55} L${x0 + len - 6} ${FB.y + r1 * 0.55}`} stroke={C.shellDark} strokeWidth={r1 * 0.5} strokeLinecap="round" opacity={0.6} />
        <path d={`M${x0 + r0 * 0.8} ${FB.y - r0 * 0.5} L${x0 + len - 10} ${FB.y - r1 * 0.5}`} stroke={C.white} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      </g>
    )
  const joint = (x: number, r: number, i: number) =>
    ghost ? (
      <circle cx={x} cy={FB.y} r={r * 0.7} fill="none" stroke={C.lime} strokeWidth={2} strokeDasharray="5 5" />
    ) : (
      <g>
        <circle cx={x} cy={FB.y} r={r} fill={C.carbon} />
        <circle cx={x} cy={FB.y} r={r * 0.42} fill={C.metal} stroke={C.ink} strokeWidth={1.5} />
        {springs && (
          <g className={`c1-spring c1-spring-${i}`} opacity={0}>
            <circle cx={x} cy={FB.y} r={r * 1.18} fill="none" stroke={C.cyan} strokeWidth={2.5} filter="url(#cn-bloom)" />
            <g className={`c1-coil-${i}`}>
              <path d={`M${x - r * 0.8} ${FB.y} l${r * 0.2} ${-r * 0.4} l${r * 0.27} ${r * 0.8} l${r * 0.27} ${-r * 0.8} l${r * 0.27} ${r * 0.8} l${r * 0.27} ${-r * 0.8} l${r * 0.2} ${r * 0.4}`} fill="none" stroke={C.cyanLight} strokeWidth={3.2} strokeLinejoin="round" />
            </g>
          </g>
        )}
      </g>
    )
  const x1 = FB.x + FL[0]
  const x2 = x1 + FL[1]
  return (
    <g className={`${cls}-j0`}>
      {seg(FB.x, FL[0], 40, 34)}
      <g className={`${cls}-j1`}>
        {seg(x1, FL[1], 34, 29)}
        <g className={`${cls}-j2`}>
          {seg(x2, FL[2], 29, 25)}
          {!ghost && <circle cx={x2 + FL[2] - 4} cy={FB.y + 4} r={20} fill={C.rubber} opacity={0.9} />}
          {joint(x2, 29, 2)}
        </g>
        {joint(x1, 34, 1)}
      </g>
      {joint(FB.x, 42, 0)}
    </g>
  )
}

function bendFinger(tl: gsap.core.Timeline, cls: string, from: number, to: number, at: number, dur: number, ease = 'power2.inOut') {
  const x1 = FB.x + FL[0]
  const x2 = x1 + FL[1]
  tl.fromTo(`.${cls}-j0`, { rotation: from, svgOrigin: `${FB.x} ${FB.y}` }, { rotation: to, svgOrigin: `${FB.x} ${FB.y}`, duration: dur, ease, immediateRender: false }, at)
  tl.fromTo(`.${cls}-j1`, { rotation: from, svgOrigin: `${x1} ${FB.y}` }, { rotation: to, svgOrigin: `${x1} ${FB.y}`, duration: dur, ease, immediateRender: false }, at)
  tl.fromTo(`.${cls}-j2`, { rotation: from, svgOrigin: `${x2} ${FB.y}` }, { rotation: to, svgOrigin: `${x2} ${FB.y}`, duration: dur, ease, immediateRender: false }, at)
}

/* ---------------------------------------------------------------- the peg-in-hole play */

/** Stage pixels per millimetre in the peg close-up. */
const PX = 18
const PEG_W = 64
const PLATE_Y = 690
const HOVER_TIP = 520
const CHAMFER_MM = 4.5
const JAM_N = 10
const K_MIN = 0.2
const K_MAX = 20
const kOf = (v: number) => K_MIN * Math.pow(K_MAX / K_MIN, v)
/** How far the hand wanders, mm, at stiffness K (soft hands can't hold their aim). */
const wobbleOf = (k: number) => 3 / k

type Outcome = 'in' | 'jam' | 'miss'
interface Attempt {
  id: number
  k: number
  outcome: Outcome
  force: number
  err: number
}

/** One insertion: where the peg meets the plate, and what happens. Documented so Pip can explain it. */
function simulate(k: number, offset: number): { outcome: Outcome; err: number; force: number } {
  // The hand aims at where it thinks the hole is (the ghost), but a soft hand wanders by
  // up to 3/K mm, sometimes toward the hole, more often away.
  const a = wobbleOf(k)
  const r = (Math.random() < 0.3 ? -1 : 1) * (0.35 + Math.random() * 0.65)
  const err = offset + a * r
  // Outside the chamfer: it lands on flat metal beside the hole and can't find it.
  if (Math.abs(err) > CHAMFER_MM) return { outcome: 'miss', err, force: 3 }
  // On the chamfer: the slope pushes the peg sideways, and the hand must give way by err mm.
  // A spring of stiffness K resists with K × err newtons; above ~10 N friction locks it.
  const f = k * Math.abs(err)
  if (f > JAM_N) return { outcome: 'jam', err, force: Math.min(48, f * 1.6) }
  return { outcome: 'in', err, force: Math.max(1.5, f) }
}

const newOffset = (prev: number) => {
  let o = 0
  do o = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random())
  while (Math.abs(o - prev) < 0.4)
  return o
}

/** The force trace of one attempt, as points in a 0..1 time × newtons space. */
function trace(a: Attempt): [number, number][] {
  if (a.outcome === 'in')
    return [
      [0, 0],
      [0.3, 0],
      [0.42, a.force],
      [0.52, a.force * 0.9],
      [0.62, 1],
      [0.8, 0.8],
      [1, 0],
    ]
  if (a.outcome === 'jam')
    return [
      [0, 0],
      [0.3, 0],
      [0.38, a.force * 0.6],
      [0.44, a.force],
      [0.8, a.force * 0.95],
      [0.88, 0],
      [1, 0],
    ]
  return [
    [0, 0],
    [0.3, 0],
    [0.36, a.force],
    [0.8, a.force],
    [0.86, 0],
    [1, 0],
  ]
}

const TRACE = { x: 1170, y: 470, w: 340, h: 200, fmax: 50 }

/* ---------------------------------------------------------------- the scene */

/** The x-ray hand in the dive and the network shot. */
const XH = { x: 640, y: 780 }
const XVIEW = { yaw: -18, pitch: 8, roll: 0, s: 2.7 }
const XARM = 300

/** Lime wires from the forearm to every joint of the x-ray hand. */
function signalPaths() {
  const { segs } = handSegments(GRASPS.relaxed)
  const proj = projector(XVIEW, XH.x, XH.y)
  const fingers: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'little']
  const wrist = proj([0, 0, 6])
  const elbow = proj([0, -XARM * 0.95, 4])
  return fingers.map((f) => {
    const fs = segs.filter((s) => s.finger === f)
    const pts = [elbow, wrist, ...fs.map((s) => proj(s.a)), proj(fs[2].b)]
    return { f, d: `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}`, joints: fs.map((s) => proj(s.a)) }
  })
}

export function Ch1Control({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapShot = useRef<SVGGElement>(null)
  const xrShot = useRef<SVGGElement>(null)
  const fingerShot = useRef<SVGGElement>(null)
  const pegShot = useRef<SVGGElement>(null)
  const rackShot = useRef<SVGGElement>(null)
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -20, pitch: 6, roll: 0, s: 1.15 } })
  const xHand = useHandStore({ pose: GRASPS.relaxed, view: XVIEW, xray: 1 })
  const pegHand = useHandStore({ pose: GRASPS.pinch, view: { yaw: 82, pitch: -6, roll: 180, s: 1.7 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const camMap = camera(mapShot.current, { x: 800, y: 470, zoom: 0.92 })
      const camX = camera(xrShot.current, { x: 640, y: 560, zoom: 1.5 })
      const camF = camera(fingerShot.current, { x: 800, y: 450, zoom: 1.04 })
      const camP = camera(pegShot.current, { x: 800, y: 460, zoom: 1.1 })
      const camR = camera(rackShot.current, { x: 800, y: 450, zoom: 1.25 })
      const ada = rig(root.current, 'c1-ada', POSES.type)
      const shots = ['.c1-map', '.c1-xr', '.c1-finger', '.c1-peg', '.c1-rack']
      // (a hair after the label, so the cue before doesn't end on the next cue's cut)
      const only = (keep: string, at: number) => shots.forEach((s) => tl.set(s, { opacity: s === keep ? 1 : 0 }, at + 0.02))

      /* b0: the map, the lime ring flares, dive into the hand; signals race to every joint. */
      tl.addLabel('b0', 0)
      only('.c1-map', 0)
      tl.set('.c1-net, .c1-ada-set', { opacity: 0 }, 0)
      fade(tl, '.fm-ring-shape, .fm-ring-muscle, .fm-ring-tendons, .fm-ring-touch, .fm-lab-shape, .fm-lab-muscle, .fm-lab-tendons, .fm-lab-touch', 0.12, 0.3, 1.2, 0.35)
      tl.fromTo('.fm-ring-brain', { opacity: 0.22 }, { opacity: 1, duration: 0.9, ease: 'power2.out', immediateRender: false }, 0.5)
      tl.fromTo('.fm-lab-brain', { opacity: 0.35 }, { opacity: 1, duration: 0.9, immediateRender: false }, 0.5)
      tl.fromTo('.c1-flare', { opacity: 0, scale: 0.6, svgOrigin: '800 470' }, { opacity: 1, scale: 1.1, svgOrigin: '800 470', duration: 1.2, ease: 'power2.out', immediateRender: false }, 0.6)
      camMap.to(tl, { x: 800, y: 470, zoom: 1.08 }, 0, 2.2, 'sine.inOut')
      camMap.to(tl, { x: 806, y: 440, zoom: 4.2 }, 2.2, 1.3, 'power3.in')
      tl.set('.c1-xr', { opacity: 1 }, 3.25)
      tl.set('.c1-map', { opacity: 0 }, 3.5)
      fade(tl, '.c1-xr', 1, 3.1, 0.4)
      camX.to(tl, { x: 680, y: 500, zoom: 0.98 }, 3.1, 1.6, 'power3.out')
      camX.to(tl, { x: 660, y: 470, zoom: 1.06 }, 4.7, 3.6, 'sine.inOut')
      fade(tl, '.c1-wires', 1, 3.6, 0.8)
      tl.fromTo('.c1-pulse', { strokeDashoffset: 0 }, { strokeDashoffset: -2600, duration: 4.6, ease: 'power2.in', immediateRender: false }, 3.6)
      tl.fromTo('.c1-jdot', { opacity: 0.2 }, { opacity: 1, duration: 0.18, repeat: 13, yoyo: true, stagger: 0.03, immediateRender: false }, 4.4)
      fade(tl, '.c1-lab-every', 1, 5.2, 0.6)

      /* b1: position control. The finger slams onto the block early and drives on. */
      const b1 = 8.4
      tl.addLabel('b1', b1)
      only('.c1-finger', b1)
      tl.set('.c1-spring', { opacity: 0 }, b1)
      camF.to(tl, { x: 800, y: 450, zoom: 1.04 }, b1, 0.01)
      camF.to(tl, { x: 830, y: 470, zoom: 1.12 }, b1 + 0.1, 10, 'sine.inOut')
      bendFinger(tl, 'c1-f', OPEN, OPEN, b1, 0.01)
      bendFinger(tl, 'c1-g', TARGET, TARGET, b1, 0.01)
      fade(tl, '.c1-mode-pos', 1, b1 + 0.3, 0.5)
      fade(tl, '.c1-ghost', 1, b1 + 0.8, 0.6)
      fade(tl, '.c1-lab-target', 1, b1 + 1.1, 0.5)
      // free air: it swings exactly where it is told (and back)
      bendFinger(tl, 'c1-f', OPEN, 9, b1 + 1.6, 0.7, 'power2.inOut')
      bendFinger(tl, 'c1-f', 9, OPEN, b1 + 2.4, 0.6, 'power2.inOut')
      fade(tl, '.c1-lab-free', 1, b1 + 1.8, 0.4)
      fade(tl, '.c1-lab-free', 0, b1 + 3.4, 0.4, 1)
      // then the block, a millimetre early
      bendFinger(tl, 'c1-f', OPEN, TOUCH, b1 + 4.6, 0.45, 'power3.in')
      const hit = b1 + 5.05
      camF.shake(tl, hit, 1.3, 0.5)
      fade(tl, '.c1-err', 1, hit, 0.3)
      tl.fromTo('.c1-farrow', { scaleY: 0.1, opacity: 0, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}` }, { scaleY: 1, opacity: 1, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}`, duration: 0.25, immediateRender: false }, hit)
      tl.fromTo('.c1-farrow', { scaleY: 1, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}` }, { scaleY: 3.2, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}`, duration: 2.2, ease: 'power2.in', immediateRender: false }, hit + 0.3)
      fade(tl, '.c1-lab-fse', 1, hit + 0.6, 0.5)
      tl.fromTo('.c1-crack', { strokeDashoffset: 400 }, { strokeDashoffset: 0, duration: 0.35, immediateRender: false }, hit + 2.4)
      fade(tl, '.c1-blockred', 1, hit + 2.4, 0.2)
      camF.shake(tl, hit + 2.45, 1.8, 0.6)
      tl.fromTo('.c1-spark', { opacity: 0, x: 0, y: 0 }, { opacity: 1, x: (i) => [-60, 40, -20, 70, 10, -80][i % 6], y: (i) => [-70, -90, -120, -40, -60, -20][i % 6], duration: 0.4, ease: 'power2.out', immediateRender: false }, hit + 2.45)
      tl.to('.c1-spark', { opacity: 0, duration: 0.4 }, hit + 2.85)
      fade(tl, '.c1-sparkglow', 1, hit + 2.45, 0.1)
      fade(tl, '.c1-sparkglow', 0, hit + 2.6, 0.8, 1)

      /* b2: impedance control. Springs in the joints; it touches and gives. */
      const b2 = b1 + 11
      tl.addLabel('b2', b2)
      fade(tl, '.c1-mode-pos, .c1-lab-fse, .c1-err, .c1-blockred', 0, b2, 0.5, 1)
      tl.fromTo('.c1-farrow', { scaleY: 3.2, opacity: 1, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}` }, { scaleY: 0.1, opacity: 0, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}`, duration: 0.5, immediateRender: false }, b2)
      tl.fromTo('.c1-crack', { strokeDashoffset: 0 }, { strokeDashoffset: 400, duration: 0.5, immediateRender: false }, b2)
      bendFinger(tl, 'c1-f', TOUCH, OPEN, b2, 0.8)
      fade(tl, '.c1-mode-imp', 1, b2 + 0.5, 0.5)
      tl.fromTo('.c1-spring', { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.2, ease: 'back.out(2)', immediateRender: false }, b2 + 1)
      camF.to(tl, { x: 700, y: 420, zoom: 1.3 }, b2 + 0.4, 2.6, 'power2.inOut')
      bendFinger(tl, 'c1-f', OPEN, TOUCH, b2 + 2.6, 1.4, 'power2.out')
      // the springs take up the error: they squash, and the push stays modest
      for (let i = 0; i < 3; i++) tl.fromTo(`.c1-coil-${i}`, { scaleX: 1, transformOrigin: '50% 50%' }, { scaleX: 0.62, transformOrigin: '50% 50%', duration: 0.6, ease: 'power2.out', immediateRender: false }, b2 + 3.8)
      tl.fromTo('.c1-farrow', { scaleY: 0.1, opacity: 0, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}` }, { scaleY: 0.75, opacity: 1, svgOrigin: `${fingerTip(TOUCH).x} ${BLOCK.y}`, duration: 0.6, ease: 'power2.out', immediateRender: false }, b2 + 3.8)
      fade(tl, '.c1-lab-tau', 1, b2 + 4.4, 0.6)
      fade(tl, '.c1-lab-give', 1, b2 + 5.2, 0.6)
      camF.to(tl, { x: 820, y: 470, zoom: 1.1 }, b2 + 4.2, 4.6, 'sine.inOut')

      /* b3: the peg and the hole (the play). */
      const b3 = b2 + 9.6
      tl.addLabel('b3', b3)
      only('.c1-peg', b3)
      camP.to(tl, { x: 800, y: 470, zoom: 1.22 }, b3, 0.01)
      camP.to(tl, { x: 800, y: 470, zoom: 1 }, b3 + 0.05, 3.2, 'power2.inOut')
      fade(tl, '.c1-pegui', 1, b3 + 1.6, 0.8)

      /* b4: the network behind the hand, then Ada at her screen. */
      const b4 = b3 + 4
      tl.addLabel('b4', b4)
      only('.c1-xr', b4)
      tl.set('.c1-lab-every', { opacity: 0 }, b4)
      tl.set('.c1-wires', { opacity: 1 }, b4)
      camX.to(tl, { x: 640, y: 450, zoom: 1.15 }, b4, 0.01)
      tl.fromTo('.c1-pulse', { strokeDashoffset: -2600 }, { strokeDashoffset: -5200, duration: 9, ease: 'none', immediateRender: false }, b4)
      fade(tl, '.c1-net', 1, b4 + 0.4, 1.6)
      tl.fromTo('.c1-netedge', { strokeDashoffset: 300 }, { strokeDashoffset: 0, duration: 1.4, stagger: 0.02, ease: 'power2.out', immediateRender: false }, b4 + 0.4)
      camX.to(tl, { x: 900, y: 420, zoom: 0.9 }, b4 + 0.3, 2.8, 'power2.inOut')
      fade(tl, '.c1-ada-set', 1, b4 + 2.2, 1)
      camX.to(tl, { x: 1660, y: 430, zoom: 1.35 }, b4 + 3.2, 4, 'power2.inOut')
      ada.idle(tl, b4, 9)
      tl.fromTo('.c1-curves', { x: 0 }, { x: -220, duration: 9, ease: 'none', immediateRender: false }, b4)
      fade(tl, '.c1-lab-net', 1, b4 + 1.4, 0.6)
      fade(tl, '.c1-lab-net', 0, b4 + 3.4, 0.6, 1)

      /* b5: the practice rack. */
      const b5 = b4 + 9
      tl.addLabel('b5', b5)
      only('.c1-rack', b5)
      camR.to(tl, { x: 800, y: 450, zoom: 1.25 }, b5, 0.01)
      camR.to(tl, { x: 800, y: 470, zoom: 1 }, b5 + 0.05, 4, 'power2.inOut')
      camR.to(tl, { x: 760, y: 480, zoom: 1.06 }, b5 + 4.1, 8.4, 'sine.inOut')
      // every hand practising: curl, open, curl ... on its own rhythm
      for (let i = 0; i < 6; i++) {
        const per = 0.9 + (i % 3) * 0.17
        const n = Math.floor(12.4 / per)
        tl.fromTo(`.c1-rf-${i}`, { rotation: 0, svgOrigin: '0 0' }, { rotation: 64, duration: per / 2, repeat: n, yoyo: true, ease: 'sine.inOut', svgOrigin: '0 0', immediateRender: false }, b5 + i * 0.13)
        tl.fromTo(`.c1-count-${i}`, { textContent: 12000 + i * 731 }, { textContent: 12000 + i * 731 + 140 + i * 9, duration: 12.4, ease: 'none', snap: { textContent: 1 }, immediateRender: false }, b5)
      }
      // the clumsy one smacks its block, again and again
      for (let k = 0; k < 6; k++) {
        const t = b5 + 1 + k * 1.9
        tl.fromTo('.c1-bonk', { y: 0, rotation: 0, svgOrigin: '0 0' }, { y: -26, rotation: 18, svgOrigin: '0 0', duration: 0.15, ease: 'power2.out', immediateRender: false }, t)
        tl.to('.c1-bonk', { y: 0, rotation: 0, duration: 0.3, ease: 'bounce.out' }, t + 0.15)
        tl.fromTo('.c1-bonkcell', { x: 0 }, { x: 6, duration: 0.05, repeat: 5, yoyo: true, immediateRender: false }, t)
        tl.fromTo('.c1-bonkflash', { opacity: 0.8 }, { opacity: 0, duration: 0.5, immediateRender: false }, t)
      }
      fade(tl, '.c1-lab-survive', 1, b5 + 3.4, 0.6)
      fade(tl, '.c1-simghost', 1, b5 + 5.6, 0.8)
      fade(tl, '.c1-lab-sim', 1, b5 + 5.8, 0.6)
      fade(tl, '.c1-lab-cheap', 1, b5 + 8.6, 0.6)
      tl.fromTo('.c1-tag', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)', immediateRender: false }, b5 + 8.4)
      tl.to({}, { duration: 0.1 }, b5 + 12.4)
    },
    [],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c1-hum', { opacity: 0.6, duration: 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-netnode', { opacity: 0.45, duration: 0.9, yoyo: true, repeat: -1, stagger: { each: 0.13, repeat: -1, yoyo: true }, ease: 'sine.inOut' })
    gsap.to('.c1-screenflick', { opacity: 0.7, duration: 0.13, yoyo: true, repeat: -1, repeatDelay: 2.3 })
  })

  /* ---------------- the play ---------------- */
  const [kv, setKv] = useState(0.92)
  const [offset, setOffset] = useState(1.9)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [streak, setStreak] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState<{ text: string; color: string } | null>(null)
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  const local = useRef<gsap.core.Timeline | null>(null)
  const sway = useRef<gsap.core.Tween | null>(null)
  const prevOffset = useRef(offset)
  const nextId = useRef(1)
  const k = kOf(kv)
  const active = cueIndex === 3 && !done

  // A soft hand sways around its aim; a stiff one holds still. Rebuilt whenever K changes.
  useEffect(() => {
    sway.current?.kill()
    const el = root.current?.querySelector('.c1-sway')
    if (!el || busy) return
    const deg = Math.min(7, wobbleOf(k) * 0.9)
    gsap.set(el, { rotation: -deg, svgOrigin: `800 ${SPRING_Y}` })
    sway.current = gsap.to(el, { rotation: deg, svgOrigin: `800 ${SPRING_Y}`, duration: 0.5 + 1.6 / Math.sqrt(k + 0.4), yoyo: true, repeat: -1, ease: 'sine.inOut', paused: !playingRef.current })
    return () => {
      sway.current?.kill()
    }
  }, [k, busy])

  // When the hole moves to a new place, slide it there.
  useEffect(() => {
    const el = root.current?.querySelector('.c1-holeslide')
    if (el && prevOffset.current !== offset) gsap.fromTo(el, { x: (prevOffset.current - offset) * PX }, { x: 0, duration: 0.6, ease: 'power2.inOut' })
    prevOffset.current = offset
  }, [offset])

  useEffect(() => {
    if (playing) {
      sway.current?.resume()
      local.current?.resume()
    } else {
      sway.current?.pause()
      local.current?.pause()
    }
  }, [playing])
  useEffect(() => () => {
    local.current?.kill()
    sway.current?.kill()
  }, [])

  const insert = () => {
    if (!active || busy) return
    const r = simulate(k, offset)
    const at: Attempt = { id: nextId.current++, k, ...r }
    setBusy(true)
    setNote(null)
    const el = root.current
    if (!el) return
    const rigEl = el.querySelector('.c1-rig')
    const swayEl = el.querySelector('.c1-sway')
    const latEl = el.querySelector('.c1-lat')
    // where the peg tip comes down, relative to where the robot thinks the hole is
    const landX = (offset - r.err) * PX
    // move the hand sideways; the two springs stretch and squash to follow it
    const lat = (tl: gsap.core.Timeline, x: number, at: number, dur: number, ease = 'power2.inOut', extra: gsap.TweenVars = {}) => {
      tl.to(latEl, { x, duration: dur, ease, ...extra }, at)
      tl.to('.c1-springL', { scaleX: (220 + x) / 220, svgOrigin: `560 ${SPRING_Y}`, duration: dur, ease, ...extra }, at)
      tl.to('.c1-springR', { scaleX: (220 - x) / 220, svgOrigin: `1040 ${SPRING_Y}`, duration: dur, ease, ...extra }, at)
    }
    const tl = gsap.timeline({ paused: !playingRef.current })
    local.current?.kill()
    local.current = tl
    const drop = PLATE_Y - HOVER_TIP
    tl.to(swayEl, { rotation: 0, svgOrigin: `800 ${SPRING_Y}`, duration: 0.3 }, 0)
    lat(tl, landX, 0.2, 0.8, 'power1.inOut')
    tl.fromTo(rigEl, { y: 0 }, { y: drop - (r.outcome === 'miss' ? 0 : 22), duration: 0.8, ease: 'power2.in' }, 0.2)
    tl.fromTo('.c1-trace-live', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 2.4, ease: 'none' }, 0)
    if (r.outcome === 'in') {
      // the chamfer guides it: the hand gives way sideways and the peg drops in
      lat(tl, offset * PX, 1.0, 0.5, 'power1.inOut')
      tl.to(rigEl, { y: drop + 12, duration: 0.5, ease: 'power1.inOut' }, 1.0)
      tl.to(rigEl, { y: drop + 110, duration: 0.6, ease: 'power2.out' }, 1.5)
      tl.fromTo('.c1-okring', { opacity: 1, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 0, scale: 1.8, transformOrigin: '50% 50%', duration: 0.8 }, 2.0)
      tl.to(rigEl, { y: 0, duration: 0.7, ease: 'power2.inOut' }, 2.6)
      lat(tl, 0, 2.6, 0.7)
    } else if (r.outcome === 'jam') {
      tl.fromTo('.c1-jamflash', { opacity: 0.9 }, { opacity: 0, duration: 0.9 }, 1.0)
      lat(tl, landX + 5, 1.0, 0.05, 'none', { repeat: 9, yoyo: true })
      tl.to(rigEl, { y: 0, duration: 0.7, ease: 'power2.inOut' }, 2.4)
      lat(tl, 0, 2.4, 0.7)
    } else {
      tl.fromTo(swayEl, { rotation: 0 }, { rotation: 4, svgOrigin: `800 ${SPRING_Y}`, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.0)
      tl.to(rigEl, { y: 0, duration: 0.7, ease: 'power2.inOut' }, 2.4)
      lat(tl, 0, 2.4, 0.7)
    }
    tl.call(() => finish(at), [], 3.2)
  }

  const finish = (at: Attempt) => {
    setAttempts((a) => [...a.slice(-3), at])
    setBusy(false)
    const ok = at.outcome === 'in'
    const s = ok ? streak + 1 : 0
    setStreak(s)
    emit({ type: 'attempt', correct: ok, detail: `K = ${at.k.toFixed(1)} N/mm: ${at.outcome === 'in' ? 'slid in' : at.outcome === 'jam' ? `jammed at ${Math.round(at.force)} N` : 'missed the hole, wandered too much'}` })
    if (at.outcome === 'jam') setNote({ text: `jammed: ${Math.round(at.force)} N against the chamfer`, color: C.danger })
    else if (at.outcome === 'miss') setNote({ text: 'missed: too soft to hold its aim', color: C.mist })
    else setNote({ text: s >= 2 ? 'in, twice in a row' : 'in! once more', color: C.lime })
    if (s >= 2) {
      setDone(true)
      void say('Soft enough to be guided, stiff enough to aim. That middle ground is why backdrivable hands are prized.')
      onPlayDone()
      return
    }
    setOffset((o) => newOffset(o))
  }

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 3) {
      const last = attempts[attempts.length - 1]
      reportState(
        `The learner's turn: peg in a hole. Side view of a robot hand holding a metal peg above a plate with a chamfered (bevelled) hole. A dashed lime marker shows where the robot THINKS the hole is; the real hole is ${offset.toFixed(1)} mm to the ${offset > 0 ? 'right' : 'left'} (it moves a little each attempt). A stiffness slider sets K, now ${k.toFixed(1)} N/mm (range 0.2 to 20, log scale). Two cyan springs hold the arm; a soft hand visibly sways. Pressing "insert" runs one attempt and draws a force trace. ` +
          `Model: a soft hand wanders by about 3/K mm, so below ~1.5 N/mm it often misses the chamfer entirely (can't aim); on the chamfer the hand must give way sideways, which takes K × error newtons, and above 10 N the peg jams. The sweet spot is roughly K = 1.5 to 4 N/mm (the middle of the slider). ` +
          `Attempts so far: ${attempts.length ? attempts.map((a) => `${a.k.toFixed(1)} N/mm → ${a.outcome}`).join('; ') : 'none'}. Current streak: ${streak} of 2 needed in a row.${last ? ` Last result: ${last.outcome}.` : ''}${done ? ' Done.' : ''} Likely mix-ups: thinking stiffer is always more precise, or that softer is always safer.`,
      )
      setHints(HINTS)
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, attempts, streak, offset, k, done, reportState, setHints])

  /* ---------------- drawing ---------------- */
  const wires = signalPaths()
  const tip = tipOnStage(pegHand, 'index', 800, 200)
  const thumb = tipOnStage(pegHand, 'thumb', 800, 200)
  const grip = { x: (tip.x + thumb.x) / 2, y: (tip.y + thumb.y) / 2 }
  const PEG_TOP = HOVER_TIP - 150
  const handDX = 800 - grip.x
  const handDY = PEG_TOP + 26 - grip.y
  const tracePts = (a: Attempt) => trace(a).map(([t, f]) => `${(TRACE.x + t * TRACE.w).toFixed(1)} ${(TRACE.y - (Math.min(f, TRACE.fmax) / TRACE.fmax) * TRACE.h).toFixed(1)}`).join(' L')
  const holeX = 800 + offset * PX
  const chamfer = CHAMFER_MM * PX
  const coils = Math.round(4 + kv * 8)

  return (
    <g ref={root}>
      {/* ---------- shot: the five-question map ---------- */}
      <g className="c1-map" ref={mapShot} pointerEvents="none">
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c1-flare" opacity={0}>
            <Pool x={800} y={470} r={620} color="lime" opacity={0.55} />
          </g>
          <FiveMap cx={800} cy={470} />
          <Hand3D store={mapHand} x={800} y={600} look="robot" arm={120} />
        </g>
        <g data-depth="1.6">
          <Dust x={-200} y={-100} w={2000} h={1100} count={24} seed={61} color={C.lime} size={0.8} />
        </g>
      </g>

      {/* ---------- shot: the x-ray hand, its wires, the network, and Ada ---------- */}
      <g className="c1-xr" ref={xrShot} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={4000} height={2100} fill={C.ink} />
          <rect x={-800} y={-600} width={4000} height={2100} fill="url(#cn-grid-big)" opacity={0.35} />
          <Pool x={640} y={420} r={700} color="rim" opacity={0.3} />
        </g>
        <g data-depth="0.8">
          <g className="c1-net" opacity={0}>
            <NeuralNet x={640} y={330} />
          </g>
        </g>
        <g data-depth="1">
          <Hand3D store={xHand} x={XH.x} y={XH.y} look="robot" arm={XARM} light={[-0.7, -0.6]} />
          <g className="c1-wires" opacity={0}>
            {wires.map((w) => (
              <g key={w.f}>
                <path d={w.d} fill="none" stroke={C.lime} strokeWidth={2} opacity={0.35} strokeLinejoin="round" />
                <path className="c1-pulse" d={w.d} fill="none" stroke={C.limeLight} strokeWidth={5} strokeDasharray="14 70" strokeLinecap="round" strokeLinejoin="round" filter="url(#cn-bloom)" />
                {w.joints.map((j, i) => (
                  <circle key={i} className="c1-jdot" cx={j.x} cy={j.y} r={9} fill={C.lime} opacity={0.2} filter="url(#cn-bloom)" />
                ))}
              </g>
            ))}
          </g>
          <Label className="c1-lab-every" x={wires[2].joints[1].x} y={wires[2].joints[1].y} tx={1010} ty={210} text="a target for every joint" sub="many times a second" color={C.lime} />
          <Label className="c1-lab-net" x={640} y={250} tx={980} ty={130} text="a neural network sets the targets" color={C.lime} />
          {/* Ada, at her screen, in the dark */}
          <g className="c1-ada-set" opacity={0}>
            <Pool x={1760} y={520} r={420} color="lime" opacity={0.35} />
            <rect x={1440} y={700} width={560} height={16} fill={C.ink3} />
            <rect x={1460} y={716} width={14} height={180} fill={C.ink2} />
            <rect x={1966} y={716} width={14} height={180} fill={C.ink2} />
            {/* the course tree pinned to the wall, its lime branch pulsing */}
            <g transform="translate(1520 250)">
              <rect x={-60} y={-90} width={120} height={160} fill={C.ink2} stroke={C.slate} strokeWidth={1.5} />
              <path d="M0 60 V-70" stroke={C.amber} strokeWidth={4} />
              {[50, 25, 0, -25, -50, -70].map((y) => (
                <circle key={y} cx={0} cy={y} r={5} fill={C.amber} />
              ))}
              <path className="hd-pulse" d="M0 40 Q24 20 30 -10 T40 -60" stroke={C.lime} strokeWidth={4} fill="none" filter="url(#cn-bloom)" />
            </g>
            {/* the monitor: training curves scroll by */}
            <g transform="translate(1800 520)">
              <rect x={-160} y={-120} width={320} height={200} rx={8} fill={C.ink} stroke={C.slate} strokeWidth={3} />
              <rect x={-12} y={80} width={24} height={60} fill={C.ink3} />
              <rect x={-60} y={136} width={120} height={10} fill={C.ink3} />
              <clipPath id="c1-screen">
                <rect x={-150} y={-110} width={300} height={180} />
              </clipPath>
              <g clipPath="url(#c1-screen)" className="c1-screenflick">
                <rect x={-150} y={-110} width={300} height={180} fill="#071a12" />
                <g className="c1-curves">
                  <path d={curve(0)} fill="none" stroke={C.lime} strokeWidth={3} />
                  <path d={curve(1)} fill="none" stroke={C.cyan} strokeWidth={2} opacity={0.8} />
                  {Array.from({ length: 12 }, (_, i) => (
                    <line key={i} x1={-150 + i * 60} x2={-150 + i * 60} y1={-110} y2={70} stroke={C.lime} strokeOpacity={0.12} />
                  ))}
                </g>
                <text x={-136} y={-86} fill={C.limeLight} fontFamily={MONO} fontSize={14}>
                  policy loss ↓ · success ↑
                </text>
              </g>
            </g>
            <g className="c1-hum">
              <Pool x={1700} y={480} r={200} color="lime" opacity={0.5} />
            </g>
            <Person name="c1-ada" x={1560} y={900} s={1.05} pose={POSES.type} hair="curls" glasses top="#2f5d62" topDark="#1c3a3e" skin={C.skinC} skinDark={C.skinCDark} light="screen" />
          </g>
        </g>
        <g data-depth="1.5">
          <Dust x={-200} y={0} w={2600} h={900} count={30} seed={63} color={C.lime} size={0.9} />
        </g>
      </g>

      {/* ---------- shot: one finger and a block ---------- */}
      <g className="c1-finger" ref={fingerShot} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
          <Pool x={760} y={460} r={640} color="key" opacity={0.35} />
        </g>
        <g data-depth="1">
          {/* the mount the finger hangs from */}
          <rect x={200} y={220} width={170} height={160} rx={14} fill={C.ink3} stroke={C.slate} strokeWidth={2} />
          <rect x={220} y={240} width={70} height={120} rx={8} fill={C.amberDark} opacity={0.7} />
          <text x={255} y={410} textAnchor="middle" fill={C.amber} fontFamily={MONO} fontSize={18}>
            motor
          </text>
          <g className="c1-sparkglow" opacity={0}>
            <Pool x={380} y={300} r={160} color="amber" />
          </g>
          {Array.from({ length: 6 }, (_, i) => (
            <circle key={i} className="c1-spark" cx={380} cy={300} r={4} fill={C.amberLight} opacity={0} filter="url(#cn-bloom)" />
          ))}
          {/* the block */}
          <g>
            <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.w} height={BLOCK.h} fill="url(#cn-metal)" />
            <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.w} height={6} fill={C.white} opacity={0.5} />
            <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.w} height={BLOCK.h} fill="url(#cn-hatch)" opacity={0.4} />
            <rect className="c1-blockred" x={BLOCK.x} y={BLOCK.y} width={BLOCK.w} height={BLOCK.h} fill={C.danger} opacity={0} style={{ mixBlendMode: 'screen' }} />
            <path className="c1-crack" d={`M${fingerTip(TOUCH).x - 4} ${BLOCK.y} l18 40 l-26 34 l30 44 l-14 38 M${fingerTip(TOUCH).x + 14} ${BLOCK.y + 74} l40 20 l12 40`} stroke={C.ink} strokeWidth={4} fill="none" strokeDasharray={400} strokeDashoffset={400} strokeLinejoin="round" />
            <text x={BLOCK.x + BLOCK.w - 20} y={BLOCK.y + BLOCK.h - 24} textAnchor="end" fill={C.ink2} fontFamily={MONO} fontSize={20}>
              rigid block
            </text>
          </g>
          <g className="c1-ghost" opacity={0}>
            <SideFinger cls="c1-g" ghost />
          </g>
          <SideFinger cls="c1-f" springs />
          {/* the push */}
          <g className="c1-farrow" opacity={0}>
            <g filter="url(#cn-bloom)">
              <path d={`M${fingerTip(TOUCH).x - 7} ${BLOCK.y - 120} h14 v86 h14 l-21 30 l-21 -30 h14 Z`} fill={C.amber} />
            </g>
          </g>
          <Label className="c1-lab-target" x={fingerTip(TARGET).x - 10} y={fingerTip(TARGET).y - 10} tx={1240} ty={800} text="target angle" sub="inside the block" color={C.lime} />
          <Label className="c1-lab-free" x={fingerTip(9).x} y={fingerTip(9).y} tx={1100} ty={300} text="free air: exactly on target" color={C.cyan} />
          <g className="c1-err" opacity={0}>
            <text x={fingerTip(TOUCH).x + 60} y={BLOCK.y - 30} fill={C.paper} fontFamily={MONO} fontSize={22}>
              error: 1 mm
            </text>
          </g>
          <Label className="c1-lab-fse" x={fingerTip(TOUCH).x - 10} y={BLOCK.y - 200} tx={1010} ty={250} text="force = stiffness × error" sub="stiffness ≈ infinite, so force ≈ huge" color={C.amber} size={34} />
          <g className="c1-mode-pos" opacity={0}>
            <text x={200} y={170} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
              position control
            </text>
          </g>
          <g className="c1-mode-imp" opacity={0}>
            <text x={200} y={170} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
              impedance control
            </text>
          </g>
          <Label className="c1-lab-tau" x={FB.x + FL[0]} y={FB.y - 40} tx={760} ty={150} text="τ = K·(target − angle)" sub="a spring around the target" color={C.lime} size={34} />
          <Label className="c1-lab-give" x={fingerTip(TOUCH).x + 10} y={BLOCK.y - 60} tx={1150} ty={420} text="touches, and gives" sub="small, steady push" color={C.amber} />
        </g>
      </g>

      {/* ---------- shot: the peg and the hole ---------- */}
      <g className="c1-peg" ref={pegShot} opacity={0}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <rect x={-800} y={-600} width={3200} height={2100} fill="url(#cn-grid-big)" opacity={0.3} />
          <Pool x={300} y={200} r={500} color="rim" opacity={0.25} />
        </g>
        <g data-depth="1">
          <Pool x={800} y={560} r={600} color="key" opacity={0.6} />
          {/* the plate, the real hole, and where the robot thinks it is */}
          <rect x={-200} y={PLATE_Y + 110} width={2000} height={400} fill={C.ink2} />
          <rect x={-200} y={PLATE_Y + 110} width={2000} height={3} fill={C.keyDeep} opacity={0.5} />
          <rect x={360} y={PLATE_Y} width={880} height={112} fill="url(#cn-metal)" />
          <rect x={360} y={PLATE_Y} width={880} height={5} fill={C.white} opacity={0.4} />
          <rect x={360} y={PLATE_Y} width={880} height={112} fill="url(#cn-hatch)" opacity={0.25} />
          <g transform={`translate(${holeX} 0)`}>
            <g className="c1-holeslide">
              <path d={`M${-PEG_W / 2 - 4 - chamfer} ${PLATE_Y} L${-PEG_W / 2 - 4} ${PLATE_Y + chamfer} V${PLATE_Y + 112} H${PEG_W / 2 + 4} V${PLATE_Y + chamfer} L${PEG_W / 2 + 4 + chamfer} ${PLATE_Y} Z`} fill={C.ink} />
              <path d={`M${-PEG_W / 2 - 4 - chamfer} ${PLATE_Y} L${-PEG_W / 2 - 4} ${PLATE_Y + chamfer} M${PEG_W / 2 + 4 + chamfer} ${PLATE_Y} L${PEG_W / 2 + 4} ${PLATE_Y + chamfer}`} stroke={C.metal} strokeWidth={3} />
              <circle className="c1-okring" cx={0} cy={PLATE_Y + 20} r={80} fill="none" stroke={C.lime} strokeWidth={5} opacity={0} />
              <text x={0} y={PLATE_Y - 14} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={17}>
                real hole
              </text>
            </g>
          </g>
          <g pointerEvents="none">
            <line x1={800} y1={PLATE_Y - 60} x2={800} y2={PLATE_Y + 125} stroke={C.lime} strokeWidth={2.5} strokeDasharray="8 6" />
            <circle cx={800} cy={PLATE_Y} r={12} fill="none" stroke={C.lime} strokeWidth={2.5} />
            <text x={812} y={PLATE_Y + 150} fill={C.lime} fontFamily={MONO} fontSize={18}>
              where it thinks the hole is
            </text>
            <text x={offset > 0 ? 680 : 920} y={PLATE_Y - 40} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={20}>
              {Math.abs(offset).toFixed(1)} mm off
            </text>
          </g>
          <rect className="c1-jamflash" x={-200} y={PLATE_Y - 300} width={2000} height={700} fill={C.danger} opacity={0} pointerEvents="none" style={{ mixBlendMode: 'screen' }} />
          {/* the springs that make the hand stiff or soft, and the hand itself */}
          <g className="c1-rig">
            <g pointerEvents="none">
              <rect x={440} y={SPRING_Y - 150} width={720} height={26} rx={6} fill={C.ink3} />
              <rect x={540} y={SPRING_Y - 130} width={20} height={170} fill={C.ink3} />
              <rect x={1040} y={SPRING_Y - 130} width={20} height={170} fill={C.ink3} />
              <path className="c1-springL" d={zigzag(560, 780, SPRING_Y, coils)} fill="none" stroke={C.cyan} strokeWidth={2 + kv * 4} strokeLinejoin="round" />
              <path className="c1-springR" d={zigzag(820, 1040, SPRING_Y, coils)} fill="none" stroke={C.cyan} strokeWidth={2 + kv * 4} strokeLinejoin="round" />
            </g>
            <g className="c1-lat">
            <g className="c1-sway">
              <g transform={`translate(${handDX} ${handDY})`}>
                <Hand3D store={pegHand} x={800} y={200} look="robot" arm={340} light={[0.8, -0.5]} />
              </g>
              <rect x={800 - PEG_W / 2} y={PEG_TOP} width={PEG_W} height={150} rx={6} fill="url(#cn-metal)" />
              <rect x={800 - PEG_W / 2 + 8} y={PEG_TOP} width={10} height={150} fill={C.white} opacity={0.4} />
              <path d={`M${800 - PEG_W / 2} ${HOVER_TIP - 12} L${800 - PEG_W / 2 + 12} ${HOVER_TIP} H${800 + PEG_W / 2 - 12} L${800 + PEG_W / 2} ${HOVER_TIP - 12}`} fill={C.metalDark} />
            </g>
            </g>
          </g>
        </g>
        <g className="c1-pegui" opacity={0}>
          <Slider x={110} y={850} w={460} value={kv} onChange={(v) => !busy && setKv(v)} color={C.cyan} label="stiffness K" valueText={`${k.toFixed(1)} N/mm`} tutor="stiffness slider" ticks={[{ at: 0, text: 'very soft' }, { at: 1, text: 'very stiff' }]} disabled={!active} />
          <Chip x={1330} y={846} w={200} text={busy ? '…' : 'insert'} onClick={insert} color={C.lime} active={!busy && active} disabled={!active || busy} tutor="insert button" />
          {/* the force traces */}
          <g pointerEvents="none">
            <text x={TRACE.x} y={TRACE.y - TRACE.h - 26} fill={C.fog} fontFamily={SANS} fontSize={20}>
              force on the peg
            </text>
            <line x1={TRACE.x} y1={TRACE.y} x2={TRACE.x + TRACE.w} y2={TRACE.y} stroke={C.slate} strokeWidth={2} />
            <line x1={TRACE.x} y1={TRACE.y} x2={TRACE.x} y2={TRACE.y - TRACE.h} stroke={C.slate} strokeWidth={2} />
            <line x1={TRACE.x} x2={TRACE.x + TRACE.w} y1={TRACE.y - (JAM_N / TRACE.fmax) * TRACE.h} y2={TRACE.y - (JAM_N / TRACE.fmax) * TRACE.h} stroke={C.danger} strokeDasharray="6 6" strokeWidth={1.5} />
            <text x={TRACE.x + TRACE.w} y={TRACE.y - (JAM_N / TRACE.fmax) * TRACE.h - 8} textAnchor="end" fill={C.danger} fontFamily={MONO} fontSize={15}>
              jams above 10 N
            </text>
            {attempts.map((a, i) => (
              <path key={a.id} className={i === attempts.length - 1 ? 'c1-trace-last' : undefined} d={`M${tracePts(a)}`} fill="none" stroke={a.outcome === 'jam' ? C.danger : a.outcome === 'in' ? C.amber : C.mist} strokeWidth={i === attempts.length - 1 ? 3.5 : 2} opacity={0.35 + (0.65 * (i + 1)) / attempts.length} strokeLinejoin="round" />
            ))}
            {busy && <path className="c1-trace-live" d={`M${TRACE.x} ${TRACE.y} L${TRACE.x + TRACE.w} ${TRACE.y}`} stroke={C.amber} strokeWidth={2} strokeDasharray={900} />}
            <text x={TRACE.x + TRACE.w} y={TRACE.y + 30} textAnchor="end" fill={C.fog} fontFamily={MONO} fontSize={16}>
              time →
            </text>
            {/* the streak */}
            <text x={TRACE.x} y={TRACE.y + 64} fill={C.fog} fontFamily={SANS} fontSize={20}>
              in a row
            </text>
            {[0, 1].map((i) => (
              <circle key={i} cx={TRACE.x + 110 + i * 34} cy={TRACE.y + 57} r={11} fill={streak > i ? C.lime : 'none'} stroke={C.lime} strokeWidth={2.5} />
            ))}
            {note && (
              <Readout x={TRACE.x} y={TRACE.y + 104} color={note.color} size={18}>
                {note.text}
              </Readout>
            )}
          </g>
        </g>
      </g>

      {/* ---------- shot: the practice rack ---------- */}
      <g className="c1-rack" ref={rackShot} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <Pool x={800} y={300} r={900} color="rim" opacity={0.25} />
        </g>
        <g data-depth="1">
          <PracticeRack />
          <Label className="c1-lab-survive" x={RACK[4].x + 70} y={RACK[4].y + 40} tx={760} ty={850} text="survive practice" sub="thousands of clumsy hours" color={C.danger} anchor="middle" />
          <Label className="c1-lab-sim" x={RACK[1].x - 60} y={RACK[1].y - 110} tx={560} ty={70} text="match the sim" color={C.lime} anchor="middle" />
          <Label className="c1-lab-cheap" x={RACK[5].x + 180} y={RACK[5].y - 100} tx={1440} ty={830} text="cheap enough to buy many" color={C.gold} anchor="end" />
        </g>
        <g data-depth="1.6">
          <Dust x={-200} y={0} w={2000} h={900} count={26} seed={66} color={C.keyLight} />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** Where the cyan springs hold the arm in the peg shot. */
const SPRING_Y = 175

function zigzag(x0: number, x1: number, y: number, n: number) {
  const step = (x1 - x0) / (n * 2)
  let d = `M${x0} ${y}`
  for (let i = 0; i < n * 2; i++) d += ` L${(x0 + step * (i + 1)).toFixed(1)} ${y + (i % 2 ? 16 : -16)}`
  return d + ` L${x1} ${y}`
}

/** A wobbly training curve for Ada's screen (two screens wide so it can scroll). */
function curve(seed: number) {
  let d = ''
  for (let i = 0; i <= 120; i++) {
    const x = -150 + i * 5
    const base = seed === 0 ? 40 - 120 * (1 - Math.exp(-i / 40)) : -60 + 100 * Math.exp(-i / 30)
    const y = base + Math.sin(i * 1.7 + seed) * 8 + Math.sin(i * 0.37) * 6
    d += `${i ? ' L' : 'M'}${x} ${y.toFixed(1)}`
  }
  return d
}

/** A glowing lime network: four layers, fully connected, behind the hand. */
function NeuralNet({ x, y }: { x: number; y: number }) {
  const layers = [5, 7, 7, 5]
  const pos = layers.map((n, li) => Array.from({ length: n }, (_, i) => ({ x: x - 420 + li * 280, y: y - (n - 1) * 55 + i * 110 })))
  return (
    <g pointerEvents="none">
      <Pool x={x} y={y} r={620} color="lime" opacity={0.3} />
      {pos.slice(0, -1).map((L, li) =>
        L.flatMap((a, i) =>
          pos[li + 1].map((b, k) => <line key={`${li}-${i}-${k}`} className="c1-netedge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.lime} strokeWidth={1.2} opacity={0.35} strokeDasharray={300} />),
        ),
      )}
      {pos.flat().map((p, i) => (
        <circle key={i} className="c1-netnode" cx={p.x} cy={p.y} r={11} fill={C.lime} filter="url(#cn-bloom)" />
      ))}
    </g>
  )
}

/** The six practice cells of the rack. */
const RACK = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 290 + (i % 3) * 400, y: 330 + Math.floor(i / 3) * 330 }))

/** Six identical printed hands on a rack, curling and opening on their own rhythms. */
function PracticeRack() {
  return (
    <g pointerEvents="none">
      {/* the rack */}
      {[0, 1].map((r) => (
        <g key={r}>
          <rect x={60} y={RACK[r * 3].y + 92} width={1480} height={16} fill={C.ink3} />
          <rect x={60} y={RACK[r * 3].y + 92} width={1480} height={3} fill={C.keyDeep} opacity={0.5} />
        </g>
      ))}
      {[70, 1520].map((x) => (
        <rect key={x} x={x} y={120} width={14} height={720} fill={C.ink3} />
      ))}
      {RACK.map((c, i) => {
        const bonk = i === 4
        return (
          <g key={i} className={bonk ? 'c1-bonkcell' : undefined}>
            <g transform={`translate(${c.x} ${c.y})`}>
              <Pool x={0} y={0} r={200} color="key" opacity={0.5} />
              {bonk && (
                <g className="c1-bonkflash" opacity={0}>
                  <Pool x={60} y={40} r={200} color="danger" />
                </g>
              )}
              <g transform="translate(-30 30) scale(1.6)">
              {/* the block it practises on */}
              <g className={bonk ? 'c1-bonk' : undefined} transform="translate(70 39)">
                <rect x={-30} y={-46} width={60} height={46} fill={i % 2 ? C.cyanDark : C.amberDark} />
                <rect x={-30} y={-46} width={60} height={5} fill={C.white} opacity={0.3} />
              </g>
              {/* a printed hand, side-on, hanging from a little arm */}
              <rect x={-120} y={-190} width={22} height={140} fill={C.ink4} />
              <g transform="translate(-104 -50)">
                <rect x={-26} y={-14} width={92} height={46} rx={10} fill="#d8cfba" />
                <rect x={-26} y={-14} width={92} height={46} rx={10} fill="url(#fr-layers-rack)" opacity={0.6} />
                {[0, 1, 2, 3].map((f) => (
                  <g key={f} transform={`translate(${60 - f * 6} ${-6 + f * 11})`}>
                    <g className={`c1-rf-${i}`}>
                      <rect x={0} y={-5} width={62 - f * 6} height={11} rx={5.5} fill="#cfc5ae" stroke="#9e937c" strokeWidth={1} />
                      <circle cx={0} cy={0} r={4} fill="#3a3a40" />
                    </g>
                  </g>
                ))}
                <rect x={-18} y={26} width={10} height={10} rx={2} fill={C.carbon} />
              </g>
              {i === 1 && (
                <g className="c1-simghost" opacity={0}>
                  <g transform="translate(-98 -54)">
                    <rect x={-26} y={-14} width={92} height={46} rx={10} fill="none" stroke={C.lime} strokeWidth={2} strokeDasharray="5 4" />
                    {[0, 1, 2, 3].map((f) => (
                      <g key={f} transform={`translate(${60 - f * 6} ${-6 + f * 11})`}>
                        <g className={`c1-rf-${i}`}>
                          <rect x={0} y={-5} width={62 - f * 6} height={11} rx={5.5} fill="none" stroke={C.lime} strokeWidth={1.6} />
                        </g>
                      </g>
                    ))}
                  </g>
                  <text x={-150} y={-60} fill={C.lime} fontFamily={MONO} fontSize={14}>
                    sim
                  </text>
                </g>
              )}
              </g>
              {i === 5 && (
                <g className="c1-tag" opacity={0}>
                  <path d="M60 -140 h110 l20 22 l-20 22 h-110 z" fill={C.gold} />
                  <circle cx={72} cy={-118} r={5} fill={C.ink} />
                  <text x={124} y={-110} textAnchor="middle" fill={C.ink} fontFamily={SANS} fontWeight={700} fontSize={22}>
                    ~$2,000
                  </text>
                </g>
              )}
              <Readout x={-150} y={120} size={18} color={C.lime}>
                <tspan>tries </tspan>
                <tspan className={`c1-count-${i}`}>{12000 + i * 731}</tspan>
              </Readout>
            </g>
          </g>
        )
      })}
      <defs>
        <pattern id="fr-layers-rack" width={6} height={3} patternUnits="userSpaceOnUse">
          <path d="M0 0.5 H6" stroke="#6e6553" strokeWidth={0.8} />
        </pattern>
      </defs>
    </g>
  )
}

export const ch1: Chapter = {
  id: 'control',
  title: 'The brain in the hand',
  cues: CUES,
  Scene: Ch1Control,
  deeper: [ControlReading],
}
