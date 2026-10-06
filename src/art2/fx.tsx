import type { ReactNode } from 'react'
import { N } from './palette'

/** A small seeded random generator, so scattered things land in the same place every time. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Shared gradients and filters. Rendered once inside the stage <svg>, so every piece
 * of art (and Pip's snapshot of the stage) can use them by id.
 */
export function Defs() {
  return (
    <defs>
      <linearGradient id="fx-sky-night" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.space} />
        <stop offset="0.55" stopColor={N.night1} />
        <stop offset="1" stopColor={N.dusk} />
      </linearGradient>
      <linearGradient id="fx-sky-deep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.space} />
        <stop offset="1" stopColor={N.night2} />
      </linearGradient>
      <linearGradient id="fx-sky-dusk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.night1} />
        <stop offset="0.6" stopColor={N.plum} />
        <stop offset="1" stopColor={N.haze} />
      </linearGradient>
      <linearGradient id="fx-sky-day" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f6fd6" />
        <stop offset="0.55" stopColor="#62a8f2" />
        <stop offset="1" stopColor="#c8e6ff" />
      </linearGradient>
      <linearGradient id="fx-sky-dawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.night2} />
        <stop offset="0.5" stopColor={N.dusk} />
        <stop offset="0.82" stopColor={N.coralLight} />
        <stop offset="1" stopColor={N.sandLight} />
      </linearGradient>
      {(['violet', 'violetDark', 'pink', 'sky', 'plum', 'dusk'] as const).map((c) => (
        <radialGradient key={c} id={`fx-bloom-${c}`}>
          <stop offset="0" stopColor={N[c]} stopOpacity="1" />
          <stop offset="0.55" stopColor={N[c]} stopOpacity="0.8" />
          <stop offset="0.8" stopColor={N[c]} stopOpacity="0.3" />
          <stop offset="1" stopColor={N[c]} stopOpacity="0" />
        </radialGradient>
      ))}
      <radialGradient id="fx-glow-warm">
        <stop offset="0" stopColor={N.goldLight} stopOpacity="0.9" />
        <stop offset="0.35" stopColor={N.gold} stopOpacity="0.35" />
        <stop offset="1" stopColor={N.gold} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fx-glow-pink">
        <stop offset="0" stopColor={N.pinkLight} stopOpacity="0.85" />
        <stop offset="0.4" stopColor={N.pink} stopOpacity="0.3" />
        <stop offset="1" stopColor={N.pink} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fx-glow-teal">
        <stop offset="0" stopColor={N.tealLight} stopOpacity="0.85" />
        <stop offset="0.4" stopColor={N.teal} stopOpacity="0.3" />
        <stop offset="1" stopColor={N.teal} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fx-glow-cool">
        <stop offset="0" stopColor={N.skyLight} stopOpacity="0.6" />
        <stop offset="0.5" stopColor={N.sky} stopOpacity="0.15" />
        <stop offset="1" stopColor={N.sky} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fx-glow-violet">
        <stop offset="0" stopColor={N.violetLight} stopOpacity="0.7" />
        <stop offset="0.45" stopColor={N.violet} stopOpacity="0.2" />
        <stop offset="1" stopColor={N.violet} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fx-vignette" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.6" stopColor={N.shadow} stopOpacity="0" />
        <stop offset="1" stopColor={N.shadow} stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id="fx-haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.violetLight} stopOpacity="0" />
        <stop offset="1" stopColor={N.violetLight} stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id="fx-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={N.night3} />
        <stop offset="1" stopColor={N.night0} />
      </linearGradient>
      <filter id="fx-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="fx-blur-big" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="30" />
      </filter>
      <filter id="fx-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

export type BloomColor = 'violet' | 'violetDark' | 'pink' | 'sky' | 'plum' | 'dusk'

/**
 * A big, very soft patch of colour in the sky. Drawn with a gradient rather than a blur
 * filter: Chrome cuts large blurred shapes off with a hard edge when they are scaled.
 */
export function Bloom({ x = 0, y = 0, r = 400, color = 'violet', opacity = 0.12 }: { x?: number; y?: number; r?: number; color?: BloomColor; opacity?: number }) {
  return <circle cx={x} cy={y} r={r + 80} fill={`url(#fx-bloom-${color})`} opacity={opacity} />
}

export type GlowColor = 'warm' | 'pink' | 'teal' | 'cool' | 'violet'

/** A soft round light. Put it behind whatever should look lit or important. */
export function Glow({ x = 0, y = 0, r = 120, color = 'warm', opacity = 1, className }: { x?: number; y?: number; r?: number; color?: GlowColor; opacity?: number; className?: string }) {
  return <circle className={className} cx={x} cy={y} r={r} fill={`url(#fx-glow-${color})`} opacity={opacity} />
}

/** A field of stars at a few depths. Inner groups twinkle on their own. */
export function Stars({ w = 1600, h = 600, count = 90, seed = 7, y = 0 }: { w?: number; h?: number; count?: number; seed?: number; y?: number }) {
  const r = rng(seed)
  const stars = Array.from({ length: count }, () => ({ x: r() * w, y: y + r() * h, s: r(), d: r() }))
  return (
    <g>
      {[0, 1, 2].map((layer) => (
        <g key={layer} className={`tw2 tw2-${layer}`}>
          {stars
            .filter((_, i) => i % 3 === layer)
            .map((st, i) =>
              st.s > 0.93 ? (
                <g key={i} transform={`translate(${st.x} ${st.y})`}>
                  <circle r={9} fill={N.skyLight} opacity={0.12} />
                  <path d="M0 -7 L1.4 -1.4 L7 0 L1.4 1.4 L0 7 L-1.4 1.4 L-7 0 L-1.4 -1.4 Z" fill={N.white} />
                </g>
              ) : (
                <circle key={i} cx={st.x} cy={st.y} r={0.8 + st.s * 1.8} fill={st.d > 0.75 ? N.goldLight : N.white} opacity={0.35 + st.s * 0.6} />
              ),
            )}
        </g>
      ))}
    </g>
  )
}

/** Tiny drifting motes of light, for air that feels alive. */
export function Motes({ w = 1600, h = 900, count = 26, seed = 3, color = N.goldLight }: { w?: number; h?: number; count?: number; seed?: number; color?: string }) {
  const r = rng(seed)
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = r() * w
        const y = r() * h
        const s = 1.5 + r() * 3
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <g className="mote" style={{ animationDelay: `${-r() * 14}s`, animationDuration: `${10 + r() * 10}s` }}>
              <circle r={s * 2.4} fill={color} opacity={0.12} />
              <circle r={s} fill={color} opacity={0.7} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** A full-stage background: gradient sky with big soft colour blooms. */
export function Backdrop({ kind = 'night', children }: { kind?: 'night' | 'deep' | 'dusk' | 'dawn' | 'day'; children?: ReactNode }) {
  return (
    <g>
      <rect x={-400} y={-300} width={2400} height={1500} fill={`url(#fx-sky-${kind})`} />
      {kind !== 'day' && (
        <>
          <Bloom x={260} y={160} r={420} color="violet" opacity={0.12} />
          <Bloom x={1350} y={260} r={380} color="pink" opacity={0.08} />
        </>
      )}
      {children}
    </g>
  )
}

/** A band of night haze that thickens toward `y`: put it in front of a far layer to push it back. */
export function Haze({ y = 700, h = 260 }: { y?: number; h?: number }) {
  return <rect x={-400} y={y - h} width={2400} height={h} fill="url(#fx-haze)" pointerEvents="none" />
}

/** Darkens the stage edges a little, which pulls the eye to the middle. */
export function Vignette() {
  return <rect x={0} y={0} width={1600} height={900} fill="url(#fx-vignette)" pointerEvents="none" />
}

/** A soft oval shadow under something standing on the ground. */
export function Shadow({ x = 0, y = 0, w = 120, opacity = 0.35 }: { x?: number; y?: number; w?: number; opacity?: number }) {
  return <ellipse cx={x} cy={y} rx={w / 2} ry={w / 9} fill={N.shadow} opacity={opacity} />
}
