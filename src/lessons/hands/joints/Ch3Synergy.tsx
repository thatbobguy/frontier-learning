import gsap from 'gsap'
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { rng } from '../../../art2/fx'
import { camera } from '../../../cine/camera'
import { GRASPS, handSegments, makeHandStore, useHandStore, type HandPose, type HandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Big, Chip, Dust, Label, Pool, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { Hand3DX, projector } from './hand4'
import { Mono, Tick, chime, useVals, type ValStore } from './parts'
import { SynergyReading } from './readings'
import { TARGETS, poseDistance, synergyPose } from './synergy'

export const CUES: Cue[] = [
  { id: 'study', say: 'In 1998, three scientists asked people to shape their hand around fifty-seven imagined objects, and recorded every joint.' },
  { id: 'two', say: 'They found something remarkable. Just two patterns of movement, mixed together, explained more than eighty percent of every hand shape.' },
  { id: 'mix', say: 'Here are the two patterns as two sliders. Mix them to match each grasp.', play: true },
  { id: 'limits', say: 'But synergies describe how we grab things, not how we move them once they’re in the hand. Spinning a pen or flipping a coin across your knuckles needs fingers that move on their own.' },
  { id: 'why', say: 'So the number of motors you choose depends on the job: grabbing, or manipulating.' },
]

const STATE = [
  'A dark room. Ada, the data scientist, sits at a table in silhouette, a laptop glowing lime with joint data. Behind her a tall lit wall fills, one by one, with fifty-seven dark hand silhouettes in slightly different grasps. This is the 1998 Santello, Flanders and Soechting study: people shaped their hands for 57 imagined objects while every joint angle was recorded.',
  'The wall goes dark and each of the 57 hand shapes collapses into a lime dot, flying onto a scatter plot with two lime axes: "pattern 1: close everything" and "pattern 2: thumb across vs spread". The dots line up along the two axes. A big "80%+" appears: two patterns (principal components) explain over 80% of the variation in hand shape.',
  '',
  'Left: a human hand driven by only the two sliders tries to roll a pen between thumb and index; the whole hand clenches together and the pen drops (red flash). Right: a fully actuated white robot hand rolls a pen smoothly from its fingertips into its palm, every joint moving on its own. Point: synergies cover grasping, not in-hand manipulation.',
  'A horizontal scale from "grasping" (few motors, synergies) to "in-hand manipulation" (many motors), with real hands placed along it: Pisa/IIT SoftHand (1 to 2 motors), Inspire (6), LEAP Hand (16), Shadow Hand (20). Point: choose the motor count by the job.',
]

/* ---------------- the 57 grasps ---------------- */
interface Ghost {
  a: number
  b: number
  pose: HandPose
  gx: number
  gy: number
}
const GRID = { x0: 250, y0: 160, dx: 122, dy: 98, cols: 10 }
const PLOT = { x0: 400, x1: 1200, cy: 480, h: 300 }
const plotX = (a: number) => PLOT.x0 + a * (PLOT.x1 - PLOT.x0)
const plotY = (b: number) => PLOT.cy - b * PLOT.h * 0.95

const GHOSTS: Ghost[] = (() => {
  const r = rng(57)
  return Array.from({ length: 57 }, (_, i) => {
    const a = Math.min(1, Math.max(0, r() * 1.05 - 0.02))
    const b = Math.max(-1, Math.min(1, (r() + r() + r() - 1.5) * 1.1))
    const bb = b * 0.5
    const base = synergyPose(a, b)
    // a little of everything else: the 20% the two patterns don't explain
    const jitter = (v: number[]) => v.map((x, k) => (k < 3 ? x + (r() - 0.5) * 10 : x)) as [number, number, number, number]
    const pose = { ...base, index: jitter(base.index), middle: jitter(base.middle), ring: jitter(base.ring), little: jitter(base.little) }
    return { a, b: bb, pose, gx: GRID.x0 + (i % GRID.cols) * GRID.dx, gy: GRID.y0 + Math.floor(i / GRID.cols) * GRID.dy }
  })
})()

/** One still ghost hand (never re-renders). */
const GhostHand = memo(function GhostHand({ g }: { g: Ghost }) {
  const store = useMemo(() => makeHandStore({ pose: g.pose, view: { yaw: -40, pitch: 6, roll: 0, s: 0.36 } }), [g])
  return <Hand3DX store={store} x={g.gx} y={g.gy + 30} look="silhouette" arm={36} />
})

/* ---------------- the play ---------------- */
const HAND = { x: 1040, y: 790 }
const VIEW = { yaw: -48, pitch: 12, roll: 0, s: 2.35 }
const MATCH = 5.5

/* ---------------- the pen ---------------- */
const PH = { x: 470, y: 760 }
const RH = { x: 1150, y: 760 }
const PEN_VIEW_H = { yaw: -70, pitch: 10, roll: 0, s: 2.0 }
const PEN_VIEW_R = { yaw: -70, pitch: 10, roll: 0, s: 2.0 }
const TRIPOD: HandPose = { ...GRASPS.tripod }
const ROLLED: HandPose = { ...GRASPS.tripod, index: [70, 84, 44, 2], middle: [74, 86, 46, 0], thumb: [62, 36, 34, 22] }

/** A pen held by a hand: between the thumb, index (and middle) tips, rolled towards the palm by `u`. */
function Pen({ store, x, y, v, k }: { store: HandStore; x: number; y: number; v: ValStore<{ u: number; drop: number; spin: number; uR: number; spinR: number }>; k: 'h' | 'r' }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  useEffect(() => v.subscribe(force), [v])
  const proj = projector(store.state.view, x, y)
  const { tips, H } = handSegments(store.state.pose)
  const t = proj(tips.thumb)
  const i = proj(tips.index)
  const m = proj(tips.middle)
  const palm = proj([H[1] * 46 + H[2] * 30, H[4] * 46 + H[5] * 30, H[7] * 46 + H[8] * 30])
  const grip = k === 'h' ? { x: (t.x + i.x) / 2, y: (t.y + i.y) / 2 } : { x: (t.x + i.x + m.x) / 3, y: (t.y + i.y + m.y) / 3 }
  const u = k === 'h' ? v.state.u : v.state.uR
  const c = { x: grip.x + (palm.x - grip.x) * u, y: grip.y + (palm.y - grip.y) * u + (k === 'h' ? v.state.drop : 0) }
  const spin = k === 'h' ? v.state.spin : v.state.spinR
  return (
    <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${spin.toFixed(1)})`} pointerEvents="none">
      <rect x={-120} y={-9} width={240} height={18} rx={9} fill={k === 'h' ? '#3a6ea5' : C.gold} />
      <rect x={-120} y={-9} width={240} height={6} rx={3} fill={C.white} opacity={0.3} />
      <path d="M120 -9 L150 0 L120 9 Z" fill={C.bone} />
      <rect x={-130} y={-9} width={18} height={18} rx={4} fill={C.ink3} />
    </g>
  )
}

/* ---------------- motors vs job ---------------- */
const SCALE = { x0: 220, x1: 1380, y: 700 }
const HANDS: { name: string; motors: string; at: number; pose: HandPose; note: string }[] = [
  { name: 'Pisa/IIT SoftHand', motors: '1–2 motors', at: 0.06, pose: GRASPS.power, note: 'one tendon, synergies' },
  { name: 'Inspire RH56', motors: '6 motors', at: 0.32, pose: GRASPS.relaxed, note: '12 joints' },
  { name: 'LEAP Hand', motors: '16 motors', at: 0.68, pose: GRASPS.tripod, note: '4 fingers' },
  { name: 'Shadow Hand', motors: '20 motors', at: 0.94, pose: GRASPS.pinch, note: '24 joints' },
]
const ScaleHand = memo(function ScaleHand({ pose, x }: { pose: HandPose; x: number }) {
  const store = useMemo(() => makeHandStore({ pose, view: { yaw: -30, pitch: 8, roll: 0, s: 1.15 } }), [pose])
  return <Hand3DX store={store} x={x} y={SCALE.y - 70} look="robot" arm={60} light={[0.6, -0.7]} />
})

export function Ch3Synergy({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const human = useHandStore({ pose: GRASPS.pinch, view: PEN_VIEW_H })
  const robot = useHandStore({ pose: TRIPOD, view: PEN_VIEW_R })
  const pen = useVals({ u: 0, drop: 0, spin: 0, uR: 0, spinR: 0 })
  const playHand = useHandStore({ pose: synergyPose(0.2, 0), view: VIEW })
  const targetHand = useHandStore({ pose: synergyPose(TARGETS[0].s1, TARGETS[0].s2), view: VIEW })

  const [s1, setS1] = useState(0.2)
  const [v2, setV2] = useState(0.5)
  const [ti, setTi] = useState(0)
  const [matched, setMatched] = useState<string[]>([])
  const [flash, setFlash] = useState(false)
  const [done, setDone] = useState(false)
  const inPlay = cueIndex === 2
  const target = TARGETS[ti % TARGETS.length]
  const s2 = v2 * 2 - 1
  const dist = poseDistance(synergyPose(s1, s2), synergyPose(target.s1, target.s2))

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(world.current, { x: 800, y: 470, zoom: 1.08 })

      /* b0: the study: a dark room, a wall filling with fifty-seven hands. */
      tl.addLabel('b0', 0)
      cam.to(tl, { x: 760, y: 450, zoom: 1 }, 0, 7.6, 'sine.inOut')
      tl.fromTo('.s-ghost', { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.075, immediateRender: false }, 0.6)
      fade(tl, '.s-lab-57', 1, 5.2, 0.6)

      /* b1: collapse to dots on two axes. */
      const b1 = 7.8
      tl.addLabel('b1', b1)
      fade(tl, '.s-lab-57', 0, b1, 0.4, 1)
      fade(tl, '.s-room', 0, b1, 1.2, 1)
      fade(tl, '.s-wall', 0.0, b1 + 0.6, 1.2, 1)
      fade(tl, '.s-ghosts', 0, b1 + 0.8, 1.2, 1)
      tl.fromTo('.s-dot', { x: (i) => GHOSTS[i].gx - plotX(GHOSTS[i].a), y: (i) => GHOSTS[i].gy - plotY(GHOSTS[i].b), opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.4, ease: 'power3.inOut', stagger: 0.012, immediateRender: false }, b1 + 0.5)
      tl.fromTo('.s-axis', { strokeDashoffset: 1000, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.2, stagger: 0.3, immediateRender: false }, b1 + 1.8)
      fade(tl, '.s-ax1', 1, b1 + 2.6, 0.5)
      fade(tl, '.s-ax2', 1, b1 + 3.2, 0.5)
      fade(tl, '.s-80', 1, b1 + 4.6, 0.8)
      tl.fromTo('.s-80', { scale: 1.3, svgOrigin: '1310 220' }, { scale: 1, svgOrigin: '1310 220', duration: 0.8, ease: 'back.out(2)', immediateRender: false }, b1 + 4.6)
      cam.to(tl, { x: 800, y: 470, zoom: 1.05 }, b1, 8.2, 'sine.inOut')

      /* b2: the play. */
      const b2 = b1 + 8.6
      tl.addLabel('b2', b2)
      fade(tl, '.s-plot', 0, b2, 0.5, 1)
      fade(tl, '.s-play', 1, b2 + 0.3, 0.6)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b2, 0.8)

      /* b3: grasping is not manipulating. */
      const b3 = b2 + 1.2
      tl.addLabel('b3', b3)
      fade(tl, '.s-play', 0, b3, 0.5, 1)
      fade(tl, '.s-pens', 1, b3 + 0.3, 0.6)
      cam.to(tl, { x: 500, y: 520, zoom: 1.25 }, b3, 1.4)
      fade(tl, '.s-lab-syn', 1, b3 + 0.8, 0.5)
      // the two-slider hand tries to roll the pen: everything clenches together
      human.to(tl, { pose: GRASPS.power }, b3 + 2.2, 0.5, 'power3.in')
      pen.to(tl, { u: 0.25, spin: 20 }, b3 + 2.2, 0.4)
      pen.to(tl, { drop: 520, spin: 160 }, b3 + 2.55, 0.9, 'power2.in')
      cam.shake(tl, b3 + 3.4, 0.5, 0.35)
      fade(tl, '.s-fail', 0.8, b3 + 2.6, 0.2)
      fade(tl, '.s-fail', 0, b3 + 3.4, 0.8, 0.8)
      fade(tl, '.s-lab-drop', 1, b3 + 3.0, 0.5)
      // the fully actuated hand rolls it into the palm
      cam.to(tl, { x: 1100, y: 520, zoom: 1.25 }, b3 + 5.6, 1.6)
      fade(tl, '.s-lab-full', 1, b3 + 7.2, 0.5)
      robot.to(tl, { pose: ROLLED, touch: { thumb: 0.6, index: 0.6, middle: 0.6 } }, b3 + 7.0, 2.4, 'sine.inOut')
      pen.to(tl, { uR: 0.85, spinR: 210 }, b3 + 7.0, 2.4, 'sine.inOut')
      robot.to(tl, { pose: TRIPOD, touch: { thumb: 0.4, index: 0.4, middle: 0.4 } }, b3 + 9.6, 2.0, 'sine.inOut')
      pen.to(tl, { uR: 0, spinR: 400 }, b3 + 9.6, 2.0, 'sine.inOut')
      cam.to(tl, { x: 800, y: 500, zoom: 1.0 }, b3 + 10.8, 2.4)

      /* b4: choose motors by the job. */
      const b4 = b3 + 14
      tl.addLabel('b4', b4)
      fade(tl, '.s-pens', 0, b4, 0.5, 1)
      fade(tl, '.s-scale', 1, b4 + 0.3, 0.6)
      tl.fromTo('.s-scaleline', { strokeDashoffset: 1300 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, b4 + 0.4)
      tl.fromTo('.s-sh', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.5, immediateRender: false }, b4 + 1.0)
      cam.to(tl, { x: 800, y: 470, zoom: 0.98 }, b4, 0.01)
      cam.to(tl, { x: 800, y: 460, zoom: 1.04 }, b4 + 0.1, 6, 'sine.inOut')
      tl.to({}, { duration: 0.2 }, b4 + 6.2)
    },
    [human, robot, pen],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.s-screen', { opacity: 0.55, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.s-dotpulse', { opacity: 0.4, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: 0.05, repeat: -1, yoyo: true } })
    gsap.to('.s-ada', { y: -2, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the play ---------------- */
  useEffect(() => {
    playHand.state.pose = synergyPose(s1, s2)
    playHand.notify()
  }, [s1, s2, playHand])
  useEffect(() => {
    targetHand.state.pose = synergyPose(target.s1, target.s2)
    targetHand.notify()
  }, [target, targetHand])

  const busy = useRef(false)
  useEffect(() => {
    if (!inPlay || done || busy.current) return
    if (dist <= MATCH && !matched.includes(target.id)) {
      busy.current = true
      chime()
      setFlash(true)
      const m = [...matched, target.id]
      setMatched(m)
      emit({ type: 'progress', detail: `matched the ${target.id} grasp (${m.length} of 3)` })
      window.setTimeout(() => {
        setFlash(false)
        busy.current = false
        if (m.length >= 3) {
          setDone(true)
          memory.jointsSynergy = m
          emit({ type: 'attempt', correct: true, detail: 'matched three grasps with two synergy sliders' })
          void say('Two sliders, three very different grasps. That’s why a hand with just a few motors can still grab most things.').then(() => onPlayDone())
        } else {
          let n = ti + 1
          while (m.includes(TARGETS[n % TARGETS.length].id)) n++
          setTi(n)
        }
      }, 1100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, inPlay])

  const skip = () => {
    if (!inPlay || done || busy.current) return
    let n = ti + 1
    while (matched.includes(TARGETS[n % TARGETS.length].id)) n++
    setTi(n)
    emit({ type: 'progress', detail: `skipped to another grasp: ${TARGETS[n % TARGETS.length].id}` })
  }

  useEffect(() => {
    if (inPlay) {
      reportState(
        'The play: a big human hand driven by two lime sliders. Slider 1 "pattern 1: close everything" curls every joint together from open to a power grasp. Slider 2 "pattern 2" goes from "spread" (left: fingers fan out, thumb out) to "thumb across" (right: thumb swings across to meet the index tip, the others tuck). A lime outline behind the hand shows the target grasp; a match meter fills as the hand gets close. ' +
          `Target now: ${target.name}. The sliders read pattern 1 = ${s1.toFixed(2)}, pattern 2 = ${s2.toFixed(2)}; the hand is ${dist.toFixed(1)} degrees (mean per joint) from the target, match at ${MATCH}. Matched so far: ${matched.length ? matched.join(', ') : 'none'} (three needed). ` +
          'Correct settings: power grasp = slider 1 fully right, slider 2 in the middle; pinch = slider 1 about 70%, slider 2 fully right; flat spread hand = slider 1 fully left, slider 2 fully left; relaxed = slider 1 about 40%, slider 2 just right of the middle. A "another grasp" chip skips to a different target. Likely mix-up: trying to do everything with slider 1, or not realising slider 2 has two directions.',
      )
      setHints(['The first slider closes everything together.', 'The second one trades the thumb against the other fingers.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [inPlay, cueIndex, target, s1, s2, dist, matched, reportState, setHints])

  const closeness = Math.max(0, Math.min(1, 1 - (dist - MATCH) / 30))

  return (
    <g ref={root}>
      <defs>
        <filter id="s-outline" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={5} result="d" />
          <feFlood floodColor={C.lime} result="c" />
          <feComposite in="c" in2="d" operator="in" result="ring" />
          <feFlood floodColor={C.lime} floodOpacity={0.12} result="c2" />
          <feComposite in="c2" in2="SourceAlpha" operator="in" result="fill" />
          <feComposite in="ring" in2="SourceAlpha" operator="out" result="edge" />
          <feMerge>
            <feMergeNode in="fill" />
            <feMergeNode in="edge" />
          </feMerge>
        </filter>
      </defs>
      <g ref={world}>
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <rect x={-800} y={-600} width={3200} height={2100} fill="url(#cn-grid-big)" opacity={0.35} />
          {/* the lit wall of hands */}
          <g className="s-wall">
            <rect x={150} y={70} width={1300} height={640} rx={6} fill={C.keyDeep} opacity={0.5} />
            <circle cx={800} cy={380} r={760} fill="url(#cn-pool-key)" opacity={0.9} />
            <rect x={150} y={70} width={1300} height={640} rx={6} fill="none" stroke={C.ink3} strokeWidth={16} />
          </g>
          <g className="s-ghosts">
            {GHOSTS.map((g, i) => (
              <g key={i} className="s-ghost" opacity={0}>
                <GhostHand g={g} />
              </g>
            ))}
          </g>
        </g>
        <g data-depth="1">
          {/* Ada at the table, in silhouette against the wall */}
          <g className="s-room" pointerEvents="none">
            <rect x={-400} y={760} width={2400} height={400} fill={C.ink} />
            <g className="s-ada">
              <Person name="s-ada" x={250} y={900} s={1.5} hair="curls" glasses top="#2f5d62" topDark="#1c3a3e" skin={C.skinC} skinDark={C.skinCDark} light="back" pose={{ ...POSES.sitForward, y: 64 }} silhouette={C.ink} />
            </g>
            <rect x={300} y={740} width={420} height={20} rx={4} fill={C.ink2} />
            <rect x={340} y={760} width={14} height={160} fill={C.ink2} />
            <rect x={680} y={760} width={14} height={160} fill={C.ink2} />
            {/* the laptop, glowing with joint angles */}
            <path d="M470 738 L600 738 L630 650 L500 650 Z" fill={C.ink3} />
            <g className="s-screen" opacity={0.9}>
              <path d="M505 656 L622 656 L596 732 L478 732 Z" fill={C.limeDark} opacity={0.5} />
              {[0, 1, 2, 3, 4].map((k) => (
                <path key={k} d={`M${500 - k * 3} ${670 + k * 12} l ${40 + ((k * 37) % 60)} 0`} stroke={C.lime} strokeWidth={3} />
              ))}
            </g>
            <Pool x={560} y={690} r={180} color="lime" opacity={0.35} />
            <Label className="s-lab-57" x={1384} y={672} tx={1384} ty={740} text="57 imagined objects, every joint recorded" sub="Santello, Flanders & Soechting, 1998" color={C.keyLight} anchor="end" size={28} />
          </g>

          {/* the plot */}
          <g className="s-plot" pointerEvents="none">
            <path className="s-axis" d={`M${PLOT.x0 - 30} ${PLOT.cy} L${PLOT.x1 + 40} ${PLOT.cy}`} stroke={C.lime} strokeWidth={4} strokeDasharray="1000" strokeDashoffset="1000" opacity={0} markerEnd="url(#cn-arrow)" />
            <path className="s-axis" d={`M${(PLOT.x0 + PLOT.x1) / 2} ${PLOT.cy + PLOT.h + 20} L${(PLOT.x0 + PLOT.x1) / 2} ${PLOT.cy - PLOT.h - 30}`} stroke={C.lime} strokeWidth={4} strokeDasharray="1000" strokeDashoffset="1000" opacity={0} markerEnd="url(#cn-arrow)" />
            {GHOSTS.map((g, i) => (
              <g key={i} transform={`translate(${plotX(g.a).toFixed(1)} ${plotY(g.b).toFixed(1)})`}>
                <g className="s-dot" opacity={0}>
                  <circle r={14} fill={C.lime} opacity={0.18} />
                  <circle className="s-dotpulse" r={6} fill={C.lime} />
                </g>
              </g>
            ))}
            <ellipse className="s-ax1" cx={800} cy={PLOT.cy} rx={430} ry={150} fill="none" stroke={C.lime} strokeWidth={2} strokeDasharray="4 10" opacity={0} />
            <g className="s-ax1" opacity={0}>
              <text x={PLOT.x1 + 64} y={PLOT.cy - 8} fill={C.lime} fontFamily={SANS} fontSize={30} fontWeight={700}>
                pattern 1
              </text>
              <text x={PLOT.x1 + 64} y={PLOT.cy + 26} fill={C.lime} fontFamily={SANS} fontSize={24} opacity={0.85}>
                close everything
              </text>
            </g>
            <g className="s-ax2" opacity={0}>
              <text x={824} y={PLOT.cy - PLOT.h - 4} fill={C.lime} fontFamily={SANS} fontSize={30} fontWeight={700}>
                pattern 2
              </text>
              <text x={824} y={PLOT.cy - PLOT.h + 28} fill={C.lime} fontFamily={SANS} fontSize={24} opacity={0.85}>
                thumb across ↑ · spread ↓
              </text>
            </g>
            <g className="s-80" opacity={0}>
              <Big x={1310} y={250} size={130} color={C.paper} hidden={false}>
                80%+
              </Big>
              <text x={1310} y={296} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={26}>
                of every hand shape
              </text>
            </g>
          </g>

          {/* the play */}
          <g className="s-play" opacity={0}>
            {inPlay && (
              <g>
                <Pool x={HAND.x} y={HAND.y - 260} r={520} color="key" opacity={0.6} />
                <g filter="url(#s-outline)" opacity={flash ? 1 : 0.85}>
                  <Hand3DX store={targetHand} x={HAND.x} y={HAND.y} look="silhouette" arm={140} />
                </g>
                <Hand3DX store={playHand} x={HAND.x} y={HAND.y} look="human" arm={140} light={[0.7, -0.6]} tutor="synergy-hand" />
                {flash && <Pool x={HAND.x} y={HAND.y - 260} r={420} color="lime" opacity={0.6} />}
                <text x={120} y={150} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                  Match: {target.name}
                </text>
                <g transform="translate(120 192)">
                  {[0, 1, 2].map((k) => (
                    <circle key={k} cx={k * 40} r={13} fill={k < matched.length ? C.lime : 'none'} stroke={k < matched.length ? C.lime : C.mist} strokeWidth={2.5} />
                  ))}
                  <Mono x={130} y={7} size={18}>
                    {matched.length} of 3 matched
                  </Mono>
                </g>
                <Slider x={130} y={420} w={480} value={s1} onChange={setS1} color={C.lime} label="pattern 1: close everything" valueText={`${Math.round(s1 * 100)}%`} tutor="slider-pattern-1" ticks={[{ at: 0, text: 'open' }, { at: 1, text: 'closed' }]} disabled={done} />
                <Slider x={130} y={590} w={480} value={v2} onChange={setV2} color={C.lime} label="pattern 2: spread ↔ thumb across" valueText={s2 > 0.05 ? 'thumb across' : s2 < -0.05 ? 'spread' : 'neutral'} tutor="slider-pattern-2" ticks={[{ at: 0, text: 'spread' }, { at: 0.5, text: '·' }, { at: 1, text: 'thumb across' }]} disabled={done} />
                <text x={130} y={700} fill={C.fog} fontFamily={SANS} fontSize={20}>
                  match
                </text>
                <rect x={200} y={688} width={410} height={14} rx={7} fill={C.ink3} />
                <rect x={200} y={688} width={410 * closeness} height={14} rx={7} fill={closeness > 0.97 ? C.lime : C.limeDark} />
                <Chip x={250} y={790} w={240} h={52} text="another grasp" color={C.mist} onClick={skip} disabled={done} tutor="another-grasp" />
                {flash && <Tick x={HAND.x + 260} y={260} s={1.6} color={C.lime} className="s-tick-on" />}
              </g>
            )}
          </g>

          {/* grasping vs manipulating */}
          <g className="s-pens" opacity={0} pointerEvents="none">
            <Pool x={PH.x} y={PH.y - 260} r={420} color="key" opacity={0.6} />
            <Pool x={RH.x} y={RH.y - 260} r={420} color="rim" opacity={0.5} />
            <Hand3DX store={human} x={PH.x} y={PH.y} look="human" arm={160} light={[0.7, -0.6]} />
            <Pen store={human} x={PH.x} y={PH.y} v={pen} k="h" />
            <g className="s-fail" opacity={0}>
              <Pool x={PH.x} y={PH.y - 220} r={360} color="danger" opacity={0.8} />
            </g>
            <Hand3DX store={robot} x={RH.x} y={RH.y} look="robot" arm={160} light={[0.6, -0.7]} />
            <Pen store={robot} x={RH.x} y={RH.y} v={pen} k="r" />
            <Label className="s-lab-syn" x={PH.x + 10} y={PH.y - 340} tx={PH.x - 230} ty={PH.y - 470} text="two patterns only" color={C.lime} />
            <Label className="s-lab-drop" x={PH.x + 60} y={PH.y + 40} tx={PH.x + 200} ty={PH.y + 70} text="everything clenches at once" color={C.danger} />
            <Label className="s-lab-full" x={RH.x + 10} y={RH.y - 340} tx={RH.x + 160} ty={RH.y - 470} text="every joint on its own" sub="in-hand manipulation" color={C.cyan} />
          </g>

          {/* motors by the job */}
          <g className="s-scale" opacity={0} pointerEvents="none">
            <path className="s-scaleline" d={`M${SCALE.x0} ${SCALE.y} L${SCALE.x1} ${SCALE.y}`} stroke={C.amber} strokeWidth={4} strokeDasharray="1300" strokeDashoffset="1300" markerEnd="url(#cn-arrow)" />
            <text x={SCALE.x0} y={SCALE.y + 70} fill={C.paper} fontFamily={SERIF} fontSize={36} fontWeight={600}>
              grasping
            </text>
            <text x={SCALE.x0} y={SCALE.y + 104} fill={C.mist} fontFamily={SANS} fontSize={22}>
              few motors, synergies
            </text>
            <text x={SCALE.x1} y={SCALE.y + 70} textAnchor="end" fill={C.paper} fontFamily={SERIF} fontSize={36} fontWeight={600}>
              in-hand manipulation
            </text>
            <text x={SCALE.x1} y={SCALE.y + 104} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={22}>
              many motors, every joint its own
            </text>
            {HANDS.map((h) => {
              const x = SCALE.x0 + h.at * (SCALE.x1 - SCALE.x0)
              return (
                <g key={h.name} className="s-sh" opacity={0}>
                  <Pool x={x} y={SCALE.y - 260} r={220} color="rim" opacity={0.35} />
                  <g className="hd-drift" style={{ animationDelay: `${-h.at * 9}s` }}>
                    <ScaleHand pose={h.pose} x={x} />
                  </g>
                  <circle cx={x} cy={SCALE.y} r={9} fill={C.amber} />
                  <text x={x} y={SCALE.y - 470} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={24} fontWeight={600}>
                    {h.name}
                  </text>
                  <text x={x} y={SCALE.y - 436} textAnchor="middle" fill={C.amber} fontFamily={MONO} fontSize={24}>
                    {h.motors}
                  </text>
                </g>
              )
            })}
          </g>
          <Dust x={-200} y={0} w={2000} h={900} count={36} seed={31} color={C.keyLight} size={0.7} />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'synergies',
  title: 'The hidden patterns',
  cues: CUES,
  Scene: Ch3Synergy,
  enter: { type: 'dissolve' },
  deeper: [SynergyReading],
}
