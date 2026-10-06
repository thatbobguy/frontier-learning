import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, handSegments, useHandStore, type HandPose, type HandView } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Egg, Label, Pool, Readout, Vignette, fade, useAmbient } from '../shared/kit'
import { HandOverlay, TouchDots, dragIn, projector, resetHand } from './fx'
import { AnatomyReading } from './readings'

export const CUES: Cue[] = [
  { id: 'yours', say: 'Before we build one, let’s study the best hand ever made. Yours.' },
  { id: 'bones', say: 'Twenty-seven bones. And roughly twenty independent ways to move, which engineers call degrees of freedom.' },
  { id: 'forearm', say: 'Here’s a surprise. Most of the muscles that bend your fingers aren’t in your hand at all.' },
  { id: 'strings', say: 'They sit in your forearm and pull on long tendons, like a puppeteer working strings. That keeps your fingers slim, light and quick.' },
  { id: 'pull', say: 'Try it. Pull on each forearm muscle and watch what moves.', play: true },
  { id: 'touch', say: 'And your skin holds about seventeen thousand touch sensors, crowded into your fingertips, reporting pressure, vibration and stretch.' },
  { id: 'system', say: 'Bones, muscles, tendons, nerves, and a brain to run it all. Every robot hand needs an answer for each one.' },
]

const STATE = [
  'A big human hand, warm-lit against black, turns slowly while its fingers flex. The chapter is about to study the human hand as the benchmark for robot hands.',
  'The hand turns to an x-ray of its bones. "27 bones" appears, then small cyan arcs light at each joint while a counter ticks up to about 21 degrees of freedom for the fingers and thumb. A note says the wrist adds 2 more: the count depends on how you count.',
  'The camera moves down from the hand to the forearm, which turns see-through: three amber muscle bellies glow inside it (the deep finger flexor, the thumb flexor, and the extensor on the back). The point: most finger muscles live in the forearm, not the hand.',
  'Cyan tendons glow from the forearm muscles, through the wrist and along each finger; as they pull, the fingers curl. Small rings on the finger bones are labelled as pulleys that stop the tendons bowstringing away from the bone. The point: muscles far away pull strings, which keeps fingers slim and light.',
  '',
  'Thousands of tiny magenta dots fade in over the palm and fingers, crowded most densely at the fingertips: about 17,000 touch sensors in one hand, roughly 2,000 per fingertip. The camera pushes into a fingertip as it touches an egg, and magenta ripples spread. They report pressure, vibration and stretch.',
  'The human hand cross-fades into a robot hand in the same pose, over a blueprint grid. Each layer is labelled with its robot counterpart: bones become links, muscles become motors, tendons become cables or linkages, nerves become sensors, and the brain becomes a controller.',
]

const HINTS = ['Each muscle pulls one tendon. Which fingers does it reach?', 'To make a fist, pull the flexors, and let go of the extensor.']

/** The hand's wrist on the main plane. At the play's shot (no camera move) world = stage. */
const HX = 800
const HY = 500
const ARM = 420
const S = 1.8
const VIEW: HandView = { yaw: -34, pitch: 4, roll: 0, s: S }
const TOUCH_VIEW: HandView = { yaw: -6, pitch: 2, roll: 0, s: S }
const TOUCH_POSE = GRASPS.spread as HandPose

/** The levers of the play: where each muscle's pull ring slides (stage coordinates). */
const LEVERS = [
  { id: 'deep', name: 'deep flexor', x: 450, y0: 470, len: 190, what: '4 fingers, 12 joints' },
  { id: 'thumb', name: 'thumb flexor', x: 1110, y0: 470, len: 190, what: 'thumb, 2 joints' },
  { id: 'ext', name: 'extensor', x: 1370, y0: 470, len: 190, what: 'opens all 15' },
] as const
type LeverId = (typeof LEVERS)[number]['id']

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** The hand the three muscles make: the deep flexor curls every finger joint together (no fingertip alone). */
function poseFrom(v: Record<LeverId, number>): HandPose {
  const f = clamp(v.deep - 0.9 * v.ext)
  const t = clamp(v.thumb - 0.9 * v.ext)
  const back = v.ext * (1 - f) * 10
  const finger = (k: number): [number, number, number, number] => [lerp(2, 86, f) - back, lerp(2, 100, f), lerp(0, 62, f), k * (1 - f)]
  return {
    thumb: [lerp(4, 62, t), lerp(10, 30, t), lerp(0, 40, t), lerp(0, 34, t)],
    index: finger(5),
    middle: finger(0),
    ring: finger(4),
    little: finger(9),
    wrist: [0, 0],
  }
}

export function Ch3Anatomy({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const main = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -40, pitch: 8, roll: 0, s: S } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(world.current, { x: 800, y: 300, zoom: 1.2 })
      const count = { n: 0 }
      const countEl = root.current?.querySelector('.c3-count-n')

      /* b0: your hand, turning in warm light. */
      resetHand(tl, hand, { pose: GRASPS.relaxed, view: { yaw: -40, pitch: 8, roll: 0, s: S } })
      tl.addLabel('b0', 0)
      cam.to(tl, { x: 800, y: 310, zoom: 1.32 }, 0, 6.5, 'sine.inOut')
      hand.to(tl, { view: { yaw: 22, pitch: 4 } }, 0, 6.5, 'sine.inOut')
      hand.to(tl, { pose: GRASPS.open }, 0.6, 1.6)
      hand.to(tl, { pose: { ...GRASPS.relaxed, index: [30, 40, 20, 3] } }, 2.4, 1.6)
      hand.to(tl, { pose: GRASPS.spread }, 4.2, 1.8)

      /* b1: x-ray to bones; a joint arc for every way it can move; the counter. */
      const b1 = 6.5
      tl.addLabel('b1', b1)
      hand.to(tl, { view: VIEW }, b1, 1.4)
      fade(tl, '.c3-bones', 1, b1 + 0.2, 1)
      fade(tl, '.c3-skin', 0.1, b1 + 0.2, 1, 1)
      cam.to(tl, { x: 800, y: 300, zoom: 1.22 }, b1, 7)
      fade(tl, '.c3-27', 1, b1 + 0.9, 0.6)
      tl.fromTo('.c3-arc', { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.2, immediateRender: false }, b1 + 2.0)
      fade(tl, '.c3-count', 1, b1 + 2.0, 0.4)
      tl.fromTo(count, { n: 0 }, { n: 21, duration: 3, ease: 'none', immediateRender: false, onUpdate: () => countEl && (countEl.textContent = `~${Math.round(count.n)}`) }, b1 + 2.0)
      fade(tl, '.c3-dofnote', 1, b1 + 5.4, 0.6)

      /* b2: down to the forearm; the muscles glow there, not in the hand. */
      const b2 = b1 + 7.5
      tl.addLabel('b2', b2)
      fade(tl, '.c3-27, .c3-count, .c3-dofnote, .c3-arc', 0, b2, 0.5, 1)
      fade(tl, '.c3-bones', 0, b2 + 0.2, 0.8, 1)
      fade(tl, '.c3-skin', 1, b2 + 0.2, 0.8, 0.1)
      hand.to(tl, { pose: GRASPS.relaxed }, b2, 1.4)
      cam.to(tl, { x: 800, y: 780, zoom: 1.6 }, b2 + 0.2, 2.6, 'power2.inOut')
      fade(tl, '.c3-sleeve', 1, b2 + 1.6, 1)
      fade(tl, '.c3-muscle-deep', 1, b2 + 2.4, 0.6)
      fade(tl, '.c3-muscle-thumb', 1, b2 + 2.8, 0.6)
      fade(tl, '.c3-muscle-extensor', 1, b2 + 3.2, 0.6)
      fade(tl, '.c3-lab-muscle', 1, b2 + 3.6, 0.6)
      cam.to(tl, { x: 790, y: 740, zoom: 1.7 }, b2 + 2.8, 4.2, 'sine.inOut')

      /* b3: tendons like puppet strings; the fingers curl as they pull; pulleys. */
      const b3 = b2 + 7
      tl.addLabel('b3', b3)
      fade(tl, '.c3-lab-muscle', 0, b3, 0.4, 1)
      cam.to(tl, { x: 800, y: 470, zoom: 1.02 }, b3, 2.4)
      fade(tl, '.c3-tendons', 1, b3 + 0.6, 1)
      hand.to(tl, { pull: { index: 1, middle: 1, ring: 1, little: 1, thumb: 0.8 }, pose: GRASPS.power }, b3 + 2.0, 1.6)
      fade(tl, '.c3-lab-tendon', 1, b3 + 2.2, 0.6)
      hand.to(tl, { pull: { index: 0, middle: 0, ring: 0, little: 0, thumb: 0 }, pose: GRASPS.open }, b3 + 4.6, 1.4)
      fade(tl, '.c3-pulleys', 1, b3 + 5.0, 0.6)
      fade(tl, '.c3-lab-pulley', 1, b3 + 5.4, 0.6)
      cam.to(tl, { x: 760, y: 300, zoom: 1.4 }, b3 + 5.0, 3)

      /* b4: the play. Back to the whole arm; the levers come in (React). */
      const b4 = b3 + 9.4
      tl.addLabel('b4', b4)
      fade(tl, '.c3-lab-tendon, .c3-lab-pulley, .c3-pulleys', 0, b4, 0.5, 1)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b4, 1.6)
      hand.to(tl, { pose: poseFrom({ deep: 0, thumb: 0, ext: 0 }), view: VIEW }, b4, 1.2)
      tl.to({}, { duration: 2.4 }, b4 + 1.2)

      /* b5: touch. Thousands of receptors, crowded at the tips; a fingertip meets an egg. */
      const b5 = b4 + 3.8
      tl.addLabel('b5', b5)
      fade(tl, '.c3-sleeve, .c3-muscle-deep, .c3-muscle-thumb, .c3-muscle-extensor, .c3-tendons', 0, b5, 0.6, 1)
      hand.to(tl, { pose: TOUCH_POSE, view: TOUCH_VIEW, pull: { index: 0, middle: 0, ring: 0, little: 0, thumb: 0 } }, b5, 0.7)
      cam.to(tl, { x: 800, y: 330, zoom: 1.32 }, b5, 1.2)
      fade(tl, '.c3-mag', 0.6, b5 + 0.3, 1.2)
      for (let i = 0; i < 5; i++) fade(tl, `.c3-dots-${i}`, 1, b5 + 0.9 + i * 0.55, 0.8)
      fade(tl, '.c3-17k', 1, b5 + 2.0, 0.6)
      fade(tl, '.c3-lab-tips', 1, b5 + 3.4, 0.6)
      const tip = tipIdx
      fade(tl, '.c3-17k, .c3-lab-tips', 0, b5 + 4.6, 0.4, 1)
      cam.to(tl, { x: tip.x + 30, y: tip.y + 20, zoom: 3.4 }, b5 + 4.5, 1.6, 'power3.inOut')
      tl.fromTo('.c3-egg', { x: 260, opacity: 0 }, { x: 0, opacity: 1, duration: 1.1, ease: 'power2.out', immediateRender: false }, b5 + 5.4)
      hand.to(tl, { touch: { index: 1 } }, b5 + 6.4, 0.3)
      tl.fromTo('.c3-ripple', { scale: 0.2, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.4, stagger: 0.35, ease: 'power1.out', transformOrigin: '50% 50%', immediateRender: false }, b5 + 6.45)
      fade(tl, '.c3-lab-feel', 1, b5 + 6.8, 0.5)
      tl.to({}, { duration: 0.3 }, b5 + 8.6)

      /* b6: the human hand becomes a robot hand, layer by layer. */
      const b6 = b5 + 8.9
      tl.addLabel('b6', b6)
      fade(tl, '.c3-lab-feel, .c3-egg', 0, b6, 0.4, 1)
      hand.to(tl, { touch: { index: 0 } }, b6, 0.4)
      cam.to(tl, { x: 830, y: 450, zoom: 1.08 }, b6, 2.2)
      tl.fromTo('.c3-dots', { opacity: 1 }, { opacity: 0, duration: 0.8, immediateRender: false }, b6 + 0.4)
      fade(tl, '.c3-mag', 0, b6 + 0.4, 0.8, 0.6)
      fade(tl, '.c3-blue', 0.7, b6 + 0.6, 1.6)
      fade(tl, '.c3-robot', 1, b6 + 1.0, 1.4)
      fade(tl, '.c3-skin', 0, b6 + 1.0, 1.4, 1)
      hand.to(tl, { pose: GRASPS.relaxed, view: { yaw: -26, pitch: 4 } }, b6 + 1.0, 2.4)
      fade(tl, '.c3-sys-0', 1, b6 + 2.2, 0.5)
      fade(tl, '.c3r-motors', 1, b6 + 3.0, 0.6)
      fade(tl, '.c3-sys-1', 1, b6 + 3.0, 0.5)
      fade(tl, '.c3r-cables', 1, b6 + 3.8, 0.6)
      fade(tl, '.c3-sys-2', 1, b6 + 3.8, 0.5)
      hand.to(tl, { touch: { thumb: 0.7, index: 0.8, middle: 0.8, ring: 0.7, little: 0.6 } }, b6 + 4.6, 0.6)
      fade(tl, '.c3-sys-3', 1, b6 + 4.6, 0.5)
      fade(tl, '.c3-sys-4', 1, b6 + 5.4, 0.5)
      tl.fromTo('.c3-net', { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.out', immediateRender: false }, b6 + 5.4)
      cam.to(tl, { x: 850, y: 430, zoom: 1.12 }, b6 + 2.2, 6.4, 'sine.inOut')
    },
    // tipIdx is a constant of the layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-breathe', { opacity: 0.7, duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-net-pulse', { opacity: 0.4, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the play: three muscles, pulled like levers ---------------- */
  const PLAY = 4
  const [lever, setLever] = useState<Record<LeverId, number>>({ deep: 0, thumb: 0, ext: 0 })
  const [pulled, setPulled] = useState<Record<LeverId, boolean>>({ deep: false, thumb: false, ext: false })
  const [won, setWon] = useState(false)
  const wonRef = useRef(false)
  const active = cueIndex === PLAY

  useEffect(() => {
    if (!active) return
    setLever({ deep: 0, thumb: 0, ext: 0 })
    setPulled({ deep: false, thumb: false, ext: false })
    setWon(false)
    wonRef.current = false
  }, [active])

  const setOne = (id: LeverId, v: number) => {
    if (!active || wonRef.current) return
    const next = { ...lever, [id]: clamp(v) }
    setLever(next)
    const p = poseFrom(next)
    Object.assign(hand.state.pose, p)
    const f = clamp(next.deep - 0.9 * next.ext)
    const t = clamp(next.thumb - 0.9 * next.ext)
    Object.assign(hand.state.pull, { index: f, middle: f, ring: f, little: f, thumb: t })
    hand.notify()
    const nowPulled = { ...pulled }
    if (next[id] > 0.55 && !pulled[id]) {
      nowPulled[id] = true
      setPulled(nowPulled)
      emit({ type: 'progress', detail: `pulled the ${LEVERS.find((l) => l.id === id)?.name}` })
    }
    const fist = f > 0.78 && t > 0.6
    if (fist && nowPulled.deep && nowPulled.thumb && nowPulled.ext) {
      wonRef.current = true
      setWon(true)
      emit({ type: 'attempt', correct: true, detail: 'pulled all three muscles and made a fist' })
      void say('Notice that one muscle bent several joints at once. Robot designers copy that trick.').then(() => onPlayDone())
    }
  }

  const leverDrag = (id: LeverId) => {
    const L = LEVERS.find((l) => l.id === id)!
    return dragIn(() => main.current, {
      start: (p) => setOne(id, (p.y - L.y0) / L.len),
      move: (p) => setOne(id, (p.y - L.y0) / L.len),
      end: () => {
        const v = lever
        const f = clamp(v.deep - 0.9 * v.ext)
        if (!wonRef.current && pulled.deep && pulled.thumb && pulled.ext && f < 0.5 && v.ext > 0.4) emit({ type: 'attempt', correct: false, detail: 'tried to make a fist with the extensor still pulled, which holds the fingers open' })
      },
    })
  }

  useEffect(() => {
    if (cueIndex === PLAY) {
      const f = clamp(lever.deep - 0.9 * lever.ext)
      const t = clamp(lever.thumb - 0.9 * lever.ext)
      reportState(
        'The forearm is see-through with three amber muscle bellies inside. Each has a pull ring on a string that slides down like a lever: "deep flexor" on the left, "thumb flexor" and "extensor" on the right. Dragging a ring down pulls that muscle and the hand moves live. ' +
          `Right now: deep flexor ${Math.round(lever.deep * 100)}%, thumb flexor ${Math.round(lever.thumb * 100)}%, extensor ${Math.round(lever.ext * 100)}%; fingers ${Math.round(f * 100)}% curled, thumb ${Math.round(t * 100)}% curled. ` +
          `Pulled so far: ${(Object.keys(pulled) as LeverId[]).filter((k) => pulled[k]).join(', ') || 'none'}. ${won ? 'The learner made a fist: done.' : ''} ` +
          'To finish: pull all three at least once, then make a fist (deep flexor and thumb flexor down, extensor let go back up). The discovery: one muscle (the deep flexor) bends 12 joints across four fingers at once, middle and end joints together, so you cannot bend a fingertip joint on its own. Likely mix-ups: leaving the extensor pulled (it opens the hand and fights the flexors), or expecting each finger to have its own muscle here.',
      )
      setHints(HINTS)
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, lever, pulled, won, reportState, setHints])

  /* ---------------- where things are on the picture ---------------- */
  const prMain = projector(VIEW, HX, HY)
  const segsMain = handSegments(GRASPS.open as HandPose).segs
  const idxSeg = segsMain.filter((s) => s.finger === 'index')
  const pulleyPt = prMain([(idxSeg[0].a[0] + idxSeg[0].b[0]) / 2, (idxSeg[0].a[1] + idxSeg[0].b[1]) / 2, (idxSeg[0].a[2] + idxSeg[0].b[2]) / 2])
  const palmTendon = prMain([4, 30, 12])
  const prT = projector(TOUCH_VIEW, HX, HY)
  const tSegs = handSegments(TOUCH_POSE)
  const tipIdx = prT(tSegs.tips.index)
  const tipMid = prT(tSegs.tips.middle)
  const prR = projector({ ...VIEW, yaw: -26 }, HX, HY)
  const rSegs = handSegments(GRASPS.relaxed as HandPose)
  const rLink = rSegs.segs.filter((s) => s.finger === 'little')[0]
  const linkPt = prR([(rLink.a[0] + rLink.b[0]) / 2, (rLink.a[1] + rLink.b[1]) / 2, rLink.a[2]])
  const motorPt = prR([-13, -ARM * 0.3, 8])
  const wristPt = prR([10, -20, 10])
  const tipR = prR(rSegs.tips.index)
  const musclePt = prMain([-4, -ARM * 0.5, 6])

  return (
    <g ref={root}>
      <g ref={world}>
        <g data-depth="0.4">
          <rect x={-1200} y={-900} width={4000} height={3200} fill={C.ink} />
          <g className="c3-blue" opacity={0}>
            <Blueprint />
          </g>
          {/* far soft lights */}
          <g filter="url(#cn-dof-3)" opacity={0.6}>
            <circle cx={200} cy={180} r={60} fill={C.keyDeep} opacity={0.35} />
            <circle cx={1450} cy={260} r={44} fill={C.rimDeep} opacity={0.3} />
            <circle cx={1300} cy={900} r={70} fill={C.keyDeep} opacity={0.2} />
          </g>
        </g>
        <g data-depth="1" ref={main}>
          <g className="c3-breathe" opacity={0.95}>
            <Pool x={HX + 40} y={HY - 160} r={620} color="key" opacity={0.85} />
          </g>
          <g className="c3-mag" opacity={0}>
            <Pool x={HX} y={HY - 170} r={420} color="magenta" opacity={0.35} />
          </g>
          <Dust x={HX - 600} y={HY - 520} w={1200} h={1300} count={34} seed={31} />

          {/* the hand: skin, bones, and later the robot, all on one store */}
          <g className="c3-skin">
            {cueIndex <= 6 && <Hand3D store={hand} x={HX} y={HY} look="human" arm={ARM} light={[-0.7, -0.6]} tutor="hand" />}
          </g>
          <g className="c3-bones" opacity={0}>
            {cueIndex <= 2 && <Hand3D store={hand} x={HX} y={HY} look="bones" arm={ARM} />}
          </g>
          <g className="c3-robot" opacity={0}>
            {cueIndex >= 5 && <Hand3D store={hand} x={HX} y={HY} look="robot" arm={ARM} light={[-0.7, -0.6]} />}
          </g>
          <HandOverlay store={hand} x={HX} y={HY} arm={ARM} cls="c3" show={{ arcs: true, sleeve: true, muscles: true, tendons: true, pulleys: true }} />
          <HandOverlay store={hand} x={HX} y={HY} arm={ARM} cls="c3r" show={{ motors: true, cables: true }} />
          <g className="c3-dots">
            <TouchDots pose={TOUCH_POSE} view={TOUCH_VIEW} x={HX} y={HY} cls="c3-dots" />
          </g>

          {/* bones: the numbers */}
          <g className="c3-27" opacity={0}>
            <Readout x={HX - 330} y={200} color={C.bone} size={40}>
              27 bones
            </Readout>
          </g>
          <g className="c3-count" opacity={0}>
            <text x={HX + 230} y={200} fill={C.cyan} fontFamily={MONO} fontSize={40} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tspan className="c3-count-n">~0</tspan>
              <tspan fontSize={24}> DOF</tspan>
            </text>
            <text x={HX + 232} y={230} fill={C.cyan} opacity={0.75} fontFamily={MONO} fontSize={18}>
              fingers + thumb
            </text>
          </g>
          <g className="c3-dofnote" opacity={0}>
            <text x={HX + 232} y={560} fill={C.mist} fontFamily={SANS} fontSize={20} fontStyle="italic">
              counted how? the wrist adds 2 more
            </text>
          </g>

          <Label className="c3-lab-muscle" x={musclePt.x} y={musclePt.y} tx={musclePt.x - 170} ty={musclePt.y - 60} text="finger muscles" sub="in the forearm" color={C.amberLight} />
          <Label className="c3-lab-tendon" x={palmTendon.x} y={palmTendon.y} tx={palmTendon.x - 280} ty={palmTendon.y + 60} text="tendons: the strings" color={C.cyanLight} />
          <Label className="c3-lab-pulley" x={pulleyPt.x} y={pulleyPt.y} tx={pulleyPt.x - 250} ty={pulleyPt.y - 170} text="pulleys stop the tendon bowstringing" color={C.cyanLight} size={22} />

          {/* touch */}
          <g className="c3-17k" opacity={0}>
            <Readout x={HX + 250} y={190} color={C.magentaLight} size={40}>
              ~17,000
            </Readout>
            <text x={HX + 252} y={222} fill={C.magentaLight} opacity={0.8} fontFamily={MONO} fontSize={18}>
              touch sensors in one hand
            </text>
          </g>
          <Label className="c3-lab-tips" x={tipMid.x} y={tipMid.y - 4} tx={tipMid.x - 260} ty={tipMid.y - 50} text="~2,000 per fingertip" color={C.magentaLight} size={22} />
          <g className="c3-egg" opacity={0}>
            <Egg x={tipIdx.x + 64} y={tipIdx.y + 10} s={0.95} />
          </g>
          {[0, 1, 2].map((i) => (
            <circle key={i} className="c3-ripple" cx={tipIdx.x + 20} cy={tipIdx.y + 4} r={22} fill="none" stroke={C.magentaLight} strokeWidth={2} opacity={0} />
          ))}
          <g className="c3-lab-feel" opacity={0}>
            <text x={tipIdx.x + 70} y={tipIdx.y + 74} fill={C.magentaLight} fontFamily={SANS} fontSize={12} textAnchor="middle">
              pressure · vibration · stretch
            </text>
          </g>

          {/* the system: anatomy → robot */}
          <Label className="c3-sys-0" x={linkPt.x} y={linkPt.y} tx={linkPt.x - 230} ty={linkPt.y - 40} text="bones → links" color={C.bone} />
          <Label className="c3-sys-1" x={motorPt.x} y={motorPt.y} tx={motorPt.x - 250} ty={motorPt.y + 10} text="muscles → motors" color={C.amber} />
          <Label className="c3-sys-2" x={wristPt.x} y={wristPt.y} tx={wristPt.x + 290} ty={wristPt.y + 70} text="tendons → cables or linkages" color={C.cyan} />
          <Label className="c3-sys-3" x={tipR.x} y={tipR.y} tx={tipR.x + 250} ty={tipR.y - 20} text="nerves → sensors" color={C.magenta} />
          <g className="c3-sys-4" opacity={0}>
            <path className="c3-net" d={`M${wristPt.x + 10} ${wristPt.y + 40} C ${wristPt.x + 160} ${wristPt.y + 60}, 1160 520, 1250 420 M1250 420 L1300 360 M1250 420 L1330 430`} fill="none" stroke={C.lime} strokeWidth={2.4} strokeDasharray="600" strokeDashoffset="600" />
            <g className="c3-net-pulse">
              <rect x={1280} y={300} width={110} height={110} rx={14} fill={C.ink1} stroke={C.lime} strokeWidth={3} />
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1={1280 + 20 + i * 23} x2={1280 + 20 + i * 23} y1={290} y2={300} stroke={C.lime} strokeWidth={3} />
                  <line x1={1280 + 20 + i * 23} x2={1280 + 20 + i * 23} y1={410} y2={420} stroke={C.lime} strokeWidth={3} />
                </g>
              ))}
              <rect x={1305} y={325} width={60} height={60} rx={6} fill={C.lime} opacity={0.25} filter="url(#cn-bloom)" />
            </g>
            <text x={1335} y={460} fill={C.lime} fontFamily={SANS} fontSize={26} fontWeight={500} textAnchor="middle" stroke={C.ink} strokeWidth={5} strokeOpacity={0.55} style={{ paintOrder: 'stroke' }}>
              brain → controller
            </text>
          </g>

          {/* the play: three pull rings on strings */}
          {active && (
            <g className="c3-play">
              {LEVERS.map((L) => {
                const v = lever[L.id]
                const ky = L.y0 + v * L.len
                const m = prMain([L.id === 'deep' ? -4 : L.id === 'thumb' ? 15 : -19, -ARM * 0.45, 6])
                const glow = L.id === 'ext' ? v : L.id === 'deep' ? clamp(lever.deep - 0.9 * lever.ext) : clamp(lever.thumb - 0.9 * lever.ext)
                return (
                  <g key={L.id} className="c3-lever">
                    {/* the string from the muscle belly to the ring */}
                    <path d={`M${m.x} ${m.y} Q ${(m.x + L.x) / 2} ${ky + 120} ${L.x} ${ky + 26}`} fill="none" stroke={C.amber} strokeWidth={2 + v * 2} opacity={0.5 + v * 0.5} strokeDasharray={L.id === 'ext' ? '6 5' : undefined} />
                    <line x1={L.x} x2={L.x} y1={L.y0} y2={L.y0 + L.len} stroke={C.slate} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 8" />
                    <text x={L.x} y={L.y0 - 62} fill={C.amberLight} fontFamily={SANS} fontSize={26} fontWeight={600} textAnchor="middle">
                      {L.name}
                    </text>
                    <text x={L.x} y={L.y0 - 36} fill={C.amberLight} opacity={pulled[L.id] ? 0.85 : 0} fontFamily={MONO} fontSize={16} textAnchor="middle">
                      {L.what}
                    </text>
                    <g {...leverDrag(L.id)} data-tutor={`lever-${L.id}`} role="slider" aria-label={L.name} aria-valuenow={Math.round(v * 100)} tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') setOne(L.id, v + 0.15)
                        if (e.key === 'ArrowUp') setOne(L.id, v - 0.15)
                      }}
                    >
                      <circle cx={L.x} cy={ky} r={52} fill="transparent" />
                      <circle cx={L.x} cy={ky} r={34} fill={C.amber} opacity={0.15 + glow * 0.5} filter="url(#cn-bloom)" />
                      <circle cx={L.x} cy={ky} r={26} fill={C.ink1} stroke={C.amber} strokeWidth={5} />
                      <circle cx={L.x} cy={ky} r={10} fill={C.amber} />
                      <path d={`M${L.x - 8} ${ky + 40} L${L.x} ${ky + 50} L${L.x + 8} ${ky + 40}`} fill="none" stroke={C.amberLight} strokeWidth={2.5} opacity={v < 0.1 ? 0.9 : 0} className="hd-blink" />
                    </g>
                  </g>
                )
              })}
              <text x={800} y={64} fill={won ? C.lime : C.mist} fontFamily={MONO} fontSize={20} textAnchor="middle" pointerEvents="none">
                {won ? '3 muscles, 15 joints' : `pulled ${Object.values(pulled).filter(Boolean).length} of 3, then a fist`}
              </text>
            </g>
          )}
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'anatomy',
  title: 'The hand you already have',
  cues: CUES,
  Scene: Ch3Anatomy,
  enter: { type: 'zoom', x: 800, y: 450 },
  deeper: [AnatomyReading],
}
