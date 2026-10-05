import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from './placeholder'

export const CUES: Cue[] = [
  { id: 'intro', say: 'Time to put it all together. Three scales, three mystery sacks. Keep every scale balanced, and find what each sack weighs.' },
  { id: 'p1', say: 'First: three sacks balance twelve weights.', play: true },
  { id: 'p2', say: 'Next: two sacks and three weights balance thirteen weights.', play: true },
  { id: 'p3-intro', say: 'Now the big one. This scale has sacks on both sides!' },
  { id: 'p3', say: 'Sacks are things too. Can you still get one sack all alone?', play: true },
  { id: 'wow', say: 'You just solved an equation with the unknown on both sides. For hundreds of years, that was cutting-edge math.' },
]

export const ch6: Chapter = {
  id: 'challenge',
  title: 'The balance challenge',
  cues: CUES,
  Scene: placeholderScene('The balance challenge', CUES),
  enter: { type: 'zoom', x: 800, y: 450 },
}
