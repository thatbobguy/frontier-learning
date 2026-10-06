import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore, type FingerName } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Big, Blueprint, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { JarPlay, HIDDEN, type JarResult } from './JarPlay'
import { AdaAtDesk, AdaFace, ChoreTile, CourseTree, DgDefs, EmptyActions, HandClip, Office, TREE_NODES, counter, type Chore } from './parts'
import { PolicyReading } from './readings'

export const CUES: Cue[] = [
  { id: 'ada', say: 'Welcome to the data branch. This is Ada. She doesn’t build hands. She teaches them.' },
  { id: 'policy', say: 'A robot’s brain is called a policy. Many times a second, it looks at the world, and decides what every joint should do next.' },
  { id: 'pairs', say: 'To learn it by example, you need pairs: what the robot saw, and exactly what it did. Millions of them.' },
  { id: 'llm', say: 'Language models had it easy. People had already written trillions of words. And in text, the next word is both the question and the answer.' },
  { id: 'video', say: 'Robots have no such library. The internet is full of videos of people cooking and folding clothes. But a video only records pixels. It never records the forces, or the muscle commands.' },
  { id: 'label', say: 'Here’s a video of a hand opening a jar. Try to write down what each finger did, from the pixels alone.', play: true },
]

const STATE = [
  'The course tree: the amber trunk of films about how hands work, and a glowing lime branch splitting off after the first film. The camera follows the lime branch into its first node, "The Missing Internet", and cuts into a dark office at night: three monitors scrolling clips of a robot hand, rain on the window. Ada, the data scientist (curly hair, glasses, teal top), sits at the desk. Then a close-up of her face in profile, lit cool by the screens, a lime glint in her eye. She does not build hands; she trains their brains.',
  'A robot policy, shown on a real reach. Seven, the lab humanoid, reaches for a mug on a small table. A camera view of the mug (top left, labelled "observation") and a column of joint readings flow along lime dotted lines into a glowing lime box labelled "policy". Out of it come joint targets (index 42°, middle 44° and so on) that drive a big robot hand on the right closing around a mug. A counter above the box ticks fifty decisions every second. Then everything dims and the picture strips down to three words: observation → policy → action.',
  'A filmstrip of camera frames slides left to right: frame by frame a robot hand approaches and grips a mug. Under each frame is a column of lime joint numbers, what the robot did at that instant. Each frame and its numbers light up together as a linked pair. The strip speeds up into a motion blur, and the words "millions of pairs" appear. Point: imitation learning needs paired observation and action data.',
  'A vast dark library: shelves of glowing text stretching to a vanishing point, the camera drifting toward it. A label reads "~15 to 36 trillion tokens" (Llama 3 and Qwen3 training text). The sentence "the cat sat on the ___" appears; the blank fills with a lime "mat". A bracket marks the words before it as the question (the input) and "mat" as the answer (the label). Point: in text, the next word is a free label; nobody had to annotate anything.',
  'A wall of warm, softly lit video tiles of hands doing chores (stirring, folding, chopping, pouring, wiping, opening jars), each hand bobbing. Under every tile the "action" row is empty: dashed lime lines and question marks. Labels: the video records pixels; it never records forces or muscle commands. Point: internet video has no action labels.',
]

/* ---------- the policy shot ---------- */
const SEVEN = { x: 300, y: 830, s: 1.25 }
const MUG = { x: 1320, y: 730 }
const BOX = { x: 680, y: 236, w: 260, h: 120 }
const INSET = { x: 60, y: 70, w: 320, h: 190 }

/* ---------- the filmstrip ---------- */
const FRAMES = 18
const FW = 200
const FGAP = 26
const STRIP_Y = 290

const TILE_CHORES: Chore[] = ['stir', 'fold', 'chop', 'pour', 'wipe', 'jar', 'wash', 'peel']
const WALL = { cols: 6, rows: 3, x: -90, y: 70, w: 270, h: 168, gx: 24, gy: 96 }

/** A tiny frame of the reach: the hand comes down and closes on a mug, step k of FRAMES. */
function ReachFrame({ x, k }: { x: number; k: number }) {
  const t = k / (FRAMES - 1)
  const down = Math.min(1, t * 1.6)
  const close = Math.max(0, (t - 0.55) / 0.45)
  const lift = Math.max(0, (t - 0.8) / 0.2)
  const hy = STRIP_Y + 8 + down * 46 - lift * 26
  return (
    <g>
      <rect x={x} y={STRIP_Y} width={FW} height={130} fill="#0e2027" />
      <rect x={x} y={STRIP_Y + 98} width={FW} height={32} fill="#173440" />
      <g transform={`translate(0 ${-lift * 26})`}>
        <rect x={x + 80} y={STRIP_Y + 74} width={40} height={42} rx={5} fill={C.shellMid} opacity={0.75} />
        <path d={`M${x + 120} ${STRIP_Y + 82} q14 4 0 22`} stroke={C.shellMid} strokeWidth={5} fill="none" opacity={0.75} />
      </g>
      <g fill={C.shell}>
        <rect x={x + 88} y={STRIP_Y - 10} width={24} height={hy - STRIP_Y + 12} rx={5} />
        <rect x={x + 82} y={hy} width={36} height={22} rx={6} />
        <rect x={x + 76 + close * 6} y={hy + 16} width={9} height={30 - close * 6} rx={4} transform={`rotate(${-12 + close * 22} ${x + 80} ${hy + 18})`} />
        <rect x={x + 115 - close * 6} y={hy + 16} width={9} height={30 - close * 6} rx={4} transform={`rotate(${12 - close * 22} ${x + 120} ${hy + 18})`} />
      </g>
    </g>
  )
}

/** Joint numbers for frame k: they drift smoothly through the reach. */
const jointRow = (k: number) => {
  const t = k / (FRAMES - 1)
  return [
    ['sh', 12 + t * 30],
    ['el', 88 - t * 40],
    ['wr', -6 + t * 14],
    ['ix', t > 0.55 ? 10 + (t - 0.55) * 90 : 4],
    ['th', t > 0.55 ? 8 + (t - 0.55) * 80 : 2],
  ] as [string, number][]
}

/* ---------- the library ---------- */
const VP = { x: 800, y: 380 }

export function Ch1Policy({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const treeRef = useRef<SVGGElement>(null)
  const officeRef = useRef<SVGGElement>(null)
  const faceRef = useRef<SVGGElement>(null)
  const polRef = useRef<SVGGElement>(null)
  const libRef = useRef<SVGGElement>(null)
  const wallRef = useRef<SVGGElement>(null)
  const grab = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 1.6 } })

  const [painted, setPainted] = useState<FingerName[]>([])
  const [result, setResult] = useState<JarResult | null>(null)
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const treeCam = camera(treeRef.current, { x: 800, y: 470, zoom: 1 })
      const offCam = camera(officeRef.current, { x: 800, y: 450, zoom: 1 })
      const faceCam = camera(faceRef.current, { x: 800, y: 450, zoom: 1.04 })
      const polCam = camera(polRef.current, { x: 800, y: 450, zoom: 1 })
      const libCam = camera(libRef.current, { x: 800, y: 450, zoom: 1 })
      const wallCam = camera(wallRef.current, { x: 410, y: 270, zoom: 2.4 })
      const ada = rig(el, 'c1-ada', POSES.sitForward)
      const seven = rig(el, 'c1-seven', POSES.stand)
      const shots = ['.c1-tree', '.c1-office', '.c1-face', '.c1-pol', '.c1-strip', '.c1-lib', '.c1-wall', '.c1-jar']
      const cut = (show: string, at: number) => {
        for (const s of shots) tl.set(s, { opacity: s === show ? 1 : 0 }, at)
      }

      /* b0: the lime branch, into Ada's office, her face in the screen light. */
      tl.addLabel('b0', 0)
      cut('.c1-tree', 0)
      tl.fromTo('.c1-tree .ct-branch', { strokeDasharray: 1400, strokeDashoffset: 1400 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', immediateRender: false }, 0)
      const n0 = TREE_NODES[0]
      treeCam.to(tl, { x: n0.x, y: n0.y, zoom: 1.7 }, 0.7, 1.4, 'power2.inOut')
      treeCam.to(tl, { zoom: 9 }, 2.0, 0.7, 'power3.in')
      fade(tl, '.c1-flash', 1, 2.3, 0.3)
      cut('.c1-office', 2.6)
      fade(tl, '.c1-flash', 0, 2.6, 0.6, 1)
      offCam.to(tl, { x: 980, y: 520, zoom: 1.32 }, 2.6, 3.0, 'sine.inOut')
      ada.to(tl, { ...POSES.sitForward, head: 14, torso: 22 }, 3.0, 1.2)
      ada.to(tl, { ...POSES.sitForward, head: 8, torso: 18, armN: 60 }, 4.3, 1.0)
      fade(tl, '.c1-adalab', 1, 3.6, 0.6)
      cut('.c1-face', 5.6)
      faceCam.to(tl, { x: 760, y: 430, zoom: 1.14 }, 5.6, 3.0, 'sine.inOut')
      fade(tl, '.c1-facelab', 1, 6.4, 0.8)

      /* b1: a policy, on a real reach: observation in, joint targets out, fifty times a second. */
      const b1 = 8.6
      tl.addLabel('b1', b1)
      cut('.c1-pol', b1)
      polCam.to(tl, { x: 800, y: 470, zoom: 1.04 }, b1, 9, 'sine.inOut')
      seven.to(tl, { ...POSES.reach, armN: 70, elbowN: 26 }, b1 + 0.2, 1.6)
      seven.to(tl, { ...POSES.reach, armN: 80, elbowN: 12, torso: 14 }, b1 + 1.8, 2.4, 'sine.inOut')
      fade(tl, '.c1-inset', 1, b1 + 0.6, 0.6)
      fade(tl, '.c1-readout', 1, b1 + 1.0, 0.6)
      tl.fromTo('.c1-inflow', { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', immediateRender: false }, b1 + 1.4)
      fade(tl, '.c1-box', 1, b1 + 2.2, 0.5)
      tl.fromTo('.c1-box', { scale: 0.7, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.6, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b1 + 2.2)
      fade(tl, '.c1-clock', 1, b1 + 2.6, 0.5)
      counter(tl, el, '.c1-tick', 0, 400, b1 + 2.6, 8, (v) => String(Math.floor(v)).padStart(4, '0'), 'none')
      tl.fromTo('.c1-outflow', { strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', immediateRender: false }, b1 + 3.2)
      fade(tl, '.c1-targets', 1, b1 + 3.6, 0.6)
      tl.fromTo('.c1-grabhand', { y: -220 }, { y: 0, duration: 1.6, ease: 'power2.out', immediateRender: false }, b1 + 3.0)
      grab.to(tl, { pose: { ...GRASPS.power, wrist: [4, 0] }, touch: { thumb: 0.5, index: 0.5, middle: 0.4 } }, b1 + 4.4, 1.2)
      fade(tl, '.c1-strip-down', 0.12, b1 + 6.6, 0.9, 1)
      fade(tl, '.c1-words', 1, b1 + 7.0, 0.8)

      /* b2: the filmstrip of pairs, sliding by, then blurring into millions. */
      const b2 = b1 + 9.6
      tl.addLabel('b2', b2)
      cut('.c1-strip', b2)
      tl.fromTo('.c1-film', { x: 120 }, { x: -1500, duration: 6.2, ease: 'power1.in', immediateRender: false }, b2)
      for (let k = 0; k < FRAMES; k++) {
        tl.fromTo(`.c1-pair-${k}`, { opacity: 0 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 1, immediateRender: false }, b2 + 0.8 + k * 0.32)
      }
      fade(tl, '.c1-pairlab', 1, b2 + 0.9, 0.5)
      fade(tl, '.c1-pairlab', 0, b2 + 4.5, 0.4, 1)
      fade(tl, '.c1-filmblur', 1, b2 + 4.6, 1.2)
      fade(tl, '.c1-filmsharp', 0.15, b2 + 4.6, 1.2, 1)
      tl.fromTo('.c1-filmblur', { x: 0 }, { x: -900, duration: 4, ease: 'none', immediateRender: false }, b2 + 4.6)
      fade(tl, '.c1-millions', 1, b2 + 5.4, 0.8)
      tl.fromTo('.c1-millions', { scale: 0.85, transformOrigin: '50% 50%' }, { scale: 1, duration: 3, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, b2 + 5.4)

      /* b3: the library of text. The next word is the question and the answer. */
      const b3 = b2 + 8.8
      tl.addLabel('b3', b3)
      cut('.c1-lib', b3)
      libCam.to(tl, { x: VP.x, y: VP.y + 40, zoom: 1.5 }, b3, 11, 'sine.inOut')
      fade(tl, '.c1-tokens', 1, b3 + 2.4, 0.8)
      fade(tl, '.c1-sentence', 1, b3 + 4.4, 0.6)
      tl.fromTo('.c1-mat', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, b3 + 6.4)
      fade(tl, '.c1-blank', 0, b3 + 6.4, 0.3, 1)
      fade(tl, '.c1-qa', 1, b3 + 7.6, 0.7)

      /* b4: the wall of videos, and the empty action rows. */
      const b4 = b3 + 10.8
      tl.addLabel('b4', b4)
      cut('.c1-wall', b4)
      wallCam.to(tl, { x: 800, y: 470, zoom: 0.98 }, b4, 4.4, 'power2.inOut')
      tl.fromTo('.c1-act', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.08, immediateRender: false }, b4 + 5.6)
      wallCam.to(tl, { x: 560, y: 380, zoom: 1.5 }, b4 + 7.4, 3.2, 'power2.inOut')
      fade(tl, '.c1-lab-pix', 1, b4 + 8.2, 0.6)
      fade(tl, '.c1-lab-force', 1, b4 + 10.4, 0.6)
      fade(tl, '.c1-lab-cmd', 1, b4 + 11.4, 0.6)
      wallCam.to(tl, { x: 600, y: 400, zoom: 1.58 }, b4 + 10.6, 4, 'sine.inOut')

      /* b5: the jar. The learner labels the forces. */
      const b5 = b4 + 14.8
      tl.addLabel('b5', b5)
      cut('.c1-jar', b5)
      tl.fromTo('.c1-jarin', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, b5)
      tl.to({}, { duration: 2.4 }, b5 + 0.4)
    },
    [grab],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c1-breathe', { opacity: 0.55, duration: 2.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-boxglow', { opacity: 1, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-shelfglow', { opacity: 0.75, duration: 3.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 5) {
      reportState(
        'The learner’s turn. Top: a looping, warm-lit clip of a human hand gripping a jar from above and twisting the lid; the palm hides the thumb and the ring finger. At the moment the lid breaks free there is a little pop and the twist speeds up. Below: five force tracks (thumb, index, middle, ring, little) with a playhead in step with the clip. The learner drags in a track to paint how hard that finger pushes over time; after at least two tracks a "reveal truth" button lets them see the true forces from the simulation that rendered the clip. ' +
          `Tracks painted so far: ${painted.length ? painted.join(', ') : 'none'}. ` +
          (result
            ? `Revealed. Their label was off by ${result.off}% overall (thumb ${result.perFinger.thumb}%, index ${result.perFinger.index}%, middle ${result.perFinger.middle}%, ring ${result.perFinger.ring}%, little ${result.perFinger.little}%). `
            : '') +
          'The truth: every finger ramps up its squeeze, strains, spikes sharply at the instant the lid breaks free (halfway through the clip), then relaxes to a light grip while spinning the lid off. The hidden thumb pushes hardest of all; the little finger least. There is no single right painting: the point is that forces are invisible in pixels, so even a careful human labeller gets them badly wrong. Likely mix-ups: painting force where the fingers move the most (motion is not force), leaving the hidden thumb and ring at zero, missing the spike at the break.',
      )
      setHints(['Which fingers can you even see?', 'When does the lid break free? The squeeze peaks there.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, painted, result, reportState, setHints])

  const onPaint = useCallback(
    (p: FingerName[]) => {
      setPainted(p)
      if (p.length) emit({ type: 'progress', detail: `painted force tracks: ${p.join(', ')}` })
    },
    [emit],
  )

  const onReveal = (r: JarResult) => {
    if (result) return
    setResult(r)
    memory.dgJarOff = r.off
    emit({ type: 'attempt', correct: true, detail: `revealed the true forces; their label was off by ${r.off}%` })
    void say('Even a person watching closely can’t see the forces. That’s the missing label, and it’s why robot data has to be made, not found.')
    window.setTimeout(() => playDoneRef.current(), 2600)
  }

  /* ---------------- The picture ---------------- */
  const books = (side: -1 | 1) => {
    const out: React.ReactNode[] = []
    for (let row = 0; row < 7; row++) {
      for (let k = 0; k < 26; k++) {
        const d0 = Math.pow(0.86, k)
        const d1 = Math.pow(0.86, k + 0.82)
        const xa = VP.x + side * 1100 * d0
        const xb = VP.x + side * 1100 * d1
        const ya = VP.y + (-560 + row * 150) * d0
        const yb = VP.y + (-560 + row * 150) * d1
        const ha = 112 * d0
        const hb = 112 * d1
        const light = (row * 7 + k * 13) % 5
        out.push(<path key={`${row}-${k}`} d={`M${xa} ${ya} L${xb} ${yb} L${xb} ${yb + hb} L${xa} ${ya + ha} Z`} fill={light === 0 ? C.keyLight : light === 1 ? C.key : C.ink3} opacity={light < 2 ? 0.55 * d0 + 0.08 : 0.9} />)
        if (light >= 2)
          for (let ln = 0; ln < 4; ln++) {
            const f = 0.2 + ln * 0.18
            out.push(<path key={`${row}-${k}-${ln}`} d={`M${xa} ${ya + ha * f} L${xb} ${yb + hb * f}`} stroke={C.keyLight} strokeWidth={Math.max(0.6, 3 * d0)} opacity={0.4} />)
          }
      }
    }
    return out
  }

  return (
    <g ref={root}>
      <DgDefs />

      {/* ---------- b0: the course tree ---------- */}
      <g className="c1-tree" ref={treeRef}>
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          <CourseTree p="ct" here={0} />
          <Dust x={-200} y={0} w={2000} h={900} count={30} seed={3} color={C.lime} size={0.7} />
        </g>
      </g>

      {/* ---------- b0: Ada's office ---------- */}
      <g className="c1-office" ref={officeRef} opacity={0}>
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
        </g>
        <g data-depth="1">
          <Office p="c1o" />
          <AdaAtDesk name="c1-ada" x={760} y={800} s={1.3} pose={POSES.sitForward} />
          <Label className="c1-adalab" x={812} y={480} tx={640} ty={330} text="Ada" sub="data scientist" color={C.limeLight} />
        </g>
        <g data-depth="1.6">
          <rect x={1560} y={-200} width={80} height={1300} fill={C.ink} filter="url(#cn-dof-3)" />
        </g>
      </g>

      {/* ---------- b0: Ada's face in the screen light ---------- */}
      <g className="c1-face" ref={faceRef} opacity={0}>
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <Pool x={1300} y={420} r={900} color="rim" opacity={0.5} />
          <Pool x={1100} y={520} r={500} color="lime" opacity={0.35} />
        </g>
        <g data-depth="1">
          <g className="c1-breathe" opacity={0.85}>
            <Pool x={900} y={420} r={420} color="rim" opacity={0.45} />
          </g>
          <AdaFace x={190} y={150} s={1.25} />
        </g>
        <g data-depth="1.3">
          {/* the monitor, out of focus at the right edge, clips scrolling past */}
          <g filter="url(#cn-dof-1)">
            <rect x={1090} y={60} width={620} height={660} rx={10} fill={C.ink} />
            <clipPath id="c1-faceclip">
              <rect x={1110} y={80} width={600} height={620} />
            </clipPath>
            <g clipPath="url(#c1-faceclip)">
              <rect x={1110} y={80} width={600} height={620} fill="#081416" />
              <g className="dg-scroll">
                {Array.from({ length: 7 }, (_, k) => (
                  <HandClip key={k} x={1124} y={90 + k * 192} w={440} h={176} seed={k + 40} tint={k % 2 ? C.lime : C.rim} />
                ))}
              </g>
            </g>
          </g>
          <Label className="c1-facelab" x={600} y={520} tx={700} ty={800} text="she trains robot brains" color={C.limeLight} size={30} />
        </g>
      </g>

      {/* ---------- b1: the policy on a real reach ---------- */}
      <g className="c1-pol" ref={polRef} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c1-strip-down">
            <Pool x={SEVEN.x + 100} y={SEVEN.y - 260} r={480} color="rim" opacity={0.4} />
            <rect x={-600} y={830} width={2800} height={500} fill={C.ink1} />
            <rect x={-600} y={830} width={2800} height={3} fill={C.rim} opacity={0.2} />
            {/* a small table and a mug */}
            <rect x={430} y={598} width={200} height={14} fill={C.ink3} />
            <rect x={450} y={612} width={12} height={218} fill={C.ink2} />
            <rect x={598} y={612} width={12} height={218} fill={C.ink2} />
            <rect x={474} y={548} width={48} height={50} rx={6} fill={C.shellMid} />
            <path d="M522 558 q18 6 0 28" stroke={C.shellMid} strokeWidth={7} fill="none" />
            <Robot name="c1-seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} pose={POSES.stand} light="cool-left" />
            {/* the close-up hand on the right */}
            <Pool x={MUG.x} y={MUG.y - 120} r={420} color="key" opacity={0.6} />
            <rect x={MUG.x - 70} y={MUG.y - 120} width={140} height={124} rx={16} fill={C.shellMid} />
            <rect x={MUG.x - 56} y={MUG.y - 110} width={20} height={100} rx={8} fill={C.white} opacity={0.4} />
            <path d={`M${MUG.x + 70} ${MUG.y - 96} q44 14 0 70`} stroke={C.shellMid} strokeWidth={14} fill="none" />
            <ellipse cx={MUG.x} cy={MUG.y + 8} rx={110} ry={12} fill="#000" opacity={0.5} />
            <g className="c1-grabhand">
              <Hand3D store={grab} x={MUG.x - 30} y={MUG.y - 222} look="robot" arm={460} light={[0.8, -0.5]} />
            </g>
          </g>
          {/* observation: the robot's camera view and its joint readings */}
          <g className="c1-inset" opacity={0}>
            <rect x={INSET.x - 6} y={INSET.y - 6} width={INSET.w + 12} height={INSET.h + 12} rx={6} fill={C.ink} stroke={C.lime} strokeWidth={2} />
            <HandClip x={INSET.x} y={INSET.y} w={INSET.w} h={INSET.h} seed={5} tint={C.lime} />
            <path d={`M${INSET.x + INSET.w / 2 - 20} ${INSET.y + INSET.h / 2} h40 M${INSET.x + INSET.w / 2} ${INSET.y + INSET.h / 2 - 20} v40`} stroke={C.lime} strokeWidth={2} opacity={0.7} />
            <circle cx={INSET.x + 18} cy={INSET.y + 18} r={6} fill={C.danger} className="hd-blink" />
            <text x={INSET.x} y={INSET.y + INSET.h + 36} fill={C.lime} fontFamily={SANS} fontSize={24} fontWeight={600}>
              what it sees
            </text>
          </g>
          <g className="c1-readout" opacity={0}>
            {['shoulder', 'elbow', 'wrist', 'index', 'thumb'].map((j, i) => (
              <text key={j} x={60} y={380 + i * 30} fill={C.lime} fontFamily={MONO} fontSize={20} opacity={0.85}>
                {j.padEnd(9, ' ')} <tspan className="hd-flicker">{[34.2, 61.8, -4.1, 12.5, 9.3][i].toFixed(1)}°</tspan>
              </text>
            ))}
            <text x={60} y={540} fill={C.lime} fontFamily={SANS} fontSize={22} opacity={0.75}>
              where its joints are
            </text>
          </g>
          <path className="c1-inflow" d={`M${INSET.x + INSET.w + 8} ${INSET.y + 100} C 520 170 560 290 ${BOX.x} ${BOX.y + 50}`} stroke={C.lime} strokeWidth={3} fill="none" strokeDasharray="600" strokeDashoffset={600} />
          <path className="c1-inflow" d={`M240 450 C 420 450 520 330 ${BOX.x} ${BOX.y + 80}`} stroke={C.lime} strokeWidth={3} fill="none" strokeDasharray="600" strokeDashoffset={600} />
          <path className="c1-inflow dg-flow" d={`M${INSET.x + INSET.w + 8} ${INSET.y + 100} C 520 170 560 290 ${BOX.x} ${BOX.y + 50}`} stroke={C.limeLight} strokeWidth={6} fill="none" strokeDasharray="2 22" strokeLinecap="round" strokeDashoffset={600} />
          <path className="c1-outflow" d={`M${BOX.x + BOX.w} ${BOX.y + 60} C 1080 300 1140 300 ${MUG.x - 40} 380`} stroke={C.lime} strokeWidth={4} fill="none" strokeDasharray="700" strokeDashoffset={700} markerEnd="url(#cn-arrow)" />
          <g className="c1-targets" opacity={0}>
            {['index → 42°', 'middle → 44°', 'thumb → 30°'].map((t, i) => (
              <text key={t} x={1000 + i * 8} y={250 + i * 28} fill={C.limeLight} fontFamily={MONO} fontSize={19}>
                {t}
              </text>
            ))}
            <text x={1000} y={346} fill={C.lime} fontFamily={SANS} fontSize={22} opacity={0.8}>
              what every joint does next
            </text>
          </g>
          <g className="c1-box" opacity={0}>
            <rect className="c1-boxglow" x={BOX.x - 14} y={BOX.y - 14} width={BOX.w + 28} height={BOX.h + 28} rx={22} fill="none" stroke={C.lime} strokeWidth={10} opacity={0.35} filter="url(#cn-bloom-big)" />
            <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={16} fill={C.ink1} stroke={C.lime} strokeWidth={4} />
            <text x={BOX.x + BOX.w / 2} y={BOX.y + BOX.h / 2 + 16} textAnchor="middle" fill={C.limeLight} fontFamily={SERIF} fontSize={48} fontWeight={600}>
              policy
            </text>
          </g>
          <g className="c1-clock" opacity={0}>
            <text x={BOX.x + BOX.w / 2} y={BOX.y - 64} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={24} fontWeight={600}>
              50 times a second
            </text>
            <text x={BOX.x + BOX.w / 2} y={BOX.y - 32} textAnchor="middle" fill={C.lime} opacity={0.7} fontFamily={MONO} fontSize={20}>
              decision #<tspan className="c1-tick">0000</tspan>
            </text>
          </g>
          <g className="c1-words" opacity={0}>
            <text x={220} y={720} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={54} fontWeight={600}>
              observation
            </text>
            <path d="M420 702 H600" stroke={C.lime} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            <text x={810} y={720} textAnchor="middle" fill={C.limeLight} fontFamily={SERIF} fontSize={54} fontWeight={600}>
              policy
            </text>
            <path d="M960 702 H1140" stroke={C.lime} strokeWidth={4} markerEnd="url(#cn-arrow)" />
            <text x={1320} y={720} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={54} fontWeight={600}>
              action
            </text>
          </g>
          <Dust x={0} y={100} w={1600} h={700} count={24} seed={12} color={C.lime} size={0.6} />
        </g>
      </g>

      {/* ---------- b2: pairs on a filmstrip ---------- */}
      <g className="c1-strip" opacity={0}>
        <Blueprint />
        <Pool x={800} y={400} r={700} color="lime" opacity={0.18} />
        <g className="c1-filmsharp">
          <g className="c1-film">
            <rect x={-40} y={STRIP_Y - 40} width={FRAMES * (FW + FGAP) + 80} height={210} fill={C.ink} />
            {Array.from({ length: FRAMES * 4 }, (_, i) => (
              <g key={i}>
                <rect x={-20 + i * ((FW + FGAP) / 4)} y={STRIP_Y - 30} width={22} height={14} rx={3} fill={C.ink3} />
                <rect x={-20 + i * ((FW + FGAP) / 4)} y={STRIP_Y + 146} width={22} height={14} rx={3} fill={C.ink3} />
              </g>
            ))}
            {Array.from({ length: FRAMES }, (_, k) => {
              const x = k * (FW + FGAP)
              return (
                <g key={k}>
                  <ReachFrame x={x} k={k} />
                  <g transform={`translate(${x + 24} ${STRIP_Y + 214})`}>
                    {jointRow(k).map(([j, v], i) => (
                      <text key={j} x={0} y={i * 28} fill={C.lime} fontFamily={MONO} fontSize={20}>
                        {j} {v.toFixed(1).padStart(5, ' ')}
                      </text>
                    ))}
                  </g>
                  <g className={`c1-pair-${k}`} opacity={0}>
                    <rect x={x - 8} y={STRIP_Y - 8} width={FW + 16} height={360} rx={12} fill={C.lime} fillOpacity={0.06} stroke={C.lime} strokeWidth={3} filter="url(#cn-bloom)" />
                  </g>
                </g>
              )
            })}
          </g>
        </g>
        <g className="c1-filmblur" opacity={0} filter="url(#dg-mblur)">
          <rect x={-200} y={STRIP_Y - 40} width={2400} height={210} fill={C.ink} />
          {Array.from({ length: 14 }, (_, k) => (
            <g key={k}>
              <rect x={-200 + k * 226} y={STRIP_Y} width={FW} height={130} fill="#173440" />
              <rect x={-120 + k * 226} y={STRIP_Y + 40} width={40} height={60} fill={C.shell} opacity={0.6} />
              <rect x={-180 + k * 226} y={STRIP_Y + 190} width={120} height={130} fill={C.lime} opacity={0.35} />
            </g>
          ))}
        </g>
        <g className="c1-pairlab" opacity={0}>
          <text x={110} y={STRIP_Y - 70} fill={C.paper} fontFamily={SANS} fontSize={28} fontWeight={600}>
            what it saw
          </text>
          <text x={110} y={STRIP_Y + 400} fill={C.lime} fontFamily={SANS} fontSize={28} fontWeight={600}>
            exactly what it did
          </text>
        </g>
        <g className="c1-millions" opacity={0}>
          <Big x={800} y={760} size={96} hidden={false}>
            × millions
          </Big>
          <text x={800} y={815} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={28} letterSpacing={4}>
            OBSERVATION–ACTION PAIRS
          </text>
        </g>
      </g>

      {/* ---------- b3: the library of text ---------- */}
      <g className="c1-lib" ref={libRef} opacity={0}>
        <g data-depth="0.3">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <circle cx={VP.x} cy={VP.y} r={260} fill="url(#cn-pool-key)" />
        </g>
        <g data-depth="1">
          <g className="c1-shelfglow" opacity={0.95}>
            {books(-1)}
            {books(1)}
          </g>
          <path d={`M${VP.x - 1100} ${VP.y + 560} L${VP.x} ${VP.y} L${VP.x + 1100} ${VP.y + 560}`} fill="none" stroke={C.keyDeep} strokeOpacity={0.3} />
          <rect x={-600} y={VP.y + 470} width={2800} height={600} fill="url(#cn-fade-up)" />
          <Dust x={300} y={150} w={1000} h={500} count={30} seed={17} color={C.keyLight} size={0.7} />
        </g>
        <g data-depth="1">
          <g className="c1-tokens" opacity={0}>
            <text x={VP.x} y={150} textAnchor="middle" fill={C.keyLight} fontFamily={MONO} fontSize={34}>
              ~15–36 trillion tokens
            </text>
            <text x={VP.x} y={188} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              the text one big language model trains on
            </text>
          </g>
          <g className="c1-sentence" opacity={0}>
            <rect x={300} y={560} width={1000} height={200} rx={24} fill={C.ink} opacity={0.75} filter="url(#cn-dof-2)" />
            <text x={760} y={680} textAnchor="end" fill={C.paper} fontFamily={SERIF} fontSize={66}>
              the cat sat on the
            </text>
            <path className="c1-blank" d="M790 690 H950" stroke={C.paper} strokeWidth={4} strokeDasharray="10 8" />
            <text className="c1-mat" x={800} y={680} fill={C.lime} fontFamily={SERIF} fontSize={66} fontWeight={600} opacity={0}>
              mat
            </text>
          </g>
          <g className="c1-qa" opacity={0}>
            <path d="M250 712 v14 H760 v-14" stroke={C.mist} strokeWidth={2.5} fill="none" />
            <text x={505} y={760} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={26}>
              the question (input)
            </text>
            <path d="M796 712 v14 H920 v-14" stroke={C.lime} strokeWidth={2.5} fill="none" />
            <text x={858} y={760} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={26}>
              the answer (label)
            </text>
            <text x={800} y={826} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22} opacity={0.8}>
              every sentence ever written is a free worked example
            </text>
          </g>
        </g>
      </g>

      {/* ---------- b4: the wall of videos with no actions ---------- */}
      <g className="c1-wall" ref={wallRef} opacity={0}>
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <Pool x={800} y={420} r={900} color="key" opacity={0.25} />
        </g>
        <g data-depth="1">
          {Array.from({ length: WALL.rows * WALL.cols }, (_, i) => {
            const c = i % WALL.cols
            const r = Math.floor(i / WALL.cols)
            const x = WALL.x + c * (WALL.w + WALL.gx)
            const y = WALL.y + r * (WALL.h + WALL.gy)
            return (
              <g key={i}>
                <ChoreTile x={x} y={y} w={WALL.w} h={WALL.h} chore={TILE_CHORES[(i * 3 + r) % TILE_CHORES.length]} k={i} />
                <g className="c1-act" opacity={0}>
                  <text x={x} y={y + WALL.h + 22} fill={C.lime} fontFamily={MONO} fontSize={14} opacity={0.75}>
                    actions:
                  </text>
                  <EmptyActions x={x + 78} y={y + WALL.h + 18} w={WALL.w - 84} />
                </g>
              </g>
            )
          })}
          <Label className="c1-lab-pix" x={420} y={160} tx={470} ty={200} text="recorded: pixels" color={C.keyLight} size={28} />
          <Label className="c1-lab-force" x={640} y={280} tx={700} ty={300} text="never recorded: forces" color={C.lime} size={26} anchor="start" />
          <Label className="c1-lab-cmd" x={640} y={292} tx={700} ty={338} text="or muscle commands" color={C.lime} size={26} anchor="start" dot={false} />
        </g>
      </g>

      {/* ---------- b5: the jar play ---------- */}
      <g className="c1-jar" opacity={0}>
        <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
        <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-grid)" opacity={0.6} />
        <g className="c1-jarin">
          <JarPlay active={cueIndex === 5} playing={playing} revealed={!!result} onPaint={onPaint} onReveal={onReveal} />
        </g>
        {result && (
          <g pointerEvents="none">
            <text x={1170} y={120} fill={C.mist} fontFamily={SANS} fontSize={22}>
              your label was off by
            </text>
            <text x={1170} y={200} fill={C.danger} fontFamily={SERIF} fontSize={84} fontWeight={600}>
              {result.off}%
            </text>
            {(['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]).map((f, i) => (
              <text key={f} x={1172} y={244 + i * 26} fill={HIDDEN.includes(f) ? C.amberLight : C.mist} fontFamily={MONO} fontSize={18}>
                {f.padEnd(7, ' ')} {String(result.perFinger[f]).padStart(3, ' ')}% off{HIDDEN.includes(f) ? ' (hidden)' : ''}
              </text>
            ))}
          </g>
        )}
      </g>

      <g className="c1-flash" opacity={0} pointerEvents="none">
        <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
        <Pool x={800} y={450} r={700} color="lime" opacity={0.7} />
      </g>
      <Vignette />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'policy',
  title: 'What a robot brain eats',
  cues: CUES,
  Scene: Ch1Policy,
  deeper: [PolicyReading],
}
