import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { useDrag } from '../../../engine/svg'
import { camera } from '../../../cine/camera'
import { FINGERS, GRASPS, Hand3D, makeHandStore, tipOnStage, useHandStore, type HandPose, type HandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { DimRoom, Glass, Mono, draw, zoom } from './parts'
import { JOBS, JOB_LIST, KINDS, KeyPrint, SKIN, SensorTip, type Job, type Kind } from './skins'
import { TactileReading } from './readings'
import './touch.css'

export const CUES: Cue[] = [
  { id: 'four', say: 'Your skin actually runs four different kinds of touch sensor. Some report steady pressure and edges. Some fire only at the moment something changes, like the first hint of slip. Some feel fast vibration. Some feel the skin stretching sideways.' },
  { id: 'tech', say: 'Engineers fake these with very different tricks.' },
  { id: 'resistive', say: 'Squishy materials whose resistance drops under pressure: cheap, but they drift and wear. Capacitors that sense a shrinking gap: sensitive, but they hate electrical noise. Piezo films that catch vibration and slip, but can’t feel a steady push.' },
  { id: 'magnetic', say: 'Magnetic skins hide a magnet in rubber over a chip that feels it move, so they sense sideways force too, and the skin can be swapped in seconds.' },
  { id: 'vision', say: 'And camera skins film the inside of a soft gel. They see detail finer than your own fingertip, but they’re bulky, and a camera only looks thirty to sixty times a second.' },
  { id: 'choose', say: 'Three jobs, five sensors. Pick the best sensor for each job, knowing what each one gives up.', play: true },
  { id: 'real', say: 'Real hands do exactly that. Figure’s newest fingertips feel about three grams, the weight of a paperclip. Sharpa packs over a thousand sensing points into each fingertip. Most cheap hands still have almost none.' },
]

const STATE = [
  'A human fingertip in close-up; the camera dives into the pad and it becomes a glowing cutaway of the skin: ridged surface, epidermis, dermis, fat. Four receptor types light up one by one, each with its own rhythm and a little spike train: Merkel discs near the surface under a pressing block, firing steadily ("pressure + edges"); Meissner corpuscles in the ridges, blipping only when a sliding pebble starts or stops ("slip onset"); a deep onion-like Pacinian corpuscle buzzing under a vibrating tool tip ("vibration"); a long Ruffini spindle stretching slowly as the skin is pulled sideways ("stretch / shear"). Fast vs slow adapting, small vs large fields.',
  'A dark shelf with five robot fingertip modules standing in a row, each dome cut away to show a different sensing trick inside (resistive grid, capacitor plates, piezo film, magnet over chip, camera under gel). A soft light sweeps across them.',
  'The camera visits three fingertips in turn. 1) Resistive: a plunger presses a squishy grid of rows and columns and one cell lights magenta (cheap, but drifts and wears). 2) Capacitive: two copper plates; pressing closes the gap and the field lines bunch up; red electrical noise squiggles appear (sensitive, but hates electrical noise). 3) Piezo film: a quick tap gives a sharp spike on a little graph, but a steady press gives a flat line (catches vibration and slip, cannot feel a steady push).',
  'The fourth fingertip: magnetic skin. A small magnet sits in a rubber cap over a magnetometer chip. A sideways push skews the rubber and the field lines tilt; amber arrows show it senses both normal (pressing) force and shear (sideways) force. Then the rubber cap pops off and a new one clicks on: "swap in 12 s" (AnySkin).',
  'The fifth fingertip: a camera skin. A tiny camera looks up into a soft gel dome. A key is pressed into the gel and a screen beside it shows a crisp magenta height map of the key’s teeth, finer than a human fingertip can resolve. Labels: "GelSight, Meta Digit 360: ~30-60 Hz" and "bulky: the camera needs room to focus".',
  '',
  'Three robot hands in close-up with spec labels: Figure 03 (fingertips feel about 3 g, the weight of a paperclip; a paperclip rests on a glowing fingertip); Sharpa Wave (over 1,000 sensing points per fingertip, shown as dense magenta dot grids on each fingertip); a cheap linkage hand whose fingertips stay dark (almost no touch sensing). These are company figures. The point: real hands mix sensors, and touch is still rare on cheap hands.',
]

/* ---------- the skin cutaway ---------- */
const SURF = 300
const PAP = 380
const surfY = (x: number) => SURF + 7 * Math.sin((x / 70) * Math.PI * 2)
const papY = (x: number) => PAP - 22 * Math.sin((x / 70) * Math.PI * 2)
const line = (f: (x: number) => number, x0 = -120, x1 = 1720) => {
  const pts: string[] = []
  for (let x = x0; x <= x1; x += 10) pts.push(`${x},${f(x).toFixed(1)}`)
  return pts.join(' L')
}
const SURF_D = `M${line(surfY)}`
const EPI_D = `M${line(surfY)} L1720,${papY(1720).toFixed(1)} L${line(papY, -120, 1720).split(' L').reverse().join(' L')} Z`
const RX = { merkel: 300, meissner: 640, pacini: 1290, ruffini: 960 }
const LAB_Y = 816

/** Spike-train pictograms for each receptor's rhythm. */
const ticks = (xs: number[], x0: number, y: number) => xs.map((x) => `M${x0 + x} ${y} v-18`).join(' ')
const TRAIN = {
  merkel: ticks(Array.from({ length: 12 }, (_, i) => 30 + i * 12), -100, 0),
  meissner: ticks([30, 36, 42, 48, 150, 156, 162], -100, 0),
  pacini: ticks(Array.from({ length: 34 }, (_, i) => 20 + i * 5), -100, 0),
  ruffini: ticks([30, 52, 72, 90, 106, 120, 134, 146, 158, 170], -100, 0),
}

/** The human fingertip the camera dives into. */
const FVIEW = { yaw: -90, pitch: 0, roll: 100, s: 3.2 }
const FPOSE: HandPose = { ...GRASPS.point, index: [10, 14, 10, 0] }
const FTIP = (() => {
  const t = tipOnStage(makeHandStore({ pose: FPOSE, view: FVIEW }), 'index', 1180, 240)
  return { x: t.x + 10, y: t.y + 14 }
})()

/* ---------- the shelf of five skins ---------- */
const TIPX = [200, 500, 800, 1100, 1400]
const SHELF_Y = 720

/* ---------- the play ---------- */
const JOB_AT: Record<Job, { x: number; y: number }> = { slip: { x: 290, y: 330 }, key: { x: 800, y: 330 }, palm: { x: 1310, y: 330 } }
const CARD_Y = 840
const CARD_X = (i: number) => 165 + i * 317
const TIP_S = 0.42

/* ---------- the real hands ---------- */
const REAL_VIEW = { yaw: -16, pitch: 10, roll: 0, s: 1.55 }
const REAL_POSE: HandPose = { ...GRASPS.relaxed, index: [8, 10, 6, 3], middle: [12, 14, 8, 0] }
const REAL_X = [330, 800, 1270]
const REAL_Y = 830
const realTips = (() => {
  const s = makeHandStore({ pose: REAL_POSE, view: REAL_VIEW })
  return REAL_X.map((x) => Object.fromEntries(FINGERS.map((f) => [f, tipOnStage(s, f, x, REAL_Y)])) as Record<(typeof FINGERS)[number], { x: number; y: number }>)
})()

/** One sensor card for the play: drag it (or tap it, then tap a job). */
function SensorCard({ kind, i, picked, onPick, onDrag, onDrop, enabled }: { kind: Kind; i: number; picked: boolean; onPick: () => void; onDrag: (p: { x: number; y: number } | null) => void; onDrop: (p: { x: number; y: number }) => void; enabled: boolean }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const drag = useDrag({
    onStart: (p) => {
      if (!enabled) return
      start.current = p
      moved.current = false
    },
    onMove: (p) => {
      if (!enabled || !start.current) return
      if (Math.hypot(p.x - start.current.x, p.y - start.current.y) > 10) moved.current = true
      if (moved.current) onDrag(p)
    },
    onEnd: (p) => {
      if (!enabled || !start.current) return
      start.current = null
      onDrag(null)
      if (moved.current) onDrop(p)
      else onPick()
    },
  })
  const x = CARD_X(i)
  const sk = SKIN[kind]
  return (
    <g
      data-tutor={`sensor-${sk.name}`}
      role="button"
      tabIndex={enabled ? 0 : -1}
      aria-label={`${sk.name} sensor`}
      onKeyDown={(e) => {
        if (enabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onPick()
        }
      }}
      {...drag}
      style={{ ...drag.style, outline: 'none' }}
    >
      <rect x={x - 150} y={CARD_Y - 190} width={300} height={220} fill="transparent" />
      {picked && <Pool x={x - 80} y={CARD_Y - 80} r={150} color="magenta" opacity={0.7} />}
      <g transform={`translate(${x - 92} ${CARD_Y}) scale(${TIP_S})`}>
        <SensorTip kind={kind} lit={picked} />
      </g>
      <text x={x - 30} y={CARD_Y - 150} fill={picked ? C.magentaLight : C.paper} fontFamily={SANS} fontSize={26} fontWeight={600}>
        {sk.name}
      </text>
      {[...sk.plus.map((t) => ['+', t]), ...sk.minus.map((t) => ['−', t])].map(([s, t], k) => (
        <text key={t} x={x - 30} y={CARD_Y - 112 + k * 28} fill={s === '+' ? C.mist : C.fog} fontFamily={SANS} fontSize={19}>
          <tspan fill={s === '+' ? C.lime : C.danger} fontFamily={MONO}>
            {s}{' '}
          </tspan>
          {t}
        </text>
      ))}
    </g>
  )
}

export function Ch3Skins({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const introRef = useRef<SVGGElement>(null)
  const shelfRef = useRef<SVGGElement>(null)
  const finger = useHandStore({ pose: FPOSE, view: FVIEW })
  const realA = useHandStore({ pose: REAL_POSE, view: REAL_VIEW })
  const realB = useHandStore({ pose: REAL_POSE, view: REAL_VIEW })
  const realC = useHandStore({ pose: REAL_POSE, view: REAL_VIEW })

  /* ---------- the play's state ---------- */
  const [assign, setAssign] = useState<Record<Job, Kind | null>>({ slip: null, key: null, palm: null })
  const [tries, setTries] = useState<Record<Job, number>>({ slip: 0, key: 0, palm: 0 })
  const [picked, setPicked] = useState<Kind | null>(null)
  const [ghostKind, setGhostKind] = useState<Kind | null>(null)
  const ghostRef = useRef<SVGGElement>(null)
  const moveGhost = (k: Kind, p: { x: number; y: number } | null) => {
    if (!p) {
      setGhostKind(null)
      return
    }
    if (ghostKind !== k) setGhostKind(k)
    ghostRef.current?.setAttribute('transform', `translate(${p.x} ${p.y + 60}) scale(0.4)`)
  }
  const [won, setWon] = useState(false)
  const active = cueIndex === 5 && !won
  const okCount = JOB_LIST.filter((j) => assign[j] && JOBS[j].ok.includes(assign[j] as Kind)).length

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(introRef.current, { x: 800, y: 450, zoom: 1 })
      const sh = camera(shelfRef.current, { x: 800, y: 540, zoom: 1 })

      /* b0: a fingertip, then into the skin: four receptors, four rhythms. */
      tl.addLabel('b0', 0)
      tl.set('.k-shelf, .k-play, .k-real', { opacity: 0 }, 0)
      tl.set('.k-intro', { opacity: 1 }, 0)
      tl.set('.k-skin', { opacity: 0 }, 0)
      cam.to(tl, { x: 760, y: 520, zoom: 1.15 }, 0, 2.2, 'sine.inOut')
      cam.to(tl, { x: FTIP.x, y: FTIP.y, zoom: 5 }, 2.2, 1.4, 'power3.in')
      fade(tl, '.k-intro', 0, 3.2, 0.5, 1)
      fade(tl, '.k-skin', 1, 3.2, 0.6)
      zoom(tl, root.current?.querySelector('.k-skinin'), 800, 380, 1.35, 1, 3.2, 3.2)
      fade(tl, '.k-r-merkel', 1, 5.0, 0.6)
      fade(tl, '.k-r-meissner', 1, 7.6, 0.6)
      fade(tl, '.k-r-pacini', 1, 12.2, 0.6)
      fade(tl, '.k-r-ruffini', 1, 14.4, 0.6)
      tl.to({}, { duration: 0.5 }, 18)

      /* b1: five fingertips on a shelf. */
      const b1 = 18.5
      tl.addLabel('b1', b1)
      fade(tl, '.k-skin', 0, b1, 0.6, 1)
      fade(tl, '.k-shelf', 1, b1, 0.8)
      sh.cut(tl, { x: 800, y: 560, zoom: 1.12 }, b1)
      sh.to(tl, { x: 800, y: 540, zoom: 1.0 }, b1, 3.6, 'sine.inOut')
      tl.fromTo('.k-sweep', { x: -500 }, { x: 1900, duration: 3.2, ease: 'sine.inOut', immediateRender: false }, b1 + 0.4)
      tl.fromTo('.k-tiplit', { opacity: 0 }, { opacity: 0.6, duration: 0.4, stagger: 0.45, yoyo: true, repeat: 1, immediateRender: false }, b1 + 0.6)

      /* b2: resistive, capacitive, piezo. */
      const b2 = b1 + 4
      tl.addLabel('b2', b2)
      sh.to(tl, { x: TIPX[0] + 30, y: 600, zoom: 2.0 }, b2, 1.0)
      fade(tl, '.k-spot-0', 1, b2 + 0.4, 0.5)
      tl.fromTo('.sk-res-press', { y: 0 }, { y: 30, duration: 0.5, ease: 'power2.in', yoyo: true, repeat: 3, repeatDelay: 0.4, immediateRender: false }, b2 + 1.0)
      tl.fromTo('.sk-res-spot', { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 3, repeatDelay: 0.7, immediateRender: false }, b2 + 1.4)
      fade(tl, '.k-lab-0', 1, b2 + 1.2, 0.5)
      sh.to(tl, { x: TIPX[1] + 30, y: 600, zoom: 2.0 }, b2 + 4.6, 0.9)
      fade(tl, '.k-spot-1', 1, b2 + 4.9, 0.5)
      tl.fromTo('.sk-cap-top', { y: 0 }, { y: 30, duration: 0.6, ease: 'power2.inOut', yoyo: true, repeat: 3, repeatDelay: 0.3, immediateRender: false }, b2 + 5.4)
      tl.fromTo('.sk-cap-field', { scaleY: 1 }, { scaleY: 0.6, duration: 0.6, ease: 'power2.inOut', yoyo: true, repeat: 3, repeatDelay: 0.3, transformOrigin: '50% 100%', immediateRender: false }, b2 + 5.4)
      fade(tl, '.k-lab-1', 1, b2 + 5.6, 0.5)
      fade(tl, '.sk-cap-noise', 1, b2 + 7.6, 0.2)
      fade(tl, '.sk-cap-noise', 0, b2 + 9.0, 0.4, 1)
      sh.to(tl, { x: TIPX[2] - 110, y: 540, zoom: 1.6 }, b2 + 9.4, 0.9)
      fade(tl, '.k-spot-2', 1, b2 + 9.7, 0.5)
      fade(tl, '.k-pz', 1, b2 + 10.0, 0.4)
      draw(tl, '.k-pz-axis', b2 + 10.0, 0.6)
      tl.fromTo('.sk-piezo-tap', { y: 0 }, { y: 18, duration: 0.12, ease: 'power3.in', yoyo: true, repeat: 1, immediateRender: false }, b2 + 10.6)
      tl.fromTo('.sk-piezo-film', { y: 0 }, { y: 3, duration: 0.05, yoyo: true, repeat: 5, immediateRender: false }, b2 + 10.72)
      draw(tl, '.k-pz-spike', b2 + 10.6, 0.5, 'none')
      fade(tl, '.k-pz-tap', 1, b2 + 10.9, 0.4)
      tl.fromTo('.sk-piezo-tap', { y: 0 }, { y: 18, duration: 0.5, ease: 'power2.in', immediateRender: false }, b2 + 12.0)
      draw(tl, '.k-pz-flat', b2 + 12.0, 1.6, 'none')
      fade(tl, '.k-pz-steady', 1, b2 + 12.6, 0.4)
      fade(tl, '.k-lab-2', 1, b2 + 12.4, 0.5)
      tl.fromTo('.sk-piezo-tap', { y: 18 }, { y: 0, duration: 0.4, immediateRender: false }, b2 + 14.0)

      /* b3: magnetic. Shear tilts the field; the skin swaps in seconds. */
      const b3 = b2 + 14.6
      tl.addLabel('b3', b3)
      sh.to(tl, { x: TIPX[3] - 20, y: 572, zoom: 1.8 }, b3, 1.0)
      fade(tl, '.k-spot-3', 1, b3 + 0.3, 0.5)
      tl.fromTo('.k-pusher', { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out', immediateRender: false }, b3 + 1.0)
      tl.fromTo('.sk-mag-skew', { skewX: 0 }, { skewX: -16, duration: 0.8, ease: 'power2.inOut', transformOrigin: '50% 100%', immediateRender: false }, b3 + 1.5)
      tl.fromTo('.sk-mag-field', { skewX: 0 }, { skewX: -22, duration: 0.8, ease: 'power2.inOut', transformOrigin: '50% 100%', immediateRender: false }, b3 + 1.5)
      fade(tl, '.k-mag-arrows', 1, b3 + 2.2, 0.5)
      tl.fromTo('.sk-mag-skew', { skewX: -16 }, { skewX: 0, duration: 0.6, ease: 'power2.inOut', transformOrigin: '50% 100%', immediateRender: false }, b3 + 5.2)
      tl.fromTo('.sk-mag-field', { skewX: -22 }, { skewX: 0, duration: 0.6, ease: 'power2.inOut', transformOrigin: '50% 100%', immediateRender: false }, b3 + 5.2)
      fade(tl, '.k-pusher', 0, b3 + 5.0, 0.4, 1)
      fade(tl, '.k-mag-arrows', 0, b3 + 5.4, 0.4, 1)
      tl.fromTo('.sk-mag-cap', { y: 0, x: 0, rotation: 0, opacity: 1 }, { y: -150, x: 60, rotation: 30, opacity: 0, duration: 0.7, ease: 'power2.out', transformOrigin: '50% 100%', immediateRender: false }, b3 + 6.2)
      tl.fromTo('.sk-mag-cap', { y: -170, x: 0, rotation: 0, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)', immediateRender: false }, b3 + 7.4)
      sh.shake(tl, b3 + 8.0, 0.3, 0.2)
      fade(tl, '.k-swap', 1, b3 + 8.0, 0.5)
      fade(tl, '.k-lab-3', 1, b3 + 1.0, 0.5)
      tl.fromTo('.k-click', { scale: 0.6, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.5, transformOrigin: '50% 50%', immediateRender: false }, b3 + 8.0)

      /* b4: the camera skin. */
      const b4 = b3 + 11.4
      tl.addLabel('b4', b4)
      sh.to(tl, { x: TIPX[4] + 170, y: 566, zoom: 1.75 }, b4, 1.0)
      fade(tl, '.k-spot-4', 1, b4 + 0.3, 0.5)
      fade(tl, '.sk-gel-key', 1, b4 + 1.0, 0.4)
      tl.fromTo('.sk-gel-key', { y: -40 }, { y: 16, duration: 1.0, ease: 'power2.in', immediateRender: false }, b4 + 1.0)
      tl.fromTo('.sk-gel-dent', { scaleY: 1 }, { scaleY: 0.82, duration: 0.4, transformOrigin: '50% 100%', immediateRender: false }, b4 + 1.8)
      fade(tl, '.k-print', 1, b4 + 2.4, 0.6)
      draw(tl, '.k-scanline', b4 + 2.4, 1.2, 'none')
      fade(tl, '.k-gel-lab', 1, b4 + 4.4, 0.6)
      fade(tl, '.k-gel-lab2', 1, b4 + 7.0, 0.6)
      fade(tl, '.k-lab-4', 1, b4 + 1.0, 0.5)
      tl.to({}, { duration: 0.4 }, b4 + 12)

      /* b5: the play. Back to the wide; the skins become cards under three jobs. */
      const b5 = b4 + 12.4
      tl.addLabel('b5', b5)
      sh.to(tl, { x: 800, y: 540, zoom: 1 }, b5, 1.4)
      fade(tl, '.k-shelf', 0, b5 + 1.2, 0.6, 1)
      fade(tl, '.k-play', 1, b5 + 1.2, 0.8)
      tl.fromTo('.k-job', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.4, immediateRender: false }, b5 + 1.6)
      tl.to({}, { duration: 0.3 }, b5 + 6.4)

      /* b6: real hands mix skins. */
      const b6 = b5 + 6.8
      tl.addLabel('b6', b6)
      fade(tl, '.k-play', 0, b6, 0.6, 1)
      fade(tl, '.k-real', 1, b6, 0.8)
      tl.fromTo('.k-realhand', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.5, ease: 'power2.out', immediateRender: false }, b6 + 0.2)
      realA.to(tl, { touch: { index: 0.8, middle: 0.3, thumb: 0.3 } }, b6 + 1.6, 0.8)
      fade(tl, '.k-real-a', 1, b6 + 2.0, 0.6)
      tl.fromTo('.k-clip', { y: -120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'bounce.out', immediateRender: false }, b6 + 2.4)
      realB.to(tl, { touch: { thumb: 1, index: 1, middle: 1, ring: 1, little: 1 } }, b6 + 5.0, 0.8)
      fade(tl, '.k-taxels', 1, b6 + 5.0, 0.8)
      fade(tl, '.k-real-b', 1, b6 + 5.2, 0.6)
      fade(tl, '.k-real-c', 1, b6 + 8.6, 0.6)
      fade(tl, '.k-real-note', 1, b6 + 9.6, 0.6)
      tl.to({}, { duration: 0.4 }, b6 + 12.4)
    },
    [realA, realB],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    // each receptor's own rhythm, on one 4-second cycle
    gsap.to('.k-g-merkel', { opacity: 0.75, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.fromTo('.k-g-meissner', { opacity: 0.35 }, { keyframes: [{ opacity: 0.35, duration: 0.6 }, { opacity: 1, duration: 0.08 }, { opacity: 0.35, duration: 0.5 }, { opacity: 0.35, duration: 1.42 }, { opacity: 1, duration: 0.08 }, { opacity: 0.35, duration: 0.5 }, { opacity: 0.35, duration: 0.82 }], repeat: -1 })
    gsap.fromTo('.k-pebble', { x: -60 }, { keyframes: [{ x: -60, duration: 0.6 }, { x: 60, duration: 1.4, ease: 'power1.inOut' }, { x: 60, duration: 0.6 }, { x: -60, duration: 1.4, ease: 'power1.inOut' }], repeat: -1 })
    gsap.to('.k-g-pacini', { scale: 1.05, duration: 0.04, yoyo: true, repeat: -1, transformOrigin: '50% 50%' })
    gsap.to('.k-buzz', { x: 3, duration: 0.03, yoyo: true, repeat: -1 })
    gsap.fromTo('.k-g-ruffini', { scaleX: 1 }, { scaleX: 1.25, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
    gsap.fromTo('.k-stretch', { x: 0 }, { x: 22, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.fromTo('.k-stretch2', { x: 0 }, { x: -22, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.k-shelflight', { opacity: 0.55, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.k-scrub', { x: 26, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.k-slotring', { rotation: 360, duration: 12, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
  })

  /* ---------- the play ---------- */
  const tryJob = (job: Job, kind: Kind) => {
    if (!active) return
    const ok = JOBS[job].ok.includes(kind)
    const next = { ...assign, [job]: kind }
    setAssign(next)
    setTries((t) => ({ ...t, [job]: t[job] + 1 }))
    setPicked(null)
    emit({ type: 'attempt', correct: ok, detail: `${SKIN[kind].name} for "${JOBS[job].title.join(' ')}": ${JOBS[job].verdict[kind]}` })
    const all = JOB_LIST.every((j) => next[j] && JOBS[j].ok.includes(next[j] as Kind))
    if (all) {
      setWon(true)
      memory.touchSkins = { ...next }
      window.setTimeout(() => {
        void say('No single skin does everything. That’s why the best hands mix several.').then(() => onPlayDone())
      }, 1800)
    }
  }
  const dropAt = (kind: Kind, p: { x: number; y: number }) => {
    let best: Job | null = null
    let bd = 300
    for (const j of JOB_LIST) {
      const d = Math.hypot(p.x - JOB_AT[j].x, p.y - JOB_AT[j].y)
      if (d < bd) {
        bd = d
        best = j
      }
    }
    if (best) tryJob(best, kind)
  }

  useEffect(() => {
    if (cueIndex === 5) {
      const desc = JOB_LIST.map((j) => `"${JOBS[j].title.join(' ')}": ${assign[j] ? `${SKIN[assign[j] as Kind].name} (${JOBS[j].ok.includes(assign[j] as Kind) ? 'works' : 'fails'}: ${JOBS[j].verdict[assign[j] as Kind]})` : 'empty'}`).join('; ')
      reportState(
        'The choose play. Three job vignettes across the top: a glass held between two robot fingertips ("Catch a glass the instant it starts to slip"), a fingertip on a key with a little screen for what it felt ("Read the shape of a key by feel"), and a robot palm scrubbing a plate ("Cover a whole palm cheaply, and survive scrubbing dishes"). Along the bottom, five sensor fingertips with their pluses and minuses: resistive, capacitive, piezo film, magnetic, camera gel. The learner drags a sensor onto a job (or taps a sensor, then a job); the job then plays out (the glass is caught or falls, the key print is crisp or blurry, the palm survives or not). ' +
          `Current assignments: ${desc}. ${okCount} of 3 jobs solved.${won ? ' All solved.' : ''} ` +
          'Correct answers: slip job: piezo or magnetic (both fast enough; piezo reacts in milliseconds to vibration, magnetic senses shear which predicts slip); camera gel fails because 30-60 frames a second is too slow. Key job: camera gel only (finest spatial detail). Palm job: resistive or magnetic (cheap, thin, replaceable); camera gel is wrong (bulky, gel tears), capacitive is confused by water and noise, piezo cannot feel a resting object. ' +
          'Likely mix-ups: choosing camera gel for slip because it is the most detailed; choosing camera gel for the palm; thinking piezo can hold a steady reading.',
      )
      setHints(['Slip happens fast. Which sensor reacts in a few thousandths of a second?', 'Reading a key’s teeth needs fine detail, not speed.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, assign, okCount, won, reportState, setHints])

  const verdictColor = (j: Job) => (assign[j] ? (JOBS[j].ok.includes(assign[j] as Kind) ? C.lime : C.danger) : C.fog)

  return (
    <g ref={root}>
      {/* ---------- b0: a fingertip, then the skin cutaway ---------- */}
      <g className="k-intro" ref={introRef} pointerEvents="none">
        <g data-depth="0.5">
          <DimRoom />
          <Pool x={700} y={500} r={600} color="key" opacity={0.7} />
        </g>
        <g data-depth="1">
          <Hand3D store={finger} x={1180} y={240} look="human" arm={500} light={[-0.6, -0.8]} />
          <Dust x={100} y={100} w={1300} h={700} count={24} seed={3} />
        </g>
      </g>

      <g className="k-skin" opacity={0} pointerEvents="none">
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink} />
        <g className="k-skinin">
          {/* deep layers */}
          <rect x={-120} y={SURF} width={1840} height={800} fill="#3a1f1c" />
          <rect x={-120} y={640} width={1840} height={400} fill="#2a1712" />
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse key={i} cx={-40 + i * 130} cy={720 + (i % 3) * 50} rx={60} ry={34} fill="#4a3020" opacity={0.6} />
          ))}
          <path d={EPI_D} fill="#b9785a" />
          <path d={EPI_D} fill={C.ink} opacity={0.25} />
          <path d={SURF_D} fill="none" stroke="#e7b08c" strokeWidth={4} />
          <Pool x={800} y={300} r={900} color="key" opacity={0.35} />
          <text x={1500} y={SURF + 40} textAnchor="end" fill="#f1c9a8" fontFamily={SANS} fontSize={20} opacity={0.75}>
            epidermis
          </text>
          <text x={1500} y={PAP + 70} textAnchor="end" fill="#e0a789" fontFamily={SANS} fontSize={20} opacity={0.6}>
            dermis
          </text>

          {/* Merkel discs: steady pressure under a pressing block */}
          <g className="k-r-merkel" opacity={0}>
            <rect x={RX.merkel - 70} y={SURF - 90} width={140} height={84} rx={8} fill={C.ink4} stroke={C.slate} strokeWidth={2} />
            <path d={`M${RX.merkel} ${SURF - 140} v40`} stroke={C.amber} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            <path d={`M${RX.merkel} ${papY(RX.merkel) + 30} Q ${RX.merkel + 20} 560 ${RX.merkel - 10} 920`} fill="none" stroke={C.magentaLight} strokeWidth={3} opacity={0.6} />
            <g className="k-g-merkel">
              {[-36, -12, 12, 36].map((dx) => (
                <ellipse key={dx} cx={RX.merkel + dx} cy={papY(RX.merkel + dx) + 4} rx={11} ry={5} fill={C.magenta} filter="url(#cn-bloom)" />
              ))}
              <Pool x={RX.merkel} y={PAP} r={120} color="magenta" opacity={0.6} />
            </g>
            <Label x={RX.merkel} y={papY(RX.merkel) + 30} tx={RX.merkel} ty={LAB_Y - 46} text="pressure + edges" sub="Merkel discs · steady" color={C.magentaLight} anchor="middle" hidden={false} dot={false} size={30} />
            <path d={TRAIN.merkel} transform={`translate(${RX.merkel - 20} ${LAB_Y + 52})`} stroke={C.magenta} strokeWidth={2.5} />
          </g>

          {/* Meissner corpuscles: a blip when something starts to slide */}
          <g className="k-r-meissner" opacity={0}>
            <g className="k-pebble">
              <ellipse cx={RX.meissner} cy={SURF - 26} rx={44} ry={22} fill={C.slate} />
              <ellipse cx={RX.meissner - 12} cy={SURF - 34} rx={16} ry={6} fill={C.mist} opacity={0.4} />
            </g>
            <path d={`M${RX.meissner} ${papY(RX.meissner) - 20} Q ${RX.meissner - 30} 560 ${RX.meissner + 10} 920`} fill="none" stroke={C.magentaLight} strokeWidth={3} opacity={0.6} />
            <g className="k-g-meissner">
              {[-35, 35].map((dx) => (
                <g key={dx}>
                  <ellipse cx={RX.meissner + dx} cy={papY(RX.meissner + dx) - 30} rx={12} ry={24} fill={C.magenta} filter="url(#cn-bloom)" />
                  {[-12, -4, 4, 12].map((dy) => (
                    <line key={dy} x1={RX.meissner + dx - 9} x2={RX.meissner + dx + 9} y1={papY(RX.meissner + dx) - 30 + dy} y2={papY(RX.meissner + dx) - 30 + dy} stroke={C.magentaLight} strokeWidth={2} />
                  ))}
                </g>
              ))}
              <Pool x={RX.meissner} y={PAP - 20} r={130} color="magenta" opacity={0.7} />
            </g>
            <Label x={RX.meissner} y={papY(RX.meissner)} tx={RX.meissner} ty={LAB_Y - 46} text="slip onset" sub="Meissner · blip on change" color={C.magentaLight} anchor="middle" hidden={false} dot={false} size={30} />
            <path d={TRAIN.meissner} transform={`translate(${RX.meissner - 20} ${LAB_Y + 52})`} stroke={C.magenta} strokeWidth={2.5} />
          </g>

          {/* Ruffini endings: slow stretch as the skin is pulled sideways */}
          <g className="k-r-ruffini" opacity={0}>
            <g className="k-stretch2">
              <path d={`M${RX.ruffini - 50} ${SURF - 30} h-70`} stroke={C.amber} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            </g>
            <g className="k-stretch">
              <path d={`M${RX.ruffini + 50} ${SURF - 30} h70`} stroke={C.amber} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            </g>
            <path d={`M${RX.ruffini + 60} 520 Q ${RX.ruffini + 100} 700 ${RX.ruffini + 60} 920`} fill="none" stroke={C.magentaLight} strokeWidth={3} opacity={0.6} />
            <g className="k-g-ruffini">
              <ellipse cx={RX.ruffini} cy={520} rx={90} ry={16} fill={C.magentaDark} opacity={0.8} filter="url(#cn-bloom)" />
              <path d={`M${RX.ruffini - 80} 520 l20 -8 l20 16 l20 -16 l20 16 l20 -16 l20 16 l20 -16 l20 8`} fill="none" stroke={C.magentaLight} strokeWidth={2} />
            </g>
            <Label x={RX.ruffini} y={540} tx={RX.ruffini} ty={LAB_Y - 46} text="stretch / shear" sub="Ruffini · slow" color={C.magentaLight} anchor="middle" hidden={false} dot={false} size={30} />
            <path d={TRAIN.ruffini} transform={`translate(${RX.ruffini - 20} ${LAB_Y + 52})`} stroke={C.magenta} strokeWidth={2.5} />
          </g>

          {/* Pacinian corpuscle: deep, buzzing with vibration */}
          <g className="k-r-pacini" opacity={0}>
            <g className="k-buzz">
              <rect x={RX.pacini - 8} y={SURF - 170} width={16} height={150} fill={C.metal} />
              <path d={`M${RX.pacini - 8} ${SURF - 20} L${RX.pacini} ${SURF - 4} L${RX.pacini + 8} ${SURF - 20} Z`} fill={C.metalDark} />
              {[0, 1, 2].map((i) => (
                <path key={i} d={`M${RX.pacini + 24 + i * 12} ${SURF - 90} q 6 10 0 20 q -6 10 0 20`} fill="none" stroke={C.paper} strokeWidth={2} opacity={0.5} />
              ))}
            </g>
            <path d={`M${RX.pacini} 700 Q ${RX.pacini - 30} 820 ${RX.pacini} 920`} fill="none" stroke={C.magentaLight} strokeWidth={3} opacity={0.6} />
            <g className="k-g-pacini">
              {[78, 62, 46, 30, 16].map((r, i) => (
                <ellipse key={r} cx={RX.pacini} cy={650} rx={r} ry={r * 0.62} fill={i === 4 ? C.magenta : 'none'} stroke={C.magentaLight} strokeWidth={2} opacity={0.4 + i * 0.12} />
              ))}
              <Pool x={RX.pacini} y={650} r={160} color="magenta" opacity={0.6} />
            </g>
            <Label x={RX.pacini} y={700} tx={RX.pacini} ty={LAB_Y - 6} text="vibration" sub="Pacinian · fast buzz" color={C.magentaLight} anchor="middle" hidden={false} dot={false} size={30} />
            <path d={TRAIN.pacini} transform={`translate(${RX.pacini - 20} ${LAB_Y + 72})`} stroke={C.magenta} strokeWidth={2} />
          </g>
        </g>
      </g>

      {/* ---------- b1-b4: the shelf of five skins ---------- */}
      <g className="k-shelf" opacity={0} ref={shelfRef} pointerEvents="none">
        <g data-depth="0.45">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            <rect x={-200} y={80} width={400} height={500} fill={C.ink3} />
            <rect x={1500} y={60} width={400} height={540} fill={C.ink3} />
            <circle cx={1200} cy={180} r={40} fill={C.rim} opacity={0.3} />
            <circle cx={300} cy={160} r={34} fill={C.key} opacity={0.25} />
          </g>
          <g className="k-shelflight">
            <Pool x={800} y={520} r={900} color="rim" opacity={0.35} />
          </g>
        </g>
        <g data-depth="1">
          <rect x={-200} y={SHELF_Y} width={2200} height={22} fill={C.ink3} />
          <rect x={-200} y={SHELF_Y} width={2200} height={3} fill={C.rim} opacity={0.3} />
          <rect x={-200} y={SHELF_Y + 22} width={2200} height={400} fill={C.ink} />
          {TIPX.map((x, i) => (
            <g key={x}>
              <g className={`k-spot-${i}`} opacity={0}>
                <Pool x={x} y={SHELF_Y - 180} r={300} color="magenta" opacity={0.55} />
              </g>
              <g className="k-tiplit" opacity={0}>
                <Pool x={x} y={SHELF_Y - 160} r={220} color="paper" opacity={0.5} />
              </g>
              <g transform={`translate(${x} ${SHELF_Y})`}>
                <SensorTip kind={KINDS[i]} />
              </g>
            </g>
          ))}
          <rect className="k-sweep" x={-200} y={-100} width={160} height={1000} fill={C.paper} opacity={0.05} filter="url(#cn-dof-3)" />
          {/* names and tradeoffs, small: the camera brings them close */}
          {[
            ['resistive', 'cheap · drifts and wears'],
            ['capacitive', 'sensitive · hates electrical noise'],
            ['piezo film', 'catches vibration · no steady push'],
            ['magnetic', 'feels shear · skin swaps'],
            ['camera gel', 'finest detail · bulky, slow'],
          ].map(([n, t], i) => (
            <g key={n} className={`k-lab-${i}`} opacity={0}>
              <text x={TIPX[i]} y={SHELF_Y + 52} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={600}>
                {n}
              </text>
              <text x={TIPX[i]} y={SHELF_Y + 76} textAnchor="middle" fill={C.magentaLight} fontFamily={SANS} fontSize={15}>
                {t}
              </text>
            </g>
          ))}
          {/* piezo: a tiny scope beside its fingertip */}
          <g className="k-pz" opacity={0}>
            <g transform="translate(-440 -262)">
            <path className="k-pz-axis" pathLength={1} strokeDasharray="1" d={`M${TIPX[2] + 110} ${SHELF_Y - 200} V${SHELF_Y - 100} H${TIPX[2] + 330}`} fill="none" stroke={C.fog} strokeWidth={1.5} />
            <path className="k-pz-spike" pathLength={1} strokeDasharray="1" d={`M${TIPX[2] + 112} ${SHELF_Y - 140} H${TIPX[2] + 150} L${TIPX[2] + 156} ${SHELF_Y - 196} L${TIPX[2] + 162} ${SHELF_Y - 104} L${TIPX[2] + 168} ${SHELF_Y - 160} L${TIPX[2] + 174} ${SHELF_Y - 140} H${TIPX[2] + 210}`} fill="none" stroke={C.magenta} strokeWidth={2.5} filter="url(#cn-bloom)" />
            <path className="k-pz-flat" pathLength={1} strokeDasharray="1" d={`M${TIPX[2] + 210} ${SHELF_Y - 140} L${TIPX[2] + 216} ${SHELF_Y - 150} L${TIPX[2] + 222} ${SHELF_Y - 140} H${TIPX[2] + 328}`} fill="none" stroke={C.magenta} strokeWidth={2.5} />
            <text className="k-pz-tap" opacity={0} x={TIPX[2] + 162} y={SHELF_Y - 86} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={13}>
              tap: spike
            </text>
            <text className="k-pz-steady" opacity={0} x={TIPX[2] + 275} y={SHELF_Y - 86} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={13}>
              steady push: flat
            </text>
            </g>
          </g>
          {/* magnetic: a sideways push, and what it measures */}
          <g className="k-pusher" opacity={0}>
            <rect x={TIPX[3] - 170} y={SHELF_Y - 318} width={90} height={44} rx={10} fill={C.ink4} stroke={C.slate} strokeWidth={2} />
          </g>
          <g className="k-mag-arrows" opacity={0}>
            <path d={`M${TIPX[3]} ${SHELF_Y - 400} v60`} stroke={C.amber} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            <path d={`M${TIPX[3] - 70} ${SHELF_Y - 330} h70`} stroke={C.amber} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            <text x={TIPX[3] + 12} y={SHELF_Y - 384} fill={C.amberLight} fontFamily={SANS} fontSize={15}>
              normal
            </text>
            <text x={TIPX[3] - 70} y={SHELF_Y - 342} fill={C.amberLight} fontFamily={SANS} fontSize={15}>
              shear
            </text>
          </g>
          <circle className="k-click" cx={TIPX[3]} cy={SHELF_Y - 250} r={70} fill="none" stroke={C.magentaLight} strokeWidth={3} opacity={0} />
          <g className="k-swap" opacity={0}>
            <text x={TIPX[3] - 100} y={SHELF_Y - 340} textAnchor="end" fill={C.magentaLight} fontFamily={SANS} fontSize={20} fontWeight={600}>
              swap in 12 s
            </text>
            <text x={TIPX[3] - 100} y={SHELF_Y - 318} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={12}>
              AnySkin, 2024
            </text>
          </g>
          {/* camera gel: what the camera sees */}
          <g className="k-print" opacity={0}>
            <KeyPrint x={TIPX[4] + 270} y={SHELF_Y - 240} w={230} h={120} />
            <path className="k-scanline" pathLength={1} strokeDasharray="1" d={`M${TIPX[4] + 155} ${SHELF_Y - 300} H${TIPX[4] + 385}`} stroke={C.magentaLight} strokeWidth={2} opacity={0.6} />
            <path d={`M${TIPX[4] + 60} ${SHELF_Y - 190} L${TIPX[4] + 155} ${SHELF_Y - 220}`} stroke={C.cyan} strokeWidth={1.5} strokeDasharray="4 4" />
          </g>
          <g className="k-gel-lab" opacity={0}>
            <text x={TIPX[4] + 155} y={SHELF_Y - 330} fill={C.paper} fontFamily={SANS} fontSize={17} fontWeight={600}>
              GelSight, Meta Digit 360: ~30-60 Hz
            </text>
            <text x={TIPX[4] + 155} y={SHELF_Y - 310} fill={C.magentaLight} fontFamily={SANS} fontSize={14}>
              finer than your fingertip
            </text>
          </g>
          <g className="k-gel-lab2" opacity={0}>
            <text x={TIPX[4] + 155} y={SHELF_Y - 150} fill={C.mist} fontFamily={SANS} fontSize={15}>
              bulky: the camera needs room to focus
            </text>
          </g>
        </g>
      </g>

      {/* ---------- b5: the play ---------- */}
      <g className="k-play" opacity={0} pointerEvents={active ? 'auto' : 'none'}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <rect x={-100} y={-100} width={1800} height={1100} fill="url(#cn-grid-big)" opacity={0.35} />
        <rect x={-100} y={600} width={1800} height={500} fill={C.ink} opacity={0.6} />
        <Dust x={0} y={0} w={1600} h={600} count={20} seed={17} color={C.mist} size={0.6} />
        {JOB_LIST.map((j) => {
          const { x, y } = JOB_AT[j]
          const k = assign[j]
          const ok = k ? JOBS[j].ok.includes(k) : false
          const t = tries[j]
          return (
            <g
              key={j}
              className="k-job"
              data-tutor={`job-${j}`}
              role="button"
              tabIndex={active && picked ? 0 : -1}
              aria-label={JOBS[j].title.join(' ')}
              onClick={() => picked && tryJob(j, picked)}
              onKeyDown={(e) => {
                if (picked && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  tryJob(j, picked)
                }
              }}
              style={{ cursor: picked ? 'pointer' : 'default', outline: 'none' }}
            >
              <rect x={x - 240} y={y - 250} width={480} height={500} fill="transparent" />
              <Pool x={x} y={y + 10} r={300} color={k ? (ok ? 'lime' : 'danger') : 'key'} opacity={k ? 0.35 : 0.45} />
              <text x={x} y={y - 210} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={25} fontWeight={600}>
                {JOBS[j].title[0]}
              </text>
              <text x={x} y={y - 180} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={25} fontWeight={600}>
                {JOBS[j].title[1]}
              </text>
              <JobArt job={j} kind={k} attempt={t} />
              {/* the slot */}
              <g transform={`translate(${x + 160} ${y + 120})`}>
                <circle className="k-slotring" r={54} fill={C.ink} fillOpacity={0.5} stroke={picked || ghostKind ? C.magentaLight : C.slate} strokeWidth={2.5} strokeDasharray="8 7" />
                {k ? (
                  <g transform={`translate(0 52) scale(0.3)`}>
                    <SensorTip kind={k} lit />
                  </g>
                ) : (
                  <text y={6} textAnchor="middle" fill={C.fog} fontFamily={SANS} fontSize={15}>
                    drop here
                  </text>
                )}
              </g>
              {k && (
                <text key={`v${t}`} className="tc-pop" x={x} y={y + 214} textAnchor="middle" fill={verdictColor(j)} fontFamily={SANS} fontSize={22} fontWeight={600}>
                  {ok ? '✓ ' : '✗ '}
                  {SKIN[k].name}: {JOBS[j].verdict[k]}
                </text>
              )}
            </g>
          )
        })}
        {KINDS.map((k, i) => (
          <SensorCard
            key={k}
            kind={k}
            i={i}
            enabled={active}
            picked={picked === k}
            onPick={() => setPicked((p) => (p === k ? null : k))}
            onDrag={(p) => moveGhost(k, p)}
            onDrop={(p) => dropAt(k, p)}
          />
        ))}
        <g ref={ghostRef} pointerEvents="none" opacity={ghostKind ? 0.9 : 0}>
          {ghostKind && <SensorTip kind={ghostKind} lit />}
        </g>
        {active && (
          <text x={800} y={600} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={20}>
            {picked ? `now tap a job for the ${SKIN[picked].name} sensor` : 'drag a sensor onto a job (or tap a sensor, then a job)'}
          </text>
        )}
        {won && (
          <text className="tc-pop" x={800} y={600} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={24} fontWeight={600}>
            three jobs, three different skins
          </text>
        )}
      </g>

      {/* ---------- b6: real hands ---------- */}
      <g className="k-real" opacity={0} pointerEvents="none">
        <DimRoom />
        <Pool x={800} y={520} r={900} color="rim" opacity={0.3} />
        {[realA, realB, realC].map((st, i) => (
          <g key={i} className="k-realhand">
            <Pool x={REAL_X[i]} y={560} r={300} color={i === 2 ? 'dark' : 'magenta'} opacity={i === 2 ? 0.8 : 0.3} />
            <Hand3D store={st as HandStore} x={REAL_X[i]} y={REAL_Y} look="robot" arm={200} light={[-0.7, -0.6]} shell={i === 2 ? C.shellMid : C.shell} />
          </g>
        ))}
        <g className="k-clip" opacity={0}>
          <path d={`M${realTips[0].index.x - 22} ${realTips[0].index.y - 26} h40 a8 8 0 0 1 0 16 h-36 a6 6 0 0 1 0 -11 h30`} fill="none" stroke={C.metal} strokeWidth={3} />
        </g>
        <g className="k-taxels" opacity={0}>
          {FINGERS.map((f) => (
            <g key={f}>
              {Array.from({ length: 25 }, (_, k) => (
                <circle key={k} cx={realTips[1][f].x - 12 + (k % 5) * 6} cy={realTips[1][f].y - 12 + Math.floor(k / 5) * 6} r={1.6} fill={C.magentaLight} />
              ))}
            </g>
          ))}
        </g>
        <g className="k-real-a" opacity={0}>
          <Label x={realTips[0].index.x} y={realTips[0].index.y - 30} tx={REAL_X[0] - 40} ty={150} text="Figure 03" sub="feels ~3 g: a paperclip" color={C.magentaLight} anchor="middle" hidden={false} />
        </g>
        <g className="k-real-b" opacity={0}>
          <Label x={realTips[1].middle.x} y={realTips[1].middle.y - 20} tx={REAL_X[1]} ty={150} text="Sharpa Wave" sub="1,000+ sensing points per fingertip" color={C.magentaLight} anchor="middle" hidden={false} />
        </g>
        <g className="k-real-c" opacity={0}>
          <Label x={realTips[2].middle.x} y={realTips[2].middle.y - 20} tx={REAL_X[2]} ty={150} text="a cheap linkage hand" sub="almost no touch at all" color={C.mist} anchor="middle" hidden={false} />
        </g>
        <g className="k-real-note" opacity={0}>
          <Mono x={800} y={880} anchor="middle" color={C.fog} size={18}>
            company figures
          </Mono>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** The little world of each job, and how it plays out with the sensor it was given. */
function JobArt({ job, kind, attempt }: { job: Job; kind: Kind | null; attempt: number }) {
  const { x, y } = JOB_AT[job]
  const ok = kind ? JOBS[job].ok.includes(kind) : false
  const k = `${attempt}`
  if (job === 'slip') {
    return (
      <g>
        <g key={`g${k}`} className={kind ? (ok ? 'tc-slip-ok' : 'tc-slip-fail') : undefined}>
          <g transform={`translate(${x - 40} ${y + 100})`}>
            <Glass w={86} h={170} />
          </g>
        </g>
        {/* two fingertips pinching the glass */}
        <g key={`f${k}`} className={kind && ok ? 'tc-squeeze-l' : undefined}>
          <rect x={x - 120} y={y - 150} width={40} height={170} rx={20} fill="url(#cn-shell)" />
          <ellipse cx={x - 82} cy={y - 6} rx={8} ry={20} fill={kind ? C.magenta : C.rubber} opacity={kind ? 0.9 : 1} />
        </g>
        <g key={`r${k}`} className={kind && ok ? 'tc-squeeze-r' : undefined}>
          <rect x={x + 0} y={y - 150} width={40} height={170} rx={20} fill="url(#cn-shell)" />
          <ellipse cx={x + 2} cy={y - 6} rx={8} ry={20} fill={kind ? C.magenta : C.rubber} opacity={kind ? 0.9 : 1} />
        </g>
      </g>
    )
  }
  if (job === 'key') {
    return (
      <g>
        <path d={`M${x - 200} ${y + 90} H${x + 60} V${y + 100} L${x + 50} ${y + 112} L${x + 40} ${y + 100} L${x + 30} ${y + 114} L${x + 20} ${y + 100} L${x + 10} ${y + 110} L${x} ${y + 100} H${x - 200} Z`} fill={C.metal} stroke={C.metalDark} strokeWidth={2} />
        <circle cx={x - 170} cy={y + 96} r={22} fill={C.ink1} stroke={C.metal} strokeWidth={10} />
        <g key={`p${k}`} className={kind ? 'tc-press' : undefined}>
          <rect x={x - 70} y={y - 130} width={60} height={200} rx={30} fill="url(#cn-shell)" />
          <ellipse cx={x - 40} cy={y + 64} rx={24} ry={10} fill={kind ? C.magenta : C.rubber} />
        </g>
        {/* what it felt */}
        <g transform={`translate(${x + 100} ${y - 40})`}>
          <rect x={-90} y={-60} width={180} height={120} fill="#14060f" stroke={C.slate} strokeWidth={2} />
          {!kind && (
            <text y={8} textAnchor="middle" fill={C.fog} fontFamily={SANS} fontSize={18}>
              what it felt
            </text>
          )}
          {kind && (
            <g key={`s${k}`} className="tc-pop">
              {kind === 'gel' && <KeyPrint x={0} y={0} w={176} h={116} />}
              {(kind === 'res' || kind === 'cap') && (
                <g filter="url(#cn-dof-2)">
                  {(kind === 'res' ? [[-30, 0, 34], [20, 6, 28]] : [[-40, -6, 18], [0, 10, 16], [36, 0, 14]]).map(([cx, cy, r]) => (
                    <circle key={cx} cx={cx} cy={cy} r={r} fill={C.magenta} opacity={0.7} />
                  ))}
                </g>
              )}
              {kind === 'piezo' && <path d="M-80 0 H-50 L-44 -36 L-38 30 L-32 0 H80" fill="none" stroke={C.magenta} strokeWidth={2.5} />}
              {kind === 'mag' && (
                <g>
                  <circle cx={-10} cy={4} r={8} fill={C.magenta} filter="url(#cn-bloom)" />
                  <text y={44} textAnchor="middle" fill={C.magentaLight} fontFamily={MONO} fontSize={13}>
                    contact at (12, 4) mm
                  </text>
                </g>
              )}
            </g>
          )}
        </g>
      </g>
    )
  }
  // palm: a robot palm scrubbing a plate in suds
  return (
    <g>
      <ellipse cx={x - 30} cy={y + 120} rx={150} ry={30} fill={C.paper} opacity={0.85} />
      <ellipse cx={x - 30} cy={y + 116} rx={100} ry={18} fill={C.mist} opacity={0.5} />
      {[[-140, 96], [-110, 84], [60, 100], [90, 88], [20, 80]].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r={8 + (i % 3) * 3} fill="none" stroke={C.cyanLight} strokeWidth={1.5} opacity={0.6} />
      ))}
      <g className="k-scrub">
        <g key={`h${k}`} className={kind && !ok ? 'tc-shake' : undefined}>
          <rect x={x - 110} y={y - 120} width={160} height={190} rx={34} fill="url(#cn-shell)" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={x - 104 + i * 38} y={y - 170} width={30} height={64} rx={15} fill="url(#cn-shell)" />
          ))}
          <rect x={x - 96} y={y - 98} width={132} height={150} rx={24} fill={C.rubber} />
          {kind && (
            <g key={`k${k}`} className="tc-pop">
              {(kind === 'res' || kind === 'mag' || kind === 'cap') &&
                Array.from({ length: 30 }, (_, i) => (
                  <circle key={i} cx={x - 80 + (i % 6) * 20} cy={y - 80 + Math.floor(i / 6) * 28} r={5} fill={kind === 'cap' ? C.danger : C.magenta} opacity={kind === 'cap' ? (i % 3 ? 0.2 : 0.9) : 0.85} />
                ))}
              {kind === 'piezo' && <rect x={x - 90} y={y - 30} width={120} height={8} fill={C.gold} opacity={0.6} />}
              {kind === 'gel' && (
                <g>
                  <ellipse cx={x - 30} cy={y - 20} rx={86} ry={70} fill={C.magenta} opacity={0.35} stroke={C.magentaLight} strokeWidth={3} />
                  <path d={`M${x - 70} ${y - 60} L${x - 40} ${y - 20} L${x - 60} ${y + 10}`} fill="none" stroke={C.danger} strokeWidth={4} />
                </g>
              )}
            </g>
          )}
        </g>
      </g>
    </g>
  )
}

export const ch3: Chapter = {
  id: 'skins',
  title: 'Ways to build a skin',
  cues: CUES,
  Scene: Ch3Skins,
  enter: { type: 'pan', dir: 'left' },
  deeper: [TactileReading],
}
