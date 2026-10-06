import { CineDefs } from './defs'
import { C } from './palette'
import { Person, POSES, Profile, Robot } from './people'
import { Grain } from '../art2/Grain'
import { GRASPS, Hand3D, makeHandStore, type HandLook, type HandPose } from './hand3d'

function H({ x, y, pose, look, yaw = -25, pitch = 10, s = 1.6, tendons, xray = 0 }: { x: number; y: number; pose: HandPose; look: HandLook; yaw?: number; pitch?: number; s?: number; tendons?: boolean; xray?: number }) {
  const store = makeHandStore({ pose, view: { yaw, pitch, s }, xray })
  return <Hand3D store={store} x={x} y={y} look={look} arm={120} tendons={tendons} />
}

/** A test page for the cinema kit: open #/cine/0, #/cine/1, ... Not linked from anywhere. */
export function CineKit({ page = 0 }: { page?: number }) {
  return (
    <div style={{ background: C.ink, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: 'min(100vw, 1600px)' }}>
        <svg viewBox="0 0 1600 900" style={{ width: '100%', display: 'block' }}>
          <CineDefs />
          <rect width={1600} height={900} fill="url(#cn-wall)" />
          {page === 0 && (
            <g>
              <circle cx={300} cy={200} r={700} fill="url(#cn-pool-key)" />
              <rect y={760} width={1600} height={140} fill="url(#cn-floor)" />
              <Person name="a" x={200} y={800} s={1.5} pose={POSES.stand} hair="bun" />
              <Person name="b" x={480} y={800} s={1.5} pose={POSES.think} hair="curls" skin={C.skinC} skinDark={C.skinCDark} top="#2f5d62" topDark="#1c3a3e" glasses />
              <Person name="c" x={760} y={800} s={1.5} pose={POSES.reach} hair="beanie" skin={C.skinA} skinDark={C.skinADark} top="#5a4a8a" topDark="#382c5e" outfit="hoodie" />
              <Person name="d" x={1040} y={800} s={1.5} pose={POSES.walkA} hair="long" hairColor={C.hairBrown} top="#c8a24a" topDark="#8d6e24" outfit="coat" flip />
              <Person name="e" x={1300} y={800} s={1.5} pose={POSES.sitForward} hair="short" headset outfit="tee" top="#3a6ea5" topDark="#244a73" light="cool-right" />
              <Robot name="r1" x={1420} y={800} s={1.5} pose={POSES.reach} />
              <Person name="f" x={1560} y={800} s={1.5} pose={POSES.stand} silhouette={C.ink1} hair="ponytail" />
            </g>
          )}
          {page === 2 && (
            <g>
              <circle cx={400} cy={200} r={900} fill="url(#cn-pool-key)" />
              <H x={200} y={420} pose={GRASPS.open} look="robot" />
              <H x={500} y={420} pose={GRASPS.power} look="robot" yaw={-60} />
              <H x={800} y={420} pose={GRASPS.pinch} look="robot" yaw={-70} />
              <H x={1100} y={420} pose={GRASPS.point} look="human" yaw={-30} />
              <H x={1400} y={420} pose={GRASPS.spread} look="human" yaw={10} />
              <H x={200} y={850} pose={GRASPS.fist} look="robot" yaw={-90} />
              <H x={500} y={850} pose={GRASPS.tripod} look="xray" yaw={-50} tendons />
              <H x={800} y={850} pose={GRASPS.relaxed} look="bones" yaw={0} />
              <H x={1100} y={850} pose={GRASPS.open} look="robot" yaw={160} />
              <H x={1400} y={850} pose={GRASPS.power} look="robot" yaw={-30} xray={1} />
            </g>
          )}
          {page === 1 && (
            <g>
              <circle cx={1300} cy={300} r={900} fill="url(#cn-pool-key)" />
              <Profile x={300} y={150} s={1.2} reflect={C.cyan} />
            </g>
          )}
        </svg>
        <Grain strength={0.12} />
      </div>
    </div>
  )
}
