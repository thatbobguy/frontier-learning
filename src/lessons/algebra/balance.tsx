import gsap from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Glow } from '../../art2/fx'
import { N } from '../../art2/palette'
import { Equation, SCALE, Sack, Scale, Weight, terms, tiltFor, tiltScale } from '../../art2/props'
import { toStage } from '../../engine/svg'

/*
 * The playable balance scale used from chapter 4 on. The learner lifts weights and sacks
 * off the pans (drag them away, or tap them), puts them back, and can drag a glowing line
 * down through the scale to split both sides into equal parts. The scale simply tips when
 * the two sides stop being equal, and the equation under it shows ≠ instead of =.
 * Nothing scores or buzzes: the world gives the feedback.
 */

export type SideName = 'left' | 'right'
export type Item = 'sack' | 'weight'
export interface Side {
  sacks: number
  weights: number
}
export interface Balance {
  left: Side
  right: Side
}
export type Move =
  | { kind: 'remove'; side: SideName; item: Item }
  | { kind: 'add'; side: SideName; item: Item }
  | { kind: 'split'; parts: number }
  /** tipped: the scale wasn't level; not-ready: one side isn't just sacks with only weights on the other. */
  | { kind: 'split-blocked'; reason: 'tipped' | 'not-ready' }

export const sideWeight = (s: Side, x: number) => s.sacks * x + s.weights
export const isLevel = (b: Balance, x: number) => sideWeight(b.left, x) === sideWeight(b.right, x)
export const tiltOf = (b: Balance, x: number) => tiltFor(sideWeight(b.right, x) - sideWeight(b.left, x))

/** One sack alone on one side, only weights on the other, and level: that's x found. */
export function isSolved(b: Balance, x: number) {
  const alone = (a: Side, o: Side) => a.sacks === 1 && a.weights === 0 && o.sacks === 0
  return isLevel(b, x) && (alone(b.left, b.right) || alone(b.right, b.left))
}

/** How many equal parts both sides can be split into right now (two or more sacks alone vs weights), or null. */
export function splitParts(b: Balance): number | null {
  const check = (a: Side, o: Side) => (a.sacks >= 2 && a.weights === 0 && o.sacks === 0 && o.weights % a.sacks === 0 ? a.sacks : null)
  return check(b.left, b.right) ?? check(b.right, b.left)
}

/** "2x + 1", "x", "9", or "0" for an empty pan. */
export function sideText(s: Side) {
  const parts = [s.sacks === 0 ? '' : s.sacks === 1 ? 'x' : `${s.sacks}x`, s.weights ? String(s.weights) : ''].filter(Boolean)
  return parts.length ? parts.join(' + ') : '0'
}

/** "x + 3 = 11", or "x + 2 ≠ 11" when the scale is tipped. */
export function equationText(b: Balance, x: number) {
  return `${sideText(b.left)} ${isLevel(b, x) ? '=' : '≠'} ${sideText(b.right)}`
}

/* ------------------------------------------------------------------ */
/* Layout                                                               */
/* ------------------------------------------------------------------ */

type Loc = 'left' | 'right' | 'trayL' | 'trayR'
interface Ids {
  sacks: string[]
  weights: string[]
}
type Places = Record<Loc, Ids>
interface Spot {
  id: string
  item: Item
  x: number
  y: number
  group: number
}

const PAN_W = 284
const WW = 46
const WH = 50
const SACK_S = 0.8
const WEIGHT_S = 0.9
const TRAY_DX = 600
const TRAY_W = 230

/** Where things sit on a pan, (0, 0) being the middle of the pan's top. With parts > 1, in that many equal groups. */
function layoutPan(ids: Ids, parts = 1): Spot[] {
  const n = ids.sacks.length
  const m = ids.weights.length
  const spots: Spot[] = []
  if (parts > 1) {
    const g = PAN_W / parts
    const per = Math.ceil(m / parts)
    const perRow = Math.max(1, Math.floor((g - 8) / WW))
    ids.sacks.forEach((id, i) => spots.push({ id, item: 'sack', x: -PAN_W / 2 + g * (i + 0.5), y: 0, group: i }))
    ids.weights.forEach((id, j) => {
      const grp = Math.floor(j / per)
      const k = j % per
      const inRow = Math.min(perRow, per - Math.floor(k / perRow) * perRow)
      spots.push({ id, item: 'weight', x: -PAN_W / 2 + g * (grp + 0.5) + ((k % perRow) - (inRow - 1) / 2) * WW, y: -Math.floor(k / perRow) * WH, group: grp })
    })
    return spots
  }
  const sw = n >= 3 ? 78 : 84
  const sackBlock = n * sw
  const perRow = n === 0 ? 6 : Math.max(1, Math.floor((PAN_W - sackBlock - 8) / WW))
  const wBlock = Math.min(perRow, m) * WW
  const total = sackBlock + (n && m ? 8 : 0) + wBlock
  const start = -total / 2
  ids.sacks.forEach((id, i) => spots.push({ id, item: 'sack', x: start + sw * (i + 0.5), y: 0, group: 0 }))
  const left = start + sackBlock + (n && m ? 8 : 0)
  ids.weights.forEach((id, j) => {
    const row = Math.floor(j / perRow)
    const inRow = Math.min(perRow, m - row * perRow)
    // Centre a short top row over the block.
    const col = j % perRow
    const x = n === 0 ? (col - (inRow - 1) / 2) * WW : left + WW * (col + 0.5) + ((perRow - inRow) * WW) / 2
    spots.push({ id, item: 'weight', x, y: -row * WH, group: 0 })
  })
  return spots
}

/** Spare things on a tray, side by side and then in rows, (0, 0) being the middle of the tray's top. */
function layoutTray(ids: Ids): Spot[] {
  const items: { id: string; item: Item; w: number }[] = [...ids.sacks.map((id) => ({ id, item: 'sack' as const, w: 84 })), ...ids.weights.map((id) => ({ id, item: 'weight' as const, w: WW }))]
  const rows: (typeof items)[] = [[]]
  let used = 0
  for (const it of items) {
    if (used + it.w > TRAY_W - 10 && rows[rows.length - 1].length) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1].push(it)
    used += it.w
  }
  const spots: Spot[] = []
  let y = 0
  for (const row of rows) {
    const width = row.reduce((n, it) => n + it.w, 0)
    let x = -width / 2
    for (const it of row) {
      spots.push({ id: it.id, item: it.item, x: x + it.w / 2, y, group: 0 })
      x += it.w
    }
    y -= row.some((it) => it.item === 'sack') ? 96 : WH
  }
  return spots
}

const count = (ids: Ids): Side => ({ sacks: ids.sacks.length, weights: ids.weights.length })

/* ------------------------------------------------------------------ */
/* The component                                                        */
/* ------------------------------------------------------------------ */

export interface BalancePlayProps {
  /** Where the scale's base stands, in stage coordinates, and its size. */
  x?: number
  y?: number
  s?: number
  /** What one sack really weighs. Only the scale knows. */
  value: number
  /** What is on the pans to begin with. Remount (change the key) to start a new puzzle. */
  start: Balance
  /** True while it is the learner's turn. Otherwise it is just a picture. */
  active: boolean
  /** Show the glowing line that splits both sides into equal parts. */
  canSplit?: boolean
  /** Show the equation for the scale underneath it, at this height (stage y) and size. */
  equation?: { y: number; size?: number }
  /** Show the trays for spare weights beside the scale. Defaults to on while active. */
  trays?: boolean
  /** A soft teal glow around the scale. */
  glow?: boolean
  onMove?: (b: Balance, move: Move) => void
  onSolved?: (b: Balance) => void
  /** Prefix for Pip's pointing names, e.g. "the first scale". */
  tutor?: string
  className?: string
}

let nextId = 0
const ids = (n: number, kind: string): string[] => Array.from({ length: n }, () => `${kind}${nextId++}`)

export function BalancePlay({ x = 800, y = 640, s = 0.85, value, start, active, canSplit = false, equation, trays, glow = false, onMove, onSolved, tutor = 'the scale', className }: BalancePlayProps) {
  const [places, setPlaces] = useState<Places>(() => ({
    left: { sacks: ids(start.left.sacks, 's'), weights: ids(start.left.weights, 'w') },
    right: { sacks: ids(start.right.sacks, 's'), weights: ids(start.right.weights, 'w') },
    trayL: { sacks: [], weights: [] },
    trayR: { sacks: [], weights: [] },
  }))
  const [held, setHeld] = useState<{ id: string; item: Item; from: Loc; px: number; py: number } | null>(null)
  const [split, setSplit] = useState<{ parts: number; fading: boolean } | null>(null)
  const [knifeY, setKnifeY] = useState<number | null>(null)
  const [initialTilt] = useState(() => tiltOf(start, value))

  const root = useRef<SVGGElement>(null)
  const tilt = useRef({ deg: initialTilt })
  const tween = useRef<gsap.core.Tween | null>(null)
  const solved = useRef(false)
  const cbs = useRef({ onMove, onSolved })
  cbs.current = { onMove, onSolved }

  const balance: Balance = useMemo(() => ({ left: count(places.left), right: count(places.right) }), [places])
  const level = isLevel(balance, value)
  const showTrays = trays ?? active
  const { H, L, DROP } = SCALE

  // The beam swings to wherever the weights say, with a little wobble.
  const target = tiltOf(balance, value)
  useLayoutEffect(() => {
    const el = root.current?.querySelector('.bp-scale') ?? null
    tween.current?.kill()
    tween.current = gsap.to(tilt.current, { deg: target, duration: 0.9, ease: 'elastic.out(1, 0.45)', onUpdate: () => tiltScale(el, tilt.current.deg) })
  }, [target])
  useEffect(() => () => void tween.current?.kill(), [])

  // Solved once the sack is alone and the scale is level (and nothing is in the learner's hand).
  useEffect(() => {
    if (held || split || solved.current || !isSolved(balance, value)) return
    solved.current = true
    cbs.current.onSolved?.(balance)
  }, [balance, held, split, value])

  /** The middle of each pan's top, in stage coordinates, for the current tilt. */
  const panAt = (side: SideName) => {
    const t = (tilt.current.deg * Math.PI) / 180
    const k = side === 'left' ? -1 : 1
    return { x: x + s * k * L * Math.cos(t), y: y + s * (-H + k * L * Math.sin(t) + DROP - 7) }
  }
  const trayAt = (loc: 'trayL' | 'trayR') => ({ x: x + (loc === 'trayL' ? -1 : 1) * TRAY_DX * s, y })

  const whereIs = (px: number, py: number): Loc => {
    for (const side of ['left', 'right'] as const) {
      const p = panAt(side)
      if (Math.abs(px - p.x) < 175 * s && py > p.y - 300 * s && py < p.y + 100 * s) return side
    }
    return px < x ? 'trayL' : 'trayR'
  }

  const take = (from: Loc, item: Item, id: string) =>
    setPlaces((p) => ({ ...p, [from]: { ...p[from], [item === 'sack' ? 'sacks' : 'weights']: p[from][item === 'sack' ? 'sacks' : 'weights'].filter((i) => i !== id) } }))
  const put = (to: Loc, item: Item, id: string) =>
    setPlaces((p) => ({ ...p, [to]: { ...p[to], [item === 'sack' ? 'sacks' : 'weights']: [...p[to][item === 'sack' ? 'sacks' : 'weights'], id] } }))

  // Picking something up lifts it off its pan straight away, so the scale reacts in the learner's hand.
  const grab = (e: ReactPointerEvent<SVGGElement>, from: Loc, item: Item, id: string) => {
    if (!active || split || held) return
    e.preventDefault()
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const p0 = toStage(svg, e.clientX, e.clientY)
    take(from, item, id)
    setHeld({ id, item, from, px: p0.x, py: p0.y })
    let moved = 0
    const move = (ev: PointerEvent) => {
      const p = toStage(svg, ev.clientX, ev.clientY)
      moved = Math.max(moved, Math.hypot(p.x - p0.x, p.y - p0.y))
      setHeld((h) => (h ? { ...h, px: p.x, py: p.y } : h))
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const p = toStage(svg, ev.clientX, ev.clientY)
      // A tap on something in a pan sends it to the tray on that side.
      const to: Loc = moved < 12 ? (from === 'left' ? 'trayL' : from === 'right' ? 'trayR' : from) : whereIs(p.x, p.y)
      put(to, item, id)
      setHeld(null)
      if (to === from) return
      const after = (() => {
        const b = { left: { ...balanceRef.current.left }, right: { ...balanceRef.current.right } }
        const key = item === 'sack' ? 'sacks' : 'weights'
        if (to === 'left' || to === 'right') b[to][key] += 1
        return b
      })()
      if (from === 'left' || from === 'right') cbs.current.onMove?.(after, { kind: 'remove', side: from, item })
      if (to === 'left' || to === 'right') cbs.current.onMove?.(after, { kind: 'add', side: to, item })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const balanceRef = useRef(balance)
  balanceRef.current = balance
  const placesRef = useRef(places)
  placesRef.current = places

  // The splitting line: drag it down through the scale.
  const knifeTop = y - (H + 120) * s
  const knifeCut = y - (H - DROP - 40) * s
  const grabKnife = (e: ReactPointerEvent<SVGGElement>) => {
    if (!active || split || held) return
    e.preventDefault()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    setKnifeY(knifeTop)
    const move = (ev: PointerEvent) => setKnifeY(Math.max(knifeTop, Math.min(y + 40, toStage(svg, ev.clientX, ev.clientY).y)))
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setKnifeY(null)
      if (toStage(svg, ev.clientX, ev.clientY).y < knifeCut) return
      const b = balanceRef.current
      if (!isLevel(b, value)) return cbs.current.onMove?.(b, { kind: 'split-blocked', reason: 'tipped' })
      const parts = splitParts(b)
      if (!parts) return cbs.current.onMove?.(b, { kind: 'split-blocked', reason: 'not-ready' })
      setSplit({ parts, fading: false })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Splitting: everything slides into equal groups, then all but one group floats away.
  useEffect(() => {
    if (!split) return
    if (!split.fading) {
      const t = window.setTimeout(() => setSplit((sp) => (sp ? { ...sp, fading: true } : sp)), 1300)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => {
      const p = placesRef.current
      const pick = (loc: 'left' | 'right'): Ids => {
        const kept = layoutPan(p[loc], split.parts).filter((sp) => sp.group === 0)
        return { sacks: kept.filter((k) => k.item === 'sack').map((k) => k.id), weights: kept.filter((k) => k.item === 'weight').map((k) => k.id) }
      }
      const next = { ...p, left: pick('left'), right: pick('right') }
      setPlaces(next)
      setSplit(null)
      cbs.current.onMove?.({ left: count(next.left), right: count(next.right) }, { kind: 'split', parts: split.parts })
    }, 800)
    return () => window.clearTimeout(t)
  }, [split])

  const drawItem = (sp: Spot, from: Loc, faded: boolean) => (
    <g
      key={sp.id}
      className={active && !split ? 'hot' : undefined}
      style={{
        transform: `translate(${sp.x}px, ${sp.y - (faded ? 50 : 0)}px)`,
        opacity: faded ? 0 : 1,
        transition: 'transform 0.35s cubic-bezier(.3,1.4,.5,1), opacity 0.6s ease',
        cursor: active && !split ? 'grab' : undefined,
        touchAction: 'none',
      }}
      onPointerDown={(e) => grab(e, from, sp.item, sp.id)}
    >
      {sp.item === 'sack' ? <Sack s={SACK_S} tutor={`${tutor}: a mystery sack`} /> : <Weight s={WEIGHT_S} tutor={`${tutor}: a weight`} />}
      {/* A bigger, invisible handle so small fingers can grab it */}
      <rect x={-30} y={sp.item === 'sack' ? -100 : -60} width={60} height={sp.item === 'sack' ? 100 : 62} fill="transparent" />
    </g>
  )

  const panContent = (side: SideName) => {
    const spots = layoutPan(places[side], split?.parts ?? 1)
    return (
      <>
        {split &&
          Array.from({ length: split.parts - 1 }, (_, i) => {
            const dx = -PAN_W / 2 + (PAN_W / split.parts) * (i + 1)
            return <line key={i} x1={dx} y1={14} x2={dx} y2={-150} stroke={N.tealLight} strokeWidth={5} strokeDasharray="10 9" strokeLinecap="round" opacity={split.fading ? 0 : 0.95} style={{ transition: 'opacity 0.4s' }} />
          })}
        {spots.map((sp) => drawItem(sp, side, !!split?.fading && sp.group > 0))}
      </>
    )
  }

  const heldStage = held && (
    <g transform={`translate(${held.px} ${held.py + (held.item === 'sack' ? 50 : 30) * s}) scale(${s})`} pointerEvents="none">
      {held.item === 'sack' ? <Sack s={SACK_S * 1.08} /> : <Weight s={WEIGHT_S * 1.08} />}
    </g>
  )

  return (
    <g ref={root} className={className}>
      {glow && <Glow x={x} y={y - H * s} r={300 * s} color="teal" opacity={level ? 0.55 : 0.15} />}

      {/* Trays for spare things, one beside each pan */}
      {showTrays &&
        (['trayL', 'trayR'] as const).map((loc) => {
          const t = trayAt(loc)
          return (
            <g key={loc} transform={`translate(${t.x} ${t.y}) scale(${s})`} data-tutor={loc === 'trayL' ? 'the left tray' : 'the right tray'}>
              <ellipse cy={10} rx={TRAY_W / 2 + 10} ry={16} fill={N.shadow} opacity={0.3} />
              <rect x={-TRAY_W / 2} y={-6} width={TRAY_W} height={22} rx={11} fill={N.woodLight} />
              <rect x={-TRAY_W / 2} y={6} width={TRAY_W} height={10} rx={5} fill={N.woodDark} opacity={0.6} />
              {active && !places[loc].sacks.length && !places[loc].weights.length && (
                <rect x={-TRAY_W / 2 + 10} y={-70} width={TRAY_W - 20} height={58} rx={16} fill="none" stroke={N.mist} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="10 8" />
              )}
              <g transform="translate(0 -6)">{layoutTray(places[loc]).map((sp) => drawItem(sp, loc, false))}</g>
            </g>
          )
        })}

      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <Scale className="bp-scale" tilt={initialTilt} tutor={tutor} left={panContent('left')} right={panContent('right')} />
      </g>

      {/* The splitting line */}
      {canSplit && (
        <g data-tutor="the splitting line">
          <line x1={x} y1={knifeTop} x2={x} y2={knifeY ?? knifeTop + 1} stroke={N.tealLight} strokeWidth={7} strokeDasharray="14 10" strokeLinecap="round" filter="url(#fx-glow)" />
          <g
            className={active ? 'hot' : undefined}
            style={{ transform: `translate(${x}px, ${knifeY ?? knifeTop}px)`, transition: knifeY === null ? 'transform 0.4s cubic-bezier(.3,1.5,.5,1)' : 'none', touchAction: 'none', cursor: active ? 'grab' : undefined }}
            onPointerDown={grabKnife}
          >
            {active && !split && knifeY === null && <circle className="hot-ring" r={40} fill="none" stroke={N.tealLight} strokeWidth={4} />}
            <Glow r={70} color="teal" opacity={0.8} />
            <circle r={26} fill={N.teal} />
            <path d="M0 -12 V12 M-9 4 L0 13 L9 4" stroke={N.night0} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle r={44} fill="transparent" />
          </g>
        </g>
      )}

      {equation && <Equation terms={terms(equationText(balance, value))} x={x} y={equation.y} size={equation.size ?? 56} tutor="the equation" />}

      {heldStage}
    </g>
  )
}
