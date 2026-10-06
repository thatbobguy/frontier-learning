import { C } from '../../../cine/palette'
import { Figure, Formula, H, Lede, List, Note, Numbers, P, Sources, Table, Think } from '../../../flow/Reading'
import type { Reading } from '../../../flow/types'

/* ------------------------------------------------------------------ */
/* Chapter 1                                                           */
/* ------------------------------------------------------------------ */

function BehaviourCloningBody() {
  // ε·T² against ε·T, for the figure
  const T = Array.from({ length: 41 }, (_, i) => i)
  const sq = T.map((t) => `${60 + t * 12} ${230 - (t * t) / 9}`).join(' L')
  const lin = T.map((t) => `${60 + t * 12} ${230 - t * 1.6}`).join(' L')
  return (
    <>
      <Lede>The simplest way to teach a robot is to show it what to do and have it copy. Why that works surprisingly well, why it quietly falls apart over long tasks, and the three standard fixes.</Lede>
      <H>Copying is supervised learning</H>
      <P>
        Behaviour cloning (BC) treats a demonstration as a list of pairs: an observation (camera images, joint positions, sometimes touch) and the action the demonstrator took at that moment (joint targets or a gripper pose). A neural network, the policy, is trained to output the demonstrator’s action when shown the same observation. That is ordinary supervised learning, the same recipe as teaching a network to label photos: minimise the error between the policy’s action and the human’s. It is simple, stable and easy to scale, and its quality is capped at the demonstrator’s: it learns to be as good as Kofi, never better.
      </P>
      <H>The catch: the robot visits places the human never did</H>
      <P>
        In ordinary supervised learning the test examples come from the same distribution as the training examples. In robotics they don’t, because the robot’s own actions decide what it sees next. A tiny error moves it to a slightly different state than any in the demonstrations. In that unfamiliar state its prediction is a bit worse, so the next error is bigger, which takes it somewhere even less familiar. This is called distribution shift, and its effect is compounding error.
      </P>
      <P>
        Stéphane Ross and Drew Bagnell made this precise. If the policy makes a mistake with probability ε at each step on the states the expert visited, then over a task of T steps the expected number of mistakes for behaviour cloning can grow like ε·T², because each early mistake can push the robot off the expert’s distribution for the rest of the task. A learner trained on the states it actually visits gets mistakes growing only like ε·T. Double the length of the task and the bound on cloning’s errors quadruples.
      </P>
      <Figure caption="How the bound on mistakes grows with the length of the task: behaviour cloning (red) against a learner trained on its own states (lime). Shapes only, for intuition.">
        <svg viewBox="0 0 600 270" role="img" aria-label="Two curves: one bending steeply upward labelled epsilon T squared, one straight and low labelled epsilon T.">
          <rect width={600} height={270} fill={C.ink1} />
          <path d="M60 30 V230 H570" stroke={C.fog} fill="none" />
          <path d={`M${sq}`} stroke={C.danger} strokeWidth={3} fill="none" />
          <path d={`M${lin}`} stroke={C.lime} strokeWidth={3} fill="none" />
          <text x={470} y={60} fill={C.danger} fontSize={16}>
            ε·T² (cloning)
          </text>
          <text x={470} y={186} fill={C.lime} fontSize={16}>
            ε·T (DAgger)
          </text>
          <text x={560} y={255} textAnchor="end" fill={C.mist} fontSize={14}>
            task length T →
          </text>
          <text x={52} y={24} fill={C.mist} fontSize={14}>
            expected mistakes
          </text>
        </svg>
      </Figure>
      <Formula tex="BC: O(ε·T²)    DAgger: O(ε·T)">ε is the per-step error rate on the expert’s own states; T is the number of steps in the task.</Formula>
      <H>Fix 1: show it how to recover</H>
      <P>
        The cure follows from the diagnosis: the policy needs data in the states it drifts into. One way is to collect demonstrations that include recoveries: start the robot slightly off course, or nudge it during a demo, and record the expert steering back. The research notes put it bluntly: data that covers recovery behaviour is disproportionately valuable, and perfectly clean expert demos can be worse than slightly noisy demos that include recoveries. In this film’s play, the recovery demos are expert runs that start beside the lane and steer back in.
      </P>
      <H>Fix 2: step in when it drifts (DAgger)</H>
      <P>
        DAgger (Dataset Aggregation, Ross, Gordon and Bagnell, 2011) runs the learner, lets it visit whatever states it visits, and asks the expert what it should have done in each of them. Those labels are added to the data and the policy is retrained; repeat. Because the training data now comes from the learner’s own state distribution, the ε·T² problem goes away. HG-DAgger (2019) makes this practical with people: the human watches and takes over only when things go wrong, and the corrections become training data. Interventions are prized because they are concentrated exactly on the policy’s failure modes, which is why fleets of deployed robots log every human takeover.
      </P>
      <H>Fix 3: predict a chunk of actions at once</H>
      <P>
        ACT (Action Chunking with Transformers, built with the low-cost ALOHA bimanual rig in 2023) predicts a short sequence of future actions instead of a single one. That cuts the number of decision points by the chunk length k, so there are fewer chances for errors to compound, and it smooths over the pauses and hesitations in human demos. ACT also predicts a new chunk at every step and blends the overlapping chunks in time (temporal ensembling), which keeps motion smooth. With about 50 demonstrations, roughly ten minutes of demos, it reached 80 to 90% success on fine bimanual tasks such as inserting a battery or opening a cup. Physical Intelligence’s π0 predicts 50-step chunks at up to 50 Hz.
      </P>
      <Numbers
        items={[
          ['ε·T² vs ε·T', 'cloning’s error bound vs a learner trained on its own states'],
          ['~50 demos', 'enough for ACT on one fine bimanual task (80–90%)'],
          ['50 steps, 50 Hz', 'π0’s action chunk and control rate'],
        ]}
      />
      <Note title="About the play">
        The drift play is a real, tiny version of all this: a nearest-neighbour policy copies the five demos, each decision lands slightly off (more so in states far from any demo), and you can watch the error curve bend upward. Recovery demos, stepping in, and 10-step chunks each change the data or the number of decisions, not the robot, and each is enough to get it home.
      </Note>
      <Think q="Why not just collect a thousand perfect demonstrations instead of five?">
        A thousand perfect demos still all hug the expert’s path, so they barely cover the drifted states where the trouble starts. More of the same data sharpens the policy where it was already good. What it lacks is data in the places it ends up when it goes wrong, which is why recovery data and interventions are worth so much more per demo.
      </Think>
      <Sources
        items={[
          ['Ross, Gordon & Bagnell: A Reduction of Imitation Learning to No-Regret Online Learning (DAgger)', 'https://arxiv.org/abs/1011.0686'],
          ['Kelly et al.: HG-DAgger, interactive imitation learning with human experts', 'https://arxiv.org/abs/1810.02890'],
          ['Zhao et al.: Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware (ACT, ALOHA)', 'https://arxiv.org/abs/2304.13705'],
          ['Black et al.: π0, a vision-language-action flow model', 'https://arxiv.org/html/2410.24164v3'],
        ]}
      />
    </>
  )
}

export const BehaviourCloningReading: Reading = {
  id: 'behaviour-cloning',
  title: 'Behaviour cloning and compounding error',
  blurb: 'Why copying demos drifts (ε·T² against ε·T), and how recovery data, DAgger and action chunking fix it.',
  minutes: 6,
  Body: BehaviourCloningBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 2                                                           */
/* ------------------------------------------------------------------ */

function MultimodalityBody() {
  return (
    <>
      <Lede>When there is more than one good way to do something, a learner that predicts the average invents a way that is bad. Why that happens, and the three families of policies built to avoid it.</Lede>
      <H>Multimodal demonstrations</H>
      <P>
        Human demonstrations are rarely consistent. Going round an obstacle on the left and on the right are both valid; one operator grasps a mug by the handle, another by the rim; someone pauses, someone doesn’t. Statisticians call a distribution with several separate peaks multimodal. Robot demonstration data is full of it, because different people (and the same person on different days) solve tasks in different ways.
      </P>
      <H>Why the average is a trap</H>
      <P>
        The simplest policy is a regression network trained with mean-squared error: for each observation, output the action that minimises the squared distance to the demonstrated actions. The answer that minimises squared error is the mean. If half the demos swerve left and half swerve right, the mean goes straight ahead, into the vase. This is not a bug in training; it is exactly what the loss asks for. The more evenly the good options are split, the more confidently the policy picks the one bad option between them.
      </P>
      <Figure caption="Two good modes and their average. A model trained to minimise squared error learns the dashed line.">
        <svg viewBox="0 0 600 240" role="img" aria-label="A vase in the middle; lime paths curve around it on both sides; a white dashed average path goes straight through it.">
          <rect width={600} height={240} fill={C.ink1} />
          <circle cx={300} cy={120} r={30} fill="#2d5d73" stroke="#7fb8cf" />
          <path d="M40 120 C 140 120 200 30 300 30 S 460 120 560 120" stroke={C.lime} strokeWidth={3} fill="none" />
          <path d="M40 120 C 140 120 200 210 300 210 S 460 120 560 120" stroke={C.lime} strokeWidth={3} fill="none" />
          <path d="M40 120 H 560" stroke={C.paper} strokeWidth={3} strokeDasharray="10 7" fill="none" />
          <text x={300} y={20} textAnchor="middle" fill={C.lime} fontSize={14}>
            mode 1
          </text>
          <text x={300} y={232} textAnchor="middle" fill={C.lime} fontSize={14}>
            mode 2
          </text>
          <text x={350} y={112} fill={C.danger} fontSize={15}>
            average: crash
          </text>
        </svg>
      </Figure>
      <H>Fix 1: diffusion policies</H>
      <P>
        Diffusion Policy (Chi et al., 2023) borrows the idea behind image generators. Instead of predicting one action, it learns to turn random noise into a realistic action chunk by removing a little noise at a time. At each step a network predicts which direction makes the current guess more like the demonstrations. Early on, both modes pull about equally; as the noise shrinks, the guess falls into one basin and commits. Run it again with different noise and it may commit to the other side. Because it models the whole distribution, it never has to average. Across the benchmarks in the paper it improved success by about 47% on average over the previous best methods.
      </P>
      <H>Fix 2: flow matching</H>
      <P>
        Flow matching learns a smooth velocity field that carries noise to actions along nearly straight paths, so a good action can be produced in a few integration steps. Physical Intelligence’s π0 uses it with 10 steps, fast enough to produce 50-step action chunks for control at up to 50 Hz. It keeps the main virtue of diffusion, sampling one coherent option from a multimodal distribution, at a lower cost per decision.
      </P>
      <H>Fix 3: actions as tokens</H>
      <P>
        The third route avoids continuous regression altogether. Discretise and compress actions into tokens, the way text is split into word pieces, and let a language-model head predict the next token, which is a probability distribution over options. Sampling from it picks one mode. PI’s FAST tokenizer (January 2025) compresses action chunks this way so that a VLA’s ordinary next-token machinery can output them.
      </P>
      <Table
        rows={[
          ['Policy head', 'How it picks an action chunk', 'Handles several modes?'],
          ['Regression (MSE)', 'one forward pass, outputs the mean', 'No: averages them'],
          ['Diffusion', 'denoise random noise over many steps', 'Yes'],
          ['Flow matching', 'integrate a learned velocity field (π0: 10 steps)', 'Yes'],
          ['Tokens (e.g. FAST)', 'sample discrete action tokens one by one', 'Yes'],
        ]}
      />
      <Note title="Two other ways people cope">
        Expressive policies are one answer. The other is upstream: write collection protocols that keep strategies consistent (always go left of the obstacle), so the data has fewer modes in the first place. Most labs do some of both.
      </Note>
      <Note title="About the play">
        The averager in the vase play really computes the point-by-point mean of your paths. The sampler groups your paths by which way they go round, picks a group with probability in proportion to its size, and follows that group’s mean: a cartoon of what diffusion and token policies do, minus the neural network. Lifted paths are averaged too, and a third of a lift is not enough to clear a vase.
      </Note>
      <Think q="If the averager is so bad, why does it work fine on many tasks?">
        When the demonstrations agree, the mean is a good action. Averaging only bites when good options are separated by bad ones: an obstacle, a choice of grasp, a choice of order. Those choices are everywhere in homes, which is why expressive policy heads became standard.
      </Think>
      <Sources
        items={[
          ['Chi et al.: Diffusion Policy, visuomotor policy learning via action diffusion', 'https://arxiv.org/abs/2303.04137'],
          ['Black et al.: π0 (flow matching action expert)', 'https://arxiv.org/html/2410.24164v3'],
          ['Pertsch et al.: FAST, efficient action tokenization for VLAs', 'https://arxiv.org/abs/2501.09747'],
        ]}
      />
    </>
  )
}

export const MultimodalityReading: Reading = {
  id: 'multimodality',
  title: 'Why averaging fails: diffusion, flow matching and tokens',
  blurb: 'Multimodal demos, why mean-squared error drives into the vase, and the three policy heads that pick one option.',
  minutes: 6,
  Body: MultimodalityBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 3                                                           */
/* ------------------------------------------------------------------ */

function ScalingBody() {
  const pts = [1, 2, 4, 8, 16, 32, 64].map((n) => {
    const s = (1 - 0.9 * Math.pow(n, -0.65)) * (1 - Math.exp(-1600 / n / 12))
    return { n, x: 60 + (Math.log(n) / Math.log(64)) * 500, y: 220 - s * 190 }
  })
  return (
    <>
      <Lede>“Scaling laws” made language models predictable: more data, lower loss, on a straight line. Robotics now has its own scaling results. What they really measured, what they suggest about how to spend a data budget, and where to be careful.</Lede>
      <H>Lin et al.: rooms beat repetitions</H>
      <P>
        The cleanest result comes from “Data Scaling Laws in Imitation Learning for Robotic Manipulation” (Lin et al., October 2024, an oral at ICLR 2025). The team collected over 40,000 demonstrations with handheld UMI grippers and ran over 15,000 real-world test rollouts, varying how many distinct environments and objects the data covered and how many demos were recorded in each. Generalisation to new environments and objects followed a power law in the number of distinct environment–object pairs, while adding more demos per environment saturated quickly. About 32 environment–object pairs with about 50 demos each gave roughly 90% success in environments and on objects the policy had never seen. Their advice: collect in as many environments as possible, with one object per environment. Four people collecting for one afternoon gathered enough data for a new task.
      </P>
      <Figure caption="The shape of the result, as in the rooms play: 1,600 demos split across N rooms. Illustrative model, not the paper’s exact curve.">
        <svg viewBox="0 0 600 250" role="img" aria-label="Success in unseen rooms rises steeply from 1 to 16 rooms, peaks near 32 rooms, and dips slightly at 64 rooms where each room has only 25 demos.">
          <rect width={600} height={250} fill={C.ink1} />
          <path d="M60 20 V220 H560" stroke={C.fog} fill="none" />
          <path d={`M${pts.map((p) => `${p.x} ${p.y}`).join(' L')}`} stroke={C.lime} strokeWidth={3} fill="none" />
          {pts.map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r={5} fill={C.lime} />
              <text x={p.x} y={240} textAnchor="middle" fill={C.mist} fontSize={13}>
                {p.n}
              </text>
            </g>
          ))}
          <text x={52} y={16} fill={C.mist} fontSize={13}>
            success in unseen rooms
          </text>
          <text x={560} y={210} textAnchor="end" fill={C.mist} fontSize={13}>
            rooms (log scale)
          </text>
        </svg>
      </Figure>
      <Note title="About the play’s model">
        The rooms play uses a simple formula shaped like Lin et al.’s finding, success ≈ (1 − 0.9·N^−0.65) × (1 − e^(−d/12)) for N rooms with d demos each, then samples 20 test kitchens so the measured result is noisy, as real evaluations are. It reproduces the headline (about 89% at 32 × 50) but it is a teaching model, not a fit to the paper’s data.
      </Note>
      <H>π0.5: more homes, and the right mix</H>
      <P>
        Physical Intelligence’s π0.5 (April 2025) was trained on about 400 hours of mobile manipulation from about 100 homes, plus data from other robots, web data and subtask labels, and tested on cleaning tasks in homes it had never seen. Performance on unseen homes rose steadily with the number of training homes; at about 100 environments it approached a model trained directly on the test homes. The ablations show what each ingredient buys, measured as success out of distribution:
      </P>
      <Table
        rows={[
          ['Training mixture', 'Success in unseen homes'],
          ['Full mixture', '94%'],
          ['No web data', '74%'],
          ['No cross-embodiment data (other robots)', '49%'],
          ['Only multi-environment mobile data', '31%'],
        ]}
      />
      <H>Bigger corpora, bigger claims</H>
      <List
        items={[
          <>
            <b>Generalist GEN-0</b> (November 2025) reported a power law between pretraining hours (its corpus was 270,000 hours of real-world manipulation) and downstream post-training loss, and “ossification”: models around 1B parameters stopped absorbing more data, around 6B did well, and 7B and up kept improving. This is a company blog claim, not peer-reviewed.
          </>,
          <>
            <b>NVIDIA EgoScale</b> (February 2026) found log-linear improvement with hours of egocentric human video (20,854 hours, R² ≈ 0.998 on validation loss).
          </>,
        ]}
      />
      <H>Read the small print</H>
      <List
        items={[
          'Most robot “scaling laws” are measured on loss or on narrow task suites, not on long, real-world chores where reliability compounds step by step.',
          'Real-world evaluation is noisy: with 50 trials, the 95% confidence interval on an 80% success rate is about ±11 points. Curves made of success rates are fuzzy.',
          'Company claims often lack independent replication.',
        ]}
      />
      <Numbers
        items={[
          ['32 × 50 ≈ 90%', 'environments × demos, success in unseen places (Lin et al.)'],
          ['94% → 31%', 'π0.5 in unseen homes, full mix vs only its own home data'],
          ['±11 points', '95% interval on 80% success with 50 trials'],
        ]}
      />
      <Think q="If diversity wins, why does anyone record hundreds of demos in one place?">
        For a narrow job in a fixed place (one factory cell, one benchmark) repetition is exactly what you need, and per-task results like ACT’s 50 demos show it is cheap. Diversity matters when the robot must work somewhere new. A home robot always is, so the home-robot companies chase environments, not repetitions.
      </Think>
      <Sources
        items={[
          ['Lin et al.: Data Scaling Laws in Imitation Learning for Robotic Manipulation', 'https://arxiv.org/html/2410.18647v3'],
          ['Physical Intelligence: π0.5', 'https://www.pi.website/blog/pi05'],
          ['Generalist: GEN-0', 'https://generalistai.com/blog/gen-0'],
          ['NVIDIA: EgoScale', 'https://arxiv.org/html/2602.16710'],
        ]}
      />
    </>
  )
}

export const ScalingReading: Reading = {
  id: 'scaling',
  title: 'What the scaling results actually say',
  blurb: 'Lin et al.’s rooms-versus-reps result, π0.5’s data-mix ablations, GEN-0 and EgoScale, and the caveats.',
  minutes: 6,
  Body: ScalingBody,
}

/* ------------------------------------------------------------------ */
/* Chapter 4                                                           */
/* ------------------------------------------------------------------ */

function VlaBody() {
  return (
    <>
      <Lede>Today’s leading robot brains start from models that already read and see, then learn to act. A short history of vision-language-action models, how robots learn from their own practice, and what world models can and cannot do yet.</Lede>
      <H>From a vision-language model to an action model</H>
      <P>
        A vision-language-action model (VLA) begins life as a vision-language model trained on web images and text. It already knows what a mug looks like, what “the sink” refers to and what people tend to do in kitchens. Robot data is then used to add an action output: either actions written as tokens the language model can predict, or a separate “action expert” network that turns the model’s understanding into smooth joint trajectories. π0, for example, is about 3.3 billion parameters: a 3B PaliGemma vision-language model plus a 300M flow-matching action expert.
      </P>
      <Figure caption="The usual VLA layout: a pretrained vision-language backbone, with an action expert that outputs a chunk of joint targets.">
        <svg viewBox="0 0 600 220" role="img" aria-label="Camera image and an instruction feed a vision-language model, which feeds a smaller action expert that outputs trajectories.">
          <rect width={600} height={220} fill={C.ink1} />
          <rect x={30} y={40} width={100} height={60} rx={6} fill={C.ink3} stroke={C.rim} />
          <text x={80} y={76} textAnchor="middle" fill={C.cyanLight} fontSize={13}>
            camera
          </text>
          <rect x={30} y={120} width={100} height={60} rx={6} fill={C.ink3} stroke={C.mist} />
          <text x={80} y={155} textAnchor="middle" fill={C.mist} fontSize={13}>
            instruction
          </text>
          <rect x={180} y={30} width={200} height={160} rx={20} fill="none" stroke={C.lime} strokeWidth={2.5} />
          <text x={280} y={115} textAnchor="middle" fill={C.lime} fontSize={15}>
            vision-language model
          </text>
          <rect x={410} y={70} width={80} height={80} rx={12} fill="none" stroke={C.lime} strokeWidth={2.5} />
          <text x={450} y={115} textAnchor="middle" fill={C.lime} fontSize={12}>
            action
          </text>
          <path d="M130 70 H180 M130 150 H180 M380 110 H410" stroke={C.fog} strokeWidth={2} />
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M490 ${95 + k * 15} c 20 -10 40 10 60 0 s 20 -8 30 0`} stroke={C.cyan} strokeWidth={2} fill="none" />
          ))}
        </svg>
      </Figure>
      <Table
        rows={[
          ['Model', 'Date', 'What it added'],
          ['RT-1 (Google)', 'Dec 2022', '~130k episodes, 13 robots, 17 months; discretised actions'],
          ['RT-2', 'Jul 2023', 'VLM co-trained on web + robot data; actions as text tokens; semantic transfer'],
          ['Octo', 'May 2024', 'open generalist policy, ~800k OXE trajectories, diffusion head'],
          ['OpenVLA', 'Jun 2024', '7B, 970k OXE episodes'],
          ['π0', 'Oct 2024', '3.3B; ~10,000 h, 7 robot configs, 68 tasks; flow matching'],
          ['π0.5', 'Apr 2025', 'co-training across homes, robots and web; cleaned unseen homes'],
          ['Gemini Robotics 1.5', 'Sep 2025', 'thinks before acting; Motion Transfer across robot bodies'],
          ['π*0.6', 'Nov 2025', '~5B; RECAP reinforcement learning from experience'],
          ['π0.7', 'Apr 2026', 'air fryer from 2 relevant episodes by composing skills'],
        ]}
      />
      <H>Many bodies, one brain</H>
      <P>
        Cross-embodiment training pools data from many robots so each benefits from the others. The Open X-Embodiment collection (2023: over a million trajectories, 22 embodiments, from 21+ institutions) showed models trained on the pool beating single-robot models. Google DeepMind’s Gemini Robotics 1.5 reported “Motion Transfer”: skills learned on its ALOHA 2 robot working on an Apptronik Apollo humanoid and a bi-arm Franka without per-robot specialisation. Making this work takes care: padding or normalising action spaces, per-robot action heads, or a shared frame such as end-effector motions.
      </P>
      <H>Practice: learning from its own attempts</H>
      <P>
        Imitation is capped at the demonstrator. Reinforcement learning lets the robot improve past it. Physical Intelligence’s π*0.6 with RECAP (November 2025) trained on demonstrations, expert corrections and its own autonomous attempts, each labelled by how it turned out. A value model estimates whether each action was better or worse than usual (its “advantage”); the policy is trained conditioned on that advantage, then asked for good actions when it runs. That lets failed attempts teach it too, instead of being thrown away. Reported results: throughput more than doubled and failures were cut at least in half on the hardest tasks; espresso ran for a full day at over 90% success; about 50 new garments were folded unattended; 59 boxes were assembled in a row. These are the company’s own reports.
      </P>
      <H>World models: a dream to practise in</H>
      <P>
        A world model is a learned simulator: given what the camera sees and an action, it predicts the next frames. Labs use them to evaluate policies without a real robot, to make synthetic training data, and to plan (imagine a video of the task, then recover actions from it, as 1X’s world model does). Their weakness mirrors simulation’s: contact physics and fine dexterity. 1X’s world model scored 0% on pouring and on drawing. A dream that cannot pour can still be useful for checking where a policy looks and what it reaches for, but it cannot yet replace practice in the real world.
      </P>
      <Note title="The missing sense">
        Almost all large robot datasets are vision plus joint positions. Touch matters most in the hardest home tasks (cloth, insertion, fragile things, in-hand moves), but tactile sensors are not standardised, demonstrators can’t easily transmit touch through teleoperation, and simulators render it badly. In 2026 there were first moves: Figure’s Helix 02 fingertips sense down to about 3 g, and NeoData released a preprint describing 30,000+ hours of visual plus tactile data. Whether touch must be in pretraining is an open question.
      </Note>
      <Numbers
        items={[
          ['3.3B', 'π0: a 3B vision-language model + a 300M action expert'],
          ['>90%', 'π*0.6 espresso success over a full day (company report)'],
          ['0%', '1X world model on pouring'],
        ]}
      />
      <Think q="Why would web pictures help a robot that has to move its fingers?">
        They don’t teach the fingers anything. They teach the model what things are and what an instruction means, so the robot data can be spent on the hard, body-specific part: how to move. RT-2 showed this as semantic transfer, following instructions about objects and concepts that never appeared in its robot data.
      </Think>
      <Sources
        items={[
          ['Brohan et al.: RT-2', 'https://arxiv.org/abs/2307.15818'],
          ['Open X-Embodiment', 'https://arxiv.org/abs/2310.08864'],
          ['Black et al.: π0', 'https://arxiv.org/html/2410.24164v3'],
          ['Google DeepMind: Gemini Robotics 1.5', 'https://deepmind.google/blog/gemini-robotics-15-brings-ai-agents-into-the-physical-world/'],
          ['Physical Intelligence: π*0.6 and RECAP', 'https://www.pi.website/blog/pistar06'],
          ['1X: world model and self-learning', 'https://1x.tech/discover/world-model-self-learning'],
          ['NeoData visuo-tactile preprint', 'https://www.alphaxiv.org/abs/2608.29601'],
        ]}
      />
    </>
  )
}

export const VlaReading: Reading = {
  id: 'vlas',
  title: 'Vision-language-action models, RL and world models',
  blurb: 'The VLA lineage from RT-1 to π0.7, cross-embodiment training, RECAP practice, and why world models can’t pour yet.',
  minutes: 7,
  Body: VlaBody,
}
