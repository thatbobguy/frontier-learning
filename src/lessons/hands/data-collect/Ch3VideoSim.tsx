import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, makeHandStore, useHandStore, type FingerName, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { DcDefs, Tag, drive } from './common'
import { VideoSimReading } from './readings'

export const CUES: Cue[] = [
  {
    id: 'head',
    say: 'Cheaper still: just film people from their own point of view. Head cameras on factory workers, smart glasses in kitchens. Tens of thousands of hours, from all over the world.',
  },
  {
    id: 'pose',
    say: 'Software can estimate where every finger joint was from the video, and translate that onto the robot. But a human hand isn’t a robot hand: different finger lengths, a different thumb, no forces at all.',
  },
  {
    id: 'emerge',
    say: 'Still, something surprising happens at scale. Once a robot model has seen enough robot data, adding human video suddenly starts to help a lot. One lab saw its results roughly double.',
  },
  {
    id: 'sim',
    say: 'And then there’s simulation: physics on a computer, faster than real time. OpenAI’s Rubik’s cube hand practised for about thirteen thousand years of simulated time.',
  },
  {
    id: 'random',
    say: 'The trick is to randomise everything: friction, weights, sizes, motor strength. If the robot copes with a thousand slightly wrong worlds, the real one is just one more.',
  },
  {
    id: 'gap',
    say: 'But simulation is weakest exactly where hands live: at contact. Tiny errors in friction flip a grasp from hold to slip. Cloth, food and touch are even harder.',
  },
  {
    id: 'multiply',
    say: 'Where sim shines is multiplying real demonstrations. A couple of hundred human demos can be replayed with the objects moved around, and grown into fifty thousand.',
  },
]

const STATE = [
  'A first-person view from a head camera: our own two hands reach up from the bottom of the frame. Quick cuts: a factory bench (soldering a circuit board), a home kitchen (chopping carrots), a market stall (handing over fruit). A red REC light and a racing timecode. Label: “Egocentric-10K: 2,153 factory workers, 10,000 h, free to use”. Then the frame shrinks into a mosaic of dozens of tiles from many places, and a counter reads tens of thousands of hours. The point: egocentric human video is cheap and hugely diverse.',
  'A single video frame of a hand holding a cup. A lime skeleton fits itself over every finger joint (pose estimation). The skeleton then slides across to a white robot hand with different proportions; lime lines link each fingertip, some of them stretching, and the human thumb’s target is out of the robot thumb’s reach (red). Three labels: “body different” (kinematics), “looks different” (a human hand in the picture, not a robot hand) and “no forces” (video records no pressure). The point: retargeting human motion to a robot is lossy.',
  'A chart on a blueprint grid. Horizontal axis: how much robot data the model has seen. A pale curve (robot data only) rises and flattens. A lime curve (with human video added) follows it until a threshold, then takes off, ending about twice as high. Labels: “×2”, “Physical Intelligence, Dec 2025”, and a note that the curve shape is illustrative. The point: transfer from human video emerges once the model has enough robot data.',
  'Split frame. Left, a blue wireframe world: a grid of dozens of tiny simulated hands, each spinning a Rubik’s cube, with more stretching into the distance, and a counter racing up to “13,000 years of simulated practice”. Right, in warm lamp light, one real robot hand slowly turning a real cube on a table. The point: simulation runs far faster than real time (OpenAI’s Dactyl, 2019).',
  'Domain randomisation. A wireframe robot hand holds a cube; in fast cuts the cube’s colour and size, the hand’s size, the background and readouts for friction, mass and motor strength all jump around. Then the real hand appears in warm light, sitting inside a cloud of faint ghost hands (all the randomised versions). The point: train on many slightly wrong worlds so the real one is just one more.',
  'Split screen: left, the simulation (blue grid), a robot hand grips a box and it holds (lime tick); right, reality (lamp light), the same grip and the box slips and falls (red). Then a towel draped over a rail: in sim it sticks out like a stiff board; in reality it hangs and folds softly. Label: “the reality gap”, plus cloth, food and touch marked as even harder. The point: simulation is weakest at contact, deformable objects and touch.',
  'A simulated tabletop seen from above. One real human demonstration (a lime path from a mug to a tray). Then the mug appears in many new positions and the demo is replayed for each: the copies that fail flash red and are thrown away, the ones that succeed stay lime and stack up into a growing counter. Label: “MimicGen: ~200 → 50,000 demos”. The point: simulation is great at multiplying real demonstrations.',
]

/* ---------- small seeded random ---------- */
const rnd = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/* ---------- POV hands ---------- */
const POV_R = { x: 1010, y: 930 }
const POV_L = { x: 590, y: 930 }
const POVVIEW = { yaw: 176, pitch: 30, roll: 0, s: 2.35 }

/* ---------- the randomised worlds ---------- */
const JITTER = (() => {
  const r = rnd(42)
  const cols = ['#ff5a4f', '#3fd8ff', '#ffd24a', '#b6f03c', '#ff4fb0', '#efe6d6', '#ff9a3c']
  return Array.from({ length: 16 }, () => ({
    col: cols[Math.floor(r() * cols.length)],
    size: 0.7 + r() * 0.7,
    hand: 1.55 + r() * 0.45,
    fric: (0.3 + r() * 1.2).toFixed(2),
    mass: Math.round(50 + r() * 120),
    motor: (0.7 + r() * 0.6).toFixed(2),
    tint: r(),
    rot: -20 + r() * 40,
  }))
})()
const GHOSTS = (() => {
  const r = rnd(7)
  return Array.from({ length: 7 }, (_, i) => ({
    store: makeHandStore({
      pose: { ...GRASPS.tripod, index: [36 + r() * 14, 40 + r() * 10, 20, 2] },
      view: {
        yaw: 40 + r() * 30,
        pitch: -10 + r() * 20,
        roll: -8 + r() * 16,
        s: 1.5 + r() * 0.45,
      },
    }),
    dx: Math.cos(i * 0.9) * (60 + r() * 50),
    dy: Math.sin(i * 0.9) * (40 + r() * 30),
  }))
})()

/* ---------- the demo multiplier ---------- */
const TRAY = { x: 1120, y: 470 }
const DEMO0 = { x: 520, y: 600 }
const COPIES = (() => {
  const r = rnd(11)
  return Array.from({ length: 22 }, (_, i) => ({
    x: 360 + r() * 560,
    y: 240 + r() * 480,
    ok: i % 4 !== 1 && i % 7 !== 3,
  }))
})()
const demoPath = (o: { x: number; y: number }) => {
  const mx = (o.x + TRAY.x) / 2
  const my = Math.min(o.y, TRAY.y) - 120
  return `M${o.x} ${o.y} Q${o.x - 30} ${o.y - 60} ${o.x + 10} ${o.y - 70} Q${mx} ${my} ${TRAY.x} ${TRAY.y}`
}

const RETARGET = (p: HandPose): HandPose => ({
  ...p,
  thumb: [Math.min(40, p.thumb[0]), p.thumb[1] * 0.8, p.thumb[2], p.thumb[3] * 0.6],
})
const CUPGRIP: HandPose = {
  ...GRASPS.power,
  thumb: [72, 38, 22, 20],
  index: [46, 60, 30, 0],
  middle: [50, 64, 32, 0],
  ring: [54, 64, 30, 0],
  little: [58, 62, 30, 4],
}
const BOXGRIP: HandPose = {
  ...GRASPS.claw,
  thumb: [50, 26, 16, 14],
  index: [32, 34, 22, 0],
  middle: [34, 34, 22, 0],
  ring: [34, 34, 22, 0],
  little: [36, 34, 22, 0],
}

export function Ch3VideoSim({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const povRef = useRef<SVGGElement>(null)
  const poseRef = useRef<SVGGElement>(null)
  const chartRef = useRef<SVGGElement>(null)
  const simRef = useRef<SVGGElement>(null)
  const randRef = useRef<SVGGElement>(null)
  const gapRef = useRef<SVGGElement>(null)
  const multRef = useRef<SVGGElement>(null)
  const povR = useHandStore({ pose: GRASPS.relaxed, view: { ...POVVIEW, yaw: 150 } })
  const povL = useHandStore({ pose: GRASPS.relaxed, view: { ...POVVIEW, yaw: 210 } })
  const vid = useHandStore({
    pose: GRASPS.relaxed,
    view: { yaw: 30, pitch: 6, roll: 0, s: 2.2 },
  })
  const rob = useHandStore({
    pose: GRASPS.relaxed,
    view: { yaw: 30, pitch: 6, roll: 0, s: 2.4 },
  })
  const real = useHandStore({
    pose: GRASPS.tripod,
    view: { yaw: 50, pitch: 0, roll: 0, s: 1.6 },
  })
  const simH = useHandStore({
    pose: BOXGRIP,
    view: { yaw: 70, pitch: -6, roll: 180, s: 1.55 },
  })
  const realH = useHandStore({
    pose: BOXGRIP,
    view: { yaw: 70, pitch: -6, roll: 180, s: 1.55 },
  })
  const tipsV = useRef<Partial<Record<FingerName, { x: number; y: number }>>>({})
  const tipsR = useRef<Partial<Record<FingerName, { x: number; y: number }>>>({})
  const slide = useRef({ x: 0 })

  const drawLinks = useCallback(() => {
    const el = poseRef.current
    if (!el) return
    for (const f of ['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]) {
      const a = tipsV.current[f]
      const b = tipsR.current[f]
      if (!a || !b) continue
      const ax = a.x + slide.current.x
      el.querySelector(`.c3-ln-${f}`)?.setAttribute('d', `M${ax.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`)
      if (f === 'thumb') el.querySelector('.c3-thumbmiss')?.setAttribute('transform', `translate(${ax.toFixed(1)} ${a.y.toFixed(1)})`)
      if (f === 'thumb' || f === 'index') el.querySelector(`.c3-nf-${f}`)?.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`)
    }
  }, [])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const camPov = camera(povRef.current, { x: 800, y: 450, zoom: 1.05 })
      const camPose = camera(poseRef.current, { x: 800, y: 450, zoom: 1.1 })
      const camChart = camera(chartRef.current, { x: 800, y: 460, zoom: 1.08 })
      const camSim = camera(simRef.current, { x: 1100, y: 520, zoom: 1.5 })
      const camRand = camera(randRef.current, { x: 800, y: 450, zoom: 1.0 })
      const camGap = camera(gapRef.current, { x: 800, y: 450, zoom: 1.04 })
      const camMult = camera(multRef.current, { x: 800, y: 450, zoom: 1.1 })
      const shots = ['.c3-pov', '.c3-pose', '.c3-chart', '.c3-sim', '.c3-rand', '.c3-gap', '.c3-mult']
      const show = (which: string, at: number) => shots.forEach((s) => tl.set(s, { opacity: s === which ? 1 : 0 }, at + 0.02))

      /* b0: head camera. Quick cuts between places, then a mosaic of many. */
      tl.addLabel('b0', 0)
      show('.c3-pov', 0)
      const scenes = ['.c3-sc-factory', '.c3-sc-kitchen', '.c3-sc-market']
      const poses: [HandPose, HandPose][] = [
        [GRASPS.pinch, GRASPS.relaxed],
        [GRASPS.relaxed, GRASPS.claw],
        [GRASPS.open, GRASPS.lateral],
      ]
      scenes.forEach((s, i) => {
        const at = i * 2.6
        scenes.forEach((o) => tl.set(o, { opacity: o === s ? 1 : 0 }, at + 0.02))
        camPov.to(tl, { x: 800 + (i - 1) * 40, y: 470, zoom: 1.08 }, at, 0.001)
        camPov.to(tl, { x: 800 + (i - 1) * 40 + 30, y: 440, zoom: 1.16 }, at + 0.01, 2.6, 'sine.inOut')
        povR.to(tl, { pose: poses[i][0] }, at + 0.1, 0.9)
        povL.to(tl, { pose: poses[i][1] }, at + 0.25, 0.9)
        povR.to(tl, { view: { roll: -8 + i * 6 } }, at + 0.8, 1.6, 'sine.inOut')
      })
      tl.fromTo(
        '.c3-pov-bob',
        { y: 0 },
        {
          y: 10,
          duration: 0.65,
          yoyo: true,
          repeat: 11,
          ease: 'sine.inOut',
          immediateRender: false,
        },
        0,
      )
      drive(tl, 0, 7.8, (u) => {
        const t = el?.querySelector('.c3-tc')
        const sec = Math.floor(3 * 3600 + 12 * 60 + u * 9000)
        if (t) t.textContent = `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
      })
      fade(tl, '.c3-lab-ego', 1, 0.3, 0.4)
      fade(tl, '.c3-lab-ego', 0, 2.3, 0.3, 1)
      // the mosaic
      const m0 = 7.8
      fade(tl, '.c3-mosaic', 1, m0, 0.3)
      fade(tl, '.c3-povframe', 0, m0 + 0.2, 0.4, 1)
      tl.fromTo(
        '.c3-mosaic-g',
        { scale: 7.2, svgOrigin: '800 450' },
        {
          scale: 1,
          duration: 2.6,
          ease: 'power3.inOut',
          immediateRender: false,
          svgOrigin: '800 450',
        },
        m0,
      )
      fade(tl, '.c3-hours', 1, m0 + 1.6, 0.6)
      drive(
        tl,
        m0 + 1.6,
        2.4,
        (u) => {
          const t = el?.querySelector('.c3-hours-n')
          if (t) t.textContent = `${Math.round(u * 20000).toLocaleString('en-US')}+ hours`
        },
        'power2.out',
      )

      /* b1: pose from video, retargeted onto a robot hand with a different body. */
      const b1 = 12.2
      tl.addLabel('b1', b1)
      show('.c3-pose', b1)
      camPose.to(tl, { x: 560, y: 450, zoom: 1.3 }, b1, 0.001)
      camPose.to(tl, { x: 600, y: 450, zoom: 1.25 }, b1 + 0.01, 3.2, 'sine.inOut')
      vid.to(tl, { pose: CUPGRIP }, b1 + 0.2, 1.4)
      tl.fromTo('.c3-scan', { y: -330 }, { y: 330, duration: 1.4, ease: 'none', immediateRender: false }, b1 + 1.4)
      fade(tl, '.c3-scan', 1, b1 + 1.4, 0.1)
      fade(tl, '.c3-scan', 0, b1 + 2.8, 0.2, 1)
      fade(tl, '.c3-bones', 1, b1 + 1.6, 1.0)
      fade(tl, '.c3-lab-pose', 1, b1 + 2.2, 0.5)
      fade(tl, '.c3-lab-pose', 0, b1 + 4.4, 0.3, 1)
      camPose.to(tl, { x: 800, y: 460, zoom: 1.0 }, b1 + 3.6, 2.2, 'power2.inOut')
      // the skeleton lifts off and flies to the robot hand
      tl.fromTo(
        slide.current,
        { x: 0 },
        {
          x: 640,
          duration: 2.0,
          ease: 'power2.inOut',
          immediateRender: false,
          onUpdate: () => {
            el?.querySelector('.c3-bonesfly')?.setAttribute('transform', `translate(${slide.current.x.toFixed(1)} 0)`)
            drawLinks()
          },
        },
        b1 + 4.0,
      )
      fade(tl, '.c3-bonesfly', 0.9, b1 + 4.0, 0.3)
      rob.to(tl, { pose: RETARGET(CUPGRIP) }, b1 + 5.6, 1.2)
      fade(tl, '.c3-links', 1, b1 + 6.0, 0.5)
      fade(tl, '.c3-thumbmiss', 1, b1 + 6.8, 0.4)
      fade(tl, '.c3-lab-body', 1, b1 + 7.6, 0.5)
      fade(tl, '.c3-lab-looks', 1, b1 + 9.0, 0.5)
      fade(tl, '.c3-lab-force', 1, b1 + 10.4, 0.5)
      tl.fromTo('.c3-noforce', { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, b1 + 10.4)

      /* b2: emergence: adding human video only helps once there's enough robot data. */
      const b2 = b1 + 13.6
      tl.addLabel('b2', b2)
      show('.c3-chart', b2)
      camChart.to(tl, { x: 800, y: 460, zoom: 1.08 }, b2, 0.001)
      camChart.to(tl, { x: 820, y: 440, zoom: 1.0 }, b2 + 0.01, 12, 'sine.inOut')
      fade(tl, '.c3-axes', 1, b2 + 0.2, 0.6)
      tl.fromTo(
        '.c3-curve-r',
        { strokeDashoffset: 1400 },
        {
          strokeDashoffset: 0,
          duration: 3.2,
          ease: 'power1.inOut',
          immediateRender: false,
        },
        b2 + 0.8,
      )
      fade(tl, '.c3-lab-ronly', 1, b2 + 3.4, 0.5)
      tl.fromTo(
        '.c3-curve-h',
        { strokeDashoffset: 1400 },
        {
          strokeDashoffset: 0,
          duration: 4.4,
          ease: 'power1.in',
          immediateRender: false,
        },
        b2 + 4.4,
      )
      fade(tl, '.c3-curve-h-g', 1, b2 + 4.4, 0.2)
      fade(tl, '.c3-thresh', 1, b2 + 6.2, 0.6)
      fade(tl, '.c3-lab-hv', 1, b2 + 8.2, 0.5)
      fade(tl, '.c3-x2', 1, b2 + 9.0, 0.5)
      tl.fromTo(
        '.c3-x2',
        { scale: 0.5, svgOrigin: '1310 260' },
        {
          scale: 1,
          duration: 0.6,
          ease: 'back.out(3)',
          immediateRender: false,
          svgOrigin: '1310 260',
        },
        b2 + 9.0,
      )
      fade(tl, '.c3-lab-pi', 1, b2 + 10.0, 0.5)

      /* b3: simulation: thousands of hands, far faster than real time; one real hand, slowly. */
      const b3 = b2 + 13
      tl.addLabel('b3', b3)
      show('.c3-sim', b3)
      camSim.to(tl, { x: 1260, y: 520, zoom: 1.7 }, b3, 0.001)
      camSim.to(tl, { x: 800, y: 450, zoom: 1.0 }, b3 + 0.6, 4.2, 'power2.inOut')
      real.to(tl, { pose: { ...GRASPS.tripod, index: [46, 50, 24, 2] } }, b3, 2.4, 'sine.inOut')
      real.to(tl, { pose: GRASPS.tripod }, b3 + 2.4, 2.4, 'sine.inOut')
      real.to(tl, { pose: { ...GRASPS.tripod, index: [46, 50, 24, 2] } }, b3 + 4.8, 2.4, 'sine.inOut')
      real.to(tl, { pose: GRASPS.tripod }, b3 + 7.2, 2.4, 'sine.inOut')
      tl.fromTo(
        '.c3-realcube',
        { rotation: 0, svgOrigin: '1300 640' },
        {
          rotation: 90,
          duration: 10,
          ease: 'none',
          immediateRender: false,
          svgOrigin: '1300 640',
        },
        b3,
      )
      fade(tl, '.c3-simcount', 1, b3 + 1.6, 0.5)
      drive(tl, b3 + 1.8, 6, (u) => {
        const t = el?.querySelector('.c3-simyears')
        if (t) t.textContent = `${Math.round(Math.pow(u, 2.2) * 13000).toLocaleString('en-US')} years`
      })
      fade(tl, '.c3-lab-real', 1, b3 + 1.0, 0.5)
      fade(tl, '.c3-lab-dactyl', 1, b3 + 7.6, 0.5)

      /* b4: randomise everything; the real world sits inside the spread. */
      const b4 = b3 + 10.6
      tl.addLabel('b4', b4)
      show('.c3-rand', b4)
      tl.set('.c3-cloud', { opacity: 0 }, b4)
      camRand.to(tl, { x: 800, y: 450, zoom: 1.0 }, b4, 0.001)
      JITTER.forEach((j, i) => {
        const at = b4 + 0.3 + i * 0.42
        tl.set('.c3-jcube', { attr: { fill: j.col } }, at)
        tl.set('.c3-jcubeg', { scale: j.size, svgOrigin: '770 480' }, at)
        tl.set('.c3-jtint', { opacity: j.tint * 0.14 }, at)
        tl.set('.c3-jhand', { rotation: j.rot, svgOrigin: '800 760' }, at)
        tl.set('.c3-r-fric', { textContent: j.fric }, at)
        tl.set('.c3-r-mass', { textContent: `${j.mass} g` }, at)
        tl.set('.c3-r-motor', { textContent: `×${j.motor}` }, at)
        simH.to(tl, { view: { s: j.hand } }, at, 0.05, 'none')
        camRand.shake(tl, at, 0.25, 0.12)
      })
      fade(tl, '.c3-readouts', 1, b4 + 0.3, 0.3)
      const c0 = b4 + 7.4
      fade(tl, '.c3-randhand', 0, c0, 0.6, 1)
      fade(tl, '.c3-readouts', 0, c0, 0.4, 1)
      fade(tl, '.c3-cloud', 1, c0 + 0.2, 1.0)
      tl.fromTo('.c3-ghost', { opacity: 0 }, { opacity: 0.55, duration: 0.3, stagger: 0.12, immediateRender: false }, c0 + 0.4)
      fade(tl, '.c3-realwarm', 1, c0 + 1.6, 0.8)
      fade(tl, '.c3-lab-onemore', 1, c0 + 2.6, 0.6)
      camRand.to(tl, { x: 800, y: 480, zoom: 1.15 }, c0, 5, 'sine.inOut')

      /* b5: the reality gap. Holds in sim, slips in reality; a towel like a board. */
      const b5 = b4 + 13
      tl.addLabel('b5', b5)
      show('.c3-gap', b5)
      tl.set('.c3-gap-towel', { opacity: 0 }, b5)
      tl.set('.c3-gap-grip', { opacity: 1 }, b5)
      camGap.to(tl, { x: 800, y: 450, zoom: 1.04 }, b5, 0.001)
      tl.fromTo('.c3-gh', { y: -260 }, { y: 0, duration: 1.0, ease: 'power2.out', immediateRender: false }, b5 + 0.2)
      simH.to(tl, { pose: BOXGRIP, view: { s: 1.55 } }, b5, 0.01)
      // both hands squeeze and lift
      tl.fromTo(
        '.c3-lift',
        { y: 0 },
        {
          y: -160,
          duration: 1.2,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        b5 + 1.6,
      )
      tl.fromTo(
        '.c3-box-sim',
        { y: 0 },
        {
          y: -160,
          duration: 1.2,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        b5 + 1.6,
      )
      tl.fromTo(
        '.c3-box-real',
        { y: 0 },
        {
          y: -110,
          duration: 1.0,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        b5 + 1.6,
      )
      tl.fromTo(
        '.c3-box-real',
        { y: -110, rotation: 0 },
        {
          y: 30,
          rotation: 24,
          duration: 0.6,
          ease: 'power2.in',
          svgOrigin: '1200 650',
          immediateRender: false,
        },
        b5 + 2.6,
      )
      camGap.shake(tl, b5 + 3.2, 0.7, 0.35)
      fade(tl, '.c3-ok', 1, b5 + 2.9, 0.3)
      fade(tl, '.c3-slip', 1, b5 + 3.1, 0.3)
      fade(tl, '.c3-lab-fric', 1, b5 + 3.6, 0.5)
      // the towel
      const tw = b5 + 5.6
      tl.set('.c3-gap-grip', { opacity: 0 }, tw)
      tl.set('.c3-gap-towel', { opacity: 1 }, tw)
      tl.fromTo(
        '.c3-towel-real',
        { scaleY: 0.2, svgOrigin: '1200 360' },
        {
          scaleY: 1,
          duration: 1.2,
          ease: 'bounce.out',
          immediateRender: false,
          svgOrigin: '1200 360',
        },
        tw + 0.3,
      )
      tl.fromTo(
        '.c3-towel-sim',
        { rotation: 0, svgOrigin: '400 360' },
        {
          rotation: -3,
          duration: 1.2,
          ease: 'power2.out',
          immediateRender: false,
          svgOrigin: '400 360',
        },
        tw + 0.3,
      )
      fade(tl, '.c3-lab-gap', 1, tw + 1.4, 0.6)
      tl.fromTo(
        '.c3-harder',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.5,
          immediateRender: false,
        },
        tw + 2.6,
      )

      /* b6: multiply real demos: replay with the object moved, keep the ones that work. */
      const b6 = b5 + 11.2
      tl.addLabel('b6', b6)
      show('.c3-mult', b6)
      camMult.to(tl, { x: 800, y: 450, zoom: 1.1 }, b6, 0.001)
      camMult.to(tl, { x: 840, y: 450, zoom: 1.0 }, b6 + 0.01, 11, 'sine.inOut')
      tl.fromTo(
        '.c3-demo0',
        { strokeDashoffset: 900 },
        {
          strokeDashoffset: 0,
          duration: 1.8,
          ease: 'power1.inOut',
          immediateRender: false,
        },
        b6 + 0.4,
      )
      fade(tl, '.c3-lab-demo', 1, b6 + 1.2, 0.5)
      fade(tl, '.c3-lab-demo', 0, b6 + 3.4, 0.3, 1)
      COPIES.forEach((c, i) => {
        const at = b6 + 2.6 + i * 0.28
        fade(tl, `.c3-cp-${i}`, 1, at, 0.2)
        tl.fromTo(
          `.c3-cpp-${i}`,
          { strokeDashoffset: 900 },
          {
            strokeDashoffset: 0,
            duration: 0.6,
            ease: 'power1.inOut',
            immediateRender: false,
          },
          at,
        )
        if (!c.ok) {
          tl.to(`.c3-cpp-${i}`, { stroke: C.danger, duration: 0.1 }, at + 0.6)
          fade(tl, `.c3-cp-${i}`, 0, at + 1.0, 0.4, 1)
        }
      })
      fade(tl, '.c3-stack', 1, b6 + 3, 0.4)
      drive(tl, b6 + 3, 7.2, (u) => {
        const t = el?.querySelector('.c3-stack-n')
        if (t) t.textContent = Math.round(200 + Math.pow(u, 1.8) * 49800).toLocaleString('en-US')
        const bar = el?.querySelector('.c3-stack-bar')
        bar?.setAttribute('height', String(Math.round(10 + u * 420)))
        bar?.setAttribute('y', String(Math.round(760 - 10 - u * 420)))
      })
      fade(tl, '.c3-lab-mimic', 1, b6 + 7.4, 0.6)
      letterbox(tl, '.c3-lb', true, b6 + 9.6)
      tl.to({}, { duration: 0.4 }, b6 + 11.4)
    },
    [povR, povL, vid, rob, real, simH, drawLinks],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c3-rec', {
      opacity: 0.15,
      duration: 0.6,
      yoyo: true,
      repeat: -1,
      ease: 'steps(1)',
    })
    gsap.to('.c3-hum', {
      opacity: 0.7,
      duration: 1.7,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
    gsap.to('.c3-drift', {
      x: 18,
      duration: 6,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
    gsap.to('.c3-pulse', {
      opacity: 0.35,
      duration: 1.2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      <DcDefs />
      <style>{`
        .c3-spin { transform-box: fill-box; transform-origin: center; animation: c3-spin 1.4s linear infinite; }
        @keyframes c3-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .flow-paused .c3-spin { animation-play-state: paused; }
      `}</style>

      {/* ---------------- point of view: head camera ---------------- */}
      <g className="c3-pov" ref={povRef} pointerEvents="none">
        <g className="c3-povframe">
          <g data-depth="0.7">
            <g className="c3-sc-factory">
              <rect x={-600} y={-500} width={2800} height={1900} fill="#1d2a2a" />
              <rect x={-600} y={-500} width={2800} height={760} fill="#121c22" />
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={-100 + i * 480} y={-60} width={300} height={22} rx={8} fill="#e9fbff" opacity={0.8} filter="url(#cn-bloom)" />
              ))}
              <rect x={-600} y={180} width={2800} height={60} fill="#263236" />
              <g className="c3-drift">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <rect key={i} x={-200 + i * 330} y={120} width={120} height={60} fill="#5a4630" />
                ))}
              </g>
              <rect x={360} y={420} width={880} height={420} rx={10} fill="#1f5a3a" />
              {Array.from({ length: 18 }, (_, i) => (
                <rect key={i} x={400 + (i % 6) * 140} y={460 + Math.floor(i / 6) * 120} width={70} height={46} rx={4} fill="#0d1d18" stroke="#b9c47a" strokeWidth={2} />
              ))}
              <path d="M400 640 H1200 M500 460 V820 M900 460 V820" stroke="#d4b25a" strokeWidth={3} opacity={0.6} />
              <circle cx={1160} cy={560} r={14} fill={C.key} filter="url(#cn-bloom)" className="c3-pulse" />
            </g>
            <g className="c3-sc-kitchen" opacity={0}>
              <rect x={-600} y={-500} width={2800} height={1900} fill="#2a2018" />
              <rect x={-600} y={-500} width={2800} height={640} fill="#1a1612" />
              <Pool x={800} y={200} r={700} color="key" opacity={0.6} />
              <rect x={300} y={380} width={1000} height={520} rx={30} fill="#8a5a32" />
              <rect x={300} y={380} width={1000} height={18} rx={9} fill="#a8723e" />
              {[0, 1, 2, 3, 4].map((i) => (
                <ellipse key={i} cx={560 + i * 90} cy={600 + (i % 2) * 20} rx={42} ry={16} fill="#f07b22" />
              ))}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <circle key={i} cx={980 + (i % 3) * 30} cy={520 + Math.floor(i / 3) * 30} r={14} fill="#f59a3a" />
              ))}
              <path d="M1060 760 L1380 640 L1394 660 L1080 790 Z" fill={C.metal} />
              <ellipse cx={180} cy={300} rx={140} ry={60} fill="#cfd8e2" />
            </g>
            <g className="c3-sc-market" opacity={0}>
              <rect x={-600} y={-500} width={2800} height={1900} fill="#1b2230" />
              {Array.from({ length: 14 }, (_, i) => (
                <rect key={i} x={-300 + i * 160} y={-200} width={80} height={330} fill={i % 2 ? '#c2412f' : '#e9e2d2'} opacity={0.85} />
              ))}
              <rect x={-600} y={120} width={2800} height={30} fill={C.ink1} />
              {[0, 1, 2].map((k) => (
                <g key={k} transform={`translate(${220 + k * 420} 360)`}>
                  <rect x={0} y={0} width={360} height={260} fill="#6b4a2a" />
                  {Array.from({ length: 12 }, (_, i) => (
                    <circle key={i} cx={40 + (i % 4) * 92} cy={50 + Math.floor(i / 4) * 80} r={34} fill={['#d8402f', '#f2a516', '#b6d23c'][k]} />
                  ))}
                </g>
              ))}
              <ellipse cx={800} cy={760} rx={140} ry={40} fill={C.ink3} />
              {[0, 1, 2, 3].map((i) => (
                <ellipse key={i} cx={740 + i * 36} cy={752} rx={16} ry={8} fill={C.gold} />
              ))}
            </g>
          </g>
          <g data-depth="1">
            <g className="c3-pov-bob">
              <Hand3D store={povL} x={POV_L.x} y={POV_L.y} look="human" left arm={360} light={[-0.6, -0.8]} />
              <Hand3D store={povR} x={POV_R.x} y={POV_R.y} look="human" arm={360} light={[-0.6, -0.8]} />
            </g>
          </g>
          {/* the camera's own lens: fisheye darkening and a REC light */}
          <rect x={0} y={0} width={1600} height={900} fill="url(#cn-vignette)" />
          <rect x={0} y={0} width={1600} height={900} fill="url(#cn-vignette)" />
          <circle className="c3-rec" cx={80} cy={70} r={11} fill={C.danger} />
          <Tag x={104} y={78} color={C.paper} size={24}>
            REC
          </Tag>
          <Tag className="c3-tc" x={1520} y={78} anchor="end" color={C.paper} size={24}>
            03:12:00
          </Tag>
          <g className="c3-lab-ego" opacity={0}>
            <text x={80} y={820} fill={C.lime} fontFamily={SANS} fontSize={30} fontWeight={600} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6}>
              Egocentric-10K
            </text>
            <text x={80} y={856} fill={C.limeLight} fontFamily={MONO} fontSize={22} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={5}>
              2,153 factory workers · 10,000 h · free to use
            </text>
          </g>
        </g>
        <g className="c3-mosaic" opacity={0}>
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <g className="c3-mosaic-g">
            {Array.from({ length: 63 }, (_, i) => {
              const c = i % 9
              const r = Math.floor(i / 9)
              const x = 800 + (c - 4) * 176 - 80
              const y = 450 + (r - 3) * 104 - 46
              const tone = ['#1f5a3a', '#8a5a32', '#6b4a2a', '#2a3a5a', '#5a2f3a', '#3a4a2a', '#4a3a5a'][(i * 5) % 7]
              return (
                <g key={i}>
                  <rect x={x} y={y} width={160} height={92} rx={4} fill={tone} />
                  <path d={`M${x + 50} ${y + 92} q 6 -40 20 -44 M${x + 110} ${y + 92} q -6 -40 -20 -44`} stroke={C.skinB} strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.85} />
                  <circle cx={x + 12} cy={y + 12} r={3.5} fill={C.danger} />
                </g>
              )
            })}
          </g>
          <g className="c3-hours" opacity={0}>
            <text className="c3-hours-n" x={800} y={470} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={84} fontWeight={600} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={12}>
              0 hours
            </text>
            <text x={800} y={530} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={30} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={8}>
              of people’s own view of their hands, from all over the world
            </text>
          </g>
        </g>
      </g>

      {/* ---------------- pose from video → robot ---------------- */}
      <g className="c3-pose" ref={poseRef} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          {/* the video frame */}
          <rect x={300} y={120} width={520} height={780} rx={6} fill="#3a2a20" />
          <Pool x={540} y={380} r={360} color="key" opacity={0.7} />
          <rect x={300} y={640} width={520} height={260} fill="#5a3f2c" />
          <rect x={300} y={120} width={520} height={780} rx={6} fill="none" stroke={C.paper} strokeWidth={3} />
          <g opacity={0.9} transform="translate(0 70)">
            <path d="M560 500 h96 v118 a10 10 0 0 1 -10 10 h-76 a10 10 0 0 1 -10 -10 Z" fill="#cfd8e2" />
            <path d="M656 520 q 36 0 36 30 q 0 30 -36 30" fill="none" stroke="#cfd8e2" strokeWidth={10} />
          </g>
          <Hand3D
            store={vid}
            x={540}
            y={840}
            look="human"
            arm={200}
            light={[-0.7, -0.6]}
            onTips={(t) => {
              tipsV.current = t
              drawLinks()
            }}
          />
          <g className="c3-bones" opacity={0} filter="url(#dc-limeline)">
            <Hand3D store={vid} x={540} y={840} look="bones" arm={0} />
          </g>
          <rect className="c3-scan" x={300} y={450} width={520} height={6} fill={C.lime} opacity={0} filter="url(#cn-bloom)" />
          <Tag x={316} y={152} color={C.paper} size={18}>
            frame 1,204
          </Tag>
          <Label className="c3-lab-pose" x={600} y={360} tx={880} ty={240} text="estimated: every finger joint" color={C.lime} />
          {/* the robot hand: a different body */}
          <Pool x={1180} y={460} r={360} color="rim" opacity={0.45} />
          <Hand3D
            store={rob}
            x={1180}
            y={860}
            look="robot"
            arm={200}
            light={[0.8, -0.5]}
            onTips={(t) => {
              tipsR.current = t
              drawLinks()
            }}
          />
          <g className="c3-bonesfly" opacity={0} filter="url(#dc-limeline)">
            <Hand3D store={vid} x={540} y={840} look="bones" arm={0} />
          </g>
          <g className="c3-links" opacity={0}>
            {(['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]).map((f) => (
              <path key={f} className={`c3-ln-${f}`} d="" stroke={f === 'thumb' ? C.danger : C.lime} strokeWidth={2.5} strokeDasharray="4 5" />
            ))}
          </g>
          <g className="c3-thumbmiss" opacity={0}>
            <circle r={22} fill="none" stroke={C.danger} strokeWidth={3} />
            <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke={C.danger} strokeWidth={3} />
          </g>
          <Label className="c3-lab-body" x={1240} y={640} tx={1300} ty={200} text="body different" sub="finger lengths, thumb" color={C.bone} />
          <Label className="c3-lab-looks" x={470} y={700} tx={330} ty={850} text="looks different" sub="a human hand in the picture" color={C.keyLight} />
          <g className="c3-noforce" opacity={0}>
            <circle className="c3-nf-thumb" r={22} fill="none" stroke={C.magenta} strokeWidth={3} strokeDasharray="4 4" />
            <circle className="c3-nf-index" r={22} fill="none" stroke={C.magenta} strokeWidth={3} strokeDasharray="4 4" />
          </g>
          <Label className="c3-lab-force" x={1110} y={720} tx={940} ty={850} text="no forces" sub="video can’t record a squeeze" color={C.magenta} />
        </g>
      </g>

      {/* ---------------- emergence chart ---------------- */}
      <g className="c3-chart" ref={chartRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c3-axes" opacity={0}>
            <line x1={260} y1={760} x2={1400} y2={760} stroke={C.mist} strokeWidth={3} markerEnd="url(#cn-arrow)" />
            <line x1={260} y1={760} x2={260} y2={130} stroke={C.mist} strokeWidth={3} markerEnd="url(#cn-arrow)" />
            <text x={1400} y={810} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={26}>
              robot data the model has seen →
            </text>
            <text x={230} y={140} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={26} transform="rotate(-90 230 140)">
              success on the task →
            </text>
          </g>
          <path className="c3-curve-r" d="M260 740 C 500 620 700 520 900 500 S 1200 488 1380 486" fill="none" stroke={C.paper} strokeWidth={5} strokeDasharray="1400" strokeDashoffset={1400} opacity={0.75} />
          <g className="c3-curve-h-g" opacity={0}>
            <path
              className="c3-curve-h"
              d="M260 744 C 500 626 700 526 860 506 C 1000 490 1060 380 1160 300 S 1320 250 1380 246"
              fill="none"
              stroke={C.lime}
              strokeWidth={6}
              strokeDasharray="1400"
              strokeDashoffset={1400}
              filter="url(#cn-bloom)"
            />
          </g>
          <g className="c3-thresh" opacity={0}>
            <line x1={880} y1={760} x2={880} y2={180} stroke={C.limeLight} strokeWidth={2} strokeDasharray="8 8" />
            <text x={890} y={200} fill={C.limeLight} fontFamily={SANS} fontSize={24}>
              enough robot data
            </text>
          </g>
          <Label className="c3-lab-ronly" x={1260} y={488} tx={1250} ty={570} text="robot data only: flattens" color={C.paper} />
          <Label className="c3-lab-hv" x={1080} y={360} tx={1000} ty={300} text="+ human video" color={C.lime} />
          <g className="c3-x2" opacity={0}>
            <path d="M1330 480 L1330 268" stroke={C.gold} strokeWidth={3} markerEnd="url(#cn-arrow)" />
            <text x={1350} y={390} fill={C.gold} fontFamily={MONO} fontSize={44} fontWeight={600}>
              ×2
            </text>
          </g>
          <g className="c3-lab-pi" opacity={0}>
            <text x={290} y={180} fill={C.paper} fontFamily={SANS} fontSize={28} fontWeight={600}>
              Physical Intelligence, Dec 2025
            </text>
            <text x={290} y={214} fill={C.mist} fontFamily={MONO} fontSize={18}>
              human→robot transfer emerged with scale · curve shape illustrative
            </text>
          </g>
        </g>
      </g>

      {/* ---------------- simulation at scale ---------------- */}
      <g className="c3-sim" ref={simRef} opacity={0} pointerEvents="none">
        <g data-depth="0.6">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#06101e" />
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-grid)" opacity={0.6} />
          {/* far rows, too many to count: a pattern of tiny cells */}
          <pattern id="c3-cells" width={44} height={36} patternUnits="userSpaceOnUse">
            <rect x={12} y={14} width={14} height={14} fill="none" stroke={C.cyan} strokeWidth={1} opacity={0.5} />
            <rect x={16} y={6} width={8} height={8} fill={C.cyan} opacity={0.35} />
          </pattern>
          <rect x={-600} y={-500} width={1660} height={700} fill="url(#c3-cells)" opacity={0.5} />
        </g>
        <g data-depth="1">
          {Array.from({ length: 48 }, (_, i) => {
            const c = i % 8
            const r = Math.floor(i / 8)
            const x = 70 + c * 112
            const y = 260 + r * 104
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <path d="M0 40 L0 10 M10 40 L10 0 M20 40 L20 -2 M30 40 L30 4 M38 44 L50 26 M-4 40 H40 V70 H-4 Z" stroke={C.cyan} strokeWidth={2} fill="none" opacity={0.75} />
                <g transform="translate(18 -14)">
                  <g
                    className="c3-spin"
                    style={{
                      animationDuration: `${0.9 + ((i * 7) % 10) / 6}s`,
                      animationDirection: i % 2 ? 'reverse' : 'normal',
                    }}
                  >
                    <rect x={-12} y={-12} width={24} height={24} fill="none" stroke={C.cyanLight} strokeWidth={1.6} />
                    <path d="M-4 -12 V12 M4 -12 V12 M-12 -4 H12 M-12 4 H12" stroke={C.cyan} strokeWidth={1} />
                  </g>
                </g>
              </g>
            )
          })}
          <g className="c3-simcount" opacity={0}>
            <text x={70} y={150} fill={C.cyanLight} fontFamily={MONO} fontSize={22}>
              simulated practice
            </text>
            <text className="c3-simyears" x={70} y={210} fill={C.paper} fontFamily={MONO} fontSize={56} fontWeight={600}>
              0 years
            </text>
          </g>
          {/* the real hand, on the right, in lamp light */}
          <rect x={1020} y={-500} width={1200} height={1900} fill={C.ink1} />
          <line x1={1020} y1={-100} x2={1020} y2={1000} stroke={C.paper} strokeWidth={2} opacity={0.3} />
          <g className="c3-hum">
            <Pool x={1300} y={560} r={360} color="key" opacity={0.95} />
          </g>
          <rect x={1020} y={720} width={1200} height={400} fill={C.ink2} />
          <rect x={1020} y={720} width={1200} height={4} fill={C.keyDeep} opacity={0.6} />
          <g className="c3-realcube">
            <rect x={1268} y={608} width={64} height={64} rx={6} fill={C.ink} />
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={1271 + (i % 3) * 20} y={611 + Math.floor(i / 3) * 20} width={18} height={18} rx={3} fill={['#ff5a4f', '#ffd24a', '#3fd8ff', '#efe6d6', '#b6f03c', '#ff9a3c'][(i * 4) % 6]} />
            ))}
          </g>
          <Hand3D store={real} x={1300} y={860} look="robot" arm={200} light={[0.8, -0.5]} />
          <Label className="c3-lab-real" x={1300} y={600} tx={1180} ty={180} text="the real hand: real time" color={C.keyLight} />
          <Label className="c3-lab-dactyl" x={520} y={780} tx={600} ty={836} text="OpenAI’s Dactyl, 2019" sub="~13,000 years in simulation" color={C.cyanLight} />
        </g>
      </g>

      {/* ---------------- domain randomisation ---------------- */}
      <g className="c3-rand" ref={randRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
          <rect className="c3-jtint" x={-600} y={-500} width={2800} height={1900} fill={C.bone} opacity={0} />
        </g>
        <g data-depth="1">
          <g className="c3-randhand">
            <g className="c3-jhand">
              <g className="c3-jcubeg">
                <rect className="c3-jcube" x={730} y={440} width={80} height={80} rx={6} fill={C.cyan} opacity={0.85} />
                <rect x={730} y={440} width={80} height={80} rx={6} fill="none" stroke={C.cyanLight} strokeWidth={2} />
              </g>
              <Hand3D store={simH} x={800} y={160} look="xray" arm={260} />
            </g>
            <g className="c3-readouts" opacity={0}>
              {[
                ['friction', 'c3-r-fric', '0.80'],
                ['cube mass', 'c3-r-mass', '90 g'],
                ['motor strength', 'c3-r-motor', '×1.00'],
              ].map(([k, cls, v], i) => (
                <g key={k}>
                  <text x={1130} y={300 + i * 70} fill={C.mist} fontFamily={SANS} fontSize={24}>
                    {k}
                  </text>
                  <text className={cls} x={1130} y={334 + i * 70} fill={C.cyanLight} fontFamily={MONO} fontSize={30}>
                    {v}
                  </text>
                </g>
              ))}
              <text x={1130} y={560} fill={C.mist} fontFamily={MONO} fontSize={20}>
                world #<tspan fill={C.paper}>…</tspan>
              </text>
            </g>
          </g>
          <g className="c3-cloud" opacity={0}>
            {GHOSTS.map((g, i) => (
              <g key={i} className="c3-ghost" opacity={0} filter="url(#dc-cyan)">
                <Hand3D store={g.store} x={800 + g.dx} y={720 + g.dy} look="silhouette" arm={160} />
              </g>
            ))}
            <g className="c3-realwarm" opacity={0}>
              <Pool x={800} y={520} r={300} color="key" opacity={0.7} />
              <Hand3D store={real} x={800} y={720} look="robot" arm={160} light={[0.8, -0.5]} />
            </g>
            <Label className="c3-lab-onemore" x={860} y={430} tx={1060} ty={300} text="the real world: just one more" color={C.keyLight} />
          </g>
        </g>
      </g>

      {/* ---------------- the reality gap ---------------- */}
      <g className="c3-gap" ref={gapRef} opacity={0} pointerEvents="none">
        <g data-depth="0.6">
          <rect x={-600} y={-500} width={1400} height={1900} fill="#06101e" />
          <rect x={-600} y={-500} width={1400} height={1900} fill="url(#cn-grid)" opacity={0.6} />
          <rect x={800} y={-500} width={1400} height={1900} fill={C.ink1} />
          <Pool x={1200} y={480} r={420} color="key" opacity={0.85} />
        </g>
        <g data-depth="1">
          <line x1={800} y1={-200} x2={800} y2={1100} stroke={C.paper} strokeWidth={2} opacity={0.35} />
          <text x={80} y={170} fill={C.cyanLight} fontFamily={SANS} fontSize={30} fontWeight={600}>
            simulation
          </text>
          <text x={1520} y={170} textAnchor="end" fill={C.keyLight} fontFamily={SANS} fontSize={30} fontWeight={600}>
            reality
          </text>
          <g className="c3-gap-grip">
            <line x1={80} y1={720} x2={720} y2={720} stroke={C.cyan} strokeWidth={2} />
            <rect x={880} y={720} width={640} height={300} fill={C.ink2} />
            <g className="c3-box-sim">
              <rect x={350} y={600} width={100} height={120} fill="none" stroke={C.cyanLight} strokeWidth={2.5} />
              <path d="M350 600 L380 580 L480 580 L450 600 M480 580 V700 L450 720" fill="none" stroke={C.cyanLight} strokeWidth={2} />
            </g>
            <g className="c3-box-real">
              <rect x={1150} y={600} width={100} height={120} fill="#b98a55" />
              <rect x={1150} y={600} width={100} height={14} fill="#d6a86c" />
              <rect x={1190} y={600} width={18} height={120} fill="#e5c9a0" opacity={0.6} />
            </g>
            <g className="c3-gh">
              <g className="c3-lift">
                <g filter="url(#dc-cyan)">
                  <Hand3D store={simH} x={400} y={430} look="xray" arm={300} />
                </g>
                <Hand3D store={simH} x={400} y={430} look="xray" arm={300} />
                <Hand3D store={realH} x={1200} y={430} look="robot" arm={300} light={[0.8, -0.5]} />
              </g>
            </g>
            <g className="c3-ok" opacity={0}>
              <text x={400} y={820} textAnchor="middle" fill={C.lime} fontFamily={SANS} fontSize={32} fontWeight={600}>
                ✓ holds
              </text>
            </g>
            <g className="c3-slip" opacity={0}>
              <text x={1200} y={820} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={32} fontWeight={600}>
                ✕ slips
              </text>
            </g>
            <Label className="c3-lab-fric" x={1150} y={540} tx={960} ty={240} text="friction a little off" sub="hold flips to slip" color={C.danger} />
          </g>
          <g className="c3-gap-towel" opacity={0}>
            {/* a rail and a towel: sim makes it a stiff board, reality drapes */}
            <line x1={240} y1={360} x2={560} y2={360} stroke={C.cyanLight} strokeWidth={6} />
            <g className="c3-towel-sim">
              <path d="M260 360 L560 360 L600 380 L300 380 Z" fill="none" stroke={C.cyan} strokeWidth={2.5} />
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={300 + i * 60} y1={360} x2={340 + i * 60} y2={380} stroke={C.cyan} strokeWidth={1} />
              ))}
            </g>
            <text x={400} y={470} textAnchor="middle" fill={C.cyanLight} fontFamily={MONO} fontSize={22}>
              a towel, like a board
            </text>
            <rect x={1020} y={350} width={360} height={14} rx={7} fill={C.metal} />
            <g className="c3-towel-real">
              <path d="M1050 360 C 1040 480 1080 560 1060 660 Q 1120 700 1180 650 Q 1240 700 1300 660 Q 1360 690 1350 640 C 1330 540 1370 460 1350 360 Z" fill="#c0504a" />
              <path d="M1110 380 C 1100 480 1130 560 1120 650 M1240 380 C 1250 480 1230 560 1250 660" stroke="#8e3430" strokeWidth={6} fill="none" opacity={0.7} />
            </g>
            <Label className="c3-lab-gap" x={800} y={520} tx={800} ty={190} text="the reality gap" color={C.paper} size={40} dot={false} anchor="middle" />
            {['cloth', 'food', 'touch'].map((t, i) => (
              <g key={t} transform={`translate(${560 + i * 240} 820)`}>
                <g className="c3-harder" opacity={0}>
                  <circle r={10} fill={t === 'touch' ? C.magenta : C.danger} />
                  <text x={20} y={9} fill={t === 'touch' ? C.magentaLight : C.paper} fontFamily={SANS} fontSize={28}>
                    {t}
                  </text>
                </g>
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* ---------------- multiplying demos ---------------- */}
      <g className="c3-mult" ref={multRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#06101e" />
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-grid)" opacity={0.5} />
        </g>
        <g data-depth="1">
          <rect x={300} y={180} width={960} height={600} rx={12} fill="#0b1a30" stroke={C.cyan} strokeWidth={2} opacity={0.9} />
          <rect x={TRAY.x - 70} y={TRAY.y - 50} width={140} height={100} rx={8} fill="none" stroke={C.cyanLight} strokeWidth={3} />
          <text x={TRAY.x} y={TRAY.y + 84} textAnchor="middle" fill={C.cyanLight} fontFamily={MONO} fontSize={18}>
            tray
          </text>
          {COPIES.map((c, i) => (
            <g key={i} className={`c3-cp-${i}`} opacity={0}>
              <path className={`c3-cpp-${i}`} d={demoPath(c)} fill="none" stroke={C.lime} strokeWidth={2.2} strokeDasharray="900" strokeDashoffset={900} opacity={0.75} />
              <circle cx={c.x} cy={c.y} r={14} fill="none" stroke={C.cyanLight} strokeWidth={2} />
            </g>
          ))}
          {/* the one real demo */}
          <circle cx={DEMO0.x} cy={DEMO0.y} r={18} fill={C.keyLight} />
          <path className="c3-demo0" d={demoPath(DEMO0)} fill="none" stroke={C.lime} strokeWidth={6} strokeDasharray="900" strokeDashoffset={900} filter="url(#cn-bloom)" />
          <Label className="c3-lab-demo" x={DEMO0.x} y={DEMO0.y} tx={380} ty={830} text="one real human demo" color={C.keyLight} />
          <g className="c3-stack" opacity={0}>
            <rect x={1380} y={330} width={60} height={430} rx={6} fill={C.ink2} />
            <rect className="c3-stack-bar" x={1380} y={750} width={60} height={10} rx={6} fill={C.lime} />
            <text className="c3-stack-n" x={1410} y={300} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={34} fontWeight={600}>
              200
            </text>
            <text x={1410} y={800} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              demos kept
            </text>
          </g>
          <g className="c3-lab-mimic" opacity={0}>
            <text x={300} y={130} fill={C.paper} fontFamily={SANS} fontSize={32} fontWeight={600}>
              MimicGen: ~200 → 50,000 demos
            </text>
            <text x={300} y={160} fill={C.mist} fontFamily={MONO} fontSize={18}>
              failed copies (red) are thrown away
            </text>
          </g>
          <Dust x={300} y={180} w={960} h={600} count={18} seed={4} color={C.cyan} size={0.6} />
        </g>
      </g>
      <Vignette />
      <Letterbox className="c3-lb" />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'video-sim',
  title: 'Watching, and dreaming',
  cues: CUES,
  Scene: Ch3VideoSim,
  enter: { type: 'zoom', x: 800, y: 450 },
  deeper: [VideoSimReading],
}
