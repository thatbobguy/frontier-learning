import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { rng } from '../../../art2/fx'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Blueprint, Dust, Label, Pool, Readout, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { FactoryCSS, FlatHand, Gear, MiniBot, SourceNote, count } from './factoryKit'
import { ReliabilityReading } from './readings'

export const CUES: Cue[] = [
  { id: 'parts', say: 'In a factory, every part is a cost, a supplier, an assembly step and something that can break. So the best engineers fight to delete parts.' },
  { id: 'fingers', say: 'One trick: make all four fingers identical. One mould, four times the volume, and a broken finger becomes a part you swap in a minute.' },
  { id: 'grips', say: 'Now the durability maths. A warehouse robot grips eight to ten thousand times a day. A hand rated for half a million grips lasts two months.' },
  { id: 'series', say: 'Here’s the cruel part. A robot works only if every part works. Set how reliable each actuator is, and see how reliable the whole robot gets.', play: true },
  { id: 'field', say: 'And lab numbers lie. One maker claimed a million cycles in testing. In a real warehouse, some of its hands broke after about fifty grips of heavy boxes.' },
]

const STATE = [
  'A prototype robot hand floats apart in the dark into an exploded view: dozens of tiny screws, brackets, gears, washers and micro motors drifting around a ghost outline of the hand. A mono counter reads "412 parts". Then the brackets fly together and fuse into one moulded palm, the screws vanish (replaced by snap fits), and the counter ticks down to "156 parts". Point: every part is a cost, a supplier, an assembly step and a failure point, so good design deletes parts. (412 and 156 are illustrative.)',
  'A small production line: four identical robot fingers slide off a conveyor and click into a row, all from one mould. Then the camera drops to a robot hand: one finger glows red (broken), pops out, and a fresh identical finger clicks into its place. Label: "field replaceable". Point: identical fingers mean one mould at four times the volume, and a broken finger is a quick swap.',
  'A warehouse aisle under orange sodium lamps. Seven, the white humanoid robot, grabs boxes from a shelf and puts them on a conveyor in a fast loop. A mono grip counter spins up toward 500,000 and a calendar flips from day 1 to day 55, then one finger cracks (red flash). Label: 500,000 cycles ÷ 9,000 grips a day ≈ 55 days. Point: a warehouse robot grips 8,000 to 10,000 times a day, so a hand rated for 300,000 to 500,000 grips lasts only one to two months; a five-year life would need roughly 15 to 18 million cycles.',
  '',
  'Split screen. Left: a clean lab test rig in cool white light; a robot hand squeezes a foam block in a perfect loop and the counter rolls up to 1,000,000. Right: a dusty warehouse; the same hand grips a 5 kg box at an awkward angle, twists, and snaps (red flash, a broken finger piece flies off); the counter reads about 50. Label: no agreed durability test exists. Point: a lab cycle count depends on the load, speed and object, so a million-cycle claim can mean little in the field. Source: Inspire (Yinshi) claimed up to a million cycles; in warehouse logistics some hands broke after about 50 grips of 5 kg items.',
]

/* ------------------------------------------------------------------ */
/* b0: the exploded prototype                                           */
/* ------------------------------------------------------------------ */
type Kind = 'screw' | 'bracket' | 'gear' | 'washer' | 'motor'
const HC = { x: 800, y: 520, s: 1.15 }
const PIECES: { kind: Kind; ax: number; ay: number; dx: number; dy: number; rot: number; r: number }[] = (() => {
  const r = rng(17)
  const out: { kind: Kind; ax: number; ay: number; dx: number; dy: number; rot: number; r: number }[] = []
  const kinds: [Kind, number][] = [['screw', 56], ['bracket', 26], ['gear', 22], ['washer', 18], ['motor', 8]]
  for (const [kind, n] of kinds) {
    for (let i = 0; i < n; i++) {
      // assembled: somewhere inside the hand (palm or a finger)
      const inFinger = r() < 0.5
      const fx = [-66, -22, 22, 66][Math.floor(r() * 4)]
      const ax = HC.x + (inFinger ? fx + (r() - 0.5) * 24 : (r() - 0.5) * 170) * HC.s
      const ay = HC.y + (inFinger ? -40 - r() * 170 : 10 + r() * 130) * HC.s
      // exploded: pushed outward from the hand's centre
      const ang = Math.atan2(ay - (HC.y - 30), ax - HC.x) + (r() - 0.5) * 0.6
      const dist = 170 + r() * 260
      const ex = Math.max(90, Math.min(1510, HC.x + Math.cos(ang) * dist * 1.55))
      const ey = Math.max(190, Math.min(820, HC.y - 30 + Math.sin(ang) * dist * 0.95))
      out.push({ kind, ax, ay, dx: ex - ax, dy: ey - ay, rot: (r() - 0.5) * 300, r: r() })
    }
  }
  return out
})()

function PieceShape({ kind, r }: { kind: Kind; r: number }) {
  if (kind === 'screw')
    return (
      <g>
        <rect x={-2} y={-2} width={4} height={18} fill={C.metal} />
        <rect x={-5} y={-6} width={10} height={5} rx={1.5} fill={C.metalDark} />
      </g>
    )
  if (kind === 'bracket') return <path d={`M-14 -10 h${10 + r * 10} v6 h-${4 + r * 10} v16 h-6 Z`} fill={C.shellMid} stroke={C.shellDark} strokeWidth={1} />
  if (kind === 'gear') return <Gear r={7 + r * 7} teeth={10} />
  if (kind === 'washer') return <circle r={6} fill="none" stroke={C.metal} strokeWidth={3} />
  return (
    <g>
      <rect x={-8} y={-14} width={16} height={28} rx={4} fill={C.amberDark} />
      <rect x={-8} y={-14} width={16} height={6} rx={3} fill={C.amber} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The series play                                                      */
/* ------------------------------------------------------------------ */
const qOf = (t: number) => Math.pow(10, -2 - 2 * t)
const tOfR = (r: number) => (-Math.log10(1 - r) - 2) / 2
const nOf = (t: number) => Math.max(1, Math.round(1 + t * 79))
const tOfN = (n: number) => (n - 1) / 79
const FLEET = 50
const FLEET_X = (i: number) => 150 + (i % 25) * 54
const FLEET_Y = (i: number) => (i < 25 ? 712 : 822)
const ACT_X = (i: number) => 140 + (i % 40) * 33
const ACT_Y = (i: number) => (i < 40 ? 190 : 232)
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`

/* b2: the warehouse */
const S7 = { x: 760, y: 800, s: 1.25 }
const SHELF = { x: 920, y: 520 }
const BELT_Y = 690

export function Ch3Durability({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const explodeShot = useRef<SVGGElement>(null)
  const lineShot = useRef<SVGGElement>(null)
  const wareShot = useRef<SVGGElement>(null)
  const labHand = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 1.55 } })
  const fieldHand = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 1.55 } })

  /* ---------- the series play's state ---------- */
  const [tn, setTn] = useState(tOfN(70))
  const [tr, setTr] = useState(0.5)
  const [won, setWon] = useState(false)
  const [shift, setShift] = useState({ k: 0, t: 0, fails: [] as number[] })
  const playingRef = useRef(playing)
  playingRef.current = playing
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone
  const n = nOf(tn)
  const q = qOf(tr)
  const rEach = 1 - q
  const R = Math.pow(rEach, n)
  const meets = R >= 0.95
  const handN = Math.round((n * 50) / 70)
  const active = cueIndex === 3
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const Rref = useRef(R)
  Rref.current = R

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const RT = root.current
      const camEx = camera(explodeShot.current, { x: 800, y: 470, zoom: 1.08 })
      const camLine = camera(lineShot.current, { x: 800, y: 300, zoom: 1.05 })
      const camWare = camera(wareShot.current, { x: 840, y: 520, zoom: 1.1 })
      const shots = ['.f3-explode', '.f3-line', '.f3-ware', '.f3-series', '.f3-field']
      const show = (sel: string, at: number, dur = 0.01) => {
        for (const s of shots) {
          if (s === sel) fade(tl, s, 1, at, dur, 0)
          else tl.set(s, { opacity: 0 }, at + dur)
        }
      }
      const seven = rig(RT, 'f3-seven', POSES.stand)

      /* b0: the prototype flies apart; parts merge; the count drops. */
      tl.addLabel('b0', 0)
      show('.f3-explode', 0)
      camEx.to(tl, { zoom: 1.0, y: 480 }, 0, 5, 'sine.inOut')
      tl.fromTo('.f3-pc', { x: 0, y: 0, rotation: 0 }, { x: (i: number) => PIECES[i].dx / 1.7, y: (i: number) => PIECES[i].dy / 1.7, rotation: (i: number) => PIECES[i].rot, duration: 2.4, ease: 'power3.out', stagger: 0.004, transformOrigin: '50% 50%', immediateRender: false }, 0.4)
      fade(tl, '.f3-count', 1, 0.6, 0.5)
      count(tl, RT, '.f3-counttext', 0, 412, 0.6, 2.2, (v) => `${Math.round(v)} parts`, 'power2.out')
      fade(tl, '.f3-lab-cost', 1, 3.0, 0.5)
      fade(tl, '.f3-lab-cost', 0, 5.4, 0.4, 1)
      // brackets fuse into the palm; screws vanish into snap fits; the rest go home
      tl.fromTo('.f3-bracket', { x: (i: number) => PIECES[56 + i].dx / 1.7, y: (i: number) => PIECES[56 + i].dy / 1.7, opacity: 1 }, { x: (i: number) => (HC.x - PIECES[56 + i].ax) / 1.7, y: (i: number) => (HC.y + 60 - PIECES[56 + i].ay) / 1.7, opacity: 0, duration: 1.2, ease: 'power2.in', stagger: 0.02, immediateRender: false }, 5.6)
      tl.fromTo('.f3-screw', { scale: 1, opacity: 1 }, { scale: 0, opacity: 0, duration: 0.3, stagger: 0.012, transformOrigin: '50% 50%', immediateRender: false }, 5.8)
      tl.fromTo('.f3-keep', { x: (i: number) => PIECES[82 + i].dx / 1.7, y: (i: number) => PIECES[82 + i].dy / 1.7, rotation: (i: number) => PIECES[82 + i].rot }, { x: 0, y: 0, rotation: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.01, immediateRender: false }, 7.0)
      fade(tl, '.f3-moulded', 1, 6.6, 0.8)
      tl.fromTo('.f3-fuseflash', { opacity: 0 }, { opacity: 0.9, duration: 0.15, yoyo: true, repeat: 1, immediateRender: false }, 6.8)
      camEx.shake(tl, 6.8, 0.6, 0.3)
      fade(tl, '.f3-snaps', 1, 7.0, 0.5)
      count(tl, RT, '.f3-counttext', 412, 156, 5.8, 3.0, (v) => `${Math.round(v)} parts`, 'power1.inOut')
      fade(tl, '.f3-lab-palm', 1, 7.4, 0.5)
      fade(tl, '.f3-lab-snap', 1, 7.9, 0.5)
      fade(tl, '.f3-keep', 0, 8.4, 0.5, 1)
      camEx.to(tl, { zoom: 1.12, y: 470 }, 8.0, 3.2, 'sine.inOut')

      /* b1: four identical fingers off the line; then a broken one swapped. */
      const b1 = 11.2
      tl.addLabel('b1', b1)
      show('.f3-line', b1, 0.5)
      camLine.to(tl, { x: 800, y: 300, zoom: 1.12 }, b1, 4, 'sine.inOut')
      for (let k = 0; k < 4; k++) {
        const t = b1 + 0.5 + k * 0.75
        tl.fromTo(`.f3-lf-${k}`, { x: -900 }, { x: 0, duration: 0.6, ease: 'power3.out', immediateRender: false }, t)
        tl.fromTo(`.f3-click-${k}`, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1.6, duration: 0.2, transformOrigin: '50% 50%', immediateRender: false }, t + 0.55)
        tl.fromTo(`.f3-click-${k}`, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, t + 0.75)
        camLine.shake(tl, t + 0.56, 0.25, 0.15)
      }
      fade(tl, '.f3-lab-mould', 1, b1 + 3.6, 0.5)
      camLine.to(tl, { x: 800, y: 790, zoom: 1.0 }, b1 + 4.6, 1.8, 'power2.inOut')
      fade(tl, '.f3-broken', 1, b1 + 6.2, 0.3)
      tl.fromTo('.f3-broken', { opacity: 1 }, { opacity: 0.4, duration: 0.2, yoyo: true, repeat: 3, immediateRender: false }, b1 + 6.5)
      tl.fromTo('.f3-swap-out, .f3-h-finger-2', { y: 0, x: 0, opacity: 1, rotation: 0 }, { y: -320, x: 240, rotation: 30, opacity: 0, duration: 0.9, ease: 'power2.in', transformOrigin: '50% 100%', immediateRender: false }, b1 + 7.4)
      tl.fromTo('.f3-swap-in', { y: -420, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', immediateRender: false }, b1 + 8.2)
      camLine.shake(tl, b1 + 8.9, 0.45, 0.2)
      fade(tl, '.f3-swapglow', 1, b1 + 8.9, 0.2)
      fade(tl, '.f3-swapglow', 0, b1 + 9.3, 0.6, 1)
      fade(tl, '.f3-lab-fru', 1, b1 + 9.0, 0.5)

      /* b2: the warehouse. Grip, grip, grip; the days flip; a finger cracks. */
      const b2 = b1 + 10.8
      tl.addLabel('b2', b2)
      show('.f3-ware', b2, 0.5)
      camWare.to(tl, { x: 900, y: 540, zoom: 1.25 }, b2, 11, 'sine.inOut')
      fade(tl, '.f3-wcount', 1, b2 + 0.6, 0.5)
      const cyc = 1.5
      for (let c = 0; c < 5; c++) {
        const t = b2 + 0.8 + c * cyc
        const box = `.f3-box-${c % 3}`
        seven.to(tl, { ...POSES.reach, torso: 6, armN: 108, elbowN: 8, wristN: 0, head: -12 }, t, 0.35, 'power2.out')
        tl.fromTo(box, { x: 0, y: 0, opacity: 1 }, { x: 0, y: 0, opacity: 1, duration: 0.01, immediateRender: false }, t)
        tl.fromTo(box, { x: 0, y: 0 }, { x: -50, y: 140, duration: 0.45, ease: 'power2.inOut', immediateRender: false }, t + 0.4)
        seven.to(tl, { ...POSES.reach, torso: 16, armN: 50, elbowN: 10, wristN: 10, head: 6 }, t + 0.4, 0.45, 'power2.inOut')
        tl.fromTo(box, { y: 140 }, { y: 250, duration: 0.18, ease: 'power2.in', immediateRender: false }, t + 0.85)
        tl.fromTo(box, { x: -50 }, { x: 800, duration: 1.6, ease: 'power1.in', immediateRender: false }, t + 1.05)
        seven.to(tl, { ...POSES.stand, armN: 30, elbowN: 30 }, t + 0.9, 0.5, 'sine.inOut')
      }
      count(tl, RT, '.f3-gripcount', 0, 500000, b2 + 0.8, 7.95, (v) => Math.round(v).toLocaleString('en-US'), 'power2.in')
      count(tl, RT, '.f3-daycount', 1, 55, b2 + 0.8, 7.95, (v) => `day ${Math.round(v)}`, 'power2.in')
      tl.fromTo('.f3-calpage', { scaleY: 1 }, { scaleY: -1, duration: 0.25, repeat: 16, ease: 'none', svgOrigin: '1380 150', immediateRender: false }, b2 + 1.0)
      // the crack
      seven.to(tl, { ...POSES.reach, torso: 6, armN: 108, elbowN: 8, wristN: 0, head: -12 }, b2 + 8.3, 0.35, 'power2.out')
      const tc = b2 + 8.75
      fade(tl, '.f3-crack', 1, tc, 0.05)
      tl.fromTo('.f3-crackline', { strokeDashoffset: 80 }, { strokeDashoffset: 0, duration: 0.15, immediateRender: false }, tc)
      tl.fromTo('.f3-shard', { x: 0, y: 0, opacity: 1, rotation: 0 }, { x: 90, y: 120, rotation: 200, opacity: 0, duration: 0.9, ease: 'power2.in', transformOrigin: '50% 50%', immediateRender: false }, tc + 0.05)
      camWare.shake(tl, tc, 1.1, 0.45)
      fade(tl, '.f3-redflash', 0.5, tc, 0.05)
      fade(tl, '.f3-redflash', 0, tc + 0.1, 0.6, 0.5)
      seven.to(tl, { ...POSES.stand, armN: 20, elbowN: 50, head: 14, torso: 4 }, tc + 0.1, 0.6)
      fade(tl, '.f3-lab-arith', 1, tc + 0.4, 0.6)

      /* b3: the series play board. */
      const b3 = b2 + 11.4
      tl.addLabel('b3', b3)
      show('.f3-series', b3, 0.8)

      /* b4: lab versus field. */
      const b4 = b3 + 1.6
      tl.addLabel('b4', b4)
      show('.f3-field', b4, 0.6)
      fade(tl, '.f3-split', 1, b4 + 0.3, 0.6)
      // left: the perfect loop on a foam block
      tl.fromTo('.f3-labhand', { y: -200 }, { y: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, b4 + 0.2)
      tl.fromTo('.f3-fieldhand', { y: -200 }, { y: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, b4 + 0.4)
      for (let c = 0; c < 9; c++) {
        const t = b4 + 1.0 + c * 1.05
        labHand.to(tl, { pose: { ...GRASPS.power, wrist: [6, 0] }, touch: { thumb: 0.6, index: 0.6, middle: 0.6, ring: 0.5, little: 0.4 } }, t, 0.4, 'power2.inOut')
        tl.fromTo('.f3-foam', { scaleY: 1 }, { scaleY: 0.86, duration: 0.4, yoyo: true, repeat: 1, svgOrigin: '400 700', immediateRender: false }, t)
        labHand.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, t + 0.5, 0.4, 'power2.inOut')
      }
      count(tl, RT, '.f3-labcount', 0, 1000000, b4 + 1.0, 9, (v) => Math.round(v).toLocaleString('en-US'), 'power2.in')
      // right: a heavy box at an angle; a twist; a snap
      for (let c = 0; c < 3; c++) {
        const t = b4 + 1.2 + c * 1.6
        fieldHand.to(tl, { pose: { ...GRASPS.power, wrist: [10, c === 2 ? 26 : 8] }, touch: { thumb: 1, index: 1, middle: 1, ring: 0.9, little: 0.8 }, view: { roll: c === 2 ? 200 : 186 } }, t, 0.4, 'power2.inOut')
        tl.fromTo('.f3-heavybox', { y: 0, rotation: 0 }, { y: -60, rotation: c === 2 ? 14 : 4, duration: 0.5, ease: 'power2.out', svgOrigin: '1200 700', immediateRender: false }, t + 0.4)
        if (c < 2) {
          tl.fromTo('.f3-heavybox', { y: -60, rotation: 4 }, { y: 0, rotation: 0, duration: 0.4, ease: 'power2.in', svgOrigin: '1200 700', immediateRender: false }, t + 1.0)
          fieldHand.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }, view: { roll: 180 } }, t + 1.1, 0.35)
        }
      }
      count(tl, RT, '.f3-fieldcount', 0, 50, b4 + 1.2, 5.6, (v) => `≈ ${Math.round(v)}`)
      const ts = b4 + 6.6
      fade(tl, '.f3-snap', 1, ts, 0.05)
      tl.fromTo('.f3-snapline', { strokeDashoffset: 90 }, { strokeDashoffset: 0, duration: 0.12, immediateRender: false }, ts)
      tl.fromTo('.f3-fshard', { x: 0, y: 0, opacity: 1, rotation: 0 }, { x: 160, y: 260, rotation: 260, opacity: 0, duration: 1.0, ease: 'power2.in', transformOrigin: '50% 50%', immediateRender: false }, ts + 0.05)
      tl.fromTo('.f3-heavybox', { y: -60, rotation: 14 }, { y: 0, rotation: 24, duration: 0.45, ease: 'bounce.out', svgOrigin: '1200 700', immediateRender: false }, ts + 0.05)
      fieldHand.to(tl, { pose: { ...GRASPS.relaxed, wrist: [-10, 30] }, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, ts + 0.05, 0.3, 'power3.out')
      fade(tl, '.f3-fieldred', 0.6, ts, 0.05)
      fade(tl, '.f3-fieldred', 0.15, ts + 0.1, 0.8, 0.6)
      fade(tl, '.f3-lab-test', 1, ts + 1.4, 0.6)
      tl.to({}, { duration: 0.2 }, b4 + 10.8)
    },
    [labHand, fieldHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.f3-sodium', { opacity: 0.7, duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.f3-floaty', { y: -8, duration: 2.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------- the shifts: each one, some robots stop ---------- */
  useEffect(() => {
    if (!active) return
    const o = { t: 0 }
    const roll = () => {
      const fails: number[] = []
      for (let i = 0; i < FLEET; i++) fails.push(Math.random() > Rref.current ? 0.1 + Math.random() * 0.85 : -1)
      return fails
    }
    let k = 0
    setShift({ k, t: 0, fails: roll() })
    const tw = gsap.to(o, {
      t: 1,
      duration: 2.4,
      ease: 'none',
      repeat: -1,
      paused: !playingRef.current,
      onUpdate: () => setShift((s) => ({ ...s, t: o.t })),
      onRepeat: () => {
        k += 1
        setShift({ k, t: 0, fails: roll() })
      },
    })
    tweenRef.current = tw
    return () => {
      tw.kill()
      tweenRef.current = null
    }
  }, [active])
  useEffect(() => {
    const t = tweenRef.current
    if (!t) return
    if (playing) t.resume()
    else t.pause()
  }, [playing])

  /* ---------- done: the target met and held ---------- */
  useEffect(() => {
    if (!active || won || !meets) return
    const id = window.setTimeout(() => {
      setWon(true)
      emit({ type: 'attempt', correct: true, detail: `${n} actuators at ${pct(rEach)} each: robot ${pct(R, 1)}` })
      memory.seriesDone = { n, r: rEach }
      void say('Seventy parts at ninety-nine point nine percent gives a robot that works only ninety-three percent of the time. Every extra joint makes that worse.')
      playDoneRef.current()
    }, 1400)
    return () => window.clearTimeout(id)
  }, [active, won, meets, n, rEach, R, emit, memory, say])

  /* ---------- what Pip sees ---------- */
  useEffect(() => {
    if (cueIndex === 3) {
      const working = shift.fails.filter((f) => f < 0).length
      reportState(
        'The series reliability play. A row of actuator icons (amber) shows how many actuators the robot has; the ones in its hands are marked. Two sliders: number of actuators (1 to 80, default 70, of which about 50 are in the hands) and how reliable each actuator is through one shift (99% to 99.99%, default 99.9%). ' +
          'A big number shows robot reliability = (each actuator’s reliability) to the power of the number of actuators. Below, a fleet of 50 robots runs shift after shift; robots with a failed actuator go dark. Goal: at least 95% of robots working through a shift. ' +
          `Now: ${n} actuators at ${pct(rEach)} each gives ${pct(R, 1)}; in the last shift ${working} of 50 robots made it. ${meets ? 'The goal is met.' : 'The goal is not met yet.'} ` +
          'Correct answer: with 70 actuators each needs about 99.93% or better (0.9993^70 ≈ 0.95); or cut the actuator count, e.g. 51 actuators at 99.9% gives 95%. ' +
          'Likely mix-ups: thinking 99.9% per part means 99.9% for the robot (it multiplies down to 93% with 70 parts), and being surprised that one more “9” on each part matters so much.',
      )
      setHints(['Each actuator can stop the robot. More of them, more chances to fail.', 'Try making each one more reliable, or using fewer.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, n, rEach, R, meets, shift.k, shift.fails, reportState, setHints])

  const changed = (what: string) => emit({ type: 'progress', detail: what })

  return (
    <g ref={root}>
      <FactoryCSS />

      {/* ---------- b0: the exploded prototype ---------- */}
      <g className="f3-explode" ref={explodeShot} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
          <Dust x={-200} y={0} w={2000} h={900} count={30} seed={61} color={C.rim} size={0.6} />
        </g>
        <g data-depth="1">
          <Pool x={HC.x} y={HC.y - 40} r={560} color="rim" opacity={0.28} />
          <g opacity={0.35}>
            <FlatHand x={HC.x} y={HC.y} s={HC.s} prefix="f3-ghost" fill={C.ink3} />
          </g>
          <g className="f3-moulded" opacity={0}>
            <FlatHand x={HC.x} y={HC.y} s={HC.s} prefix="f3-mould" />
          </g>
          <rect className="f3-fuseflash" x={HC.x - 120} y={HC.y - 50} width={240} height={220} rx={40} fill={C.white} opacity={0} filter="url(#cn-bloom-big)" />
          <g className="f3-snaps" opacity={0}>
            {[[-70, 30], [70, 30], [-60, 130], [60, 130], [0, 150]].map(([sx, sy], i) => (
              <path key={i} d={`M${HC.x + sx * HC.s - 8} ${HC.y + sy * HC.s} l8 -10 l8 10`} fill="none" stroke={C.cyan} strokeWidth={3} />
            ))}
          </g>
          <g className="f3-floaty">
            {PIECES.map((p, i) => (
              <g key={i} transform={`translate(${p.ax} ${p.ay}) scale(1.7)`}>
                <g className={`f3-pc f3-${p.kind}${p.kind === 'gear' || p.kind === 'washer' || p.kind === 'motor' ? ' f3-keep' : ''}`}>
                  <PieceShape kind={p.kind} r={p.r} />
                </g>
              </g>
            ))}
          </g>
          <Label className="f3-lab-cost" x={300} y={640} tx={180} ty={810} text="each one: a cost, a supplier, a step, a failure" color={C.mist} anchor="start" />
          <Label className="f3-lab-palm" x={HC.x + 60} y={HC.y + 100} tx={1180} ty={760} text="brackets → one moulded palm" color={C.paper} />
          <Label className="f3-lab-snap" x={HC.x - 70 * HC.s} y={HC.y + 30 * HC.s} tx={360} ty={760} text="screws → snap fits" color={C.cyanLight} />
        </g>
        <g className="f3-count" opacity={0}>
          <Readout className="f3-counttext" x={90} y={120} color={C.gold} size={64}>
            0 parts
          </Readout>
          <text x={92} y={54} fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
            ONE PROTOTYPE HAND
          </text>
        </g>
        <Vignette />
      </g>

      {/* ---------- b1: identical fingers; a swap ---------- */}
      <g className="f3-line" ref={lineShot} opacity={0} pointerEvents="none">
        <g data-depth="0.45">
          <rect x={-800} y={-600} width={3200} height={2600} fill={C.ink1} />
          <Pool x={800} y={260} r={700} color="key" opacity={0.45} />
          <Pool x={800} y={800} r={600} color="rim" opacity={0.25} />
          <Dust x={-200} y={0} w={2000} h={1300} count={30} seed={9} color={C.keyLight} size={0.6} />
        </g>
        <g data-depth="1">
          {/* the conveyor */}
          <rect x={-400} y={360} width={2400} height={34} fill={C.ink3} />
          <rect x={-400} y={360} width={2400} height={4} fill={C.slate} />
          {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={-380 + i * 80} cy={377} r={11} fill={C.ink2} stroke={C.ink4} strokeWidth={2} />
          ))}
          <rect x={-200} y={150} width={260} height={210} fill={C.ink3} />
          <rect x={-60} y={180} width={100} height={8} fill={C.gold} opacity={0.5} />
          <text x={-70} y={240} fill={C.mist} fontFamily={MONO} fontSize={16}>
            MOULD 1
          </text>
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <g className={`f3-lf-${k}`}>
                <g transform={`translate(${470 + k * 220} 340) rotate(90)`}>
                  <rect x={-19} y={-98} width={38} height={196} rx={19} fill="url(#cn-shell)" stroke={C.shellDark} strokeWidth={2} />
                  {[-40, 24].map((jy) => (
                    <line key={jy} x1={-19} x2={19} y1={jy} y2={jy} stroke={C.carbon} strokeWidth={4} />
                  ))}
                </g>
              </g>
              <circle className={`f3-click-${k}`} cx={470 + k * 220} cy={340} r={40} fill="none" stroke={C.goldLight} strokeWidth={3} opacity={0} />
            </g>
          ))}
          <Label className="f3-lab-mould" x={800} y={300} tx={800} ty={200} text="one mould, four times the volume" color={C.gold} anchor="middle" />
          {/* the hand below */}
          <g transform="translate(0 0)">
            <FlatHand x={800} y={880} s={1.05} prefix="f3-h" />
            <g className="f3-swap-out">
              <g className="f3-broken" opacity={0}>
                <rect x={800 + 22 * 1.05 - 21} y={880 - 220 * 1.05} width={42} height={206} rx={21} fill={C.danger} opacity={0.75} filter="url(#cn-bloom)" />
              </g>
            </g>
            <g className="f3-swap-in" opacity={0}>
              <g transform={`translate(800 880) scale(1.05)`}>
                <rect x={22 - 19} y={-218} width={38} height={196} rx={19} fill="url(#cn-shell)" stroke={C.shellDark} strokeWidth={2} />
                {[-160, -96].map((jy) => (
                  <line key={jy} x1={3} x2={41} y1={jy} y2={jy} stroke={C.carbon} strokeWidth={4} />
                ))}
              </g>
            </g>
            <g className="f3-swapglow" opacity={0}>
              <Pool x={823} y={760} r={160} color="gold" />
            </g>
            <Label className="f3-lab-fru" x={850} y={700} tx={1040} ty={640} text="field replaceable" color={C.goldLight} size={30} />
          </g>
        </g>
        <Vignette />
      </g>

      {/* ---------- b2: the warehouse under sodium light ---------- */}
      <g className="f3-ware" ref={wareShot} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill="#0c0a0a" />
          {/* far racks */}
          <g filter="url(#cn-dof-2)" opacity={0.8}>
            {Array.from({ length: 9 }, (_, i) => (
              <g key={i}>
                <rect x={-300 + i * 260} y={120} width={200} height={520} fill="#15110e" />
                {[0, 1, 2, 3].map((k) => (
                  <rect key={k} x={-290 + i * 260} y={160 + k * 120} width={180} height={70} fill="#2a2018" />
                ))}
              </g>
            ))}
          </g>
          <g className="f3-sodium">
            <Pool x={500} y={260} r={700} color="key" opacity={0.5} />
          </g>
        </g>
        <g data-depth="1">
          <rect x={-600} y={790} width={2800} height={700} fill="#14100c" />
          <rect x={-600} y={790} width={2800} height={3} fill={C.key} opacity={0.2} />
          {[200, 700, 1200].map((lx) => (
            <g key={lx} className="hd-flicker">
              <line x1={lx} x2={lx} y1={-200} y2={60} stroke="#2a2018" strokeWidth={4} />
              <ellipse cx={lx} cy={64} rx={40} ry={7} fill={C.keyLight} />
              <Beam x={lx} y={64} w1={70} w2={600} len={760} opacity={0.22} />
            </g>
          ))}
          {/* the shelf of boxes, and the belt */}
          <rect x={SHELF.x - 30} y={180} width={14} height={620} fill="#3a2c1e" />
          <rect x={SHELF.x + 380} y={180} width={14} height={620} fill="#3a2c1e" />
          {[300, 520].map((sy) => (
            <rect key={sy} x={SHELF.x - 30} y={sy} width={424} height={12} fill="#4a3826" />
          ))}
          {[[60, 300], [180, 300], [300, 300], [120, 520], [250, 520]].map(([bx, by], i) => (
            <rect key={i} x={SHELF.x + bx - 50} y={by - 70} width={100} height={70} fill="#7a5a36" stroke="#4a3420" strokeWidth={2} />
          ))}
          <rect x={780} y={BELT_Y + 70} width={1300} height={26} fill={C.ink3} />
          <rect x={780} y={BELT_Y + 70} width={1300} height={4} fill={C.slate} />
          {[0, 1, 2].map((k) => (
            <g key={k} className={`f3-box-${k}`} opacity={0}>
              <rect x={SHELF.x + 10 - 46} y={520 - 76} width={92} height={66} fill="#8a6640" stroke="#4a3420" strokeWidth={2} />
              <path d={`M${SHELF.x + 10 - 46} ${520 - 52} h92`} stroke="#c9a46e" strokeWidth={6} opacity={0.6} />
            </g>
          ))}
          <ellipse cx={S7.x + 10} cy={S7.y + 4} rx={110} ry={12} fill="#000" opacity={0.6} />
          <Robot name="f3-seven" x={S7.x} y={S7.y} s={S7.s} pose={POSES.stand} light="key-right" />
          {/* the crack on its hand */}
          <g className="f3-crack" opacity={0}>
            <Pool x={S7.x + 150} y={S7.y - 330} r={140} color="danger" />
            <path className="f3-crackline" d={`M${S7.x + 130} ${S7.y - 350} l12 14 l-8 10 l14 12`} fill="none" stroke={C.danger} strokeWidth={4} strokeDasharray={80} strokeDashoffset={80} />
            <path className="f3-shard" d={`M${S7.x + 150} ${S7.y - 330} l14 -4 l4 12 l-12 4 Z`} fill={C.shell} />
          </g>
          <rect className="f3-redflash" x={-600} y={-500} width={2800} height={1900} fill={C.danger} opacity={0} />
          <g className="f3-lab-arith" opacity={0}>
            <text x={760} y={900} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={34} stroke={C.ink} strokeWidth={6} style={{ paintOrder: 'stroke' }}>
              500,000 cycles ÷ 9,000 a day ≈ 55 days
            </text>
          </g>
        </g>
        <g data-depth="1.7">
          <rect x={-300} y={-200} width={170} height={1400} fill="#070505" filter="url(#cn-dof-3)" />
          <rect x={1700} y={-200} width={170} height={1400} fill="#070505" filter="url(#cn-dof-3)" />
        </g>
        <g className="f3-wcount" opacity={0}>
          <text x={80} y={70} fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
            GRIPS
          </text>
          <Readout className="f3-gripcount" x={80} y={128} color={C.paper} size={56}>
            0
          </Readout>
          <text x={80} y={162} fill={C.fog} fontFamily={SANS} fontSize={18}>
            hand rated for 500,000
          </text>
          {/* the calendar */}
          <g>
            <rect x={1300} y={80} width={160} height={150} rx={10} fill={C.paper} />
            <rect x={1300} y={80} width={160} height={40} rx={10} fill={C.danger} />
            <rect className="f3-calpage" x={1306} y={124} width={148} height={52} fill="#d9dee8" opacity={0.6} />
            <Readout className="f3-daycount" x={1380} y={200} anchor="middle" color={C.ink} size={36}>
              day 1
            </Readout>
          </g>
        </g>
        <Vignette />
      </g>

      {/* ---------- b3: the series play ---------- */}
      <g className="f3-series" opacity={0}>
        <Blueprint />
        <Pool x={800} y={480} r={760} color="amber" opacity={0.08} />
        <text x={140} y={120} fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
          THE ROBOT’S ACTUATORS · {n} IN A ROW · {handN} IN THE HANDS
        </text>
        {Array.from({ length: 80 }, (_, i) => {
          const on = i < n
          const hand = i < handN
          return (
            <g key={i} opacity={on ? 1 : 0.12}>
              <circle cx={ACT_X(i)} cy={ACT_Y(i)} r={12} fill={hand ? C.amber : C.amberDark} stroke={hand ? C.amberLight : 'none'} strokeWidth={2} />
              <circle cx={ACT_X(i)} cy={ACT_Y(i)} r={4} fill={C.ink1} />
            </g>
          )
        })}
        {handN > 0 && (
          <g>
            <path d={`M${ACT_X(0) - 12} 262 v10 h${Math.min(handN, 40) * 33 - 9} v-10`} fill="none" stroke={C.amberLight} strokeWidth={2} />
            <text x={ACT_X(0)} y={296} fill={C.amberLight} fontFamily={SANS} fontSize={18}>
              in the hands{handN > 40 ? ' (and the start of row two)' : ''}
            </text>
          </g>
        )}
        {/* the two levers */}
        <g pointerEvents={active && !won ? 'auto' : 'none'}>
          <Slider x={150} y={400} w={600} value={tn} onChange={(v) => { setTn(v); changed(`actuators: ${nOf(v)}`) }} color={C.amber} label="actuators in the robot" valueText={`${n}`} tutor="actuator-count" disabled={!active || won} ticks={[{ at: tOfN(1), text: '1' }, { at: tOfN(40), text: '40' }, { at: tOfN(70), text: '70' }, { at: tOfN(80), text: '80' }]} />
          <Slider x={150} y={530} w={600} value={tr} onChange={(v) => { setTr(v); changed(`each actuator: ${pct(1 - qOf(v))}`) }} color={C.amber} label="each actuator survives a shift" valueText={pct(rEach)} tutor="actuator-reliability" disabled={!active || won} ticks={[{ at: 0, text: '99%' }, { at: 0.5, text: '99.9%' }, { at: tOfR(0.9995), text: '99.95%' }, { at: 1, text: '99.99%' }]} />
        </g>
        {/* the result */}
        <text x={1180} y={360} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
          whole robot survives a shift
        </text>
        <text x={1180} y={480} textAnchor="middle" fill={meets ? C.lime : R > 0.9 ? C.paper : C.danger} fontFamily={SERIF} fontSize={120} fontWeight={600} letterSpacing={-2}>
          {pct(R, 1)}
        </text>
        <text x={1180} y={530} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={26}>
          {(rEach * 100).toFixed(2)}% ^ {n}
        </text>
        <text x={1180} y={580} textAnchor="middle" fill={meets ? C.lime : C.fog} fontFamily={SANS} fontSize={20}>
          goal: 95% or better
        </text>
        {/* the fleet */}
        <text x={124} y={640} fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
          FLEET OF 50 · SHIFT {shift.k + 1}
        </text>
        <rect x={124} y={652} width={1350 * shift.t} height={3} fill={C.amber} opacity={0.6} />
        {Array.from({ length: FLEET }, (_, i) => {
          const f = shift.fails[i] ?? -1
          const down = f >= 0 && shift.t > f
          return (
            <g key={i} opacity={down ? 0.25 : 1}>
              <MiniBot x={FLEET_X(i)} y={FLEET_Y(i)} s={1.25} color={down ? C.slate : C.shell} />
              {down && shift.t - f < 0.12 && <circle cx={FLEET_X(i)} cy={FLEET_Y(i) - 20} r={26} fill={C.danger} opacity={0.5} />}
              {down && <circle cx={FLEET_X(i) + 14} cy={FLEET_Y(i) - 50} r={5} fill={C.danger} />}
            </g>
          )
        })}
        <text x={1476} y={640} textAnchor="end" fill={C.paper} fontFamily={MONO} fontSize={22}>
          {FLEET - shift.fails.filter((f) => f >= 0 && shift.t > f).length} of 50 working
        </text>
        <Vignette />
      </g>

      {/* ---------- b4: the lab versus the field ---------- */}
      <g className="f3-field" opacity={0} pointerEvents="none">
        {/* left: the lab */}
        <rect x={0} y={0} width={800} height={900} fill="#151c28" />
        <Pool x={400} y={380} r={520} color="paper" opacity={0.35} />
        <rect x={60} y={700} width={680} height={20} fill={C.metal} />
        <rect x={80} y={720} width={20} height={200} fill={C.metalDark} />
        <rect x={700} y={720} width={20} height={200} fill={C.metalDark} />
        <rect x={150} y={60} width={40} height={640} fill={C.ink4} />
        <rect x={610} y={60} width={40} height={640} fill={C.ink4} />
        <rect className="f3-foam" x={330} y={610} width={140} height={90} rx={10} fill="#e6dcb8" />
        <g className="f3-labhand">
          <Hand3D store={labHand} x={420} y={330} look="robot" arm={420} light={[0.6, -0.6]} />
        </g>
        <text x={400} y={90} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22} letterSpacing={4}>
          LAB TEST RIG
        </text>
        <Readout className="f3-labcount" x={400} y={820} anchor="middle" color={C.paper} size={52}>
          0
        </Readout>
        <text x={400} y={860} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={18}>
          light foam block, same squeeze every time
        </text>

        {/* right: the field */}
        <rect x={800} y={0} width={800} height={900} fill="#1a130d" />
        <Pool x={1200} y={300} r={600} color="key" opacity={0.5} />
        <Dust x={820} y={60} w={760} h={760} count={40} seed={44} color={C.keyLight} size={0.8} />
        <rect x={800} y={700} width={800} height={200} fill="#120d09" />
        <g className="f3-heavybox">
          <rect x={1110} y={590} width={180} height={110} fill="#8a6640" stroke="#4a3420" strokeWidth={3} />
          <path d="M1110 625 h180" stroke="#c9a46e" strokeWidth={10} opacity={0.6} />
          <text x={1200} y={680} textAnchor="middle" fill="#3a2614" fontFamily={MONO} fontSize={26} fontWeight={700}>
            5 kg
          </text>
        </g>
        <g className="f3-fieldhand">
          <Hand3D store={fieldHand} x={1210} y={330} look="robot" arm={420} light={[-0.6, -0.6]} />
        </g>
        <g className="f3-snap" opacity={0}>
          <Pool x={1180} y={560} r={160} color="danger" />
          <path className="f3-snapline" d="M1150 520 l16 18 l-10 12 l18 16 l-8 12" fill="none" stroke={C.danger} strokeWidth={5} strokeDasharray={90} strokeDashoffset={90} />
          <path className="f3-fshard" d="M1176 556 l20 -6 l6 16 l-18 6 Z" fill={C.shell} />
        </g>
        <rect className="f3-fieldred" x={800} y={0} width={800} height={900} fill={C.danger} opacity={0} />
        <text x={1200} y={90} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22} letterSpacing={4}>
          REAL WAREHOUSE
        </text>
        <Readout className="f3-fieldcount" x={1200} y={820} anchor="middle" color={C.danger} size={52}>
          ≈ 0
        </Readout>
        <text x={1200} y={860} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={18}>
          heavy box, awkward angle, a twist
        </text>
        <g className="f3-split" opacity={0}>
          <line x1={800} x2={800} y1={0} y2={900} stroke={C.paper} strokeWidth={3} opacity={0.5} />
        </g>
        <g className="f3-lab-test" opacity={0}>
          <text x={800} y={448} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={36} fontWeight={600} stroke={C.ink} strokeWidth={10} strokeOpacity={0.85} style={{ paintOrder: 'stroke' }}>
            no agreed durability test exists
          </text>
        </g>
        <SourceNote className="f3-lab-test" x={800} y={500} anchor="middle" color={C.paper}>
          maker’s claim: up to 1M cycles · field report: ~50 grips of 5 kg items
        </SourceNote>
        <Vignette />
      </g>
    </g>
  )
}

export const ch3: Chapter = {
  id: 'durability',
  title: 'Fewer parts, longer life',
  cues: CUES,
  Scene: Ch3Durability,
  enter: { type: 'pan', dir: 'right' },
  deeper: [ReliabilityReading],
}
