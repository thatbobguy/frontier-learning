import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, Label, Letterbox, Meter, Pool, Slider, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { DcDefs, KOFI, SourceIcon, Tag } from './common'
import { FleetsReading } from './readings'
import { BUDGET, FLEET_UNLOCK, PRICE, SIM_SCENE, SIM_SETUP, SOURCES, TARGET, TASKS, homesLit, hoursBought, simulate, type Alloc, type Result, type Source, type Task } from './tycoon'

export const CUES: Cue[] = [
  { id: 'fleet', say: 'The last source is the robots themselves. Deploy them, let them try, and have a person step in when they fail. Those rescues are the most valuable data of all, because they land exactly on the robot’s mistakes.' },
  { id: 'tycoon', say: 'You run data for a home robot start-up. You have one million dollars. Spend it on any mix of sources, and see how well your robot does in fifty homes it has never seen.', play: true },
  { id: 'consensus', say: 'That’s roughly where the field landed by 2026. The open fight is over how thin that robot layer can get: four hours? one hour per task? or thousands?' },
]

const HINTS = ['All teleop is faithful, but it can’t cover enough homes.', 'Cheap video helps most once you have some real robot data.', 'Simulation is great for rigid objects, weak for laundry.']

const STATE = [
  'Six windows into six different homes, each with Seven, a white humanoid robot, tidying a table. In one of them Seven fumbles and knocks a cup over (red). Cut to Kofi, a remote operator at a desk with a headset and a monitor showing that home: he takes over, his visor and Seven’s visor turn lime (control), and he guides the grasp to success. The moment is recorded as a lime “correction” clip that flies to a server rack and stacks up with others. The point: fleet data with human interventions lands exactly on the robot’s own mistakes, so it is the most valuable data per hour.',
  '',
  'A cross-section like rock strata: a wide base of human video (the cheapest, most diverse layer), a middle band of wearable/glove data, and on top a thin bright lime layer of the robot’s own data, which pulses with a question mark and the text “4 hours? 1 hour per task? thousands?”. Then the course tree: “The Missing Internet” (done), “Ways to Get Data” (this lesson), and the next node “How Robots Learn” lights up lime, with “The Home Robot Frontier” after it. The point: by 2026 the consensus is a thin layer of robot data on a wide base of cheap human data; how thin it can be is still open.',
]

const SRC_TEXT: Record<Source, string> = { teleop: 'teleoperation', gloves: 'gloves & UMI', video: 'head-camera video', sim: 'simulation', fleet: 'fleet practice' }
const SRC_ICON: Record<Source, 'teleop' | 'glove' | 'video' | 'sim' | 'fleet'> = { teleop: 'teleop', gloves: 'glove', video: 'video', sim: 'sim', fleet: 'fleet' }
const TASK_TEXT: Record<Task, string> = { tidy: 'tidy rigid objects', laundry: 'fold laundry', dishes: 'load a dishwasher' }
const STEP = 25_000
const ZERO: Alloc = { teleop: 0, gloves: 0, video: 0, sim: 0, fleet: 0 }

const money = (d: number) => (d >= 1_000_000 ? `$${(d / 1_000_000).toFixed(d % 1_000_000 ? 2 : 0)}M` : d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${d}`)
const hrs = (h: number) => (h >= 10_000 ? `${Math.round(h / 1000)}k h` : `${Math.round(h).toLocaleString('en-US')} h`)
const pct = (p: number) => `${Math.round(p * 100)}%`

/* ---------- fleet shot: six homes ---------- */
const ROOMS = Array.from({ length: 6 }, (_, i) => ({ x: 70 + (i % 3) * 500, y: 90 + Math.floor(i / 3) * 380, wall: ['#3a3040', '#2f3a34', '#40342a', '#2a3444', '#3c2e2e', '#33363e'][i] }))
const FAIL = 4
const RW = 460
const RH = 330

export function Ch4Budget({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const roomsRef = useRef<SVGGElement>(null)
  const kofiRef = useRef<SVGGElement>(null)
  const playRef = useRef<SVGGElement>(null)
  const strataRef = useRef<SVGGElement>(null)
  const treeRef = useRef<SVGGElement>(null)

  /* ---------------- the play's state ---------------- */
  const [alloc, setAlloc] = useState<Alloc>(ZERO)
  const [fleetOpen, setFleetOpen] = useState(false)
  const [run, setRun] = useState<{ id: number; alloc: Alloc; res: Result } | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const doneRef = useRef(false)
  const [done, setDone] = useState(false)
  const active = cueIndex === 1
  const spent = SOURCES.reduce((n, s) => n + alloc[s], 0)
  const hours = useMemo(() => hoursBought(alloc, fleetOpen), [alloc, fleetOpen])
  const stale = !run || SOURCES.some((s) => run.alloc[s] !== alloc[s])

  const setSource = (s: Source, v: number) => {
    if (!active) return
    setAlloc((a) => {
      // Dollars snap to $25k steps, and can never take the total past the budget.
      const rest = SOURCES.reduce((n, k) => n + a[k], 0) - a[s]
      const want = Math.round((v * BUDGET) / STEP) * STEP
      const next = Math.max(0, Math.min(want, BUDGET - rest))
      return next === a[s] ? a : { ...a, [s]: next }
    })
  }

  const train = () => {
    if (!active || spent === 0) return
    const res = simulate(alloc, fleetOpen)
    const id = (run?.id ?? 0) + 1
    setRun({ id, alloc: { ...alloc }, res })
    const mix = SOURCES.filter((s) => alloc[s] > 0)
      .map((s) => `${SRC_TEXT[s]} ${money(alloc[s])}`)
      .join(', ')
    const line = `run ${id}: ${mix || 'nothing'} → tidy ${pct(res.success.tidy)}, laundry ${pct(res.success.laundry)}, dishes ${pct(res.success.dishes)}, average ${pct(res.average)}`
    setHistory((h) => [...h.slice(-5), line])
    if (!fleetOpen && res.average > FLEET_UNLOCK) setFleetOpen(true)
    if (doneRef.current) return
    if (res.average >= TARGET) {
      doneRef.current = true
      setDone(true)
      emit({ type: 'attempt', correct: true, detail: `${line}: target of 60% reached` })
      // let the homes light up before the line is said
      window.setTimeout(() => {
        void say('No single source wins. The best labs mix them: a thin layer of the robot’s own data, on top of a wide base of cheap human data.')
        onPlayDone()
      }, 1600)
    } else {
      const worst = TASKS.reduce((w, k) => (res.success[k] < res.success[w] ? k : w), TASKS[0])
      emit({ type: 'attempt', correct: false, detail: `${line}; weakest: ${TASK_TEXT[worst]} (${res.why[worst]})` })
    }
  }

  /* ---------------- timeline ---------------- */
  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    const camR = camera(roomsRef.current, { x: 800, y: 450, zoom: 1.0 })
    const camK = camera(kofiRef.current, { x: 800, y: 450, zoom: 1.1 })
    const camP = camera(playRef.current, { x: 800, y: 450, zoom: 1.0 })
    const camS = camera(strataRef.current, { x: 800, y: 470, zoom: 1.15 })
    const camT = camera(treeRef.current, { x: 800, y: 450, zoom: 1.1 })
    const shots = ['.c4-rooms', '.c4-kofi', '.c4-play', '.c4-strata', '.c4-tree']
    const show = (which: string, at: number) => shots.forEach((s) => tl.set(s, { opacity: s === which ? 1 : 0 }, at + 0.02))
    const bots = ROOMS.map((_, i) => rig(el, `c4-bot${i}`, POSES.stand))
    const mon = rig(el, 'c4-mon', POSES.stand)
    const kofi = rig(el, 'c4-kofi', POSES.sitForward)

    /* b0: a fleet in six homes; one fails; Kofi steps in; the rescue becomes data. */
    tl.addLabel('b0', 0)
    show('.c4-rooms', 0)
    tl.set('.c4-fail', { opacity: 0 }, 0)
    camR.to(tl, { x: 800, y: 450, zoom: 1.0 }, 0, 0.001)
    camR.to(tl, { x: 800, y: 460, zoom: 1.06 }, 0.01, 3.8, 'sine.inOut')
    bots.forEach((b, i) => {
      const o = (i * 0.37) % 1
      for (let k = 0; k < 3; k++) {
        const at = o + k * 1.9
        b.to(tl, { torso: 16, head: 14, armN: 66, elbowN: 30, wristN: 8 }, at, 0.8)
        b.to(tl, { torso: 4, head: 6, armN: 24, elbowN: 60, wristN: 0 }, at + 0.95, 0.8)
      }
    })
    // the failure: the cup tips over in one home
    tl.fromTo('.c4-cup-fail', { rotation: 0, x: 0, svgOrigin: `${ROOMS[FAIL].x + 300} ${ROOMS[FAIL].y + 252}` }, { rotation: 90, x: 20, duration: 0.45, ease: 'power2.in', immediateRender: false, svgOrigin: `${ROOMS[FAIL].x + 300} ${ROOMS[FAIL].y + 252}` }, 2.6)
    fade(tl, '.c4-fail', 1, 2.9, 0.2)
    tl.fromTo('.c4-fail', { scale: 0.5, svgOrigin: `${ROOMS[FAIL].x + RW / 2} ${ROOMS[FAIL].y + RH / 2}` }, { scale: 1, duration: 0.4, ease: 'back.out(3)', immediateRender: false, svgOrigin: `${ROOMS[FAIL].x + RW / 2} ${ROOMS[FAIL].y + RH / 2}` }, 2.9)
    fade(tl, '.c4-dim', 1, 3.2, 0.6)
    camR.to(tl, { x: ROOMS[FAIL].x + RW / 2, y: ROOMS[FAIL].y + RH / 2, zoom: 2.4 }, 3.6, 1.8, 'power2.inOut')
    // Kofi's desk: he takes over; both visors turn lime
    const k0 = 5.5
    show('.c4-kofi', k0)
    tl.set('.c4-takeover', { opacity: 0 }, k0)
    camK.to(tl, { x: 760, y: 470, zoom: 1.25 }, k0, 0.001)
    camK.to(tl, { x: 820, y: 450, zoom: 1.08 }, k0 + 0.01, 8.6, 'sine.inOut')
    kofi.to(tl, { torso: 10, armN: 70, elbowN: 70, wristN: 0, armF: 64, elbowF: 74 }, k0 + 0.6, 0.8)
    tl.fromTo('.c4-visor-k', { attr: { fill: C.cyan } }, { attr: { fill: C.lime }, duration: 0.3, immediateRender: false }, k0 + 1.2)
    fade(tl, '.c4-takeover', 1, k0 + 1.3, 0.3)
    // the robot's own visor and chest light (the parts drawn with a glow) switch to lime: a person is in control
    const glows = Array.from(el?.querySelectorAll('.person.c4-mon [filter]') ?? [])
    glows.forEach((g) => {
      const k = g.tagName === 'path' ? 'stroke' : 'fill'
      tl.fromTo(g, { attr: { [k]: C.cyan } }, { attr: { [k]: C.lime }, duration: 0.3, immediateRender: false }, k0 + 1.4)
    })
    fade(tl, '.c4-lab-kofi', 1, k0 + 1.0, 0.5)
    // on the monitor, the robot sets the cup right, carefully
    mon.to(tl, { torso: 16, head: 16, armN: 70, elbowN: 26, wristN: 8 }, k0 + 1.6, 1.0)
    tl.fromTo('.c4-cup-mon', { rotation: 90, svgOrigin: '958 440' }, { rotation: 0, duration: 0.8, ease: 'power2.inOut', immediateRender: false, svgOrigin: '958 440' }, k0 + 2.8)
    mon.to(tl, { torso: 4, head: 6, armN: 24, elbowN: 50, wristN: 0 }, k0 + 3.7, 0.8)
    fade(tl, '.c4-rec', 1, k0 + 1.3, 0.2)
    fade(tl, '.c4-rec', 0, k0 + 3.9, 0.2, 1)
    // the clip is cut and flies to the server
    fade(tl, '.c4-clip', 1, k0 + 4.0, 0.3)
    tl.fromTo('.c4-clip', { x: 0, y: 0, scale: 1, svgOrigin: '960 600' }, { x: 470, y: 10, scale: 0.55, duration: 1.4, ease: 'power2.inOut', immediateRender: false, svgOrigin: '960 600' }, k0 + 4.6)
    fade(tl, '.c4-clip', 0, k0 + 6.0, 0.2, 1)
    tl.fromTo('.c4-stack-new', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, immediateRender: false }, k0 + 5.9)
    fade(tl, '.c4-lab-corr', 1, k0 + 6.2, 0.6)
    tl.to({}, { duration: 0.2 }, k0 + 8.8)

    /* b1: the tycoon play. */
    const b1 = k0 + 9
    tl.addLabel('b1', b1)
    show('.c4-play', b1)
    camP.to(tl, { x: 800, y: 450, zoom: 1.08 }, b1, 0.001)
    camP.to(tl, { x: 800, y: 450, zoom: 1.0 }, b1 + 0.01, 2.4, 'power2.inOut')
    tl.fromTo('.c4-in', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.18, ease: 'power2.out', immediateRender: false }, b1 + 0.3)
    tl.fromTo('.c4-home0', { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.006, immediateRender: false }, b1 + 1.6)
    tl.fromTo('.c4-pulse-train', { scale: 1, svgOrigin: '400 806' }, { scale: 1.06, duration: 0.5, yoyo: true, repeat: 5, ease: 'sine.inOut', immediateRender: false, svgOrigin: '400 806' }, b1 + 6)
    tl.to({}, { duration: 0.2 }, b1 + 11.6)

    /* b2: the consensus, as strata; then the course tree. */
    const b2 = b1 + 12
    tl.addLabel('b2', b2)
    show('.c4-strata', b2)
    camS.to(tl, { x: 800, y: 470, zoom: 1.15 }, b2, 0.001)
    camS.to(tl, { x: 800, y: 440, zoom: 1.0 }, b2 + 0.01, 7, 'sine.inOut')
    tl.fromTo('.c4-layer', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.9, ease: 'power2.out', immediateRender: false }, b2 + 0.3)
    fade(tl, '.c4-lab-video', 1, b2 + 1.0, 0.5)
    fade(tl, '.c4-lab-glove', 1, b2 + 1.9, 0.5)
    fade(tl, '.c4-lab-robot', 1, b2 + 2.8, 0.5)
    fade(tl, '.c4-q', 1, b2 + 4.2, 0.5)
    tl.fromTo('.c4-thin', { scaleY: 1, svgOrigin: '800 370' }, { scaleY: 0.35, duration: 0.9, yoyo: true, repeat: 1, ease: 'sine.inOut', immediateRender: false, svgOrigin: '800 370' }, b2 + 4.6)
    tl.fromTo('.c4-q-opt', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.7, immediateRender: false }, b2 + 4.8)
    const t0 = b2 + 7.6
    show('.c4-tree', t0)
    camT.to(tl, { x: 800, y: 450, zoom: 1.1 }, t0, 0.001)
    camT.to(tl, { x: 800, y: 480, zoom: 1.12 }, t0 + 0.01, 4.4, 'sine.inOut')
    tl.fromTo('.c4-edge-next', { strokeDashoffset: 300 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, t0 + 0.6)
    tl.fromTo('.c4-node-next', { opacity: 0.35 }, { opacity: 1, duration: 0.5, immediateRender: false }, t0 + 1.4)
    fade(tl, '.c4-next-glow', 0.55, t0 + 1.4, 0.6)
    letterbox(tl, '.c4-lb', true, t0 + 2.6)
    tl.to({}, { duration: 0.4 }, t0 + 4.2)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c4-led', { opacity: 0.25, duration: 0.5, yoyo: true, repeat: -1, stagger: 0.13, ease: 'steps(1)' })
    gsap.to('.c4-q-pulse', { opacity: 0.4, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- what Pip sees ---------------- */
  useEffect(() => {
    if (cueIndex !== 1) {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
      return
    }
    const now = SOURCES.map((s) => `${SRC_TEXT[s]} ${money(alloc[s])}`).join(', ')
    const last = run ? `Last test (${stale ? 'with an older mix' : 'with this mix'}): tidy ${pct(run.res.success.tidy)} (${run.res.why.tidy}), laundry ${pct(run.res.success.laundry)} (${run.res.why.laundry}), dishes ${pct(run.res.success.dishes)} (${run.res.why.dishes}); average ${pct(run.res.average)}.` : 'No test run yet.'
    reportState(
      'Data Budget Tycoon. The learner runs data for a home-robot start-up with $1,000,000. Five sliders split the money: teleoperation ($120/h, the robot’s own body, but only a handful of rooms), gloves & UMI ($40/h, fits the robot fairly well, many homes), head-camera video ($5/h, huge diversity, but it only helps once the model has some real robot data), simulation ($150k setup then nearly free: great for rigid objects, weak for dishes, nearly useless for cloth), and fleet practice ($15/h, locked until a test averages over 40%, then cheap and aimed at the robot’s own mistakes). A stacked bar shows hours bought. “Train and test” runs the robot in 50 unseen homes for three tasks (tidy rigid objects, fold laundry, load a dishwasher); each home lights lime on success. Target: average 60%. ' +
        `Money now: ${now}; spent ${money(spent)} of $1M. Fleet ${fleetOpen ? 'unlocked' : 'locked'}. ${last} Runs so far: ${history.length ? history.join(' | ') : 'none'}. ${done ? 'Target reached: the learner is done.' : ''} ` +
        'A mix that passes: roughly $150k–300k teleop, $300k–500k gloves, $200k–300k video, optionally $150k–200k sim; after unlocking, moving ~$150k into fleet adds a lot. All teleop (~15%) and all video (~2%) fail. ' +
        'Likely mix-ups: putting everything in the most faithful source (teleop covers too few homes); putting everything in the cheapest (video with no robot data grounds nothing); expecting simulation to help with laundry.',
    )
    setHints(HINTS)
  }, [cueIndex, alloc, run, stale, spent, fleetOpen, history, done, reportState, setHints])

  /* ---------------- drawing helpers ---------------- */
  const res = run?.res
  const totalH = SOURCES.reduce((n, s) => n + hours[s], 0)
  const barX = 120
  const barW = 600
  const bought = SOURCES.filter((s) => hours[s] > 0)
  const segs = bought.map((s, i) => {
    const before = bought.slice(0, i).reduce((n, k) => n + hours[k], 0)
    return { s, x: barX + (before / totalH) * barW, w: (hours[s] / totalH) * barW, o: [1, 0.75, 0.5, 0.32, 0.88][SOURCES.indexOf(s)] }
  })

  return (
    <g ref={root}>
      <DcDefs />
      <style>{`
        .c4-on { animation: c4-light 0.3s ease-out both; }
        @keyframes c4-light { from { opacity: 0 } to { opacity: 1 } }
        .flow-paused .c4-on { animation-play-state: paused; }
      `}</style>

      {/* ---------------- six homes, one fleet ---------------- */}
      <g className="c4-rooms" ref={roomsRef} pointerEvents="none">
        <g data-depth="0.6">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
        </g>
        <g data-depth="1">
          {ROOMS.map((r, i) => (
            <g key={i}>
              <rect x={r.x} y={r.y} width={RW} height={RH} rx={8} fill={r.wall} />
              <rect x={r.x} y={r.y + 270} width={RW} height={60} fill={C.ink2} />
              <Pool x={r.x + RW / 2} y={r.y + 120} r={220} color="key" opacity={0.45} />
              <rect x={r.x + (i % 2 ? 300 : 40)} y={r.y + 40} width={110} height={80} rx={4} fill="#1d2a3a" stroke={C.ink4} strokeWidth={3} />
              <rect x={r.x + 240} y={r.y + 230} width={180} height={12} rx={4} fill="#7a5434" />
              <rect x={r.x + 250} y={r.y + 242} width={10} height={30} fill="#5a3c24" />
              <rect x={r.x + 400} y={r.y + 242} width={10} height={30} fill="#5a3c24" />
              <g className={i === FAIL ? 'c4-cup-fail' : undefined}>
                <path d={`M${r.x + 290} ${r.y + 206} h22 l-3 24 h-16 Z`} fill={C.paper} />
              </g>
              <Robot name={`c4-bot${i}`} x={r.x + 160} y={r.y + 300} s={0.6} pose={POSES.stand} light="key-right" />
              <rect x={r.x} y={r.y} width={RW} height={RH} rx={8} fill="none" stroke={C.ink4} strokeWidth={4} />
              <Tag x={r.x + 12} y={r.y + 26} size={16}>
                home {i + 1}
              </Tag>
            </g>
          ))}
          <g className="c4-dim" opacity={0}>
            {ROOMS.map((r, i) => (i === FAIL ? null : <rect key={i} x={r.x} y={r.y} width={RW} height={RH} rx={8} fill={C.ink} opacity={0.7} />))}
          </g>
          <g className="c4-fail" opacity={0}>
            <rect x={ROOMS[FAIL].x} y={ROOMS[FAIL].y} width={RW} height={RH} rx={8} fill="none" stroke={C.danger} strokeWidth={6} />
            <text x={ROOMS[FAIL].x + 340} y={ROOMS[FAIL].y + 180} fill={C.danger} fontFamily={SANS} fontSize={44} fontWeight={700}>
              ✕
            </text>
          </g>
        </g>
      </g>

      {/* ---------------- Kofi steps in ---------------- */}
      <g className="c4-kofi" ref={kofiRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <Pool x={760} y={380} r={520} color="rim" opacity={0.55} />
        </g>
        <g data-depth="1">
          {/* the desk and the monitor showing home 5 */}
          <rect x={300} y={700} width={900} height={24} rx={6} fill={C.ink3} />
          <rect x={700} y={250} width={520} height={340} rx={10} fill={C.ink} stroke={C.ink4} strokeWidth={8} />
          <rect x={945} y={590} width={30} height={110} fill={C.ink3} />
          <g>
            <rect x={710} y={260} width={500} height={320} fill={ROOMS[FAIL].wall} />
            <rect x={710} y={510} width={500} height={70} fill={C.ink2} />
            <Pool x={960} y={380} r={220} color="key" opacity={0.5} />
            <rect x={900} y={470} width={200} height={12} rx={4} fill="#7a5434" />
            <g className="c4-cup-mon">
              <path d="M948 416 h22 l-3 24 h-16 Z" fill={C.paper} />
            </g>
            <Robot name="c4-mon" x={830} y={560} s={0.82} pose={POSES.stand} light="key-right" />
            <g className="c4-rec" opacity={0}>
              <circle cx={740} cy={290} r={9} fill={C.lime} />
              <text x={756} y={298} fill={C.lime} fontFamily={MONO} fontSize={20}>
                TAKEOVER · REC
              </text>
            </g>
          </g>
          <Person name="c4-kofi" x={460} y={860} s={1.55} pose={POSES.sitForward} light="key-right" {...KOFI} />
          <circle className="c4-visor-k" cx={545} cy={515} r={16} fill={C.cyan} opacity={0.6} filter="url(#cn-bloom-big)" />
          <g className="c4-takeover" opacity={0}>
            <path d="M560 470 C 620 380, 660 360, 700 380" fill="none" stroke={C.lime} strokeWidth={3} strokeDasharray="6 8" markerEnd="url(#cn-arrow)" />
          </g>
          <Label className="c4-lab-kofi" x={520} y={480} tx={420} ty={200} text="Kofi takes over" sub="remote, for a few seconds" color={C.lime} />
          {/* the correction clip */}
          <g className="c4-clip" opacity={0}>
            <rect x={880} y={570} width={160} height={60} rx={6} fill={C.ink} stroke={C.lime} strokeWidth={3} filter="url(#cn-bloom)" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={890 + i * 37} y={580} width={30} height={40} rx={3} fill={C.lime} opacity={0.35 + i * 0.15} />
            ))}
          </g>
          {/* the server rack */}
          <rect x={1340} y={420} width={200} height={300} rx={8} fill={C.ink2} stroke={C.ink4} strokeWidth={3} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect x={1356} y={440 + i * 44} width={168} height={32} rx={4} fill={C.ink1} />
              <circle className="c4-led" cx={1372} cy={456 + i * 44} r={4} fill={C.lime} />
            </g>
          ))}
          <g>
            {[0, 1, 2].map((i) => (
              <rect key={i} x={1360} y={390 - i * 22} width={160} height={18} rx={4} fill={C.lime} opacity={0.35} />
            ))}
            <rect className="c4-stack-new" x={1360} y={324} width={160} height={18} rx={4} fill={C.lime} opacity={0} filter="url(#cn-bloom)" />
          </g>
          <Label className="c4-lab-corr" x={1440} y={330} tx={1180} ty={170} text="corrections" sub="right where the robot failed" color={C.lime} />
        </g>
      </g>

      {/* ---------------- Data Budget Tycoon ---------------- */}
      <g className="c4-play" ref={playRef} opacity={0} pointerEvents={active ? 'auto' : 'none'}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c4-in">
            <text x={120} y={90} fill={C.paper} fontFamily={SERIF} fontSize={40}>
              Data Budget Tycoon
            </text>
            <text x={120} y={130} fill={C.gold} fontFamily={MONO} fontSize={22}>
              budget $1,000,000 · left {money(BUDGET - spent)}
            </text>
          </g>
          {SOURCES.map((s, i) => {
            const y = 230 + i * 92
            const locked = s === 'fleet' && !fleetOpen
            const label = s === 'sim' ? `${SRC_TEXT[s]} · $150k setup` : `${SRC_TEXT[s]} · $${PRICE[s]}/h`
            const val = s === 'sim' ? (alloc.sim === 0 ? '$0' : alloc.sim < SIM_SETUP ? `${money(alloc.sim)} · setup unfinished` : `${money(alloc.sim)} · ${Math.round((alloc.sim - SIM_SETUP) / SIM_SCENE)} scenes`) : `${money(alloc[s])} · ${hrs(hours[s])}`
            return (
              <g key={s} className="c4-in">
                <g transform={`translate(150 ${y - 8}) scale(0.62)`} opacity={locked ? 0.4 : 1}>
                  <SourceIcon kind={SRC_ICON[s]} />
                </g>
                <Slider x={220} y={y} w={500} value={alloc[s] / BUDGET} onChange={(v) => setSource(s, v)} color={C.lime} label={label} valueText={locked ? '' : val} disabled={!active || locked} tutor={`slider-${s}`} />
                {locked && (
                  <Tag x={720} y={y + 36} anchor="end" color={C.mist} size={18}>
                    locked until a test averages 40%
                  </Tag>
                )}
              </g>
            )
          })}
          {/* hours bought */}
          <g className="c4-in">
            <text x={barX} y={706} fill={C.fog} fontFamily={SANS} fontSize={22}>
              hours of data bought
            </text>
            <text x={barX + barW} y={706} textAnchor="end" fill={C.lime} fontFamily={MONO} fontSize={22}>
              {hrs(totalH)}
            </text>
            <rect x={barX} y={722} width={barW} height={26} rx={6} fill={C.ink3} />
            {segs.map((g) => (
              <g key={g.s}>
                <rect x={g.x} y={722} width={Math.max(0, g.w - 2)} height={26} fill={C.lime} opacity={g.o} />
                {g.w > 64 && (
                  <text x={g.x + g.w / 2} y={741} textAnchor="middle" fill={C.ink} fontFamily={MONO} fontSize={16} fontWeight={600}>
                    {g.s}
                  </text>
                )}
              </g>
            ))}
          </g>
          <g className="c4-in c4-pulse-train">
            <Chip x={400} y={806} w={320} h={60} text={spent === 0 ? 'spend something first' : stale ? 'train and test' : 'tested ✓'} color={C.lime} active={!stale} disabled={!active || spent === 0} onClick={train} tutor="train" />
          </g>

          {/* the 50 test homes, per task */}
          {TASKS.map((k, ti) => {
            const y0 = 200 + ti * 175
            const p = res ? res.success[k] : 0
            const lit = res ? homesLit(p, k) : []
            return (
              <g key={k} className="c4-in">
                <text x={830} y={y0} fill={C.paper} fontFamily={SANS} fontSize={26} fontWeight={600}>
                  {TASK_TEXT[k]}
                </text>
                {res && (
                  <>
                    <text x={1540} y={y0} textAnchor="end" fill={p >= TARGET ? C.lime : C.paper} fontFamily={MONO} fontSize={28} opacity={stale ? 0.45 : 1}>
                      {pct(p)}
                    </text>
                    <text x={830} y={y0 + 118} fill={res.why[k] === 'good' ? C.limeLight : res.why[k].startsWith('too little') || res.why[k].startsWith('sim') ? C.danger : C.mist} fontFamily={MONO} fontSize={18} opacity={stale ? 0.45 : 1}>
                      {res.why[k] === 'good' ? 'works in most homes' : res.why[k]}
                    </text>
                  </>
                )}
                <g key={run?.id ?? 0} opacity={stale && res ? 0.45 : 1}>
                  {Array.from({ length: 50 }, (_, i) => {
                    const hx = 842 + (i % 25) * 28.4
                    const hy = y0 + 46 + Math.floor(i / 25) * 40
                    return (
                      <g key={i} className="c4-home0" transform={`translate(${hx} ${hy})`}>
                        <path d="M-11 12 L-11 -1 L0 -11 L11 -1 L11 12 Z" fill={C.ink3} stroke={C.ink4} strokeWidth={1.2} />
                        {lit[i] && <path className="c4-on" d="M-11 12 L-11 -1 L0 -11 L11 -1 L11 12 Z" fill={C.lime} style={{ animationDelay: `${(i % 25) * 0.03 + Math.floor(i / 25) * 0.1 + ti * 0.35}s` }} />}
                      </g>
                    )
                  })}
                </g>
              </g>
            )
          })}
          <g className="c4-in">
            <Meter x={830} y={772} w={710} value={res ? res.average : 0} color={res && res.average >= TARGET ? C.lime : C.limeDark} label="average across the three tasks" valueText={res ? `${pct(res.average)} · target 60%` : 'target 60%'} mark={TARGET} />
            {fleetOpen && !done && (
              <Tag x={830} y={830} color={C.limeLight} size={18}>
                fleet practice unlocked: your robot works often enough to deploy
              </Tag>
            )}
            {done && (
              <Tag x={830} y={830} color={C.lime} size={20}>
                ✓ target reached
              </Tag>
            )}
          </g>
        </g>
      </g>

      {/* ---------------- the consensus, as strata ---------------- */}
      <g className="c4-strata" ref={strataRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <Dust x={0} y={0} w={1600} h={900} count={30} seed={9} color={C.mist} size={0.6} />
        </g>
        <g data-depth="1">
          <g transform="translate(700 0) scale(0.8 1) translate(-800 0)">
          <g className="c4-layer">
            <path d="M160 780 L1440 780 L1340 520 L260 520 Z" fill={C.lime} opacity={0.14} />
            {Array.from({ length: 60 }, (_, i) => (
              <rect key={i} x={240 + (i % 20) * 56} y={560 + Math.floor(i / 20) * 70} width={40} height={26} rx={3} fill={C.lime} opacity={0.12} />
            ))}
          </g>
          <g className="c4-layer">
            <path d="M260 520 L1340 520 L1290 390 L310 390 Z" fill={C.lime} opacity={0.32} />
          </g>
          <g className="c4-layer">
            <g className="c4-thin">
              <path d="M310 390 L1290 390 L1280 350 L320 350 Z" fill={C.lime} filter="url(#cn-bloom)" />
            </g>
          </g>
          </g>
          <Label className="c4-lab-video" x={1100} y={680} tx={1200} ty={740} text="human video" sub="cheapest, widest: millions of hours" color={C.limeLight} />
          <Label className="c4-lab-glove" x={1080} y={455} tx={1240} ty={520} text="gloves & wearables" sub="fits the robot, many homes" color={C.limeLight} />
          <Label className="c4-lab-robot" x={1050} y={368} tx={1240} ty={260} text="the robot’s own data" sub="teleop, fleets: thin" color={C.lime} />
          <g className="c4-q" opacity={0}>
            <text className="c4-q-pulse" x={700} y={300} textAnchor="middle" fill={C.lime} fontFamily={SERIF} fontSize={84}>
              ?
            </text>
          </g>
          {['4 hours?', '1 hour per task?', 'or thousands?'].map((t, i) => (
            <text key={t} className="c4-q-opt" x={200} y={150 + i * 50} fill={C.paper} fontFamily={MONO} fontSize={30} opacity={0}>
              {t}
            </text>
          ))}
        </g>
      </g>

      {/* ---------------- the course tree ---------------- */}
      <g className="c4-tree" ref={treeRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          {(() => {
            const N = [
              { x: 260, y: 300, t: 'The Missing Internet', st: 'done' },
              { x: 520, y: 440, t: 'Ways to Get Data', st: 'here' },
              { x: 780, y: 580, t: 'How Robots Learn', st: 'next' },
              { x: 1040, y: 720, t: 'The Home Robot Frontier', st: 'later' },
            ]
            return (
              <>
                <path d={`M${N[0].x} ${N[0].y} L${N[1].x} ${N[1].y}`} stroke={C.limeDark} strokeWidth={4} />
                <path className="c4-edge-next" d={`M${N[1].x} ${N[1].y} L${N[2].x} ${N[2].y}`} stroke={C.lime} strokeWidth={4} strokeDasharray="300" strokeDashoffset={300} />
                <path d={`M${N[2].x} ${N[2].y} L${N[3].x} ${N[3].y}`} stroke={C.ink4} strokeWidth={4} strokeDasharray="6 8" />
                {N.map((n) => (
                  <g key={n.t} className={n.st === 'next' ? 'c4-node-next' : undefined}>
                    {n.st === 'next' && <circle className="c4-next-glow" cx={n.x} cy={n.y} r={30} fill={C.lime} opacity={0} filter="url(#cn-bloom-big)" />}
                    <circle cx={n.x} cy={n.y} r={22} fill={n.st === 'later' ? C.ink2 : n.st === 'here' ? C.ink1 : C.lime} stroke={n.st === 'later' ? C.ink4 : C.lime} strokeWidth={4} opacity={n.st === 'done' ? 0.6 : 1} />
                    {n.st === 'done' && (
                      <text x={n.x} y={n.y + 8} textAnchor="middle" fill={C.ink} fontFamily={SANS} fontSize={24} fontWeight={700}>
                        ✓
                      </text>
                    )}
                    <text x={n.x + 40} y={n.y + 9} fill={n.st === 'later' ? C.mist : C.paper} fontFamily={SANS} fontSize={30} fontWeight={n.st === 'next' ? 700 : 500}>
                      {n.t}
                    </text>
                    {n.st === 'here' && (
                      <Tag x={n.x + 40} y={n.y + 44} color={C.mist} size={18}>
                        you are here
                      </Tag>
                    )}
                    {n.st === 'next' && (
                      <Tag x={n.x + 40} y={n.y + 44} color={C.lime} size={18}>
                        next: learning from data
                      </Tag>
                    )}
                  </g>
                ))}
              </>
            )
          })()}
        </g>
      </g>
      <Vignette />
      <Letterbox className="c4-lb" />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'budget',
  title: 'The budget',
  cues: CUES,
  Scene: Ch4Budget,
  enter: { type: 'pan', dir: 'left' },
  deeper: [FleetsReading],
}
