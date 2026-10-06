/*
 * The labelling play: a looping clip of a hand opening a jar, and under it five finger-force
 * tracks the learner paints from the pixels alone. "Reveal truth" lays the forces from the
 * simulation that made the clip over their guess.
 */
import gsap from 'gsap'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GRASPS, Hand3D, makeHandStore, tipOnStage, type FingerName, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { toStage } from '../../../engine/svg'
import { Chip, Pool } from '../shared/kit'

export const FINGER_ORDER: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'little']
/** How hard each finger squeezes, relative to the thumb. The palm hides the thumb and the ring finger. */
const WEIGHT: Record<FingerName, number> = { thumb: 1, index: 0.62, middle: 0.72, ring: 0.5, little: 0.3 }
export const HIDDEN: FingerName[] = ['thumb', 'ring']
/** Where in the loop the lid breaks free. */
export const BREAK = 0.5
const PERIOD = 4.2
export const SAMPLES = 48

const ease = (a: number, b: number, u: number) => {
  const t = Math.max(0, Math.min(1, (u - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The grip over one loop of the clip (0..1): build up, strain, a spike as the lid breaks, then a light spin. */
export function grip(u: number) {
  const build = 0.42 * ease(0.06, 0.2, u) + 0.2 * ease(0.2, 0.44, u)
  const spike = Math.exp(-Math.pow((u - BREAK) / 0.028, 2)) * 0.4
  const relax = -0.38 * ease(BREAK + 0.02, BREAK + 0.1, u)
  const release = -0.24 * ease(0.86, 0.96, u)
  return Math.max(0, build + spike + relax + release)
}

export const truth = (f: FingerName, u: number) => Math.min(1, grip(u) * WEIGHT[f])

const LANES = { x: 300, y: 474, w: 1040, h: 58, gap: 9 }
const laneY = (i: number) => LANES.y + i * (LANES.h + LANES.gap)
const VIDEO = { x: 470, y: 64, w: 660, h: 340 }
const LID = { x: VIDEO.x + 330, y: VIDEO.y + 186 }
const VIEW = { yaw: 96, pitch: -4, roll: 180, s: 1.9 }

const LIGHT: HandPose = { ...GRASPS.claw, thumb: [52, 26, 18, 16], index: [46, 46, 28, 2], middle: [48, 48, 30, 0], ring: [50, 48, 30, -2], little: [52, 48, 30, -6], wrist: [0, 0] }
const TIGHT: HandPose = { ...GRASPS.claw, thumb: [60, 30, 30, 22], index: [56, 60, 40, 2], middle: [58, 62, 42, 0], ring: [60, 62, 40, -2], little: [62, 60, 38, -6], wrist: [0, 0] }
const lerpPose = (a: HandPose, b: HandPose, t: number): HandPose => {
  const o = {} as HandPose
  for (const k of Object.keys(a) as (keyof HandPose)[]) (o as unknown as Record<string, number[]>)[k] = (a[k] as number[]).map((v, i) => v + ((b[k] as number[])[i] - v) * t)
  return o
}

export interface JarResult {
  /** Overall error: total |guess - truth| over total truth, in percent. */
  off: number
  perFinger: Record<FingerName, number>
}

export function JarPlay({ active, playing, revealed, onPaint, onReveal }: {
  active: boolean
  playing: boolean
  revealed: boolean
  onPaint: (painted: FingerName[]) => void
  onReveal: (r: JarResult) => void
}) {
  const store = useMemo(() => makeHandStore({ pose: LIGHT, view: VIEW }), [])
  // Put the hand so its fingertips close around the lid.
  const at = useMemo(() => {
    const s = makeHandStore({ pose: TIGHT, view: VIEW })
    const th = tipOnStage(s, 'thumb', 0, 0)
    const mi = tipOnStage(s, 'middle', 0, 0)
    return { x: LID.x - 34 - (th.x + mi.x) / 2, y: LID.y - 26 - Math.max(th.y, mi.y) }
  }, [])
  const [paint, setPaint] = useState<(number | null)[][]>(() => FINGER_ORDER.map(() => Array(SAMPLES).fill(null)))
  const lane = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const head = useRef<SVGGElement>(null)
  const lid = useRef<SVGGElement>(null)
  const jar = useRef<SVGGElement>(null)
  const pop = useRef<SVGGElement>(null)
  const prog = useRef<SVGRectElement>(null)
  const clock = useRef(0)
  const truthRef = useRef<SVGGElement>(null)

  // The clip loops while the play is up and the film is playing.
  useEffect(() => {
    if (!active || !playing) return
    let raf = 0
    let prev = performance.now()
    const frame = (now: number) => {
      clock.current += Math.min(0.05, (now - prev) / 1000)
      prev = now
      const u = (clock.current % PERIOD) / PERIOD
      const g = grip(u)
      // the fingers tighten with the grip; the wrist twists, stuck at first, then free
      const stuck = 5 * ease(0.15, BREAK, u) + Math.sin(u * 90) * 1.2 * ease(0.3, BREAK, u) * (u < BREAK ? 1 : 0)
      const turn = 46 * ease(BREAK, 0.84, u) - 46 * ease(0.88, 1, u)
      store.state.pose = lerpPose(LIGHT, TIGHT, Math.min(1, g / 0.75))
      store.state.view.yaw = VIEW.yaw - stuck - turn * 0.6
      store.notify()
      lid.current?.setAttribute('transform', `translate(${((turn * 1.6) % 40).toFixed(1)} 0)`)
      jar.current?.setAttribute('transform', `translate(${(u < BREAK ? Math.sin(u * 140) * 1.4 * ease(0.3, BREAK, u) : 0).toFixed(1)} 0)`)
      pop.current?.setAttribute('opacity', String(Math.exp(-Math.pow((u - BREAK - 0.015) / 0.03, 2)).toFixed(2)))
      const hx = LANES.x + u * LANES.w
      head.current?.setAttribute('transform', `translate(${hx.toFixed(1)} 0)`)
      prog.current?.setAttribute('width', String((u * VIDEO.w).toFixed(1)))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active, playing, store])

  const painted = FINGER_ORDER.filter((_, i) => paint[i].filter((v) => v !== null).length >= 5)

  const paintAt = (p: { x: number; y: number }, fresh: boolean) => {
    if (!active || revealed) return
    if (fresh) {
      const li = Math.floor((p.y - LANES.y) / (LANES.h + LANES.gap))
      if (li < 0 || li > 4) return
      lane.current = li
      last.current = null
    }
    const li = lane.current
    if (li === null) return
    const idx = Math.max(0, Math.min(SAMPLES - 1, Math.floor(((p.x - LANES.x) / LANES.w) * SAMPLES)))
    const v = Math.max(0, Math.min(1, 1 - (p.y - laneY(li)) / LANES.h))
    const from = last.current ?? idx
    last.current = idx
    setPaint((old) => {
      const next = old.map((r) => r.slice())
      const a = Math.min(from, idx)
      const b = Math.max(from, idx)
      for (let k = a; k <= b; k++) {
        // blend towards the new value so strokes stay smooth
        const prevV = next[li][k]
        next[li][k] = from === idx || prevV === null ? v : prevV + (v - prevV) * 0.8
      }
      return next
    })
  }

  useEffect(() => {
    onPaint(painted)
    // report only when the set of painted fingers changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painted.join(',')])

  const onDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (!active || revealed) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    paintAt(toStage(el, e.clientX, e.clientY), true)
    const move = (ev: PointerEvent) => paintAt(toStage(el, ev.clientX, ev.clientY), false)
    const up = () => {
      lane.current = null
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const reveal = () => {
    if (revealed) return
    let tot = 0
    let err = 0
    const per = {} as Record<FingerName, number>
    FINGER_ORDER.forEach((f, i) => {
      let fe = 0
      let ft = 0
      for (let k = 0; k < SAMPLES; k++) {
        const u = (k + 0.5) / SAMPLES
        const t = truth(f, u)
        const g = paint[i][k] ?? 0
        fe += Math.abs(g - t)
        ft += t
      }
      per[f] = Math.round((fe / ft) * 100)
      err += fe
      tot += ft
    })
    onReveal({ off: Math.round((err / tot) * 100), perFinger: per })
  }

  // The truth draws itself in when revealed.
  useEffect(() => {
    if (!revealed || !truthRef.current) return
    const paths = truthRef.current.querySelectorAll('.dg-truthline')
    const t = gsap.fromTo(paths, { strokeDashoffset: 1200 }, { strokeDashoffset: 0, duration: 1.6, stagger: 0.12, ease: 'power2.inOut' })
    const t2 = gsap.fromTo(truthRef.current.querySelectorAll('.dg-truthfill, .dg-truthlab'), { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 1, stagger: 0.1 })
    return () => {
      t.kill()
      t2.kill()
    }
  }, [revealed])

  const curve = (vals: (number | null)[], i: number, close: boolean) => {
    const y0 = laneY(i) + LANES.h
    let d = ''
    let open = false
    let first = 0
    let lastX = 0
    vals.forEach((v, k) => {
      const x = LANES.x + ((k + 0.5) / SAMPLES) * LANES.w
      if (v === null) {
        if (open && close) d += ` L${lastX.toFixed(1)} ${y0} L${first.toFixed(1)} ${y0} Z`
        open = false
        return
      }
      const y = y0 - v * LANES.h
      if (!open) {
        d += ` M${x.toFixed(1)} ${y.toFixed(1)}`
        first = x
        open = true
      } else d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
      lastX = x
    })
    if (open && close) d += ` L${lastX.toFixed(1)} ${y0} L${first.toFixed(1)} ${y0} Z`
    return d
  }
  const truthVals = (f: FingerName) => Array.from({ length: SAMPLES }, (_, k) => truth(f, (k + 0.5) / SAMPLES))
  const truthPath = (f: FingerName, i: number) => {
    const y0 = laneY(i) + LANES.h
    const n = 120
    return Array.from({ length: n + 1 }, (_, k) => {
      const u = k / n
      return `${k ? 'L' : 'M'}${(LANES.x + u * LANES.w).toFixed(1)} ${(y0 - truth(f, u) * LANES.h).toFixed(1)}`
    }).join(' ')
  }

  const anyPaint = paint.some((r) => r.some((v) => v !== null))

  return (
    <g>
      {/* ---------------- the clip ---------------- */}
      <g>
        <Pool x={VIDEO.x + VIDEO.w / 2} y={VIDEO.y + VIDEO.h / 2} r={560} color="key" opacity={0.35} />
        <rect x={VIDEO.x - 10} y={VIDEO.y - 10} width={VIDEO.w + 20} height={VIDEO.h + 34} rx={8} fill={C.ink} />
        <clipPath id="dg-jarclip">
          <rect x={VIDEO.x} y={VIDEO.y} width={VIDEO.w} height={VIDEO.h} />
        </clipPath>
        <g clipPath="url(#dg-jarclip)">
          <rect x={VIDEO.x} y={VIDEO.y} width={VIDEO.w} height={VIDEO.h} fill="url(#dg-kitchen)" />
          <circle cx={VIDEO.x + 520} cy={VIDEO.y + 60} r={160} fill={C.keyLight} opacity={0.3} filter="url(#cn-dof-3)" />
          <rect x={VIDEO.x} y={VIDEO.y + 300} width={VIDEO.w} height={60} fill="#3a2010" />
          {/* the jar: glass, honey-gold, with a ridged lid */}
          <g ref={jar}>
            <rect x={VIDEO.x + 270} y={VIDEO.y + 196} width={120} height={108} rx={18} fill="#e7b04a" opacity={0.75} />
            <rect x={VIDEO.x + 280} y={VIDEO.y + 206} width={18} height={84} rx={8} fill={C.white} opacity={0.35} />
            <rect x={VIDEO.x + 264} y={VIDEO.y + 170} width={132} height={32} rx={6} fill="#2b2f3a" />
            <clipPath id="dg-lidclip">
              <rect x={VIDEO.x + 264} y={VIDEO.y + 170} width={132} height={32} rx={6} />
            </clipPath>
            <g clipPath="url(#dg-lidclip)">
              <g ref={lid}>
                {Array.from({ length: 12 }, (_, k) => (
                  <rect key={k} x={VIDEO.x + 224 + k * 20} y={VIDEO.y + 170} width={6} height={32} fill={C.metal} opacity={0.5} />
                ))}
              </g>
            </g>
          </g>
          <Hand3D store={store} x={at.x} y={at.y} look="human" arm={320} light={[0.7, -0.6]} />
          {/* the lid breaking free: a small flash of motion lines */}
          <g ref={pop} opacity={0}>
            {[-1, 1].map((s) => (
              <path key={s} d={`M${VIDEO.x + 330 + s * 80} ${VIDEO.y + 186} l${s * 34} -10 M${VIDEO.x + 330 + s * 80} ${VIDEO.y + 196} l${s * 40} 4`} stroke={C.white} strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
          <text x={VIDEO.x + 16} y={VIDEO.y + 30} fill={C.white} opacity={0.8} fontFamily={MONO} fontSize={18}>
            ● opening_jar.mp4
          </text>
          <text x={VIDEO.x + VIDEO.w - 16} y={VIDEO.y + 30} fill={C.white} opacity={0.6} fontFamily={MONO} fontSize={16} textAnchor="end">
            pixels only
          </text>
        </g>
        <rect x={VIDEO.x} y={VIDEO.y + VIDEO.h + 8} width={VIDEO.w} height={6} rx={3} fill={C.ink3} />
        <rect ref={prog} x={VIDEO.x} y={VIDEO.y + VIDEO.h + 8} width={0} height={6} rx={3} fill={C.paper} opacity={0.8} />
      </g>

      {/* ---------------- the five force tracks ---------------- */}
      <g>
        <text x={LANES.x} y={LANES.y - 16} fill={C.amberLight} fontFamily={SANS} fontSize={22} fontWeight={600}>
          finger force over time
        </text>
        <text x={LANES.x + LANES.w} y={LANES.y - 16} fill={C.lime} fontFamily={MONO} fontSize={18} textAnchor="end">
          {revealed ? 'lime: your label · amber: the real forces' : 'drag in a track to paint how hard that finger pushes'}
        </text>
        {FINGER_ORDER.map((f, i) => (
          <g key={f}>
            <rect x={LANES.x} y={laneY(i)} width={LANES.w} height={LANES.h} rx={6} fill={C.ink2} stroke={C.slate} strokeOpacity={0.6} />
            <line x1={LANES.x} x2={LANES.x + LANES.w} y1={laneY(i) + LANES.h / 2} y2={laneY(i) + LANES.h / 2} stroke={C.slate} strokeOpacity={0.35} strokeDasharray="4 8" />
            <text x={LANES.x - 18} y={laneY(i) + LANES.h / 2 + 2} fill={HIDDEN.includes(f) ? C.fog : C.paper} fontFamily={SANS} fontSize={24} textAnchor="end">
              {f}
            </text>
            {HIDDEN.includes(f) && (
              <text x={LANES.x - 18} y={laneY(i) + LANES.h / 2 + 22} fill={C.fog} fontFamily={MONO} fontSize={14} textAnchor="end">
                hidden by the palm
              </text>
            )}
            <path d={curve(paint[i], i, true)} fill={C.lime} opacity={0.22} />
            <path d={curve(paint[i], i, false)} fill="none" stroke={C.lime} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {/* the truth, from the simulation that rendered the clip */}
        {revealed && (
          <g ref={truthRef}>
            {FINGER_ORDER.map((f, i) => (
              <g key={f}>
                <path className="dg-truthfill" d={curve(truthVals(f), i, true)} fill={C.amber} fillOpacity={0.22} opacity={0} />
                <path className="dg-truthline" d={truthPath(f, i)} fill="none" stroke={C.amber} strokeWidth={4} strokeDasharray={1200} strokeDashoffset={1200} filter="url(#cn-bloom)" />
              </g>
            ))}
            <g className="dg-truthlab" opacity={0}>
              <line x1={LANES.x + BREAK * LANES.w} x2={LANES.x + BREAK * LANES.w} y1={LANES.y - 4} y2={laneY(4) + LANES.h + 8} stroke={C.paper} strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />
              <text x={LANES.x + BREAK * LANES.w} y={laneY(4) + LANES.h + 32} fill={C.paper} fontFamily={SANS} fontSize={20} textAnchor="middle">
                the lid breaks free: the squeeze peaks
              </text>
              <text x={LANES.x + BREAK * LANES.w + 64} y={laneY(0) + 22} fill={C.amberLight} fontFamily={SANS} fontSize={20}>
                the hidden thumb pushes hardest
              </text>
            </g>
          </g>
        )}
        {/* the playhead, in step with the clip */}
        <g ref={head} pointerEvents="none" transform={`translate(${LANES.x} 0)`}>
          <line x1={0} x2={0} y1={LANES.y - 6} y2={laneY(4) + LANES.h + 6} stroke={C.paper} strokeWidth={2} opacity={0.55} />
          <circle cx={0} cy={LANES.y - 6} r={5} fill={C.paper} />
        </g>
        {/* the brush surface */}
        <rect
          data-tutor="force-tracks"
          x={LANES.x - 10}
          y={LANES.y - 6}
          width={LANES.w + 20}
          height={5 * (LANES.h + LANES.gap) + 6}
          fill="transparent"
          style={{ cursor: active && !revealed ? 'crosshair' : 'default', touchAction: 'none' }}
          pointerEvents={active && !revealed ? 'all' : 'none'}
          onPointerDown={onDown}
        />
        {active && !anyPaint && (
          <g pointerEvents="none" className="hd-pulse">
            <text x={LANES.x + LANES.w / 2} y={laneY(2) + LANES.h / 2 + 8} fill={C.lime} fontFamily={SERIF} fontSize={30} fontStyle="italic" textAnchor="middle" stroke={C.ink} strokeWidth={6} style={{ paintOrder: 'stroke' }}>
              drag across a finger’s track: higher means a harder push
            </text>
          </g>
        )}
      </g>
      {active && !revealed && (
        <Chip x={300} y={250} w={250} text={painted.length >= 2 ? 'reveal truth' : `paint ${2 - painted.length} more track${painted.length === 1 ? '' : 's'}`} color={C.amber} disabled={painted.length < 2} onClick={reveal} tutor="reveal-truth" />
      )}
    </g>
  )
}
