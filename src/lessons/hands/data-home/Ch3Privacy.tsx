import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Meter, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { HOMEBOT, HomeBot, Laundry, LivingRoom, earAt } from './props'
import { HomeRobotsReading } from './readings'

export const CUES: Cue[] = [
  { id: 'neo', say: 'The first humanoids sold for homes come with a twist. When the robot can’t do a chore yet, a remote operator can put on a headset, see through its eyes, and do the chore for you.' },
  { id: 'flywheel', say: 'Every one of those rescues is training data. The customer’s home becomes a data centre. That’s how the robot is supposed to get better.' },
  { id: 'seen', say: 'But think about what those cameras see: faces, documents, children, guests who never agreed to anything. Who keeps that footage, and what is it used for? Reviewers say the answers aren’t clear yet.' },
  { id: 'choose', say: 'You set the rules for a home robot company. Each rule protects privacy or improves the robot. Find a set your customers will trust that still lets the robot learn.', play: true },
]

const STATE = [
  'A cosy living room at dusk: warm floor lamp, sofa, bookcase, a window with the last orange light. A soft-shelled home humanoid (knit beige shell, like 1X NEO) stands folding laundry from a basket. It gets stuck on a crumpled fitted sheet; a small ring light by its ear switches from white to lime: a human has taken control. Cut to a dark room far away: a remote operator in a VR headset, in silhouette, moves their arms while a screen shows the same living room through the robot\'s eyes. This is "expert mode": teleoperated rescues for chores the robot cannot do yet.',
  'A lime loop draws itself on a dark blueprint, around a spinning flywheel: home → operator rescue → training data → better model → fewer rescues → back to the home. The home node lights up like a server. Label: "1X NEO: $20,000 or $499 a month; expert mode". The point: every rescue becomes training data, so customers\' homes become the data source that improves the robot (the data flywheel).',
  'The robot\'s own camera view, with a recording HUD (red REC dot, lime timecode). The view pans slowly across the living room: a family photo with faces, an open letter on the coffee table, a child\'s drawing taped to the wall, and a guest sitting on the sofa. Each gets a faint lime dashed "recorded" outline. Then, one by one, they are blurred out (on-device blurring is one answer). The point: home robot cameras see sensitive things and people who never consented; retention, training use and blurring policies are unclear (reviewers\' criticism of expert mode).',
  '',
]

/* ---------------- the living room ---------------- */
const BOT = { x: 1160, y: 790, s: 1.05 }
const EAR = earAt(BOT.x, BOT.y, BOT.s, true)
/** Folding, as the rig's poses: arms out holding a towel, then up and over. */
const HOLD = { ...POSES.hold, torso: 8, head: 16, armN: 46, elbowN: 50, armF: 40, elbowF: 56 }
const LIFT = { ...POSES.hold, torso: 2, head: 4, armN: 82, elbowN: 30, armF: 76, elbowF: 36 }
const FOLD = { ...POSES.hold, torso: 12, head: 20, armN: 36, elbowN: 80, armF: 30, elbowF: 86 }
const STUCK = { ...POSES.hold, torso: 16, head: 26, armN: 34, elbowN: 44, armF: 26, elbowF: 40 }

/* ---------------- the operator ---------------- */
const OP = { x: 520, y: 800 }
const SCREEN = { x: 860, y: 170, w: 600, h: 340 }

/* ---------------- the flywheel ---------------- */
const FW = { x: 800, y: 440, r: 270 }
const NODES = [
  { a: -90, t: 'home', sub: 'the customer’s living room' },
  { a: -18, t: 'operator rescue', sub: 'a human takes over' },
  { a: 54, t: 'training data', sub: 'every rescue is recorded' },
  { a: 126, t: 'better model', sub: 'trained on the rescues' },
  { a: 198, t: 'fewer rescues', sub: 'the robot does more itself' },
]
const node = (i: number) => {
  const a = (NODES[i].a * Math.PI) / 180
  return { x: FW.x + Math.cos(a) * FW.r, y: FW.y + Math.sin(a) * FW.r * 0.86 }
}

/* ---------------- what the camera sees ---------------- */
const SEEN = [
  { cls: 'photo', x: 462, y: 162, w: 216, h: 166, tag: 'faces' },
  { cls: 'letter', x: 588, y: 756, w: 148, h: 46, tag: 'an open letter' },
  { cls: 'drawing', x: 716, y: 196, w: 160, h: 132, tag: 'a child’s drawing' },
  { cls: 'guest', x: 650, y: 420, w: 120, h: 150, tag: 'a guest who never agreed' },
]

/* ---------------- the play ---------------- */
interface Rule {
  text: string
  trust: number
  learn: number
  hint: string
}
const RULES: Rule[] = [
  { text: 'Blur faces and documents on the robot before upload', trust: 20, learn: -6, hint: 'trust ++   learning −' },
  { text: 'Owner approves each remote session', trust: 18, learn: -8, hint: 'trust ++   learning −' },
  { text: 'Light shows when a human is in control', trust: 10, learn: 0, hint: 'trust +   learning ±0' },
  { text: 'Keep all footage forever', trust: -25, learn: 10, hint: 'trust − −   learning +' },
  { text: 'Learn only from rescues, not from idle footage', trust: 12, learn: -4, hint: 'trust +   learning a little −' },
  { text: 'Train models on the robot itself, share only updates', trust: 14, learn: -12, hint: 'trust +   learning −, and it costs more' },
]
const BASE_TRUST = 30
const BASE_LEARN = 75
const CUSTOMERS = 20
/** Each customer stays while trust is at least their threshold (12% to 69%). */
const threshold = (i: number) => 12 + i * 3
const T_TARGET = 0.7
const L_TARGET = 0.6
const ROW_Y = (i: number) => 214 + i * 96
const CX0 = 930
const custX = (i: number) => CX0 + (i % 10) * 58
const custY = (i: number) => 458 + Math.floor(i / 10) * 74

function model(on: boolean[]) {
  let t = BASE_TRUST
  let l = BASE_LEARN
  on.forEach((v, i) => {
    if (v) {
      t += RULES[i].trust
      l += RULES[i].learn
    }
  })
  const trust = Math.max(0, Math.min(100, t)) / 100
  const stay = Array.from({ length: CUSTOMERS }, (_, i) => trust * 100 >= threshold(i))
  const kept = stay.filter(Boolean).length
  const learn = (Math.max(0, Math.min(100, l)) / 100) * (kept / CUSTOMERS)
  return { trust, learn, stay, kept, rawLearn: l / 100 }
}
/** Rescues a week over the first year, falling faster the more the robot learns. */
const rescues = (learn: number, m: number) => 20 * (1 - 0.85 * learn * (1 - Math.exp(-m / 4)))

export function Ch3Privacy({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const roomRef = useRef<SVGGElement>(null)
  const opRef = useRef<SVGGElement>(null)
  const povRef = useRef<SVGGElement>(null)

  const [on, setOn] = useState<boolean[]>(() => RULES.map(() => false))
  const [touched, setTouched] = useState<boolean[]>(() => RULES.map(() => false))
  const [won, setWon] = useState(false)
  const m = model(on)
  const live = cueIndex === 3

  const build = useCallback((tl: gsap.core.Timeline) => {
    const cam = camera(roomRef.current, { x: 800, y: 450, zoom: 1 })
    const ocam = camera(opRef.current, { x: 800, y: 450, zoom: 1.05 })
    const pcam = camera(povRef.current, { x: 570, y: 250, zoom: 2.3 })
    const bot = rig(root.current, 'neo', HOLD)
    const mini = rig(root.current, 'neo-mini', HOLD)
    const op = rig(root.current, 'operator', POSES.sitForward)

    tl.set('.c3-op, .c3-fly, .c3-pov, .c3-play', { opacity: 0 }, 0)
    tl.set('.c3-room', { opacity: 1 }, 0)

    /* b0: a living room at dusk; the robot folds, gets stuck, and a human takes over from far away. */
    tl.addLabel('b0', 0)
    cam.to(tl, { x: 980, y: 560, zoom: 1.35 }, 0, 7.6, 'sine.inOut')
    const fold = (r: typeof bot, t: number) => {
      r.to(tl, LIFT, t, 0.7)
      r.to(tl, FOLD, t + 0.7, 0.6)
      r.to(tl, HOLD, t + 1.3, 0.6)
    }
    fold(bot, 0.2)
    tl.fromTo('.c3-towel', { scaleY: 1 }, { scaleY: 0.5, duration: 0.6, yoyo: true, repeat: 1, svgOrigin: '1040 560', immediateRender: false }, 0.9)
    // stuck on a fitted sheet
    bot.to(tl, STUCK, 2.2, 0.8)
    bot.to(tl, { ...STUCK, head: 34, armN: 30 }, 3.0, 0.5)
    bot.to(tl, STUCK, 3.5, 0.5)
    fade(tl, '.c3-towel', 0, 2.1, 0.3, 1)
    fade(tl, '.c3-sheet', 1, 2.2, 0.3)
    fade(tl, '.c3-q', 1, 3.0, 0.4)
    fade(tl, '.c3-q', 0, 5.2, 0.4, 1)
    // the ear light: a human is in control
    fade(tl, '.c3-ear-on', 1, 5.4, 0.3)
    tl.fromTo('.c3-ear-core', { attr: { r: 16 } }, { attr: { r: 7 }, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, 5.4)
    fade(tl, '.c3-lab-ear', 1, 5.8, 0.5)
    bot.to(tl, HOLD, 6.2, 0.6)
    fold(bot, 6.8)
    // cut: the operator, far away
    const cut = 8.2
    tl.set('.c3-room', { opacity: 0 }, cut)
    tl.set('.c3-op', { opacity: 1 }, cut)
    ocam.to(tl, { x: 760, y: 470, zoom: 1.2 }, cut, 6.2, 'sine.inOut')
    op.to(tl, { ...POSES.sitForward, armN: 70, elbowN: 40, armF: 64, elbowF: 46 }, cut, 0.6)
    op.to(tl, { ...POSES.sitForward, armN: 96, elbowN: 24, armF: 90, elbowF: 30, head: -6 }, cut + 0.7, 0.7)
    op.to(tl, { ...POSES.sitForward, armN: 60, elbowN: 70, armF: 54, elbowF: 76, head: 10 }, cut + 1.4, 0.6)
    op.to(tl, { ...POSES.sitForward, armN: 96, elbowN: 24, armF: 90, elbowF: 30, head: -6 }, cut + 2.4, 0.7)
    op.to(tl, { ...POSES.sitForward, armN: 60, elbowN: 70, armF: 54, elbowF: 76, head: 10 }, cut + 3.1, 0.6)
    mini.to(tl, LIFT, cut + 0.7, 0.7)
    mini.to(tl, FOLD, cut + 1.4, 0.6)
    mini.to(tl, LIFT, cut + 2.4, 0.7)
    mini.to(tl, FOLD, cut + 3.1, 0.6)
    fade(tl, '.c3-lab-op', 1, cut + 1.6, 0.6)
    tl.to({}, { duration: 0.1 }, 14.3)

    /* b1: the flywheel. */
    const b1 = 14.4
    tl.addLabel('b1', b1)
    fade(tl, '.c3-op', 0, b1, 0.5, 1)
    fade(tl, '.c3-fly', 1, b1, 0.6)
    tl.fromTo('.c3-loop', { strokeDashoffset: 1800 }, { strokeDashoffset: 0, duration: 3.2, ease: 'power1.inOut', immediateRender: false }, b1 + 0.3)
    NODES.forEach((_, i) => {
      tl.fromTo(`.c3-node-${i}`, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b1 + 0.4 + i * 0.6)
    })
    fade(tl, '.c3-wheel', 1, b1 + 1.0, 0.8)
    tl.fromTo('.c3-wheelspin', { rotation: 0 }, { rotation: 540, duration: 8.6, ease: 'power1.in', svgOrigin: `${FW.x} ${FW.y}`, immediateRender: false }, b1 + 0.4)
    fade(tl, '.c3-homedata', 1, b1 + 3.6, 0.6)
    tl.fromTo('.c3-homeglow', { opacity: 0 }, { opacity: 1, duration: 0.6, immediateRender: false }, b1 + 3.6)
    tl.fromTo('.c3-packet', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.25, immediateRender: false }, b1 + 3.4)
    tl.fromTo('.c3-rescue', { opacity: 1 }, { opacity: 0, duration: 0.3, stagger: 0.35, immediateRender: false }, b1 + 6.2)
    fade(tl, '.c3-lab-neo', 1, b1 + 5.2, 0.6)
    tl.to({}, { duration: 0.1 }, b1 + 8.9)

    /* b2: through the robot's eyes. */
    const b2 = b1 + 9
    tl.addLabel('b2', b2)
    fade(tl, '.c3-fly', 0, b2, 0.5, 1)
    fade(tl, '.c3-pov', 1, b2, 0.5)
    pcam.to(tl, { x: 600, y: 300, zoom: 2.2 }, b2, 1.4, 'sine.inOut')
    pcam.to(tl, { x: 660, y: 690, zoom: 2.0 }, b2 + 1.4, 1.2, 'sine.inOut')
    pcam.to(tl, { x: 800, y: 300, zoom: 2.1 }, b2 + 2.6, 1.2, 'sine.inOut')
    pcam.to(tl, { x: 720, y: 520, zoom: 1.8 }, b2 + 3.8, 1.3, 'sine.inOut')
    pcam.to(tl, { x: 700, y: 480, zoom: 1.28 }, b2 + 5.4, 2.4, 'sine.inOut')
    pcam.to(tl, { x: 690, y: 480, zoom: 1.34 }, b2 + 7.8, 6.6, 'sine.inOut')
    const seenAt = [0.9, 2.1, 3.3, 4.6]
    SEEN.forEach((s, i) => {
      tl.fromTo(`.c3-out-${s.cls}`, { opacity: 0 }, { opacity: 1, duration: 0.35, immediateRender: false }, b2 + seenAt[i])
      tl.fromTo(`.c3-out-${s.cls} rect`, { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 0.6, immediateRender: false }, b2 + seenAt[i])
    })
    fade(tl, '.c3-upload', 1, b2 + 7.0, 0.5)
    SEEN.forEach((s, i) => {
      fade(tl, `.c3-blur-${s.cls}`, 1, b2 + 9.6 + i * 0.8, 0.6)
      fade(tl, `.c3-tag-${s.cls}`, 0, b2 + 9.6 + i * 0.8, 0.4, 1)
      fade(tl, `.c3-tagb-${s.cls}`, 1, b2 + 9.8 + i * 0.8, 0.4)
    })
    fade(tl, '.c3-lab-blur', 1, b2 + 12.4, 0.6)
    tl.to({}, { duration: 0.1 }, b2 + 14.5)

    /* b3: the learner's turn. */
    const b3 = b2 + 14.6
    tl.addLabel('b3', b3)
    fade(tl, '.c3-pov', 0, b3, 0.5, 1)
    fade(tl, '.c3-play', 1, b3 + 0.2, 0.6)
    tl.fromTo('.c3-pc', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, immediateRender: false }, b3 + 0.3)
    tl.to({}, { duration: 0.1 }, b3 + 2.2)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-lamp', { opacity: 0.8, duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-screenglow', { opacity: 0.55, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c3-rec', { opacity: 0.2, duration: 0.7, yoyo: true, repeat: -1, ease: 'steps(1)' })
    gsap.fromTo('.c3-earpulse', { attr: { r: 7 }, opacity: 1 }, { attr: { r: 16 }, opacity: 0, duration: 1.4, repeat: -1, ease: 'power1.out' })
    gsap.to('.c3-idle', { rotation: 360, duration: 30, repeat: -1, ease: 'none', svgOrigin: `${FW.x} ${FW.y}` })
    gsap.to('.c3-cust-gone', { x: 10, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  // The ear light rides on the robot's head wherever the rig puts it.
  useEffect(() => {
    const tick = () => {
      const el = root.current
      const head = el?.querySelector('.person.neo [data-j="head"]') as SVGGraphicsElement | null
      const dot = el?.querySelector('.c3-earfollow') as SVGGraphicsElement | null
      const parent = dot?.parentNode as SVGGraphicsElement | null
      const hm = head?.getScreenCTM()
      const pm = parent?.getScreenCTM()
      if (!dot || !hm || !pm) return
      const p = new DOMPoint(8, -287).matrixTransform(hm).matrixTransform(pm.inverse())
      dot.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`)
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 3) {
      const ons = RULES.filter((_, i) => on[i]).map((r) => `"${r.text}"`)
      reportState(
        'The learner\'s turn: they set the rules for a home robot company. Six switches on the left, each a policy with a privacy effect and a learning effect: ' +
          RULES.map((r) => `"${r.text}" (trust ${r.trust > 0 ? '+' : ''}${r.trust}, learning ${r.learn > 0 ? '+' : ''}${r.learn})`).join('; ') +
          `. Starting point with no rules: trust ${BASE_TRUST}%, learning ${BASE_LEARN}% before customers leave. Twenty customer figures on the right stay or leave depending on trust (each has a threshold between 12% and 69%), and learning is scaled by how many customers stay, because no customers means no data. ` +
          `Right now switched on: ${ons.length ? ons.join(', ') : 'nothing'}. Customer trust ${Math.round(m.trust * 100)}% (target 70%), robot learning ${Math.round(m.learn * 100)}% (target 60%), customers kept ${m.kept} of 20. ${won ? 'The learner has met both targets.' : ''} ` +
          'Working sets include: blur + light + rescues-only; blur + owner approval + light; owner approval + light + rescues-only. "Keep all footage forever" never works (it drives customers away); switching on every privacy rule kills learning. ' +
          'Likely mix-ups: maximising learning by keeping everything (customers leave, so learning collapses); or maximising privacy with every rule (the robot stops improving).',
      )
      setHints(['Which rules cost the robot almost nothing to learn?', 'Customers leave if they don’t trust you, and then there’s no data at all.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, on, m.trust, m.learn, m.kept, won, reportState, setHints])

  /* ---------------- the play ---------------- */
  const toggle = (i: number) => {
    if (!live) return
    const next = on.map((v, k) => (k === i ? !v : v))
    setOn(next)
    setTouched((t) => t.map((v, k) => (k === i ? true : v)))
    const r = model(next)
    emit({ type: 'progress', detail: `${next[i] ? 'switched on' : 'switched off'} "${RULES[i].text}": trust ${Math.round(r.trust * 100)}%, learning ${Math.round(r.learn * 100)}%` })
    if (!won && r.trust >= T_TARGET && r.learn >= L_TARGET) {
      setWon(true)
      emit({ type: 'attempt', correct: true, detail: `found a set of rules with trust ${Math.round(r.trust * 100)}% and learning ${Math.round(r.learn * 100)}%` })
      void say('There’s no free answer, but there are good trades. Designing them is an open job, and it’s as important as any algorithm.')
      onPlayDone()
    }
  }

  const curve = (learn: number) =>
    Array.from({ length: 25 }, (_, k) => {
      const mo = k / 2
      return `${k ? 'L' : 'M'}${(940 + mo * 46).toFixed(1)} ${(850 - (rescues(learn, mo) / 20) * 150).toFixed(1)}`
    }).join(' ')
  const yearEnd = rescues(m.learn, 12)

  return (
    <g ref={root}>
      {/* ---------- the living room ---------- */}
      <g className="c3-room" ref={roomRef} pointerEvents="none">
        <g data-depth="1">
          <LivingRoom p="lr" lampClass="c3-lamp" />
          <Laundry x={930} y={790} s={1.1} />
          <ellipse cx={BOT.x} cy={BOT.y + 4} rx={90} ry={11} fill="#000" opacity={0.5} />
          <HomeBot name="neo" x={BOT.x} y={BOT.y} s={BOT.s} flip pose={HOLD} light="soft-right" />
          {/* what it is folding: a towel, then a fitted sheet it can't manage */}
          <g className="c3-towel">
            <path d="M1012 552 L1072 552 L1076 640 L1008 640 Z" fill="#c8b8e8" />
            <path d="M1012 560 H1072" stroke="#e8e0f6" strokeWidth={4} />
          </g>
          <g className="c3-sheet" opacity={0}>
            <path d="M992 560 q20 -20 50 -6 q30 -16 46 8 q10 40 -14 70 q-30 20 -60 4 q-30 -20 -22 -76 Z" fill="#e8e2d4" />
            <path d="M1006 580 q20 10 40 -4 M1020 610 q20 6 38 -8" stroke="#b8b0a0" strokeWidth={3} fill="none" />
          </g>
          <g className="c3-q" opacity={0}>
            <text x={1060} y={430} fill={C.mist} fontFamily={SERIF} fontSize={64} fontWeight={600} textAnchor="middle">
              ?
            </text>
          </g>
          {/* the ear light */}
          <g className="c3-earfollow" transform={`translate(${EAR.x} ${EAR.y})`}>
            <circle cx={0} cy={0} r={6} fill={HOMEBOT.visor} opacity={0.9} />
            <g className="c3-ear-on" opacity={0}>
              <circle className="c3-ear-core" cx={0} cy={0} r={7} fill={C.lime} filter="url(#cn-bloom)" />
              <circle className="c3-earpulse" cx={0} cy={0} r={7} fill="none" stroke={C.lime} strokeWidth={2} />
              <Pool x={0} y={0} r={70} color="lime" opacity={0.6} />
            </g>
            <Label className="c3-lab-ear" x={-4} y={-8} tx={-130} ty={-130} text="a human is in control" sub="the ear light changes colour" color={C.limeLight} />
          </g>
          <Dust x={600} y={150} w={800} h={600} count={22} seed={61} />
        </g>
      </g>

      {/* ---------- the operator, far away ---------- */}
      <g className="c3-op" ref={opRef} opacity={0} pointerEvents="none">
        <g data-depth="0.6">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#06080e" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} filter="url(#cn-dof-2)" opacity={0.5}>
              <rect x={-200 + i * 120} y={260 + (i % 2) * 40} width={90} height={60} fill={C.ink3} />
              <rect x={-190 + i * 120} y={270 + (i % 2) * 40} width={70} height={40} fill={C.rimDeep} opacity={0.4} />
            </g>
          ))}
        </g>
        <g data-depth="1">
          {/* the screen: the living room, through the robot's eyes */}
          <rect x={SCREEN.x - 14} y={SCREEN.y - 14} width={SCREEN.w + 28} height={SCREEN.h + 28} rx={8} fill={C.ink2} />
          <svg x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} viewBox="560 300 760 430" preserveAspectRatio="xMidYMid slice">
            <LivingRoom p="lrm" />
            <Laundry x={930} y={790} s={1.1} />
            <HomeBot name="neo-mini" x={BOT.x} y={BOT.y} s={BOT.s} flip pose={HOLD} light="soft-right" />
          </svg>
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill="url(#cn-grid)" opacity={0.4} />
          <text x={SCREEN.x + 20} y={SCREEN.y + 36} fill={C.lime} fontFamily={MONO} fontSize={20}>
            ● LIVE · customer home · expert mode
          </text>
          <rect x={SCREEN.x + 330} y={SCREEN.y + SCREEN.h + 14} width={30} height={160} fill={C.ink2} />
          <rect x={SCREEN.x + 250} y={SCREEN.y + SCREEN.h + 170} width={190} height={14} fill={C.ink2} />
          <g className="c3-screenglow" opacity={0.85}>
            <Pool x={SCREEN.x - 60} y={SCREEN.y + 220} r={560} color="key" opacity={0.6} />
            <path d={`M${SCREEN.x} ${SCREEN.y} L${OP.x + 30} ${OP.y - 300} L${OP.x + 30} ${OP.y - 150} L${SCREEN.x} ${SCREEN.y + SCREEN.h} Z`} fill={C.keyLight} opacity={0.05} />
          </g>
          {/* the chair and the operator, a silhouette in a headset */}
          <rect x={OP.x - 70} y={OP.y - 120} width={110} height={14} rx={6} fill={C.ink2} />
          <rect x={OP.x - 30} y={OP.y - 106} width={12} height={106} fill={C.ink2} />
          <rect x={OP.x - 80} y={OP.y - 270} width={16} height={160} rx={6} fill={C.ink2} />
          <Person name="operator" x={OP.x} y={OP.y} s={1.1} pose={POSES.sitForward} headset outfit="tee" top="#141a26" topDark="#0c1018" pants="#0c1018" shoes="#06080c" skin="#2a1a12" skinDark="#1a0f0a" hair="buzz" light="screen" />
          <path d={`M${OP.x + 28} ${OP.y - 330} q12 30 4 60`} stroke={C.key} strokeWidth={3} fill="none" opacity={0.6} filter="url(#cn-bloom)" />
          <Label className="c3-lab-op" x={OP.x + 30} y={OP.y - 330} tx={OP.x - 60} ty={150} text="a remote operator, miles away" sub="sees through the robot’s cameras" color={C.keyLight} />
          <Dust x={300} y={100} w={1000} h={600} count={18} seed={62} color={C.keyLight} />
        </g>
      </g>

      {/* ---------- the flywheel ---------- */}
      <g className="c3-fly" opacity={0} pointerEvents="none">
        <Blueprint />
        <circle cx={FW.x} cy={FW.y} r={380} fill="url(#cn-pool-lime)" opacity={0.25} />
        <ellipse className="c3-loop" cx={FW.x} cy={FW.y} rx={FW.r} ry={FW.r * 0.86} fill="none" stroke={C.lime} strokeWidth={5} strokeDasharray="1800" strokeDashoffset="1800" opacity={0.8} />
        {[30, 102, 174, 246, 318].map((a) => {
          const r = (a * Math.PI) / 180
          const x = FW.x + Math.cos(r) * FW.r
          const y = FW.y + Math.sin(r) * FW.r * 0.86
          const deg = (Math.atan2(Math.cos(r) * FW.r * 0.86, -Math.sin(r) * FW.r) * 180) / Math.PI
          return <path key={a} className="c3-node-arrow" d="M-10 -9 L8 0 L-10 9" fill="none" stroke={C.lime} strokeWidth={4} transform={`translate(${x} ${y}) rotate(${deg})`} />
        })}
        <g className="c3-wheel" opacity={0}>
          <g className="c3-wheelspin">
            <g className="c3-idle">
              <circle cx={FW.x} cy={FW.y} r={120} fill="none" stroke={C.lime} strokeWidth={14} opacity={0.85} />
              <circle cx={FW.x} cy={FW.y} r={22} fill={C.lime} />
              {Array.from({ length: 6 }, (_, i) => (
                <line key={i} x1={FW.x} y1={FW.y} x2={FW.x + Math.cos((i * Math.PI) / 3) * 116} y2={FW.y + Math.sin((i * Math.PI) / 3) * 116} stroke={C.lime} strokeWidth={6} opacity={0.7} />
              ))}
              {Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x={FW.x - 6} y={FW.y - 136} width={12} height={16} fill={C.limeDark} transform={`rotate(${i * 30} ${FW.x} ${FW.y})`} />
              ))}
            </g>
          </g>
        </g>
        {NODES.map((n, i) => {
          const p = node(i)
          const right = p.x > FW.x + 20
          const left = p.x < FW.x - 20
          return (
            <g key={n.t} className={`c3-node-${i}`} opacity={0}>
              {i === 0 && <circle className="c3-homeglow" cx={p.x} cy={p.y} r={90} fill="url(#cn-pool-lime)" opacity={0} />}
              <circle cx={p.x} cy={p.y} r={48} fill={C.ink1} stroke={C.lime} strokeWidth={4} />
              {i === 0 && (
                <g>
                  <path d={`M${p.x - 22} ${p.y + 18} V${p.y - 4} L${p.x} ${p.y - 24} L${p.x + 22} ${p.y - 4} V${p.y + 18} Z`} fill="none" stroke={C.limeLight} strokeWidth={3} />
                  <g className="c3-homedata" opacity={0}>
                    {[0, 1, 2].map((k) => (
                      <rect key={k} x={p.x - 12} y={p.y - 2 + k * 6} width={24} height={3} fill={C.lime} />
                    ))}
                  </g>
                </g>
              )}
              {i === 1 && (
                <g>
                  <path d={`M${p.x - 24} ${p.y - 6} h48 v18 h-48 Z`} fill="none" stroke={C.limeLight} strokeWidth={3} />
                  <path d={`M${p.x - 24} ${p.y - 6} q24 -26 48 0`} fill="none" stroke={C.limeLight} strokeWidth={3} />
                </g>
              )}
              {i === 2 && (
                <g fill="none" stroke={C.limeLight} strokeWidth={3}>
                  <ellipse cx={p.x} cy={p.y - 16} rx={20} ry={7} />
                  <path d={`M${p.x - 20} ${p.y - 16} v30 q20 12 40 0 v-30`} />
                  <path d={`M${p.x - 20} ${p.y - 1} q20 12 40 0`} />
                </g>
              )}
              {i === 3 && (
                <g stroke={C.limeLight} strokeWidth={2.5}>
                  {[
                    [-18, -14, 0, -18],
                    [-18, -14, 0, 4],
                    [-18, 10, 0, 4],
                    [-18, 10, 0, -18],
                    [0, -18, 18, -4],
                    [0, 4, 18, -4],
                    [0, 4, 18, 14],
                  ].map(([a, b2, c, d], k) => (
                    <line key={k} x1={p.x + a} y1={p.y + b2} x2={p.x + c} y2={p.y + d} />
                  ))}
                  {[
                    [-18, -14],
                    [-18, 10],
                    [0, -18],
                    [0, 4],
                    [18, -4],
                    [18, 14],
                  ].map(([a, b2], k) => (
                    <circle key={k} cx={p.x + a} cy={p.y + b2} r={4} fill={C.lime} />
                  ))}
                </g>
              )}
              {i === 4 && (
                <g>
                  {[0, 1, 2, 3].map((k) => (
                    <rect key={k} className="c3-rescue" x={p.x - 22 + k * 12} y={p.y - 12} width={8} height={24} rx={2} fill={C.limeLight} />
                  ))}
                </g>
              )}
              <text x={right ? p.x + 66 : left ? p.x - 66 : p.x} y={p.y + (i === 0 ? -96 : 0)} fill={C.limeLight} fontFamily={SANS} fontSize={26} fontWeight={600} textAnchor={right ? 'start' : left ? 'end' : 'middle'}>
                {n.t}
              </text>
              <text x={right ? p.x + 66 : left ? p.x - 66 : p.x} y={p.y + (i === 0 ? -68 : 26)} fill={C.mist} fontFamily={SANS} fontSize={18} textAnchor={right ? 'start' : left ? 'end' : 'middle'}>
                {n.sub}
              </text>
            </g>
          )
        })}
        {[0, 1, 2, 3].map((k) => (
          <circle key={k} className="c3-packet" cx={node(1).x - 40 + k * 22} cy={node(1).y + 70 + k * 30} r={6} fill={C.lime} opacity={0} />
        ))}
        <g className="c3-lab-neo" opacity={0}>
          <text x={800} y={850} fill={C.paper} fontFamily={SANS} fontSize={26} textAnchor="middle">
            1X NEO: <tspan fill={C.gold}>$20,000 or $499 a month</tspan>; expert mode
          </text>
        </g>
      </g>

      {/* ---------- through the robot's eyes ---------- */}
      <g className="c3-pov" opacity={0} pointerEvents="none">
        <g ref={povRef}>
          <g data-depth="1">
            <LivingRoom p="lrp" guest lampClass="c3-lamp" />
            {/* on-device blur, one patch per private thing */}
            <g className="c3-blur-photo" opacity={0}>
              <g filter="url(#cn-dof-2)">
                {Array.from({ length: 20 }, (_, k) => (
                  <rect key={k} x={470 + (k % 5) * 40} y={170 + Math.floor(k / 5) * 37.5} width={40} height={37.5} fill={['#5a6a7a', '#b98a6a', '#3a4a5a', '#8a6a4a', '#5a6a4a'][(k * 3) % 5]} />
                ))}
              </g>
            </g>
            <g className="c3-blur-letter" opacity={0}>
              <rect x={594} y={762} width={136} height={34} rx={6} fill="#d8d2c4" filter="url(#cn-dof-2)" />
            </g>
            <g className="c3-blur-drawing" opacity={0}>
              <g filter="url(#cn-dof-2)">
                {Array.from({ length: 12 }, (_, k) => (
                  <rect key={k} x={724 + (k % 4) * 36} y={204 + Math.floor(k / 4) * 40} width={36} height={40} fill={['#f0ece0', '#e8c8a0', '#d8e0e8', '#f0e0d0'][k % 4]} />
                ))}
              </g>
            </g>
            <g className="c3-blur-guest" opacity={0}>
              {Array.from({ length: 9 }, (_, k) => (
                <rect key={k} x={694 + (k % 3) * 18} y={418 + Math.floor(k / 3) * 18} width={18} height={18} fill={['#e8b48f', '#5a3a22', '#c89a78'][k % 3]} />
              ))}
            </g>
            {SEEN.map((s) => (
              <g key={s.cls} className={`c3-out-${s.cls}`} opacity={0}>
                <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={6} fill="none" stroke={C.lime} strokeWidth={2.5} strokeDasharray="10 6" strokeDashoffset={600} />
                <g className={`c3-tag-${s.cls}`}>
                  <rect x={s.x} y={s.y - 26} width={s.tag.length * 9.6 + 56} height={22} fill={C.lime} opacity={0.9} />
                  <circle cx={s.x + 12} cy={s.y - 15} r={4} fill={C.danger} />
                  <text x={s.x + 22} y={s.y - 9} fill={C.ink} fontFamily={MONO} fontSize={15}>
                    REC · {s.tag}
                  </text>
                </g>
                <g className={`c3-tagb-${s.cls}`} opacity={0}>
                  <text x={s.x + 4} y={s.y - 9} fill={C.limeLight} fontFamily={MONO} fontSize={15}>
                    blurred on the robot
                  </text>
                </g>
              </g>
            ))}
          </g>
        </g>
        {/* the HUD stays put while the view pans */}
        <g>
          <rect x={0} y={0} width={1600} height={900} fill={C.rimDeep} opacity={0.06} />
          {[
            [70, 70, 1, 1],
            [1530, 70, -1, 1],
            [70, 830, 1, -1],
            [1530, 830, -1, -1],
          ].map(([x, y, sx, sy], i) => (
            <path key={i} d={`M${x} ${y + sy * 60} V${y} H${x + sx * 60}`} fill="none" stroke={C.paper} strokeWidth={3} opacity={0.7} />
          ))}
          <circle className="c3-rec" cx={110} cy={118} r={9} fill={C.danger} />
          <text x={128} y={126} fill={C.paper} fontFamily={MONO} fontSize={22}>
            REC
          </text>
          <text x={1490} y={126} fill={C.lime} fontFamily={MONO} fontSize={22} textAnchor="end">
            NEO · head cam · 19:42:07
          </text>
          <g className="c3-upload" opacity={0}>
            <text x={110} y={804} fill={C.lime} fontFamily={MONO} fontSize={20}>
              uploading… kept for: ?   used for: ?
            </text>
            <rect x={110} y={816} width={360} height={6} fill={C.ink3} />
            <rect className="hd-scan" x={110} y={816} width={120} height={6} fill={C.lime} />
          </g>
          <Label className="c3-lab-blur" x={1180} y={760} tx={1180} ty={760} dot={false} text="one answer: blur it on the robot, before anything leaves the house" color={C.limeLight} anchor="middle" size={24} />
        </g>
      </g>

      {/* ---------- the play: the rules ---------- */}
      <g className="c3-play" opacity={0} pointerEvents={live ? 'auto' : 'none'}>
        <Blueprint />
        <circle cx={1200} cy={500} r={500} fill="url(#cn-pool-magenta)" opacity={0.18} />
        <text className="c3-pc" x={110} y={150} fill={C.paper} fontFamily={SERIF} fontSize={34} fontWeight={600}>
          Your company’s rules
        </text>
        {RULES.map((r, i) => {
          const y = ROW_Y(i)
          const v = on[i]
          return (
            <g
              key={r.text}
              className="c3-pc"
              data-tutor={`rule ${i + 1}`}
              role="switch"
              aria-checked={v}
              tabIndex={live ? 0 : -1}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle(i)
                }
              }}
              style={{ cursor: live ? 'pointer' : 'default' }}
            >
              <rect x={90} y={y - 40} width={720} height={80} rx={14} fill={v ? C.ink3 : C.ink1} opacity={0.75} stroke={v ? C.slate : 'none'} />
              <rect x={110} y={y - 18} width={68} height={36} rx={18} fill={v ? C.lime : C.ink3} stroke={v ? C.limeLight : C.slate} strokeWidth={2} style={{ transition: 'fill 0.25s' }} />
              <circle cx={v ? 160 : 128} cy={y} r={14} fill={v ? C.ink : C.mist} style={{ transition: 'cx 0.25s' }} />
              <text x={200} y={y + (touched[i] ? -2 : 8)} fill={v ? C.paper : C.mist} fontFamily={SANS} fontSize={22} fontWeight={500}>
                {r.text}
              </text>
              {touched[i] && (
                <text x={200} y={y + 24} fill={r.trust < 0 ? C.danger : C.magentaLight} fontFamily={MONO} fontSize={15} opacity={0.85}>
                  {r.hint}
                </text>
              )}
            </g>
          )
        })}
        <g className="c3-pc">
          <Meter x={930} y={200} w={560} value={m.trust} color={C.magenta} label="customer trust" valueText={`${Math.round(m.trust * 100)}%`} mark={T_TARGET} />
          <Meter x={930} y={290} w={560} value={m.learn} color={C.lime} label="robot learning" valueText={`${Math.round(m.learn * 100)}%`} mark={L_TARGET} />
          <text x={930 + 560 * T_TARGET} y={236} fill={C.mist} fontFamily={MONO} fontSize={14} textAnchor="middle">
            target 70%
          </text>
          <text x={930 + 560 * L_TARGET} y={326} fill={C.mist} fontFamily={MONO} fontSize={14} textAnchor="middle">
            target 60%
          </text>
        </g>
        <g className="c3-pc">
          <text x={930} y={380} fill={C.fog} fontFamily={SANS} fontSize={20}>
            your customers: {m.kept} of 20 stay
          </text>
          {Array.from({ length: CUSTOMERS }, (_, i) => {
            const stay = m.stay[i]
            return (
              <g key={i} className={stay ? undefined : 'c3-cust-gone'} opacity={stay ? 1 : 0.18} style={{ transition: 'opacity 0.5s' }}>
                <g transform={`translate(${custX(i) + (stay ? 0 : 14)} ${custY(i)})`} style={{ transition: 'transform 0.5s' }}>
                  <circle cx={0} cy={-34} r={11} fill={stay ? C.magentaLight : C.slate} />
                  <path d="M-16 0 q0 -22 16 -22 q16 0 16 22 Z" fill={stay ? C.magenta : C.slate} />
                </g>
              </g>
            )
          })}
        </g>
        <g className="c3-pc">
          <text x={930} y={650} fill={C.fog} fontFamily={SANS} fontSize={20}>
            rescues needed a week, over the first year
          </text>
          <line x1={940} x2={1500} y1={850} y2={850} stroke={C.slate} strokeWidth={2} />
          <line x1={940} x2={940} y1={690} y2={850} stroke={C.slate} strokeWidth={2} />
          <text x={940} y={874} fill={C.fog} fontFamily={MONO} fontSize={14}>
            month 0
          </text>
          <text x={1492} y={874} fill={C.fog} fontFamily={MONO} fontSize={14} textAnchor="end">
            12
          </text>
          <path d={curve(m.learn)} fill="none" stroke={C.lime} strokeWidth={4} style={{ transition: 'd 0.4s' }} />
          <circle cx={1492} cy={850 - (yearEnd / 20) * 150} r={7} fill={C.lime} />
          <text x={1480} y={850 - (yearEnd / 20) * 150 - 16} fill={C.limeLight} fontFamily={MONO} fontSize={18} textAnchor="end">
            {yearEnd.toFixed(0)} a week
          </text>
        </g>
        {won && (
          <g>
            <circle cx={1210} cy={250} r={200} fill="url(#cn-pool-lime)" opacity={0.6} />
            <text x={1210} y={150} fill={C.lime} fontFamily={SANS} fontSize={24} fontWeight={600} textAnchor="middle">
              trusted, and still learning
            </text>
          </g>
        )}
      </g>

      <Vignette />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'privacy',
  title: 'The bargain',
  cues: CUES,
  Scene: Ch3Privacy,
  enter: { type: 'pan', dir: 'right' },
  deeper: [HomeRobotsReading],
}
