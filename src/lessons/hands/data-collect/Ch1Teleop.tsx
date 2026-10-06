import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore, type FingerName, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Person, Profile, Robot, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import { Arm2D, DcDefs, KOFI, MAP, PaperCup, SourceIcon, SourceMap, Tag, armPoints, clamp, drive, ease3, lerp, setArm, type ArmAngles } from './common'
import { TeleopReading } from './readings'

export const CUES: Cue[] = [
  { id: 'kofi', say: 'Meet Kofi. His job is to be the robot.' },
  { id: 'leader', say: 'The simplest rig is a puppet. Kofi moves a small copy of the robot’s arm, and the real arm copies him joint for joint. What the robot saw, and what Kofi made it do, are recorded together.' },
  { id: 'hands', say: 'For hands with many fingers, operators wear gloves or headsets that track every finger, and the robot hand mirrors them.' },
  { id: 'feel', say: 'But Kofi can’t feel what the robot touches. So he squeezes too hard, or too gently, and slows right down to watch. And the robot learns his hesitation.' },
  { id: 'lag', say: 'Any delay over about a twentieth of a second feels wrong, and a long day of puppeting is exhausting.' },
  { id: 'verdict', say: 'Teleoperation gives the most faithful data there is: the robot’s own body, its own cameras. But it’s slow, it needs a real robot for every operator, and it happens in a handful of rooms.' },
]

const STATE = [
  'Night in a data-collection room. Over Kofi’s shoulder (he is a teleoperator, seen from behind in the foreground, dark against the room) we look across to Seven, the lab’s white humanoid, standing in a taped-out square between cameras on tripods, with a small table, a cup and a cloth in front of it. Kofi raises his hands to his VR headset and it lights up; across the room Seven’s visor brightens, and as Kofi turns his head, Seven’s head turns the same way a beat later. The idea: in teleoperation a person drives the real robot.',
  'A bench under a lamp. On the left a small orange 3D-printed puppet arm (the “leader”) with Kofi’s hand on its handle; on the right the big white robot arm (the “follower”) copies every joint. Along the top, a film strip of frames from the robot’s camera appears one by one, each joined by a lime line to the joint angles recorded at that moment. Labels: “GELLO: under $300 of parts” on the leader, “ALOHA: about $20,000” on the follower. The idea: teleoperation records what the robot saw paired with the action, on the robot’s own body.',
  'Two hands side by side: Kofi’s real hand wearing lime tracking markers on every fingertip, and Seven’s white robot hand. Kofi moves through open, point, pinch, power grip and spread; Seven mirrors each pose a beat late, with lime lines pairing each fingertip. Seven’s thumb never quite matches (a red mark: the thumb is retargeted, not copied, because the robot’s thumb is built differently).',
  'A close-up of Kofi’s face in profile, half in shadow, beside a table where Seven’s robot hand comes down on a paper cup. It squeezes too hard: the fingertips glow magenta (the robot feels pressure) but the signal never reaches Kofi (a broken magenta line with a red cross, labelled “no touch feedback for the operator”). The cup crumples; Kofi winces. Second take: the hand creeps down very slowly with pauses, a speed meter reads “slow”, and a lime trace records the hesitant, stop-start motion. The point: the robot learns the operator’s hesitation.',
  'Back at the puppet bench with a latency dial. At 20 milliseconds the robot arm tracks the puppet tightly. The dial turns to 150 milliseconds: the robot arm lags behind, then overshoots and knocks a cup off the bench. Then a time-lapse of Kofi’s shift: a clock races, the sky outside turns towards dawn, and Kofi slumps. Delays over about 50 ms feel wrong; operators tire within hours.',
  'The lime map from the previous film: a triangle with corners “true to the robot” (top), “cheap” (bottom left) and “diverse” (bottom right). The teleoperation icon (a little puppet arm) settles right next to “true to the robot”, far from cheap and diverse. Three tags appear: slow, one real robot per operator, a handful of rooms. The point: teleop is the most faithful data but expensive and narrow.',
]

/* ---------- where things are ---------- */
const SEVEN = { x: 1160, y: 742, s: 0.95 }
const KOFI_AT = { x: 330, y: 1080, s: 2.3 }
/** The puppet bench. */
const LEAD = { x: 420, y: 700, s: 1.15, lens: [120, 100, 56] as [number, number, number] }
const FOLL = { x: 1070, y: 700, s: 1.95, lens: [120, 100, 56] as [number, number, number] }
const CUP = { x: 1452, y: 700 }

/** The puppet's motion while Kofi works (degrees), a smooth figure of eight. */
const L = (t: number): ArmAngles => [-4 + 14 * Math.sin(0.8 * t), 48 + 20 * Math.sin(1.1 * t + 0.6), 34 + 22 * Math.sin(1.5 * t + 1.2)]

/** The latency demo: the puppet sweeps right and stops; the follower chases a delayed copy. */
const LAG_T = 6.2
const LAG_SWITCH = 2.6
const leadLag = (t: number): ArmAngles => {
  if (t < LAG_SWITCH) return [-6 + 16 * Math.sin(1.6 * t), 46 + 14 * Math.sin(2 * t), 30 + 10 * Math.sin(2.4 * t)]
  const k = ease3((t - LAG_SWITCH - 0.3) / 0.5)
  const base = leadLag(LAG_SWITCH - 0.001)
  return [lerp(base[0], 30, k), lerp(base[1], 64, k), lerp(base[2], 44, k)]
}
const latencyAt = (t: number) => (t < LAG_SWITCH ? 0.02 : lerp(0.02, 0.15, clamp((t - LAG_SWITCH) / 0.3)))
/** Pre-simulated follower: a spring chasing the delayed puppet; stiff and damped at 20 ms, springy at 150 ms (the operator over-corrects). */
const LAG_SIM = (() => {
  const dt = 1 / 120
  const n = Math.ceil(LAG_T / dt) + 1
  const out: ArmAngles[] = []
  let a: number[] = [...leadLag(0)]
  let v = [0, 0, 0]
  let knock = -1
  for (let i = 0; i < n; i++) {
    const t = i * dt
    const d = latencyAt(t)
    const target = leadLag(Math.max(0, t - d))
    const slow = d > 0.05
    const k = slow ? 110 : 900
    const c = slow ? 6 : 60
    v = v.map((vv, j) => vv + (k * (target[j] - a[j]) - c * vv) * dt)
    a = a.map((aa, j) => aa + v[j] * dt)
    out.push([a[0], a[1], a[2]])
    const end = armPoints(FOLL.lens, [a[0], a[1], a[2]])[3]
    if (knock < 0 && t > LAG_SWITCH && FOLL.y + end.y * FOLL.s > 632) knock = t
  }
  return { out, dt, knock: knock < 0 ? LAG_T - 1 : knock }
})()

const HUMAN_SEQ: { pose: HandPose; at: number }[] = [
  { pose: GRASPS.open, at: 0.3 },
  { pose: GRASPS.point, at: 1.6 },
  { pose: GRASPS.pinch, at: 3.0 },
  { pose: GRASPS.power, at: 4.4 },
  { pose: GRASPS.spread, at: 5.8 },
  { pose: GRASPS.relaxed, at: 7.2 },
]
/** Seven's thumb is built differently: its swing is shorter, so the pose is retargeted, not copied. */
const retarget = (p: HandPose): HandPose => ({ ...p, thumb: [p.thumb[0] * 0.5 + 6, p.thumb[1] * 0.7, p.thumb[2] * 1.3 + 8, p.thumb[3] * 0.5] })

const CRUSH: HandPose = { ...GRASPS.power, index: [70, 86, 50, 0], middle: [72, 88, 52, 0], ring: [72, 86, 50, 0], little: [70, 84, 48, 2], thumb: [66, 40, 36, 26] }
const WRAP: HandPose = { ...GRASPS.claw, index: [34, 34, 24, 0], middle: [36, 36, 24, 0], ring: [36, 36, 24, 0], little: [38, 36, 24, 0] }

export function Ch1Teleop({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const roomRef = useRef<SVGGElement>(null)
  const benchRef = useRef<SVGGElement>(null)
  const handsRef = useRef<SVGGElement>(null)
  const feelRef = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const human = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 18, pitch: 10, roll: 0, s: 1.75 } })
  const robot = useHandStore({ pose: retarget(GRASPS.relaxed), view: { yaw: 18, pitch: 10, roll: 0, s: 1.75 } })
  const grip = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 2.0 } })
  const tipsH = useRef<Partial<Record<FingerName, { x: number; y: number }>>>({})
  const tipsR = useRef<Partial<Record<FingerName, { x: number; y: number }>>>({})

  const drawPairs = useCallback(() => {
    const el = handsRef.current
    if (!el) return
    for (const f of ['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]) {
      const a = tipsH.current[f]
      const b = tipsR.current[f]
      if (!a) continue
      const mk = el.querySelector(`.c1-mk-${f}`)
      mk?.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`)
      if (!b) continue
      const line = el.querySelector(`.c1-pl-${f}`)
      const mx = (a.x + b.x) / 2
      const my = Math.min(a.y, b.y) - 70 - (f === 'thumb' ? 0 : 20)
      line?.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`)
      const num = el.querySelector(`.c1-num-${f}`)
      const pz = human.state.pose[f]
      if (num) num.textContent = pz.slice(0, 3).map((v) => `${Math.round(v)}°`.padStart(4, ' ')).join(' ')
      if (f === 'thumb') el.querySelector('.c1-thumbat')?.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`)
    }
  }, [human])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const camRoom = camera(roomRef.current, { x: 800, y: 450, zoom: 1 })
      const camBench = camera(benchRef.current, { x: 800, y: 450, zoom: 1.05 })
      const camHands = camera(handsRef.current, { x: 800, y: 470, zoom: 1.1 })
      const camFeel = camera(feelRef.current, { x: 820, y: 460, zoom: 1.05 })
      const camMap = camera(mapRef.current, { x: 800, y: 470, zoom: 1.25 })
      const kofi = rig(el, 'c1-kofi', POSES.stand)
      const seven = rig(el, 'c1-seven', POSES.stand)
      const shots = ['.c1-room', '.c1-bench', '.c1-hands', '.c1-feel', '.c1-map']
      const show = (which: string, at: number) => shots.forEach((s) => tl.set(s, { opacity: s === which ? 1 : 0 }, at + 0.02))

      /* b0: Kofi and Seven. Kofi pulls the headset down; Seven wakes and copies his head. */
      tl.addLabel('b0', 0)
      show('.c1-room', 0)
      tl.set('.c1-timelapse', { opacity: 0 }, 0)
      camRoom.to(tl, { x: 900, y: 470, zoom: 1.14 }, 0, 6.2, 'sine.inOut')
      kofi.to(tl, { armN: 150, elbowN: 110, armF: 140, elbowF: 110, head: -6 }, 0.2, 0.9)
      kofi.to(tl, { armN: 10, elbowN: 40, armF: 6, elbowF: 40, head: 0 }, 1.5, 0.8)
      fade(tl, '.c1-visor-k', 1, 1.2, 0.4)
      fade(tl, '.c1-visor-s', 1, 1.6, 0.5)
      tl.fromTo('.c1-visor-s', { scale: 0.6, svgOrigin: `${SEVEN.x - 18} ${SEVEN.y - 286}` }, { scale: 1.2, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, 1.6)
      // Kofi looks left then right; Seven follows a beat late
      kofi.to(tl, { head: -16, torso: -3 }, 2.4, 0.7)
      seven.to(tl, { head: -16, torso: -3 }, 2.65, 0.7)
      kofi.to(tl, { head: 14, torso: 3 }, 3.5, 0.8)
      seven.to(tl, { head: 14, torso: 3 }, 3.75, 0.8)
      kofi.to(tl, { head: 0, torso: 0, armN: 40, elbowN: 70, armF: 36, elbowF: 70 }, 4.6, 0.7)
      seven.to(tl, { head: 0, torso: 0, armN: 40, elbowN: 70, armF: 36, elbowF: 70 }, 4.85, 0.7)
      fade(tl, '.c1-lab-kofi', 1, 0.8, 0.6)
      fade(tl, '.c1-lab-seven', 1, 2.0, 0.6)

      /* b1: the puppet. Leader in Kofi's hand, follower copying, frames and numbers recorded together. */
      const b1 = 6.2
      tl.addLabel('b1', b1)
      fade(tl, '.c1-lab-kofi, .c1-lab-seven', 0, b1, 0.2, 1)
      show('.c1-bench', b1)
      tl.set('.c1-lag', { opacity: 0 }, b1)
      camBench.to(tl, { x: 760, y: 470, zoom: 1.0 }, b1, 0.001)
      camBench.to(tl, { x: 800, y: 430, zoom: 1.0 }, b1 + 0.01, 13.5, 'sine.inOut')
      const benchDraw = (a: ArmAngles, f: ArmAngles) => {
        setArm(el, 'c1-lead', a, LEAD.lens)
        setArm(el, 'c1-foll', f, FOLL.lens)
        const p = armPoints(LEAD.lens, a)[3]
        const hx = LEAD.x + p.x * LEAD.s
        const hy = LEAD.y + p.y * LEAD.s
        const ex = hx - 170
        const ey = hy + 200
        el?.querySelector('.c1-karm')?.setAttribute('d', `M${ex - 140} ${ey + 260} L${ex} ${ey}`)
        el?.querySelector('.c1-karm2')?.setAttribute('d', `M${ex} ${ey} L${hx - 12} ${hy + 10}`)
        el?.querySelector('.c1-fist')?.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)})`)
      }
      drive(tl, b1, 13.6, (u) => {
        const t = u * 13.6
        benchDraw(L(t), L(Math.max(0, t - 0.06)))
      })
      // frames recorded with their joint numbers
      FRAMES.forEach((_, i) => {
        const at = b1 + 2.4 + i * 1.5
        fade(tl, `.c1-fr-${i}`, 1, at, 0.3)
        tl.fromTo(`.c1-fr-${i}`, { y: -20 }, { y: 0, duration: 0.4, ease: 'power2.out', immediateRender: false }, at)
        tl.fromTo(`.c1-flash`, { opacity: 0.5 }, { opacity: 0, duration: 0.4, immediateRender: false }, at)
      })
      fade(tl, '.c1-lab-gello', 1, b1 + 1.0, 0.6)
      fade(tl, '.c1-lab-aloha', 1, b1 + 2.4, 0.6)
      fade(tl, '.c1-lab-rec', 1, b1 + 9, 0.6)

      /* b2: hands. Glove markers on Kofi's fingers, Seven's hand mirrors a beat late; the thumb is off. */
      const b2 = b1 + 13.6
      tl.addLabel('b2', b2)
      show('.c1-hands', b2)
      camHands.to(tl, { x: 800, y: 470, zoom: 1.06 }, b2, 0.001)
      camHands.to(tl, { x: 800, y: 450, zoom: 0.98 }, b2 + 0.01, 9.5, 'sine.inOut')
      HUMAN_SEQ.forEach(({ pose, at }) => {
        human.to(tl, { pose }, b2 + at, 0.9)
        robot.to(tl, { pose: retarget(pose) }, b2 + at + 0.32, 0.9)
      })
      human.to(tl, { view: { yaw: 30 } }, b2, 9, 'sine.inOut')
      robot.to(tl, { view: { yaw: 30 } }, b2 + 0.3, 9, 'sine.inOut')
      fade(tl, '.c1-pairs', 1, b2 + 0.6, 0.8)
      fade(tl, '.c1-lab-glove', 1, b2 + 0.8, 0.6)
      fade(tl, '.c1-lab-mirror', 1, b2 + 1.8, 0.6)
      fade(tl, '.c1-lab-thumb', 1, b2 + 3.4, 0.5)
      fade(tl, '.c1-thumbring', 1, b2 + 3.4, 0.4)

      /* b3: feel. Crush, wince; then a slow, hesitant second take that gets recorded. */
      const b3 = b2 + 9.5
      tl.addLabel('b3', b3)
      show('.c1-feel', b3)
      camFeel.to(tl, { x: 800, y: 450, zoom: 1.0 }, b3, 0.001)
      camFeel.to(tl, { x: 860, y: 470, zoom: 1.08 }, b3 + 0.01, 3.4, 'sine.inOut')
      tl.set('.c1-cup2', { opacity: 0 }, b3)
      tl.set('.c1-cup1', { opacity: 1 }, b3)
      tl.set('.c1-eyes-shut', { opacity: 0 }, b3)
      tl.fromTo('.c1-grip', { y: -420 }, { y: 150, duration: 1.3, ease: 'power2.inOut', immediateRender: false }, b3 + 0.2)
      grip.to(tl, { pose: WRAP }, b3 + 0.6, 0.8)
      grip.to(tl, { pose: CRUSH, touch: { thumb: 1, index: 1, middle: 1, ring: 0.9, little: 0.7 } }, b3 + 1.6, 0.35, 'power3.in')
      tl.fromTo('.c1-cupbody', { scaleX: 1 }, { scaleX: 0.62, duration: 0.3, ease: 'power3.in', svgOrigin: '1090 742', immediateRender: false }, b3 + 1.65)
      fade(tl, '.c1-crumple', 1, b3 + 1.7, 0.15)
      tl.fromTo('.c1-drop', { y: 0, x: 0, opacity: 0 }, { y: (i) => [-60, -90, -40, -70][i % 4], x: (i) => [-80, -20, 60, 100][i % 4], opacity: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, b3 + 1.75)
      tl.to('.c1-drop', { y: '+=160', opacity: 0, duration: 0.6, ease: 'power2.in' }, b3 + 2.1)
      camFeel.shake(tl, b3 + 1.75, 0.9, 0.45)
      // the touch signal tries to reach Kofi and breaks
      tl.fromTo('.c1-signal', { strokeDashoffset: 520 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.out', immediateRender: false }, b3 + 1.8)
      fade(tl, '.c1-signal-g', 1, b3 + 1.8, 0.1)
      fade(tl, '.c1-break', 1, b3 + 2.4, 0.2)
      fade(tl, '.c1-lab-notouch', 1, b3 + 2.6, 0.5)
      // Kofi winces
      fade(tl, '.c1-eyes-shut', 1, b3 + 1.9, 0.1)
      fade(tl, '.c1-eyes-shut', 0, b3 + 3.2, 0.15, 1)
      tl.fromTo('.c1-face', { x: 0 }, { x: -16, duration: 0.2, yoyo: true, repeat: 1, immediateRender: false }, b3 + 1.9)
      // second take: a fresh cup, the hand creeps down, stopping to look
      const t2 = b3 + 4.2
      grip.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, t2 - 0.4, 0.5)
      tl.fromTo('.c1-grip', { y: 150 }, { y: -320, duration: 0.6, ease: 'power2.in', immediateRender: false }, t2 - 0.4)
      tl.set('.c1-cup1', { opacity: 0 }, t2 + 0.2)
      fade(tl, '.c1-cup2', 1, t2 + 0.2, 0.4)
      fade(tl, '.c1-lab-notouch, .c1-signal-g, .c1-break', 0, t2, 0.4, 1)
      camFeel.to(tl, { x: 780, y: 450, zoom: 1.02 }, t2, 2, 'sine.inOut')
      // a stop-start creep: the same path, but with long pauses
      const steps = [-320, -230, -200, -110, -90, 20, 40, 140]
      for (let i = 1; i < steps.length; i++) tl.fromTo('.c1-grip', { y: steps[i - 1] }, { y: steps[i], duration: i % 2 ? 0.7 : 0.55, ease: i % 2 ? 'sine.inOut' : 'none', immediateRender: false }, t2 + 0.3 + (i - 1) * 0.75)
      grip.to(tl, { pose: WRAP, touch: { thumb: 0.3, index: 0.3, middle: 0.25 } }, t2 + 5.4, 1.0, 'sine.inOut')
      fade(tl, '.c1-speed', 1, t2 + 0.4, 0.5)
      tl.fromTo('.c1-speedbar', { scaleX: 1 }, { scaleX: 0.16, duration: 1.4, ease: 'power2.out', svgOrigin: '1180 160', immediateRender: false }, t2 + 0.5)
      tl.fromTo('.c1-trace', { strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: 5.6, ease: 'none', immediateRender: false }, t2 + 0.3)
      fade(tl, '.c1-lab-hesitant', 1, t2 + 4.4, 0.6)

      /* b4: latency. 20 ms tracks; 150 ms lags and overshoots, knocking the cup. Then the long shift. */
      const b4 = b3 + 11.8
      tl.addLabel('b4', b4)
      show('.c1-bench', b4)
      tl.set('.c1-lag', { opacity: 1 }, b4)
      fade(tl, '.c1-strip, .c1-lab-gello, .c1-lab-aloha, .c1-lab-rec', 0, b4, 0.01, 1)
      camBench.to(tl, { x: 900, y: 460, zoom: 1.04 }, b4, 0.001)
      camBench.to(tl, { x: 960, y: 470, zoom: 1.1 }, b4 + 0.01, LAG_T, 'sine.inOut')
      const knock = LAG_SIM.knock
      drive(tl, b4, LAG_T, (u) => {
        const t = u * LAG_T
        const i = Math.min(LAG_SIM.out.length - 1, Math.round(t / LAG_SIM.dt))
        benchDraw(leadLag(t), LAG_SIM.out[i])
        const ms = Math.round(latencyAt(t) * 1000)
        const txt = el?.querySelector('.c1-ms')
        if (txt) txt.textContent = `${ms} ms`
        el?.querySelector('.c1-dial')?.setAttribute('transform', `rotate(${lerp(-60, 60, (ms - 20) / 130).toFixed(1)})`)
        const bad = ms > 50
        el?.querySelector('.c1-ms')?.setAttribute('fill', bad ? C.danger : C.lime)
        // the cup: knocked over when the overshoot reaches it
        const k = t - knock
        const cup = el?.querySelector('.c1-lagcup')
        if (cup) {
          if (k <= 0) cup.setAttribute('transform', '')
          else {
            const fall = Math.min(1, k / 0.9)
            cup.setAttribute('transform', `translate(${(fall * 140).toFixed(1)} ${(fall * fall * 300).toFixed(1)}) rotate(${(Math.min(1, k / 0.35) * 80 + fall * 60).toFixed(1)} ${CUP.x} ${CUP.y})`)
          }
        }
      })
      camBench.shake(tl, b4 + knock, 0.8, 0.4)
      fade(tl, '.c1-lab-overshoot', 1, b4 + knock, 0.3)
      fade(tl, '.c1-lab-overshoot', 0, b4 + LAG_T - 0.2, 0.2, 1)
      // the long shift: back in the room, time racing
      const tl0 = b4 + LAG_T
      show('.c1-room', tl0)
      fade(tl, '.c1-timelapse', 1, tl0, 0.3)
      camRoom.to(tl, { x: 520, y: 460, zoom: 1.2 }, tl0, 0.001)
      camRoom.to(tl, { x: 560, y: 480, zoom: 1.28 }, tl0 + 0.01, 4, 'sine.inOut')
      tl.fromTo('.c1-hand-min', { rotation: 0 }, { rotation: 360 * 8, duration: 3.6, ease: 'power1.in', svgOrigin: '1300 210', immediateRender: false }, tl0)
      tl.fromTo('.c1-hand-hr', { rotation: 0 }, { rotation: 240, duration: 3.6, ease: 'power1.in', svgOrigin: '1300 210', immediateRender: false }, tl0)
      drive(tl, tl0, 3.6, (u) => {
        const h = el?.querySelector('.c1-hours')
        if (h) h.textContent = `hour ${Math.min(8, 1 + Math.floor(u * 8))}`
      }, 'power1.in')
      fade(tl, '.c1-dawn', 0.8, tl0, 3.6, 0)
      kofi.to(tl, { torso: 18, head: 26, armN: 14, elbowN: 30, armF: 10, elbowF: 30, y: 10 }, tl0 + 0.4, 3, 'power1.in')
      seven.to(tl, { armN: 4, elbowN: 8, armF: -4, elbowF: 8 }, tl0, 1)

      /* b5: the verdict on the lime map. */
      const b5 = tl0 + 4
      tl.addLabel('b5', b5)
      show('.c1-map', b5)
      fade(tl, '.c1-timelapse', 0, b5, 0.01, 1)
      camMap.to(tl, { x: 800, y: 470, zoom: 1.25 }, b5, 0.001)
      camMap.to(tl, { x: 800, y: 450, zoom: 0.94 }, b5 + 0.01, 5, 'sine.inOut')
      fade(tl, '.c1-mapbase', 1, b5 + 0.2, 0.8)
      tl.fromTo('.c1-ticon', { x: 0, y: 360, scale: 0.6 }, { x: 0, y: 0, scale: 1, duration: 2.2, ease: 'power3.inOut', immediateRender: false }, b5 + 0.8)
      fade(tl, '.c1-ticon', 1, b5 + 0.8, 0.4)
      tl.fromTo('.c1-far', { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', immediateRender: false }, b5 + 3.4)
      fade(tl, '.c1-far-g', 1, b5 + 3.4, 0.4)
      fade(tl, '.c1-tag-0', 1, b5 + 6.4, 0.5)
      fade(tl, '.c1-tag-1', 1, b5 + 7.6, 0.5)
      fade(tl, '.c1-tag-2', 1, b5 + 9.4, 0.5)
      fade(tl, '.c1-ghosts', 1, b5 + 1.2, 1.2)
      letterbox(tl, '.c1-lb', true, b5 + 10.5)
      tl.to({}, { duration: 0.4 }, b5 + 12.6)
    },
    [human, robot, grip],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c1-hum', { opacity: 0.75, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-screenglow', { opacity: 0.55, duration: 0.9, yoyo: true, repeat: -1, ease: 'steps(3)' })
    gsap.to('.c1-recdot', { opacity: 0.2, duration: 0.6, yoyo: true, repeat: -1, ease: 'steps(1)' })
    gsap.to('.c1-ghost', { rotation: 360, duration: 60, repeat: -1, ease: 'none', svgOrigin: `${MAP.top.x} 560` })
    gsap.to('.c1-pulse', { scale: 1.12, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      <DcDefs />
      {/* ---------------- the room: over Kofi's shoulder to Seven ---------------- */}
      <g className="c1-room" ref={roomRef}>
        <g data-depth="0.25">
          <LabSky flashClass="c1-flash-sky" />
          <rect className="c1-dawn" x={-600} y={-500} width={2800} height={1900} fill="url(#cn-sky-dawn)" opacity={0} />
        </g>
        <g data-depth="0.6">
          <LabWall />
        </g>
        <g data-depth="1">
          <LabFloor />
          {/* the capture cell: tape on the floor, cameras on tripods, a soft light */}
          <path d={`M${SEVEN.x - 240} 800 L${SEVEN.x + 200} 800 L${SEVEN.x + 150} 740 L${SEVEN.x - 190} 740 Z`} fill="none" stroke={C.lime} strokeWidth={3} strokeDasharray="18 12" opacity={0.55} />
          <g className="c1-hum">
            <Pool x={SEVEN.x - 40} y={560} r={420} color="rim" opacity={0.55} />
          </g>
          {[SEVEN.x - 330, SEVEN.x + 260].map((x, i) => (
            <g key={x} transform={`translate(${x} 770)`}>
              <path d="M0 0 L-30 0 M0 0 L30 0 M0 0 L0 -260 M0 -60 L-26 0 M0 -60 L26 0" stroke={C.ink4} strokeWidth={5} />
              <rect x={-26} y={-290} width={52} height={34} rx={5} fill={C.ink3} />
              <circle cx={i ? -26 : 26} cy={-273} r={12} fill={C.ink1} stroke={C.slate} strokeWidth={3} />
              <circle className="c1-recdot" cx={i ? 14 : -14} cy={-282} r={4} fill={C.danger} />
            </g>
          ))}
          {/* the task table */}
          <rect x={SEVEN.x - 250} y={640} width={150} height={10} fill={C.ink3} />
          <rect x={SEVEN.x - 240} y={650} width={10} height={110} fill={C.ink2} />
          <rect x={SEVEN.x - 120} y={650} width={10} height={110} fill={C.ink2} />
          <PaperCup x={SEVEN.x - 200} y={640} s={0.4} />
          <path d={`M${SEVEN.x - 160} 640 q 20 -10 40 0 l -6 -6 q -14 -6 -28 2 Z`} fill={C.mist} opacity={0.7} />
          {/* a monitor cart with the robot's view */}
          <g transform="translate(700 770)">
            <rect x={-6} y={-200} width={12} height={200} fill={C.ink2} />
            <rect x={-70} y={-10} width={140} height={10} fill={C.ink2} />
            <rect x={-90} y={-300} width={180} height={110} rx={6} fill={C.ink1} stroke={C.ink4} strokeWidth={4} />
            <rect className="c1-screenglow" x={-82} y={-292} width={164} height={94} fill={C.rim} opacity={0.35} />
            <rect x={-60} y={-270} width={50} height={56} fill="none" stroke={C.lime} strokeWidth={2} />
            <Pool x={0} y={-240} r={160} color="rim" opacity={0.4} />
          </g>
          <ellipse cx={SEVEN.x} cy={SEVEN.y + 4} rx={90} ry={11} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
          <Robot name="c1-seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} flip pose={POSES.stand} light="cool-right" />
          <g className="c1-visor-s" opacity={0}>
            <circle cx={SEVEN.x - 18} cy={SEVEN.y - 286} r={26} fill={C.cyan} opacity={0.45} filter="url(#cn-bloom-big)" />
            <circle cx={SEVEN.x - 22} cy={SEVEN.y - 288} r={6} fill={C.cyanLight} />
          </g>
          <Label className="c1-lab-seven" x={SEVEN.x + 10} y={SEVEN.y - 330} tx={SEVEN.x + 90} ty={SEVEN.y - 400} text="Seven" sub="copies whatever Kofi does" color={C.rim} />
          <Dust x={600} y={200} w={900} h={560} count={30} seed={8} color={C.rim} size={0.8} />
        </g>
        <g data-depth="1.55">
          <ellipse cx={KOFI_AT.x + 40} cy={480} rx={260} ry={420} fill={C.ink} opacity={0.4} filter="url(#cn-dof-3)" />
          <Person name="c1-kofi" x={KOFI_AT.x} y={KOFI_AT.y} s={KOFI_AT.s} pose={POSES.stand} light="back" {...KOFI} />
          <g className="c1-visor-k" opacity={0}>
            <circle cx={KOFI_AT.x + 66} cy={KOFI_AT.y - 288 * KOFI_AT.s} r={30} fill={C.cyan} opacity={0.35} filter="url(#cn-bloom-big)" />
          </g>
          <Label className="c1-lab-kofi" x={KOFI_AT.x + 40} y={KOFI_AT.y - 322 * KOFI_AT.s} tx={KOFI_AT.x + 170} ty={230} text="Kofi" sub="teleoperator" color={C.keyLight} />
        </g>
        <g className="c1-timelapse" opacity={0} pointerEvents="none">
          <circle cx={1300} cy={210} r={92} fill={C.ink1} fillOpacity={0.8} stroke={C.paper} strokeWidth={4} />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={1300} y1={130} x2={1300} y2={142} stroke={C.mist} strokeWidth={3} transform={`rotate(${i * 30} 1300 210)`} />
          ))}
          <line className="c1-hand-hr" x1={1300} y1={210} x2={1300} y2={160} stroke={C.paper} strokeWidth={7} strokeLinecap="round" />
          <line className="c1-hand-min" x1={1300} y1={210} x2={1300} y2={138} stroke={C.key} strokeWidth={4} strokeLinecap="round" />
          <circle cx={1300} cy={210} r={7} fill={C.paper} />
          <Tag className="c1-hours" x={1300} y={346} anchor="middle" size={28} color={C.paper}>
            hour 1
          </Tag>
        </g>
      </g>

      {/* ---------------- the puppet bench ---------------- */}
      <g className="c1-bench" ref={benchRef} opacity={0}>
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.6}>
            <rect x={60} y={120} width={260} height={420} fill={C.ink3} />
            <rect x={1300} y={100} width={300} height={460} fill={C.ink3} />
            <circle cx={200} cy={260} r={34} fill={C.key} opacity={0.35} />
            <circle cx={1450} cy={230} r={40} fill={C.rim} opacity={0.35} />
          </g>
        </g>
        <g data-depth="1">
          <g className="c1-hum">
            <Pool x={480} y={620} r={460} color="key" opacity={0.9} />
          </g>
          <Pool x={1100} y={520} r={560} color="rim" opacity={0.45} />
          <rect x={-600} y={700} width={2800} height={800} fill={C.ink2} />
          <rect x={-600} y={700} width={2800} height={5} fill={C.keyDeep} opacity={0.6} />
          <ellipse cx={600} cy={712} rx={600} ry={40} fill={C.key} opacity={0.12} filter="url(#cn-dof-2)" />
          {/* the follower's camera, over the bench */}
          <g transform="translate(1380 250)">
            <path d="M0 0 L0 460" stroke={C.ink4} strokeWidth={8} />
            <rect x={-40} y={-26} width={66} height={44} rx={6} fill={C.ink3} />
            <circle cx={-44} cy={-4} r={14} fill={C.ink1} stroke={C.slate} strokeWidth={3} />
            <path d="M-56 -4 L-330 150 M-56 -4 L-300 330" stroke={C.lime} strokeWidth={1.5} strokeDasharray="6 8" opacity={0.5} />
          </g>
          <Arm2D cls="c1-foll" x={FOLL.x} y={FOLL.y} s={FOLL.s} lens={FOLL.lens} a={L(0)} />
          <g className="c1-lag" opacity={0}>
            <g className="c1-lagcup">
              <PaperCup x={CUP.x} y={CUP.y} s={0.75} />
            </g>
            {/* the latency dial */}
            <g transform="translate(760 250)">
              <path d="M-90 30 A100 100 0 0 1 90 30" fill="none" stroke={C.ink4} strokeWidth={14} strokeLinecap="round" />
              <path d="M-90 30 A100 100 0 0 1 -46 -60" fill="none" stroke={C.lime} strokeWidth={14} strokeLinecap="round" />
              <path d="M30 -78 A100 100 0 0 1 90 30" fill="none" stroke={C.danger} strokeWidth={14} strokeLinecap="round" opacity={0.8} />
              <g className="c1-dial">
                <line x1={0} y1={40} x2={0} y2={-70} stroke={C.paper} strokeWidth={5} strokeLinecap="round" />
              </g>
              <circle cx={0} cy={40} r={10} fill={C.paper} />
              <text x={0} y={-118} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={24}>
                latency
              </text>
              <text className="c1-ms" x={0} y={100} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={40}>
                20 ms
              </text>
            </g>
            <Label className="c1-lab-overshoot" x={1440} y={640} tx={1290} ty={430} text="late, then too far" color={C.danger} />
          </g>
          <Arm2D
            cls="c1-lead"
            x={LEAD.x}
            y={LEAD.y}
            s={LEAD.s}
            lens={LEAD.lens}
            look="leader"
            a={L(0)}
            tip={
              <g>
                <rect x={-7} y={-34} width={14} height={36} rx={5} fill={C.ink3} />
              </g>
            }
          />
          {/* Kofi's arm, from off the frame to the puppet's handle */}
          <g filter="url(#cn-lit-key-left)">
            <path className="c1-karm" d="" fill="none" stroke={KOFI.top} strokeWidth={64} strokeLinecap="round" />
            <path className="c1-karm2" d="" fill="none" stroke={C.skinC} strokeWidth={36} strokeLinecap="round" />
            <g className="c1-fist">
              <ellipse cx={-6} cy={6} rx={26} ry={22} fill={C.skinC} />
              <path d="M-22 -6 q 16 -10 30 0" stroke={C.skinCDark} strokeWidth={4} fill="none" />
            </g>
          </g>
          <Label className="c1-lab-gello" x={LEAD.x - 40} y={LEAD.y - 60} tx={LEAD.x - 140} ty={LEAD.y + 90} text="the puppet" sub="GELLO: under $300 of parts" color={C.keyLight} anchor="start" />
          <Label className="c1-lab-aloha" x={FOLL.x + 60} y={FOLL.y - 120} tx={FOLL.x + 150} ty={FOLL.y + 90} text="the real arm" sub="ALOHA: about $20,000" color={C.rim} anchor="start" />
        </g>
        {/* the film strip: what the robot saw, paired with what Kofi made it do */}
        <g className="c1-strip" pointerEvents="none">
          {FRAMES.map((a, i) => {
            const x = 90 + i * 240
            return (
              <g key={i} className={`c1-fr-${i}`} opacity={0}>
                <rect x={x} y={40} width={190} height={106} rx={4} fill={C.ink} stroke={C.lime} strokeWidth={2} />
                <g transform={`translate(${x + 96} 140) scale(0.22)`} opacity={0.85}>
                  {(() => {
                    const p = armPoints(FOLL.lens, a)
                    return <path d={`M${p.map((q) => `${q.x} ${q.y}`).join(' L')}`} stroke={C.shell} strokeWidth={26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  })()}
                  <rect x={-460} y={-6} width={920} height={10} fill={C.slate} />
                </g>
                <line x1={x + 95} y1={146} x2={x + 95} y2={174} stroke={C.lime} strokeWidth={2} />
                <text x={x + 95} y={196} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={17}>
                  {a.map((v) => `${Math.round(v)}°`).join('  ')}
                </text>
              </g>
            )
          })}
          <rect className="c1-flash" x={0} y={0} width={1600} height={900} fill={C.paper} opacity={0} />
          <g className="c1-lab-rec" opacity={0}>
            <circle className="c1-recdot" cx={1500} cy={240} r={8} fill={C.danger} />
            <Tag x={1484} y={247} anchor="end" color={C.lime} size={20}>
              picture + action, recorded together
            </Tag>
          </g>
        </g>
      </g>

      {/* ---------------- two hands: tracked glove, mirroring robot ---------------- */}
      <g className="c1-hands" ref={handsRef} opacity={0}>
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          <Pool x={480} y={560} r={420} color="key" opacity={0.75} />
          <Pool x={1120} y={560} r={420} color="rim" opacity={0.45} />
          <line x1={800} y1={120} x2={800} y2={940} stroke={C.paper} strokeWidth={1.5} opacity={0.18} />
          <Hand3D store={human} x={480} y={760} look="human" arm={320} light={[-0.8, -0.6]} onTips={(t) => { tipsH.current = t; drawPairs() }} />
          <Hand3D store={robot} x={1120} y={760} look="robot" arm={320} light={[0.8, -0.5]} onTips={(t) => { tipsR.current = t; drawPairs() }} />
          {/* a wrist strap: the tracking glove */}
          <rect x={440} y={748} width={80} height={22} rx={8} fill={C.ink2} stroke={C.lime} strokeWidth={2} />
          <circle className="c1-recdot" cx={506} cy={759} r={5} fill={C.lime} />
          <g className="c1-pairs" opacity={0}>
            {(['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]).map((f) => (
              <g key={f}>
                <path className={`c1-pl-${f}`} d="" fill="none" stroke={C.lime} strokeWidth={1.6} strokeDasharray="5 7" opacity={0.55} />
                <g className={`c1-mk-${f}`}>
                  <circle r={9} fill="none" stroke={C.lime} strokeWidth={2.5} />
                  <circle r={3.5} fill={C.lime} />
                </g>
              </g>
            ))}
          </g>
          <g className="c1-thumbring" opacity={0}>
            <g className="c1-thumbat">
              <circle r={36} fill="none" stroke={C.danger} strokeWidth={3} strokeDasharray="8 6" />
            </g>
          </g>
          <Label className="c1-lab-thumb" x={1040} y={640} tx={1000} ty={830} text="thumb: retargeted, not copied" color={C.danger} />
          <Label className="c1-lab-glove" x={420} y={520} tx={330} ty={300} text="tracked: every finger" sub="glove or headset" color={C.lime} />
          <Label className="c1-lab-mirror" x={1200} y={520} tx={1290} ty={300} text="Seven mirrors" sub="a beat late" color={C.rim} />
          {/* the stream between them: every finger's angles, many times a second */}
          <g className="c1-pairs" opacity={0}>
            <text x={800} y={150} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={20}>
              glove → robot, 50 times a second
            </text>
            {(['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]).map((f, i) => (
              <g key={f}>
                <text x={786} y={190 + i * 30} textAnchor="end" fill={C.fog} fontFamily={MONO} fontSize={18}>
                  {f}
                </text>
                <text className={`c1-num-${f}`} x={800} y={190 + i * 30} fill={C.lime} fontFamily={MONO} fontSize={18}>
                  0°
                </text>
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* ---------------- feel: the crushed cup and the hesitant take ---------------- */}
      <g className="c1-feel" ref={feelRef} opacity={0}>
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.6}>
            <rect x={1340} y={60} width={300} height={500} fill={C.ink3} />
            <circle cx={1450} cy={200} r={36} fill={C.rim} opacity={0.4} />
          </g>
        </g>
        <g data-depth="1">
          <g className="c1-hum">
            <Pool x={1090} y={620} r={460} color="key" opacity={0.9} />
          </g>
          <rect x={560} y={742} width={2000} height={600} fill={C.ink2} />
          <rect x={560} y={742} width={2000} height={4} fill={C.keyDeep} opacity={0.6} />
          <g className="c1-cup1">
            <g className="c1-cupbody">
              <PaperCup x={1090} y={742} s={1.5} />
            </g>
            <path className="c1-crumple" d="M1066 650 l14 20 l-10 18 l16 16 l-8 20 M1110 640 l-10 22 l12 20 l-8 24" stroke="#7d6f58" strokeWidth={3} fill="none" opacity={0} />
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} className="c1-drop" cx={1090} cy={640} r={7 - i} fill="#6b4426" opacity={0} />
            ))}
          </g>
          <g className="c1-cup2" opacity={0}>
            <PaperCup x={1090} y={742} s={1.5} />
          </g>
          <g className="c1-grip">
            <Hand3D store={grip} x={1100} y={300} look="robot" arm={460} light={[0.8, -0.5]} />
          </g>
          {/* touch signal: the robot feels it, Kofi doesn't */}
          <g className="c1-signal-g" opacity={0}>
            <path className="c1-signal" d="M1040 640 C 880 600 640 520 400 440" fill="none" stroke={C.magenta} strokeWidth={4} strokeDasharray="520" strokeDashoffset={520} filter="url(#cn-bloom)" />
          </g>
          <g className="c1-break" opacity={0}>
            <path d="M582 476 l36 36 M618 476 l-36 36" stroke={C.danger} strokeWidth={6} strokeLinecap="round" />
          </g>
          <Label className="c1-lab-notouch" x={640} y={520} tx={600} ty={640} text="no touch feedback for the operator" color={C.magentaLight} anchor="start" />
          {/* speed meter and the recorded trace */}
          <g className="c1-speed" opacity={0}>
            <text x={1180} y={140} fill={C.mist} fontFamily={SANS} fontSize={22}>
              hand speed
            </text>
            <rect x={1180} y={154} width={300} height={12} rx={6} fill={C.ink3} />
            <rect className="c1-speedbar" x={1180} y={154} width={300} height={12} rx={6} fill={C.cyan} />
            <text x={1480} y={140} textAnchor="end" fill={C.cyan} fontFamily={MONO} fontSize={22}>
              slow
            </text>
            <path className="c1-trace" d="M1180 260 L1230 260 L1250 238 L1300 236 L1320 214 L1380 212 L1392 200 L1440 198 L1452 186 L1500 184" fill="none" stroke={C.lime} strokeWidth={3} strokeDasharray="700" strokeDashoffset={700} />
            <line x1={1180} y1={276} x2={1500} y2={276} stroke={C.fog} strokeWidth={1.5} />
          </g>
          <Label className="c1-lab-hesitant" x={1320} y={214} tx={1300} ty={330} text="recorded: slow, hesitant" color={C.lime} />
        </g>
        <g data-depth="1.3">
          <g className="c1-face">
            <Profile x={-60} y={230} s={0.95} skin={C.skinC} skinDark={C.skinCDark} light="screen" half={0.62} reflect={C.cyanLight} />
            <g transform="translate(-60 230) scale(0.95)">
              <g className="c1-eyes-shut" opacity={0}>
                <path d="M330 252 q 24 -6 48 0" stroke={C.ink} strokeWidth={9} fill="none" strokeLinecap="round" />
                <path d="M326 236 q 30 -4 58 10" stroke={C.ink} strokeWidth={8} fill="none" strokeLinecap="round" />
              </g>
              {/* the headset pushed up on his forehead */}
              <path d="M150 120 Q300 40 392 150" stroke={C.ink3} strokeWidth={22} fill="none" />
              <g transform="rotate(24 360 130)">
                <rect x={330} y={108} width={92} height={56} rx={14} fill={C.ink3} />
                <rect x={340} y={122} width={72} height={10} rx={4} fill={C.cyan} opacity={0.7} />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* ---------------- the verdict on the lime map ---------------- */}
      <g className="c1-map" ref={mapRef} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c1-mapbase" opacity={0}>
            <SourceMap />
          </g>
          <g className="c1-ghosts" opacity={0}>
            {(['glove', 'video', 'sim', 'fleet'] as const).map((k, i) => (
              <g key={k} className="c1-ghost">
                <g transform={`translate(${MAP.top.x + Math.cos(i * 1.57 + 0.6) * 520} ${560 + Math.sin(i * 1.57 + 0.6) * 300}) scale(0.7)`} opacity={0.3}>
                  <SourceIcon kind={k} color={C.mist} />
                </g>
              </g>
            ))}
          </g>
          <g className="c1-far-g" opacity={0}>
            <path className="c1-far" d={`M${MAP.top.x} 270 L${MAP.left.x + 40} ${MAP.left.y - 30}`} stroke={C.lime} strokeWidth={2} strokeDasharray="600" strokeDashoffset={600} opacity={0.5} />
            <path className="c1-far" d={`M${MAP.top.x} 270 L${MAP.right.x - 40} ${MAP.right.y - 30}`} stroke={C.lime} strokeWidth={2} strokeDasharray="600" strokeDashoffset={600} opacity={0.5} />
            <Tag x={540} y={500} anchor="middle" color={C.limeLight} size={22}>
              far from cheap
            </Tag>
            <Tag x={1060} y={500} anchor="middle" color={C.limeLight} size={22}>
              far from diverse
            </Tag>
          </g>
          <g transform={`translate(${MAP.top.x} 270)`}>
            <g className="c1-ticon" opacity={0}>
              <circle className="c1-pulse" r={52} fill={C.lime} opacity={0.18} filter="url(#cn-bloom)" />
              <SourceIcon kind="teleop" />
              <text y={78} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={26} fontWeight={600}>
                teleop
              </text>
            </g>
          </g>
          {['slow', 'a real robot per operator', 'a handful of rooms'].map((t, i) => (
            <g key={t} className={`c1-tag-${i}`} opacity={0}>
              <circle cx={990} cy={250 + i * 50} r={6} fill={i === 1 ? C.gold : C.mist} />
              <text x={1010} y={258 + i * 50} fill={i === 1 ? C.gold : C.paper} fontFamily={SANS} fontSize={28}>
                {t}
              </text>
            </g>
          ))}
        </g>
      </g>
      <Vignette />
      <Letterbox className="c1-lb" />
    </g>
  )
}

/** The six frames in the film strip, with the joint angles at the moment each was taken. */
const FRAMES: ArmAngles[] = Array.from({ length: 6 }, (_, i) => L(2.4 + i * 1.5))

export const ch1: Chapter = {
  id: 'teleop',
  title: 'The puppet',
  cues: CUES,
  Scene: Ch1Teleop,
  deeper: [TeleopReading],
}
