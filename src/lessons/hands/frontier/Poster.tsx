import { GRASPS, makeHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { Blueprint, Pool, Vignette } from '../shared/kit'
import type { Design } from './design'
import { DesignHand } from './designHand'

const hand = makeHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 8, roll: 0, s: 2.05 }, xray: 1 })
const DESIGN: Design = { fingers: 5, motors: 12, place: 'forearm', drive: 'tendon', skin: 'arrays', build: 'mould' }

/** Start screen: your own hand on the drafting table, in x-ray, signed. */
export function Poster() {
  return (
    <g>
      <Blueprint />
      <Pool x={1120} y={420} r={560} color="key" opacity={0.55} />
      <Pool x={1120} y={760} r={380} color="cyan" opacity={0.25} />
      {/* drafting marks */}
      <g stroke={C.cyan} strokeWidth={1.5} opacity={0.5} fill="none">
        <circle cx={1120} cy={430} r={330} strokeDasharray="4 10" />
        <path d="M760 860 H1500 M760 850 v20 M1500 850 v20" />
        <path d="M1560 120 V860 M1550 120 h20 M1550 860 h20" />
      </g>
      <text x={1540} y={840} textAnchor="end" fill={C.cyanLight} fontFamily={MONO} fontSize={18} opacity={0.8}>
        rev 1 · 5 fingers · 12 motors · tendons
      </text>
      <DesignHand store={hand} design={DESIGN} x={1120} y={700} arm={150} xray={1} />
      {/* leader-line labels */}
      <g fontFamily={SANS} fontSize={24} fontWeight={600}>
        <path d="M1165 800 L1300 780 H1400" stroke={C.amber} strokeWidth={2} fill="none" />
        <text x={1408} y={788} fill={C.amber}>
          motors
        </text>
        <path d="M1050 560 L940 520 H860" stroke={C.cyan} strokeWidth={2} fill="none" />
        <text x={852} y={528} textAnchor="end" fill={C.cyan}>
          tendons
        </text>
      </g>
      <g transform="translate(1380 250) rotate(-9) scale(0.8)">
        <rect x={-150} y={-46} width={300} height={92} rx={10} fill="none" stroke={C.gold} strokeWidth={5} />
        <text x={0} y={18} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={52} fontWeight={700} letterSpacing={8}>
          SIGNED
        </text>
      </g>
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        Build Your Own Hand
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 6
      </text>
      <Vignette />
    </g>
  )
}
