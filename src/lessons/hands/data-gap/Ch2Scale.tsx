import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Blueprint, DeskLamp, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { GuessPlay, ITEMS } from './GuessPlay'
import { DgDefs, commas, counter } from './parts'
import { ScaleReading } from './readings'

export const CUES: Cue[] = [
  { id: 'lifetimes', say: 'Let’s measure the gap in human terms. The text behind a big language model would take one person about a quarter of a million years to read.' },
  { id: 'robots', say: 'Now robot data. A famous dataset from 2024, gathered by thirteen labs over a year, holds about three hundred and fifty hours. About two weeks.' },
  { id: 'biggest', say: 'By 2026 the biggest collections reached around half a million hours. That sounds huge. It’s about fifty-seven years: a few human childhoods of using your hands.' },
  { id: 'ratio', say: 'So robots are learning from thousands of times less experience than a language model gets. And yet you learned to use your hands from just one childhood.' },
  { id: 'guess', say: 'Guess first. Drag each dataset to where you think it sits on this scale, from a minute to a million years.', play: true },
]

const STATE = [
  'A single reader in silhouette at a desk under a warm lamp, a window behind. Time-lapse: days flicker past, the seasons outside turn (green, gold, bare, snow), books pile up on the desk, the reader changes as generations pass, and a counter climbs to 250,000 years of reading. Then the camera pulls back: the reader becomes one lime dot in a long line of dots stretching off-screen, each dot an 80-year lifetime of reading, about 3,000 lifetimes in all. That is the text behind a big language model (about 15 trillion tokens, Llama 3) at 250 words a minute, 8 hours a day.',
  'A small stack of lime tiles, each a recorded clip: DROID, a 2024 robot dataset gathered by 13 labs over about a year: 76,000 clips, 350 hours. Beside it a calendar fills in day by day: 15 days. Point: a flagship academic robot dataset is about two weeks of experience.',
  'A tower chart of lime tiles growing: π0 (Physical Intelligence, 2024) 10,000 hours ≈ 1.1 years; Generalist GEN-0 (Nov 2025) 270,000 hours ≈ 31 years; Generalist GEN-1 (Apr 2026) about 500,000 hours ≈ 57 years, all from wearables on people. DROID is a hairline at the foot. Beside it a child grows into an adult in silhouette with a counter: about 100,000 waking hours by age 18 (a warm bar). The largest robot corpus is a few childhoods of hand use.',
  'A log-scale bar chart draws itself, each step ×10 from 1 year to a million: text for a language model ≈ 250,000 years towers over the biggest robot corpus ≈ 57 years, which stands just above one human childhood ≈ 18 years (glowing warm, labelled "you"). A double arrow marks ≈ 4,400× between text and robot data. Point: robots learn from thousands of times less experience than a language model, yet a person learns hand skills from one childhood.',
]

/* the reader's room */
const READER = { x: 560, y: 760 }
const WIN = { x: 960, y: 110, w: 420, h: 470 }
const SEASONS = ['#2f5a3a', '#4f7a2e', '#b06a24', '#5b6b88', '#dfe8f2', '#2f5a3a', '#4f7a2e', '#b06a24', '#5b6b88', '#dfe8f2', '#2f5a3a']

/* the tower */
const BASE = 800
const PX_PER_H = 640 / 500000
const TOWER = [
  { name: 'DROID', h: 350, x: 220, note: '350 h · 15 days' },
  { name: 'π0', h: 10000, x: 430, note: '10,000 h · ≈1.1 yr' },
  { name: 'GEN-0', h: 270000, x: 590, note: '270,000 h · ≈31 yr' },
  { name: 'GEN-1', h: 500000, x: 760, note: '≈500,000 h · ≈57 yr' },
]

/* the log chart: 100 px per ×10, from 1 year */
const LOG = { base: 800, px: 100 }
const logH = (years: number) => Math.log10(years) * LOG.px
const BARS = [
  { name: 'text for a language model', years: 250000, x: 470, color: C.paper, val: '≈250,000 years' },
  { name: 'biggest robot dataset', years: 57, x: 820, color: C.lime, val: '≈57 years' },
  { name: 'one childhood', years: 18, x: 1170, color: C.keyLight, val: '18 years' },
]

export function Ch2Scale({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const roomRef = useRef<SVGGElement>(null)
  const dataRef = useRef<SVGGElement>(null)
  const [placedN, setPlacedN] = useState(0)
  const [guesses, setGuesses] = useState<Record<string, number | null> | null>(null)
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    const roomCam = camera(roomRef.current, { x: 820, y: 470, zoom: 1.12 })
    const dataCam = camera(dataRef.current, { x: 800, y: 450, zoom: 1 })
    const shots = ['.c2-room', '.c2-line', '.c2-data', '.c2-log', '.c2-guess']
    const cut = (show: string[], at: number) => {
      for (const s of shots) tl.set(s, { opacity: show.includes(s) ? 1 : 0 }, at)
    }

    /* b0: a quarter of a million years of reading, then one dot in a line of lifetimes. */
    tl.addLabel('b0', 0)
    cut(['.c2-room'], 0)
    roomCam.to(tl, { x: 700, y: 520, zoom: 1.3 }, 0, 7.6, 'sine.inOut')
    // days and seasons race past the window
    SEASONS.forEach((c, i) => {
      if (i === 0) return
      tl.fromTo('.c2-leaves', { attr: { fill: SEASONS[i - 1] } }, { attr: { fill: c }, duration: 0.6, ease: 'none', immediateRender: false }, 1 + i * 0.6)
    })
    tl.fromTo('.c2-sky', { opacity: 0.2 }, { opacity: 0.9, duration: 0.12, yoyo: true, repeat: 47, ease: 'none', immediateRender: false }, 1)
    fade(tl, '.c2-snow', 1, 3.2, 0.3)
    fade(tl, '.c2-snow', 0, 3.8, 0.3, 1)
    fade(tl, '.c2-snow2', 1, 6.2, 0.3)
    fade(tl, '.c2-snow2', 0, 6.8, 0.3, 1)
    tl.fromTo('.c2-book', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.2, stagger: 0.32, immediateRender: false }, 1.2)
    fade(tl, '.c2-web', 1, 4.5, 2)
    // generations: the reader changes
    fade(tl, '.c2-reader-0', 0, 3.4, 0.4, 1)
    fade(tl, '.c2-reader-1', 1, 3.4, 0.4)
    fade(tl, '.c2-reader-1', 0, 5.6, 0.4, 1)
    fade(tl, '.c2-reader-2', 1, 5.6, 0.4)
    tl.fromTo('.c2-page', { scaleX: 1, transformOrigin: '0% 50%' }, { scaleX: -1, duration: 0.18, repeat: 23, ease: 'none', transformOrigin: '0% 50%', immediateRender: false }, 1)
    fade(tl, '.c2-count', 1, 1.0, 0.5)
    counter(tl, el, '.c2-years', 0, 250000, 1.0, 6.4, (v) => commas(v), 'power2.in')
    // pull back: the room shrinks to a dot at the head of a line of lifetimes
    const b0p = 7.8
    tl.fromTo('.c2-roomwrap', { scale: 1, x: 0, y: 0 }, { scale: 0.012, x: 160 - READER.x, y: 450 - 560, duration: 2.6, ease: 'power3.inOut', svgOrigin: `${READER.x} 560`, immediateRender: false }, b0p)
    fade(tl, '.c2-count', 0, b0p, 0.6, 1)
    fade(tl, '.c2-roomwrap', 0, b0p + 1.2, 1.2, 1)
    fade(tl, '.c2-line', 1, b0p + 0.8, 0.8)
    tl.fromTo('.c2-dotclip', { attr: { width: 0 } }, { attr: { width: 1900 }, duration: 3.2, ease: 'power2.in', immediateRender: false }, b0p + 1.2)
    fade(tl, '.c2-linelab', 1, b0p + 2.2, 0.8)
    tl.set('.c2-room', { opacity: 0 }, b0p + 2.6)

    /* b1: DROID, a small stack of clips and two weeks on a calendar. */
    const b1 = 12.8
    tl.addLabel('b1', b1)
    cut(['.c2-data'], b1)
    dataCam.to(tl, { x: 760, y: 470, zoom: 1.06 }, b1, 10, 'sine.inOut')
    fade(tl, '.c2-droid', 1, b1, 0.4)
    tl.fromTo('.c2-tile', { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power2.out', immediateRender: false }, b1 + 0.4)
    fade(tl, '.c2-droidlab', 1, b1 + 2.6, 0.6)
    fade(tl, '.c2-cal', 1, b1 + 4.6, 0.6)
    tl.fromTo('.c2-day', { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.18, immediateRender: false }, b1 + 5.2)
    fade(tl, '.c2-callab', 1, b1 + 8.0, 0.6)

    /* b2: the tower of the biggest datasets, and a child growing up beside it. */
    const b2 = b1 + 10.6
    tl.addLabel('b2', b2)
    fade(tl, '.c2-cal, .c2-callab, .c2-droidlab', 0, b2, 0.5, 1)
    tl.fromTo('.c2-droidstack', { x: 0, y: 0, scale: 1, transformOrigin: '50% 100%' }, { x: TOWER[0].x - 380, y: 0, scale: 0.35, duration: 1.2, ease: 'power2.inOut', transformOrigin: '50% 100%', immediateRender: false }, b2)
    fade(tl, '.c2-tower', 1, b2 + 0.4, 0.5)
    tl.set('.c2-col-1, .c2-col-2, .c2-col-3', { scaleY: 0, transformOrigin: '50% 100%' }, b2)
    tl.set('.c2-kidbar', { scaleY: 0, transformOrigin: '50% 100%' }, b2)
    tl.set('.c2-grow', { scale: 0.48, transformOrigin: '50% 100%' }, b2)
    TOWER.slice(1).forEach((_, i) => {
      tl.fromTo(`.c2-col-${i + 1}`, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 1.4 + i * 0.6, ease: 'power2.out', transformOrigin: '50% 100%', immediateRender: false }, b2 + 0.8 + i * 1.6)
      fade(tl, `.c2-colab-${i + 1}`, 1, b2 + 1.6 + i * 1.6 + i * 0.6, 0.5)
    })
    dataCam.to(tl, { x: 820, y: 460, zoom: 1 }, b2, 3)
    fade(tl, '.c2-kid', 1, b2 + 5.0, 0.6)
    tl.fromTo('.c2-grow', { scale: 0.48, transformOrigin: '50% 100%' }, { scale: 1, duration: 4.6, ease: 'sine.inOut', transformOrigin: '50% 100%', immediateRender: false }, b2 + 5.2)
    counter(tl, el, '.c2-hours', 0, 100000, b2 + 5.2, 4.6, (v) => commas(v), 'sine.inOut')
    tl.fromTo('.c2-kidbar', { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 4.6, ease: 'sine.inOut', transformOrigin: '50% 100%', immediateRender: false }, b2 + 5.2)
    fade(tl, '.c2-kidlab', 1, b2 + 9.6, 0.6)

    /* b3: the same story on a log scale. */
    const b3 = b2 + 11.8
    tl.addLabel('b3', b3)
    cut(['.c2-log'], b3)
    fade(tl, '.c2-log', 1, b3, 0.6)
    tl.fromTo('.c2-logaxis', { strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', immediateRender: false }, b3 + 0.2)
    tl.fromTo('.c2-logtick', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.12, immediateRender: false }, b3 + 0.5)
    tl.set('.c2-bar-0, .c2-bar-1, .c2-bar-2', { scaleY: 0, transformOrigin: '50% 100%' }, b3)
    BARS.forEach((_, i) => {
      tl.fromTo(`.c2-bar-${i}`, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 1.6, ease: 'power3.out', transformOrigin: '50% 100%', immediateRender: false }, b3 + 1.4 + i * 0.9)
      fade(tl, `.c2-barlab-${i}`, 1, b3 + 2.4 + i * 0.9, 0.5)
    })
    fade(tl, '.c2-ratio', 1, b3 + 4.6, 0.7)
    fade(tl, '.c2-you', 1, b3 + 7.6, 0.8)
    tl.fromTo('.c2-you-glow', { opacity: 0 }, { opacity: 0.9, duration: 0.8, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, b3 + 7.8)

    /* b4: the learner places the datasets on a log axis. */
    const b4 = b3 + 11.8
    tl.addLabel('b4', b4)
    cut(['.c2-guess'], b4)
    tl.fromTo('.c2-guessin', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, b4)
    tl.to({}, { duration: 2 }, b4 + 0.5)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-lamp', { opacity: 0.8, duration: 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-breath', { y: -2, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-shimmer', { opacity: 0.55, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.2 })
  })

  useEffect(() => {
    if (cueIndex === 4) {
      reportState(
        'The learner’s turn. A horizontal log axis of experience time runs from 1 minute to 1 million years; each tick is ×10 (5 min, 53 min, 9 h, 4 days, 5 weeks, 1 yr, 10 yr, 100 yr, 1,000 yr, 10,000 yr, 100,000 yr, 1M yr). Six rows, each with a draggable knob: "One person’s childhood of hand use", "DROID (13 labs, a year of collecting)", "π0’s robot data", "Generalist GEN-1", "OpenAI’s Rubik’s cube hand, in simulation", "Text for a big language model". The learner drags each knob to a guess, then presses "reveal" (after placing at least four). ' +
          `Placed so far: ${placedN} of 6. ` +
          (guesses ? 'Revealed: the knobs slid to the truth, with red arrows showing how far off each guess was. ' : '') +
          'True positions: childhood ≈ 11 years of continuous time (100,000 waking hours by 18); DROID 350 h ≈ 15 days; π0 10,000 h ≈ 1.1 years; GEN-1 ≈ 500,000 h ≈ 57 years; Dactyl ≈ 13,000 years of simulated experience; LLM text ≈ 250,000 years of reading. Likely mix-ups: placing robot datasets far too high (thousands of years), forgetting the axis is logarithmic, or thinking simulation is small.',
      )
      setHints(['Remember: three hundred and fifty hours is about two weeks.', 'This axis jumps by ten at every tick.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, placedN, guesses, reportState, setHints])

  const onPlace = (n: number) => {
    setPlacedN(n)
    emit({ type: 'progress', detail: `placed ${n} of 6 datasets on the scale` })
  }
  const onReveal = (g: Record<string, number | null>) => {
    if (guesses) return
    setGuesses(g)
    memory.dgScaleGuesses = g
    const far = ITEMS.filter((it) => g[it.id] !== null && Math.abs(Math.log10(g[it.id] as number) - Math.log10(it.years)) > 1).map((it) => it.id)
    emit({ type: 'attempt', correct: far.length <= 2, detail: far.length ? `revealed; more than ×10 off on: ${far.join(', ')}` : 'revealed; every guess within ×10' })
    void say('Most people guess robots have far more data than they do. The one thing in the same league as text is simulation, and that comes with its own catch.')
    window.setTimeout(() => playDoneRef.current(), 2400)
  }

  /* the dots of lifetimes */
  return (
    <g ref={root}>
      <DgDefs />
      <defs>
        <pattern id="dg-tiles" width={22} height={14} patternUnits="userSpaceOnUse">
          <rect width={22} height={14} fill={C.limeDark} />
          <rect x={1} y={1} width={20} height={12} rx={2} fill={C.lime} opacity={0.75} />
        </pattern>
      </defs>

      {/* ---------- b0: the reader ---------- */}
      <g className="c2-room" ref={roomRef}>
        <g className="c2-roomwrap">
          <g data-depth="0.6">
            <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-wall)" />
            <g>
              <rect className="c2-sky" x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="#7fb4e6" opacity={0.2} />
              <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="url(#cn-sky-night)" opacity={0.6} />
              {/* a tree outside, whose leaves turn with the seasons */}
              <path d={`M${WIN.x + 250} ${WIN.y + WIN.h} L${WIN.x + 262} ${WIN.y + 260} L${WIN.x + 200} ${WIN.y + 170} M${WIN.x + 262} ${WIN.y + 280} L${WIN.x + 330} ${WIN.y + 190}`} stroke={C.ink} strokeWidth={14} fill="none" />
              <g className="c2-leaves" fill={SEASONS[0]} opacity={0.85}>
                <circle cx={WIN.x + 220} cy={WIN.y + 170} r={70} />
                <circle cx={WIN.x + 300} cy={WIN.y + 150} r={80} />
                <circle cx={WIN.x + 340} cy={WIN.y + 220} r={60} />
              </g>
              {[0, 1].map((k) => (
                <g key={k} className={k ? 'c2-snow2' : 'c2-snow'} opacity={0}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <circle key={i} cx={WIN.x + ((i * 97) % WIN.w)} cy={WIN.y + ((i * 61) % WIN.h)} r={3} fill={C.white} opacity={0.8} />
                  ))}
                  <rect x={WIN.x} y={WIN.y + WIN.h - 40} width={WIN.w} height={40} fill={C.white} opacity={0.6} />
                </g>
              ))}
              <rect x={WIN.x - 12} y={WIN.y - 12} width={WIN.w + 24} height={WIN.h + 24} fill="none" stroke={C.ink1} strokeWidth={18} />
              <rect x={WIN.x + WIN.w / 2 - 5} y={WIN.y} width={10} height={WIN.h} fill={C.ink1} />
              <rect x={WIN.x} y={WIN.y + WIN.h * 0.45} width={WIN.w} height={10} fill={C.ink1} />
            </g>
            <g className="c2-web" opacity={0}>
              <path d="M-100 -60 L240 -60 M-100 -60 L180 60 M-100 -60 L120 160 M60 -60 Q 90 0 70 40 M140 -60 Q 150 40 120 90" stroke={C.mist} strokeOpacity={0.35} fill="none" />
            </g>
          </g>
          <g data-depth="1">
            <rect x={-600} y={780} width={2800} height={600} fill="url(#cn-floor)" />
            <g className="c2-lamp">
              <Pool x={640} y={600} r={460} color="key" opacity={0.95} />
            </g>
            <Beam x={760} y={410} w1={50} w2={420} len={260} angle={20} opacity={0.4} />
            {/* the desk */}
            <rect x={470} y={640} width={460} height={16} fill={C.ink3} />
            <rect x={490} y={656} width={14} height={124} fill={C.ink1} />
            <rect x={900} y={656} width={14} height={124} fill={C.ink1} />
            <DeskLamp x={880} y={640} s={1} />
            {/* the pile of finished books */}
            {Array.from({ length: 20 }, (_, i) => (
              <rect key={i} className="c2-book" x={700 + ((i * 13) % 40) - (i > 9 ? 120 : 0)} y={626 - (i % 10) * 15} width={92 - (i % 3) * 10} height={13} rx={2} fill={[C.keyDeep, C.ink4, '#6a2e1a', C.slate][i % 4]} opacity={0} />
            ))}
            {/* the reader: one person, then the next generation, then the next */}
            {[
              { hair: 'bun' as const },
              { hair: 'long' as const },
              { hair: 'short' as const },
            ].map((h, i) => (
              <g key={i} className={`c2-reader-${i}`} opacity={i === 0 ? 1 : 0}>
                <g className="c2-breath">
                  <rect x={READER.x - 80} y={READER.y - 100} width={70} height={12} rx={4} fill={C.ink} />
                  <rect x={READER.x - 94} y={READER.y - 230} width={14} height={140} rx={6} fill={C.ink} />
                  <Person name={`c2-r${i}`} x={READER.x - 50} y={READER.y + 20} s={1} pose={{ ...POSES.sitForward, head: 22, torso: 14, armN: 50, elbowN: 70, armF: 44, elbowF: 74 }} silhouette={C.ink} hair={h.hair} />
                </g>
              </g>
            ))}
            {/* the open book, its pages flicking */}
            <path d={`M${READER.x + 20} 560 L${READER.x + 52} 570 L${READER.x + 84} 560 L${READER.x + 84} 540 L${READER.x + 52} 550 L${READER.x + 20} 540 Z`} fill={C.bone} />
            <path className="c2-page" d={`M${READER.x + 52} 550 L${READER.x + 82} 541 L${READER.x + 82} 559 L${READER.x + 52} 568 Z`} fill={C.paper} />
            <Dust x={420} y={380} w={500} h={300} count={20} seed={4} />
          </g>
        </g>
        <g className="c2-count" opacity={0}>
          <text x={110} y={150} fill={C.keyLight} fontFamily={MONO} fontSize={64}>
            <tspan className="c2-years">0</tspan>
          </text>
          <text x={114} y={190} fill={C.mist} fontFamily={SANS} fontSize={24}>
            years of reading, 8 hours a day
          </text>
        </g>
      </g>

      {/* ---------- b0: the line of lifetimes ---------- */}
      <g className="c2-line" opacity={0}>
        <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} opacity={0.0} />
        <clipPath id="dg-dotclip">
          <rect className="c2-dotclip" x={140} y={300} width={0} height={300} />
        </clipPath>
        <g clipPath="url(#dg-dotclip)">
          {[0, 1, 2, 3, 4].map((r) => (
            <line key={r} x1={160} x2={1800} y1={370 + r * 40} y2={370 + r * 40} stroke={C.lime} strokeWidth={9} strokeLinecap="round" strokeDasharray="0 16" opacity={1 - r * 0.12} />
          ))}
        </g>
        <circle className="c2-linelab" cx={160} cy={450} r={16} fill="none" stroke={C.keyLight} strokeWidth={3} opacity={0} />
        <g className="c2-linelab" opacity={0}>
          <Label x={160} y={434} tx={250} ty={250} text="one lifetime of reading" sub="80 years, 8 hours a day" color={C.keyLight} hidden={false} />
          <text x={800} y={680} textAnchor="middle" fill={C.lime} fontFamily={SERIF} fontSize={64} fontWeight={600}>
            ≈ 3,000 lifetimes
          </text>
          <text x={800} y={724} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={24}>
            ~15 trillion tokens ≈ 11 trillion words ≈ 250,000 years
          </text>
          <text x={1560} y={250} textAnchor="end" fill={C.lime} fontFamily={MONO} fontSize={20} opacity={0.8}>
            and on, off the edge →
          </text>
        </g>
      </g>

      {/* ---------- b1-b2: robot data ---------- */}
      <g className="c2-data" ref={dataRef} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <rect x={-600} y={BASE} width={2800} height={600} fill={C.ink1} />
          <line x1={-600} x2={2200} y1={BASE} y2={BASE} stroke={C.lime} strokeOpacity={0.4} strokeWidth={2} />
          {/* DROID: a small stack of clips */}
          <g className="c2-droid" opacity={0}>
            <Pool className="c2-droidlab" x={380} y={BASE - 120} r={260} color="lime" opacity={0} />
            <g className="c2-droidstack">
              {Array.from({ length: 24 }, (_, i) => (
                <g key={i} className="c2-tile" opacity={0}>
                  <rect x={300 + (i % 4) * 42} y={BASE - 30 - Math.floor(i / 4) * 28} width={38} height={24} rx={3} fill={C.lime} opacity={0.75} />
                  <rect x={304 + (i % 4) * 42} y={BASE - 26 - Math.floor(i / 4) * 28} width={14} height={8} fill={C.ink} opacity={0.4} />
                </g>
              ))}
            </g>
            <g className="c2-droidlab" opacity={0}>
              <text x={380} y={500} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={56} fontWeight={600}>
                DROID
              </text>
              <text x={380} y={540} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
                2024 · 13 labs · ~12 months · 76,000 clips
              </text>
              <text x={380} y={590} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={34}>
                350 h ≈ 15 days
              </text>
            </g>
          </g>
          {/* two weeks on a calendar */}
          <g className="c2-cal" opacity={0}>
            <rect x={860} y={250} width={560} height={470} rx={14} fill={C.ink1} stroke={C.slate} strokeWidth={2} />
            <rect x={860} y={250} width={560} height={60} rx={14} fill={C.ink3} />
            <text x={1140} y={292} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={26} fontWeight={600}>
              one robot, running non-stop
            </text>
            {Array.from({ length: 35 }, (_, i) => {
              const cx = 880 + (i % 7) * 76
              const cy = 326 + Math.floor(i / 7) * 76
              return (
                <g key={i}>
                  <rect x={cx} y={cy} width={68} height={68} rx={8} fill={C.ink2} />
                  <text x={cx + 8} y={cy + 22} fill={C.fog} fontFamily={MONO} fontSize={15}>
                    {i + 1}
                  </text>
                  {i < 15 && (
                    <g className="c2-day" opacity={0}>
                      <rect x={cx} y={cy} width={68} height={68} rx={8} fill={C.lime} opacity={0.75} />
                      <text x={cx + 8} y={cy + 22} fill={C.ink} fontFamily={MONO} fontSize={15}>
                        {i + 1}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>
          <g className="c2-callab" opacity={0}>
            <Label x={914} y={548} tx={1140} ty={772} text="about two weeks of one robot’s time" color={C.lime} hidden={false} size={28} anchor="middle" />
          </g>
          {/* the tower of the biggest datasets */}
          <g className="c2-tower" opacity={0}>
            {TOWER.map((t, i) => {
              const h = Math.max(1.5, t.h * PX_PER_H)
              return (
                <g key={t.name}>
                  {i > 0 && (
                    <g className={`c2-col-${i}`}>
                      <rect x={t.x - 60} y={BASE - h} width={120} height={h} fill="url(#dg-tiles)" />
                      <rect className="c2-shimmer" x={t.x - 60} y={BASE - h} width={120} height={h} fill={C.limeLight} opacity={0.15} />
                      <rect x={t.x - 60} y={BASE - h} width={120} height={4} fill={C.limeLight} />
                    </g>
                  )}
                  <g className={i > 0 ? `c2-colab-${i}` : ''} opacity={i > 0 ? 0 : 1}>
                    <text x={t.x} y={BASE - h - (i === 0 ? 110 : 44)} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={28} fontWeight={600}>
                      {t.name}
                    </text>
                    <text x={t.x} y={BASE - h - (i === 0 ? 84 : 16)} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={18}>
                      {t.note}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
          {/* a child grows up beside a counter */}
          <g className="c2-kid" opacity={0}>
            <rect className="c2-kidbar" x={1040} y={BASE - 100000 * PX_PER_H} width={80} height={100000 * PX_PER_H} fill={C.keyLight} opacity={0.55} />
            <Pool x={1240} y={BASE - 160} r={320} color="key" opacity={0.6} />
            <g className="c2-grow">
              <Person name="c2-kid" x={1240} y={BASE} s={1.15} pose={POSES.relaxed} silhouette={C.ink} hair="curls" />
            </g>
            <text x={1240} y={300} textAnchor="middle" fill={C.keyLight} fontFamily={MONO} fontSize={46}>
              <tspan className="c2-hours">0</tspan> h
            </text>
            <text x={1240} y={336} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              waking hours, birth to 18
            </text>
            <g className="c2-kidlab" opacity={0}>
              <text x={1080} y={BASE - 196} textAnchor="middle" fill={C.keyLight} fontFamily={SERIF} fontSize={28} fontStyle="italic">
                GEN-1 ≈ 5 of these
              </text>
            </g>
          </g>
          <Dust x={0} y={100} w={1600} h={700} count={20} seed={22} color={C.lime} size={0.6} />
        </g>
      </g>

      {/* ---------- b3: the log chart ---------- */}
      <g className="c2-log" opacity={0}>
        <Blueprint />
        <path className="c2-logaxis" d={`M240 ${LOG.base} V${LOG.base - 6 * LOG.px - 20}`} stroke={C.mist} strokeWidth={3} strokeDasharray={700} />
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <g key={d} className="c2-logtick" opacity={0}>
            <line x1={228} x2={1400} y1={LOG.base - d * LOG.px} y2={LOG.base - d * LOG.px} stroke={C.slate} strokeOpacity={0.5} strokeDasharray="3 8" />
            <text x={216} y={LOG.base - d * LOG.px + 6} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={18}>
              {['1 yr', '10', '100', '1,000', '10,000', '100,000', '1M yr'][d]}
            </text>
          </g>
        ))}
        <text x={240} y={LOG.base - 6 * LOG.px - 44} fill={C.fog} fontFamily={SANS} fontSize={20}>
          each step up is ×10
        </text>
        {BARS.map((b, i) => (
          <g key={b.name}>
            {i === 2 && (
              <g className="c2-you-glow" opacity={0}>
                <Pool x={b.x} y={LOG.base - logH(b.years) / 2} r={260} color="key" />
              </g>
            )}
            <g className={`c2-bar-${i}`}>
              <rect x={b.x - 90} y={LOG.base - logH(b.years)} width={180} height={logH(b.years)} rx={6} fill={b.color} opacity={0.85} />
              <rect x={b.x - 90} y={LOG.base - logH(b.years)} width={180} height={5} fill={C.white} opacity={0.6} />
            </g>
            <g className={`c2-barlab-${i}`} opacity={0}>
              <text x={b.x} y={LOG.base - logH(b.years) - 46} textAnchor="middle" fill={b.color} fontFamily={MONO} fontSize={26}>
                {b.val}
              </text>
              <text x={b.x} y={LOG.base + 40} textAnchor="middle" fill={b.color} fontFamily={SANS} fontSize={22}>
                {b.name}
              </text>
            </g>
          </g>
        ))}
        <g className="c2-ratio" opacity={0}>
          <path d={`M645 ${LOG.base - logH(250000) + 6} V${LOG.base - logH(57) - 6}`} stroke={C.danger} strokeWidth={3} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
          <text x={662} y={LOG.base - (logH(250000) + logH(57)) / 2 + 10} fill={C.danger} fontFamily={SERIF} fontSize={46} fontWeight={600}>
            ≈ 4,400×
          </text>
          <text x={664} y={LOG.base - (logH(250000) + logH(57)) / 2 + 44} fill={C.mist} fontFamily={SANS} fontSize={20}>
            less experience
          </text>
        </g>
        <g className="c2-you" opacity={0}>
          <text x={BARS[2].x} y={LOG.base - logH(18) - 92} textAnchor="middle" fill={C.keyLight} fontFamily={SERIF} fontSize={54} fontWeight={600} fontStyle="italic">
            you
          </text>
        </g>
      </g>

      {/* ---------- b4: the guess ---------- */}
      <g className="c2-guess" opacity={0}>
        <Blueprint />
        <g className="c2-guessin">
          <text x={150} y={120} fill={C.paper} fontFamily={SERIF} fontSize={44} fontWeight={600}>
            How much experience is in each?
          </text>
          <GuessPlay active={cueIndex === 4} onPlace={onPlace} onReveal={onReveal} />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'scale',
  title: 'How big is the gap?',
  cues: CUES,
  Scene: Ch2Scale,
  enter: { type: 'dissolve' },
  deeper: [ScaleReading],
}
