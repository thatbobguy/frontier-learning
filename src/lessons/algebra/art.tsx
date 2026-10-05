import type { ReactNode } from 'react'
import { Person, type PersonProps } from '../../art2/characters'
import { Backdrop, Glow, Haze, Stars } from '../../art2/fx'
import { N } from '../../art2/palette'
import { Moon, Palm, River, Skyline } from '../../art2/scenery'

/*
 * The cast and places of the algebra lesson, shared by every chapter so they always look the same.
 *
 * Colour rule for this lesson: pink is only ever the unknown (x), gold only a known number,
 * teal only balance and the equals sign. Clothes and buildings stay out of those three.
 */

type CastProps = Omit<PersonProps, 'skin' | 'skinDark' | 'robe' | 'robeLight' | 'robeDark' | 'head' | 'headColor' | 'headDark' | 'beard'>

/** Layla, the spice seller at the night market. */
export function Layla(p: CastProps) {
  return <Person {...p} head="hijab" headColor={N.sky} headDark={N.skyDark} robe={N.coral} robeLight={N.coralLight} robeDark={N.coralDark} skin={N.skin2} skinDark={N.skin2Dark} />
}

/** The customer who brings the sealed sack. */
export function Customer(p: CastProps) {
  return <Person {...p} head="cap" headColor={N.sand} headDark={N.sandDark} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} beard={N.night1} skin={N.skin1} skinDark={N.skin1Dark} />
}

/** Muhammad ibn Musa al-Khwarizmi, scholar at the House of Wisdom. */
export function AlKhwarizmi(p: CastProps) {
  return <Person {...p} head="turban" headColor={N.cream} headDark={N.sandLight} robe={N.violet} robeLight={N.violetLight} robeDark={N.violetDark} beard={N.night0} skin={N.skin3} skinDark={N.skin3Dark} />
}

/**
 * The House of Wisdom: a great domed library. (x, y) is the middle of the dome, which is
 * where the camera flies in at the start of chapter 2. Give the glow the class you animate.
 */
export function HouseOfWisdom({ x = 0, y = 0, s = 1, glowClass, children }: { x?: number; y?: number; s?: number; glowClass?: string; children?: ReactNode }) {
  const win = (wx: number, wy: number, w = 22, h = 40) => (
    <g key={`${wx}-${wy}`}>
      <rect x={wx - w / 2 - 5} y={wy - 5} width={w + 10} height={h + 10} rx={w / 2 + 5} fill={N.gold} opacity={0.16} />
      <path d={`M${wx - w / 2} ${wy + h} V${wy + w / 2} A${w / 2} ${w / 2} 0 0 1 ${wx + w / 2} ${wy + w / 2} V${wy + h} Z`} fill={N.goldLight} />
    </g>
  )
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={glowClass}>
        <Glow y={10} r={330} color="warm" opacity={0.55} />
      </g>
      {/* minarets */}
      {[-250, 250].map((mx) => (
        <g key={mx}>
          <rect x={mx - 16} y={-150} width={32} height={600} fill={N.night2} />
          <rect x={mx + 4} y={-150} width={12} height={600} fill={N.night1} opacity={0.7} />
          <rect x={mx - 24} y={-60} width={48} height={12} rx={4} fill={N.night3} />
          <path d={`M${mx - 16} -150 Q${mx} -210 ${mx + 16} -150 Z`} fill={N.violetDark} />
          <circle cx={mx} cy={-206} r={5} fill={N.goldLight} />
          {win(mx, -30, 12, 24)}
        </g>
      ))}
      {/* the hall */}
      <rect x={-210} y={60} width={420} height={420} fill={N.night2} />
      <rect x={-210} y={60} width={60} height={420} fill={N.night3} opacity={0.8} />
      <rect x={120} y={60} width={90} height={420} fill={N.night1} opacity={0.7} />
      <rect x={-224} y={48} width={448} height={18} rx={6} fill={N.night3} />
      {[-150, -90, 90, 150].map((wx) => win(wx, 110))}
      {[-150, -90, 90, 150].map((wx) => win(wx, 190))}
      {/* doorway */}
      <path d="M-46 300 V180 A46 46 0 0 1 46 180 V300 Z" fill={N.gold} opacity={0.25} />
      <path d="M-34 300 V186 A34 34 0 0 1 34 186 V300 Z" fill={N.goldLight} />
      {/* drum and dome */}
      <rect x={-120} y={10} width={240} height={50} fill={N.night3} />
      {[-80, -40, 0, 40, 80].map((wx) => win(wx, 18, 14, 26))}
      <rect x={-130} y={2} width={260} height={14} rx={6} fill={N.violetDark} />
      <path d="M-112 4 A112 136 0 0 1 112 4 Z" fill={N.violet} />
      <path d="M30 -124 A112 136 0 0 1 112 4 H52 Q62 -70 30 -124 Z" fill={N.violetDark} opacity={0.75} />
      <path d="M-70 -84 Q-92 -46 -94 -6" stroke={N.violetLight} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.7} />
      <path d="M-112 4 A112 136 0 0 1 112 4" stroke={N.gold} strokeWidth={5} fill="none" opacity={0.75} />
      {/* finial with a crescent */}
      <rect x={-4} y={-170} width={8} height={40} fill={N.gold} />
      <circle cy={-176} r={8} fill={N.gold} />
      <path d="M-12 -206 A14 14 0 1 0 12 -206 A11 11 0 1 1 -12 -206 Z" fill={N.goldLight} />
      {children}
    </g>
  )
}

/** A night market seen from far away: a little striped awning with lantern lights, standing on (0, 0). */
export function FarMarket({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow y={-30} r={110} color="warm" opacity={0.8} />
      <rect x={-44} y={-46} width={4} height={46} fill={N.night0} />
      <rect x={40} y={-46} width={4} height={46} fill={N.night0} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${-48 + i * 16} -56 h16 v12 q-8 6 -16 0 Z`} fill={i % 2 ? N.cream : N.coral} />
      ))}
      <rect x={-50} y={-14} width={100} height={14} rx={3} fill={N.wood} />
      <path d="M-90 -64 Q-50 -48 0 -60 Q50 -48 90 -64" stroke={N.night0} strokeWidth={1.5} fill="none" />
      {[-70, -36, 0, 36, 70].map((lx, i) => (
        <g key={lx} className={`blink-light tw2-${i % 3}`}>
          <circle cx={lx} cy={-55 + Math.abs(lx) * 0.03} r={9} fill={N.gold} opacity={0.3} />
          <circle cx={lx} cy={-55 + Math.abs(lx) * 0.03} r={4} fill={N.goldLight} />
        </g>
      ))}
    </g>
  )
}

/** Where the far market sits in the city picture, and where the House of Wisdom's dome is. */
export const CITY = { market: { x: 560, y: 782 }, dome: { x: 1180, y: 380 } }

/**
 * Night-time Baghdad on the Tigris: sky, moon, two layers of rooftops, the House of Wisdom,
 * the river and the near bank with the night market on it.
 */
export function BaghdadCity({ domeGlowClass, children }: { domeGlowClass?: string; children?: ReactNode }) {
  return (
    <g>
      <Backdrop kind="night">
        <Stars h={560} count={110} />
      </Backdrop>
      <Moon x={300} y={150} r={50} />
      <Skyline y={650} seed={5} color={N.night3} scale={0.8} windows={0.22} />
      <Haze y={650} h={220} />
      <HouseOfWisdom x={CITY.dome.x} y={CITY.dome.y} s={0.82} glowClass={domeGlowClass} />
      <Skyline y={735} seed={14} color={N.night1} windows={0.4} width={900} x={-60} />
      <Skyline y={735} seed={31} color={N.night1} windows={0.4} width={240} x={1420} />
      <Haze y={735} h={120} />
      <River y={735} />
      {/* lights mirrored in the water */}
      {[
        [CITY.market.x, 26, 0.5],
        [CITY.dome.x, 20, 0.35],
        [CITY.dome.x - 110, 8, 0.25],
        [CITY.dome.x + 110, 8, 0.25],
      ].map(([rx, w, o], i) => (
        <g key={i} className="shimmer" style={{ animationDelay: `${-i * 0.8}s` }}>
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={rx - w / 2 - k * 3} y={745 + k * 11} width={w + k * 6} height={4} rx={2} fill={N.goldLight} opacity={o * (1 - k * 0.2)} />
          ))}
        </g>
      ))}
      <path d="M-60 792 Q300 772 640 788 T1660 780 V960 H-60 Z" fill={N.night0} />
      <path d="M-60 792 Q300 772 640 788 T1660 780" stroke={N.night2} strokeWidth={4} fill="none" />
      <FarMarket x={CITY.market.x} y={CITY.market.y} />
      <Palm x={130} y={800} s={1.1} />
      <Palm x={1490} y={800} s={0.95} lean={-6} />
      {children}
    </g>
  )
}
