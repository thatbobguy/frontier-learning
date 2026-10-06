import { C } from '../../../cine/palette'
import { Figure, Lede, Note, Numbers, P, H, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

function MoravecBody() {
  return (
    <>
      <Lede>Why the things a toddler does without thinking are the things machines find hardest, and why the hand is where that bites hardest.</Lede>
      <P>
        In 1988 the roboticist Hans Moravec wrote: “It is comparatively easy to make computers exhibit adult level performance on intelligence tests or playing checkers, and difficult or impossible to give them the skills of a one-year-old when it comes to perception and mobility.” Nearly forty years later the line still describes the field. Language models pass professional exams. Robots still struggle to fold a basket of laundry reliably.
      </P>
      <H>The evolution argument</H>
      <P>
        Moravec’s explanation was evolutionary. Seeing, balancing and grasping were tuned over hundreds of millions of years, so they run so smoothly in us that we don’t notice the work. Abstract reasoning (chess, algebra, writing essays) is a very recent skill, so we feel every bit of effort it takes. What feels hard to us is the thin new layer; what feels easy is the vast old machinery underneath.
      </P>
      <P>
        There’s a second reason that matters even more today. Because the old skills are effortless, nobody ever wrote them down. The internet is full of text about chess openings and almost empty of descriptions of exactly how hard your fingertips pressed when you picked up a grape. Modern AI learns from recorded examples, so skills that were never recorded are the ones it can’t easily learn. That is the starting point of this course’s data branch.
      </P>
      <Figure caption="Hard for people, easy for machines, and the reverse. Rough placement, for intuition.">
        <svg viewBox="0 0 600 260" role="img" aria-label="A chart: chess and maths are hard for people and easy for machines; grasping and walking are easy for people and hard for machines.">
          <rect width={600} height={260} fill={C.ink1} />
          <line x1={60} y1={220} x2={570} y2={220} stroke={C.fog} />
          <line x1={60} y1={220} x2={60} y2={20} stroke={C.fog} />
          <text x={315} y={250} fill={C.mist} fontSize={14} textAnchor="middle">hard for people →</text>
          <text x={30} y={120} fill={C.mist} fontSize={14} textAnchor="middle" transform="rotate(-90 30 120)">hard for machines →</text>
          {[
            ['chess', 470, 190, C.cyan],
            ['algebra', 420, 170, C.cyan],
            ['exam essays', 380, 150, C.cyan],
            ['walking', 120, 90, C.amber],
            ['seeing a cup', 150, 70, C.amber],
            ['folding laundry', 170, 45, C.magenta],
            ['picking up an egg', 110, 35, C.magenta],
          ].map(([t, x, y, c]) => (
            <g key={t as string}>
              <circle cx={x as number} cy={y as number} r={6} fill={c as string} />
              <text x={(x as number) + 10} y={(y as number) + 5} fill={c as string} fontSize={14}>
                {t}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <H>Why the hand is the sharpest edge</H>
      <P>
        Walking was the poster child of Moravec’s paradox for decades, and it has largely fallen: with reinforcement learning in simulation, humanoids now walk over rubble, recover from shoves, and do backflips. Hands are harder for three reasons that the rest of this course unpacks. They make and break contact constantly, and contact is exactly where physics simulators are least accurate. They depend on touch, which robots barely have and which almost no dataset records. And a hand has to be small, light and strong at once, which squeezes every engineering choice.
      </P>
      <H>What “solved” looked like in 2019</H>
      <P>
        OpenAI’s Dactyl project taught a Shadow Hand to solve a Rubik’s Cube in 2019, trained entirely in simulation with ever-widening random changes to friction, sizes and motor strength. It was a landmark, but read the details: success was about 60% on average scrambles and 20% on the hardest, it relied on a cube with built-in sensors (with vision alone the numbers fell to 20% and 0%), the sequence of moves came from a classic solver, and the team had to calibrate 264 simulator parameters, including models of the hand’s tendons, to make it transfer. Only the finger work was learned. That gap between a spectacular demo and a reliable everyday skill is the theme of the whole course.
      </P>
      <Numbers
        items={[
          ['1988', 'Moravec states the paradox in Mind Children'],
          ['60% / 20%', 'Dactyl’s Rubik’s Cube success on average / hardest scrambles (2019)'],
          ['264', 'simulator parameters OpenAI calibrated for the Shadow Hand'],
        ]}
      />
      <Note title="Careful with the word “solved”">When you see a robot hand demo, ask three questions: how often does it work, under what conditions, and what parts were scripted rather than learned? You’ll be asking them all course.</Note>
      <Think q="If walking fell to simulation and reinforcement learning, why not hands too?">
        Walking mostly involves the feet touching a fairly predictable floor, and small errors average out over many steps. Manipulation is a stream of contacts with objects of unknown weight, friction and softness, and one wrong squeeze breaks the egg. Simulators model this badly, and touch, the sense that would catch the errors, is missing from most robots and almost all data.
      </Think>
      <Sources
        items={[
          ['Moravec’s paradox (overview and the 1988 quote)', 'https://en.wikipedia.org/wiki/Moravec%27s_paradox'],
          ['Alex Irpan: notes on OpenAI’s Rubik’s Cube result', 'https://www.alexirpan.com/2019/10/29/openai-rubiks.html'],
          ['OpenAI: Solving Rubik’s Cube with a robot hand', 'https://openai.com/index/solving-rubiks-cube'],
        ]}
      />
    </>
  )
}

export const MoravecReading: Reading = {
  id: 'moravec',
  title: 'Moravec’s paradox, and why hands are its sharpest edge',
  blurb: 'Why easy things are hard for machines, and what the famous Rubik’s Cube hand really did.',
  minutes: 5,
  Body: MoravecBody,
}


/* ---------- Grippers vs hands ---------- */

function GrippersBody() {
  return (
    <>
      <Lede>Do robots need five fingers at all? Serious engineers disagree, and the most interesting answers sit in the middle.</Lede>
      <P>
        Walk into almost any car or parcel factory and you will see robot arms ending in two-fingered jaws or suction cups, not hands. They are cheap, strong and nearly unbreakable. A typical industrial two-finger gripper, the Robotiq 2F-85, has a single actuator, weighs 0.9 kg, squeezes with anywhere from 20 to 235 N and carries 5 kg. Nothing in a humanoid hand comes close to that combination of force, simplicity and price. So why is the industry spending billions trying to build hands?
      </P>
      <H>The case for grippers</H>
      <P>
        Grippers handle the large majority of industrial pick-and-place. You will often hear that a parallel gripper covers “80% of tasks”, but nobody has traced that figure to a primary study: treat it as folklore that points at something real rather than as a measurement. Grippers are also easy to model, which matters for software. With one motor and two pads, a planner only has to choose where to put the jaws. Today’s learned robot policies already do a great deal with them: most of the robot learning data in the world was collected on parallel-jaw grippers, and big models such as Google DeepMind’s Gemini Robotics 2 run on a Franka arm with a Robotiq gripper.
      </P>
      <P>
        There is a serious academic version of the argument too. A 2025 paper titled “Do Robots Really Need Anthropomorphic Hands?” questions whether copying the human form is the right goal at all. A machine that never has to use a pair of scissors may be better served by a tool changer than by a hand.
      </P>
      <H>The case for hands</H>
      <P>
        The world is built for hands. Scissors, spray triggers, pens, door handles, jar lids and keys all assume four fingers and an opposable thumb. A gripper can hold a pen, but it can’t write with it. Two jaws can’t turn an object over inside the grasp (in-hand reorientation), pull a trigger while holding the handle, or slide a key out of a bunch. Those tasks need several contact points that move independently.
      </P>
      <P>
        The newer argument is about data. A robot learns from demonstrations, and the cheapest source of demonstrations is people: video of human hands, or gloves that record finger motion. The further a robot hand is from a human hand, the harder it is to translate (“retarget”) human motion onto it. Researchers call this the morphology gap. A five-fingered hand narrows the gap, which is one reason humanoid companies keep choosing human-like hands even when a simpler one would do the task.
      </P>
      <Figure caption="Boston Dynamics’ path: from a two-finger gripper to three fingers (2025) to four fingers (2026), and deliberately not five.">
        <svg viewBox="0 0 600 220" role="img" aria-label="Three stylised robot hands with two, three and four fingers, and a crossed-out fifth finger.">
          <rect width={600} height={220} fill={C.ink1} />
          {[
            { x: 100, n: 2, lab: '2 fingers', sub: 'gripper' },
            { x: 300, n: 3, lab: '3 fingers', sub: '2025 · 7 actuators' },
            { x: 500, n: 4, lab: '4 fingers', sub: '2026 · 13 DOF' },
          ].map(({ x, n, lab, sub }) => (
            <g key={lab}>
              <rect x={x - 40} y={110} width={80} height={50} rx={10} fill={C.ink3} stroke={C.metal} />
              {Array.from({ length: n }, (_, i) => {
                const fx = x - 30 + (60 / Math.max(1, n - 1)) * i
                const thumb = n > 2 && i === 0
                return thumb ? (
                  <rect key={i} x={x - 70} y={100} width={14} height={44} rx={7} fill={C.metal} transform={`rotate(-35 ${x - 63} 140)`} />
                ) : (
                  <rect key={i} x={fx - 7} y={50} width={14} height={62} rx={7} fill={C.metal} />
                )
              })}
              <text x={x} y={188} fill={C.paper} fontSize={15} textAnchor="middle">{lab}</text>
              <text x={x} y={208} fill={C.mist} fontSize={12} textAnchor="middle">{sub}</text>
            </g>
          ))}
          <g stroke={C.danger} strokeWidth={3}>
            <rect x={553} y={62} width={12} height={40} rx={6} fill="none" strokeDasharray="4 4" />
            <line x1={548} y1={60} x2={572} y2={104} />
          </g>
          <text x={560} y={46} fill={C.danger} fontSize={12} textAnchor="middle">no pinky</text>
        </svg>
      </Figure>
      <H>The middle path: minimal anthropomorphism</H>
      <P>
        Boston Dynamics shows a third answer: copy the human hand only as far as the tasks require. Its 2025 Atlas hand had three fingers and 7 actuators, and the company said “three fingers represent the minimum needed for complex task performance.” In October 2026 it moved to four fingers with 13 degrees of freedom, including a 4-DOF thumb that slides along the length and width of the hand. It still left out the little finger. Its reasoning was that “eliminating the pinky reduces cost, size, actuator count and potential failure points without significantly reducing functionality.” To check this, staff taped their own ring and little fingers together for a day.
      </P>
      <P>
        That is a design decision made from function, not from imitation. The thumb, the part that lets fingers oppose each other, mattered more than the finger count.
      </P>
      <Numbers
        items={[
          ['1 actuator', 'Robotiq 2F-85 gripper: 20–235 N, 0.9 kg, 5 kg payload'],
          ['7 → 13', 'actuators in Atlas’s 3-finger hand (2025), DOF in its 4-finger hand (2026)'],
          ['“80%”', 'the often-quoted share of tasks a gripper covers, with no primary source'],
        ]}
      />
      <Note title="What is still uncertain">
        Nobody has a clean, agreed benchmark that says which tasks need which hand. Company statements (“minimum needed”, “without significantly reducing functionality”) are design judgements, not measurements. The 2025 anthropomorphism paper is cited here by its question; its full results were not reviewed for this course.
      </Note>
      <Think q="A home robot must load a dishwasher, open jars and fold towels. Gripper, three fingers or five?">
        Towels and plates suit a gripper. Jars need a twisting grip that’s far easier with a thumb opposing two or more fingers. And if you plan to train it from videos of people doing chores, a more human hand narrows the morphology gap. Many teams would land on three or four fingers plus a strong thumb: Boston Dynamics’ answer.
      </Think>
      <Sources
        items={[
          ['Robotiq 2F-85 specifications', 'https://en.idec-fs.com/robotiq/Products/2f-85-140.html'],
          ['Do Robots Really Need Anthropomorphic Hands? (arXiv 2508.05415)', 'https://arxiv.org/pdf/2508.05415'],
          ['On the morphology gap in learning from human data (arXiv 2311.01832)', 'https://arxiv.org/pdf/2311.01832'],
          ['Atlas’s 3-fingered hand (Interesting Engineering)', 'https://interestingengineering.com/innovation/atlas-humanoid-robot-3-fingered-hand'],
          ['Boston Dynamics unveils a four-finger hand for Atlas', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['Gemini Robotics 2 on gripper-equipped arms', 'https://runtimewire.com/article/google-deepmind-gemini-robotics-2-apptronik-apollo-2'],
        ]}
      />
    </>
  )
}

export const GrippersReading: Reading = {
  id: 'grippers-vs-hands',
  title: 'The gripper versus hand debate',
  blurb: 'Two jaws are cheap and tough. Five fingers fit the world. Why Atlas stopped at four.',
  minutes: 5,
  Body: GrippersBody,
}

/* ---------- Industry stakes ---------- */

function IndustryBody() {
  return (
    <>
      <Lede>The hand has become the bottleneck of the humanoid robot industry: the most expensive, most fragile and most redesigned part of the body.</Lede>
      <H>Bodies waiting for hands</H>
      <P>
        In October 2025 The Information reported that Tesla had paused mass production of its Optimus humanoid, leaving “a stockpile of Optimus bodies missing hands and forearms.” Elon Musk called the hand “the most difficult part,” and has said the hand and forearm make up the majority of Optimus’s engineering difficulty (estimates put it around 50–60%). Tesla’s patents, published in April 2026, describe a hand with 22 joints plus 2 in the wrist, driven by 25 linear actuators packed into each forearm, pulling tendons about three per finger. Musk later said that patented design “didn’t actually work” and was replaced.
      </P>
      <P>
        Tesla is the loudest example, not the only one. Reports describe the challenge as making a hand “dexterous, durable, compact, and inexpensive enough for high-volume production,” and redesigns that “left partially built robots waiting for parts.” Some specifics, such as claims about overheating, come only from secondary sources.
      </P>
      <H>The money</H>
      <P>
        Analysts at Morgan Stanley estimate the hand at about 17% of the Optimus bill of materials (BOM), roughly $9,500 on a $50,000–60,000 robot. Broader industry estimates put a humanoid’s hands at 10–20% of its BOM, and above 20% for high-end versions with touch sensors. The source tables behind these splits are rough (one adds up to more than 100%), so read them as “a big slice,” not as precise accounting.
      </P>
      <Figure caption="Where a humanoid’s cost goes, roughly. The hands alone are about a sixth (Morgan Stanley estimate for Optimus).">
        <svg viewBox="0 0 600 150" role="img" aria-label="A bar split into hands about 17 percent and the rest of the robot.">
          <rect width={600} height={150} fill={C.ink1} />
          <rect x={40} y={50} width={520} height={44} rx={6} fill={C.ink3} stroke={C.fog} />
          <rect x={40} y={50} width={520 * 0.172} height={44} rx={6} fill={C.gold} />
          <text x={40 + (520 * 0.172) / 2} y={78} fill={C.ink} fontSize={15} textAnchor="middle" fontWeight={700}>hands ~17%</text>
          <text x={340} y={78} fill={C.mist} fontSize={15} textAnchor="middle">rest of the robot: legs, arms, torso, battery, computer</text>
          <text x={40} y={124} fill={C.mist} fontSize={13}>≈ $9,500 of a $50–60k bill of materials</text>
        </svg>
      </Figure>
      <H>The volume</H>
      <P>
        In 2025 the world shipped about 13,000–18,000 humanoid robots, roughly 90% of them from Chinese companies, and more than 30,000 dexterous hands (two per robot, plus hands sold to labs and for arms). One Chinese maker, Inspire, reports more than 10,000 hands shipped. Prices are falling fast: in China a dexterous hand that cost RMB 50,000–100,000 now sells for about RMB 20,000–35,000 (US$3,000–5,000).
      </P>
      <P>
        Now scale it. A million humanoids need two million hands. With about 25 actuators per hand, that is 50 million hand actuators, against an entire industry that built about 30,000 hands last year.
      </P>
      <H>The durability gap</H>
      <P>
        A warehouse robot grips something 8,000–10,000 times a day. A hand rated for 300,000–500,000 cycles therefore lasts one to two months. Lab claims of a million cycles look better, but in real logistics work some hands broke after about 50 grips of 5 kg items. And a humanoid has about 70 actuators in series: if each is 99.9% reliable over some period, the whole robot is only 0.999<sup>70</sup> ≈ 93% reliable. The hands carry most of those actuators.
      </P>
      <Numbers
        items={[
          ['Oct 2025', 'Tesla pauses Optimus production; bodies wait for hands'],
          ['~17%', 'hand share of the Optimus bill of materials (Morgan Stanley)'],
          ['30,000+', 'dexterous hands shipped worldwide in 2025'],
          ['8–10k/day', 'grips in a warehouse, against 300–500k-cycle hands'],
        ]}
      />
      <Note title="Read the claims carefully">
        Production numbers, cycle ratings and BOM splits mostly come from analysts, trade press and company statements, not audited figures. Musk’s 50–60% is an estimate of engineering effort, not a cost. The direction is consistent across sources, though: hands are expensive, scarce and break first.
      </Note>
      <Think q="Why would a company sell 30,000 hands a year if they break within months?">
        Most of 2025’s hands went to research labs, demos and pilot lines, where a hand grips hundreds of times a day, not ten thousand. Durability only becomes the binding constraint once robots do real shifts. That is exactly the step the industry is now trying to take.
      </Think>
      <Sources
        items={[
          ['TechSpot: Tesla temporarily halts Optimus mass production', 'https://www.techspot.com/news/109781-tesla-temporarily-halts-mass-production-optimus-robots-citing.html'],
          ['The forearm is the new hand (Optimus analysis)', 'https://droids.substack.com/p/the-forearm-is-the-new-hand-inside'],
          ['Tesla Optimus Gen 3 hand patents: 25 actuators, 22 DOF', 'https://www.basenor.com/blogs/news/tesla-optimus-gen-3-hand-patents-revealed-25-actuators-22-dof'],
          ['Hand share of humanoid BOM (ITES China)', 'https://global.iteschina.com/en/news/details/2994'],
          ['Humanoid BOM and actuator cost (Xenospectrum)', 'https://xenospectrum.com/en/humanoid-robot-bom-actuator-cost/'],
          ['China humanoid robot supply chain 2026', 'https://faxiangongchang.com/en/reports/china-humanoid-robot-supply-chain-2026'],
          ['Hand durability in warehouses (Tiger Brokers news)', 'https://www.itiger.com/news/1123099345'],
          ['Optimus hand durability snag (roic.ai)', 'https://www.roic.ai/news/teslas-optimus-robot-hits-snag-over-hand-durability-threatening-1000-unit-weekly-target-09-25-2026'],
        ]}
      />
    </>
  )
}

export const IndustryReading: Reading = {
  id: 'industry-stakes',
  title: 'Why the industry is obsessed with hands',
  blurb: 'Handless robots in a Tesla warehouse, a sixth of the bill of materials, and hands that wear out in weeks.',
  minutes: 5,
  Body: IndustryBody,
}

/* ---------- Anatomy ---------- */

function AnatomyBody() {
  return (
    <>
      <Lede>Every robot hand is measured against one benchmark: the one at the end of your arm. Here it is, described the way an engineer would.</Lede>
      <H>Structure: 27 bones</H>
      <P>
        The hand has 27 bones: 8 small carpals in the wrist, 5 metacarpals in the palm, and 14 phalanges, three in each finger and two in the thumb. Each long finger has three joints. The knuckle (MCP) bends and also swings sideways, so it counts as 2 degrees of freedom (DOF). The middle (PIP) and end (DIP) joints are simple hinges, 1 DOF each. That is 4 DOF per finger.
      </P>
      <P>
        But ask “how many DOF does a hand have?” and you will hear several answers, because people count differently:
      </P>
      <Table
        rows={[
          ['Counting convention', 'DOF', 'What it includes'],
          ['Fingers + thumb', '~21', '4 per finger × 4, thumb 4–5'],
          ['… plus wrist', '~23', 'adds wrist bend and side-to-side'],
          ['Graphics / robotics models', '“27”', 'adds palm arching and a 6-DOF pose for the whole hand'],
        ]}
      />
      <P>
        So always ask: counted how? And note that even 21 overstates what you control. Most people cannot bend the end joint of a finger without bending the middle one too, because they share tendon mechanics. Robots copy this as PIP–DIP coupling: the Shadow Hand spec says its distal joints “are coupled in a manner similar to a human finger.”
      </P>
      <H>The thumb</H>
      <P>
        The thumb’s base joint (the carpometacarpal, or CMC) is a saddle joint: two curved surfaces nested at right angles, like a rider on a saddle. It gives the thumb two rotation axes, which lets it swing across the palm to face each fingertip. That is opposition, and it is why the thumb is so hard to copy: its two axes are neither at right angles nor crossing, it must push against all four fingers, and it needs a large workspace.
      </P>
      <H>Muscles: the motors live in the forearm</H>
      <P>
        Clench your fist and watch your forearm move. The big, strong muscles that bend and straighten your fingers (the extrinsic muscles) sit in the forearm and send long tendons across the wrist. Small intrinsic muscles inside the hand handle fine positioning and the sideways spreading of the fingers. Around 34–35 muscles move the hand, roughly half of them in the forearm (a commonly cited count that we could not pin to one primary source). This layout keeps the fingers slim and light while the heavy power plant sits near the elbow. Tesla’s Optimus, 1X’s NEO and the Shadow Hand copy it; Inspire, Wuji and Boston Dynamics put their motors inside the hand instead.
      </P>
      <Figure caption="Pulleys hold the flexor tendon close to the bone. Without them the tendon would lift away like a bowstring and the joint would lose its predictable lever arm.">
        <svg viewBox="0 0 600 200" role="img" aria-label="A bent finger with a cyan tendon held by pulleys A1 to A5 along the bones.">
          <rect width={600} height={200} fill={C.ink1} />
          <g stroke={C.bone} strokeWidth={22} strokeLinecap="round" fill="none">
            <path d="M60 120 L230 120 L340 95 L430 55 L480 20" />
          </g>
          <path d="M40 140 L230 140 L345 115 L440 72 L490 34" stroke={C.cyan} strokeWidth={4} fill="none" />
          {[
            ['A1', 210, 140],
            ['A2', 280, 131],
            ['A3', 345, 115],
            ['A4', 395, 92],
            ['A5', 450, 66],
          ].map(([t, x, y]) => (
            <g key={t as string}>
              <rect x={(x as number) - 9} y={(y as number) - 8} width={18} height={16} rx={3} fill="none" stroke={t === 'A2' || t === 'A4' ? C.paper : C.mist} strokeWidth={2.5} />
              <text x={x as number} y={(y as number) + 30} fill={t === 'A2' || t === 'A4' ? C.paper : C.mist} fontSize={13} textAnchor="middle">{t}</text>
            </g>
          ))}
          <text x={60} y={186} fill={C.cyan} fontSize={13}>flexor tendon (from a forearm muscle)</text>
          <text x={470} y={150} fill={C.mist} fontSize={12} textAnchor="middle">A2 and A4 matter most</text>
        </svg>
      </Figure>
      <H>Tendons and pulleys: the transmission</H>
      <P>
        The flexor tendons run in a sheath held against the bones by five ring-shaped (annular) pulleys, A1 to A5, plus three criss-cross (cruciate) ones, C1 to C3. A2 and A4 matter most. They stop bowstringing and fix the moment arm, the distance between tendon and joint centre. Joint torque is tendon tension times moment arm, so a fixed moment arm means predictable torque. Robots use cable guides, low-friction channels and tiny pulleys for the same job, and every one adds friction.
      </P>
      <H>Strength</H>
      <P>
        In a classic study (Mathiowetz and colleagues, 1985, dominant hand, ages 25–29), men and women produced these pinch forces:
      </P>
      <Table
        rows={[
          ['Pinch', 'Men', 'Women'],
          ['Tip (fingertip to thumb tip)', '8.3 kg (~81 N)', '5.1 kg (~50 N)'],
          ['Key (thumb on the side of the index)', '12.1 kg (~119 N)', '8.0 kg (~78 N)'],
          ['Palmar (three-jaw chuck)', '11.8 kg (~116 N)', '8.0 kg (~78 N)'],
        ]}
      />
      <P>
        Whole-hand power grip in young adults is typically around 45–50 kg for men and 28–32 kg for women, though we could not check those figures against the normative tables. Everyday fingertip forces are only a few newtons. Most humanoid hands deliver 10–30 N per fingertip: well below a maximal human pinch, but enough for most daily tasks.
      </P>
      <H>Touch: 17,000 sensors</H>
      <P>
        About 17,000 mechanoreceptive units serve the hairless skin of one hand, around 2,000 of them in each fingertip. At the fingertip, fast-adapting FA I units reach about 140 per square centimetre and slow-adapting SA I about 70. They come in four kinds:
      </P>
      <Table
        rows={[
          ['Receptor', 'Adapts', 'Best at', 'Robot analogue'],
          ['Meissner (FA I)', 'fast', 'slip onset, light flutter', 'high-rate tactile arrays'],
          ['Merkel (SA I)', 'slow', 'pressure, edges, texture', 'pressure taxels, gel sensors'],
          ['Pacinian (FA II)', 'fast', 'vibration, peak ~250 Hz', 'fingertip accelerometers'],
          ['Ruffini (SA II)', 'slow', 'skin stretch, sideways force', 'shear-sensing skins'],
        ]}
      />
      <P>
        These signals let you grip only 10–40% harder than the minimum needed to stop a slip, and correct a slipping grip about 100 ms after it starts. A robot fingertip that only reports static pressure 30 times a second misses the fast channels entirely.
      </P>
      <Numbers
        items={[
          ['27', 'bones'],
          ['~21', 'DOF in fingers and thumb (~23 with wrist)'],
          ['17,000', 'touch units in one hand; ~2,000 per fingertip'],
          ['10–40%', 'how much harder than needed you grip'],
        ]}
      />
      <Note title="Simpler than it looks">
        In 1998 Santello and colleagues found that two combinations of joint motion explain over 80% of how people shape their hand to grasp 57 imagined objects. Grasping is lower-dimensional than 21 DOF suggests, which is why a 6-motor hand can grasp most things. Spinning an object in your fingers is another matter.
      </Note>
      <Sources
        items={[
          ['Hand (anatomy overview)', 'https://en.wikipedia.org/wiki/Hand'],
          ['Flexor pulley system and biomechanics (arXiv 2010.02580)', 'https://ar5iv.arxiv.org/html/2010.02580'],
          ['Shadow Dexterous Hand technical specification', 'https://shadowrobot.com/wp-content/uploads/2025/09/shadow_dexterous_hand_e_technical_specification.pdf'],
          ['Pinch strength norms (Mathiowetz 1985)', 'https://www.topendsports.com/testing/tests/pinch-grip-strength.htm'],
          ['Johansson & Vallbo: tactile units in the hand', 'https://www.cns.nyu.edu/~david/courses/sm12/Readings/Johansson1983.pdf'],
          ['Johansson & Flanagan: coding of touch in manipulation', 'https://web.stanford.edu/class/cs114/readings/MK-Johansson.pdf'],
          ['Mechanoreceptor types', 'https://en.wikipedia.org/wiki/Mechanoreceptor'],
          ['Hand synergies (Bicchi, Gabiccini et al.)', 'https://www.centropiaggio.unipi.it/sites/default/files/2010_RSS_GB.pdf'],
        ]}
      />
    </>
  )
}

export const AnatomyReading: Reading = {
  id: 'anatomy',
  title: 'Your hand, as an engineer sees it',
  blurb: 'Bones, DOF counting, forearm motors, pulleys, pinch strength and 17,000 touch sensors.',
  minutes: 6,
  Body: AnatomyBody,
}

/* ---------- Framework ---------- */

function FrameworkBody() {
  return (
    <>
      <Lede>Every robot hand is a set of answers to five questions, built inside a wall. Here is how six real hands answer them.</Lede>
      <P>
        The five questions are: <b style={{ color: C.bone }}>shape</b> (how many joints, and where), <b style={{ color: C.amber }}>muscle</b> (what makes the force), <b style={{ color: C.cyan }}>tendons</b> (how the force reaches the joint), <b style={{ color: C.magenta }}>touch</b> (what the hand feels) and <b style={{ color: C.lime }}>brain</b> (who decides how each joint moves, and what it learned from). Around them stands <b style={{ color: C.gold }}>the wall</b>: can you build a million, cheaply, and keep them working?
      </P>
      <H>Six hands, five answers</H>
      <Table
        rows={[
          ['Hand', 'Shape', 'Muscle', 'Tendons', 'Touch', 'The wall'],
          ['Shadow Dexterous Hand E', '24 joints, 20 driven; coupled finger tips', '20 motors in the forearm', 'tendon pairs', 'joint and tendon force; optional tactile tips', '4.3 kg with forearm; ~$80–130k+'],
          ['Tesla Optimus V3 (patents)', '22 hand + 2 wrist', '25 linear actuators per forearm', '~3 tendons per finger', 'not disclosed', 'Musk: the design “didn’t actually work”'],
          ['Inspire RH56DFX', '12 joints, 6 driven', '6 micro linear servos in the hand', 'linkages; self-locking', 'force sensor in each actuator', '540 g; ~€5k–$20k; 10,000+ shipped'],
          ['Wuji Hand', '20 DOF', 'brushless motor in each finger segment', 'direct, no tendons', 'encoders; tactile optional', '~$16k; 300k+ cycles claimed'],
          ['Boston Dynamics Atlas (4-finger)', '13 DOF, no pinky', 'direct actuation, one actuator type', 'no cables across joints; backdrivable', 'pressure sensing on fingertips and palm', 'built for factory duty'],
          ['LEAP Hand (CMU)', '16 DOF, 4 fingers', '16 hobby servos at the joints', 'direct', 'none (v2 adds soft pads)', '595 g; ~$2k; 3D printed'],
        ]}
      />
      <P>
        Brain is missing from the table on purpose. For almost all of these hands the control software is the customer’s problem: the same Shadow or LEAP hand might run a hand-written grasp script or a neural network trained on millions of simulated attempts. That is why the course gives the brain its own branch.
      </P>
      <H>The triangle</H>
      <P>
        Every answer has a price. More joints buy dexterity, but they cost money and add parts that break. The wall turns that into a triangle with three corners: dexterity, robustness and cost. Today you can usually pick two.
      </P>
      <Figure caption="Pick two. Real hands sit near an edge of the triangle, not in the middle.">
        <svg viewBox="0 0 600 300" role="img" aria-label="A triangle with corners dexterity, robustness and low cost, with example hands on each edge.">
          <rect width={600} height={300} fill={C.ink1} />
          <polygon points="300,30 80,260 520,260" fill="none" stroke={C.gold} strokeWidth={2.5} />
          <text x={300} y={20} fill={C.paper} fontSize={15} textAnchor="middle">dexterity</text>
          <text x={70} y={284} fill={C.paper} fontSize={15} textAnchor="middle">robustness</text>
          <text x={530} y={284} fill={C.paper} fontSize={15} textAnchor="middle">low cost</text>
          <circle cx={190} cy={145} r={6} fill={C.cyan} />
          <text x={180} y={150} fill={C.cyan} fontSize={13} textAnchor="end">Shadow DEX-EE</text>
          <circle cx={410} cy={145} r={6} fill={C.magenta} />
          <text x={420} y={150} fill={C.magenta} fontSize={13}>LEAP · ORCA · Aero</text>
          <circle cx={300} cy={260} r={6} fill={C.amber} />
          <text x={300} y={248} fill={C.amber} fontSize={13} textAnchor="middle">6-DOF linkage hands</text>
          <circle cx={300} cy={170} r={5} fill="none" stroke={C.danger} strokeWidth={2} />
          <text x={300} y={196} fill={C.danger} fontSize={12} textAnchor="middle">all three? (Tesla’s attempt)</text>
        </svg>
      </Figure>
      <Table
        rows={[
          ['Pair', 'Example', 'What it gives up'],
          ['Cheap + robust', '6-DOF linkage hands (Inspire, BrainCo, Linkerbot O6), about $1–5k', 'dexterity: fingers mostly open and close together'],
          ['Dexterous + robust', 'Shadow DEX-EE, built about 50% larger than a human hand to survive impacts', 'cost and size'],
          ['Dexterous + cheap', 'LEAP (~$2k), ORCA (<2,000 CHF materials), Aero (~$720)', 'durability: ORCA’s skin wore out after 2,000–4,000 cycles'],
        ]}
      />
      <P>
        Tesla’s public struggle is what trying for all three at once looks like: a hand dexterous enough for a general-purpose humanoid, cheap enough for a million robots, and tough enough for warehouse shifts.
      </P>
      <Numbers
        items={[
          ['5 + 1', 'questions plus the wall'],
          ['20 vs 6', 'motors in a Shadow hand vs an Inspire hand'],
          ['$2k – $100k+', 'the price range of serious dexterous hands'],
        ]}
      />
      <Note title="About these numbers">
        Many 2026 specs come from resellers and trade press, not manufacturer datasheets, and prices vary a lot by distributor. The Optimus row describes patents that Tesla says it has moved past. Wuji’s cycle count and Inspire’s shipments are company claims.
      </Note>
      <Think q="Which corner would you give up for a robot that lives in a home?">
        Probably not robustness (it must survive years of daily chores) and not cost (households won’t pay car prices). That leaves dexterity, which is why many home robots start with simpler hands and rely on clever software. The open question is whether that is enough for jars, laundry and dishes.
      </Think>
      <Sources
        items={[
          ['Shadow Dexterous Hand technical specification', 'https://shadowrobot.com/wp-content/uploads/2025/09/shadow_dexterous_hand_e_technical_specification.pdf'],
          ['Wuji Hand vs Shadow Hand (price)', 'https://www.roboticscenter.ai/de/compare/wuji-hand-vs-shadow-hand'],
          ['Tesla Optimus Gen 3 hand patents', 'https://www.basenor.com/blogs/news/tesla-optimus-gen-3-hand-patents-revealed-25-actuators-22-dof'],
          ['Inspire RH56DFX specifications', 'https://www.generationrobots.com/en/404369-rh56dfx-robotic-hand.html'],
          ['Wuji Hand', 'https://humanoid.guide/product/wuji-hand/'],
          ['Boston Dynamics four-finger Atlas hand', 'https://roboticsandautomationnews.com/2026/10/02/boston-dynamics-unveils-new-four-finger-hand-for-atlas-humanoid-robot/105440/'],
          ['LEAP Hand paper', 'https://ar5iv.arxiv.org/html/2309.06440'],
          ['ORCA Hand paper', 'https://arxiv.org/html/2504.04259v1'],
          ['Shadow DEX-EE (maxon)', 'https://www.maxongroup.com/en/knowledge-and-support/blog/the-most-sensitive-and-durable-robot-hand-yet-created-254852'],
          ['Optimus hand durability snag', 'https://www.roic.ai/news/teslas-optimus-robot-hits-snag-over-hand-durability-threatening-1000-unit-weekly-target-09-25-2026'],
        ]}
      />
    </>
  )
}

export const FrameworkReading: Reading = {
  id: 'framework',
  title: 'The five questions, with real examples',
  blurb: 'Shadow, Optimus, Inspire, Wuji, Atlas and LEAP, each answering the same five questions, and the triangle they live in.',
  minutes: 6,
  Body: FrameworkBody,
}
