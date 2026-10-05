import { useEffect, useRef, useState } from 'react'
import { At, Bubble, ClayToken, Hills, Label, Moon, NotchedBone, Pebble, PebbleBag, Pen, Sheep, Shepherd, Sky, Stars, Sun, SvgButton, Tree } from '../art/kit'
import { C } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import { toStage, useDrag } from '../engine/svg'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Stop 1: Why math was born.
 * The story carries the idea: a shepherd with no number words keeps track of her flock by
 * matching one pebble to one sheep. Each story step is the next piece of the concept, then
 * it fades from real things (sheep, pebbles) to marks, and on to a timeline of real history.
 */

const BEATS = [
  { id: 'meet-ama', say: 'Long, long ago, before anyone had numbers, a shepherd named Ama looked after a flock of sheep.' },
  { id: 'morning', say: 'Every morning, Ama let her sheep out of the pen to munch grass on the hills.' },
  { id: 'night', say: 'Every night, she brought them home. But Ama had a problem. How could she tell if a sheep was missing? She had no number words at all.' },
  { id: 'try-guess', say: 'Here is the flock tonight. Is every sheep home? Take a guess!', challenge: true, quick: true },
  { id: 'idea', say: 'Ama had a clever idea. Each morning, as each sheep walked out the gate, she dropped one pebble into her bag.' },
  { id: 'one-for-one', say: 'One sheep, one pebble. One sheep, one pebble. The bag now holds a pebble for every sheep.' },
  { id: 'coming-home', say: 'At night, as each sheep came home, Ama took one pebble out.' },
  { id: 'left-over', say: 'Look! One pebble is left in the bag. That means one sheep is still out there!' },
  { id: 'matching', say: 'This is the first big idea of math: matching. One thing for one thing. Sheep, pebbles, or marks, they all keep track the same way.' },
  { id: 'history', say: 'People really did this! Long ago, people carved one notch on a bone for each thing. Later they used clay tokens, and then they wrote numbers down.' },
  { id: 'night-watch', say: 'Now you keep watch! The pebbles are from this morning, one for each sheep that went out. Drag one pebble onto each sheep that came home. Then tell me, is every sheep home?', challenge: true },
]

const PEN = [
  { x: 1150, y: 640 },
  { x: 1265, y: 628 },
  { x: 1380, y: 645 },
  { x: 1205, y: 700 },
  { x: 1330, y: 705 },
]
const FIELD = [
  { x: 250, y: 680 },
  { x: 420, y: 640 },
  { x: 580, y: 690 },
  { x: 330, y: 765 },
  { x: 690, y: 750 },
]
const GATE = { x: 1010, y: 720 }
const AMA = { x: 890, y: 800 }
const BAG = { x: 820, y: 800 }
const LOST = { x: 330, y: 505 }

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const walk = (i: number, to: { x: number; y: number }, facing: 1 | -1, at: number | string, dur = 1.6) => {
        tl.to(`.dir-${i}`, { scaleX: facing, duration: 0.15 }, at)
        tl.to(`.sheep-${i}`, { x: to.x, y: to.y, duration: dur, ease: 'power1.inOut' }, '<')
        tl.fromTo(`.hop-${i}`, { y: 0 }, { y: -10, duration: dur / 8, repeat: 7, yoyo: true, ease: 'sine.inOut' }, '<')
      }
      const toNight = (at: number | string, dur = 2) => {
        tl.to('.sky-dusk', { opacity: 1, duration: dur / 2 }, at)
        tl.to('.sun', { y: 640, duration: dur, ease: 'power1.in' }, '<')
        tl.to('.sky-night', { opacity: 1, duration: dur / 2 }, `<${dur / 2}`)
        tl.to('.hills-night', { opacity: 1, duration: dur / 2 }, '<')
        tl.to('.stars', { opacity: 1, duration: dur / 2 }, '<')
        tl.to('.night-tint', { opacity: 0.32, duration: dur / 2 }, '<')
        tl.to('.moon', { y: 0, duration: dur, ease: 'power1.out' }, '<')
      }
      const toDay = (at: number | string, dur = 2) => {
        tl.to('.moon', { y: 700, duration: dur, ease: 'power1.in' }, at)
        tl.to(['.sky-night', '.hills-night', '.stars', '.night-tint'], { opacity: 0, duration: dur / 2 }, '<')
        tl.to('.sky-dusk', { opacity: 0, duration: dur / 2 }, `<${dur / 2}`)
        tl.to('.sun', { y: 0, duration: dur, ease: 'power1.out' }, '<')
      }

      // Starting state.
      tl.set(['.night-tint', '.sky-dusk', '.sky-night', '.hills-night', '.stars', '.qmark', '.pairs', '.board', '.timeline', '.left-glow', '.lost'], { opacity: 0 }, 0)
      tl.set('.moon', { y: 700 }, 0)
      tl.set('.sun', { y: 0 }, 0)
      tl.set('.dim', { opacity: 0 }, 0)
      PEN.forEach((p, i) => tl.set(`.sheep-${i}`, { x: p.x, y: p.y, opacity: 1 }, 0))
      PEN.forEach((_, i) => tl.set(`.dir-${i}`, { scaleX: 1 }, 0))
      for (let i = 0; i < 5; i++) {
        tl.set(`.pair-${i}`, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, 0)
        tl.set(`.drop-${i}`, { x: AMA.x - 40, y: AMA.y - 150, opacity: 0 }, 0)
        tl.set(`.out-${i}`, { x: BAG.x, y: BAG.y - 40, opacity: 0 }, 0)
        tl.set(`.bsheep-${i}, .bpebble-${i}, .bline-${i}, .btally-${i}`, { opacity: 0 }, 0)
      }
      tl.set('.tl-axis', { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      for (let i = 0; i < 4; i++) tl.set(`.tl-pt-${i}`, { opacity: 0, y: 20 }, 0)

      // b0: meet Ama.
      tl.addLabel('b0', 0.01)
      tl.fromTo('.ama', { x: AMA.x - 160, opacity: 0 }, { x: AMA.x, opacity: 1, duration: 1.4, ease: 'back.out(1.4)' }, 'b0')

      // b1: the sheep go out to graze.
      tl.addLabel('b1', '+=0.3')
      FIELD.forEach((f, i) => {
        tl.to(`.sheep-${i}`, { x: GATE.x, y: GATE.y, duration: 0.9, ease: 'power1.in' }, `b1+=${i * 0.55}`)
        tl.to(`.dir-${i}`, { scaleX: -1, duration: 0.15 }, '<')
        tl.fromTo(`.hop-${i}`, { y: 0 }, { y: -10, duration: 0.11, repeat: 7, yoyo: true }, '<')
        walk(i, f, -1, '>', 1.5)
      })

      // b2: night falls and they come home. The question.
      tl.addLabel('b2', '+=0.2')
      toNight('b2', 2.4)
      PEN.forEach((p, i) => {
        tl.to(`.sheep-${i}`, { x: GATE.x, y: GATE.y, duration: 1.2 }, `b2+=${1 + i * 0.45}`)
        tl.to(`.dir-${i}`, { scaleX: 1, duration: 0.15 }, '<')
        tl.fromTo(`.hop-${i}`, { y: 0 }, { y: -10, duration: 0.15, repeat: 7, yoyo: true }, '<')
        walk(i, p, 1, '>', 0.9)
      })
      tl.fromTo('.qmark', { opacity: 0, scale: 0.3, transformOrigin: '50% 100%' }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, '>-0.2')

      // b3: quick guess (the scene hides the story sheep and shows a milling flock).
      tl.addLabel('b3', '+=0.4')
      tl.to('.qmark', { opacity: 0, duration: 0.4 }, 'b3')
      tl.to('.story-sheep', { opacity: 0, duration: 0.4 }, 'b3')

      // b4: next morning, one pebble per sheep at the gate.
      tl.addLabel('b4', '+=0.6')
      tl.to('.story-sheep', { opacity: 1, duration: 0.4 }, 'b4')
      toDay('b4', 1.8)
      tl.to('.pairs', { opacity: 1, duration: 0.5 }, 'b4+=1.6')
      FIELD.forEach((f, i) => {
        const at = `b4+=${2 + i * 1.5}`
        tl.to(`.sheep-${i}`, { x: GATE.x, y: GATE.y, duration: 0.7 }, at)
        tl.to(`.dir-${i}`, { scaleX: -1, duration: 0.15 }, '<')
        tl.fromTo(`.drop-${i}`, { x: AMA.x - 40, y: AMA.y - 150, opacity: 0 }, { opacity: 1, duration: 0.2 }, '>')
        tl.to(`.drop-${i}`, { x: BAG.x, y: BAG.y - 50, duration: 0.45, ease: 'power2.in' }, '>')
        tl.to(`.drop-${i}`, { opacity: 0, duration: 0.1 }, '>')
        tl.to(`.pair-${i}`, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '<')
        walk(i, f, -1, `${at}+=0.75`, 1.2)
      })

      // b5: one for one, the pairs pulse in turn.
      tl.addLabel('b5', '+=0.2')
      for (let i = 0; i < 5; i++) {
        tl.to(`.pair-${i}`, { scale: 1.25, duration: 0.3, yoyo: true, repeat: 1 }, `b5+=${0.3 + i * 0.7}`)
      }

      // b6: night, four sheep come home, one pebble out for each.
      tl.addLabel('b6', '+=0.4')
      toNight('b6', 2)
      for (let i = 0; i < 4; i++) {
        const at = `b6+=${1.6 + i * 1.3}`
        tl.to(`.sheep-${i}`, { x: GATE.x, y: GATE.y, duration: 0.8 }, at)
        tl.to(`.dir-${i}`, { scaleX: 1, duration: 0.15 }, '<')
        tl.to(`.out-${i}`, { opacity: 1, duration: 0.15 }, '>')
        tl.to(`.out-${i}`, { x: 560 + i * 48, y: 840, duration: 0.5, ease: 'power2.out' }, '>')
        tl.to(`.pcheck-${i}`, { opacity: 1, duration: 0.3 }, '<')
        walk(i, PEN[i], 1, `${at}+=0.8`, 0.7)
      }
      tl.to('.sheep-4', { opacity: 0, duration: 0.6 }, 'b6+=1.6')

      // b7: one pebble left over, and the lost sheep on the hill.
      tl.addLabel('b7', '+=0.3')
      tl.to('.out-4', { opacity: 1, duration: 0.2 }, 'b7')
      tl.to('.out-4', { x: BAG.x, y: BAG.y - 110, duration: 0.6, ease: 'back.out(2)' }, '>')
      tl.to('.left-glow', { opacity: 1, duration: 0.4 }, '<')
      tl.to('.lost', { opacity: 1, duration: 0.8 }, '>+0.4')
      tl.to('.pair-4', { scale: 1.3, duration: 0.35, yoyo: true, repeat: 3 }, '<')

      // b8: matching, from things to marks.
      tl.addLabel('b8', '+=0.6')
      tl.to(['.pairs', '.left-glow', '.lost', '.out-4'], { opacity: 0, duration: 0.4 }, 'b8')
      tl.to('.dim', { opacity: 0.55, duration: 0.6 }, 'b8')
      tl.to('.board', { opacity: 1, duration: 0.6 }, '<')
      for (let i = 0; i < 5; i++) {
        tl.to(`.bsheep-${i}`, { opacity: 1, duration: 0.3 }, `b8+=${0.6 + i * 0.25}`)
      }
      for (let i = 0; i < 5; i++) {
        tl.to(`.bline-${i}`, { opacity: 1, duration: 0.3 }, `b8+=${2 + i * 0.4}`)
        tl.to(`.bpebble-${i}`, { opacity: 1, duration: 0.3 }, '<0.15')
      }
      for (let i = 0; i < 5; i++) {
        tl.to(`.btally-${i}`, { opacity: 1, duration: 0.3 }, `b8+=${4.4 + i * 0.35}`)
      }

      // b9: the timeline of real history.
      tl.addLabel('b9', '+=0.6')
      tl.to('.board', { opacity: 0, duration: 0.5 }, 'b9')
      tl.to('.timeline', { opacity: 1, duration: 0.5 }, '<')
      tl.to('.tl-axis', { scaleX: 1, duration: 1.2, ease: 'power2.out' }, '>')
      for (let i = 0; i < 4; i++) {
        tl.to(`.tl-pt-${i}`, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, `b9+=${1.2 + i * 1.4}`)
      }

      // b10: night watch. The world comes back, the story sheep step aside.
      tl.addLabel('b10', '+=0.8')
      tl.to('.timeline', { opacity: 0, duration: 0.5 }, 'b10')
      tl.to('.dim', { opacity: 0, duration: 0.6 }, '<')
      tl.to('.story-sheep', { opacity: 0, duration: 0.3 }, '<')
      tl.addLabel('end', '+=0.4')
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <g className="scene-world">
        <Sky />
        <g className="sky-dusk"><Sky top={C.skyDusk} low={C.skyDuskLow} /></g>
        <g className="sky-night"><Sky top={C.skyNight} low={C.skyNightLow} /></g>
        <g className="stars"><Stars /></g>
        <At x={1320} y={170}><g className="sun"><Sun /></g></At>
        <At x={210} y={160}><g className="moon"><Moon /></g></At>
        <Hills />
        <g className="hills-night"><Hills far={C.hillNightFar} near={C.hillNight} front="#3D6E66" /></g>
        <At x={150} y={610} s={0.8}><Tree /></At>
        <At x={1500} y={600} s={0.6}><Tree /></At>
        <At x={1060} y={740}><Pen w={430} /></At>
        <rect className="night-tint" x={0} y={0} width={1600} height={900} fill={C.skyNight} opacity={0} />
        <g className="lost">
          <At x={LOST.x} y={LOST.y} s={0.45} flip><Sheep /></At>
          <At x={LOST.x + 40} y={LOST.y - 40}><Bubble text="Baa!" w={150} h={66} size={30} /></At>
        </g>
        <g className="ama" data-tutor="Ama the shepherd">
          <At x={0} y={AMA.y}><Shepherd /></At>
        </g>
        <At x={BAG.x} y={BAG.y} data-tutor="the pebble bag"><PebbleBag open /></At>
        <g className="qmark">
          <At x={AMA.x + 70} y={AMA.y - 300}><Bubble text="?" w={110} h={110} size={84} /></At>
        </g>
        <g className="story-sheep">
          {PEN.map((_, i) => (
            <g key={i} className={`sheep-${i}`}>
              <g className={`dir-${i}`}>
                <g className={`hop-${i}`}>
                  <g transform="scale(0.8)"><Sheep /></g>
                </g>
              </g>
            </g>
          ))}
        </g>
        <g className="drops">
          {PEN.map((_, i) => (
            <g key={i} className={`drop-${i}`}><Pebble seed={i} /></g>
          ))}
        </g>
        <g className="outs" style={{ opacity: 1 }}>
          {PEN.map((_, i) => (
            <g key={i} className={`out-${i}`}><Pebble seed={i} /></g>
          ))}
        </g>
        <g className="left-glow">
          <At x={BAG.x} y={BAG.y - 110}><circle r={34} fill={C.sunGlow} opacity={0.6} className="pulse" /></At>
        </g>
        <Pairs />
      </g>

      <rect className="dim" x={0} y={0} width={1600} height={900} fill={C.ink} opacity={0} />
      <MatchingBoard />
      <HistoryTimeline />

      {id === 'try-guess' && <GuessFlock {...props} />}
      {id === 'night-watch' && <NightWatch {...props} />}
    </g>
  )
}

/** The top strip that builds one sheep-and-pebble pair per sheep that walks out. */
function Pairs() {
  return (
    <g className="pairs" data-tutor="the sheep and pebble pairs">
      <rect x={470} y={36} width={660} height={250} rx={40} fill={C.white} opacity={0.9} />
      {PEN.map((_, i) => (
        <g key={i} className={`pair-${i}`}>
          <g transform={`translate(${552 + i * 124} 0)`}>
            <At y={104} s={0.55}><Sheep blink={false} /></At>
            <line x1={0} y1={160} x2={0} y2={196} stroke={C.inkSoft} strokeWidth={5} strokeDasharray="4 8" strokeLinecap="round" />
            <At y={228} s={1.4}><Pebble seed={i} /></At>
            <g className={`pcheck-${i}`} opacity={0}>
              <circle cx={44} cy={62} r={18} fill={C.teal} />
              <path d="M 35 62 l 7 7 l 12 -13" stroke={C.white} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </g>
      ))}
    </g>
  )
}

/** Sheep, pebbles and tally marks lined up: the same idea in three forms. */
function MatchingBoard() {
  const rows = [300, 390, 480, 570, 660]
  return (
    <g className="board">
      <rect x={260} y={100} width={1080} height={670} rx={40} fill={C.cream} />
      <At x={800} y={165}><Label text="Matching: one for one" size={56} /></At>
      <At x={490} y={232}><Label text="sheep" size={32} color={C.inkSoft} weight={700} /></At>
      <At x={800} y={232}><Label text="pebbles" size={32} color={C.inkSoft} weight={700} /></At>
      <At x={1110} y={232}><Label text="marks" size={32} color={C.inkSoft} weight={700} /></At>
      {rows.map((y, i) => (
        <g key={i}>
          <g className={`bsheep-${i}`}><At x={480} y={y - 14} s={0.56}><Sheep blink={false} /></At></g>
          <g className={`bline-${i}`}>
            <line x1={565} y1={y} x2={760} y2={y} stroke={C.coral} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" />
            <line x1={840} y1={y} x2={1060} y2={y} stroke={C.coral} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" />
          </g>
          <g className={`bpebble-${i}`}><At x={800} y={y} s={1.5}><Pebble seed={i} /></At></g>
          <g className={`btally-${i}`}>
            <line x1={1110} y1={y - 34} x2={1115} y2={y + 34} stroke={C.ink} strokeWidth={11} strokeLinecap="round" />
          </g>
        </g>
      ))}
    </g>
  )
}

/** A real-history timeline: notched bones, clay tokens, written numbers, and you. */
function HistoryTimeline() {
  const xs = [330, 630, 940, 1250]
  const when = (x: number, a: string, b: string) => (
    <g>
      <At x={x} y={624}><Label text={a} size={27} color={C.inkSoft} weight={600} /></At>
      <At x={x} y={658}><Label text={b} size={27} color={C.inkSoft} weight={600} /></At>
    </g>
  )
  return (
    <g className="timeline" data-tutor="the history timeline">
      <rect x={140} y={100} width={1320} height={670} rx={40} fill={C.cream} />
      <At x={800} y={170}><Label text="People have kept track like this for ages" size={44} /></At>
      <g className="tl-axis">
        <line x1={220} y1={500} x2={1380} y2={500} stroke={C.inkSoft} strokeWidth={8} strokeLinecap="round" />
        <path d="M 1360 480 L 1392 500 L 1360 520" stroke={C.inkSoft} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="tl-pt-0">
        <circle cx={xs[0]} cy={500} r={14} fill={C.coral} />
        <At x={xs[0]} y={380} s={0.95}><NotchedBone notches={7} /></At>
        <At x={xs[0]} y={572}><Label text="Notched bones" size={34} /></At>
        {when(xs[0], 'about 20,000', 'years ago')}
      </g>
      <g className="tl-pt-1">
        <circle cx={xs[1]} cy={500} r={14} fill={C.coral} />
        <At x={xs[1] - 60} y={392} s={1.3}><ClayToken kind="cone" /></At>
        <At x={xs[1]} y={398} s={1.3}><ClayToken kind="ball" /></At>
        <At x={xs[1] + 60} y={392} s={1.3}><ClayToken kind="disc" /></At>
        <At x={xs[1]} y={572}><Label text="Clay tokens" size={34} /></At>
        {when(xs[1], 'about 10,000', 'years ago')}
      </g>
      <g className="tl-pt-2">
        <circle cx={xs[2]} cy={500} r={14} fill={C.coral} />
        <rect x={xs[2] - 80} y={320} width={160} height={124} rx={16} fill={C.clay} />
        {[0, 1, 2].map((k) => (
          <path key={k} d={`M ${xs[2] - 46 + k * 36} 352 l 14 0 l -7 14 z M ${xs[2] - 39 + k * 36} 362 l 0 50`} stroke={C.clayDark} strokeWidth={7} fill={C.clayDark} strokeLinecap="round" />
        ))}
        <At x={xs[2]} y={572}><Label text="Written numbers" size={34} /></At>
        {when(xs[2], 'about 5,000', 'years ago')}
      </g>
      <g className="tl-pt-3">
        <circle cx={xs[3]} cy={500} r={18} fill={C.mustard} />
        <path d={starPath(xs[3], 384, 66, 30)} fill={C.mustard} />
        <At x={xs[3]} y={390}><Label text="You!" size={30} color={C.ink} /></At>
        <At x={xs[3]} y={572}><Label text="Today" size={34} /></At>
        {when(xs[3], 'you are', 'learning it now')}
      </g>
    </g>
  )
}

function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/* ---------------------------------------------------------------- milling flock */

/** Spots for sheep wandering inside the pen, and how each one drifts. */
const MILL = [
  { x: 1120, y: 625, dx: 40, dur: 3.1 },
  { x: 1230, y: 615, dx: -35, dur: 2.7 },
  { x: 1340, y: 628, dx: -40, dur: 3.5 },
  { x: 1440, y: 640, dx: -30, dur: 2.9 },
  { x: 1170, y: 705, dx: 45, dur: 3.3 },
  { x: 1290, y: 712, dx: -40, dur: 2.5 },
  { x: 1400, y: 718, dx: -35, dur: 3.7 },
]

function MillingSheep({ count, matched, onRef }: { count: number; matched: (number | null)[]; onRef?: (i: number, el: SVGGElement | null) => void }) {
  return (
    <g>
      {MILL.slice(0, count).map((m, i) => {
        const done = matched[i] !== null && matched[i] !== undefined
        return (
          <g key={i} transform={`translate(${m.x} ${m.y})`}>
            <g
              ref={(el) => onRef?.(i, el)}
              className={done ? undefined : 'mill'}
              style={{ ['--dx' as string]: `${m.dx}px`, animationDuration: `${m.dur}s` }}
              data-tutor={`sheep ${i + 1}`}
            >
              <g transform={`scale(${m.dx > 0 ? 0.68 : -0.68} 0.68)`}>
                <Sheep />
              </g>
              {done && (
                <g>
                  <At y={-34}><Pebble seed={matched[i] ?? 0} /></At>
                  <circle cx={34} cy={-50} r={13} fill={C.teal} />
                  <path d="M 28 -50 l 5 5 l 9 -10" stroke={C.white} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** Quick "take a guess" moment: the flock mills about and it is hard to tell. */
function GuessFlock({ onChallengeDone, say, reportState, emit }: SceneProps) {
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    reportState('Seven sheep are milling around inside the pen at night. The student is asked to guess whether every sheep is home. There is no right answer yet: the point is to feel how hard it is to keep track without numbers.')
  }, [reportState])
  const pick = (choice: string) => {
    if (picked) return
    setPicked(choice)
    emit({ type: 'progress', detail: `guessed ${choice}` })
    say('Hard to tell, right? When the sheep keep moving, it is really tricky to keep track. Ama needed a better way.')
    window.setTimeout(onChallengeDone, 5200)
  }
  return (
    <g>
      <MillingSheep count={7} matched={Array(7).fill(null)} />
      <rect x={250} y={120} width={700} height={250} rx={36} fill={C.white} opacity={0.94} />
      <At x={600} y={185}><Label text="Is every sheep home?" size={48} /></At>
      <SvgButton x={400} y={290} w={170} label="Yes" color={C.teal} onClick={() => pick('yes')} disabled={!!picked && picked !== 'yes'} tutor="Yes button" />
      <SvgButton x={600} y={290} w={170} label="No" color={C.coral} onClick={() => pick('no')} disabled={!!picked && picked !== 'no'} tutor="No button" />
      <SvgButton x={800} y={290} w={190} label="Not sure" color={C.violet} onClick={() => pick('not sure')} disabled={!!picked && picked !== 'not sure'} tutor="Not sure button" />
    </g>
  )
}

/* ---------------------------------------------------------------- the night watch game */

const ROUNDS = [
  { pebbles: 6, sheep: 5 },
  { pebbles: 7, sheep: 7 },
]

function clothSpot(i: number) {
  return { x: 330 + i * 52, y: 812 }
}

function NightWatch({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [round, setRound] = useState(0)
  const [matched, setMatched] = useState<(number | null)[]>(() => Array(ROUNDS[0].sheep).fill(null))
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null)
  const [answer, setAnswer] = useState<'right' | null>(null)
  const sheepEls = useRef<(SVGGElement | null)[]>([])
  const { pebbles, sheep } = ROUNDS[round]
  const used = new Set(matched.filter((m): m is number => m !== null))
  const allMatched = matched.every((m) => m !== null)
  const leftover = pebbles - used.size

  useEffect(() => {
    setHints([
      'Try giving each sheep just one pebble.',
      'Drag a pebble from the cloth onto a sheep. Every sheep that came home gets one pebble.',
      'When every sheep has a pebble, look at the cloth. Is any pebble left over? Each pebble stands for a sheep that went out this morning.',
    ])
  }, [setHints])

  useEffect(() => {
    const correct = pebbles > sheep ? `No, ${pebbles - sheep} sheep ${pebbles - sheep === 1 ? 'is' : 'are'} still out (there will be ${pebbles - sheep} pebble left over)` : 'Yes, every sheep is home (no pebbles left over)'
    reportState(
      `Night watch game, round ${round + 1} of 2. ${pebbles} pebbles are on the cloth (one for each sheep that went out this morning). ${sheep} sheep are in the pen, wandering around. The student has matched ${used.size} pebble${used.size === 1 ? '' : 's'} to sheep so far${allMatched ? `, every sheep in the pen now has a pebble, and ${leftover} pebble${leftover === 1 ? ' is' : 's are'} left on the cloth` : ''}. Correct answer: ${correct}. Common mix-up: trying to count the moving sheep instead of matching, or thinking leftover pebbles are just extra.`,
    )
  }, [round, pebbles, sheep, used.size, allMatched, leftover, reportState])

  const dropOn = (i: number, p: { x: number; y: number }) => {
    let best = -1
    let bestD = 95
    sheepEls.current.forEach((el, k) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const c = toStage(el, r.left + r.width / 2, r.top + r.height / 2)
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < bestD) {
        bestD = d
        best = k
      }
    })
    if (best < 0) return
    if (matched[best] !== null) {
      say('That sheep already has a pebble. Just one pebble for each sheep!')
      emit({ type: 'attempt', correct: false, detail: 'gave a second pebble to the same sheep' })
      return
    }
    setMatched((m) => m.map((v, k) => (k === best ? i : v)))
    emit({ type: 'progress', detail: 'matched a pebble to a sheep' })
  }

  const choose = (yes: boolean) => {
    if (answer) return
    const right = yes === (pebbles === sheep)
    emit({ type: 'attempt', correct: right, detail: yes ? 'said everyone is home' : 'said some are still out' })
    if (!right) {
      say(
        yes
          ? 'Hmm, look at the cloth. Is there a pebble left over? Each pebble stands for a sheep that went out this morning.'
          : 'Look again. Is any pebble left on the cloth? If every pebble found a sheep, who could be missing?',
      )
      return
    }
    setAnswer('right')
    if (round === 0) {
      say('Yes! One pebble is left over, so one sheep is still out on the hill. Ama will go and bring it home. Now, the next night.')
      window.setTimeout(() => {
        setRound(1)
        setMatched(Array(ROUNDS[1].sheep).fill(null))
        setAnswer(null)
      }, 7000)
    } else {
      say('That is right! Every pebble found a sheep, so every sheep is home. Goodnight, flock!')
      window.setTimeout(onChallengeDone, 2500)
    }
  }

  return (
    <g>
      <MillingSheep count={sheep} matched={matched} onRef={(i, el) => (sheepEls.current[i] = el)} />
      {round === 0 && answer === 'right' && (
        <g>
          <At x={LOST.x} y={LOST.y} s={0.45} flip><Sheep /></At>
          <At x={LOST.x + 40} y={LOST.y - 40}><Bubble text="Baa!" w={150} h={66} size={30} /></At>
        </g>
      )}
      <rect x={290} y={780} width={pebbles * 52 + 28} height={64} rx={18} fill={C.berry} opacity={0.85} data-tutor="the pebble cloth" />
      {Array.from({ length: pebbles }, (_, i) => {
        if (used.has(i)) return null
        const home = clothSpot(i)
        const p = drag?.i === i ? drag : home
        return <DraggablePebble key={`${round}-${i}`} i={i} x={p.x} y={p.y} glow={allMatched} onMove={(q) => setDrag({ i, ...q })} onDrop={(q) => { setDrag(null); dropOn(i, q) }} />
      })}
      <rect x={200} y={110} width={860} height={allMatched ? 280 : 120} rx={36} fill={C.white} opacity={0.94} />
      <At x={630} y={170}>
        <Label text={allMatched ? 'Is every sheep home?' : `Night ${round + 1}: one pebble for each sheep`} size={allMatched ? 46 : 38} />
      </At>
      {allMatched && (
        <g>
          <SvgButton x={460} y={300} w={330} label="Yes, all home" color={C.teal} onClick={() => choose(true)} disabled={!!answer} tutor="Yes, all home button" />
          <SvgButton x={810} y={300} w={330} label="No, some are out" color={C.coral} onClick={() => choose(false)} disabled={!!answer} tutor="No, some are out button" />
        </g>
      )}
    </g>
  )
}

function DraggablePebble({
  i,
  x,
  y,
  glow,
  onMove,
  onDrop,
}: {
  i: number
  x: number
  y: number
  glow: boolean
  onMove: (p: { x: number; y: number }) => void
  onDrop: (p: { x: number; y: number }) => void
}) {
  const drag = useDrag({ onMove, onEnd: onDrop })
  return (
    <g transform={`translate(${x} ${y})`} {...drag} data-tutor={`pebble ${i + 1}`}>
      <circle r={30} fill="transparent" />
      <g transform="scale(1.3)"><Pebble seed={i} glow={glow} /></g>
    </g>
  )
}

export const stop1: Stop = {
  id: 'origin',
  title: 'Why math was born',
  branch: 'origin',
  beats: BEATS,
  Scene,
}
