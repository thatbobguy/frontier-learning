import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, SANS } from '../../../cine/palette'
import { POSES, Robot, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Big, Dust, Egg, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { ForeShelf, LabFloor, LabSky, LabWall, Workbench } from '../shared/sets'
import { MoravecReading } from './readings'

export const CUES: Cue[] = [
  { id: 'lab', say: 'Two in the morning. The lab is dark, except for one robot.' },
  { id: 'flip', say: 'This machine can walk over rubble, get back up when it’s shoved, and even do a backflip.' },
  { id: 'egg', say: 'Now watch it try to pick up an egg.' },
  { id: 'crack', say: 'Too gentle, and the egg slips away. Too hard, and it’s over.' },
  { id: 'paradox', say: 'That’s the strange truth of robotics. What feels effortless to you is often the hardest thing to teach a machine.' },
  { id: 'title', say: 'Researchers call it Moravec’s paradox. And right at the centre of it is the hand.' },
]

const STATE = [
  'A dark robotics lab at two in the morning. Rain runs down tall windows with a blurred city behind. A desk lamp pools warm light on a workbench. Seven, a white humanoid robot with a cyan visor, stands in the middle, lit from behind by the window. The camera slowly pushes in.',
  'Seven walks a few steps, gets shoved and recovers its balance, then crouches and does a backflip, silhouetted against the window as lightning flashes. It lands cleanly. The point: robots can now do hard athletic feats.',
  'Close-up on the workbench under the lamp: a single egg. A big white robot hand descends slowly from above, fingers opening.',
  'The robot hand closes too gently and the egg squirts away and rolls. It tries again, squeezes too hard (the fingertips glow red-pink with pressure) and the egg cracks and spills. The point: grip force has to be just right, and that is very hard for a robot.',
  'A human hand appears beside the robot hand and holds an egg easily, turning it in the fingers. Split screen: the robot hand in cool light on the left, the human hand in warm light on the right. The point: what is effortless for people is often hardest for machines.',
  'Everything goes dark except the two hands, which merge into one silhouette. Title: "Robot Hands, the hardest machine". The idea named is Moravec’s paradox: skills that are easy for humans (perception, grasping) are hard for machines, while things hard for humans (chess, maths) are comparatively easy.',
]

/** Where things stand in the lab (main plane, stage coordinates of the wide shot). */
const SEVEN = { x: 400, y: 790, s: 1.05 }
/** Seven's hips, in stage units above its feet (for the flip's pivot). */
const HIP = 215 * SEVEN.s
const BENCH = { x: 1230, y: 640 }
/** The human hand's egg in the close-up. */
const HUMAN = { x: 1190, y: 700 }
/** The egg in the close-up, and where it rolls to. */
const EGG = { x: 760, y: 700 }
const ROLL = 330
/** How far the hand drops from its approach height to grip. */
const DROP = 200

/** A crouch and a tuck for the backflip (the rig's joint angles; see people.tsx). */
const CROUCH = { ...POSES.stand, y: 44, torso: 26, head: -10, legN: 54, kneeN: 96, legF: 50, kneeF: 92, armN: -52, elbowN: 10, armF: -48, elbowF: 10 }
/** A gentle hold around an egg, all fingers just touching. */
const HOLD = { ...GRASPS.claw, index: [48, 46, 28, 0], middle: [50, 48, 30, 0], ring: [50, 48, 30, 0], little: [52, 48, 30, 0] } as typeof GRASPS.claw
const TUCK = { ...POSES.stand, y: 10, torso: 30, head: 10, legN: 96, kneeN: 128, legF: 92, kneeF: 124, armN: 70, elbowN: 40, armF: 66, elbowF: 40 }

export function Ch1ColdOpen({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const wide = useRef<SVGGElement>(null)
  const close = useRef<SVGGElement>(null)
  const robotHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 82, pitch: -6, roll: 180, s: 2.05 } })
  const humanHand = useHandStore({ pose: HOLD, view: { yaw: -82, pitch: -6, roll: 180, s: 2.05 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(wide.current, { x: 820, y: 470, zoom: 1 })
      const cam2 = camera(close.current, { x: 800, y: 470, zoom: 1.12 })
      const seven = rig(root.current, 'seven', POSES.stand)

      /* b0: the lab. A slow push-in past the foreground shelf. */
      tl.addLabel('b0', 0)
      tl.set('.c1-close', { opacity: 0 }, 0)
      tl.set('.c1-title', { opacity: 0 }, 0)
      cam.to(tl, { x: 560, y: 560, zoom: 1.3 }, 0, 5.2, 'sine.inOut')
      seven.idle(tl, 0.2, 4.8)

      /* b1: walk, shove, recover, backflip under lightning. */
      tl.addLabel('b1', 5.2)
      const b1 = 5.2
      cam.to(tl, { x: 640, y: 540, zoom: 1.2 }, b1, 1.6)
      tl.fromTo('.c1-shadow', { x: 0 }, { x: 150 * SEVEN.s, duration: 1.6, ease: 'none', immediateRender: false }, b1)
      const walked = seven.walk(tl, b1, { steps: 4, dx: 150, stepDur: 0.4 })
      // the shove: knocked sideways, catches itself
      seven.to(tl, { lean: -16, torso: -8, armN: 40, armF: 50, x: 240, legF: -20 }, walked + 0.05, 0.22, 'power3.out')
      cam.shake(tl, walked + 0.05, 0.7, 0.4)
      tl.fromTo('.c1-shove', { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.15, immediateRender: false }, walked)
      tl.to('.c1-shove', { opacity: 0, duration: 0.3 }, walked + 0.3)
      seven.to(tl, { ...POSES.stand, x: 230 }, walked + 0.4, 0.5, 'back.out(2)')
      // crouch, tuck and rotate a full turn around the hips, then land
      const f0 = walked + 1.1
      seven.to(tl, { ...CROUCH, x: 230 }, f0, 0.45, 'power2.in')
      seven.to(tl, { ...TUCK, x: 230 }, f0 + 0.45, 0.3, 'power2.out')
      const hip = `${SEVEN.x + 230 * SEVEN.s} ${SEVEN.y - HIP}`
      tl.fromTo('.c1-shadow', { x: 150 * SEVEN.s }, { x: 230 * SEVEN.s, duration: 0.3, immediateRender: false }, walked)
      tl.fromTo('.c1-shadow', { scaleX: 1 }, { scaleX: 0.5, duration: 0.47, yoyo: true, repeat: 1, svgOrigin: `${SEVEN.x + 230 * SEVEN.s} ${SEVEN.y}`, immediateRender: false }, f0 + 0.45)
      tl.fromTo('.c1-flipper', { rotation: 0, y: 0 }, { rotation: -360, duration: 0.95, ease: 'power1.inOut', svgOrigin: hip, immediateRender: false }, f0 + 0.45)
      tl.fromTo('.c1-flipper', { y: 0 }, { y: -150, duration: 0.47, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, f0 + 0.45)
      cam.to(tl, { x: 700, y: 480, zoom: 1.1 }, f0 + 0.3, 0.8)
      // lightning at the top of the flip
      tl.fromTo('.sky-flash', { opacity: 0 }, { opacity: 0.8, duration: 0.05, immediateRender: false }, f0 + 0.85)
      tl.to('.sky-flash', { opacity: 0.1, duration: 0.12 }, f0 + 0.9)
      tl.to('.sky-flash', { opacity: 0.6, duration: 0.04 }, f0 + 1.02)
      tl.to('.sky-flash', { opacity: 0, duration: 0.5 }, f0 + 1.06)
      fade(tl, '.c1-sil', 1, f0 + 0.85, 0.05)
      fade(tl, '.c1-sil', 0, f0 + 1.2, 0.5, 1)
      // land
      seven.to(tl, { ...CROUCH, x: 230 }, f0 + 1.4, 0.18, 'power2.in')
      cam.shake(tl, f0 + 1.55, 1, 0.45)
      seven.to(tl, { ...POSES.stand, x: 230 }, f0 + 1.75, 0.6, 'power2.out')
      cam.to(tl, { x: 900, y: 560, zoom: 1.25 }, f0 + 1.7, 1.2)

      /* b2: cut to the bench. One egg. The hand comes down from the dark. */
      const b2 = f0 + 3
      tl.addLabel('b2', b2)
      tl.set('.c1-close', { opacity: 1 }, b2)
      tl.set('.c1-wide', { opacity: 0 }, b2)
      cam2.to(tl, { x: 790, y: 520, zoom: 1.28 }, b2, 3.4, 'sine.inOut')
      tl.fromTo('.c1-rhand', { y: -760 }, { y: -260, duration: 2.8, ease: 'power2.out', immediateRender: false }, b2 + 0.2)
      robotHand.to(tl, { pose: GRASPS.open }, b2 + 0.6, 1.6)

      /* b3: too gentle, the egg squirts away; too hard, it cracks. */
      const b3 = b2 + 3.4
      tl.addLabel('b3', b3)
      tl.fromTo('.c1-rhand', { y: -260 }, { y: DROP, duration: 0.45, ease: 'power2.out', immediateRender: false }, b3 - 0.3)
      robotHand.to(tl, { pose: { ...GRASPS.claw, index: [30, 30, 20, 0], middle: [30, 30, 20, 0], ring: [30, 30, 20, 0], little: [30, 30, 20, 0] }, touch: { thumb: 0.25, index: 0.25, middle: 0.2 } }, b3 - 0.35, 0.75)
      tl.fromTo('.c1-egg', { x: 0, rotation: 0 }, { x: ROLL, rotation: 75, duration: 0.9, ease: 'power3.out', svgOrigin: `${EGG.x} ${EGG.y}`, immediateRender: false }, b3 + 0.45)
      tl.fromTo('.c1-egg', { y: 0 }, { y: -26, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out', immediateRender: false }, b3 + 0.45)
      robotHand.to(tl, { pose: GRASPS.open, touch: { thumb: 0, index: 0, middle: 0 } }, b3 + 0.7, 0.4)
      tl.fromTo('.c1-rhand', { x: 0, y: DROP }, { x: ROLL, y: -60, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, b3 + 1.0)
      tl.fromTo('.c1-rhand', { y: -60 }, { y: DROP + 20, duration: 0.5, ease: 'power2.in', immediateRender: false }, b3 + 1.8)
      robotHand.to(tl, { pose: GRASPS.power, touch: { thumb: 1, index: 1, middle: 1, ring: 0.8, little: 0.6 } }, b3 + 2.3, 0.35, 'power3.in')
      tl.fromTo('.c1-crack', { strokeDashoffset: 120 }, { strokeDashoffset: 0, duration: 0.2, immediateRender: false }, b3 + 2.55)
      fade(tl, '.c1-spill', 1, b3 + 2.6, 0.5)
      tl.fromTo('.c1-eggshape', { scaleY: 1 }, { scaleY: 0.86, duration: 0.2, svgOrigin: `${EGG.x} ${EGG.y}`, immediateRender: false }, b3 + 2.55)
      tl.fromTo('.c1-shard', { x: 0, y: 0, opacity: 0 }, { x: (i) => [-90, 70, -40, 110, 20][i % 5], y: (i) => [-60, -80, -110, -30, -140][i % 5], opacity: 1, rotation: (i) => i * 70, duration: 0.5, ease: 'power2.out', immediateRender: false }, b3 + 2.6)
      tl.to('.c1-shard', { y: '+=90', opacity: 0, duration: 0.6, ease: 'power2.in' }, b3 + 3.1)
      cam2.shake(tl, b3 + 2.58, 1.1, 0.5)
      tl.fromTo('.c1-lamp', { opacity: 1 }, { opacity: 0.45, duration: 0.06, yoyo: true, repeat: 5, immediateRender: false }, b3 + 2.62)
      fade(tl, '.c1-danger', 1, b3 + 2.55, 0.15)
      fade(tl, '.c1-danger', 0, b3 + 3.4, 0.8, 1)

      /* b4: a human hand turns an egg with no effort. Split frame: cool robot, warm human. */
      const b4 = b3 + 4.4
      tl.addLabel('b4', b4)
      robotHand.to(tl, { pose: GRASPS.relaxed, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, b4, 1)
      tl.fromTo('.c1-rhand', { x: ROLL, y: DROP + 20 }, { x: ROLL - 40, y: -150, duration: 1.4, ease: 'power2.inOut', immediateRender: false }, b4)
      tl.fromTo('.c1-robotside', { x: 0 }, { x: -380, duration: 1.6, ease: 'power3.inOut', immediateRender: false }, b4 + 0.2)
      fade(tl, '.c1-humanside', 1, b4 + 0.6, 1.2)
      tl.fromTo('.c1-humanside', { x: 380 }, { x: 0, duration: 1.6, ease: 'power3.inOut', immediateRender: false }, b4 + 0.2)
      fade(tl, '.c1-split', 1, b4 + 1.4, 0.8)
      // lifts it without a thought, and tips it to look at it
      tl.fromTo('.c1-hlift', { y: 0 }, { y: -170, duration: 1.4, ease: 'power2.inOut', immediateRender: false }, b4 + 1.6)
      tl.fromTo('.c1-hlift', { rotation: 0 }, { rotation: -12, duration: 1.6, ease: 'sine.inOut', svgOrigin: `${HUMAN.x} ${HUMAN.y}`, immediateRender: false }, b4 + 3.0)
      tl.to('.c1-hlift', { rotation: 6, duration: 1.6, ease: 'sine.inOut', svgOrigin: `${HUMAN.x} ${HUMAN.y}` }, b4 + 4.6)
      fade(tl, '.c1-lab-robot', 1, b4 + 2.2, 0.6)
      fade(tl, '.c1-lab-human', 1, b4 + 2.6, 0.6)

      /* b5: dark, the hands meet, the title. */
      const b5 = b4 + 6.4
      tl.addLabel('b5', b5)
      fade(tl, '.c1-lab-robot, .c1-lab-human, .c1-split', 0, b5, 0.6, 1)
      fade(tl, '.c1-dark', 0.92, b5, 1.4, 0)
      tl.fromTo('.c1-robotside', { x: -380 }, { x: -130, duration: 2.2, ease: 'power2.inOut', immediateRender: false }, b5 + 0.4)
      tl.fromTo('.c1-humanside', { x: 0 }, { x: -230, duration: 2.2, ease: 'power2.inOut', immediateRender: false }, b5 + 0.4)
      fade(tl, '.c1-handsdim', 0.82, b5 + 1.4, 1.4, 0)
      letterbox(tl, '.c1-lb', true, b5 + 0.6)
      cam2.to(tl, { x: 800, y: 470, zoom: 1.08 }, b5, 3.2)
      fade(tl, '.c1-title', 1, b5 + 2.2, 1.4)
      tl.fromTo('.c1-title-main', { letterSpacing: 18 }, { letterSpacing: -1, duration: 3.2, ease: 'power2.out', immediateRender: false }, b5 + 2.2)
      tl.to({}, { duration: 0.4 }, b5 + 5.2)
    },
    [robotHand, humanHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    // the lamp hums and the window light breathes, so no frame is ever still
    gsap.to('.c1-hum', { opacity: 0.8, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c1-winlight', { opacity: 0.3, duration: 3.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      {/* ---------- the wide shot: the lab ---------- */}
      <g className="c1-wide" ref={wide}>
        <g data-depth="0.25">
          <LabSky />
        </g>
        <g data-depth="0.6">
          <LabWall />
        </g>
        <g data-depth="1">
          <LabFloor />
          <Workbench x={BENCH.x} y={BENCH.y} w={520} />
          <g transform={`translate(${BENCH.x - 120} ${BENCH.y - 30}) scale(0.6)`}>
            <Egg />
          </g>
          {/* window light falling across the robot */}
          <g className="c1-winlight" opacity={0.45}>
            <Pool x={SEVEN.x + 160} y={SEVEN.y - 300} r={520} color="rim" />
          </g>
          <ellipse className="c1-shadow" cx={SEVEN.x + 10} cy={SEVEN.y + 4} rx={110} ry={12} fill="#000" opacity={0.55} filter="url(#cn-dof-1)" />
          <g className="c1-flipper">
            <Robot name="seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} pose={POSES.stand} light="cool-left" />
          </g>
          {/* at the top of the flip, a pure silhouette against the lightning */}
          <g className="c1-sil" opacity={0}>
            <rect x={-600} y={-500} width={2800} height={1900} fill="#000" opacity={0.25} />
          </g>
          {/* the shove: a blur of motion from the left */}
          <g className="c1-shove" opacity={0}>
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${SEVEN.x + 150 * SEVEN.s - 50} ${SEVEN.y - 300 * SEVEN.s + i * 40} l -120 ${-6 + i * 6}`} stroke={C.paper} strokeWidth={4 - i} strokeLinecap="round" opacity={0.6 - i * 0.15} />
            ))}
          </g>
          <Dust x={-200} y={0} w={2000} h={800} count={40} seed={21} color={C.rim} size={0.8} />
        </g>
        <g data-depth="1.7">
          <ForeShelf x={1500} />
        </g>
      </g>

      {/* ---------- the close-up: the bench, the egg, the hands ---------- */}
      <g className="c1-close" ref={close} opacity={0}>
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          {/* out-of-focus lab behind */}
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            <rect x={-100} y={60} width={300} height={500} fill={C.ink3} />
            <rect x={1300} y={40} width={360} height={520} fill={C.ink3} />
            <circle cx={1450} cy={220} r={40} fill={C.rim} opacity={0.35} />
            <circle cx={60} cy={260} r={30} fill={C.key} opacity={0.3} />
            <circle cx={1180} cy={160} r={22} fill={C.rim} opacity={0.4} />
          </g>
        </g>
        <g data-depth="1">
          <g className="c1-lamp">
            <g className="c1-hum">
              <Pool x={800} y={640} r={760} color="key" opacity={0.95} />
            </g>
          </g>
          {/* bench top in close-up */}
          <rect x={-600} y={790} width={2800} height={800} fill={C.ink2} />
          <rect x={-600} y={790} width={2800} height={5} fill={C.keyDeep} opacity={0.6} />
          <g className="c1-lamp">
            <ellipse cx={800} cy={800} rx={700} ry={60} fill={C.key} opacity={0.18} filter="url(#cn-dof-2)" />
          </g>

          <g className="c1-robotside">
            {/* the egg */}
            <g className="c1-egg">
              <g className="c1-eggshape">
                <Egg x={EGG.x} y={EGG.y + 4} s={2.3} crackClass="c1-crack" />
              </g>
            </g>
            <g className="c1-spill" opacity={0}>
              <ellipse cx={EGG.x + ROLL + 60} cy={EGG.y + 86} rx={190} ry={22} fill="#f3e6b8" opacity={0.8} />
              <ellipse cx={EGG.x + ROLL + 90} cy={EGG.y + 80} rx={46} ry={18} fill="#f2a516" />
              <ellipse cx={EGG.x + ROLL + 80} cy={EGG.y + 74} rx={14} ry={6} fill="#ffd36a" />
            </g>
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} className="c1-shard" d="M0 0 l14 -6 l6 12 l-12 6 Z" fill="#efe4cf" opacity={0} transform={`translate(${EGG.x + ROLL - 10 + i * 6} ${EGG.y})`} />
            ))}
            <g className="c1-danger" opacity={0}>
              <Pool x={EGG.x + ROLL} y={EGG.y - 40} r={260} color="danger" opacity={0.6} />
            </g>
            <g className="c1-rhand">
              <Hand3D store={robotHand} x={EGG.x + 40} y={250} look="robot" arm={460} light={[0.8, -0.5]} />
            </g>
            <Label className="c1-lab-robot" x={EGG.x + ROLL - 60} y={EGG.y - 20} tx={EGG.x + ROLL - 40} ty={EGG.y + 150} text="robot: guessing the force" color={C.rim} anchor="middle" />
          </g>

          <g className="c1-humanside" opacity={0}>
            <Pool x={1180} y={520} r={420} color="key" opacity={0.7} />
            <g className="c1-hlift">
              <Egg x={HUMAN.x + 50} y={HUMAN.y - 10} s={2.3} />
              <Hand3D store={humanHand} x={HUMAN.x - 40} y={250 + DROP} look="human" arm={460} light={[-0.8, -0.6]} />
            </g>
            <Label className="c1-lab-human" x={HUMAN.x - 80} y={HUMAN.y - 40} tx={HUMAN.x - 180} ty={HUMAN.y + 150} text="you: no thought at all" color={C.keyLight} anchor="middle" />
          </g>
          <g className="c1-split" opacity={0}>
            <rect x={-600} y={-500} width={1400} height={1900} fill={C.rim} opacity={0.06} style={{ mixBlendMode: 'screen' }} />
            <line x1={800} x2={800} y1={-200} y2={1100} stroke={C.paper} strokeWidth={2} opacity={0.35} />
          </g>
        </g>
        <rect className="c1-dark" x={-600} y={-500} width={2800} height={1900} fill="#000" opacity={0} pointerEvents="none" />
        <g className="c1-handsdim" opacity={0} pointerEvents="none">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#000" />
          <Pool x={800} y={420} r={520} color="rim" opacity={0.35} />
        </g>
      </g>

      <g className="c1-title" opacity={0} pointerEvents="none">
        <Big className="c1-title-main" x={800} y={640} size={150} hidden={false}>
          Robot Hands
        </Big>
        <text x={800} y={710} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={30} letterSpacing={10}>
          THE HARDEST MACHINE
        </text>
      </g>
      <Vignette />
      <Letterbox className="c1-lb" />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'cold-open',
  title: 'Backflips and eggs',
  cues: CUES,
  Scene: Ch1ColdOpen,
  deeper: [MoravecReading],
}
