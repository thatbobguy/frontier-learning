/*
 * The scale play: a log axis of experience time, from a minute to a million years. The learner
 * drags each dataset to where they think it sits, then reveals the truth.
 */
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { C, MONO, SANS } from '../../../cine/palette'
import { useDrag } from '../../../engine/svg'
import { Chip } from '../shared/kit'

/** Axis: log10(years) from one minute to a million years. */
const MIN_YEARS = 1 / (365.25 * 24 * 60)
const L0 = Math.log10(MIN_YEARS)
const L1 = 6
export const AXIS = { x0: 150, x1: 1450, y: 690 }
export const xOf = (years: number) => AXIS.x0 + ((Math.log10(years) - L0) / (L1 - L0)) * (AXIS.x1 - AXIS.x0)
const yearsOf = (x: number) => Math.pow(10, L0 + ((x - AXIS.x0) / (AXIS.x1 - AXIS.x0)) * (L1 - L0))

export const TICKS: [number, string][] = [
  [1e-5, '5 min'],
  [1e-4, '53 min'],
  [1e-3, '9 h'],
  [1e-2, '4 days'],
  [1e-1, '5 weeks'],
  [1, '1 yr'],
  [10, '10 yr'],
  [100, '100 yr'],
  [1e3, '1,000 yr'],
  [1e4, '10,000 yr'],
  [1e5, '100,000 yr'],
  [1e6, '1M yr'],
]

export interface Item {
  id: string
  text: string
  /** True experience, in years of continuous time. */
  years: number
  truth: string
  color: string
}

export const ITEMS: Item[] = [
  { id: 'child', text: 'One person’s childhood of hand use', years: 100000 / 8766, truth: '~11 yr (100,000 waking hours by 18)', color: C.keyLight },
  { id: 'droid', text: 'DROID (13 labs, a year of collecting)', years: 350 / 8766, truth: '350 h ≈ 15 days', color: C.lime },
  { id: 'pi0', text: 'π0’s robot data', years: 10000 / 8766, truth: '10,000 h ≈ 1.1 yr', color: C.lime },
  { id: 'gen1', text: 'Generalist GEN-1', years: 500000 / 8766, truth: '500,000 h ≈ 57 yr', color: C.lime },
  { id: 'dactyl', text: 'OpenAI’s Rubik’s cube hand, in simulation', years: 13000, truth: '~13,000 yr of simulated practice', color: C.cyanLight },
  { id: 'text', text: 'Text for a big language model', years: 250000, truth: '~250,000 yr of reading', color: C.paper },
]

const ROW0 = 200
const ROWH = 74
const START = AXIS.x0

function Row({ i, item, x, placed, guessX, revealed, active, onMove }: { i: number; item: Item; x: number; placed: boolean; guessX: number | null; revealed: boolean; active: boolean; onMove: (x: number) => void }) {
  const y = ROW0 + i * ROWH
  const clamp = (v: number) => Math.max(AXIS.x0, Math.min(AXIS.x1, v))
  const drag = useDrag({ onStart: (p) => active && onMove(clamp(p.x)), onMove: (p) => active && onMove(clamp(p.x)) })
  const right = x < 900
  const off = guessX !== null ? Math.abs(Math.log10(yearsOf(guessX)) - Math.log10(item.years)) : 0
  const factor = Math.pow(10, off)
  const fText = factor < 1.5 ? 'spot on' : `${guessX !== null && guessX > x ? 'too high' : 'too low'} by ×${factor >= 100 ? Math.round(factor / 10) * 10 : Math.round(factor)}`
  return (
    <g>
      <line x1={AXIS.x0} x2={AXIS.x1} y1={y} y2={y} stroke={C.slate} strokeOpacity={0.5} strokeDasharray="3 9" />
      {/* where it lands on the axis */}
      <line x1={x} x2={x} y1={y} y2={AXIS.y} stroke={item.color} strokeOpacity={placed ? 0.4 : 0.12} strokeDasharray="4 6" />
      {revealed && guessX !== null && Math.abs(guessX - x) > 6 && (
        <g>
          <circle cx={guessX} cy={y} r={14} fill="none" stroke={item.color} strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={2} />
          <path className="dg-guessarrow" d={`M${guessX} ${y - 16} Q ${(guessX + x) / 2} ${y - 46} ${x + (guessX > x ? 12 : -12)} ${y - 20}`} fill="none" stroke={C.danger} strokeWidth={3} markerEnd="url(#cn-arrow)" />
        </g>
      )}
      <g {...(active ? drag : {})} data-tutor={`guess-${item.id}`} style={{ cursor: active ? 'grab' : 'default', touchAction: 'none' }}>
        <rect x={x - 30} y={y - 30} width={60} height={60} fill="transparent" />
        <circle cx={x} cy={y} r={18} fill={C.ink1} stroke={item.color} strokeWidth={4} opacity={placed || revealed ? 1 : 0.6} />
        <circle cx={x} cy={y} r={7} fill={item.color} opacity={placed || revealed ? 1 : 0.5} />
        <text x={x + (right ? 30 : -30)} y={y + 8} textAnchor={right ? 'start' : 'end'} fill={item.color} fontFamily={SANS} fontSize={23} fontWeight={600} stroke={C.ink} strokeWidth={6} strokeOpacity={0.7} style={{ paintOrder: 'stroke' }} opacity={placed || revealed ? 1 : 0.7}>
          {item.text}
        </text>
        {revealed && (
          <text x={x + (right ? 30 : -30)} y={y + 32} textAnchor={right ? 'start' : 'end'} fill={item.color} opacity={0.8} fontFamily={MONO} fontSize={16} stroke={C.ink} strokeWidth={5} strokeOpacity={0.7} style={{ paintOrder: 'stroke' }}>
            {item.truth}
            {guessX !== null ? `  ·  you: ${fText}` : ''}
          </text>
        )}
      </g>
    </g>
  )
}

export function GuessPlay({ active, onPlace, onReveal }: { active: boolean; onPlace: (n: number) => void; onReveal: (guesses: Record<string, number | null>) => void }) {
  const [pos, setPos] = useState<number[]>(() => ITEMS.map(() => START))
  const [placed, setPlaced] = useState<boolean[]>(() => ITEMS.map(() => false))
  const [guess, setGuess] = useState<(number | null)[] | null>(null)
  const tween = useRef<gsap.core.Tween | null>(null)
  const n = placed.filter(Boolean).length
  const revealed = guess !== null

  useEffect(() => () => void tween.current?.kill(), [])

  const move = (i: number, x: number) => {
    if (revealed) return
    setPos((p) => p.map((v, k) => (k === i ? x : v)))
    if (!placed[i]) {
      const next = placed.map((v, k) => v || k === i)
      setPlaced(next)
      onPlace(next.filter(Boolean).length)
    }
  }

  const reveal = () => {
    if (revealed) return
    const g = pos.map((x, i) => (placed[i] ? x : null))
    setGuess(g)
    const o = { k: 0 }
    const from = pos.slice()
    tween.current = gsap.to(o, {
      k: 1,
      duration: 1.8,
      ease: 'power3.inOut',
      onUpdate: () => setPos(from.map((x, i) => x + (xOf(ITEMS[i].years) - x) * o.k)),
    })
    const out: Record<string, number | null> = {}
    ITEMS.forEach((it, i) => (out[it.id] = g[i] === null ? null : yearsOf(g[i] as number)))
    onReveal(out)
  }

  return (
    <g>
      {/* the axis */}
      <line x1={AXIS.x0} x2={AXIS.x1} y1={AXIS.y} y2={AXIS.y} stroke={C.mist} strokeWidth={3} />
      <text x={AXIS.x0} y={AXIS.y + 64} fill={C.fog} fontFamily={MONO} fontSize={16} textAnchor="middle">
        1 min
      </text>
      {TICKS.map(([y, t]) => (
        <g key={t}>
          <line x1={xOf(y)} x2={xOf(y)} y1={AXIS.y - 12} y2={AXIS.y + 12} stroke={C.mist} strokeWidth={2} />
          <text x={xOf(y)} y={AXIS.y + 40} fill={C.mist} fontFamily={MONO} fontSize={17} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      <text x={AXIS.x1} y={AXIS.y + 92} fill={C.fog} fontFamily={SANS} fontSize={19} textAnchor="end">
        experience, if you lived it non-stop · each tick is ×10
      </text>
      {ITEMS.map((it, i) => (
        <Row key={it.id} i={i} item={it} x={pos[i]} placed={placed[i]} guessX={guess ? guess[i] : null} revealed={revealed} active={active && !revealed} onMove={(x) => move(i, x)} />
      ))}
      {active && !revealed && (
        <Chip x={800} y={836} w={260} text={n >= 4 ? 'reveal' : `place ${4 - n} more`} color={C.lime} disabled={n < 4} onClick={reveal} tutor="reveal-scale" />
      )}
    </g>
  )
}
