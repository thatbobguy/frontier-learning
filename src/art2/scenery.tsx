import { useId } from 'react'
import { Glow, rng } from './fx'
import { N } from './palette'

/** A crescent moon with a soft halo. */
export function Moon({ x = 0, y = 0, r = 46 }: { x?: number; y?: number; r?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow r={r * 3.2} color="cool" opacity={0.7} />
      <mask id={`moon-${id}`}>
        <circle r={r} fill="#fff" />
        <circle cx={r * 0.42} cy={-r * 0.22} r={r * 0.86} fill="#000" />
      </mask>
      <g mask={`url(#moon-${id})`}>
        <circle r={r} fill={N.cream} />
        <circle cx={-r * 0.35} cy={r * 0.3} r={r * 0.16} fill={N.sandLight} opacity={0.6} />
        <circle cx={-r * 0.62} cy={-r * 0.1} r={r * 0.1} fill={N.sandLight} opacity={0.6} />
      </g>
    </g>
  )
}

interface Building {
  x: number
  w: number
  h: number
  kind: 'dome' | 'minaret' | 'flat' | 'tower'
}

/** City rooftops: domes, minarets and flat roofs, with warm lit windows. */
export function Skyline({ y = 700, seed = 11, color = N.night1, windowColor = N.gold, windows = 0.5, scale = 1, width = 1700, x = -50 }: { y?: number; seed?: number; color?: string; windowColor?: string; windows?: number; scale?: number; width?: number; x?: number }) {
  const r = rng(seed)
  const parts: Building[] = []
  let cx = x
  while (cx < x + width) {
    const roll = r()
    const kind: Building['kind'] = roll < 0.28 ? 'dome' : roll < 0.42 ? 'minaret' : roll < 0.62 ? 'tower' : 'flat'
    const w = (kind === 'minaret' ? 26 + r() * 10 : 70 + r() * 90) * scale
    const h = (kind === 'minaret' ? 210 + r() * 80 : kind === 'tower' ? 120 + r() * 70 : 60 + r() * 70) * scale
    parts.push({ x: cx, w, h, kind })
    cx += w + (r() < 0.3 ? 6 * scale : -2)
  }
  const lights: { x: number; y: number; w: number; h: number }[] = []
  for (const b of parts) {
    if (b.kind === 'minaret') continue
    const cols = Math.max(1, Math.floor(b.w / (34 * scale)))
    const rows = Math.max(1, Math.floor(b.h / (42 * scale)))
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() < windows) {
          const ww = 10 * scale
          const wx = b.x + ((i + 0.5) * b.w) / cols - ww / 2
          const wy = y - b.h + 22 * scale + j * 42 * scale
          if (wy < y - 18 * scale) lights.push({ x: wx, y: wy, w: ww, h: 16 * scale })
        }
      }
    }
  }
  return (
    <g>
      {parts.map((b, i) => {
        const top = y - b.h
        if (b.kind === 'dome') {
          const dr = b.w * 0.42
          return (
            <g key={i} fill={color}>
              <rect x={b.x} y={top} width={b.w} height={b.h + 40} />
              <rect x={b.x + b.w / 2 - dr - 6} y={top - 8} width={dr * 2 + 12} height={12} rx={4} />
              <path d={`M${b.x + b.w / 2 - dr} ${top - 6} A${dr} ${dr * 1.15} 0 0 1 ${b.x + b.w / 2 + dr} ${top - 6} Z`} />
              <rect x={b.x + b.w / 2 - 2.5 * scale} y={top - dr * 1.15 - 22 * scale} width={5 * scale} height={20 * scale} />
              <circle cx={b.x + b.w / 2} cy={top - dr * 1.15 - 24 * scale} r={4.5 * scale} />
            </g>
          )
        }
        if (b.kind === 'minaret') {
          return (
            <g key={i} fill={color}>
              <rect x={b.x + b.w * 0.15} y={top} width={b.w * 0.7} height={b.h + 40} />
              <rect x={b.x - 4} y={top + b.h * 0.22} width={b.w + 8} height={9 * scale} rx={3} />
              <path d={`M${b.x + b.w * 0.15} ${top} Q${b.x + b.w / 2} ${top - b.w * 1.3} ${b.x + b.w * 0.85} ${top} Z`} />
              <circle cx={b.x + b.w / 2} cy={top - b.w * 0.75} r={3 * scale} />
            </g>
          )
        }
        if (b.kind === 'tower') {
          return (
            <g key={i} fill={color}>
              <rect x={b.x} y={top} width={b.w} height={b.h + 40} />
              {Array.from({ length: Math.floor(b.w / (16 * scale)) }, (_, k) => (
                <rect key={k} x={b.x + k * 16 * scale + 2} y={top - 9 * scale} width={9 * scale} height={10 * scale} />
              ))}
            </g>
          )
        }
        return <rect key={i} x={b.x} y={top} width={b.w} height={b.h + 40} fill={color} />
      })}
      {/* moonlight on the left faces, shade on the right, painted loosely */}
      <g filter="url(#fx-wet)">
        {parts.map((b, i) =>
          b.kind === 'minaret' ? null : (
            <g key={i}>
              <rect x={b.x + b.w * 0.64} y={y - b.h} width={b.w * 0.36} height={b.h + 40} fill={N.shadow} opacity={0.22} />
              <rect x={b.x} y={y - b.h} width={Math.min(6, b.w * 0.08)} height={b.h + 40} fill={N.mist} opacity={0.1} />
            </g>
          ),
        )}
      </g>
      <g>
        {lights.map((l, i) => (
          <g key={i}>
            <rect x={l.x - 3} y={l.y - 3} width={l.w + 6} height={l.h + 6} rx={4} fill={windowColor} opacity={0.18} />
            <path d={`M${l.x} ${l.y + l.h} V${l.y + l.w / 2} A${l.w / 2} ${l.w / 2} 0 0 1 ${l.x + l.w} ${l.y + l.w / 2} V${l.y + l.h} Z`} fill={windowColor} opacity={0.9} />
          </g>
        ))}
      </g>
    </g>
  )
}

/** A hanging lantern with a warm glow. Put the `sway` class on a wrapper to let it swing. */
export function Lantern({ x = 0, y = 0, s = 1, color = N.gold, rope = 60 }: { x?: number; y?: number; s?: number; color?: string; rope?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1={0} y1={-rope} x2={0} y2={-24} stroke={N.night0} strokeWidth={3} />
      <Glow r={90} color="warm" opacity={0.75} />
      <path d="M-10 -26 H10 L14 -16 H-14 Z" fill={N.brassDark} />
      <path d="M-14 -16 Q-22 6 -12 22 H12 Q22 6 14 -16 Z" fill={color} />
      <path d="M-14 -16 Q-22 6 -12 22 H-4 Q-12 6 -6 -16 Z" fill={N.goldLight} opacity={0.8} />
      <path d="M2 -16 Q8 6 4 22 H12 Q22 6 14 -16 Z" fill={N.goldDark} opacity={0.55} />
      <path d="M-12 22 H12 L8 30 H-8 Z" fill={N.brassDark} />
      <circle cx={0} cy={34} r={3} fill={N.brassDark} />
    </g>
  )
}

/** A palm tree in silhouette, with lighter fronds on top. */
export function Palm({ x = 0, y = 0, s = 1, color = N.night0, lean = 6 }: { x?: number; y?: number; s?: number; color?: string; lean?: number }) {
  const fronds = [-150, -115, -80, -45, -10, 25]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <path d={`M-9 0 Q${lean * 2} -120 ${lean * 3 - 4} -250 L${lean * 3 + 6} -250 Q${lean * 2 + 12} -120 9 0 Z`} />
      <g transform={`translate(${lean * 3 + 1} -250)`}>
        {fronds.map((a, i) => (
          <path key={i} transform={`rotate(${a})`} d="M0 -4 Q60 -34 120 6 Q64 -10 0 6 Z" />
        ))}
        <circle r={10} />
      </g>
    </g>
  )
}

/** A wide river with moonlit ripples. */
export function River({ y = 760, h = 160 }: { y?: number; h?: number }) {
  return (
    <g>
      <rect x={-400} y={y} width={2400} height={h + 300} fill="url(#fx-water)" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} className="shimmer" style={{ animationDelay: `${-i * 0.7}s` }} x={300 + ((i * 397) % 1000)} y={y + 18 + i * 14} width={60 + ((i * 53) % 90)} height={4} rx={2} fill={N.skyLight} opacity={0.35} />
      ))}
    </g>
  )
}

/** A market stall with a striped awning and a counter. Content goes on the counter at y = 0. */
export function Stall({ x = 0, y = 0, w = 640, stripe = N.coral, stripe2 = N.cream }: { x?: number; y?: number; w?: number; stripe?: string; stripe2?: string }) {
  const n = 8
  const sw = w / n
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* posts */}
      <rect x={-w / 2 + 10} y={-330} width={16} height={330} fill={N.woodDark} />
      <rect x={w / 2 - 26} y={-330} width={16} height={330} fill={N.woodDark} />
      {/* awning */}
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${-w / 2 + i * sw} -360 h${sw} v70 q${-sw / 2} 26 ${-sw} 0 Z`} fill={i % 2 ? stripe2 : stripe} />
      ))}
      <rect x={-w / 2 - 10} y={-378} width={w + 20} height={22} rx={8} fill={N.coralDark} />
      <path d={`M${-w / 2} -290 h${w} v10 h${-w} Z`} fill={N.shadow} opacity={0.18} />
      {/* counter */}
      <rect x={-w / 2 - 20} y={0} width={w + 40} height={26} rx={8} fill={N.woodLight} />
      <rect x={-w / 2 - 6} y={26} width={w + 12} height={130} fill={N.wood} />
      <rect x={-w / 2 - 6} y={26} width={w + 12} height={14} fill={N.woodDark} opacity={0.6} />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={-w / 2 + 20 + i * (w / 5)} y={60} width={w / 5 - 40} height={80} rx={10} fill={N.woodDark} opacity={0.35} />
      ))}
    </g>
  )
}

/** Rolling ground in two tones with a lit rim. */
export function Ground({ y = 780, color = N.night2, rim = N.night3 }: { y?: number; color?: string; rim?: string }) {
  return (
    <g>
      <path d={`M-400 ${y} Q400 ${y - 40} 800 ${y} T2000 ${y} V1300 H-400 Z`} fill={rim} />
      <path d={`M-400 ${y + 12} Q400 ${y - 28} 800 ${y + 12} T2000 ${y + 12} V1300 H-400 Z`} fill={color} />
    </g>
  )
}
