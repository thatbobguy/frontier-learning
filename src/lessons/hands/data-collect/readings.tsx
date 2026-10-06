import { C } from '../../../cine/palette'
import { Figure, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ================================================================== */
/* Chapter 1: teleoperation                                             */
/* ================================================================== */

function TeleopBody() {
  return (
    <>
      <Lede>How people drive robots to make training data, what the rigs cost, why the operator can’t feel anything, and why an hour of data costs far more than an hour of work.</Lede>
      <P>
        In teleoperation a person drives the real robot in real time. The robot’s own cameras and joint sensors record what it sees, and the commands the person sends become the “action labels”: the right answers the robot will later learn to copy. Because the data comes from the robot’s own body, nothing has to be translated from a human body to a robot body. That is why teleop is called the gold standard for fidelity. Everything else in this lesson is an attempt to get most of that quality for less money.
      </P>
      <H>Four ways to hold the strings</H>
      <List
        items={[
          <>
            <b>Leader–follower puppets.</b> The operator moves a small copy of the robot arm (the leader) and the real arm (the follower) copies it joint for joint. It is intuitive and fast, and the operator gets a little feel from the leader’s own joints. GELLO builds 3D-printed leader arms from hobby servos for under $300. Stanford’s ALOHA rig for two arms cost under $20,000; Mobile ALOHA, on a wheeled base, about $32,000.
          </>,
          <>
            <b>VR and XR headsets.</b> A headset tracks the operator’s head, wrists and fingers, the motion is retargeted onto the robot, and the robot’s stereo cameras stream back into the headset. It adds roughly $3,000–8,000 on top of the arms. The downsides: no force feedback, finger retargeting errors, and motion sickness.
          </>,
          <>
            <b>Data gloves and exoskeletons</b>, for many-fingered hands. Indicative 2026 prices run from about $500 (motion capture only) through $3,000–4,000 (Inspire glove, SenseGlove Nova 2) and $6,000 (Dexmo exoskeleton) to about $10,000 (HaptX G1, with microfluidic touch feedback).
          </>,
          <>
            <b>Whole-body motion-capture suits</b> for humanoids. Tesla reportedly used mocap suits plus VR for Optimus until mid-2025, then switched to workers wearing camera helmets and backpacks.
          </>,
        ]}
      />
      <Figure caption="Round-trip delay between the operator’s move and seeing the robot copy it. Thresholds are vendor estimates, for intuition.">
        <svg viewBox="0 0 600 170" role="img" aria-label="A latency scale: under 35 milliseconds feels natural, above 50 milliseconds feels laggy.">
          <rect width={600} height={170} fill={C.ink1} />
          <rect x={40} y={70} width={520} height={18} rx={9} fill={C.ink3} />
          <rect x={40} y={70} width={182} height={18} rx={9} fill={C.lime} opacity={0.8} />
          <rect x={300} y={70} width={260} height={18} rx={9} fill={C.danger} opacity={0.7} />
          {[0, 25, 50, 75, 100].map((ms) => (
            <g key={ms}>
              <line x1={40 + ms * 5.2} y1={92} x2={40 + ms * 5.2} y2={102} stroke={C.mist} />
              <text x={40 + ms * 5.2} y={120} fill={C.mist} fontSize={13} textAnchor="middle">
                {ms} ms
              </text>
            </g>
          ))}
          <text x={40} y={55} fill={C.lime} fontSize={15}>
            under ~35 ms: feels natural
          </text>
          <text x={560} y={55} fill={C.danger} fontSize={15} textAnchor="end">
            over ~50 ms: laggy
          </text>
          <text x={40} y={150} fill={C.mist} fontSize={13}>
            leader–follower benches: ~10–20 ms · VR: ~20–35 ms
          </text>
        </svg>
      </Figure>
      <H>The haptics problem</H>
      <P>
        Most teleop gives the operator vision and nothing else. Without force feedback, operators over-squeeze, crush or drop things, and they struggle with steps that depend on feel: pushing a plug into a socket, wiping, rolling an object in the fingers. There is a subtler cost too. Operators make up for the missing touch by moving slowly and carefully, watching everything. The robot then learns those slow, hesitant habits, because hesitation is what the data contains. Haptic gloves help: one vendor claims 30–40% fewer failed grasps with feedback, though that figure is unverified.
      </P>
      <H>Throughput: the collected hour is not the operator hour</H>
      <P>
        A practised operator manages roughly 30–60 short pick-and-place episodes an hour, or 10–20 long ones like folding. The market price for a collected hour of US teleop is about $90–150, fully loaded; China’s market runs ¥500–1,000 (about $70–145).
      </P>
      <P>
        But those are hours of operator time. An analysis of AgiBot’s data facility in China shows how much less trajectory you actually get. Its trajectories average 10.7 seconds. A station produced about 200 clips a day, which is roughly 36 minutes of usable motion per robot per day; most of the operator’s day goes on resets, setup, failures and robots sitting idle. Counting robot depreciation at facility-wide utilisation, the analysis puts the cost at about $550–670 per hour of trajectory.
      </P>
      <Numbers
        items={[
          ['< $300', 'GELLO 3D-printed leader arms'],
          ['~$32k', 'Mobile ALOHA, two arms on a wheeled base (2024)'],
          ['$90–150', 'per collected hour of US teleop (2026 market estimate)'],
          ['~36 min', 'of usable trajectory per robot per day at one Chinese data factory'],
          ['$550–670', 'per trajectory-hour, fully loaded, at that facility'],
        ]}
      />
      <H>Data farms</H>
      <P>
        China has gone furthest. The first state-backed humanoid training base opened in Shanghai in January 2025; by December 2025 more than 40 state-owned data-collection centres had been announced and about two dozen were running. Trainers in VR headsets and arm exoskeletons repeat opening microwaves, folding and wiping “hundreds of times daily”. Even so, Berkeley’s Ken Goldberg is sceptical: “Even if you have hundreds of people working, it’s going to take a long time to get enough data.”
      </P>
      <Note title="The real limit is diversity, not quality">A teleop farm repeats tasks in a handful of staged rooms. Studies of robot scaling in 2024 found that the number of different environments matters more than the number of demonstrations in each. Teleop gives you the best data per hour, from too few places.</Note>
      <Think q="Why might a robot trained on careful, slow teleop demos be worse than its operator?">
        The operator was slow because they couldn’t feel the object, not because slowness is the right strategy. The robot copies the behaviour, not the reason, so it inherits the caution without the eyes and judgement that made the caution safe.
      </Think>
      <Sources
        items={[
          ['ALOHA (Zhao et al., 2023)', 'https://arxiv.org/abs/2304.13705'],
          ['Mobile ALOHA (2024)', 'https://arxiv.org/html/2401.02117v1'],
          ['GELLO (2023)', 'https://arxiv.org/abs/2309.13037'],
          ['Open-TeleVision (2024)', 'https://arxiv.org/abs/2407.01512'],
          ['Teleoperation rig cost guide (vendor estimates)', 'https://www.roboticscenter.ai/guides/teleoperation-rig-cost/'],
          ['Glove-based dexterous teleoperation guide (vendor estimates)', 'https://roboticscenter.ai/guides/glove-based-dexterous-teleoperation-guide'],
          ['What a robot hour actually costs (AgiBot analysis)', 'https://insidecm.substack.com/p/what-a-robot-hour-actually-costs'],
          ['Robotics training data market guide', 'https://www.teahose.com/guides/robotics-training-data'],
          ['Rest of World: China’s robot training centres', 'https://restofworld.org/2026/china-robots-training-centers-workers/'],
          ['eWeek: Tesla Optimus training', 'https://www.eweek.com/news/tesla-optimus-robot-training/'],
        ]}
      />
    </>
  )
}

export const TeleopReading: Reading = {
  id: 'teleop',
  title: 'Teleoperation in depth',
  blurb: 'Leader arms, VR and gloves; what the rigs cost, why lag and missing touch matter, and the real price of an hour.',
  minutes: 6,
  Body: TeleopBody,
}

/* ================================================================== */
/* Chapter 2: wearables                                                 */
/* ================================================================== */

function WearablesBody() {
  return (
    <>
      <Lede>Take the robot out of data collection: give a person a device that matches the robot, record what the robot would have seen and done, and carry it into thousands of real homes.</Lede>
      <H>UMI: the handheld gripper</H>
      <P>
        The Universal Manipulation Interface (Stanford and Columbia, February 2024) is a 3D-printed handheld copy of a two-jawed gripper, about $73 in parts, carrying a GoPro with a 155° fisheye lens (about $298). Mirrors at the sides give the camera a second viewpoint for depth. Software (ORB-SLAM3) fuses the video with the GoPro’s motion sensor to recover the gripper’s full path in space, and that path becomes the action label.
      </P>
      <P>Three design choices make it transfer:</P>
      <List
        items={[
          <>
            <b>The same camera rides on the robot’s wrist</b>, so at run time the robot sees exactly what the data showed.
          </>,
          <>
            <b>Actions are relative</b>: “move 3 cm left of where you are now”, not “go to this spot in the room”, so it doesn’t matter where the robot’s base stands.
          </>,
          <>
            <b>Latency is matched</b> between camera and robot, so the timing in the data is the timing the robot will live with.
          </>,
        ]}
      />
      <P>Collection was over three times faster than teleop, and a cup-arranging policy succeeded 71.7% of the time in places it had never seen.</P>
      <Figure caption="Every route from a person to a robot loses something. Wearables keep more than video because the device forces the human into the robot’s shape.">
        <svg viewBox="0 0 600 210" role="img" aria-label="A chart of cost per hour against how well the data fits the robot: teleop is costly and faithful, gloves cheaper and fairly faithful, video cheapest and least faithful.">
          <rect width={600} height={210} fill={C.ink1} />
          <line x1={60} y1={175} x2={570} y2={175} stroke={C.fog} />
          <line x1={60} y1={175} x2={60} y2={20} stroke={C.fog} />
          <text x={315} y={200} fill={C.mist} fontSize={13} textAnchor="middle">
            cost per collected hour →
          </text>
          <text x={30} y={98} fill={C.mist} fontSize={13} textAnchor="middle" transform="rotate(-90 30 98)">
            fits the robot →
          </text>
          {[
            ['head-camera video', 120, 150],
            ['gloves, UMI, DexUMI', 250, 80],
            ['teleop', 500, 35],
          ].map(([t, x, y]) => (
            <g key={t as string}>
              <circle cx={x as number} cy={y as number} r={8} fill={C.lime} />
              <text x={(x as number) + 14} y={(y as number) + 5} fill={C.limeLight} fontSize={14}>
                {t}
              </text>
            </g>
          ))}
          <text x={500} y={60} fill={C.gold} fontSize={12} textAnchor="middle">
            $90–150/h
          </text>
          <text x={120} y={128} fill={C.gold} fontSize={12} textAnchor="middle">
            $25–60/h
          </text>
        </svg>
      </Figure>
      <H>DexUMI: the same trick for fingers</H>
      <P>
        DexUMI (2025) extends the idea to many-fingered hands. For each robot hand (the 6-motor Inspire hand, the 12-motor XHand) the team co-designed a wearable exoskeleton so that whatever the human fingers do maps onto motions that robot hand can actually make. Joint sensors on the exoskeleton read the actions directly. To close the visual gap, video inpainting paints the human hand out of every frame and a rendered robot hand in. The result: 86% average success on four tasks, and 3.2× the data-collection efficiency of teleop.
      </P>
      <H>Sunday’s glove, and data with no robot in it</H>
      <P>
        In November 2025 Sunday Robotics described a ~$200 “Skill Capture Glove” matched to its robot’s hand, against roughly $20,000 for a teleop rig. It shipped more than 2,000 gloves to people in over 500 homes and reports 10 million+ episodes. A “Skill Transform” step converts glove recordings into robot data at about 90% success. Its ACT-1 model was trained on zero teleop data, loads dishwashers, and was dropped into six Airbnbs it had never seen. These are company figures.
      </P>
      <P>
        Generalist AI went further. GEN-0 (November 2025) trained on 270,000 hours collected with thousands of devices and robots; GEN-1 (April 2026) on about 500,000 hours, and its pretraining contained no robot data at all, only “low-cost wearable devices on humans doing millions of activities”. And in September 2026 a preprint called NeoData described a UMI with vision-based touch sensors: more than 30,000 hours of synced video and touch, the first try at touch data at that scale (not yet peer-reviewed).
      </P>
      <Numbers
        items={[
          ['~$371', 'UMI: $73 gripper + $298 GoPro'],
          ['71.7%', 'UMI cup arrangement in unseen environments'],
          ['3.2×', 'DexUMI collection efficiency vs teleop'],
          ['2,000+ / 500+', 'Sunday gloves shipped / homes (company figures)'],
          ['500,000 h', 'Generalist GEN-1 corpus, all from wearables'],
        ]}
      />
      <H>The spork</H>
      <P>
        The catch is that a glove is not the robot. The human arm has different reach, strength and speed, so some recorded motions are impossible for the robot. Tracking can fail, and nothing records force unless you add sensors. Sergey Levine calls surrogate data a “spork”: it forces a policy into the narrow overlap of what works on the device and what works on the robot, and the stronger learning gets, the more it notices and exploits the differences.
      </P>
      <Note title="Constrain the human, not the robot">The lesson of UMI and DexUMI is that a device earns its data by limiting the person: two jaws instead of five fingers, an exoskeleton that only bends where the robot bends. More freedom for the human means more motions the robot can’t replay.</Note>
      <Think q="Why put the same camera on the robot’s wrist instead of using a nicer camera for collection?">
        The policy learns from pictures. If the pictures at collection time look different from the pictures at run time (another lens, angle or field of view), the robot is effectively seeing a new world. Matching the camera is the cheapest way to make the data look like the robot’s own.
      </Think>
      <Sources
        items={[
          ['UMI (Chi et al., 2024)', 'https://arxiv.org/abs/2402.10329'],
          ['DexUMI (2025)', 'https://arxiv.org/html/2505.21864v2'],
          ['Sunday Robotics: no robot data', 'https://www.sunday.ai/journal/no-robot-data'],
          ['The Neuron: Sunday’s glove explained', 'https://www.theneuron.ai/explainer-articles/this-home-robot-learned-to-do-your-dishes-from-10-million-real-family-routines'],
          ['Generalist GEN-0', 'https://generalistai.com/blog/gen-0'],
          ['Generalist GEN-1', 'https://generalistai.com/blog/apr-02-2026-GEN-1'],
          ['NeoData tactile UMI preprint', 'https://www.alphaxiv.org/abs/2608.29601'],
          ['Sergey Levine: Sporks of AGI', 'https://sergeylevine.substack.com/p/sporks-of-agi'],
        ]}
      />
    </>
  )
}

export const WearablesReading: Reading = {
  id: 'wearables',
  title: 'Robot-free collection: UMI, DexUMI and gloves',
  blurb: 'Handheld grippers, finger exoskeletons and $200 gloves: why matching the robot matters, and the spork critique.',
  minutes: 6,
  Body: WearablesBody,
}

/* ================================================================== */
/* Chapter 3: video and simulation                                      */
/* ================================================================== */

function VideoSimBody() {
  return (
    <>
      <Lede>The two cheapest sources of all: watching people, and imagining worlds on a computer. Both are nearly unlimited, and both leave a gap that something else has to close.</Lede>
      <H>Three routes from video to actions</H>
      <P>Video shows what happened but not the motor commands that made it happen. There are three main ways to get actions out of it.</P>
      <List
        items={[
          <>
            <b>Estimate the hand, then retarget.</b> Work out the wrist position and every finger joint from the video (or record them directly with a headset), then map them onto the robot. EgoDex recorded 829 hours with Apple Vision Pro’s hand tracking. EgoMimic found that one hour of a person wearing camera glasses gave about 1,400 demos, against about 135 from an hour of teleop, and that 2 hours of robot data plus 1 hour of hand data beat 3 hours of robot data. NVIDIA’s EgoScale used 20,854 hours and found a smooth scaling law: more human video kept helping. With about 4 hours of robot data on top, it gave one-shot transfer to new tasks on a 22-motor hand.
          </>,
          <>
            <b>Latent actions.</b> Skip hands entirely: teach a network to compress “what changed between this frame and the next” into a small vocabulary of codes, pretrain on those, then map the codes to real robot commands with a little labelled data. LAPA (2024) beat the OpenVLA model by 6.2% on real tabletop tasks, with about 272 GPU-hours of pretraining against OpenVLA’s 21,500.
          </>,
          <>
            <b>World model, then inverse dynamics.</b> Generate a video of the task being done, then use a second model to infer which actions would produce it. 1X’s world model (January 2026) reached 80–100% on familiar tasks but 0% on dexterous pouring and drawing.
          </>,
        ]}
      />
      <H>Four gaps between a human and a robot</H>
      <Table
        rows={[
          ['Gap', 'What differs'],
          ['Body (kinematic)', 'A human hand has ~27 degrees of freedom including the wrist; robot hands have 1 to ~22, with other finger lengths and thumb placement'],
          ['Dynamics', 'Muscles are springy and fast, skin feels everything; robots are stiffer, slower and mostly touch-blind'],
          ['Looks (visual)', 'A human hand in the frame looks nothing like a robot hand; fixes include painting it out'],
          ['Strategy', 'People use tricks robots can’t: fingernails, a palm braced on a wall'],
        ]}
      />
      <P>
        Despite all this, Physical Intelligence reported in December 2025 that human-to-robot transfer emerges with scale: once its π0.5 model had seen diverse enough robot data, adding human first-person video with 3D hand poses roughly doubled performance on the tasks in those videos, where robot-only training had levelled off. The shape of the curve in the film is illustrative; the “roughly double” is the lab’s own summary.
      </P>
      <H>Simulation: free hours, authored worlds</H>
      <P>
        A physics engine (MuJoCo, Isaac Sim, ManiSkill, Genesis) steps the world faster than real time on GPUs and knows the true state of everything, so labels and rewards come free. OpenAI’s Dactyl hand learned to manipulate a Rubik’s cube with about 13,000 years of simulated experience on 64 GPUs and 920 CPU workers. Its key trick was automatic domain randomisation: keep widening the ranges of friction, mass, cube size and motor strength until the real world looks like one more random sample. Even so, success was about 60% on typical scrambles and 20% on the hardest, and the move sequence came from a classic solver.
      </P>
      <Figure caption="Domain randomisation: train across a spread of slightly wrong worlds so the real one falls inside it.">
        <svg viewBox="0 0 600 200" role="img" aria-label="A scatter of simulated worlds by friction and mass, with the real world inside the cloud.">
          <rect width={600} height={200} fill={C.ink1} />
          <line x1={60} y1={170} x2={560} y2={170} stroke={C.fog} />
          <line x1={60} y1={170} x2={60} y2={20} stroke={C.fog} />
          <text x={310} y={194} fill={C.mist} fontSize={13} textAnchor="middle">
            friction →
          </text>
          <text x={30} y={95} fill={C.mist} fontSize={13} textAnchor="middle" transform="rotate(-90 30 95)">
            object mass →
          </text>
          {Array.from({ length: 70 }, (_, i) => {
            const a = i * 2.39996
            const r = 12 + ((i * 37) % 70)
            return <circle key={i} cx={310 + Math.cos(a) * r * 2.6} cy={95 + Math.sin(a) * r * 0.85} r={4} fill={C.cyan} opacity={0.5} />
          })}
          <circle cx={350} cy={110} r={9} fill={C.keyLight} stroke={C.ink} strokeWidth={2} />
          <text x={366} y={115} fill={C.keyLight} fontSize={14}>
            the real world
          </text>
        </svg>
      </Figure>
      <P>
        Simulation’s best manipulation trick is multiplying real demonstrations. MimicGen (2023) turned about 200 human demos into more than 50,000 across 18 tasks: it cuts each demo into object-centred pieces, replays them with the objects moved, and keeps only the copies that succeed in sim. NVIDIA reported generating 780,000 synthetic trajectories in 11 hours, which it equates to about 6,500 hours of human demos.
      </P>
      <H>Why contact is the weak spot</H>
      <P>
        Contact is all-or-nothing: things stick or slip, touch or don’t. Small errors in friction, stiffness or shape flip a grasp from hold to slip, and engines approximate contact for stability rather than accuracy. Cloth, food, cables and bags are slow and inaccurate to simulate, and they dominate home chores. Simulating what a touch sensor would feel needs detailed contact mechanics and per-sensor calibration, with little real data to check against.
      </P>
      <Note title="Check the speed claims">Genesis (December 2024) advertised 43 million frames per second, “430,000× real time”. An independent test with realistic settings (substeps, self-collisions, active robots) measured about 0.29 million, roughly 150× less, and with cameras rendering it ran at about 10× real time.</Note>
      <Numbers
        items={[
          ['1,400 vs 135', 'demos per hour: human camera glasses vs teleop (EgoMimic)'],
          ['20,854 h', 'human video in NVIDIA’s EgoScale scaling study'],
          ['~13,000 years', 'simulated practice for OpenAI’s Rubik’s cube hand'],
          ['~200 → 50,000', 'demos multiplied by MimicGen'],
          ['780k in 11 h', 'synthetic trajectories from NVIDIA’s GR00T pipeline'],
        ]}
      />
      <Think q="If simulation is free per hour, why isn’t all robot data synthetic?">
        Because the diversity has to be built by people: every object, room and randomisation range is authored. And the physics is least accurate exactly where hands work: contact, soft things and touch. Sim is cheap per sample but expensive per kind of world, and it can be confidently wrong.
      </Think>
      <Sources
        items={[
          ['EgoDex', 'https://arxiv.org/abs/2505.11709'],
          ['EgoMimic', 'https://arxiv.org/html/2410.24221v1'],
          ['EgoScale (NVIDIA, 2026)', 'https://arxiv.org/html/2602.16710'],
          ['LAPA: latent action pretraining', 'https://arxiv.org/html/2410.11758v1'],
          ['1X world model', 'https://1x.tech/discover/world-model-self-learning'],
          ['Physical Intelligence human-video transfer (report)', 'https://texxr.com/893927/physical-intelligence-improves-robot-vision-with-human-video'],
          ['Egocentric-10K', 'https://www.humanoidsdaily.com/news/build-ai-open-sources-10-000-hours-of-factory-worker-video-to-scale-robot-learning'],
          ['OpenAI: Solving Rubik’s Cube with a robot hand', 'https://openai.com/index/solving-rubiks-cube/'],
          ['MimicGen', 'https://arxiv.org/abs/2310.17596'],
          ['GR00T N1.6 deep dive', 'https://www.naddod.com/ai-insights/a-deep-dive-into-pre-training-and-post-training-for-nvidia-isaac-gr00t-n1-6'],
          ['Stone Tao: checking Genesis’s speed', 'https://stoneztao.substack.com/p/the-new-hyped-genesis-simulator-is'],
        ]}
      />
    </>
  )
}

export const VideoSimReading: Reading = {
  id: 'video-and-sim',
  title: 'Learning from video, and from simulation',
  blurb: 'Three ways to pull actions out of video, the four embodiment gaps, Dactyl, MimicGen, and why contact breaks simulators.',
  minutes: 7,
  Body: VideoSimBody,
}

/* ================================================================== */
/* Chapter 4: fleets and the budget                                     */
/* ================================================================== */

function FleetsBody() {
  return (
    <>
      <Lede>Why the robot’s own mistakes are the most valuable data, how labs learn from failures, and what a million hours would cost.</Lede>
      <H>The drift problem, and DAgger</H>
      <P>
        A robot trained only by copying demonstrations makes small errors. Each one puts it somewhere the demonstrator never went, where it knows even less, so errors compound. In 2011 Ross and colleagues proposed DAgger: run the learner, let the expert label the states the learner actually visits, add those labels to the data, and repeat. HG-DAgger (2019) made it practical for people: the human watches and takes over only when things go wrong, and the model trains on those takeovers.
      </P>
      <Figure caption="Demonstrations cover the path an expert takes. Interventions land where the robot actually drifts.">
        <svg viewBox="0 0 600 190" role="img" aria-label="An expert path, a robot path drifting away from it, and correction marks where a person stepped in.">
          <rect width={600} height={190} fill={C.ink1} />
          <path d="M40 150 C 160 140, 300 100, 560 40" fill="none" stroke={C.paper} strokeWidth={3} strokeDasharray="6 6" opacity={0.7} />
          <text x={420} y={40} fill={C.paper} fontSize={13} opacity={0.8}>
            the expert’s path
          </text>
          <path d="M40 150 C 140 150, 210 156, 260 168" fill="none" stroke={C.lime} strokeWidth={3} />
          <path d="M260 168 C 300 140, 330 110, 380 98" fill="none" stroke={C.lime} strokeWidth={3} />
          <path d="M380 98 C 420 100, 450 120, 480 128" fill="none" stroke={C.lime} strokeWidth={3} />
          <path d="M480 128 C 510 100, 530 70, 560 44" fill="none" stroke={C.lime} strokeWidth={3} />
          {[
            [260, 168],
            [480, 128],
          ].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={11} fill="none" stroke={C.danger} strokeWidth={2.5} />
              <text x={x} y={y + 30} fill={C.limeLight} fontSize={12} textAnchor="middle">
                correction
              </text>
            </g>
          ))}
          <text x={60} y={176} fill={C.lime} fontSize={13}>
            the robot’s path
          </text>
        </svg>
      </Figure>
      <P>
        That is why interventions are such valuable data. A demonstration mostly shows situations the robot already handles. A rescue is concentrated exactly on the robot’s failure modes, in the states its own behaviour leads to.
      </P>
      <H>Learning from failures too</H>
      <P>
        Physical Intelligence’s π*0.6 with RECAP (November 2025) uses three kinds of data: demonstrations, expert teleop corrections, and the robot’s own autonomous attempts labelled by outcome. A value model estimates whether each action was better or worse than usual, and the policy is trained on that signal, so failed attempts teach something instead of being thrown away. Throughput on the hardest tasks more than doubled and failures fell at least twofold; it made espresso for a full day at over 90% success, folded about 50 garments it had never seen, and assembled 59 boxes in a row.
      </P>
      <H>Fleets as flywheels</H>
      <P>
        Deployed robots can produce data at deployment scale: log every failure and intervention, train on them, redeploy, repeat. It is the playbook self-driving companies used. 1X built its NEO home humanoid this way: remote “experts” teleoperate it through tasks it can’t do yet, and the company has said those sessions train the model, which makes customers’ homes into data-collection sites (with obvious privacy questions).
      </P>
      <Note title="The cold-start problem">A fleet only produces data once robots are useful enough that people will pay to have them. Until then, there is no fleet. Teleop-assisted products are one way across the gap; the locked fleet slider in Data Budget Tycoon is the same idea.</Note>
      <H>The budget arithmetic</H>
      <P>A rough sum from the research notes behind this course: what one million hours of data would cost at different rates.</P>
      <Table
        rows={[
          ['Source and rate', 'Cost of 1,000,000 hours'],
          ['Egocentric wearables at ~$40/h', '~$40 million'],
          ['US teleop at ~$100/h', '~$100 million'],
          ['Teleop at fully loaded facility rates', '~$600 million'],
        ]}
      />
      <P>
        Generalist’s GEN-1 corpus is already about 500,000 hours, almost all from wearables. No one could have paid for that with teleop. That is the economics behind the consensus at the end of the film: a wide base of cheap human data, with a thin layer of the robot’s own data on top. How thin is still argued over. NVIDIA’s EgoScale used about 4 hours of robot data on top of 20,854 hours of human video; others think each new task needs its own hour, and some labs keep building teleop farms of thousands of hours.
      </P>
      <Numbers
        items={[
          ['2011', 'DAgger: let the expert label where the learner actually goes'],
          ['> 2×', 'π*0.6 throughput gain on its hardest tasks'],
          ['59', 'boxes assembled in a row by π*0.6'],
          ['~$40M–600M', 'rough cost of a million hours, by source'],
        ]}
      />
      <Note title="About the game">The model inside Data Budget Tycoon is a toy, written to make three claims from the research visible: all-teleop lacks diversity, all-video lacks grounding, and a mix wins. The prices are the rough ones above; the curves are hand-tuned, not measured.</Note>
      <Think q="Why can’t a start-up begin with fleet data, if it’s the best?">
        Fleet data comes from robots doing real work, and nobody deploys a robot that fails most of the time. The first useful version has to be built from other sources, usually teleop plus cheap human data, before the flywheel can start.
      </Think>
      <Sources
        items={[
          ['DAgger (Ross, Gordon & Bagnell, 2011)', 'https://arxiv.org/abs/1011.0686'],
          ['HG-DAgger (2019)', 'https://arxiv.org/abs/1810.02890'],
          ['Physical Intelligence: π*0.6 and RECAP', 'https://www.pi.website/blog/pistar06'],
          ['π*0.6 summary', 'https://aiwiki.ai/wiki/pi_star_0_6'],
          ['TechSpot: 1X NEO and remote experts', 'https://www.techspot.com/news/110056-first-consumer-humanoid-robot-here-but-strangers-see.html'],
          ['Generalist GEN-1', 'https://generalistai.com/blog/apr-02-2026-GEN-1'],
          ['EgoScale (NVIDIA, 2026)', 'https://arxiv.org/html/2602.16710'],
          ['What a robot hour actually costs', 'https://insidecm.substack.com/p/what-a-robot-hour-actually-costs'],
        ]}
      />
    </>
  )
}

export const FleetsReading: Reading = {
  id: 'fleets',
  title: 'Fleets, interventions and learning from mistakes',
  blurb: 'DAgger, learning from failures, fleets as data flywheels, the cold-start problem, and the cost of a million hours.',
  minutes: 6,
  Body: FleetsBody,
}
