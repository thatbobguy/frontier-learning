import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1: the long tail of homes                                    */
/* ------------------------------------------------------------------ */

function ReliabilityFigure() {
  const X = (n: number) => 60 + (n / 80) * 500
  const Y = (v: number) => 220 - v * 190
  const curve = (p: number) =>
    Array.from({ length: 81 }, (_, n) => `${n ? 'L' : 'M'}${X(n).toFixed(1)} ${Y(Math.pow(p, n)).toFixed(1)}`).join(' ')
  const lines: [number, string, string][] = [
    [0.999, C.lime, '99.9% per step'],
    [0.995, C.limeLight, '99.5%'],
    [0.99, C.gold, '99%'],
    [0.95, C.danger, '95%'],
  ]
  return (
    <svg viewBox="0 0 600 270" role="img" aria-label="Whole-chore success falls with the number of steps: at 95% per step it collapses within 20 steps; at 99.9% it stays above 90% even at 80 steps.">
      <rect width={600} height={270} fill={C.ink1} />
      <line x1={60} y1={220} x2={565} y2={220} stroke={C.fog} />
      <line x1={60} y1={220} x2={60} y2={25} stroke={C.fog} />
      {[0, 20, 40, 60, 80].map((n) => (
        <text key={n} x={X(n)} y={240} fill={C.mist} fontSize={13} textAnchor="middle">
          {n}
        </text>
      ))}
      {[0, 0.5, 0.9, 1].map((v) => (
        <g key={v}>
          <line x1={60} x2={565} y1={Y(v)} y2={Y(v)} stroke={C.slate} strokeDasharray={v === 0.9 ? '4 4' : '1 6'} />
          <text x={52} y={Y(v) + 4} fill={C.mist} fontSize={12} textAnchor="end">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {lines.map(([p, c, t], i) => (
        <g key={p}>
          <path d={curve(p)} fill="none" stroke={c} strokeWidth={3} />
          <text x={X(80) - 4} y={Y(Math.pow(p, 80)) - 8 - (i === 3 ? 14 : 0)} fill={c} fontSize={13} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <text x={310} y={262} fill={C.mist} fontSize={13} textAnchor="middle">
        steps in the chore →
      </text>
      <text x={20} y={120} fill={C.mist} fontSize={13} textAnchor="middle" transform="rotate(-90 20 120)">
        whole chore works
      </text>
    </svg>
  )
}

function LongTailBody() {
  return (
    <>
      <Lede>Factories, warehouses and labs can be rearranged to suit a robot. Homes can’t. Why the place where most people would like a robot is the hardest place to put one.</Lede>
      <H>Every home is its own world</H>
      <P>
        A factory cell is engineered: the same parts arrive in the same trays under the same lights, and if a robot struggles, engineers change the cell. A home is the opposite. Layouts, clutter, appliances, lighting, floor types, cupboard handles, pets and children all differ, and they change from day to day. Researchers studying how robot performance scales with data keep finding that the number of <em>different environments</em> in the training data matters more than the number of demonstrations in any one of them. One study found that about 32 environments with 50 demonstrations each got a policy to roughly 90% success in new places, while piling more demonstrations into fewer places did much less.
      </P>
      <P>
        The flip side is brutal. A policy trained in one lab can be excellent there and useless elsewhere. The UMI team’s cup-arranging policy, trained in the lab, scored 0% in unseen locations; the same policy trained on data gathered “in the wild” scored 71.7%. Every new home is, in a sense, a new test.
      </P>
      <H>The long tail</H>
      <P>
        Plot how often a home robot meets each kind of object or situation and you get a long-tail distribution: a few things (cups, plates, doors) turn up constantly, and thousands of things turn up rarely: a toy wedged in the dishwasher, a sticky jar lid, a cat asleep on the laundry, a new kettle with a strange lid. Each rare thing barely appears in training data, so the robot has little to learn from. Yet together the rare things are a large share of everything that happens, and they are where robots fail.
      </P>
      <P>
        There is some early evidence that breadth plus composition can cover part of the tail. In April 2026 Physical Intelligence reported that its π0.7 model operated an air fryer after seeing only two relevant training episodes, by combining skills learned elsewhere. Treat it as a promising company result, not a solved problem.
      </P>
      <H>Reliability compounds</H>
      <P>
        Chores are long. Loading a dishwasher is dozens of separate steps: open the door, pull the rack, pick up a plate, find a slot, and so on. If each step succeeds independently with probability <em>p</em>, a chore of <em>n</em> steps succeeds with probability <em>p</em> to the power <em>n</em>.
      </P>
      <Formula tex="P(whole chore) = pⁿ        p needed for a target T:  p = T^(1/n)">
        p is the chance one step works; n is the number of steps. Real steps aren’t perfectly independent (a robot can retry or recover), but the shape of the problem holds.
      </Formula>
      <Figure caption="Whole-chore success against the number of steps, for four per-step success rates (my calc).">
        <ReliabilityFigure />
      </Figure>
      <Table
        rows={[
          ['per step', '10 steps', '20 steps', '60 steps', '80 steps'],
          ['95%', '60%', '36%', '4.6%', '1.7%'],
          ['99%', '90%', '82%', '55%', '45%'],
          ['99.5%', '95%', '90%', '74%', '67%'],
          ['99.9%', '99%', '98%', '94%', '92%'],
        ]}
      />
      <P>
        To make a 60-step chore work nine times in ten you need about 99.83% on every step; for 80 steps, about 99.87%. Typical lab success rates for a single skill are far lower. Figure’s Helix 02 demo in January 2026 ran a four-minute dishwasher cycle with 61 autonomous loco-manipulation actions; at 99% per action that would complete only about 54% of the time, which is why one clean video says little about a product.
      </P>
      <H>Deformable things and contact</H>
      <P>
        The jobs people most want done at home (laundry, dishes, wiping, making beds) are full of cloth, liquids and constant contact. These are exactly what simulators model worst and what touch-free training data captures least, so homes stack the hardest data problem on top of the hardest environment problem.
      </P>
      <H>Failure costs more at home</H>
      <P>
        A warehouse can live with 99% pick success because a dropped box is just a retry. In a home, a broken heirloom, a flooded floor, a hurt pet or a fall near a child is not acceptable. A 66-pound humanoid falling over is a safety event in itself. So home robots need low forces, soft and compliant joints and conservative behaviour, and they need it while being cheap enough to buy. Formal safety standards for general-purpose home humanoids are still immature (ISO work is ongoing; the details are unverified here).
      </P>
      <Numbers
        items={[
          ['0.99²⁰ ≈ 82%', 'a 20-step chore at 99% per step'],
          ['0.95²⁰ ≈ 36%', 'the same chore at 95% per step'],
          ['61', 'actions in Figure Helix 02’s autonomous dishwasher run (Jan 2026)'],
          ['2', 'training episodes behind π0.7’s air-fryer run (company report)'],
        ]}
      />
      <Note title="Reading demos">When you see a home-robot video, ask: how many takes, how many steps, and how many different homes? A single success at 61 steps is real progress, and it is also compatible with a per-step reliability that would fail most days.</Note>
      <Think q="Why might real chores be a bit better than pⁿ suggests, and why a bit worse?">
        Better: a robot can notice a failed grasp and try again, so a step’s effective success can be higher than one attempt’s. Worse: failures are not independent. A slippery plate, bad lighting or an odd layout makes many steps harder at once, and some failures (a broken glass) can’t be retried at all.
      </Think>
      <Sources
        items={[
          ['Data scaling laws in imitation learning (environments vs demos)', 'https://arxiv.org/html/2410.18647v3'],
          ['UMI: in-the-wild vs lab-trained policies', 'https://aiwiki.ai/wiki/universal_manipulation_interface'],
          ['TechCrunch: Physical Intelligence’s π0.7 (Apr 2026)', 'https://techcrunch.com/2026/04/16/physical-intelligence-a-hot-robotics-startup-says-its-new-robot-brain-can-figure-out-tasks-it-was-never-taught/'],
          ['Figure Helix 02’s 4-minute kitchen task (Jan 2026)', 'https://www.techloy.com/figure-ais-helix-02-completes-4-minute-autonomous-kitchen-task-setting-new-humanoid-robotics-benchmark/'],
        ]}
      />
    </>
  )
}

export const LongTailReading: Reading = {
  id: 'long-tail',
  title: 'The long tail of homes',
  blurb: 'Why homes are the hardest place for a robot, and the arithmetic of reliability over long chores.',
  minutes: 6,
  Body: LongTailBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 2: evaluation                                                */
/* ------------------------------------------------------------------ */

function IntervalFigure() {
  const X = (v: number) => 80 + ((v - 0.5) / 0.5) * 480
  const rows: [number, number][] = [
    [20, 0.175],
    [50, 0.111],
    [200, 0.055],
    [1000, 0.025],
  ]
  return (
    <svg viewBox="0 0 600 230" role="img" aria-label="The 95% confidence interval around an 80% success rate shrinks from about plus or minus 17 points at 20 trials to about 2.5 points at 1,000 trials.">
      <rect width={600} height={230} fill={C.ink1} />
      {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
        <g key={v}>
          <line x1={X(v)} x2={X(v)} y1={20} y2={190} stroke={C.slate} strokeDasharray="1 5" />
          <text x={X(v)} y={210} fill={C.mist} fontSize={12} textAnchor="middle">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {rows.map(([n, h], i) => {
        const y = 40 + i * 42
        return (
          <g key={n}>
            <text x={70} y={y + 5} fill={C.mist} fontSize={13} textAnchor="end">
              n = {n.toLocaleString('en')}
            </text>
            <line x1={X(0.8 - h)} x2={X(0.8 + h)} y1={y} y2={y} stroke={C.lime} strokeWidth={6} strokeLinecap="round" opacity={0.6} />
            <circle cx={X(0.8)} cy={y} r={7} fill={C.lime} />
            <text x={X(0.8 + h) + 10} y={y + 5} fill={C.limeLight} fontSize={12}>
              ±{(h * 100).toFixed(1)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function EvaluationBody() {
  return (
    <>
      <Lede>Collecting data gets the headlines. Measuring whether it helped is the quiet half of the problem, and in robotics it is slow, noisy and easy to fool yourself with.</Lede>
      <H>Why real-world tests are expensive</H>
      <P>
        A language model can be scored on ten thousand questions in minutes. A robot policy has to be run on a physical robot, one trial at a time, and between trials a person has to reset the scene: put the cup back, refold the towel, check the lighting. That is roughly one to five minutes per trial. On top of that, results drift: lighting changes, objects wear, batteries sag, cameras slip out of calibration, and no two labs can build exactly the same scene. A generalist home robot ought to be tested on thousands of tasks in many homes, which no lab can staff, and long chores need partial-credit scoring because “it got 40 of 61 steps right” is information too.
      </P>
      <H>How noisy is a success rate?</H>
      <P>
        Suppose a policy succeeds in 40 of 50 trials. The best guess is 80%, but how sure are you? For a success rate <em>p</em> measured over <em>n</em> trials, an approximate 95% confidence interval is:
      </P>
      <Formula tex="p ± 1.96 × √( p (1 − p) / n )">
        At p = 0.8 and n = 50: 1.96 × √(0.8 × 0.2 / 50) ≈ 0.11, so the honest answer is “somewhere between about 69% and 91%”. (For small n or rates near 0% or 100%, better intervals such as the Wilson interval are used; the film’s game draws Wilson intervals.)
      </Formula>
      <Figure caption="The 95% interval around an 80% success rate, for different numbers of trials (my calc).">
        <IntervalFigure />
      </Figure>
      <Table
        rows={[
          ['trials', 'interval at 80%', 'reset time at 3 min/trial'],
          ['20', '±17.5 points', '1 hour'],
          ['50', '±11.1 points', '2.5 hours'],
          ['200', '±5.5 points', '10 hours'],
          ['1,000', '±2.5 points', '50 hours'],
        ]}
      />
      <P>
        The interval shrinks only with the square root of the number of trials: four times the trials for half the uncertainty. Telling a 78% policy from an 85% one so that the two intervals don’t overlap takes roughly 470 trials each (my calc), well over 40 hours of resets. The research notes put it plainly: distinguishing 80% from 85% at statistical confidence needs hundreds of trials per policy.
      </P>
      <H>Benchmarks that measure memory</H>
      <P>
        Simulated benchmarks avoid the reset problem, but they bring their own trap. LIBERO (2023) is a suite of 130 language-conditioned simulated tasks. It is now saturated: models such as π0.5 and OpenVLA variants score about 97–98%. In October 2025, LIBERO-PRO moved objects to new positions or corrupted the instructions, and these models collapsed to near 0%, replaying almost identical trajectories as if the objects were still where they used to be. They had learned the test, not the skill.
      </P>
      <P>
        SIMPLER (2024) takes a different approach: simulated environments built specifically so that their rankings of real policies (for Google’s robots and WidowX arms) correlate with real-world rankings. It trades some realism for repeatability. Large simulated suites keep growing: Stanford’s BEHAVIOR offers household activities in simulation (its 2026 challenge data has 20,000 demonstrations), and AgiBot claims more than 100,000 scenarios in Genie Sim 3.0 (a company claim).
      </P>
      <H>An arena for robots</H>
      <P>
        RoboArena (June 2025) borrows the idea behind chatbot leaderboards. Evaluators at seven institutions, all using the same DROID robot setup, pick their own task and scene, run two anonymous policies on it, and record progress scores and which one did better. Nobody knows which policy is which (double-blind), and nobody controls the task list, so it is hard to overfit. The paper reports more than 600 pairwise episodes across 7 policies; the full dataset has 4,284 episodes.
      </P>
      <P>
        The results are combined with a Bradley–Terry model, the same family of models used to rank chess players. Each policy gets a strength <em>s</em>, and the chance that A beats B depends only on the difference:
      </P>
      <Formula tex="P(A beats B) = 1 / (1 + e^−(s_A − s_B))">
        RoboArena’s version also accounts for how hard each evaluator’s chosen task was, so a win on a hard task counts for more.
      </Formula>
      <H>World models as judges</H>
      <P>
        A newer idea is to evaluate policies inside a learned video “world model” instead of a hand-built simulator (WorldGym, and 1X’s world-model challenge). It is promising, but the judge inherits the world model’s physics errors; 1X’s own world model scored 0% on dexterous pouring and drawing tasks.
      </P>
      <Note title="Why this is a data problem">Without cheap, trusted evaluation you can’t tell which data helped. And if you can’t tell, you can’t tune your data mix: how much teleoperation versus human video versus simulation. Evaluation is the measuring stick for everything else in this branch.</Note>
      <Numbers
        items={[
          ['±11 points', '95% interval on 80% after 50 trials'],
          ['~470', 'trials each to separate 78% from 85% cleanly (my calc)'],
          ['97% → ~0%', 'LIBERO vs LIBERO-PRO for top models'],
          ['4,284', 'episodes in the RoboArena dataset'],
        ]}
      />
      <Think q="A simulator ranks policy B above policy A. The real robot, after 50 trials each, says the opposite with overlapping intervals. What should you do?">
        Neither result settles it. The simulator may be biased (it may reward behaviours that don’t transfer), and 50 real trials can’t separate close policies. Run more real trials, or use paired, blind A/B comparisons on varied tasks, and check how well this simulator’s rankings have matched reality before.
      </Think>
      <Sources
        items={[
          ['LIBERO benchmark', 'https://arxiv.org/abs/2306.03310'],
          ['LIBERO-PRO (Oct 2025)', 'https://arxiv.org/html/2510.03827v1'],
          ['SIMPLER (2024)', 'https://arxiv.org/abs/2405.05941'],
          ['RoboArena (Jun 2025)', 'https://arxiv.org/html/2506.18123v2'],
          ['World-model evaluation (WorldGym)', 'https://arxiv.org/html/2506.00613v3'],
          ['1X world model results', 'https://1x.tech/discover/world-model-self-learning'],
        ]}
      />
    </>
  )
}

export const EvaluationReading: Reading = {
  id: 'evaluation',
  title: 'Evaluation: the hidden half of the data problem',
  blurb: 'Confidence intervals, memorised benchmarks, and why labs now run blind A/B arenas.',
  minutes: 7,
  Body: EvaluationBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 3: home robots in 2026 and the privacy bargain               */
/* ------------------------------------------------------------------ */

function HorizonFigure() {
  const cols: [string, string, string[]][] = [
    ['near', C.lime, ['tidying into bins', 'loading a dishwasher', 'wiping counters', 'folding laundry, slowly', 'fetching objects']],
    ['medium', C.gold, ['full laundry cycles', 'simple cooking', 'making beds', 'unpacking groceries', 'hours with no help']],
    ['far', C.danger, ['fragile, tiny things at speed', 'caring for people', 'tools needing force', 'unsupervised near toddlers']],
  ]
  return (
    <svg viewBox="0 0 600 250" role="img" aria-label="Home tasks sorted into near, medium and far as of October 2026.">
      <rect width={600} height={250} fill={C.ink1} />
      {cols.map(([t, c, items], i) => (
        <g key={t} transform={`translate(${20 + i * 195} 20)`}>
          <rect width={180} height={210} rx={10} fill="none" stroke={c} strokeOpacity={0.5} />
          <text x={14} y={28} fill={c} fontSize={18} fontWeight={600}>
            {t}
          </text>
          {items.map((it, k) => (
            <text key={it} x={14} y={60 + k * 32} fill={C.paper} fontSize={13}>
              {it}
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}

function HomeRobotsBody() {
  return (
    <>
      <Lede>Who is trying to put robots in homes as of October 2026, what they can actually do, and the bargain hidden inside the business model: your home becomes the training ground.</Lede>
      <H>1X NEO: the first one you can order</H>
      <P>
        1X opened preorders for NEO on 28 October 2025 at $20,000, or $499 a month. The company said its first year of production, more than 10,000 units, sold out within five days (a company claim). It opened a factory in Hayward, California on 30 April 2026 with capacity for 10,000 robots a year and a target of 100,000+ by the end of 2027. NEO weighs 66 lb, stands 5 ft 6 in, and has 22-degree-of-freedom tendon-driven hands. The official delivery date is “2026”, but as of mid-August 2026 independent reporting could not confirm a single delivery to a customer’s home.
      </P>
      <P>
        The twist is <strong>expert mode</strong>. For chores NEO can’t do yet, a remote 1X operator puts on a VR headset, sees through the robot’s cameras and drives it. Lights around NEO’s ears signal when a human is in control, and owners schedule and approve sessions. Reviewers point out that the details that matter most are unclear: how long footage is kept, whether and how it is used for training, whether faces and documents are blurred, and whether owners can mark rooms as no-go zones. Critics summed it up as “strangers see inside your home.”
      </P>
      <H>The flywheel, made explicit</H>
      <P>
        Expert mode is the data flywheel in plain sight. Every rescue is a teleoperated demonstration, recorded in a real home with real clutter: exactly the diverse data the long tail needs. More robots in more homes means more rescues, better models, fewer rescues, happier customers, more robots. The economics depend on it: a $20,000 robot has to save its owner a lot of hours, and teleop-assisted autonomy only pays off if remote-operator time per robot falls quickly.
      </P>
      <H>Everyone else</H>
      <List
        items={[
          <>
            <strong>Figure.</strong> Figure 03 (October 2025) is designed for homes. Project Go-Big (September 2025) collects first-person human video across Brookfield’s 100,000+ residential units. Helix 02 ran a four-minute, 61-action autonomous dishwasher cycle (January 2026) and a living-room tidying demo (July 2026). The CEO said home “alpha testing” was pulled forward to 2025; how many real customer homes are involved is unverified.
          </>,
          <>
            <strong>Sunday Robotics (Memo).</strong> A wheeled, non-humanoid robot trained from data collected with $200 gloves rather than teleoperation (the company reports “10M+ episodes” from 2,000+ gloves in 500+ homes). It showed dishwasher loading and worked in 6 unseen Airbnbs zero-shot. A beta with about 50 founding families is planned for late 2026, with wider rollout in 2027–28.
          </>,
          <>
            <strong>Physical Intelligence.</strong> Sells robot brains, not robots. π0 (2024) folded laundry from a dryer; π0.5 (April 2025) cleaned kitchens and bedrooms in homes never seen in training; π*0.6 (November 2025) did hours-long laundry and made espresso; π0.7 (April 2026) showed skills combining in new ways. Reported valuation $5.6B, with talks at about $11B.
          </>,
          <>
            <strong>Tesla Optimus.</strong> Shifted toward camera-rig human video for training in August 2025. Tesla says Optimus will cost about $20,000–30,000 at volume; home availability is unannounced.
          </>,
        ]}
      />
      <H>What robots can and can’t do at home</H>
      <Figure caption="A synthesis of where home tasks stand as of October 2026. Near means demonstrated autonomously in some unseen homes, at partial reliability.">
        <HorizonFigure />
      </Figure>
      <P>
        Even the near tasks run slowly: current systems work at roughly 30–50% of human speed (Sunday reports about 50%), though Generalist claims its GEN-1 model is about three times faster than the previous state of the art on some tasks.
      </P>
      <H>Privacy and consent</H>
      <P>
        Home data is the most diverse and valuable robot data there is, and also the most sensitive: faces, documents, screens, children, bedrooms. The owner can consent; a guest, a babysitter or a child cannot meaningfully do so. Questions any home robot company has to answer:
      </P>
      <List
        items={[
          'What is recorded, when, and for how long is it kept?',
          'Is footage used to train models, and can an owner opt out without losing features?',
          'Are faces, documents and screens blurred on the robot, before anything is uploaded?',
          'Can owners mark rooms or times as off limits, and see a log of every remote session?',
          'How are guests and children told, and can they refuse?',
        ]}
      />
      <P>
        There are technical answers that trade a little learning for a lot of trust: on-device blurring, learning only from rescue episodes rather than idle footage, and federated learning, where models are trained on the robot and only model updates leave the house. None is free, which is why designing the bargain is an open problem in its own right.
      </P>
      <H>The people behind the data</H>
      <P>
        Someone is wearing the headset. Teleoperation is real work: in China’s state-backed data centres, trainers repeat motions hundreds of times a day and describe themselves as “cyber-laborers”. Repetitive strain, low wages and offshore labour are part of the cost of robot data, even when the robot looks autonomous.
      </P>
      <Numbers
        items={[
          ['$20,000 or $499/mo', '1X NEO price at preorder (Oct 2025)'],
          ['10,000/yr', 'Hayward factory capacity (opened Apr 2026)'],
          ['0', 'customer-home deliveries independently confirmed by mid-Aug 2026'],
          ['30–50%', 'of human speed for today’s home tasks'],
        ]}
      />
      <Think q="Would you accept expert mode in your home? What rules would you need first?">
        There’s no single right answer. Many people would want owner approval for each session, a visible light, a session log, on-device blurring and a clear retention limit, and some would accept it only for specific rooms. Notice that each rule you add costs the company some data, which is exactly the trade the film’s game asks you to make.
      </Think>
      <Sources
        items={[
          ['1X opens NEO factory in Hayward (Apr 2026)', 'https://www.globenewswire.com/news-release/2026/04/30/3285118/0/en/1x-opens-neo-factory-in-hayward-ca-america-s-first-vertically-integrated-humanoid-robot-factory-with-consumer-shipments-planned-for-2026.html'],
          ['1X NEO review (delivery status, expert mode)', 'https://www.firgellirobots.com/blogs/robot-reviews/1x-technologies-neo-review'],
          ['TechSpot: strangers see inside your home', 'https://www.techspot.com/news/110056-first-consumer-humanoid-robot-here-but-strangers-see.html'],
          ['Figure: Project Go-Big', 'https://www.figure.ai/news/project-go-big'],
          ['Figure testing robots in homes', 'https://www.emarketer.com/content/figure-ai-testing-humanoid-robots-homes'],
          ['Sunday Robotics and its glove data', 'https://www.theneuron.ai/explainer-articles/this-home-robot-learned-to-do-your-dishes-from-10-million-real-family-routines'],
          ['Physical Intelligence: π0.5', 'https://www.pi.website/blog/pi05'],
          ['Tesla Optimus training shift', 'https://www.eweek.com/news/tesla-optimus-robot-training/'],
          ['Generalist GEN-1', 'https://generalistai.com/blog/apr-02-2026-GEN-1'],
          ['Rest of World: China’s robot training centres', 'https://restofworld.org/2026/china-robots-training-centers-workers/'],
        ]}
      />
    </>
  )
}

export const HomeRobotsReading: Reading = {
  id: 'home-robots',
  title: 'Home robots in 2026, and the privacy bargain',
  blurb: '1X NEO and expert mode, Figure, Sunday, Physical Intelligence, Tesla, and what your home gives up.',
  minutes: 8,
  Body: HomeRobotsBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 4: open questions and opportunities                          */
/* ------------------------------------------------------------------ */

function StarterFigure() {
  const items: [string, number, string][] = [
    ['data glove (Sunday)', 200, C.lime],
    ['GELLO leader arm', 300, C.lime],
    ['UMI handheld gripper', 371, C.lime],
    ['teleop rig', 20000, C.gold],
  ]
  const X = (v: number) => 190 + (Math.log10(v) - 2) * 160
  return (
    <svg viewBox="0 0 600 200" role="img" aria-label="Cheap data-collection hardware costs a few hundred dollars, about a hundred times less than a twenty-thousand-dollar teleoperation rig.">
      <rect width={600} height={200} fill={C.ink1} />
      {[100, 1000, 10000, 100000].map((v) => (
        <g key={v}>
          <line x1={X(v)} x2={X(v)} y1={20} y2={170} stroke={C.slate} strokeDasharray="1 5" />
          <text x={X(v)} y={190} fill={C.mist} fontSize={12} textAnchor="middle">
            ${v.toLocaleString('en')}
          </text>
        </g>
      ))}
      {items.map(([t, v, c], i) => (
        <g key={t}>
          <text x={180} y={45 + i * 36} fill={C.paper} fontSize={13} textAnchor="end">
            {t}
          </text>
          <rect x={X(100)} y={33 + i * 36} width={X(v) - X(100)} height={16} rx={4} fill={c} opacity={0.8} />
          <text x={X(v) + 8} y={45 + i * 36} fill={c} fontSize={12}>
            {v < 1000 ? `$${v}` : `$${v.toLocaleString('en')}`}
          </text>
        </g>
      ))}
    </svg>
  )
}

function OpenQuestionsBody() {
  return (
    <>
      <Lede>The honest state of the field in late 2026: ten questions nobody has answered, and the places where someone new, without a big robot budget, can make a real contribution.</Lede>
      <H>Ten open questions</H>
      <List
        items={[
          <>
            <strong>Is human data enough?</strong> Generalist pretrained GEN-1 on about 500,000 hours collected entirely from human-worn wearables, with no robot data, and Sunday trains without teleoperation. Skeptics, including Sergey Levine’s “sporks” argument, say substitute data covers less and less of what a strong model needs. The likely answer is human data for breadth plus a thin layer of robot data (NVIDIA’s EgoScale needed about 4 hours), but whether “thin” means an hour per task or thousands of hours per robot is unresolved.
          </>,
          <>
            <strong>Can simulation handle manipulation?</strong> It works for walking and for multiplying demonstrations, but it is unproven for contact-rich, deformable home tasks. Learned world models may replace simulators for visuals, yet still fail at physics: 1X’s world model scored 0% on pouring.
          </>,
          <>
            <strong>Where is the touch data?</strong> There is no large standard tactile dataset, sensors are incompatible, and people can’t easily demonstrate force. NeoData (a 2026 preprint, 30,000+ hours of synced vision and touch, 5,000 open) is a first attempt. Does touch belong in pretraining, or can it be added later?
          </>,
          <>
            <strong>What does a useful hour cost?</strong> Quoted rates hide resets, rejected episodes and idle time. Rough budgets for a million hours (my calc in the research notes): about $40M at $40/h for egocentric wearables, $100M at $100/h for teleoperation, $600M at fully loaded facility rates. The number that matters, cost per unit of improvement, is almost never published.
          </>,
          <>
            <strong>How much data does a home robot need?</strong> Nobody knows. π0.5 suggests about 100 homes buy decent generalisation for its tasks; Generalist’s scaling curve suggests gains continue past 100,000 hours. Estimates from 10⁶ to 10⁸ hours circulate without rigorous support.
          </>,
          <>
            <strong>Evaluation.</strong> Cheap, trusted, reproducible tests for generalist robots don’t exist yet (see the previous chapter’s reading).
          </>,
          <>
            <strong>Privacy and consent</strong> for home data, especially remote “expert modes” and cameras that capture people who never agreed.
          </>,
          <>
            <strong>Sharing or moats?</strong> Open datasets (Open X-Embodiment, DROID, AgiBot World, EgoDex, Egocentric-10K, EgoSuite-Open100K, the LeRobot hub) sit beside closed ones (Physical Intelligence, Generalist, Tesla, Figure, 1X). Will robot data become a commodity like web text, or stay the moat?
          </>,
          <>
            <strong>Hands versus grippers.</strong> Most robot data comes from two-finger grippers. Multi-finger hands (6 to 22 degrees of freedom) have no shared standard, retargeting human hand motion onto them is lossy, and data from one 22-DoF hand may not transfer to another.
          </>,
          <>
            <strong>Labour.</strong> Repetitive, low-paid teleoperation work, often offshore, sits underneath many “autonomous” results.
          </>,
        ]}
      />
      <H>Where a newcomer can start</H>
      <P>Much of the most useful work needs a laptop, a few hundred dollars of hardware, or none at all.</P>
      <Figure caption="Starter hardware for collecting robot data, on a log scale: a few hundred dollars against $20,000 for a teleoperation rig.">
        <StarterFigure />
      </Figure>
      <List
        items={[
          <>
            <strong>Data quality tools.</strong> Automatically flag bad demonstrations, timestamp drift and calibration errors (a 50 ms misalignment at 50 Hz is a 2.5-step label error). Build methods that answer “which episodes actually helped?” and measure duplication and diversity.
          </>,
          <>
            <strong>Cheap collection hardware.</strong> Hugging Face’s LeRobot SO-100/101 arms have a big community (4,500+ SO-family datasets, about 855 hours); GELLO leader arms cost under $300; UMI-style handheld grippers about $400. Phone or glasses apps that extract hand poses are another route.
          </>,
          <>
            <strong>Retargeting</strong> human hand motion onto many different robot hands.
          </>,
          <>
            <strong>Honest tests.</strong> Join or extend RoboArena-style distributed evaluations, build LIBERO-PRO-style perturbation suites that catch memorisation, or measure how well world-model evaluations predict real results.
          </>,
          <>
            <strong>Touch.</strong> Low-cost tactile sensors, representations that work across sensors, tactile add-ons for handheld grippers.
          </>,
          <>
            <strong>Annotation pipelines.</strong> Use vision-language models to label subtasks, detect success and write instructions, with human checking.
          </>,
          <>
            <strong>Privacy-preserving collection.</strong> On-device blurring, consent flows, federated learning for home fleets.
          </>,
          <>
            <strong>Open data from places nobody has recorded.</strong> Deformable objects, kitchens in non-Western homes, accessibility tasks.
          </>,
        ]}
      />
      <Note title="A first project">Record ten kitchens nobody has filmed, with consent, using a phone and a hand-pose app; label the subtasks; publish it in the LeRobot format with a clear licence. Many big datasets are non-commercial (AgiBot World is CC-BY-NC-SA, EgoDex CC-BY-NC-ND), so well-licensed data in an under-covered niche is genuinely useful.</Note>
      <Numbers
        items={[
          ['500,000 h', 'GEN-1’s pretraining data, all from human wearables (Apr 2026)'],
          ['~4 h', 'robot data EgoScale needed on top of human data'],
          ['<$300', 'a GELLO leader arm'],
          ['4,500+', 'SO-family community datasets on the LeRobot hub'],
        ]}
      />
      <Think q="Pick one open question. What is the smallest experiment that would teach you something about it?">
        For “is human data enough?”, you could train a small policy on an SO-101 arm with and without a few hours of your own hand videos and compare success on 50 honest trials each. Remember the previous chapter: 50 trials gives you about ±11 points, so only large effects will show.
      </Think>
      <Sources
        items={[
          ['Generalist GEN-1', 'https://generalistai.com/blog/apr-02-2026-GEN-1'],
          ['Sergey Levine: Sporks of AGI', 'https://sergeylevine.substack.com/p/sporks-of-agi'],
          ['EgoScale (NVIDIA)', 'https://arxiv.org/html/2602.16710'],
          ['1X world model', 'https://1x.tech/discover/world-model-self-learning'],
          ['NeoData tactile preprint', 'https://www.alphaxiv.org/abs/2608.29601'],
          ['What a robot hour actually costs', 'https://insidecm.substack.com/p/what-a-robot-hour-actually-costs'],
          ['Trajectory datasets survey (SO-family datasets, licences)', 'https://mcobzarenco-fontaine-blog.static.hf.space/posts/2026-08-09-trajectory-datasets-survey.html'],
          ['GELLO', 'https://arxiv.org/abs/2309.13037'],
          ['UMI', 'https://arxiv.org/abs/2402.10329'],
          ['DexUMI', 'https://arxiv.org/html/2505.21864v2'],
          ['LeRobotDataset v3', 'https://huggingface.co/docs/lerobot/lerobot-dataset-v3'],
          ['RoboArena', 'https://arxiv.org/html/2506.18123v2'],
          ['Rest of World: robot training centres', 'https://restofworld.org/2026/china-robots-training-centers-workers/'],
        ]}
      />
    </>
  )
}

export const OpenQuestionsReading: Reading = {
  id: 'open-questions',
  title: 'Open questions and opportunities',
  blurb: 'Ten problems nobody has solved, and concrete places a newcomer can start.',
  minutes: 8,
  Body: OpenQuestionsBody,
}
