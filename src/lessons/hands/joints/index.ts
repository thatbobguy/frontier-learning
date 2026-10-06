import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Dof'
import { ch2 } from './Ch2Under'
import { ch3 } from './Ch3Synergy'
import { ch4 } from './Ch4Thumb'
import { Poster } from './Poster'

export const handsJoints: FlowLesson = {
  id: 'hands-joints',
  title: 'Joints and Freedom',
  tagline: 'Degrees of freedom, fewer motors than joints, the two hidden patterns behind every grasp, and why the thumb is the hardest finger to build.',
  age: 'Teens and adults',
  minutes: 9,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
