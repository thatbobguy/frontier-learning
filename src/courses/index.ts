import { C } from '../cine/palette'
import { HANDS_LESSONS } from '../lessons/hands'
import type { Course } from './types'

const L = HANDS_LESSONS

/**
 * Robot hands: the trunk runs through how a hand works, from the big picture to the
 * frontier; the data branch splits off after the first film for learners who want the
 * brain's side of the story.
 */
export const robotHands: Course = {
  id: 'robot-hands',
  title: 'Robot Hands: The Frontier',
  tagline: 'How the most advanced robot hands work, how they will be built by the million, and the problems nobody has solved yet.',
  audience: 'a curious teenager or adult, new to robotics, who wants to understand the industry well enough to work in it',
  branches: [
    { id: 'trunk', title: 'How hands work', blurb: 'The five questions every robot hand must answer, one film at a time.', color: C.amber },
    { id: 'data', title: 'The data problem', blurb: 'Where a robot’s brain learns from, and why there is no internet of robot actions.', color: C.lime },
  ],
  nodes: [
    { id: 'hands-why', branch: 'trunk', lesson: L['hands-why'], title: 'The Hardest Machine', blurb: 'Why robots can backflip but can’t pick up an egg, and the five questions every hand must answer.', at: [0, 0] },
    { id: 'hands-joints', branch: 'trunk', parent: 'hands-why', lesson: L['hands-joints'], title: 'Joints and Freedom', blurb: 'Degrees of freedom, underactuation, synergies and the trouble with thumbs.', at: [0, 1] },
    { id: 'hands-muscle', branch: 'trunk', parent: 'hands-joints', lesson: L['hands-muscle'], title: 'Muscles of Metal', blurb: 'Motors, gears and tendons: how force gets from a battery to a fingertip.', at: [0, 2] },
    { id: 'hands-touch', branch: 'trunk', parent: 'hands-muscle', lesson: L['hands-touch'], title: 'The Sense of Touch', blurb: 'How a hand knows what it is holding, and why skin is so hard to build.', at: [0, 3] },
    { id: 'hands-factory', branch: 'trunk', parent: 'hands-touch', lesson: L['hands-factory'], title: 'A Million Hands', blurb: 'Cost, molds, magnets and durability: turning a lab hand into a product.', at: [0, 4] },
    { id: 'hands-frontier', branch: 'trunk', parent: 'hands-factory', lesson: L['hands-frontier'], title: 'Build Your Own Hand', blurb: 'Design a hand for a real customer, then meet the open problems of the field.', see: ['data-gap'], at: [0, 5] },
    { id: 'data-gap', branch: 'data', parent: 'hands-why', lesson: L['data-gap'], title: 'The Missing Internet', blurb: 'Language models read trillions of words. Robots have no internet of actions.', at: [1.4, 1.2] },
    { id: 'data-collect', branch: 'data', parent: 'data-gap', lesson: L['data-collect'], title: 'Ways to Get Data', blurb: 'Teleoperation, gloves, human video, simulation and fleets, and what each costs.', at: [1.9, 2.2] },
    { id: 'data-learn', branch: 'data', parent: 'data-collect', lesson: L['data-learn'], title: 'How Robots Learn', blurb: 'Behaviour cloning, drift, diffusion policies and the models that run today’s robots.', at: [2.2, 3.2] },
    { id: 'data-home', branch: 'data', parent: 'data-learn', lesson: L['data-home'], title: 'The Home Robot Frontier', blurb: 'Why your kitchen is the hardest place on Earth for a robot, and the open questions.', at: [2.3, 4.2] },
  ],
}

export const courses: Record<string, Course> = { [robotHands.id]: robotHands }
