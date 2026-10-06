import { C } from '../../../cine/palette'
import { Figure, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1: counting                                                  */
/* ------------------------------------------------------------------ */

function DofBody() {
  return (
    <>
      <Lede>Two numbers hide inside every “degrees of freedom” figure on a spec sheet. Learn to pull them apart and you will never be fooled by a brochure again.</Lede>
      <H>What a degree of freedom is</H>
      <P>
        A degree of freedom (DOF) is one independent way a mechanism can move. A door on hinges has one: it can only swing. A drawer has one: it can only slide. Your shoulder has three: it swings forwards and back, lifts out to the side, and twists. For robot hands the rule of thumb is one DOF per rotary joint, as long as that joint can move on its own.
      </P>
      <P>
        A long finger, by the usual count, has four. The knuckle (the MCP joint) has two: it bends, and it spreads sideways. The middle joint (PIP) and the end joint (DIP) are plain hinges with one each. The thumb is usually modelled with four or five, because its base (the CMC joint) is a saddle with two axes. Add it up and a human hand has about 21 DOF in the fingers and thumb, about 23 if you count the wrist’s two, and you will even see “27” in computer-graphics models that add palm arching and the six ways the whole hand can move in space.
      </P>
      <Figure caption="One finger, four degrees of freedom: three hinges that bend, plus a sideways spread at the knuckle (seen from above, right).">
        <svg viewBox="0 0 600 220" role="img" aria-label="A side view of a finger with three bend arcs at its three joints, and a top view of the knuckle with a spread arc.">
          <rect width={600} height={220} fill={C.ink1} />
          <rect x={20} y={88} width={60} height={44} rx={8} fill={C.ink2} stroke={C.bone} strokeWidth={2} />
          {[
            [80, 190],
            [190, 270],
            [270, 330],
          ].map(([a, b]) => (
            <rect key={a} x={a + 6} y={98} width={b - a - 12} height={24} rx={6} fill={C.ink2} stroke={C.bone} strokeWidth={2} />
          ))}
          {[80, 190, 270].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={110} r={10} fill={C.ink1} stroke={C.bone} strokeWidth={2} />
              <path d={`M${x + 28} ${110} A 28 28 0 0 1 ${x + 4} ${138}`} stroke={C.cyan} strokeWidth={3} fill="none" />
              <text x={x} y={170} fill={C.cyanLight} fontSize={13} textAnchor="middle">
                {['MCP bend', 'PIP', 'DIP'][i]}
              </text>
            </g>
          ))}
          <g transform="translate(470 150)">
            <rect x={-60} y={0} width={120} height={22} rx={6} fill={C.ink2} stroke={C.bone} strokeWidth={2} />
            <line x1={0} y1={0} x2={0} y2={-100} stroke={C.bone} strokeWidth={14} strokeLinecap="round" />
            <line x1={0} y1={0} x2={0} y2={-100} stroke={C.ink2} strokeWidth={9} strokeLinecap="round" />
            <path d="M-40 -100 A 108 108 0 0 1 40 -100" stroke={C.cyan} strokeWidth={3} fill="none" />
            <text x={0} y={46} fill={C.cyanLight} fontSize={13} textAnchor="middle">
              MCP spread (top view)
            </text>
          </g>
          <text x={20} y={30} fill={C.paper} fontSize={16}>
            1 + 1 + 1 + 1 = 4 DOF
          </text>
        </svg>
      </Figure>
      <H>Joints are not motors</H>
      <P>
        The trap is that a joint that can move is not the same as a joint that is driven. Engineers keep two counts. DOF counts the joints that can move. Degrees of actuation (DOA), often written “active DOF”, counts the independent inputs: the motors or tendon drives you can command separately. When the two numbers match, the hand is fully actuated and every joint can be placed exactly where you want it. When DOA is smaller, the hand is underactuated: some joints are coupled to others, or are moved by springs and contact rather than by a motor of their own.
      </P>
      <P>
        Even your own hand is a little underactuated. Most people can’t bend the fingertip joint without the middle joint coming along, because the two share tendon mechanics. The Shadow Dexterous Hand copies this on purpose: its spec sheet says the distal joints are coupled “in a manner similar to a human finger”, which is why it has 24 joints but 20 motor units.
      </P>
      <Table
        rows={[
          ['Hand', 'Joints (DOF)', 'Motors (DOA)', 'What it means'],
          ['Shadow Dexterous Hand E', '24', '20', 'nearly fully actuated; end joints coupled'],
          ['Wuji Hand', '20', '20', 'fully actuated, a motor in every phalanx'],
          ['LEAP Hand (CMU)', '16', '16', 'fully actuated, four fingers'],
          ['Unitree Dex5-1', '20', '16', '4 passive joints'],
          ['Linker Hand L30', '21', '17', '4 passive joints'],
          ['TetherIA Aero Hand Open', '16', '7', 'tendons share drives'],
          ['Inspire RH56DFX', '12', '6', 'linkages couple two joints per finger'],
          ['Pisa/IIT SoftHand 2', '19', '2', 'one tendon through the whole hand'],
          ['SDM Hand (2007)', '8', '1', 'adaptive: springs decide'],
        ]}
      />
      <P>
        Read down the table and the same word, “DOF”, spans a range from fully driven to almost entirely passive. None of these hands is cheating; they are simply different answers to question one. But a brochure that says “20 DOF” could describe either the Wuji hand (20 motors) or the Unitree Dex5-1 (16 motors and 4 passive joints), and those behave very differently when you try to move one fingertip on its own.
      </P>
      <H>The wrist muddies it further</H>
      <P>
        A human wrist adds two DOF (bending up and down, tilting side to side), and turning the palm over adds a third that actually lives in the forearm. Product numbers often fold these in. 1X’s NEO hand, for example, is announced as 25 DOF: 22 in the hand plus 3 in the wrist. Tesla’s Optimus V3 patents describe 22 DOF in the hand plus 2 in the wrist, driven by 25 linear actuators per hand and forearm, though Tesla has said that design was superseded. Neither number is wrong; you just can’t compare them with a hand-only figure.
      </P>
      <Numbers
        items={[
          ['4', 'DOF in one long finger (MCP 2, PIP 1, DIP 1)'],
          ['~21', 'DOF in fingers and thumb of a human hand (counting conventions vary)'],
          ['6 / 12', 'motors / joints in the Inspire RH56DFX'],
          ['20 / 24', 'motor units / joints in the Shadow Hand E'],
        ]}
      />
      <Note title="Three questions for any spec sheet">
        Is that number joints or motors? Does it include the wrist? Which joints are passive or coupled, and to what? If the sheet won’t say, look for the phrase “active DOF” or the number of actuators, and treat the headline figure as the larger, joint count.
      </Note>
      <Think q="A hand has 16 joints and 6 motors. What can’t it do that a 16-motor hand can?">
        It can’t place every joint independently. Any two joints that share a motor always move together in a fixed or spring-decided ratio, so it can’t, say, curl one fingertip while keeping the middle joint straight, or roll an object by moving fingers in a sequence the coupling doesn’t allow. For grasping that often doesn’t matter; for in-hand manipulation it matters a lot.
      </Think>
      <Sources
        items={[
          ['Hand anatomy (bones, joints, muscles)', 'https://en.wikipedia.org/wiki/Hand'],
          ['Shadow Dexterous Hand E technical specification', 'https://shadowrobot.com/wp-content/uploads/2025/09/shadow_dexterous_hand_e_technical_specification.pdf'],
          ['Inspire RH56DFX (Generation Robots)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Unitree Dex5-1 announcement', 'https://www.robotics247.com/article/unitree-releases-new-dex5-1-humanoid-robot-hand/news'],
          ['Wuji Hand listing', 'https://www.mybotshop.de/Wuji-Robotic-Hand-v10_1'],
          ['LEAP Hand paper (RSS 2023)', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['Linker Hand L30', 'https://openelab.com/products/linker-hand-linkerbot-l30-l30'],
          ['TetherIA Aero Hand Open', 'https://humanoid.guide/product/aero-hand-open/'],
          ['1X NEO hands, 25 DOF', 'https://roboticsandautomationnews.com/2026/07/17/1x-unveils-25-degree-of-freedom-humanoid-robot-hands-for-neo/103405/'],
          ['Optimus V3 hand patents', 'https://www.basenor.com/blogs/news/tesla-optimus-gen-3-hand-patents-revealed-25-actuators-22-dof'],
          ['SDM Hand (Dollar & Howe)', 'https://www.eng.yale.edu/grablab/pubs/dollar_ICRA07.pdf'],
        ]}
      />
    </>
  )
}

export const DofReading: Reading = {
  id: 'dof-counting',
  title: 'Counting degrees of freedom without being fooled',
  blurb: 'Joints versus motors, a table of real hands, and the three questions to ask any spec sheet.',
  minutes: 6,
  Body: DofBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 2: underactuation                                            */
/* ------------------------------------------------------------------ */

function UnderBody() {
  return (
    <>
      <Lede>Fewer motors than joints sounds like a compromise. Done well, it is one of the cleverest ideas in robot hands: the hand works out its own shape.</Lede>
      <H>Two ways to share a motor</H>
      <P>
        <b>Rigid coupling</b> ties joints together with a linkage or a tendon looped over both, so one motor drives two joints in a fixed ratio (the end joint always bends, say, 0.8 times as far as the middle one). The Inspire RH56 hands work this way: six small linear actuators push rods that drive four-bar linkages, curling two finger joints each, for 12 joints in all. The finger can follow exactly one curl path. That makes it stiff, precise and easy to model, and its self-locking screws hold a grasp with the power off. It also means the finger can’t, for example, keep its fingertip flat while sliding along a surface.
      </P>
      <P>
        <b>Adaptive coupling</b> runs one tendon over several joints with springs or flexible hinges in between. In free air, the springs decide the shape, so the finger curls the same way every time. When the first link touches an object it stops, but the tendon keeps pulling, so the outer links carry on and wrap around the object. The finger conforms to the shape with no sensors and no control at all.
      </P>
      <Figure caption="An adaptive finger closing on a ball: the base link touches and stops (magenta), and the rest keep wrapping. Same pull, different shape for every object.">
        <svg viewBox="0 0 600 240" role="img" aria-label="A three-link finger wrapping around a ball, with contact points marked.">
          <rect width={600} height={240} fill={C.ink1} />
          <rect x={0} y={208} width={600} height={6} fill={C.ink3} />
          <circle cx={330} cy={150} r={58} fill={C.key} opacity={0.85} />
          <path d="M240 200 L268 112 L352 82 L398 126" stroke={C.shell} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M248 200 L276 116 L352 92 L392 132" stroke={C.cyan} strokeWidth={2.5} fill="none" />
          {[
            [240, 200],
            [268, 112],
            [352, 82],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={9} fill={C.carbon} />
          ))}
          {[
            [262, 140],
            [318, 94],
            [384, 118],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={7} fill={C.magenta} />
          ))}
          <text x={30} y={40} fill={C.cyanLight} fontSize={15}>
            one tendon (cyan), springs at each joint
          </text>
          <text x={430} y={190} fill={C.magentaLight} fontSize={15}>
            3 contacts
          </text>
        </svg>
      </Figure>
      <H>The classics</H>
      <P>
        The <b>SDM Hand</b> (Aaron Dollar and Robert Howe, Harvard, 2007) is the textbook example. One actuator drives eight joints across four fingers through pre-stretched cables, and the joints are soft polyurethane flexures cast in place, so each finger weighs 39 g and has no fasteners. It survived drops from more than 50 feet, hammer blows and use underwater, and it grasped 5 cm objects even when the robot’s estimate of where they were was off by up to 100% of the object’s size. That last number is the real point: adaptive hands forgive bad perception.
      </P>
      <P>
        Yale’s open-source <b>OpenHand Model T</b> drives four flexure-jointed fingers from one servo through a pulley-tree differential (490 g, 10 to 13 N holding force). In industry, the <b>Robotiq 2F-85</b> gripper (85 mm stroke, 20 to 235 N grip, 0.9 kg, 5 kg payload) uses an underactuated linkage that pinches with parallel fingertips or, when it meets an object early, switches to wrapping around it.
      </P>
      <P>
        The <b>Pisa/IIT SoftHand</b> pushes the idea furthest. Nineteen joints (14 rolling-contact “CORE” joints plus 5 for spreading) are driven by a single Dyneema tendon running through the whole hand. SoftHand 2 adds a second motor at the other end of the same tendon (both Maxon DC-X 22S with 86:1 gearboxes): pulling together closes the hand, pulling in opposite directions slides the tendon and makes a second movement. Its joints can dislocate under overload and spring back instead of breaking. It is sold as the qbHand.
      </P>
      <P>
        Soft hands go one step further and drop rigid links. TU Berlin’s <b>RBO Hand 2</b> uses seven air-driven PneuFlex actuators on a plastic frame, run at up to about 80 kPa. It is extremely compliant and safe, and it grasps by using the world: sliding along a table to scoop up a flat object, for instance.
      </P>
      <Table
        rows={[
          ['', 'Fully actuated', 'Rigid coupling', 'Adaptive / soft'],
          ['Motors', 'one per joint', 'about half', 'one or two'],
          ['Cost, weight', 'high', 'medium', 'low'],
          ['Forgives misplaced grasps', 'only with good control', 'somewhat', 'very well'],
          ['Survives knocks', 'often fragile', 'stiff, can break', 'very robust'],
          ['Precise fingertip placement', 'yes', 'along one path', 'no'],
          ['In-hand manipulation', 'yes', 'limited', 'poor'],
          ['Easy to simulate', 'yes', 'yes', 'hard (shape depends on contact)'],
        ]}
      />
      <Note title="The catch">
        An adaptive finger’s shape depends on the contact forces, so it is hard to predict and hard to simulate. And because you can’t command individual joints, it can’t aim its fingertip: it can’t pinch a flat coin off a table, and it can’t roll an object between its fingers. That is why many commercial hands mix approaches: coupled fingers for robust grasping, plus separate drives where precision matters (often the thumb).
      </Note>
      <Numbers
        items={[
          ['1 → 8', 'actuator → joints in the SDM Hand'],
          ['50+ ft', 'drop the SDM Hand survived'],
          ['2 → 19', 'motors → joints in the Pisa/IIT SoftHand 2'],
          ['6 → 12', 'actuators → joints in the Inspire RH56'],
        ]}
      />
      <Think q="Why might a warehouse prefer an adaptive gripper to a 20-motor hand, even if money were no object?">
        Because its job is mostly grasping varied objects whose position the camera only roughly knows. The adaptive hand tolerates those errors, survives collisions, and has far fewer parts to fail over millions of cycles. The 20-motor hand’s extra abilities (in-hand manipulation) would rarely be used, and every extra motor is another thing to break.
      </Think>
      <Sources
        items={[
          ['Dollar & Howe: the SDM Hand (ICRA 2007)', 'https://www.eng.yale.edu/grablab/pubs/dollar_ICRA07.pdf'],
          ['Yale OpenHand Model T', 'https://www.eng.yale.edu/grablab/openhand/model_t.html'],
          ['Robotiq 2F-85 / 2F-140', 'https://en.idec-fs.com/robotiq/Products/2f-85-140.html'],
          ['Pisa/IIT SoftHand 2 specs', 'https://www.wevolver.com/specs/the.pisa-iit.softhand.2'],
          ['RBO Hand 2', 'https://www.naturalmachinemotioninitiative.com/rbo-hand-2'],
          ['Inspire product selection guide', 'https://cdn.robotshop.com/rbm/62a1587c-c4cd-47cc-b64f-c077e2ad3775/7/7660deb4-9a9f-4227-a29b-38f4f2100034/ad0450f8_inspire-robots-products-selection-guide-v14-.pdf'],
          ['Inspire RH56DFX (Generation Robots)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Tesla Optimus V3 hand patents', 'https://www.basenor.com/blogs/news/tesla-optimus-gen-3-hand-patents-revealed-25-actuators-22-dof'],
          ['Why Optimus moved actuators to the forearm', 'https://droids.substack.com/p/the-forearm-is-the-new-hand-inside'],
        ]}
      />
    </>
  )
}

export const UnderReading: Reading = {
  id: 'underactuation',
  title: 'Underactuated and soft hands',
  blurb: 'Rigid and adaptive coupling, the hands that survive 50-foot drops, and what they give up.',
  minutes: 7,
  Body: UnderBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 3: synergies                                                 */
/* ------------------------------------------------------------------ */

function SynergyBody() {
  return (
    <>
      <Lede>Your hand has around twenty joints, but when you grab things you hardly use that freedom. A 1998 experiment showed how little, and it changed how people design robot hands.</Lede>
      <H>The experiment</H>
      <P>
        Marco Santello, Martha Flanders and John Soechting asked people to shape their hand as if to grasp 57 different imagined objects while sensors recorded the angle of every joint. Each grasp is then a list of about 20 numbers, a single point in a 20-dimensional “posture space”. The question was whether those 57 points fill that space, or sit in some small corner of it.
      </P>
      <P>
        They sit in a very small corner. The first two principal components (more on those below) explained more than 80% of the variation in joint angles across all the grasps. As a later paper from the Pisa robotics group put it: “Out of the ca. 20 DoFs of a human hand, only two or three combinations can be used to shape the hand for basic grasps.” These combinations are called postural synergies.
      </P>
      <H>Principal components, simply</H>
      <P>
        Imagine plotting every grasp as a dot. If the dots formed a round cloud, every direction would matter equally and you would need all 20 numbers. Instead they form a long, flat cloud, like a cigar. Principal component analysis (PCA) finds the longest direction of the cloud first (the movement that explains the most variation), then the next longest at right angles to it, and so on. Describe each grasp by its position along the first two directions and you have captured most of what makes grasps different from one another.
      </P>
      <Figure caption="A stretched cloud of grasps. The first pattern (long axis) is roughly “close everything together”; the second is roughly “thumb across versus fingers spread”. Most of the spread lies along these two directions.">
        <svg viewBox="0 0 600 260" role="img" aria-label="A scatter of dots forming a tilted ellipse, with two arrows marking its long and short axes.">
          <rect width={600} height={260} fill={C.ink1} />
          {Array.from({ length: 60 }, (_, i) => {
            const t = ((i * 37) % 60) / 60 - 0.5
            const u = ((i * 23) % 17) / 17 - 0.5
            const x = 300 + t * 380 * 0.94 - u * 70 * 0.34
            const y = 130 - t * 380 * 0.34 * 0.6 - u * 70 * 0.94
            return <circle key={i} cx={x} cy={y} r={4} fill={C.lime} opacity={0.8} />
          })}
          <path d="M110 197 L500 63" stroke={C.lime} strokeWidth={3} markerEnd="url(#rd-arrow)" />
          <path d="M282 75 L318 185" stroke={C.limeLight} strokeWidth={3} />
          <text x={440} y={52} fill={C.lime} fontSize={15}>
            pattern 1
          </text>
          <text x={324} y={204} fill={C.limeLight} fontSize={15}>
            pattern 2
          </text>
          <defs>
            <marker id="rd-arrow" viewBox="0 0 10 10" refX={7} refY={5} markerWidth={5} markerHeight={5} orient="auto">
              <path d="M0 0 L10 5 L0 10 Z" fill={C.lime} />
            </marker>
          </defs>
        </svg>
      </Figure>
      <H>From biology to hardware</H>
      <P>
        If two or three patterns cover most grasps, a robot hand might not need a motor per joint to grasp well. It could wire the patterns into its mechanics. That is the founding idea of the Pisa/IIT SoftHand: its single tendon is routed so that pulling it moves all 19 joints roughly along the first synergy, and the compliance in the joints lets the hand adapt to each object (the designers call this “adaptive synergies”). SoftHand 2 adds a second motor on the other end of the same tendon to produce a second movement.
      </P>
      <P>
        The same reasoning explains why six-actuator hands like the Inspire RH56 are commercially viable. Coupling two joints per finger throws away freedom you rarely use for grasping, and saves cost, weight and failure points. Inspire reportedly delivered more than 10,000 hands in 2025: plenty of robots mainly need to pick things up, not juggle them.
      </P>
      <H>Where synergies run out</H>
      <P>
        Synergies describe grasp postures: the shape your hand takes to hold something. They say very little about in-hand manipulation: rolling a pen, turning a key, flipping a coin across your knuckles, or regrasping a tool without putting it down. Those skills depend precisely on fingers moving independently, in sequence, often against each other. They need independent joints, fingertip workspaces that overlap, and good touch sensing.
      </P>
      <P>
        The most famous demonstration is OpenAI’s Dactyl, which in 2019 used a Shadow Dexterous Hand (20 motor units driving 24 joints) to solve a Rubik’s Cube. The finger skills were learned in simulation, with roughly 13,000 years of simulated experience. Even then, success was about 60% on typical scrambles and 20% on the hardest, the cube contained its own sensors, and the sequence of face turns came from a classic solving algorithm: only the manipulation was learned. Fully actuated hardware made the skill possible; it didn’t make it easy.
      </P>
      <Numbers
        items={[
          ['57', 'imagined objects in Santello et al. (1998)'],
          ['>80%', 'of posture variation explained by two synergies'],
          ['33', 'grasp types in the Feix GRASP taxonomy (2016)'],
          ['~13,000 yrs', 'simulated experience behind Dactyl’s cube skill'],
        ]}
      />
      <Note title="A useful way to say it">
        Grasping is low-dimensional; manipulation is not. A hand built around synergies can grab most things with few motors. A hand that must reposition objects in its fingers needs many independent joints, and the software to use them.
      </Note>
      <Think q="If synergies cover 80% of grasp shapes, what is in the missing 20%, and does a robot need it?">
        The remaining variation includes small, individual finger adjustments: tucking the little finger, placing the index precisely on a trigger, fine thumb positioning. For bulk picking a robot can often ignore it. For tool use and precise placement it is exactly the part that matters, which is why many hands add independent drives for the thumb and index even when the other fingers are coupled.
      </Think>
      <Sources
        items={[
          ['Gabiccini, Bicchi et al.: synergies and the 1998 result (RSS 2010)', 'https://www.centropiaggio.unipi.it/sites/default/files/2010_RSS_GB.pdf'],
          ['Pisa/IIT SoftHand 2 specs', 'https://www.wevolver.com/specs/the.pisa-iit.softhand.2'],
          ['Centro Piaggio: SoftHand', 'https://www.centropiaggio.unipi.it/node/2886'],
          ['Feix et al.: the GRASP taxonomy', 'https://www.eng.yale.edu/grablab/pubs/Feix_THMS2016.pdf'],
          ['OpenAI: Solving Rubik’s Cube with a robot hand', 'https://openai.com/index/solving-rubiks-cube'],
          ['Alex Irpan: notes on the Rubik’s Cube result', 'https://www.alexirpan.com/2019/10/29/openai-rubiks.html'],
          ['Synced: Dactyl’s training scale', 'https://syncedreview.com/2019/10/15/openai-robot-hand-today-rubiks-cube-tomorrow-the-real-world/'],
          ['WAIC 2026 report on the dexterous-hand market', 'https://autonews.gasgoo.com/articles/news/dextrous-hands-how-much-longer-until-they-are-good-enough-2081759214195150849'],
        ]}
      />
    </>
  )
}

export const SynergyReading: Reading = {
  id: 'synergies',
  title: 'Synergies, and why six motors go a long way',
  blurb: 'The 1998 experiment, principal components without the maths, and where synergies stop working.',
  minutes: 7,
  Body: SynergyBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 4: thumbs                                                    */
/* ------------------------------------------------------------------ */

function ThumbBody() {
  return (
    <>
      <Lede>Four fingers are, mechanically, variations on one design. The thumb is a different machine, and most of a hand’s usefulness rides on getting it right.</Lede>
      <H>The saddle at the base</H>
      <P>
        The thumb’s base joint, the carpometacarpal (CMC) joint, is a saddle: two curved surfaces nested at right angles, like a rider on a horse. A saddle lets the thumb rotate about two axes, so it can swing out from the palm and, crucially, swing across it until its pad faces the pads of the other fingers. That move is opposition, and it is what lets you pinch a coin, hold a pen or turn a key. Impairment guidelines commonly rate losing the thumb as losing something like 40 to 50% of the hand’s function (a widely quoted figure we could not confirm from a primary source).
      </P>
      <Figure caption="The CMC saddle: two curved surfaces and two rotation axes that are skewed, neither at right angles nor crossing at one point.">
        <svg viewBox="0 0 600 230" role="img" aria-label="A saddle-shaped surface drawn in wireframe with two skewed rotation axes.">
          <rect width={600} height={230} fill={C.ink1} />
          {Array.from({ length: 7 }, (_, i) => {
            const t = i / 6 - 0.5
            return <path key={`a${i}`} d={`M${150 + t * 60} ${120 + t * 40 - 40} Q ${300 + t * 60} ${150 + t * 40 + 60 * (0.25 - t * t)} ${450 + t * 60} ${120 + t * 40 - 40}`} stroke={C.bone} strokeWidth={1.5} fill="none" opacity={0.7} />
          })}
          {Array.from({ length: 7 }, (_, i) => {
            const t = i / 6 - 0.5
            return <path key={`b${i}`} d={`M${150 + t * 300} ${60 + Math.abs(t) * 20} Q ${180 + t * 300} ${130} ${210 + t * 300} ${160 - Math.abs(t) * 30}`} stroke={C.bone} strokeWidth={1.5} fill="none" opacity={0.5} />
          })}
          <line x1={120} y1={170} x2={480} y2={70} stroke={C.cyan} strokeWidth={3} />
          <line x1={250} y1={30} x2={350} y2={210} stroke={C.cyan} strokeWidth={3} strokeDasharray="8 6" />
          <text x={486} y={70} fill={C.cyanLight} fontSize={14}>
            axis 1
          </text>
          <text x={356} y={214} fill={C.cyanLight} fontSize={14}>
            axis 2 (offset, tilted)
          </text>
        </svg>
      </Figure>
      <H>Why it is the hardest finger to build</H>
      <List
        items={[
          <>
            <b>Workspace.</b> The thumb tip has to reach every fingertip, so it needs a big swing across the palm (the two-axis saddle motion), not just a bend.
          </>,
          <>
            <b>Force.</b> In a grasp the thumb pushes back against all four fingers at once, so it needs more torque than any single finger, from a joint buried in the palm where there is little room for a motor. Human pinch strength shows the scale: tip pinch averages about 8.3 kg for men and 5.1 kg for women aged 25 to 29, and key pinch 12.1 and 8.0 kg.
          </>,
          <>
            <b>Awkward axes.</b> The two CMC axes are neither perpendicular nor intersecting, which makes the joint hard to package and to calibrate.
          </>,
        ]}
      />
      <H>How real hands approximate it</H>
      <P>
        Most commercial hands replace the saddle with one “rotation” axis that swings the thumb across the palm plus one bending motion, each with its own motor. The Inspire RH56 spends two of its six actuators on the thumb (lateral rotation and bending); BrainCo’s Revo 2 does the same. That two-for-one budget is itself a design statement: a third of the motors go to one digit.
      </P>
      <P>
        Boston Dynamics’ new Atlas hand (October 2026) goes further and gives the thumb 4 DOF that let it slide along the length and width of the other fingers, so it can meet them across a wide area. The company’s design story is that thumb workspace, not finger count, drives what a hand can do.
      </P>
      <P>
        Workspace overlap matters for fingers too. CMU’s LEAP Hand noticed that in most robot hands the sideways (abduction) axis tilts with the finger, so a bent finger loses its ability to spread. LEAP’s “universal” abduction-adduction mechanism keeps every MCP motion available at any bend, which measurably improved how well the fingertips can be moved in all directions (manipulability). LEAP has 16 DOF, weighs 595 g, costs about $2,000 in parts, and in pull-out tests held 19.5 N, against 8.5 N for the Allegro hand and 26.5 N for a human hand.
      </P>
      <H>The missing pinky</H>
      <P>
        Atlas’s new hand has four fingers: three fingers with 3 DOF each plus the 4-DOF thumb, 13 in all. Boston Dynamics says that “eliminating the pinky reduces cost, size, actuator count and potential failure points without significantly reducing functionality”, and that it tested the idea by having staff tape their pinky and ring fingers together for a day. The company had already moved from two fingers to three (its 2025 hand had 7 actuators and was described as “the minimum needed for complex task performance”); four, not five, is where it stopped.
      </P>
      <Table
        rows={[
          ['Hand', 'Thumb solution', 'Total'],
          ['Human', 'CMC saddle (2) + MCP + IP', '4–5 DOF thumb'],
          ['Inspire RH56', '2 actuators: rotate across + bend', '6 actuators, 12 joints'],
          ['BrainCo Revo 2', '2 actuators', '6 active DOF'],
          ['Atlas 4-finger (2026)', '4 DOF, slides along and across the fingers', '13 DOF'],
          ['LEAP Hand', '4 DOF; universal MCP abduction on fingers', '16 DOF'],
        ]}
      />
      <Note title="Design by function">
        The thumb and the pinky teach the same lesson from opposite ends: spend motors where the job needs them (opposition, force, workspace) and remove what it doesn’t (a fifth finger whose work a neighbour can cover). Copy the task, not the anatomy.
      </Note>
      <Think q="If you could afford only seven motors for a five-fingered hand, how would you spend them?">
        A common answer: two for the thumb (rotate across the palm, and bend), one each for index and middle (the fingers that do precise work with the thumb), and one or two shared by ring and little finger (they mostly add wrapping force). TetherIA’s open-source Aero Hand shows the budget is realistic: it drives 16 joints with 7 actuators.
      </Think>
      <Sources
        items={[
          ['Hand anatomy and the CMC saddle joint', 'https://en.wikipedia.org/wiki/Hand'],
          ['Pinch-grip strength norms (Mathiowetz et al. 1985)', 'https://www.topendsports.com/testing/tests/pinch-grip-strength.htm'],
          ['Inspire RH56DFX (Generation Robots)', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['BrainCo Revo 2', 'https://www.roboticscenter.ai/hardware/brainco-revo'],
          ['Boston Dynamics’ four-finger Atlas hand', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['Atlas three-finger hand (2025)', 'https://interestingengineering.com/innovation/atlas-humanoid-robot-3-fingered-hand'],
          ['LEAP Hand paper (RSS 2023)', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['TetherIA Aero Hand Open', 'https://humanoid.guide/product/aero-hand-open/'],
        ]}
      />
    </>
  )
}

export const ThumbReading: Reading = {
  id: 'thumbs',
  title: 'Designing a thumb',
  blurb: 'The saddle joint, why the thumb needs the most force, how real hands fake it, and Atlas’s missing pinky.',
  minutes: 7,
  Body: ThumbBody,
}
