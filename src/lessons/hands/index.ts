import type { FlowLesson } from '../../flow/types'
import { handsJoints } from './joints'
import { handsMuscle } from './muscle'
import { handsTouch } from './touch'
import { handsFactory } from './factory'
import { handsFrontier } from './frontier'
import { dataGap } from './data-gap'
import { dataCollect } from './data-collect'
import { dataLearn } from './data-learn'
import { dataHome } from './data-home'
import { handsWhy } from './why'

/** Every film in the robot hands course, by lesson id. */
export const HANDS_LESSONS: Record<string, FlowLesson | undefined> = {
  [handsWhy.id]: handsWhy,
  [handsJoints.id]: handsJoints,
  [handsMuscle.id]: handsMuscle,
  [handsTouch.id]: handsTouch,
  [handsFactory.id]: handsFactory,
  [handsFrontier.id]: handsFrontier,
  [dataGap.id]: dataGap,
  [dataCollect.id]: dataCollect,
  [dataLearn.id]: dataLearn,
  [dataHome.id]: dataHome,
}
