import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Big, Blueprint, Dust, Egg, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { DimRoom, JointGhost, Mono, draw, ticker } from './parts'
import { ProprioReading } from './readings'
import './touch.css'

export const CUES: Cue[] = [
  { id: 'inner', say: 'Before touch comes a quieter sense: knowing where your own fingers are and how hard they’re pushing. It’s called proprioception.' },
  { id: 'encoders', say: 'Robots get it from sensors at each joint: tiny magnets and Hall sensors, or encoders on the motors, reading angles a thousand times a second.' },
  { id: 'current', say: 'And remember the motors? A motor’s current tells you its torque. With a gentle gear ratio, that’s a decent force sensor for free. With a steep ratio, friction drowns the signal.' },
  { id: 'blind', say: 'But proprioception only tells you about yourself. To know about the object, where it touches, whether it’s slipping, how soft it is, you need skin.' },
]

const STATE = [
  'Darkness. A human hand, lit from one side, slowly flexes and spreads its fingers. Ghostly dashed lines trace each finger’s bones and small magenta circles sit on each joint, with live angle readouts on the index finger (e.g. 14.0°, 18.0°). Then a white robot hand appears beside it with the same ghost lines and readouts. The word "proprioception" appears: the sense of where your own fingers are and how hard they push.',
  'An x-ray blueprint close-up of a robot finger joint. A small magnet in the moving finger segment turns past a Hall-effect chip on the other segment as the joint bends back and forth; magnetic field lines swing with it. A mono readout ticks the joint angle many times a second ("1,000 readings a second", "Shadow Hand: 0.2° at 1 kHz"). On the left, a motor with a striped encoder disc spins under an optical sensor: "encoder on the motor".',
  'A callback to film 3 (muscle). Two robot fingers side by side, each driven by an amber motor through cyan gears: left a gentle 5:1 ratio, right a steep 100:1 ratio. A human finger presses on each robot fingertip at the same moment. Under each, the motor current trace (amber): the 5:1 trace shows a clean bump when pressed; the 100:1 trace is buried in a fuzzy noise band (label "friction swamps it"). Formula: torque ≈ N × Kt × current − friction. The point: with low gear ratios (backdrivable), motor current is a free force sensor; with high ratios, gear friction hides the signal.',
  'A robot hand points one finger down at an egg on a dark bench. Ghost lines and joint-angle readouts show on the finger. As the fingertip touches the egg, the angle numbers barely change (about 0.1°), and a magenta question mark pulses at the contact point. Labels list what the joints cannot tell: where it touches, whether it is slipping, how soft it is. Finally the fingertip glows magenta: that is what skin (touch sensing) adds.',
]

/** The knuckle close-up: the joint centre, and the motor on the left. */
const K = { x: 860, y: 470 }
const MOTOR = { x: 300, y: 470 }
/** The two current-sensing setups. */
const UNITS = [
  { cx: 420, ratio: '5:1', small: 26, big: 40, clean: true },
  { cx: 1180, ratio: '100:1', small: 14, big: 70, clean: false },
] as const
const FY = 300
const TRACE = { y0: 720, h: 150, w: 520 }
const EGG = { x: 980, y: 700 }

/** A gear: a toothed ring of radius r. */
function Gear({ r, teeth, color = C.cyan }: { r: number; teeth: number; color?: string }) {
  const pts: string[] = []
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 ? r : r + Math.max(3, r * 0.14)
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`)
  }
  return (
    <g>
      <polygon points={pts.join(' ')} fill={C.ink2} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      <circle r={r * 0.3} fill="none" stroke={color} strokeWidth={2} />
      <path d={`M${-r * 0.7} 0 H${r * 0.7} M0 ${-r * 0.7} V${r * 0.7}`} stroke={color} strokeWidth={1.4} opacity={0.5} />
    </g>
  )
}

/** A noisy trace: a band of jagged lines (deterministic). */
function noise(x0: number, y: number, w: number, amp: number, seed: number) {
  let s = seed
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const pts: string[] = []
  for (let x = 0; x <= w; x += 6) pts.push(`${x0 + x},${(y + (r() - 0.5) * 2 * amp).toFixed(1)}`)
  return pts.join(' ')
}

export function Ch2Proprio({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const darkRef = useRef<SVGGElement>(null)
  const human = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -28, pitch: 8, roll: -6, s: 2.3 } })
  const robot = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 28, pitch: 8, roll: 6, s: 2.3 } })
  const pointer = useHandStore({ pose: { ...GRASPS.point, index: [2, 6, 4, 2] }, view: { yaw: 82, pitch: -6, roll: 180, s: 2.2 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(darkRef.current, { x: 800, y: 450, zoom: 1.05 })
      const angle = el?.querySelector('.p-angle')
      const samples = el?.querySelector('.p-samples')

      /* b0: a hand in darkness; the ghost of its joints; then the robot's. */
      tl.addLabel('b0', 0)
      tl.set('.p-knuckle, .p-current, .p-blind', { opacity: 0 }, 0)
      tl.set('.p-dark', { opacity: 1 }, 0)
      cam.to(tl, { x: 800, y: 470, zoom: 1.0 }, 0, 10, 'sine.inOut')
      fade(tl, '.p-human', 1, 0, 1.6)
      human.to(tl, { pose: GRASPS.spread }, 0.6, 1.8, 'sine.inOut')
      human.to(tl, { pose: { ...GRASPS.relaxed, index: [40, 50, 26, 2], middle: [30, 40, 20, 0] } }, 2.6, 1.8, 'sine.inOut')
      human.to(tl, { pose: GRASPS.tripod }, 4.6, 1.8, 'sine.inOut')
      human.to(tl, { pose: GRASPS.relaxed }, 6.8, 2, 'sine.inOut')
      fade(tl, '.p-ghost-h', 1, 1.6, 1.2)
      fade(tl, '.p-robot', 1, 4.6, 1.4)
      tl.fromTo('.p-robot', { x: 80 }, { x: 0, duration: 2, ease: 'power2.out', immediateRender: false }, 4.6)
      robot.to(tl, { pose: { ...GRASPS.relaxed, index: [40, 50, 26, 2], middle: [30, 40, 20, 0] } }, 5.2, 1.6, 'sine.inOut')
      robot.to(tl, { pose: GRASPS.spread }, 7.0, 1.8, 'sine.inOut')
      fade(tl, '.p-ghost-r', 1, 5.6, 1)
      fade(tl, '.p-title', 1, 6.6, 1.2)

      /* b1: the knuckle in x-ray. A magnet turns past a Hall chip; an encoder spins. */
      const b1 = 10.4
      tl.addLabel('b1', b1)
      fade(tl, '.p-dark', 0, b1, 0.6, 1)
      fade(tl, '.p-knuckle', 1, b1, 0.6)
      tl.fromTo('.p-kzoom', { scale: 1.25 }, { scale: 1, duration: 3, ease: 'power2.out', svgOrigin: `${K.x} ${K.y}`, immediateRender: false }, b1)
      draw(tl, '.p-outline', b1 + 0.2, 1.4)
      const bend = { a: 10 }
      const dist = el?.querySelector('.p-distal')
      const apply = () => {
        dist?.setAttribute('transform', `rotate(${bend.a.toFixed(2)} ${K.x} ${K.y})`)
        if (angle) angle.textContent = `θ = ${bend.a.toFixed(1)}°`
      }
      tl.fromTo(bend, { a: 10 }, { a: 62, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: 5, immediateRender: false, onUpdate: apply }, b1 + 0.8)
      fade(tl, '.p-lab-hall', 1, b1 + 1.6, 0.5)
      fade(tl, '.p-readout', 1, b1 + 2.2, 0.5)
      ticker(tl, samples, 0, 4200, b1 + 2.2, 7.6, (v) => `${Math.round(v).toLocaleString('en-GB')} readings`)
      fade(tl, '.p-motor', 1, b1 + 3.6, 0.8)
      fade(tl, '.p-lab-enc', 1, b1 + 4.4, 0.5)
      fade(tl, '.p-lab-khz', 1, b1 + 6.2, 0.6)

      /* b2: the motor current as a force sensor: 5:1 clean, 100:1 drowned. */
      const b2 = b1 + 10.6
      tl.addLabel('b2', b2)
      fade(tl, '.p-knuckle', 0, b2, 0.6, 1)
      fade(tl, '.p-current', 1, b2, 0.6)
      draw(tl, '.p-axis', b2 + 0.4, 0.8)
      fade(tl, '.p-callback', 1, b2 + 0.3, 0.6)
      fade(tl, '.p-callback', 0, b2 + 3.4, 0.6, 1)
      const press = b2 + 3.2
      tl.fromTo('.p-press', { y: -220 }, { y: 0, duration: 1.0, ease: 'power2.in', immediateRender: false }, press)
      tl.fromTo('.p-press', { y: 0 }, { y: -220, duration: 1.0, ease: 'power2.inOut', immediateRender: false }, press + 2.6)
      tl.fromTo('.p-tipbend', { rotation: 0 }, { rotation: 7, duration: 0.3, ease: 'power2.out', transformOrigin: '0px 24px', immediateRender: false }, press + 0.95)
      tl.fromTo('.p-tipbend', { rotation: 7 }, { rotation: 0, duration: 0.5, ease: 'power2.inOut', transformOrigin: '0px 24px', immediateRender: false }, press + 2.7)
      tl.fromTo('.p-reveal', { attr: { width: 0 } }, { attr: { width: TRACE.w }, duration: 6.4, ease: 'none', immediateRender: false }, b2 + 1.2)
      fade(tl, '.p-lab-clean', 1, press + 1.4, 0.6)
      fade(tl, '.p-lab-swamp', 1, press + 2.0, 0.6)
      fade(tl, '.p-formula', 1, b2 + 8.2, 0.8)
      tl.to({}, { duration: 0.4 }, b2 + 12.4)

      /* b3: a fingertip meets an egg. The joints barely notice. */
      const b3 = b2 + 12.8
      tl.addLabel('b3', b3)
      fade(tl, '.p-current', 0, b3, 0.6, 1)
      fade(tl, '.p-blind', 1, b3, 0.6)
      tl.fromTo('.p-pointer', { y: -260, x: -60 }, { y: 0, x: 0, duration: 3.2, ease: 'power2.out', immediateRender: false }, b3 + 0.2)
      pointer.to(tl, { pose: { ...GRASPS.point, index: [12, 10, 6, 2] } }, b3 + 0.4, 2.8)
      pointer.to(tl, { pose: { ...GRASPS.point, index: [12.1, 10.1, 6, 2] }, touch: { index: 0 } }, b3 + 3.4, 0.4)
      fade(tl, '.p-ghost-p', 1, b3 + 0.6, 0.8)
      fade(tl, '.p-lab-barely', 1, b3 + 3.6, 0.6)
      fade(tl, '.p-q', 1, b3 + 3.6, 0.3)
      fade(tl, '.p-asks', 1, b3 + 5.2, 0.8)
      tl.fromTo('.p-ask', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.9, immediateRender: false }, b3 + 5.2)
      pointer.to(tl, { touch: { index: 1 } }, b3 + 9.6, 0.8)
      fade(tl, '.p-skin', 1, b3 + 9.8, 0.8)
      fade(tl, '.p-q', 0, b3 + 9.6, 0.6, 1)
      tl.to({}, { duration: 0.4 }, b3 + 11.8)
    },
    [human, robot, pointer],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.p-spin', { rotation: 360, duration: 1.2, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
    gsap.to('.p-field', { opacity: 0.35, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.p-noise', { x: 4, duration: 0.07, yoyo: true, repeat: -1, ease: 'none' })
    gsap.to('.p-noise2', { x: -5, y: 2, duration: 0.11, yoyo: true, repeat: -1, ease: 'none' })
    gsap.to('.p-qpulse', { scale: 1.15, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
    gsap.to('.p-breathe', { opacity: 0.6, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      {/* ---------- b0: hands in the dark ---------- */}
      <g className="p-dark" ref={darkRef}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <g className="p-breathe">
            <Pool x={520} y={420} r={520} color="key" opacity={0.35} />
            <Pool x={1120} y={420} r={520} color="rim" opacity={0.3} />
          </g>
        </g>
        <g data-depth="1">
          <g className="p-human" opacity={0}>
            <Hand3D store={human} x={520} y={760} look="human" arm={300} light={[-0.9, -0.4]} />
            <g className="p-ghost-h" opacity={0}>
              <JointGhost store={human} x={520} y={760} />
            </g>
          </g>
          <g className="p-robot" opacity={0}>
            <Hand3D store={robot} x={1110} y={760} look="robot" arm={300} light={[0.9, -0.4]} />
            <g className="p-ghost-r" opacity={0}>
              <JointGhost store={robot} x={1110} y={760} />
            </g>
          </g>
          <Dust x={0} y={0} w={1600} h={900} count={30} seed={8} color={C.mist} size={0.7} />
        </g>
        <g className="p-title" opacity={0}>
          <Big x={800} y={150} size={84} hidden={false}>
            proprioception
          </Big>
          <text x={800} y={196} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={26}>
            where your own fingers are, and how hard they push
          </text>
        </g>
      </g>

      {/* ---------- b1: the knuckle in x-ray ---------- */}
      <g className="p-knuckle" opacity={0}>
        <Blueprint />
        <g className="p-kzoom">
          <Pool x={K.x} y={K.y} r={420} color="magenta" opacity={0.25} />
          {/* the proximal segment, fixed, coming in from the left */}
          <path className="p-outline" pathLength={1} strokeDasharray="1" d={`M${K.x - 520} ${K.y - 70} H${K.x - 20} A70 70 0 0 1 ${K.x - 20} ${K.y + 70} H${K.x - 520}`} fill={C.ink1} fillOpacity={0.6} stroke={C.cyan} strokeWidth={3} />
          <line x1={K.x - 500} y1={K.y} x2={K.x - 60} y2={K.y} stroke={C.bone} strokeWidth={22} strokeLinecap="round" opacity={0.25} />
          {/* the Hall chip on the fixed side */}
          <rect x={K.x - 60} y={K.y - 106} width={56} height={30} rx={4} fill={C.ink} stroke={C.magentaLight} strokeWidth={2} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={K.x - 52 + i * 14} x2={K.x - 52 + i * 14} y1={K.y - 76} y2={K.y - 68} stroke={C.magentaLight} strokeWidth={2} />
          ))}
          <path d={`M${K.x - 32} ${K.y - 106} Q ${K.x - 200} ${K.y - 200} ${K.x - 420} ${K.y - 180}`} fill="none" stroke={C.magentaLight} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
          {/* the moving segment: magnet in its base */}
          <g className="p-distal" transform={`rotate(10 ${K.x} ${K.y})`}>
            <path d={`M${K.x} ${K.y - 66} H${K.x + 440} Q${K.x + 520} ${K.y} ${K.x + 440} ${K.y + 66} H${K.x} A66 66 0 0 1 ${K.x} ${K.y - 66}`} fill={C.ink1} fillOpacity={0.6} stroke={C.cyan} strokeWidth={3} />
            <line x1={K.x + 40} y1={K.y} x2={K.x + 430} y2={K.y} stroke={C.bone} strokeWidth={20} strokeLinecap="round" opacity={0.25} />
            <path d={`M${K.x + 430} ${K.y - 56} Q${K.x + 500} ${K.y} ${K.x + 430} ${K.y + 56}`} fill="none" stroke={C.magenta} strokeWidth={6} opacity={0.4} />
            <g className="p-field">
              {[60, 90, 120].map((r) => (
                <ellipse key={r} cx={K.x} cy={K.y} rx={r} ry={r * 0.55} fill="none" stroke={C.magentaLight} strokeWidth={1.5} opacity={0.6} />
              ))}
            </g>
            <circle cx={K.x} cy={K.y} r={36} fill={C.danger} opacity={0.9} />
            <path d={`M${K.x} ${K.y - 36} A36 36 0 0 0 ${K.x} ${K.y + 36} Z`} fill={C.rimDeep} />
            <text x={K.x + 16} y={K.y + 8} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={20} fontWeight={700}>
              N
            </text>
            <text x={K.x - 16} y={K.y + 8} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={20} fontWeight={700}>
              S
            </text>
          </g>
          <Label className="p-lab-hall" x={K.x - 32} y={K.y - 108} tx={K.x - 120} ty={K.y - 250} text="Hall sensor feels the magnet turn" color={C.magentaLight} hidden />
        </g>
        {/* the motor and its encoder */}
        <g className="p-motor" opacity={0}>
          <rect x={MOTOR.x - 190} y={MOTOR.y + 130} width={170} height={110} rx={14} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
          <rect x={MOTOR.x - 20} y={MOTOR.y + 178} width={50} height={14} fill={C.metal} />
          <g transform={`translate(${MOTOR.x + 60} ${MOTOR.y + 185})`}>
            <g className="p-spin">
              <circle r={62} fill={C.ink2} stroke={C.lime} strokeWidth={2} />
              {Array.from({ length: 24 }, (_, i) => (
                <rect key={i} x={-3} y={-58} width={6} height={14} fill={C.limeLight} opacity={0.8} transform={`rotate(${i * 15})`} />
              ))}
              <circle r={10} fill={C.metal} />
            </g>
          </g>
          <rect x={MOTOR.x + 42} y={MOTOR.y + 108} width={36} height={22} fill={C.ink} stroke={C.lime} strokeWidth={1.5} />
          <path d={`M${MOTOR.x + 60} ${MOTOR.y + 130} V${MOTOR.y + 150}`} stroke={C.limeLight} strokeWidth={3} filter="url(#cn-bloom)" />
          <Label className="p-lab-enc" x={MOTOR.x + 62} y={MOTOR.y + 104} tx={MOTOR.x + 150} ty={MOTOR.y + 60} text="encoder on the motor" color={C.limeLight} hidden />
        </g>
        <g className="p-readout" opacity={0}>
          <Mono x={1500} y={150} anchor="end" color={C.lime} size={48}>
            <tspan className="p-angle">θ = 10.0°</tspan>
          </Mono>
          <Mono x={1500} y={196} anchor="end" color={C.limeLight} size={24}>
            <tspan className="p-samples">0 readings</tspan>
          </Mono>
        </g>
        <g className="p-lab-khz" opacity={0}>
          <Mono x={1500} y={790} anchor="end" color={C.mist} size={24}>
            Shadow Hand joint sensors: 0.2° at 1,000 per second
          </Mono>
        </g>
      </g>

      {/* ---------- b2: motor current as a force sensor ---------- */}
      <g className="p-current" opacity={0}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <rect x={-100} y={-100} width={1800} height={1100} fill="url(#cn-grid-big)" opacity={0.5} />
        <line x1={800} x2={800} y1={80} y2={820} stroke={C.slate} strokeWidth={1.5} strokeDasharray="4 8" />
        {UNITS.map((u, i) => {
          const gx = u.cx - 230
          return (
            <g key={u.ratio}>
              <Pool x={u.cx} y={FY + 40} r={360} color="amber" opacity={0.18} />
              {/* motor */}
              <rect x={gx - 120} y={FY - 40} width={110} height={80} rx={12} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
              <text x={gx - 65} y={FY + 8} textAnchor="middle" fill={C.amberLight} fontFamily={SANS} fontSize={18} fontWeight={600}>
                motor
              </text>
              {/* gears: small on the motor, big on the joint */}
              <g transform={`translate(${gx + 6 + u.small} ${FY - u.big + u.small})`}>
                <g className="p-spin">
                  <Gear r={u.small} teeth={Math.max(6, Math.round(u.small / 3))} />
                </g>
              </g>
              <g transform={`translate(${gx + 10 + 2 * u.small + u.big} ${FY})`}>
                <Gear r={u.big} teeth={Math.round(u.big / 3)} />
              </g>
              <text x={u.cx - 40} y={FY - 120} textAnchor="middle" fill={C.cyan} fontFamily={MONO} fontSize={44} fontWeight={600}>
                {u.ratio}
              </text>
              <text x={u.cx - 40} y={FY - 88} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={20}>
                {u.clean ? 'gentle gearing (backdrivable)' : 'steep gearing'}
              </text>
              {/* the finger, pointing right from the joint */}
              <g transform={`translate(${gx + 10 + 2 * u.small + u.big} ${FY})`}>
                <g className="p-tipbend">
                  <rect x={0} y={-24} width={200} height={48} rx={24} fill="url(#cn-shell)" />
                  <circle cx={210} cy={0} r={18} fill={C.carbon} />
                  <rect x={214} y={-21} width={120} height={42} rx={21} fill="url(#cn-shell)" />
                  <ellipse cx={322} cy={-14} rx={18} ry={9} fill={C.rubber} />
                </g>
              </g>
              {/* a human finger presses the tip from above */}
              <g className="p-press" transform="translate(0 -220)">
                <g transform={`translate(${gx + 10 + 2 * u.small + u.big + 322} ${FY - 26})`}>
                  <path d="M-22 -360 L-22 -26 Q-22 0 0 0 Q22 0 22 -26 L22 -360 Z" fill={C.skinB} />
                  <path d="M-8 -360 L-8 -30 Q-8 -12 4 -10" fill="none" stroke={C.skinA} strokeWidth={8} opacity={0.5} />
                  <path d="M-12 -40 Q0 -34 12 -40" stroke={C.skinBDark} strokeWidth={3} fill="none" />
                </g>
              </g>
              {/* the current trace */}
              <g>
                <path className="p-axis" pathLength={1} strokeDasharray="1" d={`M${u.cx - TRACE.w / 2} ${TRACE.y0 - TRACE.h} V${TRACE.y0} H${u.cx + TRACE.w / 2}`} fill="none" stroke={C.fog} strokeWidth={2} />
                <text x={u.cx - TRACE.w / 2} y={TRACE.y0 - TRACE.h - 14} fill={C.amberLight} fontFamily={SANS} fontSize={20}>
                  motor current
                </text>
                <clipPath id={`p-clip-${i}`}>
                  <rect className="p-reveal" x={u.cx - TRACE.w / 2} y={TRACE.y0 - TRACE.h - 20} width={0} height={TRACE.h + 30} />
                </clipPath>
                <g clipPath={`url(#p-clip-${i})`}>
                  {u.clean ? (
                    <path d={`M${u.cx - TRACE.w / 2} ${TRACE.y0 - 30} H${u.cx - 60} C${u.cx - 40} ${TRACE.y0 - 30} ${u.cx - 40} ${TRACE.y0 - 120} ${u.cx - 10} ${TRACE.y0 - 120} H${u.cx + 90} C${u.cx + 120} ${TRACE.y0 - 120} ${u.cx + 120} ${TRACE.y0 - 30} ${u.cx + 140} ${TRACE.y0 - 30} H${u.cx + TRACE.w / 2}`} fill="none" stroke={C.amber} strokeWidth={4} filter="url(#cn-bloom)" />
                  ) : (
                    <g>
                      <path d={`M${u.cx - TRACE.w / 2} ${TRACE.y0 - 70} H${u.cx - 60} C${u.cx - 40} ${TRACE.y0 - 70} ${u.cx - 40} ${TRACE.y0 - 84} ${u.cx - 10} ${TRACE.y0 - 84} H${u.cx + 90} C${u.cx + 120} ${TRACE.y0 - 84} ${u.cx + 120} ${TRACE.y0 - 70} ${u.cx + 140} ${TRACE.y0 - 70} H${u.cx + TRACE.w / 2}`} fill="none" stroke={C.amber} strokeWidth={3} opacity={0.7} />
                      <polyline className="p-noise" points={noise(u.cx - TRACE.w / 2, TRACE.y0 - 74, TRACE.w, 46, 7)} fill="none" stroke={C.mist} strokeWidth={1.6} opacity={0.75} />
                      <polyline className="p-noise2" points={noise(u.cx - TRACE.w / 2, TRACE.y0 - 74, TRACE.w, 40, 19)} fill="none" stroke={C.fog} strokeWidth={1.6} opacity={0.75} />
                    </g>
                  )}
                </g>
              </g>
            </g>
          )
        })}
        <Label className="p-lab-clean" x={UNITS[0].cx + 40} y={TRACE.y0 - 120} tx={UNITS[0].cx + 120} ty={TRACE.y0 - 170} text="a clean bump: the press" color={C.amberLight} hidden />
        <Label className="p-lab-swamp" x={UNITS[1].cx + 40} y={TRACE.y0 - 110} tx={UNITS[1].cx + 120} ty={TRACE.y0 - 180} text="friction swamps it" color={C.danger} hidden />
        <g className="p-callback" opacity={0}>
          <Mono x={800} y={60} anchor="middle" color={C.amber} size={22}>
            from film 3 · the muscle
          </Mono>
        </g>
        <g className="p-formula" opacity={0}>
          <text x={800} y={830} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={30}>
            torque ≈ N × K<tspan fontSize={20} dy={6}>t</tspan>
            <tspan dy={-6}> × current − friction</tspan>
          </text>
        </g>
      </g>

      {/* ---------- b3: a fingertip meets an egg ---------- */}
      <g className="p-blind" opacity={0}>
        <DimRoom />
        <Pool x={EGG.x} y={EGG.y - 60} r={560} color="key" opacity={0.85} />
        <rect x={-100} y={EGG.y + 40} width={1800} height={600} fill={C.ink2} />
        <rect x={-100} y={EGG.y + 40} width={1800} height={4} fill={C.keyDeep} opacity={0.6} />
        <Egg x={EGG.x} y={EGG.y + 2} s={1.6} />
        <g className="p-pointer">
          <Hand3D store={pointer} x={EGG.x - 66} y={190} look="robot" arm={380} light={[0.8, -0.5]} />
          <g className="p-ghost-p" opacity={0}>
            <JointGhost store={pointer} x={EGG.x - 66} y={190} />
          </g>
        </g>
        <g className="p-q" opacity={0}>
          <g className="p-qpulse">
            <text x={EGG.x + 60} y={EGG.y - 40} textAnchor="middle" fill={C.magenta} fontFamily={SANS} fontSize={80} fontWeight={700} filter="url(#cn-bloom)">
              ?
            </text>
          </g>
        </g>
        <Label className="p-lab-barely" x={EGG.x - 80} y={EGG.y - 250} tx={EGG.x - 330} ty={EGG.y - 330} text="joint angles barely change" sub="+0.1° at contact" color={C.magentaLight} hidden />
        <g className="p-asks" opacity={0}>
          {['where does it touch?', 'is it slipping?', 'how soft is it?'].map((t, i) => (
            <g key={t} className="p-ask">
              <text x={1250} y={330 + i * 54} fill={C.paper} fontFamily={SANS} fontSize={30} fontWeight={500}>
                {t}
              </text>
            </g>
          ))}
        </g>
        <g className="p-skin" opacity={0}>
          <text x={1250} y={530} fill={C.magenta} fontFamily={SANS} fontSize={34} fontWeight={700}>
            → you need skin
          </text>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'proprio',
  title: 'Knowing where you are',
  cues: CUES,
  Scene: Ch2Proprio,
  enter: { type: 'zoom', x: 1250, y: 330 },
  deeper: [ProprioReading],
}
