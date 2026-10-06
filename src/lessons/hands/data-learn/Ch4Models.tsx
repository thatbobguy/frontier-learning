import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { LabSky } from '../shared/sets'
import { ADA, Monitor, Tag } from './art'
import { VlaReading } from './readings'

export const CUES: Cue[] = [
  { id: 'vla', say: 'That’s why today’s leading robot brains are built on top of models that already understand images and language. They’re called vision-language-action models.' },
  { id: 'knows', say: 'The web teaches them what a mug is, what “the sink” means, and what people usually do with things. Robot data teaches them how to move this particular body.' },
  { id: 'practice', say: 'And the newest step is practice. Let the robot try, score each attempt, and learn from failures too. One lab’s robot made espresso all day at over ninety percent success.' },
  { id: 'dream', say: 'Some labs go further, training a model that imagines the future: what will the camera see if the hand does this? A dream world to practise and test in. But those dreams still get physics wrong, especially pouring and touch.' },
  { id: 'next', say: 'So the methods are getting powerful. The final question is the hardest: is any of this good enough to let a robot loose in your home?' },
]

const STATE = [
  'A large lime network diagram on a blueprint: a vision-language model (an eye icon and text glyphs going in) with a smaller "action expert" attached that outputs smooth joint trajectories. The camera pans right into a night kitchen where Seven hears the caption "put the yellow mug in the sink", picks the yellow mug off the counter and puts it in the sink. Idea: a VLA starts from a pretrained vision-language model and adds an action output.',
  'Two streams pour into the model: a blizzard of web images and captions (cool blue cards: “a mug”, “the sink”, “washing up”) labelled what, and a narrow lime stream of robot trajectories labelled how. Idea: web data gives semantics and common sense; robot data teaches how to move this particular body.',
  'A night café counter: Seven makes espresso in a loop. A counter of attempts and a success rate climb; when it fumbles a cup (red mark), a lime spark flies from the failure into the model: it learns from failures too. Label: π*0.6 with RECAP, Nov 2025. Idea: reinforcement learning from the robot’s own experience; the espresso ran all day at over 90% success.',
  'A dreamy, warped, colour-shifting video of a kitchen, generated frame by frame by a world model (frame counter ticking). A robot hand pours from a jug, but the water bends sideways unnaturally and never fills the glass. Label: world models: 1X world model scored 0% on pouring. Idea: world models predict what the camera will see after an action, useful for practice and testing, but they still get contact physics, pouring and touch wrong.',
  'The camera pulls back from Ada’s monitor, through her window and across the dark rainy city to one single lit house. The course map appears: the lime data branch with its stops, and the last node, “Robots at home”, lights up. The next film asks whether any of this is good enough for a robot in your home.',
]

/** b0: the network, laid out on the left of a wide world; the kitchen is to its right. */
const NET = { x: 520, y: 450 }
const KIT = { x: 2300, floor: 800, counter: 600 }
const MUG0 = { x: KIT.x - 120, y: KIT.counter }
const SINK = { x: KIT.x + 300, y: KIT.counter + 6 }

const WEB_CARDS = ['a mug', 'the sink', 'washing up', 'a yellow cup', 'kitchen at night', 'rinse it', 'mug on a shelf', 'tap', 'dishes', 'a teacup', 'put away', 'handle']

export function Ch4Models({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const worldRef = useRef<SVGGElement>(null)
  const cafeRef = useRef<SVGGElement>(null)
  const dreamRef = useRef<SVGGElement>(null)
  const homeRef = useRef<SVGGElement>(null)
  const mugRef = useRef<SVGGElement>(null)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const cam = camera(worldRef.current, { x: 640, y: 450, zoom: 1.12 })
    const camC = camera(cafeRef.current, { x: 800, y: 470, zoom: 1.1 })
    const camD = camera(dreamRef.current, { x: 800, y: 450, zoom: 1.05 })
    const camH = camera(homeRef.current, { x: 800, y: 395, zoom: 3.0 })
    const seven = rig(root.current, 'd4-seven', POSES.stand)
    const barista = rig(root.current, 'd4-barista', POSES.stand)

    tl.set('.d4-cafe, .d4-dream, .d4-home, .d4-tree', { opacity: 0 }, 0)
    tl.set('.d4-world', { opacity: 1 }, 0)
    tl.set('.d4-traj', { strokeDashoffset: 1 }, 0)
    tl.set('.d4-card, .d4-robo', { opacity: 0 }, 0)

    /* b0: the VLA, then Seven doing what it's told. */
    tl.addLabel('b0', 0)
    cam.to(tl, { x: 600, y: 450, zoom: 1.0 }, 0, 3)
    tl.fromTo('.d4-node', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.02, transformOrigin: '50% 50%', ease: 'back.out(2)', immediateRender: false }, 0.2)
    fade(tl, '.d4-edges', 0.5, 0.6, 1.4)
    fade(tl, '.d4-lab-vlm', 1, 1.4)
    fade(tl, '.d4-expert', 1, 2.6, 0.6)
    tl.fromTo('.d4-traj', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, stagger: 0.15, ease: 'power1.inOut', immediateRender: false }, 3.0)
    fade(tl, '.d4-lab-expert', 1, 3.2)
    fade(tl, '.d4-lab-vla', 1, 4.2)
    // the pan into the kitchen
    cam.to(tl, { x: KIT.x, y: 470, zoom: 1.05 }, 5.0, 2.2, 'power2.inOut')
    fade(tl, '.d4-say', 1, 6.4, 0.4)
    seven.to(tl, { ...POSES.reach, armN: 66, elbowN: 20, torso: 12 }, 7.2, 0.8)
    tl.fromTo(mugRef.current, { x: 0, y: 0 }, { x: 140, y: -150, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, 8.0)
    seven.to(tl, { ...POSES.reach, armN: 100, elbowN: 10, torso: 6, x: 60 }, 8.0, 0.9)
    tl.fromTo(mugRef.current, { x: 140, y: -150 }, { x: SINK.x - MUG0.x, y: 0, duration: 1.0, ease: 'power2.inOut', immediateRender: false }, 9.0)
    seven.to(tl, { ...POSES.reach, armN: 60, elbowN: 16, torso: 18, x: 160 }, 9.0, 1.0)
    fade(tl, '.d4-done', 1, 10.0, 0.4)
    seven.to(tl, { ...POSES.stand, x: 160 }, 10.4, 0.8)

    /* b1: what (the web) and how (robot data) pour into the model. */
    const b1 = 11.2
    tl.addLabel('b1', b1)
    fade(tl, '.d4-say, .d4-done', 0, b1, 0.4, 1)
    cam.to(tl, { x: 760, y: 440, zoom: 0.92 }, b1, 2, 'power2.inOut')
    tl.fromTo('.d4-card', { opacity: 0, x: -520, y: -360 }, { opacity: 1, x: 0, y: 0, duration: 2.4, stagger: { each: 0.22, repeat: 1 }, ease: 'power1.in', immediateRender: false }, b1 + 1.2)
    tl.to('.d4-card', { opacity: 0, duration: 0.4, stagger: 0.22 }, b1 + 3.4)
    tl.fromTo('.d4-robo', { opacity: 0, x: -460 }, { opacity: 1, x: 0, duration: 2.2, stagger: { each: 0.5, repeat: 1 }, ease: 'none', immediateRender: false }, b1 + 3.2)
    fade(tl, '.d4-lab-what', 1, b1 + 2.4)
    fade(tl, '.d4-lab-how', 1, b1 + 6.0)
    tl.fromTo('.d4-core', { opacity: 0.5 }, { opacity: 1, duration: 0.3, repeat: 15, yoyo: true, immediateRender: false }, b1 + 2.4)
    tl.to({}, { duration: 0.5 }, b1 + 11)

    /* b2: practice. Espresso all night; failures become lessons. */
    const b2 = b1 + 11.4
    tl.addLabel('b2', b2)
    fade(tl, '.d4-world', 0, b2, 0.5, 1)
    fade(tl, '.d4-cafe', 1, b2, 0.6)
    camC.to(tl, { x: 800, y: 480, zoom: 1.12 }, b2, 11.5, 'sine.inOut')
    const cycle = 2.4
    for (let k = 0; k < 5; k++) {
      const t = b2 + 0.6 + k * cycle
      barista.to(tl, { ...POSES.reach, armN: 58, elbowN: 34, torso: 10 }, t, 0.6)
      barista.to(tl, { ...POSES.reach, armN: 84, elbowN: 20, torso: 4 }, t + 0.8, 0.6)
      barista.to(tl, { ...POSES.hold, torso: 4 }, t + 1.6, 0.6)
      tl.fromTo('.d4-shot', { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1, immediateRender: false }, t + 1.1)
      if (k === 2) {
        // a fumble: the cup tips; the failure becomes a lesson
        tl.fromTo('.d4-fumble', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, transformOrigin: '50% 50%', immediateRender: false }, t + 1.3)
        tl.to('.d4-fumble', { opacity: 0, duration: 0.5 }, t + 2.4)
        tl.fromTo('.d4-spark', { x: 0, y: 0, opacity: 0 }, { x: -240, y: -330, opacity: 1, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, t + 1.6)
        tl.to('.d4-spark', { opacity: 0, duration: 0.3 }, t + 2.7)
        tl.fromTo('.d4-lesson', { scale: 1 }, { scale: 1.4, duration: 0.25, yoyo: true, repeat: 1, transformOrigin: '50% 50%', immediateRender: false }, t + 2.6)
      }
    }
    const counter = { n: 0, ok: 0 }
    const writeCount = () => {
      const a = root.current?.querySelector('.d4-count')
      const b = root.current?.querySelector('.d4-rate')
      if (a) a.textContent = `attempts ${Math.round(counter.n)}`
      if (b) b.textContent = `success ${counter.n ? Math.min(97, Math.round((counter.ok / Math.max(1, counter.n)) * 100)) : 0}%`
    }
    tl.fromTo(counter, { n: 0, ok: 0 }, { n: 412, ok: 382, duration: 11, ease: 'power1.in', immediateRender: false, onUpdate: writeCount }, b2 + 0.5)
    fade(tl, '.d4-lab-recap', 1, b2 + 4.5)
    fade(tl, '.d4-lab-allday', 1, b2 + 8)
    tl.to({}, { duration: 0.4 }, b2 + 12)

    /* b3: the dream world, and its broken physics. */
    const b3 = b2 + 12.6
    tl.addLabel('b3', b3)
    fade(tl, '.d4-cafe', 0, b3, 0.8, 1)
    fade(tl, '.d4-dream', 1, b3, 1.2)
    camD.to(tl, { x: 820, y: 470, zoom: 1.2 }, b3, 15, 'sine.inOut')
    tl.fromTo('.d4-warp', { attr: { scale: 30 } }, { attr: { scale: 9 }, duration: 3, ease: 'sine.inOut', immediateRender: false }, b3)
    tl.fromTo('.d4-warp', { attr: { scale: 9 } }, { attr: { scale: 14 }, duration: 4, ease: 'sine.inOut', immediateRender: false }, b3 + 8)
    tl.fromTo('.d4-hue', { attr: { values: '0' } }, { attr: { values: '40' }, duration: 15, ease: 'sine.inOut', immediateRender: false }, b3)
    fade(tl, '.d4-lab-dream', 1, b3 + 1.6)
    tl.fromTo('.d4-jug', { rotation: 0 }, { rotation: -58, duration: 2, ease: 'power2.inOut', svgOrigin: '980 360', immediateRender: false }, b3 + 6)
    tl.fromTo('.d4-pour', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power1.in', immediateRender: false }, b3 + 7.6)
    tl.fromTo('.d4-pour2', { opacity: 0 }, { opacity: 1, duration: 1.4, immediateRender: false }, b3 + 9)
    tl.fromTo('.d4-pour', { opacity: 1 }, { opacity: 0, duration: 1.4, immediateRender: false }, b3 + 9)
    fade(tl, '.d4-blob', 1, b3 + 9.4, 1)
    fade(tl, '.d4-lab-wrong', 1, b3 + 10.4)
    fade(tl, '.d4-lab-1x', 1, b3 + 11.6)
    tl.to({}, { duration: 1 }, b3 + 14.6)

    /* b4: pull back from Ada's screen, across the city, to one lit house; the map. */
    const b4 = b3 + 15.6
    tl.addLabel('b4', b4)
    fade(tl, '.d4-dream', 0, b4, 0.6, 1)
    fade(tl, '.d4-home', 1, b4, 0.6)
    letterbox(tl, '.d4-lb', true, b4)
    // out of the screen to see Ada and her window...
    camH.to(tl, { x: 800, y: 450, zoom: 0.95 }, b4 + 0.1, 2.6, 'power2.inOut')
    // ...then out through the window, across the city, to one lit house
    camH.to(tl, { x: 800, y: 600, zoom: 2.9 }, b4 + 2.7, 2.8, 'power2.in')
    fade(tl, '.d4-room', 0, b4 + 3.6, 1.0, 1)
    fade(tl, '.d4-house', 1, b4 + 3.2, 1.2)
    fade(tl, '.d4-tree', 1, b4 + 5.0, 1.2)
    tl.fromTo('.d4-branch', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut', immediateRender: false }, b4 + 5.2)
    tl.fromTo('.d4-homenode', { scale: 0.4, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(3)', transformOrigin: '50% 50%', immediateRender: false }, b4 + 6.8)
    fade(tl, '.d4-homelab', 1, b4 + 7.1)
    tl.to({}, { duration: 1.2 }, b4 + 8)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.d4-core', { attr: { r: 64 }, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d4-steam', { y: -30, opacity: 0, duration: 2.4, repeat: -1, stagger: 0.8, ease: 'sine.out' })
    gsap.to('.d4-turb', { attr: { baseFrequency: 0.02 }, duration: 3.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d4-frame', { textContent: 999, duration: 40, repeat: -1, ease: 'none', snap: { textContent: 1 } })
    gsap.fromTo('.d4-homenode-glow', { opacity: 0.3 }, { opacity: 0.9, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  /* the network's nodes */
  const layers = [5, 7, 7, 7, 5]
  const nodes = layers.flatMap((n, li) => Array.from({ length: n }, (_, k) => ({ x: NET.x - 200 + li * 100, y: NET.y - ((n - 1) / 2) * 52 + k * 52, li })))

  return (
    <g ref={root}>
      <defs>
        <filter id="d4-dreamfx" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence className="d4-turb" type="fractalNoise" baseFrequency={0.012} numOctaves={2} seed={4} result="n" />
          <feDisplacementMap className="d4-warp" in="SourceGraphic" in2="n" scale={10} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix className="d4-hue" in="d" type="hueRotate" values="0" result="h" />
          <feGaussianBlur in="h" stdDeviation={1.2} />
        </filter>
      </defs>

      {/* ================= b0-b1: the model and the kitchen, one wide world ================= */}
      <g className="d4-world" ref={worldRef} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={4400} height={2100} fill={C.ink1} />
          <rect x={-800} y={-600} width={2400} height={2100} fill="url(#cn-grid-big)" opacity={0.6} />
          <Pool x={NET.x} y={NET.y} r={700} color="lime" opacity={0.18} />
        </g>
        <g data-depth="1">
          {/* the vision-language model */}
          <g className="d4-edges" opacity={0}>
            {nodes.map((a, i) =>
              nodes
                .filter((b) => b.li === a.li + 1)
                .map((b, j) => <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.lime} strokeWidth={1} opacity={0.35} />),
            )}
          </g>
          <circle className="d4-core" cx={NET.x} cy={NET.y} r={50} fill={C.lime} opacity={0.15} filter="url(#cn-bloom-big)" />
          {nodes.map((n, i) => (
            <circle key={i} className="d4-node" cx={n.x} cy={n.y} r={10} fill={C.ink} stroke={C.lime} strokeWidth={3} opacity={0} />
          ))}
          <rect x={NET.x - 250} y={NET.y - 230} width={500} height={460} rx={40} fill="none" stroke={C.lime} strokeWidth={2.5} opacity={0.6} />
          <g className="d4-lab-vlm" opacity={0}>
            <text x={NET.x} y={NET.y - 252} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={28} fontWeight={600}>
              vision-language model
            </text>
            <Tag x={NET.x} y={NET.y + 262} anchor="middle" size={18} color={C.limeLight}>
              pretrained on the web: billions of images and words
            </Tag>
          </g>
          {/* inputs: an eye and words */}
          <g transform={`translate(${NET.x - 420} ${NET.y - 90})`}>
            <path d="M-50 0 Q 0 -40 50 0 Q 0 40 -50 0 Z" fill="none" stroke={C.rim} strokeWidth={4} />
            <circle r={16} fill={C.rim} />
            <circle r={6} fill={C.ink} />
            <path d="M70 0 H 150" stroke={C.rim} strokeWidth={3} markerEnd="url(#cn-arrow)" />
          </g>
          <g transform={`translate(${NET.x - 470} ${NET.y + 80})`}>
            <text x={0} y={0} fill={C.mist} fontFamily={MONO} fontSize={22}>
              “put the yellow
            </text>
            <text x={0} y={28} fill={C.mist} fontFamily={MONO} fontSize={22}>
              mug in the sink”
            </text>
            <path d="M200 10 H 260" stroke={C.mist} strokeWidth={3} markerEnd="url(#cn-arrow)" />
          </g>
          {/* the action expert */}
          <g className="d4-expert" opacity={0}>
            <path d={`M${NET.x + 250} ${NET.y} H ${NET.x + 330}`} stroke={C.lime} strokeWidth={4} />
            <rect x={NET.x + 330} y={NET.y - 110} width={210} height={220} rx={26} fill={C.lime} fillOpacity={0.1} stroke={C.lime} strokeWidth={3} />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <path
                key={k}
                className="d4-traj"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1}
                d={`M${NET.x + 560} ${NET.y - 90 + k * 36} c 40 ${-20 + k * 6} 80 ${24 - k * 4} 120 ${-6 + k * 3} s 80 ${-10 + k * 5} 130 ${4 - k * 2}`}
                stroke={C.cyan}
                strokeWidth={3}
                fill="none"
              />
            ))}
          </g>
          <Label className="d4-lab-expert" x={NET.x + 435} y={NET.y + 110} tx={NET.x + 435} ty={NET.y + 170} text="action expert" sub="joint trajectories out" color={C.lime} size={26} anchor="middle" />
          <g className="d4-lab-vla" opacity={0}>
            <text x={NET.x + 150} y={NET.y - 330} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={52} fontWeight={600}>
              vision-language-action model
            </text>
          </g>

          {/* web cards (what) and robot trajectories (how) */}
          {WEB_CARDS.map((t, i) => {
            const x = NET.x - 160 + ((i * 53) % 220)
            const y = NET.y - 120 + ((i * 71) % 160)
            return (
              <g key={t} className="d4-card" opacity={0}>
                <rect x={x - 70} y={y - 46} width={140} height={92} rx={6} fill={C.ink3} stroke={C.rim} strokeOpacity={0.6} />
                <rect x={x - 62} y={y - 38} width={124} height={52} rx={3} fill={['#2d5d73', '#5a4636', '#3d5a4a', '#5b3e4e'][i % 4]} />
                <circle cx={x - 20 + (i % 3) * 18} cy={y - 14} r={10} fill={i % 2 ? C.gold : C.paper} opacity={0.8} />
                <text x={x} y={y + 34} textAnchor="middle" fill={C.cyanLight} fontFamily={SANS} fontSize={16}>
                  {t}
                </text>
              </g>
            )
          })}
          {[0, 1, 2, 3].map((k) => (
            <path key={k} className="d4-robo" d={`M${NET.x - 300} ${NET.y + 180 + k * 8} c 60 -20 120 20 180 -6 s 80 -40 120 -60`} stroke={C.lime} strokeWidth={4} fill="none" opacity={0} />
          ))}
          <Label className="d4-lab-what" x={NET.x - 250} y={NET.y - 200} tx={NET.x - 470} ty={NET.y - 300} anchor="start" text="what: the web" sub="what a mug is, what “the sink” means" color={C.cyanLight} size={30} />
          <Label className="d4-lab-how" x={NET.x - 200} y={NET.y + 200} tx={NET.x - 470} ty={NET.y + 300} anchor="start" text="how: robot data" sub="how to move this particular body" color={C.lime} size={30} />

          {/* the kitchen to the right */}
          <rect x={KIT.x - 700} y={-200} width={1500} height={KIT.floor + 200} fill="#1a2433" />
          <Pool x={KIT.x} y={460} r={640} color="key" opacity={0.6} />
          <rect x={KIT.x + 120} y={140} width={300} height={240} fill="#0d1b2c" stroke={C.ink} strokeWidth={10} />
          <g className="hd-bokeh">
            <circle cx={KIT.x + 200} cy={220} r={18} fill={C.key} opacity={0.5} filter="url(#cn-dof-2)" />
            <circle cx={KIT.x + 330} cy={300} r={14} fill={C.rim} opacity={0.5} filter="url(#cn-dof-2)" />
          </g>
          <rect x={KIT.x - 560} y={160} width={300} height={140} fill="#2f3b4c" />
          <rect x={KIT.x - 700} y={KIT.counter} width={1500} height={18} fill={C.ink4} />
          <rect x={KIT.x - 700} y={KIT.counter + 18} width={1500} height={KIT.floor - KIT.counter - 18} fill="#2f3b4c" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <line key={k} x1={KIT.x - 600 + k * 230} x2={KIT.x - 600 + k * 230} y1={KIT.counter + 30} y2={KIT.floor - 10} stroke={C.ink} strokeOpacity={0.4} strokeWidth={2} />
          ))}
          <rect x={SINK.x - 90} y={KIT.counter - 4} width={180} height={14} rx={4} fill={C.metalDark} />
          <path d={`M${SINK.x + 40} ${KIT.counter - 4} V ${KIT.counter - 90} Q ${SINK.x + 40} ${KIT.counter - 110} ${SINK.x + 10} ${KIT.counter - 110} V ${KIT.counter - 90}`} stroke={C.metal} strokeWidth={8} fill="none" />
          <rect x={KIT.x - 700} y={KIT.floor} width={1500} height={300} fill={C.ink2} />
          <Robot name="d4-seven" x={KIT.x - 330} y={KIT.floor} s={1.25} pose={POSES.stand} light="key-left" />
          <g ref={mugRef}>
            <rect x={MUG0.x - 20} y={MUG0.y - 44} width={40} height={44} rx={6} fill="#f2c230" />
            <path d={`M${MUG0.x + 20} ${MUG0.y - 34} q 16 0 16 12 q 0 12 -16 12`} fill="none" stroke="#f2c230" strokeWidth={6} />
          </g>
          <g className="d4-say" opacity={0}>
            <rect x={KIT.x - 560} y={250} width={500} height={74} rx={37} fill={C.ink} fillOpacity={0.75} stroke={C.mist} strokeOpacity={0.5} />
            <text x={KIT.x - 310} y={298} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={28}>
              “Put the yellow mug in the sink.”
            </text>
          </g>
          <g className="d4-done" opacity={0}>
            <Tag x={SINK.x} y={KIT.counter - 140} anchor="middle" color={C.lime} size={24}>
              ✓ done
            </Tag>
          </g>
          <Dust x={-200} y={0} w={3000} h={800} count={40} seed={33} color={C.limeLight} size={0.7} />
        </g>
      </g>

      {/* ================= b2: the café ================= */}
      <g className="d4-cafe" ref={cafeRef} opacity={0} pointerEvents="none">
        <g data-depth="0.3">
          <LabSky seed={21} />
        </g>
        <g data-depth="0.7">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#140f12" opacity={0.6} />
          {[200, 520, 1180, 1460].map((x, i) => (
            <g key={x}>
              <line x1={x} x2={x} y1={-100} y2={120 + (i % 2) * 40} stroke={C.ink3} strokeWidth={2} />
              <circle cx={x} cy={130 + (i % 2) * 40} r={16} fill={C.keyLight} filter="url(#cn-bloom)" />
              <Pool x={x} y={200 + (i % 2) * 40} r={180} color="key" opacity={0.5} />
            </g>
          ))}
        </g>
        <g data-depth="1">
          <Robot name="d4-barista" x={640} y={840} s={1.3} pose={POSES.hold} light="key-right" />
          {/* the counter and the machine */}
          <rect x={-200} y={620} width={2000} height={400} fill="#3a2a1e" />
          <rect x={-200} y={612} width={2000} height={14} fill="#5a412c" />
          <g transform="translate(860 420)">
            <rect x={0} y={0} width={220} height={192} rx={12} fill={C.metal} />
            <rect x={10} y={10} width={200} height={60} rx={8} fill={C.metalDark} />
            <circle cx={60} cy={40} r={14} fill={C.ink} />
            <circle cx={60} cy={40} r={5} fill={C.danger} className="hd-blink" />
            <rect x={70} y={90} width={80} height={24} rx={4} fill={C.ink2} />
            <rect className="d4-shot" x={104} y={114} width={10} height={60} fill="#5a2f14" opacity={0} />
            <rect x={90} y={160} width={40} height={32} rx={4} fill={C.paper} />
          </g>
          {[0, 1, 2].map((k) => (
            <circle key={k} className="d4-steam" cx={970 + k * 10} cy={570} r={8} fill={C.paper} opacity={0.3} filter="url(#cn-dof-1)" />
          ))}
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={1140 + k * 56} y={580} width={40} height={32} rx={4} fill={C.paper} opacity={0.9} />
          ))}
          <g className="d4-fumble" opacity={0}>
            <rect x={1000} y={596} width={40} height={20} rx={4} fill={C.paper} transform="rotate(70 1020 606)" />
            <ellipse cx={1050} cy={616} rx={60} ry={6} fill="#5a2f14" />
            <text x={1020} y={560} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={44} fontWeight={700}>
              ✕
            </text>
          </g>
          <circle className="d4-spark" cx={1020} cy={560} r={10} fill={C.lime} filter="url(#cn-bloom)" opacity={0} />
          {/* the model, learning */}
          <g className="d4-lesson" transform="translate(780 230)">
            <circle r={44} fill={C.ink} stroke={C.lime} strokeWidth={3} />
            {[[-16, -12], [14, -14], [0, 10], [-20, 16], [20, 14]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={6} fill={C.lime} />
            ))}
            <Tag x={0} y={-60} anchor="middle" size={18} color={C.lime}>
              value model
            </Tag>
          </g>
          <g transform="translate(190 190)">
            <text className="d4-count" x={0} y={0} fill={C.paper} fontFamily={MONO} fontSize={32}>
              attempts 0
            </text>
            <text className="d4-rate" x={0} y={44} fill={C.lime} fontFamily={MONO} fontSize={32}>
              success 0%
            </text>
          </g>
          <Label className="d4-lab-recap" x={826} y={236} tx={1010} ty={190} text="π*0.6 with RECAP, Nov 2025" sub="learns from its good and bad attempts" color={C.lime} size={26} />
          <g className="d4-lab-allday" opacity={0}>
            <Tag x={190} y={280} size={22} color={C.mist}>
              espresso, all day, over 90% success
            </Tag>
          </g>
          <Dust x={0} y={100} w={1600} h={600} count={30} seed={17} size={0.8} />
        </g>
      </g>

      {/* ================= b3: the dream ================= */}
      <g className="d4-dream" ref={dreamRef} opacity={0} pointerEvents="none">
        <g data-depth="1">
          <g filter="url(#d4-dreamfx)">
            <rect x={-200} y={-200} width={2000} height={1300} fill="#2a2440" />
            <rect x={-200} y={560} width={2000} height={600} fill="#4a3a5a" />
            <rect x={-200} y={548} width={2000} height={18} fill="#6a5a7a" />
            <rect x={220} y={120} width={360} height={260} fill="#1a2440" stroke="#5a4a7a" strokeWidth={10} />
            <circle cx={400} cy={240} r={70} fill="#ff9ad8" opacity={0.3} />
            <rect x={1200} y={150} width={260} height={160} fill="#5a4a6a" />
            <rect x={1180} y={360} width={300} height={190} fill="#5a4a7a" />
            <rect x={1190} y={372} width={135} height={168} fill="#6a5a8a" />
            <rect x={1335} y={372} width={135} height={168} fill="#6a5a8a" />
            <rect x={120} y={420} width={260} height={130} fill="#3a2f55" />
            <circle cx={180} cy={400} r={40} fill="#4a8a5a" opacity={0.7} />
            <rect x={160} y={410} width={40} height={40} fill="#8a5a3a" />
            <rect x={600} y={548} width={200} height={10} fill="#8a7aa0" />
            <Pool x={800} y={420} r={640} color="magenta" opacity={0.25} />
            <Pool x={900} y={380} r={500} color="cyan" opacity={0.25} />
            {/* the glass and the jug */}
            <path d="M780 548 L770 430 H850 L840 548 Z" fill="#bfe8ff" opacity={0.35} stroke="#dff6ff" strokeWidth={3} />
            <g className="d4-jug">
              <path d="M940 380 L1000 380 L1010 280 Q1040 270 1020 240 L960 240 Q930 250 940 280 Z" fill="#c9e6f2" opacity={0.8} />
              <path d="M940 290 L912 270" stroke="#c9e6f2" strokeWidth={10} />
            </g>
            {/* what the dream thinks pouring looks like */}
            <path className="d4-pour" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d="M915 268 C 880 300 860 340 840 360 C 820 380 800 400 812 440" stroke="#9fe0ff" strokeWidth={10} fill="none" strokeLinecap="round" />
            <path className="d4-pour2" d="M915 268 C 870 300 900 360 960 360 C 1040 360 1060 300 1120 330" stroke="#9fe0ff" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0} />
            <g className="d4-blob" opacity={0}>
              <circle cx={1130} cy={330} r={22} fill="#9fe0ff" opacity={0.8} />
              <circle cx={1170} cy={300} r={12} fill="#9fe0ff" opacity={0.6} />
            </g>
          </g>
          <rect x={-200} y={-200} width={2000} height={1300} fill="url(#cn-vignette)" opacity={0.6} />
          <g transform="translate(110 130)">
            <text x={0} y={0} fill={C.magentaLight} fontFamily={MONO} fontSize={22} opacity={0.8}>
              imagined frame <tspan className="d4-frame">0</tspan>
            </text>
          </g>
          <Label className="d4-lab-dream" x={600} y={250} tx={180} ty={210} text="a world model: what will the camera see next?" color={C.paper} size={26} />
          <Label className="d4-lab-wrong" x={1080} y={340} tx={1180} ty={460} text="water doesn’t do that" color={C.danger} size={28} />
          <g className="d4-lab-1x" opacity={0}>
            <Tag x={1480} y={770} anchor="end" size={24} color={C.paper}>
              world models: 1X world model scored 0% on pouring
            </Tag>
          </g>
        </g>
      </g>

      {/* ================= b4: out of the window, to one lit house ================= */}
      <g className="d4-home" ref={homeRef} opacity={0} pointerEvents="none">
        <g data-depth="0.35">
          <LabSky seed={5} />
          <g className="d4-house" opacity={0}>
            <Pool x={800} y={600} r={260} color="key" opacity={0.9} />
            <path d="M740 640 V 590 L 800 550 L 860 590 V 640 Z" fill={C.ink} />
            <rect x={770} y={600} width={22} height={20} fill={C.keyLight} />
            <rect x={808} y={600} width={22} height={20} fill={C.keyLight} />
          </g>
        </g>
        <g data-depth="0.9" className="d4-room">
          {/* Ada's window and her desk, seen from inside */}
          <path d="M-900 -700 H 2500 V 1600 H -900 Z M 520 200 H 1080 V 700 H 520 Z" fill="#0b1018" fillRule="evenodd" />
          <rect x={790} y={200} width={20} height={500} fill="#0b1018" />
          <rect x={520} y={440} width={560} height={14} fill="#0b1018" />
        </g>
        <g data-depth="1.3" className="d4-room">
          <Monitor x={640} y={300} w={320} h={190}>
            <rect x={640} y={300} width={320} height={190} fill="url(#cn-grid)" opacity={0.3} />
            <path d="M660 460 C 720 380 780 420 840 360 S 920 330 940 320" stroke={C.lime} strokeWidth={3} fill="none" />
          </Monitor>
          <g filter="url(#cn-dof-1)">
            <Person name="d4-ada" x={420} y={960} s={1.4} pose={POSES.type} light="screen" {...ADA} />
          </g>
        </g>
      </g>

      {/* the map: the data branch, and the next stop lighting up */}
      <g className="d4-tree" opacity={0} pointerEvents="none">
        <rect x={0} y={0} width={1600} height={900} fill={C.ink} opacity={0.55} />
        <path d="M300 820 V 120" stroke={C.amber} strokeWidth={5} opacity={0.6} />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <circle key={k} cx={300} cy={760 - k * 120} r={12} fill={C.ink} stroke={C.amber} strokeWidth={4} opacity={0.7} />
        ))}
        <path className="d4-branch" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d="M300 760 C 520 720 640 640 760 590 S 980 470 1100 400 S 1240 300 1280 270" stroke={C.lime} strokeWidth={5} fill="none" />
        {[
          [760, 590, 'The Missing Internet'],
          [950, 488, 'Ways to Get Data'],
          [1100, 400, 'How Robots Learn'],
        ].map(([x, y, t], i) => (
          <g key={i}>
            <circle cx={x as number} cy={y as number} r={14} fill={i === 2 ? C.lime : C.ink} stroke={C.lime} strokeWidth={4} />
            <text x={(x as number) - 24} y={(y as number) + 6} textAnchor="end" fill={C.limeLight} fontFamily={SANS} fontSize={24}>
              {t}
            </text>
          </g>
        ))}
        <g className="d4-homenode">
          <circle className="d4-homenode-glow" cx={1280} cy={270} r={44} fill={C.lime} opacity={0.4} filter="url(#cn-bloom-big)" />
          <circle cx={1280} cy={270} r={20} fill={C.lime} />
        </g>
        <g className="d4-homelab" opacity={0}>
          <text x={1240} y={226} textAnchor="end" fill={C.paper} fontFamily={SERIF} fontSize={44} fontWeight={600}>
            Robots at home
          </text>
          <Tag x={1320} y={320} anchor="middle" size={18} color={C.lime}>
            next on the data branch
          </Tag>
        </g>
        <Tag x={300} y={860} anchor="middle" size={18} color={C.amber}>
          how hands work
        </Tag>
      </g>

      <Vignette />
      <Letterbox className="d4-lb" />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'models',
  title: 'The big models',
  cues: CUES,
  Scene: Ch4Models,
  deeper: [VlaReading],
}
