import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, FiveMap, Label, Meter, Pool, Readout, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { MotorFace, MotorSide, MuscleStyle, RFinger, Shimmer, Smoke, TorqueArc, Weights, clamp, count, fingerRig } from './parts'
import { MotorPhysicsReading } from './readings'

export const CUES: Cue[] = [
  { id: 'back', say: 'Question two: muscle. Nearly every robot hand runs on electric motors. So let’s open one up.' },
  { id: 'how', say: 'Current flows through copper coils next to magnets, and the magnetic push turns the shaft. More current, more twist. Engineers call that twist torque.' },
  { id: 'scale', say: 'Here’s the catch. A motor’s torque grows with its size cubed. Make it half as wide and half as long, and it’s eight times weaker.' },
  { id: 'shrink', say: 'Your turn. Shrink the motor until it fits inside a finger, and watch what happens to its strength and its heat.', play: true },
  { id: 'heat', say: 'And holding a grip costs heat. The heat in a motor grows with the square of the torque it’s holding, so squeezing twice as hard makes four times the heat.' },
]

const STATE = [
  'The five-question map from film 1: five tilted coloured rings around an x-ray robot hand, inside a gold dotted wall. The bone-white ring (shape, last film) glows briefly, then the amber ring (question 2, muscle: actuation) flares. The camera dives into the amber ring and out of the dark comes a single small electric motor, which splits open into an exploded view: the housing lifts away, two magnets (labelled NdFeB, neodymium-iron-boron) separate above and below, the copper coil sits in the middle, the shaft slides out to the right, and the end cap with its wires slides left.',
  'A blueprint diagram grows out of the motor: a copper coil loop sits between a north magnet (top) and a south magnet (bottom). Cyan field lines run between the magnets. A current gauge on the left rises; amber dots of current flow around the loop, the field lines bend, and the loop turns about the shaft faster and faster. An amber torque arc around the end of the shaft gets thicker as the current rises. Formula on screen: torque = K_t × current. The point: torque (twist) is proportional to current.',
  'Two motors seen end-on, each with the same lever on its shaft lifting a stack of weights. The full-size motor lifts 8 weights; a motor half as wide and half as long lifts only 1. The equation "torque ∝ size³" writes itself, with "½ × ½ × ½ = ⅛". The reason: torque comes from magnetic shear stress acting over the rotor surface at the rotor radius, so it scales with rotor volume times radius.',
  '',
  'Close-up: two white robot fingers pinch a drinks can from both sides, with a small motor at each knuckle. First a normal squeeze (amber force arrows, heat bar at 1 of 4). Then the fingers squeeze twice as hard: the arrows double, the can dents slightly, the knuckle motors glow and heat shimmer rises, and the heat bar jumps to 4 of 4. Formula: heat = (torque / motor constant)². Doubling the torque you hold quadruples the copper heat, which is why holding a grip is expensive for a motor and why self-locking gears are attractive.',
]

/** The amber ring's marker on the five-question map (FiveMap at 800, 470). */
const DOT = { x: 798, y: 364 }
/** The play: the motor's home, the finger and the slot cut into it. */
const MOTOR_HOME = { x: 1080, y: 250 }
const FINGER = { x: 150, y: 250, s: 1.5 }
const SLOT = { x: 262, y: 250 }
const FIT = 0.35
/** Torque needed to hold a light grip, as a share of the full-size motor's torque. */
const NEED = 0.04

/** The pinch close-up in the heat cue. */
const PINCH_OPEN: [number, number, number] = [-2, 4, 4]
const PINCH_1: [number, number, number] = [15, 25, 25]
const PINCH_2: [number, number, number] = [17, 27, 27]

export function Ch1Motors({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const labRef = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 8, roll: 0, s: 1.35 }, xray: 1 })

  /* ---------------- the play: shrink the motor ---------------- */
  const [v, setV] = useState(1)
  const [done, setDone] = useState(false)
  const size = 0.2 + 0.8 * v
  const torque = size ** 3
  const heat = (NEED / torque) ** 2
  const fits = size <= FIT + 0.004
  const lifted = Math.min(8, Math.floor(torque * 8 + 0.001))
  const active = cueIndex === 3 && !done
  const lastEmit = useRef(0)

  useEffect(() => {
    if (!active) return
    if (Date.now() - lastEmit.current > 1500) {
      lastEmit.current = Date.now()
      emit({ type: 'progress', detail: `motor at ${Math.round(size * 100)}% size: torque ${Math.round(torque * 100)}%, ${fits ? 'fits in the finger' : 'too big for the finger'}` })
    }
    if (!fits) return
    const t = window.setTimeout(() => {
      setDone(true)
      memory.shrinkTorque = torque
      emit({ type: 'attempt', correct: true, detail: `shrank the motor to ${Math.round(size * 100)}%: it fits, with ${Math.round(torque * 100)}% of its torque` })
      void say('It fits, but it’s far too weak, and holding anything would cook it. Something has to multiply its force.')
      onPlayDone()
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fits, v])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(mapRef.current, { x: 800, y: 470, zoom: 1 })
      const cam2 = camera(labRef.current, { x: 800, y: 450, zoom: 1 })
      const pinch = fingerRig(el, 'c1p', PINCH_OPEN)

      /* b0: the map, the amber ring flares, dive into one motor, which splits open. */
      tl.addLabel('b0', 0)
      tl.set('.c1-lab', { opacity: 0 }, 0)
      tl.set('.c1-how, .c1-scale, .c1-play, .c1-heat', { opacity: 0 }, 0)
      cam.to(tl, { zoom: 1.08, y: 450 }, 0, 2.2, 'sine.inOut')
      hand.to(tl, { view: { yaw: -10 } }, 0, 3)
      fade(tl, '.m1-ring-shape', 0.75, 0.2, 0.5, 0.22)
      fade(tl, '.m1-ring-shape', 0.22, 0.9, 0.6, 0.75)
      fade(tl, '.m1-ring-muscle', 1, 0.9, 0.6, 0.22)
      fade(tl, '.m1-lab-muscle', 1, 0.9, 0.6, 0.35)
      tl.fromTo('.c1-flare', { scale: 0.2, opacity: 0, svgOrigin: `${DOT.x} ${DOT.y}` }, { scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out', immediateRender: false }, 1.0)
      cam.to(tl, { x: DOT.x, y: DOT.y, zoom: 5 }, 2.2, 1.3, 'power3.in')
      fade(tl, '.c1-map', 0, 3.0, 0.5, 1)
      fade(tl, '.c1-lab', 1, 3.0, 0.5, 0)
      tl.fromTo('.c1-motorwrap', { scale: 0.25, rotation: -18, svgOrigin: '800 500' }, { scale: 1, rotation: 0, duration: 1.4, ease: 'power3.out', immediateRender: false }, 3.0)
      cam2.to(tl, { zoom: 1.04 }, 3.0, 4.2, 'sine.inOut')
      const ex = 4.4
      tl.fromTo('.m1x-can', { y: 0 }, { y: -262, duration: 1, ease: 'power3.inOut', immediateRender: false }, ex)
      tl.fromTo('.m1x-magT', { y: 0 }, { y: -96, duration: 1, ease: 'power3.inOut', immediateRender: false }, ex + 0.15)
      tl.fromTo('.m1x-magB', { y: 0 }, { y: 96, duration: 1, ease: 'power3.inOut', immediateRender: false }, ex + 0.15)
      tl.fromTo('.m1x-cap', { x: 0 }, { x: -120, duration: 1, ease: 'power3.inOut', immediateRender: false }, ex + 0.25)
      tl.fromTo('.m1x-shaft', { x: 0 }, { x: 150, duration: 1, ease: 'power3.inOut', immediateRender: false }, ex + 0.3)
      fade(tl, '.c1-xl-coil', 1, ex + 1.1, 0.4)
      fade(tl, '.c1-xl-mag', 1, ex + 1.35, 0.4)
      fade(tl, '.c1-xl-shaft', 1, ex + 1.6, 0.4)
      fade(tl, '.c1-xl-can', 1, ex + 1.85, 0.4)

      /* b1: the diagram grows out of the coil. Current rises, the loop turns, torque thickens. */
      const b1 = 7.2
      tl.addLabel('b1', b1)
      fade(tl, '.c1-xl', 0, b1, 0.4, 1)
      fade(tl, '.c1-motorwrap', 0.12, b1, 0.8, 1)
      fade(tl, '.c1-how', 1, b1 + 0.2, 0.9)
      tl.fromTo('.c1-how-in', { scale: 0.85, svgOrigin: '800 450' }, { scale: 1, duration: 1.2, ease: 'power2.out', immediateRender: false }, b1 + 0.2)
      cam2.to(tl, { zoom: 1.0, x: 800, y: 450 }, b1, 1)
      fade(tl, '.c1-how-lab-field', 1, b1 + 1.0, 0.5)
      // current rises in two steps; the loop turns faster each time
      tl.fromTo('.c1-knob', { y: 0 }, { y: -110, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, b1 + 1.4)
      tl.fromTo('.c1-knob', { y: -110 }, { y: -250, duration: 1.4, ease: 'power2.inOut', immediateRender: false }, b1 + 5.0)
      fade(tl, '.c1-current', 0.55, b1 + 1.4, 0.6)
      tl.to('.c1-current', { opacity: 1, duration: 0.6 }, b1 + 5.0)
      fade(tl, '.c1-how-lab-current', 1, b1 + 1.8, 0.5)
      fade(tl, '.c1-bent', 1, b1 + 1.6, 1.2)
      fade(tl, '.c1-straight', 0.25, b1 + 1.6, 1.2, 1)
      tl.fromTo('.c1-loop', { scaleY: 1 }, { scaleY: -1, duration: 0.7, repeat: 4, yoyo: true, ease: 'sine.inOut', svgOrigin: '800 450', immediateRender: false }, b1 + 1.6)
      tl.fromTo('.c1-loop', { scaleY: -1 }, { scaleY: 1, duration: 0.32, repeat: 13, yoyo: true, ease: 'sine.inOut', svgOrigin: '800 450', immediateRender: false }, b1 + 5.1)
      tl.fromTo('.c1-tq', { strokeWidth: 3, opacity: 0 }, { strokeWidth: 9, opacity: 1, duration: 1.2, immediateRender: false }, b1 + 1.6)
      tl.fromTo('.c1-tq', { strokeWidth: 9 }, { strokeWidth: 24, duration: 1.4, immediateRender: false }, b1 + 5.0)
      fade(tl, '.c1-how-lab-torque', 1, b1 + 6.2, 0.5)
      fade(tl, '.c1-how-eq', 1, b1 + 7.0, 0.6)

      /* b2: torque grows with size cubed: eight weights versus one. */
      const b2 = 17
      tl.addLabel('b2', b2)
      fade(tl, '.c1-how', 0, b2, 0.6, 1)
      fade(tl, '.c1-motorwrap', 0, b2, 0.5, 0.12)
      fade(tl, '.c1-scale', 1, b2 + 0.4, 0.8)
      cam2.to(tl, { zoom: 1.05, x: 820, y: 460 }, b2, 9, 'sine.inOut')
      fade(tl, '.c1-sc-lab-a', 1, b2 + 1.2, 0.5)
      fade(tl, '.c1-sc-lab-b', 1, b2 + 1.6, 0.5)
      // both levers try to lift; the big one lifts eight, the small one only one
      const lift = (i: number, at: number) => {
        tl.fromTo(`.c1-lever-${i}`, { rotation: 0 }, { rotation: -42, duration: 1.6, ease: 'power2.inOut', svgOrigin: i === 0 ? '470 380' : '1150 420', immediateRender: false }, at)
        tl.fromTo(`.c1-wts-${i}`, { x: 0, y: 0 }, { x: 25, y: -156, duration: 1.6, ease: 'power2.inOut', immediateRender: false }, at)
      }
      lift(0, b2 + 2.2)
      lift(1, b2 + 2.2)
      fade(tl, '.c1-sc-n-0', 1, b2 + 3.8, 0.4)
      fade(tl, '.c1-sc-n-1', 1, b2 + 3.8, 0.4)
      tl.fromTo('.c1-eqclip', { attr: { width: 0 } }, { attr: { width: 900 }, duration: 1.6, ease: 'steps(16)', immediateRender: false }, b2 + 5.0)
      fade(tl, '.c1-eq2', 1, b2 + 6.6, 0.6)

      /* b3: the play. The finger and its slot, a full-size motor beside it. */
      const b3 = 27.6
      tl.addLabel('b3', b3)
      fade(tl, '.c1-scale', 0, b3, 0.6, 1)
      fade(tl, '.c1-play', 1, b3 + 0.4, 0.8)
      cam2.to(tl, { zoom: 1, x: 800, y: 450 }, b3, 1.2)
      tl.to({}, { duration: 0.1 }, b3 + 2.6)

      /* b4: holding a grip costs heat. Twice the squeeze, four times the heat. */
      const b4 = b3 + 2.8
      tl.addLabel('b4', b4)
      fade(tl, '.c1-play', 0, b4, 0.6, 1)
      fade(tl, '.c1-heat', 1, b4 + 0.3, 0.8)
      cam2.to(tl, { zoom: 1.12, x: 800, y: 470 }, b4, 11, 'sine.inOut')
      pinch.to(tl, PINCH_1, b4 + 1.2, 1.0, 'power2.out')
      fade(tl, '.c1-f1', 1, b4 + 2.0, 0.4)
      tl.fromTo('.c1-hseg-0', { opacity: 0.15 }, { opacity: 1, duration: 0.3, immediateRender: false }, b4 + 2.2)
      fade(tl, '.c1-hl-1', 1, b4 + 2.4, 0.5)
      fade(tl, '.c1-sh1', 0.5, b4 + 2.2, 0.8)
      // twice as hard
      const sq = b4 + 5.2
      pinch.to(tl, PINCH_2, sq, 0.5, 'power3.in')
      tl.fromTo('.c1-canbody', { scaleX: 1 }, { scaleX: 0.95, duration: 0.5, ease: 'power3.in', svgOrigin: '800 560', immediateRender: false }, sq)
      fade(tl, '.c1-f1', 0, sq, 0.3, 1)
      fade(tl, '.c1-f2', 1, sq + 0.2, 0.4)
      tl.fromTo('.c1-hseg-1, .c1-hseg-2, .c1-hseg-3', { opacity: 0.15 }, { opacity: 1, duration: 0.25, stagger: 0.25, immediateRender: false }, sq + 0.5)
      fade(tl, '.c1-hl-1', 0, sq + 0.3, 0.3, 1)
      fade(tl, '.c1-hl-2', 1, sq + 0.6, 0.5)
      fade(tl, '.c1-sh2', 1, sq + 0.4, 0.8)
      fade(tl, '.c1-kglow', 1, sq + 0.4, 1.0)
      fade(tl, '.c1-heat-eq', 1, sq + 1.6, 0.6)
      count(tl, el, '.c1-heat-x', 1, 4, sq + 0.5, 1, (n) => `heat ×${Math.round(n)}`)
      tl.to({}, { duration: 0.1 }, b4 + 11.4)
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c1-breathe', { opacity: 0.55, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-hum', { y: -6, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        `The learner's turn. A big white robot finger (side view) at the top left has a dashed slot cut into its first segment, the space a motor would have to fit in. A full-size electric motor sits to the right. A "motor size" slider runs along the bottom (100% at the right, 20% at the left). Live readouts: a torque meter (torque ∝ size³), a lever on the motor lifting up to 8 weights, a "heat to hold a light grip" meter (heat ∝ (torque needed / torque available)²), and a "fits in the finger" lamp that lights at 35% or smaller. ` +
          `Right now the motor is at ${Math.round(size * 100)}% size, torque ${Math.round(torque * 100)}% of full size, lifting ${lifted} of 8 weights, heat ${heat > 1 ? 'over the limit (overheating)' : `${Math.round(heat * 100)}% of the limit`}, ${fits ? 'and it FITS in the finger' : 'and it does not fit in the finger yet'}. ${done ? 'The learner has finished: the motor fits but is far too weak and would cook.' : ''} ` +
          'To finish: drag the size down to 35% or less. The lesson: at 35% size the torque is only about 4% of the original (0.35³ ≈ 0.043), so a finger-sized motor is hopelessly weak, and holding even a light grip would overheat it. Likely mix-ups: expecting torque to fall in proportion to size (35%), not with the cube; thinking the heat goes down because the motor is smaller.',
      )
      setHints(['Drag the size down until the motor fits in the finger slot.', 'Watch the torque bar: it falls much faster than the size.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, size, torque, heat, fits, lifted, done, reportState, setHints])

  const glow = clamp((heat - 0.25) / 0.75)
  const motorAt = fits ? SLOT : MOTOR_HOME

  return (
    <g ref={root}>
      <MuscleStyle />
      {/* ---------- the five-question map ---------- */}
      <g className="c1-map" ref={mapRef}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <Pool x={800} y={470} r={700} color="rim" opacity={0.25} />
          <Dust x={-200} y={-100} w={2000} h={1100} count={36} seed={31} color={C.rim} size={0.7} />
        </g>
        <g data-depth="1">
          <Pool x={800} y={470} r={360} color="key" opacity={0.35} />
          <FiveMap cx={800} cy={470} prefix="m1" />
          <Hand3D store={hand} x={800} y={640} look="xray" arm={110} />
          <g className="c1-flare" opacity={0}>
            <circle cx={DOT.x} cy={DOT.y} r={90} fill="url(#cn-pool-amber)" />
            <circle cx={DOT.x} cy={DOT.y} r={16} fill={C.amberLight} filter="url(#cn-bloom)" />
          </g>
        </g>
      </g>

      {/* ---------- the motor lab: dark space, one motor ---------- */}
      <g className="c1-lab" ref={labRef} opacity={0}>
        <g data-depth="0.3">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <g className="c1-breathe" opacity={0.35}>
            <Pool x={800} y={420} r={720} color="amber" opacity={0.45} />
          </g>
          <g filter="url(#cn-dof-3)" opacity={0.55}>
            <circle cx={180} cy={180} r={40} fill={C.key} opacity={0.3} />
            <circle cx={1430} cy={260} r={56} fill={C.rim} opacity={0.25} />
            <circle cx={1300} cy={760} r={30} fill={C.key} opacity={0.3} />
            <circle cx={260} cy={760} r={46} fill={C.rim} opacity={0.2} />
          </g>
        </g>
        <g data-depth="1">
          {/* the exploded motor */}
          <g className="c1-motorwrap">
            <g className="c1-hum">
              <MotorSide x={800} y={500} s={1.3} cls="m1x" />
            </g>
          </g>
          <g className="c1-xl">
            <Label className="c1-xl-coil" x={740} y={520} tx={560} ty={640} text="copper coil" color={C.amberLight} />
            <Label className="c1-xl-mag" x={930} y={296} tx={1110} ty={300} text="magnets" sub="NdFeB: neodymium, iron, boron" color={C.mist} />
            <Label className="c1-xl-shaft" x={1250} y={500} tx={1290} ty={590} text="shaft" color={C.paper} />
            <Label className="c1-xl-can" x={640} y={130} tx={500} ty={110} text="housing" color={C.mist} />
          </g>

          {/* how it works: a coil loop between two magnets */}
          <g className="c1-how">
            <Blueprint opacity={0.92} />
            <g className="c1-how-in">
              <rect x={520} y={150} width={560} height={64} rx={8} fill={C.slate} />
              <text x={800} y={194} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={30} fontWeight={700}>N</text>
              <rect x={520} y={686} width={560} height={64} rx={8} fill={C.ink4} />
              <text x={800} y={730} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={30} fontWeight={700}>S</text>
              {/* field lines, straight then bent around the loop */}
              <g className="c1-straight" stroke={C.cyan} strokeWidth={2} fill="none" opacity={0.8}>
                {[570, 640, 710, 780, 850, 920, 990].map((x) => (
                  <path key={x} className="mu-flow-slow" d={`M${x} 216 L${x} 684`} strokeDasharray="12 12" />
                ))}
              </g>
              <g className="c1-bent" stroke={C.cyan} strokeWidth={2.2} fill="none" opacity={0}>
                {[570, 640, 710, 780, 850, 920, 990].map((x, i) => (
                  <path key={x} className="mu-flow-slow" d={`M${x} 216 C ${x + (i - 3) * 22 + 40} 380 ${x + (i - 3) * 22 - 40} 520 ${x} 684`} strokeDasharray="12 12" />
                ))}
              </g>
              {/* the shaft and the loop that turns about it */}
              <rect x={470} y={443} width={860} height={14} rx={6} fill="url(#cn-metal)" />
              <g className="c1-loop">
                <rect x={590} y={360} width={420} height={180} rx={10} fill="none" stroke="url(#cn-copper)" strokeWidth={16} />
                <rect x={590} y={360} width={420} height={180} rx={10} fill="none" stroke="#ffd2a1" strokeWidth={3} opacity={0.6} />
                <rect className="c1-current mu-flow" x={590} y={360} width={420} height={180} rx={10} fill="none" stroke={C.amberLight} strokeWidth={9} strokeLinecap="round" strokeDasharray="0 24" opacity={0} filter="url(#cn-bloom)" />
              </g>
              {/* torque around the shaft's end */}
              <ellipse cx={1290} cy={450} rx={10} ry={20} fill={C.metal} />
              <path className="c1-tq" d="M1290 360 A 44 90 0 1 1 1250 520" fill="none" stroke={C.amber} strokeWidth={3} strokeLinecap="round" opacity={0} markerEnd="url(#cn-arrow)" />
              {/* the current gauge */}
              <g>
                <rect x={236} y={330} width={14} height={300} rx={7} fill={C.ink3} />
                <g className="c1-knob">
                  <rect x={236} y={614} width={14} height={16} rx={7} fill={C.amber} />
                  <circle cx={243} cy={622} r={18} fill={C.ink1} stroke={C.amber} strokeWidth={4} />
                  <circle cx={243} cy={622} r={6} fill={C.amber} />
                </g>
                <text x={243} y={300} textAnchor="middle" fill={C.amberLight} fontFamily={SANS} fontSize={24} fontWeight={500}>current</text>
              </g>
              <Label className="c1-how-lab-field" x={990} y={300} tx={1130} ty={250} text="magnetic field" color={C.cyan} />
              <Label className="c1-how-lab-current" x={600} y={540} tx={420} ty={600} text="current in the coil" color={C.amberLight} />
              <Label className="c1-how-lab-torque" x={1330} y={380} tx={1380} ty={300} text="torque" sub="the twist on the shaft" color={C.amber} />
              <text className="c1-how-eq" x={800} y={830} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={36} opacity={0}>
                torque = K_t × current
              </text>
            </g>
          </g>

          {/* size cubed: eight weights versus one */}
          <g className="c1-scale">
            <rect x={-800} y={760} width={3200} height={900} fill={C.ink} opacity={0.6} />
            <MotorWithLever i={0} x={470} y={380} r={120} depth={200} />
            <MotorWithLever i={1} x={1150} y={420} r={60} depth={100} />
            <Label className="c1-sc-lab-a" x={470} y={250} tx={330} ty={150} text="full size" color={C.paper} />
            <Label className="c1-sc-lab-b" x={1150} y={350} tx={1050} ty={230} text="half as wide, half as long" color={C.paper} />
            <text className="c1-sc-n-0" x={740} y={420} fill={C.amber} fontFamily={SANS} fontSize={30} fontWeight={600} opacity={0}>lifts 8</text>
            <text className="c1-sc-n-1" x={1400} y={300} fill={C.amber} fontFamily={SANS} fontSize={30} fontWeight={600} opacity={0}>lifts 1</text>
            <clipPath id="c1-eqclip-p">
              <rect className="c1-eqclip" x={350} y={760} width={0} height={80} />
            </clipPath>
            <text x={800} y={815} textAnchor="middle" fill={C.amber} fontFamily={MONO} fontSize={52} clipPath="url(#c1-eqclip-p)">
              torque ∝ size³
            </text>
            <text className="c1-eq2" x={800} y={868} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={28} opacity={0}>
              ½ × ½ × ½ = ⅛
            </text>
          </g>

          {/* the play: shrink the motor until it fits in a finger */}
          <g className="c1-play">
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} opacity={0.7} />
            <Pool x={360} y={250} r={420} color="key" opacity={0.35} />
            <Pool x={motorAt.x} y={motorAt.y} r={fits ? 260 : 380} color={glow > 0.3 ? 'danger' : 'amber'} opacity={0.25 + glow * 0.4} />
            <RFinger x={FINGER.x} y={FINGER.y} s={FINGER.s} lens={[150, 105, 85]} xray={0.35} />
            <rect x={SLOT.x - 56} y={SLOT.y - 30} width={112} height={60} rx={8} fill={C.ink} opacity={0.7} stroke={fits ? C.lime : C.cyan} strokeWidth={2.5} strokeDasharray="7 6" />
            <Label x={SLOT.x} y={SLOT.y + 34} tx={SLOT.x + 30} ty={SLOT.y + 120} text="finger-width slot" color={C.cyan} hidden={false} size={22} />
            <g style={{ transform: `translate(${motorAt.x}px, ${motorAt.y}px) scale(${size})`, transition: 'transform 0.35s ease-out' }}>
              <MotorSide cls="m1p" glow={glow} />
            </g>
            {heat > 0.6 && <Smoke x={motorAt.x - 20} y={motorAt.y - 60 * size} n={5} />}
            {heat > 0.3 && <Shimmer x={motorAt.x} y={motorAt.y - 90 * size} n={3} spread={30} color={C.danger} />}

            {/* the lever test: the shrinking motor tries to lift weights */}
            <g>
              <rect x={150} y={700} width={640} height={6} fill={C.ink4} />
              <MotorFace x={330} y={540} r={70 * size + 6} glow={glow} />
              <g className={lifted > 0 ? undefined : 'mu-strain'}>
                <g transform={`rotate(${lifted > 0 ? -16 : 24} 330 540)`}>
                  <rect x={330} y={532} width={220} height={16} rx={8} fill={C.metal} />
                  <circle cx={545} cy={540} r={8} fill={C.metalDark} />
                </g>
                <g transform={`translate(${lifted > 0 ? 537 : 526} ${lifted > 0 ? 481 : 627})`}>
                  <Weights n={Math.max(1, lifted)} w={50} h={14} lit={lifted} color={lifted > 0 ? C.amberDark : C.slate} />
                </g>
              </g>
              {Array.from({ length: 8 - Math.max(1, lifted) }, (_, i) => (
                <rect key={i} x={600 + (i % 4) * 46} y={684 - Math.floor(i / 4) * 17} width={40} height={14} rx={3} fill={C.slate} opacity={0.6} />
              ))}
              <text x={150} y={745} fill={C.fog} fontFamily={SANS} fontSize={22}>
                lifts <tspan fill={C.amber} fontFamily={MONO}>{lifted}</tspan> of 8 weights
              </text>
            </g>
            <Meter x={900} y={520} w={540} value={torque} color={C.amber} label="torque (∝ size³)" valueText={`${(torque * 100).toFixed(torque < 0.1 ? 1 : 0)}%`} />
            <Meter x={900} y={610} w={540} value={Math.min(1, heat)} color={heat > 0.6 ? C.danger : C.amber} label="heat to hold a light grip" valueText={heat > 1 ? 'overheats' : `${Math.round(heat * 100)}% of limit`} mark={0.6} />
            <g>
              <circle cx={918} cy={688} r={14} fill={fits ? C.lime : C.ink3} stroke={fits ? C.limeLight : C.fog} strokeWidth={2} filter={fits ? 'url(#cn-bloom)' : undefined} />
              <text x={946} y={697} fill={fits ? C.lime : C.fog} fontFamily={SANS} fontSize={24} fontWeight={500}>
                fits in the finger
              </text>
            </g>
            <Slider
              x={330}
              y={838}
              w={940}
              value={v}
              onChange={(nv) => !done && cueIndex === 3 && setV(nv)}
              color={C.amber}
              label="motor size"
              valueText={`${Math.round(size * 100)}%`}
              tutor="motor-size"
              disabled={cueIndex !== 3}
              ticks={[
                { at: 0, text: '20%' },
                { at: (FIT - 0.2) / 0.8, text: '35%' },
                { at: 0.375, text: '50%' },
                { at: 1, text: '100%' },
              ]}
            />
            {done && (
              <Readout x={770} y={262} color={C.danger} size={26}>
                {`${(torque * 100).toFixed(1)}% torque · overheats`}
              </Readout>
            )}
          </g>

          {/* holding costs heat: a pinch on a can */}
          <g className="c1-heat" pointerEvents="none">
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
            <Pool x={800} y={420} r={640} color="key" opacity={0.55} />
            <rect x={-800} y={720} width={3200} height={600} fill={C.ink2} />
            <rect x={-800} y={720} width={3200} height={4} fill={C.keyDeep} opacity={0.6} />
            <ellipse cx={800} cy={724} rx={170} ry={16} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
            <g className="c1-canbody">
              <rect x={680} y={400} width={240} height={322} rx={18} fill="#8a2a2a" />
              <rect x={680} y={480} width={240} height={150} fill="#b23a33" />
              <rect x={700} y={400} width={36} height={322} fill={C.white} opacity={0.14} />
              <rect x={860} y={400} width={46} height={322} fill="#000" opacity={0.22} />
              <ellipse cx={800} cy={402} rx={120} ry={16} fill={C.metal} />
              <ellipse cx={800} cy={402} rx={96} ry={11} fill={C.metalDark} />
            </g>
            <PinchFinger />
            <g transform="translate(1600 0) scale(-1 1)">
              <PinchFinger />
            </g>
            <g className="c1-sh1" opacity={0}>
              <Shimmer x={300} y={330} n={3} spread={30} />
              <Shimmer x={1300} y={330} n={3} spread={30} />
            </g>
            <g className="c1-sh2" opacity={0}>
              <Shimmer x={300} y={320} n={6} spread={60} color={C.danger} />
              <Shimmer x={1300} y={320} n={6} spread={60} color={C.danger} />
            </g>
            <g className="c1-f1" opacity={0}>
              <line x1={600} y1={560} x2={660} y2={560} stroke={C.amber} strokeWidth={6} markerEnd="url(#cn-arrow)" />
              <line x1={1000} y1={560} x2={940} y2={560} stroke={C.amber} strokeWidth={6} markerEnd="url(#cn-arrow)" />
            </g>
            <g className="c1-f2" opacity={0}>
              <line x1={540} y1={560} x2={662} y2={560} stroke={C.amber} strokeWidth={11} markerEnd="url(#cn-arrow)" />
              <line x1={1060} y1={560} x2={938} y2={560} stroke={C.amber} strokeWidth={11} markerEnd="url(#cn-arrow)" />
            </g>
            <Label className="c1-hl-1" x={630} y={562} tx={540} ty={660} text="squeeze ×1" color={C.amber} anchor="end" />
            <Label className="c1-hl-2" x={600} y={562} tx={540} ty={660} text="squeeze ×2" color={C.amber} anchor="end" />
            {/* the heat bar */}
            <g transform="translate(560 800)">
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} className={`c1-hseg-${i}`} x={i * 122} y={0} width={114} height={22} rx={6} fill={i < 1 ? C.amber : C.danger} opacity={0.15} />
              ))}
              <text className="c1-heat-x" x={500} y={19} fill={C.danger} fontFamily={MONO} fontSize={26}>
                heat ×1
              </text>
              <text x={-16} y={19} textAnchor="end" fill={C.fog} fontFamily={SANS} fontSize={22}>
                heat in the motors
              </text>
            </g>
            <text className="c1-heat-eq" x={800} y={120} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={36} opacity={0}>
              heat = (torque / motor constant)²
            </text>
          </g>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** One finger of the pinch, base at the left, with its knuckle motor. Curled by fingerRig('c1p'). */
function PinchFinger() {
  return (
    <g>
      {/* the mount and the knuckle motor */}
      <rect x={140} y={340} width={170} height={84} rx={14} fill={C.carbon} />
      <g transform="translate(240 380)">
        <rect x={-60} y={-30} width={120} height={60} rx={14} fill="url(#cn-metal)" />
        <rect className="c1-kglow" x={-60} y={-30} width={120} height={60} rx={14} fill={C.danger} opacity={0} filter="url(#cn-bloom)" />
      </g>
      <RFinger x={300} y={380} rot={-10} s={1.2} cls="c1p" angles={PINCH_OPEN} />
    </g>
  )
}

/** A motor seen end-on with its body behind it, and a lever on its shaft lifting a stack of weights. */
function MotorWithLever({ i, x, y, r, depth }: { i: number; x: number; y: number; r: number; depth: number }) {
  const dx = -depth * 0.55
  const dy = -depth * 0.4
  const len = Math.hypot(dx, dy)
  const nx = (-dy / len) * r
  const ny = (dx / len) * r
  // the lever starts drooping (30°) and lifts by 42°
  const L = 220
  const a0 = 30 * (Math.PI / 180)
  const tip = { x: x + Math.cos(a0) * L, y: y + Math.sin(a0) * L }
  return (
    <g>
      <path d={`M${x + nx} ${y + ny} L${x + dx + nx} ${y + dy + ny} L${x + dx - nx} ${y + dy - ny} L${x - nx} ${y - ny} Z`} fill={C.metalDark} />
      <circle cx={x + dx} cy={y + dy} r={r} fill={C.ink4} />
      <MotorFace x={x} y={y} r={r} />
      <g className={`c1-wts-${i}`}>
        <g transform={`translate(${tip.x} ${tip.y})`}>
          <Weights n={i === 0 ? 8 : 1} w={70} h={20} color={C.amberDark} />
        </g>
      </g>
      <g className={`c1-lever-${i}`}>
        <g transform={`rotate(30 ${x} ${y})`}>
          <rect x={x} y={y - 9} width={L + 8} height={18} rx={9} fill="url(#cn-metal)" />
          <circle cx={x + L} cy={y} r={9} fill={C.metalDark} />
        </g>
      </g>
      <circle cx={x} cy={y} r={r * 0.24} fill={C.metalDark} />
      <TorqueArc cx={x} cy={y} r={r + 26} start={60} sweep={-110} width={i === 0 ? 14 : 4} />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'motors',
  title: 'Why small motors are weak',
  cues: CUES,
  Scene: Ch1Motors,
  deeper: [MotorPhysicsReading],
}
