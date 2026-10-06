import { C, SANS, SERIF } from '../../../cine/palette'
import { Dust, Pool, Vignette } from '../shared/kit'
import { TopCup, TopGripper, TopTable, TopVase } from './art'
import { averagePath, pathD, tenDemos, VASE, GOAL } from './sim'

const DEMOS = tenDemos()
const AVG = averagePath(DEMOS)
/** Shift the vase scene right so the title has room. */
const DX = 330
const shift = (p: { x: number; y: number }[]) => p.map((q) => ({ x: q.x + DX, y: q.y }))

/** Start screen: ten demonstrations around a vase, and the average driving straight into it. */
export function Poster() {
  return (
    <g>
      <TopTable x={560} y={40} w={1060} h={860} seed={4} lampX={1130} lampY={420} />
      <TopCup x={GOAL.x + DX} y={GOAL.y - 10} s={1} rot={-20} />
      {DEMOS.map((d, i) => (
        <path key={i} d={pathD(shift(d))} stroke={C.lime} strokeWidth={3} fill="none" opacity={0.8} filter={i % 3 ? undefined : 'url(#cn-bloom)'} />
      ))}
      <Pool x={VASE.x + DX} y={VASE.y} r={240} color="danger" opacity={0.8} />
      <g transform={`rotate(12 ${VASE.x + DX} ${VASE.y})`}>
        <TopVase x={VASE.x + DX + 8} y={VASE.y - 10} s={1.05} />
      </g>
      <path d={pathD(shift(AVG))} stroke={C.paper} strokeWidth={5} strokeDasharray="14 9" fill="none" />
      <g transform={`translate(${AVG[17].x + DX} ${AVG[17].y + 6}) rotate(-90) scale(1.5)`}>
        <TopGripper glow={C.danger} />
      </g>
      <Dust x={560} y={40} w={1060} h={860} count={30} seed={7} />
      <rect x={0} y={0} width={760} height={900} fill="url(#cn-fade-up)" opacity={0} />
      <path d="M0 0 H 820 Q 640 450 820 900 H 0 Z" fill={C.ink} opacity={0.78} />
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        How Robots
      </text>
      <text className="poster-title" x={110} y={268} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        Learn
      </text>
      <text className="poster-title" x={114} y={322} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · DATA 3
      </text>
      <text x={114} y={760} fill={C.lime} fontFamily={SANS} fontSize={26}>
        ten good demos, one bad average
      </text>
      <Vignette />
    </g>
  )
}
