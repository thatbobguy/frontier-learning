import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ---------------------------------------------------------------------------------------- */
/* Chapter 1: Johansson                                                                      */
/* ---------------------------------------------------------------------------------------- */

function JohanssonBody() {
  const T = (t: number) => 60 + t * 500
  const load = (t: number) => (t < 0.2 ? 0 : t < 0.5 ? (t - 0.2) / 0.3 : 1) + (t > 0.62 && t < 0.72 ? 0.5 * Math.sin(((t - 0.62) / 0.1) * Math.PI) : 0)
  const grip = (t: number) => (t < 0.12 ? 0 : t < 0.42 ? ((t - 0.12) / 0.3) * 1.25 : t < 0.68 ? 1.25 : t < 0.74 ? 1.25 + ((t - 0.68) / 0.06) * 0.45 : 1.7 - Math.min(0.4, (t - 0.74) * 2))
  const Y = (v: number) => 210 - v * 80
  const path = (f: (t: number) => number) => Array.from({ length: 101 }, (_, i) => `${i ? 'L' : 'M'}${T(i / 100).toFixed(1)} ${Y(f(i / 100)).toFixed(1)}`).join(' ')
  return (
    <>
      <Lede>What a pair of numbed fingertips reveals about how you hold things, and the simple rule a robot has to copy.</Lede>
      <P>
        In the 1980s and 1990s Roland Johansson’s lab in Umeå, Sweden, ran a set of experiments that every robot-hand engineer eventually meets. Volunteers had their fingertips numbed with a local anaesthetic. They could still see perfectly, their muscles were untouched, and they knew exactly what they were trying to do. Yet ordinary tasks fell apart. Grip forces became too large and badly timed, objects slipped, and picking up a match and striking it turned into a slow, clumsy struggle.
      </P>
      <Note title="A number to treat with care">
        You’ll often see the match task quoted as about 7 seconds normally and about 25 to 30 seconds with numbed fingers. The film uses those figures, but we could not confirm them in a written source (they come from descriptions of a lab video). The direction of the result is solid; the exact seconds are not.
      </Note>
      <H>Grip just above slip</H>
      <P>
        Hold a glass between finger and thumb. Gravity pulls it down with a force equal to its weight, the <em>load force</em>. The only thing stopping it is friction at your two fingertips, and friction is limited: at each contact it can be at most the coefficient of friction μ times how hard you squeeze. With two contacts that gives the rule:
      </P>
      <Formula tex="F_grip ≥ F_load / (2μ)">
        F_grip is how hard you squeeze, F_load is the weight plus any extra pull from accelerating the object, μ is the friction coefficient between skin and object (roughly 0.4 to 1 for skin; lower when wet or greasy).
      </Formula>
      <P>
        Squeeze less than that and the object slides. Squeeze much more and you waste effort, tire faster, and crush anything fragile. Johansson and his colleague Randall Flanagan found that people sit remarkably close to the line: we grip only about <strong>10 to 40%</strong> harder than the minimum needed, and we keep adjusting that margin to the surface. Sandpaper gets a lighter grip than silk, because silk has a lower μ.
      </P>
      <P>
        The clever part is how grip and load move together. When you lift, the load force rises, and your grip force rises in step, at the same moment, not after a delay. Your brain predicts the load from experience. Touch then checks the prediction: the first contact tells you how slippery the surface is, and a tiny slip anywhere on the fingertip triggers a correction.
      </P>
      <Figure caption="Lifting and then bumping a glass (illustrative shape, not measured data). Grip (amber) tracks the load and stays a little above the slip line (dashed). When a knock starts a slip, grip jumps about 100 ms later.">
        <svg viewBox="0 0 600 260" role="img" aria-label="A graph of grip force rising with load force, staying above a dashed slip line, and jumping after a slip.">
          <rect width={600} height={260} fill={C.ink1} />
          <line x1={60} y1={210} x2={570} y2={210} stroke={C.fog} />
          <line x1={60} y1={210} x2={60} y2={30} stroke={C.fog} />
          <rect x={T(0.69)} y={30} width={T(0.74) - T(0.69)} height={180} fill={C.magenta} opacity={0.15} />
          <path d={path(load)} fill="none" stroke={C.mist} strokeWidth={2} strokeDasharray="6 5" />
          <path d={path(grip)} fill="none" stroke={C.amber} strokeWidth={3} />
          <text x={T(0.3)} y={60} fill={C.amberLight} fontSize={14}>grip force</text>
          <text x={T(0.3) + 10} y={Y(0.6) + 24} fill={C.mist} fontSize={14}>slip line (load ÷ 2μ)</text>
          <text x={T(0.66)} y={46} fill={C.magentaLight} fontSize={13}>slip! → ~100 ms → grip up</text>
          <text x={315} y={245} fill={C.mist} fontSize={13} textAnchor="middle">time (about 1 second) →</text>
        </svg>
      </Figure>
      <H>The hundred-millisecond reflex</H>
      <P>
        When something does slip, the correction is fast. Grip force starts to rise roughly <strong>100 milliseconds</strong> after the slip begins. That is quicker than a conscious reaction, and it is driven by touch alone: the fast-adapting receptors in the fingertip skin notice the tiny vibrations and stretch of a starting slip and fire a burst of signals. The spinal cord and brainstem turn that burst into extra squeeze before you have even noticed anything happened.
      </P>
      <P>
        Each fingertip carries about <strong>2,000 touch nerve fibres</strong>, packed about a millimetre apart. That density is what lets you feel a slip begin at one edge of the contact while the rest of the fingertip is still stuck.
      </P>
      <H>Why the eyes can’t take over</H>
      <P>
        The numbed volunteers could watch their fingers the whole time, so why didn’t vision rescue them? Because at the moment of contact the hand hides the very thing you need to see. The contact patch is underneath the fingertip. Friction, pressure and the first few hundred micrometres of slip are invisible from the outside. Vision is excellent for reaching and lining up; it is almost useless for the contact phase.
      </P>
      <P>
        Robots hit the same wall. A camera on the robot’s head sees the back of its hand as the fingers close. Without touch, a robot has two bad options: squeeze hard just in case (and crush the egg), or squeeze gently and hope (and drop the glass). Touch sensing is what lets a robot do what you do: ride just above the slip line.
      </P>
      <Numbers
        items={[
          ['10–40%', 'how much harder than the minimum people grip'],
          ['~100 ms', 'from slip to extra grip, driven by touch'],
          ['~2,000', 'touch nerve fibres per fingertip'],
          ['~17,000', 'touch units in the hairless skin of one hand'],
        ]}
      />
      <Think q="A robot hand lifts a 200 g mug with two fingertips, μ = 0.5. What is the least it must squeeze, and what would a human-like margin add?">
        The load is about 0.2 × 9.81 ≈ 2 N. Minimum grip = 2 / (2 × 0.5) = 2 N. A 10 to 40% margin gives about 2.2 to 2.8 N. Accelerating the mug upward raises the load, so the grip has to rise with it, which is exactly what your hand does automatically.
      </Think>
      <Sources
        items={[
          ['Johansson & Flanagan (2009), Coding and use of tactile signals from the fingertips in object manipulation tasks, Nature Reviews Neuroscience', 'https://www.nature.com/articles/nrn2621'],
          ['Johansson & Flanagan, chapter summary (Stanford CS114 reading)', 'https://web.stanford.edu/class/cs114/readings/MK-Johansson.pdf'],
          ['Johansson & Vallbo (1983), Tactile sensory coding in the glabrous skin of the human hand', 'https://www.cns.nyu.edu/~david/courses/sm12/Readings/Johansson1983.pdf'],
          ['Video: matches experiment with anaesthesia, Roland Johansson', 'https://www.youtube.com/watch?v=1UbhIkDkUoc'],
        ]}
      />
    </>
  )
}

/* ---------------------------------------------------------------------------------------- */
/* Chapter 2: proprioception                                                                  */
/* ---------------------------------------------------------------------------------------- */

function ProprioBody() {
  return (
    <>
      <Lede>Before a robot can feel the world, it needs to feel itself: where every joint is and how hard every finger is pushing.</Lede>
      <P>
        Close your eyes and touch your nose. You can do it because sensors in your muscles, tendons and joints report the position and effort of every part of your arm, a sense called <em>proprioception</em>. Robot hands need the same thing, and engineers have several ways to provide it. Each answers a slightly different question, and each has a blind spot.
      </P>
      <Figure caption="Where a robot finger’s self-sensing can live. Each sensor sees a different part of the chain from motor to fingertip.">
        <svg viewBox="0 0 600 240" role="img" aria-label="A diagram of a motor, gearbox, tendon and finger joint, with an encoder on the motor, a tendon force sensor, a Hall sensor at the joint and a camera in the palm.">
          <rect width={600} height={240} fill={C.ink1} />
          <rect x={30} y={90} width={90} height={60} rx={8} fill={C.ink3} stroke={C.cyan} />
          <text x={75} y={125} fill={C.cyanLight} fontSize={13} textAnchor="middle">motor</text>
          <circle cx={30} cy={120} r={16} fill="none" stroke={C.lime} strokeWidth={3} />
          <text x={30} y={80} fill={C.limeLight} fontSize={12} textAnchor="middle">encoder</text>
          <rect x={130} y={98} width={60} height={44} rx={6} fill={C.ink3} stroke={C.fog} />
          <text x={160} y={125} fill={C.mist} fontSize={12} textAnchor="middle">gears</text>
          <path d="M190 120 H400" stroke={C.cyan} strokeWidth={3} />
          <rect x={260} y={108} width={40} height={24} rx={4} fill="none" stroke={C.lime} strokeWidth={2} />
          <text x={280} y={160} fill={C.limeLight} fontSize={12} textAnchor="middle">tendon force</text>
          <rect x={400} y={100} width={90} height={40} rx={18} fill={C.shell} />
          <circle cx={495} cy={120} r={12} fill={C.carbon} />
          <path d="M505 120 L570 70" stroke={C.shell} strokeWidth={30} strokeLinecap="round" />
          <circle cx={495} cy={120} r={22} fill="none" stroke={C.lime} strokeWidth={2} strokeDasharray="4 3" />
          <text x={495} y={170} fill={C.limeLight} fontSize={12} textAnchor="middle">Hall sensor at joint</text>
          <text x={300} y={210} fill={C.fog} fontSize={12} textAnchor="middle">backlash, stretch and friction sit between the motor and the joint</text>
        </svg>
      </Figure>
      <H>Encoders: precise, but on the wrong side</H>
      <P>
        Almost every robot motor has an <strong>encoder</strong>, a sensor that counts how far the shaft has turned, often to a tiny fraction of a degree. The catch is that it measures the <em>motor</em>, not the finger. Between them sit a gearbox with a little slack (backlash), and often a tendon that stretches under load. So the motor can report “joint at 40°” while the real finger sits at 37° because something is pushing on it.
      </P>
      <H>Joint sensors: measuring the finger itself</H>
      <P>
        The fix is to put a sensor right at the joint. The usual trick is a tiny magnet on one bone and a Hall-effect chip on the other: as the joint bends, the magnetic field at the chip changes, and that maps to an angle. The Shadow Dexterous Hand reads its joints this way at <strong>1,000 times a second</strong> with about <strong>0.2°</strong> resolution. Some newer hands, such as Wuji’s, put an encoder on both the motor side and the joint side of every gearbox, so the difference between them shows how much the transmission is twisting.
      </P>
      <H>Sensing force: listen to the motor, or measure the tendon</H>
      <P>A motor’s torque is proportional to its current, so in principle the current tells you how hard the finger pushes:</P>
      <Formula tex="τ_joint ≈ η · N · K_t · I − τ_friction">
        τ_joint is the joint torque, η the gearbox efficiency, N the gear ratio, K_t the motor’s torque constant, I the current, τ_friction the friction in the drive.
      </Formula>
      <P>
        That works when the gear ratio is low (about 5:1 to 15:1) and friction is small, so the drive is <em>backdrivable</em>: a push on the fingertip turns the motor backwards and shows up as a clean change in current. 1X chose such low ratios for its hand for exactly this “force transparency”. At high ratios (50:1 and above), friction grows with N and swamps the signal. A light touch disappears into the noise. This is the callback to film 3: the same gearbox that makes a tiny motor strong also makes it numb.
      </P>
      <P>
        The alternative is to measure force directly. The Shadow Hand senses the load in each tendon pair to about <strong>30 mN</strong> at 500 times a second, with an internal torque loop at 5 kHz. Shadow’s DEX-EE has five tendon force sensors per finger and closes its local force loop at <strong>10 kHz</strong>. Inspire builds a force sensor into each linear actuator with about <strong>0.5 N</strong> resolution.
      </P>
      <Table
        rows={[
          ['Sensor', 'Tells you', 'Blind spot'],
          ['Motor encoder', 'Motor angle, very precisely', 'Backlash and tendon stretch hide the real joint angle'],
          ['Joint Hall sensor', 'Joint angle (Shadow: 0.2°, 1 kHz)', 'Nothing about force or contact'],
          ['Motor current', 'Force, cheaply', 'Only works with low gear ratios and low friction'],
          ['Tendon / actuator force sensor', 'Force along the drive (Shadow: ~30 mN)', 'Not where the contact is, or whether it slips'],
          ['Palm camera', 'What is under or inside the hand', 'Blocked once the fingers close'],
        ]}
      />
      <H>Cameras in the palm</H>
      <P>
        Figure 03 and the 2025 electric Atlas hand both put cameras in the palm, to see what the head cameras can’t: the inside of a cabinet, the object under the hand during the approach. That helps with the last few centimetres. Once the fingers wrap around the object, though, even a palm camera is staring at the inside of a fist.
      </P>
      <H>What all of this still misses</H>
      <P>
        Joint angles and joint torques describe the hand, not the contact. When a fingertip touches an egg, the joint angles change by a fraction of a degree, and the torque change is buried in friction. None of these sensors can say <em>where</em> on the fingertip the contact is, whether it is starting to slide, or how soft the object is. For that you need skin, the subject of the next chapter.
      </P>
      <Numbers
        items={[
          ['0.2° at 1 kHz', 'Shadow Hand joint sensing'],
          ['~30 mN', 'Shadow tendon force resolution'],
          ['10 kHz', 'DEX-EE local force loop'],
          ['5–15:1', 'gear ratios low enough to sense force from current'],
        ]}
      />
      <Sources
        items={[
          ['Shadow Dexterous Hand E technical specification', 'https://shadowrobot.com/wp-content/uploads/2025/09/shadow_dexterous_hand_e_technical_specification.pdf'],
          ['Wuji Hand product page (dual encoders)', 'https://www.mybotshop.de/Wuji-Robotic-Hand-v10_1'],
          ['Gear ratio, backdrivability and current sensing (humanoid.guide)', 'https://humanoid.guide/?p=17946'],
          ['DEX-EE (IEEE Robots Guide)', 'https://robotsguide.com/robots/dexee'],
          ['1X NEO hand: low gear ratios for force transparency', 'https://roboticsandautomationnews.com/2026/07/17/1x-unveils-25-degree-of-freedom-humanoid-robot-hands-for-neo/103405/'],
          ['Inspire RH56DFX (actuator force sensors)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Introducing Figure 03 (palm cameras)', 'https://www.figure.ai/news/introducing-figure-03'],
        ]}
      />
    </>
  )
}

/* ---------------------------------------------------------------------------------------- */
/* Chapter 3: tactile technologies                                                            */
/* ---------------------------------------------------------------------------------------- */

function TactileBody() {
  const cell = (x: number, y: number, name: string, what: string, color: string) => (
    <g>
      <rect x={x} y={y} width={230} height={80} rx={8} fill={C.ink2} stroke={color} />
      <text x={x + 115} y={y + 34} fill={color} fontSize={15} textAnchor="middle" fontWeight={600}>
        {name}
      </text>
      <text x={x + 115} y={y + 58} fill={C.mist} fontSize={12} textAnchor="middle">
        {what}
      </text>
    </g>
  )
  return (
    <>
      <Lede>Your fingertip runs four kinds of touch sensor at once. Robot skin copies them with very different tricks, and every trick gives something up.</Lede>
      <H>The four channels in your skin</H>
      <P>
        Touch nerve fibres come in two speeds and two sizes. <em>Slow-adapting</em> ones keep firing as long as something presses; <em>fast-adapting</em> ones fire only when something changes. <em>Small-field</em> ones sit near the surface and report fine detail; <em>large-field</em> ones sit deeper and feel broad patterns. Two speeds times two sizes gives four channels.
      </P>
      <Figure caption="Biology splits touch by speed and by size. A robot that senses only steady pressure at 30 Hz is missing the whole fast column.">
        <svg viewBox="0 0 600 240" role="img" aria-label="A 2 by 2 grid: Merkel and Meissner in the small-field row, Ruffini and Pacinian in the large-field row; slow-adapting on the left, fast-adapting on the right.">
          <rect width={600} height={240} fill={C.ink1} />
          <text x={190} y={24} fill={C.mist} fontSize={13} textAnchor="middle">slow: keeps firing</text>
          <text x={440} y={24} fill={C.mist} fontSize={13} textAnchor="middle">fast: fires on change</text>
          <text x={36} y={80} fill={C.mist} fontSize={13} textAnchor="middle" transform="rotate(-90 36 80)">small field</text>
          <text x={36} y={180} fill={C.mist} fontSize={13} textAnchor="middle" transform="rotate(-90 36 180)">large field</text>
          {cell(75, 38, 'Merkel (SA I)', 'pressure, edges, shape', C.magentaLight)}
          {cell(325, 38, 'Meissner (FA I)', 'slip onset, light flutter', C.magentaLight)}
          {cell(75, 138, 'Ruffini (SA II)', 'skin stretch, shear', C.magentaLight)}
          {cell(325, 138, 'Pacinian (FA II)', 'vibration, ~250 Hz peak', C.magentaLight)}
        </svg>
      </Figure>
      <P>
        Your fingertip packs these at about a millimetre apart, roughly 2,000 fibres per fingertip. The fast ones are what catch the first hint of slip, which is why they matter so much for grip.
      </P>
      <H>Five ways to build robot skin</H>
      <Table
        rows={[
          ['Technology', 'How it works', 'Good at', 'Gives up'],
          ['Resistive', 'Squishy conductive layer; resistance drops under pressure', 'Cheap, covers big areas, 100 Hz to 1 kHz', 'Usually no shear; drifts, creeps and wears'],
          ['Capacitive', 'Pressure shrinks the gap between electrodes', 'Sensitive, about 1 kHz; some read 3-axis force', 'Electrical noise, temperature and humidity'],
          ['Piezoelectric', 'Bending a film makes a voltage', 'Vibration and slip, kHz rates, cheap', 'Can’t feel a steady push (the charge leaks away)'],
          ['Magnetic', 'A magnetised rubber skin moves over a magnetometer chip', 'Feels shear, 100 to 400 Hz, few wires, skin swaps out', 'Stray magnetic fields from motors and tools'],
          ['Camera (vision-based)', 'A camera films the inside of a soft coated gel', 'Detail finer than a human fingertip', 'Slow (about 25 to 60 frames a second), bulky, gel tears'],
          ['Barometric', 'Tiny air-pressure chips cast in rubber', 'Very cheap (chips about $1), robust', 'No shear; coarse'],
        ]}
      />
      <Note title="How sure are these rows?">
        The magnetic, camera and barometric rows come from the papers and product pages listed below. The resistive and piezo rows are standard engineering background rather than a single measured source, and the rates in them are typical ranges.
      </Note>
      <H>The magnetic skins</H>
      <P>
        Meta’s <strong>ReSkin</strong> (2021) is a 2 to 3 mm rubber skin full of magnetic particles over a small board of magnetometers. It locates a touch to about 1 mm, reads up to 400 times a second, survives more than 50,000 contacts and costs under $30. Its successor <strong>AnySkin</strong> (2024) is designed to be swapped: the skin pulls off and a new one clicks on in about <strong>12 seconds</strong>, and it detected slip on unseen objects 92% of the time. XELA’s <strong>uSkin</strong> sells 3-axis magnetic taxels, for example 30 three-axis points in one fingertip.
      </P>
      <H>The camera skins</H>
      <P>
        A <strong>GelSight</strong> sensor is a tiny camera looking up into a soft gel with a reflective coating. Press a key into it and the camera sees every tooth, finer than your own fingertip can resolve. The GelSight Mini launched at about $499. Meta’s <strong>Digit 360</strong> (2024, made by GelSight) adds vibration and heat sensing and is advertised with “8 million taxels”. Those are camera pixels on a curved gel, not 8 million separate wired sensors, which is why the number looks so out of line with everything else. The weakness of every camera skin is speed and size: a camera typically looks 25 to 60 times a second, too slow to catch the first millisecond of a slip, and it needs room to focus.
      </P>
      <H>What real hands carry</H>
      <List
        items={[
          <>
            <strong>Figure 03</strong> (2025): in-house fingertip sensors that detect about <strong>3 g</strong>, the weight of a paperclip.
          </>,
          <>
            <strong>Sharpa Wave</strong> (2026): more than <strong>1,000 sensing points per fingertip</strong>, up to 180 times a second.
          </>,
          <>
            <strong>Shadow tactile fingertips</strong>: 17 three-axis taxels per tip, read 1,000 times a second.
          </>,
          <>
            <strong>Unitree Dex5-1P</strong>: 94 force and temperature sensors over palm and fingers, 10 g to 2.5 kg range.
          </>,
          <>
            <strong>TakkTile</strong> (barometric): about 1 g sensitivity, survives a 25 lb crush, chips about $1 each.
          </>,
        ]}
      />
      <P>
        These are mostly company figures, so treat them as claims rather than independent measurements. Many cheaper hands still have little or no touch sensing at all.
      </P>
      <Think q="Why do the best hands mix several skin types instead of choosing the single best one?">
        Because the channels you need don’t fit in one technology. A camera skin has the detail but misses fast slip; a piezo film catches slip but can’t hold a steady reading; a resistive grid is cheap enough for a whole palm but drifts. Your own skin solves this with four receptor types side by side, and robot fingertips are starting to do the same.
      </Think>
      <Sources
        items={[
          ['ReSkin (Bhirangi et al., 2021)', 'https://ar5iv.labs.arxiv.org/html/2111.00071'],
          ['AnySkin (Bhirangi et al., 2024)', 'https://arxiv.org/html/2409.08276v2'],
          ['XELA uSkin fingertips', 'https://www.automation.com/article/xela-robotics-robotic-fingertips-new-tactile-sensor-capabilities'],
          ['GelSight Mini launch', 'https://www.eenewseurope.com/en/human-resolution-tactile-sensor-for-engineers-scientists'],
          ['Meta FAIR: Digit 360 and Digit Plexus', 'https://ai.meta.com/blog/fair-robotics-open-source/'],
          ['TakkTile sensors (Soft Robotics Toolkit)', 'https://softroboticstoolkit.com/book/takktile-sensors'],
          ['Introducing Figure 03', 'https://www.figure.ai/news/introducing-figure-03'],
          ['Sharpa Wave at CES 2026', 'https://mikekalil.com/blog/sharpa-north-ces-2026/'],
          ['Unitree Dex5-1P', 'https://www.robotics247.com/article/unitree-releases-new-dex5-1-humanoid-robot-hand/news'],
          ['Johansson & Vallbo (1983), receptor densities', 'https://www.cns.nyu.edu/~david/courses/sm12/Readings/Johansson1983.pdf'],
        ]}
      />
    </>
  )
}

/* ---------------------------------------------------------------------------------------- */
/* Chapter 4: open problems                                                                   */
/* ---------------------------------------------------------------------------------------- */

function SkinBody() {
  // log-scale bars, 10^3 .. 10^6
  const X = (v: number) => 200 + ((Math.log10(v) - 3) / 3) * 370
  const bars: [string, number, number, string][] = [
    ['ORCA skin wore out', 2000, 4000, C.magenta],
    ['ORCA wires snapped', 4500, 7000, C.danger],
    ['Industrial target', 300000, 300000, C.lime],
    ['Warehouse: ~1 month', 9000 * 30, 9000 * 30, C.gold],
  ]
  return (
    <>
      <Lede>Robots that feel are possible today. Robots that keep feeling, cheaply, after a year of work are not yet. Here is why.</Lede>
      <P>
        Touch sensors have improved fast, so why do most robot hands still have little or none? Because skin has a job no other part of the hand has: it is the layer that actually rubs, presses and scrapes against the world. Every problem below follows from that.
      </P>
      <H>1. Skin is the wear surface</H>
      <P>
        Gears and motors are hidden inside. The skin is on the outside, taking every scrape. The open-source <strong>ORCA</strong> hand from ETH Zurich (2025) reported that its silicone fingertip skin degraded after about <strong>2,000 to 4,000 cycles</strong>, and its touch sensitivity fell with it. That sounds like a lot until you compare it with real work.
      </P>
      <Figure caption="Cycles before failure, on a log scale. Research-hand skin and wiring wear out about a hundred times sooner than an industrial hand needs to last. A warehouse hand gripping about 9,000 times a day does 270,000 grips a month.">
        <svg viewBox="0 0 600 220" role="img" aria-label="A bar chart on a log scale: ORCA skin 2,000 to 4,000 cycles, ORCA wires 4,500 to 7,000, industrial target 300,000, a warehouse month about 270,000.">
          <rect width={600} height={220} fill={C.ink1} />
          {[1e3, 1e4, 1e5, 1e6].map((v) => (
            <g key={v}>
              <line x1={X(v)} y1={20} x2={X(v)} y2={180} stroke={C.fog} opacity={0.4} />
              <text x={X(v)} y={200} fill={C.mist} fontSize={12} textAnchor="middle">
                {v.toLocaleString('en-US')}
              </text>
            </g>
          ))}
          {bars.map(([t, a, b, c], i) => (
            <g key={t}>
              <text x={190} y={45 + i * 38} fill={C.mist} fontSize={13} textAnchor="end">
                {t}
              </text>
              <rect x={200} y={32 + i * 38} width={X(a) - 200} height={18} fill={c} opacity={0.75} />
              {b > a && <rect x={X(a)} y={32 + i * 38} width={X(b) - X(a)} height={18} fill={c} opacity={0.35} />}
            </g>
          ))}
        </svg>
      </Figure>
      <P>
        Industry targets for a working hand are around <strong>300,000 operations</strong> and up. A warehouse humanoid can grip 8,000 to 10,000 times a day, so even a 300,000-cycle hand lasts only a month or two. A skin that fails at a few thousand cycles would last a morning. The practical answer is to make skin a cheap, swappable part, like a tyre, which is exactly what designs such as AnySkin aim for.
      </P>
      <H>2. Wires through moving joints</H>
      <P>
        A thousand sensing points need a way to send their readings back to the computer, and the only route goes through joints that bend thousands of times a day. Metal fatigues when it flexes. ORCA’s thin copper sensor wires snapped after <strong>4,500 to 7,000 cycles</strong> at the knuckle and side-to-side joints. Fixes include flexible circuit boards designed with a safe bend radius, reading many sensors over a single shared bus, and wireless or slip-ring designs, all of which add cost or complexity.
      </P>
      <H>3. Drift</H>
      <P>
        Rubber creeps, electronics warm up, and magnets and gels age. So the same press can read differently in the morning and the afternoon, or after a month of use. Every reading has to be recalibrated against something, and a controller that rides just above the slip line needs to trust its numbers.
      </P>
      <H>4. A new skin reads differently</H>
      <P>
        Even two skins from the same batch differ slightly. That matters because modern robots learn their skills from data. A policy trained on one skin learns that skin’s quirks, and can stumble when the skin is replaced. AnySkin’s authors measured this: after swapping in a fresh skin, a policy kept <strong>87%</strong> of its performance with AnySkin, versus <strong>57%</strong> with the earlier ReSkin. Better manufacturing narrowed the gap but didn’t close it.
      </P>
      <H>5. Almost no data</H>
      <P>
        The big robot datasets, from Open X-Embodiment and DROID to AgiBot World and the huge egocentric video collections, record camera images and joint angles. Almost none record touch. There are good reasons: touch sensors are not standard, so data from one doesn’t transfer to another; a person teleoperating a robot can’t easily pass on what their fingers feel; and simulators render touch poorly.
      </P>
      <P>
        That is starting to change. TacVerse collected about 1,000 hours of touch interactions. NeoData, a September 2026 preprint not yet peer-reviewed, reports more than <strong>30,000 hours</strong> of synchronised video and touch from tactile handheld grippers, 5,000 of them open. Compare that with the hundreds of thousands of hours behind the largest vision-and-motion corpora. And the payoff is real: a 2025 study found policies that used vision plus touch beat vision-only ones on contact-heavy tasks such as lighting a match, the same task that numbed fingers found so hard.
      </P>
      <Numbers
        items={[
          ['2,000–4,000', 'cycles before ORCA’s fingertip skin degraded'],
          ['4,500–7,000', 'cycles before ORCA’s sensor wires snapped'],
          ['87% vs 57%', 'performance kept after a skin swap (AnySkin vs ReSkin)'],
          ['30,000 h', 'NeoData visuo-tactile data (preprint)'],
        ]}
      />
      <Note title="Cost is a problem too">
        The UK company Touchlab argued in 2026 that putting human-density electronic skin everywhere on a robot would make it “prohibitively expensive” today. Expect skin first on fingertips, then palms, and only later on whole hands and arms.
      </Note>
      <Sources
        items={[
          ['ORCA hand (ETH Zurich, 2025): skin wear and wire failures', 'https://arxiv.org/html/2504.04259v1'],
          ['AnySkin (2024): swap-in skins and cross-skin performance', 'https://arxiv.org/html/2409.08276v2'],
          ['Gasgoo WAIC 2026 report on dexterous hands (durability targets, TacVerse)', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Warehouse grip counts and hand lifetimes (iTiger)', 'https://www.itiger.com/news/1123099345'],
          ['NeoData preprint (Sep 2026)', 'https://www.alphaxiv.org/abs/2608.29601'],
          ['Visuotactile imitation learning for match lighting (2025)', 'https://arxiv.org/abs/2504.13618'],
          ['Touchlab on e-skin cost (TechRadar)', 'https://techradar.com/pro/groundbreaking-technology-often-enters-the-market-at-a-premium-before-scaling-touch-sensitive-e-skin-could-soon-be-commonplace-in-robotics'],
        ]}
      />
    </>
  )
}

export const JohanssonReading: Reading = {
  id: 'johansson',
  title: 'Grip, slip and the hundred-millisecond reflex',
  blurb: 'The numbed-fingertip experiments, the friction rule behind every grip, and why eyes can’t replace touch.',
  minutes: 6,
  Body: JohanssonBody,
}
export const ProprioReading: Reading = {
  id: 'proprioception',
  title: 'How a robot knows where its fingers are',
  blurb: 'Encoders, joint sensors, motor current and tendon force: what each one tells a robot, and what it misses.',
  minutes: 6,
  Body: ProprioBody,
}
export const TactileReading: Reading = {
  id: 'tactile-tech',
  title: 'A field guide to robot skin',
  blurb: 'Your four touch channels, the five main ways to build robot skin, and what real hands carry in 2026.',
  minutes: 7,
  Body: TactileBody,
}
export const SkinReading: Reading = {
  id: 'skin-problems',
  title: 'Why robot skin is still unsolved',
  blurb: 'Wear, wiring, drift, swapped skins and missing data: the open problems of robot touch.',
  minutes: 6,
  Body: SkinBody,
}
