import gsap from 'gsap'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { DeskLamp, Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { CourseTree, HomeBot } from './props'
import { OpenQuestionsReading } from './readings'

export const CUES: Cue[] = [
  { id: 'near', say: 'So where are we, in late 2026? In some homes they’ve never seen, robots can now tidy up, load a dishwasher, wipe counters, and fold laundry, slowly, at about half human speed.' },
  { id: 'far', say: 'Harder jobs, like cooking, caring for people, or fine work with fragile things, are still far off.' },
  { id: 'questions', say: 'And the big questions are wide open. Is cheap human data enough, or does every robot need its own? Can simulation ever handle touch and cloth? How much data does a home robot need? Nobody knows.' },
  { id: 'you', say: 'Which is where you come in. Some of the most useful work needs no expensive robot: tools that spot bad demonstrations, cheap touch sensors, honest tests, or open data from homes nobody has recorded yet.' },
  { id: 'loop', say: 'Hardware and data are two halves of one problem. Better hands need better data, and better data needs hands worth teaching. You’ve now seen both.' },
  { id: 'end', say: 'Go deeper on anything that caught you. And when your brain starts looping on one of these problems, that’s the point.' },
]

const STATE = [
  'A dark street at night in late 2026, seen from across the road: a row of houses, and one by one four windows light up warm. In each, the silhouette of a soft home robot does one chore: tidying toys into a box, loading plates into a dishwasher, wiping a counter, folding a towel. They move slowly. A label reads "≈ 30-50% human speed". The point: in homes they have never seen, today\'s best robots can do simple chores, at about half human speed.',
  'The camera drifts further down the street. These windows stay dark, with only faint outlines inside: a stove with a steaming pot ("cooking"), a person in a bed being helped up ("care"), a needle and thread ("fragile, fine work"). The point: cooking, caring for people and delicate work with fragile things are still far off.',
  'The camera tilts up from the dark houses into the night sky. Three glowing lime question marks rise from the roofs like lanterns, one after another, each labelled: "human data enough?" (is cheap video of people enough, or does every robot need its own data), "can sim do touch?" (can simulation ever handle contact and cloth), "how much is enough?" (how much data a home robot needs). Nobody knows the answers yet.',
  'Ada\'s office at night. Ada, the data scientist (curly hair, glasses, teal top), is at her monitor, then swivels round in her chair toward us. Warm lamplight comes back on. Behind her, four small vignettes light up on the wall: a 3D-printed robot arm with a $300 price tag (cheap hardware), a laptop with a data-quality chart flagging bad demonstrations in red, a tiny fingertip touch sensor next to a coin, and a phone recording a kitchen in Lagos (open data from homes nobody has recorded). The point: some of the most useful work needs no expensive robot.',
  'The whole course tree in the dark: the amber trunk of hardware films (from "The Hardest Machine" up to "Build Your Own Hand") and the lime branch of data films (up to this one, "The Home Robot Frontier"), every node lit. The lime branch curls back over and touches the trunk\'s top node: hardware and data are two halves of one problem. The camera slowly rises; the tree\'s light reflects on a dark floor.',
  'The tree holds, glowing. A warm light gathers in the bottom-right corner, where Pip lives, inviting questions. Then the film fades to black. The learner can open the "Go deeper" readings on anything that caught their interest.',
]

/* ---------------- the street ---------------- */

const HX = [360, 900, 1440, 1980, 2640, 3180, 3720]
const WALLS = ['#1c2230', '#221d2a', '#1b2428', '#24201c', '#1a1f2b', '#201c26', '#1d2226']
const WIN = { w: 300, h: 220, y: 410 }
const SIL = '#2a1d14'
const FAINT = '#7d8aa3'
const LANTERNS = [
  { x: 2380, y: -150, t: 'human data enough?' },
  { x: 2900, y: -300, t: 'can sim do touch?' },
  { x: 3440, y: -130, t: 'how much is enough?' },
]

/* ---------------- the office ---------------- */

const ADA = { hair: 'curls' as const, glasses: true, top: '#2f5d62', topDark: '#1c3a3e', skin: C.skinC, skinDark: C.skinCDark }
const SEAT = { x: 640, y: 800, s: 1.2 }
const CARDS = [
  { x: 1000, y: 300, t: 'a $300 3D-printed arm' },
  { x: 1350, y: 300, t: 'spot bad demonstrations' },
  { x: 1000, y: 580, t: 'a cheap touch sensor' },
  { x: 1350, y: 580, t: 'open data: a kitchen in Lagos' },
]

/* ---------------- the tree ---------------- */

const TREE_T = 'translate(800 720) scale(0.8) translate(-800 -860)'
const TREE_R = 'translate(800 720) scale(0.8 -0.8) translate(-800 -860)'
/** The trunk's frontier node, "Build Your Own Hand", in tree coordinates. */
const TREE_FRONT = { x: 800, y: 170 }

/** A house front with one window; `lit` windows are warm, the rest stay dark. */
function House({ i, lit, children }: { i: number; lit: boolean; children?: ReactNode }) {
  const x = HX[i]
  const wx = x - WIN.w / 2
  return (
    <g>
      <path d={`M${x - 268} 256 L${x} 112 L${x + 268} 256 Z`} fill="#11141c" />
      <rect x={x - 240} y={250} width={480} height={600} fill={WALLS[i]} />
      <rect x={x - 240} y={250} width={480} height={600} fill="url(#cn-hatch)" opacity={0.25} />
      <circle cx={x} cy={196} r={22} fill="#0d1119" stroke="#2b3243" strokeWidth={5} />
      <rect x={x + 120} y={700} width={80} height={150} rx={4} fill="#121620" />
      <rect x={wx - 12} y={WIN.y - 12} width={WIN.w + 24} height={WIN.h + 24} fill="#0c1018" />
      <rect x={wx} y={WIN.y} width={WIN.w} height={WIN.h} fill="#0b111c" />
      <g clipPath={`url(#c4-win${i})`}>
        {lit && (
          <g className={`c4-lit${i}`} opacity={0}>
            <rect x={wx} y={WIN.y} width={WIN.w} height={WIN.h} fill="url(#c4-warm)" />
            <circle cx={x - 60} cy={WIN.y + 40} r={110} fill="#ffd9a0" opacity={0.25} />
          </g>
        )}
        {children}
      </g>
      <path d={`M${x} ${WIN.y} V${WIN.y + WIN.h} M${wx} ${WIN.y + 90} H${wx + WIN.w}`} stroke="#0c1018" strokeWidth={8} />
      <rect x={wx - 16} y={WIN.y + WIN.h + 6} width={WIN.w + 32} height={12} fill="#2b3243" />
      {lit && <Pool className={`c4-spill${i}`} x={x} y={WIN.y + WIN.h + 140} r={260} color="amber" opacity={0} />}
    </g>
  )
}

/** A street lamp in the foreground. */
function StreetLamp({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 7} y={360} width={14} height={540} fill="#0a0d13" />
      <path d={`M${x} 370 q0 -40 50 -40 h30`} stroke="#0a0d13" strokeWidth={12} fill="none" />
      <rect x={x + 62} y={322} width={44} height={18} rx={6} fill="#0a0d13" />
      <ellipse cx={x + 84} cy={344} rx={18} ry={5} fill={C.keyLight} opacity={0.8} />
      <Pool x={x + 84} y={360} r={150} color="key" opacity={0.35} />
    </g>
  )
}

/** The things in each wall vignette (local coordinates, card centre at 0,0). */
function CardArt({ k }: { k: number }) {
  if (k === 0)
    return (
      <g>
        {/* a 3D-printed puppet arm on a little base, with a price tag */}
        <rect x={-90} y={50} width={80} height={14} rx={4} fill={C.ink3} />
        <path d="M-50 50 L-40 -10 L30 -40" stroke={C.paper} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M-50 50 L-40 -10 L30 -40" stroke={C.amber} strokeWidth={18} strokeDasharray="3 5" strokeLinecap="round" fill="none" opacity={0.45} />
        <circle cx={-40} cy={-10} r={9} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
        <path d="M30 -40 l26 -14 M30 -40 l28 4" stroke={C.paper} strokeWidth={7} strokeLinecap="round" />
        <g transform="translate(70 30) rotate(-8)">
          <path d="M-30 -16 H26 L36 0 L26 16 H-30 Z" fill={C.goldDark} stroke={C.gold} strokeWidth={2} />
          <text x={-2} y={7} fill={C.goldLight} fontFamily={MONO} fontSize={20} textAnchor="middle">
            $300
          </text>
        </g>
      </g>
    )
  if (k === 1)
    return (
      <g>
        {/* a laptop with a data-quality chart: good demos lime, bad ones flagged red */}
        <path d="M-100 58 H100 L112 72 H-112 Z" fill={C.ink3} />
        <rect x={-92} y={-64} width={184} height={122} rx={6} fill={C.ink} stroke={C.slate} strokeWidth={3} />
        {[0.7, 0.8, 0.25, 0.75, 0.66, 0.2, 0.85, 0.72, 0.3, 0.78].map((v, i) => {
          const bad = v < 0.35
          return <rect key={i} x={-80 + i * 16.5} y={44 - v * 90} width={11} height={v * 90} fill={bad ? C.danger : C.lime} opacity={bad ? 1 : 0.8} />
        })}
        <path d="M-84 -2 H84" stroke={C.mist} strokeWidth={1.5} strokeDasharray="4 4" />
      </g>
    )
  if (k === 2)
    return (
      <g>
        {/* a tiny fingertip touch sensor, next to a coin for scale */}
        <path d="M-60 60 V-10 Q-60 -60 -10 -60 Q40 -60 40 -10 V60 Z" fill={C.ink3} stroke={C.slate} strokeWidth={3} />
        <ellipse cx={-10} cy={-14} rx={36} ry={40} fill={C.magentaDark} opacity={0.7} />
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={-31 + (i % 4) * 14} cy={-38 + Math.floor(i / 4) * 16} r={3.5} fill={C.magentaLight} />
        ))}
        <path d="M-60 60 q-10 30 -40 30" stroke={C.slate} strokeWidth={3} fill="none" />
        <circle cx={80} cy={40} r={26} fill={C.goldDark} stroke={C.gold} strokeWidth={3} />
        <circle cx={80} cy={40} r={17} fill="none" stroke={C.gold} strokeWidth={1.5} opacity={0.6} />
      </g>
    )
  return (
    <g>
      {/* a phone recording a kitchen: a two-burner stove on a gas bottle, a kettle, a mortar, louvred window */}
      <rect x={-64} y={-84} width={128} height={170} rx={14} fill={C.ink} stroke={C.slate} strokeWidth={3} />
      <g>
        <rect x={-56} y={-74} width={112} height={150} fill="#d9a466" />
        <rect x={-56} y={-74} width={112} height={150} fill="url(#cn-hatch)" opacity={0.25} />
        {[0, 1, 2, 3].map((r) => (
          <rect key={r} x={6} y={-64 + r * 12} width={40} height={6} fill="#6b4a2c" opacity={0.7} />
        ))}
        <rect x={-50} y={10} width={100} height={8} fill="#5b4636" />
        <rect x={-42} y={-6} width={44} height={16} rx={3} fill="#3a3f48" />
        <path d="M-34 -6 q8 -26 30 0 Z" fill="#9aa4ae" />
        <path d="M-6 -18 l8 -6" stroke="#9aa4ae" strokeWidth={4} />
        <rect x={-46} y={30} width={22} height={40} rx={8} fill="#2a63a8" />
        <path d="M14 52 h26 l-4 18 h-18 Z" fill="#7b5a3c" />
        <path d="M30 52 l10 -26" stroke="#5b4030" strokeWidth={5} strokeLinecap="round" />
      </g>
      <circle cx={-40} cy={-60} r={6} fill={C.danger} className="c4-rec" />
      <text x={-30} y={-55} fill={C.paper} fontFamily={MONO} fontSize={13}>
        REC
      </text>
    </g>
  )
}

export function Ch4Open({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const street = useRef<SVGGElement>(null)
  const office = useRef<SVGGElement>(null)
  const tree = useRef<SVGGElement>(null)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    const scam = camera(street.current, { x: 1170, y: 470, zoom: 0.78 })
    const ocam = camera(office.current, { x: 560, y: 560, zoom: 1.4 })
    const tcam = camera(tree.current, { x: 820, y: 560, zoom: 1.22 })
    const b0r = rig(el, 'c4-bot0', { ...POSES.stand, torso: 10, head: 10, armN: 40, elbowN: 60, armF: 30, elbowF: 50 })
    const b1r = rig(el, 'c4-bot1', { ...POSES.stand, torso: 22, head: 14, armN: 40, elbowN: 40, armF: 20, elbowF: 40 })
    const b2r = rig(el, 'c4-bot2', { ...POSES.stand, torso: 14, head: 18, armN: 66, elbowN: 18, armF: 30, elbowF: 40 })
    const b3r = rig(el, 'c4-bot3', { ...POSES.hold, head: 18 })
    const adaA = rig(el, 'c4-ada-a', { ...POSES.sitForward, armN: 58, elbowN: 70, wristN: -14, armF: 50, elbowF: 74 })
    const adaB = rig(el, 'c4-ada-b', { ...POSES.sit, torso: -2, head: -2, armN: 16, elbowN: 64, armF: 12, elbowF: 66 })

    tl.set('.c4-office, .c4-tree, .c4-black, .c4-pip', { opacity: 0 }, 0)
    tl.set('.c4-street', { opacity: 1 }, 0)

    /* b0: a dark street; four windows light up, one chore each, done slowly. */
    tl.addLabel('b0', 0)
    fade(tl, '.c4-street', 1, 0, 1.0, 0)
    scam.to(tl, { x: 1190, y: 500, zoom: 0.82 }, 0, 12.3, 'sine.inOut')
    const LIGHT = [4.8, 7.0, 8.1, 9.1]
    LIGHT.forEach((at, i) => {
      fade(tl, `.c4-lit${i}`, 1, at, 0.5)
      fade(tl, `.c4-spill${i}`, 0.7, at, 0.8)
      fade(tl, `.c4-sil${i}`, 1, at, 0.3)
    })
    // The chores, slowly, until the street is left behind.
    const END = 33
    for (let t = LIGHT[0]; t < END; t += 3.2) {
      b0r.to(tl, { torso: 34, head: 24, armN: 72, elbowN: 16 }, t, 1.6, 'sine.inOut')
      b0r.to(tl, { torso: 10, head: 10, armN: 40, elbowN: 60 }, t + 1.6, 1.6, 'sine.inOut')
    }
    tl.fromTo('.c4-toy', { y: 0, opacity: 1 }, { y: -40, opacity: 0, duration: 1.2, stagger: 3.2, immediateRender: false }, LIGHT[0] + 1.6)
    for (let t = LIGHT[1]; t < END; t += 3.6) {
      b1r.to(tl, { torso: 42, head: 26, armN: 72, elbowN: 10 }, t, 1.8, 'sine.inOut')
      b1r.to(tl, { torso: 22, head: 14, armN: 40, elbowN: 40 }, t + 1.8, 1.8, 'sine.inOut')
    }
    tl.fromTo('.c4-plate', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 3.6, immediateRender: false }, LIGHT[1] + 1.6)
    for (let t = LIGHT[2]; t < END; t += 2.4) {
      b2r.to(tl, { torso: 20, armN: 84, elbowN: 8 }, t, 1.2, 'sine.inOut')
      b2r.to(tl, { torso: 12, armN: 62, elbowN: 22 }, t + 1.2, 1.2, 'sine.inOut')
    }
    tl.fromTo('.c4-gloss', { x: -60, opacity: 0 }, { x: 60, opacity: 0.8, duration: 1.2, yoyo: true, repeat: 9, ease: 'sine.inOut', immediateRender: false }, LIGHT[2])
    for (let t = LIGHT[3]; t < END; t += 4) {
      tl.fromTo('.c4-towel', { scaleY: 1 }, { scaleY: 0.5, duration: 1.4, ease: 'sine.inOut', transformOrigin: '50% 0%', immediateRender: false }, t + 0.6)
      tl.fromTo('.c4-towel', { scaleY: 0.5 }, { scaleY: 1, duration: 0.4, ease: 'sine.out', transformOrigin: '50% 0%', immediateRender: false }, t + 3.4)
      b3r.to(tl, { head: 26, torso: 8 }, t + 0.6, 1.4, 'sine.inOut')
      b3r.to(tl, { head: 18, torso: 4 }, t + 2.6, 1.0, 'sine.inOut')
    }
    fade(tl, '.c4-lab-speed', 1, 10.4, 0.7)

    /* b1: further down the street, the windows stay dark. */
    const b1 = 12.4
    tl.addLabel('b1', b1)
    fade(tl, '.c4-lab-speed', 0, b1, 0.5, 1)
    scam.to(tl, { x: 3120, y: 490, zoom: 0.86 }, b1, 3.4, 'power2.inOut')
    fade(tl, '.c4-faint4', 0.85, b1 + 1.4, 0.9)
    fade(tl, '.c4-faint5', 0.85, b1 + 2.5, 0.9)
    fade(tl, '.c4-faint6', 0.85, b1 + 3.6, 0.9)
    fade(tl, '.c4-farlab', 1, b1 + 1.6, 0.6)
    fade(tl, '.c4-lab-far', 1, b1 + 4.6, 0.7)

    /* b2: three lime question marks rise over the roofs like lanterns. */
    const b2 = b1 + 6.5
    tl.addLabel('b2', b2)
    fade(tl, '.c4-lab-far', 0, b2, 0.5, 1)
    scam.to(tl, { x: 2900, y: 70, zoom: 0.76 }, b2, 3.6, 'power2.inOut')
    const RISE = [2.6, 7.2, 10.0]
    RISE.forEach((at, i) => {
      tl.fromTo(`.c4-lan${i}`, { y: 380, opacity: 0 }, { y: 0, opacity: 1, duration: 2.6, ease: 'power2.out', immediateRender: false }, b2 + at)
      fade(tl, `.c4-lanlab${i}`, 1, b2 + at + 1.4, 0.6)
    })
    scam.to(tl, { x: 2920, y: 40, zoom: 0.74 }, b2 + 3.7, 10, 'sine.inOut')

    /* b3: Ada turns round; the wall behind her lights up with work anyone can do. */
    const b3 = b2 + 13.8
    tl.addLabel('b3', b3)
    fade(tl, '.c4-street', 0, b3, 0.7, 1)
    fade(tl, '.c4-office', 1, b3, 0.7)
    fade(tl, '.c4-warm', 0, b3, 0.01, 0)
    fade(tl, '.c4-ada-a-g', 1, b3, 0.01, 1)
    fade(tl, '.c4-ada-b-g', 0, b3, 0.01, 0)
    adaA.to(tl, { armN: 62, elbowN: 64 }, b3 + 0.2, 0.4, 'sine.inOut')
    adaA.to(tl, { head: 0, torso: 8 }, b3 + 0.7, 0.6, 'sine.inOut')
    fade(tl, '.c4-ada-a-g', 0, b3 + 1.4, 0.3, 1)
    fade(tl, '.c4-ada-b-g', 1, b3 + 1.4, 0.3)
    adaB.to(tl, { torso: -6, head: -8, armN: 30, elbowN: 96, wristN: 20 }, b3 + 1.7, 1.2, 'power2.out')
    fade(tl, '.c4-warm', 1, b3 + 2.0, 3.0)
    fade(tl, '.c4-screenlight', 0.25, b3 + 2.0, 3.0, 1)
    ocam.to(tl, { x: 900, y: 470, zoom: 1.0 }, b3 + 2.4, 6.0, 'power2.inOut')
    const CARD_AT = [4.2, 6.0, 7.8, 9.6]
    CARD_AT.forEach((at, k) => {
      fade(tl, `.c4-card${k}`, 1, b3 + at, 0.5, 0.18)
      tl.fromTo(`.c4-cardin${k}`, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b3 + at)
      fade(tl, `.c4-cardpool${k}`, 0.8, b3 + at, 0.6)
    })
    adaB.to(tl, { head: -12 }, b3 + 6.0, 1.2, 'sine.inOut')
    adaB.to(tl, { head: -4, armN: 18, elbowN: 64, wristN: 0 }, b3 + 9.6, 1.2, 'sine.inOut')

    /* b4: the whole course tree; the data branch curls back to the trunk. */
    const b4 = b3 + 13.1
    tl.addLabel('b4', b4)
    fade(tl, '.c4-office', 0, b4, 0.8, 1)
    fade(tl, '.c4-tree', 1, b4, 0.8)
    tl.set('.c4t-curl, .c4r-curl', { strokeDashoffset: 420 }, b4)
    tl.set('.c4-flare', { opacity: 0 }, b4)
    tcam.to(tl, { x: 820, y: 430, zoom: 1.0 }, b4, 9.6, 'sine.inOut')
    tl.fromTo('.c4t-trunk, .c4r-trunk', { opacity: 0.5 }, { opacity: 1, duration: 0.5, yoyo: true, repeat: 1, immediateRender: false }, b4 + 0.4)
    tl.fromTo('.c4t-branch, .c4r-branch', { opacity: 0.5 }, { opacity: 1, duration: 0.5, yoyo: true, repeat: 1, immediateRender: false }, b4 + 1.6)
    tl.fromTo('.c4t-curl, .c4r-curl', { strokeDashoffset: 420 }, { strokeDashoffset: 0, duration: 2.6, ease: 'power1.inOut', immediateRender: false }, b4 + 4.0)
    tl.fromTo('.c4-flare', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out', immediateRender: false }, b4 + 6.5)
    tl.fromTo('.c4-flarering', { attr: { r: 12 } }, { attr: { r: 34 }, duration: 0.9, ease: 'power2.out', immediateRender: false }, b4 + 6.5)

    /* b5: the tree holds; Pip's corner glows; fade. */
    const b5 = b4 + 9.6
    tl.addLabel('b5', b5)
    tcam.to(tl, { x: 820, y: 410, zoom: 0.97 }, b5, 8.1, 'sine.inOut')
    fade(tl, '.c4-pip', 1, b5 + 2.4, 1.6)
    letterbox(tl, '.c4-lb', true, b5 + 1.0, 72, 2.0)
    fade(tl, '.c4-black', 1, b5 + 6.4, 1.7, 0)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c4-bob', { y: -14, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.7 })
    gsap.to('.c4-langlow', { opacity: 0.55, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.5 })
    gsap.to('.c4-rec', { opacity: 0.2, duration: 0.6, yoyo: true, repeat: -1, ease: 'steps(1)' })
    gsap.to('.c4-steam', { y: -12, opacity: 0.2, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c4-pipglow', { opacity: 0.45, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c4-node-glow', { opacity: 0.5, duration: 2.0, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      <defs>
        <linearGradient id="c4-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c27a" />
          <stop offset="1" stopColor="#c46a2c" />
        </linearGradient>
        {HX.map((x, i) => (
          <clipPath key={i} id={`c4-win${i}`}>
            <rect x={x - WIN.w / 2} y={WIN.y} width={WIN.w} height={WIN.h} />
          </clipPath>
        ))}
        <linearGradient id="c4-floorfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="0.6" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id="c4-reflmask">
          <rect x={-400} y={720} width={2400} height={400} fill="url(#c4-floorfade)" />
        </mask>
      </defs>

      {/* ---------- b0-b2: the street at night ---------- */}
      <g className="c4-street" ref={street} pointerEvents="none">
        <g data-depth="0.15">
          <rect x={-1600} y={-1800} width={7600} height={3200} fill="url(#cn-sky-night)" />
          <rect x={-1600} y={-1800} width={7600} height={3200} fill={C.ink} opacity={0.35} />
          <Dust x={-600} y={-700} w={4200} h={1100} count={90} seed={14} color={C.paper} />
          <circle cx={1700} cy={-260} r={46} fill={C.paper} opacity={0.85} />
          <Pool x={1700} y={-260} r={260} color="paper" opacity={0.25} />
        </g>
        <g data-depth="0.45">
          <path d="M-1400 420 V330 h180 v-60 h140 v90 h120 v-140 h90 v140 h220 v-40 h160 v70 h200 v-110 h120 v110 h260 v-50 h180 v80 h140 v-160 h100 v160 h240 v-60 h200 v90 h160 v-120 h120 v120 h300 v-40 h200 v60 h300 V900 H-1400 Z" fill="#121826" />
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={-1300 + i * 150 + ((i * 37) % 60)} y={300 + ((i * 53) % 80)} width={10} height={14} fill="#e9b76e" opacity={i % 3 === 0 ? 0.5 : 0.15} />
          ))}
        </g>
        <g data-depth="1">
          <rect x={-1600} y={846} width={7600} height={400} fill="#0d1118" />
          <rect x={-1600} y={846} width={7600} height={6} fill="#1b2230" />

          {/* lit windows: the near chores */}
          <House i={0} lit>
            <g className="c4-sil0" opacity={0}>
              <HomeBot name="c4-bot0" x={HX[0] - 50} y={700} s={0.7} light="none" silhouette={SIL} />
              <rect x={HX[0] + 70} y={590} width={74} height={44} rx={4} fill={SIL} />
              {[0, 1, 2].map((k) => (
                <rect key={k} className="c4-toy" x={HX[0] + 6 + k * 18} y={618} width={12} height={12} rx={2} fill={SIL} />
              ))}
            </g>
          </House>
          <House i={1} lit>
            <g className="c4-sil1" opacity={0}>
              <HomeBot name="c4-bot1" x={HX[1] + 70} y={700} s={0.7} flip light="none" silhouette={SIL} />
              <rect x={HX[1] - 150} y={540} width={120} height={100} fill={SIL} />
              <path d={`M${HX[1] - 30} 630 L${HX[1] + 40} 640 L${HX[1] + 40} 630`} fill={SIL} stroke={SIL} strokeWidth={6} />
              <path d={`M${HX[1] - 140} 580 h100`} stroke="#7a5236" strokeWidth={3} />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <ellipse key={k} className="c4-plate" cx={HX[1] - 130 + k * 16} cy={566} rx={4} ry={16} fill={SIL} opacity={0} />
              ))}
            </g>
          </House>
          <House i={2} lit>
            <g className="c4-sil2" opacity={0}>
              <rect x={HX[2] - 10} y={565} width={170} height={80} fill={SIL} />
              <rect x={HX[2] - 16} y={558} width={182} height={10} fill={SIL} />
              <rect className="c4-gloss" x={HX[2] + 50} y={556} width={50} height={4} fill="#ffe2b0" opacity={0} />
              <HomeBot name="c4-bot2" x={HX[2] - 70} y={700} s={0.7} light="none" silhouette={SIL} />
            </g>
          </House>
          <House i={3} lit>
            <g className="c4-sil3" opacity={0}>
              <rect x={HX[3] + 40} y={600} width={110} height={40} rx={8} fill={SIL} />
              <HomeBot name="c4-bot3" x={HX[3] - 60} y={700} s={0.7} light="none" silhouette={SIL} />
              <rect className="c4-towel" x={HX[3] - 26} y={548} width={52} height={50} rx={3} fill="#3a2a1d" />
            </g>
          </House>

          {/* dark windows: the far jobs, only faint outlines */}
          <House i={4} lit={false}>
            <g className="c4-faint4" opacity={0} fill="none" stroke={FAINT} strokeWidth={3} strokeDasharray="6 5">
              <rect x={HX[4] - 90} y={540} width={180} height={100} />
              <path d={`M${HX[4] - 70} 540 h50 M${HX[4] + 20} 540 h50`} />
              <path d={`M${HX[4] - 64} 540 v-30 h60 v30`} />
              <path className="c4-steam" d={`M${HX[4] - 44} 500 q-10 -20 0 -40 M${HX[4] - 24} 500 q10 -20 0 -40`} />
            </g>
          </House>
          <House i={5} lit={false}>
            <g className="c4-faint5" opacity={0} fill="none" stroke={FAINT} strokeWidth={3} strokeDasharray="6 5">
              <path d={`M${HX[5] - 140} 600 h200 v-24 h-200 Z M${HX[5] - 140} 576 v-40 M${HX[5] - 140} 600 v40 M${HX[5] + 60} 600 v40`} />
              <circle cx={HX[5] - 110} cy={556} r={14} />
              <path d={`M${HX[5] - 96} 566 q40 -20 90 -6`} />
              <circle cx={HX[5] + 90} cy={470} r={16} />
              <path d={`M${HX[5] + 90} 486 v80 M${HX[5] + 86} 500 q-40 30 -80 50`} />
            </g>
          </House>
          <House i={6} lit={false}>
            <g className="c4-faint6" opacity={0} fill="none" stroke={FAINT} strokeWidth={3}>
              <path d={`M${HX[6] - 80} 560 L${HX[6] + 70} 470`} strokeWidth={4} />
              <ellipse cx={HX[6] + 58} cy={478} rx={8} ry={4} transform={`rotate(-31 ${HX[6] + 58} 478)`} />
              <path d={`M${HX[6] + 64} 474 q60 -10 40 60 q-20 60 -120 70`} strokeDasharray="6 5" />
              <path d={`M${HX[6] - 120} 600 q30 -20 60 0 q30 20 60 0`} strokeDasharray="6 5" />
            </g>
          </House>
          <g className="c4-farlab" opacity={0}>
            {['cooking', 'care', 'fragile, fine work'].map((t, k) => (
              <text key={t} x={HX[4 + k]} y={694} fill={C.mist} fontFamily={MONO} fontSize={24} textAnchor="middle">
                {t}
              </text>
            ))}
          </g>

          <Label className="c4-lab-speed" x={HX[2]} y={410} tx={HX[2] - 220} ty={330} text="≈ 30-50% human speed" sub="slow, but in homes they’ve never seen" color={C.limeLight} size={34} />
          <Label className="c4-lab-far" x={HX[5]} y={400} tx={HX[5] + 30} ty={330} text="still far off" color={C.fog} size={34} dot={false} />

          {/* the lanterns */}
          {LANTERNS.map((l, i) => (
            <g key={l.t} className={`c4-lan${i}`} opacity={0}>
              <g className="c4-bob">
                <Pool className="c4-langlow" x={l.x} y={l.y - 30} r={170} color="lime" opacity={0.9} />
                <text x={l.x} y={l.y} fill={C.lime} fontFamily={SERIF} fontSize={140} fontWeight={600} textAnchor="middle" filter="url(#cn-bloom)">
                  ?
                </text>
                <text className={`c4-lanlab${i}`} opacity={0} x={l.x} y={l.y + 70} fill={C.limeLight} fontFamily={SANS} fontSize={40} fontWeight={500} textAnchor="middle" style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6} strokeOpacity={0.5}>
                  {l.t}
                </text>
              </g>
            </g>
          ))}
        </g>
        <g data-depth="1">
          <StreetLamp x={1150} />
          <StreetLamp x={2290} />
          <StreetLamp x={3430} />
        </g>
        <g data-depth="1.35">
          <path d="M-1600 900 V880 Q-400 860 800 878 T3200 872 T6000 880 V900 Z" fill="#06080c" />
        </g>
      </g>

      {/* ---------- b3: Ada turns round ---------- */}
      <g className="c4-office" ref={office} opacity={0} pointerEvents="none">
        <g data-depth="0.6">
          <rect x={-400} y={-300} width={2400} height={1500} fill="url(#cn-wall)" />
          <rect x={-400} y={-300} width={2400} height={1500} fill={C.ink} opacity={0.35} />
          {CARDS.map((c, k) => (
            <g key={k}>
              <Pool className={`c4-cardpool${k}`} x={c.x} y={c.y} r={240} color="amber" opacity={0} />
              <g className={`c4-card${k}`} opacity={0.18}>
                <g className={`c4-cardin${k}`}>
                  <rect x={c.x - 150} y={c.y - 104} width={300} height={208} rx={12} fill={C.ink1} stroke={C.slate} strokeWidth={3} />
                  <circle cx={c.x} cy={c.y - 116} r={7} fill={C.amberDark} />
                  <g transform={`translate(${c.x} ${c.y})`}>
                    <CardArt k={k} />
                  </g>
                  <text x={c.x} y={c.y + 140} fill={C.paper} fontFamily={SANS} fontSize={24} fontWeight={500} textAnchor="middle">
                    {c.t}
                  </text>
                </g>
              </g>
            </g>
          ))}
        </g>
        <g data-depth="1">
          <rect x={-400} y={800} width={2400} height={400} fill="url(#cn-floor)" />
          <Pool className="c4-screenlight" x={275} y={500} r={360} color="cyan" opacity={1} />
          <g className="c4-warm" opacity={0}>
            <Pool x={420} y={560} r={520} color="amber" opacity={0.9} />
            <Pool x={900} y={420} r={800} color="amber" opacity={0.35} />
          </g>
          {/* the desk and the monitor (Ada's back is to it, after she turns) */}
          <rect x={110} y={640} width={420} height={18} fill={C.ink2} />
          <rect x={130} y={658} width={14} height={150} fill={C.ink2} />
          <rect x={490} y={658} width={14} height={150} fill={C.ink2} />
          <rect x={150} y={430} width={250} height={160} rx={8} fill={C.ink} stroke={C.ink3} strokeWidth={6} />
          <rect x={162} y={442} width={226} height={136} fill="#0e2a2c" />
          {[40, 70, 56, 20, 88, 64, 30, 76].map((h, i) => (
            <rect key={i} x={176 + i * 26} y={560 - h} width={16} height={h} fill={h < 35 ? C.danger : C.lime} opacity={0.8} />
          ))}
          <rect x={262} y={590} width={30} height={50} fill={C.ink3} />
          <DeskLamp x={520} y={640} s={0.8} light={false} />
          <g className="c4-warm" opacity={0}>
            <ellipse cx={424} cy={472} rx={36} ry={7} fill={C.keyLight} transform="rotate(28 424 472)" />
            <Pool x={424} y={500} r={160} color="amber" opacity={1} />
          </g>
          {/* the chair */}
          <g transform={`translate(${SEAT.x} ${SEAT.y}) scale(${SEAT.s})`}>
            <rect x={-46} y={-96} width={70} height={12} rx={4} fill={C.ink2} />
            <rect x={-14} y={-84} width={8} height={70} fill={C.ink2} />
            <path d="M-50 -10 L36 -10" stroke={C.ink2} strokeWidth={8} strokeLinecap="round" />
          </g>
          <g className="c4-ada-a-g">
            <g transform={`translate(${SEAT.x} ${SEAT.y}) scale(${SEAT.s})`}>
              <rect x={30} y={-210} width={14} height={124} rx={6} fill={C.ink2} />
            </g>
            <Person name="c4-ada-a" x={SEAT.x} y={SEAT.y} s={SEAT.s} flip pose={POSES.sitForward} light="screen" {...ADA} />
          </g>
          <g className="c4-ada-b-g" opacity={0}>
            <g transform={`translate(${SEAT.x} ${SEAT.y}) scale(${SEAT.s})`}>
              <rect x={-58} y={-210} width={14} height={124} rx={6} fill={C.ink2} />
            </g>
            <Person name="c4-ada-b" x={SEAT.x} y={SEAT.y} s={SEAT.s} pose={{ ...POSES.sit, torso: -2, head: -2, armN: 16, elbowN: 64, armF: 12, elbowF: 66 }} light="key-left" {...ADA} />
          </g>
        </g>
        <g data-depth="1.3">
          <Dust x={0} y={100} w={1600} h={700} count={22} seed={33} color={C.amberLight} />
        </g>
      </g>

      {/* ---------- b4-b5: the course tree, both halves ---------- */}
      <g className="c4-tree" ref={tree} opacity={0} pointerEvents="none">
        <g data-depth="0.3">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <Dust x={-200} y={-200} w={2000} h={900} count={40} seed={8} color={C.paper} />
        </g>
        <g data-depth="1">
          <rect x={-800} y={720} width={3200} height={600} fill="#07090d" />
          <path d="M-800 720 H2400" stroke="#1b2230" strokeWidth={2} />
          <g mask="url(#c4-reflmask)" opacity={0.85} filter="url(#cn-dof-2)">
            <g transform={TREE_R}>
              <CourseTree p="c4r" />
            </g>
          </g>
          <g transform={TREE_T}>
            <CourseTree p="c4t" />
            <g className="c4-flare" opacity={0}>
              <Pool x={TREE_FRONT.x} y={TREE_FRONT.y} r={160} color="lime" opacity={0.9} />
              <Pool className="c4-node-glow" x={TREE_FRONT.x} y={TREE_FRONT.y} r={110} color="amber" opacity={1} />
              <circle className="c4-flarering" cx={TREE_FRONT.x} cy={TREE_FRONT.y} r={34} fill="none" stroke={C.limeLight} strokeWidth={3} />
            </g>
          </g>
        </g>
      </g>

      <rect className="c4-black" x={-200} y={-200} width={2000} height={1300} fill="#000" opacity={0} pointerEvents="none" />
      <Vignette />
      {/* Pip lives in the bottom-right corner: a warm glow there at the very end */}
      <g className="c4-pip" opacity={0} pointerEvents="none">
        <Pool className="c4-pipglow" x={1560} y={880} r={420} color="key" opacity={1} />
        <Pool x={1560} y={880} r={200} color="paper" opacity={0.6} />
      </g>
      <Letterbox className="c4-lb" />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'open',
  title: 'The open questions',
  cues: CUES,
  Scene: Ch4Open,
  deeper: [OpenQuestionsReading],
}
