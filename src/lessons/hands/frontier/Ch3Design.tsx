import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, useHandStore, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Profile, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Blueprint, Chip, DeskLamp, Dust, Meter, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import {
  CUSTOMERS,
  FITS,
  START,
  describe,
  designKey,
  fmtCycles,
  score,
  type CustomerId,
  type Design,
  type Drive,
  type Metric,
  type Place,
  type Verdict,
} from './design'
import { DesignHand } from './designHand'
import { at, IndustryChart, MiniHand, placeDesign } from './industry'
import { DesignReading } from './readings'

export const CUES: Cue[] = [
  { id: 'brief', say: 'Now it’s your turn. You’ve seen every trade. Design a hand, and pitch it to three customers.' },
  { id: 'lab', say: 'Build your hand, then pitch it. Each customer has a budget and a job. See which one signs.', play: true },
  { id: 'real', say: 'If your designs looked like the market, that’s no accident. The market is made of exactly these trades.' },
]

const HINTS = [
  'Start with the warehouse: what’s the cheapest hand that survives ten thousand grips a day?',
  'For the research lab, dexterity and touch matter more than price.',
  'The home robot needs to be safe: think backdrivable, and light.',
]

/** What the lab remembers between chapters: the designs that signed, by customer. */
type Signed = Partial<Record<CustomerId, Design>>

/** Sensible signed designs to show on the map if the learner's turn was skipped. */
const FALLBACK: Signed = {
  warehouse: { fingers: 5, motors: 6, place: 'palm', drive: 'linkage', skin: 'pads', build: 'mould' },
  lab: { fingers: 3, motors: 12, place: 'forearm', drive: 'tendon', skin: 'arrays', build: 'cnc' },
}

/* ---------------------------------------------------------------- layout of the lab */

const HAND = { x: 300, y: 610 }
const CTRL_X = 575
const ROW = (i: number) => 132 + i * 80
const OUT_X = 1085
const OUT_W = 450
const OUT_ROW = (i: number) => 148 + i * 66
const CARD = { y: 640, w: 318, h: 236, x: (i: number) => 500 + i * 330 }
const PITCH = { x: 1310, y: 585 }

interface Row<K extends keyof Design> {
  key: K
  label: string
  film: string
  options: { v: Design[K]; text: string }[]
}

const ROWS: [Row<'fingers'>, Row<'motors'>, Row<'place'>, Row<'drive'>, Row<'skin'>, Row<'build'>] = [
  { key: 'fingers', label: 'fingers', film: 'film 2', options: [{ v: 3, text: '3' }, { v: 4, text: '4' }, { v: 5, text: '5' }] },
  { key: 'motors', label: 'motors (actuated DoF)', film: 'film 2', options: [{ v: 1, text: '1' }, { v: 6, text: '6' }, { v: 12, text: '12' }, { v: 20, text: '20' }] },
  { key: 'place', label: 'where the motors live', film: 'film 3', options: [{ v: 'joints', text: 'joints' }, { v: 'palm', text: 'palm' }, { v: 'forearm', text: 'forearm' }] },
  { key: 'drive', label: 'transmission', film: 'film 3', options: [{ v: 'linkage', text: 'linkage' }, { v: 'tendon', text: 'tendon' }, { v: 'gear', text: 'gear' }] },
  { key: 'skin', label: 'touch', film: 'film 4', options: [{ v: 'none', text: 'none' }, { v: 'pads', text: 'pads' }, { v: 'arrays', text: 'arrays' }, { v: 'gel', text: 'gel cams' }] },
  { key: 'build', label: 'build', film: 'film 5', options: [{ v: 'print', text: 'printed' }, { v: 'cnc', text: 'CNC' }, { v: 'mould', text: 'moulded' }] },
]
const ROW_COLOR: Record<keyof Design, string> = { fingers: C.bone, motors: C.amber, place: C.amber, drive: C.cyan, skin: C.magenta, build: C.gold }

/** A meter's position (0..1) on a log scale. */
const logPos = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, Math.log(v / lo) / Math.log(hi / lo)))

/** Wrap a line of text into lines of about `n` characters. */
function wrap(text: string, n: number) {
  const out: string[] = []
  let cur = ''
  for (const w of text.split(' ')) {
    if ((cur + ' ' + w).trim().length > n) {
      out.push(cur.trim())
      cur = w
    } else cur += ' ' + w
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** The pose the live hand cycles through, which shows how many motors it has. */
function livePose(t: number, d: Design): HandPose {
  const a = Math.min(d.motors, 4 * d.fingers)
  const k = 0.75
  const wave = (f: number, ph: number) => 0.5 + 0.5 * Math.sin(t * f + ph)
  const fingers = ['index', 'middle', 'ring', 'little'] as const
  const p: HandPose = { thumb: [20, 16, 10, 8], index: [0, 0, 0, 4], middle: [0, 0, 0, 0], ring: [0, 0, 0, 4], little: [0, 0, 0, 8], wrist: [6, 0] }
  if (a <= 1) {
    // one motor: every finger closes together, like a gripper
    const c = wave(1.3, 0) * k
    fingers.forEach((f) => (p[f] = [58 * c, 52 * c, 30 * c, 2]))
    p.thumb = [20 + 36 * c, 18, 22 * c, 14 * c]
  } else if (a <= 6) {
    // a motor per finger: each curls on its own, its joints tied together
    fingers.forEach((f, i) => {
      const c = wave(1.1, i * 1.4) * k
      p[f] = [58 * c, 52 * c, 30 * c, 2]
    })
    const c = wave(0.9, 2.2) * k
    p.thumb = [16 + 40 * c, 20, 22 * c, 12 * c]
  } else {
    // many motors: knuckles and middle joints move separately; with 20, fingers spread too
    fingers.forEach((f, i) => {
      const m = wave(1.0, i * 1.1) * k
      const q = wave(1.6, i * 2.3 + 1) * k
      const spread = a >= 16 ? (wave(0.7, i * 0.9) - 0.5) * 22 : 2
      p[f] = [62 * m, 70 * q, 40 * q, spread]
    })
    p.thumb = [12 + 44 * wave(0.8, 0.4) * k, 10 + 24 * wave(1.3, 2) * k, 30 * wave(1.1, 1) * k, 24 * wave(1.5, 3) * k]
  }
  return p
}

const mixPose = (a: HandPose, b: HandPose, t: number): HandPose => {
  const m = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t)
  return {
    thumb: m(a.thumb, b.thumb) as HandPose['thumb'],
    index: m(a.index, b.index) as HandPose['index'],
    middle: m(a.middle, b.middle) as HandPose['middle'],
    ring: m(a.ring, b.ring) as HandPose['ring'],
    little: m(a.little, b.little) as HandPose['little'],
    wrist: m(a.wrist, b.wrist) as HandPose['wrist'],
  }
}

/* ---------------------------------------------------------------- portraits */

function Portrait({ id, x, y }: { id: CustomerId; x: number; y: number }) {
  const clip = `c3-por-${id}`
  const skin = id === 'warehouse' ? C.skinA : id === 'home' ? C.skinC : C.skinB
  const skinDark = id === 'warehouse' ? C.skinADark : id === 'home' ? C.skinCDark : C.skinBDark
  return (
    <g transform={`translate(${x} ${y})`}>
      <clipPath id={clip}>
        <circle r={46} />
      </clipPath>
      <circle r={48} fill={C.ink3} stroke={C.slate} strokeWidth={2} />
      <g clipPath={`url(#${clip})`}>
        <circle r={46} fill={id === 'warehouse' ? '#2b2416' : id === 'home' ? '#1f1a2b' : '#14222a'} />
        {/* shoulders and clothes */}
        {id === 'warehouse' && (
          <g>
            <path d="M-50 60 Q-40 26 -6 22 L14 22 Q46 26 52 60 Z" fill="#c8e021" />
            <path d="M-44 44 L46 44" stroke="#e8eef3" strokeWidth={5} />
            <path d="M-6 22 L4 60 L14 22" fill="#3a4a5a" />
          </g>
        )}
        {id === 'home' && <path d="M-50 60 Q-40 24 -6 20 L14 20 Q46 24 52 60 Z" fill="#5a3d7a" />}
        {id === 'lab' && (
          <g>
            <path d="M-50 60 Q-40 26 -6 22 L14 22 Q46 26 52 60 Z" fill="#6b5a44" />
            <path d="M-2 22 L4 60 L10 22" fill={C.paper} />
          </g>
        )}
        <g transform="translate(-34 -60) scale(0.15)">
          <Profile skin={skin} skinDark={skinDark} hair={id === 'lab' ? C.hairGrey : id === 'home' ? C.hairDark : C.hairBrown} light="key-right" half={0.4} />
        </g>
        {id === 'lab' && <path d="M14 -24 h10 v6 h-10 Z M24 -21 L30 -22" stroke={C.ink} strokeWidth={1.6} fill={C.cyanLight} fillOpacity={0.15} />}
        {id === 'warehouse' && <path d="M-24 -50 Q0 -64 22 -50 L24 -44 L-26 -44 Z" fill="#f0c419" />}
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- the scene */

export function Ch3Design({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const room = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -28, pitch: 10, roll: 0, s: 1.62 } })

  const [design, setDesign] = useState<Design>(START)
  const [verdicts, setVerdicts] = useState<Partial<Record<CustomerId, Verdict>>>({})
  const [pitchedKey, setPitchedKey] = useState<string | null>(null)
  const [signed, setSigned] = useState<Signed>(() => (memory.signedHands as Signed) ?? {})
  const [busy, setBusy] = useState(false)
  const [xray, setXray] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pitches, setPitches] = useState<string[]>([])
  const s = useMemo(() => score(design), [design])
  const designRef = useRef(design)
  const playingRef = useRef(playing)
  useEffect(() => {
    designRef.current = design
    playingRef.current = playing
  }, [design, playing])
  const live = useRef<gsap.core.Animation[]>([])
  const gripT = useRef({ g: 0 })
  const active = cueIndex === 1

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(room.current, { x: 760, y: 470, zoom: 1 })
      const noor = rig(root.current, 'c3-noor', POSES.stand)

      /* b0: Noor walks to the drafting table and slides the blank blueprint over to you. */
      tl.addLabel('b0', 0)
      tl.set('.c3-room', { opacity: 1 }, 0)
      tl.set('.c3-lab, .c3-real', { opacity: 0 }, 0)
      cam.to(tl, { x: 840, y: 520, zoom: 1.12 }, 0, 3.2, 'sine.inOut')
      const walked = noor.walk(tl, 0.2, { steps: 5, dx: 420, stepDur: 0.5 })
      noor.to(tl, { ...POSES.present, x: 420, head: 4 }, walked + 0.2, 0.8)
      noor.idle(tl, walked + 1.1, 2.4)
      cam.to(tl, { x: 1060, y: 560, zoom: 1.6 }, 3.2, 2.2, 'power2.inOut')
      // the blank blueprint slides forward and fills the frame
      tl.fromTo('.c3-sheet', { x: 0, y: 0 }, { x: -60, y: 30, duration: 1, ease: 'power2.out', immediateRender: false }, 4.6)
      cam.to(tl, { x: 1110, y: 640, zoom: 5.5 }, 5.5, 1.4, 'power3.in')
      fade(tl, '.c3-wash', 1, 6.3, 0.6)

      /* b1: the design lab on the blueprint. */
      const b1 = 7.1
      tl.addLabel('b1', b1)
      tl.set('.c3-room', { opacity: 0 }, b1 + 0.02)
      tl.set('.c3-lab', { opacity: 1 }, b1 + 0.02)
      tl.fromTo('.c3-lab-in', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out', immediateRender: false }, b1 + 0.1)
      tl.to({}, { duration: 0.1 }, b1 + 1.9)

      /* b2: your hands land on the industry map. */
      const b2 = b1 + 2
      tl.addLabel('b2', b2)
      tl.set('.c3-lab', { opacity: 0 }, b2 + 0.02)
      tl.set('.c3-real', { opacity: 1 }, b2 + 0.02)
      tl.set('.c3-dot', { opacity: 1 }, b2 + 0.02)
      fade(tl, '.c3-axes, .c3-cluster', 1, b2, 0.8)
      tl.fromTo('.c3-dot', { opacity: 0 }, { opacity: 0.85, duration: 0.6, stagger: 0.05, immediateRender: false }, b2 + 0.2)
      tl.fromTo('.c3-mine', { y: 520, opacity: 0 }, { y: 0, opacity: 1, duration: 1.8, stagger: 0.5, ease: 'power3.out', immediateRender: false }, b2 + 1.2)
      tl.fromTo('.c3-near', { strokeDashoffset: 300 }, { strokeDashoffset: 0, duration: 0.8, stagger: 0.5, immediateRender: false }, b2 + 3.0)
      fade(tl, '.c3-minelab', 1, b2 + 3.4, 0.6)
      tl.to({}, { duration: 0.1 }, b2 + 7.0)
    },
    [],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-lamp', { opacity: 0.8, duration: 2.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-minepulse', { scale: 1.25, opacity: 0.2, transformOrigin: '50% 50%', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the live hand: it moves the way its motors let it, and turns slowly ---------------- */
  useEffect(() => {
    const clock = { t: 0 }
    const spin = gsap.to(clock, {
      t: 1000,
      duration: 1000,
      ease: 'none',
      paused: true,
      onUpdate: () => {
        const p = livePose(clock.t, designRef.current)
        const g = gripT.current.g
        hand.state.pose = g > 0 ? mixPose(p, GRASPS.power, g) : p
        hand.state.view.yaw = -28 + Math.sin(clock.t * 0.25) * 16
        hand.state.view.pitch = 10 + Math.sin(clock.t * 0.17) * 5
        hand.state.touch.index = g
        hand.notify()
      },
    })
    live.current.push(spin)
    return () => {
      spin.kill()
    }
  }, [hand])
  // the hand only moves while the lab is on screen and the film is playing
  useEffect(() => {
    for (const t of live.current) {
      if (playing && cueIndex === 1) t.resume()
      else t.pause()
    }
  }, [playing, cueIndex])

  // the x-ray fades in and out
  useEffect(() => {
    const t = gsap.to(hand.state, { xray: xray ? 1 : 0, duration: 0.5, ease: 'power2.inOut', onUpdate: () => hand.notify() })
    return () => {
      t.kill()
    }
  }, [xray, hand])

  /* ---------------- choices ---------------- */
  const choose = <K extends keyof Design>(key: K, v: Design[K]) => {
    if (!active || busy) return
    let next = { ...design, [key]: v } as Design
    let msg: string | null = null
    if (key === 'drive' && !FITS[v as Drive].includes(next.place)) {
      next = { ...next, place: FITS[v as Drive][0] }
      msg = v === 'gear' ? 'gears sit in the joints they turn: motors moved to the joints' : v === 'tendon' ? 'tendons need room to run: motors moved to the palm' : 'a screw pushes from the palm: motors moved to the palm'
    }
    if (key === 'place' && !FITS[next.drive].includes(v as Place)) {
      const drive = (['tendon', 'linkage', 'gear'] as Drive[]).find((d) => FITS[d].includes(v as Place))!
      next = { ...next, drive }
      msg = v === 'forearm' ? 'from the forearm, force needs tendons: switched to tendons' : v === 'joints' ? 'switched to a linkage, which fits motors in the joints' : 'switched to tendons'
    }
    if (next.motors > next.fingers * 4) msg = `only ${next.fingers * 4} motors fit in ${next.fingers} fingers`
    setNote(msg)
    setDesign(next)
    setVerdicts({})
    setPitchedKey(null)
    emit({ type: 'progress', detail: `changed ${String(key)} to ${String(v)}` })
  }

  const pitch = () => {
    if (!active || busy) return
    setBusy(true)
    setVerdicts({})
    const d = design
    const sc = score(d)
    const results = CUSTOMERS.map((c) => [c.id, c.judge(sc, d)] as const)
    const tl = gsap.timeline({ paused: !playingRef.current })
    live.current.push(tl)
    // the hand shows off a firm grasp, then each customer answers in turn
    tl.to(gripT.current, { g: 1, duration: 0.5, ease: 'power2.inOut' }, 0)
    tl.to(gripT.current, { g: 0, duration: 0.6, ease: 'power2.inOut' }, 1.1)
    results.forEach(([id, v], i) => tl.call(() => setVerdicts((o) => ({ ...o, [id]: v })), [], 0.7 + i * 0.6))
    tl.call(
      () => {
        setBusy(false)
        setPitchedKey(designKey(d))
        const wins = results.filter(([, v]) => v.ok).map(([id]) => id)
        const nextSigned: Signed = { ...signed }
        for (const id of wins) nextSigned[id] = d
        setSigned(nextSigned)
        memory.signedHands = nextSigned
        setPitches((p) => [...p, `${describe(d)} → ${wins.length ? `signed by ${wins.join(', ')}` : 'no one signed'}`])
        emit({ type: 'attempt', correct: wins.length > 0, detail: `${describe(d)}: ${results.map(([id, v]) => `${id} ${v.ok ? 'signed' : `passed (${v.why})`}`).join('; ')}` })
        if (Object.keys(nextSigned).length >= 2 && !done) {
          setDone(true)
          void say('Two customers, two different hands. That’s exactly why the industry has split into workhorses and research hands.')
          onPlayDone()
        }
      },
      [],
      0.7 + 3 * 0.6 + 0.2,
    )
  }

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 1) {
      const signedList = Object.keys(signed)
      reportState(
        `The learner's turn: the design lab, the course's capstone. On a blueprint: a live 3D robot hand on the left that changes with every choice (fingers, motors shown amber in x-ray, transmission cyan, skin magenta, material), six rows of choices in the middle, six live output bars on the right, and three customer cards below with a gold "pitch" button. ` +
          `Current design: ${describe(design)}. Outputs: dexterity ${Math.round(s.dex)}/100, grip ${Math.round(s.grip)} N, weight at the wrist ${Math.round(s.weight)} g, ${fmtCycles(s.cycles)} cycles before first failure, unit cost $${Math.round(s.cost).toLocaleString('en-US')} at 10,000 units, learnability ${Math.round(s.learn)}/100, backdrivable ${s.backdrive >= 0.7 ? 'yes' : s.backdrive > 0 ? 'partly' : 'no'}. ` +
          `Contracts: warehouse (Rosa) needs cost under $3,000, at least 3.65M cycles (10,000 grips a day for a year) and 60 N grip; home robot (Sam) needs cost under $6,000, backdrivable (tendons), under 700 g at the wrist, dexterity 50+, grip 30 N+, and 365k cycles; research lab (Dr Mei) needs dexterity 75+, dense tactile arrays or camera gel tips, learnability 65+ and 50k cycles, budget $40,000. ` +
          `Designs that work: warehouse = few motors (1 or 6), linkage + screw in the palm, little or no skin, moulded (e.g. 5 fingers, 6 motors, palm, linkage, pads, moulded: about $1,550 and 3.8M cycles; CNC makes it too expensive, printing too fragile). Home = tendons from forearm motors, 6-12 motors, pads, moulded. Research = 12+ motors, tendons or gears, arrays or gel, any build (a 3-finger, 12-motor tendon hand with arrays is like Shadow’s DEX-EE). No single design can win all three, or even two: that is the point. ` +
          `Customers signed so far: ${signedList.length ? signedList.join(', ') : 'none'} (needs two different customers). Pitches so far: ${pitches.length ? pitches.join(' | ') : 'none'}. Latest verdicts: ${Object.entries(verdicts).map(([id, v]) => `${id}: ${v?.ok ? 'signed' : v?.why}`).join('; ') || 'not pitched since the last change'}. ` +
          `Likely mix-ups: maxing everything out (it fails on cost or durability), expecting a 20-motor hand to survive a warehouse, or forgetting that a self-locking linkage is not safe around people.`,
      )
      setHints(HINTS)
    } else if (cueIndex === 0) {
      reportState('Noor, the lead hardware engineer (rust jacket, hair in a bun), walks through the night lab to a drafting table under a warm desk lamp, turns toward the camera (toward you, the new hire) and slides a blank blueprint forward. The camera pushes into the blueprint until it fills the frame. Next: you design a hand and pitch it to three customers.')
      setHints([])
    } else {
      const mine = Object.entries(signedOrFallback(signed)).map(([id, d]) => `${id}: ${describe(d!)} (lands near ${placeDesign(d!).near.name})`)
      reportState(`The industry map from chapter 2 returns (dexterous up, cheap + tough right). The learner’s signed designs float up and land on it next to their nearest real neighbours: ${mine.join('; ')}. The point: real products sit where they do because of exactly the trades the learner just made; workhorse hands cluster cheap and tough, research hands dexterous and costly, and the top-right corner stays empty.`)
      setHints([])
    }
  }, [cueIndex, design, s, signed, verdicts, pitches, reportState, setHints])

  /* ---------------- drawing ---------------- */
  const shown = signedOrFallback(signed)
  const backLabel = s.backdrive >= 0.7 ? 'backdrivable' : s.backdrive > 0 ? 'barely backdrivable' : 'self-locking'
  const blamed = new Set<Metric>(Object.values(verdicts).filter((v): v is Verdict => !!v && !v.ok && !!v.key).map((v) => v.key!))
  const meters: { key: Metric; label: string; value: number; text: string; color: string }[] = [
    { key: 'dex', label: 'dexterity', value: s.dex / 100, text: `${Math.round(s.dex)} / 100`, color: C.bone },
    { key: 'grip', label: 'grip strength', value: s.grip / 160, text: `${Math.round(s.grip)} N`, color: C.amber },
    { key: 'weight', label: 'weight at the wrist', value: s.weight / 1200, text: `${Math.round(s.weight)} g`, color: C.amber },
    { key: 'cycles', label: 'grips before first failure', value: logPos(s.cycles, 20_000, 20_000_000), text: fmtCycles(s.cycles), color: C.danger },
    { key: 'cost', label: 'unit cost at 10,000 units', value: logPos(s.cost, 300, 12_000), text: `$${Math.round(s.cost).toLocaleString('en-US')}`, color: C.gold },
    { key: 'learn', label: 'learnability', value: s.learn / 100, text: `${Math.round(s.learn)} / 100`, color: C.lime },
  ]

  return (
    <g ref={root}>
      {/* ---------- the room ---------- */}
      <g className="c3-room" ref={room} pointerEvents="none">
        <g data-depth="0.25">
          <LabSky flashClass="c3-flash" seed={23} />
        </g>
        <g data-depth="0.6">
          <LabWall />
        </g>
        <g data-depth="1">
          <LabFloor />
          {/* the drafting table, under its lamp */}
          <g className="c3-lamp">
            <Pool x={1100} y={600} r={520} color="key" opacity={0.95} />
          </g>
          <Beam x={1230} y={300} w1={50} w2={420} len={420} angle={18} opacity={0.4} />
          <path d="M880 760 L900 600 L1340 560 L1330 760" fill="none" stroke={C.ink2} strokeWidth={12} />
          <path d="M860 610 L1360 556 L1380 600 L880 660 Z" fill={C.ink3} />
          <path d="M860 610 L1360 556 L1362 562 L862 616 Z" fill={C.keyDeep} opacity={0.6} />
          <g className="c3-sheet">
            <path d="M960 612 L1250 580 L1262 606 L972 640 Z" fill={C.ink1} stroke={C.cyan} strokeWidth={1.5} />
            <path d="M960 612 L1250 580 L1262 606 L972 640 Z" fill="url(#cn-grid)" />
          </g>
          <DeskLamp x={1330} y={560} s={0.9} />
          <g className="c3-flip">
            <Person name="c3-noor" x={380} y={800} s={1.1} pose={POSES.stand} hair="bun" top="#9c4a2c" topDark="#6a2e1a" skin={C.skinB} light="key-left" />
          </g>
          <Dust x={800} y={200} w={600} h={500} count={22} seed={31} />
        </g>
        <rect className="c3-wash" x={-800} y={-600} width={3200} height={2100} fill={C.ink1} opacity={0} />
      </g>

      {/* ---------- the design lab ---------- */}
      <g className="c3-lab" opacity={0}>
        <style>{'.c3-lab [role=button]:focus:not(:focus-visible){outline:none}'}</style>
        <Blueprint />
        <Pool x={HAND.x} y={420} r={460} color="rim" opacity={0.35} />
        <g className="c3-lab-in">
          <text x={60} y={78} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
            design lab
          </text>
          <text x={62} y={108} fill={C.mist} fontFamily={MONO} fontSize={17}>
            your hand · rev {pitches.length + 1}
          </text>
          <Chip x={420} y={84} w={150} h={46} text={xray ? 'x-ray on' : 'x-ray'} color={C.cyan} active={xray} onClick={() => setXray((v) => !v)} tutor="x-ray toggle" />
        </g>
        <g className="c3-lab-in" data-tutor="your hand">
          <DesignHand store={hand} design={design} x={HAND.x} y={HAND.y} arm={110} />
          {xray && (
            <g pointerEvents="none">
              <text x={60} y={872} fill={C.amber} fontFamily={MONO} fontSize={16}>
                ■ motors
              </text>
              <text x={170} y={872} fill={C.cyan} fontFamily={MONO} fontSize={16}>
                ━ transmission
              </text>
              <text x={330} y={872} fill={C.magenta} fontFamily={MONO} fontSize={16}>
                ● touch
              </text>
            </g>
          )}
        </g>
        {/* the choices */}
        <g className="c3-lab-in">
          {ROWS.map((row, i) => {
            const y = ROW(i)
            const n = row.options.length
            const w = n === 4 ? 104 : 142
            return (
              <g key={row.key}>
                <text x={CTRL_X} y={y} fill={ROW_COLOR[row.key]} fontFamily={SANS} fontSize={21} fontWeight={600}>
                  {row.label}
                </text>
                <text x={CTRL_X + 452} y={y} textAnchor="end" fill={C.fog} fontFamily={MONO} fontSize={14}>
                  {row.film}
                </text>
                {row.options.map((o, k) => (
                  <Chip
                    key={String(o.v)}
                    x={CTRL_X + w / 2 + k * (w + 9)}
                    y={y + 34}
                    w={w}
                    h={44}
                    text={o.text}
                    color={ROW_COLOR[row.key]}
                    active={design[row.key] === o.v}
                    disabled={!active || busy}
                    onClick={() => choose(row.key, o.v as never)}
                    tutor={`${row.label}: ${o.text}`}
                  />
                ))}
                {row.key === 'skin' && blamed.has('skin') && <rect x={CTRL_X - 8} y={y + 8} width={466} height={52} rx={26} fill="none" stroke={C.danger} strokeWidth={2.5} strokeDasharray="6 5" pointerEvents="none" />}
              </g>
            )
          })}
          {note && (
            <text x={CTRL_X} y={ROW(6) + 6} fill={C.mist} fontFamily={MONO} fontSize={15} pointerEvents="none">
              {note}
            </text>
          )}
        </g>
        {/* the numbers */}
        <g className="c3-lab-in" pointerEvents="none">
          {meters.map((m, i) => (
            <g key={m.key}>
              <Meter x={OUT_X} y={OUT_ROW(i)} w={OUT_W} value={m.value} color={m.color} label={m.label} valueText={m.text} />
              {blamed.has(m.key) && <rect x={OUT_X - 10} y={OUT_ROW(i) - 38} width={OUT_W + 20} height={60} rx={10} fill="none" stroke={C.danger} strokeWidth={2.5} strokeDasharray="6 5" />}
            </g>
          ))}
          <text x={OUT_X} y={OUT_ROW(5) + 42} fill={s.backdrive >= 0.7 ? C.lime : C.mist} fontFamily={MONO} fontSize={15}>
            {backLabel} · {s.sim >= 0.8 ? 'easy' : 'hard'} to simulate{s.active < design.motors ? ` · ${s.active} motors fitted` : ''}
          </text>
          {blamed.has('backdrive') && <rect x={OUT_X - 10} y={OUT_ROW(5) + 22} width={OUT_W + 20} height={30} rx={10} fill="none" stroke={C.danger} strokeWidth={2.5} strokeDasharray="6 5" />}
        </g>
        <g className="c3-lab-in">
          <Chip x={PITCH.x} y={PITCH.y} w={330} h={56} text={busy ? 'pitching…' : pitchedKey === designKey(design) ? 'change a choice first' : 'pitch to the customers'} color={C.gold} active={active && !busy && pitchedKey !== designKey(design)} disabled={!active || busy || pitchedKey === designKey(design)} onClick={pitch} tutor="pitch button" />
        </g>
        {/* the customers */}
        <g className="c3-lab-in">
          {CUSTOMERS.map((c, i) => {
            const x = CARD.x(i)
            const v = verdicts[c.id]
            const won = !!signed[c.id]
            const border = v ? (v.ok ? C.gold : C.danger) : won ? C.goldDark : C.slate
            return (
              <g key={c.id} data-tutor={`${c.name}, ${c.role}`} pointerEvents="none">
                <rect x={x} y={CARD.y} width={CARD.w} height={CARD.h} rx={16} fill={C.ink} fillOpacity={0.82} stroke={border} strokeWidth={v ? 3 : 2} />
                {v?.ok && <rect x={x} y={CARD.y} width={CARD.w} height={CARD.h} rx={16} fill="url(#cn-pool-gold)" opacity={0.5} />}
                <Portrait id={c.id} x={x + 58} y={CARD.y + 60} />
                <text x={x + 116} y={CARD.y + 40} fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={600}>
                  {c.name}
                </text>
                <text x={x + 116} y={CARD.y + 64} fill={C.mist} fontFamily={SANS} fontSize={16}>
                  {c.role}
                </text>
                <text x={x + 116} y={CARD.y + 94} fill={C.gold} fontFamily={MONO} fontSize={18}>
                  ${c.budget.toLocaleString('en-US')} a hand
                </text>
                {(v ? wrap(`“${v.line}”`, 33) : wrap(c.job, 31)).map((l, k) => (
                  <text key={k} x={x + 18} y={CARD.y + 140 + k * 22} fill={v ? (v.ok ? C.goldLight : C.paper) : C.fog} fontFamily={v ? SANS : MONO} fontSize={v ? 17 : 15} fontStyle={v ? 'italic' : undefined}>
                    {l}
                  </text>
                ))}
                {won && !v && (
                  <text x={x + CARD.w - 16} y={CARD.y + CARD.h - 16} textAnchor="end" fill={C.gold} fontFamily={MONO} fontSize={15}>
                    ✓ signed earlier
                  </text>
                )}
                {v && (
                  <g transform={`translate(${x + CARD.w - 74} ${CARD.y + CARD.h - 30}) rotate(-8)`}>
                    <rect x={-62} y={-20} width={124} height={36} rx={6} fill="none" stroke={v.ok ? C.gold : C.danger} strokeWidth={3} />
                    <text x={0} y={7} textAnchor="middle" fill={v.ok ? C.gold : C.danger} fontFamily={SANS} fontSize={20} fontWeight={700} letterSpacing={3}>
                      {v.ok ? 'SIGNED' : 'PASS'}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
          <text x={CARD.x(0)} y={CARD.y + CARD.h + 18} fill={C.fog} fontFamily={MONO} fontSize={14} pointerEvents="none">
            signed: {Object.keys(signed).length} of 2 customers needed
          </text>
        </g>
      </g>

      {/* ---------- your hands on the market map ---------- */}
      <g className="c3-real" opacity={0} pointerEvents="none">
        <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
        <Pool x={1000} y={300} r={800} color="gold" opacity={0.1} />
        <IndustryChart p="c3" />
        {CUSTOMERS.map((c, i) => {
          const d = shown[c.id]
          if (!d) return <g key={c.id} className="c3-mine" />
          const pl = placeDesign(d)
          const q = at(pl.u, pl.v)
          const n = at(pl.near.u, pl.near.v)
          const lab = c.id === 'warehouse' ? 'your warehouse hand' : c.id === 'home' ? 'your home hand' : 'your research hand'
          // warehouse label up and to the right, research above, home below
          const lx = i === 0 ? q.x + 50 : q.x
          const ly = i === 0 ? q.y - 50 : i === 1 ? q.y + 72 : q.y - 58
          const anchor = i === 0 ? 'start' : 'middle'
          return (
            <g key={c.id}>
              <path className="c3-near" d={`M${q.x} ${q.y} L${n.x} ${n.y}`} stroke={C.cyan} strokeWidth={2} strokeDasharray="6 6" strokeDashoffset={300} fill="none" />
              <g className="c3-mine">
                <circle className="c3-minepulse" cx={q.x} cy={q.y} r={44} fill="none" stroke={C.cyan} strokeWidth={2} />
                <circle cx={q.x} cy={q.y} r={36} fill={C.ink1} stroke={C.cyan} strokeWidth={3} filter="url(#cn-bloom)" />
                <MiniHand x={q.x} y={q.y + 9} s={0.95} fingers={d.motors === 1 && d.fingers === 3 ? 2 : d.fingers} color={C.cyanLight} />
              </g>
              <g className="c3-minelab" opacity={0}>
                <text x={lx} y={ly} textAnchor={anchor} fill={C.cyanLight} fontFamily={SANS} fontSize={26} fontWeight={600} stroke={C.ink} strokeWidth={6} strokeOpacity={0.85} style={{ paintOrder: 'stroke' }}>
                  {lab}
                </text>
                <text x={lx} y={ly + 24} textAnchor={anchor} fill={C.mist} fontFamily={MONO} fontSize={16} stroke={C.ink} strokeWidth={5} strokeOpacity={0.85} style={{ paintOrder: 'stroke' }}>
                  near {pl.near.name}
                </text>
              </g>
            </g>
          )
        })}
      </g>
      <Vignette strength={0.8} />
    </g>
  )
}

function signedOrFallback(s: Signed): Signed {
  return Object.keys(s).length >= 2 ? s : { ...FALLBACK, ...s }
}

export const ch3: Chapter = {
  id: 'design',
  title: 'Your hand',
  cues: CUES,
  Scene: Ch3Design,
  enter: { type: 'dissolve' },
  deeper: [DesignReading],
}

