import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { rng } from '../../../art2/fx'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot, rig, type Pose } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { AdaAtDesk, DgDefs, KOFI, counter } from './parts'
import { FactoryReading } from './readings'

export const CUES: Cue[] = [
  { id: 'farm', say: 'So companies manufacture data. In China, dozens of state-backed training centres now fill warehouse floors with robots and the people who puppet them.' },
  { id: 'clip', say: 'But look at a single recording. The average clip in one huge dataset lasts ten point seven seconds. A million clips adds up to only about three thousand hours.' },
  { id: 'resets', say: 'Most of a teleoperator’s day is spent resetting the scene, fixing failures and waiting. One analysis found a station produced only thirty-six minutes of usable recording a day.' },
  { id: 'price', say: 'Counting everything, a usable hour can cost hundreds of dollars. Which raises the question this whole branch is about: what’s the cheapest way to get the data that actually helps?' },
]

const STATE = [
  'A vast, dim warehouse hall under orange sodium lamps, haze in the air. Rows of white humanoid robots stand at mock kitchens and laundry tables; beside each one a human operator in a VR headset moves their arms and the robot copies them (teleoperation). Kofi, the course’s teleoperator (blue tee, headset), is in the nearest row. The camera dollies slowly along the row. Context: by the end of 2025 China had announced 40+ state-backed robot data-collection centres, about two dozen running.',
  'A single recorded clip plays in a frame: a robot hand picks up a cup and sets it down; a timer runs to 10.7 seconds, the average clip length in AgiBot World. The clip shrinks to a tile, and a flood of tiny tiles pours in and stacks into a block labelled "1,000,000 clips", which compresses to "≈ 3,000 hours" (about four months of one robot’s time). Point: impressive clip counts can be small in hours.',
  'Kofi’s working day as a ribbon across the top of the screen: thin lime slivers of actual recording separated by long grey stretches labelled setup, reset, failed take (red), robot fault (red) and waiting. Below, Kofi resets the scene again and again at his station while a clock races through the shift. A counter of recorded minutes creeps up to only 36 minutes for the whole day. Source: an analysis of AgiBot’s collection facility (about 200 clips a day per station).',
  'The block of recorded hours with a gold price tag swinging onto it: "$550–670 per usable hour, fully loaded" (¥3,990–4,800 per trajectory-hour at facility-wide utilisation, including robot depreciation; market quotes for collected teleop hours are lower, about $90–150 in the US). The camera pulls back: it is all on Ada’s monitor in her dark office, and she leans in. The question for the branch: what is the cheapest way to get the data that actually helps?',
]

/* the hall */
const STATIONS = [
  { x: 220, kind: 'kitchen' },
  { x: 700, kind: 'laundry' },
  { x: 1180, kind: 'kitchen' },
  { x: 1660, kind: 'laundry' },
  { x: 2140, kind: 'kitchen' },
]
const FLOOR = 800
const VR: Partial<Pose> = { ...POSES.stand, torso: 6, head: 4, armN: 62, elbowN: 64, wristN: -10, armF: 50, elbowF: 74 }
const VR2: Partial<Pose> = { ...VR, armN: 74, elbowN: 40, armF: 62, elbowF: 56, torso: 10 }

/* the clip */
const FRAME = { x: 330, y: 110, w: 940, h: 540 }

/* the ribbon of a working day: 480 minutes */
const RIB = { x: 100, y: 120, w: 1400, h: 46 }
type Seg = { a: number; b: number; kind: 'rec' | 'reset' | 'fail' | 'fault' | 'wait' | 'setup' }
const DAY: Seg[] = (() => {
  const r = rng(8)
  const out: Seg[] = [{ a: 0, b: 28, kind: 'setup' }]
  let t = 28
  let recs = 0
  while (t < 452) {
    if (t > 196 && t < 200) {
      out.push({ a: t, b: t + 34, kind: 'wait' })
      t += 34
      continue
    }
    if (t > 300 && t < 306) {
      out.push({ a: t, b: t + 42, kind: 'fault' })
      t += 42
      continue
    }
    const rec = 0.6
    out.push({ a: t, b: t + rec, kind: 'rec' })
    recs++
    t += rec
    const fail = r() < 0.08
    const gap = fail ? 8 + r() * 6 : 3.5 + r() * 3
    out.push({ a: t, b: t + gap, kind: fail ? 'fail' : 'reset' })
    t += gap
  }
  out.push({ a: t, b: 480, kind: 'wait' })
  // scale the recordings so the day's total is the reported 36 minutes
  const k = 36 / (recs * 0.6)
  let shift = 0
  return out.map((s) => {
    const len = (s.b - s.a) * (s.kind === 'rec' ? k : 1)
    const o = { ...s, a: s.a + shift, b: s.a + shift + len }
    shift += len - (s.b - s.a)
    return o
  })
})()
const DAY_END = DAY[DAY.length - 1].b
const ribX = (m: number) => RIB.x + (m / DAY_END) * RIB.w
const SEG_FILL: Record<Seg['kind'], string> = { rec: C.lime, reset: '#3b465a', fail: C.danger, fault: '#a8332c', wait: '#252e3e', setup: '#2c3647' }
/** Recorded minutes up to minute m of the day. */
const recordedBy = (m: number) => DAY.reduce((n, s) => (s.kind === 'rec' ? n + Math.max(0, Math.min(m, s.b) - s.a) : n), 0)

/* the monitor in Ada's office at the end */
const MON = { x: 860, y: 250, s: 0.34 }

function Station({ x, kind, name, operator, kofi = false, light = 'key-left' }: { x: number; kind: string; name: string; operator: string; kofi?: boolean; light?: 'key-left' | 'none' }) {
  const t = x + 150
  return (
    <g>
      {/* the mock set */}
      {kind === 'kitchen' ? (
        <g>
          <rect x={t - 40} y={FLOOR - 170} width={230} height={170} fill={C.ink3} />
          <rect x={t - 46} y={FLOOR - 176} width={242} height={12} fill={C.slate} />
          <rect x={t + 10} y={FLOOR - 140} width={70} height={60} rx={4} fill={C.ink2} stroke={C.slate} />
          <rect x={t + 110} y={FLOOR - 206} width={30} height={30} rx={4} fill={C.bone} opacity={0.8} />
          <ellipse cx={t + 40} cy={FLOOR - 182} rx={30} ry={7} fill={C.metal} opacity={0.7} />
        </g>
      ) : (
        <g>
          <rect x={t - 40} y={FLOOR - 150} width={230} height={14} fill={C.slate} />
          <rect x={t - 30} y={FLOOR - 136} width={10} height={136} fill={C.ink2} />
          <rect x={t + 170} y={FLOOR - 136} width={10} height={136} fill={C.ink2} />
          <path d={`M${t - 20} ${FLOOR - 152} q60 -16 120 -4 q40 6 60 0 l-6 -16 q-80 -14 -170 6 Z`} fill="#c9b6d8" opacity={0.85} />
        </g>
      )}
      <Robot name={`${name}-bot`} x={x + 70} y={FLOOR} s={1} pose={VR} light="cool-left" />
      <Person name={operator} x={x - 70} y={FLOOR} s={1} pose={VR} light={light} {...(kofi ? KOFI : { headset: true, outfit: 'tee', top: '#4a4f5c', topDark: '#30343e' })} />
    </g>
  )
}

export function Ch3Hour({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const hallRef = useRef<SVGGElement>(null)
  const dayRef = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 1.5 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const hallCam = camera(hallRef.current, { x: 560, y: 470, zoom: 1.12 })
      const dayCam = camera(dayRef.current, { x: 800, y: 470, zoom: 1 })
      const shots = ['.c3-hall', '.c3-clip', '.c3-day', '.c3-price']
      const cut = (show: string[], at: number) => {
        for (const s of shots) tl.set(s, { opacity: show.includes(s) ? 1 : 0 }, at)
      }
      // Kofi and his robot: he moves, it copies a beat later
      const kofi = rig(el, 'c3-kofi', VR)
      const bot = rig(el, 'c3-k-bot', VR)
      const others = [0, 2, 3, 4].map((i) => [rig(el, `c3-op${i}`, VR), rig(el, `c3-s${i}-bot`, VR)])

      /* b0: the hall. A slow dolly along the row of stations. */
      tl.addLabel('b0', 0)
      cut(['.c3-hall'], 0)
      hallCam.to(tl, { x: 1060, y: 450, zoom: 1.2 }, 0, 10.6, 'sine.inOut')
      for (let k = 0; k < 5; k++) {
        const at = 0.4 + k * 2
        kofi.to(tl, k % 2 ? VR : VR2, at, 1.0, 'sine.inOut')
        bot.to(tl, k % 2 ? VR : VR2, at + 0.25, 1.0, 'sine.inOut')
        others.forEach(([op, rb], j) => {
          const pose = (k + j) % 2 ? VR : VR2
          op.to(tl, pose, at + 0.3 * j, 1.1, 'sine.inOut')
          rb.to(tl, pose, at + 0.3 * j + 0.25, 1.1, 'sine.inOut')
        })
      }
      fade(tl, '.c3-kofilab', 1, 3.6, 0.6)
      fade(tl, '.c3-hallab', 1, 6.4, 0.8)

      /* b1: one clip, 10.7 seconds; a million of them; only 3,000 hours. */
      const b1 = 10.6
      tl.addLabel('b1', b1)
      cut(['.c3-clip'], b1)
      fade(tl, '.c3-frame', 1, b1, 0.5)
      tl.fromTo('.c3-hand', { x: 0, y: -160 }, { x: 0, y: 0, duration: 1.0, ease: 'power2.out', immediateRender: false }, b1 + 0.3)
      hand.to(tl, { pose: { ...GRASPS.power, wrist: [4, 0] }, touch: { thumb: 0.4, index: 0.4, middle: 0.3 } }, b1 + 1.2, 0.5)
      tl.fromTo('.c3-hand, .c3-cup', { x: 0, y: 0 }, { x: 320, y: -60, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, b1 + 1.8)
      tl.to('.c3-hand, .c3-cup', { y: 0, duration: 0.5, ease: 'power2.in' }, b1 + 3.0)
      hand.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0 } }, b1 + 3.5, 0.4)
      tl.to('.c3-hand', { y: -200, duration: 0.6, ease: 'power2.in' }, b1 + 3.8)
      counter(tl, el, '.c3-timer', 0, 10.7, b1 + 0.3, 4.1, (v) => `00:${v.toFixed(1).padStart(4, '0')}`, 'none')
      fade(tl, '.c3-avg', 1, b1 + 4.4, 0.5)
      // the clip becomes one tile among a million
      tl.fromTo('.c3-frame', { scale: 1, x: 0, y: 0, svgOrigin: '800 380' }, { scale: 0.022, x: -322, y: 316, svgOrigin: '800 380', duration: 1.2, ease: 'power3.inOut', immediateRender: false }, b1 + 5.2)
      fade(tl, '.c3-frame', 0, b1 + 6.2, 0.3, 1)
      fade(tl, '.c3-flood', 1, b1 + 6.0, 0.2)
      tl.fromTo('.c3-t', { opacity: 0, y: -500 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.in', stagger: { each: 0.008, from: 'random' }, immediateRender: false }, b1 + 6.0)
      fade(tl, '.c3-million', 1, b1 + 8.0, 0.6)
      tl.fromTo('.c3-flood', { scale: 1, svgOrigin: '800 700' }, { scale: 0.62, svgOrigin: '800 700', duration: 1.2, ease: 'power2.inOut', immediateRender: false }, b1 + 9.2)
      fade(tl, '.c3-million', 0, b1 + 9.2, 0.4, 1)
      fade(tl, '.c3-hours', 1, b1 + 9.8, 0.6)

      /* b2: Kofi's day, as a ribbon: slivers of recording between resets and failures. */
      const b2 = b1 + 12.4
      tl.addLabel('b2', b2)
      cut(['.c3-day'], b2)
      dayCam.to(tl, { x: 860, y: 520, zoom: 1.1 }, b2, 12, 'sine.inOut')
      tl.fromTo('.c3-ribclip', { attr: { width: 0 } }, { attr: { width: RIB.w + 4 }, duration: 10, ease: 'none', immediateRender: false }, b2 + 1)
      tl.fromTo('.c3-head', { x: 0 }, { x: RIB.w, duration: 10, ease: 'none', immediateRender: false }, b2 + 1)
      const o = { m: 0 }
      const recEls = el ? [...el.querySelectorAll('.c3-rec')] : []
      const clockH = el?.querySelector('.c3-hh')
      const clockM = el?.querySelector('.c3-mh')
      const clockD = el ? [...el.querySelectorAll('.c3-clockd')] : []
      tl.fromTo(o, { m: 0 }, {
        m: DAY_END,
        duration: 10,
        ease: 'none',
        immediateRender: false,
        onUpdate: () => {
          const rec = recordedBy(o.m)
          recEls.forEach((e) => (e.textContent = `${Math.round(rec)} min`))
          const mins = 9 * 60 + o.m
          clockH?.setAttribute('transform', `rotate(${(mins / 720) * 360} 0 0)`)
          clockM?.setAttribute('transform', `rotate(${(mins / 60) * 360} 0 0)`)
          const hh = Math.floor(mins / 60)
          const mm = Math.floor(mins % 60)
          clockD.forEach((e) => (e.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`))
        },
      }, b2 + 1)
      fade(tl, '.c3-riblab', 1, b2 + 3.2, 0.3)
      tl.fromTo('.c3-riblab', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.9, immediateRender: false }, b2 + 3.2)
      // Kofi resets the scene, again and again
      const kofi2 = rig(el, 'c3-kofi2', VR)
      const BEND: Partial<Pose> = { ...POSES.workbench, torso: 40, head: 20, armN: 80, elbowN: 20, armF: 70, elbowF: 30 }
      for (let k = 0; k < 6; k++) {
        const at = b2 + 0.6 + k * 2
        kofi2.to(tl, BEND, at, 0.6, 'power2.inOut')
        kofi2.to(tl, { ...BEND, torso: 26, armN: 60, x: 60 }, at + 0.7, 0.5, 'power2.inOut')
        kofi2.to(tl, { ...VR, x: 0 }, at + 1.3, 0.6, 'power2.inOut')
      }
      tl.fromTo('.c3-reset-item', { x: 0, y: 0 }, { x: 60, y: -40, duration: 0.6, yoyo: true, repeat: 11, ease: 'sine.inOut', immediateRender: false }, b2 + 0.9)
      tl.fromTo('.c3-total', { scale: 1.4, transformOrigin: '50% 50%' }, { scale: 1, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(2)', immediateRender: false }, b2 + 11.2)

      /* b3: the price tag, then pull back to Ada's monitor. */
      const b3 = b2 + 13
      tl.addLabel('b3', b3)
      cut(['.c3-price'], b3)
      tl.fromTo('.c3-tag', { y: -500 }, { y: 0, duration: 0.8, ease: 'power2.in', immediateRender: false }, b3 + 0.6)
      tl.fromTo('.c3-swing', { rotation: 34, svgOrigin: '1020 130' }, { rotation: 0, svgOrigin: '1020 130', duration: 3.2, ease: 'elastic.out(1, 0.25)', immediateRender: false }, b3 + 1.3)
      fade(tl, '.c3-taglab', 1, b3 + 2.2, 0.6)
      // pull back: it was on Ada's monitor all along
      const pb = b3 + 6.6
      fade(tl, '.c3-office', 1, pb, 0.6)
      tl.fromTo('.c3-screen', { scale: 1, x: 0, y: 0, svgOrigin: '0 0' }, { scale: MON.s, x: MON.x, y: MON.y, svgOrigin: '0 0', duration: 2.6, ease: 'power3.inOut', immediateRender: false }, pb)
      fade(tl, '.c3-bezel', 1, pb + 1.6, 0.8)
      const ada = rig(el, 'c3-ada', POSES.sitForward)
      ada.to(tl, { ...POSES.sitForward, torso: 30, head: 16, armN: 70, elbowN: 60 }, pb + 2.8, 1.6, 'power2.inOut')
      fade(tl, '.c3-adalab', 1, pb + 3.2, 0.6)
      tl.to({}, { duration: 0.5 }, pb + 5.6)
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-sodium', { opacity: 0.75, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.5 })
    gsap.to('.c3-haze', { x: 60, duration: 9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-blockglow', { opacity: 0.35, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  /* the flood of tiles: 30 x 14 */
  const tiles = []
  for (let r = 0; r < 14; r++)
    for (let c = 0; c < 30; c++)
      tiles.push(<rect key={`${r}-${c}`} className="c3-t" x={530 + c * 18} y={680 - r * 14} width={15} height={11} rx={2} fill={(r * 7 + c * 3) % 9 === 0 ? C.limeLight : C.lime} opacity={0} />)

  return (
    <g ref={root}>
      <DgDefs />

      {/* ---------- b0: the data farm ---------- */}
      <g className="c3-hall" ref={hallRef}>
        <g data-depth="0.35">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#0b0a0c" />
          {/* high windows and the far wall */}
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={-300 + i * 220} y={60} width={150} height={90} fill="#1a2232" />
          ))}
          {/* far rows of stations, in silhouette */}
          <g opacity={0.45}>
            {Array.from({ length: 9 }, (_, i) => (
              <g key={i} transform={`translate(${-400 + i * 300} 560) scale(0.42)`}>
                <rect x={60} y={-160} width={200} height={160} fill="#2a2016" />
                <Robot name={`c3-far${i}`} x={10} y={0} s={1} pose={VR} light="none" silhouette="#1c1712" />
                <Person name={`c3-farp${i}`} x={-110} y={0} s={1} pose={VR} light="none" silhouette="#1c1712" headset />
              </g>
            ))}
          </g>
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} className="c3-sodium" opacity={0.95}>
              <circle cx={-200 + i * 330} cy={190} r={90} fill="url(#cn-pool-amber)" />
              <rect x={-220 + i * 330} y={184} width={40} height={8} rx={3} fill={C.keyLight} />
            </g>
          ))}
        </g>
        <g data-depth="0.7">
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${-150 + i * 330} 200 L${-330 + i * 330} 900 L${30 + i * 330} 900 Z`} fill="url(#dg-sodium)" opacity={0.4} />
          ))}
          <g className="c3-haze" opacity={0.18}>
            <ellipse cx={600} cy={560} rx={900} ry={160} fill="url(#cn-pool-amber)" />
          </g>
        </g>
        <g data-depth="1">
          <rect x={-600} y={FLOOR} width={3400} height={600} fill="url(#cn-floor)" />
          <rect x={-600} y={FLOOR} width={3400} height={3} fill={C.amber} opacity={0.2} />
          {STATIONS.map((s, i) =>
            i === 1 ? (
              <g key={i}>
                <Pool x={s.x + 60} y={FLOOR - 200} r={360} color="amber" opacity={0.45} />
                <Station x={s.x} kind={s.kind} name="c3-k" operator="c3-kofi" kofi />
              </g>
            ) : (
              <g key={i}>
                <Pool x={s.x + 60} y={FLOOR - 200} r={300} color="amber" opacity={0.3} />
                <Station x={s.x} kind={s.kind} name={`c3-s${i}`} operator={`c3-op${i}`} />
              </g>
            ),
          )}
          <Label className="c3-kofilab" x={STATIONS[1].x - 50} y={FLOOR - 300} tx={STATIONS[1].x - 200} ty={FLOOR - 430} text="Kofi" sub="teleoperator" color={C.cyanLight} />
          <Dust x={-200} y={150} w={2600} h={650} count={50} seed={14} color={C.amberLight} size={0.8} />
        </g>
        <g data-depth="1.6">
          <rect x={900} y={-200} width={90} height={1300} fill="#050405" filter="url(#cn-dof-2)" />
          <path d="M1800 -100 q 30 300 -20 600" stroke="#050405" strokeWidth={14} fill="none" />
        </g>
        <g className="c3-hallab" opacity={0} pointerEvents="none">
          <text x={80} y={110} fill={C.amberLight} fontFamily={SANS} fontSize={30} fontWeight={600} stroke={C.ink} strokeWidth={6} style={{ paintOrder: 'stroke' }}>
            40+ state-backed data centres announced
          </text>
          <text x={82} y={146} fill={C.mist} fontFamily={MONO} fontSize={20} stroke={C.ink} strokeWidth={5} style={{ paintOrder: 'stroke' }}>
            China, by the end of 2025 · about two dozen running
          </text>
        </g>
      </g>

      {/* ---------- b1: one clip, then a million ---------- */}
      <g className="c3-clip" opacity={0}>
        <Blueprint />
        <g className="c3-frame" opacity={0}>
          <rect x={FRAME.x - 12} y={FRAME.y - 12} width={FRAME.w + 24} height={FRAME.h + 24} rx={10} fill={C.ink} />
          <clipPath id="c3-frameclip">
            <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} />
          </clipPath>
          <g clipPath="url(#c3-frameclip)">
            <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} fill="#1a1712" />
            <Pool x={800} y={420} r={600} color="amber" opacity={0.4} />
            <rect x={FRAME.x} y={540} width={FRAME.w} height={120} fill="#2a2016" />
            <rect x={FRAME.x} y={540} width={FRAME.w} height={4} fill={C.amber} opacity={0.4} />
            {/* the cup */}
            <g className="c3-cup">
              <rect x={600} y={448} width={92} height={96} rx={12} fill={C.bone} />
              <rect x={612} y={458} width={16} height={74} rx={6} fill={C.white} opacity={0.5} />
              <path d="M692 466 q34 10 0 54" stroke={C.bone} strokeWidth={11} fill="none" />
            </g>
            <ellipse cx={960} cy={546} rx={60} ry={8} fill={C.lime} opacity={0.35} />
            <text x={960} y={590} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={18} opacity={0.7}>
              place here
            </text>
            <g className="c3-hand">
              <Hand3D store={hand} x={690} y={300} look="robot" arm={420} light={[0.8, -0.5]} />
            </g>
          </g>
          <circle cx={FRAME.x + 26} cy={FRAME.y + 28} r={9} fill={C.danger} className="hd-blink" />
          <text x={FRAME.x + 44} y={FRAME.y + 36} fill={C.white} fontFamily={MONO} fontSize={22} opacity={0.85}>
            REC · clip 000,481
          </text>
          <text x={FRAME.x + FRAME.w - 24} y={FRAME.y + 40} textAnchor="end" fill={C.white} fontFamily={MONO} fontSize={34}>
            <tspan className="c3-timer">00:00.0</tspan>
          </text>
          <text x={FRAME.x + FRAME.w - 24} y={FRAME.y + 70} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={16}>
            ▶▶ shown sped up
          </text>
          <g className="c3-avg" opacity={0}>
            <text x={800} y={FRAME.y + FRAME.h + 70} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={44} fontWeight={600}>
              10.7 seconds: the average clip
            </text>
          </g>
        </g>
        <g className="c3-flood" opacity={0}>
          <rect className="c3-blockglow" x={510} y={480} width={580} height={230} rx={10} fill={C.lime} opacity={0.15} filter="url(#cn-bloom-big)" />
          {tiles}
        </g>
        <g className="c3-million" opacity={0}>
          <text x={800} y={420} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={64} fontWeight={600}>
            1,000,000 clips
          </text>
          <text x={800} y={460} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={24}>
            AgiBot World, 2025: one of the biggest robot datasets
          </text>
        </g>
        <g className="c3-hours" opacity={0}>
          <text x={800} y={500} textAnchor="middle" fill={C.lime} fontFamily={SERIF} fontSize={84} fontWeight={600}>
            ≈ 3,000 hours
          </text>
          <text x={800} y={548} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={26}>
            about four months of one robot’s time
          </text>
        </g>
      </g>

      {/* ---------- b2: Kofi's day ---------- */}
      <g className="c3-day" ref={dayRef} opacity={0}>
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#0b0a0c" />
          <Pool x={760} y={560} r={600} color="amber" opacity={0.35} />
          <g filter="url(#cn-dof-2)" opacity={0.5}>
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(${-100 + i * 600} 720) scale(0.55)`}>
                <Robot name={`c3-bg${i}`} x={0} y={0} s={1} pose={VR} light="none" silhouette="#1c1712" />
              </g>
            ))}
          </g>
        </g>
        <g data-depth="1">
          <rect x={-600} y={FLOOR + 20} width={2800} height={600} fill="url(#cn-floor)" />
          <g transform="translate(0 20)">
            <rect x={760} y={FLOOR - 160} width={260} height={160} fill={C.ink3} />
            <rect x={754} y={FLOOR - 166} width={272} height={12} fill={C.slate} />
            <g className="c3-reset-item">
              <rect x={820} y={FLOOR - 200} width={34} height={34} rx={4} fill={C.bone} opacity={0.85} />
            </g>
            <rect x={900} y={FLOOR - 190} width={60} height={24} rx={4} fill={C.ink2} stroke={C.slate} />
            <Robot name="c3-k2-bot" x={700} y={FLOOR} s={1.1} pose={{ ...POSES.stand, armN: 10, elbowN: 20 }} light="cool-left" />
            <Person name="c3-kofi2" x={520} y={FLOOR} s={1.1} pose={VR} light="key-left" {...KOFI} />
          </g>
          {/* the clock */}
          <g transform="translate(1320 560)">
            <circle r={96} fill={C.ink1} stroke={C.mist} strokeWidth={4} />
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1={0} x2={0} y1={-84} y2={-74} stroke={C.mist} strokeWidth={3} transform={`rotate(${i * 30})`} />
            ))}
            <line className="c3-hh" x1={0} y1={0} x2={0} y2={-48} stroke={C.paper} strokeWidth={7} strokeLinecap="round" transform="rotate(270)" />
            <line className="c3-mh" x1={0} y1={0} x2={0} y2={-74} stroke={C.paper} strokeWidth={4} strokeLinecap="round" />
            <circle r={7} fill={C.paper} />
            <text y={140} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={28}>
              <tspan className="c3-clockd">09:00</tspan>
            </text>
          </g>
          <Label x={560} y={FLOOR - 320} tx={450} ty={FLOOR - 420} text="Kofi, resetting the scene" color={C.cyanLight} hidden={false} size={24} />
        </g>
        {/* the ribbon of the day (not in the camera, it is a graphic over the picture) */}
      </g>
      <g className="c3-day" opacity={0} pointerEvents="none">
        <text x={RIB.x} y={RIB.y - 22} fill={C.paper} fontFamily={SANS} fontSize={26} fontWeight={600}>
          one station, one working day
        </text>
        <rect x={RIB.x - 4} y={RIB.y - 4} width={RIB.w + 8} height={RIB.h + 8} rx={6} fill={C.ink} />
        <clipPath id="c3-rib">
          <rect className="c3-ribclip" x={RIB.x - 2} y={RIB.y - 10} width={0} height={RIB.h + 20} />
        </clipPath>
        <g clipPath="url(#c3-rib)">
          {DAY.map((s, i) => (
            <rect key={i} x={ribX(s.a)} y={RIB.y} width={Math.max(s.kind === 'rec' ? 1.6 : 0.5, ribX(s.b) - ribX(s.a))} height={RIB.h} fill={SEG_FILL[s.kind]} opacity={s.kind === 'rec' ? 1 : 0.95} />
          ))}
        </g>
        <g className="c3-head">
          <line x1={RIB.x} x2={RIB.x} y1={RIB.y - 12} y2={RIB.y + RIB.h + 12} stroke={C.paper} strokeWidth={3} />
        </g>
        {(
          [
            ['setup', 14, C.mist],
            ['reset', 120, C.mist],
            ['failed take', DAY.find((s) => s.kind === 'fail' && s.a > 60)?.a ?? 90, C.danger],
            ['waiting', 214, C.mist],
            ['robot fault', 330, C.danger],
            ['recording', DAY.find((s) => s.kind === 'rec' && s.a > 400)?.a ?? 410, C.lime],
          ] as [string, number, string][]
        ).map(([t, m, c], i) => (
          <g key={t} className="c3-riblab" opacity={0}>
            <path d={`M${ribX(m)} ${RIB.y + RIB.h + 4} V${RIB.y + RIB.h + 30 + (i % 2) * 30}`} stroke={c} strokeWidth={1.6} opacity={0.8} />
            <text x={ribX(m)} y={RIB.y + RIB.h + 52 + (i % 2) * 30} textAnchor="middle" fill={c} fontFamily={SANS} fontSize={21}>
              {t}
            </text>
          </g>
        ))}
        <g transform="translate(1320 300)">
          <text textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
            usable recording so far
          </text>
          <g className="c3-total" opacity={1}>
            <text y={60} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={54}>
              <tspan className="c3-rec">0 min</tspan>
            </text>
          </g>
        </g>
      </g>

      {/* ---------- b3: the price, on Ada's monitor ---------- */}
      <g className="c3-price" opacity={0}>
        <g className="c3-office" opacity={0}>
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-wall)" />
          <rect x={-600} y={800} width={2800} height={600} fill="url(#cn-floor)" />
          <Pool x={MON.x + 270} y={MON.y + 150} r={700} color="lime" opacity={0.3} />
          <rect x={600} y={640} width={1000} height={18} fill={C.ink3} />
          <rect x={MON.x + 260} y={MON.y + 300} width={16} height={86} fill={C.ink2} />
          <rect x={MON.x + 200} y={MON.y + 382} width={140} height={10} rx={3} fill={C.ink2} />
          <AdaAtDesk name="c3-ada" x={600} y={810} s={1.45} pose={POSES.sitForward} />
          <Label className="c3-adalab" x={700} y={472} tx={380} ty={170} text="Ada" sub="what’s the cheapest data that actually helps?" color={C.limeLight} anchor="start" />
        </g>
        <g className="c3-screen">
          <rect x={0} y={0} width={1600} height={900} fill={C.ink1} />
          <rect x={0} y={0} width={1600} height={900} fill="url(#cn-grid-big)" opacity={0.8} />
          <Pool x={800} y={520} r={600} color="lime" opacity={0.3} />
          <g className="c3-blockglow" opacity={0.2}>
            <rect x={620} y={400} width={360} height={150} rx={10} fill={C.lime} filter="url(#cn-bloom-big)" opacity={0.6} />
          </g>
          {Array.from({ length: 9 * 20 }, (_, i) => (
            <rect key={i} x={630 + (i % 20) * 17.6} y={410 + Math.floor(i / 20) * 15} width={15} height={12} rx={2} fill={C.lime} opacity={0.85} />
          ))}
          <text x={800} y={600} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={30}>
            one usable hour of robot data
          </text>
          <g className="c3-tag">
            <g className="c3-swing">
              <path d="M1020 130 L1020 300" stroke={C.goldLight} strokeWidth={3} />
              <path d="M1020 300 L800 400" stroke={C.goldLight} strokeWidth={2} opacity={0.6} />
              <g transform="translate(1020 300) rotate(-8)">
                <path d="M-150 0 L130 0 L170 60 L130 120 L-150 120 Z" fill={C.gold} />
                <circle cx={140} cy={60} r={10} fill={C.ink} />
                <text x={-10} y={78} textAnchor="middle" fill={C.ink} fontFamily={SERIF} fontSize={62} fontWeight={700}>
                  $550–670
                </text>
              </g>
            </g>
          </g>
          <g className="c3-taglab" opacity={0}>
            <text x={1040} y={500} fill={C.goldLight} fontFamily={SANS} fontSize={26}>
              per usable hour, fully loaded
            </text>
            <text x={1040} y={534} fill={C.mist} fontFamily={MONO} fontSize={18}>
              ¥3,990–4,800 · resets, idle robots, depreciation
            </text>
            <text x={1040} y={562} fill={C.mist} fontFamily={MONO} fontSize={18}>
              market quote for a raw teleop hour: $90–150 (US)
            </text>
          </g>
        </g>
        <g className="c3-bezel" opacity={0}>
          <rect x={MON.x - 14} y={MON.y - 14} width={1600 * MON.s + 28} height={900 * MON.s + 28} rx={8} fill="none" stroke={C.ink} strokeWidth={22} />
          <g className="hd-flicker">
            <rect x={MON.x} y={MON.y} width={1600 * MON.s} height={900 * MON.s} fill={C.lime} opacity={0.04} />
          </g>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'hour',
  title: 'What an hour really costs',
  cues: CUES,
  Scene: Ch3Hour,
  enter: { type: 'pan', dir: 'left' },
  deeper: [FactoryReading],
}
