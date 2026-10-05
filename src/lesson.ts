import type { Stop } from './engine/types'
import { stop1 } from './scenes/Stop1Origin'
import { stop2 } from './scenes/Stop2Map'
import { stop3 } from './scenes/Stop3Names'
import { stop4 } from './scenes/Stop4Bundles'
import { stop5 } from './scenes/Stop5Change'
import { teaserNext } from './scenes/TeaserNext'
import { teaserShape } from './scenes/TeaserShape'

/** The lesson in order: the core path, then the branches a student can choose. */
export const STOPS: Stop[] = [stop1, stop2, stop3, stop4, stop5, teaserNext, teaserShape]
