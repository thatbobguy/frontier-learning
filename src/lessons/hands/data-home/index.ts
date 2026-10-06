import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const dataHome: FlowLesson = {
  id: 'data-home',
  title: 'The Home Robot Frontier',
  tagline: 'Why the home is the hardest place on Earth for a robot, how you’d even know a robot is good enough, the privacy bargain, and the open questions nobody has answered.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
