/*
 * The grip play of film 4: you are the controller. Hold a squeeze, press lift, and get the
 * egg out of its cup without crushing or dropping it. Round 1 with touch off (only the camera
 * view), round 2 with touch on (a pressure bar and a slip flicker).
 *
 * Physics, in newtons: two fingertip contacts, friction μ = 0.4, so the most friction the
 * grip can give is 2·μ·grip. The egg needs friction equal to its weight plus m·a while it
 * accelerates, plus a bump partway up. Too little and it slides (and drops); too much and it
 * cracks.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDrag } from '../../../engine/svg'
import { C, MONO, SANS } from '../../../cine/palette'
import type { LessonEvent } from '../../../engine/types'
import { Chip, Egg, Pool } from '../shared/kit'
import { BigFinger, EggCup } from './parts'

const MU = 0.4
const MASS = 0.06
const GRAV = 9.81
const W = MASS * GRAV
const GMAX = 5
const CRUSH = 3.0
const LIFT_T = 3.6
const LIFT_H = 270
const DROP_AT = 56
const SLIP_RATE = 500 // px per second per newton of missing friction

/** Where things are on stage. */
const EGG = { x: 740, y: 560, s: 2.4 }
const HALF_W = 40 * EGG.s
const PAD_Y = EGG.y + 10 * EGG.s
const FINGER = { len: 300, w: 72 }
const SLIDER = { x: 1390, top: 250, bottom: 640 }

export type Phase = 'ready' | 'lifting' | 'won' | 'crushed' | 'dropped'

interface Sim {
  grip: number
  t: number
  lift: number
  slip: number
  overCrush: number
  bumpAt: number
  need: number
  warn: number
  hist: { grip: number; need: number }[]
}

const fresh = (): Sim => ({ grip: 0, t: 0, lift: 0, slip: 0, overCrush: 0, bumpAt: 1.1 + Math.random() * 1.2, need: W, warn: 0, hist: [] })

/** Friction the egg needs at time t of the lift (N). */
function needAt(t: number, bumpAt: number, lifting: boolean) {
  if (!lifting) return W
  let a = 0
  if (t < 0.6) a = 4
  else if (t > LIFT_T - 0.6 && t < LIFT_T) a = -3
  const dt = t - bumpAt
  const bump = dt > -0.25 && dt < 0.45 ? (dt < 0 ? (dt + 0.25) / 0.25 : 1 - dt / 0.45) * 0.95 : 0
  return MASS * (GRAV + a) + bump
}
const liftAt = (t: number) => {
  const u = Math.max(0, Math.min(1, t / LIFT_T))
  return LIFT_H * (u * u * (3 - 2 * u))
}

export function GripPlay({ active, playing, onWin, emit, report }: { active: boolean; playing: boolean; onWin: () => void; emit: (e: LessonEvent) => void; report: (d: string) => void }) {
  const [round, setRound] = useState<1 | 2>(1)
  const [phase, setPhase] = useState<Phase>('ready')
  const [attempts, setAttempts] = useState(0)
  const [, setFrame] = useState(0)
  const sim = useRef<Sim>(fresh())
  const phaseRef = useRef<Phase>('ready')
  phaseRef.current = phase
  const roundRef = useRef(round)
  roundRef.current = round
  const playingRef = useRef(playing)
  playingRef.current = playing
  const winRef = useRef(onWin)
  winRef.current = onWin
  const history = useRef<string[]>([])

  const s = sim.current
  const setGrip = (v: number) => {
    if (!active || (phase !== 'ready' && phase !== 'lifting')) return
    s.grip = Math.max(0, Math.min(GMAX, v))
    setFrame((f) => f + 1)
  }
  const sliderRef = useRef<SVGGElement>(null)
  const drag = useDrag({
    onStart: (p) => {
      sliderRef.current?.focus({ preventScroll: true })
      setGrip(((SLIDER.bottom - p.y) / (SLIDER.bottom - SLIDER.top)) * GMAX)
    },
    onMove: (p) => setGrip(((SLIDER.bottom - p.y) / (SLIDER.bottom - SLIDER.top)) * GMAX),
    onEnd: () => emit({ type: 'progress', detail: `set the squeeze to ${s.grip.toFixed(1)} N (round ${round})` }),
  })

  const end = (p: Phase) => {
    setPhase(p)
    const r = roundRef.current
    const line = `round ${r}: ${p === 'won' ? 'lifted the egg cleanly' : p === 'crushed' ? 'crushed the egg (squeezed over the crack limit)' : 'dropped the egg (not enough grip, it slid out)'} at a squeeze of ${s.grip.toFixed(1)} N`
    history.current = [...history.current.slice(-5), line]
    emit({ type: 'attempt', correct: p === 'won', detail: line })
    if (r === 1) {
      window.setTimeout(() => {
        sim.current = fresh()
        setRound(2)
        setPhase('ready')
      }, 2600)
    } else if (p === 'won') {
      window.setTimeout(() => winRef.current(), 900)
    } else {
      window.setTimeout(() => {
        sim.current = fresh()
        setPhase('ready')
      }, 2200)
    }
  }

  /* the physics loop: runs while the play is live */
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      raf = requestAnimationFrame(step)
      if (!playingRef.current) return
      const ph = phaseRef.current
      const m = sim.current
      if (ph !== 'ready' && ph !== 'lifting') {
        if (ph === 'dropped' && m.slip < 400) {
          m.slip += dt * 900
          setFrame((f) => f + 1)
        }
        return
      }
      const lifting = ph === 'lifting'
      if (lifting) m.t += dt
      m.need = needAt(m.t, m.bumpAt, lifting)
      const cap = 2 * MU * m.grip
      m.warn = m.grip < 0.05 ? 0 : Math.max(0, Math.min(1, (m.need * 1.25 - cap) / (m.need * 0.25)))
      if (lifting && cap < m.need) m.slip += (m.need - cap) * SLIP_RATE * dt
      m.lift = lifting ? liftAt(m.t) : 0
      m.overCrush = m.grip > CRUSH ? m.overCrush + dt : 0
      m.hist.push({ grip: m.grip, need: m.need / (2 * MU) })
      if (m.hist.length > 240) m.hist.shift()
      setFrame((f) => f + 1)
      if (m.overCrush > 0.12) end('crushed')
      else if (m.slip > DROP_AT) end('dropped')
      else if (lifting && m.t >= LIFT_T) end('won')
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // end() reads refs; the loop restarts only when the play turns on or off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const lift = () => {
    if (!active || phase !== 'ready') return
    sim.current.t = 0
    setPhase('lifting')
    setAttempts((a) => a + 1)
    emit({ type: 'progress', detail: `pressed lift with a squeeze of ${s.grip.toFixed(1)} N (round ${round})` })
  }

  /* what Pip sees */
  useEffect(() => {
    if (!active) return
    report(
      `The grip play. Side view: two white robot fingertips either side of an egg in an egg cup on the bench under the lamp. The learner holds a vertical "squeeze" slider (right) and presses "lift". ` +
        `Physics: two contacts, friction μ = 0.4, so maximum friction = 0.8 × squeeze; the egg weighs 0.59 N, needs about 0.83 N while accelerating up, and a random bump mid-lift briefly adds about 0.95 N. So the squeeze must stay above about 0.74 N at rest, 1.04 N while starting the lift and about 1.9 N during the bump, but below 3.0 N or the shell cracks. ` +
        `Now: round ${round} (${round === 1 ? 'touch OFF: only a camera view, no readouts, the fingers hide much of the egg' : 'touch ON: a magenta pressure bar with the crack limit marked, a live "needed" marker, and a slip light that flickers just before the egg starts to slide'}); phase ${phase}; squeeze ${s.grip.toFixed(1)} N; attempts ${attempts}. ` +
        (history.current.length ? `History: ${history.current.join('; ')}. ` : '') +
        'Goal: lift the egg to the top in round 2 without crushing or dropping it (round 1 counts after one attempt either way). Best strategy: squeeze until the pressure is a little above the needed marker, then when the slip light flickers (the bump) squeeze a bit more, staying well under the crack line. Likely mix-ups: squeezing as hard as possible (cracks it), or setting a light grip and ignoring the slip light (drops it during the bump).',
    )
  }, [active, round, phase, attempts, report, s.grip])

  /* ---------- drawing ---------- */
  const touching = s.grip > 0.05
  const open = 30 * (1 - Math.min(1, s.grip / 0.3))
  const squash = round === 2 ? Math.min(0.04, (s.grip / CRUSH) * 0.03) : 0
  const handY = -s.lift
  const eggDY = phase === 'dropped' ? Math.min(-s.lift + s.slip, 0) : -s.lift + s.slip
  const crushed = phase === 'crushed'
  const kv = s.grip / GMAX
  const needK = s.need / (2 * MU) / GMAX
  const slipping = phase === 'lifting' && 2 * MU * s.grip < s.need
  const sensed = round === 2

  let msg: ReactNode = null
  if (phase === 'crushed') msg = <tspan fill={C.danger}>Crushed. Too much squeeze.</tspan>
  else if (phase === 'dropped') msg = <tspan fill={C.danger}>Dropped. It slid out of the fingers.</tspan>
  else if (phase === 'won') msg = round === 1 ? <tspan fill={C.keyLight}>Lifted, but you couldn’t tell how close it came.</tspan> : <tspan fill={C.lime}>Lifted, riding just above the slip line.</tspan>
  else if (phase === 'ready') msg = <tspan fill={C.mist}>{touching ? 'Now press lift.' : 'Drag the squeeze up to close the fingers.'}</tspan>

  const chart = s.hist
  const cx0 = 90
  const cw = 420
  const cy0 = 840
  const ch = 130
  const pathOf = (k: 'grip' | 'need') => chart.map((h, i) => `${i ? 'L' : 'M'}${(cx0 + (i / 240) * cw).toFixed(1)} ${(cy0 - Math.min(1, h[k] / 3.2) * ch).toFixed(1)}`).join(' ')

  return (
    <g pointerEvents={active ? 'auto' : 'none'}>
      {/* the hand: a wrist block and two fingers, lifted together */}
      <g transform={`translate(0 ${handY})`}>
        <rect x={EGG.x - 34} y={PAD_Y - 258 - 600} width={68} height={500} fill={C.shellDark} />
        <rect x={EGG.x - HALF_W - FINGER.w - 40} y={PAD_Y - 258 - 120} width={2 * (HALF_W + FINGER.w + 40)} height={134} rx={26} fill="url(#cn-shell)" />
      </g>
      {/* the egg (behind the fingers, so they hide some of it) */}
      <g transform={`translate(0 ${eggDY})`}>
        <g transform={`translate(${EGG.x} ${EGG.y}) scale(${1 - squash} ${1 + squash * 0.5}) translate(${-EGG.x} ${-EGG.y})`}>
          <Egg x={EGG.x} y={EGG.y} s={EGG.s} />
        </g>
        {crushed && (
          <g>
            <path d={`M${EGG.x - 88} ${EGG.y + 10} L${EGG.x - 50} ${EGG.y - 8} L${EGG.x - 30} ${EGG.y + 20} L${EGG.x} ${EGG.y - 10} L${EGG.x + 26} ${EGG.y + 16} L${EGG.x + 52} ${EGG.y - 12} L${EGG.x + 88} ${EGG.y + 4}`} fill="none" stroke="#5b4a33" strokeWidth={4} />
            <path d={`M${EGG.x - 20} ${EGG.y + 60} q 10 50 0 110`} stroke="#f2a516" strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.85} />
          </g>
        )}
      </g>
      {/* the cup in front of the egg's base */}
      <g transform={`translate(${EGG.x} ${EGG.y + 38 * EGG.s - 34})`}>
        <EggCup s={2.2} />
      </g>
      {/* fingers */}
      <g transform={`translate(0 ${handY})`}>
        <g transform={`translate(${EGG.x - HALF_W - FINGER.w / 2 - 4 - open} ${PAD_Y - 258})`}>
          <BigFinger len={FINGER.len} w={FINGER.w} padColor={sensed && touching ? C.magenta : C.rubber} />
        </g>
        <g transform={`translate(${EGG.x + HALF_W + FINGER.w / 2 + 4 + open} ${PAD_Y - 258})`}>
          <BigFinger len={FINGER.len} w={FINGER.w} flip padColor={sensed && touching ? C.magenta : C.rubber} />
        </g>
        {sensed && touching && (
          <g pointerEvents="none" filter="url(#cn-bloom)" opacity={0.3 + 0.7 * Math.min(1, kv * 2)}>
            <circle cx={EGG.x - HALF_W - 2} cy={PAD_Y} r={10 + kv * 20} fill={C.magenta} opacity={0.5} />
            <circle cx={EGG.x + HALF_W + 2} cy={PAD_Y} r={10 + kv * 20} fill={C.magenta} opacity={0.5} />
          </g>
        )}
      </g>

      {/* round 1: what a camera sees, nothing else */}
      {round === 1 && (
        <g pointerEvents="none">
          <rect x={440} y={150} width={600} height={690} rx={12} fill="none" stroke={C.lime} strokeWidth={2} opacity={0.55} />
          <g opacity={0.14}>
            {Array.from({ length: 86 }, (_, i) => (
              <rect key={i} x={440} y={150 + i * 8} width={600} height={2} fill="#000" />
            ))}
          </g>
          <circle className="hd-blink" cx={466} cy={178} r={7} fill={C.danger} />
          <text x={482} y={185} fill={C.lime} fontFamily={MONO} fontSize={18}>
            CAMERA ONLY · touch off
          </text>
        </g>
      )}

      {/* round 2: what touch adds */}
      {round === 2 && (
        <g pointerEvents="none">
          <text x={110} y={230} fill={C.magentaLight} fontFamily={SANS} fontSize={22} fontWeight={600}>
            fingertip pressure
          </text>
          <rect x={150} y={250} width={44} height={390} rx={8} fill={C.ink3} />
          <rect x={150} y={250} width={44} height={390 * (1 - CRUSH / GMAX)} rx={8} fill="url(#cn-hatch)" stroke={C.danger} strokeWidth={1.5} />
          <text x={204} y={270} fill={C.danger} fontFamily={SANS} fontSize={18}>
            cracks
          </text>
          <rect x={150} y={640 - 390 * kv} width={44} height={390 * kv} rx={8} fill={C.magenta} filter="url(#cn-bloom)" />
          <line x1={140} x2={204} y1={640 - 390 * needK} y2={640 - 390 * needK} stroke={C.paper} strokeWidth={3} strokeDasharray="6 4" />
          <text x={212} y={646 - 390 * needK} fill={C.paper} fontFamily={SANS} fontSize={18}>
            needed
          </text>
          {/* the slip light */}
          <g transform="translate(330 330)">
            <circle r={40} fill={C.ink2} stroke={C.magentaLight} strokeWidth={2} />
            <circle r={30} fill={C.magenta} opacity={slipping ? 1 : s.warn > 0 ? (Math.random() < 0.5 ? s.warn : 0.1) : 0.06} filter="url(#cn-bloom)" />
            <text y={70} textAnchor="middle" fill={C.magentaLight} fontFamily={SANS} fontSize={22} fontWeight={600}>
              slip
            </text>
          </g>
          {/* a live trace: squeeze vs needed */}
          <path d={`M${cx0} ${cy0 - ch - 10} V${cy0} H${cx0 + cw}`} fill="none" stroke={C.fog} strokeWidth={1.5} />
          <path d={pathOf('need')} fill="none" stroke={C.mist} strokeWidth={2.5} strokeDasharray="8 6" />
          <path d={pathOf('grip')} fill="none" stroke={C.amber} strokeWidth={3.5} />
          <text x={cx0 + 6} y={cy0 - ch - 18} fill={C.amberLight} fontFamily={SANS} fontSize={18}>
            grip <tspan fill={C.mist}>vs slip line</tspan>
          </text>
        </g>
      )}

      <text x={740} y={118} textAnchor="middle" fontFamily={SANS} fontSize={28} fontWeight={600} pointerEvents="none" stroke={C.ink} strokeWidth={8} strokeOpacity={0.85} style={{ paintOrder: 'stroke' }}>
        {msg}
      </text>
      <text x={110} y={130} fill={round === 1 ? C.lime : C.magentaLight} fontFamily={MONO} fontSize={22} pointerEvents="none">
        ROUND {round} · TOUCH {round === 1 ? 'OFF' : 'ON'}
      </text>

      {/* the squeeze control */}
      <g
        ref={sliderRef}
        data-tutor="squeeze"
        role="slider"
        tabIndex={active ? 0 : -1}
        aria-label="squeeze"
        aria-valuemin={0}
        aria-valuemax={GMAX}
        aria-valuenow={Math.round(s.grip * 10) / 10}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setGrip(s.grip + 0.1)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setGrip(s.grip - 0.1)
          else return
          e.preventDefault()
        }}
        onPointerDown={drag.onPointerDown}
        style={{ ...drag.style, outline: 'none' }}
      >
        <rect x={SLIDER.x - 60} y={SLIDER.top - 40} width={120} height={SLIDER.bottom - SLIDER.top + 80} fill="transparent" />
        <Pool x={SLIDER.x} y={(SLIDER.top + SLIDER.bottom) / 2} r={200} color="amber" opacity={0.25} />
        <rect x={SLIDER.x - 5} y={SLIDER.top} width={10} height={SLIDER.bottom - SLIDER.top} rx={5} fill={C.ink3} />
        <rect x={SLIDER.x - 5} y={SLIDER.bottom - (SLIDER.bottom - SLIDER.top) * kv} width={10} height={(SLIDER.bottom - SLIDER.top) * kv} rx={5} fill={C.amber} />
        <circle cx={SLIDER.x} cy={SLIDER.bottom - (SLIDER.bottom - SLIDER.top) * kv} r={26} fill={C.ink1} stroke={C.amber} strokeWidth={4} />
        <circle cx={SLIDER.x} cy={SLIDER.bottom - (SLIDER.bottom - SLIDER.top) * kv} r={9} fill={C.amber} />
        <text x={SLIDER.x} y={SLIDER.top - 54} textAnchor="middle" fill={C.amberLight} fontFamily={SANS} fontSize={24} fontWeight={600}>
          squeeze
        </text>
        <text x={SLIDER.x + 40} y={SLIDER.top + 8} fill={C.fog} fontFamily={SANS} fontSize={18}>
          hard
        </text>
        <text x={SLIDER.x + 40} y={SLIDER.bottom + 6} fill={C.fog} fontFamily={SANS} fontSize={18}>
          open
        </text>
      </g>
      <Chip x={SLIDER.x} y={730} w={170} h={60} text={phase === 'lifting' ? 'lifting…' : 'lift'} color={C.cyan} onClick={lift} disabled={!active || phase !== 'ready' || !touching} tutor="lift" />
    </g>
  )
}
