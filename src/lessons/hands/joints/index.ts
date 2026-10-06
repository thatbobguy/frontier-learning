import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const handsJoints: FlowLesson = {
  id: 'hands-joints',
  title: 'Joints and Freedom',
  tagline: 'Degrees of freedom, fewer motors than joints, the two hidden patterns behind every grasp, and why the thumb is the hardest finger to build.',
  age: 'Teens and adults',
  minutes: 9,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
