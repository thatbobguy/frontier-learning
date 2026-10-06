import './art2.css'
import { Person, Pip2 } from './characters'
import { Backdrop, Defs, Glow, Motes, Stars, Vignette } from './fx'
import { N } from './palette'
import { Book, Equation, NumberMachine, Sack, Scale, Title, Weight, terms, weightSpots } from './props'
import { Lantern, Moon, Palm, River, Skyline, Stall } from './scenery'
import { BalancePlay } from '../lessons/algebra/balance'
import { Ama, Bag, Bundle, GROUND_Y, Hand, NumberLine, Pebble, Pen, PlaceNumber, Sheep, Stick, Valley } from '../lessons/frameworks/art'

/** A test page for the art kit: open #/kit. Not linked from anywhere. */
export function Gallery({ page = 0 }: { page?: number }) {
  return (
    <div style={{ background: N.space, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <svg viewBox="0 0 1600 900" style={{ width: 'min(100vw, 1600px)' }}>
        <Defs />
        {page === 0 && (
          <g>
            <Backdrop kind="night">
              <Stars h={520} />
            </Backdrop>
            <Moon x={1300} y={150} r={56} />
            <Skyline y={720} seed={5} color={N.night3} scale={0.8} windows={0.25} />
            <Skyline y={760} seed={9} color={N.night1} windows={0.45} />
            <River y={760} />
            <Palm x={140} y={780} s={1.1} />
            <Palm x={1480} y={790} s={0.9} lean={-6} />
            <Motes />
            <Vignette />
          </g>
        )}
        {page === 1 && (
          <g>
            <Backdrop kind="dusk">
              <Stars h={300} count={40} />
            </Backdrop>
            <Skyline y={560} seed={21} color={N.dusk} scale={0.7} windows={0.2} />
            <Stall x={800} y={560} w={900} />
            <g className="sway">
              <Lantern x={480} y={260} rope={60} />
            </g>
            <g className="sway" style={{ animationDelay: '-1.6s' }}>
              <Lantern x={1120} y={250} rope={50} color={N.coral} />
            </g>
            <Person x={300} y={860} s={1.1} head="hijab" headColor={N.teal} headDark={N.tealDark} robe={N.coral} robeLight={N.coralLight} robeDark={N.coralDark} skin={N.skin2} skinDark={N.skin2Dark} pose="wave" />
            <Person x={1330} y={860} s={1.1} flip head="turban" headColor={N.cream} headDark={N.sandLight} robe={N.violet} robeLight={N.violetLight} robeDark={N.violetDark} beard={N.night0} skin={N.skin3} skinDark={N.skin3Dark} pose="think" face="think" />
            <g transform="translate(800 540)">
              <Scale
                tilt={-6}
                left={
                  <>
                    <Sack x={-60} />
                    {weightSpots(3, 3).map(([x, y], i) => (
                      <Weight key={i} x={x + 60} y={y} />
                    ))}
                  </>
                }
                right={weightSpots(11, 5).map(([x, y], i) => (
                  <Weight key={i} x={x} y={y} s={0.9} />
                ))}
              />
            </g>
            <Vignette />
          </g>
        )}
        {page === 2 && (
          <g>
            <Backdrop kind="deep">
              <Stars count={60} />
            </Backdrop>
            <g transform="translate(420 380)">
              <NumberMachine op="+3" running />
            </g>
            <Book x={1180} y={420} diagram />
            <Equation terms={terms('2x + 3 = x + 10')} x={800} y={690} />
            <Title x={800} y={820} size={60}>
              al-jabr: restoring
            </Title>
            <g transform="translate(1440 160) scale(1.2)">
              <Pip2 mood="talking" />
            </g>
            <Glow x={160} y={160} r={120} color="violet" />
          </g>
        )}
        {page === 3 && (
          <g>
            <Backdrop kind="deep">
              <Stars count={60} />
            </Backdrop>
            <BalancePlay key="a" x={800} y={620} value={3} start={{ left: { sacks: 3, weights: 1 }, right: { sacks: 1, weights: 7 } }} active canSplit equation={{ y: 760 }} glow onMove={(b, m) => console.log('move', JSON.stringify(m), JSON.stringify(b))} onSolved={(b) => console.log('solved', JSON.stringify(b))} />
          </g>
        )}
        {(page === 4 || page === 5 || page === 6) && (
          <g>
            <Valley time={page === 4 ? 'day' : page === 5 ? 'dusk' : 'night'} />
            <Pen x={1130} y={GROUND_Y} />
            <Ama x={760} y={GROUND_Y + 40} s={1.1} />
            <Bag x={900} y={GROUND_Y + 50} />
            <Sheep x={300} y={GROUND_Y + 40} />
            <g style={{ ['--walk' as string]: 1 }}>
              <Sheep x={480} y={GROUND_Y + 70} s={1.1} flip />
            </g>
            <Sheep x={1330} y={GROUND_Y + 60} s={0.9} wool={N.sandLight} />
            {[0, 1, 2, 3, 4].map((i) => (
              <Pebble key={i} x={960 + i * 40} y={GROUND_Y + 80} seed={i} />
            ))}
          </g>
        )}
        {page === 7 && (
          <g>
            <Backdrop kind="deep">
              <Stars count={60} />
            </Backdrop>
            <Hand x={200} y={420} fingers={5} />
            <Hand x={400} y={420} fingers={2} flip />
            <Hand x={600} y={420} fingers={0} />
            <Bundle x={800} y={400} />
            <Bundle x={920} y={400} />
            <Stick x={1020} y={400} />
            <Stick x={1050} y={400} />
            <Stick x={1080} y={400} rot={6} />
            <PlaceNumber value={34} x={1300} y={300} />
            <PlaceNumber value={7} x={1300} y={440} size={56} />
            <NumberLine x={160} y={700} from={0} to={40} unit={32} labelEvery={10} />
          </g>
        )}
      </svg>
    </div>
  )
}
