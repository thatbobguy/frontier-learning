import { C } from '../../../cine/palette'
import { Figure, Lede, Note, Numbers, P, H, Sources, Think } from '../../../flow/Reading'
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
