import { useCallback, useEffect, useRef, useState } from 'react'
import { Backdrop, Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Sack, Scale, Title, Weight, tiltFor, tiltScale, weightSpots } from '../../art2/props'
import { Lantern, Skyline, Stall } from '../../art2/scenery'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import { useDrag } from '../../engine/svg'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { BaghdadCity, CITY, Customer, Layla } from './art'

export const CUES: Cue[] = [
  { id: 'city', say: 'Baghdad, about twelve hundred years ago. It was one of the biggest, busiest cities in the world.' },
  { id: 'market', say: 'Down by the river, the night market is buzzing. Layla sells spices, and she weighs everything on a balance scale.' },
  { id: 'sack', say: 'A customer brings her a sealed sack of saffron. On one side of the scale go the sack and three brass weights. On the other side, eleven weights. The scale is perfectly level.' },
  { id: 'guess', say: 'How many weights is the sack worth? Drag the marker to your guess.', play: true, quick: true },
  { id: 'harder', say: 'Maybe you worked it out in your head. But what if there were two sacks? Or sacks on both sides? Guessing gets hard, fast.' },
  { id: 'birth', say: 'Puzzles like this one gave birth to a whole new kind of math.' },
]

const LOCKED_LINE = "Got it. Hold on to that guess. We'll come back to it."

/** Where things stand in the market picture (stage coordinates). */
const SC = { x: 800, y: 600, s: 0.85 }
const CUSTOMER = { x: 1350, y: 880, s: 1.3 }
/** The guess slate on the front of the counter. */
const LINE = { x0: 430, step: 50, y: 742, max: 15 }

const STATE: string[] = [
  'A wide night view of Baghdad about 1,200 years ago, on the river, with the House of Wisdom dome lit on the right and a little night market on the near bank.',
  "Close up of the night market. Layla stands by her spice stall with a brass balance scale on the counter. The scale's pans are empty and level.",
  'A customer walks up with a sealed pink sack of saffron (the unknown). The sack and 3 gold weights go on the left pan, 11 gold weights on the right pan, and the scale ends up level.',
  '',
  'More mystery sacks drop on: a second sack on the left and one on the right. The scale rocks back and forth and question marks pop up: guessing stops working.',
  'The camera pulls back out over the city. A trail of light runs from the market to the glowing dome of the House of Wisdom, where the new kind of math was born.',
]

export function Ch1Riddle({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const [guess, setGuess] = useState(0)
  const [touched, setTouched] = useState(false)
  const [locked, setLocked] = useState(false)
  const lockTimer = useRef(0)
  const guessing = cueIndex === 3 && !locked

  const build = useCallback((tl: gsap.core.Timeline) => {
    const scaleEl = root.current?.querySelector('.ch1-scale') ?? null
    const tilt = { deg: 0 }
    const tiltTo = (from: number, to: number, at: number, dur = 0.7, ease = 'elastic.out(1, 0.45)') =>
      tl.fromTo(tilt, { deg: from }, { deg: to, duration: dur, ease, immediateRender: false, onUpdate: () => tiltScale(scaleEl, tilt.deg) }, at)
    const drop = (sel: string, at: number, dur = 0.5) => tl.fromTo(sel, { y: -220, opacity: 0 }, { y: 0, opacity: 1, duration: dur, ease: 'bounce.out' }, at)
    // Later tweens of something already animated must not jump it to their start when the timeline is built.
    const later = { immediateRender: false }

    // Start: the city, with the market hidden and nothing on the scale.
    tl.set('.ch1-market', { opacity: 0 })
    tl.set(['.ld-sack', '.ld-w', '.rd-w', '.ld-sack2', '.rd-sack', '.fly-sack', '.ch1-q', '.ch1-slate', '.ch1-trail-glow'], { opacity: 0 })
    tl.set('.ch1-level', { opacity: 0, scale: 0.6, svgOrigin: `${SC.x} ${SC.y - 360 * SC.s - 110}` })
    tl.set('.ch1-trail', { strokeDashoffset: 1 })
    tl.set('.dome-glow', { opacity: 0.35, scale: 1, svgOrigin: `${CITY.dome.x} ${CITY.dome.y}` })

    // 0. The city: the camera drifts back to reveal the sky over Baghdad.
    tl.addLabel('b0')
    tl.fromTo('.ch1-city-drift', { scale: 1.32, svgOrigin: '800 760' }, { scale: 1, duration: 6, ease: 'sine.inOut' }, 'b0')
    tl.fromTo('.ch1-place', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 'b0+=1')
    tl.to('.dome-glow', { opacity: 0.6, duration: 2, ease: 'sine.inOut' }, 'b0+=3')

    // 1. Fly down into the market by the river.
    tl.addLabel('b1')
    const b1 = tl.labels.b1
    tl.to('.ch1-place', { opacity: 0, duration: 0.4 }, b1)
    tl.fromTo('.ch1-city-zoom', { scale: 1, svgOrigin: `${CITY.market.x} ${CITY.market.y - 30}` }, { scale: 7, duration: 1.9, ease: 'power3.in' }, b1)
    tl.fromTo('.ch1-city', { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power1.in' }, b1 + 1.3)
    tl.fromTo('.ch1-market', { opacity: 0 }, { opacity: 1, duration: 0.8 }, b1 + 1.2)
    tl.fromTo('.ch1-market-zoom', { scale: 0.45, svgOrigin: '800 560' }, { scale: 1, duration: 1.8, ease: 'power3.out' }, b1 + 1.2)
    tl.fromTo('.ch1-layla', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' }, b1 + 2.4)
    tl.fromTo('.ch1-scale-glow', { opacity: 0 }, { opacity: 1, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b1 + 4.6)

    // 2. The customer brings the sack; it goes on the left pan with 3 weights, then 11 weights on the right.
    tl.addLabel('b2')
    const b2 = tl.labels.b2
    tl.fromTo('.ch1-customer', { x: 460 }, { x: 0, duration: 1.6, ease: 'power2.out' }, b2)
    tl.fromTo('.ch1-customer-bob', { y: 0 }, { y: -12, duration: 0.2, repeat: 7, yoyo: true, ease: 'sine.inOut' }, b2)
    const hand = { x: CUSTOMER.x, y: CUSTOMER.y - 62 * CUSTOMER.s }
    const pan = { x: SC.x - (300 + 62) * SC.s, y: SC.y - (360 - 210 + 7) * SC.s }
    tl.set('.cust-sack', { opacity: 0 }, b2 + 2.2)
    tl.set('.fly-sack', { opacity: 1, x: hand.x, y: hand.y }, b2 + 2.2)
    tl.to('.fly-sack', { x: pan.x, duration: 1.1, ease: 'power1.inOut' }, b2 + 2.2)
    tl.to('.fly-sack', { y: 300, duration: 0.55, ease: 'power2.out' }, b2 + 2.2)
    tl.to('.fly-sack', { y: pan.y, duration: 0.55, ease: 'power2.in' }, b2 + 2.75)
    tl.set('.fly-sack', { opacity: 0 }, b2 + 3.3)
    tl.set('.ld-sack', { opacity: 1 }, b2 + 3.3)
    tiltTo(0, tiltFor(-8), b2 + 3.3)
    ;[0, 1, 2].forEach((i) => drop(`.ld-w${i}`, b2 + 4.6 + i * 0.35))
    const right = b2 + 6.6
    for (let i = 0; i < 11; i++) {
      drop(`.rd-w${i}`, right + i * 0.3, 0.45)
      tiltTo(tiltFor(i - 11), tiltFor(i + 1 - 11), right + i * 0.3 + 0.3, 0.45, i === 10 ? 'elastic.out(1.1, 0.35)' : 'power2.out')
    }
    tl.to('.ch1-level', { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2.5)' }, right + 4.4)
    tl.fromTo('.ch1-scale-glow', { opacity: 0 }, { opacity: 1, duration: 0.8, ...later }, right + 4.4)

    // 3. The guess slate rises on the counter.
    tl.addLabel('b3')
    const b3 = tl.labels.b3
    tl.to('.ch1-level', { opacity: 0, duration: 0.4 }, b3)
    tl.fromTo('.ch1-slate', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.6)' }, b3 + 0.2)

    // 4. More sacks: the scale rocks and question marks pop up.
    tl.addLabel('b4')
    const b4 = tl.labels.b4
    tl.to('.ch1-slate', { opacity: 0, y: 30, duration: 0.5, ease: 'power2.in' }, b4 + 0.4)
    tl.to('.ch1-scale-glow', { opacity: 0, duration: 0.5 }, b4 + 0.4)
    drop('.ld-sack2', b4 + 3.0, 0.6)
    tiltTo(0, -13, b4 + 3.4, 0.6)
    drop('.rd-sack', b4 + 4.6, 0.6)
    tiltTo(-13, 9, b4 + 5.0, 0.5, 'power2.inOut')
    tiltTo(9, -6, b4 + 5.5, 0.5, 'power2.inOut')
    tiltTo(-6, 5, b4 + 6.0, 0.5, 'power2.inOut')
    tiltTo(5, -3, b4 + 6.5, 0.6, 'power2.inOut')
    tl.fromTo('.ch1-q', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.22 }, b4 + 5.2)

    // 5. Back out over the city: a trail of light runs from the market to the House of Wisdom.
    tl.addLabel('b5')
    const b5 = tl.labels.b5
    tl.to('.ch1-q', { opacity: 0, duration: 0.3 }, b5)
    tl.fromTo('.ch1-market-zoom', { scale: 1 }, { scale: 0.2, duration: 1.4, ease: 'power3.in', ...later }, b5)
    tl.to('.ch1-market', { opacity: 0, duration: 0.5 }, b5 + 0.7)
    tl.fromTo('.ch1-city', { opacity: 0 }, { opacity: 1, duration: 0.6, ...later }, b5 + 0.6)
    tl.fromTo('.ch1-city-zoom', { scale: 7 }, { scale: 1, duration: 2, ease: 'power3.out', ...later }, b5 + 0.6)
    tl.fromTo('.ch1-trail', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut', ...later }, b5 + 2.4)
    tl.to('.ch1-trail-glow', { opacity: 1, duration: 0.6 }, b5 + 3.6)
    tl.to('.dome-glow', { opacity: 1, scale: 1.25, duration: 1, ease: 'power2.out' }, b5 + 3.7)
    tl.addLabel('b6', b5 + 4.8)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  // What Pip sees, and hints for the guessing turn.
  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        `The learner is guessing how many weights the sealed sack is worth by dragging a marker along a 0 to 15 number line on the counter. ` +
          `Left pan: the sack and 3 weights. Right pan: 11 weights. The scale is level. The answer is 8, but this is only a warm-up guess: any guess is accepted and chapter 4 comes back to it. ` +
          `Marker is at ${guess}${locked ? ' (locked in)' : ''}. A likely mix-up is answering 11 (forgetting the 3 weights next to the sack) or 14 (adding instead of taking away).`,
      )
      setHints([
        'Both sides weigh the same. What is on the left side besides the sack?',
        'Imagine lifting the 3 small weights off the left side, and 3 off the right side too. What would the sack be balancing then?',
      ])
    } else {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, guess, locked, reportState, setHints])

  useEffect(() => () => window.clearTimeout(lockTimer.current), [])

  const valueAt = (x: number) => Math.max(0, Math.min(LINE.max, Math.round((x - LINE.x0) / LINE.step)))
  const drag = useDrag({
    onStart: (p) => {
      if (!guessing) return
      window.clearTimeout(lockTimer.current)
      setTouched(true)
      setGuess(valueAt(p.x))
    },
    onMove: (p) => guessing && setGuess(valueAt(p.x)),
    onEnd: (p) => {
      if (!guessing) return
      const v = valueAt(p.x)
      setGuess(v)
      // A moment to change your mind, then the guess is locked in and the story carries on.
      lockTimer.current = window.setTimeout(() => {
        setLocked(true)
        memory.guess = v
        emit({ type: 'progress', detail: `guessed ${v}` })
        void say(LOCKED_LINE)
        onPlayDone()
      }, 900)
    },
  })

  const lw = weightSpots(3, 3)
  const rw = weightSpots(11, 5)
  const markerX = LINE.x0 + guess * LINE.step

  return (
    <g ref={root}>
      {/* The city, wide */}
      <g className="ch1-city">
        <g className="ch1-city-zoom">
          <g className="ch1-city-drift">
            <BaghdadCity domeGlowClass="dome-glow">
              <path
                className="ch1-trail"
                d={`M${CITY.market.x} ${CITY.market.y - 60} Q${CITY.market.x + 160} ${CITY.dome.y - 150} ${CITY.dome.x - 40} ${CITY.dome.y - 10}`}
                pathLength={1}
                strokeDasharray="1 1"
                stroke={N.goldLight}
                strokeWidth={6}
                strokeLinecap="round"
                fill="none"
                filter="url(#fx-glow)"
              />
              <g className="ch1-trail-glow">
                <Glow x={CITY.dome.x} y={CITY.dome.y} r={200} color="warm" />
              </g>
            </BaghdadCity>
          </g>
        </g>
        <g className="ch1-place">
          <Title x={600} y={250} size={86}>
            Baghdad
          </Title>
          <Title x={600} y={302} size={32} color={N.mist} weight={700}>
            about 1,200 years ago
          </Title>
        </g>
      </g>

      {/* The night market, close up */}
      <g className="ch1-market">
        <g className="ch1-market-zoom">
          <Backdrop kind="dusk">
            <Stars h={260} count={50} seed={12} />
          </Backdrop>
          <Skyline y={560} seed={21} color={N.dusk} scale={0.7} windows={0.2} />
          <rect x={-100} y={760} width={1800} height={300} fill={N.plum} opacity={0.55} />
          <g transform={`translate(${SC.x} ${SC.y}) scale(1.35)`}>
            <Stall w={1000} stripe={N.coral} stripe2={N.cream} />
          </g>
          <g className="sway">
            <Lantern x={330} y={300} rope={50} />
          </g>
          <g className="sway" style={{ animationDelay: '-1.6s' }}>
            <Lantern x={1270} y={300} rope={50} color={N.coral} />
          </g>
          {/* spice bowls on the counter */}
          {[
            [400, N.coral],
            [1200, N.leaf],
          ].map(([bx, c]) => (
            <g key={bx} transform={`translate(${bx} ${SC.y})`}>
              <path d="M-38 0 Q-34 -26 0 -40 Q34 -26 38 0 Z" fill={c as string} />
              <path d="M-44 0 H44 Q40 24 0 28 Q-40 24 -44 0 Z" fill={N.woodDark} />
            </g>
          ))}

          <g className="ch1-scale-glow">
            <Glow x={SC.x} y={SC.y - 360 * SC.s} r={260} color="teal" opacity={0.7} />
          </g>
          <g transform={`translate(${SC.x} ${SC.y}) scale(${SC.s})`}>
            <Scale
              className="ch1-scale"
              tutor="the balance scale"
              left={
                <>
                  <g className="ld-sack">
                    <Sack x={-62} tutor="the sealed sack" />
                  </g>
                  <g className="ld-sack2">
                    <Sack x={-52} y={-96} s={0.82} />
                  </g>
                  {lw.map(([x, y], i) => (
                    <g key={i} className={`ld-w ld-w${i}`}>
                      <Weight x={x + 62} y={y} s={0.9} tutor="the 3 weights next to the sack" />
                    </g>
                  ))}
                </>
              }
              right={
                <>
                  {rw.map(([x, y], i) => (
                    <g key={i} className={`rd-w rd-w${i}`}>
                      <Weight x={x} y={y} s={0.9} tutor="the 11 weights" />
                    </g>
                  ))}
                  <g className="rd-sack">
                    <Sack y={-150} s={0.82} />
                  </g>
                </>
              }
            />
          </g>
          {/* "Level!" marker over the pivot */}
          <g className="ch1-level">
            <rect x={SC.x - 70} y={SC.y - 360 * SC.s - 136} width={140} height={52} rx={26} fill={N.teal} />
            <text x={SC.x} y={SC.y - 360 * SC.s - 100} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={30} fill={N.night0}>
              level
            </text>
          </g>

          <g className="ch1-layla">
            <Layla x={250} y={880} s={1.3} pose={cueIndex >= 4 ? 'think' : 'wave'} face={cueIndex >= 4 ? 'wow' : 'smile'} />
          </g>
          <g className="ch1-customer">
            <g className="ch1-customer-bob">
              <Customer
                x={CUSTOMER.x}
                y={CUSTOMER.y}
                s={CUSTOMER.s}
                flip
                pose={cueIndex === 2 || cueIndex === 0 || cueIndex === 1 ? 'hold' : 'down'}
                face={cueIndex === 4 ? 'wow' : 'smile'}
                holding={
                  <g className="cust-sack">
                    <Sack y={-62} s={0.62} label="x" />
                  </g>
                }
              />
            </g>
          </g>

          {/* Question marks: guessing gets hard */}
          {[
            [470, 230, -14, 70, N.pink],
            [640, 150, 10, 54, N.goldLight],
            [960, 160, -8, 64, N.pink],
            [1130, 250, 14, 56, N.goldLight],
            [800, 110, 0, 80, N.pinkLight],
          ].map(([qx, qy, r, size, c], i) => (
            <g key={i} className="ch1-q" transform={`translate(${qx} ${qy})`}>
              <g className="float" style={{ animationDelay: `${-i * 0.9}s` }}>
                <text transform={`rotate(${r})`} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size as number} fill={c as string} stroke={N.shadow} strokeOpacity={0.35} strokeWidth={8} paintOrder="stroke">
                  ?
                </text>
              </g>
            </g>
          ))}

          {/* The guess slate */}
          <g className="ch1-slate">
            <rect x={LINE.x0 - 60} y={LINE.y - 102} width={LINE.step * LINE.max + 120} height={160} rx={28} fill={N.night0} opacity={0.88} />
            <rect x={LINE.x0 - 60} y={LINE.y - 102} width={LINE.step * LINE.max + 120} height={160} rx={28} fill="none" stroke={N.gold} strokeOpacity={0.35} strokeWidth={3} />
            <g {...drag} className={guessing ? 'hot' : undefined} style={{ ...drag.style, cursor: guessing ? 'grab' : 'default' }} data-tutor="the guess marker">
              <rect x={LINE.x0 - 40} y={LINE.y - 100} width={LINE.step * LINE.max + 80} height={150} fill="transparent" />
              <line x1={LINE.x0} y1={LINE.y} x2={LINE.x0 + LINE.step * LINE.max} y2={LINE.y} stroke={N.gold} strokeWidth={5} strokeLinecap="round" />
              {Array.from({ length: LINE.max + 1 }, (_, i) => (
                <g key={i}>
                  <line x1={LINE.x0 + i * LINE.step} y1={LINE.y - (i % 5 ? 8 : 14)} x2={LINE.x0 + i * LINE.step} y2={LINE.y + (i % 5 ? 8 : 14)} stroke={N.gold} strokeWidth={i % 5 ? 3 : 5} strokeLinecap="round" />
                  <text x={LINE.x0 + i * LINE.step} y={LINE.y + 42} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={i === guess && touched ? 30 : 24} fill={i === guess && touched ? N.goldLight : N.gold} opacity={i === guess && touched ? 1 : 0.75}>
                    {i}
                  </text>
                </g>
              ))}
              <g style={{ transform: `translate(${markerX}px, ${LINE.y - 8}px)`, transition: 'transform 0.12s ease-out' }}>
                {guessing && !touched && <circle className="hot-ring" cy={-40} r={46} fill="none" stroke={N.pinkLight} strokeWidth={4} />}
                {locked && <circle cy={-40} r={50} fill="none" stroke={N.goldLight} strokeWidth={5} />}
                <Sack s={0.5} />
              </g>
            </g>
          </g>

          <Motes count={18} seed={8} />
        </g>
      </g>

      {/* The sack in flight, from the customer's hands to the pan */}
      <g className="fly-sack" pointerEvents="none">
        <Sack y={0} s={CUSTOMER.s * 0.62} />
      </g>

      <Vignette />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'riddle',
  title: 'A riddle in Baghdad',
  cues: CUES,
  Scene: Ch1Riddle,
}
