import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1ColdOpen'
import { WhyPoster } from './Poster'

export const handsWhy: FlowLesson = {
  id: 'hands-why',
  title: 'The Hardest Machine',
  tagline: 'Robots can do backflips, but they can’t reliably pick up an egg. Why the hand is the hardest part of a robot, and the five questions every hand must answer.',
  age: 'Teens and adults',
  minutes: 8,
  chapters: [ch1],
  Poster: WhyPoster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
