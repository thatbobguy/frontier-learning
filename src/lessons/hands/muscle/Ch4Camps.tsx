import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { useDrag } from '../../../engine/svg'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Dust, FiveMap, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { MuscleStyle, RFinger, Shimmer, fingerRig } from './parts'
import { CampsReading } from './readings'

export const CUES: Cue[] = [
  { id: 'camps', say: 'Today’s hands fall into three camps, each betting on a different answer.' },
  { id: 'linkage', say: 'Linkage hands: tiny motors with screws push rigid rods. Stiff, precise, cheap to make, and they hold a grip for free. But each motor drives a fixed curl, and they don’t like being knocked.' },
  { id: 'tendon', say: 'Tendon hands: motors in the forearm pull cables. Light, human-like, many joints. But friction, stretch and wear make them harder to build, simulate and repair.' },
  { id: 'direct', say: 'Direct-drive hands: a small motor and gearbox inside every joint. Every joint is independent and easy to model. But the fingers get heavier, and the heat has nowhere to go.' },
  { id: 'wild', say: 'And at the edges, wilder ideas: water-powered artificial muscles, tiny hydraulic valves, even fishing line that contracts when heated.' },
  { id: 'match', say: 'Match each hand to its biggest weakness.', play: true },
  { id: 'hybrid', say: 'Whichever camp wins, the muscle question comes down to the same three numbers: force, speed and weight, paid for in heat, friction and money.' },
]

const STATE = [
  'A dark gallery. Three plinths stand in a row, each lit by its own spotlight, each holding a robot hand drawn in cyan x-ray style. Plinth labels: linkage, tendon, direct drive. These are the three main ways (transmission "camps") that today\'s robot hands get force from motors to joints.',
  'The first plinth (linkage) lights up; the others dim. Its hand curls all four fingers together. Beside it a blueprint cutaway of one finger: a tiny motor turns a lead screw, a nut climbs the screw and pushes a rigid rod, and the whole finger curls along one fixed path. Label: "Inspire RH56, AgiBot OmniHand: 6 motors, about $5k". Gains: stiff, precise, cheap, self-locking so it holds a grip at zero power. Losses: one motor per fixed curl (few independent joints), and impacts load the screw.',
  'The second plinth (tendon) lights up. The hand\'s tendons glow cyan. Beside it a cutaway: a finger with a cable along its palm side, running down through the wrist to a motor in the forearm; pulses of pull travel up the cable and the finger curls. Label: "Shadow, Tesla Optimus, 1X NEO". Gains: light fingers, human-like, many joints. Losses: friction, stretch and wear; harder to build, simulate and repair.',
  'The third plinth (direct drive) lights up. Amber motor capsules glow at every joint of its cutaway finger, with heat shimmer rising. Label: "Wuji, Unitree Dex5, Atlas". Gains: every joint independent, easy to model (good for simulation). Losses: heavier fingers at the end of the arm, and heat trapped in a small space.',
  'The plinths go dark. Three quick vignettes: Clone Robotics\' water-pressurised Myofiber artificial muscles (pale tubes that swell and shorten), Sanctuary AI\'s miniature hydraulic valve block, and a twisted-coiled-polymer (TCP) muscle made from nylon fishing line that contracts when heated (glowing coil). Labels: Clone, Sanctuary, TCP muscle. None is mainstream yet: hydraulics need pumps, seals and maintenance; TCP muscles are slow and inefficient because they work by heat.',
  '',
  'Back to the five-question map: the amber ring (muscle, actuation) and the cyan ring (tendons, transmission) settle, now understood. The magenta ring (touch, sensing) starts to pulse: the next film. Takeaway: every actuation choice is a trade between force, speed and weight, paid for in heat, friction and money.',
]

const PX = [300, 800, 1300]
const TOP = 520
const CAMP = ['linkage', 'tendon', 'direct'] as const
type Camp = (typeof CAMP)[number]
const CAMP_NAME: Record<Camp, string> = { linkage: 'linkage', tendon: 'tendon', direct: 'direct drive' }

const CARDS: { id: string; text: string; camp: Camp; why: string }[] = [
  { id: 'fixed', text: 'Fixed curl paths, few independent joints', camp: 'linkage', why: 'one screw drives a whole finger along one curve' },
  { id: 'calib', text: 'Friction and stretch need constant calibration', camp: 'tendon', why: 'every bend and every stretch shifts the force' },
  { id: 'heavy', text: 'Heavy fingers and heat in a small space', camp: 'direct', why: 'a motor in every joint weighs and warms the finger' },
  { id: 'impact', text: 'Impacts load the screw directly', camp: 'linkage', why: 'a screw that can’t be pushed back takes the hit' },
  { id: 'repair', text: 'Hard to repair: cables run through everything', camp: 'tendon', why: 'fixing one cable means opening the whole hand' },
]
const COIL_D = 'M0 -30 ' + 'q 14 30 0 60 q -6 -30 16 -60 '.repeat(14)
const CARD_W = 470
const CARD_H = 52
const HOME = [
  { x: 290, y: 772 },
  { x: 800, y: 772 },
  { x: 1310, y: 772 },
  { x: 545, y: 846 },
  { x: 1055, y: 846 },
]
const VIEWS = [
  { yaw: -40, pitch: 8, roll: 0, s: 1.3 },
  { yaw: -20, pitch: 8, roll: 0, s: 1.3 },
  { yaw: 20, pitch: 8, roll: 0, s: 1.3 },
]
const CURL = { ...GRASPS.claw, thumb: [30, 20, 20, 20], index: [40, 46, 36, 0], middle: [42, 48, 38, 0], ring: [44, 48, 38, 0], little: [46, 48, 38, 0] } as typeof GRASPS.claw

export function Ch4Camps({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const h0 = useHandStore({ pose: GRASPS.relaxed, view: VIEWS[0], xray: 1 })
  const h1 = useHandStore({ pose: GRASPS.relaxed, view: VIEWS[1], xray: 1 })
  const h2 = useHandStore({ pose: GRASPS.relaxed, view: VIEWS[2], xray: 1 })
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -20, pitch: 8, roll: 0, s: 1.9 }, xray: 1 })

  /* ---------------- the play ---------------- */
  const [placed, setPlaced] = useState<Record<string, Camp>>({})
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [flash, setFlash] = useState<{ camp: Camp; ok: boolean; text: string; id: string; n: number } | null>(null)
  const [done, setDone] = useState(false)
  const active = cueIndex === 5 && !done
  const nPlaced = Object.keys(placed).length

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), flash.ok ? 3200 : 1400)
    return () => window.clearTimeout(t)
  }, [flash])
  useEffect(() => {
    if (!active || nPlaced < CARDS.length) return
    const t = window.setTimeout(() => {
      setDone(true)
      memory.campsMatched = true
      void say('Every camp is a different trade. And in 2026, the newest hands are hybrids, mixing all three.')
      onPlayDone()
    }, 900)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, nPlaced])

  const drop = (id: string, x: number, y: number) => {
    const card = CARDS.find((c) => c.id === id)
    if (!card) return
    const i = PX.findIndex((px) => Math.abs(px - x) < 250)
    if (i < 0 || y > 735) return
    const camp = CAMP[i]
    if (camp === card.camp) {
      setPlaced((p) => ({ ...p, [id]: camp }))
      setFlash({ camp, ok: true, text: card.why, id, n: Date.now() })
      emit({ type: 'attempt', correct: true, detail: `matched "${card.text}" to the ${CAMP_NAME[camp]} hand` })
    } else {
      setFlash({ camp, ok: false, text: '', id, n: Date.now() })
      emit({ type: 'attempt', correct: false, detail: `tried "${card.text}" on the ${CAMP_NAME[camp]} hand (it belongs to ${CAMP_NAME[card.camp]})` })
    }
  }

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(world.current, { x: 800, y: 470, zoom: 1.12 })
      const lk = fingerRig(el, 'c4lk', [0, 0, 0])
      const td = fingerRig(el, 'c4td', [0, 0, 0])
      const dd = fingerRig(el, 'c4dd', [0, 0, 0])

      /* b0: three spotlit plinths in a dark gallery. */
      tl.addLabel('b0', 0)
      tl.set('.c4-dg, .c4-wild, .c4-map, .c4-cards', { opacity: 0 }, 0)
      tl.set('.c4-spot', { opacity: 0 }, 0)
      cam.to(tl, { zoom: 1.0, x: 800, y: 450 }, 0, 6, 'sine.inOut')
      ;[0, 1, 2].forEach((i) => {
        tl.fromTo(`.c4-spot-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none', immediateRender: false }, 0.4 + i * 0.9)
        tl.to(`.c4-spot-${i}`, { opacity: 0.4, duration: 0.06 }, 0.55 + i * 0.9)
        tl.to(`.c4-spot-${i}`, { opacity: 1, duration: 0.1 }, 0.65 + i * 0.9)
        fade(tl, `.c4-plab-${i}`, 1, 0.7 + i * 0.9, 0.5)
      })
      h0.to(tl, { view: { yaw: -30 } }, 0, 6, 'sine.inOut')
      h1.to(tl, { view: { yaw: -10 } }, 0, 6, 'sine.inOut')
      h2.to(tl, { view: { yaw: 30 } }, 0, 6, 'sine.inOut')

      /* b1: linkage. */
      const spotOnly = (k: number, at: number) => {
        ;[0, 1, 2].forEach((i) => tl.to(`.c4-spot-${i}`, { opacity: i === k ? 1 : 0.18, duration: 0.6 }, at))
        ;[0, 1, 2].forEach((i) => tl.to(`.c4-ped-${i}`, { opacity: i === k ? 1 : 0.08, duration: 0.6 }, at))
      }
      const b1 = 6
      tl.addLabel('b1', b1)
      spotOnly(0, b1)
      cam.to(tl, { zoom: 1.5, x: 470, y: 400 }, b1, 1.6)
      fade(tl, '.c4-dg-0', 1, b1 + 0.8, 0.6)
      h0.to(tl, { pose: CURL }, b1 + 1.6, 1.6)
      tl.fromTo('.c4-nut', { y: 0 }, { y: -46, duration: 1.6, ease: 'power2.inOut', immediateRender: false }, b1 + 1.6)
      tl.fromTo('.c4-threads', { y: 0 }, { y: -40, duration: 1.6, ease: 'none', immediateRender: false }, b1 + 1.6)
      lk.to(tl, [30, 36, 30], b1 + 1.6, 1.6)
      fade(tl, '.c4-dg-0-lab', 1, b1 + 3.0, 0.6)
      h0.to(tl, { pose: GRASPS.relaxed }, b1 + 8.6, 1.6)
      tl.fromTo('.c4-nut', { y: -46 }, { y: 0, duration: 1.6, ease: 'power2.inOut', immediateRender: false }, b1 + 8.6)
      lk.to(tl, [0, 0, 0], b1 + 8.6, 1.6)

      /* b2: tendon. */
      const b2 = b1 + 12.5
      tl.addLabel('b2', b2)
      spotOnly(1, b2)
      fade(tl, '.c4-dg-0', 0, b2, 0.5, 1)
      cam.to(tl, { zoom: 1.5, x: 940, y: 400 }, b2, 1.6)
      fade(tl, '.c4-dg-1', 1, b2 + 0.8, 0.6)
      h1.to(tl, { pose: CURL, pull: { thumb: 1, index: 1, middle: 1, ring: 1, little: 1 } }, b2 + 1.6, 1.6)
      td.to(tl, [32, 40, 34], b2 + 1.6, 1.6)
      fade(tl, '.c4-dg-1-lab', 1, b2 + 2.8, 0.6)
      h1.to(tl, { pose: GRASPS.relaxed, pull: { thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.2, little: 0.2 } }, b2 + 7.4, 1.6)
      td.to(tl, [8, 10, 8], b2 + 7.4, 1.6)

      /* b3: direct drive. */
      const b3 = b2 + 10.2
      tl.addLabel('b3', b3)
      spotOnly(2, b3)
      fade(tl, '.c4-dg-1', 0, b3, 0.5, 1)
      cam.to(tl, { zoom: 1.5, x: 1150, y: 400 }, b3, 1.6)
      fade(tl, '.c4-dg-2', 1, b3 + 0.8, 0.6)
      h2.to(tl, { pose: GRASPS.tripod }, b3 + 1.6, 1.4)
      dd.to(tl, [14, 50, 10], b3 + 1.6, 1.2)
      dd.to(tl, [40, 10, 40], b3 + 3.0, 1.2)
      dd.to(tl, [25, 30, 25], b3 + 4.4, 1.2)
      fade(tl, '.c4-dd-heat', 1, b3 + 5.2, 1.2)
      fade(tl, '.c4-dg-2-lab', 1, b3 + 2.4, 0.6)
      h2.to(tl, { pose: GRASPS.relaxed }, b3 + 8.4, 1.4)

      /* b4: the wild ideas. */
      const b4 = b3 + 12
      tl.addLabel('b4', b4)
      fade(tl, '.c4-dg-2', 0, b4, 0.5, 1)
      ;[0, 1, 2].forEach((i) => tl.to(`.c4-spot-${i}`, { opacity: 0.08, duration: 0.6 }, b4))
      ;[0, 1, 2].forEach((i) => tl.to(`.c4-ped-${i}`, { opacity: 0.2, duration: 0.6 }, b4))
      cam.to(tl, { zoom: 1.05, x: 800, y: 430 }, b4, 1.4)
      fade(tl, '.c4-wild', 1, b4 + 0.5, 0.5)
      tl.fromTo('.c4-wv', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, stagger: 1.6, ease: 'power2.out', immediateRender: false }, b4 + 0.6)

      /* b5: the play: match each hand to its weakness. */
      const b5 = b4 + 8.4
      tl.addLabel('b5', b5)
      fade(tl, '.c4-wild', 0, b5, 0.5, 1)
      ;[0, 1, 2].forEach((i) => tl.to(`.c4-spot-${i}`, { opacity: 1, duration: 0.6 }, b5))
      ;[0, 1, 2].forEach((i) => tl.to(`.c4-ped-${i}`, { opacity: 1, duration: 0.6 }, b5))
      cam.to(tl, { zoom: 1, x: 800, y: 450 }, b5, 1)
      fade(tl, '.c4-cards', 1, b5 + 0.6, 0.6)
      tl.to({}, { duration: 0.1 }, b5 + 2.4)

      /* b6: back to the map. */
      const b6 = b5 + 2.6
      tl.addLabel('b6', b6)
      fade(tl, '.c4-cards', 0, b6, 0.5, 1)
      cam.to(tl, { zoom: 1, x: 800, y: 470 }, b6, 2.4, 'power2.inOut')
      fade(tl, '.c4-gallery', 0, b6 + 0.6, 1.2, 1)
      fade(tl, '.c4-map', 1, b6 + 0.8, 1.2)
      tl.fromTo('.m4-ring-muscle, .m4-ring-tendons', { opacity: 0.22 }, { opacity: 1, duration: 1, immediateRender: false }, b6 + 1.6)
      tl.fromTo('.m4-lab-muscle, .m4-lab-tendons', { opacity: 0.35 }, { opacity: 1, duration: 1, immediateRender: false }, b6 + 1.6)
      tl.fromTo('.m4-ring-muscle, .m4-ring-tendons', { opacity: 1 }, { opacity: 0.6, duration: 1.2, immediateRender: false }, b6 + 3.4)
      tl.fromTo('.m4-ring-touch', { opacity: 0.22 }, { opacity: 1, duration: 0.5, repeat: 5, yoyo: true, ease: 'sine.inOut', immediateRender: false }, b6 + 4.2)
      tl.fromTo('.m4-lab-touch', { opacity: 0.35 }, { opacity: 1, duration: 0.6, immediateRender: false }, b6 + 4.2)
      fade(tl, '.c4-trio', 1, b6 + 5.2, 0.8)
      tl.to({}, { duration: 0.1 }, b6 + 10.6)
    },
    [h0, h1, h2],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c4-haze', { opacity: 0.55, duration: 3.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    if (cueIndex === 5) {
      const left = CARDS.filter((c) => !placed[c.id])
      reportState(
        `The learner's turn. Three spotlit plinths, each with an x-ray robot hand: linkage (left), tendon (middle), direct drive (right). Along the bottom are weakness cards to drag onto the right hand; a correct card snaps onto that plinth with a short reason, a wrong one bounces back. ` +
          `Placed so far: ${nPlaced} of 5.${left.length ? ` Still to place: ${left.map((c) => `"${c.text}"`).join(', ')}.` : ' All placed.'} ` +
          'Correct answers: linkage = "Fixed curl paths, few independent joints" and "Impacts load the screw directly" (one screw-driven actuator pushes rods that curl a whole finger along one path, and a self-locking screw cannot give way when hit). Tendon = "Friction and stretch need constant calibration" and "Hard to repair: cables run through everything" (cables over pulleys from the forearm). Direct drive = "Heavy fingers and heat in a small space" (a motor and gearbox inside every joint). Likely mix-ups: giving "impacts" to direct drive (its small gearboxes can suffer too, but the classic weak point is the linkage screw), or "heavy fingers" to linkage.',
      )
      setHints(['Which design has motors right inside the fingers?', 'Which one has long cables wrapped around pulleys?'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, placed, nPlaced, reportState, setHints])

  const hands = [h0, h1, h2]

  return (
    <g ref={root}>
      <MuscleStyle />
      <g ref={world}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <rect x={-800} y={-600} width={3200} height={1300} fill="url(#cn-wall)" opacity={0.8} />
          <g className="c4-haze" opacity={0.3}>
            <Pool x={800} y={300} r={800} color="rim" opacity={0.25} />
          </g>
        </g>
        <g data-depth="1">
          <g className="c4-gallery">
            <rect x={-800} y={700} width={3200} height={800} fill="url(#cn-floor)" />
            {PX.map((x, i) => (
              <g key={x}>
                <g className={`c4-spot c4-spot-${i}`}>
                  <Beam x={x} y={-120} w1={80} w2={420} len={880} fill="url(#cn-beam-white)" opacity={0.5} className="hd-flicker" />
                  <ellipse cx={x} cy={712} rx={240} ry={34} fill={C.keyLight} opacity={0.12} filter="url(#cn-dof-2)" />
                  <Pool x={x} y={380} r={300} color="rim" opacity={0.35} />
                  <Dust x={x - 160} y={0} w={320} h={640} count={10} seed={40 + i} color={C.paper} size={0.7} />
                </g>
                <g className={`c4-ped-${i}`}>
                  {/* the plinth */}
                  <rect x={x - 150} y={TOP} width={300} height={190} fill={C.ink3} />
                  <rect x={x - 150} y={TOP} width={300} height={190} fill="url(#cn-fade-up)" opacity={0.5} />
                  <ellipse cx={x} cy={TOP} rx={150} ry={20} fill={C.ink4} />
                  <ellipse cx={x} cy={TOP} rx={150} ry={20} fill="none" stroke={C.mist} strokeOpacity={0.3} />
                  <text className={`c4-plab-${i}`} x={x} y={TOP + 64} textAnchor="middle" fill={i === 1 ? C.cyan : i === 0 ? C.bone : C.amber} fontFamily={SANS} fontSize={28} fontWeight={600} letterSpacing={2} opacity={0}>
                    {CAMP_NAME[CAMP[i]].toUpperCase()}
                  </text>
                  <Hand3D store={hands[i]} x={x} y={TOP - 20} look="xray" arm={50} />
                  {i === 2 && (
                    <g className="c4-dd-heat" opacity={0}>
                      <Pool x={x} y={330} r={170} color="amber" opacity={0.6} />
                      <Shimmer x={x} y={240} n={5} spread={70} />
                    </g>
                  )}
                </g>
              </g>
            ))}

            {/* cutaways: one finger per camp */}
            <g className="c4-dg c4-dg-0">
              <Pool x={640} y={360} r={260} color="dark" />
              <g transform="translate(640 470)">
                <rect x={-44} y={0} width={88} height={150} rx={8} fill={C.ink1} fillOpacity={0.8} stroke={C.cyan} strokeWidth={2} />
                <rect x={-12} y={20} width={24} height={120} fill={C.metalDark} />
                <clipPath id="c4-screw-p">
                  <rect x={-12} y={20} width={24} height={120} />
                </clipPath>
                <g clipPath="url(#c4-screw-p)">
                  <g className="c4-threads">
                    {Array.from({ length: 20 }, (_, k) => (
                      <line key={k} x1={-12} y1={14 + k * 10} x2={12} y2={22 + k * 10} stroke={C.metal} strokeWidth={3} />
                    ))}
                  </g>
                </g>
                <rect x={-30} y={150} width={60} height={34} rx={6} fill={C.amberDark} stroke={C.amber} strokeWidth={2} />
                <g className="c4-nut">
                  <rect x={-24} y={96} width={48} height={22} rx={4} fill={C.bone} />
                  <line x1={20} y1={100} x2={34} y2={-6} stroke={C.bone} strokeWidth={7} strokeLinecap="round" />
                </g>
                <RFinger x={0} y={0} rot={-90} s={0.8} lens={[150, 105, 85]} w={50} look="blueprint" cls="c4lk" />
              </g>
              <g className="c4-dg-0-lab" opacity={0}>
                <text x={720} y={600} fill={C.bone} fontFamily={MONO} fontSize={18}>screw + rods</text>
                <text x={720} y={628} fill={C.amber} fontFamily={MONO} fontSize={18}>holds at 0 W</text>
                <text x={640} y={150} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={500}>Inspire RH56, AgiBot OmniHand</text>
                <text x={640} y={180} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>
                  6 motors, <tspan fill={C.gold}>about $5k</tspan>
                </text>
              </g>
            </g>
            <g className="c4-dg c4-dg-1">
              <Pool x={1100} y={360} r={260} color="dark" />
              <g transform="translate(1100 440)">
                <rect x={-44} y={0} width={88} height={120} rx={8} fill={C.ink1} fillOpacity={0.8} stroke={C.cyan} strokeWidth={2} />
                <line x1={14} y1={0} x2={14} y2={190} stroke={C.cyan} strokeWidth={4} />
                <line className="mu-flow" x1={14} y1={190} x2={14} y2={0} stroke={C.cyanLight} strokeWidth={4} strokeDasharray="6 18" strokeLinecap="round" />
                <rect x={-30} y={190} width={80} height={40} rx={8} fill={C.amberDark} stroke={C.amber} strokeWidth={2} />
                <RFinger x={0} y={0} rot={-90} s={0.8} lens={[150, 105, 85]} w={50} look="blueprint" cls="c4td" under={[150, 105, 85].map((L, k) => <line key={k} x1={0} y1={17} x2={L} y2={17} stroke={C.cyanLight} strokeWidth={4} />)} />
              </g>
              <g className="c4-dg-1-lab" opacity={0}>
                <text x={1100} y={150} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={500}>Shadow, Tesla Optimus, 1X NEO</text>
                <text x={1100} y={180} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>motors in the forearm</text>
                <text x={1170} y={640} fill={C.cyan} fontFamily={MONO} fontSize={18}>cable to the forearm</text>
              </g>
            </g>
            <g className="c4-dg c4-dg-2">
              <Pool x={1000} y={360} r={260} color="dark" />
              <g transform="translate(1000 520)">
                <rect x={-44} y={0} width={88} height={80} rx={8} fill={C.ink1} fillOpacity={0.8} stroke={C.cyan} strokeWidth={2} />
                <RFinger
                  x={0}
                  y={0}
                  rot={-90}
                  s={0.8}
                  lens={[150, 105, 85]}
                  w={50}
                  look="blueprint"
                  cls="c4dd"
                  slots={[0, 1, 2].map((k) => (
                    <g key={k}>
                      <rect x={6} y={-16} width={38} height={32} rx={8} fill={C.amberDark} stroke={C.amber} strokeWidth={2} />
                      <circle cx={0} cy={0} r={9} fill={C.amber} className="mu-glowpulse" />
                    </g>
                  ))}
                />
              </g>
              <g className="c4-dg-2-lab" opacity={0}>
                <text x={1000} y={150} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={500}>Wuji, Unitree Dex5, Atlas</text>
                <text x={1000} y={180} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>a motor in every joint</text>
              </g>
            </g>

            {/* the wild ideas */}
            <g className="c4-wild">
              <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} opacity={0.88} />
              <g className="c4-wv">
                <Pool x={360} y={400} r={240} color="paper" opacity={0.18} />
                {[0, 1, 2, 3].map((k) => (
                  <g key={k} transform={`translate(${290 + k * 46} 250)`}>
                    <rect className="mu-swell" style={{ animationDelay: `${-k * 0.3}s` }} x={-14} y={0} width={28} height={240} rx={14} fill="#e9e2d6" opacity={0.85} />
                  </g>
                ))}
                <path d="M270 520 Q360 560 450 520" stroke={C.cyan} strokeWidth={4} fill="none" />
                <Label x={360} y={520} tx={360} ty={600} text="Clone" sub="water-powered muscle fibres" color={C.paper} anchor="middle" hidden={false} />
              </g>
              <g className="c4-wv">
                <Pool x={800} y={400} r={240} color="cyan" opacity={0.2} />
                <rect x={700} y={320} width={200} height={140} rx={10} fill={C.metalDark} />
                <rect x={700} y={320} width={200} height={16} rx={6} fill={C.metal} />
                {[0, 1, 2, 3].map((k) => (
                  <g key={k}>
                    <rect x={716 + k * 46} y={350} width={30} height={86} rx={4} fill={C.ink3} />
                    <circle className="hd-blink" style={{ animationDelay: `${-k * 0.4}s` }} cx={731 + k * 46} cy={366} r={5} fill={C.cyan} />
                    <path d={`M${731 + k * 46} 460 v 60`} stroke={C.cyanDark} strokeWidth={8} />
                  </g>
                ))}
                <Label x={800} y={520} tx={800} ty={600} text="Sanctuary" sub="tiny hydraulic valves" color={C.paper} anchor="middle" hidden={false} />
              </g>
              <g className="c4-wv">
                <Pool x={1240} y={400} r={240} color="amber" opacity={0.3} />
                <g transform="translate(1130 390)">
                  <g className="mu-coil">
                    <path d={COIL_D} stroke="#d9d2c4" strokeWidth={5} fill="none" />
                    <path d={COIL_D} stroke={C.amber} strokeWidth={5} fill="none" className="mu-glowpulse" filter="url(#cn-bloom)" opacity={0.7} />
                  </g>
                </g>
                <Label x={1240} y={430} tx={1240} ty={600} text="TCP muscle" sub="nylon fishing line, heated" color={C.paper} anchor="middle" hidden={false} />
              </g>
            </g>
          </g>

          {/* the five-question map */}
          <g className="c4-map">
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
            <Pool x={800} y={470} r={700} color="rim" opacity={0.25} />
            <FiveMap cx={800} cy={470} prefix="m4" />
            <Hand3D store={mapHand} x={800} y={600} look="xray" arm={110} />
            <text className="c4-trio" x={800} y={850} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={34} opacity={0}>
              force · speed · weight
            </text>
          </g>
        </g>
      </g>

      {/* ---------- the play's cards (outside the camera) ---------- */}
      <g className="c4-cards">
        {PX.map((x, i) => {
          const camp = CAMP[i]
          const here = CARDS.filter((c) => placed[c.id] === camp)
          const f = flash && flash.camp === camp ? flash : null
          return (
            <g key={x}>
              {f && <Pool key={f.n} x={x} y={360} r={260} color={f.ok ? 'lime' : 'danger'} opacity={0.6} />}
              {f && f.ok && (
                <text x={x} y={170} textAnchor="middle" fill={C.limeLight} fontFamily={SANS} fontSize={21} fontWeight={500}>
                  {f.text}
                </text>
              )}
              {here.map((c, k) => (
                <g key={c.id} transform={`translate(${x} ${TOP + 100 + k * 44}) scale(0.6)`}>
                  <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={10} fill={C.ink1} stroke={C.lime} strokeWidth={3} />
                  <text x={0} y={7} textAnchor="middle" fill={C.limeLight} fontFamily={SANS} fontSize={21}>
                    {c.text}
                  </text>
                </g>
              ))}
            </g>
          )
        })}
        {CARDS.map((c, i) =>
          placed[c.id] ? null : (
            <Card key={c.id} id={c.id} bad={flash && !flash.ok && flash.id === c.id ? flash.n : 0} text={c.text} home={HOME[i]} at={drag?.id === c.id ? drag : null} active={active} onMove={(x, y) => setDrag({ id: c.id, x, y })} onDrop={(x, y) => {
              setDrag(null)
              drop(c.id, x, y)
            }} />
          ),
        )}
      </g>
      <Vignette />
    </g>
  )
}

function Card({ id, bad, text, home, at, active, onMove, onDrop }: { id: string; bad: number; text: string; home: { x: number; y: number }; at: { x: number; y: number } | null; active: boolean; onMove: (x: number, y: number) => void; onDrop: (x: number, y: number) => void }) {
  const off = useRef({ x: 0, y: 0 })
  const last = useRef({ x: home.x, y: home.y })
  const drag = useDrag({
    onStart: (p) => {
      off.current = { x: home.x - p.x, y: home.y - p.y }
      last.current = { x: home.x, y: home.y }
    },
    onMove: (p) => {
      last.current = { x: p.x + off.current.x, y: p.y + off.current.y }
      onMove(last.current.x, last.current.y)
    },
    onEnd: () => onDrop(last.current.x, last.current.y),
  })
  const pos = at ?? home
  return (
    <g {...(active ? drag : {})} data-tutor={`card-${id}`} style={{ cursor: active ? 'grab' : 'default', touchAction: 'none' }}>
      <g transform={`translate(${pos.x} ${pos.y})`}>
        <g key={bad} className={bad ? 'mu-shake' : undefined}>
        <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={10} fill={C.ink1} fillOpacity={0.92} stroke={bad ? C.danger : at ? C.paper : C.mist} strokeOpacity={at || bad ? 0.9 : 0.5} strokeWidth={2} />
        <text x={0} y={7} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={21} pointerEvents="none">
          {text}
        </text>
        </g>
      </g>
    </g>
  )
}

export const ch4: Chapter = {
  id: 'camps',
  title: 'The three camps',
  cues: CUES,
  Scene: Ch4Camps,
  enter: { type: 'dissolve' },
  deeper: [CampsReading],
}
