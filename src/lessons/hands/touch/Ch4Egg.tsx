import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Dust, Egg, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { BigFinger, Mono, draw, ticker } from './parts'
import { GripPlay } from './GripPlay'
import { SkinReading } from './readings'
import './touch.css'

export const CUES: Cue[] = [
  { id: 'return', say: 'Back to our egg. Now the robot can feel. Here’s how a touch-driven grip works.' },
  { id: 'loop', say: 'Close gently until you feel contact. Squeeze a little. If you feel slip, squeeze a bit more. Never more than you need.' },
  { id: 'grip', say: 'You’re the controller. Lift the egg out of its cup without crushing it or dropping it. First with the touch sensors off, then on.', play: true },
  { id: 'problems', say: 'So why don’t all robot hands have great skin? Because skin is the part that touches the world, so it’s the part that wears out first.' },
  { id: 'wiring', say: 'Thousands of sensing points need wires through every moving joint, and those wires fatigue and snap. Readings drift with heat and age. And a model trained on one skin can stumble when the skin is replaced.' },
  { id: 'data', say: 'And there’s almost no data. The world’s big robot datasets are nearly all vision. Touch is the newest frontier, and one of the most open.' },
]

const STATE = [
  'Back to the close-up from film 1: the workbench under the warm lamp at night, one egg. The big white robot hand descends slowly from above again, fingers open, but this time its fingertips glow faint magenta: they can feel. Label: "fingertips that feel".',
  'The robot hand runs a touch-driven grip on the egg while a lime control-loop diagram draws itself beside it: contact → hold → slip? → +grip, with an arrow looping back to hold. The hand closes gently until the fingertips register contact (magenta glow), squeezes a little, starts to lift; the egg slips a few millimetres (magenta flicker), the hand squeezes a bit more and the egg holds. Below the loop a small graph: the amber grip line rides just above the dashed slip line, stepping up when slip is felt. Caption: "never more than you need".',
  '',
  'A robot fingertip with a magenta skin scrubs a frying pan over and over. A counter climbs from 0 to 4,000 cycles. The silicone skin scuffs, gets scratched and finally tears. A graph beside it shows tactile sensitivity falling away after about 2,000 cycles. Label: "ORCA hand: fingertip skin degraded after 2,000-4,000 cycles" (ORCA is an open-source ETH Zurich hand, 2025).',
  'Three problems, left to right. 1) An x-ray of a robot finger flexing: a bundle of fine lime sensor wires runs through the knuckle; one strand fatigues and snaps with a spark ("ORCA: sensor wires snapped after 4,500-7,000 cycles at the knuckle"). 2) A thermometer rises while the same press is repeated, and the reading creeps upward: drift with heat and age. 3) Two fingertip skins, the original and a replacement, give different magenta heatmaps for the same press; a model trained on the first gets confused on the second (after a skin swap, a policy kept 87% of its performance with AnySkin versus 57% with ReSkin).',
  'A vast wall of glowing video tiles (vision data: the big robot datasets are almost all camera images plus joint angles) and, in a corner, one small shelf of magenta tiles: touch data. The camera pushes in on the small shelf. Labels: the biggest corpora reach hundreds of thousands of hours, almost all without touch; NeoData (Sep 2026 preprint) is a first attempt with 30,000 hours of visual + touch data. A lime branch flickers in the background, a link to the data course.',
]

/** The film 1 close-up: the egg on the bench, and how far the hand drops to grip it. */
const EGG = { x: 760, y: 700 }
const DROP = 200
const RVIEW = { yaw: 82, pitch: -6, roll: 180, s: 2.05 }
const GENTLE: HandPose = { ...GRASPS.claw, index: [30, 30, 20, 0], middle: [30, 30, 20, 0], ring: [30, 30, 20, 0], little: [30, 30, 20, 0] }
const FIRM: HandPose = { ...GRASPS.claw, index: [33, 32, 21, 0], middle: [33, 32, 21, 0], ring: [32, 31, 21, 0], little: [32, 31, 21, 0] }

/** The loop diagram, on the right of the frame (screen space). */
const LOOP = { x: 1260, y: 350, r: 165 }
const NODES = [
  { id: 'contact', text: 'contact', a: -135 },
  { id: 'hold', text: 'hold', a: -45 },
  { id: 'slip', text: 'slip?', a: 45 },
  { id: 'grip', text: '+grip', a: 135 },
].map((n) => ({ ...n, x: LOOP.x + LOOP.r * Math.cos((n.a * Math.PI) / 180), y: LOOP.y + LOOP.r * Math.sin((n.a * Math.PI) / 180) }))
const arc = (a0: number, a1: number) => {
  const r = LOOP.r
  const p = (a: number) => `${(LOOP.x + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(LOOP.y + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`
  return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`
}
/** The little grip-vs-slip graph under the loop. */
const GR = { x0: 1010, y0: 800, w: 420, h: 140 }
const slipAt = (u: number) => 0.32 + 0.12 * Math.min(1, u / 0.25) + (u > 0.5 && u < 0.72 ? 0.2 * Math.sin(((u - 0.5) / 0.22) * Math.PI) : 0)
const gripAt = (u: number) => (u < 0.08 ? (u / 0.08) * 0.42 : u < 0.5 ? 0.42 + 0.13 * Math.min(1, (u - 0.08) / 0.2) : u < 0.54 ? 0.55 + ((u - 0.5) / 0.04) * 0.2 : 0.75)
const curve = (f: (u: number) => number) => Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${(GR.x0 + (i / 60) * GR.w).toFixed(1)} ${(GR.y0 - f(i / 60) * GR.h).toFixed(1)}`).join(' ')

/** The wear graph. */
const WG = { x0: 940, y0: 640, w: 520, h: 300 }
const WEAR = `M${WG.x0} ${WG.y0 - WG.h * 0.9} L${WG.x0 + WG.w * 0.42} ${WG.y0 - WG.h * 0.88} C${WG.x0 + WG.w * 0.6} ${WG.y0 - WG.h * 0.84} ${WG.x0 + WG.w * 0.7} ${WG.y0 - WG.h * 0.45} ${WG.x0 + WG.w} ${WG.y0 - WG.h * 0.18}`

/** The x-ray finger's knuckle in the wiring cue. */
const KN = { x: 320, y: 470 }
const WIRES = [-30, -18, -6, 6, 18, 30]

/** The drift trace: the same press six times while the baseline creeps up. */
const DRIFT = `M752 560 ${Array.from({ length: 6 }, (_, i) => `L${770 + i * 40} ${560 - i * 16} l6 -70 h12 l6 70`).join(' ')} L1010 ${560 - 6 * 16}`

/** The data library. */
const TILE = { cols: 34, rows: 15, w: 38, h: 24, gx: 6, gy: 8, x0: 60, y0: 70 }
const SHELF = { x: 1180, y: 800 }

export function Ch4Egg({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const closeRef = useRef<SVGGElement>(null)
  const wireRef = useRef<SVGGElement>(null)
  const dataRef = useRef<SVGGElement>(null)
  const robot = useHandStore({ pose: GRASPS.relaxed, view: RVIEW })
  const [won, setWon] = useState(false)
  const active = cueIndex === 2 && !won

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(closeRef.current, { x: 800, y: 470, zoom: 1.12 })
      const wc = camera(wireRef.current, { x: 800, y: 450, zoom: 1 })
      const dc = camera(dataRef.current, { x: 800, y: 450, zoom: 1 })

      /* b0: the bench, the egg, the hand again. This time the fingertips glow. */
      tl.addLabel('b0', 0)
      tl.set('.e-play, .e-wear, .e-wire, .e-data, .e-loop', { opacity: 0 }, 0)
      tl.set('.e-close', { opacity: 1 }, 0)
      cam.to(tl, { x: 790, y: 520, zoom: 1.28 }, 0, 5.6, 'sine.inOut')
      tl.fromTo('.e-rhand', { y: -760 }, { y: -170, duration: 3.4, ease: 'power2.out', immediateRender: false }, 0.3)
      tl.fromTo('.e-lift', { y: 0 }, { y: 0, duration: 0.1, immediateRender: false }, 0)
      robot.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, 0, 0.1)
      robot.to(tl, { touch: { thumb: 0.15, index: 0.15, middle: 0.15, ring: 0.12, little: 0.1 } }, 2.4, 1.2)
      fade(tl, '.e-lab-feel', 1, 3.6, 0.6)
      tl.to({}, { duration: 0.3 }, 6.1)

      /* b1: the loop, run on the egg while the diagram draws itself. */
      const b1 = 6.4
      tl.addLabel('b1', b1)
      fade(tl, '.e-lab-feel', 0, b1, 0.4, 1)
      cam.to(tl, { x: 1010, y: 520, zoom: 1.2 }, b1, 1.4, 'power2.inOut')
      fade(tl, '.e-loop', 1, b1 + 0.6, 0.6)
      // contact
      tl.fromTo('.e-rhand', { y: -170 }, { y: DROP, duration: 1.0, ease: 'power2.out', immediateRender: false }, b1 + 0.2)
      robot.to(tl, { pose: GENTLE }, b1 + 0.6, 0.6)
      robot.to(tl, { touch: { thumb: 0.4, index: 0.4, middle: 0.35, ring: 0.25, little: 0.2 } }, b1 + 1.1, 0.25)
      tl.fromTo('.e-n-contact', { opacity: 0.25 }, { opacity: 1, duration: 0.3, immediateRender: false }, b1 + 1.1)
      draw(tl, '.e-a-0', b1 + 1.3, 0.5)
      fade(tl, '.e-ah-0', 1, b1 + 1.3 + 0.5 - 0.1, 0.15)
      // hold: squeeze a little and start to lift
      tl.fromTo('.e-n-hold', { opacity: 0.25 }, { opacity: 1, duration: 0.3, immediateRender: false }, b1 + 1.9)
      robot.to(tl, { touch: { thumb: 0.55, index: 0.55, middle: 0.5, ring: 0.35, little: 0.3 } }, b1 + 1.9, 0.4)
      tl.fromTo('.e-lift', { y: 0 }, { y: -50, duration: 1.4, ease: 'power1.in', immediateRender: false }, b1 + 2.2)
      draw(tl, '.e-a-1', b1 + 2.3, 0.5)
      fade(tl, '.e-ah-1', 1, b1 + 2.3 + 0.5 - 0.1, 0.15)
      draw(tl, '.e-g-slip', b1 + 1.1, 6.6, 'none')
      draw(tl, '.e-g-grip', b1 + 1.1, 6.6, 'none')
      // slip? the egg sinks a little in the fingers; the tips flicker
      tl.fromTo('.e-n-slip', { opacity: 0.25 }, { opacity: 1, duration: 0.3, immediateRender: false }, b1 + 3.6)
      tl.fromTo('.e-egg', { y: 0 }, { y: 9, duration: 0.3, ease: 'power1.in', immediateRender: false }, b1 + 3.6)
      tl.fromTo('.e-slipflash', { opacity: 0 }, { opacity: 1, duration: 0.06, yoyo: true, repeat: 5, immediateRender: false }, b1 + 3.6)
      draw(tl, '.e-a-2', b1 + 3.9, 0.5)
      fade(tl, '.e-ah-2', 1, b1 + 3.9 + 0.5 - 0.1, 0.15)
      // +grip: a bit more, and it holds
      tl.fromTo('.e-n-grip', { opacity: 0.25 }, { opacity: 1, duration: 0.3, immediateRender: false }, b1 + 4.5)
      robot.to(tl, { pose: FIRM, touch: { thumb: 0.8, index: 0.8, middle: 0.7, ring: 0.5, little: 0.4 } }, b1 + 4.5, 0.3)
      draw(tl, '.e-a-3', b1 + 4.8, 0.6)
      fade(tl, '.e-ah-3', 1, b1 + 4.8 + 0.6 - 0.1, 0.15)
      tl.fromTo('.e-lift', { y: -50 }, { y: -130, duration: 2.6, ease: 'sine.inOut', immediateRender: false }, b1 + 5.0)
      fade(tl, '.e-never', 1, b1 + 7.0, 0.6)
      tl.to({}, { duration: 0.3 }, b1 + 8.9)

      /* b2: the play. A side view at the bench; you are the controller. */
      const b2 = b1 + 9.2
      tl.addLabel('b2', b2)
      fade(tl, '.e-close, .e-loop', 0, b2, 0.6, 1)
      fade(tl, '.e-play', 1, b2 + 0.3, 0.8)
      tl.fromTo('.e-playin', { y: -60 }, { y: 0, duration: 1.2, ease: 'power2.out', immediateRender: false }, b2 + 0.3)
      tl.to({}, { duration: 0.3 }, b2 + 9.7)

      /* b3: skin wears out first. */
      const b3 = b2 + 10
      tl.addLabel('b3', b3)
      fade(tl, '.e-play', 0, b3, 0.5, 1)
      fade(tl, '.e-wear', 1, b3 + 0.2, 0.7)
      tl.fromTo('.e-scrub', { x: -70 }, { x: 70, duration: 0.32, ease: 'sine.inOut', yoyo: true, repeat: 27, immediateRender: false }, b3 + 0.6)
      tl.fromTo('.e-suds', { opacity: 0.5 }, { opacity: 0.9, duration: 0.32, yoyo: true, repeat: 27, immediateRender: false }, b3 + 0.6)
      ticker(tl, root.current?.querySelector('.e-count'), 0, 4000, b3 + 0.6, 8.4, (v) => `${Math.round(v / 10) * 10}`.replace(/\B(?=(\d{3})+$)/g, ','), 'power1.in')
      draw(tl, '.e-wearline', b3 + 0.6, 8.4, 'power1.in')
      fade(tl, '.e-scuff-0', 1, b3 + 3.6, 0.4)
      fade(tl, '.e-scuff-1', 1, b3 + 5.0, 0.4)
      fade(tl, '.e-scuff-2', 1, b3 + 6.4, 0.4)
      fade(tl, '.e-band', 1, b3 + 4.8, 0.6)
      fade(tl, '.e-tear', 1, b3 + 8.0, 0.2)
      fade(tl, '.e-padglow', 0.15, b3 + 4.0, 4.4, 1)
      fade(tl, '.e-lab-orca', 1, b3 + 5.6, 0.6)
      tl.to({}, { duration: 0.3 }, b3 + 10.1)

      /* b4: wires snap, readings drift, a new skin reads differently. */
      const b4 = b3 + 10.4
      tl.addLabel('b4', b4)
      fade(tl, '.e-wear', 0, b4, 0.5, 1)
      fade(tl, '.e-wire', 1, b4 + 0.2, 0.6)
      tl.set('.e-merc', { scaleY: 0.25, transformOrigin: '50% 100%' }, b4)
      wc.cut(tl, { x: 430, y: 440, zoom: 1.2 }, b4)
      tl.fromTo('.e-distal', { rotation: 0 }, { rotation: 50, duration: 0.42, ease: 'sine.inOut', yoyo: true, repeat: 9, svgOrigin: `${KN.x} ${KN.y}`, immediateRender: false }, b4 + 0.4)
      ticker(tl, root.current?.querySelector('.e-wcount'), 0, 6000, b4 + 0.4, 4.2, (v) => `${Math.round(v / 10) * 10}`.replace(/\B(?=(\d{3})+$)/g, ','), 'power1.in')
      tl.fromTo('.e-badwire', { stroke: C.lime }, { stroke: C.danger, duration: 1.2, immediateRender: false }, b4 + 2.6)
      fade(tl, '.e-badtail', 0, b4 + 4.4, 0.05, 1)
      tl.fromTo('.e-spark', { scale: 0.2, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.5, transformOrigin: '50% 50%', immediateRender: false }, b4 + 4.4)
      fade(tl, '.e-lab-wire', 1, b4 + 3.0, 0.6)
      // drift
      wc.to(tl, { x: 840, y: 440, zoom: 1.25 }, b4 + 5.2, 1.0)
      tl.fromTo('.e-merc', { scaleY: 0.25 }, { scaleY: 1, duration: 3.6, ease: 'power1.inOut', transformOrigin: '50% 100%', immediateRender: false }, b4 + 5.8)
      draw(tl, '.e-drift', b4 + 5.8, 3.6, 'none')
      fade(tl, '.e-lab-drift', 1, b4 + 6.4, 0.6)
      // a replaced skin
      wc.to(tl, { x: 1290, y: 470, zoom: 1.15 }, b4 + 9.4, 1.0)
      fade(tl, '.e-lab-wire', 0, b4 + 9.4, 0.5, 1)
      tl.fromTo('.e-press', { y: -40 }, { y: 0, duration: 0.5, ease: 'power2.in', immediateRender: false }, b4 + 10.2)
      fade(tl, '.e-heat', 1, b4 + 10.7, 0.4)
      fade(tl, '.e-verdict-a', 1, b4 + 11.4, 0.4)
      fade(tl, '.e-verdict-b', 1, b4 + 12.2, 0.4)
      fade(tl, '.e-lab-swap', 1, b4 + 12.4, 0.6)
      tl.to({}, { duration: 0.3 }, b4 + 14.3)

      /* b5: a library of vision, one shelf of touch. */
      const b5 = b4 + 14.6
      tl.addLabel('b5', b5)
      fade(tl, '.e-wire', 0, b5, 0.5, 1)
      fade(tl, '.e-data', 1, b5 + 0.2, 0.8)
      dc.cut(tl, { x: 800, y: 430, zoom: 1.05 }, b5)
      dc.to(tl, { x: 800, y: 450, zoom: 1 }, b5, 3.4, 'sine.out')
      tl.fromTo('.e-tilerow', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.12, immediateRender: false }, b5 + 0.3)
      fade(tl, '.e-lab-vision', 1, b5 + 2.4, 0.6)
      fade(tl, '.e-shelf', 1, b5 + 3.4, 0.6)
      dc.to(tl, { x: SHELF.x + 60, y: SHELF.y - 50, zoom: 2.0 }, b5 + 5.0, 2.4, 'power2.inOut')
      fade(tl, '.e-lab-touch', 1, b5 + 6.6, 0.6)
      tl.to({}, { duration: 0.3 }, b5 + 10.1)
    },
    [robot],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.e-hum', { opacity: 0.85, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.fromTo('.e-flick-a', { opacity: 0.3 }, { opacity: 0.9, duration: 0.7, yoyo: true, repeat: -1, ease: 'steps(3)' })
    gsap.fromTo('.e-flick-b', { opacity: 0.85 }, { opacity: 0.25, duration: 1.1, yoyo: true, repeat: -1, ease: 'steps(4)' })
    gsap.fromTo('.e-branch', { opacity: 0.12 }, { keyframes: [{ opacity: 0.12, duration: 1.2 }, { opacity: 0.4, duration: 0.06 }, { opacity: 0.18, duration: 0.1 }, { opacity: 0.36, duration: 0.05 }, { opacity: 0.12, duration: 0.6 }], repeat: -1 })
    gsap.to('.e-dust', { y: -14, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------- Pip ---------- */
  const reportPlay = useCallback((d: string) => reportState(d), [reportState])
  useEffect(() => {
    if (cueIndex === 2) {
      setHints(['Squeeze just until it stops slipping, then hold steady.', 'Watch the slip flicker: it warns you before the egg slides.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, reportState, setHints])

  const onWin = () => {
    if (won) return
    setWon(true)
    memory.touchGrip = true
    void say('With touch you can ride just above the slip line. That’s the same trick your own fingers use.').then(() => onPlayDone())
  }

  return (
    <g ref={root}>
      {/* ---------- b0-b1: film 1's close-up, the bench and the egg ---------- */}
      <g className="e-close" ref={closeRef} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            <rect x={-100} y={60} width={300} height={500} fill={C.ink3} />
            <rect x={1300} y={40} width={360} height={520} fill={C.ink3} />
            <circle cx={1450} cy={220} r={40} fill={C.rim} opacity={0.35} />
            <circle cx={60} cy={260} r={30} fill={C.key} opacity={0.3} />
            <circle cx={1180} cy={160} r={22} fill={C.rim} opacity={0.4} />
          </g>
        </g>
        <g data-depth="1">
          <g className="e-hum" opacity={0.95}>
            <Pool x={800} y={640} r={760} color="key" opacity={0.95} />
          </g>
          <rect x={-600} y={790} width={2800} height={800} fill={C.ink2} />
          <rect x={-600} y={790} width={2800} height={5} fill={C.keyDeep} opacity={0.6} />
          <ellipse cx={800} cy={800} rx={700} ry={60} fill={C.key} opacity={0.18} filter="url(#cn-dof-2)" />
          <g className="e-lift">
            <g className="e-egg">
              <Egg x={EGG.x} y={EGG.y + 4} s={2.3} />
            </g>
            <g className="e-rhand">
              <Hand3D store={robot} x={EGG.x + 40} y={250} look="robot" arm={460} light={[0.8, -0.5]} />
            </g>
            <g className="e-slipflash" opacity={0} filter="url(#cn-bloom)">
              <ellipse cx={EGG.x} cy={EGG.y - 10} rx={120} ry={90} fill="none" stroke={C.magenta} strokeWidth={10} />
            </g>
          </g>
          <Label className="e-lab-feel" x={810} y={450} tx={1010} ty={380} text="fingertips that feel" sub="the same hand, now with touch skin" color={C.magentaLight} />
        </g>
        <g className="e-dust">
          <Dust x={100} y={60} w={1400} h={700} count={22} seed={8} />
        </g>
        <Vignette />
      </g>

      {/* the loop diagram, in screen space */}
      <g className="e-loop" opacity={0} pointerEvents="none">
        {NODES.map((n, i) => {
          // the first three arrows run round the circle; the last cuts back across it to hold
          const back = i === 3
          const a0 = n.a + 24
          const a1 = back ? 0 : NODES[i + 1].a - 26
          const end = (a1 * Math.PI) / 180
          const h = NODES[1]
          const u = 86 / Math.hypot(h.x - n.x, h.y - n.y)
          const ex = back ? h.x - (h.x - n.x) * u : LOOP.x + LOOP.r * Math.cos(end)
          const ey = back ? h.y - (h.y - n.y) * u : LOOP.y + LOOP.r * Math.sin(end)
          const rot = back ? (Math.atan2(h.y - n.y, h.x - n.x) * 180) / Math.PI : a1 + 90
          const d = back ? `M${(n.x + (h.x - n.x) * u).toFixed(1)} ${(n.y + (h.y - n.y) * u).toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}` : arc(a0, a1)
          return (
            <g key={n.id}>
              <path className={`e-a-${i}`} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset={1} fill="none" stroke={C.lime} strokeWidth={4} />
              <path className={`e-ah-${i}`} d="M-9 -10 L9 0 L-9 10 Z" fill={C.lime} opacity={0} transform={`translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${rot.toFixed(1)})`} />
            </g>
          )
        })}
        {NODES.map((n) => (
          <g key={n.id} className={`e-n-${n.id}`} opacity={0.25}>
            <circle cx={n.x} cy={n.y} r={68} fill={C.ink} stroke={n.id === 'slip' ? C.magentaLight : C.lime} strokeWidth={3} />
            <circle cx={n.x} cy={n.y} r={68} fill={n.id === 'slip' ? C.magenta : C.lime} opacity={0.14} />
            <text x={n.x} y={n.y + 9} textAnchor="middle" fill={n.id === 'slip' ? C.magentaLight : C.limeLight} fontFamily={SANS} fontSize={27} fontWeight={600}>
              {n.text}
            </text>
          </g>
        ))}
        <text className="e-never" x={LOOP.x} y={LOOP.y + LOOP.r + 110} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={28} fontStyle="italic" opacity={0}>
          never more than you need
        </text>
        {/* grip rides above slip */}
        <path d={`M${GR.x0} ${GR.y0 - GR.h} V${GR.y0} H${GR.x0 + GR.w}`} fill="none" stroke={C.fog} strokeWidth={1.5} opacity={0.6} />
        <path className="e-g-slip" d={curve(slipAt)} pathLength={1} strokeDasharray="1" strokeDashoffset={1} fill="none" stroke={C.mist} strokeWidth={2.5} opacity={0.8} />
        <path className="e-g-grip" d={curve(gripAt)} pathLength={1} strokeDasharray="1" strokeDashoffset={1} fill="none" stroke={C.amber} strokeWidth={4} />
        <text x={GR.x0 + GR.w + 8} y={GR.y0 - gripAt(1) * GR.h + 6} fill={C.amberLight} fontFamily={SANS} fontSize={20}>
          grip
        </text>
        <text x={GR.x0 + GR.w + 8} y={GR.y0 - slipAt(1) * GR.h + 14} fill={C.mist} fontFamily={SANS} fontSize={20}>
          slip line
        </text>
      </g>

      {/* ---------- b2: the play ---------- */}
      <g className="e-play" opacity={0} pointerEvents={active ? 'auto' : 'none'}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <g filter="url(#cn-dof-3)" opacity={0.6} pointerEvents="none">
          <rect x={-60} y={80} width={260} height={480} fill={C.ink3} />
          <circle cx={1490} cy={160} r={30} fill={C.rim} opacity={0.35} />
        </g>
        <g className="e-hum" opacity={0.95}>
          <Pool x={760} y={600} r={640} color="key" opacity={0.8} />
        </g>
        <rect x={-100} y={800} width={1800} height={300} fill={C.ink2} />
        <rect x={-100} y={800} width={1800} height={5} fill={C.keyDeep} opacity={0.6} />
        <g className="e-playin">
          {cueIndex >= 1 && cueIndex <= 3 && <GripPlay active={active} playing={playing} onWin={onWin} emit={emit} report={reportPlay} />}
        </g>
      </g>

      {/* ---------- b3: skin wears out ---------- */}
      <g className="e-wear" opacity={0} pointerEvents="none">
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <Pool x={480} y={640} r={560} color="key" opacity={0.7} />
        {/* the pan */}
        <ellipse cx={480} cy={790} rx={330} ry={60} fill={C.ink3} />
        <ellipse cx={480} cy={780} rx={300} ry={48} fill="#1d2027" />
        <rect x={790} y={772} width={280} height={22} rx={10} fill={C.ink3} />
        <g className="e-suds" opacity={0.6}>
          {[-120, -60, 10, 70, 140, -20, 100].map((dx, i) => (
            <circle key={i} cx={480 + dx} cy={772 + (i % 3) * 8} r={10 + (i % 3) * 5} fill={C.white} opacity={0.35} />
          ))}
        </g>
        <g className="e-scrub">
          <g transform="translate(480 300)">
            <rect x={-60} y={-400} width={120} height={420} fill={C.shellMid} />
            <g transform="rotate(-8)">
              <BigFinger len={470} w={130} padColor={C.magenta} />
            </g>
          </g>
          <g transform="translate(480 300) rotate(-8)">
            <g className="e-padglow" filter="url(#cn-bloom)">
              <ellipse cx={30} cy={440} rx={56} ry={30} fill={C.magenta} opacity={0.5} />
            </g>
            <g className="e-scuff-0" opacity={0}>
              <path d="M10 400 l30 10 M20 420 l26 6 M6 440 l34 4" stroke={C.ink} strokeWidth={3} opacity={0.7} />
            </g>
            <g className="e-scuff-1" opacity={0}>
              <path d="M30 392 l20 22 M40 430 l18 10 M14 452 l30 -4 M50 406 l8 18" stroke={C.ink} strokeWidth={3} opacity={0.75} />
              <circle cx={44} cy={418} r={4} fill={C.ink} opacity={0.7} />
            </g>
            <g className="e-scuff-2" opacity={0}>
              <path d="M24 398 l26 30 l-8 14 M8 426 l40 -6 M52 440 l6 16" stroke={C.ink} strokeWidth={3.5} opacity={0.85} />
            </g>
            <g className="e-tear" opacity={0}>
              <path d="M16 404 l14 10 l-6 12 l16 8 l-4 14 l14 10" fill="none" stroke={C.danger} strokeWidth={5} strokeLinejoin="round" />
              <path d="M18 406 l12 8 l-6 12 l14 8 l-4 12 l12 10 l-30 -6 Z" fill="#2a0b14" />
            </g>
          </g>
        </g>
        <Mono x={140} y={160} size={26} color={C.fog}>
          scrub cycles
        </Mono>
        <text className="e-count" x={140} y={232} fill={C.paper} fontFamily={MONO} fontSize={64} style={{ fontVariantNumeric: 'tabular-nums' }}>
          0
        </text>
        {/* sensitivity decays */}
        <rect className="e-band" x={WG.x0 + WG.w * 0.5} y={WG.y0 - WG.h} width={WG.w * 0.5} height={WG.h} fill={C.danger} fillOpacity={0.12} opacity={0} />
        <path d={`M${WG.x0} ${WG.y0 - WG.h - 10} V${WG.y0} H${WG.x0 + WG.w + 10}`} fill="none" stroke={C.fog} strokeWidth={1.5} />
        <path className="e-wearline" d={WEAR} pathLength={1} strokeDasharray="1" strokeDashoffset={1} fill="none" stroke={C.magenta} strokeWidth={5} filter="url(#cn-bloom)" />
        <text x={WG.x0} y={WG.y0 - WG.h - 24} fill={C.magentaLight} fontFamily={SANS} fontSize={24} fontWeight={600}>
          touch sensitivity
        </text>
        {[0, 2000, 4000].map((v, i) => (
          <text key={v} x={WG.x0 + (WG.w * i) / 2} y={WG.y0 + 32} textAnchor="middle" fill={C.fog} fontFamily={MONO} fontSize={18}>
            {v.toLocaleString('en-US')}
          </text>
        ))}
        <text x={WG.x0 + WG.w} y={WG.y0 + 62} textAnchor="end" fill={C.fog} fontFamily={SANS} fontSize={18}>
          cycles
        </text>
        <Label className="e-lab-orca" x={WG.x0 + WG.w * 0.75} y={WG.y0 - WG.h * 0.4} tx={WG.x0 + WG.w * 0.3} ty={WG.y0 + 130} text="ORCA hand: fingertip skin degraded after 2,000-4,000 cycles" sub="open-source hand, ETH Zurich, 2025" color={C.magentaLight} size={24} anchor="middle" />
        <Vignette />
      </g>

      {/* ---------- b4: wires, drift, a swapped skin ---------- */}
      <g className="e-wire" opacity={0} pointerEvents="none">
        <g ref={wireRef}>
          <g data-depth="0.3">
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          </g>
          <g data-depth="1">
            {/* 1. an x-ray finger: a wire bundle through the knuckle */}
            <Pool x={KN.x} y={KN.y} r={360} color="cyan" opacity={0.25} />
            <rect x={KN.x - 70} y={KN.y - 330} width={140} height={330} rx={56} fill={C.cyan} opacity={0.07} stroke={C.cyanLight} strokeOpacity={0.4} strokeWidth={2} />
            <rect x={KN.x - 18} y={KN.y - 320} width={36} height={300} rx={14} fill={C.bone} opacity={0.75} />
            {WIRES.map((dx) => (
              <path key={dx} d={`M${KN.x + dx * 0.9} ${KN.y - 330} V${KN.y}`} stroke={C.lime} strokeWidth={2.5} className={dx === 18 ? 'e-badwire' : undefined} />
            ))}
            <g className="e-distal">
              <rect x={KN.x - 62} y={KN.y} width={124} height={250} rx={52} fill={C.cyan} opacity={0.07} stroke={C.cyanLight} strokeOpacity={0.4} strokeWidth={2} />
              <rect x={KN.x - 16} y={KN.y + 20} width={32} height={200} rx={13} fill={C.bone} opacity={0.75} />
              {WIRES.map((dx) => (
                <path key={dx} className={dx === 18 ? 'e-badtail e-badwire' : undefined} d={`M${KN.x + dx * 0.9} ${KN.y} V${KN.y + 220}`} stroke={C.lime} strokeWidth={2.5} />
              ))}
              <path d={`M${KN.x - 40} ${KN.y + 230} Q${KN.x} ${KN.y + 250} ${KN.x + 40} ${KN.y + 230}`} fill="none" stroke={C.magenta} strokeWidth={6} />
            </g>
            <circle cx={KN.x} cy={KN.y} r={22} fill={C.ink} stroke={C.bone} strokeWidth={4} opacity={0.9} />
            <g className="e-spark" opacity={0}>
              <path d={`M${KN.x + 16} ${KN.y - 40} l8 -26 l6 22 l22 -12 l-14 22 l26 6 l-26 8 l14 20 l-22 -10 l-6 24 l-8 -24 l-22 12 l12 -22 l-24 -8 l24 -6 l-12 -22 Z`} fill={C.danger} filter="url(#cn-bloom)" />
            </g>
            <Mono x={KN.x - 300} y={KN.y - 200} size={22} color={C.fog}>
              bends:
            </Mono>
            <text className="e-wcount" x={KN.x - 210} y={KN.y - 200} fill={C.paper} fontFamily={MONO} fontSize={30} style={{ fontVariantNumeric: 'tabular-nums' }}>
              0
            </text>
            <Label className="e-lab-wire" x={KN.x + 22} y={KN.y - 30} tx={KN.x + 150} ty={KN.y + 190} text="sensor wires snap at the knuckle" sub="ORCA: after 4,500-7,000 cycles" color={C.danger} size={24} />

            {/* 2. drift */}
            <g transform="translate(660 320)">
              <rect x={-16} y={0} width={32} height={260} rx={16} fill={C.ink2} stroke={C.fog} strokeWidth={2} />
              <circle cx={0} cy={280} r={30} fill={C.key} />
              <rect className="e-merc" x={-8} y={20} width={16} height={262} rx={8} fill={C.key} />
            </g>
            <path d="M740 600 V300 M740 600 H1010" fill="none" stroke={C.fog} strokeWidth={1.5} />
            <path className="e-drift" d={DRIFT} pathLength={1} strokeDasharray="1" strokeDashoffset={1} fill="none" stroke={C.lime} strokeWidth={3.5} />
            <path d="M752 490 H1010" stroke={C.mist} strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
            <text x={760} y={634} fill={C.fog} fontFamily={SANS} fontSize={18}>
              the same press, again and again
            </text>
            <Label className="e-lab-drift" x={986} y={380} tx={930} ty={250} text="readings drift with heat and age" color={C.limeLight} size={24} anchor="middle" />

            {/* 3. a replaced skin reads differently */}
            {[0, 1].map((k) => (
              <g key={k} transform={`translate(${1170 + k * 250} 560)`}>
                <path d="M-80 0 V-90 A80 80 0 0 1 80 -90 V0 Z" fill="url(#cn-shell)" />
                <path d="M-80 -90 A80 80 0 0 1 80 -90" fill="none" stroke={C.magentaDark} strokeWidth={10} />
                <g className="e-press">
                  <rect x={-16} y={-260} width={32} height={60} rx={6} fill={C.metal} />
                  <path d="M0 -196 v18" stroke={C.amber} strokeWidth={5} markerEnd="url(#cn-arrow)" />
                </g>
                {/* the heatmap it reports */}
                <g className="e-heat" opacity={0} transform="translate(-75 30)">
                  {Array.from({ length: 36 }, (_, i) => {
                    const cx = i % 6
                    const cy = Math.floor(i / 6)
                    const d = Math.hypot(cx - (k ? 3.4 : 2.5), cy - (k ? 1.8 : 2.5))
                    const v = Math.max(0.06, (k ? 0.75 : 1) - d * (k ? 0.18 : 0.3))
                    return <rect key={i} x={cx * 25} y={cy * 25} width={23} height={23} fill={C.magenta} opacity={v} />
                  })}
                </g>
                <text x={0} y={220} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
                  {k ? 'new skin' : 'original skin'}
                </text>
                <text className={k ? 'e-verdict-b' : 'e-verdict-a'} x={0} y={-290} textAnchor="middle" fill={k ? C.danger : C.lime} fontFamily={SANS} fontSize={30} fontWeight={700} opacity={0}>
                  {k ? '?' : '✓'}
                </text>
              </g>
            ))}
            <text x={1295} y={226} textAnchor="middle" fill={C.limeLight} fontFamily={MONO} fontSize={20}>
              model trained on the original
            </text>
            <Label className="e-lab-swap" x={1420} y={650} tx={1295} ty={800} text="after a skin swap: 87% vs 57% of performance kept" sub="AnySkin vs ReSkin, 2024" color={C.magentaLight} size={22} anchor="middle" />
          </g>
        </g>
        <Vignette />
      </g>

      {/* ---------- b5: the data ---------- */}
      <g className="e-data" opacity={0} pointerEvents="none">
        <g ref={dataRef}>
          <g data-depth="0.3">
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
            <g className="e-branch" opacity={0.2}>
              <path d="M820 1000 C 800 700 860 520 800 260 M808 640 C 980 560 1120 500 1260 330 M816 480 C 640 420 520 300 420 170 M1060 520 C 1150 560 1260 560 1400 600 M600 360 C 520 380 400 440 300 450" fill="none" stroke={C.lime} strokeWidth={14} strokeLinecap="round" filter="url(#cn-bloom)" />
            </g>
          </g>
          <g data-depth="1">
            {Array.from({ length: TILE.rows }, (_, r) => (
              <g key={r} className="e-tilerow" opacity={0}>
                {Array.from({ length: TILE.cols }, (_, c) => {
                  const h = (r * 31 + c * 17) % 11
                  return <rect key={c} className={h === 0 ? 'e-flick-a' : h === 5 ? 'e-flick-b' : undefined} x={TILE.x0 + c * (TILE.w + TILE.gx)} y={TILE.y0 + r * (TILE.h + TILE.gy)} width={TILE.w} height={TILE.h} rx={3} fill={h % 3 ? C.rim : C.cyanDark} opacity={0.4 + (h / 11) * 0.45} />
                })}
              </g>
            ))}
            <Label className="e-lab-vision" x={TILE.x0 + 9 * 44} y={TILE.y0 + 13 * 32} tx={TILE.x0 + 9 * 44 + 40} ty={TILE.y0 + 15 * 32 + 80} text="vision: camera frames and joint angles" sub="the biggest corpora reach hundreds of thousands of hours" color={C.rim} size={26} anchor="middle" />
            <g className="e-shelf" opacity={0}>
              <Pool x={SHELF.x + 60} y={SHELF.y - 60} r={220} color="magenta" opacity={0.5} />
              <rect x={SHELF.x - 70} y={SHELF.y} width={260} height={12} rx={3} fill={C.ink3} />
              {[0, 1, 2, 3, 4].map((i) => (
                <rect key={i} className={i === 2 ? 'e-flick-a' : undefined} x={SHELF.x - 56 + i * 48} y={SHELF.y - 30} width={40} height={26} rx={3} fill={C.magenta} opacity={0.85} filter="url(#cn-bloom)" />
              ))}
              <Label className="e-lab-touch" x={SHELF.x + 60} y={SHELF.y + 14} tx={SHELF.x + 60} ty={SHELF.y + 64} text="touch" sub="NeoData, 30,000 h: a first try (preprint, 2026)" color={C.magentaLight} size={26} anchor="middle" />
            </g>
          </g>
        </g>
        <Vignette />
      </g>
    </g>
  )
}

export const ch4: Chapter = {
  id: 'egg',
  title: 'Hold the egg',
  cues: CUES,
  Scene: Ch4Egg,
  enter: { type: 'dissolve' },
  deeper: [SkinReading],
}
