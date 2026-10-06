/*
 * Recurring sets for the robot hands films. Each set is split into layers so a scene can put
 * them at different camera depths (`<g data-depth="0.3">` far, `1` main, `1.6` foreground).
 *
 *   <g data-depth="0.25"><LabSky /></g>
 *   <g data-depth="0.6"><LabWall /></g>
 *   <g data-depth="1"><LabFloor /><Workbench x={1180} y={700} />...</g>
 *   <g data-depth="1.7"><ForeShelf /></g>
 */
import { rng } from '../../../art2/fx'
import { C } from '../../../cine/palette'
import { Beam, DeskLamp, Dust, Pool } from './kit'
import './hands.css'

/** The city at night through the windows: deep sky, blurred lights, rain. `flashClass` names the lightning flash. */
export function LabSky({ flashClass = 'sky-flash', seed = 11 }: { flashClass?: string; seed?: number }) {
  const r = rng(seed)
  const towers = Array.from({ length: 22 }, (_, i) => ({ x: -300 + i * 105 + r() * 40, w: 60 + r() * 70, h: 180 + r() * 380 }))
  return (
    <g pointerEvents="none">
      <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-sky-night)" />
      <circle cx={1150} cy={150} r={500} fill="url(#cn-pool-rim)" opacity={0.35} />
      {/* far towers, soft */}
      <g filter="url(#cn-dof-3)">
        {towers.map((t, i) => (
          <g key={i}>
            <rect x={t.x} y={760 - t.h} width={t.w} height={t.h + 300} fill={C.ink2} />
            {Array.from({ length: Math.floor(t.h / 34) }, (_, k) => (
              <rect key={k} x={t.x + 8 + (k % 3) * (t.w / 3.4)} y={760 - t.h + 14 + k * 30} width={8} height={10} fill={r() > 0.55 ? C.keyLight : C.rim} opacity={r() * 0.5 + 0.1} />
            ))}
          </g>
        ))}
      </g>
      {/* bokeh: big soft city lights */}
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} className="hd-bokeh" style={{ animationDelay: `${-r() * 6}s` }} cx={-200 + r() * 2000} cy={420 + r() * 420} r={10 + r() * 26} fill={r() > 0.5 ? C.key : C.rim} opacity={0.5} filter="url(#cn-dof-2)" />
      ))}
      {/* rain */}
      <g opacity={0.35}>
        {Array.from({ length: 110 }, (_, i) => {
          const x = -300 + r() * 2200
          const y = -200 + r() * 1100
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <line className="hd-rain" style={{ animationDelay: `${-r()}s`, animationDuration: `${0.6 + r() * 0.5}s` }} x1={0} y1={0} x2={-6} y2={34} stroke={C.rim} strokeWidth={1.2} />
            </g>
          )
        })}
      </g>
      <rect className={flashClass} x={-600} y={-500} width={2800} height={1900} fill="#dff6ff" opacity={0} />
    </g>
  )
}

/** The window wall of the lab: three tall windows (holes) with mullions, rain drips on the glass, and shelves between them. */
export function LabWall({ windows = [[80, 60, 360, 640], [620, 60, 360, 640], [1160, 60, 360, 640]] as [number, number, number, number][] }: { windows?: [number, number, number, number][] }) {
  const holes = windows.map(([x, y, w, h]) => `M${x} ${y} h${w} v${h} h${-w} Z`).join(' ')
  const r = rng(4)
  return (
    <g pointerEvents="none">
      <path d={`M-600 -500 H2200 V1400 H-600 Z ${holes}`} fill="url(#cn-wall)" fillRule="evenodd" />
      {windows.map(([x, y, w, h], i) => (
        <g key={i}>
          {/* glass sheen and drips */}
          <rect x={x} y={y} width={w} height={h} fill={C.rim} opacity={0.04} />
          {Array.from({ length: 7 }, (_, k) => {
            const dx = x + 20 + r() * (w - 40)
            const dy = y + r() * h * 0.5
            return (
              <g key={k} transform={`translate(${dx} ${dy})`}>
                <circle className="hd-drip" style={{ animationDelay: `${-r() * 7}s`, animationDuration: `${5 + r() * 5}s` }} r={2.4} fill={C.rimDeep} />
              </g>
            )
          })}
          {/* mullions */}
          <rect x={x - 10} y={y - 10} width={w + 20} height={14} fill={C.ink1} />
          <rect x={x - 10} y={y + h - 4} width={w + 20} height={18} fill={C.ink1} />
          <rect x={x - 10} y={y - 10} width={12} height={h + 20} fill={C.ink1} />
          <rect x={x + w - 2} y={y - 10} width={12} height={h + 20} fill={C.ink1} />
          <rect x={x + w / 2 - 4} y={y} width={8} height={h} fill={C.ink1} />
          <rect x={x} y={y + h * 0.42} width={w} height={8} fill={C.ink1} />
          {/* a cool rim where the window light hits the frame */}
          <rect x={x + w - 2} y={y} width={2} height={h} fill={C.rim} opacity={0.5} />
        </g>
      ))}
      {/* shelves of parts between the windows, deep in shadow */}
      {[460, 1000].map((sx) => (
        <g key={sx} transform={`translate(${sx} 140)`}>
          {[0, 150, 300, 450].map((sy) => (
            <g key={sy}>
              <rect x={0} y={sy + 110} width={140} height={8} fill={C.ink3} />
              {/* boxes, coils, a spare robot finger */}
              <rect x={10} y={sy + 70} width={44} height={40} fill={C.ink2} />
              <rect x={60} y={sy + 84} width={30} height={26} rx={4} fill={C.ink3} />
              <circle cx={112} cy={sy + 96} r={14} fill="none" stroke={C.ink4} strokeWidth={5} />
              <rect x={14} y={sy + 76} width={36} height={3} fill={C.slate} opacity={0.5} />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}

/** The lab floor: polished concrete that catches the window light. */
export function LabFloor({ y = 760 }: { y?: number }) {
  return (
    <g pointerEvents="none">
      <rect x={-600} y={y} width={2800} height={700} fill="url(#cn-floor)" />
      {/* window light lying on the floor */}
      {[260, 800, 1340].map((x) => (
        <path key={x} d={`M${x - 150} ${y} L${x + 150} ${y} L${x + 420} ${y + 200} L${x - 20} ${y + 200} Z`} fill={C.rim} opacity={0.05} filter="url(#cn-dof-2)" />
      ))}
      <rect x={-600} y={y} width={2800} height={3} fill={C.rim} opacity={0.12} />
    </g>
  )
}

/** A workbench with a desk lamp pooling warm light on it. (x, y) is the centre of the bench top. */
export function Workbench({ x = 1200, y = 700, w = 560, lamp = true, lampClass = 'bench-lamp' }: { x?: number; y?: number; w?: number; lamp?: boolean; lampClass?: string }) {
  return (
    <g pointerEvents="none">
      {lamp && (
        <g className={lampClass}>
          <Pool x={x - 40} y={y - 20} r={420} color="key" opacity={0.9} />
          <Beam x={x + 70} y={y - 330} w1={60} w2={420} len={330} angle={14} opacity={0.35} />
          <Dust x={x - 260} y={y - 320} w={420} h={300} count={18} seed={9} />
        </g>
      )}
      {/* legs and shelf */}
      <rect x={x - w / 2 + 20} y={y + 20} width={18} height={180} fill={C.ink1} />
      <rect x={x + w / 2 - 38} y={y + 20} width={18} height={180} fill={C.ink1} />
      <rect x={x - w / 2 + 20} y={y + 140} width={w - 40} height={10} fill={C.ink2} />
      {/* top */}
      <rect x={x - w / 2} y={y} width={w} height={22} fill={C.ink3} />
      <rect x={x - w / 2} y={y} width={w} height={4} fill={C.keyDeep} opacity={0.7} />
      {/* clutter */}
      <rect x={x + w / 2 - 150} y={y - 26} width={70} height={26} rx={3} fill={C.ink2} />
      <rect x={x + w / 2 - 144} y={y - 22} width={58} height={4} fill={C.cyan} opacity={0.6} />
      <path d={`M${x - w / 2 + 40} ${y} q 30 -30 70 -6 t 80 -4`} fill="none" stroke={C.ink4} strokeWidth={4} />
      <rect x={x - w / 2 + 160} y={y - 10} width={90} height={10} rx={3} fill={C.metalDark} />
      {lamp && <DeskLamp x={x + w / 2 - 40} y={y} s={1} />}
    </g>
  )
}

/** A blurred foreground edge (a shelf upright and hanging cables) that slides past during a push-in. */
export function ForeShelf({ x = 1480 }: { x?: number }) {
  return (
    <g pointerEvents="none" filter="url(#cn-dof-3)">
      <rect x={x} y={-200} width={70} height={1300} fill={C.ink} />
      <rect x={x - 220} y={520} width={300} height={36} fill={C.ink} />
      <path d={`M${x - 160} 556 q 20 160 -40 260`} stroke={C.ink} strokeWidth={10} fill="none" />
      <path d={`M${x - 120} 556 q -10 120 30 240`} stroke={C.ink1} strokeWidth={7} fill="none" />
      <rect x={x - 200} y={470} width={90} height={50} fill={C.ink1} />
    </g>
  )
}
