import gsap from 'gsap'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Backdrop, Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Equation, SCALE, Sack, Scale, Title, Weight, terms, termWidth, tiltScale, weightSpots, type Term } from '../../art2/props'
import { toStage } from '../../engine/svg'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { AlKhwarizmi } from './art'

export const CUES: Cue[] = [
  { id: 'name', say: "Here is the first trick. Give the thing you don't know a name." },
  { id: 'x', say: "Al-Khwarizmi called it 'the thing'. Today we usually use a letter, like x." },
  { id: 'one', say: "x isn't a mystery forever. It stands for one exact number. We just don't know which one yet." },
  { id: 'write', say: 'Now the whole scale fits in one short line. Drag each piece of the scale down into the line.', play: true, quick: true },
  { id: 'equation', say: 'x plus 3 equals 11. That is an equation: a balance scale, written small.' },
]

/** What the narrator says as each piece lands in the line, and when a piece goes to the wrong place. */
const LINES = {
  x: 'The sack is x.',
  three: 'Three weights is 3.',
  eleven: 'Eleven weights is 11.',
  eq: 'And the level beam means equals.',
  wrongSide: 'Each side of the line matches one pan of the scale.',
  middle: 'The middle of the line is saved for the level beam.',
}

/* ------------------------------------------------------------------ */
/* Layout (stage coordinates, 1600 x 900)                               */
/* ------------------------------------------------------------------ */

/** The big glowing sack of the first three cues: where its base stands, and how big it is drawn. */
const HERO = { x: 650, y: 680, s: 3.3 }
/** Where the tag's string is tied on: the right end of the sack's gold tie, in the sack's own units. */
const TIE = { x: 22, y: -87 }
/** The tag hangs from the tie (stage units): where its hole is, how it tilts, and the middle of its writing. */
const TAG = { hx: 120, hy: 95, tilt: 8, textX: 150 }
/** Where the ink starts and how far it runs when "the thing" is written. */
const INK = { x: 18, w: 290 }
/** The little window on the sack's belly, in the sack's own units. */
const WIN = { y: -38, w: 46, h: 36, step: 34 }
/** Numbers flicking past in the window (none of 3, 8 or 11), stopping on the hidden one. */
const REEL = ['5', '12', '7', '20', '1', '15', '9', '4', '26', '2', '17', '6', '30', '14', '10', '19', '?']

/** The market scale in cue 4. */
const SC = { x: 800, y: 600, s: 0.9 }
const PIVOT_Y = SC.y - SCALE.H * SC.s
const PAN_Y = SC.y + SC.s * (-SCALE.H + SCALE.DROP - 7)
const PAN_DX = SCALE.L * SC.s
/** Half the beam's length on stage. */
const BEAM = (SCALE.L + 10) * SC.s

/** The equation line under the scale, and where it ends up: big, with the equals tile on the stage centre. */
const LINE = { y: 770, size: 76, gap: 18 }
const FINAL = { y: 450, size: 140 }
const GROW = FINAL.size / LINE.size

const IDS = ['x', 'plus', 'three', 'eq', 'eleven'] as const
type TermId = (typeof IDS)[number]
const EQ: Term[] = terms('x + 3 = 11').map((t, i) => ({ ...t, id: IDS[i] }))
const EQ_W = EQ.map((t) => termWidth(t, LINE.size))
const EQ_TOTAL = EQ_W.reduce((a, b) => a + b, 0) + LINE.gap * (EQ.length - 1)
/** Each tile's middle, relative to the Equation's own centre (the same sums Equation does). */
const EQ_C = EQ_W.map((w, i) => -EQ_TOTAL / 2 + EQ_W.slice(0, i).reduce((a, b) => a + b, 0) + LINE.gap * i + w / 2)
/** The Equation's x, chosen so the equals tile sits exactly on x = 800. */
const EQ_X = 800 - EQ_C[3]
const TILE = Object.fromEntries(IDS.map((id, i) => [id, EQ_X + EQ_C[i]])) as Record<TermId, number>
const TILE_W = Object.fromEntries(IDS.map((id, i) => [id, EQ_W[i]])) as Record<TermId, number>
const TILE_H = LINE.size * 1.3

/** The finished equation's edges, for the "equation" bracket under it. */
const BR = {
  l: 800 + (TILE.x - TILE_W.x / 2 - 800) * GROW,
  r: 800 + (TILE.eleven + TILE_W.eleven / 2 - 800) * GROW,
  y: FINAL.y + (TILE_H / 2) * GROW + 34,
}
/** The scale ends up this small, standing on top of the equals tile. */
const ICON = { k: 0.17, base: FINAL.y - (TILE_H / 2) * GROW }

/** The three pieces the learner writes down. */
type Piece = 'x' | 'three' | 'eleven'
const PIECES: Piece[] = ['x', 'three', 'eleven']
const NAME: Record<Piece, string> = { x: 'the sack', three: 'the 3 weights', eleven: 'the 11 weights' }
const SIDE: Record<Piece, 'left' | 'right'> = { x: 'left', three: 'left', eleven: 'right' }
/** Where each piece stands on its pan (stage coordinates of its base). */
const HOME: Record<Piece, { x: number; y: number }> = {
  x: { x: SC.x - PAN_DX - 62 * SC.s, y: PAN_Y },
  three: { x: SC.x - PAN_DX + 62 * SC.s, y: PAN_Y },
  eleven: { x: SC.x + PAN_DX, y: PAN_Y },
}
/** Each piece's grab area in its pan's units: x, y, width, height. */
const HIT: Record<Piece, [number, number, number, number]> = {
  x: [-58, -124, 116, 132],
  three: [-76, -86, 152, 96],
  eleven: [-126, -170, 252, 180],
}
const LW = weightSpots(3, 3)
const RW = weightSpots(11, 5)

const STATE: string[] = [
  'A big glowing pink sack (the unknown from the market) floats in the night sky. A blank cream name tag hangs from its tie, with a blinking cursor, waiting for a name.',
  "Al-Khwarizmi points at the sack and his word for the unknown, 'the thing', is written on the tag. Then those words fold away and a big pink letter x bursts onto the tag: the unknown now has a short name, x.",
  'A little window opens on the sack. Gold numbers spin past like a slot machine, then it clunks to a stop on one single card with a pink question mark: x is one exact number, we just do not know which one yet. (It is 8, but chapter 4 finds that out, so do not tell.)',
  '',
  'The scale has become the equation x + 3 = 11, big in the middle of the stage, and each tile lights up as it is read. The word "equation" appears under it. Then the scale shrinks right down and lands on top of the teal equals tile, which teeters like a beam: an equation is a balance scale, written small. (x is 8, but finding that is the next chapter, so do not give it away.)',
]

/* ------------------------------------------------------------------ */
/* Local art                                                            */
/* ------------------------------------------------------------------ */

/** The sealed sack drawn big: the kit's Sack shape (so it can shrink into one), without its little tag. Base at (0, 0). */
function BigSack() {
  return (
    <g>
      <path d="M-30 -84 Q-56 -62 -48 -24 Q-44 0 0 0 Q44 0 48 -24 Q56 -62 30 -84 Z" fill={N.pink} />
      <path d="M12 -84 H30 Q56 -62 48 -24 Q44 0 0 0 Q34 -10 32 -40 Q30 -66 12 -84 Z" fill={N.pinkDark} />
      <path d="M-30 -74 Q-46 -50 -38 -20" stroke={N.pinkLight} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.8} />
      <path d="M-14 -80 Q-8 -66 -12 -52 M4 -80 Q10 -70 8 -60" stroke={N.pinkDark} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.55} />
      <path d="M-22 -86 Q-26 -104 -10 -110 L10 -110 Q26 -104 22 -86 Z" fill={N.pink} />
      <path d="M6 -110 L10 -110 Q26 -104 22 -86 H12 Q16 -100 6 -110 Z" fill={N.pinkDark} opacity={0.7} />
      <rect x={-26} y={-92} width={52} height={10} rx={5} fill={N.gold} />
    </g>
  )
}

/** A four-pointed sparkle centred on (0, 0). */
function Sparkle({ r = 12, color = N.white }: { r?: number; color?: string }) {
  const k = r * 0.22
  return <path d={`M0 ${-r} L${k} ${-k} L${r} 0 L${k} ${k} L0 ${r} L${-k} ${k} L${-r} 0 L${-k} ${-k} Z`} fill={color} />
}

/** A quill pen with its nib at (0, 0). */
function Quill() {
  return (
    <g transform="rotate(-35)">
      <path d="M0 0 L-5 -18 Q-20 -70 -6 -128 Q14 -86 9 -20 Z" fill={N.violetLight} />
      <path d="M0 0 L-2 -20 Q-4 -80 -6 -128 Q4 -80 4 -20 Z" fill={N.violet} opacity={0.6} />
      <path d="M0 0 L-3 -16 L3 -16 Z" fill={N.night1} />
    </g>
  )
}

/** The name tag, in stage units, hanging from its string tied on at (0, 0). */
function NameTag({ inkClip, rays }: { inkClip: string; rays: string }) {
  const word = { fontFamily: FONT2, fontWeight: 800, fontSize: 50, fill: N.night1, textAnchor: 'middle' as const }
  return (
    <g data-tutor="the name tag">
      <path d={`M0 0 Q${TAG.hx * 0.25} ${TAG.hy * 0.95} ${TAG.hx} ${TAG.hy}`} stroke={N.cream} strokeWidth={5} fill="none" strokeLinecap="round" />
      <g transform={`translate(${TAG.hx} ${TAG.hy}) rotate(${TAG.tilt})`}>
        {/* light behind the new name */}
        <g className="c3-xglow">
          <Glow x={TAG.textX} r={230} color="pink" />
        </g>
        <g transform={`translate(${TAG.textX} 0)`}>
          <g className="c3-rays">
            <g className="spin" style={{ animationDuration: '40s' }}>
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI) / 6
                const d = 0.07
                const R = 270
                return <path key={i} d={`M0 0 L${R * Math.cos(a - d)} ${R * Math.sin(a - d)} L${R * Math.cos(a + d)} ${R * Math.sin(a + d)} Z`} fill={`url(#${rays})`} />
              })}
            </g>
          </g>
        </g>
        {/* the tag itself */}
        <path d="M-42 -26 L-14 -64 H294 Q316 -64 316 -42 V42 Q316 64 294 64 H-14 L-42 26 Z" fill={N.cream} />
        <path d="M-42 26 L-14 64 H294 Q316 64 316 42 V30 Q316 50 294 50 H-8 L-38 18 Z" fill={N.sandLight} opacity={0.75} />
        <circle r={15} fill="none" stroke={N.sand} strokeWidth={5} />
        <circle r={10} fill={N.night1} />
        <g className="c3-writeline">
          <line x1={34} x2={290} y1={40} y2={40} stroke={N.stone} strokeWidth={4} strokeDasharray="3 11" strokeLinecap="round" />
        </g>
        <g className="c3-caret">
          <g className="blink-light">
            <rect x={TAG.textX - 3} y={-36} width={7} height={64} rx={3.5} fill={N.night2} />
          </g>
        </g>
        {/* "the thing", written in ink */}
        <g clipPath={`url(#${inkClip})`}>
          <text className="c3-w" x={78} y={18} {...word}>
            the
          </text>
          <text className="c3-w" x={210} y={18} {...word}>
            thing
          </text>
        </g>
        <g className="c3-quill-pos" transform={`translate(${INK.x} 0)`}>
          <g className="c3-quill">
            <g className="c3-quill-bob">
              <g transform="translate(0 22)">
                <Quill />
              </g>
            </g>
          </g>
        </g>
        {/* ...and its new name */}
        <circle className="c3-gather" cx={TAG.textX} cy={4} r={18} fill={N.pinkLight} filter="url(#fx-glow)" />
        <g transform={`translate(${TAG.textX} 4)`}>
          <circle className="c3-ring" r={190} fill="none" stroke={N.pinkLight} strokeWidth={7} />
          {Array.from({ length: 10 }, (_, i) => (
            <g key={i} className="c3-sp">
              <Sparkle r={i % 2 ? 11 : 16} color={i % 3 ? N.pinkLight : N.white} />
            </g>
          ))}
        </g>
        <text className="c3-x" x={TAG.textX} y={46} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={132} fill={N.pink} stroke={N.pinkDark} strokeWidth={4} paintOrder="stroke" data-tutor="the letter x">
          x
        </text>
      </g>
    </g>
  )
}

/** The slot-machine window on the sack's belly, in the sack's own units. */
function NumberWindow({ clip, shade }: { clip: string; shade: string }) {
  const x0 = -WIN.w / 2
  const y0 = WIN.y - WIN.h / 2
  const num = { textAnchor: 'middle' as const, fontFamily: FONT2, fontWeight: 800, fontSize: 26 }
  return (
    <g className="c3-win" data-tutor="the number window">
      <rect x={x0 - 3} y={y0 - 3} width={WIN.w + 6} height={WIN.h + 6} rx={10} fill={N.stoneDark} />
      <rect x={x0} y={y0} width={WIN.w} height={WIN.h} rx={8} fill={N.night0} />
      <g clipPath={`url(#${clip})`}>
        <g className="c3-reel">
          {REEL.map((n, i) => {
            const cy = WIN.y + i * WIN.step
            return n === '?' ? (
              <g key={i} transform={`translate(0 ${cy})`}>
                <g className="c3-card-glow">
                  <Glow r={24} color="warm" opacity={0.7} />
                </g>
                <rect x={-15} y={-14} width={30} height={28} rx={6} fill={N.night2} stroke={N.goldDark} strokeWidth={1.2} />
                <text className="c3-q" y={9.5} {...num} fill={N.pink}>
                  ?
                </text>
              </g>
            ) : (
              <text key={i} y={cy + 9} {...num} fill={N.gold}>
                {n}
              </text>
            )
          })}
        </g>
        <rect x={x0} y={y0} width={WIN.w} height={WIN.h} fill={`url(#${shade})`} />
      </g>
      <rect className="c3-flash" x={x0} y={y0} width={WIN.w} height={WIN.h} rx={8} fill={N.white} />
      <rect x={x0} y={y0} width={WIN.w} height={WIN.h} rx={8} fill="none" stroke={N.stoneLight} strokeWidth={2.4} />
      <g className="c3-arrows">
        <path d={`M${x0 - 9} ${WIN.y - 5} L${x0 - 2.5} ${WIN.y} L${x0 - 9} ${WIN.y + 5} Z`} fill={N.stoneLight} />
        <path d={`M${-x0 + 9} ${WIN.y - 5} L${-x0 + 2.5} ${WIN.y} L${-x0 + 9} ${WIN.y + 5} Z`} fill={N.stoneLight} />
      </g>
    </g>
  )
}

/** The scale drawn tiny in teal line art, standing on (x, base) at the size the real one shrinks to. */
function ScaleIcon({ x, base, k }: { x: number; base: number; k: number }) {
  const s = k * SC.s
  const top = base - SCALE.H * s
  const L = SCALE.L * s
  const drop = SCALE.DROP * s
  const pan = 146 * s
  return (
    <g data-tutor="the tiny scale on the equals sign">
      <Glow x={x} y={top + 20} r={90} color="teal" opacity={0.7} />
      <path d={`M${x - 15} ${base} Q${x} ${base - 9} ${x + 15} ${base} Z`} fill={N.tealLight} />
      <rect x={x - 2.5} y={top} width={5} height={base - top - 4} rx={2} fill={N.tealLight} />
      <rect x={x - L - 2} y={top - 2.5} width={2 * L + 4} height={5} rx={2.5} fill={N.tealLight} />
      <path d={`M${x - 3} ${top} L${x} ${top - 10} L${x + 3} ${top} Z`} fill={N.white} />
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={`M${x + side * L} ${top} L${x + side * L - pan * 0.8} ${top + drop} M${x + side * L} ${top} L${x + side * L + pan * 0.8} ${top + drop}`} stroke={N.tealLight} strokeWidth={1.6} opacity={0.9} />
          <path d={`M${x + side * L - pan} ${top + drop} Q${x + side * L} ${top + drop + 12} ${x + side * L + pan} ${top + drop} Z`} fill={N.tealLight} />
        </g>
      ))}
      <circle cx={x} cy={top} r={3.5} fill={N.white} />
    </g>
  )
}

/** What a piece looks like on its pan (pan units, base at (0, 0)). */
function PieceArt({ piece, tutor }: { piece: Piece; tutor?: string }) {
  if (piece === 'x') return <Sack tutor={tutor} />
  const spots = piece === 'three' ? LW : RW
  return (
    <g data-tutor={tutor}>
      {spots.map(([x, y], i) => (
        <Weight key={i} x={x} y={y} s={0.9} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The scene                                                            */
/* ------------------------------------------------------------------ */

interface Ghost {
  piece: Piece
  x: number
  y: number
  /** In the learner's hand, flying back to its pan, or flying into its tile. */
  mode: 'hand' | 'home' | 'slot'
}

export function Ch3Unknown({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ids = { ink: `c3-ink-${uid}`, win: `c3-win-${uid}`, shade: `c3-shade-${uid}`, rays: `c3-rays-${uid}` }

  const [placed, setPlaced] = useState<Record<Piece, boolean>>({ x: false, three: false, eleven: false })
  const [eqIn, setEqIn] = useState(false)
  const [beamLit, setBeamLit] = useState(false)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [ready, setReady] = useState(false)
  const [misses, setMisses] = useState(0)

  const cueRef = useRef(cueIndex)
  cueRef.current = cueIndex
  const playingRef = useRef(playing)
  playingRef.current = playing
  const placedRef = useRef(placed)
  placedRef.current = placed
  const cb = useRef({ say, emit, onPlayDone })
  cb.current = { say, emit, onPlayDone }
  const holding = useRef(false)
  const eqStarted = useRef(false)
  const eqPending = useRef(false)
  const timers = useRef<number[]>([])
  const fx = useRef<gsap.Context | null>(null)

  const allIn = placed.x && placed.three && placed.eleven
  const myTurn = cueIndex === 3 && ready && !allIn

  const build = useCallback((tl: gsap.core.Timeline) => {
    const scaleEl = root.current?.querySelector('.c3-scale') ?? null
    const tilt = { deg: 13 }
    const tiltTo = (from: number, to: number, at: number, dur: number, ease: string) =>
      tl.fromTo(tilt, { deg: from }, { deg: to, duration: dur, ease, immediateRender: false, onUpdate: () => tiltScale(scaleEl, tilt.deg) }, at)
    // Later tweens of something already animated must not jump it to their start when the timeline is built.
    const later = { immediateRender: false }
    const kick = (at: number, deg: number) => {
      tl.to('.c3-tag-kick', { rotation: deg, svgOrigin: '0 0', duration: 0.18, ease: 'power2.out' }, at)
      tl.to('.c3-tag-kick', { rotation: 0, duration: 1.5, ease: 'elastic.out(1, 0.25)' }, at + 0.18)
    }

    // Start: the big sack alone in the night sky, with a blank tag. Everything else waits, hidden.
    tl.set('.c3-hero', { x: HERO.x, y: HERO.y, scale: HERO.s, svgOrigin: '0 0', opacity: 1 })
    tl.set(['.c3-caret', '.c3-writeline', '.c3-quill', '.c3-x', '.c3-xglow', '.c3-rays', '.c3-ring', '.c3-sp', '.c3-gather', '.c3-win', '.c3-arrows', '.c3-flash'], { opacity: 0 })
    tl.set('.c3-alk', { opacity: 0, y: 90 })
    tl.set(`#${ids.ink} rect`, { attr: { width: 0 } })
    tl.set('.c3-card-glow', { opacity: 0.25 })
    tl.set(['.c3-scalewrap', '.c3-pan-sack', '.c3-slot', '.c3-guide', '.c3-level-glow'], { opacity: 0 })
    tl.set(['.c3-label', '.c3-bracket', '.c3-icon', '.c3-shock', '.c3-lit', '.c3-glint'], { opacity: 0 })

    // 0. The sack drifts in, glowing. "...a name": it wriggles, the tag swings, and a cursor blinks on it.
    tl.addLabel('b0')
    tl.fromTo('.c3-cam', { scale: 0.88, svgOrigin: '780 480' }, { scale: 1, duration: 5, ease: 'sine.out' }, 'b0')
    tl.fromTo('.c3-far', { scale: 0.96, svgOrigin: '800 450' }, { scale: 1, duration: 5, ease: 'sine.out' }, 'b0')
    tl.fromTo('.c3-hero-glow', { opacity: 0.2 }, { opacity: 0.75, duration: 2.4, ease: 'sine.inOut' }, 'b0+=0.4')
    tl.to('.c3-hero-wig', { rotation: -5, svgOrigin: '0 0', duration: 0.16, ease: 'power2.out' }, 'b0+=2.4')
    tl.to('.c3-hero-wig', { rotation: 4, duration: 0.2, ease: 'power2.inOut' }, 'b0+=2.56')
    tl.to('.c3-hero-wig', { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 'b0+=2.76')
    kick(tl.labels.b0 + 4.0, 13)
    tl.fromTo('.c3-writeline', { opacity: 0, scaleX: 0, svgOrigin: '34 40' }, { opacity: 1, scaleX: 1, duration: 0.5, ease: 'power2.out' }, 'b0+=4.1')
    tl.to('.c3-caret', { opacity: 1, duration: 0.2 }, 'b0+=4.45')

    // 1. Al-Khwarizmi's word is inked onto the tag, folds away, and a pink x bursts in.
    tl.addLabel('b1', 5.0)
    const b1 = tl.labels.b1
    tl.fromTo('.c3-cam2', { scale: 1, svgOrigin: '930 470' }, { scale: 1.08, duration: 5.3, ease: 'sine.inOut' }, b1)
    tl.to('.c3-far', { x: -16, duration: 5.3, ease: 'sine.inOut' }, b1)
    tl.to('.c3-alk', { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.4)' }, b1 + 0.1)
    tl.to('.c3-caret', { opacity: 0, duration: 0.2 }, b1 + 0.5)
    tl.to('.c3-quill', { opacity: 1, duration: 0.3 }, b1 + 0.6)
    tl.to(`#${ids.ink} rect`, { attr: { width: INK.w }, duration: 1.1, ease: 'power1.inOut' }, b1 + 0.9)
    tl.fromTo('.c3-quill-pos', { x: INK.x }, { x: INK.x + INK.w - 10, duration: 1.1, ease: 'power1.inOut' }, b1 + 0.9)
    tl.fromTo('.c3-quill-bob', { y: 0 }, { y: -10, duration: 0.11, yoyo: true, repeat: 9, ease: 'sine.inOut' }, b1 + 0.9)
    tl.to('.c3-quill', { opacity: 0, y: -40, duration: 0.4, ease: 'power2.in' }, b1 + 2.1)
    tl.to('.c3-alk', { opacity: 0, y: 70, duration: 0.6, ease: 'power2.in' }, b1 + 2.7)
    tl.to('.c3-w', { scaleY: 0, opacity: 0, transformOrigin: '50% 65%', duration: 0.3, ease: 'power2.in', stagger: 0.12 }, b1 + 3.0)
    tl.to('.c3-writeline', { opacity: 0, duration: 0.3 }, b1 + 3.15)
    tl.fromTo('.c3-gather', { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.55, ease: 'power2.in' }, b1 + 3.65)
    const pop = b1 + 4.2
    tl.set('.c3-gather', { opacity: 0 }, pop)
    tl.fromTo('.c3-x', { opacity: 0, scale: 0.1, rotation: -40, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, rotation: 0, duration: 0.75, ease: 'back.out(2.4)' }, pop)
    tl.fromTo('.c3-ring', { opacity: 1, scale: 0.12, transformOrigin: '50% 50%' }, { opacity: 0, scale: 1, duration: 0.9, ease: 'power2.out', ...later }, pop)
    tl.fromTo(
      '.c3-sp',
      { opacity: 1, x: 0, y: 0, scale: 0.4, svgOrigin: '0 0' },
      { opacity: 0, x: (i: number) => Math.cos(i * 0.628 + 0.3) * 250, y: (i: number) => Math.sin(i * 0.628 + 0.3) * 180, scale: 1.1, duration: 1.0, ease: 'power3.out', ...later },
      pop,
    )
    tl.fromTo('.c3-rays', { opacity: 0, scale: 0.3, svgOrigin: '0 0' }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out', ...later }, pop)
    tl.to('.c3-xglow', { opacity: 1, duration: 0.4 }, pop)
    tl.to('.c3-hero-glow', { opacity: 1, duration: 0.5 }, pop)
    kick(pop, -12)

    // 2. A window opens on the sack: numbers spin past, then clunk to a stop on one hidden number.
    tl.addLabel('b2', b1 + 5.3)
    const b2 = tl.labels.b2
    const winOrigin = `${HERO.x} ${HERO.y + WIN.y * HERO.s}`
    tl.to('.c3-cam2', { scale: 1, duration: 1.2, ease: 'power2.inOut' }, b2)
    tl.fromTo('.c3-cam3', { scale: 1, svgOrigin: winOrigin }, { scale: 1.2, duration: 6.6, ease: 'sine.inOut' }, b2 + 0.2)
    tl.to('.c3-far', { x: -30, duration: 6.6, ease: 'sine.inOut' }, b2)
    tl.to('.c3-rays', { opacity: 0.18, duration: 1 }, b2)
    tl.to('.c3-xglow', { opacity: 0.35, duration: 1 }, b2)
    tl.fromTo('.c3-win', { opacity: 0, scale: 0, svgOrigin: `0 ${WIN.y}` }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.8)', ...later }, b2 + 0.3)
    const st = WIN.step
    tl.fromTo('.c3-reel', { y: 0 }, { y: -3 * st, duration: 0.8, ease: 'power2.in' }, b2 + 0.5)
    tl.to('.c3-reel', { y: -13 * st, duration: 1.35, ease: 'none' }, b2 + 1.3)
    tl.to('.c3-reel', { y: -(REEL.length - 1) * st, duration: 0.75, ease: 'power2.out' }, b2 + 2.65)
    const lock = b2 + 3.4
    tl.fromTo('.c3-flash', { opacity: 0.85 }, { opacity: 0, duration: 0.45, ease: 'power2.out', ...later }, lock)
    tl.fromTo('.c3-hero-wig', { scaleY: 0.95 }, { scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.35)', ...later }, lock)
    tl.to('.c3-arrows', { opacity: 1, duration: 0.25 }, lock)
    tl.to('.c3-card-glow', { opacity: 1, duration: 0.6 }, lock + 0.1)
    tl.to('.c3-q', { scale: 1.25, transformOrigin: '50% 50%', duration: 0.24, yoyo: true, repeat: 3, ease: 'sine.inOut' }, b2 + 5.2)

    // 3. The market scale comes back: the sack lands on its pan, the scale levels, and an empty line waits under it.
    tl.addLabel('b3', b2 + 6.9)
    const b3 = tl.labels.b3
    tl.to('.c3-win', { scale: 0, opacity: 0, duration: 0.35, ease: 'back.in(1.6)' }, b3)
    tl.to('.c3-cam3', { scale: 1, duration: 1.5, ease: 'power2.inOut' }, b3)
    tl.to('.c3-far', { x: 0, duration: 1.5, ease: 'power2.inOut' }, b3)
    tl.to(['.c3-rays', '.c3-xglow'], { opacity: 0, duration: 0.5 }, b3)
    tl.to('.c3-tagwrap', { opacity: 0, duration: 0.5 }, b3 + 0.3)
    tl.to('.c3-hero-glow', { opacity: 0.4, duration: 0.8 }, b3 + 0.2)
    // The sack arcs up over the pan and drops onto it.
    tl.to('.c3-hero', { x: HOME.x.x, duration: 1.3, ease: 'power2.inOut' }, b3 + 0.2)
    tl.to('.c3-hero', { scale: SC.s, duration: 1.1, ease: 'power2.out' }, b3 + 0.2)
    tl.to('.c3-hero', { y: HOME.x.y - 120, duration: 0.85, ease: 'power2.out' }, b3 + 0.2)
    tl.to('.c3-hero', { y: HOME.x.y - 44, duration: 0.45, ease: 'power2.in' }, b3 + 1.05)
    tl.fromTo('.c3-scalewrap', { opacity: 0, scale: 0.8, svgOrigin: `${SC.x} ${SC.y}` }, { opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out', ...later }, b3 + 0.3)
    const land = b3 + 1.5
    tl.set('.c3-hero', { opacity: 0 }, land)
    tl.set('.c3-pan-sack', { opacity: 1 }, land)
    tl.fromTo('.c3-pan-sack', { y: -44 / SC.s }, { y: 0, duration: 0.22, ease: 'power2.in', ...later }, land)
    tiltTo(13, 0, land + 0.2, 1.0, 'elastic.out(1, 0.45)')
    tl.to('.c3-level-glow', { opacity: 1, duration: 0.5 }, land + 0.5)
    tl.to('.c3-level-glow', { opacity: 0.35, duration: 0.8 }, land + 1.0)
    tl.fromTo('.c3-slot', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.12, ...later }, land + 0.6)
    tl.to('.c3-guide', { opacity: 1, duration: 0.6 }, land + 0.9)

    // 4. The line becomes the big equation; each tile lights as it is read; the scale shrinks onto the equals sign.
    tl.addLabel('b4', land + 1.6)
    const b4 = tl.labels.b4
    tl.to(['.c3-slot', '.c3-guide', '.c3-level-glow', '.c3-beamwrap'], { opacity: 0, duration: 0.35 }, b4)
    tl.to('.c3-scalewrap', { scale: 0.42, y: -255, duration: 1.2, ease: 'power3.inOut' }, b4)
    tl.fromTo('.c3-eqwrap', { y: 0, scale: 1, svgOrigin: `800 ${LINE.y}` }, { y: FINAL.y - LINE.y, scale: GROW, duration: 1.2, ease: 'power3.inOut' }, b4)
    const light = (list: TermId[], at: number) =>
      list.forEach((id) => {
        tl.to(`.c3-eq .term-${id}`, { scale: 1.14, transformOrigin: '50% 50%', duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.out' }, at)
        if (id === 'plus') return
        tl.fromTo(`.c3-lit-${id}`, { opacity: 0 }, { opacity: 1, duration: 0.15, ...later }, at)
        tl.to(`.c3-lit-${id}`, { opacity: id === 'eq' ? 0.45 : 0.12, duration: 0.7 }, at + 0.25)
      })
    light(['x'], b4 + 0.1)
    light(['plus', 'three'], b4 + 0.55)
    light(['eq'], b4 + 1.05)
    light(['eleven'], b4 + 1.55)
    tl.fromTo('.c3-bracket', { opacity: 0, scaleX: 0, svgOrigin: `${(BR.l + BR.r) / 2} ${BR.y}` }, { opacity: 1, scaleX: 1, duration: 0.6, ease: 'power2.out', ...later }, b4 + 2.4)
    tl.fromTo('.c3-label', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', ...later }, b4 + 2.5)
    const shrink = b4 + 3.6
    tl.to('.c3-scalewrap', { scale: ICON.k, y: ICON.base - SC.y, duration: 0.8, ease: 'power2.inOut' }, shrink)
    const hit = shrink + 0.8
    tl.fromTo('.c3-eq .term-eq text', { rotation: -13, transformOrigin: '50% 50%' }, { rotation: 0, duration: 1.0, ease: 'elastic.out(1.1, 0.3)', ...later }, hit)
    tl.fromTo('.c3-shock', { opacity: 0.9, scale: 0.3, svgOrigin: `800 ${ICON.base}` }, { opacity: 0, scale: 1, duration: 0.8, ease: 'power2.out', ...later }, hit)
    tl.to('.c3-lit-eq', { opacity: 1, duration: 0.12 }, hit)
    tl.to('.c3-lit-eq', { opacity: 0.55, duration: 0.8 }, hit + 0.15)
    tl.to('.c3-scalewrap', { opacity: 0, duration: 0.35 }, hit + 0.15)
    tl.to('.c3-icon', { opacity: 1, duration: 0.35 }, hit + 0.15)
    tl.fromTo('.c3-glint', { opacity: 0, scale: 0, rotation: 0, svgOrigin: '0 0' }, { opacity: 1, scale: 1, rotation: 45, duration: 0.25, ease: 'power2.out', ...later }, hit + 0.35)
    tl.to('.c3-glint', { opacity: 0, scale: 0, rotation: 90, duration: 0.35, ease: 'power2.in' }, hit + 0.6)
    tl.fromTo('.c3-cam4', { scale: 1, svgOrigin: '800 450' }, { scale: 1.035, duration: 4.0, ease: 'sine.inOut' }, b4 + 1.2)
    tl.addLabel('b5', hit + 1.0)
    // The ids are stable for this mount; the timeline is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The scale has arrived in cue 4 once its animation is done: then the pieces can be picked up.
  const animDone = useCallback(() => {
    if (cueRef.current === 3) setReady(true)
    onAnimDone()
  }, [onAnimDone])

  useBeatTimeline(root, build, cueIndex, playing, animDone)

  // One-off animations for the learner's moves, cleaned up with the scene.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {}, root)
    fx.current = ctx
    return () => {
      ctx.revert()
      fx.current = null
    }
  }, [])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  // Tiles show once they have been written (and always from the last cue on).
  const shown: Record<TermId, boolean> = {
    x: placed.x || cueIndex >= 4,
    plus: placed.three || cueIndex >= 4,
    three: placed.three || cueIndex >= 4,
    eq: eqIn || cueIndex >= 4,
    eleven: placed.eleven || cueIndex >= 4,
  }
  useLayoutEffect(() => {
    IDS.forEach((id) => {
      const el = root.current?.querySelector<SVGGElement>(`.c3-eq .term-${id}`)
      if (!el) return
      el.style.transition = 'opacity 0.25s ease-out'
      el.style.opacity = shown[id] ? '1' : '0'
    })
  })

  // What Pip sees, and hints for the learner's turn.
  useEffect(() => {
    if (cueIndex !== 3) {
      reportState(STATE[cueIndex] ?? '')
      return
    }
    const done = PIECES.filter((p) => placed[p]).map((p) => NAME[p])
    reportState(
      'The market scale is back and level: the pink sack (x) and 3 gold weights on the left pan, 11 gold weights on the right pan. ' +
        'Under it is an empty line with a left part, a teal spot in the middle for the equals sign, and a right part, with dotted guides from each pan to its part. ' +
        'The learner drags each piece of the scale down into the line (a tap also sends it). The answer: the sack becomes the pink x tile and the 3 weights become "+ 3", both left of the middle; the 11 weights become 11 on the right. ' +
        'When all three are in, the level beam flies in as the equals sign, making x + 3 = 11. ' +
        `Written so far: ${done.length ? done.join(', ') : 'nothing yet'}. Drops on the wrong side so far: ${misses}. ` +
        'Likely mix-up: putting the 11 weights on the left or the sack on the right, forgetting that each side of the line is one pan.',
    )
    setHints([
      'Each part of the line sits under the scale, just like the pans do.',
      'Look at which pan each piece is sitting on.',
      'The teal spot in the middle stands for the beam. Each pan gets its own side of it.',
    ])
  }, [cueIndex, placed, misses, reportState, setHints])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  /** A tile pops up where a piece has just landed, with a ring of light. */
  const popTiles = (list: TermId[]) =>
    fx.current?.add(() => {
      list.forEach((id) => {
        const tile = root.current?.querySelector(`.c3-eq .term-${id}`)
        if (tile) gsap.fromTo(tile, { scale: 0.3, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.6, ease: 'back.out(2.6)' })
        const ring = root.current?.querySelector(`.c3-pop-${id}`)
        if (ring) gsap.fromTo(ring, { opacity: 1, scale: 0.45, transformOrigin: '50% 50%' }, { opacity: 0, scale: 1.5, duration: 0.7, ease: 'power2.out' })
      })
    })

  /** Once both sides are written, the level beam glows teal and drops into the middle of the line as "=". */
  const startEquals = () => {
    if (eqStarted.current) return
    if (!playingRef.current) {
      eqPending.current = true
      return
    }
    eqStarted.current = true
    eqPending.current = false
    setBeamLit(true)
    void cb.current.say(LINES.eq)
    fx.current?.add(() => {
      const t = gsap.timeline({
        onComplete: () => {
          setEqIn(true)
          popTiles(['eq'])
          cb.current.onPlayDone()
        },
      })
      const bars = ['.c3-beambar-a', '.c3-beambar-b']
      t.set(bars, { opacity: 1, attr: { x: SC.x - BEAM, width: 2 * BEAM, y: PIVOT_Y - 8 } }, 0.45)
      t.to(bars, { attr: { x: SC.x - 34, width: 68 }, duration: 0.85, ease: 'power2.inOut' }, 0.5)
      t.to('.c3-beambar-a', { attr: { y: LINE.y - 18 }, duration: 0.85, ease: 'power2.inOut' }, 0.5)
      t.to('.c3-beambar-b', { attr: { y: LINE.y + 4 }, duration: 0.85, ease: 'power2.inOut' }, 0.5)
      t.to(bars, { opacity: 0, duration: 0.2 }, 1.3)
    })
  }
  useEffect(() => {
    if (playing && eqPending.current && cueRef.current === 3) startEquals()
    // startEquals only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const goHome = (p: Piece) => {
    setGhost((g) => g && { ...g, x: HOME[p].x, y: HOME[p].y, mode: 'home' })
    later(() => {
      setGhost(null)
      holding.current = false
    }, 460)
  }

  const land = (p: Piece) => {
    const tile = p === 'x' ? TILE.x : p === 'three' ? TILE.three : TILE.eleven
    const mid = p === 'x' ? 52 : p === 'three' ? 28 : 75
    setGhost((g) => g && { ...g, x: tile, y: LINE.y + mid * SC.s * 0.4, mode: 'slot' })
    const nowAll = PIECES.every((k) => k === p || placedRef.current[k])
    cb.current.emit({ type: 'attempt', correct: true, detail: `wrote ${NAME[p]} on the ${SIDE[p]} side of the line` })
    const said = cb.current.say(LINES[p])
    later(() => {
      setGhost(null)
      holding.current = false
      setPlaced((pl) => ({ ...pl, [p]: true }))
      popTiles(p === 'three' ? ['plus', 'three'] : [p === 'x' ? 'x' : 'eleven'])
    }, 420)
    if (nowAll) {
      cb.current.emit({ type: 'progress', detail: 'wrote the whole scale as x + 3 = 11' })
      void said.then(() => {
        if (cueRef.current === 3) startEquals()
      })
    }
  }

  const drop = (p: Piece, at: { x: number; y: number } | null) => {
    // A tap sends the piece straight to its place.
    if (!at) return land(p)
    if (at.y < LINE.y - 130) return goHome(p)
    if (Math.abs(at.x - SC.x) < 50) {
      goHome(p)
      void cb.current.say(LINES.middle)
      cb.current.emit({ type: 'attempt', correct: false, detail: `dropped ${NAME[p]} on the equals spot` })
      return
    }
    const side = at.x < SC.x ? 'left' : 'right'
    if (side !== SIDE[p]) {
      goHome(p)
      setMisses((m) => m + 1)
      void cb.current.say(LINES.wrongSide)
      cb.current.emit({ type: 'attempt', correct: false, detail: `put ${NAME[p]} on the ${side} side of the line` })
      return
    }
    land(p)
  }

  // Picking up a piece lifts a glowing copy of it off the pan; the scale itself stays level.
  const grab = (e: ReactPointerEvent<SVGGElement>, p: Piece) => {
    if (!myTurn || placed[p] || holding.current) return
    e.preventDefault()
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const p0 = toStage(svg, e.clientX, e.clientY)
    const home = HOME[p]
    holding.current = true
    setGhost({ piece: p, x: home.x, y: home.y, mode: 'hand' })
    let moved = 0
    const move = (ev: PointerEvent) => {
      const q = toStage(svg, ev.clientX, ev.clientY)
      moved = Math.max(moved, Math.hypot(q.x - p0.x, q.y - p0.y))
      setGhost((g) => g && { ...g, x: home.x + q.x - p0.x, y: home.y + q.y - p0.y })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      drop(p, moved < 12 ? null : toStage(svg, ev.clientX, ev.clientY))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const pieceOnPan = (p: Piece, tutor: string) => {
    const live = myTurn && !placed[p] && !ghost
    const [hx, hy, hw, hh] = HIT[p]
    const ring = p === 'x' ? N.pinkLight : N.goldLight
    return (
      <g
        className={live ? 'hot' : undefined}
        style={{ touchAction: 'none', cursor: live ? 'grab' : undefined, opacity: ghost?.piece === p ? 0.5 : 1, transition: 'opacity 0.2s' }}
        onPointerDown={(e) => grab(e, p)}
      >
        {placed[p] && <Glow y={hy / 2} r={hw * 0.7} color={p === 'x' ? 'pink' : 'warm'} opacity={0.55} />}
        <PieceArt piece={p} tutor={tutor} />
        {live && <rect className="hot-ring" x={hx} y={hy} width={hw} height={hh} rx={28} fill="none" stroke={ring} strokeWidth={4} />}
        <rect x={hx} y={hy} width={hw} height={hh} fill="transparent" />
      </g>
    )
  }

  const slotBox = (from: number, to: number, color: string, fill: string, tutor: string, key: string): ReactNode => (
    <g key={key} className="c3-slot" data-tutor={tutor}>
      <rect x={from} y={LINE.y - TILE_H / 2 - 12} width={to - from} height={TILE_H + 24} rx={28} fill={fill} opacity={0.35} />
      <rect x={from} y={LINE.y - TILE_H / 2 - 12} width={to - from} height={TILE_H + 24} rx={28} fill="none" stroke={color} strokeWidth={4} strokeDasharray="12 10" strokeLinecap="round" />
    </g>
  )

  const ghostScale = ghost?.mode === 'slot' ? SC.s * 0.4 : ghost?.mode === 'home' ? SC.s : SC.s * 1.06
  const litColor: Record<Exclude<TermId, 'plus'>, 'pink' | 'warm' | 'teal'> = { x: 'pink', three: 'warm', eq: 'teal', eleven: 'warm' }

  return (
    <g ref={root}>
      <defs>
        <clipPath id={ids.ink}>
          <rect x={INK.x} y={-80} width={0} height={160} />
        </clipPath>
        <clipPath id={ids.win}>
          <rect x={-WIN.w / 2} y={WIN.y - WIN.h / 2} width={WIN.w} height={WIN.h} rx={8} />
        </clipPath>
        <radialGradient id={ids.rays} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={270}>
          <stop offset="0.15" stopColor={N.pinkLight} stopOpacity="0.55" />
          <stop offset="1" stopColor={N.pinkLight} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.night0} stopOpacity="0.95" />
          <stop offset="0.3" stopColor={N.night0} stopOpacity="0" />
          <stop offset="0.7" stopColor={N.night0} stopOpacity="0" />
          <stop offset="1" stopColor={N.night0} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* The far sky: moves less than everything else, for depth */}
      <g className="c3-far">
        <Backdrop kind="deep">
          <Stars h={900} count={140} seed={33} />
        </Backdrop>
        <Glow x={1230} y={640} r={560} color="violet" opacity={0.3} />
        <Glow x={280} y={760} r={480} color="cool" opacity={0.25} />
      </g>

      <g className="c3-cam">
        <g className="c3-cam2">
          <g className="c3-cam3">
            <g className="c3-cam4">
              {/* Al-Khwarizmi, for a moment */}
              <g className="c3-alk" pointerEvents="none">
                <Glow x={250} y={660} r={250} color="violet" opacity={0.8} />
                <AlKhwarizmi x={250} y={880} s={1.15} pose="point" face="smile" />
              </g>

              {/* The market scale, level: the sack and 3 weights against 11 weights */}
              <g className="c3-scalewrap">
                <g className="c3-level-glow">
                  <Glow x={SC.x} y={PIVOT_Y} r={300} color="teal" opacity={0.6} />
                </g>
                <g transform={`translate(${SC.x} ${SC.y}) scale(${SC.s})`}>
                  <Scale
                    className="c3-scale"
                    tilt={13}
                    tutor="the balance scale"
                    left={
                      <>
                        <g className="c3-pan-sack">
                          <g transform="translate(-62 0)">{pieceOnPan('x', 'the sack on the scale')}</g>
                        </g>
                        <g transform="translate(62 0)">{pieceOnPan('three', 'the 3 weights')}</g>
                      </>
                    }
                    right={pieceOnPan('eleven', 'the 11 weights')}
                  />
                </g>
                <g className="c3-beamwrap" pointerEvents="none">
                  <g style={{ opacity: beamLit ? 1 : 0, transition: 'opacity 0.4s ease-out' }}>
                    <Glow x={SC.x} y={PIVOT_Y} r={320} color="teal" opacity={0.9} />
                    <rect x={SC.x - BEAM} y={PIVOT_Y - 9} width={2 * BEAM} height={18} rx={9} fill={N.teal} />
                    <rect x={SC.x - BEAM + 10} y={PIVOT_Y - 7} width={2 * BEAM - 20} height={5} rx={2.5} fill={N.tealLight} />
                  </g>
                </g>
              </g>

              {/* The big sack with its name tag and its number window */}
              <g className="float" pointerEvents="none">
                <g className="c3-hero" data-tutor="the sealed sack">
                  <g className="c3-hero-wig">
                    <g className="c3-hero-glow">
                      <Glow y={-52} r={210} color="pink" opacity={0.4} />
                      <Glow y={-52} r={128} color="pink" />
                    </g>
                    <g className="breathe">
                      <BigSack />
                    </g>
                    <NumberWindow clip={ids.win} shade={ids.shade} />
                    <g transform={`translate(${TIE.x} ${TIE.y}) scale(${1 / HERO.s})`}>
                      <g className="c3-tagwrap">
                        <g className="c3-tag-kick">
                          <g className="sway" style={{ transformBox: 'view-box', transformOrigin: '0 0' }}>
                            <NameTag inkClip={ids.ink} rays={ids.rays} />
                          </g>
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>

              {/* The empty line, with dotted guides from each pan to its part */}
              <g pointerEvents="none">
                <g className="c3-guide">
                  {[
                    [SC.x - PAN_DX, PAN_Y + 52, (TILE.x + TILE.three) / 2, LINE.y - TILE_H / 2 - 16],
                    [SC.x, SC.y + 14, SC.x, LINE.y - TILE_H / 2 - 16],
                    [SC.x + PAN_DX, PAN_Y + 52, TILE.eleven, LINE.y - TILE_H / 2 - 16],
                  ].map(([x1, y1, x2, y2], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i === 1 ? N.teal : N.mist} strokeOpacity={0.45} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" />
                  ))}
                </g>
                {slotBox(TILE.x - TILE_W.x / 2 - 12, TILE.three + TILE_W.three / 2 + 12, N.mist, N.night0, 'the left side of the line', 'l')}
                {slotBox(TILE.eq - TILE_W.eq / 2 - 8, TILE.eq + TILE_W.eq / 2 + 8, N.teal, N.tealDark, 'the equals spot', 'm')}
                {slotBox(TILE.eleven - TILE_W.eleven / 2 - 12, TILE.eleven + TILE_W.eleven / 2 + 12, N.mist, N.night0, 'the right side of the line', 'r')}
              </g>

              {/* The equation: written tile by tile in cue 4, then big in the middle */}
              <g className="c3-eqwrap" pointerEvents="none">
                {(['x', 'three', 'eq', 'eleven'] as const).map((id) => (
                  <g key={id} className={`c3-lit c3-lit-${id}`}>
                    <Glow x={TILE[id]} y={LINE.y} r={LINE.size * 1.5} color={litColor[id]} />
                  </g>
                ))}
                <Equation className="c3-eq" terms={EQ} x={EQ_X} y={LINE.y} size={LINE.size} gap={LINE.gap} tutor="the equation" />
                {(['x', 'three', 'eq', 'eleven'] as const).map((id) => (
                  <circle key={id} className={`c3-pop-${id}`} cx={TILE[id]} cy={LINE.y} r={TILE_H * 0.75} fill="none" stroke={id === 'x' ? N.pinkLight : id === 'eq' ? N.tealLight : N.goldLight} strokeWidth={5} opacity={0} />
                ))}
              </g>

              {/* The finished picture: "equation", and the scale standing tiny on the equals sign */}
              <g pointerEvents="none">
                <path className="c3-bracket" d={`M${BR.l} ${BR.y - 16} Q${BR.l} ${BR.y} ${BR.l + 16} ${BR.y} H${BR.r - 16} Q${BR.r} ${BR.y} ${BR.r} ${BR.y - 16}`} stroke={N.mist} strokeOpacity={0.6} strokeWidth={4} fill="none" strokeLinecap="round" />
                <g className="c3-label">
                  <Title x={(BR.l + BR.r) / 2} y={BR.y + 62} size={48} color={N.mist}>
                    an equation
                  </Title>
                </g>
                <ellipse className="c3-shock" cx={800} cy={ICON.base} rx={150} ry={34} fill="none" stroke={N.tealLight} strokeWidth={5} />
                <g className="c3-icon">
                  <ScaleIcon x={800} base={ICON.base} k={ICON.k} />
                </g>
                <g transform={`translate(${800 + SCALE.L * SC.s * ICON.k} ${ICON.base - SCALE.H * SC.s * ICON.k - 6})`}>
                  <g className="c3-glint">
                    <Sparkle r={22} color={N.white} />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* What the learner carries, and the beam flying down as "=" */}
      <g pointerEvents="none">
        {ghost && (
          <g
            style={{
              transform: `translate(${ghost.x}px, ${ghost.y}px) scale(${ghostScale})`,
              opacity: ghost.mode === 'hand' ? 1 : 0,
              transition: ghost.mode === 'hand' ? 'none' : 'transform 0.42s cubic-bezier(.45,0,.3,1), opacity 0.42s ease-in',
            }}
          >
            <Glow y={ghost.piece === 'eleven' ? -75 : -45} r={ghost.piece === 'eleven' ? 190 : 120} color={ghost.piece === 'x' ? 'pink' : 'warm'} opacity={0.8} />
            <PieceArt piece={ghost.piece} />
          </g>
        )}
        <rect className="c3-beambar-a" x={SC.x - BEAM} y={PIVOT_Y - 8} width={2 * BEAM} height={14} rx={7} fill={N.tealLight} opacity={0} filter="url(#fx-glow)" />
        <rect className="c3-beambar-b" x={SC.x - BEAM} y={PIVOT_Y - 8} width={2 * BEAM} height={14} rx={7} fill={N.tealLight} opacity={0} filter="url(#fx-glow)" />
      </g>

      <g pointerEvents="none">
        <Motes count={16} seed={5} color={N.mist} />
      </g>
      <Vignette />
    </g>
  )
}

export const ch3: Chapter = {
  id: 'unknown',
  title: 'Naming the unknown',
  cues: CUES,
  Scene: Ch3Unknown,
  enter: { type: 'pan', dir: 'left' },
}
