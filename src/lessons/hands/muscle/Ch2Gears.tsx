import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, makeHandStore, tipOnStage, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, Label, Pool, Readout, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { Gear, MuscleStyle, Planetary, RFinger, TorqueArc, clamp, count, fingerRig, fk } from './parts'
import { GearingReading } from './readings'

export const CUES: Cue[] = [
  { id: 'bargain', say: 'The answer is a gearbox. A small gear turning a big one trades speed for force: ten turns in, one turn out, ten times the torque.' },
  { id: 'price', say: 'But the bargain has hidden costs. The higher the ratio, the slower the finger, and the harder it is for anything to push it back.' },
  { id: 'inertia', say: 'Worse, the motor’s spinning mass is multiplied by the ratio squared. At one hundred to one, anything that bumps the fingertip feels a rotor ten thousand times heavier. Teeth snap.' },
  { id: 'ratio', say: 'Find a gear ratio that passes all three tests: lift a full jug, survive a bump, and let a person push the finger aside.', play: true },
  { id: 'qdd', say: 'Engineers call that recipe quasi-direct drive: a strong motor and a gentle ratio. The finger stays quick, survives knocks, and the motor’s current tells you how hard it’s pushing.' },
  { id: 'lock', say: 'The opposite camp loves high ratios for one reason: a screw drive that can’t be pushed back will hold a grip with zero power.' },
]

const STATE = [
  'Two meshing metal gears on a blueprint: a small 10-tooth gear spins fast, driving a big 100-tooth gear that turns slowly the other way. Counters read "turns in: 10" and "turns out: 1". A thin amber torque arc circles the small gear, an arc ten times thicker circles the big one. Then the gears give way to three planetary gear stages in a row, 4:1 × 4:1 × 4:1 = 64:1, showing how real gearboxes stack stages. Ratio N multiplies torque by N and divides speed by N.',
  'A white robot finger stands on a gearbox marked 100:1 with a small motor behind it. It curls very slowly (label "speed ÷ 100"). Then Theo\'s hand comes in and pushes on the fingertip to open it: the finger does not budge. Label: "not backdrivable". High ratios make fingers slow and impossible to push back by hand, so they cannot yield to people or sense contact through the motor.',
  'The same 100:1 finger. A heavy steel block falls onto the fingertip. Behind the gearbox, a ghost of the motor\'s rotor balloons into a huge spinning wheel, labelled "feels 10,000× heavier" (reflected inertia = rotor inertia × ratio², 100² = 10,000). The impact cannot be absorbed by the rotor recoiling, so the gear teeth crack: shards fly, the frame shakes and flashes red.',
  '',
  'A finger on a big motor with a gentle 8:1 ratio brushes against a person\'s open hand and yields softly instead of shoving. A lime oscilloscope trace of motor current spikes at the moment of contact (label "current ≈ force": at low ratios the motor current is a good force sensor). Label: "1X NEO: 5:1 to 15:1". This recipe is called quasi-direct drive, pioneered in the MIT Cheetah legged robot.',
  'A lead screw driven by a small motor moves a nut, which pushes a rod that curls a finger around a bottle. Then the power plug is pulled out: the wattmeter drops to 0 W, the screw stops, and the bottle stays held. Label: "self-locking: holds at 0 W". Screws with a small lead (and worm gears) cannot be turned backwards by the load, so they hold a grip for free, as in Inspire\'s linkage hands. The price is that impacts load the screw directly.',
]

/* ---------------- the story finger (price, inertia) ---------------- */
const BASE = { x: 500, y: 600 }
const LENS = [150, 105, 85]
const S = 1.3
const CLOSED: [number, number, number] = [20, 25, 20]
const pts = fk(BASE.x, BASE.y, -90, LENS, CLOSED, S)
const DIST = { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2, a: pts[3].a }
const N = { x: Math.cos(((DIST.a + 90) * Math.PI) / 180), y: Math.sin(((DIST.a + 90) * Math.PI) / 180) }
const CONTACT = { x: DIST.x + N.x * 26, y: DIST.y + N.y * 26 }
const POINT_VIEW = { yaw: -20, pitch: 0, roll: 25, s: 1.3 }
const pointStore = makeHandStore({ pose: GRASPS.point, view: POINT_VIEW })
const tipOff = tipOnStage(pointStore, 'index', 0, 0)
const PUSH_FROM = { x: N.x * 420, y: N.y * 420 }

/* ---------------- the play ---------------- */
const MAXR = 300
const ratioOf = (v: number) => Math.pow(10, v * Math.log10(MAXR))
const vOf = (r: number) => Math.log10(r) / Math.log10(MAXR)
const LIFT_SMALL = 40
const LIFT_BIG = 11
const BUMP_MAX = 30
const PUSH_MAX = 22
const PLAY_BASE = { x: 360, y: 610 }

/* ---------------- the lead screw ---------------- */
const LOCK_FINGER = { x: 1000, y: 600 }
const LOCK_CLOSED: [number, number, number] = [26, 40, 38]

export function Ch2Gears({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const human = useHandStore({ pose: GRASPS.point, view: POINT_VIEW })
  const palm = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 20, pitch: 0, roll: 80, s: 1.15 } })

  /* ---------------- play state ---------------- */
  const [v, setV] = useState(vOf(100))
  const [big, setBig] = useState(false)
  const [settled, setSettled] = useState<number[]>([])
  const [offer, setOffer] = useState(false)
  const [done, setDone] = useState(false)
  const ratio = ratioOf(v)
  const liftMin = big ? LIFT_BIG : LIFT_SMALL
  const lift = ratio >= liftMin
  const bump = ratio <= BUMP_MAX
  const push = ratio <= PUSH_MAX
  const all = lift && bump && push
  const active = cueIndex === 3 && !done
  const rText = ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toString()

  // a setting counts as tried when the learner holds it for a moment
  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      const b = Math.round(v * 12)
      setSettled((s) => (s.includes(b) ? s : [...s, b]))
      emit({ type: 'attempt', correct: all, detail: `ratio ${rText}:1${big ? ' with the bigger forearm motor' : ''}: lift ${lift ? 'pass' : 'fail'}, bump ${bump ? 'pass' : 'fail'}, push ${push ? 'pass' : 'fail'}` })
    }, 650)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, big, active])
  useEffect(() => {
    if (settled.length >= 3) setOffer(true)
  }, [settled])
  // never a dead end: the option appears after a while anyway
  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => setOffer(true), 25000)
    return () => window.clearTimeout(t)
  }, [active])
  useEffect(() => {
    if (!active || !all) return
    const t = window.setTimeout(() => {
      setDone(true)
      memory.gearRatio = Math.round(ratio)
      emit({ type: 'attempt', correct: true, detail: `all three tests pass at ${rText}:1 with a bigger motor in the forearm` })
      void say('No ratio could do it all with a tiny motor. A bigger motor, with a gentle ratio, could. So where do you put the bigger motor?')
      onPlayDone()
    }, 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, all])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(world.current, { x: 840, y: 470, zoom: 0.86 })
      const finger = fingerRig(el, 'c2f', [0, 0, 0])
      const qdd = fingerRig(el, 'c2q', [6, 8, 6])
      const lock = fingerRig(el, 'c2l', [0, 4, 4])
      const sceneSets = '.c2-gears, .c2-plan, .c2-bench, .c2-play, .c2-qdd, .c2-lock'

      /* b0: ten turns in, one turn out. Then planetary stages. */
      tl.addLabel('b0', 0)
      tl.set(sceneSets, { opacity: 0 }, 0)
      tl.set('.c2-gears', { opacity: 1 }, 0)
      cam.to(tl, { zoom: 0.92, x: 860, y: 470 }, 0, 6, 'sine.inOut')
      tl.fromTo('.c2-small', { rotation: 18 }, { rotation: 18 + 3600, duration: 6.2, ease: 'power1.inOut', svgOrigin: '0 0', immediateRender: false }, 0.4)
      tl.fromTo('.c2-big', { rotation: 0 }, { rotation: -360, duration: 6.2, ease: 'power1.inOut', svgOrigin: '0 0', immediateRender: false }, 0.4)
      count(tl, el, '.c2-in', 0, 10, 0.4, 6.2, (n) => `turns in: ${n.toFixed(1)}`, 'power1.inOut')
      count(tl, el, '.c2-out', 0, 1, 0.4, 6.2, (n) => `turns out: ${n.toFixed(1)}`, 'power1.inOut')
      fade(tl, '.c2-tq-s', 1, 1.0, 0.6)
      fade(tl, '.c2-tq-b', 1, 2.4, 0.8)
      fade(tl, '.c2-gl-s', 1, 1.4, 0.5)
      fade(tl, '.c2-gl-b', 1, 2.8, 0.5)
      fade(tl, '.c2-gears', 0, 6.8, 0.7, 1)
      fade(tl, '.c2-plan', 1, 7.0, 0.8)
      tl.fromTo('.c2-plan-st', { scale: 0.6, opacity: 0, svgOrigin: '800 430' }, { scale: 1, opacity: 1, duration: 0.6, stagger: 0.35, ease: 'back.out(1.6)', immediateRender: false }, 7.1)
      fade(tl, '.c2-plan-eq', 1, 8.4, 0.6)
      cam.to(tl, { zoom: 1.04, x: 800, y: 450 }, 6.8, 3.6, 'sine.inOut')

      /* b1: the finger on a 100:1 gearbox closes slowly; a hand pushes and it won't budge. */
      const b1 = 10.6
      tl.addLabel('b1', b1)
      fade(tl, '.c2-plan', 0, b1, 0.6, 1)
      fade(tl, '.c2-bench', 1, b1 + 0.3, 0.8)
      cam.to(tl, { zoom: 1.12, x: 640, y: 450 }, b1, 9.6, 'sine.inOut')
      finger.to(tl, CLOSED, b1 + 1.0, 4.4, 'none')
      tl.fromTo('.c2-wgear', { rotation: 0 }, { rotation: -1440, duration: 4.4, ease: 'none', svgOrigin: '0 0', immediateRender: false }, b1 + 1.0)
      fade(tl, '.c2-l-slow', 1, b1 + 1.4, 0.5)
      fade(tl, '.c2-l-ratio', 1, b1 + 0.8, 0.5)
      fade(tl, '.c2-push', 1, b1 + 5.2, 0.3)
      fade(tl, '.c2-l-slow', 0, b1 + 5.0, 0.5, 1)
      tl.fromTo('.c2-push', { x: PUSH_FROM.x, y: PUSH_FROM.y }, { x: 0, y: 0, duration: 1.4, ease: 'power2.out', immediateRender: false }, b1 + 5.2)
      tl.fromTo('.c2-push', { x: 0, y: 0 }, { x: -N.x * 8, y: -N.y * 8, duration: 0.25, repeat: 3, yoyo: true, ease: 'power1.inOut', immediateRender: false }, b1 + 6.7)
      fade(tl, '.c2-pushar', 1, b1 + 6.7, 0.3)
      cam.shake(tl, b1 + 6.75, 0.25, 0.4)
      fade(tl, '.c2-l-nbd', 1, b1 + 7.4, 0.5)

      /* b2: a bump. The rotor feels 10,000 times heavier; teeth snap. */
      const b2 = b1 + 10.2
      tl.addLabel('b2', b2)
      fade(tl, '.c2-push, .c2-pushar, .c2-l-nbd', 0, b2, 0.5, 1)
      fade(tl, '.c2-xr', 1, b2 + 0.2, 0.8)
      fade(tl, '.c2-ghost', 1, b2 + 2.0, 0.4)
      tl.fromTo('.c2-ghost-s', { scale: 0.12, svgOrigin: '300 660' }, { scale: 1, duration: 2.2, ease: 'power2.inOut', immediateRender: false }, b2 + 2.0)
      tl.fromTo('.c2-ghost-r', { rotation: 0 }, { rotation: 300, duration: 8.5, ease: 'power1.out', svgOrigin: '300 660', immediateRender: false }, b2 + 2.0)
      fade(tl, '.c2-l-heavy', 1, b2 + 3.4, 0.5)
      const hit = b2 + 6.0
      fade(tl, '.c2-block', 1, hit - 1.0, 0.2)
      tl.fromTo('.c2-block', { y: -560, rotation: -12 }, { y: 0, rotation: 0, duration: 0.7, ease: 'power3.in', svgOrigin: `${pts[3].x} ${pts[3].y - 60}`, immediateRender: false }, hit - 0.7)
      tl.fromTo('.c2-block', { y: 0, x: 0 }, { y: 220, x: 160, rotation: 40, duration: 0.9, ease: 'power2.in', immediateRender: false }, hit + 0.05)
      cam.shake(tl, hit, 1.4, 0.6)
      fade(tl, '.c2-crack', 1, hit, 0.08)
      fade(tl, '.c2-flash', 0.35, hit, 0.06, 0)
      fade(tl, '.c2-flash', 0, hit + 0.15, 0.7, 0.35)
      tl.fromTo('.c2-shard', { x: 0, y: 0, opacity: 1, rotation: 0 }, { x: (i) => [-140, 90, -60, 160, -180, 40][i % 6], y: (i) => [-120, -160, -60, -90, 40, -200][i % 6], rotation: (i) => i * 90 + 60, opacity: 0, duration: 1.1, ease: 'power2.out', immediateRender: false }, hit)
      fade(tl, '.c2-l-snap', 1, hit + 0.5, 0.4)

      /* b3: the play. */
      const b3 = b2 + 11
      tl.addLabel('b3', b3)
      fade(tl, '.c2-bench', 0, b3, 0.5, 1)
      fade(tl, '.c2-play', 1, b3 + 0.3, 0.8)
      cam.to(tl, { zoom: 1, x: 800, y: 450 }, b3, 1.2)
      tl.to({}, { duration: 0.1 }, b3 + 2.4)

      /* b4: quasi-direct drive: a strong motor, a gentle ratio, a soft touch. */
      const b4 = b3 + 2.6
      tl.addLabel('b4', b4)
      fade(tl, '.c2-play', 0, b4, 0.5, 1)
      fade(tl, '.c2-qdd', 1, b4 + 0.3, 0.8)
      cam.to(tl, { zoom: 1.08, x: 760, y: 440 }, b4, 11.5, 'sine.inOut')
      qdd.to(tl, [22, 26, 18], b4 + 0.8, 1.2, 'power2.inOut')
      tl.fromTo('.c2-palm', { x: 360 }, { x: 0, duration: 1.6, ease: 'power2.out', immediateRender: false }, b4 + 1.4)
      const touch = b4 + 3.0
      qdd.to(tl, [8, 14, 10], touch, 0.5, 'power2.out')
      qdd.to(tl, [12, 18, 13], touch + 0.5, 0.8, 'sine.inOut')
      tl.fromTo('.c2-trace-clip', { attr: { width: 0 } }, { attr: { width: 520 }, duration: 6, ease: 'none', immediateRender: false }, b4 + 0.6)
      fade(tl, '.c2-l-cur', 1, touch + 0.4, 0.5)
      fade(tl, '.c2-l-soft', 1, touch + 0.8, 0.5)
      fade(tl, '.c2-l-neo', 1, touch + 3.2, 0.6)
      fade(tl, '.c2-l-qddr', 1, b4 + 0.6, 0.5)

      /* b5: a screw that can't be pushed back holds a grip with no power. */
      const b5 = b4 + 11.8
      tl.addLabel('b5', b5)
      fade(tl, '.c2-qdd', 0, b5, 0.5, 1)
      fade(tl, '.c2-lock', 1, b5 + 0.3, 0.8)
      cam.to(tl, { zoom: 1.05, x: 800, y: 430 }, b5, 10, 'sine.inOut')
      tl.fromTo('.c2-threads', { x: 0 }, { x: -96, duration: 3.4, ease: 'none', immediateRender: false }, b5 + 1.0)
      tl.fromTo('.c2-nut', { x: 0 }, { x: 150, duration: 3.4, ease: 'power1.inOut', immediateRender: false }, b5 + 1.0)
      lock.to(tl, LOCK_CLOSED, b5 + 1.0, 3.4, 'power1.inOut')
      count(tl, el, '.c2-watts', 3.2, 3.2, b5 + 0.5, 0.1, (n) => `${n.toFixed(1)} W`)
      const pull = b5 + 5.0
      tl.fromTo('.c2-plug', { x: 0, y: 0, rotation: 0 }, { x: -90, y: 40, rotation: -20, duration: 0.5, ease: 'power3.out', svgOrigin: '160 520', immediateRender: false }, pull)
      fade(tl, '.c2-spark', 1, pull, 0.05)
      fade(tl, '.c2-spark', 0, pull + 0.2, 0.3, 1)
      count(tl, el, '.c2-watts', 3.2, 0, pull + 0.05, 0.4, (n) => `${n.toFixed(1)} W`)
      fade(tl, '.c2-powered', 0.15, pull + 0.1, 0.4, 1)
      tl.fromTo('.c2-bottle', { y: 0 }, { y: 6, duration: 0.15, yoyo: true, repeat: 3, ease: 'power1.inOut', immediateRender: false }, pull + 1.2)
      fade(tl, '.c2-l-lock', 1, pull + 1.4, 0.6)
      tl.to({}, { duration: 0.1 }, b5 + 10.2)
    },
    [],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-breathe', { opacity: 0.5, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-tremble', { x: 1.5, duration: 0.09, yoyo: true, repeat: -1, ease: 'none' })
  })

  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        `The learner's turn. A white robot finger stands on a gearbox with a motor behind it (${big ? 'now a bigger motor, moved down into the forearm' : 'a tiny motor'}). A gear-ratio slider (log scale, 1:1 to 300:1) sits below it, with live readouts: torque ×N, speed ÷N, felt inertia ×N². On the right are three test lamps, each with a small live animation: (1) lift a full jug, (2) survive a bump (a falling ball hits the fingertip), (3) let a person push the finger aside. ` +
          `Current ratio: ${rText}:1. Lift ${lift ? 'PASSES (the jug rises)' : 'FAILS (too weak, the jug stays down)'}; bump ${bump ? 'PASSES (the finger recoils)' : 'FAILS (gear teeth crack)'}; push ${push ? 'PASSES (the finger yields)' : 'FAILS (the finger will not move)'}. ` +
          `${offer ? (big ? 'The learner has switched to the bigger forearm motor. ' : 'A new option has appeared next to the slider: "a bigger motor (moved to the forearm)". ') : 'The learner has tried ' + settled.length + ' different settings so far; after three, a new option appears next to the slider. '}` +
          `${done ? 'Solved: all three lamps are green.' : ''} ` +
          'The rules: with the tiny motor, lifting needs a ratio of at least 40:1, but surviving a bump needs 30:1 or less and being pushed aside needs about 20:1 or less, so NO ratio passes all three. With the bigger forearm motor, lifting needs only about 11:1, so any ratio from about 11:1 to 22:1 passes everything. Likely mix-ups: hunting for a magic ratio with the tiny motor; not noticing the new option; thinking a higher ratio is always better.',
      )
      setHints(['Try a low ratio and a high one. Which tests flip?', 'If no ratio works, maybe the motor itself has to change.', 'Look for the new option next to the dial.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, ratio, rText, lift, bump, push, big, offer, settled, done, reportState, setHints])

  const hx = CONTACT.x - tipOff.x
  const hy = CONTACT.y - tipOff.y

  const ticks = useMemo(() => [1, 3, 10, 30, 100, 300].map((r) => ({ at: vOf(r), text: `${r}:1` })), [])

  return (
    <g ref={root}>
      <MuscleStyle />
      <g ref={world}>
        <g data-depth="0.3">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <g className="c2-breathe" opacity={0.3}>
            <Pool x={760} y={420} r={760} color="amber" opacity={0.4} />
          </g>
          <g filter="url(#cn-dof-3)" opacity={0.5}>
            <circle cx={160} cy={160} r={40} fill={C.key} opacity={0.3} />
            <circle cx={1460} cy={240} r={60} fill={C.rim} opacity={0.25} />
            <circle cx={1380} cy={800} r={34} fill={C.key} opacity={0.3} />
          </g>
          <Dust x={-200} y={-100} w={2000} h={1100} count={30} seed={41} color={C.keyLight} size={0.7} />
        </g>
        <g data-depth="1">
          {/* ---------- b0: gears ---------- */}
          <g className="c2-gears">
            <Blueprint opacity={0.9} />
            <Pool x={1100} y={470} r={520} color="amber" opacity={0.3} />
            <g transform="translate(1100 470)">
              <Gear r={400} n={100} className="c2-big" holes={8} hub={0.12} />
            </g>
            <g transform="translate(660 470)">
              <Gear r={40} n={10} className="c2-small" hub={0.3} />
            </g>
            <TorqueArc className="c2-tq-s" cx={660} cy={470} r={72} start={110} sweep={-200} width={3} />
            <TorqueArc className="c2-tq-b" cx={1100} cy={470} r={150} start={-70} sweep={200} width={30} />
            <Label className="c2-gl-s" x={630} y={420} tx={470} ty={300} text="small gear: fast, weak" color={C.amberLight} />
            <Label className="c2-gl-b" x={1390} y={745} tx={1470} ty={860} text="big gear: slow, strong" color={C.amber} anchor="end" />
            <Readout className="c2-in" x={180} y={700} color={C.cyan} size={30}>turns in: 0.0</Readout>
            <Readout className="c2-out" x={180} y={744} color={C.cyan} size={30}>turns out: 0.0</Readout>
            <text x={180} y={800} fill={C.amber} fontFamily={MONO} fontSize={30}>torque ×10</text>
          </g>
          <g className="c2-plan">
            <Blueprint opacity={0.9} />
            <rect x={240} y={424} width={1120} height={12} rx={5} fill="url(#cn-metal)" />
            {[420, 800, 1180].map((x, i) => (
              <g key={x} className="c2-plan-st">
                <Planetary x={x} y={430} r={130} />
                <text x={x} y={620} textAnchor="middle" fill={C.amber} fontFamily={MONO} fontSize={34}>4:1</text>
                {i < 2 && (
                  <text x={x + 190} y={444} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={40}>×</text>
                )}
              </g>
            ))}
            <text className="c2-plan-eq" x={800} y={740} textAnchor="middle" fill={C.amber} fontFamily={MONO} fontSize={46} opacity={0}>
              4 × 4 × 4 = 64:1
            </text>
            <text x={800} y={180} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={28}>
              planetary stages stack inside one gearbox
            </text>
          </g>

          {/* ---------- b1, b2: a finger on a 100:1 gearbox ---------- */}
          <g className="c2-bench">
            <Pool x={560} y={420} r={560} color="key" opacity={0.6} />
            <rect x={-800} y={720} width={3200} height={700} fill={C.ink2} />
            <rect x={-800} y={720} width={3200} height={4} fill={C.keyDeep} opacity={0.6} />
            {/* ghost rotor, behind everything */}
            <g className="c2-ghost" opacity={0}>
              <g className="c2-ghost-s">
                <g className="c2-ghost-r">
                  <circle cx={300} cy={660} r={330} fill={C.amber} opacity={0.08} />
                  <circle cx={300} cy={660} r={330} fill="none" stroke={C.amber} strokeWidth={4} strokeDasharray="18 12" opacity={0.7} />
                  {[0, 60, 120, 180, 240, 300].map((a) => (
                    <line key={a} x1={300} y1={660} x2={300 + Math.cos((a * Math.PI) / 180) * 320} y2={660 + Math.sin((a * Math.PI) / 180) * 320} stroke={C.amber} strokeWidth={3} opacity={0.4} />
                  ))}
                  <circle cx={300} cy={660} r={60} fill={C.amberDark} opacity={0.5} />
                </g>
              </g>
            </g>
            <GearboxStack x={500} y={600} label="100:1" />
            <RFinger x={BASE.x} y={BASE.y} rot={-90} s={S} lens={LENS} cls="c2f" />
            {/* the bump */}
            <g className="c2-block" opacity={0}>
              <g transform={`translate(${pts[3].x - 10} ${pts[3].y - 64})`}>
                <rect x={-55} y={-40} width={110} height={80} rx={6} fill="url(#cn-metal)" />
                <rect x={-55} y={-40} width={110} height={10} rx={4} fill={C.white} opacity={0.4} />
                <text x={0} y={14} textAnchor="middle" fill={C.ink2} fontFamily={MONO} fontSize={22} fontWeight={700}>2 kg</text>
              </g>
            </g>
            <g className="c2-crack" opacity={0}>
              <path d="M520 640 l 14 18 l -10 12 l 16 20" stroke={C.danger} strokeWidth={4} fill="none" filter="url(#cn-bloom)" />
              <path d="M480 650 l -10 16 l 12 10" stroke={C.danger} strokeWidth={3} fill="none" filter="url(#cn-bloom)" />
            </g>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} className="c2-shard" d="M0 0 l12 -4 l4 12 l-12 4 Z" fill={C.metal} opacity={0} transform={`translate(${505 + i * 6} ${650 + (i % 3) * 8})`} />
            ))}
            {/* Theo's hand pushes on the fingertip */}
            <g className="c2-push" opacity={0}>
              <g transform={`translate(${hx} ${hy})`}>
                                <Hand3D store={human} x={0} y={0} look="human" arm={260} light={[-0.6, -0.8]} />
              </g>
            </g>
            <g className="c2-pushar" opacity={0}>
              <line x1={CONTACT.x + N.x * 120} y1={CONTACT.y + N.y * 120} x2={CONTACT.x + N.x * 30} y2={CONTACT.y + N.y * 30} stroke={C.amber} strokeWidth={8} markerEnd="url(#cn-arrow)" />
            </g>
            <Label className="c2-l-ratio" x={440} y={705} tx={300} ty={790} text="gearbox 100:1" color={C.amber} />
            <Label className="c2-l-slow" x={pts[1].x + 20} y={pts[1].y} tx={pts[1].x + 220} ty={pts[1].y + 40} text="speed ÷ 100" sub="the finger crawls" color={C.cyan} />
            <Label className="c2-l-nbd" x={CONTACT.x} y={CONTACT.y} tx={CONTACT.x + 200} ty={CONTACT.y - 120} text="not backdrivable" sub="it won’t give way" color={C.danger} />
            <Label className="c2-l-heavy" x={300} y={330} tx={120} ty={250} text="feels 10,000× heavier" sub="rotor inertia × 100²" color={C.amber} anchor="start" />
            <Label className="c2-l-snap" x={520} y={660} tx={760} ty={770} text="teeth snap" color={C.danger} />
            <rect className="c2-flash" x={-800} y={-600} width={3200} height={2100} fill={C.danger} opacity={0} pointerEvents="none" />
          </g>

          {/* ---------- b3: the play ---------- */}
          <RatioPlay
            v={v}
            setV={(nv) => active && setV(nv)}
            ratio={ratio}
            rText={rText}
            big={big}
            offer={offer}
            setBig={() => {
              if (!active) return
              setBig(true)
              emit({ type: 'progress', detail: 'chose the bigger motor, moved to the forearm' })
            }}
            lift={lift}
            bump={bump}
            push={push}
            ticks={ticks}
            enabled={active}
          />

          {/* ---------- b4: quasi-direct drive ---------- */}
          <g className="c2-qdd" pointerEvents="none">
            <Pool x={620} y={420} r={600} color="key" opacity={0.55} />
            <rect x={-800} y={720} width={3200} height={700} fill={C.ink2} />
            <rect x={-800} y={720} width={3200} height={4} fill={C.keyDeep} opacity={0.6} />
            <GearboxStack x={500} y={600} label="8:1" big />
            <RFinger x={500} y={600} rot={-90} s={1.3} lens={LENS} cls="c2q" angles={[6, 8, 6]} />
            <g className="c2-palm">
              <Hand3D store={palm} x={960} y={270} look="human" arm={200} light={[-0.6, -0.8]} />
            </g>
            {/* the current trace */}
            <g transform="translate(960 800)">
              <rect x={-20} y={-90} width={560} height={160} rx={10} fill={C.ink} opacity={0.7} />
              <line x1={0} y1={30} x2={520} y2={30} stroke={C.limeDark} strokeWidth={1} opacity={0.5} />
              <clipPath id="c2-trace-p">
                <rect className="c2-trace-clip" x={0} y={-90} width={0} height={180} />
              </clipPath>
              <path d="M0 30 L150 30 L160 28 L190 30 L200 26 L215 -70 L228 -40 L245 -50 L265 -46 L300 -48 L330 -47 L360 -48 L400 -47 L520 -48" fill="none" stroke={C.lime} strokeWidth={3} clipPath="url(#c2-trace-p)" filter="url(#cn-bloom)" />
              <text x={0} y={-60} fill={C.lime} fontFamily={MONO} fontSize={20}>motor current</text>
            </g>
            <Label className="c2-l-cur" x={1175} y={730} tx={1250} ty={640} text="current ≈ force" color={C.lime} />
            <Label className="c2-l-soft" x={740} y={260} tx={820} ty={150} text="yields softly" color={C.cyan} />
            <Label className="c2-l-qddr" x={440} y={705} tx={300} ty={790} text="strong motor, gentle 8:1" color={C.amber} />
            <text className="c2-l-neo" x={1150} y={110} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={28} opacity={0}>
              1X NEO: 5:1 to 15:1
            </text>
          </g>

          {/* ---------- b5: a self-locking screw ---------- */}
          <g className="c2-lock" pointerEvents="none">
            <Pool x={900} y={420} r={620} color="key" opacity={0.55} />
            <rect x={-800} y={720} width={3200} height={700} fill={C.ink2} />
            <rect x={-800} y={720} width={3200} height={4} fill={C.keyDeep} opacity={0.6} />
            {/* the wall socket and plug */}
            <rect x={60} y={470} width={70} height={110} rx={8} fill={C.ink3} />
            <circle cx={84} cy={515} r={5} fill={C.ink} />
            <circle cx={106} cy={515} r={5} fill={C.ink} />
            <path d="M170 520 C 240 520 230 650 330 650" stroke={C.ink4} strokeWidth={8} fill="none" />
            <g className="c2-plug">
              <rect x={130} y={500} width={50} height={36} rx={6} fill={C.slate} />
            </g>
            <g className="c2-spark" opacity={0}>
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={135} y1={518} x2={135 + Math.cos(i * 1.3) * 40} y2={518 + Math.sin(i * 1.3) * 40} stroke={C.amberLight} strokeWidth={3} filter="url(#cn-bloom)" />
              ))}
            </g>
            {/* motor and lead screw */}
            <rect x={250} y={610} width={150} height={80} rx={14} fill="url(#cn-metal)" />
            <g className="c2-powered">
              <rect x={250} y={610} width={150} height={80} rx={14} fill={C.amber} opacity={0.25} filter="url(#cn-bloom)" />
            </g>
            <clipPath id="c2-screw-p">
              <rect x={400} y={636} width={500} height={28} />
            </clipPath>
            <rect x={400} y={636} width={500} height={28} rx={4} fill={C.metalDark} />
            <g clipPath="url(#c2-screw-p)">
              <g className="c2-threads">
                {Array.from({ length: 50 }, (_, i) => (
                  <line key={i} x1={390 + i * 12} y1={636} x2={402 + i * 12} y2={664} stroke={C.metal} strokeWidth={4} />
                ))}
              </g>
            </g>
            <g className="c2-nut">
              <rect x={480} y={620} width={70} height={60} rx={6} fill={C.slate} />
              <rect x={480} y={620} width={70} height={10} rx={4} fill={C.mist} opacity={0.4} />
              {/* push rod to the finger's crank */}
              <line x1={550} y1={630} x2={830} y2={610} stroke={C.bone} strokeWidth={10} strokeLinecap="round" />
            </g>
            <rect x={920} y={600} width={160} height={120} rx={12} fill={C.carbon} />
            <line x1={980} y1={610} x2={1000} y2={600} stroke={C.bone} strokeWidth={10} strokeLinecap="round" />
            <circle cx={1000} cy={600} r={24} fill={C.ink3} />
            {/* the bottle */}
            <g className="c2-bottle">
              <path d="M1170 300 L1170 360 Q1130 390 1130 440 L1130 700 Q1130 718 1150 718 L1270 718 Q1290 718 1290 700 L1290 440 Q1290 390 1250 360 L1250 300 Z" fill={C.cyanDark} opacity={0.55} />
              <path d="M1150 460 L1150 700" stroke={C.white} strokeWidth={8} opacity={0.25} strokeLinecap="round" />
              <rect x={1165} y={280} width={90} height={26} rx={5} fill={C.slate} />
              <rect x={1130} y={500} width={160} height={110} fill={C.ink3} opacity={0.6} />
            </g>
            <RFinger x={LOCK_FINGER.x} y={LOCK_FINGER.y} rot={-90} s={1.2} lens={LENS} cls="c2l" angles={[0, 4, 4]} />
            {/* the wattmeter */}
            <g transform="translate(250 330)">
              <rect x={-20} y={-60} width={240} height={110} rx={12} fill={C.ink} opacity={0.75} stroke={C.slate} />
              <text x={0} y={-24} fill={C.fog} fontFamily={SANS} fontSize={20}>power in</text>
              <Readout className="c2-watts" x={0} y={30} color={C.lime} size={48}>3.2 W</Readout>
            </g>
            <Label className="c2-l-lock" x={1210} y={470} tx={1540} ty={190} text="self-locking: holds at 0 W" color={C.amber} anchor="end" />
          </g>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** A motor behind a gearbox block, the finger's base on top at (x, y). */
function GearboxStack({ x, y, label, big = false }: { x: number; y: number; label: string; big?: boolean }) {
  return (
    <g>
      {/* motor */}
      {big ? (
        <g>
          <rect x={x - 330} y={y + 10} width={230} height={110} rx={18} fill="url(#cn-metal)" />
          <rect x={x - 330} y={y + 10} width={230} height={110} rx={18} fill={C.amber} opacity={0.12} />
          <rect x={x - 300} y={y + 22} width={170} height={12} rx={6} fill={C.white} opacity={0.4} />
        </g>
      ) : (
        <g>
          <rect x={x - 230} y={y + 34} width={130} height={60} rx={12} fill="url(#cn-metal)" />
          <rect x={x - 220} y={y + 40} width={100} height={8} rx={4} fill={C.white} opacity={0.4} />
        </g>
      )}
      {/* gearbox with a window */}
      <rect x={x - 110} y={y - 8} width={220} height={128} rx={14} fill={C.carbon} />
      <rect x={x - 110} y={y - 8} width={220} height={12} rx={6} fill={C.slate} opacity={0.6} />
      <g className="c2-xr" opacity={0}>
        <rect x={x - 80} y={y + 16} width={120} height={84} rx={8} fill={C.ink} opacity={0.8} />
        <g transform={`translate(${x - 40} ${y + 58})`}>
          <Gear r={30} n={14} className="c2-wgear" hub={0.3} />
        </g>
        <g transform={`translate(${x + 4} ${y + 40})`}>
          <Gear r={14} n={7} hub={0.3} color={C.amberLight} />
        </g>
      </g>
      <text x={x + 90} y={y + 105} textAnchor="end" fill={C.amber} fontFamily={MONO} fontSize={22} fontWeight={700}>
        {label}
      </text>
    </g>
  )
}

/** The ratio play: the finger, the dial, the three tests. Drawn from React state. */
function RatioPlay({ v, setV, ratio, rText, big, offer, setBig, lift, bump, push, ticks, enabled }: {
  v: number
  setV: (v: number) => void
  ratio: number
  rText: string
  big: boolean
  offer: boolean
  setBig: () => void
  lift: boolean
  bump: boolean
  push: boolean
  ticks: { at: number; text: string }[]
  enabled: boolean
}) {
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : n < 10 ? n.toFixed(1) : Math.round(n).toString())
  const spinDur = clamp(0.25 * ratio, 0.3, 60)
  return (
    <g className="c2-play">
      <Pool x={PLAY_BASE.x} y={420} r={520} color="key" opacity={0.5} />
      <rect x={-800} y={730} width={3200} height={700} fill={C.ink2} opacity={0.8} />
      {/* the finger on its drive */}
      <g>
        {big && <Pool x={PLAY_BASE.x - 190} y={PLAY_BASE.y + 70} r={180} color="amber" opacity={0.5} />}
        <rect x={PLAY_BASE.x - 110} y={PLAY_BASE.y - 8} width={220} height={128} rx={14} fill={C.carbon} />
        <rect x={PLAY_BASE.x - 80} y={PLAY_BASE.y + 16} width={120} height={84} rx={8} fill={C.ink} opacity={0.8} />
        <g transform={`translate(${PLAY_BASE.x - 40} ${PLAY_BASE.y + 58})`}>
          <g className="mu-spin" style={{ animationDuration: `${spinDur}s` }}>
            <Gear r={30} n={14} hub={0.3} />
          </g>
        </g>
        {big ? (
          <g>
            <rect x={PLAY_BASE.x - 340} y={PLAY_BASE.y + 10} width={230} height={110} rx={18} fill="url(#cn-metal)" />
            <rect x={PLAY_BASE.x - 310} y={PLAY_BASE.y + 22} width={170} height={12} rx={6} fill={C.white} opacity={0.4} />
            <text x={40} y={PLAY_BASE.y + 150} textAnchor="start" fill={C.amber} fontFamily={SANS} fontSize={20}>bigger motor, in the forearm</text>
          </g>
        ) : (
          <rect x={PLAY_BASE.x - 230} y={PLAY_BASE.y + 34} width={120} height={56} rx={12} fill="url(#cn-metal)" />
        )}
        <RFinger x={PLAY_BASE.x} y={PLAY_BASE.y} rot={-90} s={1.25} lens={LENS} angles={[12, 16, 12]} />
        <text x={PLAY_BASE.x + 90} y={PLAY_BASE.y + 105} textAnchor="end" fill={C.amber} fontFamily={MONO} fontSize={24} fontWeight={700}>
          {rText}:1
        </text>
      </g>
      {/* what the ratio does */}
      <g fontFamily={MONO} fontSize={24}>
        <text x={560} y={300} fill={C.amber}>torque ×{fmt(ratio)}</text>
        <text x={560} y={346} fill={C.cyan}>speed ÷{fmt(ratio)}</text>
        <text x={560} y={392} fill={ratio > 50 ? C.danger : C.mist}>felt inertia ×{fmt(ratio * ratio)}</text>
      </g>
      <Slider x={110} y={835} w={640} value={v} onChange={setV} color={C.amber} label="gear ratio" valueText={`${rText}:1`} tutor="gear-ratio" disabled={!enabled} ticks={ticks} />
      {offer && (
        <Chip x={1090} y={835} w={470} text={big ? 'bigger motor, in the forearm ✓' : 'a bigger motor (moved to the forearm)'} color={C.amber} active={big} onClick={setBig} tutor="bigger-motor" className="c2-offer" disabled={!enabled && !big} />
      )}
      {/* the three tests */}
      <TestLamp y={170} ok={lift} title="lift a full jug" note={lift ? 'it rises' : 'too weak'}>
        <g className={lift ? 'mu-bob' : 'mu-strain'}>
          <RFinger x={0} y={-40} rot={0} s={0.42} lens={LENS} angles={[0, 70, 70]} />
          <g transform="translate(118 10)">
            {/* a water jug with a carry handle on top */}
            <path d="M-12 -30 q 0 -34 30 -34 q 30 0 30 34" stroke={C.mist} strokeWidth={7} fill="none" />
            <path d="M-40 -26 L60 -26 Q72 -26 72 -12 L72 58 Q72 70 60 70 L-28 70 Q-40 70 -40 58 L-40 -6 L-56 -14 L-56 -30 Z" fill={C.cyanDark} opacity={0.75} />
            <path d="M-38 12 Q-10 4 18 12 T70 12 L70 58 Q70 68 60 68 L-28 68 Q-38 68 -38 58 Z" fill={C.cyan} opacity={0.55} />
            <rect x={-62} y={-36} width={14} height={14} rx={3} fill={C.slate} />
          </g>
        </g>
      </TestLamp>
      <TestLamp y={385} ok={bump} title="survive a bump" note={bump ? 'it recoils' : 'teeth crack'}>
        <rect x={-20} y={50} width={80} height={30} rx={6} fill={C.carbon} />
        <g className={bump ? 'mu-recoil' : undefined} style={{ transformOrigin: '20px 50px' }}>
          <RFinger x={20} y={50} rot={-80} s={0.42} lens={LENS} angles={[0, 0, 0]} />
        </g>
        <g className="mu-drop">
          <circle cx={55} cy={-86} r={14} fill={C.metal} />
        </g>
        {!bump && (
          <g className="mu-crack">
            <path d="M10 56 l 10 8 l -6 8 l 12 10" stroke={C.danger} strokeWidth={3} fill="none" filter="url(#cn-bloom)" />
            <path d="M40 54 l 12 -10 M30 60 l -14 -8" stroke={C.danger} strokeWidth={3} filter="url(#cn-bloom)" />
          </g>
        )}
      </TestLamp>
      <TestLamp y={600} ok={push} title="let a person push it aside" note={push ? 'it gives way' : 'it won’t budge'}>
        <rect x={-20} y={50} width={80} height={30} rx={6} fill={C.carbon} />
        <g className={push ? 'mu-yield' : undefined} style={{ transformOrigin: '20px 50px' }}>
          <RFinger x={20} y={50} rot={-90} s={0.42} lens={LENS} angles={[0, 0, 0]} />
        </g>
        <g className="mu-push">
          <path d="M70 -60 L190 -60" stroke={C.skinA} strokeWidth={24} strokeLinecap="round" />
          <path d="M150 -60 L260 -60" stroke="#3d4a6b" strokeWidth={34} strokeLinecap="round" />
        </g>
      </TestLamp>
    </g>
  )
}

function TestLamp({ y, ok, title, note, children }: { y: number; ok: boolean; title: string; note: string; children: React.ReactNode }) {
  const col = ok ? C.lime : C.danger
  return (
    <g>
      <circle cx={940} cy={y} r={20} fill={col} opacity={0.9} filter="url(#cn-bloom)" />
      <circle cx={940} cy={y} r={9} fill={ok ? C.limeLight : '#ffb3ad'} />
      <text x={976} y={y - 4} fill={C.paper} fontFamily={SANS} fontSize={26} fontWeight={500}>
        {title}
      </text>
      <text x={976} y={y + 28} fill={col} fontFamily={MONO} fontSize={20}>
        {note}
      </text>
      <g transform={`translate(1310 ${y + 40})`}>{children}</g>
    </g>
  )
}

export const ch2: Chapter = {
  id: 'gears',
  title: 'The gear bargain',
  cues: CUES,
  Scene: Ch2Gears,
  enter: { type: 'zoom', x: 240, y: 380 },
  deeper: [GearingReading],
}
