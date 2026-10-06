import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ---------------------------------------------------------------- 1. control */

function ControlBody() {
  return (
    <>
      <Lede>Three ways to tell a finger what to do, why the obvious one is dangerous the moment it touches something, and what learning asks of the hardware.</Lede>
      <H>Position control: perfect in the air, brutal in contact</H>
      <P>
        The simplest controller commands an angle. A stiff feedback loop measures where the joint is, compares it with where it should be, and pushes until the error is zero. In free air this is ideal: fast, precise, repeatable. Inspire’s linkage hands quote ±0.2 mm repeatability this way.
      </P>
      <P>
        The trouble starts at contact. If the target is 1 mm inside a rigid object, the controller keeps pushing to close that 1 mm. The force it produces is roughly the stiffness of the whole loop times the error, and a stiff loop has a very large stiffness. A small miscalculation in where the object is becomes a large force: a crushed cup, a jammed peg, a stripped gear.
      </P>
      <Formula tex="F ≈ k · e">k is the stiffness of the finger and its controller (N/mm), e the position error (mm). Stiff k plus a small e is still a big F.</Formula>
      <H>Force control and impedance control</H>
      <P>
        The alternative is to command force (or joint torque) directly. That needs either a torque sensor at the joint or a transmission transparent enough that motor current tells you the force, which brings us back to backdrivability.
      </P>
      <P>
        The standard compromise is impedance control, usually credited to Neville Hogan in 1985: don’t command a position or a force, command a relationship between them. The finger behaves like a spring and damper pulled toward a target.
      </P>
      <Formula tex="τ = K (q_d − q) + D (q̇_d − q̇)">τ is joint torque, q the joint angle, q_d the desired angle, K the virtual spring stiffness and D the damping. Low K gives gentle, forgiving contact; high K gives precision but stiffness.</Formula>
      <Figure caption="The same 1 mm error, two stiffnesses. A stiff loop slams into the wall; a soft one leans on it.">
        <svg viewBox="0 0 600 220" role="img" aria-label="Force against position error for a stiff and a soft controller: the stiff line rises steeply, the soft one gently.">
          <rect width={600} height={220} fill={C.ink1} />
          <line x1={70} y1={180} x2={560} y2={180} stroke={C.fog} />
          <line x1={70} y1={180} x2={70} y2={20} stroke={C.fog} />
          <text x={315} y={208} fill={C.mist} fontSize={14} textAnchor="middle">position error into the object (mm) →</text>
          <text x={34} y={100} fill={C.mist} fontSize={14} textAnchor="middle" transform="rotate(-90 34 100)">force →</text>
          <path d="M70 180 L190 24" stroke={C.danger} strokeWidth={3} />
          <text x={196} y={36} fill={C.danger} fontSize={15}>position control (stiff)</text>
          <path d="M70 180 L560 120" stroke={C.lime} strokeWidth={3} />
          <text x={410} y={116} fill={C.lime} fontSize={15}>impedance (soft K)</text>
          <line x1={190} y1={180} x2={190} y2={185} stroke={C.paper} />
          <text x={190} y={198} fill={C.paper} fontSize={12} textAnchor="middle">1 mm</text>
        </svg>
      </Figure>
      <H>Springs on purpose</H>
      <P>
        You can also build softness into the hardware. A series elastic actuator puts a spring between the gearbox and the joint: measure how far the spring stretches and you know the force (F = k·x), and the spring soaks up impacts that would otherwise break gear teeth. The price is lower bandwidth and less precise positioning. Long tendons are springy by nature, so a tendon hand gets some of this for free. Passive compliance, such as soft fingertips, flexures and rolling joints, is “free” robustness with no sensing delay at all; Figure 03 moved to softer fingertips for steadier grasps.
      </P>
      <H>Why backdrivability matters</H>
      <P>A backdrivable joint can be pushed by the outside world. That one property unlocks a lot:</P>
      <List
        items={[
          'force can be estimated from motor current, with no extra sensor;',
          'an impact spins the rotor instead of snapping a tooth;',
          'a person can push the hand away safely;',
          'teleoperation and teaching by hand are easier;',
          'the real hand behaves more like its simulation.',
        ]}
      />
      <P>
        1X’s NEO hand (forearm motors, polymer tendons, gear ratios of roughly 5-15:1) and Boston Dynamics’ October 2026 Atlas hand both list backdrivable, force-controllable joints as a core goal. The counterpoint is real: self-locking hands such as Inspire’s and Wuji’s hold a heavy object with zero power, which saves battery and heat. Neither camp is simply wrong.
      </P>
      <H>Where learning comes in</H>
      <P>
        Today most dexterous behaviour comes from learned policies, trained by reinforcement learning in simulation (OpenAI’s Dactyl, and the LEAP and ORCA hands transferring “zero-shot” from sim to real) or by imitation from human demonstrations (gloves, teleoperation, wearable cameras). The network usually outputs joint targets; a low-level impedance or position loop still runs underneath. Learning puts three demands on hardware:
      </P>
      <List
        items={[
          'Survive clumsy practice. Shadow’s DEX-EE, built with Google DeepMind, was designed to “survive long, harsh training sessions”.',
          'Be simulatable. Direct-drive joints are “more deterministic for Sim2Real”; tendon friction and hysteresis are hard to model. Dactyl needed tendon-pulley models and 264 calibrated simulator parameters.',
          'Be cheap enough to own many. LEAP costs about $2,000; Allegro about $15-16k; a Shadow hand over $100,000.',
        ]}
      />
      <Numbers
        items={[
          ['±0.2 mm', 'Inspire RH56 repeatability under position control'],
          ['5-15:1', '1X NEO finger gear ratios (low, so backdrivable)'],
          ['264', 'simulator parameters calibrated for Dactyl’s Shadow Hand'],
          ['15 min vs 60 min', 'Allegro vs LEAP in LEAP’s repetitive load test'],
        ]}
      />
      <Note title="Caveat">Impedance control’s origin (Hogan, 1985) and the series-elastic description are textbook material that the course’s research notes flag as standard but not re-checked against a primary source.</Note>
      <Think q="Why did the peg in the film go in only with a middle stiffness?">
        Too soft, and the finger sags and wobbles by more than the chamfer can correct, so it misses. Too stiff, and the peg can’t slide sideways when the chamfer pushes on it, so the contact force spikes and it jams. A middle K lets the chamfer steer the peg while the fingertip still aims well enough to land on it.
      </Think>
      <Sources
        items={[
          ['Inspire product selection guide (RH56 specs, hybrid position/force)', 'https://cdn.robotshop.com/rbm/62a1587c-c4cd-47cc-b64f-c077e2ad3775/7/7660deb4-9a9f-4227-a29b-38f4f2100034/ad0450f8_inspire-robots-products-selection-guide-v14-.pdf'],
          ['Figure 03 announcement (softer fingertips)', 'https://www.figure.ai/news/introducing-figure-03'],
          ['1X NEO hands (backdrivable tendon drive)', 'https://roboticsandautomationnews.com/2026/07/17/1x-unveils-25-degree-of-freedom-humanoid-robot-hands-for-neo/103405/'],
          ['Boston Dynamics four-finger Atlas hand (Oct 2026)', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['Backdrivability explainer', 'https://humanoid.guide/?p=17946'],
          ['Shadow DEX-EE', 'https://robotsguide.com/robots/dexee'],
          ['Gasgoo: dexterous hands at WAIC 2026', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['LEAP Hand paper', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['ORCA Hand paper', 'https://arxiv.org/abs/2504.04259'],
          ['Alex Irpan on OpenAI’s Rubik’s Cube hand', 'https://www.alexirpan.com/2019/10/29/openai-rubiks.html'],
        ]}
      />
    </>
  )
}

export const ControlReading: Reading = {
  id: 'control',
  title: 'Position, force and impedance control',
  blurb: 'Why commanding an angle is dangerous in contact, how a virtual spring fixes it, and what learning demands of the hardware.',
  minutes: 6,
  Body: ControlBody,
}

/* ---------------------------------------------------------------- 2. industry map */

function IndustryBody() {
  return (
    <>
      <Lede>Who builds robot hands in 2026, how they make money, and where the volume really is. Many numbers here are company claims or analyst estimates; they are marked as such.</Lede>
      <H>The size of it</H>
      <P>
        In 2025 the world shipped somewhere between 13,000 and 18,000 humanoid robots, about 90% of them from Chinese companies, led by Unitree (about 5,500) and AgiBot (about 5,000). More than 30,000 dexterous hands shipped the same year. Analysts put the hand at roughly 10-20% of a humanoid’s bill of materials; Morgan Stanley’s estimate for Optimus is about 17%. In China the average dexterous hand fell from about RMB 50,000-100,000 to RMB 20,000-35,000 (about $3-5k).
      </P>
      <H>Camp 1: build it all yourself</H>
      <P>
        Tesla, Figure, 1X, Boston Dynamics and Unitree design their hands in-house. Vertical integration buys control of cost, intellectual property and pace: Unitree makes its own core components and reports about 60% gross margin. It is also slow and risky. Tesla paused Optimus production in 2025 with a stockpile of bodies missing hands and forearms, and in 2026 Musk said the patented tendon hand “didn’t actually work” and had been replaced. 1X makes motors, tendons and moulded hands in Hayward, California; Boston Dynamics dropped the little finger on its 2026 Atlas hand to cut cost and failure points.
      </P>
      <H>Camp 2: sell hands to everyone else</H>
      <P>
        China had more than 140 humanoid makers in 2025, most of which cannot build a hand. Merchant suppliers serve them. Inspire (Yinshi) shipped 10,000+ hands in 2025, and supplied 96% of Unitree’s hand purchases in the first three quarters of 2025, a single-source dependency. Linkerbot claims more than 80% of high-DoF hand volume and a $3B valuation (May 2026), with a 6-DoF hand listed at RMB 6,666 (about $930). Sharpa (Singapore) makes the 22-DoF SharpaWave with over 1,000 taxels per fingertip (about $50k, per one report); Wuji sells a 20-DoF hand with motors in every joint for about $16,000; Xynova raised about RMB 1.5bn in under a year.
      </P>
      <H>Camp 3: skip the humanoid</H>
      <P>
        Mimic, an ETH Zurich spin-off, puts a 21-joint tendon hand on an ordinary industrial arm and sells it as a station (about $90k) or as a service ($2-5k a month). Shadow Robot and PSYONIC sit at the research and prosthetics end. And a fourth pattern is spreading across all camps: bundling data with hardware (Linkerbot’s skill library, Xynova’s data ecosystem, Sharpa’s data glove).
      </P>
      <Figure caption="The film’s map, roughly. Placements are judgements from prices, cycle claims and joint counts, not measurements.">
        <svg viewBox="0 0 600 300" role="img" aria-label="A map: dexterity up, cheap and tough to the right. Grippers bottom right, linkage hands middle right, research hands upper left, the top right corner empty.">
          <rect width={600} height={300} fill={C.ink1} />
          <line x1={60} y1={260} x2={570} y2={260} stroke={C.fog} />
          <line x1={60} y1={260} x2={60} y2={20} stroke={C.fog} />
          <text x={560} y={286} fill={C.gold} fontSize={14} textAnchor="end">cheap + tough →</text>
          <text x={30} y={140} fill={C.bone} fontSize={14} textAnchor="middle" transform="rotate(-90 30 140)">dexterous →</text>
          <rect x={470} y={26} width={92} height={60} rx={8} fill="none" stroke={C.gold} strokeDasharray="5 4" />
          <text x={516} y={60} fill={C.goldLight} fontSize={13} textAnchor="middle">nobody, yet</text>
          {(
            [
              ['Robotiq gripper', 470, 245, C.gold],
              ['Inspire · AgiBot', 420, 185, C.gold],
              ['in-house humanoid hands', 340, 140, C.amber],
              ['Wuji · Sharpa', 270, 70, C.gold],
              ['LEAP · ORCA · Aero', 150, 115, C.danger],
              ['Shadow DEX-EE', 90, 55, C.gold],
            ] as const
          ).map(([t, x, y, c]) => (
            <g key={t}>
              <circle cx={x} cy={y} r={6} fill={c} />
              <text x={x + 10} y={y + 5} fill={c} fontSize={13}>
                {t}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <H>Where the hands are made</H>
      <P>
        Production clusters in a few Chinese regions. Beijing’s Yizhuang district has about 300 robotics companies (Linkerbot, Inspire); Suzhou’s Wuzhong district more than 1,000 robotics firms; the Shanghai-Hangzhou corridor hosts AgiBot, Unitree and Xynova; Ningbo and Xinchang make screws and reducers; Shenzhen has 70+ humanoid supply-chain firms. A national RMB 100bn venture fund launched in December 2025. Morgan Stanley estimates an Optimus bill of materials at about $46,000 with Chinese suppliers and about $131,000 without them.
      </P>
      <Table
        rows={[
          ['Hand', 'Joints / motors', 'Price (approx.)'],
          ['Inspire RH56', '12 joints / 6 motors, linkage + screw', '$4,500-10,000 (one US listing ~$20k)'],
          ['Linkerbot O6', '6 DoF', 'RMB 6,666 (~$930)'],
          ['Unitree Dex5-S', '22 DoF, gear drive', 'from $6,500'],
          ['Wuji', '20 DoF, motors in joints', '~$16,000'],
          ['SharpaWave', '22 DoF, 1,000+ taxels per tip', '~$50,000 (press report)'],
          ['Shadow Dexterous Hand', '20 motors, tendons', '>$100,000'],
          ['LEAP / Aero Hand Open', '16 / 7 motors, printed', '~$2,000 / ~$720'],
        ]}
      />
      <Note title="Treat with care">Volumes, valuations and cycle counts come mostly from company statements, trade press and sell-side research. Linkerbot’s 80% share, Sharpa’s price and the Tesla production figures are single-source; Inspire prices vary fourfold between distributors.</Note>
      <Numbers
        items={[
          ['30,000+', 'dexterous hands shipped worldwide in 2025'],
          ['140+', 'Chinese humanoid makers in 2025'],
          ['~17%', 'hand share of Optimus bill of materials (Morgan Stanley)'],
          ['$46k vs $131k', 'Optimus BOM with vs without Chinese suppliers'],
        ]}
      />
      <Think q="Why would a hand supplier want to sell data as well as hardware?">
        A hand is only useful if a robot can learn to use it, and policies trained on one hand often fail on another. A supplier that ships the hand together with a library of learned skills and a way to collect more data is harder to replace with a cheaper hand next year.
      </Think>
      <Sources
        items={[
          ['China humanoid supply chain report 2026', 'https://faxiangongchang.com/en/reports/china-humanoid-robot-supply-chain-2026'],
          ['Gasgoo: dexterous hands mass-production race', 'https://autonews.gasgoo.com/articles/market-industry/from-prototypes-to-production-dexterous-hands-kick-off-a-mass-production-race-2016425582734970881'],
          ['ITES China: hand prices and BOM share', 'https://global.iteschina.com/en/news/details/2994'],
          ['Morgan Stanley BOM figures (via CloudNews)', 'https://cloudnews.tech/teslas-optimus-chain-looks-to-the-u-s-but-remains-tied-to-chinese-suppliers/'],
          ['Rest of World: Unitree IPO', 'https://restofworld.org/2026/unitree-china-humanoid-robot-shanghai-ipo/'],
          ['TechSpot: Optimus production pause', 'https://www.techspot.com/news/109781-tesla-temporarily-halts-mass-production-optimus-robots-citing.html'],
          ['The Next Web: Linkerbot valuation', 'https://thenextweb.com/news/linkerbot-china-robot-hand-6-billion-valuation'],
          ['Sacra: Mimic', 'https://sacra.com/c/mimic-robotics'],
          ['Inspire Robotics overview', 'https://aiwiki.ai/wiki/inspire_robotics'],
          ['Wuji Hand listing', 'https://humanoid.guide/product/wuji-hand/'],
          ['Unitree Dex5-S launch', 'https://hermes-ai.net/news/unitree-s-dex5-s-brings-a-22-dof-robotic-hand-to-developers-for-6-500/'],
          ['Xynova funding', 'https://ionanalytics.com/insights/mergermarket/xynova-seeks-fresh-funding-as-it-aims-to-become-the-nvidia-of-dexterous-manipulation/'],
        ]}
      />
    </>
  )
}

export const IndustryReading: Reading = {
  id: 'industry-map',
  title: 'The robot hand industry in 2026',
  blurb: 'Builders, suppliers and hand-on-an-arm startups: who makes what, at what price, and where.',
  minutes: 7,
  Body: IndustryBody,
}

/* ---------------------------------------------------------------- 3. design guide */

function DesignBody() {
  return (
    <>
      <Lede>A walk through sketching a hand the way the design lab does it, with the arithmetic from earlier films, and where to start if you want to build a real one.</Lede>
      <H>1. Start from the job, not the hand</H>
      <P>
        Write down what the customer grips, how often, how heavy, and what a failure costs. A warehouse picks totes about 8,000-10,000 times a day; a home robot maybe a thousand times, around people; a research lab cares about in-hand manipulation and data. Boston Dynamics picked its finger count by taping staff’s ring and little fingers together for a day and seeing what they lost.
      </P>
      <H>2. Fingers and motors</H>
      <P>
        Count the motors you actually need, not the joints. Coupling two joints to one motor (a linkage or a shared tendon) keeps the hand cheap and robust: Inspire curls 12 joints with 6 motors. Every extra motor adds cost, weight, heat and something to break, and series reliability punishes part count: seventy parts each 99.9% reliable give a system only about 93% reliable.
      </P>
      <Formula tex="R_hand = R₁ × R₂ × … × Rₙ">If every part has the same reliability R, the hand’s reliability is Rⁿ, so 0.999⁷⁰ ≈ 0.93.</Formula>
      <H>3. Where the motors live, and how force gets out</H>
      <P>
        Motors in the hand make a self-contained, bolt-on module that is easy to simulate, but force tiny motors into high gear ratios (weak, hot, self-locking). Motors in the forearm can be bigger and backdrivable, and they move mass toward the elbow, but tendons lose force to friction at every bend:
      </P>
      <Formula tex="T_out = T_in · e^(−μθ)">μ is the friction coefficient, θ the total wrap angle in radians. With μ = 0.1 and θ = 2π, only about 53% of the pull reaches the fingertip.</Formula>
      <P>Weight at the end of the arm is paid at the shoulder:</P>
      <Formula tex="τ_shoulder = m · g · L">A 1.3 kg hand held 0.6 m out costs about 7.7 N·m before it picks anything up.</Formula>
      <H>4. Touch</H>
      <P>
        Pads (a few force sensors) are cheap and tough. Dense arrays and camera-based gel tips give the rich data a learning lab wants, but the skin is the wear surface: ORCA’s silicone fingertips degraded after 2,000-4,000 cycles. Magnetic skins like AnySkin can be swapped in about 12 seconds.
      </P>
      <H>5. Cost and durability arithmetic</H>
      <P>Unit cost is the per-part cost plus the tooling spread over the volume:</P>
      <Formula tex="unit cost = v + F / V">v variable cost per unit, F fixed tooling cost, V number of units. Printing has F ≈ 0 and a high v; moulding has a large F and a tiny v.</Formula>
      <P>
        Then check life: grips per day × days in service must be less than the cycles to first failure. A 300,000-cycle hand at 10,000 grips a day lasts a month.
      </P>
      <H>How the film’s design lab scores you</H>
      <P>
        The lab uses a deliberately simple, documented model (see <code>design.ts</code> in the course code). The numbers are illustrative, tuned so the trades match the research above, not measurements of any real product:
      </P>
      <List
        items={[
          'Dexterity grows with the logarithm of independent motors and a little with finger count; linkages count for less because their joints are coupled.',
          'Grip depends on where the motors sit (forearm motors are biggest) and the transmission (screws push hardest).',
          'Cycles start from a base per transmission (linkage 4M, gear 1.5M, tendon 1M), fall with motor count and fragile skins, and drop to a fifth when printed.',
          'Cost = motors + drivers + skin per finger + v per unit + tooling / 10,000 units.',
          'Learnability rewards backdrivable joints, easy simulation and rich touch.',
        ]}
      />
      <Table
        rows={[
          ['Customer', 'Must have', 'A design that signs'],
          ['Warehouse (Rosa)', 'under $3,000; 3.65M cycles; 60 N', '5 fingers, 6 motors in the palm, linkage, pads, moulded (~$1,550)'],
          ['Home robot (Sam)', 'under $6,000; backdrivable; under 700 g', '5 fingers, 12 forearm motors, tendons, pads, moulded'],
          ['Research lab (Dr Mei)', 'dexterity 75+; arrays or gel; learnable', '3 fingers, 12 forearm motors, tendons, arrays, CNC (like DEX-EE)'],
        ]}
      />
      <P>Of the 720 designs the lab allows, none satisfies two customers at once. That is the iron triangle in miniature.</P>
      <H>Open-source starting points</H>
      <List
        items={[
          'LEAP Hand (Carnegie Mellon, 2023): 16 Dynamixel servos, 3D printed, about $2,000, under four hours to assemble.',
          'ORCA Hand (ETH Zurich, 2025): 17-DoF tendon hand, under 2,000 CHF in materials, self-tensioning, joints that pop out under overload; ran 10,000+ cycles (about 20 hours) without failure.',
          'Aero Hand Open (TetherIA, 2025): 7 motors, 16 joints, tendons, printed nylon; about $314 as a kit or $720 assembled.',
        ]}
      />
      <Figure caption="Three open-source hands by price. All are cheap and dexterous; none is industrial-tough yet.">
        <svg viewBox="0 0 600 170" role="img" aria-label="Bar chart: Aero Hand about 720 dollars, LEAP about 2,000 dollars, ORCA under 2,000 Swiss francs in materials.">
          <rect width={600} height={170} fill={C.ink1} />
          {(
            [
              ['Aero Hand Open', 720, '$720 assembled'],
              ['LEAP Hand', 2000, '~$2,000'],
              ['ORCA Hand', 2000, '<2,000 CHF materials'],
            ] as const
          ).map(([t, v, l], i) => (
            <g key={t}>
              <text x={150} y={45 + i * 45} fill={C.paper} fontSize={14} textAnchor="end">
                {t}
              </text>
              <rect x={162} y={30 + i * 45} width={(v / 2200) * 300} height={22} rx={4} fill={C.gold} />
              <text x={170 + (v / 2200) * 300} y={46 + i * 45} fill={C.goldLight} fontSize={13}>
                {l}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <Note title="Before you build">Research hands are made to be repaired: budget for spare tendons, fingertip skins and servos, and log every failure. That log is exactly the durability data the industry is missing.</Note>
      <Think q="Why does the warehouse hand use a linkage and the home hand use tendons, when both are five-fingered?">
        The warehouse needs millions of cycles at low cost, and a screw-driven linkage is stiff, durable and cheap to mould. But that screw is self-locking: it can’t be pushed back, which is unsafe if it pinches a child. The home hand trades some lifespan and money for backdrivable tendons from the forearm, which also keeps the hand light.
      </Think>
      <Sources
        items={[
          ['LEAP Hand paper', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['ORCA Hand paper', 'https://arxiv.org/html/2504.04259v1'],
          ['TetherIA Aero Hand', 'https://aiwiki.ai/wiki/tetheria'],
          ['Aero Hand Open listing', 'https://humanoid.guide/product/aero-hand-open/'],
          ['AnySkin (swappable magnetic skin)', 'https://arxiv.org/html/2409.08276v2'],
          ['Boston Dynamics four-finger Atlas hand', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['Warehouse grip counts and hand lifetimes', 'https://www.itiger.com/news/1123099345'],
          ['Tendon friction and the forearm move', 'https://droids.substack.com/p/the-forearm-is-the-new-hand-inside'],
          ['Injection moulding costs', 'https://www.teamrapidtooling.com/injection-molding-cost-1000-10000-parts-a-680.html'],
        ]}
      />
    </>
  )
}

export const DesignReading: Reading = {
  id: 'design-guide',
  title: 'How to sketch your own hand',
  blurb: 'From the job to fingers, motors, transmission, touch, cost and lifespan, plus the open-source hands to start from.',
  minutes: 7,
  Body: DesignBody,
}

/* ---------------------------------------------------------------- 4. open problems */

function OpenBody() {
  return (
    <>
      <Lede>The research notes behind this course list a dozen problems nobody has solved. Here they are, and the places a newcomer can actually help.</Lede>
      <H>The big six from the film</H>
      <P>
        <strong>The triangle.</strong> Today you pick two of dexterous, cheap and tough. Cheap and tough: 6-DoF linkage hands at about $1-5k. Dexterous and tough: Shadow’s DEX-EE, big and very expensive. Dexterous and cheap: LEAP, ORCA and Aero, which are not industrial-durable. Tesla’s struggles are the public example of reaching for all three.
      </P>
      <P>
        <strong>Skin.</strong> The skin is the part that touches the world, so it wears first. A dense skin means thousands of taxels with wiring through moving joints, and a replacement skin reads slightly differently, so a learned policy may fail on it: in one study a policy kept 87% of its performance after an AnySkin swap but only 57% after a ReSkin swap. Touchlab said in 2026 that human-density sensing everywhere would make robots “prohibitively expensive”.
      </P>
      <P>
        <strong>An honest test.</strong> “1M cycles” claims aren’t comparable because load, speed and object vary. Inspire reports up to a million cycles in load tests, yet some hands broke after about 50 grips of 5 kg items in a real warehouse.
      </P>
      <P>
        <strong>Safety.</strong> ISO 10218-1/-2:2025 covers industrial arms. ISO 25785-1, for mobile robots with actively controlled stability such as humanoids, was a working draft in 2025, with publication expected around late 2026-2027. Open questions for hands include pinch-force limits, finger entrapment, certifying learned behaviour and what a grip should do on power loss.
      </P>
      <P>
        <strong>Heat and weight.</strong> A gripping motor works near stall, where current and heat peak while output power is zero. Sharpa quotes 15 W static and 180 W peak for one hand. Every gram at the wrist multiplies into shoulder torque (τ = m·g·L).
      </P>
      <P>
        <strong>Data.</strong> Xynova estimates the whole industry has maybe 100,000 hours of high-quality dexterous hand data. Practitioners at WAIC 2026 said hardware is “rapidly improving” while data and algorithms are the major gap. And each new hand design invalidates some learned policies, which pressures companies to freeze designs before durability is solved.
      </P>
      <Figure caption="Durability arithmetic: how long a hand lasts at warehouse pace (10,000 grips a day).">
        <svg viewBox="0 0 600 200" role="img" aria-label="Bars: 300,000 cycles lasts about a month, 1 million about three months, 15 to 18 million about five years.">
          <rect width={600} height={200} fill={C.ink1} />
          {(
            [
              ['300k cycles', 30, '≈ 1 month'],
              ['1M cycles', 100, '≈ 3 months'],
              ['15-18M cycles', 1650, '≈ 5 years (industrial asset)'],
            ] as const
          ).map(([t, d, l], i) => (
            <g key={t}>
              <text x={130} y={50 + i * 50} fill={C.paper} fontSize={14} textAnchor="end">
                {t}
              </text>
              <rect x={142} y={35 + i * 50} width={Math.max(6, (Math.log10(d) / Math.log10(1650)) * 300)} height={22} rx={4} fill={i < 2 ? C.danger : C.lime} />
              <text x={150 + (Math.log10(d) / Math.log10(1650)) * 300} y={51 + i * 50} fill={C.mist} fontSize={13}>
                {l}
              </text>
            </g>
          ))}
          <text x={142} y={188} fill={C.fog} fontSize={12}>bar length on a log scale of days</text>
        </svg>
      </Figure>
      <H>The rest of the list</H>
      <List
        items={[
          'No standard interfaces: no agreed wrist flange, connector or protocol (hands ship with USB, RS485, CAN or EtherCAT), so swapping suppliers means redesigning the forearm.',
          'Quality at scale: Figure’s end-of-line first-pass yield is reported at about 80%, against 99.3% for its battery packs.',
          'Supply ramp: China’s projected 2026 hand demand (~70,000) far exceeds 2025 output (~19,000), and precision gear and screw grinders come from a handful of firms.',
          'Geopolitics: China licenses exports of heavy rare earths used in hot-running magnets; a suspension of the expanded controls expires around 10 November 2026.',
          'Repair: who re-tensions tendons in the field? Is a hand a swap module or a repairable assembly? There are no public MTBF figures for humanoid hands.',
          'Recycling: robots carry 2-4 kg of NdFeB magnets each, and magnet recycling at scale barely exists.',
        ]}
      />
      <H>Where newcomers fit</H>
      <P>Not every contribution is a whole hand. The research notes point to niches a small team can own:</P>
      <List
        items={[
          'Components: coreless motors, micro screws, MIM gears, low-creep tendons, flexible harnesses.',
          'Test rigs and benchmarks: cycle testers and an agreed, honest durability test.',
          'Skins: cheap, tough, replaceable tactile covers that read the same after a swap.',
          'Field service: replaceable fingers and refurbishment.',
          'Simulation and data: teleoperation gloves, datasets, better tendon and contact models.',
          'Calibration software: self-diagnosis, automatic tendon-tension estimation.',
        ]}
      />
      <Note title="Mind the dates">Standards, export rules and company plans in this reading are as of October 2026 and change fast. ISO 25785-1’s timeline and the rare-earth suspension date are the likeliest to move.</Note>
      <Numbers
        items={[
          ['~50 grips', 'field life of some hands lifting 5 kg, against 1M-cycle lab claims'],
          ['~100,000 h', 'estimated high-quality dexterous hand data, industry-wide'],
          ['80% vs 99.3%', 'Figure’s robot vs battery first-pass yield'],
          ['2-4 kg', 'NdFeB magnets per humanoid'],
        ]}
      />
      <Think q="If you had one year and a small team, which open problem would you pick, and why?">
        There is no single answer. A durability test rig is cheap to build and every company needs comparable numbers. A swappable skin that keeps a policy working after replacement attacks both the skin and the data problems at once. A dataset of real hand failures would be valuable to everyone. Pick the one where your skills meet a gap nobody owns.
      </Think>
      <Sources
        items={[
          ['Warehouse durability and the 50-grip failures', 'https://www.itiger.com/news/1123099345'],
          ['ORCA Hand: skin and wiring failures', 'https://arxiv.org/html/2504.04259v1'],
          ['AnySkin: swappable tactile skin', 'https://arxiv.org/html/2409.08276v2'],
          ['Touchlab on e-skin cost (TechRadar)', 'https://techradar.com/pro/groundbreaking-technology-often-enters-the-market-at-a-premium-before-scaling-touch-sensitive-e-skin-could-soon-be-commonplace-in-robotics'],
          ['ISO 25785-1 explained', 'https://www.i-scoop.eu/iso-25785-1-explained-and-what-it-means-for-humanoid-robot-safety/'],
          ['ISO 25785-1 at ISO', 'https://www.iso.org/standard/91469.html'],
          ['Sharpa Wave specs (heat)', 'https://www.cnx-software.com/2026/06/02/sharpa-wave-high-end-dexterous-robotic-hand-with-22-dof-high-sensitivity-dynamic-tactile-array/'],
          ['Gasgoo: WAIC 2026 hands report', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
          ['Xynova and the data estimate', 'https://ionanalytics.com/insights/mergermarket/xynova-seeks-fresh-funding-as-it-aims-to-become-the-nvidia-of-dexterous-manipulation/'],
          ['Figure: 1,000 robots and yield', 'https://ai2.work/blog/figure-builds-its-1-000th-humanoid-robot-as-botq-hits-one-per-hour'],
          ['Hand supply vs demand in China', 'https://global.iteschina.com/en/news/details/2994'],
          ['Rare-earth export controls', 'https://finance.yahoo.com/markets/commodities/articles/china-rare-earth-export-pause-123614106.html'],
          ['Magnets per robot', 'https://stockhead.com.au/resources/how-the-dawn-of-the-robot-age-could-send-rare-earth-demand-ballistic'],
        ]}
      />
    </>
  )
}

export const OpenReading: Reading = {
  id: 'open-problems',
  title: 'Open problems, and where newcomers fit',
  blurb: 'The unsolved list (the triangle, skin, honest tests, safety, heat, data and more) and the niches a small team can own.',
  minutes: 7,
  Body: OpenBody,
}
