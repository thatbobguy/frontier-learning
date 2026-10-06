import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1: what a policy is and what it eats                         */
/* ------------------------------------------------------------------ */

function PolicyBody() {
  return (
    <>
      <Lede>A robot’s brain is a function that turns what it senses into what its joints do next. Here is what goes in, what comes out, and why the data to train it can’t simply be downloaded.</Lede>
      <H>The loop</H>
      <P>
        Roboticists call the brain a <b>policy</b>. Many times a second it takes an <b>observation</b> and returns an <b>action</b>. The observation is usually one or more camera images plus the robot’s own joint positions (its proprioception), and sometimes touch. The action is a set of targets: either an angle for every joint, or a pose for the hand in space (where the palm should be and how it should be turned) plus a command for the fingers. Low-level motor controllers then chase those targets thousands of times a second.
      </P>
      <P>
        How often does the policy decide? Physical Intelligence’s π0 model, for example, outputs a chunk of 50 future actions at a time and runs at up to 50 Hz, so the robot gets fresh targets every 20 milliseconds. Predicting a short chunk instead of one step smooths out the jitter in human demonstrations and means fewer decisions in which an error can creep in.
      </P>
      <Figure caption="The loop a policy runs, many times a second. Real object first (the camera image), then numbers, then the decision.">
        <svg viewBox="0 0 600 220" role="img" aria-label="Observation (camera image and joint angles) flows into the policy, which outputs joint targets that move the hand; the hand changes the world, which changes the next observation.">
          <defs>
            <marker id="dg-rd-arrow" viewBox="0 0 10 10" refX={7} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill={C.mist} />
            </marker>
          </defs>
          <rect width={600} height={220} fill={C.ink1} />
          <rect x={20} y={50} width={130} height={80} rx={6} fill={C.ink3} stroke={C.lime} />
          <rect x={40} y={92} width={30} height={26} rx={4} fill={C.shellMid} />
          <rect x={52} y={56} width={12} height={34} rx={3} fill={C.shell} />
          <text x={85} y={150} fill={C.lime} fontSize={14} textAnchor="middle">observation</text>
          <text x={85} y={168} fill={C.mist} fontSize={11} textAnchor="middle">images + joint angles</text>
          <path d="M155 90 H230" stroke={C.lime} strokeWidth={2.5} markerEnd="url(#dg-rd-arrow)" />
          <rect x={235} y={60} width={130} height={60} rx={12} fill={C.ink} stroke={C.lime} strokeWidth={2.5} />
          <text x={300} y={97} fill={C.limeLight} fontSize={20} textAnchor="middle">policy</text>
          <path d="M370 90 H445" stroke={C.lime} strokeWidth={2.5} markerEnd="url(#dg-rd-arrow)" />
          <text x={510} y={70} fill={C.paper} fontSize={13} textAnchor="middle">index → 42°</text>
          <text x={510} y={90} fill={C.paper} fontSize={13} textAnchor="middle">middle → 44°</text>
          <text x={510} y={110} fill={C.paper} fontSize={13} textAnchor="middle">thumb → 30°</text>
          <text x={510} y={150} fill={C.lime} fontSize={14} textAnchor="middle">action</text>
          <path d="M510 165 Q 510 205 300 205 Q 85 205 85 178" stroke={C.fog} strokeWidth={1.5} fill="none" strokeDasharray="5 5" markerEnd="url(#dg-rd-arrow)" />
          <text x={300} y={198} fill={C.fog} fontSize={11} textAnchor="middle">the world changes; look again (20 ms later at 50 Hz)</text>
        </svg>
      </Figure>
      <H>Learning by example is supervised learning</H>
      <P>
        The most common way to train a policy is <b>behaviour cloning</b>: record an expert (usually a human driving the robot) and train the network to output the same action the expert took, given the same observation. It is ordinary supervised learning, the same recipe as teaching a network to label photos, and it is simple and stable. Two catches: it is data-hungry, and it can only be as good as the demonstrations it copies.
      </P>
      <Formula tex="minimise  Σₜ ‖ π(oₜ) − aₜ ‖²">
        π is the policy, oₜ the observation at step t, aₜ the action the expert actually took. Real systems use fancier losses (diffusion and flow matching handle the fact that two different actions can both be right), but the shape is the same: an observation in, the expert’s action as the answer.
      </Formula>
      <P>
        So the data must come in <b>pairs</b>: what the robot saw, and exactly what it did, recorded at the same instant, on hardware close to the robot that will use the policy. A demonstration of a robot picking up a mug at 50 Hz for ten seconds is 500 such pairs.
      </P>
      <H>Why language models had it easy</H>
      <P>
        A language model is trained to predict the next word (more precisely, the next token). Every sentence anyone ever wrote is a free worked example: the words so far are the question and the next word is the answer. Nobody had to label anything, which is why models could be trained on 15 to 36 trillion tokens of text that already existed.
      </P>
      <H>Why video doesn’t help directly</H>
      <P>
        The internet is full of videos of people cooking, cleaning and folding clothes. But a video records only pixels. It has none of the motor commands, forces or contact states behind the motion. That missing piece is the <b>action label</b>, and it is the core asymmetry with language. You felt it in the jar play: you can see the fingers move, but not how hard each one squeezes, and the fingers you can’t see at all may be doing most of the work.
      </P>
      <P>
        Motion is not force. A finger that is pressing hard against a lid barely moves; a finger that moves a lot may be pressing lightly. Watching a video, you mostly see the wrong thing.
      </P>
      <Note title="A preview of the workarounds">
        Researchers are trying to squeeze actions out of video anyway. One idea is <b>latent actions</b>: learn a small vocabulary of “what changed between this frame and the next” from video alone, pretrain a policy to predict those codes, then map them to real robot actions with a little labelled data. LAPA (2024) did this and beat the OpenVLA model by 6.2 percentage points on real tabletop tasks while using about 272 H100 GPU-hours of pretraining compared with OpenVLA’s 21,500 A100-hours. Another idea is to estimate 3D hand poses from video and treat them as actions. Both are covered later in this branch; neither recovers forces.
      </Note>
      <Numbers
        items={[
          ['50 Hz', 'π0’s control rate, with chunks of 50 actions'],
          ['15–36 T', 'tokens of text behind Llama 3 and Qwen3'],
          ['0', 'action labels in an ordinary internet video'],
        ]}
      />
      <Think q="Why not just put a camera on a person’s head and record everything they do with their hands?">
        You would get the observation side (roughly what they saw) and, with good hand tracking, the motion of their fingers. You would still be missing the forces, and the body is wrong: a human hand has about 27 degrees of freedom including the wrist, while robot hands range from a 1-DoF gripper to about 22. Turning human motion into robot actions (retargeting) loses information. That trade is what chapter 4 and the next film are about.
      </Think>
      <Sources
        items={[
          ['π0: a vision-language-action flow model (Physical Intelligence, 2024)', 'https://arxiv.org/html/2410.24164v3'],
          ['LAPA: latent action pretraining from videos (2024)', 'https://arxiv.org/abs/2410.11758'],
          ['Sergey Levine: Sporks of AGI (2025)', 'https://sergeylevine.substack.com/p/sporks-of-agi'],
          ['Llama 3 technical report (2024)', 'https://arxiv.org/abs/2407.21783'],
          ['Qwen3 technical report (2025)', 'https://arxiv.org/abs/2505.09388'],
          ['Genie: generative interactive environments (2024)', 'https://arxiv.org/abs/2402.15391'],
        ]}
      />
    </>
  )
}

export const PolicyReading: Reading = {
  id: 'policy',
  title: 'What a robot policy is, and what it eats',
  blurb: 'Observations, actions, control rates, behaviour cloning, and why video has no action labels.',
  minutes: 6,
  Body: PolicyBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 2: the scale gap                                             */
/* ------------------------------------------------------------------ */

const LOGBARS: [string, number, string][] = [
  ['LLM text (Llama 3)', 250000, C.paper],
  ['Dactyl, in simulation', 13000, C.cyan],
  ['GEN-1 (wearables)', 57, C.lime],
  ['GEN-0', 31, C.lime],
  ['one childhood (awake)', 11.4, C.keyLight],
  ['π0', 1.14, C.lime],
  ['DROID', 0.04, C.lime],
]

function ScaleBody() {
  return (
    <>
      <Lede>Every number behind the chapter: how much text a language model reads, how much experience the biggest robot datasets hold, and how to compare the two honestly.</Lede>
      <H>The corpora, side by side</H>
      <P>Sizes as reported by the people who built them. “Hours” for robot and video data are hours of recorded experience; text has no hours, so it is converted below.</P>
      <Table
        rows={[
          ['Corpus', 'Size', 'Hours', 'When'],
          ['Llama 3 pretraining', '~15 trillion tokens', '–', 'Jul 2024'],
          ['Qwen3 pretraining', '~36 trillion tokens', '–', 'May 2025'],
          ['Ego4D (human video, no actions)', '931 wearers, 74 places', '3,670', '2021'],
          ['Open X-Embodiment', '1M+ trajectories, 22 robot types, 21+ labs', 'not cleanly reported', 'Oct 2023'],
          ['DROID', '76k trajectories, 564 scenes, 13 labs, ~12 months', '350', 'Mar 2024'],
          ['π0 pretraining', '903M timesteps, 7 robot setups, 68 tasks', '~10,000', 'Oct 2024'],
          ['AgiBot World', '1,001,552 trajectories', '~2,976', 'Mar 2025'],
          ['EgoDex (Apple Vision Pro hand tracking)', '338k trajectories, 194 tasks', '829', 'May 2025'],
          ['Build AI Egocentric-10K', '2,153 factory workers, 1.08B frames', '10,000', 'Nov 2025'],
          ['Generalist GEN-0', 'real-world manipulation, growing 10k h/week', '270,000', 'Nov 2025'],
          ['NVIDIA EgoScale', 'action-labelled egocentric human video', '20,854', 'Feb 2026'],
          ['Generalist GEN-1', 'all from human-worn wearables, no robot data', '~500,000', 'Apr 2026'],
          ['EgoSuite-Open100K', 'egocentric, hand and body pose, 15k+ tasks', '100,000', 'Aug 2026'],
          ['NeoData (touch)', 'synced vision + touch, 6 embodiments', '30,000+', 'Sep 2026 preprint'],
        ]}
      />
      <H>Turning text into years</H>
      <P>
        15 trillion tokens is roughly 11 trillion words. A person reading 250 words a minute for 8 hours a day gets through about 120,000 words a day. That is about 90 million days, or roughly <b>250,000 years</b> of full-time reading: some 3,000 eighty-year lifetimes. Qwen3’s 36 trillion tokens is about 2.4 times more. For comparison, a child hears somewhere around 10 to 100 million words growing up, so a language model sees on the order of 100,000 times more language than a person does.
      </P>
      <H>Turning robot hours into years</H>
      <List
        items={[
          'DROID’s 350 hours ≈ 15 days of continuous experience.',
          'π0’s 10,000 hours ≈ 1.1 years continuous, or about 5 full-time working years.',
          'GEN-0’s 270,000 hours ≈ 31 years; GEN-1’s ~500,000 hours ≈ 57 years.',
          'A person has about 100,000 waking hours by age 18 (≈ 11 years of continuous time), a large share of it using their hands.',
        ]}
      />
      <Figure caption="Experience on a log scale: each gridline is ×10. Text and simulation sit thousands of times above real robot data.">
        <svg viewBox="0 0 600 270" role="img" aria-label="Log-scale bars: LLM text 250,000 years, Dactyl simulation 13,000 years, GEN-1 57 years, GEN-0 31 years, one childhood 11 years, pi-zero 1.1 years, DROID 15 days.">
          <rect width={600} height={270} fill={C.ink1} />
          {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((d) => {
            const x = 190 + ((d + 2) / 8) * 390
            return (
              <g key={d}>
                <line x1={x} x2={x} y1={14} y2={236} stroke={C.slate} strokeOpacity={0.6} strokeDasharray="2 4" />
                <text x={x} y={254} fill={C.mist} fontSize={10} textAnchor="middle">
                  {['4 d', '5 wk', '1 yr', '10', '100', '1k', '10k', '100k', '1M yr'][d + 2]}
                </text>
              </g>
            )
          })}
          {LOGBARS.map(([t, y, c], i) => {
            const w = ((Math.log10(y) + 2) / 8) * 390
            return (
              <g key={t}>
                <text x={182} y={36 + i * 31} fill={c} fontSize={12} textAnchor="end">
                  {t}
                </text>
                <rect x={190} y={24 + i * 31} width={Math.max(2, w)} height={18} rx={3} fill={c} opacity={0.85} />
              </g>
            )
          })}
        </svg>
      </Figure>
      <P>
        Put together: the largest manipulation datasets of 2026 hold a few human childhoods of hand experience, while language models read thousands of lifetimes of text. Measured against what one person gets, robot data is roughly three to four orders of magnitude “behind” text. And yet people learn to use their hands from one childhood, so raw volume can’t be the whole story. Whether robots can learn with anything like human efficiency is an open question.
      </P>
      <H>Another way to count: timesteps</H>
      <P>
        Hours hide how many training examples there are. π0’s 903 million timesteps over about 10,000 hours works out to an effective ~25 Hz. A 500,000-hour corpus at 25 to 50 Hz holds roughly 45 to 90 billion action steps. Counted like tokens, that is within one or two orders of magnitude of the text used for GPT-2-era models, which is why Generalist framed its results as robotics’ “GPT-2 moment”. Steps are not tokens (neighbouring steps are nearly identical), so treat this as a rough analogy, not an equivalence.
      </P>
      <H>Simulation is the one thing in text’s league</H>
      <P>
        OpenAI’s Dactyl hand learned to manipulate a Rubik’s Cube with about <b>13,000 years</b> of simulated experience, generated on 64 GPUs and 920 CPU workers. Simulation is effectively free per sample, but the catch is the reality gap: contact, friction and touch are exactly what simulators get wrong, and Dactyl still succeeded only about 60% of the time on typical scrambles and about 20% on the hardest (figures from OpenAI’s blog; treat as approximate).
      </P>
      <Note title="Company numbers">
        GEN-0 and GEN-1 hours come from Generalist’s own blog posts, not peer-reviewed papers. The 270,000-hour figure is GEN-0’s pretraining corpus; GEN-1’s ~500,000 hours are all from wearables worn by people, with no robot data in pretraining. The year conversions are back-of-envelope arithmetic.
      </Note>
      <Think q="If a person learns hand skills from about 100,000 waking hours, why might a robot need more?">
        A child’s experience comes with touch on every surface, a body that never changes, feedback from every mistake, and evolution’s head start (hundreds of millions of years of tuning). Robot datasets are mostly vision and joint angles with no touch, recorded across many different bodies, and mostly of success rather than recovery. It is not obvious robots need more; it is obvious their hours are poorer.
      </Think>
      <Sources
        items={[
          ['DROID: a large-scale in-the-wild robot dataset (2024)', 'https://arxiv.org/abs/2403.12945'],
          ['π0 paper (2024)', 'https://arxiv.org/html/2410.24164v3'],
          ['Generalist GEN-0 (Nov 2025)', 'https://generalistai.com/blog/gen-0'],
          ['Generalist GEN-1 (Apr 2026)', 'https://generalistai.com/blog/apr-02-2026-GEN-1'],
          ['AgiBot World (2025)', 'https://arxiv.org/abs/2503.06669'],
          ['Open X-Embodiment (2023)', 'https://arxiv.org/abs/2310.08864'],
          ['Ego4D (2021)', 'https://arxiv.org/abs/2110.07058'],
          ['EgoDex (2025)', 'https://arxiv.org/abs/2505.11709'],
          ['Egocentric-10K (Build AI)', 'https://www.humanoidsdaily.com/news/build-ai-open-sources-10-000-hours-of-factory-worker-video-to-scale-robot-learning'],
          ['NVIDIA EgoScale (2026)', 'https://arxiv.org/html/2602.16710'],
          ['EgoSuite-Open100K', 'https://humanoidroboticstechnology.com/industry-news/lightwheel-and-hugging-face-release-egosuite-open100k/'],
          ['NeoData tactile preprint (2026)', 'https://www.alphaxiv.org/abs/2608.29601'],
          ['“Robotics has its GPT-2 moment”', 'https://theahura.substack.com/p/tech-things-robotics-has-its-gpt2'],
          ['OpenAI Rubik’s Cube (Synced summary)', 'https://syncedreview.com/2019/10/15/openai-robot-hand-today-rubiks-cube-tomorrow-the-real-world/'],
        ]}
      />
    </>
  )
}

export const ScaleReading: Reading = {
  id: 'scale',
  title: 'The scale gap, in numbers',
  blurb: 'Every dataset size, the lifetime conversions, the timesteps view, and where simulation fits.',
  minutes: 7,
  Body: ScaleBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 3: inside a data factory                                     */
/* ------------------------------------------------------------------ */

function FactoryBody() {
  return (
    <>
      <Lede>Robot data is manufactured, often in halls full of robots and the people who puppet them. What those places look like, what an hour of their output really costs, and who sells it.</Lede>
      <H>China’s state-backed centres</H>
      <P>
        China opened its first humanoid training base in Shanghai in January 2025. A Beijing centre of more than 10,000 square metres with 16 mock scenarios (kitchens, laundry, retail shelves) opened in October 2025. By December 2025, more than 40 state-owned data-collection centres had been announced and about two dozen were running; one in Hubei operates nearly 100 humanoids. Trainers wear VR headsets and arm exoskeletons and repeat the same chores, opening microwaves, folding, ironing, wiping, hundreds of times a day. Some describe themselves as “cyber-labourers”.
      </P>
      <P>
        Not everyone thinks brute force will get there. The roboticist Ken Goldberg: “Even if you have hundreds of people working, it’s going to take a long time to get enough data.”
      </P>
      <H>A collected hour is not an operator hour</H>
      <P>
        An analysis of AgiBot’s facility shows the gap between clock time and useful data. The AgiBot World trajectories average <b>10.7 seconds</b> each, so its million-plus trajectories add up to only about 3,000 hours. A station produced about 200 clips a day, which is roughly <b>36 minutes</b> of recorded trajectory per robot per day (a reporter’s observation from June 2025). The whole facility produced 1,000 to 3,700 clips a day: 3 to 11 hours of trajectory.
      </P>
      <Figure caption="Where a station’s day goes (illustrative, built from the reported 36 minutes of recording). Most of the time is not recording.">
        <svg viewBox="0 0 600 150" role="img" aria-label="A bar for an 8-hour shift: a thin lime sliver of 36 minutes of recording, and the rest resets, setup, failures and waiting.">
          <rect width={600} height={150} fill={C.ink1} />
          <rect x={30} y={40} width={540} height={34} rx={4} fill="#3b465a" />
          <rect x={30} y={40} width={40.5} height={34} rx={4} fill={C.lime} />
          <rect x={360} y={40} width={50} height={34} fill="#a8332c" />
          <rect x={220} y={40} width={36} height={34} fill="#252e3e" />
          <text x={50} y={100} fill={C.lime} fontSize={13} textAnchor="middle">36 min recorded</text>
          <text x={150} y={30} fill={C.mist} fontSize={12} textAnchor="middle">resets and setup</text>
          <text x={238} y={100} fill={C.mist} fontSize={12} textAnchor="middle">waiting</text>
          <text x={385} y={100} fill={C.danger} fontSize={12} textAnchor="middle">faults, failed takes</text>
          <text x={570} y={130} fill={C.fog} fontSize={11} textAnchor="end">one 8-hour shift</text>
        </svg>
      </Figure>
      <P>Counting everything (operators, robots sitting idle, robot depreciation, resets, failures), the analysis puts the fully loaded cost at:</P>
      <List
        items={[
          'about ¥740–890 per trajectory-hour at the busiest stations’ utilisation;',
          <span key="f"><b>¥3,990–4,800 (about $550–670) per trajectory-hour</b> at facility-wide utilisation, including robot depreciation. That is the figure on the price tag in the film.</span>,
        ]}
      />
      <H>Market prices</H>
      <P>Quotes for a collected hour of teleoperation in 2026 (vendor and analyst estimates, not audited):</P>
      <Table
        rows={[
          ['Source', 'Price per collected hour'],
          ['US teleoperation', '~$90–150, fully loaded'],
          ['China teleoperation', '¥500–1,000 (~$70–145)'],
          ['Offshore bimanual teleop', '$40–80'],
          ['Egocentric wearable capture', '$25–60'],
        ]}
      />
      <P>
        The gap between a quoted “collected hour” and the cost per usable hour is about five times in the AgiBot analysis. Throughput guides suggest 30 to 60 short pick-and-place episodes per operator-hour, 10 to 20 for long tasks like folding, or about 240 episodes in a six-hour shift (vendor estimate). Not every episode is usable: failed, hesitant or inconsistent demos are often thrown away, and public numbers on that quality yield are scarce.
      </P>
      <H>Who sells robot data</H>
      <P>A new industry has grown around collection. Funding figures below come from a secondary guide and are partly unverified:</P>
      <List
        items={[
          'Scale AI sells robot data to Physical Intelligence, Generalist and others.',
          'XDOF: teleoperation plus wearables, $70M raised, 130k+ episodes.',
          'Tacta Systems: sensorised gloves on production lines, $75M.',
          'Mecka: body sensors and iPhones, about $68M, reportedly sells to 1X.',
          'Micro1: egocentric gig work in 50+ countries; claims 160k+ hours submitted a month, and buyer spend above $100M a year (CEO claim).',
          'Lightwheel: simulation assets, about $280M.',
          'AgiBot itself claims “millions” of real samples and a programme aiming at “tens of millions of hours” in 2026 (company claim, unverified).',
        ]}
      />
      <Note title="The real metric">
        Cost per collected hour hides resets, rejections and idle time, and even cost per usable hour is not what matters. What matters is cost per unit of improvement in the robot, and almost nobody publishes it. A rough budget for a million hours: about $100M at $100 an hour, about $600M at fully loaded facility rates, about $40M at $40 an hour for egocentric capture.
      </Note>
      <Numbers
        items={[
          ['10.7 s', 'average AgiBot World clip'],
          ['36 min', 'recorded per station per day'],
          ['$550–670', 'per usable hour, fully loaded'],
          ['40+', 'state-backed data centres announced in China'],
        ]}
      />
      <Think q="Why might a teleoperation farm in a few big halls produce less useful data than its hours suggest?">
        Because diversity matters more than repetition. Scaling studies (Lin et al., 2024) found that a policy’s ability to work in new places grows with the number of distinct environments and objects, while extra demos in the same environment saturate quickly. A farm repeats tasks in a handful of staged rooms; a home robot will meet thousands of kitchens.
      </Think>
      <Sources
        items={[
          ['What a robot hour actually costs (analysis of AgiBot)', 'https://insidecm.substack.com/p/what-a-robot-hour-actually-costs'],
          ['Rest of World: inside China’s robot training centres (2026)', 'https://restofworld.org/2026/china-robots-training-centers-workers/'],
          ['Beijing training centre opening (Oct 2025)', 'https://english.beijing.gov.cn/latest/news/202510/t20251009_4216190.html'],
          ['Robotics training data: prices and vendors', 'https://www.teahose.com/guides/robotics-training-data'],
          ['Teleoperation rig costs and throughput', 'https://www.roboticscenter.ai/guides/teleoperation-rig-cost/'],
          ['AgiBot strategy (TechNode, Aug 2026)', 'https://technode.com/2026/08/17/robot-companies-are-becoming-ai-companies-as-agibot-reveals-the-new-logic-of-embodied-ai-competition/'],
          ['Data scaling laws in imitation learning (Lin et al., 2024)', 'https://arxiv.org/html/2410.18647v3'],
        ]}
      />
    </>
  )
}

export const FactoryReading: Reading = {
  id: 'data-factories',
  title: 'Inside a data factory',
  blurb: 'China’s training centres, the 36-minute day, what a usable hour costs, and who sells robot data.',
  minutes: 7,
  Body: FactoryBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 4: the five sources                                          */
/* ------------------------------------------------------------------ */

function SourcesBody() {
  return (
    <>
      <Lede>Five ways to make robot data, each a different bargain between cost, fidelity to the robot’s body, and the variety of places and things it covers.</Lede>
      <H>The triangle</H>
      <P>
        The hardware of a hand has its iron triangle: dexterity, robustness, cost. Data has one too. <b>Fidelity</b> is how close the recording is to the robot that will use it: same body, same cameras, same forces. <b>Diversity</b> is how many different homes, objects, lighting conditions and people it covers. <b>Cost</b> is money and time per useful hour. Real robot data has perfect fidelity and is slow and expensive; human video is nearly free and endlessly varied but records the wrong body and no forces. Every lab’s strategy is a mix.
      </P>
      <Figure caption="Where each source roughly sits. Positions are qualitative, for intuition.">
        <svg viewBox="0 0 600 300" role="img" aria-label="A triangle with corners cheap, true to the robot, and diverse. Teleoperation near true; robot practice near true; simulation in the middle; wearables between cheap and diverse; human video at cheap and diverse.">
          <rect width={600} height={300} fill={C.ink1} />
          <path d="M300 30 L540 260 L60 260 Z" fill={C.lime} fillOpacity={0.05} stroke={C.lime} strokeWidth={2} />
          <text x={300} y={20} fill={C.limeLight} fontSize={14} textAnchor="middle">true to the robot</text>
          <text x={52} y={282} fill={C.gold} fontSize={14}>cheap</text>
          <text x={548} y={282} fill={C.cyanLight} fontSize={14} textAnchor="end">diverse</text>
          {[
            [300, 80, '1 teleop'],
            [335, 125, '5 practice'],
            [300, 170, '4 sim'],
            [210, 215, '2 wearables'],
            [380, 248, '3 human video'],
          ].map(([x, y, t]) => (
            <g key={t as string}>
              <circle cx={x as number} cy={y as number} r={7} fill={C.lime} />
              <text x={(x as number) + 12} y={(y as number) + 5} fill={C.paper} fontSize={13}>
                {t}
              </text>
            </g>
          ))}
        </svg>
      </Figure>
      <H>The summary table</H>
      <Table
        rows={[
          ['Method', 'Hardware', 'Cost per collected hour', 'Body gap', 'Diversity', 'Touch / force', 'Best for'],
          ['Leader–follower teleop', '$300 (GELLO) to ~$30k (Mobile ALOHA) + robot', '$90–150 US; ~$70–145 China; up to ~$550–670 fully loaded', 'none', 'low–medium (staged rooms)', 'partial', 'fine two-handed work, post-training'],
          ['VR / glove teleop', '+$3–10k', 'similar', 'none on the robot side', 'low–medium', 'usually none', 'humanoids, dexterous hands'],
          ['Handheld / wearable (UMI, DexUMI, gloves)', '$200–$1k', 'low tens of $ (unverified)', 'small–medium', 'high (any home)', 'only if instrumented', 'in-the-wild pretraining'],
          ['Egocentric human video', '$100s (glasses, head cams)', '$25–60 (vendor)', 'large', 'very high', 'none', 'pretraining, task meaning, navigation'],
          ['Internet video', '$0', '~$0 + compute', 'very large, no labels', 'highest', 'none', 'latent actions, world models'],
          ['Simulation', 'GPUs + building assets', 'near-zero per hour, high setup', 'sim-to-real gap', 'whatever people author', 'poor', 'walking, multiplying demos, evaluation'],
          ['Robot practice, fleets, RL', 'deployed robots', 'low human cost', 'none', 'depends on deployment', 'robot’s own sensors', 'reliability, the long tail'],
        ]}
      />
      <H>One line on each</H>
      <List
        items={[
          <span key="1"><b>Teleoperation.</b> A human drives the real robot; the commands sent are the action labels. ALOHA-style rigs cost under $20k; GELLO builds 3D-printed leader arms for under $300. The limits are resets, operator fatigue, no touch feedback (operators over-squeeze or go slow), and that it can’t go into millions of homes.</span>,
          <span key="2"><b>Wearables.</b> Give a person a device shaped like the robot’s hand. UMI is a ~$73 3D-printed gripper plus a ~$298 GoPro and collected data more than 3× faster than teleop; its cup-arranging policy hit 71.7% in unseen places, where a lab-trained one scored 0%. Sunday’s ~$200 glove versus ~$20k rigs (company figure); DexUMI reports 3.2× collection efficiency for multi-finger hands.</span>,
          <span key="3"><b>Human video.</b> EgoMimic found an hour of human video yields about 1,400 demos versus about 135 from an hour of teleop. Physical Intelligence reported that transfer from human video emerges once robot pretraining is diverse enough, roughly doubling performance on the tasks shown. The body gap and missing forces remain.</span>,
          <span key="4"><b>Simulation.</b> Labels are free and it runs faster than real time on GPUs. NVIDIA generated 780,000 synthetic trajectories in 11 hours, “equivalent to ~6,500 hours” of demos, seeded by humans. Contact, cloth and touch are where it fails; speed claims are often inflated (one simulator advertised 430,000× real time and measured about 10× with cameras in an independent test).</span>,
          <span key="5"><b>The robot’s own practice.</b> Let a decent robot work, have humans step in when it fails, and train on the corrections and outcomes. Physical Intelligence’s π*0.6 with RECAP more than doubled throughput on hard tasks and ran espresso for a full day at over 90% success. The catch is a cold start: you need a robot good enough to deploy first.</span>,
        ]}
      />
      <Note title="The emerging consensus (2025–2026)">
        Human data for breadth (“what to do” and coarse “how to move”), plus a thin layer of real robot data to ground it in a specific body. NVIDIA’s EgoScale needed only about 4 hours of robot data on top of 20,854 hours of human video for one-shot transfer; Generalist reports about 1 hour of robot data per task after pretraining. How thin “thin” can get is the open question of the whole branch.
      </Note>
      <Think q="A startup has $1M for data for a home robot. Why not spend it all on the cheapest source?">
        Because each source fills a different gap. Cheap video teaches what tasks look like but not how this robot’s fingers must press; teleop teaches exact actions but only in a few rooms; practice data needs a robot that already works. Studies keep finding that mixtures beat any single source (π0.5’s success in unseen homes fell from 94% with its full mixture to 31% with only its mobile home data), and that variety of places beats raw volume.
      </Think>
      <Sources
        items={[
          ['UMI: Universal Manipulation Interface (2024)', 'https://arxiv.org/abs/2402.10329'],
          ['DexUMI (2025)', 'https://arxiv.org/html/2505.21864v2'],
          ['Sunday: no robot data', 'https://www.sunday.ai/journal/no-robot-data'],
          ['GELLO (2023)', 'https://arxiv.org/abs/2309.13037'],
          ['ALOHA / ACT (2023)', 'https://arxiv.org/abs/2304.13705'],
          ['EgoMimic (2024)', 'https://arxiv.org/html/2410.24221v1'],
          ['NVIDIA EgoScale (2026)', 'https://arxiv.org/html/2602.16710'],
          ['GR00T N1.6 deep dive', 'https://www.naddod.com/ai-insights/a-deep-dive-into-pre-training-and-post-training-for-nvidia-isaac-gr00t-n1-6'],
          ['Genesis simulator speed check', 'https://stoneztao.substack.com/p/the-new-hyped-genesis-simulator-is'],
          ['π*0.6 and RECAP', 'https://www.pi.website/blog/pistar06'],
          ['π0.5 (co-training ablations)', 'https://www.pi.website/blog/pi05'],
          ['Human video transfer at Physical Intelligence', 'https://texxr.com/893927/physical-intelligence-improves-robot-vision-with-human-video'],
          ['Prices: robotics training data guide', 'https://www.teahose.com/guides/robotics-training-data'],
        ]}
      />
    </>
  )
}

export const SourcesReading: Reading = {
  id: 'sources',
  title: 'The five sources at a glance',
  blurb: 'Teleop, wearables, human video, simulation and practice: costs, body gap, diversity and touch, side by side.',
  minutes: 7,
  Body: SourcesBody,
}
