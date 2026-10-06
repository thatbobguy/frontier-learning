import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { useDrag } from '../../../engine/svg'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Meter, Pool, Readout, Vignette, fade, useAmbient } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import { MuscleStyle, RFinger, TorqueArc, count, fingerRig } from './parts'
import { TendonsReading } from './readings'

export const CUES: Cue[] = [
  { id: 'choice', say: 'So where should the motors live? In the hand, right at the joints? Or back in the forearm, like your own muscles?' },
  { id: 'weight', say: 'Motors in the hand make it heavy, and every gram at the end of the arm costs the shoulder dearly. A one-and-a-half kilo hand held out at arm’s length is like a bag of sugar on a broomstick.' },
  { id: 'tendons', say: 'Motors in the forearm keep the fingers light, and leave room for bigger motors. But now force has to travel through tendons, and tendons have a problem: friction.' },
  { id: 'capstan', say: 'Every time a cable bends around a corner, friction eats a share of its pull, and the losses multiply. With one full turn of total bending, about half of the motor’s pull never reaches the fingertip.' },
  { id: 'route', say: 'Route the tendon. Drag the pulleys to get the most force to the fingertip, but the finger still has to bend all the way.', play: true },
  { id: 'stretch', say: 'Tendons also stretch, creep longer over time and wear where they rub. Fresh plastic tendon can stretch by more than nine percent, so they’re pre-stretched and heat-set, and still need re-tensioning.' },
]

const STATE = [
  'The dark night lab, rain on the windows. Two robot arms stand side by side on pillars, held out horizontally. Left: motors packed into the hand itself (an x-ray glow of amber motor capsules in the palm and at the knuckles). Right: motors back in the forearm (amber actuators in the forearm, cyan tendons running through the wrist to each finger). The question: should the motors live in the hand or in the forearm, like human muscles do?',
  'Close on the left arm: with its motors in the hand, the arm sags and an amber torque arc swells at the shoulder, labelled "hand mass × g × arm length" (about 1.5 kg × 9.8 m/s² × 0.6 m ≈ 9 N·m just to hold the hand out, before it carries anything). Then the camera pans to Theo in silhouette holding a broom straight out with a bag of sugar on the end, wobbling: weight far from the shoulder is hard to hold.',
  'The right arm, motors in the forearm, lifts easily. The camera pushes into its forearm and the picture becomes a blueprint: a side view of forearm, wrist and finger. A bright cyan pulse runs along a single tendon from the forearm motor, over the wrist, round a pulley at each knuckle, to the fingertip.',
  'The blueprint tendon glows brightest at the motor and dims after every bend. Readouts at each bend show the tension that is left: 100% → 85% → 72% → 61% → 53%. The capstan equation: T_out = T_in · e^(−μθ). With friction μ ≈ 0.1 and one full turn of total bending (θ = 2π, about a quarter turn at each of four bends), about half the motor\'s pull is lost before the fingertip. The losses multiply, they do not add.',
  '',
  'Tendons stretch. A cable under load lengthens against a ruler: fresh UHMWPE (Dyneema) tendon can stretch more than 9% (creep), pre-stretched and heat-set fibre less than 1%. As slack appears, the real finger lags behind its command (a dashed ghost finger shows where it should be). A tensioner screw at the motor turns and takes up the slack, and the finger catches up. Tendons also wear where they rub on pulleys.',
]

/* ---------------- the lab ---------------- */
const ARM_L = { sx: 150, sy: 430 }
const ARM_R = { sx: 900, sy: 430 }
const HS = 1.25
const ARM_LEN = 230
const wristOf = (sx: number) => sx + ARM_LEN * HS + 20
const HAND_VIEW = { yaw: 0, pitch: -64, roll: -90, s: HS }
const THEO = { x: 2380, y: 790 }

/* ---------------- the blueprint ---------------- */
const MOTOR = { x: 260, y: 570 }
const W = { x: 640, y: 520 }
const K = { x: 900, y: 520 }
const LENS = [170, 120, 95]
const BEND = [15, 15, 15]
const DEG = Math.PI / 180
const P = { x: K.x + Math.cos(15 * DEG) * 170, y: K.y + Math.sin(15 * DEG) * 170 }
const D = { x: P.x + Math.cos(30 * DEG) * 120, y: P.y + Math.sin(30 * DEG) * 120 }
const ANCHOR = { x: D.x + Math.cos(45 * DEG) * 50 - Math.sin(45 * DEG) * 22, y: D.y + Math.sin(45 * DEG) * 50 + Math.cos(45 * DEG) * 22 }
const JOINTS = [
  { id: 'knuckle', ...K, beta: 7.5 },
  { id: 'middle', ...P, beta: 22.5 },
  { id: 'end', ...D, beta: 37.5 },
]
/** Where each pulley may go: centre and radius. */
const ZONES = [
  { name: 'wrist', x: 640, y: 505, r: 95 },
  { name: 'knuckle', x: 895, y: 545, r: 62 },
  { name: 'middle', x: 1060, y: 590, r: 56 },
  { name: 'end', x: 1158, y: 646, r: 50 },
]
const START = [
  { x: 640, y: 420 },
  { x: 885, y: 600 },
  { x: 1088, y: 604 },
  { x: 1146, y: 672 },
]
const MU = 0.15
const TARGET = 0.7

type Pt = { x: number; y: number }

function routeOf(ps: Pt[]) {
  const pts = [MOTOR, ...ps, ANCHOR]
  const turns: number[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
    const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)
    let d = Math.abs(a2 - a1)
    if (d > Math.PI) d = 2 * Math.PI - d
    turns.push(d)
  }
  const theta = turns.reduce((a, b) => a + b, 0)
  let left = 1
  const after = turns.map((t) => (left *= Math.exp(-MU * t)))
  // moment arm at each finger joint: how far its pulley sits on the palm side
  const arms = JOINTS.map((j, i) => {
    const p = ps[i + 1]
    const n = { x: -Math.sin(j.beta * DEG), y: Math.cos(j.beta * DEG) }
    return (p.x - j.x) * n.x + (p.y - j.y) * n.y
  })
  return { pts, turns, theta, after, force: Math.exp(-MU * theta), arms }
}

export function Ch3Placement({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const labRef = useRef<SVGGElement>(null)
  const bpRef = useRef<SVGGElement>(null)
  const left = useHandStore({ pose: GRASPS.relaxed, view: HAND_VIEW, xray: 0.45 })
  const right = useHandStore({ pose: GRASPS.relaxed, view: HAND_VIEW, xray: 1 })

  /* ---------------- the play ---------------- */
  const [ps, setPs] = useState<Pt[]>(START)
  const [done, setDone] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const r = routeOf(ps)
  const okJ = r.arms.map((a) => a > 6)
  const allOk = okJ.every(Boolean)
  const win = allOk && r.force >= TARGET
  const active = cueIndex === 4 && !done
  const lastEmit = useRef(0)

  useEffect(() => {
    if (!active || drag !== null) return
    if (Date.now() - lastEmit.current > 1200) {
      lastEmit.current = Date.now()
      emit({ type: 'attempt', correct: win, detail: `routed the tendon: ${Math.round(r.theta / DEG)}° of bending, ${Math.round(r.force * 100)}% reaches the fingertip${allOk ? '' : `, but the ${JOINTS.filter((_, i) => !okJ[i]).map((j) => j.id).join(' and ')} joint can't bend`}` })
    }
    if (!win) return
    const t = window.setTimeout(() => {
      setDone(true)
      memory.tendonForce = Math.round(r.force * 100)
      void say('Straighter paths, fewer bends. That’s why Tesla patented a special router for the cables in the wrist.')
      onPlayDone()
    }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, win, drag, ps])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(labRef.current, { x: 800, y: 480, zoom: 0.92 })
      const cam2 = camera(bpRef.current, { x: 800, y: 450, zoom: 1 })
      const theo = rig(el, 'c3-theo', { ...POSES.stand, armN: 84, elbowN: 4, armF: 78, elbowF: 8 })
      const real = fingerRig(el, 'c3r', BEND as [number, number, number])
      const ghost = fingerRig(el, 'c3g', BEND as [number, number, number])

      /* b0: two arms in the dark lab. */
      tl.addLabel('b0', 0)
      tl.set('.c3-bp, .c3-play', { opacity: 0 }, 0)
      tl.set('.c3-lab', { opacity: 1 }, 0)
      cam.to(tl, { zoom: 1.02, x: 820, y: 470 }, 0, 9, 'sine.inOut')
      left.to(tl, { pose: GRASPS.open }, 0.6, 2)
      right.to(tl, { pose: GRASPS.open, pull: { index: 0.8, middle: 0.8, ring: 0.6, little: 0.6, thumb: 0.6 } }, 0.9, 2)
      left.to(tl, { pose: GRASPS.relaxed }, 4.4, 2)
      right.to(tl, { pose: GRASPS.relaxed, pull: { index: 0, middle: 0, ring: 0, little: 0, thumb: 0 } }, 4.7, 2)
      fade(tl, '.c3-l-in', 1, 1.6, 0.5)
      fade(tl, '.c3-l-fore', 1, 3.2, 0.5)

      /* b1: the hand-motor arm sags; a bag of sugar on a broomstick. */
      const b1 = 9
      tl.addLabel('b1', b1)
      fade(tl, '.c3-l-in, .c3-l-fore', 0, b1, 0.4, 1)
      cam.to(tl, { zoom: 1.45, x: 430, y: 430 }, b1, 1.8)
      tl.fromTo('.c3-armL', { rotation: 0 }, { rotation: 10, duration: 2.2, ease: 'power2.inOut', svgOrigin: `${ARM_L.sx} ${ARM_L.sy}`, immediateRender: false }, b1 + 0.8)
      tl.fromTo('.c3-tqs', { scale: 0.5, opacity: 0, svgOrigin: `${ARM_L.sx} ${ARM_L.sy}` }, { scale: 1, opacity: 1, duration: 2.4, ease: 'power2.in', immediateRender: false }, b1 + 0.8)
      fade(tl, '.c3-l-mgl', 1, b1 + 2.4, 0.6)
      fade(tl, '.c3-l-nm', 1, b1 + 3.4, 0.6)
      // pan across to Theo with his broom
      cam.to(tl, { zoom: 1.25, x: 2080, y: 500 }, b1 + 6.2, 2.4, 'power2.inOut')
      fade(tl, '.c3-theo-all', 1, b1 + 5.6, 0.6)
      theo.to(tl, { armN: 76, armF: 70, torso: 6, lean: 3 }, b1 + 8.4, 0.9, 'sine.inOut')
      theo.to(tl, { armN: 86, armF: 80, torso: 2, lean: -2 }, b1 + 9.3, 0.8, 'sine.inOut')
      theo.to(tl, { armN: 72, armF: 66, torso: 8, lean: 4 }, b1 + 10.1, 1.0, 'sine.inOut')
      theo.to(tl, { armN: 80, armF: 74, torso: 4, lean: 0 }, b1 + 11.1, 1.0, 'sine.inOut')
      tl.fromTo('.c3-broom', { rotation: 0 }, { rotation: -7, duration: 0.9, yoyo: true, repeat: 3, ease: 'sine.inOut', svgOrigin: `${THEO.x - 170} ${THEO.y - 270}`, immediateRender: false }, b1 + 8.4)
      fade(tl, '.c3-l-sugar', 1, b1 + 8.6, 0.6)

      /* b2: the forearm-motor arm lifts easily; follow one tendon into the blueprint. */
      const b2 = b1 + 14.5
      tl.addLabel('b2', b2)
      fade(tl, '.c3-l-mgl, .c3-l-nm, .c3-l-sugar', 0, b2, 0.4, 1)
      cam.to(tl, { zoom: 1.25, x: 1120, y: 440 }, b2, 1.8)
      tl.fromTo('.c3-armR', { rotation: 0 }, { rotation: -9, duration: 1.2, ease: 'power2.out', svgOrigin: `${ARM_R.sx} ${ARM_R.sy}`, immediateRender: false }, b2 + 1.2)
      tl.fromTo('.c3-armR', { rotation: -9 }, { rotation: 0, duration: 1.2, ease: 'power2.inOut', svgOrigin: `${ARM_R.sx} ${ARM_R.sy}`, immediateRender: false }, b2 + 2.6)
      fade(tl, '.c3-l-light', 1, b2 + 1.4, 0.5)
      fade(tl, '.c3-l-light', 0, b2 + 3.6, 0.4, 1)
      right.to(tl, { pull: { index: 1 } }, b2 + 3.4, 0.6)
      cam.to(tl, { zoom: 3, x: 1080, y: 430 }, b2 + 3.8, 1.4, 'power3.in')
      fade(tl, '.c3-lab', 0, b2 + 4.8, 0.5, 1)
      fade(tl, '.c3-bp', 1, b2 + 4.8, 0.5)
      cam2.cut(tl, { zoom: 2, x: 300, y: 560 }, b2 + 4.8)
      cam2.to(tl, { zoom: 1.6, x: 1000, y: 600 }, b2 + 5.3, 4.6, 'sine.inOut')
      tl.fromTo('.c3-pulse', { strokeDashoffset: 0 }, { strokeDashoffset: -1400, duration: 4.6, ease: 'sine.inOut', immediateRender: false }, b2 + 5.3)
      fade(tl, '.c3-pulse', 1, b2 + 5.1, 0.3)
      fade(tl, '.c3-pulse', 0, b2 + 9.9, 0.5, 1)
      fade(tl, '.c3-bl-motor', 1, b2 + 5.4, 0.5)
      fade(tl, '.c3-bl-pulley', 1, b2 + 8.2, 0.5)

      /* b3: the capstan: every bend eats a share. */
      const b3 = b2 + 11.3
      tl.addLabel('b3', b3)
      cam2.to(tl, { zoom: 1.08, x: 680, y: 520 }, b3, 1.6)
      fade(tl, '.c3-bl-motor, .c3-bl-pulley', 0, b3, 0.4, 1)
      fade(tl, '.c3-cap', 1, b3 + 0.6, 0.4)
      for (let i = 0; i < 5; i++) {
        tl.fromTo(`.c3-seg-${i}`, { opacity: 0.2 }, { opacity: 1, duration: 0.5, immediateRender: false }, b3 + 1.6 + i * 1.3)
        fade(tl, `.c3-cr-${i}`, 1, b3 + 1.8 + i * 1.3, 0.4)
      }
      fade(tl, '.c3-cap-eq', 1, b3 + 8.6, 0.6)
      fade(tl, '.c3-cap-half', 1, b3 + 10.6, 0.6)

      /* b4: the play: drag the pulleys. */
      const b4 = b3 + 15
      tl.addLabel('b4', b4)
      fade(tl, '.c3-cap, .c3-baseroute', 0, b4, 0.5, 1)
      fade(tl, '.c3-play', 1, b4 + 0.2, 0.6, 0)
      cam2.to(tl, { zoom: 1, x: 760, y: 500 }, b4, 1)
      tl.to({}, { duration: 0.1 }, b4 + 2.4)

      /* b5: tendons stretch and creep; the finger lags; re-tension. */
      const b5 = b4 + 2.6
      tl.addLabel('b5', b5)
      fade(tl, '.c3-play, .c3-basefinger', 0, b5, 0.5, 1)
      fade(tl, '.c3-str', 1, b5 + 0.3, 0.6)
      cam2.to(tl, { zoom: 1.04, x: 760, y: 470 }, b5, 12, 'sine.inOut')
      tl.fromTo('.c3-cable', { attr: { x2: 700 } }, { attr: { x2: 754 }, duration: 3.2, ease: 'power1.out', immediateRender: false }, b5 + 1.0)
      tl.fromTo('.c3-wt', { x: 0 }, { x: 54, duration: 3.2, ease: 'power1.out', immediateRender: false }, b5 + 1.0)
      count(tl, el, '.c3-stretch-n', 0, 9.2, b5 + 1.0, 3.2, (n) => `+${n.toFixed(1)}%`, 'power1.out')
      fade(tl, '.c3-l-fresh', 1, b5 + 2.4, 0.5)
      // the command curls the finger; the slack real finger lags behind
      ghost.to(tl, [32, 40, 34], b5 + 4.0, 1.4)
      real.to(tl, [18, 20, 18], b5 + 4.3, 1.8)
      fade(tl, '.c3-l-lag', 1, b5 + 5.2, 0.5)
      fade(tl, '.c3-l-heat', 1, b5 + 6.0, 0.5)
      // re-tension: the screw turns, the slack goes
      tl.fromTo('.c3-tens', { rotation: 0 }, { rotation: 540, duration: 1.8, ease: 'power2.inOut', svgOrigin: `${MOTOR.x - 90} ${MOTOR.y}`, immediateRender: false }, b5 + 8.0)
      real.to(tl, [32, 40, 34], b5 + 8.4, 1.6)
      fade(tl, '.c3-l-lag', 0, b5 + 8.6, 0.4, 1)
      fade(tl, '.c3-l-tens', 1, b5 + 8.6, 0.5)
      tl.to({}, { duration: 0.1 }, b5 + 12.3)
    },
    [left, right],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-palmglow', { opacity: 0.55, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-hum', { opacity: 0.4, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    if (cueIndex === 4) {
      const bad = JOINTS.filter((_, i) => !okJ[i]).map((j) => j.id)
      reportState(
        `The learner's turn, on the blueprint: a side view of a forearm, wrist and slightly curled robot finger. A cyan tendon runs from a motor in the forearm, over four draggable pulleys (at the wrist, the knuckle, the middle joint and the end joint), to an anchor near the fingertip. Each pulley can be dragged within a dashed circle. Every bend costs force: force at the tip = e^(−0.15 × total bend in radians). Readouts at each pulley show how much pull is left after that bend; a meter shows the force reaching the fingertip, with a target mark at 70%. Each finger joint turns red if its pulley is dragged to the back of the joint (no moment arm, so that joint could not bend). ` +
          `Right now: total bending ${Math.round(r.theta / DEG)}° (bends of ${r.turns.map((t) => Math.round(t / DEG)).join('°, ')}° at the wrist, knuckle, middle and end pulleys), ${Math.round(r.force * 100)}% of the pull reaches the fingertip. ${bad.length ? `Joints that cannot bend: ${bad.join(', ')}.` : 'All three finger joints can bend.'} ${done ? 'Solved.' : ''} ` +
          'To succeed: get at least 70% to the fingertip while every finger joint keeps its pulley on the palm side. The big win is the wrist pulley: it starts high, making a sharp kink; dragging it down into a straight line from the motor to the knuckle removes most of the bending. The knuckle pulley starts too deep (a bowstring) and the middle pulley makes a zigzag; easing them toward a smooth curve helps too. Likely mix-ups: dragging pulleys above their joints (straight, but that joint then cannot bend); thinking the length of the tendon matters rather than the bends.',
      )
      setHints(['Each bend costs force. Which pulley creates the sharpest bend?', 'The tendon must stay on the palm side of every joint, or that joint can’t bend.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, r.theta, r.force, r.turns, okJ, done, reportState, setHints])

  const wl = wristOf(ARM_L.sx)
  const wr = wristOf(ARM_R.sx)

  return (
    <g ref={root}>
      <MuscleStyle />
      {/* ---------- the lab: two arms ---------- */}
      <g className="c3-lab" ref={labRef}>
        <g data-depth="0.25">
          <LabSky seed={7} />
        </g>
        <g data-depth="0.6">
          <LabWall windows={[[80, 60, 360, 640], [620, 60, 360, 640], [1160, 60, 360, 640], [1700, 60, 360, 640]]} />
          <rect x={2190} y={-500} width={1200} height={1900} fill="url(#cn-wall)" />
        </g>
        <g data-depth="1">
          <LabFloor />
          <rect x={2190} y={760} width={1200} height={700} fill="url(#cn-floor)" />
          <Pool x={ARM_L.sx + 300} y={360} r={420} color="key" opacity={0.65} />
          <Pool x={ARM_R.sx + 300} y={360} r={420} color="rim" opacity={0.45} />
          {/* pillars and shoulders */}
          {[ARM_L, ARM_R].map((a) => (
            <g key={a.sx}>
              <rect x={a.sx - 40} y={a.sy + 30} width={80} height={760 - a.sy - 30} fill={C.ink2} />
              <rect x={a.sx - 70} y={752} width={140} height={14} rx={4} fill={C.ink3} />
              <circle cx={a.sx} cy={a.sy} r={58} fill={C.carbon} />
              <circle cx={a.sx} cy={a.sy} r={22} fill={C.metalDark} />
            </g>
          ))}
          <TorqueArc className="c3-tqs" cx={ARM_L.sx} cy={ARM_L.sy} r={92} start={-60} sweep={130} width={12} />
          <g className="c3-armL">
            <rect x={ARM_L.sx} y={ARM_L.sy - 20} width={50} height={40} fill={C.carbon} />
            <Hand3D store={left} x={wl} y={ARM_L.sy} look="robot" arm={ARM_LEN} light={[-0.4, 0.9]} />
            {/* motors packed in the palm and knuckles */}
            <g className="c3-palmglow" filter="url(#cn-bloom)">
              {[
                [wl + 40, ARM_L.sy - 14],
                [wl + 40, ARM_L.sy + 14],
                [wl + 80, ARM_L.sy - 20],
                [wl + 80, ARM_L.sy + 6],
                [wl + 112, ARM_L.sy - 30],
                [wl + 116, ARM_L.sy - 4],
                [wl + 112, ARM_L.sy + 22],
              ].map(([x, y], i) => (
                <rect key={i} x={x - 13} y={y - 7} width={26} height={14} rx={6} fill={C.amber} opacity={0.85} />
              ))}
            </g>
          </g>
          <g className="c3-armR">
            <rect x={ARM_R.sx} y={ARM_R.sy - 20} width={50} height={40} fill={C.carbon} />
            <Hand3D store={right} x={wr} y={ARM_R.sy} look="robot" arm={ARM_LEN} light={[-0.4, 0.9]} />
          </g>
          <Label className="c3-l-in" x={wl + 80} y={ARM_L.sy - 20} tx={wl + 40} ty={200} text="motors in the hand" color={C.amber} anchor="middle" />
          <Label className="c3-l-fore" x={ARM_R.sx + 160} y={ARM_R.sy} tx={ARM_R.sx + 220} ty={200} text="motors in the forearm" sub="tendons to the fingers" color={C.cyan} anchor="middle" />
          <Label className="c3-l-mgl" x={ARM_L.sx + 60} y={ARM_L.sy - 80} tx={ARM_L.sx + 40} ty={170} text="hand mass × g × arm length" color={C.amber} anchor="start" />
          <text className="c3-l-nm" x={ARM_L.sx + 40} y={240} fill={C.amberLight} fontFamily={MONO} fontSize={22} opacity={0}>
            1.5 kg × 9.8 × 0.6 m ≈ 9 N·m
          </text>
          <Label className="c3-l-light" x={wr + 60} y={ARM_R.sy - 50} tx={wr + 40} ty={200} text="light fingers, easy lift" color={C.cyan} anchor="middle" />
          {/* Theo and the broom */}
          <g className="c3-theo-all" opacity={0}>
            <Pool x={THEO.x - 200} y={THEO.y - 300} r={420} color="rim" opacity={0.5} />
            <g className="c3-broom">
              <line x1={THEO.x - 120} y1={THEO.y - 262} x2={THEO.x - 640} y2={THEO.y - 272} stroke="#7a5534" strokeWidth={9} strokeLinecap="round" />
              <line x1={THEO.x - 636} y1={THEO.y - 272} x2={THEO.x - 636} y2={THEO.y - 246} stroke="#a89878" strokeWidth={3} />
              <path d={`M${THEO.x - 646} ${THEO.y - 246} L${THEO.x - 626} ${THEO.y - 246} Q${THEO.x - 588} ${THEO.y - 230} ${THEO.x - 590} ${THEO.y - 178} Q${THEO.x - 592} ${THEO.y - 150} ${THEO.x - 636} ${THEO.y - 150} Q${THEO.x - 682} ${THEO.y - 150} ${THEO.x - 682} ${THEO.y - 178} Q${THEO.x - 684} ${THEO.y - 230} ${THEO.x - 646} ${THEO.y - 246} Z`} fill="#d8cbb0" />
              <path d={`M${THEO.x - 600} ${THEO.y - 200} Q${THEO.x - 602} ${THEO.y - 160} ${THEO.x - 636} ${THEO.y - 156}`} fill="none" stroke="#a89878" strokeWidth={4} />
              <text x={THEO.x - 636} y={THEO.y - 186} textAnchor="middle" fill={C.ink2} fontFamily={SANS} fontSize={14} fontWeight={700}>SUGAR
              </text>
            </g>
            <Person name="c3-theo" x={THEO.x} y={THEO.y} s={1.15} flip pose={{ ...POSES.stand, armN: 84, elbowN: 4, armF: 78, elbowF: 8 }} hair="beanie" outfit="hoodie" top="#3d4a6b" topDark="#283250" skin={C.skinA} light="cool-right" />
            <Label className="c3-l-sugar" x={THEO.x - 636} y={THEO.y - 272} tx={THEO.x - 560} ty={THEO.y - 470} text="weight far from the shoulder" color={C.mist} anchor="middle" />
          </g>
          <Dust x={-200} y={0} w={2900} h={800} count={44} seed={23} color={C.rim} size={0.7} />
        </g>
      </g>

      {/* ---------- the blueprint ---------- */}
      <g className="c3-bp" ref={bpRef} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          {/* forearm, wrist and palm outline */}
          <path d={`M40 450 L600 455 Q640 456 650 470 L900 482 L900 558 L650 570 Q640 590 600 590 L40 595`} fill={C.ink1} fillOpacity={0.6} stroke={C.cyan} strokeWidth={2.2} />
          <circle cx={W.x} cy={W.y} r={12} fill="none" stroke={C.cyanLight} strokeWidth={2} />
          {/* the forearm motor and its tensioner */}
          <g className="c3-hum" opacity={0.75}>
            <Pool x={MOTOR.x - 50} y={MOTOR.y - 20} r={160} color="amber" opacity={0.6} />
          </g>
          <rect x={MOTOR.x - 170} y={MOTOR.y - 60} width={150} height={80} rx={12} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
          <circle cx={MOTOR.x - 10} cy={MOTOR.y} r={14} fill={C.ink1} stroke={C.amber} strokeWidth={3} />
          <g className="c3-tens">
            <circle cx={MOTOR.x - 90} cy={MOTOR.y} r={13} fill={C.metal} />
            <path d={`M${MOTOR.x - 99} ${MOTOR.y} H${MOTOR.x - 81}`} stroke={C.ink} strokeWidth={3} />
          </g>
          <Label className="c3-bl-motor" x={MOTOR.x - 95} y={MOTOR.y - 60} tx={MOTOR.x - 60} ty={380} text="forearm motor" color={C.amber} anchor="middle" />
          <g className="c3-basefinger">
            <RFinger x={K.x} y={K.y} lens={LENS} w={56} look="blueprint" angles={BEND} />
          </g>
          <g className="c3-baseroute">
            <path d={`M${MOTOR.x} ${MOTOR.y} L${START.map((p) => `${p.x} ${p.y}`).join(' L')} L${ANCHOR.x} ${ANCHOR.y}`} fill="none" stroke={C.cyan} strokeWidth={4} strokeLinejoin="round" opacity={0.8} />
            {START.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={14} fill={C.ink1} stroke={C.cyan} strokeWidth={3} />
            ))}
          </g>
          {/* the story finger (stretch) and the play finger */}
          <g className="c3-str" opacity={0}>
            <RFinger x={K.x} y={K.y} lens={LENS} w={56} look="ghost" cls="c3g" angles={BEND} />
            <RFinger x={K.x} y={K.y} lens={LENS} w={56} look="blueprint" cls="c3r" angles={BEND} under={LENS.map((L, i) => <line key={i} x1={0} y1={18} x2={L} y2={18} stroke={C.cyan} strokeWidth={4} />)} />
            <line x1={MOTOR.x} y1={MOTOR.y} x2={K.x} y2={K.y + 18} stroke={C.cyan} strokeWidth={4} />
            {/* a cable under load against a ruler */}
            <g transform="translate(0 0)">
              <rect x={150} y={130} width={30} height={90} rx={4} fill={C.slate} />
              <line className="c3-cable" x1={180} y1={170} x2={700} y2={170} stroke={C.cyan} strokeWidth={4} />
              <g className="c3-wt">
                <line x1={700} y1={170} x2={700} y2={200} stroke={C.mist} strokeWidth={2} />
                <rect x={676} y={200} width={48} height={40} rx={4} fill={C.amberDark} />
              </g>
              <line x1={180} y1={260} x2={800} y2={260} stroke={C.mist} strokeWidth={2} />
              {Array.from({ length: 32 }, (_, i) => (
                <line key={i} x1={180 + i * 20} y1={260} x2={180 + i * 20} y2={i % 5 === 0 ? 278 : 270} stroke={C.mist} strokeWidth={1.5} />
              ))}
              <line x1={700} y1={240} x2={700} y2={290} stroke={C.paper} strokeWidth={2} strokeDasharray="4 4" />
              <Readout className="c3-stretch-n" x={820} y={182} color={C.cyan} size={34}>+0.0%</Readout>
              <text className="c3-l-fresh" x={820} y={222} fill={C.mist} fontFamily={SANS} fontSize={22} opacity={0}>
                fresh plastic tendon (heat-set: under 1%)
              </text>
            </g>
            <Label className="c3-l-lag" x={1170} y={700} tx={1060} ty={800} text="slack: the finger lags its command" color={C.cyanLight} anchor="middle" />
            <text className="c3-l-heat" x={1060} y={850} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22} opacity={0}>
              dashed: where it should be
            </text>
            <Label className="c3-l-tens" x={MOTOR.x - 90} y={MOTOR.y + 14} tx={MOTOR.x - 60} ty={720} text="re-tension" color={C.amber} anchor="middle" />
          </g>

          <TendonPlay
            ps={ps}
            setP={(i, p) => {
              if (!active) return
              const z = ZONES[i]
              const dx = p.x - z.x
              const dy = p.y - z.y
              const d = Math.hypot(dx, dy)
              const k = d > z.r ? z.r / d : 1
              setPs((old) => old.map((q, j) => (j === i ? { x: z.x + dx * k, y: z.y + dy * k } : q)))
            }}
            setDrag={setDrag}
            route={r}
            okJ={okJ}
            active={active}
            showStatic={cueIndex !== 4}
          />

          {/* the capstan story: the same route, readouts at each bend */}
          <g className="c3-cap" opacity={0} pointerEvents="none">
            {(() => {
              const sp = routeOf(START).pts
              const vals = [1, 0.85, 0.72, 0.61, 0.53]
              return (
                <g>
                  {sp.slice(0, -1).map((a, i) => {
                    const b = sp[i + 1]
                    return <line key={i} className={`c3-seg-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.cyanLight} strokeWidth={3 + vals[i] * 9} opacity={0.2} strokeLinecap="round" filter={i === 0 ? 'url(#cn-bloom)' : undefined} style={{ strokeOpacity: 0.3 + vals[i] * 0.7 }} />
                  })}
                  {sp.slice(1, -1).map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={14} fill={C.ink1} stroke={C.cyan} strokeWidth={3} />
                  ))}
                  {vals.map((v, i) => {
                    const p = i === 0 ? { x: MOTOR.x + 40, y: MOTOR.y + 70 } : { x: sp[i].x + (i === 1 ? -10 : i === 4 ? 40 : 6), y: sp[i].y + (i === 1 ? -50 : 52) }
                    return (
                      <g key={i} className={`c3-cr-${i}`} opacity={0}>
                        <Readout x={p.x} y={p.y} color={C.cyanLight} size={30} anchor="middle">{`${Math.round(v * 100)}%`}</Readout>
                        {i > 0 && (
                          <text x={p.x} y={p.y + 24} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>
                            ¼ turn
                          </text>
                        )}
                      </g>
                    )
                  })}
                  <text className="c3-cap-eq" x={800} y={140} textAnchor="middle" fill={C.cyanLight} fontFamily={MONO} fontSize={42} opacity={0}>
                    T_out = T_in · e^(−μθ)
                  </text>
                  <text className="c3-cap-half" x={800} y={190} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={24} opacity={0}>
                    μ ≈ 0.1, θ = one full turn → about half is lost
                  </text>
                </g>
              )
            })()}
          </g>
          <Label className="c3-bl-pulley" x={K.x - 5} y={K.y + 24} tx={K.x - 40} ty={690} text="a pulley at every joint" color={C.cyan} anchor="middle" />
          <path className="c3-pulse" d={`M${MOTOR.x} ${MOTOR.y} L${START.map((p) => `${p.x} ${p.y}`).join(' L')} L${ANCHOR.x} ${ANCHOR.y}`} fill="none" stroke={C.white} strokeWidth={8} strokeLinecap="round" strokeDasharray="60 1400" opacity={0} filter="url(#cn-bloom)" />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** The tendon routing play, drawn from state. */
function TendonPlay({ ps, setP, setDrag, route, okJ, active, showStatic }: {
  ps: Pt[]
  setP: (i: number, p: Pt) => void
  setDrag: (i: number | null) => void
  route: ReturnType<typeof routeOf>
  okJ: boolean[]
  active: boolean
  showStatic: boolean
}) {
  const { pts, after, force } = route
  const levels = [1, ...after]
  return (
    <g className="c3-play">
      {/* joints that can't bend go red */}
      {JOINTS.map((j, i) => (
        <g key={j.id}>
          <circle cx={j.x} cy={j.y} r={20} fill="none" stroke={okJ[i] ? C.lime : C.danger} strokeWidth={3} opacity={okJ[i] ? 0.5 : 1} filter={okJ[i] ? undefined : 'url(#cn-bloom)'} />
          {!okJ[i] && (
            <text x={j.x} y={j.y - 44} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={20} fontWeight={600}>
              can’t bend
            </text>
          )}
        </g>
      ))}
      {/* drag zones */}
      {!showStatic &&
        ZONES.map((z) => <circle key={z.name} cx={z.x} cy={z.y} r={z.r} fill={C.cyan} fillOpacity={0.04} stroke={C.cyan} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 6" />)}
      {/* the tendon, dimming after each bend */}
      {pts.slice(0, -1).map((a, i) => {
        const b = pts[i + 1]
        const v = levels[i]
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.cyanLight} strokeWidth={2 + v * 8} strokeOpacity={0.25 + v * 0.75} strokeLinecap="round" />
      })}
      <circle cx={ANCHOR.x} cy={ANCHOR.y} r={6} fill={C.cyanLight} />
      {/* pulleys */}
      {ps.map((p, i) => (
        <Pulley key={i} i={i} p={p} setP={setP} setDrag={setDrag} active={active} left={after[i]} />
      ))}
      {/* the result */}
      <Meter x={1000} y={830} w={460} value={force} color={force >= TARGET ? C.lime : C.cyan} label="pull that reaches the fingertip" valueText={`${Math.round(force * 100)}%`} mark={TARGET} />
      <Readout x={100} y={845} color={C.cyan} size={24}>
        {`total bending ${Math.round(route.theta / DEG)}°`}
      </Readout>
      <text x={100} y={808} fill={C.fog} fontFamily={MONO} fontSize={20}>
        force at tip = e^(−0.15 θ)
      </text>
    </g>
  )
}

function Pulley({ i, p, setP, setDrag, active, left }: { i: number; p: Pt; setP: (i: number, p: Pt) => void; setDrag: (i: number | null) => void; active: boolean; left: number }) {
  const off = useRef({ x: 0, y: 0 })
  const drag = useDrag({
    onStart: (q) => {
      off.current = { x: p.x - q.x, y: p.y - q.y }
      setDrag(i)
    },
    onMove: (q) => setP(i, { x: q.x + off.current.x, y: q.y + off.current.y }),
    onEnd: () => setDrag(null),
  })
  const above = i === 0
  return (
    <g>
      <g {...(active ? drag : {})} data-tutor={`pulley-${ZONES[i].name}`}>
        <circle cx={p.x} cy={p.y} r={34} fill="transparent" />
        <circle cx={p.x} cy={p.y} r={16} fill={C.ink1} stroke={C.cyan} strokeWidth={3} />
        <circle cx={p.x} cy={p.y} r={5} fill={C.cyanLight} />
        {active && <circle className="hd-pulse" cx={p.x} cy={p.y} r={24} fill="none" stroke={C.cyanLight} strokeWidth={1.5} opacity={0.6} />}
      </g>
      <text x={p.x} y={above ? p.y - 38 : p.y + 44} textAnchor="middle" fill={C.cyanLight} fontFamily={MONO} fontSize={20} pointerEvents="none">
        {`${Math.round(left * 100)}%`}
      </text>
    </g>
  )
}

export const ch3: Chapter = {
  id: 'placement',
  title: 'Where the muscles go',
  cues: CUES,
  Scene: Ch3Placement,
  enter: { type: 'pan', dir: 'left' },
  deeper: [TendonsReading],
}
