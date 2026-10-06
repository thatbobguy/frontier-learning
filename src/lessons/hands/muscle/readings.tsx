import { C, MONO } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1: motor physics                                             */
/* ------------------------------------------------------------------ */

function MotorPhysicsBody() {
  // torque ∝ size³ and heat ∝ torque², drawn as two small plots.
  const cube = Array.from({ length: 41 }, (_, i) => {
    const s = i / 40
    return `${i === 0 ? 'M' : 'L'}${40 + s * 220} ${210 - s * s * s * 170}`
  }).join(' ')
  const sq = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40
    return `${i === 0 ? 'M' : 'L'}${340 + t * 220} ${210 - t * t * 170}`
  }).join(' ')
  return (
    <>
      <Lede>Four equations explain almost everything about why a motor small enough for a finger is too weak for the job, and why squeezing hard makes it hot.</Lede>
      <P>
        Nearly every robot hand sold today is moved by electric motors. They are cheap, precise, easy to control from a computer, and backed by a huge supply chain. But a motor is a device whose strength depends on its size, and a finger is a very small place. To see why that hurts, you only need a handful of relationships.
      </P>
      <H>Torque comes from current</H>
      <Formula tex="τ = K_t × I">
        τ is torque (twisting force, in newton-metres), I is the current through the coil (amps), and K_t is the motor’s torque constant, fixed by its magnets and windings.
      </Formula>
      <P>
        Current in a coil sitting in a magnet’s field feels a sideways push, and around a shaft that push becomes a twist. Double the current, double the torque. The same constant works in reverse: a spinning motor generates a voltage, the back-EMF, equal to K_e × ω, and in SI units K_e equals K_t. That is why a motor run fast needs more voltage, and why a motor can also be used as a generator.
      </P>
      <H>Holding costs heat</H>
      <Formula tex="P_heat = I²R = (τ / K_m)²">K_m = K_t / √R is the motor constant: how much torque you get for a watt of heat in the copper.</Formula>
      <P>
        The current has to push through the coil’s resistance R, and that turns into heat. Because heat goes as the square of current, it goes as the square of torque: <b>double the grip, four times the heat</b>. Worse, a motor holding a squeeze is not moving, so none of that electricity does useful work. It all becomes heat. A hand holding a heavy jug with ordinary geared motors is quietly cooking itself. Sharpa quotes 15 W of static draw for its Wave hand and 180 W at peak: a real thermal budget for something the size of your hand.
      </P>
      <H>Why shrinking a motor hurts so much</H>
      <P>
        A motor’s torque comes from a shear stress σ in the thin air gap between rotor and magnets, acting over the rotor’s surface (2πrL) at the rotor’s radius r:
      </P>
      <Formula tex="τ = 2π σ r² L">At a fixed σ, torque grows with radius squared times length: the cube of the motor’s size.</Formula>
      <P>
        Halve every dimension and torque falls to ½ × ½ × ½ = ⅛. The surface that sheds heat falls only to ¼, which sounds like good news, but the copper cross-section falls too, so the current a small winding can carry without overheating drops, and the achievable σ drops with it. Small motors are thermally limited before they are magnetically limited.
      </P>
      <Figure caption="Left: torque against motor size (both relative to a full-size motor). Right: copper heat against the torque you ask for. Both curves bend the wrong way for a finger.">
        <svg viewBox="0 0 600 250" role="img" aria-label="Two plots. Torque rises with the cube of motor size. Heat rises with the square of torque.">
          <rect width={600} height={250} fill={C.ink1} />
          <line x1={40} y1={210} x2={270} y2={210} stroke={C.fog} />
          <line x1={40} y1={210} x2={40} y2={30} stroke={C.fog} />
          <line x1={340} y1={210} x2={570} y2={210} stroke={C.fog} />
          <line x1={340} y1={210} x2={340} y2={30} stroke={C.fog} />
          <path d={cube} stroke={C.amber} strokeWidth={3} fill="none" />
          <path d={sq} stroke={C.danger} strokeWidth={3} fill="none" />
          <line x1={150} y1={210} x2={150} y2={189} stroke={C.amberLight} strokeDasharray="3 3" />
          <circle cx={150} cy={189} r={5} fill={C.amberLight} />
          <text x={158} y={184} fill={C.amberLight} fontSize={13}>half size → ⅛ torque</text>
          <circle cx={450} cy={168} r={5} fill={C.danger} />
          <circle cx={560} cy={40} r={5} fill={C.danger} />
          <text x={456} y={190} fill={C.danger} fontSize={13}>1× grip</text>
          <text x={470} y={44} fill={C.danger} fontSize={13}>2× grip = 4× heat</text>
          <text x={155} y={238} fill={C.mist} fontSize={13} textAnchor="middle">motor size →</text>
          <text x={455} y={238} fill={C.mist} fontSize={13} textAnchor="middle">torque asked for →</text>
          <text x={46} y={24} fill={C.amber} fontSize={13}>torque</text>
          <text x={346} y={24} fill={C.danger} fontSize={13}>heat</text>
        </svg>
      </Figure>
      <H>Inertia: the flip side</H>
      <P>
        A rotor’s inertia (its resistance to being spun up) goes as mass times radius squared, so as r⁴L. Long, thin rotors start and stop quickly; short, fat “pancake” rotors give more torque but are sluggish. Designers pick the shape for the job, and the choice matters again in the next chapter, when a gearbox multiplies that inertia.
      </P>
      <H>Coreless or brushless?</H>
      <List
        items={[
          <>
            <b>Coreless brushed DC</b>: the rotor is a self-supporting cup of copper with no iron, so it is light, has no cogging, and needs simple electronics. Brushes wear out. Used by Shadow (Maxon motors), DEX-EE, and the micro linear servos in Inspire hands.
          </>,
          <>
            <b>Brushless (BLDC)</b>: no brushes, longer life, and the windings sit on the outside where heat can escape to the housing. Needs position sensors and field-oriented control. Used in the PSYONIC Ability Hand and in Wuji’s per-joint actuators.
          </>,
        ]}
      />
      <H>The gap, in numbers</H>
      <P>
        A motor that fits inside a finger segment is roughly 10 to 15 mm across and gives continuous torque in the range of thousandths of a newton-metre. A fingertip pressing with 10 to 20 N on a lever 50 to 90 mm long needs something like 0.5 to 1.5 N·m at the knuckle. That is a gap of around a hundred times. Something has to close it, and that something is a transmission.
      </P>
      <Numbers
        items={[
          ['⅛', 'torque left when every motor dimension is halved'],
          ['4×', 'heat when you double the torque held'],
          ['~100×', 'gap between finger-sized motor torque and what a fingertip needs'],
          ['15 W', 'Sharpa Wave static power for one hand (180 W peak)'],
        ]}
      />
      <Note title="How sure is the 100× figure?">It is an order-of-magnitude estimate built from typical motor sizes and fingertip forces, not a measurement of a particular motor. Real gaps vary with the motor, the cooling and how long the grip is held. The scaling laws behind it are textbook physics.</Note>
      <Think q="Why does a robot hand get hot holding a cup, even though nothing is moving?">
        Holding still still needs torque, torque needs current, and current through the coil’s resistance makes heat at a rate of I²R. No movement means none of that power becomes work, so all of it becomes heat. Self-locking transmissions avoid this by holding the load mechanically.
      </Think>
      <Sources
        items={[
          ['Electric motor scaling laws and inertia in robot actuators (Mewayz)', 'https://mewayz.com/ay/blog/electric-motor-scaling-laws-and-inertia-in-robot-actuators'],
          ['Shadow Dexterous Hand E technical specification', 'https://shadowrobot.com/wp-content/uploads/2025/09/shadow_dexterous_hand_e_technical_specification.pdf'],
          ['Wuji Hand specification (MYBOTSHOP)', 'https://www.mybotshop.de/Wuji-Robotic-Hand-v10_1'],
          ['Sharpa Wave power figures (CNX Software)', 'https://www.cnx-software.com/2026/06/02/sharpa-wave-high-end-dexterous-robotic-hand-with-22-dof-high-sensitivity-dynamic-tactile-array/'],
          ['PSYONIC Ability Hand (humanoid.guide)', 'https://humanoid.guide/product/ability-hand/'],
        ]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Chapter 2: gearing                                                   */
/* ------------------------------------------------------------------ */

function GearingBody() {
  const bars: [string, number, string][] = [
    ['1:1', 1, '1×'],
    ['5:1', 25, '25×'],
    ['15:1', 225, '225×'],
    ['100:1', 10000, '10,000×'],
    ['300:1', 90000, '90,000×'],
  ]
  return (
    <>
      <Lede>A gearbox trades speed for force. It also changes how the finger feels to the world, and that second effect is what designers argue about.</Lede>
      <P>
        A gearbox of ratio N turns its output once for every N turns of the motor. With efficiency η (the share of power that survives the friction inside), three things change at once:
      </P>
      <Formula tex="τ_out = η·N·τ_motor     ω_out = ω_motor / N     J_reflected = N²·J_rotor">
        Torque goes up by N, speed goes down by N, and the motor’s rotor feels N² times heavier to anything pushing on the output.
      </Formula>
      <P>
        The first two are the bargain everyone expects. The third is the hidden cost. Push on a fingertip and you have to spin the motor’s rotor backwards through the gears, N times faster than the finger moves. The rotor’s inertia shows up multiplied by N². At 100:1 the rotor feels <b>10,000 times</b> heavier than it is. Gear friction is multiplied as well, roughly by N for dry friction and N² for viscous drag.
      </P>
      <Figure caption="How heavy the motor’s rotor feels at the fingertip, for different gear ratios (log scale).">
        <svg viewBox="0 0 600 230" role="img" aria-label="Bar chart of reflected inertia: 1 times at 1 to 1, 25 times at 5 to 1, 225 times at 15 to 1, 10,000 times at 100 to 1, 90,000 times at 300 to 1.">
          <rect width={600} height={230} fill={C.ink1} />
          {bars.map(([lab, v, txt], i) => {
            const h = 20 + (Math.log10(v) / 5) * 150
            const x = 50 + i * 108
            const col = v > 1000 ? C.danger : v > 100 ? C.amberLight : C.cyan
            return (
              <g key={lab}>
                <rect x={x} y={190 - h} width={70} height={h} rx={4} fill={col} opacity={0.85} />
                <text x={x + 35} y={182 - h} fill={col} fontSize={14} textAnchor="middle" fontFamily={MONO}>
                  {txt}
                </text>
                <text x={x + 35} y={212} fill={C.mist} fontSize={14} textAnchor="middle" fontFamily={MONO}>
                  {lab}
                </text>
              </g>
            )
          })}
          <line x1={40} y1={190} x2={580} y2={190} stroke={C.fog} />
        </svg>
      </Figure>
      <H>Low ratio or high ratio?</H>
      <Table
        rows={[
          ['', 'Low (≈5–15:1, “quasi-direct drive”)', 'High (≈50–300:1)'],
          ['Gains', 'Backdrivable; motor current doubles as a force sensor; the rotor recoils on impact instead of teeth breaking; fast', 'Lots of torque from a tiny motor; compact; holds position'],
          ['Loses', 'Needs a bigger, stronger motor; more heat when holding; less static force', 'Feels numb (not backdrivable); impacts land on gear teeth; needs a separate force sensor; slower; friction and backlash complicate control and simulation'],
        ]}
      />
      <H>Kinds of reducer</H>
      <List
        items={[
          <><b>Spur and planetary gearheads</b>: the everyday choice in finger motors. Fairly efficient (often 70–90% for a multi-stage head, a typical rather than verified figure), backdrivable at low ratios, a little backlash. Stages multiply: three 4:1 stages give 64:1.</>,
          <><b>Harmonic (strain-wave) drives</b>: a flexible toothed ring squeezed into an ellipse gives 30–320:1 in one stage with almost no backlash. Common in arm joints, rare inside fingers because of size. Sources disagree on whether Wuji uses them.</>,
          <><b>Worm gears</b>: huge ratio in one stage and self-locking, so they hold a grip at zero power. Inefficient (often under 50%) and impossible to push back, so a knock goes straight into the teeth.</>,
          <><b>Lead screws</b>: turn rotation into straight-line push. Cheap, self-locking at shallow thread angles, roughly 30–50% efficient. The classic micro linear actuator in Inspire-style hands.</>,
          <><b>Ball screws and planetary roller screws</b>: rolling elements instead of sliding threads. About 90% efficient (ball screws) and backdrivable; roller screws carry the most load and shock for their size. Both cost more.</>,
        ]}
      />
      <H>How a screw turns a weak motor into a firm finger</H>
      <Formula tex="F = 2π·η·τ / lead">F is the straight-line push, τ the motor torque, and lead the distance the nut moves per turn.</Formula>
      <P>
        Take a screw with a 1 mm lead and an efficiency of 0.4. One milli-newton-metre of motor torque becomes 2π × 0.4 × 0.001 / 0.001 ≈ <b>2.5 N</b> of push. That is how a tiny coreless motor with a fine screw gives an Inspire RH56 finger 10 to 15 N at the tip, and why those fingers lock in place when the power is cut.
      </P>
      <H>Quasi-direct drive</H>
      <P>
        The alternative school uses a fatter, stronger motor and a single gentle stage of around 6–10:1. MIT’s Cheetah robot made the idea famous: with so little gearing, the motor current is an honest measure of force, good to about 0.25 N, and a hard landing just spins the motor back instead of breaking teeth. In hands, the motor has to live somewhere roomier for this to work. 1X put its NEO hand motors in the forearm and chose about 5:1 to 15:1 for “force transparency”. Boston Dynamics describes the 2026 Atlas hand as having a backdrivable transmission for force regulation. By contrast, the Pisa/IIT SoftHand 2 runs its single tendon through an 86:1 gearbox.
      </P>
      <Numbers
        items={[
          ['10,000×', 'how heavy the rotor feels through a 100:1 gearbox'],
          ['2.5 N', 'push from 1 mN·m on a 1 mm screw at 40% efficiency'],
          ['0.25 N', 'force resolution MIT Cheetah gets from motor current'],
          ['5–15:1', '1X NEO hand gear ratios'],
        ]}
      />
      <Note title="Self-locking is a feature and a bug">A gear that cannot be pushed back holds a grasp for free, which saves heat. The same gear cannot give way when the finger is hit, so the shock has to go somewhere: usually the teeth or the screw. Some designs add a deliberate release, like Wuji’s twist-lock joints that pop apart under a heavy impact.</Note>
      <Think q="Why can a low-ratio motor tell how hard it is pushing, while a high-ratio one can’t?">
        Torque is proportional to current, so in principle current tells you force at the output. But gear friction sits in the way and grows with the ratio. At 8:1 the friction is small compared with the force you want to measure; at 100:1 it swamps it, and you need a separate sensor.
      </Think>
      <Sources
        items={[
          ['Gear ratios, backdrivability and reflected inertia (humanoid.guide)', 'https://humanoid.guide/?p=17946'],
          ['MIT Cheetah actuator design (MIT Biomimetic Robotics Lab)', 'https://biomimetics.mit.edu/research/1a9ba04b-d200-4743-b8fc-bf231f3231f0'],
          ['1X unveils 25-DOF hands for NEO (Robotics & Automation News)', 'https://roboticsandautomationnews.com/2026/07/17/1x-unveils-25-degree-of-freedom-humanoid-robot-hands-for-neo/103405/'],
          ['Inspire RH56DFX (Generation Robots)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Boston Dynamics four-finger Atlas hand (Robotics & Automation News)', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['Wuji Hand (humanoid.guide)', 'https://humanoid.guide/product/wuji-hand/'],
        ]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Chapter 3: tendons                                                   */
/* ------------------------------------------------------------------ */

function TendonsBody() {
  const curve = (mu: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const th = (i / 40) * 4 * Math.PI
      return `${i === 0 ? 'M' : 'L'}${50 + (i / 40) * 500} ${200 - Math.exp(-mu * th) * 170}`
    }).join(' ')
  return (
    <>
      <Lede>Putting the motors in the forearm frees the fingers, but every cable has to bend its way to the fingertip, and every bend costs force.</Lede>
      <P>
        A tendon hand works like a puppet. A motor in the forearm winds in a cable; the cable runs over pulleys or through sleeves (sheaths) past the wrist and anchors on a finger bone. Cable tension times its distance from the joint (the moment arm) gives the joint’s torque. Cables can only pull, so each joint needs a partner to pull it back: a second tendon (an antagonistic pair, two per joint), a return spring, or a clever “N+1” layout where several joints share one extensor. Shadow uses a tendon pair per motor with a force sensor on each pair; Tesla’s Optimus patents show three tendons per finger, some routed in front of the joints and some behind.
      </P>
      <H>The capstan equation</H>
      <Formula tex="T_out = T_in × e^(−μθ)">μ is the friction coefficient between cable and surface, θ the total angle the cable wraps, in radians, added up over every bend.</Formula>
      <P>
        This is the same physics that lets a sailor hold a heavy boat with a rope wrapped around a post. For a robot designer it is bad news, because the loss is exponential in the total wrap. Through a wrist and three finger joints the total can easily reach a full turn (2π radians) or more.
      </P>
      <Table
        rows={[
          ['Friction μ', 'Share of pull reaching the tip after one full turn of wrap'],
          ['0.05 (very slippery)', '73%'],
          ['0.1 (polymer on PTFE, typical)', '53%'],
          ['0.2', '28%'],
        ]}
      />
      <Figure caption="Share of the motor’s pull that survives, against total wrap angle, for three friction values.">
        <svg viewBox="0 0 600 240" role="img" aria-label="Three falling curves: with more wrap angle, less force survives; higher friction falls faster.">
          <rect width={600} height={240} fill={C.ink1} />
          <line x1={50} y1={200} x2={560} y2={200} stroke={C.fog} />
          <line x1={50} y1={200} x2={50} y2={20} stroke={C.fog} />
          <line x1={175} y1={200} x2={175} y2={25} stroke={C.fog} strokeDasharray="3 4" />
          <text x={175} y={218} fill={C.mist} fontSize={12} textAnchor="middle">one turn (2π)</text>
          <text x={550} y={218} fill={C.mist} fontSize={12} textAnchor="end">two turns</text>
          <path d={curve(0.05)} stroke={C.cyanLight} strokeWidth={3} fill="none" />
          <path d={curve(0.1)} stroke={C.cyan} strokeWidth={3} fill="none" />
          <path d={curve(0.2)} stroke={C.cyanDark} strokeWidth={3} fill="none" />
          <text x={480} y={110} fill={C.cyanLight} fontSize={13}>μ = 0.05</text>
          <text x={480} y={160} fill={C.cyan} fontSize={13}>μ = 0.1</text>
          <text x={480} y={190} fill={C.cyanDark} fontSize={13}>μ = 0.2</text>
          <text x={44} y={34} fill={C.mist} fontSize={12} textAnchor="end">100%</text>
        </svg>
      </Figure>
      <P>
        That exponential is why tendon designers fight for straighter paths and fewer bends, and why Tesla patented a wrist “router” that reorders the cables to reduce friction and crosstalk. Remote actuation can still work well when friction is designed for: the 2026 MM-Hand delivers 25 N at the fingertip through a 1 m sheath.
      </P>
      <H>Hysteresis and wrist coupling</H>
      <P>
        Friction always opposes motion, so it helps when the finger opens and hurts when it closes. The same motor position gives a different finger position depending on which way you came from: hysteresis. It changes with the hand’s pose and grows as cables wear. And tendons crossing the wrist change length when the wrist bends, unless they are routed through the wrist’s axis, so bending the wrist leaks into the fingers and the controller must correct for it.
      </P>
      <H>Stretch, creep and wear</H>
      <Formula tex="k = E·A / L">A cable’s stiffness: material stiffness E times cross-section A, divided by length L. Long tendons from the forearm are springy.</Formula>
      <P>
        Springiness adds a little safety, but it delays force and can make fingers oscillate. Polymer tendons such as Dyneema (UHMWPE) also creep: under steady load they slowly lengthen, so the tension you set leaks away and slack appears. Untreated fibre can creep by more than 9%; heat-setting brings it under 1%. ETH Zurich’s ORCA hand answered with automatic calibration and tensioning plus “popping” joints that pop out under overload and snap back, and ran more than 10,000 cycles (about 20 hours) without failure.
      </P>
      <H>Why simulators struggle</H>
      <P>
        All of this is hard to put into a simulator. When OpenAI trained a Shadow Hand to solve a Rubik’s Cube in 2019, the team had to add tendon-and-pulley models and calibrate <b>264</b> simulator parameters before the learned skill transferred to the real hand. Industry voices describe tendon drive as “technically orders of magnitude harder than alternatives but higher performance ceiling”.
      </P>
      <H>Why bother? Weight at the end of the arm</H>
      <P>
        Every gram in the hand is held out at the end of a lever. The shoulder torque just to hold the hand out is m × g × L. A 1.3 kg hand 0.6 m from the shoulder costs about 1.3 × 9.81 × 0.6 ≈ <b>7.7 N·m</b> before it picks anything up. Moving the motors to the forearm shortens that lever for most of the mass.
      </P>
      <Numbers
        items={[
          ['53%', 'pull left after one full turn of wrap at μ = 0.1'],
          ['25 N', 'MM-Hand fingertip force through a 1 m sheath'],
          ['10,000+', 'ORCA hand cycles with auto-tensioning'],
          ['264', 'simulator parameters tuned for Dactyl’s Shadow Hand'],
        ]}
      />
      <Note title="Typical, not measured">The μ = 0.1 for polymer on PTFE is a typical value, not a measurement for any particular hand. Real friction depends on the cable, the surface, the load and wear.</Note>
      <Think q="If friction losses are exponential, why not just use a stronger motor?">
        You can, up to a point, and forearm motors have room to be bigger. But friction also brings hysteresis and wear, which a stronger motor doesn’t fix, and the lost force turns into heat and abrasion in the cable path. Cutting the wrap angle helps all of these at once.
      </Think>
      <Sources
        items={[
          ['The forearm is the new hand (Droids substack)', 'https://droids.substack.com/p/the-forearm-is-the-new-hand-inside'],
          ['ORCA: an open-source, reliable, cost-effective, anthropomorphic robotic hand (arXiv)', 'https://arxiv.org/abs/2504.04259'],
          ['MM-Hand (arXiv)', 'https://arxiv.org/abs/2604.17245'],
          ['Tendon-driven robots (AI Wiki)', 'https://aiwiki.ai/wiki/tendon_driven'],
          ['OpenAI’s Rubik’s Cube, in detail (Alex Irpan)', 'https://www.alexirpan.com/2019/10/29/openai-rubiks.html'],
          ['Dextrous hands: how much longer until they are good enough? (Gasgoo)', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Tesla patents: Optimus V3 hand tendons (Drive Tesla Canada)', 'https://driveteslacanada.ca/news/new-tesla-patents-reveal-optimus-v3-hand-human-muscles-tendons/'],
        ]}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Chapter 4: the camps                                                 */
/* ------------------------------------------------------------------ */

function CampsBody() {
  const col = [C.bone, C.cyan, C.amber]
  return (
    <>
      <Lede>Three ways to get force from a motor to a joint, each with its own trade. Here they are side by side, plus the stranger ideas at the edges and the hybrids that mix them.</Lede>
      <Figure caption="Where the motors sit in each camp. Amber is the motor, cyan the way its force travels to the finger.">
        <svg viewBox="0 0 600 220" role="img" aria-label="Three finger diagrams: linkage with a screw motor in the palm and a rod; tendon with a motor in the forearm and a long cable; direct drive with a motor at every joint.">
          <rect width={600} height={220} fill={C.ink1} />
          {[0, 1, 2].map((i) => {
            const x = 100 + i * 200
            return (
              <g key={i}>
                <rect x={x - 14} y={30} width={28} height={50} rx={10} fill="none" stroke={C.mist} strokeWidth={2} />
                <rect x={x - 14} y={82} width={28} height={40} rx={10} fill="none" stroke={C.mist} strokeWidth={2} />
                <rect x={x - 22} y={124} width={44} height={40} rx={8} fill="none" stroke={C.mist} strokeWidth={2} />
                {i === 0 && (
                  <>
                    <rect x={x - 10} y={140} width={20} height={20} rx={4} fill={C.amber} />
                    <line x1={x + 4} y1={138} x2={x + 6} y2={70} stroke={C.cyan} strokeWidth={4} />
                  </>
                )}
                {i === 1 && (
                  <>
                    <line x1={x + 8} y1={36} x2={x + 8} y2={196} stroke={C.cyan} strokeWidth={3} />
                    <rect x={x - 8} y={190} width={34} height={20} rx={4} fill={C.amber} />
                  </>
                )}
                {i === 2 && [56, 102, 144].map((y) => <rect key={y} x={x - 8} y={y - 8} width={16} height={16} rx={4} fill={C.amber} />)}
                <text x={x} y={22} textAnchor="middle" fill={col[i]} fontSize={14}>
                  {['linkage', 'tendon', 'direct drive'][i]}
                </text>
              </g>
            )
          })}
        </svg>
      </Figure>
      <H>The three main camps</H>
      <Table
        rows={[
          ['', 'Linkage', 'Tendon', 'Direct drive'],
          ['How', 'Tiny motors with screws push rigid rods and four-bar linkages', 'Motors in the forearm pull cables over pulleys and through sheaths', 'A small motor and gearbox inside every joint'],
          ['Examples', 'Inspire RH56, AgiBot OmniHand', 'Shadow, Tesla Optimus, 1X NEO, ORCA', 'Wuji, Unitree Dex5, Linker O30, Atlas (2026)'],
          ['Gains', 'Stiff, precise, no stretch, durable, easy to model and mass-produce; self-locking screw holds a grip at zero power', 'Light, slim fingers; motors away from the hand; natural give; many joints possible', 'Every joint independent; stiff and precise; predictable in simulation; fingers can be swapped'],
          ['Loses', 'One fixed curl per motor; rods take space; can’t give way, so impacts load the screw', 'Friction, hysteresis, stretch, creep and wear; complex routing; hard to simulate and repair', 'Motor mass in the fingers; heat trapped in a small space; wiring through every joint'],
        ]}
      />
      <P>
        The Inspire RH56DFX is the linkage camp’s best-seller: 6 micro linear servos curl 12 joints (two per finger, two for the thumb), it weighs 540 g, gives 10–15 N at the fingertip and holds its grip when the power is off. Listed prices range from about €5,000 at an EU distributor to about $20,000 at a US reseller. At the other end, a Shadow Dexterous Hand with 20 forearm motors and tendon pairs costs roughly $80,000 to $130,000. Wuji’s direct-drive hand puts a brushless actuator in each of 20 joints and sells for around $16,000.
      </P>
      <Note title="“Direct drive” isn’t quite direct">In hand marketing, “direct drive” usually means a motor plus a small gearbox at the joint, not a gearless motor. A truly gearless motor at finger size would be far too weak (see the motor physics reading).</Note>
      <H>At the edges: fluid power and artificial muscles</H>
      <Table
        rows={[
          ['Idea', 'Best numbers', 'Why it isn’t mainstream'],
          ['Sanctuary AI hydraulic valves', '21-DOF hand; miniature valves tested to 2 billion cycles without leaking; claims about ten times the power density of alternatives', 'Pumps, plumbing and seals; the company itself says hydraulics are more finicky and need more maintenance'],
          ['Clone Robotics Myofibers', 'Water-pressurised muscles, 27 DOF, 36 valves, 500 W pump, about 1 kg of force per fibre, 650,000 cycles', 'Needs a pump and fluid; leak risk; noise; valve losses'],
          ['Twisted coiled polymer (TCP)', 'Nylon fishing line that contracts when heated; lifts 100× more than human muscle of the same length and weight; fibre costs about $5/kg', 'Works by heat, so it is slow to cool and inefficient'],
          ['Shape memory alloy', 'High stress per mass, silent, tiny', '1–5% efficient, slow to cool, fatigues'],
          ['HASEL (electrostatic pouches)', 'Fast (20–40+ Hz), self-healing', 'Needs around 10 kV, low force'],
        ]}
      />
      <P>
        Each of these beats an electric motor on something. So far, each also loses on at least one thing that matters for a product: efficiency, speed, safe voltages, controllability, lifetime or ease of manufacture. A motor and gearbox comes with a mature supply chain.
      </P>
      <H>2026: the hybrids</H>
      <P>
        The newest hands stop picking one camp. Joyson’s “Lingxi” mixes direct drive, tendons and linkages and claims to be 30% lighter with two to three times the torque density. Xynova’s Flex 2 combines strong tendons pulled from behind with micro motors in the palm. As one industry analysis put it: “Pure direct drive and pure cable drive... each faces barriers for industrial application. True breakthroughs emerge from fusion.” Meanwhile prices are falling fast: Chinese makers shipped thousands of hands in 2025 (Inspire alone more than 10,000), some prices are heading toward ¥10,000 (about $1,400), and hands still make up 18–25% of a humanoid’s total cost.
      </P>
      <Numbers
        items={[
          ['6 / 12', 'Inspire RH56DFX motors / joints'],
          ['~$16k', 'Wuji direct-drive hand, 20 DOF'],
          ['2 billion', 'cycles Sanctuary says its valves survived'],
          ['18–25%', 'share of a humanoid’s cost that goes on its hands'],
        ]}
      />
      <Note title="Company claims">Cycle counts, power-density claims and the Lingxi figures come from the companies or press coverage, not independent tests. Prices vary widely by seller and region.</Note>
      <Think q="A warehouse robot drops boxes onto a conveyor all day and sometimes bumps them. Which camp would you choose, and what would you worry about?">
        A linkage hand is cheap, durable and holds grips at zero power, but its self-locking screw takes every bump directly, so you’d want some give or a breakaway joint. A tendon or backdrivable direct-drive hand would absorb bumps better but costs more in calibration or heat. There’s no free answer: that’s the point.
      </Think>
      <Sources
        items={[
          ['Dextrous hands: how much longer until they are good enough? (Gasgoo, WAIC 2026)', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Inspire RH56DFX (Generation Robots)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Wuji Hand vs Shadow Hand (RoboticsCenter)', 'https://www.roboticscenter.ai/de/compare/wuji-hand-vs-shadow-hand'],
          ['Sanctuary AI dexterity update (The Robot Report)', 'https://www.therobotreport.com/sanctuary-ai-showing-new-dexterity-with-in-hand-manipulation-skills/'],
          ['Clone demos humanoid hand (Interesting Engineering)', 'https://interestingengineering.com/ai-robotics/clone-demos-creepy-humanoid-hand'],
          ['Strong artificial muscles from fishing line (AAAS)', 'https://www.aaas.org/news/science-strong-artificial-muscles-built-fishing-line-and-sewing-thread'],
          ['The forearm is the new hand (Droids substack)', 'https://droids.substack.com/p/the-forearm-is-the-new-hand-inside'],
        ]}
      />
    </>
  )
}

export const MotorPhysicsReading: Reading = {
  id: 'motor-physics',
  title: 'Motor physics in one page',
  blurb: 'Torque, heat and the cube law: why a motor small enough for a finger is about a hundred times too weak.',
  minutes: 6,
  Body: MotorPhysicsBody,
}
export const GearingReading: Reading = {
  id: 'gearing',
  title: 'Gear ratios, backdrivability and reflected inertia',
  blurb: 'What a gearbox gives, what it hides, and how a screw turns a whisper of torque into a firm grip.',
  minutes: 7,
  Body: GearingBody,
}
export const TendonsReading: Reading = {
  id: 'tendons',
  title: 'Tendons: the capstan equation and its friends',
  blurb: 'Why every bend costs force, why cables stretch and creep, and why tendon hands are hard to simulate.',
  minutes: 7,
  Body: TendonsBody,
}
export const CampsReading: Reading = {
  id: 'camps',
  title: 'The three camps, compared',
  blurb: 'Linkage, tendon and direct drive side by side, plus hydraulics, artificial muscles and the 2026 hybrids.',
  minutes: 7,
  Body: CampsBody,
}
